---
title: Project Agents & Operating Rules
description: A single, human-readable guide that consolidates the Cursor rule files in `.cursor/rules` into practical agent roles, responsibilities, triggers, and procedures.
---

# AGENTS

This document distills the rules in `.cursor/rules` into agent personas and day-to-day guidance. It’s intended for anyone (human or AI) contributing to this repository so that work remains aligned with our stack, quality bar, and delivery constraints.

Referenced rule sources:

- `.cursor/rules/00-global-guardrails.mdc`
- `.cursor/rules/10-react-front-end.mdc`
- `.cursor/rules/15-supabase-react-vite.mdc`
- `.cursor/rules/20-node-api.mdc`
- `.cursor/rules/90-testing-and-a11y.mdc`
- `.cursor/rules/91-noninteractive-terminal.mdc`
- `.cursor/rules/92-headless-and-single-run.mdc`
- `.cursor/rules/95-atomic-commits.mdc`
- `.cursor/rules/96-no-remote-ops.mdc`

Key docs to keep in sync (update in the same PR):

- `docs/FEATURES.md`
- `docs/UX_FLOW.md`
- `docs/API_CONTRACT.md`
- `docs/TEST_PLAN.md`
- `docs/MIGRATION_PLAN.md` (when schema changes)

Stack baseline (from rules):

- Frontend: React + Vite, React Router, shadcn/ui, Tailwind, React Query
- Auth/DB: Supabase (Postgres + Auth, RLS)
- API: Node/Express on Fly.io
- Deploy: Cloudflare Workers (frontend), Fly.io (API)
- Tests: Vitest + Testing Library, Playwright (e2e), @axe-core/playwright (a11y)
- Validation: Zod
- Banned: Next.js (App Router, Server Components/Actions, Next middleware, next.config)

Mobile- and a11y-first:

- Design and verify from 375–812 px before desktop.
- 0 serious/critical axe accessibility violations on key flows.

---

## Operating Protocol (All Agents)

1. Plan first
   - Produce a brief step-by-step architecture plan or pseudocode before big changes.
2. Confirm risky assumptions
   - If anything is unclear or risky, state assumptions in 1–2 bullets, then proceed.
3. Implement completely
   - Provide full code (no placeholders), correct imports, strict TypeScript, and Zod on all inputs.
4. Add tests and a11y checks
   - Update or add Vitest unit tests, Playwright e2e (headless, single-run), and axe checks.
5. Update documentation
   - Update `FEATURES.md`, `UX_FLOW.md`, `API_CONTRACT.md`, `TEST_PLAN.md`, and `MIGRATION_PLAN.md` when needed.
6. Security & privacy
   - Verify JWT auth, enforce Supabase RLS, never log secrets/PII.
7. Types & errors
   - Strict TS (no `any`), exhaustive unions. Use a typed `AppError { code, http, message, details? }`.

Environment guards for commands (assume CI/non-interactive):

- Always prefer non-interactive flags: `-y`, `--yes`, `--force`, `--non-interactive`, etc.
- Always headless and single-run for tests; remove `--watch`, `--ui`, and `--headed`.
- Recommended env: `CI=1 VITEST_WATCH=false PWDEBUG=0 FLY_NONINTERACTIVE=1 WRANGLER_NON_INTERACTIVE=1`.

---

## Agent Personas

### 1) Global Guardrail Agent

Scope: Always-on quality bar and delivery constraints.

Responsibilities:

- Enforce mobile-first (375–812 px) and a11y-first (0 serious/critical axe issues).
- Require TDD: add/adjust unit tests and e2e with each change.
- Ensure Zod validates all API inputs; return consistent JSON errors.
- Keep docs updated in the same PR (see key docs list).
- Security: JWT verification, Supabase RLS; never log secrets/PII.
- Strict TypeScript; exhaustive unions; no `any`.
- PR discipline: follow template, include mobile+desktop screenshots, add manual QA steps.

Triggers:

- All code changes; always apply.

Outputs:

- Updated code, tests, and docs with the above guarantees in place.

---

### 2) React Frontend Agent

Scope: `client/src/**/*.{ts,tsx}`, `client/src/**/*.css`

Responsibilities:

- Use shadcn/ui + Tailwind; design mobile-first.
- Forms with React Hook Form + Zod; label every input; wire `aria-describedby` for errors.
- State: local UI state in components; server state via React Query hooks.
- Navigation: mobile hamburger + Drawer for authed routes; persistent sidebar at `md+`.
- Performance: avoid heavy imports in hot paths; memoize noisy components; lazy-load heavy routes.

Testing:

- Update affected component tests; reflect in `docs/TEST_PLAN.md`.

---

### 3) Supabase Full-Stack Agent (React/Vite, shadcn/ui)

Scope: `client/src/**/*.{ts,tsx}`, `server/src/**/*.ts`, `shared/**/*.ts`, `docs/**/*.md` (always apply)

Responsibilities:

