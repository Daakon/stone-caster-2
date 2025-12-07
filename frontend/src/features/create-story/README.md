# Create Story Feature (Draft Workspace)

This feature module implements the new "Story Creation" (Casting Circle) architecture, replacing the legacy implementation.

## Architecture

### Directory Structure
```
src/features/create-story/
├── store/
│   └── useStoryDraftStore.ts    # Zustand store with localStorage + debounced backend sync
├── components/                   # React components (to be implemented)
├── hooks/                        # Custom hooks (to be implemented)
├── index.ts                      # Feature exports
└── README.md                     # This file
```

### State Management

**Store:** `useStoryDraftStore`
- **Persistence:** Immediate localStorage sync via Zustand persist middleware
- **Backend Sync:** Debounced (2s delay) to reduce API calls
- **State:** Manages `StoryDraft` with multi-step wizard (0-4 steps)

### Domain Model

All types are defined in `@/types/chimera-domain.ts`:

- **WorldDefinition** (Tier 0): World metadata with `ruleset_keys`
- **EntityTemplate** (Tier 1): Entities with new stats (`root_force`, `root_finesse`, etc.)
- **StoryDraft**: Draft workspace state with staged entities/lore

### New Stats System

Replaces legacy D&D-style attributes:
- ❌ `strength`, `dexterity`, `constitution`, `intelligence`, `wisdom`, `charisma`
- ✅ `root_force`, `root_finesse`, `root_awareness`, `root_insight`, `root_influence`

## Usage

```typescript
import { useStoryDraftStore } from '@/features/create-story';

function MyComponent() {
  const draft = useStoryDraftStore((state) => state.draft);
  const initializeDraft = useStoryDraftStore((state) => state.initializeDraft);
  const updateMetadata = useStoryDraftStore((state) => state.updateMetadata);
  const setStep = useStoryDraftStore((state) => state.setStep);
  
  // Initialize draft
  useEffect(() => {
    initializeDraft('world-123', {
      title: 'My World',
      summary: 'A fantasy world',
      genre_tags: ['fantasy'],
      safety_filters: ['pg'],
      ruleset_keys: ['d100-5-pillars'],
    });
  }, []);
  
  // Update metadata
  const handleUpdate = () => {
    updateMetadata({ title: 'Updated Title' });
  };
  
  // Navigate steps
  const handleNext = () => {
    setStep(draft?.current_step + 1 ?? 0);
  };
}
```

## Store API

### State
- `draft: StoryDraft | null` - Current draft state

### Actions
- `initializeDraft(draftId, metadata?)` - Create new draft
- `updateMetadata(updates)` - Update world metadata (triggers debounced save)
- `setStep(step)` - Set wizard step 0-4 (saves immediately)
- `stageEntity(entityId)` - Add entity to staged list
- `unstageEntity(entityId)` - Remove entity from staged list
- `stageLore(loreId)` - Add lore fragment to staged list
- `unstageLore(loreId)` - Remove lore fragment from staged list
- `markDirty()` - Mark draft as having unsaved changes
- `saveToBackend()` - Immediate save (bypasses debounce)
- `debouncedSave()` - Trigger debounced save
- `clearDraft()` - Reset to initial state
- `loadFromBackend(draftId)` - Load draft from server (TODO)

## Next Steps

1. **Implement Components:**
   - Step 0: Intent/Genre selection
   - Step 1: World selection/creation
   - Step 2: Ruleset selection
   - Step 3: Entity staging
   - Step 4: Review and finalize

2. **Backend Integration:**
   - Implement `saveToBackend()` API call
   - Implement `loadFromBackend()` API call
   - Add error handling and retry logic

3. **Testing:**
   - Unit tests for store actions
   - Integration tests for wizard flow
   - E2E tests for draft persistence

## Migration Notes

- Legacy stats (`strength`, `dexterity`, etc.) have been archived
- See `src/archive/legacy-stats/README.md` for migration checklist
- Test file `GamePage.layer-p1.test.tsx` has been updated to use new stats
