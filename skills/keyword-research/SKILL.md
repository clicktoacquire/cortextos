---
name: keyword-research
description: Runs hybrid keyword research combining Google Ads KeywordPlanIdeaService, Google Autocomplete, and Gemini 2.0 Flash LSI clustering — auto-detects client geo from active campaigns.
---

> **Owned by:** googli (and sesio for keyword/SEO overlap when sesio is back online).

This skill executes the hybrid keyword research pipeline for Click To Acquire client accounts. It combines three data sources — the Google Ads Keyword Planner API, Google Autocomplete scraping, and Gemini 2.0 Flash LSI/long-tail expansion — into a single deduplicated, clustered CSV ready for ad group planning.

---

## When to Invoke

Run this skill in any of these situations:

- **New client onboarding** — seed keyword universe before building campaign structure
- **Keyword refresh** — quarterly re-run to capture search trend shifts
- **Expanding ad groups** — adding new services, geographies, or product lines
- **Intent-gap fill** — after `intent-gap-mapper` identifies ABSENT or WEAK stages, use this to source candidates for those gaps

Do not run on accounts where the Google Ads API connection (`google-ads.yaml`) is not configured — the tool will exit with an error.

---

## Prerequisites

| Requirement | Details |
|-------------|---------|
| `google-ads.yaml` | Must exist in the home directory (`~/google-ads.yaml`). Contains OAuth credentials and developer token for the Google Ads API. |
| `GEMINI_API_KEY` env var | Set in shell environment OR pass as `--gemini_key` flag at runtime. Required for LSI expansion and ad group clustering. |
| Python dependencies | See `skills/keyword-research/requirements.txt`. Install with `pip install -r skills/keyword-research/requirements.txt` before first run. |
| Active campaigns | The tool auto-detects geo targets from the client's enabled campaigns. If the account has no campaign-level location targeting, you must pass `--location_ids` manually. |

---

## How to Run

```bash
python skills/keyword-research/keyword_research.py \
  --customer_id <CUSTOMER_ID_NO_DASHES> \
  --keywords "seed keyword 1" "seed keyword 2" \
  [--page_url https://client-landing-page.com] \
  [--output orgs/click-to-acquire/clients/[client-name]/keyword-research/results-YYYY-MM-DD.csv]
```

**Common invocation patterns:**

```bash
# Seed keywords only (most common)
python skills/keyword-research/keyword_research.py \
  --customer_id 1234567890 \
  --keywords "dental implants" "cosmetic dentist" "teeth whitening"

# Seed keywords + landing page for deeper ideation
python skills/keyword-research/keyword_research.py \
  --customer_id 1234567890 \
  --keywords "roofing contractor" \
  --page_url https://clientsite.com/roofing \
  --output results.csv

# Manual geo override (when account has no campaign location targets)
python skills/keyword-research/keyword_research.py \
  --customer_id 1234567890 \
  --keywords "personal injury lawyer" \
  --location_ids 1014221  # e.g., Chicago DMA

# Skip Google Ads API (autocomplete + Gemini only — no API credentials needed)
python skills/keyword-research/keyword_research.py \
  --customer_id 1234567890 \
  --keywords "plumber near me" \
  --skip_ads \
  --location_ids 1025197
```

