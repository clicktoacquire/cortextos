---
name: quality-control
description: Quality control validation loop — runs after any completed work to check it meets Click To Acquire's standards before it's considered done. Covers RSA copy, campaign creation, weekly reports, and client setup.
---

> **Owned by:** fleet-wide. Any agent invokes this before declaring work done.

You are running quality control for Click To Acquire.

**Do not mark work as done until all required checks PASS.**

---

## Step 1: Identify What Was Just Completed

Ask: "What did you just finish? (RSA copy / campaign creation / weekly report / client setup)"

Or detect from context if it's clear.

Then ask: "Which client?"

Read `orgs/click-to-acquire/clients/[client-name]/profile.md` for context (budget, CPA target, vertical, competitive market playbook trigger conditions).

---

## Step 2: Run the Right Checklist

---

### CHECKLIST A — RSA Copy

Load `knowledge-base/copy-patterns.md` before running.

| # | Check | How to verify | Standard |
|---|-------|--------------|----------|
| 1 | Headline count | Count headlines | Exactly 15 |
| 2 | Description count | Count descriptions | Exactly 4 |
| 3 | H1 character limit | Count chars | ≤ 30 chars |
| 4 | All headlines ≤ 30 chars | Check each | 0 violations |
| 5 | All descriptions ≤ 90 chars | Check each | 0 violations |
| 6 | H1 pinned to keyword | Check pin assignment | H1 = HEADLINE_1 pinned |
| 7 | Angle diversity | Classify each headline by angle (keyword / benefit / proof / CTA / differentiator / urgency-offer) | At least 2 headlines per angle |
| 8 | No angle overloading | Count per angle | No single angle > 4 headlines |
| 9 | D1 formula | Check description 1 | Must follow: price/offer + promo + CTA |
| 10 | D2 formula | Check description 2 | Must contain trust signal or proof |
| 11 | D3 formula | Check description 3 | Must contain differentiator |
| 12 | No vague words | Scan all copy | Zero instances of: amazing, best, great, excellent, top, leading, #1 (unless backed by proof) |
| 13 | Competitive playbook — price anchor | Check profile: avg CPC > $15? | If yes → H1 must contain price (e.g., "From $X") |
| 14 | Competitive playbook — offer | Check profile: 5+ competitors? | If yes → H7 must contain offer/promo code |
| 15 | No cross-client contamination | Scan for specific prices, codes, business names | Zero references to other client data |
| 16 | Keyword in at least 3 headlines | Check H1–H5 | Primary keyword appears ≥ 3 times across headlines |
| 17 | CTA present | Scan headlines + descriptions | At least 1 clear call to action |

---

### CHECKLIST B — Campaign Creation

Read `orgs/click-to-acquire/clients/[client-name]/campaigns/search.md` and `orgs/click-to-acquire/clients/[client-name]/tracking/conversion-actions.md`.

| # | Check | How to verify | Standard |
|---|-------|--------------|----------|
| 1 | Campaign ID saved | Check campaigns/search.md | Campaign resource name populated |
| 2 | Campaign status | Check file or API | ENABLED (unless intentionally paused — must be noted) |
| 3 | Ad groups created | Count in file | ≥ 1 per keyword cluster from keyword research |
| 4 | Ad group IDs saved | Check campaigns/search.md | All ad group resource names populated |
| 5 | Keywords added | Count in file | ≥ 3 keywords per ad group |
| 6 | RSA per ad group | Check file | 1 RSA per ad group, status ENABLED |
| 7 | RSA passed copy QC | Run Checklist A | All copy checks PASS |
| 8 | Call extension linked | Check campaignAssets | Phone number from profile.md present |
| 9 | Sitelinks linked | Check campaignAssets | ≥ 4 sitelinks |
| 10 | Callouts linked | Check campaignAssets | ≥ 4 callouts |
| 11 | Conversion action linked | Check conversion-actions.md | ≥ 1 action ID populated |
| 12 | Landing page live | Check tracking/landing-page.md | HTTP 200 confirmed |
| 13 | Final URL matches landing page | Compare RSA finalUrls vs landing-page.md | Exact match |
| 14 | Location targeting set | Check campaign criteria | Client's service area applied |
| 15 | Bidding strategy correct | Cross-check with conversion volume | Matches Media Buyer ladder (0 conv = MAXIMIZE_CLICKS, etc.) |
| 16 | Budget set | Check campaign budget | Matches profile.md monthly budget ÷ 30 |
| 17 | Change log entry added | Check change-log.md | Campaign launch entry present with date + IDs |

> **Tracking note:** Before marking campaign creation complete, also run the `gtm-audit` skill to confirm conversion tags are not firing on All Pages and that form/postMessage tracking is in place. See `knowledge-base/confidence-scoring.md` for per-client conversion volume thresholds before switching bidding strategies.

