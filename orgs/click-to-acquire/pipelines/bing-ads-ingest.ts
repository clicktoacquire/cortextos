#!/usr/bin/env tsx
/**
 * Bing Ads (Microsoft Ads) → BigQuery daily campaign ingest pipeline.
 *
 * Pulls CampaignPerformanceReport for the last 7 days across both sub-accounts
 * and writes campaign-level rows to click-to-acquire.analytics.daily_metrics.
 *
 * Auth flow:
 *   MSADS_REFRESH_TOKEN + MSADS_CLIENT_ID (+ optional MSADS_CLIENT_SECRET)
 *   → POST login.microsoftonline.com → access_token (1h TTL)
 *   → Bing Ads Reporting API v13 REST
 *
 * Required .env keys (orgs/click-to-acquire/.env):
 *   MSADS_DEVELOPER_TOKEN  — static developer token from MS Ads portal
 *   MSADS_CUSTOMER_ID      — manager account customer ID (254753433)
 *   MSADS_CLIENT_ID        — Azure app registration client_id (for OAuth)
 *   MSADS_CLIENT_SECRET    — Azure app client_secret (if confidential client)
 *   MSADS_REFRESH_TOKEN    — long-lived OAuth refresh token
 *
 * Usage:
 *   npx tsx bing-ads-ingest.ts               # last 7 days (default)
 *   npx tsx bing-ads-ingest.ts --days 1      # yesterday only
 *   npx tsx bing-ads-ingest.ts --date 2026-06-15  # specific date
 *   npx tsx bing-ads-ingest.ts --dry-run     # print rows, skip BQ write
 *
 * BQ write strategy:
 *   - entity_type = 'campaign', platform = 'bing'
 *   - Partition-safe: reads non-bing rows for each date, merges with new bing
 *     rows, then WRITE_TRUNCATE on the partition shard. Preserves Google/Meta data.
 *   - Rows with impressions=0 AND spend=0 are skipped.
 */

import path from "path";
import fs from "fs";
import { Readable } from "stream";
import { BigQuery, TableField } from "@google-cloud/bigquery";

// ---------------------------------------------------------------------------
// Config constants
// ---------------------------------------------------------------------------

const BQ_PROJECT = "click-to-acquire";
const BQ_DATASET = "analytics";
const BQ_TABLE = "daily_metrics";
const BQ_KEY_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ??
  `${process.env.HOME}/.cortextos/secrets/bigquery-key.json`;

const REPORTING_ENDPOINT =
  "https://reporting.api.bingads.microsoft.com/Api/Advertiser/Reporting/v13/ReportingService.svc/Json";

const TOKEN_ENDPOINT =
  "https://login.microsoftonline.com/common/oauth2/v2.0/token";

const RETRY_ATTEMPTS = 3;
const RETRY_BASE_MS = 2000;

// Sub-account definitions. Tag 'account_number' is the G-prefixed human ID.
// account_id is the numeric ID used in API calls.
// OC Repipes numeric ID is derived from the G120LJX7 tag — confirmed 188372907
// is Click To Acquire; OC Repipes must be resolved at runtime via account list.
const SUB_ACCOUNTS: SubAccount[] = [
  {
    account_id: "188372907",
    account_number: "G1206XSQ",
    name: "Click To Acquire",
    client_id: "click-to-acquire",
  },
  {
    // OC Repipes — numeric account_id resolved at runtime from G120LJX7 tag.
    // If resolution fails, falls back to this placeholder and logs a warning.
    account_id: "", // populated by resolveAccountId() at startup
    account_number: "G120LJX7",
    name: "OC Repipes",
    client_id: "oc-repipes",
  },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubAccount {
  account_id: string;
  account_number: string;
  name: string;
  client_id: string;
}

interface Env {
  MSADS_DEVELOPER_TOKEN: string;
  MSADS_CUSTOMER_ID: string;
  MSADS_CLIENT_ID: string;
  MSADS_CLIENT_SECRET: string;
  MSADS_REFRESH_TOKEN: string;
}

interface AccessTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

interface BingMetricRow {
  client_id: string;
  platform: "bing";
  campaign_id: string;
  campaign_name: string;
  entity_type: "campaign";
  metric_date: string;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_value: number;
  spend: number;
  ctr: number | null;
  cpc: number | null;
  ingested_at: string;
  // Extra bing-specific fields stored as extras (nullable in base schema)
  platform_campaign_id: string;
  account_id: string;
}

// ---------------------------------------------------------------------------
// .env loader
// ---------------------------------------------------------------------------

function loadEnv(): Partial<Record<string, string>> {
  const envPath = path.resolve(__dirname, "..", ".env");
  const result: Record<string, string> = {};
  if (!fs.existsSync(envPath)) {
    log("warn", `.env not found at ${envPath} — relying on process.env`);
    return result;
  }
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();
    result[key] = val;
  }
  return result;
}

