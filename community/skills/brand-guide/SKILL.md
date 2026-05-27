---
name: brand-guide
description: "Per-client brand guide lifecycle — creation during onboarding + edit-request loop. Generates brand-guide.md from existing client materials (lp-copy, audits, vault notes), interviews Rob via Telegram for gaps, commits to clients/<client>/brand-guide.md. Powers the red-team Tier A persona-variant attacks. Triggers: 'create brand guide', 'scaffold brand guide', 'update <client> brand guide', 'edit <client> brand guide', 'change <client> brand guide'."
triggers: ["create brand guide", "scaffold brand guide", "build brand guide", "update brand guide", "edit brand guide", "change brand guide", "brand guide for", "make brand guide"]
---

# Brand Guide

> Owns the per-client brand-guide.md lifecycle. Powers red-team Tier A persona attacks.
> Lives at `orgs/<org>/clients/<client>/brand-guide.md` — git-tracked, mobile-editable via Telegram.

---

## When this skill fires

**Creation triggers** (Phase 0 of client onboarding OR Rob asks):
- "create brand guide for <client>"
- "scaffold brand guide for <client>"
- "build brand guide for <client>"

**Edit triggers** (Rob via Telegram, mobile-first):
- "update <client> brand guide — <natural language change>"
- "edit <client> brand guide: <change>"
- "change <client> brand guide — <change>"

---

## Anatomy of a brand-guide.md

The file follows the red-team template. Required sections:
1. Brand Name + one-line positioning
2. Target ICP (1-N personas with: demographics, role, primary pain, **dominant stall** [critical], emotional state, decision dynamic)
3. Universal Objection (top stall across all personas, in buyer voice)
4. Voice & Tone (3-5 adjectives, sentence patterns, signature phrases, banned phrases)
5. Verified Claims / Stats (publicly defensible only)
6. Banned Claims / Stats
7. Competitors (top 3-5, positioning + your differentiator)
8. Social Proof (testimonials/case studies/press/ratings — quantity + format)
9. Vertical / Compliance Notes (FDA, FTC, TCPA, etc.)
10. Category Context (horror stories, bad actors, your structural difference)
11. Known Conversion History (prior red-team scores, dead angles)

Template source: `orgs/<org>/brand/brand-guide.example.md`

---

## Creation Workflow

### Step 1: Locate existing client materials

```bash
CLIENT_DIR="orgs/$CTX_ORG/clients/<client-slug>"
ls "$CLIENT_DIR/" 2>/dev/null
```

Read every file in that directory + query KB for any docs tagged with the client:

```bash
cortextos bus kb-query "<client> ICP" --org $CTX_ORG
cortextos bus kb-query "<client> voice" --org $CTX_ORG
cortextos bus kb-query "<client> competitors" --org $CTX_ORG
```

Also check:
- `clients/<client>/lp-copy/*.md` (LP copy reveals positioning, claims, ICP)
- `clients/<client>/audits/*.md` (audit findings often surface pain points, objections)
- `clients/<client>/creatives/*.md` (ad copy reveals tested angles)
- `clients/<client>/playbook-override.md` (if exists, has ICP context)
- `central-vault/clients/<client>/**` (vault notes from intake calls)

### Step 2: Pre-fill from existing materials (~80%)

Draft `clients/<client>/brand-guide.md` using the template at `orgs/<org>/brand/brand-guide.example.md` as the base. Fill every section possible from existing materials.

**Mark unfilled sections with `<!-- GAP: <what's missing> -->` markers.** These become the questions for Rob.

### Step 3: Identify gaps and structure them for Telegram

Group gaps into batches of 3-5 questions max per Telegram message (mobile readability). Number them so Rob can answer "1: X, 2: Y" inline.

Example batch:
```
[14:32 ET / 18:32 UTC] Brand-guide draft for SID is 78% filled from existing materials. Need your input on these gaps:

1. Universal objection — what's the #1 reason SID leads go silent before booking? (e.g., "cost", "fear of dental work", "no time")

2. Persona 2 — beyond the price-conscious family, who else converts? (e.g., young professional, retired patient, parent of teen)

3. Banned claims — anything from prior comms that legal/insurance flagged or that you've explicitly told us NOT to say?

Reply inline: "1: ..., 2: ..., 3: ..."
```

