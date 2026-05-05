#!/usr/bin/env bash
# onboard-client.sh — scaffold a new client in the vault.
#
# Aligned with Rob's vision pillar 3 (client onboarding pipeline) and pillar 4
# (creative testing map). Creates the folder structure + starter templates so
# specialist agents have a known place to write client-scoped notes from day 1.
#
# Does NOT yet:
#   - request ad account access (out of scope for shell)
#   - ingest call transcriptions (mozart task)
#   - create BQ tables (sherlock/methy task)
#   - branch on existing-vs-new ad accounts (mozart routing decision)
#
# This is the vault-side seed. Mozart should follow with platform-side tasks.
#
# Usage:
#   onboard-client.sh <client-slug> [--name "<full-name>"]
#
# Exit: 0 ok, 2 bad args, 3 already exists.

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: onboard-client.sh <client-slug> [--name '<full-name>']" >&2
  exit 2
fi

SLUG="$1"; shift
NAME=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --name) NAME="$2"; shift 2 ;;
    *) echo "Unknown flag: $1" >&2; exit 2 ;;
  esac
done

if ! [[ "$SLUG" =~ ^[a-z0-9-]+$ ]]; then
  echo "client-slug must be lowercase letters/digits/dashes only" >&2
  exit 2
fi

NAME="${NAME:-$SLUG}"
DATE=$(date -u +%Y-%m-%d)
VAULT="${OBSIDIAN_VAULT:-$HOME/ObsidianVault}"

# Folders
FOLDERS=(
  "01-Clients/$SLUG"
  "05-Campaigns/$SLUG"
  "06-Creative/$SLUG"
  "07-Pipelines/$SLUG"
)
for f in "${FOLDERS[@]}"; do
  if [[ -e "$VAULT/$f" ]]; then
    echo "EXISTS: $VAULT/$f — refusing to overwrite" >&2
    exit 3
  fi
  mkdir -p "$VAULT/$f"
  echo "  mkdir $f"
done

# Brief template
cat > "$VAULT/01-Clients/$SLUG/brief.md" << EOF
---
agent: mozart
date: $DATE
type: client
status: active
client_slug: $SLUG
client_name: $NAME
links: [[../_FLEET_PROTOCOL]] [[testing-map]] [[../../05-Campaigns/$SLUG]] [[../../06-Creative/$SLUG]]
---

# $NAME — Brief

## Status
Onboarded $DATE. Mozart owns the platform-side onboarding tasks (ad account access, transcription ingestion, BQ table creation, branch decision).

## Account branch
- [ ] **Existing accounts** — audit running ads, baseline performance, identify quick wins
- [ ] **New build** — create ads from scratch, set up tracking, design creative testing map

## Stakeholders
- Primary contact: ?
- Account owner (sherlock):
- Creative owner (picasso):
- Ads owners (gary/googli/methy):

## Onboarding docs
- Onboarding call recording / transcript: TBD
- Brand guidelines: TBD
- Existing ad assets: TBD

## Spend posture
- Monthly budget: TBD
- Platforms: ?
- KPI / outcome metric: ?

## Open questions for Rob
-
EOF

# Creative testing map (pillar 4 — the vault that meta-agents publish from)
cat > "$VAULT/01-Clients/$SLUG/testing-map.md" << EOF
---
agent: picasso
date: $DATE
type: testing-map
status: draft
client_slug: $SLUG
links: [[brief]]
---

# $NAME — Creative Testing Map

Modular matrix for creative experimentation. Each cell is a testable variant
that picasso/gary/googli/methy can publish/pause based on performance.

## Products / Services

| Product/Service | Status |
|---|---|
| (TBD) | — |

## Angles

| Angle ID | Hypothesis | Status |
|---|---|---|
| A1 | (TBD) | draft |

## Hooks

| Hook ID | Type (curiosity / pain / social-proof / news / authority) | Copy | Status |
|---|---|---|---|
| H1 | curiosity | (TBD) | draft |

## Image types

| Type | Description | Status |
|---|---|---|
| product-shot | clean white-bg | — |
| lifestyle | in-context use | — |
| testimonial-still | screenshot of review | — |
| meme-format | trending visual | — |

## Video types

| Type | Description | Status |
|---|---|---|
| ugc-talking-head | creator-style direct address | — |
| screen-record-walkthrough | product demo | — |
| split-screen-comparison | before/after | — |
| ad-mashup | montage of clips | — |

## Open variants ready for QA

(picasso fills in as variants come ready for human review per HITL gate)

## Killed variants (with reason)

(maintained for learning — never delete, always annotate)
EOF

# Per-client change log (pillar 7 verification/observability)
cat > "$VAULT/01-Clients/$SLUG/change-log.md" << EOF
---
agent: any
date: $DATE
type: change-log
status: active
client_slug: $SLUG
links: [[brief]]
---

# $NAME — Change Log

Append-only record of every platform action taken on behalf of this client.
Each entry should link to a Playwright proof-of-work screenshot when applicable.

## Format

\`\`\`
### YYYY-MM-DD HH:MM — <agent> — <action>
- What changed: ...
- Platform: Google Ads | Meta | LP | analytics | other
- Reason: ...
- Proof: [screenshot path or n/a]
- Reverted? n / y (link to revert entry)
\`\`\`

---

### $DATE — mozart — Client onboarded
- Folders scaffolded: 01-Clients/$SLUG, 05-Campaigns/$SLUG, 06-Creative/$SLUG, 07-Pipelines/$SLUG
- Brief, testing-map, change-log templates created.
EOF

# Campaigns README (placeholder for sherlock/gary/googli)
cat > "$VAULT/05-Campaigns/$SLUG/README.md" << EOF
---
agent: any
date: $DATE
type: campaign-index
status: active
client_slug: $SLUG
links: [[../../01-Clients/$SLUG/brief]]
---

# $NAME — Campaigns

One file per active campaign. Cross-link to creative variants in 06-Creative/$SLUG.
Campaign filename pattern: \`<platform>-<campaign-id>-<short-name>.md\`.
EOF

# Creative folder README (picasso)
cat > "$VAULT/06-Creative/$SLUG/README.md" << EOF
---
agent: picasso
date: $DATE
type: creative-index
status: active
client_slug: $SLUG
links: [[../../01-Clients/$SLUG/brief]] [[../../01-Clients/$SLUG/testing-map]]
---

# $NAME — Creative Assets

Each variant gets its own subfolder with versions, scripts (for video), QA
notes, and Figma-style commentary thread.

Subfolder pattern: \`<variant-id>-<short-description>/\`.
EOF

# Pipeline notes (methy/dexter)
cat > "$VAULT/07-Pipelines/$SLUG/README.md" << EOF
---
agent: methy
date: $DATE
type: pipeline-index
status: active
client_slug: $SLUG
links: [[../../01-Clients/$SLUG/brief]]
---

# $NAME — Data Pipelines

Track ingest health for this client across Google Ads, Meta, GA, Clarity,
PostHog, CallRail. Note any account-level access issues, schema gotchas,
or rate-limit incidents.
EOF

echo
echo "  Onboarded: $NAME ($SLUG)"
echo "  Vault folders: ${FOLDERS[*]}"
echo "  Templates: brief.md, testing-map.md, change-log.md (+ 4 README index files)"
echo
echo "  Next steps for mozart:"
echo "    1. Send the new client brief to your specialists for review"
echo "    2. Decide branch (existing-accounts vs new-build) and dispatch initial tasks"
echo "    3. Schedule onboarding call ingestion + ad account access requests"
echo "    4. Trigger sherlock/methy to spin up BQ tables (per their warehouse playbook)"
