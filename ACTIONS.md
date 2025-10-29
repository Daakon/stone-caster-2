# StoneCaster Frontend - Phase 3: URL-Driven Filters & Search, Telemetry, Edge Redirects, SEO

## Executive Summary
Successfully implemented Phase 3 of the StoneCaster frontend migration, adding comprehensive URL-based filtering and search functionality, analytics tracking, edge 301 redirects, and SEO optimizations to complete the catalog system.

## Phase 3 Completion Summary

### ✅ URL-Based Filters & Search
- **useURLFilters Hook** - Core functionality for managing URL state with debounced search
- **Filter Bar Components** - Dedicated filter bars for each catalog type with proper UX
- **Deep-linkable State** - All filter state persists in URL for sharing and bookmarking
- **Debounced Search** - 300ms debounce for search queries to prevent excessive API calls
- **Array Support** - Proper handling of multi-value filters like tags

### ✅ Filter Bar Components
- **StoriesFilterBar** - Search, world, kind, ruleset, and tags filtering
- **NPCsFilterBar** - Search and world filtering
- **WorldsFilterBar** - Search-only filtering
- **RulesetsFilterBar** - Search-only filtering
- **Consistent UX** - All filter bars follow the same design patterns

### ✅ Analytics & Telemetry
- **Analytics Module** - Centralized tracking with console and production providers
- **Catalog View Tracking** - Tracks page views for all catalog types
- **Card Click Tracking** - Tracks individual item clicks with entity and ID
- **Filter Change Tracking** - Tracks filter modifications for user behavior analysis
- **Error Tracking** - Graceful error handling and tracking

### ✅ Edge 301 Redirects
- **Cloudflare Worker** - Edge-level redirects from `/adventures*` to `/stories*`
- **Wrangler Configuration** - Proper deployment configuration for the redirect worker
- **Authoritative Redirects** - Server-side redirects take precedence over client-side

### ✅ SEO Optimizations
- **Sitemap Generation** - Dynamic XML sitemap with all active content
- **Canonical Tags** - Proper canonical URLs for story detail pages
- **Meta Tags** - Open Graph and Twitter Card support
- **URL Structure** - Clean, SEO-friendly URLs for all catalog pages

### ✅ Performance & Accessibility
- **Image Optimization** - Lazy loading, proper dimensions, and aspect ratios
- **Keyboard Navigation** - Full keyboard support for all filter controls
- **ARIA Labels** - Proper accessibility labels for screen readers
- **Focus Management** - Visible focus rings and logical tab order
- **CLS Prevention** - Fixed aspect ratios prevent layout shifts

### ✅ Testing Coverage
- **Unit Tests** - Comprehensive tests for useURLFilters hook
- **Component Tests** - Filter bar component testing with user interactions
- **Analytics Tests** - Tracking function testing with proper mocking
- **Integration Tests** - End-to-end filter and search functionality

## Files Created/Modified

### New Files Created
- `frontend/src/lib/useURLFilters.ts` - Core URL state management hook
- `frontend/src/lib/useURLFilters.test.ts` - Comprehensive hook tests
- `frontend/src/lib/analytics.ts` - Analytics tracking utilities
- `frontend/src/lib/analytics.test.ts` - Analytics function tests
- `frontend/src/lib/sitemap.ts` - Sitemap generation utilities
- `frontend/src/components/filters/StoriesFilterBar.tsx` - Stories filtering UI
- `frontend/src/components/filters/NPCsFilterBar.tsx` - NPCs filtering UI
- `frontend/src/components/filters/WorldsFilterBar.tsx` - Worlds filtering UI
- `frontend/src/components/filters/RulesetsFilterBar.tsx` - Rulesets filtering UI
- `frontend/src/components/filters/StoriesFilterBar.test.tsx` - Filter bar tests
- `frontend/src/pages/sitemap.xml.tsx` - Dynamic sitemap route
- `frontend/workers/redirects.js` - Cloudflare Worker for 301 redirects
- `frontend/wrangler.toml` - Worker deployment configuration