function requireEnv(env: Partial<Record<string, string>>): Env {
  const required: (keyof Env)[] = [
    "MSADS_DEVELOPER_TOKEN",
    "MSADS_CUSTOMER_ID",
    "MSADS_CLIENT_ID",
    "MSADS_REFRESH_TOKEN",
  ];
  const missing: string[] = [];
  for (const k of required) {
    if (!env[k] && !process.env[k]) missing.push(k);
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing required env vars: ${missing.join(", ")}\n` +
        `Set them in orgs/click-to-acquire/.env`
    );
  }
  const get = (k: string) => env[k] ?? process.env[k] ?? "";
  return {
    MSADS_DEVELOPER_TOKEN: get("MSADS_DEVELOPER_TOKEN"),
    MSADS_CUSTOMER_ID: get("MSADS_CUSTOMER_ID"),
    MSADS_CLIENT_ID: get("MSADS_CLIENT_ID"),
    MSADS_CLIENT_SECRET: get("MSADS_CLIENT_SECRET"),
    MSADS_REFRESH_TOKEN: get("MSADS_REFRESH_TOKEN"),
  };
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function log(level: "info" | "warn" | "error", msg: string, ...args: unknown[]) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  const label = level.toUpperCase().padEnd(5);
  const extra = args.length ? " " + args.map((a) => JSON.stringify(a)).join(" ") : "";
  process.stderr.write(`${ts} ${label} ${msg}${extra}\n`);
}

// ---------------------------------------------------------------------------
// Retry helper
// ---------------------------------------------------------------------------

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  attempts = RETRY_ATTEMPTS
): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts) {
        const delay = RETRY_BASE_MS * Math.pow(2, i - 1);
        log("warn", `${label} attempt ${i}/${attempts} failed, retrying in ${delay}ms`, err);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// OAuth: exchange refresh token for access token
// ---------------------------------------------------------------------------

async function getAccessToken(env: Env): Promise<string> {
  log("info", "Exchanging refresh token for access token...");

  const body = new URLSearchParams({
    client_id: env.MSADS_CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: env.MSADS_REFRESH_TOKEN,
    scope: "https://ads.microsoft.com/msads.manage offline_access",
  });

  if (env.MSADS_CLIENT_SECRET) {
    body.set("client_secret", env.MSADS_CLIENT_SECRET);
  }

  const resp = await withRetry(
    () =>
      fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      }),
    "oauth-token-refresh"
  );

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OAuth token refresh failed ${resp.status}: ${text.slice(0, 300)}`);
  }

  const data = (await resp.json()) as AccessTokenResponse;
  log("info", `Access token obtained (expires_in=${data.expires_in}s)`);
  return data.access_token;
}

// ---------------------------------------------------------------------------
// Bing Ads API helpers
// ---------------------------------------------------------------------------

