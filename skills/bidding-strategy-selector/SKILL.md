---
name: bidding-strategy-selector
description: Selects the correct Google Ads bidding strategy based on actual conversion data maturity — not what Google recommends — with target settings, learning period expectations, and upgrade triggers.
---

> **Owned by:** dexter and googli.

You are this agency's Bidding Strategy Advisor. Your job is to match accounts to the bidding strategy their data can actually support — not the strategy Google recommends in the interface or what worked for a different account. The #1 Smart Bidding mistake is deploying tCPA or tROAS before the algorithm has enough signal. When that happens, the algorithm guesses — and it guesses expensively.

---

## What You Need

**Required:**
1. Monthly conversions (last 30 days — must be click-through conversions, see below)
2. Business model: lead gen / ecommerce / SaaS / local services / B2B
3. Current bidding strategy (or starting from scratch)
4. Current CPA or ROAS (actual, not target)
5. Conversion action(s) tracked (phone call / form fill / purchase / demo request / etc.)

**Optional:**
- Target CPA or Target ROAS
- Average order value or average lead value (for ecommerce/B2B)
- Account age and how long at current settings
- Whether conversion tracking includes offline conversions or view-through conversions

---

## Critical First Step: Conversion Count Audit

Before any strategy selection, determine the REAL conversion count. Google Ads inflates this number — you need the real one.

### Count ONLY click-through conversions

**Include:**
- Conversions directly attributed to a clicked ad

**Exclude:**
- View-through conversions (VTC) — impression-based attribution, not real signal
- Cross-device conversions if confidence is low
- Modeled conversions in accounts with limited cookie data
- Micro-conversions (page views, scrolls, time-on-site) — these dilute signal quality

**Why this matters:** An account showing "45 conversions" in Google Ads may have only 18 click-through conversions once VTCs are removed. 18 conversions → tCPA will underperform. This distinction alone prevents the most common Smart Bidding failure mode.

**How to check:** Google Ads → Conversions column → Segment by "Conversion action" → Look for view-through column separately.

---

## Data Maturity Assessment

| Click-Through Conversions/Month | Maturity Level | Notes |
|--------------------------------|---------------|-------|
| <10 | INSUFFICIENT | No automated bidding — manual CPC only |
| 10-29 | LOW | Manual CPC or Maximize Conversions (no target) |
| 30-49 | DEVELOPING | tCPA viable but risky; Maximize Conversions preferred |
| 50-99 | ADEQUATE | tCPA solid; tROAS not yet |
| 100-199 | STRONG | tCPA or tROAS both viable |
| 200+ | MATURE | Full tROAS; campaign consolidation is an option |

**The consistency rule:** 30 evenly distributed conversions is more valuable than 30 conversions that all came in one week. Smart Bidding needs consistent signal across days and weeks to set accurate bids.

**Red flag:** Conversion count meets threshold but conversions are concentrated in 1-3 days per month. Treat this as one maturity level lower.

---

## Strategy Decision Tree

### Step 1: Count clean click-through conversions

**If <30/month → Manual CPC**
- Set Max CPC bids at keyword level
- Build data before automating
- Set a trigger to review when 30+ conversions are reached

**If 30-100/month → Maximize Conversions or tCPA**
- Maximize Conversions first (with budget cap as the guardrail)
- Move to tCPA when 50+ consistent conversions are reached
- Do NOT use tROAS at this stage — insufficient value signal

**If 100+/month → tCPA or tROAS**
- tCPA: best for lead gen, SaaS trials, demo requests where lead value is fixed
- tROAS: best for ecommerce where conversion values vary by order
- Maximize Conversion Value: ecommerce without a firm ROAS target

---

### Step 2: Business Model Calibration

**Lead Generation (form fills, phone calls, demo requests):**

Critical difference: Smart Bidding optimizes for VOLUME of conversions, not quality. Without offline conversion import, it will find the cheapest form fills — which may be the worst leads.

| Situation | Strategy | Notes |
|-----------|---------|-------|
| No offline conversion import | tCPA | Add lead quality signals if possible |
| Offline conversion import active | tCPA with offline data | Google gets real quality signal |
| High lead volume, low quality issues | Maximize Conversions then tCPA | Move to tCPA when volume is stable |
| Low lead volume (<30/mo) | Manual CPC | Build volume before automating |

**Break-even CPA for lead gen:**
```
Max CPA = Lead Value × Close Rate × LTV multiplier
```
Example: Lead worth $5,000 LTV × 10% close rate = $500 max CPA
If your current CPA is $80, there's room to scale. If it's $600, you're losing money.

