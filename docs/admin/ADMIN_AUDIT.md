# Admin Audit

## Routes Tree

### Main Admin Routes
- `/admin` — Admin router entry point
  - `/admin/prompts` — **KEEP** — Legacy prompt management (current: 120+ prompts)
  - `/admin/awf/core-contracts` — **KEEP** — AWF core contract management
  - `/admin/awf/rulesets` — **KEEP** — AWF ruleset management  
  - `/admin/awf/worlds` — **KEEP** — AWF world management
  - `/admin/awf/adventures` — **REWIRE** → Entry Points — AWF adventure management
  - `/admin/awf/adventure-starts` — **REWIRE** → Entry Points — AWF adventure start management
  - `/admin/awf/scenarios` — **REWIRE** → Entry Points — AWF scenario management
  - `/admin/awf/injection-maps` — **KEEP** — AWF injection map management

### Legacy Routes (Not in Router)
- `/admin/awf/npcs` — **REWIRE** → NPCs — Referenced in navigation but not implemented
- `/admin/awf/analytics` — **DELETE** — Disabled placeholder

## Components

### Core Admin Components
- `AdminRouter` (`frontend/src/components/admin/AdminRouter.tsx`) — **KEEP** — Main admin router
- `AdminLayout` (`frontend/src/components/layout/AdminLayout.tsx`) — **KEEP** — Admin layout wrapper
- `AdminRoute` (`frontend/src/components/admin/AdminRoute.tsx`) — **KEEP** — Route protection component

### Admin Pages
- `PromptAdmin` (`frontend/src/pages/admin/PromptAdmin.tsx`) — **KEEP** — Legacy prompt management
- `AwfCoreContractsAdmin` (`frontend/src/pages/admin/AwfCoreContractsAdmin.tsx`) — **KEEP** — Core contracts management
- `AwfRulesetsAdmin` (`frontend/src/pages/admin/AwfRulesetsAdmin.tsx`) — **KEEP** — Rulesets management
- `AwfWorldsAdmin` (`frontend/src/pages/admin/AwfWorldsAdmin.tsx`) — **KEEP** — Worlds management
- `AwfAdventuresAdmin` (`frontend/src/pages/admin/AwfAdventuresAdmin.tsx`) — **REWIRE** → Entry Points
- `AwfAdventureStartsAdmin` (`frontend/src/pages/admin/AwfAdventureStartsAdmin.tsx`) — **REWIRE** → Entry Points
- `AwfScenariosAdmin` (`frontend/src/pages/admin/AwfScenariosAdmin.tsx`) — **REWIRE** → Entry Points

### Admin Services & Stores
- `adminStore` (`frontend/src/stores/adminStore.ts`) — **KEEP** — Zustand store for admin state
- `awfAdminService` (`frontend/src/services/awfAdminService.ts`) — **KEEP** — AWF admin API service
- `adminService` (`frontend/src/services/adminService.ts`) — **KEEP** — Legacy admin API service
- `useAdminRole` (`frontend/src/hooks/useAdminRole.ts`) — **KEEP** — Admin role verification hook

## API Usage

### Admin API Endpoints
- `/api/admin/prompts/*` — **KEEP** — Legacy prompt management (37 endpoints)
- `/api/admin/awf/core-contracts/*` — **KEEP** — Core contracts CRUD
- `/api/admin/awf/rulesets/*` — **KEEP** — Rulesets CRUD
- `/api/admin/awf/worlds/*` — **KEEP** — Worlds CRUD
- `/api/admin/awf/adventures/*` — **REWIRE** → `/api/admin/entry-points/*`
- `/api/admin/awf/adventure-starts/*` — **REWIRE** → `/api/admin/entry-points/*`
- `/api/admin/awf/scenarios/*` — **REWIRE** → `/api/admin/entry-points/*`
- `/api/admin/awf/npcs/*` — **KEEP** — NPCs CRUD
- `/api/admin/awf/injection-maps/*` — **KEEP** — Injection maps CRUD
- `/api/admin/awf/localization/*` — **KEEP** — Localization management

### Database Tables
- `prompts` — **KEEP** — Legacy prompt storage
- `core_contracts` — **KEEP** — AWF core contracts
- `core_rulesets` — **KEEP** — AWF rulesets
- `worlds` — **KEEP** — AWF worlds
- `adventures` — **REWIRE** → `entry_points` — AWF adventures
- `adventure_starts` — **REWIRE** → `entry_points` — AWF adventure starts
- `scenarios` — **REWIRE** → `entry_points` — AWF scenarios
- `npcs` — **KEEP** — AWF NPCs
- `injection_maps` — **KEEP** — AWF injection maps
- `localization_packs` — **KEEP** — Localization data

## Role Checks

### Frontend Role Checks
- `AdminLayout` — Checks for `prompt_admin` role before rendering
- `AdminRoute` — Wraps admin routes with role verification
- `useAdminRole` — Hook for role verification with caching
- `awfAdminService` — Validates `prompt_admin` role before API calls

### Backend Role Checks
- `requireAdminRole` middleware — Checks `prompt_admin` role in user metadata
- `requireAdmin` middleware — Checks `admin` role in user profiles
- RLS policies — Database-level role enforcement

### Role Inconsistencies
- **Frontend**: Expects `prompt_admin` role
- **Backend**: Some routes check `prompt_admin`, others check `admin`
- **Database**: RLS policies check for `admin` role
- **Navigation**: References non-existent routes (npcs, analytics)

## Notes

### Legacy vs AWF System
- **Legacy Adventures**: UUID-based, simple fields, `adventures` table
- **AWF Adventures**: Text-based IDs, JSONB docs, versioned
- **Duplication**: Both systems exist simultaneously
- **Migration**: Need to consolidate into unified Entry Points system

### Missing Implementations
- NPC admin page referenced in navigation but not implemented
- Analytics page disabled but referenced
- Some API endpoints exist but no corresponding UI

### Data Touchpoints
- **Entry Points**: Will replace adventures, adventure-starts, scenarios
- **Prompt Segments**: Will replace legacy prompts
- **Content Reviews**: New moderation system
- **App Roles**: New role system replacing user_metadata roles

### Questions
- Should legacy prompts be migrated to prompt_segments?
- How to handle versioning in Entry Points?
- What happens to existing AWF documents during migration?
- Should NPCs be part of Entry Points or separate?