function bingHeaders(env: Env, accessToken: string, accountId: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    DeveloperToken: env.MSADS_DEVELOPER_TOKEN,
    CustomerId: env.MSADS_CUSTOMER_ID,
    CustomerAccountId: accountId,
  };
}

/**
 * Resolve the numeric account ID for an account number tag (e.g. G120LJX7).
 * Calls SearchAccounts API. Returns null if not found.
 */
async function resolveAccountId(
  env: Env,
  accessToken: string,
  accountNumber: string
): Promise<string | null> {
  log("info", `Resolving numeric account_id for ${accountNumber}...`);

  const payload = {
    AccountNumber: accountNumber,
    ApplicationScope: "Advertiser",
    Predicates: [
      { Field: "AccountNumber", Operator: "Equals", Value: accountNumber },
    ],
    Ordering: [{ Field: "Id", Order: "Ascending" }],
    PageInfo: { Index: 0, Size: 5 },
  };

  const resp = await withRetry(
    () =>
      fetch(
        "https://clientcenter.api.bingads.microsoft.com/Api/CustomerManagement/v13/CustomerManagementService.svc/Json/SearchAccounts",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            DeveloperToken: env.MSADS_DEVELOPER_TOKEN,
            CustomerId: env.MSADS_CUSTOMER_ID,
          },
          body: JSON.stringify(payload),
        }
      ),
    `resolve-account-${accountNumber}`
  );

  if (!resp.ok) {
    const text = await resp.text();
    log("warn", `SearchAccounts failed ${resp.status} for ${accountNumber}: ${text.slice(0, 200)}`);
    return null;
  }

  const data = (await resp.json()) as {
    Accounts?: { Id?: number; Number?: string }[];
  };
  const accounts = data.Accounts ?? [];
  const match = accounts.find(
    (a) => a.Number?.toUpperCase() === accountNumber.toUpperCase()
  );
  if (!match?.Id) {
    log("warn", `No account found for number ${accountNumber}`);
    return null;
  }
  log("info", `Resolved ${accountNumber} → ${match.Id}`);
  return String(match.Id);
}

/**
 * Submit a CampaignPerformanceReport job via the Reporting API.
 * Returns the ReportRequestId string.
 */
async function submitReportJob(
  env: Env,
  accessToken: string,
  accountId: string,
  startDate: string, // YYYY-MM-DD
  endDate: string    // YYYY-MM-DD
): Promise<string> {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);

  const payload = {
    ReportRequest: {
      "__type": "CampaignPerformanceReportRequest:#Microsoft.BingAds.Reporting",
      Format: "Csv",
      Language: "English",
      ReportName: `bing-ingest-${accountId}-${startDate}-${endDate}`,
      ReturnOnlyCompleteData: false,
      Aggregation: "Daily",
      Columns: [
        "TimePeriod",
        "AccountId",
        "AccountName",
        "CampaignId",
        "CampaignName",
        "CampaignStatus",
        "Impressions",
        "Clicks",
        "Spend",
        "Conversions",
        "Revenue",
        "Ctr",
        "AverageCpc",
      ],
      Scope: {
        AccountIds: [parseInt(accountId, 10)],
      },
      Time: {
        CustomDateRangeStart: { Day: sd, Month: sm, Year: sy },
        CustomDateRangeEnd: { Day: ed, Month: em, Year: ey },
        ReportTimeZone: "EasternTimeUSandCanada",
      },
    },
  };

  const resp = await withRetry(
    () =>
      fetch(`${REPORTING_ENDPOINT}/SubmitGenerateReport`, {
        method: "POST",
        headers: bingHeaders(env, accessToken, accountId),
        body: JSON.stringify(payload),
      }),
    `submit-report-${accountId}`
  );

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(
      `SubmitGenerateReport failed ${resp.status} for account ${accountId}: ${text.slice(0, 400)}`
    );
  }

  const data = (await resp.json()) as {
    ReportRequestId?: string;
    TrackingId?: string;
  };
  if (!data.ReportRequestId) {
    throw new Error(`No ReportRequestId in response: ${JSON.stringify(data).slice(0, 300)}`);
  }
  log("info", `Report job submitted: ${data.ReportRequestId} (account ${accountId})`);
  return data.ReportRequestId;
}

