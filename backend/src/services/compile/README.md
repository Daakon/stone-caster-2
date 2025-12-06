# Compile Service

**Purpose:** The 4-Step Compiler (Clean Slate Implementation)

## Architecture

This service implements the Chimera compilation pipeline:

1. **Base Loader:** Load `BaseCharacter` + Merge `World` extensions
2. **Resolution:** Validate `Ruleset` dependencies and `Exclusion Groups`
3. **Schema Build:** Merge `actions`, `stats`, and `lore` into a Master Schema
4. **Artifact Gen:** Output `CompiledStory` (JSON) + `LoreIndex` (Vector)

## Status

**Phase 1:** Directory scaffolded. Ready for Phase 2 implementation.

## Related Documentation

- `docs/PROJECT_CONTEXT_MAP.md` - Section 4: The Compiler Strategy
- `docs/chimera-full-schemas.json` - Schema definitions

