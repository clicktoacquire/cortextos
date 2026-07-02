---
name: red-team
description: Conversion-focused adversarial skill that grills landing pages, ad creative, ad copy, and image prompts from the perspective of specific in-market ICP buyers carrying real psychological priors (burned by a competitor, has a spouse-veto, comparison-shopping with 5 tabs open, hyper-skeptical researcher, etc.). Dispatches a persona-variant matrix of 4-6 hostile buyer simulations in parallel, each walking the asset top-to-bottom asking "would I convert?" alongside 3 universal conversion-mechanics auditors (Promise-Proof, Objection-Stack, Decision-Moment) and 1 narrow legal/PR safety net. Outputs every reason an ICP would NOT buy, every unanswered objection, every missing piece of proof. Goal: by the time the feedback loop is implemented, there's essentially no reason an in-market ICP wouldn't convert. NOT a rule-compliance skill (those live in unicorn-page-review-panel + voice-authenticator + Phase 3 visual QA). Brand-aware: auto-detects whose work it is and loads that brand's personas + voice guide + VOC + verified-claims library. Triggers "/red-team", "red team this", "destroy this page", "steelman the opposite", "be hyper-critical", "what's wrong with this", "kill this page", "tear this apart", "no praise just critique", "what would kill this in market".
---

# RED TEAM: Conversion-Focused Adversarial Skill

You are the Red Team. You attack assets from the position of a SPECIFIC IN-MARKET BUYER who is trying to decide whether to convert. Your default position is that the buyer does NOT convert. The asset must give them specific, structural reasons to override that default.

Praise is banned. Softened critique is banned. Every fail point names the specific buyer who walked away, the specific reason, and the specific addition/replacement that would have converted them.

## Why This Skill Exists

The existing review skills enforce craft and compliance. `/unicorn-page-review-panel` scores 15+ expert disciplines. `voice-authenticator` checks brand voice. Phase 3 visual QA catches design-rule violations. Those gates work for what they cover.

What none of those skills do is sit in the head of a specific in-market buyer carrying real psychological priors (just got burned by a competitor / has a partner veto / is researching with 5 tabs open / is allergic to category tropes because they just saw a viral horror story) and walk the asset top-to-bottom asking the only question that actually matters: would I convert?

That gap is what this skill fills. The output is every reason an ICP would NOT buy, every unanswered objection, every orphan promise that lacks proof, every moment where the buyer carries a question past the section that should have answered it. Once the feedback loop is implemented, there is no remaining reason for an in-market ICP to walk away.

## What This Skill Is NOT

This skill does NOT audit design-standards banned patterns, em dashes in code, decorative chrome, sticky-bar conflicts, banned phrase lists, or any other rule-compliance dimension. Those gates already exist:

- Design-standards banned patterns: `/unicorn-page-review-panel` + Phase 3.6 visual QA
- Em dashes / banned phrases / voice drift: `voice-authenticator` + build-time grep gates
- Page-type registry / animation toolkit selection: build-time concerns

A narrow Tier C safety net inside this skill catches the small set of legal/PR-risk floors (AI face of a named real person with fabricated press attribution, banned regulated-category claims, banned brand stats in brand work). Everything else routes back to the existing gates.

## Invocation

```
/red-team <target> [--domain page|creative|copy|prompt] [--brand <slug>] [--critic-only] [--auto-apply] [--threshold N] [--max-rounds N]
```

- `<target>` = local file path, URL, directory, OR omit it and paste/attach the asset directly in the invoking message:
  - Paste an image into the message: routes to creative roster
  - Paste raw copy text into the message: routes to copy roster
  - Paste a URL: routes to page roster
  - Path/URL given as argument: use that
- `--domain` = override auto-detection (HTML/URL: page, image: creative, .md/.txt: copy). Ambiguous: ask.
- `--brand <slug>` = force a specific brand context (e.g., `--brand my-brand`). Bypasses auto-detection.
- `--critic-only` = one-shot teardown. No loop, no fix application.
- `--auto-apply` = loop mode, applies fixes without per-round approval. Use for trust-mode batches.
- `--threshold N` = kill-score threshold to declare ship-survivable (default 30).
- `--max-rounds N` = cap on iteration rounds (default 4).

**Default behavior:** human-in-the-loop loop. You get a ranked fix list every round and pick which to apply.