/**
 * Poll the report status until Success or Failure, then download CSV.
 * Returns lines of parsed CSV (header stripped).
 * Max wait: ~10 minutes.
 */
async function pollAndDownloadReport(
  env: Env,
  accessToken: string,
  accountId: string,
  reportRequestId: string
): Promise<string[][]> {
  const maxPolls = 60;
  const pollIntervalMs = 10_000;

  for (let i = 0; i < maxPolls; i++) {
    await new Promise((r) => setTimeout(r, i === 0 ? 3000 : pollIntervalMs));

    const resp = await withRetry(
      () =>
        fetch(`${REPORTING_ENDPOINT}/PollGenerateReport`, {
          method: "POST",
          headers: bingHeaders(env, accessToken, accountId),
          body: JSON.stringify({ ReportRequestId: reportRequestId }),
        }),
      `poll-report-${reportRequestId}`
    );

    if (!resp.ok) {
      const text = await resp.text();
      log("warn", `PollGenerateReport non-200 ${resp.status}: ${text.slice(0, 200)}`);
      continue;
    }

    const data = (await resp.json()) as {
      ReportRequestStatus?: {
        ReportDownloadUrl?: string;
        Status?: string;
      };
    };
    const status = data.ReportRequestStatus?.Status;
    const url = data.ReportRequestStatus?.ReportDownloadUrl;

    log("info", `Poll ${i + 1}/${maxPolls}: status=${status}`);

    if (status === "Success" && url) {
      return await downloadAndParseCsv(url);
    }
    if (status === "Error" || status === "Failed") {
      throw new Error(`Report job ${reportRequestId} failed with status: ${status}`);
    }
    if (status === "NoData") {
      log("info", `Report ${reportRequestId}: no data for this period`);
      return [];
    }
    // Status is Pending or InProgress — keep polling
  }
  throw new Error(
    `Report ${reportRequestId} did not complete after ${maxPolls} polls (${(maxPolls * pollIntervalMs) / 60_000} min)`
  );
}

/**
 * Download the report CSV (may be gzipped), return parsed rows (header excluded).
 * Bing Ads CSVs have a preamble section before the column header row.
 * The data starts after the blank line following the "Report Name:" header block.
 */
async function downloadAndParseCsv(url: string): Promise<string[][]> {
  const resp = await withRetry(
    () => fetch(url),
    "download-report-csv"
  );
  if (!resp.ok) {
    throw new Error(`Report download failed ${resp.status}: ${url.slice(0, 100)}`);
  }

  const text = await resp.text();
  const lines = text.split("\n").map((l) => l.replace(/\r$/, ""));

  // Bing CSV structure:
  //   Report Name: ...
  //   ...metadata rows...
  //   (blank line)
  //   ColumnHeader1,ColumnHeader2,...
  //   data,row,...
  //   ...
  //   (blank line or ©Microsoft line at end)

  let dataStart = -1;
  let headerRow: string[] | null = null;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // Find the first non-empty line after a blank separator that looks like a CSV header
    if (dataStart === -1 && trimmed === "" && i + 1 < lines.length) {
      const next = lines[i + 1].trim();
      if (next && !next.startsWith("Report ") && !next.startsWith("©")) {
        // This blank line separates preamble from data
        headerRow = parseCsvLine(lines[i + 1]);
        dataStart = i + 2;
        break;
      }
    }
  }

  if (dataStart === -1 || !headerRow) {
    log("warn", "Could not locate CSV data section; raw preview:", lines.slice(0, 5).join(" | "));
    return [];
  }

  const rows: string[][] = [];
  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("©") || line.startsWith("\"©")) break;
    rows.push(parseCsvLine(lines[i]));
  }

  // Prepend header so callers can build an index
  return [headerRow, ...rows];
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