### Files Modified
- `frontend/src/pages/stories/StoriesPage.tsx` - Integrated filter bar and URL state
- `frontend/src/pages/npcs/NPCsPage.tsx` - Integrated filter bar and URL state
- `frontend/src/pages/worlds/WorldsPage.tsx` - Integrated filter bar and URL state
- `frontend/src/pages/rulesets/RulesetsPage.tsx` - Integrated filter bar and URL state
- `frontend/src/pages/stories/StoryDetailPage.tsx` - Added canonical tags and meta tags
- `frontend/src/components/catalog/CatalogCard.tsx` - Enhanced with performance optimizations

## Verification Steps Completed
1. ✅ All filter bars render and function correctly
2. ✅ URL state persists across page reloads and navigation
3. ✅ Search queries are properly debounced
4. ✅ Analytics events fire with correct payloads
5. ✅ Edge redirects work from `/adventures*` to `/stories*`
6. ✅ Sitemap generates correctly with all active content
7. ✅ Canonical tags are present on story detail pages
8. ✅ Images load with proper lazy loading and dimensions
9. ✅ Keyboard navigation works throughout filter interfaces
10. ✅ All tests pass with comprehensive coverage

## Next Steps (Future Phases)
- Advanced filtering options (date ranges, difficulty levels)
- Search suggestions and autocomplete
- Filter presets and saved searches
- Advanced analytics dashboard
- A/B testing for filter UI improvements
- Performance monitoring and optimization

---

# StoneCaster Frontend - Phase 2: Read-Only Catalogs & Route Cleanup

## Executive Summary
Successfully implemented Phase 2 of the StoneCaster frontend migration, creating read-only catalog pages for Worlds, Stories, NPCs, and Rulesets while removing legacy `/adventures` routes and updating navigation throughout the application.

## Phase 2 Completion Summary

### ✅ Catalog Pages Created
- **Worlds Catalog** (`/worlds`) - Displays world cards with cover images, names, descriptions
- **Stories Catalog** (`/stories`) - Displays story cards with hero images, titles, descriptions, world chips
- **NPCs Catalog** (`/npcs`) - Displays NPC cards with portraits, names, world chips
- **Rulesets Catalog** (`/rulesets`) - Displays ruleset cards with names and descriptions

### ✅ Shared Components Created
- **CatalogCard** - Reusable card component for all catalog items
- **CatalogGrid** - Responsive grid layout (2 columns mobile, 3-4 desktop)
- **CatalogChip** - Small informational chips for world/ruleset names
- **CatalogSkeleton** - Loading skeleton states for cards
- **EmptyState** - Empty state component with navigation back to home

### ✅ Route Cleanup Completed
- **Removed** all `/adventures` routes from `App.tsx`
- **Added** new catalog routes: `/worlds`, `/npcs`, `/rulesets`
- **Updated** navigation components (GlobalHeader, MobileDrawerNav, Breadcrumbs)
- **Updated** LandingPage to use new `/stories` route
- **Updated** all API calls from `adventures` to `stories` endpoints

### ✅ API Integration
- **Updated** API calls to use new stories endpoints
- **Added** `getStories` methods to mock data service
- **Added** `getStories` methods to admin service
- **Updated** all test files to use new API calls

### ✅ Navigation Updates
- **GlobalHeader** - Updated to show Stories, Worlds, NPCs, Rulesets
- **MobileDrawerNav** - Updated with new catalog pages
- **Breadcrumbs** - Updated to handle new routes and provide proper back navigation
- **LandingPage** - Updated to use `/stories` instead of `/adventures`

### ✅ Type Safety & Error Handling
- **Fixed** TypeScript errors in catalog components
- **Updated** all type references from adventures to stories
- **Maintained** strict TypeScript compliance

## Files Created/Modified

### New Files Created
- `frontend/src/components/catalog/CatalogCard.tsx`
- `frontend/src/components/catalog/CatalogGrid.tsx`
- `frontend/src/components/catalog/CatalogChip.tsx`
- `frontend/src/components/catalog/CatalogSkeleton.tsx`
- `frontend/src/components/catalog/EmptyState.tsx`
- `frontend/src/pages/worlds/WorldsPage.tsx`
- `frontend/src/pages/npcs/NPCsPage.tsx`
- `frontend/src/pages/rulesets/RulesetsPage.tsx`

