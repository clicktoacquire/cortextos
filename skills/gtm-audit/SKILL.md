---
name: gtm-audit
description: Audits a Google Tag Manager container via API — lists all tags, triggers, and variables, then flags conversion tags on All Pages, duplicate tags, missing FB pixel events, and GHL/LeadConnector iframe tracking gaps.
---

> **Owned by:** googli.

This skill pulls a live GTM container via the Tag Manager API and produces a structured audit report. It is self-contained: the script lives at `skills/gtm-audit/gtm-audit.js`.

---

## When to Invoke

- During every `conversion-tracking-audit` run — GTM is the most common source of tracking errors.
- When the user provides a GTM container ID and asks for a tag inventory.
- When a new client is onboarded and tracking has not yet been verified.
- After any GTM publish (container changes can silently break conversion tags).
- When the `quality-control` skill flags Infrastructure Health (dimension C) below 3.

---

## Required Environment Variables

The script reuses the Google Ads OAuth credentials (same OAuth app, same refresh token):

| Variable | Description |
|----------|-------------|
| `GOOGLE_ADS_CLIENT_ID` | OAuth 2.0 client ID from Google Cloud Console |
| `GOOGLE_ADS_CLIENT_SECRET` | OAuth 2.0 client secret |
| `GOOGLE_ADS_REFRESH_TOKEN` | Refresh token with Tag Manager API scope |

These must be present in the project `.env` file. The script calls `require('dotenv').config()` at startup.

**Scope requirement:** The refresh token must have been granted the `https://www.googleapis.com/auth/tagmanager.readonly` scope in addition to the Google Ads scopes. If the audit returns "No GTM accounts found," re-authorize with the Tag Manager readonly scope added.

---

## Known Issue: Hardcoded Container ID

**The script currently has a hardcoded container ID: `GTM-NGSFDQ3C`** (line 8 of `gtm-audit.js`):

```js
const TARGET_CONTAINER_PUBLIC_ID = 'GTM-NGSFDQ3C';
```

This is the container for the initial Click To Acquire client this script was written for. To audit a different container, the agent must either:

1. Edit the constant in the script before running, or
2. Pass the container ID as a command-line argument (not yet implemented).

**Future improvement:** Parameterize the container ID via `process.argv[2]` so the script can be invoked as `node skills/gtm-audit/gtm-audit.js GTM-XXXXXXX`. This should be done in a future pass — do not block on it for current audits.

---

## How to Run

```bash
node skills/gtm-audit/gtm-audit.js
```

Run from the cortextOS repo root (or any directory where the `.env` file is accessible). The script requires Node.js and the following npm packages:

- `googleapis` — Tag Manager API client
- `dotenv` — env file loading

If packages are not installed: `npm install googleapis dotenv`

---

## Output Sections

The script prints to stdout in five labeled sections:

### 1. LISTING GTM ACCOUNTS
Lists all GTM accounts accessible to the OAuth user. Confirms authentication is working. If empty, the refresh token lacks Tag Manager scope.

### 2. FOUND TARGET / Container path
Confirms the target container was located. If the container ID is not found across all accounts, the script exits with a "not found" message — update the constant or check that the OAuth user has access.

### 3. ALL TRIGGERS
Lists every trigger with:
- Trigger ID and name
- Type (pageview, formSubmission, customEvent, etc.)
- Filters, custom event filters, auto-event filters

Key trigger to note: the built-in "All Pages" trigger has ID `2147479553`. Any conversion tag firing on this trigger ID is a critical bug.

### 4. ALL TAGS
Lists every tag with:
- Tag ID, name, type, paused status
- Parameters (truncated at 500 chars for list/map types)
- `Fires on:` — maps trigger IDs to trigger names
- `Blocked by:` — blocking triggers if any

Tag types to know:
- `awct` — Google Ads conversion tracking tag
- `gaawe` — Google Analytics 4 event tag
- `sp` — Google Ads remarketing/audience tag
- `html` — Custom HTML tag (used for FB pixel, GHL postMessage listeners, etc.)

### 5. ANALYSIS & FLAGS

Four subsections, each with clear WARNING markers:

