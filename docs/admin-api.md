# Admin API Documentation

## Overview

Admin API endpoints for managing templates, prompt snapshots, and game settings.

## Authentication

All endpoints require authentication via Bearer token in the `Authorization` header:

```
Authorization: Bearer <token>
```

## Role-Based Access Control

- **viewer**: Read-only access
- **editor**: Can edit templates (draft)
- **publisher**: Can publish templates and override snapshots
- **admin**: Full access (mapped to publisher)

## Templates

### Publish Template

`POST /api/admin/templates/publish`

Publish a new version of a template.

**Required Role**: publisher

**Rate Limit**: 10 requests/hour

**Request Body**:
```json
{
  "type": "world",
  "slot": "tone",
  "body": "Template body with {{variables}}",
  "baseVersion": 1
}
```

**Response**:
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "type": "world",
    "slot": "tone",
    "version": 2,
    "body": "...",
    "status": "published",
    "created_at": "2025-01-01T00:00:00Z",
    "created_by": "user-uuid"
  }
}
```

### Get Template History

`GET /api/admin/templates/:type/:slot/history`

Get version history for a template.

**Response**:
```json
{
  "ok": true,
  "data": [
    {
      "version": 2,
      "status": "published",
      "created_at": "2025-01-01T00:00:00Z",
      "created_by": "user-uuid"
    }
  ]
}
```

### Get Active Templates

`GET /api/admin/templates/active?type=world`

Get active (published) templates, optionally filtered by type.

**Response**:
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "type": "world",
      "slot": "tone",
      "version": 2,
      "body": "...",
      "status": "published"
    }
  ]
}
```

### Get Template Versions

`GET /api/admin/templates/versions`

Get distinct published template versions.

**Response**:
```json
{
  "ok": true,
  "data": [3, 2, 1]
}
```

### Lint Templates

`GET /api/admin/templates/lint?templatesVersion=1`

Lint templates for health checks.

**Response**:
```json
{
  "ok": true,
  "data": {
    "warnings": [
      {
        "type": "truncated",
        "severity": "warning",
        "message": "Content truncated due to max_len"
      }
    ],
    "errors": [
      {
        "type": "missing_slot",
        "severity": "error",
        "message": "Missing published template for slot: world.tone"
      }
    ],
    "summary": {
      "total": 2,
      "errors": 1,
      "warnings": 1
    }
  }
}
```

## Prompt Snapshots

### List Snapshots

`GET /api/admin/prompt-snapshots?gameId=uuid&limit=50`

List prompt snapshots.

**Response**:
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "snapshot_id": "snapshot-uuid",
      "created_at": "2025-01-01T00:00:00Z",
      "source": "auto",
      "templates_version": "1",
      "game_id": "uuid"
    }
  ]
}
```

### Get Snapshot

`GET /api/admin/prompt-snapshots/:id`

Get a specific snapshot.

**Response**:
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "snapshot_id": "snapshot-uuid",
    "tp": { /* TurnPacketV3 */ },
    "linearized_prompt_text": "...",
    "templates_version": "1",
    "created_at": "2025-01-01T00:00:00Z",
    "source": "auto"
  }
}
```

### Get Snapshot Diff

`GET /api/admin/prompt-snapshots/:id/diff/:otherId`

Get unified diff between two snapshots.

**Response**:
```json
{
  "ok": true,
  "data": {
    "tpDiff": "unified diff string",
    "textDiff": "unified diff string"
  }
}
```

### Override Snapshot

`POST /api/admin/prompt-snapshots/:id/override`

Create a manual override snapshot.

**Required Role**: publisher

**Rate Limit**: 5 requests/hour

**Request Body**:
```json
{
  "tp": { /* TurnPacketV3 */ },
  "linearized_prompt_text": "...",
  "reason": "Fix for bug #123"
}
```

**Response**:
```json
{
  "ok": true,
  "data": {
    "originalSnapshotId": "uuid",
    "overrideSnapshotId": "uuid",
    "reason": "Fix for bug #123"
  }
}
```

### Create Manual Snapshot

`POST /api/admin/prompt-snapshots/create`

Create a manual snapshot from preview.

**Required Role**: publisher

**Request Body**:
```json
{
  "tp": { /* TurnPacketV3 */ },
  "linearized_prompt_text": "...",
  "templates_version": "1",
  "pack_versions": {},
  "game_id": "uuid"
}
```