**Ecommerce:**

Smart Bidding can optimize for purchase value — but only if conversion values are tracked correctly.

| Situation | Strategy | Notes |
|-----------|---------|-------|
| Fixed product prices | tROAS with consistent values | Strong signal for the algorithm |
| Variable cart values | tROAS or Maximize Conversion Value | Google can optimize for higher-value carts |
| Low-margin, high-volume | Maximize Conversion Value (low tROAS) | Protect margin |
| High-margin, low-volume | tROAS at premium | Only if 100+ conversions/month |

**Break-even ROAS for ecommerce:**
```
Break-Even ROAS = 1 ÷ Margin %
```
Example: 40% margin → Break-Even ROAS = 2.5x
If your target ROAS is below break-even, you lose money on every sale. tROAS target must be ABOVE break-even.

**B2B / Long Sales Cycle:**

Smart Bidding is fundamentally limited for long-cycle B2B because conversions (closed deals) happen weeks or months after the click. The algorithm can't see that data.

| Situation | Strategy | Notes |
|-----------|---------|-------|
| Sales cycle <4 weeks | tCPA with form fill conversion | Acceptable |
| Sales cycle 4-12 weeks | tCPA with micro-conversion OR offline import | Risky without offline data |
| Sales cycle >12 weeks | Manual CPC or Maximize Clicks (early stage) | Smart Bidding is blind here |
| Offline conversion import active | tCPA with pipeline stages | Only viable path for long-cycle |

---

## Industry-Specific Modifications

**High-value, long sales cycle (B2B enterprise, legal, financial):**
- Avoid tROAS — deal values are too variable and infrequent
- Use tCPA based on a micro-conversion (demo, meeting booked) if direct revenue data isn't available
- Set tCPA 30-50% above current CPA initially to avoid over-constraining the algorithm

**High-volume, low-margin (ecommerce, commodities):**
- tROAS is essential — margin protection is automatic
- Set tROAS target 20% above break-even to build in buffer
- Monitor impression share — tROAS aggressively reduces spend when auction prices rise

**Seasonal businesses:**
- Avoid changing bidding strategy during or immediately before peak season
- Set tCPA/tROAS targets based on off-season data, then adjust 2 weeks before peak
- Do NOT switch strategies during peak — learning phase during peak season is catastrophic

**B2B SaaS (free trial):**
- Free trial sign-ups have highly variable quality — optimize for activation (in-app event) if possible
- If optimizing for trial only: expect high volume, lower quality
- Pass activation/upgrade data back to Google Ads for real signal

---

## Learning Period Management

Every new or changed bidding strategy triggers a learning period. During learning, performance is unpredictable.

| Conversion Volume | Learning Period Duration | Action During Learning |
|-------------------|------------------------|----------------------|
| <30/month | 4-6 weeks | Do NOT change targets or campaign structure |
| 30-50/month | 3-4 weeks | Do NOT change targets or campaign structure |
| 50-100/month | 2-3 weeks | Minor changes acceptable after 14 days |
| 100+/month | 1-2 weeks | Normal changes acceptable after 7 days |

**Hard rule: Minimum 14 days between any significant change.** Significant changes = new keywords, bid strategy change, target change >20%, new ad groups, new ads with new landing pages.

**What resets learning:**
- Bidding strategy change (full reset — treat as day 0)
- tCPA target change >30% (partial reset)
- Budget reduction >50% (partial reset)
- Pausing campaigns then resuming after 5+ days (full reset)
- Adding broad match keywords to campaigns with Smart Bidding (increases variance)

---

## Setting Initial Targets

**tCPA initial target:**
- Set at 10-20% ABOVE your current actual CPA
- Gives Smart Bidding room to operate without immediately failing
- Example: Current CPA $45 → set tCPA at $50-54 initially
- After 30+ days of stable performance, lower target by 10% increments

**tROAS initial target:**
- Set at 10-20% BELOW your current actual ROAS
- Gives Smart Bidding room without constraining too tightly
- Example: Current ROAS 4.2x → set tROAS at 3.5-3.8x initially
- After 30+ days stable, raise target by 10-15% increments

**Never set targets at your ideal — set them where you are now, then optimize.**

---

## Upgrade Triggers (When to Move Up the Maturity Ladder)

| Current Strategy | Upgrade To | When |
|-----------------|-----------|------|
| Manual CPC | Maximize Conversions | 30+ consistent conversions/month for 60+ days |
| Maximize Conversions | tCPA | 50+ conversions/month, stable trend |
| tCPA | tROAS | 100+ conversions/month with consistent conversion values |
| tROAS | Portfolio bidding / consolidation | 200+ conversions, multiple campaigns performing |

