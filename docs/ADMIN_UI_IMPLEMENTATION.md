# Admin UI Implementation Summary

## Completed Backend Infrastructure

### 1. Database Migrations
- ✅ `20250215_stories_templates_version.sql` - Adds `templates_version` column to games table

### 2. RBAC (Role-Based Access Control)
- ✅ `backend/src/middleware/rbac.ts` - Role hierarchy: viewer < editor < publisher
- ✅ Enforced on:
  - POST /api/admin/templates/publish (requires publisher)
  - POST /api/admin/prompt-snapshots/:id/override (requires publisher)

### 3. Rate Limiting
- ✅ `backend/src/middleware/rate-limit.ts` - In-memory rate limiting
- ✅ Limits:
  - Template publish: 10/hour per user
  - Snapshot override: 5/hour per user
- ✅ Returns 429 with retryAfter and resetAt

### 4. Caching
- ✅ `backend/src/services/templates-cache.ts` - 60s TTL cache for active templates
- ✅ Auto-invalidates on template publish
- ✅ Used by renderSlots() for performance

### 5. Template Linting
- ✅ `backend/src/utils/template-lint.ts` - Health checks:
  - Missing published template for registered slots
  - Unknown Mustache variables
  - Truncated content (over max_len)
  - Syntax errors
- ✅ GET /api/admin/templates/lint - Returns warnings and errors
- ✅ POST /api/admin/prompt-preview - Includes warnings in response

### 6. Story-Level Template Pinning
- ✅ Games table has `templates_version` column
- ✅ `turns.service.ts` reads `game.templates_version` and passes to adapter
- ✅ `buildTurnPacketV3FromV3()` accepts `templatesVersion` parameter
- ✅ Falls back to latest published if not set

### 7. Updated Admin Routes
- ✅ POST /api/admin/templates/publish - RBAC + rate limit
- ✅ POST /api/admin/prompt-snapshots/:id/override - RBAC + rate limit + validation
- ✅ POST /api/admin/prompt-preview - Includes lint warnings
- ✅ GET /api/admin/templates/lint - Health check endpoint

## Admin UI Pages (To Implement)

### 1. Templates Manager (`/admin/templates`)
**List View:**
- Group by type → slot
- Show latest published version, draft count
- Link to detail view

**Detail View:**
- Version history table (version, status, created_at, created_by)
- Editor with textarea for body
- [Preview] button - calls POST /api/admin/prompt-preview with fixture
- [Publish] button - calls POST /api/admin/templates/publish
- Show warnings inline on preview

**API Calls:**
- GET /api/admin/templates/active?type=...
- GET /api/admin/templates/:type/:slot/history
- POST /api/admin/templates/publish

### 2. Prompt Snapshots (`/admin/prompt-snapshots`)
**List View:**
- GET /api/admin/prompt-snapshots?gameId=&limit=
- Columns: id, created_at, source, templates_version
- Row actions: [View], [Diff Prev], [Override]

**View:**
- Show tp JSON (collapsible sections)
- Show linearized text
- Copy-to-clipboard buttons

**Diff:**
- GET /api/admin/prompt-snapshots/:id/diff/:otherId
- Render unified diff for JSON and text

**Override Panel:**
- Textarea for linearized text
- JSON editor for tp
- Require "reason" field
- POST /api/admin/prompt-snapshots/:id/override

### 3. Prompt Preview (`/admin/prompt-preview`)
**Form:**
- World selector
- Ruleset selector
- Scenario selector (optional)
- Multi-select NPCs
- Templates version dropdown (Latest Published or specific version)

**On Submit:**
- POST /api/admin/prompt-preview
- Show tp JSON, linearized text, warnings
- "Create snapshot from preview" button (flag-gated, creates manual snapshot)

## Next Steps

1. Create React components for the 3 admin pages
2. Add routes to AdminRouter
3. Implement API service functions
4. Add story settings UI for templates_version pinning
5. Write tests for RBAC and rate limits
6. Generate API docs