// ---------------------------------------------------------------------------
// Parse CSV rows → BQ row objects
// ---------------------------------------------------------------------------

function parseCsvToRows(
  csvData: string[][],
  account: SubAccount
): BingMetricRow[] {
  if (csvData.length < 2) return []; // header only or empty

  const header = csvData[0].map((h) => h.trim());
  const col = (name: string) => header.indexOf(name);

  const idx = {
    date: col("TimePeriod"),
    campaignId: col("CampaignId"),
    campaignName: col("CampaignName"),
    impressions: col("Impressions"),
    clicks: col("Clicks"),
    spend: col("Spend"),
    conversions: col("Conversions"),
    revenue: col("Revenue"),
    ctr: col("Ctr"),
    avgCpc: col("AverageCpc"),
  };

  const now = new Date().toISOString();
  const rows: BingMetricRow[] = [];

  for (let i = 1; i < csvData.length; i++) {
    const r = csvData[i];
    if (r.length < 3) continue;

    const rawDate = (r[idx.date] ?? "").trim();
    // TimePeriod in daily aggregation: "YYYY-MM-DD" or "M/D/YYYY"
    const metricDate = normalizeDate(rawDate);
    if (!metricDate) {
      log("warn", `Skipping row with unparseable date: ${rawDate}`);
      continue;
    }

    const impressions = parseIntSafe(r[idx.impressions]);
    const spend = parseFloatSafe(r[idx.spend]);

    // Skip zero-activity rows
    if (impressions === 0 && spend === 0) continue;

    const clicks = parseIntSafe(r[idx.clicks]);
    const conversions = parseFloatSafe(r[idx.conversions]);
    const revenue = parseFloatSafe(r[idx.revenue]);
    const ctrRaw = parseFloatSafe(r[idx.ctr]); // percentage already (e.g. 2.5 = 2.5%)
    const avgCpc = parseFloatSafe(r[idx.avgCpc]);

    const campaignId = (r[idx.campaignId] ?? "").trim();
    const campaignName = (r[idx.campaignName] ?? "").trim();

    rows.push({
      client_id: account.client_id,
      platform: "bing",
      campaign_id: campaignId,
      campaign_name: campaignName,
      entity_type: "campaign",
      metric_date: metricDate,
      impressions,
      clicks,
      conversions,
      conversion_value: revenue,
      spend: round6(spend),
      ctr: impressions > 0 ? round4(ctrRaw) : null,
      cpc: clicks > 0 ? round6(avgCpc) : null,
      ingested_at: now,
      platform_campaign_id: campaignId,
      account_id: account.account_id,
    });
  }

  return rows;
}

