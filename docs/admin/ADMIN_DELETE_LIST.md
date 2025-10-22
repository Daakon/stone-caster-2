# Admin Delete List (Legacy)

## Pages to Remove
- `frontend/src/pages/admin/AwfAdventuresAdmin.tsx` — **DELETE** — Replace with Entry Points
- `frontend/src/pages/admin/AwfAdventureStartsAdmin.tsx` — **DELETE** — Replace with Entry Points  
- `frontend/src/pages/admin/AwfScenariosAdmin.tsx` — **DELETE** — Replace with Entry Points

## API Endpoints to Remove
- `backend/src/routes/admin.ts` lines 1014-1094 — **DELETE** — `/api/admin/awf/adventures/*`
- `backend/src/routes/admin.ts` lines 1097-1172 — **DELETE** — `/api/admin/awf/adventure-starts/*`
- `backend/src/routes/admin.ts` lines 1423-1561 — **DELETE** — `/api/admin/awf/scenarios/*`

## Database Tables to Remove
- `adventures` — **DELETE** — Replace with `entry_points`
- `adventure_starts` — **DELETE** — Replace with `entry_points`
- `scenarios` — **DELETE** — Replace with `entry_points`

## Navigation Items to Remove
- `frontend/src/components/layout/AdminLayout.tsx` lines 147-152 — **DELETE** — Adventure/Scenario navigation
- `frontend/src/components/layout/AdminLayout.tsx` lines 154-158 — **DELETE** — Scenarios/Injection Maps navigation

## Legacy Prompt System (Optional)
- `frontend/src/pages/admin/PromptAdmin.tsx` — **DELETE** — Replace with prompt_segments
- `frontend/src/services/adminService.ts` — **DELETE** — Replace with prompt_segments service
- `backend/src/routes/admin.ts` lines 120-643 — **DELETE** — Legacy prompt endpoints
- `prompts` table — **DELETE** — Replace with `prompt_segments`

## Role System Cleanup
- `backend/src/middleware/adminAuth.ts` — **DELETE** — Replace with app_roles
- `backend/src/routes/admin.ts` lines 70-94 — **DELETE** — Replace with app_roles middleware
- `frontend/src/hooks/useAdminRole.ts` — **REWIRE** — Update to use app_roles

## Unused Admin Files
- `frontend/src/pages/admin/TestLab.tsx` — **DELETE** — Test/development page
- `frontend/src/pages/admin/MarketplaceReview.tsx` — **DELETE** — Unused marketplace features
- `frontend/src/pages/admin/LiveOpsPanel.tsx` — **DELETE** — Unused live ops features
- `frontend/src/pages/admin/NarrativeHealthDashboard.tsx` — **DELETE** — Unused dashboard
- `frontend/src/pages/admin/MetricsOverview.tsx` — **DELETE** — Unused metrics
- `frontend/src/pages/admin/EconomyDashboard.tsx` — **DELETE** — Unused economy features

## Migration Scripts Needed
1. **Adventure Migration**: `adventures` → `entry_points` (type: 'adventure')
2. **Adventure Start Migration**: `adventure_starts` → `entry_points` (type: 'start')
3. **Scenario Migration**: `scenarios` → `entry_points` (type: 'scenario')
4. **Prompt Migration**: `prompts` → `prompt_segments` (scope: 'entry', ref_id: entry_points.id)
5. **Role Migration**: `user_metadata.role` → `app_roles` table

## Cleanup Order
1. **Phase 1**: Remove unused admin pages and navigation
2. **Phase 2**: Migrate data to new schema
3. **Phase 3**: Remove old API endpoints
4. **Phase 4**: Remove old database tables
5. **Phase 5**: Update role system to app_roles
6. **Phase 6**: Remove legacy prompt system (optional)

## Files to Keep
- `frontend/src/components/admin/AdminRouter.tsx` — **KEEP** — Core admin router
- `frontend/src/components/layout/AdminLayout.tsx` — **KEEP** — Admin layout (update navigation)
- `frontend/src/stores/adminStore.ts` — **KEEP** — Admin state management
- `frontend/src/services/awfAdminService.ts` — **KEEP** — AWF admin service
- `backend/src/routes/admin.ts` — **KEEP** — Core admin routes (remove legacy endpoints)
- AWF tables: `core_contracts`, `core_rulesets`, `worlds`, `npcs`, `injection_maps` — **KEEP**


