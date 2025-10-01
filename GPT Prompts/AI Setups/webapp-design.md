# Build Prompt — “Universal RPG Storyteller Webapp (Multi‑World + Subscriptions)”

You are a senior full‑stack engineer. Generate a production‑ready webapp that implements **RPG Storyteller** as a world‑agnostic, multi‑adventure platform. Users can browse worlds/adventures, create & store multiple characters, play sessions with saves, and unlock premium content via subscriptions or one‑off purchases. Include moderation, observability, and an admin console.

## Product Goals

- **World‑independent** engine: load any compatible world/adventure bundle at runtime.
- **Library & Marketplace**: browse, preview, install/activate content (free or paid).
- **Characters & Saves**: users create characters per world/adventure, resume later.
- **Monetization**: subscriptions (tiered), one‑off adventure purchases, trials.
- **A/B Model Routing**: OpenAI + Anthropic with per‑session switching.
- **Safety**: text moderation; image generation gated by scene metadata.
- **Mobile‑first** UX with numbered choices, icons, and streaming turns.

## Opinionated Stack

- **Frontend**: Next.js 14 (App Router, RSC), TypeScript, Tailwind, shadcn/ui, Zustand for client state.
- **Backend**: Node 20 with Next API routes (or Express), **Socket.IO** for streaming turns.
- **DB**: Supabase Postgres (JSONB for saves), **Redis** (session, rate limits, queues).
- **Auth**: NextAuth (Email/OAuth). RLS on user‑scoped data.
- **Payments**: **Stripe** (Checkout + Billing + Customer Portal + Webhooks). Support subscriptions + one‑off SKUs; entitlements synced by webhook.
- **Storage**: Supabase buckets for bundles and downloadable saves. Hash every bundle; CDN cache.
- **Infra**: Docker; Vercel (frontend) + Fly/Render (API/WS). IaC optional (Terraform).
- **Tests**: Vitest + Playwright (E2E), zod for API validation, smoke tests for narrative rules.

## Content System (World‑Agnostic)

Implement a **bundle loader** that accepts a zipped folder and loads files **in strict order** (skip missing with graceful degradation; log which are absent):

1. `world-codex-<world>-logic.json`
2. `systems.unified.json` (schemas, skills, policies, beats, guards)
3. `style.ui-global.json`
4. `style.<world>.md`
5. `core.rpg-storyteller.json`
6. `agency.presence-and-guardrails.json`
7. `save.instructions.json`
8. `validation.save.json`
9. `validation.assets.json`
10. `adventure.<name>.json`
11. (Save structure defined in save.instructions.json)
12. `world-codex-<world>-lore.md` (non‑binding flavor)

- Maintain a **Bundle Registry**: `bundles(id, world_id, world_name, adventure_id, adventure_name, version, files_meta JSONB, price_cents, is_free, visibility, image_urls, created_at, activated_at)`.
- Each bundle passes a **compatibility check** (engine version, required templates).
- On activation, pre‑compute renderer inputs and cache.

## Engine Runtime Contracts (Enforce Globally)

- **First‑meet = observed‑only**: show `alias` + observable traits until explicit reveal.
- **Name‑gating**: NPCs must not address player by name until player shares it on‑screen.
- **Player dialog visible**: user lines render as `**You:** {text}` in eligible phases.
- **Headers always render**: location, time (icon+label), weather; safe fallbacks.
- **Numbered choices**: `1)`, `2)`, `3)`…
- **Outcome lock**: no ambient text during `outcome_render` or `choice_menu_render`.
- **Recap on load**: after loading any save, show `## ✨ Recap` before resuming.
- **Graceful degradation**: if a template/field is missing, continue with plain text and log.

_(These mirror our 5.8.1 fixes and must be engine‑wide, regardless of world.)_

## User & Play Flows

- **Discover**: Home → Worlds → choose World → Adventures list → Adventure detail (cover, tags, difficulty, required bundle, price).
- **Acquire**:
  - If free: “Add to Library”.
  - If paid: Stripe Checkout (one‑off) or Subscription tier unlocks. After webhook, grant entitlements.
- **New Game**: launch → `player_creation_00` (generic prompts: name, essence or equivalent, role/archetype, brief background, arrival) → first scene.
- **Play Screen**:
  - Header with location/time/weather chips + Essence HUD (◆ Order / ✿ Life / ⚝ Chaos or world‑equivalent chips from stylepack).
  - Scene blocks: `## 🕯️ Scene`, `## 🔢 Choices`.
  - Numbered, keyboard‑selectable choices; sticky footer on mobile.
  - Toggles: **Narrative Mode** (`read_focus | balanced | interactive`), **Show mechanics** (default off).
- **Saves**: auto‑save after outcome commit; manual save/export; load shows Recap.
- **Characters**: roster per user with filters by world/adventure; duplicate/retire; portability between bundle versions with migration prompts.
- **Library**: installed content; update badges when new bundle versions are available.
- **Account**: manage subscription, purchases, invoices via Stripe Customer Portal.

## Monetization & Entitlements