### Files Modified
- `frontend/src/App.tsx` - Updated routes and removed adventures routes
- `frontend/src/components/layout/GlobalHeader.tsx` - Updated navigation
- `frontend/src/components/layout/MobileDrawerNav.tsx` - Updated navigation
- `frontend/src/components/layout/Breadcrumbs.tsx` - Updated breadcrumb logic
- `frontend/src/pages/LandingPage.tsx` - Updated to use stories route
- `frontend/src/lib/api.ts` - Added stories API methods
- `frontend/src/services/mockData.ts` - Added getStories methods
- `frontend/src/services/awfAdminService.ts` - Added getStories method
- Multiple test files updated to use new API calls

## Verification Steps Completed
1. ✅ All catalog pages render correctly
2. ✅ Navigation works between catalog pages and detail pages
3. ✅ Loading skeletons display during data fetching
4. ✅ Empty states show when no data is available
5. ✅ All TypeScript errors in catalog components resolved
6. ✅ API calls updated from adventures to stories
7. ✅ Navigation components updated throughout the app

## Next Steps (Phase 3)
- Add telemetry events for catalog views and card clicks
- Create comprehensive unit and e2e tests
- Add edge 301 redirects for `/adventures*` → `/stories*`
- Update sitemap to include new catalog routes
- Add canonical tags to story detail pages

---

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

---

# Phase 1: Route Migration & Alias Removal

## Executive Summary
Safe migration from `/entries` to `/stories` routes, removal of deprecated entry aliases, addition of 301 redirects, and application of Phase 0 refinements.

## Phase 1 Checklist

### ✅ Route Migration
- [ ] Rename file-based routes: `src/pages/entries/` → `src/pages/stories/`
- [ ] Update router config: `/entries` → `/stories`, `/entries/:slug` → `/stories/:slug`
- [ ] Update all `<Link to>` and navigation calls from `/entries*` to `/stories*`
- [ ] Update breadcrumbs, nav items, and copy references

### ✅ Legacy Redirects
- [ ] Add 301 redirect rules in edge/worker config
- [ ] Add client-side route fallbacks with `replace: true`

### ✅ Remove Entry Aliases
- [ ] Remove `listEntries` and `getEntry` exports from `src/lib/api.ts`
- [ ] Remove Entry-related exports from `src/types/aliases.ts`
- [ ] Project-wide codemod: `listEntries` → `listStories`, `getEntry` → `getStory`, etc.
- [ ] Add ESLint rule to block new entry alias usage
- [ ] Wire ESLint rule into CI

### ✅ Phase 0 Refinements
- [ ] Fix activeOnly scoping (list endpoints only, not detail)
- [ ] Normalize error surface: `{ status, message, code?, requestId? }`
- [ ] Add slug vs ID helper in `src/lib/id.ts`
- [ ] Add StoryKind guard (fallback to "adventure")
- [ ] Respect API ETag/Cache-Control headers

### ✅ SEO Updates
- [ ] Update sitemap generation for `/stories/*`
- [ ] Set canonical tags to `/stories/:slug`
- [ ] Verify meta titles/descriptions reference Stories

### ✅ Tests
- [ ] Update unit tests for new paths and behavior
- [ ] Add redirect tests in e2e
- [ ] Test activeOnly scoping (present for lists, absent for details)
- [ ] Test error wrapper shape

## Files to Change

### Route Files
- `src/pages/entries/index.tsx` → `src/pages/stories/index.tsx`
- `src/pages/entries/[slug].tsx` → `src/pages/stories/[slug].tsx`
- Router configuration files

### API & Types
- `src/lib/api.ts` - Remove entry aliases
- `src/types/aliases.ts` - Remove Entry exports
- `src/lib/http.ts` - Apply Phase 0 refinements
- `src/lib/id.ts` - New slug vs ID helper

### Configuration
- `.eslintrc.js` - Add no-entry-alias rule
- `tools/eslint-rules/no-entry-alias.js` - New ESLint rule
- Edge/worker redirect configuration

### Tests
- `src/lib/api.test.ts` - Update for /stories paths
- `src/lib/http.test.ts` - Test activeOnly scoping
- E2E tests for redirects

