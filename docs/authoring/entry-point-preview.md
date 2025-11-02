# Entry Point Preview Tool

The Entry Point Preview tool allows authors to inspect and debug v3 prompt assembly without calling AI or creating games.

## Overview

The preview tool provides:
- **Real-time prompt assembly** - See the exact prompt that would be sent to AI
- **Budget simulation** - Test different token budgets and see how NPCs are trimmed
- **Piece inspection** - View all pieces (core, ruleset, world, entry, NPCs) with token counts
- **Content QA** - Automatically flag common content issues
- **Export** - Copy or download prompts and preview data

## Access

The preview tool is admin-only and requires:
1. Admin role in `user_profiles`
2. `DEBUG_ROUTES_ENABLED=true` environment variable
3. Valid `X-Debug-Token` header matching `DEBUG_ROUTES_TOKEN`

## UI Usage

### Route
```
/admin/entry-points/:id/preview
```

### Controls

1. **Budget Slider**: Adjust token budget (25% - 200% of default)
   - Default: 8000 tokens
   - Adjust to simulate different budget constraints

2. **Warning Threshold**: Set the percentage at which warnings are triggered
   - Default: 90%
   - When token usage exceeds this, policy actions are triggered

3. **NPC Cap**: Hard limit on NPCs before budget policy
   - Pre-trims NPCs deterministically
   - Useful for testing specific NPC configurations

4. **Include NPCs Toggle**: Toggle NPC inclusion on/off
   - When off, all NPC pieces are excluded

5. **Entry Start Slug**: Optional override for entry start slug
   - Defaults to entry point's configured start slug

6. **QA Report Toggle**: Enable/disable content quality checks
   - Checks for empty text, oversized pieces, duplicate NPCs, etc.

### Panels

- **Meta Bar**: Token usage gauge, NPC counts, and by-scope breakdown
- **Prompt Panel**: Full assembled prompt with copy/download
- **Pieces Table**: All pieces grouped by scope with token counts
- **QA Section**: Filterable list of content issues

### Keyboard Accessibility

- All controls are keyboard accessible
- Screen reader announcements for state changes (e.g., "NPCs trimmed from 12 to 8")
- Tab navigation and Enter/Space activation

## API Usage

### Endpoint
```
GET /api/admin/preview/entry-point/:entryPointId
```

### Query Parameters

- `rulesetSlug` (optional): Override ruleset selection
- `budget` (optional): Token budget override (number)
- `warnPct` (optional): Warning threshold override (0-1)
- `npcLimit` (optional): Hard cap on NPCs (integer)
- `includeNpcs` (0|1, default 1): Include NPC pieces
- `entryStartSlug` (optional): Entry start slug override
- `qa=1`: Include QA report in diagnostics

### Response

```json
{
  "ok": true,
  "data": {
    "prompt": "...",
    "pieces": [...],
    "meta": {
      "included": [],
      "dropped": [],
      "policy": [],
      "tokenEst": { "input": 0, "budget": 0, "pct": 0.0 },
      "source": "entry-point",
      "version": "v3"
    },
    "diagnostics": {
      "tokenEstDetail": [...],
      "npcBefore": 12,
      "npcAfter": 9,
      "budgetOverrides": {...},
      "prompt_hash": "...",
      "byScope": {...},
      "qaReport": [...]
    }
  }
}
```

## CLI Usage

### Batch Preview Script

Preview all active entry points:

```bash
pnpm preview:all
```

This script:
1. Fetches all active entry points
2. Runs preview with default budget and tight budget (50%)
3. Generates JSON report: `docs/reports/v3-entry-point-preview.json`
4. Generates Markdown summary: `docs/reports/v3-entry-point-preview-summary.md`
5. Flags entry points exceeding 90% budget

### Output

The script outputs:
- Per-entry-point token usage (default and tight budgets)
- NPC trimming statistics
- QA issue counts
- Summary of entry points exceeding thresholds

## Content QA

The QA system checks for:

### Error-Level Issues
- **EMPTY_TEXT**: Piece has very low token count (< 10), likely empty
- **DUPLICATE_NPC_SLUG**: Same NPC slug appears multiple times

### Warning-Level Issues
- **OVERSIZED_PIECE**: Single piece uses > 40% of budget
- **EXCESS_WHITESPACE**: Leading/trailing whitespace issues

### Info-Level Issues
- **DISALLOWED_CHARS**: Contains markdown code fences (may be intentional)

## Best Practices

### Token Budget Management

1. **Target < 75% usage before NPCs**
   - This leaves room for NPCs and avoids aggressive trimming

2. **Monitor by-scope breakdown**
   - Core, ruleset, world, and entry should be stable
   - NPCs are the variable component

3. **Test with tight budgets**
   - Run preview with 50% budget to stress test
   - Verify NPC trimming is deterministic and appropriate

### Content Quality

1. **Fix all error-level QA issues**
   - Empty pieces break prompt continuity
   - Duplicate NPCs cause confusion

2. **Review oversized pieces**
   - If a single piece uses > 40% of budget, consider splitting
   - World or ruleset prompts are common culprits

3. **Validate whitespace**
   - Clean up leading/trailing whitespace
   - Ensure consistent formatting

### NPC Management

1. **Use sort_order consistently**
   - NPCs are ordered by `sort_order ASC, npc_slug ASC`
   - Trimming happens from the end (lowest priority first)

2. **Test NPC limits**
   - Use `npcLimit` parameter to test specific configurations
   - Verify critical NPCs aren't trimmed

3. **Monitor NPC counts**
   - Track `npcBefore` vs `npcAfter` in diagnostics
   - Adjust budgets if too many NPCs are dropped

## Troubleshooting

### "Entry point not found"
- Verify entry point ID is correct
- Check entry point status is 'active'
- Verify world is active

### "No default ruleset found"
- Ensure entry point has a mapped ruleset in `entry_point_rulesets`
- Check at least one ruleset has `is_default=true`

### "Admin role required"
- Verify user has `role='admin'` in `user_profiles`
- Check `DEBUG_ROUTES_ENABLED=true` in environment
- Ensure `X-Debug-Token` header matches `DEBUG_ROUTES_TOKEN`

### Preview differs from actual game
- Preview uses v3 assembler only (entry-point mode)
- Actual games may use different assemblers or have different contexts
- Check `source` and `version` in meta to confirm

## Rate Limiting

The preview API is rate-limited:
- Default: 30 requests per minute per `X-Debug-Token`
- Configurable via `DEBUG_ROUTES_RATE_LIMIT` environment variable
- Rate limit applies per token (not per user)

## Storage

Preview settings are stored in `localStorage`:
- Key: `sc.preview.{entryPointId}`
- Includes: budget, warnPct, npcLimit, includeNpcs, entryStartSlug, qa
- Persists across sessions
- Use "Reset to defaults" to clear

## Examples

### Testing Budget Trim Policy

```bash
# Default budget (8000 tokens)
curl -H "X-Debug-Token: $TOKEN" \
  "https://api.example.com/api/admin/preview/entry-point/$EP_ID"

# Tight budget (4000 tokens) to force NPC trimming
curl -H "X-Debug-Token: $TOKEN" \
  "https://api.example.com/api/admin/preview/entry-point/$EP_ID?budget=4000"

# Disable NPCs entirely
curl -H "X-Debug-Token: $TOKEN" \
  "https://api.example.com/api/admin/preview/entry-point/$EP_ID?includeNpcs=0"
```

### Running QA Check

```bash
# Include QA report
curl -H "X-Debug-Token: $TOKEN" \
  "https://api.example.com/api/admin/preview/entry-point/$EP_ID?qa=1"
```

## Related Documentation

- [Prompt Architecture (Observed)](../prompting-architecture-observed.md)
- [API Contract](../API_CONTRACT.md)
- [Entry Point Assembler v3](../../backend/src/prompts/entry-point-assembler-v3.ts)

