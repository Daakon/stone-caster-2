# Stonecaster: instructions for coding agents

This file is the shared entry point for every coding agent (Codex, Cursor, Copilot, Claude, Gemini and others). Tool-specific files (`CLAUDE.md`, `.cursor/rules/`, `.github/copilot-instructions.md`) point here.

## What this is

Stonecaster is an AI tabletop storyteller: handcrafted worlds, story-level rulesets, and a narrator that adapts to the player. It's a monorepo:
- `frontend/`: React, Vite, shadcn/ui, Tailwind, TanStack Query, zustand. Served on a Cloudflare Worker.
- `backend/`: Node and Express on Fly.
- `shared/`: Zod schemas and TypeScript types.
- `supabase/`: auth, database, migrations.
- `content/first-party/`: first-party rulesets, worlds and entities, synced with `npm run content:sync`.

## Rules

- Repo rules live in `.agent/rules/` and apply to every agent. Read the ones that match your task. `rule-scope-adherence.md`, `rule-accessibility-first.md`, `rule-design-system.md` and `rule-play-screen-design.md` apply to all UI work.
- Workflows for common tasks are in `.agent/workflows/`.
- Commit and branch rules: `.cursor/rules/95-atomic-commits.mdc`, `96-no-remote-ops.mdc`, `97-mainline-integration.mdc`. One task per branch, merged to main before the next.
- Terminal: non-interactive, single-run commands only (`.cursor/rules/91-*`, `92-*`). Use package scripts (`94-*`).

## Design is the source of truth for UI

All UI work follows `docs/design/`. Start at `docs/design/README.md`.
- **Mobile first.** Build at 390x844, then enhance for 1100 and 1440. Most players are on phones.
- Colours, fonts, sizes: only from `docs/design/play-redesign/tokens.css` (as CSS variables or Tailwind theme values). No raw hex, rgb or Tailwind palette colours (`text-cyan-400`, `bg-zinc-800`) in new or changed components. `node scripts/check-design-tokens.mjs` checks this.
- UI text never below 12px. Every tap target at least 44px. Every icon-only button has an accessible name.
- Show only data that exists. The play UI renders a HUD module only when the story's rulesets declare that field. Never default a stat to 100, never invent Health (no ruleset declares HP), and never show NPC facts the player hasn't learned. See SPEC §11.3–11.4.
- Names in designs (Kiera, Daakon, the Gilded Stag) are sample data. Use them only in fixtures and tests.

## Current work

The play-screen redesign is being built in phases: `docs/design/play-redesign/ROADMAP.md`, detailed in `PLAN.md`.
- F0a (frozen content and pinned sessions) is done locally.
- **Next: Phase 0**, the tokens and mobile-first shell. Task brief: `docs/design/play-redesign/PHASE0_BRIEF.md`, split into slices 0A (tokens), 0B (shell against fixtures) and 0C (backend play view). 0A and 0B are frontend-only and can start in parallel.

## Checks before you open a PR

```
npm run type-check
npm run lint
npm run test --workspace=frontend   # or backend, for the workspace you changed
node scripts/check-design-tokens.mjs
```

For UI changes, attach Playwright screenshots at 390, 1100 and 1440 and name the design screen(s) you matched. If a spec, plan or screen conflicts with the code or another rule, say so in the PR description instead of choosing silently.