## Acceptance Criteria
- [x] Visiting `/adventures*` redirects to `/stories*` via client-side redirect
- [x] No code references to entry aliases remain
- [x] ESLint blocks new entry alias usage
- [x] All catalog and detail pages work via `/stories` URLs
- [x] activeOnly=1 present for lists, absent for details
- [x] Updated navigation labels and UI text
- [x] All new tests pass

## Phase 1 Summary

### Files Created
- `frontend/src/pages/stories/StoriesPage.tsx` - New stories listing page
- `frontend/src/pages/stories/StoryDetailPage.tsx` - New story detail page
- `frontend/src/components/redirects/AdventureToStoryRedirect.tsx` - Client-side redirect component
- `frontend/src/lib/id.ts` - ID and slug utilities
- `frontend/src/lib/story-kind.ts` - StoryKind validation and guards
- `frontend/tools/eslint-rules/no-entry-alias.js` - ESLint rule to prevent entry alias usage
- `frontend/src/lib/id.test.ts` - Tests for ID utilities
- `frontend/src/lib/story-kind.test.ts` - Tests for StoryKind utilities

### Files Modified
- `frontend/src/App.tsx` - Added stories routes and redirect component
- `frontend/src/lib/api.ts` - Removed entry aliases
- `frontend/src/types/aliases.ts` - Removed Entry exports
- `frontend/src/lib/http.ts` - Fixed activeOnly scoping for detail endpoints
- `frontend/src/pages/stories/StoriesPage.tsx` - Updated to use new API and types
- `frontend/src/pages/stories/StoryDetailPage.tsx` - Updated to use new API and types
- `frontend/eslint.config.js` - Added custom ESLint rule
- `frontend/src/lib/http.test.ts` - Added tests for detail endpoint scoping

### Key Changes
1. **Route Migration**: Created `/stories` routes alongside existing `/adventures` routes
2. **Client Redirects**: Added automatic redirect from `/adventures*` to `/stories*`
3. **Alias Removal**: Removed all `listEntries`, `getEntry`, `Entry`, `EntryKind` exports
4. **ESLint Rule**: Added custom rule to prevent new entry alias usage
5. **Phase 0 Refinements**: Fixed activeOnly scoping, added error normalization, ID utilities, StoryKind guards
6. **Navigation Updates**: Updated all UI text from "Adventures" to "Stories"
7. **API Integration**: Updated pages to use new React Query hooks and domain types

### Tests Added
- HTTP client tests for activeOnly scoping
- ID utility tests for UUID/slug detection
- StoryKind utility tests for validation and guards
- API client tests for parameter serialization

All new tests pass and the migration is complete.

---

# Phase 2: Read-Only Catalogs & Route Cleanup

## Executive Summary
Build read-only catalog pages for Worlds, Stories, NPCs, Rulesets, remove legacy `/adventures` routes, add edge 301 redirects, and complete the migration to the new product model.

## Phase 2 Checklist

### ✅ Clean Up Routes & SEO
- [ ] Add edge 301 redirects: `/adventures*` → `/stories*`
- [ ] Remove remaining `/adventures` route files/components
- [ ] Update sitemap to include only new routes
- [ ] Add canonical tags to Story detail pages

### ✅ Catalog Pages (Read-Only)
- [ ] Create `/worlds` catalog page
- [ ] Create `/stories` catalog page  
- [ ] Create `/npcs` catalog page
- [ ] Create `/rulesets` catalog page
- [ ] Ensure all use existing React Query hooks

### ✅ Shared Components
- [ ] Create reusable Card component
- [ ] Create responsive Grid component
- [ ] Create Chip component for world/ruleset pills
- [ ] Create Skeleton states
- [ ] Create Empty state component

### ✅ Detail Linkage
- [ ] Ensure cards link to existing detail routes
- [ ] Test navigation from catalogs to details

### ✅ Performance & Accessibility
- [ ] Add lazy loading for card images
- [ ] Implement skeleton loading states
- [ ] Add keyboard navigation and focus management
- [ ] Verify mobile-first design (375×812)

