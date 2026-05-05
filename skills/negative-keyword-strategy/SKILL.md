---
name: negative-keyword-strategy
description: Builds a complete proactive negative keyword strategy using a 6-layer foundation — universal waste, industry-specific, competitor blocking, cross-modality, intent filtering, and CPC protection.
---

> **Owned by:** googli (and sesio for cross-platform negatives).

You are this agency's negative keyword architect. Your job is proactive defense — building negative structures before waste happens, not just reacting to search terms after budget is burned. Most accounts run with fewer than 20 negatives. This framework builds a layered defense with 6 tiers, each targeting a different type of query contamination.

Negative keywords are not optional maintenance. A missing negative on a 1,000-impression-per-day keyword costs more than most optimization work saves.

---

## What You Need

**Required:**
1. Business type: ecommerce / lead gen / B2B / local services / SaaS / healthcare / legal
2. What you sell (one sentence — product/service and who buys it)
3. Primary keywords or ad groups (paste your keyword list — messy is fine)

**Optional (significantly improves accuracy):**
- Current negative keyword list (paste if exists)
- Industries or services you DON'T offer (e.g., "we do residential, not commercial")
- Geographic scope (local vs. national vs. global)
- Competitor names (to add brand protection)
- Any specific queries you've seen burning budget in past search term reports

---

## The 6-Layer Negative Keyword Foundation

Build these layers in order. Each layer has a specific scope (account / campaign / ad group) and purpose.

---

### Layer 1: Universal Waste (Account Level)

These patterns waste budget in EVERY account, regardless of industry. Add at account level so they apply everywhere.

**Employment / Job Seeker queries — Broad Match:**

| Pattern | Examples |
|---------|---------|
| job | "plumbing jobs near me," "CRM software jobs" |
| jobs | same |
| career | "accounting career," "career in marketing" |
| careers | same |
| salary | "digital marketing salary," "CRM developer salary" |
| hiring | "who is hiring plumbers" |
| resume | "resume for CRM manager" |
| internship | "marketing internship" |
| apprenticeship | "plumbing apprenticeship" |
| volunteer | "volunteer opportunities" |

**Navigation / Brand queries — Phrase Match:**

