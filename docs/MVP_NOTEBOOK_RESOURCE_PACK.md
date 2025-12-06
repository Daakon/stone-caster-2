# StoneCaster MVP Notebook Resource Pack

Canonical reference for the current MVP design, data, and execution footprint so the NotebookLM workspace can ground every answer. Each section summarizes the living source file(s) you should import, plus contextual bullets the LLM will need in order to answer "why" questions without re-reading the whole repo.

---

## 0. How To Use This Packet
- **Seed NotebookLM with both the summaries and the linked files.** Use this file as the index; drop the original sources referenced below as independent Notebook resources when you need deeper details.
- **Tag resources by domain:** `architecture`, `data`, `api`, `frontend`, `ops`. NotebookLM cross-source reasoning works best when we signal intent.
- **When prompting:** cite the resource slug (for example, "According to `catalog-npc-route`, explain...") so NotebookLM retrieves the right chunk.

---

## 1. Product & Architecture Context

### 1.1 Project Spine — `docs/PROJECT_CONTEXT_MAP.md`
- Defines the active initiative ("Chimera V3" greenfield) and the **legacy kill list** (all `awf_*`, `stone_*`, `mod_*`, etc.). NotebookLM should treat any lingering AWF references as deprecated.
- Captures the **Hybrid Pattern** rule: query-critical fields belong in SQL columns, deep authoring schema lives inside JSONB `definition`.
- Outlines backend layering mandate (`routes` → `services` → `db/repos`) and the four-stone Casting Circle UX pillars on the frontend.

### 1.2 System Spec — `docs/CHIMERA_ARCHITECTURE_SPEC.md`
- Core glossary: Story Dimension, Casting Circle, MAS1/Engine/MAS2 runtime loop, Tier0 vs. Tier1 game state.
- Data architecture deep dive for every `chimera_*` table, including indexes, ownership, and migration guidance.
- Compiler pipeline (Base Loader → Resolution → Schema Build → Artifact Gen) and Lore RAG flow (pgvector ingestion + MAS2 retrieval).
- Keep this file in NotebookLM for authoritative schema definitions; use this summary when you only need the headlines.

---

## 2. Data Surfaces & Storage Contracts

### 2.1 Supabase World Resolver — `backend/src/services/worldResolver.ts`
- Resolves either UUID or slug to canonical `worlds.id`. UUID regex guard + fallback slug lookup.
- Returns `null` when not found to keep catalog endpoints idempotent (empty 200 responses rather than 404s).

### 2.2 Catalog Validation — `backend/src/validation/catalogNpcs.schema.ts`
- `GET /api/catalog/npcs` query params: `q`, `world`, `page` (default 1), `pageSize` (default 24, max 50), `sort` (`name|created_at|popularity`), `order`.
- `GET /api/catalog/npcs/:idOrSlug` path param: `idOrSlug` (UUID or slug up to 120 chars).
- When NotebookLM reasons about pagination or caching signatures, it needs these normalized shapes.

### 2.3 Chimera Budget Extras — `backend/src/routes/admin-budget.ts`
- Demonstrates how Chimera entities store overrides: `chimera_worlds.definition.extras`, `chimera_ruleset_templates.definition.extras`, `chimera_stories.definition.extras`, and per-NPC extras inside `chimera_entities.definition`.
- The POST route reads these extras, merges runtime overrides, and feeds them into the `TurnPacketV3` builder + budget engine. This is the best current sample of how authoring data flows into runtime budgeting without persisting artifacts.

---

## 3. Backend APIs (Surface Area Today)

### 3.1 OpenAPI Surface — `backend/src/routes/openapi.ts` & `backend/src/openapi/*`
- Routes: `GET /api/openapi.json` returns composed spec; `/api/docs` serves Swagger UI.
- `backend/src/openapi/index.ts` stitches components + `paths.catalogNpcs.ts` + `paths.accessRequests.ts` + `paths.earlyAccess.ts`.
- NotebookLM tip: Import the generated JSON (`curl http://localhost:3000/api/openapi.json`) into the notebook whenever the spec drifts; this keeps endpoint docs synchronized automatically.

### 3.2 NPC Catalog (Public) — `backend/src/routes/catalogNpcs.ts`
- **List endpoint (`GET /api/catalog/npcs`):**
  - Applies strict validation, resolves optional `world` slug→UUID, and normalizes search queries (length ≤ 2 uses `ilike`, else Postgres `textSearch` on `search_vector`).
  - RLS-aware Supabase client ensures auth context inherits from `Authorization: Bearer` if present; caching signature (`buildQuerySignature`) includes `aud=auth|anon` to prevent leakage.
  - HTTP caching: `ETag` = SHA256(key + max `updated_at`), `Last-Modified` = newest ISO timestamp, `Cache-Control` via `setSharedCache`.
  - Response shape (`CatalogNpcListResponse`): `meta` includes pagination, actual sort (popularity falls back to `created_at`), normalized search string, and original world filter. Each NPC includes portrait fallback `/assets/portrait/{id}.svg` plus embedded world mini (from `fetchWorldsMap`).