**Downgrade triggers (when to step back):**
- tCPA or tROAS performance degrading for 3+ consecutive weeks with no external cause
- Conversion volume drops below strategy's threshold (e.g., drops from 45 to 18/month)
- Bidding strategy enters extended learning (>4 weeks) without stabilizing

---

## Output Format

### Conversion Audit

| Metric | Your Number | Adjusted (VTC removed) | Maturity Level |
|--------|------------|----------------------|---------------|
| Raw conversions (30d) | [X] | [X] | [level] |
| Click-through only | — | [X] | [level] |
| Consistency | [clustered/even] | — | [flag if clustered] |

---

### Strategy Recommendation

**Recommended Strategy:** [Manual CPC / Maximize Conversions / tCPA / tROAS / Maximize Conversion Value]

**Confidence:** [HIGH / MEDIUM / LOW]

**Rationale:** [2-3 sentences connecting the data to the recommendation]

---

### Configuration Settings

| Setting | Value | Reason |
|---------|-------|--------|
| Bidding strategy | [strategy] | [reason] |
| Initial target | [tCPA: $X / tROAS: Xx] | [X]% above/below current actual |
| Budget recommendation | [maintain / increase / decrease] | [reason] |
| Learning period | [X] weeks | Based on conversion volume |
| First review date | [launch + 14 days] | Minimum before any assessment |

---

### Upgrade Roadmap

| Milestone | Trigger | Action |
|-----------|---------|--------|
| 30-day mark | If conversions stable and on-target | Assess tCPA target reduction |
| [X] conversions/month reached | When volume hits [next threshold] | Consider upgrading to [next strategy] |
| Seasonal peak approaching | 2 weeks before | Lock in current settings — no changes during peak |

---

## Guardrails

❌ NEVER count view-through conversions as signal for Smart Bidding readiness
❌ NEVER switch to tCPA or tROAS with fewer than 30 clean click-through conversions
❌ NEVER set tCPA at your aspirational target — always start above current CPA
❌ NEVER change bidding strategy mid-learning period
❌ NEVER run tROAS for lead gen unless lead values are consistent and trackable
❌ NEVER switch bidding strategies more than once every 30 days (learning resets each time)

✅ ALWAYS remove VTCs from conversion count before assessing data maturity
✅ ALWAYS give Smart Bidding 14 days minimum before evaluating performance
✅ ALWAYS document the current CPA/ROAS before changing strategy (comparison baseline)
✅ ALWAYS set initial targets conservatively — tighten after the algorithm proves itself
✅ ALWAYS note when offline conversion import is missing for lead gen accounts

---

## Troubleshooting

**Performance degraded after Smart Bidding switch:**
Before blaming the bidding strategy, rule out:
1. External factors (seasonality, competitor changes, market shifts)
2. Landing page issues (page speed, offers, content)
3. Conversion tracking changes (did something break?)
4. Creative fatigue (same ads running too long)

If all external causes are ruled out → bidding strategy mismatch. Evaluate downgrade.

**Smart Bidding "learning" status won't clear:**
- Campaign has too few conversions for the strategy
- Target is too aggressive (tCPA too low, tROAS too high)
- Too many changes during learning period
- Fix: reset strategy, allow 2 weeks of no changes

**tCPA at target but volume is too low:**
- Raise tCPA target by 20% — you're constraining the algorithm too tightly
- Check impression share — are budget limits reducing delivery?
- Evaluate keyword coverage — may need more keywords for the algorithm to find volume

**tROAS hitting target but improving ROAS makes revenue drop:**
- Algorithm is becoming too selective — only finding highest-value orders
- This may be correct (protecting margin) or wrong (missing profitable volume)
- Test: lower tROAS target by 15% and monitor revenue + margin together

---

## Confidence Thresholds

Maturity thresholds (conversion volumes, CPA/ROAS ratios, learning period durations) use knowledge-base/confidence-scoring.md (dynamic thresholds — compute per-client based on budget, CPC, conversion volume; static defaults must NOT be used).

---

## Cross-references

- Before deploying broad match alongside Smart Bidding, run the `broad-match-governance` skill — Gate 4 requires bidding strategy confirmation.
- Use the `quality-control` skill to validate conversion tracking is clean before running this audit.

---

## Save & Log

Save output to: `orgs/click-to-acquire/clients/[client-name]/audits/bidding-strategy-[YYYY-MM-DD].md`

> After saving, note: `cortextos bus log-change` — log strategy recommendation, maturity level, and current CPA/ROAS baseline.
