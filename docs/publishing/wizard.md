# Publishing Wizard

## Overview

The Publishing Wizard (Phase 7) is an admin-only tool that provides a unified interface for reviewing and submitting entities (worlds, stories, NPCs) for publishing. It combines media checks, dependency validation, field validation, and snapshot preview into a single guided workflow.

## What the Wizard Checks

The wizard runs comprehensive preflight checks across four categories:

### 1. Media Checks

- **Cover Image**: Must be present, finalized (`status='ready'`), and approved (`image_review_status='approved'`)
- **Gallery Images**: All gallery images should be approved (warnings if not, but doesn't block)

**Blockers:**
- Missing cover image
- Cover image not finalized
- Cover image not approved

**Warnings:**
- Gallery images not approved (count shown)

### 2. Dependencies

- **World**: Story/NPC must have a published world
- **Ruleset**: Story must have at least one ruleset linked
- **References**: All entity references must be valid and published

**Blockers:**
- Missing world
- Missing ruleset (for stories)
- Invalid entity references

**Warnings:**
- World not published (for stories/NPCs)

### 3. Validation

- **Required Fields**: Entity must have all required fields filled
  - World: `name`, `description`
  - Story: `title`, `description`
  - NPC: `name`

**Blockers:**
- Missing required fields
- Invalid field values

### 4. Snapshot Preview

For stories and worlds, the wizard shows a preview of what will be frozen at publish time:

- **Schema Version**: Current snapshot schema version (currently `1`)
- **Prompts**: 
  - Core prompt (system prompt)
  - World prompt (from world's `doc`)
  - Ruleset prompt (from ruleset's `doc`)
  - Story prompt (from entry point's `doc` or `content`)
- **Media References**:
  - Cover media ID
  - Gallery media IDs (approved + ready only)

**Note**: This is a preview only. The actual snapshot is created when the publish request is approved (see Phase 5).

## Blocker vs Warning

- **Blockers**: Must be fixed before submitting. The submit button is disabled if any blockers exist.
- **Warnings**: Informational only. You can proceed with warnings, but they indicate potential issues.

## How Snapshot Preview Works

The wizard simulates the snapshot creation process without actually creating a snapshot:

1. Loads the entity and its dependencies (world, ruleset)
2. Extracts prompts using the same logic as `EntryPointAssemblerV3`
3. Collects media references (cover + approved gallery items)
4. Displays the preview in read-only code blocks

The actual snapshot is created later when an admin approves the publish request (see `docs/publishing/README.md` Phase 5).

## Relationship to Phase 5 Snapshot System

The wizard preview shows what will be captured in the prompt snapshot when the entity is published. The snapshot ensures:

- **Game Stability**: Games created after publishing use the frozen prompt configuration
- **Media Stability**: Cover and gallery media IDs are frozen at publish time
- **Versioning**: Each publish creates a new snapshot version

See `docs/publishing/README.md` for full details on the snapshot system.

## How Admins Should Use It

1. **Navigate to Edit Page**: Go to the entity's edit page (world/story/NPC)
2. **Open Wizard**: Click the "Publishing Wizard" button (feature-flag gated, admin-only)
3. **Review Steps**: Go through each step:
   - **Media**: Verify cover and gallery are approved
   - **Dependencies**: Check that all required dependencies are published
   - **Validation**: Ensure all required fields are filled
   - **Snapshot Preview**: Review what will be frozen at publish time
4. **Fix Blockers**: Address any blockers before proceeding
5. **Submit**: Click "Submit for Publishing" when all checks pass

The wizard will:
- Re-run preflight checks before submitting
- Create a publish request if all checks pass
- Return an error if blockers remain

## Feature Flag

The wizard is controlled by the `FF_PUBLISHING_WIZARD` feature flag:

- **Backend**: `FF_PUBLISHING_WIZARD=true`
- **Frontend**: `VITE_FF_PUBLISHING_WIZARD=true`

When disabled, the wizard button is hidden and endpoints return 501.

## API Endpoints

- `GET /api/publishing-wizard/:entityType/:entityId/preflight` - Run preflight checks
- `POST /api/publishing-wizard/:entityType/:entityId/submit` - Submit for publishing

Both endpoints require:
- Authentication (JWT token)
- Admin role
- Feature flag enabled

## Testing

See `docs/publishing/README.md` Phase 7 section for testing requirements.