- **Tiers** (example): Free (demo scenes only), Adventurer, Lorekeeper (unlocks all worlds), Collector (bonus cosmetics).
- **Products**: Subscription plans, one‑off adventure SKUs, cosmetic packs (UI themes, frames).
- **Stripe Webhooks**:
  - On checkout/session.completed and invoice.paid → upsert **entitlements**.
  - On subscription updated/canceled/expired → update entitlements with grace period.
- **Entitlements Model**:
  - `entitlements(id, user_id, kind: 'subscription'|'sku', ref, status, current_period_end, payload JSONB)`
  - `user_access(user_id, bundle_id, access: 'granted'|'locked'|'trial', source)`
- **Paywalls**:
  - Gate “Start” or “Continue past demo cutoff”.
  - Show upsell modal with what unlocks at each tier.

## Provider Layer (A/B Testing)

- Interface: `generateTurn(promptParts, provider: 'openai'|'anthropic', stream: true)`.
- Per‑session routing with weights; record selection in `sessions.model_variant`.
- Stream tokens to UI via Socket.IO with backpressure.

## Moderation & Image Gating

- Text moderation on **both** user input and model output before render; redact/replace with safe variants and log results.
- Image generation **off by default**; only enable when a scene’s metadata `image_safe=true` and after moderation.
- Central policy map (PG‑13 floor; romance allowed; explicit nudity disallowed). Log to `moderation_logs`.

## Travel Scheduler & Beats (Global)

- During long travel segments, low‑chance random events **or** party bonding beats.
- Cooldowns, world‑specific weights from the bundle; respect outcome/choice phase locks.

## Database Schema (Postgres; adjust names as needed)

- `users(id, email, display_name, created_at)`
- `sessions(id, user_id, model_variant, narrative_mode, show_mechanics, current_bundle_id, created_at)`
- `characters(id, user_id, name, avatar_url, world_id, adventure_id, meta JSONB, created_at, updated_at)`
- `saves(id, user_id, character_id, session_id, bundle_id, state_json JSONB, last_scene_id, handoff_point, created_at, updated_at)`
- `bundles(...)` (see Content System)
- `entitlements(...)`, `user_access(...)` (see Monetization)
- `telemetry(id, session_id, event, payload JSONB, created_at)`
- `moderation_logs(id, session_id, stage, provider, result JSONB, created_at)`

Indexes on `(user_id)`, `(character_id)`, `(bundle_id)`, `(created_at)` and GIN on JSONB.

## API Surface (typed + zod‑validated)

- `POST /api/session` → start session (select world/adventure; choose model A/B; narrative_mode, show_mechanics defaults).
- `POST /api/turn` (stream) → `{session_id, character_id, user_line?, choice_index?}` → phased output stream: `scene_preamble`, `scene_body`, `choice_menu`, `post_outcome_reflection`.
- `POST /api/save` → atomic write (buffered commit policy).
- `GET /api/saves/:character_id` → list/latest with `## ✨ Recap`.
- `GET /api/bundles` → discoverable catalog (respect entitlements).
- `POST /api/admin/bundle` → upload/activate bundle (zip). Validate, hash, store.
- `POST /api/stripe/checkout` → create checkout (sku or sub).
- `POST /api/stripe/webhook` → apply entitlements.
- `GET /api/health`, `GET /api/version`.

## Frontend Pages

- **Home** (featured worlds/adventures, continue last session)
- **Worlds** → **World Detail** (adventures, tags, lore snippet)
- **Adventure Detail** (preview, price/tiers, “Add to Library”/“Purchase”/“Start”)
- **Play** (engine UI)
- **Characters** (manage roster; duplicate/retire)
- **Library** (installed content; updates)
- **Account** (profile; Customer Portal link)
- **Admin** (bundle upload, validate, activate; toggle feature flags; run self‑tests)

## Security & Performance

- RLS on user‑owned rows; per‑user rate limits (Redis).
- CSRF for non‑GET endpoints; secure cookies; session rotation.
- Streamed responses with backpressure; cache bundle metadata; edge caching for public assets.

## Observability

- Pino structured logs with request ids; token usage metrics; moderation hit rate; random‑event rate.
- Feature flags for model routing, image gating, demo cutoffs.

## Migrations & Versioning

- Bundle **version pinning** in saves; on bundle upgrade, offer migration steps or “continue on pinned version”.
- Export/import saves as files; checksum verification.

## Validations & Self‑Tests (dev tool + Admin button)

- First‑meet shows alias only; no leaked names.
- NPCs don’t address player by name before user shares it.
- Headers render with fallbacks (no “undefined”).
- Numbered choices present.
- No ambient text inside outcome/choices.
- Recap appears after load.
- Payments: test subscription & one‑off flow → entitlements applied.

## Deliverables

- Full repo with README (setup, env, run, deploy).
- SQL migrations + seed data (demo worlds/adventures).
- Stripe test mode wiring + sample SKUs/tiers.
- Provider layer for OpenAI/Anthropic with streaming.
- Playwright E2E covering: acquire → start → play → save → load (recap) → paywall unlock.

**Now generate the project** (scaffold, schema, API routes, provider layer, streaming, UI, payments, moderation, tests, and README). Include sample worlds (e.g., “High Fantasy,” “Sci‑Fi Outpost”) to prove world independence and pass self‑tests.