| Pattern | Examples |
|---------|---------|
| "login" | "CRM software login," "my account login" |
| "sign in" | "sign in to my account" |
| "log in" | same |
| "account" | "my account," "manage my account" |
| "customer portal" | "client portal login" |
| "download" | "download CRM software for free" |
| "app" | "CRM app download" (if you don't have an app) |

**DIY / Free queries — Phrase Match:**

| Pattern | Examples |
|---------|---------|
| "how to" | "how to fix a leaking pipe" (unless you want informational traffic) |
| "DIY" | "DIY plumbing repair" |
| "free" | "free CRM software," "free legal advice" |
| "template" | "email template free" |
| "free trial" | Add ONLY if you don't offer a free trial |
| "open source" | "open source CRM" |

**Academic / Research queries — Phrase Match:**

| Pattern | Examples |
|---------|---------|
| "what is" | "what is a CRM" |
| "definition" | "CRM definition" |
| "meaning" | "CRM meaning" |
| "wikipedia" | any query |
| "history of" | "history of CRM software" |

**Forum / Community Research — Phrase Match:**

| Pattern | Examples |
|---------|---------|
| "reddit" | "best CRM reddit" |
| "forum" | "plumbing forum UK" |
| "community" | "plumbers community advice" |
| "quora" | any |

**Document Seeking — Broad Match:**

| Pattern | Examples |
|---------|---------|
| pdf | "plumbing guide pdf" |
| manual | "CRM user manual pdf" |
| ebook | same |
| whitepaper | B2B context |

---

### Layer 2: Industry-Specific Waste (Account or Campaign Level)

Patterns specific to your vertical that don't apply to competitors but burn your budget.

**Home Services / Trades:**
- "DIY [service type]" — people fixing it themselves
- "supply" / "supplies" / "parts" — buying parts, not hiring a tradesperson
- "tool" / "tools" / "equipment" — same
- "training" / "certification" / "license exam" — trade students, not customers
- "warranty" — people looking up warranty info, not service
- "complaint" / "review" (if you can't control competitor names appearing)

**Ecommerce / Physical Products:**
- "wholesale" — unless you sell wholesale
- "bulk" — unless you sell in bulk
- "manufacturer" / "factory" — seeking the source, not a retailer
- "OEM" / "generic" — price-sensitive/brand-agnostic shopper
- "second hand" / "used" / "secondhand" / "refurbished" — unless you sell these
- "repair" / "fix" — unless you offer repairs

**B2B SaaS:**
- "tutorial" / "course" / "training" — learning platforms, not buyers
- "certification" — training seekers
- "API" / "integration" — often developers exploring, not buyers
- "vs" — ONLY add if you don't want to appear for competitor comparison terms (usually keep these)
- "open source" / "self-hosted" — price avoiders
- "alternative to [your brand]" — add as negative on non-competitor campaigns (keep for defensive use)

**Healthcare / Medical:**
- "symptoms" — informational, not treatment-seeking
- "self-diagnose" / "self-treatment"
- "natural remedy" / "home remedy" — unless you offer these
- "NHS" — UK patients using NHS route, not private
- "insurance" — if you don't accept specific insurance types

**Legal Services:**
- "pro se" / "self-represent" / "DIY legal"
- "legal aid" — unless you offer it
- "free legal advice" — unless you offer it
- "law school" / "paralegal course"
- "form" / "template" — people looking for blank legal forms

---

### Layer 3: Competitor Blocking (Campaign Level)

Protect your brand spend. Prevent competitor-branded queries from triggering your non-brand campaigns.

**Add competitor brand names as negatives to all NON-competitor campaigns:**

Strategy:
1. List all known competitors in your space
2. Add their brand names as exact match negatives `[competitor name]` to general campaigns
3. If you run dedicated competitor campaigns — those campaigns are exempt from this negative
4. Add common misspellings of competitor names if high-volume

**Example for CRM SaaS:**
- [salesforce], [hubspot], [zoho], [pipedrive], [monday.com], [notion]

**Important:** Do NOT block competitor names at account level — you may want competitor campaigns later.

---

### Layer 4: Cross-Modality Protection (Campaign or Ad Group Level)

Prevents different campaigns from cannibalizing each other. These are negatives that route queries to the right campaign.

**Brand vs. Non-Brand:**
- Add `[your brand name]` as exact match negative to all non-brand campaigns
- Add `["your brand name"]` as phrase match for brand variations

**Service-Type Separation:**
- If you have separate campaigns for different services, add each service's core keyword as a negative to the others
- Example: Residential Plumbing campaign → add [commercial plumbing], [industrial plumbing] as negatives

**Location Separation:**
- If you have city-specific campaigns → add location names as negatives to the general campaign
- Example: "London Plumber" campaign → add [london] to the "UK Plumber" general campaign

**Match Type Separation:**
- If running both exact and broad/phrase campaigns for same terms → add exact match keywords as negatives `[keyword]` to the broad campaign to prevent the exact campaign from being cannibalized

---

### Layer 5: Intent Filtering (Campaign Level)

Filter queries by funnel stage to protect bottom-funnel campaigns from informational traffic.

**For bottom-funnel (Ready to Act) campaigns, add these as negatives:**

| Intent Type | Phrases to Block |
|-------------|-----------------|
| Informational | "what is," "how does," "explain," "guide," "overview," "introduction to" |
| Research | "best," "top 10," "review," "comparison," "vs" (if you want only transactional traffic) |
| Career | "job," "career," "salary," "hire" (covered in Layer 1 but reinforce at campaign level) |
| DIY | "how to," "DIY," "yourself" |

**For top-funnel (awareness) campaigns, REMOVE these as negatives** — you want informational traffic there.

**Exception:** "Best [your service/product]" is often ready-to-buy intent, especially in local services and B2B SaaS. Evaluate before blocking.

---

### Layer 6: CPC Protection (Campaign Level)

Block queries that trigger expensive clicks for off-intent audiences.

**Break-even CPC formula:**
```
Break-Even CPC = Target CPA × Expected CVR
```

Example: Target CPA $50, Expected CVR 3% → Break-Even CPC = $50 × 0.03 = $1.50

If a keyword or search term pattern has average CPC above break-even with no conversion history → block it.

**High-CPC / Low-intent patterns to evaluate:**
- Insurance-related terms (often extremely high CPC, low CVR for non-insurance businesses)
- Legal-adjacent terms (same issue for non-legal businesses)
- Finance/credit terms (banks bid these up; non-financial businesses get burned)
- Generic single-word terms (e.g., "software," "service," "company") — high volume, zero specificity

---

## Match Type Strategy for Negatives

Getting the match type wrong is as costly as missing the negative entirely.

| Match Type | Target Distribution | When to Use |
|-----------|---------------------|-------------|
| Broad Match Negative | ~15% of negative list | High-confidence waste patterns with all variations dangerous (e.g., "job" — "jobs," "job posting," "job training" are all waste) |
| Phrase Match Negative | ~70% of negative list | Patterns where the phrase in any context is waste (e.g., "how to" — "how to do X" is always informational) |
| Exact Match Negative | ~15% of negative list | Surgical blocks: specific competitor names, specific product models, geographic terms that need precise control |

**Common mistake:** Adding everything as broad match negatives. This blocks legitimate traffic. "plumber jobs" as a broad negative blocks "emergency plumber" because "plumber" is in both. Use phrase or exact for most negatives.

---

## Application Level Matrix

| Negative Type | Where to Apply | Scope |
|--------------|---------------|-------|
| Universal waste (employment, navigation) | Account-level list | All campaigns |
| Industry-specific waste | Account-level OR campaign-level | Account if always irrelevant; campaign if only irrelevant to specific campaigns |
| Competitor names (blocking) | Campaign-level | Specific campaigns where competitors shouldn't trigger |
| Cross-modality protection | Campaign or ad-group level | Specific campaigns only |
| Intent filtering | Campaign-level | Bottom-funnel campaigns only |
| CPC protection | Campaign-level | High-CPC campaigns where cost control is critical |

---

## Output Format

### Negative Keyword Build Plan

**Account-Level List (Universal + Industry Waste):**

| Negative Keyword | Match Type | Layer | Reason |
|-----------------|-----------|-------|--------|
| job | Broad | Universal | Job seekers, not buyers |
| [negative] | [Phrase/Broad/Exact] | [Layer 1-6] | [reason] |

**Campaign-Level Recommendations:**

For each campaign:

| Campaign | Negative Keyword | Match Type | Layer | Reason |
|----------|-----------------|-----------|-------|--------|
| [campaign name] | [negative] | [match type] | [layer] | [reason] |

---

### Google Ads Editor Import Format

```
# ACCOUNT LEVEL NEGATIVES
[keyword]               Broad Match Negative
"keyword phrase"        Phrase Match Negative
[exact keyword]         Exact Match Negative

# CAMPAIGN: [Campaign Name] NEGATIVES
[keyword]               Broad Match Negative
"keyword phrase"        Phrase Match Negative
```

---

### Estimated Waste Protection

| Layer | Estimated Monthly Queries Blocked | Risk of Over-Blocking | Priority |
|-------|----------------------------------|----------------------|----------|
| Layer 1: Universal | [X] | Low | Immediate |
| Layer 2: Industry | [X] | Low-Med | Immediate |
| Layer 3: Competitor | [X] | Low | Immediate |
| Layer 4: Cross-Modality | [X] | Med | This week |
| Layer 5: Intent | [X] | Med | This week |
| Layer 6: CPC Protection | [X] | Med | Evaluate first |

---

### Missing Negative Risks (Flagged)

Any patterns found in the keyword list that could generate irrelevant queries but don't have a blocking negative:

| Pattern | Risk Query Example | Recommended Negative | Match Type |
|---------|------------------|---------------------|-----------|
| [pattern] | "[example]" | [negative] | [Phrase] |

---

## Ongoing Maintenance Schedule

| Frequency | Action |
|-----------|--------|
| Weekly (first 4 weeks) | Review search terms report — add new negatives immediately |
| Bi-weekly (months 2-3) | Review search terms, check for new waste patterns |
| Monthly (ongoing) | Quarterly negative audit: are any negatives blocking converting queries? |
| After any campaign change | Re-run cross-modality check — new keywords create new cannibalization risks |

---

## Guardrails

❌ NEVER add a negative without checking if it blocks a converting query first — especially broad match negatives
❌ NEVER add competitor names as account-level negatives — blocks your own competitor campaigns
❌ NEVER ignore search terms for more than 2 weeks — waste compounds faster than most accounts realize
❌ NEVER add every negative as broad match — the most common over-blocking mistake
❌ NEVER skip Layer 4 (cross-modality) — match type campaigns cannibalizing each other is invisible without it

✅ ALWAYS specify the match type for every negative — match type omitted = Google chooses, and Google chooses wrong
✅ ALWAYS document why each negative was added — makes future audits faster
✅ ALWAYS check for "false positives" before adding broad match negatives
✅ ALWAYS apply negatives at the correct level — account-level is overkill for campaign-specific issues
✅ ALWAYS calculate break-even CPC before building Layer 6

---

## Edge Cases

**Account is brand new (no search terms data yet):** Build Layers 1, 2, 3 immediately from inference. Layers 4-6 require data — add them after the first week of data.

**Client doesn't know their competitors:** Infer from vertical. Ask: "Who do your customers compare you to when they're deciding?" Use those names.

**Negative blocking conversions discovered:** Remove immediately. Then re-examine the query pattern — was it an overly broad negative? Narrow the match type and re-add.

**Remarketing / RLSA campaigns:** These campaigns often SHOULD show for informational queries to warm audiences. Review Layer 5 exceptions carefully before applying.

**International accounts:** Geographic negatives become critical. Add non-target countries/regions at campaign level. Check language mismatch patterns.

**Multi-product accounts:** Cross-modality (Layer 4) is the most complex. Map out all product/service categories and build a routing matrix before adding campaign-level negatives.

---

## Confidence Thresholds

CPC break-even calculations and waste estimation use knowledge-base/confidence-scoring.md (dynamic thresholds — compute per-client based on budget, CPC, conversion volume; static defaults must NOT be used).

---

## Cross-references

- After building negatives, run the `intent-gap-mapper` skill to ensure negative additions don't inadvertently block stages you intend to cover.
- Use the `quality-control` skill to verify negative lists before deploying to accounts.

---

## Save & Log

Save output to: `orgs/click-to-acquire/clients/[client-name]/negative-keywords/[YYYY-MM-DD]-negative-build.md`

> After saving, note: `cortextos bus log-change` — log this negative keyword build with client ID, date, and layer counts.
