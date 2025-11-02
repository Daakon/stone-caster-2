# Legacy Prompts Deprecation Schedule

## Timeline

**Sunset Date**: `2025-12-31` (or as set by `LEGACY_PROMPTS_SUNSET`)

**Current Status**: Legacy prompts disabled by default (`LEGACY_PROMPTS_ENABLED=false`)

## Deprecated Components

### Routes

- `POST /api/games/:id/initial-prompt` - Superseded by `POST /api/games` (V3 spawn)

### Services

- `PromptsService.buildPrompt()` - Replaced by `DatabasePromptAssembler.assemblePromptV2()`
- `PromptsService.createInitialPromptWithApproval()` - Replaced by Phase 3 `spawnV3`

## Migration Path

### For Clients Using Legacy Route

**Old**:
```http
POST /api/games/:id/initial-prompt
Content-Type: application/json

{
  "entry_point_id": "...",
  "world_id": "...",
  ...
}
```

**New**:
```http
POST /api/games
Content-Type: application/json
Idempotency-Key: <uuid>

{
  "entry_point_id": "...",
  "world_id": "...",
  "entry_start_slug": "...",
  "scenario_slug": "...",
  ...
}
```

### Response Shape

**Old**: Legacy response format (varies)

**New**: 
```json
{
  "ok": true,
  "data": {
    "game_id": "<uuid>",
    "first_turn": {
      "turn_number": 1,
      "role": "narrator",
      "content": "...",
      "meta": { ... }
    }
  }
}
```

## Removal Plan

### Phase 1: Disable (Current)

- `LEGACY_PROMPTS_ENABLED=false` (default)
- Legacy route returns `410 Gone` with migration guidance
- Compatibility adapter kept in code (gated behind flag)

### Phase 2: Monitoring (Next 3 Months)

- Monitor `legacy_prompt_used_total` metric
- Should remain at 0 (no usage)
- If increments detected, investigate and migrate client

### Phase 3: Code Removal (After Sunset Date)

**Date**: After `2025-12-31` (or `LEGACY_PROMPTS_SUNSET` date)

**Actions**:
1. Remove `LEGACY_PROMPTS_ENABLED` flag and all related code
2. Delete `PromptsService.buildPrompt()` method
3. Delete `PromptsService.createInitialPromptWithApproval()` method
4. Remove `POST /api/games/:id/initial-prompt` route handler
5. Remove compatibility adapter code
6. Update documentation to remove legacy references

**Files to Delete/Modify**:
- `backend/src/services/prompts.service.ts` (remove methods)
- `backend/src/routes/games.ts` (remove legacy route)
- `backend/src/config/index.ts` (remove flag)
- `docs/` (remove legacy references)

### Phase 4: Cleanup (1 Month After Removal)

- Remove deprecated code from version control
- Update API documentation
- Remove feature flag from config matrix
- Archive migration guide

## Communication

### Stakeholders

- **Internal Teams**: Notify via Slack #engineering
- **External Clients**: Email notification 90 days before sunset
- **Documentation**: Update API docs with deprecation notice

### Migration Support

- Provide migration guide (this document)
- Offer support during migration period
- Monitor metrics for usage and assist with migration

## Rollback Plan

If removal causes issues:

1. Re-enable flag: `LEGACY_PROMPTS_ENABLED=true`
2. Re-deploy with legacy code
3. Investigate root cause
4. Fix and retry removal

## Success Criteria

**Removal Complete When**:
- [ ] No metrics for `legacy_prompt_used_total` for 30 days
- [ ] All clients migrated to V3 API
- [ ] Code removed and tests updated
- [ ] Documentation updated
- [ ] No references to legacy prompts in codebase

