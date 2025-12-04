# Route Audit Map - Phase 1.6

**Generated:** 2025-12-04  
**Purpose:** Map Frontend Routes → Components → API Calls → Backend Handlers → Database Tables

---

## Route Analysis Table

| Route | Component File | Service File | API Endpoint | Backend File | Backend Route | Table Used | Verdict |
|-------|---------------|--------------|--------------|--------------|---------------|------------|---------|
| `/admin/worlds` | `frontend/src/pages/admin/worlds/index.tsx` | `frontend/src/services/admin.worlds.ts` | `GET /api/admin/worlds` | `backend/src/routes/admin.ts:2566` | `router.get('/worlds')` | `worlds_admin` (LEGACY) | **KILL** - Uses legacy table |
| `/admin/worlds/new` | `frontend/src/pages/admin/worlds/new.tsx` | `frontend/src/services/admin.worlds.ts` | `POST /api/admin/worlds` | `backend/src/routes/admin.ts:2638` | `router.post('/worlds')` | `worlds` (LEGACY) | **KILL** - Uses legacy table |
| `/admin/worlds/:id` | `frontend/src/pages/admin/worlds/[id].tsx` | `frontend/src/services/admin.worlds.ts` | `GET /api/admin/worlds/:id` | `backend/src/routes/admin.ts:2743` | `router.get('/worlds/:id')` | `worlds_admin`, `worlds` (LEGACY) | **KILL** - Uses legacy tables |
| `/admin/worlds/:id/edit` | `frontend/src/pages/admin/worlds/edit.tsx` | `frontend/src/services/admin.worlds.ts` | `PUT /api/admin/worlds/:id` | `backend/src/routes/admin.ts:2801` | `router.put('/worlds/:id')` | `worlds_admin`, `worlds` (LEGACY) | **KILL** - Uses legacy tables |
| `/admin/rulesets` | `frontend/src/pages/admin/rulesets/index.tsx` | `frontend/src/services/admin.rulesets.ts` | `GET /api/admin/rulesets` | `backend/src/routes/admin.ts:2211` | `router.get('/rulesets')` | `rulesets` (LEGACY) | **KILL** - Uses legacy table |
| `/admin/rulesets/:id` | `frontend/src/pages/admin/rulesets/[id].tsx` | `frontend/src/services/admin.rulesets.ts` | `GET /api/admin/rulesets/:id` | `backend/src/routes/admin.ts:2360` | `router.get('/rulesets/:id')` | `rulesets` (LEGACY) | **KILL** - Uses legacy table |
| `/admin/npcs` | `frontend/src/pages/admin/npcs/index.tsx` | `frontend/src/services/admin.npcs.ts` | `GET /api/admin/npcs` | `backend/src/routes/admin.ts:3220` | `router.get('/npcs')` | `npcs` (LEGACY) | **KILL** - Uses legacy table |
| `/admin/npcs/new` | `frontend/src/pages/admin/npcs/new.tsx` | `frontend/src/services/admin.npcs.ts` | `POST /api/admin/npcs` | `backend/src/routes/admin.ts:3294` | `router.post('/npcs')` | `npcs` (LEGACY) | **KILL** - Uses legacy table |
| `/admin/npcs/:id` | `frontend/src/pages/admin/npcs/[id].tsx` | `frontend/src/services/admin.npcs.ts` | `GET /api/admin/npcs/:id` | `backend/src/routes/admin.ts:3408` | `router.get('/npcs/:id')` | `npcs` (LEGACY) | **KILL** - Uses legacy table |
| `/admin/npcs/:id/edit` | `frontend/src/pages/admin/npcs/edit.tsx` | `frontend/src/services/admin.npcs.ts` | `PUT /api/admin/npcs/:id` | `backend/src/routes/admin.ts:3591` | `router.put('/npcs/:id')` | `npcs` (LEGACY) | **KILL** - Uses legacy table |
| `/admin/stories/:id/modules` | Various (StorySettings, ModuleParams, etc.) | Direct API calls | `GET /api/admin/stories/:id/modules` | `backend/src/routes/admin.ts:6357` | `router.get('/stories/:id/modules')` | `story_modules` (LEGACY) | **KILL** - Uses legacy table |