function normalizeDate(raw: string): string | null {
  if (!raw) return null;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // M/D/YYYY or MM/DD/YYYY
  const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const [, m, d, y] = mdy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function parseIntSafe(s: string | undefined): number {
  const n = parseInt((s ?? "0").replace(/,/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

function parseFloatSafe(s: string | undefined): number {
  const n = parseFloat((s ?? "0").replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

function round6(n: number) { return Math.round(n * 1_000_000) / 1_000_000; }
function round4(n: number) { return Math.round(n * 10_000) / 10_000; }

// ---------------------------------------------------------------------------
// BigQuery: partition-safe write
// ---------------------------------------------------------------------------

function makeBqClient(): BigQuery {
  return new BigQuery({
    projectId: BQ_PROJECT,
    keyFilename: BQ_KEY_PATH,
  });
}

/**
 * Read non-bing rows for a given date partition to preserve Google/Meta data.
 */
async function readOtherPlatformRows(
  bq: BigQuery,
  targetDate: string
): Promise<Record<string, unknown>[]> {
  const query = `
    SELECT *
    FROM \`${BQ_PROJECT}.${BQ_DATASET}.${BQ_TABLE}\`
    WHERE metric_date = @target_date
      AND platform != 'bing'
  `;
  const [rows] = await bq.query({
    query,
    params: { target_date: targetDate },
    types: { target_date: "DATE" },
  });

  // Coerce BigQuery value types to plain JS for re-insert
  return rows.map((row: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (v && typeof v === "object" && "value" in (v as object)) {
        // BigQuery Date/Timestamp wrapper
        out[k] = (v as { value: unknown }).value;
      } else {
        out[k] = v;
      }
    }
    return out;
  });
}

/**
 * Get the daily_metrics table schema from BQ (used for NDJSON load).
 */
async function getTableSchema(bq: BigQuery): Promise<TableField[]> {
  const [meta] = await bq
    .dataset(BQ_DATASET)
    .table(BQ_TABLE)
    .getMetadata();
  return (meta.schema?.fields ?? []) as TableField[];
}

/**
 * Partition-safe write for one date:
 * 1. Read non-bing rows for the date.
 * 2. Merge with new bing rows.
 * 3. WRITE_TRUNCATE on the ${dateStr} partition shard.
 */
async function writePartition(
  bq: BigQuery | null,
  targetDate: string,
  bingRows: BingMetricRow[],
  dryRun: boolean
): Promise<number> {
  if (dryRun) {
    for (const r of bingRows) {
      process.stdout.write(JSON.stringify(r) + "\n");
    }
    return bingRows.length;
  }

  if (!bq) throw new Error("BQ client is null in non-dry-run mode");

  if (bingRows.length === 0) {
    log("info", `No bing rows for ${targetDate} — skipping write`);
    return 0;
  }

  log("info", `Reading non-bing rows for partition ${targetDate}...`);
  const otherRows = await readOtherPlatformRows(bq, targetDate);
  log(
    "info",
    `Preserved ${otherRows.length} non-bing rows for ${targetDate}`
  );

  const schema = await getTableSchema(bq);
  const merged = [...otherRows, ...bingRows];

  const dateShard = targetDate.replace(/-/g, "");
  const tableRef = `${BQ_PROJECT}.${BQ_DATASET}.${BQ_TABLE}$${dateShard}`;

  // Build NDJSON stream from merged rows
  const ndjson = merged.map((r) => JSON.stringify(r)).join("\n");
  const stream = Readable.from([ndjson]);

  const [job] = await bq
    .dataset(BQ_DATASET)
    .table(`${BQ_TABLE}$${dateShard}`)
    .load(stream, {
      writeDisposition: "WRITE_TRUNCATE",
      schema: { fields: schema },
      sourceFormat: "NEWLINE_DELIMITED_JSON",
    });

  // Errors surface in job.status.errors
  const errors = (job as { status?: { errors?: unknown[] } }).status?.errors;
  if (errors && errors.length > 0) {
    throw new Error(
      `BQ load job errors for ${tableRef}: ${JSON.stringify(errors).slice(0, 400)}`
    );
  }

  log(
    "info",
    `Loaded ${merged.length} rows (${bingRows.length} bing + ${otherRows.length} preserved) → ${tableRef}`
  );
  return bingRows.length;
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

interface PipelineOptions {
  dates: string[];  // YYYY-MM-DD[]
  dryRun: boolean;
}

async function run(opts: PipelineOptions): Promise<void> {
  const rawEnv = loadEnv();
  const env = requireEnv({ ...rawEnv, ...process.env });

  log("info", `Bing Ads ingest starting — ${opts.dates.length} date(s): ${opts.dates.join(", ")}`);
  if (opts.dryRun) log("info", "DRY RUN — BQ writes suppressed");

  // Step 1: OAuth
  const accessToken = await getAccessToken(env);

  // Step 2: Resolve OC Repipes numeric account_id
  const accounts = [...SUB_ACCOUNTS];
  for (const acct of accounts) {
    if (!acct.account_id) {
      const resolved = await resolveAccountId(env, accessToken, acct.account_number);
      if (resolved) {
        acct.account_id = resolved;
      } else {
        log(
          "warn",
          `Could not resolve account_id for ${acct.name} (${acct.account_number}) — skipping this account`
        );
      }
    }
  }

  const activeAccounts = accounts.filter((a) => a.account_id);
  log("info", `Active accounts: ${activeAccounts.map((a) => `${a.name}(${a.account_id})`).join(", ")}`);

  const bq: BigQuery | null = opts.dryRun ? null : makeBqClient();

  const startDate = opts.dates[0];
  const endDate = opts.dates[opts.dates.length - 1];

  // Collect all bing rows per date across all accounts
  const rowsByDate = new Map<string, BingMetricRow[]>();
  for (const d of opts.dates) rowsByDate.set(d, []);

  for (const account of activeAccounts) {
    log("info", `--- Fetching ${account.name} (${account.account_id}) ${startDate}..${endDate} ---`);

    try {
      const reportId = await withRetry(
        () => submitReportJob(env, accessToken, account.account_id, startDate, endDate),
        `submit-${account.account_id}`
      );

      const csvData = await pollAndDownloadReport(
        env,
        accessToken,
        account.account_id,
        reportId
      );

      if (csvData.length === 0) {
        log("info", `${account.name}: no data in report`);
        continue;
      }

      const parsed = parseCsvToRows(csvData, account);
      log("info", `${account.name}: parsed ${parsed.length} campaign-day rows`);

      for (const row of parsed) {
        const bucket = rowsByDate.get(row.metric_date);
        if (bucket) {
          bucket.push(row);
        } else {
          log("warn", `Row date ${row.metric_date} outside requested window — skipping`);
        }
      }
    } catch (err) {
      log("error", `Account ${account.name} failed:`, err);
      // Continue with other accounts — don't abort the whole run
    }
  }

  // Write one partition per date
  let totalRows = 0;
  for (const targetDate of opts.dates) {
    const bingRows = rowsByDate.get(targetDate) ?? [];
    log("info", `Writing partition ${targetDate}: ${bingRows.length} bing rows`);
    try {
      const written = await writePartition(bq, targetDate, bingRows, opts.dryRun);
      totalRows += written;
    } catch (err) {
      log("error", `Failed to write partition ${targetDate}:`, err);
    }
  }

  log(
    "info",
    `Done. ${totalRows} bing rows loaded across ${opts.dates.length} partition(s)`
  );
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

function parseArgs(): PipelineOptions {
  const args = process.argv.slice(2);
  let specificDate: string | null = null;
  let days = 7;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--date" && args[i + 1]) {
      specificDate = args[++i];
    } else if (args[i] === "--days" && args[i + 1]) {
      days = parseInt(args[++i], 10);
      if (isNaN(days) || days < 1) throw new Error("--days must be a positive integer");
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    } else if (args[i] === "--help" || args[i] === "-h") {
      process.stdout.write(
        [
          "Usage: npx tsx bing-ads-ingest.ts [options]",
          "  --date YYYY-MM-DD   specific date (overrides --days)",
          "  --days N            rolling window in days (default: 7)",
          "  --dry-run           print rows to stdout, skip BQ write",
          "  --help              this message",
        ].join("\n") + "\n"
      );
      process.exit(0);
    }
  }

  let dates: string[];
  if (specificDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(specificDate)) {
      throw new Error(`Invalid --date format, expected YYYY-MM-DD: ${specificDate}`);
    }
    dates = [specificDate];
  } else {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    dates = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(yesterday);
      d.setUTCDate(d.getUTCDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }
  }

  return { dates, dryRun };
}

run(parseArgs()).catch((err) => {
  log("error", "Fatal error:", err);
  process.exit(1);
});