Wait for Rob's response. Apply answers to draft. Loop until 0 gaps.

### Step 4: Send full draft for final review

```bash
cortextos bus send-telegram $CTX_TELEGRAM_CHAT_ID "Brand-guide complete for <client>. Drafted at clients/<client-slug>/brand-guide.md — sending the full file as attachment for your review. Reply 'approve' to commit, or send edits as 'update <client> brand guide — <change>'." --file "orgs/$CTX_ORG/clients/<client-slug>/brand-guide.md"
```

### Step 5: Append inline change-log + log event

The brand-guide lives under `orgs/` (gitignored at repo level), so change history is captured **inline** at the bottom of the file:

```markdown
## Change Log
- 2026-MM-DD HH:MM UTC — Created from intake + N gaps filled by Rob
```

Append-only; never edit prior entries. Then log event:
```bash
cortextos bus log-event action brand_guide_created info --meta '{"client":"<client-slug>","gaps_filled_by_rob":<N>}'
```

---

## Edit Workflow (mobile-first)

When Rob sends "update <client> brand guide — <change>":

### Step 1: Parse the request

- Identify target client (`<client-slug>` → `clients/<client-slug>/brand-guide.md`)
- Identify target section (universal objection / persona N / competitor list / banned claims / etc.)
- Identify the change (add / replace / delete)

### Step 2: Read current file + locate the section

Use the Read tool. Find the exact section. If ambiguous (e.g., "the second persona" vs "Persona 2"), ask Rob to clarify in one sentence before editing.

### Step 3: Apply the edit

Use Edit tool with precise old/new strings. Preserve all other content untouched.

### Step 4: Send before/after snippet back

Telegram doesn't render git diffs well — send a compact before/after instead:

```bash
cortextos bus send-telegram $CTX_TELEGRAM_CHAT_ID "Edit drafted for <client> brand guide, section '<section name>':

BEFORE:
<old text, max ~10 lines>

AFTER:
<new text, max ~10 lines>

Reply 'commit' to save, or 'refine: <change>' to adjust."
```

### Step 5: On 'commit' — append change-log entry

Append a single line to the file's `## Change Log` footer:
```markdown
- 2026-MM-DD HH:MM UTC — <section>: <one-line summary>. Source: Rob via Telegram. Exact request: "<verbatim quote>"
```

Then log event:
```bash
cortextos bus log-event action brand_guide_edited info --meta '{"client":"<client-slug>","section":"<section>","change":"<one-line>"}'
```

On 'refine' — re-edit, re-send before/after. Loop.

---

## Onboarding Integration

This skill is invoked from Phase 0 of `playbooks/client-onboarding.md`. After the intake checklist runs, the orchestrator triggers brand-guide creation.

Onboarding playbook Phase 0 should include:
```
- [ ] Build brand-guide.md (invoke brand-guide skill — agent drafts from materials + interviews Rob for gaps)
```

Brand guide must exist BEFORE Phase 3 (LP Build) — otherwise creative work runs without the red-team Tier A persona attacks and quality drops.

---

## Anti-patterns

- DO NOT draft the brand guide entirely from agent imagination — always pull from existing client materials first. Hallucinated personas produce worthless red-team attacks.
- DO NOT batch >5 questions per Telegram message — Rob is mobile-first and skims.
- DO NOT commit edits without sending Rob the diff first. The brand guide is downstream of every creative decision; silent edits = lost trust.
- DO NOT keep the brand guide outside `clients/<client>/` — that's the canonical location, picked up automatically by red-team Phase 0 brand detection.
- DO NOT use the agency-level `brand/brand-guide.example.md` as anything but a template. The per-client brand-guide.md is the source of truth.

---

*Owned by mozart (orchestrator). Other agents read this file but do not edit it directly — edit requests route through mozart so Rob always gets the diff first.*