---

## Detailed Route Analysis

### Worlds Routes (`/admin/worlds`)

**Frontend Flow:**
1. **Component:** `frontend/src/pages/admin/worlds/index.tsx` → `WorldsAdmin`
2. **Service:** `frontend/src/services/admin.worlds.ts` → `WorldsService`
3. **API Calls:**
   - `GET /api/admin/worlds` - List worlds
   - `POST /api/admin/worlds` - Create world
   - `GET /api/admin/worlds/:id` - Get world
   - `PUT /api/admin/worlds/:id` - Update world
   - `DELETE /api/admin/worlds/:id` - Delete world

**Backend Flow:**
- **File:** `backend/src/routes/admin.ts`
- **Routes:** Lines 2566-3112
- **Tables Used:**
  - `worlds_admin` (LEGACY - view/table)
  - `worlds` (LEGACY - main table)
  - `world_id_mapping` (LEGACY - UUID mapping)

**Verdict:** **KILL** - All routes use legacy tables. Should migrate to `chimera_worlds`.

---

### Rulesets Routes (`/admin/rulesets`)

**Frontend Flow:**
1. **Component:** `frontend/src/pages/admin/rulesets/index.tsx` → `RulesetsAdmin`
2. **Service:** `frontend/src/services/admin.rulesets.ts` → `RulesetsService`
3. **API Calls:**
   - `GET /api/admin/rulesets` - List rulesets
   - `POST /api/admin/rulesets` - Create ruleset
   - `GET /api/admin/rulesets/:id` - Get ruleset
   - `PUT /api/admin/rulesets/:id` - Update ruleset
   - `DELETE /api/admin/rulesets/:id` - Delete ruleset

**Backend Flow:**
- **File:** `backend/src/routes/admin.ts`
- **Routes:** Lines 2211-2507
- **Tables Used:**
  - `rulesets` (LEGACY)

**Verdict:** **KILL** - All routes use legacy table. Should migrate to `chimera_ruleset_templates`.

---

### NPCs Routes (`/admin/npcs`)

**Frontend Flow:**
1. **Component:** `frontend/src/pages/admin/npcs/index.tsx` → `NPCsAdmin`
2. **Service:** `frontend/src/services/admin.npcs.ts` → `NPCsService`
3. **API Calls:**
   - `GET /api/admin/npcs` - List NPCs
   - `POST /api/admin/npcs` - Create NPC
   - `GET /api/admin/npcs/:id` - Get NPC
   - `PUT /api/admin/npcs/:id` - Update NPC
   - `DELETE /api/admin/npcs/:id` - Delete NPC

**Backend Flow:**
- **File:** `backend/src/routes/admin.ts`
- **Routes:** Lines 3220-3770
- **Tables Used:**
  - `npcs` (LEGACY)

**Verdict:** **KILL** - All routes use legacy table. Should migrate to `chimera_entities` (kind='npc').

---

### Stories Routes (`/admin/stories`)

**Frontend Flow:**
1. **Components:** Multiple (StorySettings, ModuleParams, StoryModules, etc.)
2. **API Calls:** Direct API calls (no service layer)
3. **Endpoints:**
   - `GET /api/admin/stories/:id/modules` - List story modules
   - `POST /api/admin/stories/:id/modules` - Attach module
   - `DELETE /api/admin/stories/:id/modules/:moduleId` - Remove module
   - `POST /api/admin/stories/:id/apply-loadout` - Apply loadout

**Backend Flow:**
- **File:** `backend/src/routes/admin.ts`
- **Routes:** Lines 6357-6800
- **Tables Used:**
  - `story_modules` (LEGACY)
  - `modules` (LEGACY)

**Verdict:** **KILL** - Uses legacy tables. Stories should use `compiled_stories` (Chimera V3).

---

## Legacy Code Patterns Identified

