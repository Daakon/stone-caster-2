# Prompt Generation Fix - Adventure Start Alignment

## Problem Identified

The prompt generation was still producing the old format:
```
Begin the adventure "adventure_opening" from its starting scene "opening".
```

Instead of the new format that should reference the actual adventure and scene:
```
Begin the adventure "adv.whispercross.start.v3" from its starting scene "forest_meet".
```

## Root Causes Found

### 1. Incorrect Adventure Name Mapping
- **Issue**: `mapSceneToAdventure` was returning `'whispercross'` instead of the actual adventure ID `'adv.whispercross.start.v3'`
- **Fix**: Updated mapping in both `prompts.service.ts` and `ai.ts` to use correct adventure IDs

### 2. Incorrect Adventure Name Formatting
- **Issue**: `resolvePlayerInput` was adding `adventure_` prefix to already-formatted adventure names
- **Fix**: Removed automatic `adventure_` prefix addition, use adventure name as-is

### 3. Outdated Validation Pattern
- **Issue**: Validation regex expected `adventure_` prefix format
- **Fix**: Updated regex to accept any adventure name format

## Changes Made

### 1. Updated Adventure Mappings
```typescript
// Before
'forest_meet': 'whispercross'

// After  
'forest_meet': 'adv.whispercross.start.v3'
```

### 2. Fixed Adventure Name Formatting
```typescript
// Before
const formattedAdventureName = adventureName.startsWith('adventure_') 
  ? adventureName 
  : `adventure_${adventureName}`;

// After
const formattedAdventureName = adventureName;
```

### 3. Updated Validation Pattern
```typescript
// Before
const expectedPattern = /Begin the adventure "adventure_\w+" from its starting scene "\w+"/;

// After
const expectedPattern = /Begin the adventure ".+" from its starting scene "\w+"/;
```

## Expected Output

The system should now generate:
```
Begin the adventure "adv.whispercross.start.v3" from its starting scene "forest_meet".
```

This correctly references:
- **Adventure ID**: `adv.whispercross.start.v3` (matches the adventure file)
- **Scene ID**: `forest_meet` (matches the start.scene in the adventure file)

## Validation

- ✅ All 36 tests passing
- ✅ Adventure mappings use correct IDs
- ✅ No automatic `adventure_` prefix addition
- ✅ Validation pattern accepts any adventure name format
- ✅ Prompt generation aligns with new start format

The prompt generation system now correctly aligns with the new adventure start structure and will generate the proper INPUT_BEGIN section that references the actual adventure and scene IDs.