- **Detail endpoint (`GET /api/catalog/npcs/:idOrSlug`):**
  - Accepts either UUID or slug; slug resolves via `slug` column or `doc->>'slug'`.
  - 404 responses are cacheable for 30 seconds (`stale-while-revalidate=60`).
  - Detail payload preserves the `doc` blob for client-side experiments; `description` prefers `doc.long_desc` fallback `doc.description`.
- Include both endpoints plus helper utilities in NotebookLM when debugging cache behaviors or user-facing catalog responses.

### 3.3 Budget Dashboard (Secure) — `backend/src/routes/admin-budget.ts`
- `GET /api/system/budget`: Requires `admin|moderator|viewer`. Returns counts from modern `chimera_*` tables plus zeroed legacy placeholders so dashboards stop referencing AWF tables.
- `POST /api/admin/prompt-budget-report`: `admin|publisher` only. Validates `worldId`, `rulesetId`, optional `scenarioId`, `npcIds[]`, `templatesVersion`, overrides, and `maxTokens` (50–1,000,000 with `.env` default). Builds a throwaway `TurnPacketV3`, linearizes sections, runs the budget engine, and returns per-section before/after token estimates plus trim flags.
- NotebookLM should cite this route when answering questions such as "How do we estimate prompt cost without saving drafts?"

---

## 4. Frontend Experience & SEO Guarantees

### 4.1 Story Detail Page — `frontend/src/pages/stories/StoryDetailPage.tsx`
- Dual data source: uses legacy `useStoryQuery` unless `isChimeraEnabled`, where it calls `chimeraStoriesService.getStory` and adapts the schema (`display_name` → `title`, etc.).
- CTA logic: `handleStartStory` always routes through Player Gateway when Chimera is on, ensuring character selection happens centrally.
- SEO instrumentation (inside `useEffect`):
  - Title via `makeTitle`, description via `makeDescription`, canonical via `absoluteUrl`.
  - Injects OG and Twitter tags, plus CreativeWork JSON-LD referencing the world as a `CreativeWorkSeries`.
  - NotebookLM should surface this block whenever asked "How do we keep story pages SEO-friendly?"
- UI details worth remembering: hero image priority loading with fallback copy block, featured NPC grid uses `CatalogCard`, `WorldRuleMeters` placeholder indicates pending Chimera V3 refactor.

### 4.2 SEO Regression Test — `frontend/src/pages/stories/StoryDetailPage.test.tsx`
- Vitest ensures the meta hook set populates `document.title`, meta description, OG/Twitter tags, canonical link, and JSON-LD with `@type=CreativeWork`.
- Mocked `useStoryQuery` returns a deterministic "The Veil" story to keep the test stable.
- NotebookLM referencing this test clarifies which head tags are contractually required.

---

## 5. Admin Tooling Snapshot

### Route Mapping Script — `scripts/map-admin-routes.ts`
- Executable via `tsx`. Reads `frontend/src/admin/AdminRoutes.tsx` and legacy `frontend/src/components/admin/AdminRouter.tsx` to print a Markdown table of `<Route>` definitions, indicating allowed roles (if a `GuardedRoute` wrapper is present).
- Also inventories admin pages/components directories and navigation sources (`AdminNav.tsx`, `AdminLayout.tsx`, `AppAdminShell.tsx`).
- Emits "Key Findings" callouts: current primary nav is `AdminNav.tsx`, missing Worlds & Rulesets menu items, and the schema mismatch (frontend `active` boolean vs. DB `status` text). This is the canonical truth source when reconciling admin UX drift.

---

## 6. Existing Reference Artifacts To Import
- `docs/chimera-full-schemas.json`: machine-readable schema for syncing Zod + Supabase.
- `backend/src/openapi/paths.catalogNpcs.ts`: per-endpoint param and response objects for the catalog; great for NotebookLM when you need example payloads.
- `assets/` (portraits, OG): currently used as deterministic placeholders when NPCs lack images.
- `shared/` package: type definitions such as `@shared/types/catalog.ts` (import when NotebookLM needs DTO fields verbatim).

---

## 7. Coverage & Next Questions
- **Not covered yet:** Compiler service code, MAS runtime internals, Casting Circle frontend flows. Add them once those folders stabilize to keep NotebookLM snippets lean.
- **Recommended NotebookLM next steps:**
  1. Upload this packet as `mvp-resource-pack`.
  2. Upload each linked source (context map, architecture spec, catalog routes, budget route, StoryDetailPage, StoryDetailPage.test, map-admin-routes).
  3. When specs update, regenerate this packet so NotebookLM stays in sync.

With these resources loaded, NotebookLM can answer architecture, data, API, SEO, and admin routing questions for the MVP without rummaging through the repo.