## Prompt Preview

### Preview Prompt

`POST /api/admin/prompt-preview`

Preview TurnPacketV3 and linearized prompt without invoking model. Supports temporary overrides for module params and extras (non-persisting).

**Request Body**:
```json
{
  "worldId": "uuid",
  "rulesetId": "slug",
  "scenarioId": "slug",
  "npcIds": ["npc-1", "npc-2"],
  "templatesVersion": 1,
  "moduleParamsOverrides": {
    "module.relationships.v3": {
      "gainCurve": { "scale": 0.8, "softCap": 12, "hardCap": 20 },
      "minTrustToRomance": 6
    }
  },
  "extrasOverrides": {
    "world": { "soft_taboos": ["violence"] },
    "ruleset": { "custom_setting": "value" },
    "scenario": { "difficulty": "hard" },
    "npcs": {
      "npc-1": { "personality_traits": ["brave", "curious"] }
    }
  },
  "maxTokens": 6000,
  "verbose": true
}
```

**Request Parameters**:
- `worldId` (required): UUID of the world
- `rulesetId` (required): Slug or ID of the ruleset
- `scenarioId` (optional): Slug or ID of the scenario
- `npcIds` (optional): Array of NPC IDs
- `templatesVersion` (optional): Template version to use (pins deterministic results)
- `moduleParamsOverrides` (optional): Temporary overrides for module parameters (non-persisting, validated)
- `extrasOverrides` (optional): Temporary overrides for pack extras (non-persisting, validated)
- `maxTokens` (optional): Maximum context tokens for budget calculation. If provided, applies budget engine and includes budget summary
- `verbose` (optional): If `1` or `true`, includes token counts and budget summary in response

**Note**: Overrides (`moduleParamsOverrides` and `extrasOverrides`) are temporary and never persisted to the database. They only affect the preview output. All overrides are validated against their respective schemas.

**Response**:
```json
{
  "ok": true,
  "data": {
    "source": "preview-overrides",
    "tp": { /* TurnPacketV3 */ },
    "linearized": "...",
    "warnings": [
      "Missing published template for slot: world.tone"
    ],
    "errors": [],
    "tokens": {
      "before": 5000,
      "after": 4800,
      "trimPlan": [
        { "key": "npc.npc-1.bio", "removedTokens": 200 }
      ]
    }
  }
}
```

**Response Fields** (when `verbose=1` or `maxTokens` provided):
- `tokens.before`: Token count before budgeting
- `tokens.after`: Token count after budgeting (only if `maxTokens` provided)
- `tokens.trimPlan`: Array of trim operations (only if `maxTokens` provided)

### Budget Report

`POST /api/admin/prompt-budget-report`

Generate a detailed token budget report for a prompt configuration without persisting anything. Returns deterministic results given the same inputs and `templatesVersion`.

**Required Role**: admin

**Request Body**:
```json
{
  "worldId": "uuid",
  "rulesetId": "slug",
  "scenarioId": "slug",
  "npcIds": ["npc-1", "npc-2"],
  "templatesVersion": 1,
  "moduleParamsOverrides": {
    "module.relationships.v3": {
      "gainCurve": { "scale": 0.8, "softCap": 12, "hardCap": 20 }
    }
  },
  "extrasOverrides": {
    "world": { "soft_taboos": ["violence"] },
    "ruleset": { "custom_setting": "value" }
  },
  "maxTokens": 6000
}
```

**Request Parameters**:
- `worldId` (required): UUID of the world
- `rulesetId` (required): Slug or ID of the ruleset
- `scenarioId` (optional): Slug or ID of the scenario
- `npcIds` (optional): Array of NPC IDs
- `templatesVersion` (optional): Template version to use (ensures deterministic results)
- `moduleParamsOverrides` (optional): Temporary overrides for module parameters (non-persisting, validated)
- `extrasOverrides` (optional): Temporary overrides for pack extras (non-persisting, validated)
- `maxTokens` (optional): Maximum context tokens for budget calculation. Defaults to system config (`CTX_MAX_TOKENS_DEFAULT` or 8000). Must be between 50 and 1,000,000.

