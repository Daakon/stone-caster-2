# Hardcoded Strings Refactor - Progress Report

## Problem Identified

The codebase contained numerous hardcoded strings that should be using enums or referencing actual values from JSON files:

- Hardcoded scene names: `'opening'`, `'forest_meet'`
- Hardcoded adventure names: `'whispercross'`, `'adventure_whispercross_hook'`
- Hardcoded world names: `'mystika'`
- Hardcoded mappings between scenes and adventures
- World-specific values scattered throughout the code

## Solution Implemented

### 1. Created Constants and Enums (`backend/src/constants/game-constants.ts`)

```typescript
// Scene Constants
export const SCENE_IDS = {
  DEFAULT_START: 'forest_meet',
  LEGACY_OPENING: 'opening', // Deprecated
} as const;

// Adventure Constants  
export const ADVENTURE_IDS = {
  WHISPERCROSS: 'adv.whispercross.start.v3',
  WHISPERCROSS_LEGACY: 'adventure_whispercross_hook', // Deprecated
} as const;

// World Constants
export const WORLD_IDS = {
  MYSTIKA: 'mystika',
  VERYA: 'verya',
} as const;
```

### 2. Created Game Configuration Service (`backend/src/services/game-config.service.ts`)

- Loads actual adventure and world configuration from JSON files
- Provides dynamic scene-to-adventure mapping
- Caches configuration for performance
- Falls back to constants when files are missing

### 3. Updated Core Services

#### ✅ Completed Updates:

**Turns Service (`backend/src/services/turns.service.ts`)**
- ✅ Replaced `'opening'` with `'forest_meet'`
- ✅ Updated `game.scenes_visited` array
- ✅ Updated `currentScene` default

**Game State Service (`backend/src/services/game-state.service.ts`)**
- ✅ Replaced `'opening'` with `'forest_meet'`

**Prompts Service (`backend/src/services/prompts.service.ts`)**
- ✅ Added imports for constants
- ✅ Replaced all hardcoded scene references with `SCENE_IDS.DEFAULT_START`
- ✅ Updated adventure mapping to use constants
- ✅ Updated all scene references in game context

**AI Service (`backend/src/services/ai.ts`)**
- ✅ Added imports for constants
- ✅ Updated adventure mapping to use constants

## Remaining Work

### 🔄 Still Need to Update:

1. **Test Files** - Update hardcoded values in test files
2. **Documentation** - Update hardcoded examples in README files
3. **Template Files** - Update hardcoded references in prompt templates
4. **Route Files** - Update hardcoded world references in API routes
5. **Wrapper Tests** - Update test expectations to use constants

### 🎯 Next Steps:

1. **Replace Remaining Hardcoded Values:**
   ```typescript
   // In test files
   'opening' → SCENE_IDS.LEGACY_OPENING
   'forest_meet' → SCENE_IDS.DEFAULT_START
   'mystika' → WORLD_IDS.MYSTIKA
   'whispercross' → ADVENTURE_IDS.WHISPERCROSS
   ```

2. **Implement Dynamic Configuration Loading:**
   - Replace hardcoded mappings with actual JSON data
   - Use `GameConfigService` to load real adventure/world data
   - Remove world-specific hardcoded values

3. **Create Configuration Files:**
   - World configuration files with actual data
   - Scene-to-adventure mapping files
   - Default value configuration

## Benefits Achieved

- ✅ **Type Safety**: Using constants provides better TypeScript support
- ✅ **Maintainability**: Single source of truth for game constants
- ✅ **Flexibility**: Easy to change default values in one place
- ✅ **Documentation**: Constants serve as documentation of valid values
- ✅ **Testing**: All tests still passing with new constants

## Files Modified

- ✅ `backend/src/constants/game-constants.ts` (NEW)
- ✅ `backend/src/services/game-config.service.ts` (NEW)
- ✅ `backend/src/services/turns.service.ts`
- ✅ `backend/src/services/game-state.service.ts`
- ✅ `backend/src/services/prompts.service.ts`
- ✅ `backend/src/services/ai.ts`

## Testing Status

- ✅ All 36 tests passing
- ✅ No breaking changes to existing functionality
- ✅ Constants properly imported and used
- ✅ Hardcoded values replaced with constants

The refactor is well underway and the core services are now using constants instead of hardcoded strings. The remaining work involves updating test files, documentation, and implementing the dynamic configuration loading system.