**All flags:**

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--customer_id` / `-c` | Yes | — | Google Ads customer ID, no dashes |
| `--keywords` / `-k` | One of k/p | — | Seed keywords (space-separated, quoted) |
| `--page_url` / `-p` | One of k/p | — | Landing page URL for Keyword Planner seed |
| `--location_ids` / `-l` | No | Auto-detected | Geo target constant IDs (manual override) |
| `--language_id` / `-i` | No | 1000 (English) | Language constant ID |
| `--gemini_key` / `-g` | No | `GEMINI_API_KEY` env | Gemini API key |
| `--output` / `-o` | No | `keyword_research_results.csv` | Output CSV path |
| `--skip_ads` | No | false | Skip Google Ads API step |
| `--skip_gemini` | No | false | Skip Gemini expansion step |

---

## Auto-Features (What Happens Automatically)

**Geo detection:** The tool queries `campaign_criterion` for all ENABLED campaigns with location targets. No manual `--location_ids` needed unless overriding or the account has no campaign-level geo targeting yet.

**Ad destination URL read:** Before keyword ideation, the tool reads `ad_group_ad.ad.final_urls` from active ads and prints them. This shows where current traffic lands — useful for spotting mismatches between keywords being researched and actual landing pages.

**Three-source layering:**
1. `google_ads_api` — KeywordPlanIdeaService results with avg monthly searches, competition level, competition index, and top-of-page bid range (low/high)
2. `autocomplete` — Google Autocomplete scraping across seed keywords with prefixes: `""`, `"how to "`, `"best "`, `"cheap "`, `"top "`, `"why "`, `"what is "`
3. `gemini_expansion` — Gemini 2.0 Flash generates 30-50 additional LSI/long-tail terms NOT already in the list, then clusters ALL keywords (existing + new) into named ad group buckets

**Deduplication:** All three sources are merged on lowercase keyword text. A keyword that appears in multiple sources gets all source tags (e.g., `google_ads_api | autocomplete`), not duplicate rows.

---

## Output Files

**Primary CSV** (`--output` path, default `keyword_research_results.csv`):

| Column | Description |
|--------|-------------|
| `keyword` | Lowercase keyword text |
| `avg_monthly_searches` | From Google Ads API (0 if source is autocomplete/gemini only) |
| `competition` | LOW / MEDIUM / HIGH (from API) |
| `competition_index` | 0-100 numeric competition score |
| `low_top_of_page_bid` | Estimated low bid in $ |
| `high_top_of_page_bid` | Estimated high bid in $ |
| `sources` | Pipe-delimited: `google_ads_api`, `autocomplete`, `gemini_expansion` |
| `cluster` | Ad group name assigned by Gemini clustering |

**Cluster JSON** (auto-named `[output_stem]_clusters.json`):
A map of ad group names to keyword lists — directly usable for ad group planning.

---

## Confidence Thresholds

Competition level interpretation and cluster quality scoring use knowledge-base/confidence-scoring.md (dynamic thresholds — compute per-client based on budget, CPC, conversion volume; static defaults must NOT be used). In particular: do not set keyword-level bids based on `high_top_of_page_bid` without validating against actual auction data from the account.

---

## Cross-References

- Output feeds directly into the `intent-gap-mapper` skill — paste the keyword list from the CSV to classify by buyer journey stage.
- High-competition, low-intent keywords surfaced here are candidates for the `negative-keyword-strategy` skill.
- Re-run quarterly per client. Mark the run date in `orgs/click-to-acquire/clients/[client-name]/keyword-research/` folder naming convention.

---

## Quality Control

Before importing any keyword from this tool's output into a live account:

1. Filter out keywords with `avg_monthly_searches = 0` AND `sources = autocomplete` only — these are unvalidated suggestions with no volume data.
2. Review the `cluster` column for ad group coherence — Gemini clusters are directional, not final. Rename clusters to match campaign naming conventions before use.
3. Check `high_top_of_page_bid` against account CPA targets. Flag any keyword where the high bid alone exceeds break-even CPC (see the `negative-keyword-strategy` skill, Layer 6 CPC Protection).
4. Run the `quality-control` skill checklist before pushing to the account.

---

## Save & Log

Save CSV output to: `orgs/click-to-acquire/clients/[client-name]/keyword-research/[YYYY-MM-DD]-keyword-research.csv`
Save cluster JSON to: `orgs/click-to-acquire/clients/[client-name]/keyword-research/[YYYY-MM-DD]-clusters.json`

> After saving, note: `cortextos bus log-change` — log client ID, date, seed keywords used, total keyword count, and cluster count.
