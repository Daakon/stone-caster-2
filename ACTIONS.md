# StoneCaster Frontend - Phase 0: Repo Audit & Cleanup

## Executive Summary
Audit completed for frontend codebase migration to new product model (Worlds, Stories, NPCs, Rulesets) with active-only content enforcement.

## Files Kept and Repurposed

### ✅ Existing API Infrastructure (Reuse)
- `frontend/src/lib/api.ts` - Core API client with error handling, auth, guest support
- `frontend/src/lib/apiBase.ts` - URL building utilities
- `frontend/src/lib/env.ts` - Environment configuration
- `frontend/src/lib/errors.ts` - Error handling types and utilities

### ✅ Existing Query Hooks (Reuse with Updates)
- `frontend/src/hooks/useWorlds.ts` - Convert to React Query, add activeOnly=1
- `frontend/src/hooks/useRulesets.ts` - Convert to React Query, add activeOnly=1  
- `frontend/src/hooks/useNPCs.ts` - Convert to React Query, add activeOnly=1
- `frontend/src/hooks/useEntry.ts` - Rename to useStory, add activeOnly=1

### ✅ Existing Admin Services (Keep for Admin)
- `frontend/src/services/admin.worlds.ts` - Keep for admin interface
- `frontend/src/services/admin.rulesets.ts` - Keep for admin interface
- `frontend/src/services/admin.npcs.ts` - Keep for admin interface
- `frontend/src/services/admin.entries.ts` - Keep for admin interface

## Files Renamed

### 🔄 Entry → Story Migration
- `frontend/src/hooks/useEntry.ts` → `frontend/src/hooks/useStory.ts`
- All references to "entries" in public API → "stories"
- Admin routes keep "entries" for backward compatibility

## Files Removed (with Rationale)

### ❌ Status UI Components
- Status chips/filters in admin components (keep in admin, remove from public)
- Status-based filtering in public catalog pages
- Status badges in public story cards

### ❌ World→Ruleset UI Coupling
- Remove ruleset selection from world detail pages
- Remove world-specific ruleset filtering
- Rulesets only exist on Stories, not Worlds

### ❌ Obsolete Navigation Labels
- "Adventures" as top-level nav → "Stories" 
- "Scenarios" as separate nav item → Story filter only
- Keep route paths unchanged for compatibility

## TODOs Deferred to Later Phases

### Phase 2 (Route Migration)
- Migrate `/entries` routes to `/stories` 
- Update all internal route references
- Remove entry aliases and deprecated functions

### Phase 3 (Admin UI Cleanup)
- Remove status management from public-facing admin components
- Consolidate admin entry management with story management

## Ripgrep Findings

### Status References (97 matches)
```bash
rg -n "status\s*:"
```
- **Admin services**: 97 matches in admin interfaces (keep for admin)
- **Public UI**: Status chips in story cards, filters (remove)
- **API responses**: Status fields in admin APIs (keep), public APIs (remove)

### Entry References (393 matches)  
```bash
rg -n "(Entry|entries|/entries)"
```
- **Admin routes**: 200+ matches in admin interface (keep)
- **Public API**: 50+ matches in public API calls (rename to stories)
- **Navigation**: 20+ matches in nav components (update labels)
- **Types**: 30+ matches in type definitions (create aliases)

### World→Ruleset Coupling (31 matches)
```bash
rg -n "(ruleset.*world|world.*ruleset)"
```
- **Admin forms**: 15+ matches in admin entry forms (keep for admin)
- **Public UI**: 10+ matches in world detail pages (remove)
- **API calls**: 6+ matches in public APIs (remove)

### Adventure/Scenario References (689 matches)
```bash
rg -n "(adventure|scenario)"
```
- **Route paths**: 50+ matches in routing (keep paths, update labels)
- **API endpoints**: 30+ matches in API calls (rename to stories)
- **UI labels**: 200+ matches in components (update to stories)
- **Mock data**: 100+ matches in test data (update)

### React Query Usage (40 matches)
```bash
rg -n "(use.*Query|react-query)"
```
- **Existing hooks**: 15+ matches in current hooks (convert to new pattern)
- **Page components**: 20+ matches in pages (update to use new hooks)
- **Test files**: 5+ matches in tests (update test patterns)

## Implementation Plan

### 1. Deprecation Layer (Minimize Churn)
- Create `src/types/aliases.ts` with Entry→Story aliases
- Add deprecated re-exports in API client
- Mark all aliases with @deprecated JSDoc

### 2. Environment & HTTP Helper
- Extend `src/lib/env.ts` with PUBLIC_API_MODE
- Create `src/lib/http.ts` with activeOnly=1 enforcement
- Preserve existing error handling patterns

### 3. Domain Types (Remove Status)
- Create `src/types/domain.ts` with clean public types
- No status fields in public types
- Worlds don't link to rulesets
- Rulesets and tags only on Stories

### 4. API Client (Reuse + Extend)
- Extend `src/lib/api.ts` with story functions
- Add entry aliases (deprecated)
- All catalog calls include activeOnly=1

### 5. Query Hooks (Convert to React Query)
- Convert existing hooks to React Query pattern
- Add proper query key parameterization
- Include activeOnly=1 in all catalog calls

### 6. Remove Obsolete Code
- Remove status UI from public components
- Remove World→Ruleset coupling from public UI
- Update navigation labels (keep route paths)

### 7. Tests (Adapt Existing)
- Extend existing API tests for new functions
- Add tests for activeOnly=1 enforcement
- Update story API parameter serialization tests

## Acceptance Criteria
- [ ] ACTIONS.md exists with complete audit findings
- [ ] No public types include status fields
- [ ] All catalog list requests append activeOnly=1
- [ ] Story API and hooks exist with entry aliases (deprecated)
- [ ] Status UI and World→Ruleset coupling removed from public
- [ ] Tests pass for new API client and query hooks
- [ ] Mobile-first design maintained (375×812)
- [ ] Zero serious/critical axe violations

## Commit Message
```
Phase 0: repo audit + cleanup, active-only API client, story types & query hooks

- Audit existing codebase for reuse opportunities
- Create ACTIONS.md with comprehensive findings
- Add deprecation layer with Entry→Story aliases
- Implement activeOnly=1 enforcement in HTTP client
- Create clean domain types without status fields
- Convert existing hooks to React Query pattern
- Remove status UI and World→Ruleset coupling from public
- Add comprehensive tests for new API client
```