### Tables Used by Admin Routes (ALL LEGACY):
- ❌ `worlds` - Should use `chimera_worlds`
- ❌ `worlds_admin` - Should use `chimera_worlds`
- ❌ `world_id_mapping` - Not needed with Chimera V3 UUIDs
- ❌ `rulesets` - Should use `chimera_ruleset_templates`
- ❌ `npcs` - Should use `chimera_entities` (kind='npc')
- ❌ `story_modules` - Should use `compiled_stories`
- ❌ `modules` - Legacy module system

### Migration Path:
1. **Worlds:** Migrate to `chimera_worlds` (Hybrid Schema: SQL columns + JSONB `definition`)
2. **Rulesets:** Migrate to `chimera_ruleset_templates` (Hybrid Schema)
3. **NPCs:** Migrate to `chimera_entities` with `kind='npc'`
4. **Stories:** Migrate to `compiled_stories` (Chimera V3)

---

## Scripts Inventory

### Root Directory Scripts

#### PowerShell Scripts (`.ps1`):
1. `deploy-backend.ps1` - Backend deployment
2. `deploy-client.ps1` - Frontend deployment
3. `deploy-server.ps1` - Server deployment
4. `deploy.ps1` - Main deployment script
5. `fix-oauth-callbacks.ps1` - OAuth callback fixes
6. `fix-prod-config.ps1` - Production config fixes
7. `install-fly.ps1` - Fly.io installation
8. `set-fly-auth-secrets.ps1` - Fly auth secrets
9. `set-fly-secrets.ps1` - Fly secrets management

#### Shell Scripts (`.sh`):
1. `scripts/canary-health.sh` - Canary health check
2. `scripts/check-legacy-code.sh` - Legacy code checker
3. `scripts/purge_legacy.sh` - Legacy code purger

#### JavaScript Scripts (`.js`):
1. `scripts/apply-migration.js` - Migration application
2. `scripts/check-migrations.js` - Migration checker
3. `scripts/execute-migrations-step-by-step.js` - Step-by-step migrations
4. `scripts/run-migrations-api.js` - API-based migrations
5. `scripts/run-migrations-auto.js` - Auto migrations
6. `scripts/run-migrations-direct.js` - Direct migrations
7. `scripts/run-migrations-frontend.js` - Frontend migrations
8. `scripts/run-migrations-simple.js` - Simple migrations
9. `scripts/test-migrations.js` - Migration testing
10. `scripts/validate-migrations.js` - Migration validation
11. `scripts/apply-admin-migrations.js` - Admin migrations
12. `scripts/test-npc-visibility.js` - NPC visibility testing
13. `scripts/dev-setup.js` - Development setup

### Backend Scripts (`backend/scripts/`)

#### TypeScript Scripts (`.ts`):
1. **Migration Scripts:**
   - `apply-admin-migrations.ts`
   - `apply-adventure-starts-migration.ts`
   - `apply-and-test.ts`
   - `apply-core-contracts-migration.ts`
   - `apply-core-schema.ts`
   - `apply-migration.ts`
   - `apply-naming-cleanup.ts`
   - `apply-naming-cleanup-manual.ts`
   - `apply-role-migration.ts`
   - `apply-unique-constraints.ts`
   - `apply-world-data-migration.ts`
   - `create-adventure-starts-table.ts`
   - `create-core-tables.ts`
   - `create-schema.ts`
   - `create-schema-step-by-step.ts`
   - `force-create-schema.ts`
   - `recreate-core-schema.ts`
   - `verify-migration.ts`

2. **Database Scripts:**
   - `check-constraints.ts`
   - `check-db.ts`
   - `check-existing-table.ts`
   - `check-user-role.ts`
   - `detailed-verify.ts`
   - `final-verification.ts`
   - `test-table-structure.ts`
   - `verify-data-integrity.ts`
   - `inspect-other-tables.ts`

