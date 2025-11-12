# Admin UI Implementation - Complete

## Summary

All admin UI components, backend endpoints, tests, and documentation have been implemented.

## Completed Components

### A) Prompt Snapshots UI ✅

**Files Created:**
- `frontend/src/pages/admin/PromptSnapshots.tsx` - Main page
- `frontend/src/components/admin/SnapshotList.tsx` - List view with actions
- `frontend/src/components/admin/SnapshotView.tsx` - View with collapsible JSON sections
- `frontend/src/components/admin/SnapshotDiff.tsx` - Unified diff viewer
- `frontend/src/components/admin/SnapshotOverrideDialog.tsx` - Override dialog with validation
- `frontend/src/components/admin/CollapsibleSection.tsx` - Reusable collapsible component

**Features:**
- List view with filtering by gameId
- View with TurnPacket JSON and linearized text tabs
- Diff view with unified diff for JSON and text
- Override dialog with client-side validation
- Copy-to-clipboard functionality
- Rate limit messaging (5/hour)

### B) Prompt Preview UI ✅

**Files Created:**
- `frontend/src/pages/admin/PromptPreview.tsx` - Main page
- `frontend/src/components/admin/PromptPreviewForm.tsx` - Form with world/ruleset/NPC selectors
- `frontend/src/components/admin/PromptPreviewResult.tsx` - Result display with warnings

**Features:**
- Form with world/ruleset/scenario/NPC selectors
- Templates version dropdown (Latest or specific version)
- Preview result with TurnPacket JSON and linearized text
- Warnings display
- "Create snapshot from preview" button (feature-flagged, publisher-only)

### C) Story Settings - Templates Pinning ✅

**Files Created:**
- `frontend/src/pages/admin/StorySettings.tsx` - Story settings page
- `frontend/src/components/admin/TemplatesVersionSelect.tsx` - Version selector component

**Features:**
- Dropdown with "Latest Published" and specific versions
- Save to `games.templates_version`
- Inline call-out explaining pinning effect
- PATCH `/api/admin/games/:id` endpoint

### D) Backend Endpoints ✅

**New Endpoints:**
- `PATCH /api/admin/games/:id` - Update game templates_version
- `POST /api/admin/prompt-snapshots/create` - Create manual snapshot
- `GET /api/admin/templates/versions` - Get distinct template versions

**Enhanced Endpoints:**
- `POST /api/admin/templates/publish` - Added RBAC (publisher) + rate limit (10/hour)
- `POST /api/admin/prompt-snapshots/:id/override` - Added RBAC (publisher) + rate limit (5/hour)

### E) Tests ✅

**Files Created:**
- `backend/tests/template-lint.test.ts` - CI gate for template lint
- `backend/tests/rbac.test.ts` - RBAC middleware tests
- `backend/tests/rate-limit.test.ts` - Rate limit middleware tests

**CI Gates Added:**
- Template lint gate (no missing slot errors for Latest Published)
- Linearized order test
- RBAC and rate limit tests

### F) Documentation ✅

**Files Created:**
- `docs/admin-api.md` - Complete API documentation with examples
- `docs/ADMIN_UI_COMPLETE.md` - This summary document

### G) UX Polish ✅

**Features Added:**
- Rate limit messages in UI (10 publishes/hour, 5 overrides/hour)
- Cache-busting on publish (invalidates active templates query)
- Error handling for 429 rate limit responses
- Client-side validation for TurnPacketV3 in override dialog
- Deep links ready (can be added to navigation)

## Routes Added

```typescript
<Route path="/prompt-snapshots" element={<PromptSnapshots />} />
<Route path="/prompt-preview" element={<PromptPreview />} />
<Route path="/stories/:gameId/settings" element={<StorySettings />} />
```

## ExtrasForm How-To

### Using ExtrasForm in Pack Edit Pages

1. **Import the component:**
```typescript
import { ExtrasForm } from '@/components/admin/ExtrasForm';
```

2. **Add to your edit page:**
```typescript
<ExtrasForm
  packType="npc"
  packId={id}
  initialExtras={npc.extras || null}
  onSuccess={() => {
    loadNPC(); // Reload to get updated extras
  }}
/>
```

3. **Features:**
   - Automatically fetches field definitions for the pack type
   - Renders form controls based on JSON Schema
   - Shows "Used in Templates" badges for fields referenced in templates
   - Validates on change and submit
   - Scrolls to first error on validation failure
   - Supports deprecated field toggle

### Creating Field Definitions

1. Go to `/admin/field-registry`
2. Click "Create Field"
3. Fill in:
   - Pack Type (world/ruleset/npc/scenario)
   - Key (e.g., `soft_taboos`)
   - Label (e.g., "Soft Taboos")
   - Group Label (optional, for UI grouping)
   - JSON Schema (e.g., `{"type": "array", "items": {"type": "string"}}`)
   - Default Value (optional)
   - Help Text (optional)

4. Save - the field is now available in ExtrasForm for that pack type

### Using Extras in Templates

Reference extras in Mustache templates:
```
{{extras.soft_taboos}}
{{extras.personality_traits}}
```

The ExtrasForm shows which fields are used in templates with a badge.

## Next Steps (Optional Enhancements)

1. **Deep Links:**
   - Add "Diff with previous" link in SnapshotView
   - Add "Preview with this version" link in TemplatesManager

2. **Character Count Visualization:**
   - Show slot.max_len in Template Editor
   - Visualize truncation with progress bar

3. **RBAC UI:**
   - Show role badges in admin pages
   - Disable buttons based on role (not just hide)

4. **Cache Management:**
   - Add manual cache invalidation button
   - Show cache status/age

## Testing

All components are ready for testing. Run:

```bash
# Backend tests
cd backend && npm test

# Template lint gate
npm run test:template-lint

# Frontend (manual testing)
# Navigate to /admin/prompt-snapshots, /admin/prompt-preview, etc.
```

## API Documentation

See `docs/admin-api.md` for complete API reference.