- Fit to stack (React/Vite + Express/Fly + Supabase) and ban Next.js patterns.
- Zod-validate inputs/outputs; use generated types where available.
- Enforce RLS and least-privilege policies; update `supabase/policies.sql` if schema changes.
- CRUD via React Query with optimistic updates and proper rollback.
- Realtime via Supabase channels, with subscription cleanup.
- Storage with signed URLs, bucket policies, and size/type validation.
- UI patterns: shadcn components; dark mode; token usage; multi-step flows with a Stepper.
- Avoid prop-drilling more than 2 levels (use context where needed).

Performance:

- Index DB queries; avoid N+1.
- Keep frontend bundles tight; lazy-load heavy routes.

Error handling:

- Use `AppError { code, http, message, details? }` and render friendly error cards and empty states with CTAs.

App-specific fit:

- World identity is normalized (`uuid + code`) and must resolve consistently.
- Characters are independent of Adventures; Adventures reference `characterId` + world.
- Saves may snapshot `gameData.player` for gameplay continuity.
- Use absolute API base URL envs (no relative CF paths when deployed on Workers/Fly).

Protocol reminders:

- Plan → Confirm assumptions → Implement → Tests & axe → Docs.

---

### 4) Node API Agent

Scope: `server/src/**/*.ts`

Responsibilities:

- Validate all request bodies/params with Zod; return `{ ok, data?, error? }`.
- Enforce auth on protected routes; scope queries by `userId`.
- World identity: resolve `code + uuid`; reject mismatches (e.g., `character.world_id !== world_id`).
- Keep character data de-nested in API resources (saves may snapshot for gameplay continuity).

References:

- `docs/API_CONTRACT.md`, `docs/MIGRATION_PLAN.md`.

---

### 5) Testing & A11y Agent

Scope: `client/src/**/*.{ts,tsx}`, `e2e/**/*.ts`, `server/src/**/*.ts`, `docs/**/*.md`

Responsibilities:

- Vitest: add meaningful unit tests including unhappy paths.
- Playwright: cover one happy path and at least one failure path; include mobile drawer flows.
- Axe: 0 serious/critical on Dashboard, Character Creation, and Game pages.

References:

- `docs/TEST_PLAN.md`.

---

### 6) Non-Interactive Terminal Agent

Scope: All commands; CI-friendly execution policy (always apply)

Responsibilities:

- Assume CI/non-interactive; use non-interactive flags (`--yes`, `-y`, `--no-input`, `--quiet`, etc.).
- Prefer `--dry-run`, `--check`, or `--plan` to preview risk when available.
- Never open editors or pagers (no `git commit` without `-m`, no `less`, `vim`, etc.).
- Prefer direct file edits over interactive generators/wizards.
- Abort long-silent commands that may be waiting for input and propose safe alternatives.
- No sudo or system-wide changes; stay within repo scope.

Stack-specific command forms:

- Fly.io: `FLY_NONINTERACTIVE=1 flyctl deploy --yes --detach`
- Wrangler: `wrangler deploy --yes --config wrangler.toml`
- Supabase CLI: `supabase login --token "$SUPABASE_ACCESS_TOKEN"`, `supabase link --project-ref "$SUPABASE_PROJECT_REF"`, `supabase db reset --force`
- Playwright: `npx playwright install --with-deps chromium`
- pnpm/npx create: `pnpm dlx <creator> --yes ...`, `npm create <x>@latest -y`
- Git: `git commit -m "feat: ..."` (never open an editor)

---

### 7) Headless & Single-Run Agent

Scope: All test commands (always apply)

Responsibilities:

- Never run interactive or headed test commands.
- Mappings:
  - `vitest` → `vitest run --coverage --passWithNoTests`
  - `pnpm test` → `pnpm test:ci`
  - `playwright test --ui|--headed` → remove those flags (run headless)
  - Remove any `--watch` flags (single-run only)
- Always set: `CI=1 VITEST_WATCH=false PWDEBUG=0`.

---

### 8) Atomic Commits Agent

Scope: Local git hygiene (always apply)

Responsibilities:

- Per task: create a branch `git checkout -b <type>/<area>-<kebab-title>`
  - type ∈ { feat, fix, chore, refactor, docs, test }
  - area ∈ { client, server, db, infra, docs, tests, ui, a11y }
- Make only changes required for this task.
- Run `pnpm ci` non-interactively; ensure it passes before committing.
- Use Conventional Commits and `.github/COMMIT_TEMPLATE.txt`.

Commit format:

- Title: `<type>(<area>): <imperative short summary>`
- Body sections: Why, What changed, API/Schema, Tests, Docs, Risk/Rollback, Screenshots.

Prohibitions:

- Do not `git push` or run any remote ops (see next agent).

---

### 9) Software Engineering Principles Agent

Scope: All code files; enforce traditional software engineering best practices (always apply)

Responsibilities:

**SOLID Principles:**

- **Single Responsibility**: Each component/function/class has one reason to change
- **Open/Closed**: Open for extension, closed for modification (use composition over inheritance)
- **Liskov Substitution**: Derived classes must be substitutable for base classes
- **Interface Segregation**: No client should depend on methods it doesn't use
- **Dependency Inversion**: Depend on abstractions, not concretions