---

### CHECKLIST C — Weekly Report

Read the report file at `orgs/click-to-acquire/clients/[client-name]/reports/[date]-report.md`.

| # | Check | How to verify | Standard |
|---|-------|--------------|----------|
| 1 | Report file exists | Check file path | Saved at correct path |
| 2 | Executive summary present | Check section | ≥ 1 paragraph, leads with leads/revenue — not metrics |
| 3 | Executive summary is plain English | Re-read it | No unexplained acronyms. CPL, CTR, CPA must be spelled out on first use |
| 4 | Google Ads metrics table present | Check section | Clicks, Impressions, CTR, Avg CPC, Conversions, Cost, CPA all present |
| 5 | WoW comparison column | Check table | % change column with ↑↓ arrows present |
| 6 | MoM comparison column | Check table | Month-over-month column present (or noted as N/A for new clients) |
| 7 | Plain English summary after Google table | Check section | 2–3 sentences explaining what the numbers mean |
| 8 | Facebook metrics table present | Check section | Only if client runs Facebook ads — skip if Google-only |
| 9 | What's Working section | Check section | 2–3 specific elements named (not generic) |
| 10 | What Needs Attention section | Check section | 1–2 issues with specific numbers (not "CPA is high" — "CPA is $X vs target $X") |
| 11 | Metric interpretation flags applied | Review data | CTR up + CVR down → alignment flag present if applicable |
| 12 | What We Did section | Check section | Pulled from change-log.md — lists real actions taken, not generic statements |
| 13 | What's Next section | Check section | 3 specific planned actions (not "optimize campaigns") |
| 14 | Change log entry added | Check change-log.md | Report-sent entry with date + file path |

---

### CHECKLIST D — Client Setup

Read all files in `orgs/click-to-acquire/clients/[client-name]/`.

| # | Check | How to verify | Standard |
|---|-------|--------------|----------|
| 1 | profile.md exists | Check file | Present and not empty |
| 2 | Business name populated | Check profile.md | Filled |
| 3 | Service area populated | Check profile.md | City/region and radius specified |
| 4 | Monthly budget populated | Check profile.md | Dollar amount present |
| 5 | CPA target populated | Check profile.md | Dollar amount present |
| 6 | Phone number populated | Check profile.md | Client phone number present |
| 7 | ICP section exists | Check profile.md | Has: Demographics, Pain Points, Desires, Winning Angles |
| 8 | Vertical tag present | Check profile.md | e.g., repiping / dental / home services |
| 9 | Google Ads account ID | Check profile.md | Populated or marked "pending MCC acceptance" |
| 10 | change-log.md exists | Check file | Present |
| 11 | First log entry exists | Check change-log.md | Onboarding entry with date |
| 12 | campaigns/ folder exists | Check folder | search.md, pmax.md, retargeting.md present (can be blank templates) |
| 13 | tracking/ folder exists | Check folder | conversion-actions.md present |
| 14 | Brand guardrails present | Check profile.md | Tone, prohibited words, or "none" explicitly noted |

---

## Step 3: Output the QC Report

Format:

```
## QC Report — [Work Type] — [Client Name] — [Date]

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1 | [Check name] | ✅ PASS | — |
| 2 | [Check name] | ❌ FAIL | [Exact issue + what to fix] |
| 3 | [Check name] | ⚠️ WARN | [Not blocking but worth noting] |

**Result: [X] PASS / [X] FAIL / [X] WARN**

### Fixes Required
1. [Check #X] — [Specific fix needed, not vague]
2. ...

### Warnings (non-blocking)
- [Any WARN items]
```

---

## Step 4: Fix and Re-Run Loop

If any FAIL exists:
- State clearly: "Work is NOT done. Fix the items above before this can be marked complete."
- After fixes are made (user confirms or you make the fixes), re-run only the failed checks.
- Repeat until all required checks PASS.

WARN items do not block completion — flag them but proceed.

Once all required checks PASS:
- Output: "✅ QC PASSED — [Work type] for [Client] is done."
- Add to `orgs/click-to-acquire/clients/[client-name]/change-log.md`:
```
### [Date] — QC — [Work Type] Validated
**Who:** Click To Acquire
**Checks:** [X] passed, [X] warnings
**Status:** Approved
```

---

## WARN vs FAIL definitions

**FAIL** = blocks completion. Work cannot be called done. Must fix.
- Missing required fields
- Character limit violations
- Missing campaign IDs
- No conversion action linked
- Report missing required sections

**WARN** = worth noting, does not block.
- Optional fields not populated (e.g., D4 description)
- Warnings about competitive playbook that may not apply
- Low conversion volume noted but not actionable yet
- Fields marked "pending" with a clear next step

---

After running, log via `cortextos bus log-change` and update bus task if applicable.