3. **AWF Legacy Scripts (Should be removed):**
   - `awf-analytics-backfill.ts`
   - `awf-autoplay-nightly.ts`
   - `awf-autoplay-smoke.ts`
   - `awf-experiments-report.ts`
   - `awf-export-import.ts`
   - `awf-lint-dialogue.ts`
   - `awf-lint-economy.ts`
   - `awf-lint-graph.ts`
   - `awf-lint-i18n.ts`
   - `awf-lint-mechanics.ts`
   - `awf-lint-mods.ts`
   - `awf-lint-party.ts`
   - `awf-lint-sim.ts`
   - `awf-override.ts`
   - `awf-recap.ts`
   - `awf-rollout-set.ts`
   - `awf-rollups-run.ts`
   - `awf-sim-runner.ts`
   - `awf-snapshot.ts`
   - `awf-weekly-report.ts`
   - `ci-awf-checks.ts`
   - `dump-awf-bundle.ts`
   - `run-awf-turn.ts`
   - `seed-awf-core-contract.ts`
   - `seed-awf-core-data.ts`
   - `seed-awf-data.ts`
   - `seed-awf-games-fixtures.ts`
   - `validate-awf-docs.ts`

4. **Utility Scripts:**
   - `api-docs-ci.ts`
   - `assign-admin-role.ts`
   - `canary-env-check.ts`
   - `clear-v3-fixtures.ts`
   - `generate-swagger-docs.ts`
   - `ingest-prompts.ts`
   - `manual-migration-guide.ts`
   - `ops-weekly-report.ts`
   - `preview-all-entry-points.ts`
   - `prompt-preview.ts`
   - `qa-scan-entry-points.ts`
   - `seed-v3-fixtures.ts`
   - `seed-v3-master.ts`
   - `smoke-spawn-rollback.ts`
   - `snapshot-prompts.ts`
   - `test-admin-endpoint.ts`
   - `validate-api-docs.ts`

#### JavaScript Scripts (`.js`):
1. `apply-migrations.js`
2. `apply-migrations-simple.js`
3. `apply-turn-recording-migration.js`
4. `apply-world-data-migration.js`
5. `check-constraints.js`
6. `check-file-prompt-references.js`
7. `create-env-template.js`
8. `demo-prompt-cleaning.js`
9. `dev-with-default-env.js`
10. `fix-characters-schema.js`
11. `simple-prompt-test.js`
12. `simple-schema-fix.js`
13. `test-character-creation.js`
14. `test-env-setup.js`
15. `test-prompt-cleaning.js`
16. `verify-config.js`
17. `setup-config.js`

#### SQL Scripts (`.sql`):
1. `audit_tables.sql`
2. `db-guards.sql`
3. `explain-v3.sql`
4. `inspect_other_tables.sql`
5. `manual-migration.sql`
6. `setup-adventure-starts.sql`
7. `simple-migration.sql`

#### Shell Scripts (`.sh`):
1. `purge_legacy.sh`
2. `purge_legacy_backend.sh`

#### PowerShell Scripts (`.ps1`):
1. `purge_legacy.ps1`

### Frontend Scripts (`frontend/scripts/`)

#### TypeScript Scripts (`.ts`):
1. `seed/seed-db.ts` - Database seeding

---

## Summary

### Routes Status:
- **Total Admin Routes Audited:** 11
- **Routes Using Legacy Tables:** 11 (100%)
- **Routes Using Chimera V3 Tables:** 0 (0%)

### Scripts Status:
- **Total Scripts:** 100+
- **Legacy AWF Scripts:** 30+ (should be removed)
- **Migration Scripts:** 20+
- **Utility Scripts:** 50+

### Action Items:
1. ✅ **COMPLETED:** Deleted `frontend/src/admin/legacy/` directory
2. ⚠️ **PENDING:** Run SQL script to get list of 85 tables (requires manual execution)
3. ✅ **COMPLETED:** Created comprehensive route audit map
4. ✅ **COMPLETED:** Audited all scripts

### Next Steps:
1. Migrate admin routes to use Chimera V3 tables:
   - Worlds → `chimera_worlds`
   - Rulesets → `chimera_ruleset_templates`
   - NPCs → `chimera_entities`
   - Stories → `compiled_stories`
2. Remove legacy AWF scripts from `backend/scripts/`
3. Update frontend services to use new Chimera V3 API endpoints
4. Remove legacy admin routes once migration is complete

