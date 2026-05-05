---
name: client-health
description: Scores every active Click To Acquire client on performance, activity, infrastructure, testing, and communication. Produces a ranked dashboard showing who needs attention, who is healthy, and who is at churn risk.
---

> **Owned by:** dexter (or mozart for morning briefing).

You are running the client health assessment for Click To Acquire.

---

## Step 1: Discover Active Clients

List all folders in `orgs/click-to-acquire/clients/` (excluding `_template`). Each folder is an active client.

For each client, read:
- `profile.md` — budget, target CPA, platforms, goals
- `change-log.md` — last 10 entries (recency and volume of activity)
- Any files in `audits/` — last audit date
- Any files in `reports/` — last report date
- Any files in `campaigns/` — active campaign docs

---

## Step 2: Health Scoring (Per Client)

Score each client across 5 dimensions on a 1-5 scale:

### A. Performance vs. KPIs (Weight: 30%)
- 5: CPA < target, conversions growing MoM
- 4: CPA within 10% of target, stable
- 3: CPA within 20% of target, flat
- 2: CPA 20-50% above target, declining
- 1: CPA > 50% above target or zero conversions

*If no performance data available, score 3 and flag "no data — needs performance pull"*

Confidence thresholds are computed per-client based on budget, CPC, and conversion volume — see `knowledge-base/confidence-scoring.md` (dynamic thresholds — compute per-client based on budget, CPC, conversion volume; do NOT use static defaults).

### B. Account Activity (Weight: 25%)
- 5: Change log updated in last 3 days, active optimization
- 4: Change log updated in last 7 days
- 3: Change log updated in last 14 days
- 2: Change log updated in last 30 days
- 1: No change log entries in 30+ days — **RED FLAG: account neglected**

### C. Infrastructure Health (Weight: 20%)
- 5: All tracking verified, landing pages fast, CRM connected
- 4: Tracking verified, minor gaps (e.g., no Clarity)
- 3: Tracking set up but not recently verified
- 2: Known tracking issues, or key infrastructure missing
- 1: No conversion tracking, no analytics — **RED FLAG**

### D. Testing Velocity (Weight: 15%)
- 5: Active tests running, testing map current, results documented
- 4: Tests running but testing map outdated
- 3: Last test completed 2+ weeks ago
- 2: No active tests, last test 30+ days ago
- 1: No testing ever conducted — **missing growth engine**

### E. Reporting & Communication (Weight: 10%)
- 5: Weekly reports delivered, client engaged
- 4: Bi-weekly reports, client responsive
- 3: Monthly reports, sporadic communication
- 2: Last report 30+ days ago
- 1: No reports ever sent — **RED FLAG: client may churn**

---

## Step 3: Calculate Overall Health Score

```
Health Score = (A * 0.30) + (B * 0.25) + (C * 0.20) + (D * 0.15) + (E * 0.10)
```

**Ratings:**
- 4.0 - 5.0: **HEALTHY** (green) — maintain current pace
- 3.0 - 3.9: **MONITOR** (yellow) — address gaps this week
- 2.0 - 2.9: **AT RISK** (orange) — immediate action plan needed
- 1.0 - 1.9: **CRITICAL** (red) — urgent intervention, churn risk

---

## Step 4: Generate Action Items

For every client scoring below 4.0, generate specific action items:

| Client | Score | Status | Top Issue | Recommended Action | Skill to Run |
|--------|-------|--------|-----------|-------------------|-------------|
| [name] | [X.X] | [color] | [what's dragging the score] | [specific fix] | [skill name] |

**Auto-generated recommendations by issue:**
- Account neglected (B < 3) → "Run `audit-google` or `audit-facebook` skill for [client]"
- No tracking verification (C < 3) → "Run `conversion-tracking-audit` skill for [client]"
- No active tests (D < 3) → "Run `create-testing-map` skill for [client], then `creative-testing` skill"
- No recent report (E < 3) → "Run `weekly-report` skill for [client]"
- CPA spiking (A < 3) → "Run `diagnose-cpa-spike` skill for [client]"
- No ICP on file → "Run `create-icp` skill for [client]"
- No hooks/angles bank → "Run `hooks-and-angles` skill for [client]"

---

## Step 5: Output

### Dashboard Summary
```
# Client Health Dashboard — [Date]

| Client | Score | Status | Performance | Activity | Infrastructure | Testing | Reporting |
|--------|-------|--------|-------------|----------|---------------|---------|-----------|
| [name] | [X.X] | [status] | [A] | [B] | [C] | [D] | [E] |
```

### Priority Action List
Ordered by severity (critical first):
1. [Client] — [action] — [why it's urgent]
2. ...

Save dashboard to `orgs/click-to-acquire/clients/_health-dashboard.md` (overwrite each time).

### Telegram Notification
Send to Robert:
- If any client is CRITICAL or AT RISK: send immediately with action items
- If all clients are HEALTHY or MONITOR: send as part of morning briefing only
- Format: concise, one line per client, sorted by score ascending (worst first)

---

After running, log via `cortextos bus log-change` and update bus task if applicable.
