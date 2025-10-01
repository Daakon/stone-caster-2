# StoneCaster Application Specification

This document serves as both a **guide to build** the StoneCaster app and as **acceptance criteria** for verifying that the implementation is complete and correct.

---

## 1. Product Vision
StoneCaster is a mobile-first web application for interactive solo role‑playing. Players **cast Stones** to ripple through narrative worlds, creating branching adventures. The **Dimensional Drifter** acts as tutorial guide and brand mascot, introducing worlds and mechanics.

- **Guest (cookie-based)** users can start instantly, receive a small Casting Stone balance, and play limited turns.
- **Authenticated (Supabase)** users receive full wallets, can convert/purchase stones, and access subscriptions.
- **Every turn consumes Casting Stones** for both guest and authenticated users.

---

## 2. Key Features
- **Worlds & Adventures**: Browse, filter, view details; each World may have unique rules.
- **Game Sessions**: Spawn a game from an adventure, consume Stones per turn, view story stream, choices, relationships, factions.
- **Characters (guest or auth)**: Player-driven characters (not auth-only). Each **Character belongs to a World** and may be **active on one Adventure/Game at a time**.
- **Stones & Wallets**:
  - Guest wallet: Casting Stones only.
  - Authenticated wallet: Casting + inventory stones (Shard/Crystal/Relic) with conversion, purchases, and subscriptions.
- **Dimensional Drifter**: Contextual tutorial/guide lines throughout the app.
- **Config Spine + Feature Toggles**: All numbers, costs, flags live in DB or env, never hard-coded. A **feature toggle system** enables/disables app capabilities per environment.
- **AI Turn Engine**: Server assembles prompt, calls AI model, buffers/validates JSON, applies game state, returns full response.
- **Admin Panel**: Manage config values, feature flags, and **versioned prompts for worlds, scenarios, adventures, quests**.

---

## 3. Architecture
- **Frontend**: React, **Tailwind CSS** (utility-first), mobile-first, Zustand for state, TanStack Query for API, Supabase Auth.
- **Backend**: **Node/Express**, service-first design, Supabase Postgres, optional Redis/queue for async jobs, optional WebSockets.
- **3rd-Party Integrations**: **Obfuscated behind custom wrappers** (Auth, Payments, AI). No direct vendor calls in feature code; single replacement point.
- **Hosting**: Frontend on Cloudflare Workers/Pages; API on Fly.io.
- **Secrets**: Fly secrets & Wrangler env only; never hard-coded.

---

## 4. Database (Core Tables)
- `worlds`, `adventures`, `scenarios`, `quests` (content catalog)
- `cookie_groups`, `cookie_group_members` (guest identity)
- `guest_stone_wallets`, `stone_wallets`, **`stone_ledger`** (economy + audit)
- `games`, `turns` (sessions and state)
- **`characters`** (player characters: `id`, `owner_user_id?`, `owner_cookie_id?`, `world_id`, `active_game_id?`, traits JSON, timestamps)
- `prompts` (AI prompt templates, versioned)
- `app_config`, `pricing_config`, `ai_config`, `feature_flags`, `config_meta` (config spine)
- **Tags per entity**: `tags`, and join tables: `world_tags`, `adventure_tags`, `scenario_tags`, `quest_tags`, `character_tags`

---

## 5. API Endpoints
### Public (Browser-callable)
- **Me**: `GET /api/me`
- **Catalog**: `GET /api/worlds`, `GET /api/worlds/:id`, `GET /api/adventures`, `GET /api/adventures/:id`, `GET /api/search`
- **Games**: `POST /api/games`, `GET /api/games/:id`, `GET /api/games` (auth only), `POST /api/games/:id/turn`
- **Relationships/Factions**: `GET /api/games/:id/relationships`, `GET /api/games/:id/factions`
- **Characters (guest or auth)**: `POST /api/characters`, `GET /api/characters`, `GET /api/characters/:id`, `PATCH /api/characters/:id`, `DELETE /api/characters/:id`
  - Ownership by user or cookie; server-enforced. Character must be in **one active game/adventure at a time**.
- **Stones**: `GET /api/stones/wallet`, `POST /api/stones/convert` (auth), `GET /api/stones/packs`, `POST /api/stones/purchase`
- **Subscription (auth)**: `GET /api/subscription`, `POST /api/subscription/create|cancel|portal`
- **Telemetry**: `POST /api/telemetry/event`
- **Config**: `GET /api/config` (public safe projection with ETag)