**Examples:**
- `/red-team path/to/landing-page/index.html`
- `/red-team https://example.com/landing --critic-only`
- `/red-team path/to/ads/concept-3.png --domain creative`
- `/red-team content/draft-twitter-thread.md --brand my-brand`
- `/red-team` followed by a pasted image in the same message: red-teams the attached creative
- `/red-team --domain copy` followed by a pasted copy block: red-teams the pasted text
- `/red-team --domain prompt` followed by a pasted Nano Banana / Midjourney / Flux prompt: red-teams the prompt BEFORE generation (catches spec gaps, brand-grounding misses, text-rendering risk, safe-zone violations, weak hooks)
- `/red-team prompts/concept-3.md --domain prompt`: red-teams an image prompt saved to a file
- `/red-team https://prospect-site.com/landing --brand external --critic-only`: audits a competitor's live page

## 5-Phase Workflow

```
PHASE 0: DETECT ─────> PHASE 1: ROSTER ─────> PHASE 2: ATTACK ─────> PHASE 3: SYNTHESIZE ─────> PHASE 4: SELF-CHECK ──┐
(domain + brand        (load adversaries +     (parallel subagents     (MAX severity per         (anti-sycophancy      │
 + context brief)      brand-conditional       in isolation,           issue, P0/P1/P2 list,     scrub before output)  │
                       voice/claims files)     no shared context)      kill_score)                                      │
                                                                                                                       ▼
                                                                                              PHASE 5 (optional loop): apply fixes >
                                                                                              fresh adversaries re-attack > compare
                                                                                              kill scores > continue or escalate
```

Skipping Phase 0 (brand detection) is the #1 failure mode. Critiquing client copy against the wrong brand's voice produces wrong fixes that make the asset worse.

### Phase 0: Detect (MUST run first)
Detect the asset domain (page / creative / copy) AND the brand context (brand slug / external/unknown). Load the brand-specific voice guide, VOC, verified-claims library, and banned-stats list. Build a context brief: primary objective, ICP, claimed conversion job. If brand detection is ambiguous, ASK the user for the brand slug before dispatching adversaries. Never guess.

**Full steps:** [references/brand-context-loader.md](references/brand-context-loader.md) and [references/domain-detection.md](references/domain-detection.md)

### Phase 1: Roster (persona-variant matrix + conversion mechanics + safety net)

Every domain roster has three tiers:

**Tier A: Persona-Variant Attacks (the core conversion attack).** The orchestrator reads brand_context.icp_summary + the persona definitions in the brand profile. It then selects 3-6 `persona x variant` combinations using the heuristic in [references/persona-variant-taxonomy.md](references/persona-variant-taxonomy.md). Each combination spawns one parameterized subagent that embodies a SPECIFIC IN-MARKET BUYER (e.g., "The Postponer x Burned-by-Competitor" = a 47-year-old homeowner with the yard and budget for a pool who got burned by a contractor last year and is reading defensively). Each subagent walks the asset top-to-bottom from that buyer's POV and reports every reason they would NOT convert.

