# Contributing to cortextOS

## Development Setup

```bash
git clone https://github.com/grandamenium/cortextos.git
cd cortextos
npm install
npm run build
npm test
```

## Before Submitting Changes

1. `npm run build` — TypeScript must compile cleanly
2. `npm test` — all tests must pass
3. Match existing patterns in `src/` for new features
4. Add unit tests in `tests/` for any new code

## Project Structure

- `src/` — TypeScript source (bus, cli, daemon, hooks, types, utils)
- `bus/` — Shell wrapper scripts (delegate to `dist/cli.js bus`)
- `dashboard/` — Next.js 14 web dashboard
- `templates/` — Agent templates (agent, orchestrator, analyst)
- `community/` — Community skills and agent catalog
- `tests/` — Unit, integration, and E2E tests

## Code Style

- TypeScript strict mode
- No external runtime dependencies beyond what's in `package.json`
- File operations use atomic writes (see `src/utils/atomic.ts`)
- All bus operations go through `src/bus/` modules

## Permission Management

Watch your own tool call history within the session. If you notice you've called a tool 3+ times that isn't in `.claude/settings.json` under `permissions.allow`, those calls likely each fired a prompt. Tell Rob what you noticed, propose the specific entry you'd add (wildcard or bare name), and wait for explicit confirmation before writing:
- **MCP tool** (starts with `mcp__`): propose wildcard `mcp__<server>__*`
- **Built-in tool**: propose the bare tool name

Also: if a tool gets denied, propose the allowlist entry and confirm with Rob before retrying. If Rob says he keeps getting prompts, run `/fewer-permission-prompts` to scan past sessions and surface allowlist proposals — still confirm before applying.

Use `/update-config` to write changes to `settings.json` once approved.

**Current allow-list scope (set 2026-05-06):** `defaultMode: bypassPermissions` + comprehensive bare-name + MCP-wildcard allow list in `.claude/settings.json`. Most everyday tools no longer prompt.
