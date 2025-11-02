# Prompting Legacy Decommission Plan

This document outlines the controlled decommission of legacy prompting infrastructure in favor of v3 entry-point assembler.

## Overview

Legacy prompting infrastructure has been quarantined and will be removed in phases over 30 days. This ensures no regressions while migrating to the new system.

## Current State (Phase 1)

**Date:** 2025-02-08  
**Status:** ✅ Quarantined

### Schema Changes

- **`prompting` schema** → **`prompting_legacy` schema**
  - All legacy tables, functions, and views moved
  - Access revoked from `service_role`, `authenticated`, `anon`
  - Only database owner can access

- **New `prompting` schema**
  - Empty schema for future use
  - Stub functions that error if called

### Code Changes

- Legacy functions replaced with error stubs
- ESLint rules block legacy imports
- Dependency cruiser prevents legacy usage
- Check scripts prevent reintroduction

## Migration Timeline

### Phase 1: Quarantine (2025-02-08) ✅

**Completed:**
- [x] Rename `prompting` → `prompting_legacy`
- [x] Create new empty `prompting` schema
- [x] Revoke access from all roles
- [x] Create stub functions that error
- [x] Add ESLint rules
- [x] Add dependency cruiser config
- [x] Add check scripts
- [x] Add CI guards

**Verification:**
```bash
pnpm ops:db-guards
pnpm run check-legacy-code  # platform-specific
```

### Phase 2: Code Cleanup (T+14 days, ~2025-02-22)

**Planned:**
- [ ] Remove legacy code references in tests/fixtures
- [ ] Archive legacy test fixtures to `tests/fixtures/legacy/`
- [ ] Update any remaining documentation references
- [ ] Run full test suite to verify no regressions

**Verification:**
```bash
pnpm test
pnpm qa:scan
```

### Phase 3: Hard Drop (T+30 days, ~2025-03-08)

**Planned:**
- [ ] Full database backup
- [ ] Drop `prompting_legacy` schema
- [ ] Remove stub functions (or keep as permanent guards)
- [ ] Final verification

**Rollback Plan:**
See [Rollback](#rollback) section below.

## Guardrails

### Database Guards

Run `pnpm ops:db-guards` to verify:
- `prompting_legacy` schema exists
- `prompting` schema exists and is empty
- Stub functions contain `LEGACY_PROMPTS_DISABLED`
- Access is properly revoked

### Codebase Guards

**ESLint Rules:**
- Blocks imports matching `**/*prompt_segments*`
- Blocks `scope: 'scenario'` in new code

**Dependency Cruiser:**
- Blocks imports from `**/legacy/**` to `**/src/**`
- Blocks imports of `prompt_segments` modules

**Check Scripts:**
- `scripts/check-legacy-code.sh` (Unix)
- `scripts/check-legacy-code.ps1` (Windows)

Blocks:
- `prompt_segments_for_context`
- `prompting.prompts\b`
- `prompting.prompt_segments\b`
- `buildPrompt(` (except in `tests/fixtures/legacy/**`)
- `initial-prompt` route strings
- `scope: 'scenario'` in new code

### CI Guards

GitHub Actions workflow checks:
1. `pnpm qa:scan` (warn on PR, block on main)
2. `scripts/check-legacy-code.*`
3. `pnpm typecheck:strict`
4. `pnpm ops:db-guards`
5. Grep compiled output for legacy symbols

## Replacement Path

### Old (Legacy)

```typescript
// ❌ DEPRECATED
const { data } = await supabase.rpc('prompting.prompt_segments_for_context', {
  p_world_id: worldId,
  p_entry_start_slug: entrySlug,
});
```

### New (v3)

```typescript
// ✅ Use entry-point assembler v3
import { EntryPointAssemblerV3 } from '../prompts/entry-point-assembler-v3.js';

const assembler = new EntryPointAssemblerV3();
const result = await assembler.assemble({
  entryPointId,
  entryStartSlug,
  budgetTokens: 8000,
});
```

## Rollback

If critical issues arise, rollback procedure:

### Database Rollback

```sql
BEGIN;

-- Restore schema name
ALTER SCHEMA prompting_legacy RENAME TO prompting;

-- Restore access (if needed)
GRANT USAGE ON SCHEMA prompting TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA prompting TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA prompting TO service_role;

COMMIT;
```

### Code Rollback

1. Revert migration: `supabase/migrations/20250208_legacy_quarantine.sql`
2. Remove ESLint rules from `.eslintrc.cjs`
3. Remove dependency cruiser config
4. Remove check scripts or mark as optional
5. Update CI to not fail on legacy usage

**Note:** Rollback should only be used in emergency situations. Preferred approach is to fix issues while maintaining quarantine.

## Monitoring

### Metrics to Track

- Calls to stub functions (should be zero)
- CI failures from legacy checks (should be zero)
- QA scan errors (should decrease over time)

### Alerts

Set up alerts for:
- Any access to `prompting_legacy` schema (should be zero)
- CI failures from legacy code checks
- QA scan error severity findings

## Related Documentation

- [Entry Point Preview Tool](../authoring/entry-point-preview.md)
- [Prompt Architecture (Observed)](../prompting-architecture-observed.md)
- [API Contract](../API_CONTRACT.md)

## Questions

For questions about the decommission:
1. Check this document first
2. Review `docs/prompting-architecture-observed.md` for current architecture
3. Contact engineering team lead

## Changelog

- **2025-02-08**: Phase 1 completed - Legacy quarantined
- **T+14 days**: Phase 2 planned - Code cleanup
- **T+30 days**: Phase 3 planned - Hard drop

