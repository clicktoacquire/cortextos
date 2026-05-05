---
name: find-experiments
description: Identifies high-impact Google Ads experiments from actual account data — every recommendation is grounded in specific performance numbers, not generic best practices. Paste performance data to find scaling opportunities, waste to cut, efficiency improvements, and tests worth running, each with a confidence score.
---

> **Owned by:** sherlock (primary).

This skill is owned by sherlock.

---

You are running the PPC Experiment Finder for Click To Acquire.

Every experiment recommendation must be triggered by a specific performance pattern visible in the data. No generic best practices.

---

## Core Rules

**1. Surface What The Data Shows — Not Generic Advice**
- Don't suggest "test mobile ads" unless mobile performance shows a problem
- Don't recommend "add more keywords" unless search terms show missed opportunities
- ✅ "Mobile CVR is 0.8% vs desktop 2.4%" → Test mobile landing page
- ❌ "Test mobile landing page" (no data justification)

**2. Prioritize High-Impact, Low-Risk First**
- High Priority: Strong signal + easy to implement + low risk + clear impact
- Medium Priority: Good signal + moderate complexity
- Low Priority: Weak signal OR complex execution OR high risk

**3. Plain English Only**
- ✅ "Increase budget on branded campaign"
- ❌ "Optimize budget allocation for RLSA-enabled brand SKAG"
- ✅ "Mobile users convert 3× worse than desktop"
- ❌ "Device-level CVR variance indicates UX optimization opportunity"

**4. Connect Gaps to Dollar Impact**
- Don't say "CTR is low" — say "Campaign losing 60% impression share to budget — could generate ~$12K more revenue per month"

**5. Acknowledge Uncertainty — Don't Fake Confidence**
Not every signal is definitive. Use confidence scores and state when data is insufficient.

Refer to knowledge-base/confidence-scoring.md (dynamic thresholds — agent must compute applicable thresholds for the client based on budget + CPC + conversion volume, not the static defaults) for full threshold logic. Quick reference:
- 0.9–1.0: Strong signal, 30+ conversions, clear pattern
- 0.7–0.8: Good signal, 10–29 conversions
- 0.5–0.6: Weak signal, <10 conversions, inconsistent
- <0.5: Insufficient data — say so explicitly, do not recommend an experiment

---

## Step 1: Get the Data

Ask the user:
1. **Client name**
2. **Performance data** — paste campaign-level report. Better: include device/geo breakdowns, impression share, search terms
3. **Business targets** — Target CPA or ROAS. If unknown, I'll use account averages
4. **Date range** — last 30 days minimum. 90 days preferred for patterns

Read `orgs/click-to-acquire/clients/[client-name]/profile.md` for business context.

---

## Step 2: Analyze by Experiment Category

Work through each category. Only surface an experiment if the data specifically shows it.

### Category 1 — Alignment Problems (Fix Before Anything Else)
*If the alignment chain is broken, no optimization will work until it's fixed.*

Signals:
- High CTR + Low CVR → Ad promise doesn't match landing page
- Conversions but wrong-fit leads → Keywords attracting wrong audience

Experiment: Fix the alignment break before testing anything else. For deep diagnosis, invoke the `alignment-diagnosis` skill.
Priority: CRITICAL if found — pause other testing.

---

### Category 2 — Scaling Profitable Performance (Quickest Wins)
*Something is working and being held back. Get out of the way.*

Signals:
- High ROAS/low CPA + impression share lost to budget → Campaign starved of budget
- Strong performance + limited geography → Expand location targeting
- Profitable campaign + low ad rank → Increase bids to capture more auctions

Experiment format:
- **What:** Increase daily budget on [Campaign X] from $X to $X
- **Why:** Campaign has CPA of $X vs target $X, but only capturing X% impression share
- **Expected impact:** ~X additional conversions/month at target CPA
- **Confidence:** X (based on X conversions in last 30 days)
- **Risk:** Low — already proven profitable

---

### Category 3 — Stopping Obvious Waste (Cost Savings)
*Something is clearly not working. Stop paying for it.*

Signals:
- Campaigns/keywords with $X+ spend, 0 conversions
- High CPC keywords with near-zero CTR → Poor relevance, wasting Quality Score
- Campaigns running in wrong locations or at wrong times

Experiment format:
- **What:** Pause [Campaign/Keyword X]
- **Why:** $X spent, 0 conversions over X days
- **Expected impact:** $X/month recovered, reallocated to [winner]
- **Confidence:** X
- **Risk:** Low if spend is above $50 with 0 conversions

---

### Category 4 — Efficiency Improvements (Optimization)
*Make what's working work better.*

Signals:
- Mobile CVR significantly below desktop (>30% lower) → Test mobile landing page
- Geographic performance variance → Add bid adjustments by location
- Time-of-day patterns → Implement ad scheduling
- Match type efficiency differences → Tighten match types on wasted terms

Experiment format:
- **What:** Add -30% mobile bid adjustment to [Campaign X]
- **Why:** Mobile CVR is X% vs desktop X% — mobile converting at X× lower rate
- **Expected impact:** Reduce wasted mobile spend by ~$X/month
- **Confidence:** X
- **Risk:** Medium — watch for volume drop

---

### Category 5 — Expansion Opportunities (Growth)
*Find new demand to capture.*

Signals:
- Converting search terms not in keyword list → Add as exact match keywords
- High-performing ad groups with low impression share lost to rank → Increase bids
- Geographic areas with high intent but no coverage → Expand targeting

---

### Category 6 — Creative Testing (Iterative)
*Test copy when everything else is optimized.*

Signals:
- Ads running for 90+ days with declining CTR
- RSA ad strength below "Good"
- Only 1 ad per ad group (no test running)

Only recommend creative testing after Categories 1–3 are addressed. Don't test ads when the fundamental problem is alignment or budget. For RSA copy work, invoke the `google-ads-rsa` skill.

---

## Step 3: Output Format

### Experiment Prioritization
| Priority | Experiment | Category | Confidence | Est. Monthly Impact |
|----------|-----------|----------|------------|---------------------|
| 1 | | | X | $X |
| 2 | | | X | $X |

---

### Experiment Details

For each experiment:

**Experiment: [Plain English Title]**
- **Why test this:** [1–2 sentences with the specific data signal]
- **What to do:** [Exact steps]
- **How to measure success:** [Specific metric and threshold]
- **Decision point:** [When to call it — e.g., "2 weeks or 50 conversions"]
- **Confidence:** X | **Risk:** Low/Medium/High
- **Est. impact:** $X/month or X leads/month

---

### What NOT to Test Right Now
List 1–2 things the data says are fine or insufficient for testing. Prevent wasted effort.

---

## Step 4: Save & Log

Save to: `orgs/click-to-acquire/clients/[client-name]/audits/experiments-[YYYY-MM-DD].md`

Update the client's `testing-map.md` with any experiments approved to run.

Log in change log when experiments are launched via `cortextos bus log-change`.

Prompt: "To build a full structured testing map, run the `create-testing-map` skill for [client-name]."

After running this skill, log a one-line entry to the change-log via `cortextos bus log-change` and update the bus task if one exists.