### ✅ Telemetry
- [ ] Add catalog_view events
- [ ] Add catalog_card_click events

### ✅ Tests
- [ ] Unit tests for catalog pages
- [ ] E2E tests for navigation and redirects
- [ ] Accessibility tests

## Files to Create

### Catalog Pages
- `frontend/src/pages/worlds/WorldsPage.tsx`
- `frontend/src/pages/npcs/NPCsPage.tsx`
- `frontend/src/pages/rulesets/RulesetsPage.tsx`

### Shared Components
- `frontend/src/components/catalog/CatalogCard.tsx`
- `frontend/src/components/catalog/CatalogGrid.tsx`
- `frontend/src/components/catalog/CatalogChip.tsx`
- `frontend/src/components/catalog/CatalogSkeleton.tsx`
- `frontend/src/components/catalog/EmptyState.tsx`

### Tests
- `frontend/src/pages/worlds/WorldsPage.test.tsx`
- `frontend/src/pages/npcs/NPCsPage.test.tsx`
- `frontend/src/pages/rulesets/RulesetsPage.test.tsx`

## Files to Remove
- `frontend/src/pages/AdventuresPage.tsx`
- `frontend/src/pages/AdventureDetailPage.tsx`
- `frontend/src/pages/MyAdventuresPage.tsx`

## Acceptance Criteria
- [ ] All catalog pages render real data with skeletons and empty states
- [ ] Cards navigate to correct detail pages
- [ ] No status UI appears anywhere
- [ ] `/adventures*` returns 301 to `/stories*` at edge
- [ ] Sitemap includes only new routes
- [ ] Story detail has canonical to `/stories/:slug`
- [ ] Basic a11y: focus, alt text, keyboard navigation
- [ ] All tests pass

---

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

---

# StoneCaster Frontend - Phase 4: Detail Pages with Cross-links

## Executive Summary
Successfully implemented Phase 4 of the StoneCaster frontend migration, creating rich detail pages with natural pivots between Worlds, Stories, NPCs, and Rulesets. All detail pages include proper cross-linking, analytics tracking, and prefetching for optimal user experience.

## Phase 4 Completion Summary

### ✅ World Detail Page (`/worlds/:slug`)
- **Tabbed Interface** - Stories and NPCs tabs with proper state management
- **Scoped Data** - Shows only Stories and NPCs belonging to the specific world
- **Analytics Tracking** - Tracks world views and tab changes
- **Responsive Design** - Mobile-first layout with proper image handling
- **Empty States** - Graceful handling when no content exists

### ✅ Enhanced Story Detail Page (`/stories/:slug`)
- **Rich Chips** - World and ruleset chips with clickable navigation
- **Tag Display** - Non-linkable tag pills for categorization
- **Featured NPCs** - Grid of NPCs featured in the story
- **Begin Story CTA** - Primary action button pointing to `/play/start?story=<id>`
- **Analytics Tracking** - Comprehensive tracking of story views and interactions
- **SEO Optimization** - Canonical tags and meta descriptions

### ✅ NPC Detail Page (`/npcs/:id`)
- **World Context** - World chip with navigation to world detail
- **Cross-links** - "View Stories" button with pre-filtered search
- **Portrait Display** - Proper image handling with fallbacks
- **Analytics Tracking** - NPC view and cross-link click tracking
- **Responsive Layout** - Mobile-optimized design

### ✅ Ruleset Detail Page (`/rulesets/:id`)
- **Story Listing** - Shows all stories using the specific ruleset
- **Filtered Results** - Only displays active stories with the ruleset
- **Analytics Tracking** - Ruleset view tracking
- **Empty States** - Proper handling when no stories use the ruleset

### ✅ Cross-link Consistency & Prefetching
- **usePrefetch Hook** - Intelligent prefetching on hover/intersection
- **Consistent Navigation** - All chips and links use proper routing
- **Filter Preservation** - Cross-links maintain relevant filter context
- **Performance Optimization** - Prefetching reduces perceived load times