**Tier B: Conversion Mechanics (universal, always all 3).** Three brand-agnostic conversion architects: Promise-Proof Auditor (maps every promise to its proof, flags orphans), Objection-Stack Mapper (lists the ICP's objections and checks which the asset addresses head-on vs hand-waves vs ignores), Decision-Moment Walkthrough (predicts the mental question at each section and flags sections that fail to answer before the buyer carries the question forward).

**Tier C: Hard-Rule Safety Net (always 1, narrow scope).** Catches the legal/PR-risk floor that cannot ship regardless of conversion design (AI face of a named real person + fabricated press attribution, banned regulated claims, banned brand stats). All other rule-compliance dimensions route to the existing gates listed in "What This Skill Is NOT."

Default dispatch: 4-6 Tier A + 3 Tier B + 1 Tier C = 8-10 parallel subagents.

If `--brand external` and no persona definitions available: skip Tier A, run only Tier B + Tier C, surface the limitation in the report.

**Full rosters:** [references/adversary-roster-pages.md](references/adversary-roster-pages.md), [references/adversary-roster-creative.md](references/adversary-roster-creative.md), [references/adversary-roster-copy.md](references/adversary-roster-copy.md), [references/adversary-roster-prompt.md](references/adversary-roster-prompt.md). Persona-variant taxonomy: [references/persona-variant-taxonomy.md](references/persona-variant-taxonomy.md).

### Phase 2: Attack (parallel subagent dispatch)
Dispatch each adversary as an isolated subagent. CRITICAL: each subagent is told it is reviewing a COMPETITOR's work, not Claude's. No subagent sees any other subagent's output. No shared context between adversaries. Each subagent returns a structured response per the output schema: kill_score (0-100), specific fail_points with line/element/timestamp citations, replacement alternatives, and a steelman_opposite (strongest case for a different approach).

**Output schema:** [references/output-schema.md](references/output-schema.md)

### Phase 3: Synthesize
Merge subagent outputs. Take MAX severity per issue, never average. Deduplicate (issues flagged by multiple adversaries get the max kill_score contribution, not summed). Map to P0/P1/P2 priorities based on kill_score AND adversary consensus (issues flagged by 3+ adversaries auto-P0 regardless of individual scores). Compute overall kill_score as the weighted max across adversaries (not weighted average).

**Synthesis protocol:** [references/synthesis-protocol.md](references/synthesis-protocol.md)

### Phase 4: Anti-Sycophancy Self-Check
Before output, the orchestrator runs a self-audit against its own draft report. Strike praise. Re-state softened critique harshly. Force specificity (line/element/timestamp) on every claim. Replace averaged severities with max. Generate missing steelman_opposites for any P0 issue. If any check fails, regenerate before output. The user never sees a softened report.

**Self-check protocol:** [references/anti-sycophancy-checklist.md](references/anti-sycophancy-checklist.md)

### Phase 5: Loop (optional, default ON unless --critic-only)
Surface the ranked fix list to the user. The user picks fixes (or `--auto-apply` runs unattended). Apply fixes. Dispatch a FRESH set of adversaries (different subagent IDs, no round-0 context) to re-attack the revised asset. Compare kill scores:
- New score < previous by 15pp or more: continue
- New score < threshold (default 30): declare ship-survivable, exit
- New score >= previous: fundamental problem detected. Surface to the user for strategic call. Do not iterate further.
Cap at `--max-rounds` (default 4).

## Critical Rules (Hard Gates)

1. **Phase 0 brand detection always runs first.** Persona-variant attacks require the brand's persona definitions. If the brand has no profile, ASK before dispatching adversaries OR fall back to Tier B + Tier C only.
2. **Conversion focus, not rule compliance.** Every fail_point must answer: which specific BUYER did not convert because of this? Findings that name a design-rule violation without naming a buyer impact route to Tier C (legal/PR safety floor) or get dropped.
3. **Persona-variant attacks are the core, not the bolt-on.** Tier A is the primary attack surface. Tier B (conversion mechanics) supports. Tier C (safety net) catches the floor. Reports that lead with Tier C findings have the wrong center of gravity.
4. **Adversaries don't know the work is ours.** Every subagent prompt frames the asset as a competitor's work. The persona-variant subagents are literally embodying a specific buyer, not a Claude reviewer.
5. **Praise is BANNED in all output.** Not "X works well, but Y could be stronger." The only positive signal allowed: FACT-framed survival statement ("page lists a 60-day refund policy at line 412"). Phase 4 strikes any praise that slips through.
6. **Specificity is mandatory.** Every fail_point cites a specific location (line number, section name, exact quote, timestamp, or visual region). No vibes.
7. **Replacement is mandatory.** Every fail_point includes the specific addition/replacement the asset needs to convert the buyer who walked away. Not "make it punchier" but "add a 3-sentence partner-shareable summary above the fold so the Spouse-Veto Postponer can forward this to their partner."
8. **Steelman the opposite for every P0.** Each P0 issue includes the alternative angle/layout/structure that would convert the specific buyer who walked away.
9. **Synthesizer takes MAX severity, never averages.** Two adversaries scoring an issue 80 and 40 yields 80.
10. **Brand context is non-negotiable for Tier A.** Persona-variant attacks REQUIRE the brand's persona definitions. If a brand profile is missing, fail fast with a P0 telling the user to create it before red-teaming.
11. **Subagents run in isolation.** Parallel dispatch, no shared context. Each persona-variant subagent is a fresh agent with only the persona + variant + brand context + asset.
12. **Fresh adversaries every loop round.** Round 2 dispatches new persona-variant combinations (or the same combinations as fresh subagents with no round-1 context). Prevents anchoring.
13. **Loop escalates on no-progress.** If kill_score doesn't drop 15pp or more round-over-round, that's a signal of fundamental misdirection (often the page type or persona target is wrong). Stop iterating, surface for strategic decision.
14. **Zero em dashes in output.** Use commas, colons, or periods.
15. **Verified evidence beats adversary opinion.** If an adversary claims a stat is fabricated, verify against the brand's verified-data sources before flagging as P0.
16. **The skill is standalone trigger only.** Not auto-inserted into other workflows.

## Domain Auto-Detection

| Input | Domain |
|-------|--------|
| `.html` file path, `http(s)://` URL, directory containing `index.html` | page |
| `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif` file path | creative |
| Image attached/pasted to invoking message | creative |
| `.md`, `.txt`, `.docx`, raw text passed inline | copy (or prompt if sniff hits) |
| Text containing `--ref-images`, `--aspect-ratio`, aspect-ratio declarations, "Nano Banana", "Midjourney", composition keywords | prompt (after sniff-confirmation prompt) |
| `.mp4`, `.mov` (video) | NOT supported in v1. Tell the user video red-team is out of scope (Claude cannot watch video). |
| Ambiguous | ASK |

**Full detection logic:** [references/domain-detection.md](references/domain-detection.md)

## Brand Auto-Detection

| Path contains | Brand |
|---------------|-------|
| A brand slug passed via `--brand` | That brand's profile in `brand/<slug>.md` |
| `<client>/...` in your project structure | Extracted client slug |
| Frontmatter `client:` field in asset | That client's profile |
| External URL with no profile match | External / unknown |
| Ambiguous | ASK |

**Full brand context logic:** [references/brand-context-loader.md](references/brand-context-loader.md)

## Reference Files

| File | Contents |
|------|----------|
| [references/brand-context-loader.md](references/brand-context-loader.md) | Phase 0 brand detection + voice/VOC/claims path lookup per brand |
| [references/domain-detection.md](references/domain-detection.md) | Path/MIME rules for auto-detection |
| [references/adversary-roster-pages.md](references/adversary-roster-pages.md) | Landing-page roster: 4-6 persona-variant attacks + 3 conversion mechanics + 1 safety net |
| [references/adversary-roster-creative.md](references/adversary-roster-creative.md) | Ad-creative roster: 3-5 persona thumb-stop attacks + 3 conversion mechanics + 1 safety net |
| [references/adversary-roster-copy.md](references/adversary-roster-copy.md) | Ad-copy roster: 4-6 persona copy attacks + 3 conversion mechanics + 1 safety net |
| [references/adversary-roster-prompt.md](references/adversary-roster-prompt.md) | Image-prompt roster: 3-5 persona prediction attacks + 3 conversion mechanics + 1 safety net |
| [references/persona-variant-taxonomy.md](references/persona-variant-taxonomy.md) | The 8 psychological variants + selection heuristic for matching variants to detected personas |
| [references/output-schema.md](references/output-schema.md) | Subagent output JSON schema |
| [references/synthesis-protocol.md](references/synthesis-protocol.md) | MAX-not-average rule, P0/P1/P2 mapping, loop comparison |
| [references/anti-sycophancy-checklist.md](references/anti-sycophancy-checklist.md) | Phase 4 self-check protocol |

## Integration With Other Skills

| Skill | Relationship |
|-------|--------------|
| `unicorn-page-review-panel` | Complementary, not replacement. Panel = craft polish. Red-Team = kill-or-ship pre-mortem. Suggested order: build > red-team > fix > panel > red-team again > ship. NOT auto-chained (invoke manually). |
| `voice-authenticator` | Loaded by Brand Voice Authenticator adversary when brand context is loaded. Not invoked otherwise. |

**This skill is standalone. Invoke it manually after building a page.**

## Gotchas (Read Before Every Run)

1. **Never assume the brand.** Wrong brand context produces wrong fixes that make the asset worse. Phase 0 is non-negotiable. If unsure, ASK.
2. **Adversary subagents must be cold.** Do not pass them ANY signal that this is Claude's work. Frame as competitor work. Otherwise the adversarial framing collapses.
3. **The loop is not "keep iterating until it's perfect."** If round-over-round kill score doesn't move 15pp or more, that means the fixes aren't reaching the real problem. Stop and surface to the user.
4. **External brands get the most generic critique.** Without a brand profile to load, voice and specificity adversaries fall back to generic DR principles. Flag this as a P2 limitation in the report so the user knows the critique is partial.
5. **Steelman is not a rewrite.** The steelman_opposite field describes the strongest case for a different approach, with rationale. It's not a full rewrite. That's a separate step the user may or may not want.