**Response**:
```json
{
  "ok": true,
  "data": {
    "tokens": {
      "before": 8500,
      "after": 6000
    },
    "trims": [
      {
        "key": "npc.npc-1.bio",
        "removedChars": 500,
        "removedTokens": 125
      },
      {
        "key": "world.tone",
        "removedChars": 800,
        "removedTokens": 200
      }
    ],
    "warnings": [
      "fallback_trim_applied"
    ],
    "sections": [
      {
        "key": "ruleset.principles",
        "label": "RULESET - Principles",
        "tokensBefore": 400,
        "tokensAfter": 400,
        "trimmed": false
      },
      {
        "key": "npc.npc-1.bio",
        "label": "NPCS - NPC-1 Bio",
        "tokensBefore": 500,
        "tokensAfter": 375,
        "trimmed": true
      }
    ]
  }
}
```

**Response Fields**:
- `tokens.before`: Total token count before budgeting
- `tokens.after`: Total token count after budgeting
- `trims`: Array of trim operations with `key`, `removedChars`, and `removedTokens`
- `warnings`: Array of warning messages (e.g., `"fallback_trim_applied"`, `"min_chars sum exceeds guardrail"`)
- `sections`: Array of section summaries with `key`, `label`, `tokensBefore`, `tokensAfter`, and `trimmed` flag

**Notes**:
- Results are deterministic given the same inputs and `templatesVersion`
- Does not persist any data to the database
- Overrides are temporary and only affect the report output
- Trim order respects category precedence (CORE → RULESET → MODULES → WORLD → SCENARIO → NPCS → STATE → INPUT) and slot priority within categories

**Error Responses**:
- `400`: Missing required fields (`worldId` or `rulesetId`), or `maxTokens` out of range (must be 50-1,000,000)
- `500`: Server error during report generation

**Validation Errors** (400):
```json
{
  "ok": false,
  "error": "Invalid module params overrides",
  "details": {
    "moduleId": "module.relationships.v3",
    "errors": [
      {
        "path": ["gainCurve", "scale"],
        "message": "Number must be between 0 and 3"
      }
    ]
  }
}
```

## Games

### Update Game Settings

`PATCH /api/admin/games/:id`

Update game settings (e.g., templates_version pinning).

**Request Body**:
```json
{
  "templates_version": 1
}
```

**Response**:
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "templates_version": 1
  }
}
```

## Field Definitions

### List Field Definitions

`GET /api/admin/field-defs?packType=world&status=active`

List field definitions for pack extras.

**Response**:
```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "pack_type": "world",
      "key": "soft_taboos",
      "label": "Soft Taboos",
      "group_label": "Content Guidelines",
      "schema_json": {
        "type": "array",
        "items": { "type": "string" }
      },
      "default_json": [],
      "help": "Topics to avoid or handle carefully",
      "status": "active"
    }
  ]
}
```

### Create/Update Field Definition

`POST /api/admin/field-defs`

Create or update a field definition.

**Request Body**:
```json
{
  "pack_type": "npc",
  "key": "personality_traits",
  "label": "Personality Traits",
  "group_label": "Character",
  "schema_json": {
    "type": "array",
    "items": { "type": "string" },
    "minItems": 1,
    "maxItems": 5
  },
  "default_json": [],
  "help": "List of personality traits",
  "status": "active"
}
```

### Deprecate Field Definition

`POST /api/admin/field-defs/:packType/:key/deprecate`

Deprecate a field definition (hides from forms but keeps validation).

## Extras

### Save Pack Extras

`POST /api/admin/:packType/:id/extras`

Save extras for a pack with validation.

**Request Body**:
```json
{
  "extras": {
    "soft_taboos": ["violence", "romance"],
    "personality_traits": ["brave", "curious"]
  }
}
```

**Response**:
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "extras": {
      "soft_taboos": ["violence", "romance"],
      "personality_traits": ["brave", "curious"]
    }
  }
}
```

**Validation Errors** (400):
```json
{
  "ok": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "personality_traits",
      "message": "must NOT have more than 5 items"
    }
  ]
}
```

## Error Responses

All endpoints return errors in this format:

```json
{
  "ok": false,
  "error": "Error message",
  "details": "Additional details"
}
```

### Rate Limit Response

When rate limit is exceeded:

```json
{
  "ok": false,
  "error": "Rate limit exceeded",
  "retryAfter": 3600,
  "resetAt": "2025-01-01T01:00:00Z"
}
```

Status: `429 Too Many Requests`

## Rate Limits

- Template publish: 10 requests/hour per user
- Snapshot override: 5 requests/hour per user