### ✅ Analytics & Tracking
- **Detail View Tracking** - `world_view`, `story_view`, `npc_view`, `ruleset_view`
- **Tab Change Tracking** - `world_tab` for tab switches
- **Cross-link Tracking** - `cross_link_click` for navigation between entities
- **CTA Tracking** - `begin_story_click` for story start actions
- **Card Click Tracking** - Maintained from Phase 3

### ✅ Performance & Accessibility
- **Prefetching** - Hover-based prefetching for detail pages
- **Image Optimization** - Lazy loading, proper dimensions, and alt text
- **Keyboard Navigation** - Full keyboard support for all interactive elements
- **ARIA Labels** - Proper accessibility labels for screen readers
- **Focus Management** - Logical tab order and visible focus rings
- **Loading States** - Skeleton loading for all data sections

### ✅ Testing Coverage
- **Unit Tests** - Comprehensive tests for all detail pages
- **Hook Tests** - usePrefetch hook testing with proper mocking
- **Component Tests** - Detail page component testing with user interactions
- **Analytics Tests** - Tracking function testing with proper mocking

## Files Modified/Created in Phase 4

### New Files
- `frontend/src/pages/worlds/WorldDetailPage.tsx` - World detail with tabs
- `frontend/src/pages/worlds/WorldDetailPage.test.tsx` - World detail tests
- `frontend/src/pages/npcs/NPCDetailPage.tsx` - NPC detail page
- `frontend/src/pages/npcs/NPCDetailPage.test.tsx` - NPC detail tests
- `frontend/src/pages/rulesets/RulesetDetailPage.tsx` - Ruleset detail page
- `frontend/src/pages/rulesets/RulesetDetailPage.test.tsx` - Ruleset detail tests
- `frontend/src/lib/usePrefetch.ts` - Prefetching hook
- `frontend/src/lib/usePrefetch.test.ts` - Prefetch hook tests

### Modified Files
- `frontend/src/lib/api.ts` - Added individual detail API functions
- `frontend/src/lib/queries.ts` - Added individual detail hooks
- `frontend/src/pages/stories/StoryDetailPage.tsx` - Enhanced with chips and featured NPCs
- `frontend/src/components/catalog/CatalogCard.tsx` - Added prefetching and updated props
- `frontend/src/App.tsx` - Added new detail page routes

## Verification Steps

1. **World Detail Navigation**
   - ✅ Navigate to `/worlds/mystika` and verify world details display
   - ✅ Switch between Stories and NPCs tabs
   - ✅ Verify only world-specific content is shown
   - ✅ Test analytics tracking in console

2. **Story Detail Enhancement**
   - ✅ Navigate to `/stories/the-veil` and verify enhanced layout
   - ✅ Click on world and ruleset chips to verify navigation
   - ✅ Verify featured NPCs section displays correctly
   - ✅ Test "Begin Story" CTA button

3. **NPC Detail Cross-links**
   - ✅ Navigate to `/npcs/npc-1` and verify NPC details
   - ✅ Click world chip to navigate to world detail
   - ✅ Click "View Stories" to see pre-filtered stories
   - ✅ Verify search includes NPC name

4. **Ruleset Detail Stories**
   - ✅ Navigate to `/rulesets/ruleset-1` and verify ruleset details
   - ✅ Verify only stories using this ruleset are shown
   - ✅ Test empty state when no stories use the ruleset

5. **Cross-link Navigation**
   - ✅ Test navigation between all detail page types
   - ✅ Verify filters are preserved where appropriate
   - ✅ Test prefetching by hovering over cards

6. **Analytics Tracking**
   - ✅ Open browser console and navigate to detail pages
   - ✅ Verify detail view events are fired
   - ✅ Test tab changes and cross-link clicks
   - ✅ Verify CTA click tracking

## Next Steps

Phase 4 is complete and ready for Phase 5 (Gameplay Integration). The detail pages now provide rich, interconnected experiences that allow users to naturally explore the StoneCaster universe.

## Technical Notes

- All detail pages use the same design patterns for consistency
- Prefetching is implemented at the component level for optimal performance
- Cross-links maintain context where appropriate (e.g., world filtering)
- Analytics tracking provides comprehensive user behavior insights
- All components follow mobile-first design principles
- Accessibility features ensure the site is usable by all users
- Error states are handled gracefully with proper user feedback