**DRY & Code Organization:**

- **Don't Repeat Yourself**: Extract common logic into reusable functions/hooks
- **Consistent naming**: Use clear, descriptive names; follow established conventions
- **File organization**: Group related functionality; maintain logical directory structure
- **Import organization**: Group imports (external, internal, relative) with clear separation

**Atomic Design (UI Components):**

- **Atoms**: Basic building blocks (Button, Input, Label)
- **Molecules**: Simple combinations (SearchBox, FormField)
- **Organisms**: Complex UI sections (Header, CharacterCard, GameBoard)
- **Templates**: Page-level layouts without content
- **Pages**: Specific instances of templates with real content

**Clean Architecture:**

- **Separation of concerns**: UI, business logic, and data access are separate layers
- **Dependency direction**: Dependencies point inward (UI → Business → Data)
- **Abstraction layers**: Use interfaces/contracts between layers
- **Testability**: Each layer can be tested in isolation

**Design Patterns:**

- **Factory Pattern**: For creating objects (character creation, world generation)
- **Observer Pattern**: For event handling and state updates
- **Strategy Pattern**: For interchangeable algorithms (different game mechanics)
- **Repository Pattern**: For data access abstraction
- **Custom Hooks**: For reusable stateful logic in React

**Code Quality:**

- **Function size**: Keep functions under 20 lines when possible
- **Component complexity**: Limit component props to 5-7 maximum
- **Cyclomatic complexity**: Avoid deeply nested conditionals
- **Error boundaries**: Implement proper error handling at component boundaries
- **Performance**: Use React.memo, useMemo, useCallback appropriately

**Documentation:**

- **JSDoc comments**: For complex functions and public APIs
- **README updates**: When adding new patterns or architectural decisions
- **Code comments**: Explain "why" not "what" for complex business logic

Triggers:

- All code changes; always apply these principles.

Outputs:

- Code that follows established software engineering principles.
- Clear separation of concerns and maintainable architecture.

---

### 10) No Remote Ops Agent

Scope: Prevent pushes/PRs or remote CI/CD (always apply)

Responsibilities:

- Never run: `git push`, `git pull`, `git fetch --all --prune`, any `gh` commands, or deploy commands.
- If a step normally pushes or opens a PR, stop and report:
  - "Committed locally on branch <branch>. Manual push/PR is disabled by project policy."

---

## When To Engage Which Agent (by file patterns)

- Frontend changes: `client/src/**/*.{ts,tsx}`, `client/src/**/*.css`
  - React Frontend Agent, Supabase Full-Stack Agent, Testing & A11y Agent, Software Engineering Principles Agent
- API changes: `server/src/**/*.ts`
  - Node API Agent, Supabase Full-Stack Agent, Testing & A11y Agent, Software Engineering Principles Agent
- Shared/utility changes: `shared/**/*.ts`
  - Supabase Full-Stack Agent, Software Engineering Principles Agent
- Docs changes: `docs/**/*.md`
  - Supabase Full-Stack Agent, Testing & A11y Agent
- Any command execution, CI, or testing
  - Non-Interactive Terminal Agent, Headless & Single-Run Agent
- Always
  - Global Guardrail Agent, Software Engineering Principles Agent, Atomic Commits Agent, No Remote Ops Agent

---

## Quick Checklists

Delivery checklist (every PR):

- [ ] Mobile-first (375–812 px) layout validated
- [ ] axe shows 0 serious/critical on affected views
- [ ] Zod validations added/updated for API and forms
- [ ] Tests updated: Vitest unit + Playwright e2e (headless, single-run)
- [ ] Docs updated: FEATURES, UX_FLOW, API_CONTRACT, TEST_PLAN, MIGRATION_PLAN (if schema)
- [ ] Strict TS, no `any`; unions exhaustive
- [ ] JWT auth verified; Supabase RLS enforced
- [ ] **Software Engineering Principles applied:**
  - [ ] SOLID principles followed (single responsibility, proper abstractions)
  - [ ] DRY: no code duplication; reusable functions/hooks extracted
  - [ ] Atomic Design: components properly categorized (atoms/molecules/organisms)
  - [ ] Clean Architecture: proper separation of concerns and dependency direction
  - [ ] Design patterns used appropriately (factory, observer, strategy, etc.)
  - [ ] Code quality: functions <20 lines, components <7 props, proper error boundaries
  - [ ] Documentation: JSDoc for complex functions, clear naming conventions
- [ ] Conventional commit on a topic branch; no remote ops executed

Commands checklist:

- [ ] Non-interactive flags used; prefer dry-runs
- [ ] Headless & single-run for all tests
- [ ] No editors/pagers opened; no sudo/global changes

---

## References

- Prompt management and flows: `docs/prompt-management/*`, `docs/ai-systems/*`, `docs/PROMPT_CREATION_AND_DELIVERY_FLOW.md`
- Routing and core system docs: `docs/routing-system.md`, `NEW_SYSTEM_INTEGRATION_GUIDE.md`, `TEMPLATE_SYSTEM_GUIDE.md`
- Database migrations: `migrations/*.sql`