### Internal Only
- Cookie → user group linking (auth callback)
- Guest → user migration (merge wallets, games)
- Daily stone regen job
- Purge stale guest groups/games
- Stripe webhooks: `POST /api/webhooks/stripe`
- **Admin Panel APIs**: manage config, feature flags, and versioned prompts for worlds/scenarios/adventures/quests (authz: admin role)

---

## 6. Game Loop Acceptance Criteria
- Every turn request (`POST /api/games/:id/turn`) must:
  - Resolve owner (JWT or cookie).
  - Deduct Casting Stones (via config-defined costs).
  - Be idempotent (Idempotency-Key required).
  - Assemble prompt from DB prompt templates.
  - Call AI API through **custom wrapper**, buffer stream, validate JSON (Zod schema).
  - Persist turn + update game snapshot + **append to stone_ledger** with `delta`, `reason`, `game_id`, `turn_id`.
  - Return validated JSON object (no partials).
- Guests with 0 stones → sign-up prompt.
- Auth users with 0 stones → store/convert/subscribe prompt.
- **Characters**:
  - Belong to a **World**.
  - May be **active on only one Adventure/Game at a time** (server constraint).

---

## 7. Frontend Acceptance Criteria
- **Mobile-first layout** with accessible design using **Tailwind CSS**.
- **Unified Player** screen: story stream, choice panel (shows stone costs), relationships/factions side panels.
- **Stones Pill & Sheet**: guest vs auth variants.
- **Dimensional Drifter bubble**: contextual tips; dismissible.
- **Dashboard**: continue adventures, view wallet, browse more.
- **World Browser**: includes world-specific rules preview.
- **Feature Toggles**: UI reacts to `feature_flags` (hide/disable gated features without redeploy).

---

## 8. Config Spine & Feature Toggles — Acceptance Criteria
- Config values stored in DB tables: `app_config`, `pricing_config`, `ai_config`, `feature_flags`.
- All services import values only via `config.service.ts`.
- `GET /api/config` returns safe projection, supports ETag and 304.
- Hot reload triggered by `config_meta.version` update.
- No hard-coded numbers in services or routes.
- Feature flags can enable/disable: Drifter, WS push, guest stone pill, beta worlds, etc.

---

## 9. Jobs & Operations
- **Daily stone regen**: Adds configured Casting Stones to wallets (guest groups and users).
- **Purge guest groups**: Removes expired cookie groups/games after TTL.
- **Stripe webhook**: Updates wallet/subscription via **payment wrapper**, verifies signature.
- **Telemetry**: Logs feature usage, turn latency, token counts.
- **Admin Panel**: CRUD for config, feature flags, and versioned prompts (worlds, scenarios, adventures, quests), with audit.

---

## 10. Security & Rules
- Owner resolution: server infers from JWT or httpOnly cookie. No client-supplied IDs.
- All turn-spending actions require idempotency keys.
- Config and secrets managed centrally; no hard-coded constants.
- RLS (Row-Level Security) for direct Supabase reads (auth only) as needed.
- Public endpoints never leak internal IDs or sensitive data.
- **3rd-party integrations** (Auth, Payments, AI) must go through **single custom wrappers**; no vendor SDKs scattered in feature code.

---

## 11. Test-Driven Development (TDD) Requirements
- Write failing tests **first**, then implement code until tests pass.
- **Unit tests**: config loaders, feature flags resolution, pricing lookups, wrappers (auth/payments/ai), turn JSON schema validation, stone ledger writes.
- **Integration tests**: `/api/config` ETag/304; `/api/games` spawn ownership (cookie vs auth); `/api/games/:id/turn` spending + idempotency; character constraints (one active game); feature flags toggling behavior.
- **E2E smoke**: guest spawn → play until 0 stones → signup → continue; auth convert/purchase flow (mocked via payment wrapper).

## 12. Acceptance Summary
The app is considered complete when:
- All endpoints function as specified, with correct auth/cookie behavior.
- Every turn consumes Stones according to DB config and **stone_ledger** records every transaction.
- Dimensional Drifter guides users contextually.
- Config spine and **feature toggles** are authoritative and hot-reloadable.
- Guest flow and auth flow both function end-to-end.
- **Admin panel** can manage config, flags, and versioned prompts for worlds/scenarios/adventures/quests.
- **3rd-party integrations** are isolated behind wrappers and are swappable with minimal refactor.
- TDD test suites (unit, integration, E2E) pass consistently.

---

**This document is the baseline contract: each layer must build on the previous without refactoring.**