#### GOOGLE ADS CONVERSION TAGS
Filters for `awct`, `gaawe`, `sp` types, plus HTML tags with "google" or "conversion" in the name. For each, shows what trigger it fires on. If it fires on trigger ID `2147479553` (All Pages), prints:
```
*** WARNING: Conversion tag firing on All Pages! ***
```
This is always a bug for conversion tags — they should only fire on conversion confirmation pages.

#### FACEBOOK / META PIXEL TAGS
Filters by tag name containing "facebook", "meta", "fb", or "pixel", or HTML tags whose code contains `fbq(` or `fbevents`. Shows all `fbq(...)` calls found in the HTML. Missing `fbq('track', 'Lead')` or `fbq('track', 'Purchase')` calls = FB pixel not tracking the right events.

#### FORM SUBMISSION / POSTMESSAGE TRACKING
Identifies tags and triggers related to form submissions and iframe/postMessage patterns. This section is critical for GHL (GoHighLevel) / LeadConnector clients because GHL embeds forms in iframes — native form submission triggers do not fire inside iframes. Look for:
- A custom HTML tag with `addEventListener('message', ...)` or `postMessage`
- A customEvent trigger listening for a GHL form-submit event name
- If neither exists, form submissions from GHL iframes are NOT being tracked.

#### TAGS FIRING ON "ALL PAGES"
Lists all tags (not just conversion tags) firing on the built-in All Pages trigger (ID `2147479553`) or any unfiltered custom pageview trigger. Tags are classified:
- `(OK — likely config/base tag)` — GA4 config, GTM DataLayer push, etc.
- `*** CONVERSION TAG ON ALL PAGES — FIX THIS ***` — must be moved to a conversion-specific trigger.

---

## Common Findings and How to Interpret Them

| Finding | What It Means | Severity | Fix |
|---------|--------------|----------|-----|
| Google Ads conversion tag on All Pages | Tag fires on every page load — massively over-reports conversions | CRITICAL | Move trigger to thank-you page URL or conversion event |
| No FB pixel Lead/Purchase event | Facebook is receiving PageView but not conversion events — retargeting and optimization audiences are blind | High | Add fbq('track','Lead') on conversion confirmation or via GTM event trigger |
| No postMessage listener for GHL/LeadConnector iframe | Form submissions inside GHL embed not tracked at all | High | Add custom HTML tag with window.addEventListener('message') filtering for GHL event type |
| Multiple Google Ads conversion tags | Possible duplicate counting — check if they cover different conversion actions or the same one | Medium | Verify each fires on a different trigger; remove redundant duplicates |
| Conversion tag paused | Tag exists but is not firing — tracking gap | High | Unpause if the conversion action should be active |
| No conversion tags found | GTM is not used for conversion tracking (may use hard-coded tags or another method) | Info | Verify via page source; if neither, tracking is absent |
| Conversion tag with no firing trigger | Tag will never fire — orphaned | High | Assign correct trigger or delete |

---

## Interpreting the Full Report

1. Start with ANALYSIS & FLAGS — this is the synthesized view.
2. Cross-reference with ALL TRIGGERS and ALL TAGS if a flag needs deeper inspection.
3. For every `*** WARNING ***` line, create a finding in the audit output.
4. If no warnings appear, state: "GTM container is clean — no conversion tags on All Pages, FB pixel events present, form tracking confirmed."
5. If the FORM SUBMISSION section is empty and the client uses GHL, that is itself a finding — flag it.

---

## Saving Results

Save the audit output to:
`orgs/click-to-acquire/clients/[client-name]/audits/[date]-gtm-audit.md`

Include the raw stdout output plus a brief summary of findings and recommended fixes at the top.

---

## Related Skills

- After a GTM audit, a `conversion-tracking-audit` should be run with updated tracking data to quantify the financial impact of any bugs found.
- Before marking any campaign creation complete, the `quality-control` skill Checklist B (Campaign Creation) includes tracking verification — use this skill's findings as the evidence for checks 11-13.
- For confidence thresholds when deciding whether tracking data is sufficient for Smart Bidding, see `knowledge-base/confidence-scoring.md` (dynamic thresholds — compute per-client based on budget, CPC, conversion volume; do NOT use static defaults).

---

After running, log via `cortextos bus log-change` and update bus task if applicable.
