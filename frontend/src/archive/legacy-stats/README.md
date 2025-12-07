# Legacy Stats Archive

This directory contains archived files and documentation related to legacy RPG stat systems that have been replaced by the new Chimera domain model.

## Migration Summary

### Old Stats System (Deprecated)
- `strength`, `dexterity`, `constitution`, `intelligence`, `wisdom`, `charisma`
- `mana`, `inventory_slots`
- D&D-style attribute system

### New Chimera Domain Model
- `root_force` - Physical power and strength
- `root_finesse` - Dexterity and precision
- `root_awareness` - Perception and alertness
- `root_insight` - Wisdom and understanding
- `root_influence` - Charisma and social power

## Files Still Using Legacy Stats

The following files still reference legacy stats but are kept for backward compatibility or are in active migration:

1. **`frontend/src/services/mockData.ts`**
   - Status: Still in use by several components
   - Used by: `PlayBottomSheet.tsx`, `CharacterCreator.tsx`, `WorldRuleMeters.tsx`
   - Action: Migrate to new domain model when refactoring these components

2. **`frontend/src/mock/characters.json`**
   - Status: Mock test data
   - Contains legacy `skills` object with old stats
   - Action: Update test data to use new stats when tests are refactored

3. **`frontend/src/mock/schemas/*.json`**
   - Status: World-specific character schemas
   - May contain legacy stat references
   - Action: Review and update when migrating world schemas

## Migration Checklist

- [x] Created `src/types/chimera-domain.ts` with new domain model
- [x] Updated `GamePage.layer-p1.test.tsx` to use new stats
- [ ] Migrate `mockData.ts` Character interface to use new stats
- [ ] Update `characters.json` mock data
- [ ] Review and update world schema files
- [ ] Update components using `mockDataService` to use new domain model

## Notes

- The new domain model uses `Record<string, number>` for stats to allow ruleset-specific extensions
- Stats are stored in `entity_json.stats` (JSONB) in the database
- The frontend should use the types from `@/types/chimera-domain.ts` as the source of truth
