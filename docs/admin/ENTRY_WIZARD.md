# Entry Setup Wizard

The Entry Setup Wizard is a comprehensive tool for configuring game entries with optimal prompt assembly. It guides authors through a step-by-step process to ensure all necessary components are properly configured.

## Overview

The wizard consists of four main steps:

1. **Basics** - Configure entry name, world, and rulesets
2. **NPCs** - Select and bind NPCs and NPC packs
3. **Segments** - Review and manage prompt segments
4. **Preview** - Live preview with token budgeting and linting

## Features

### Step 1: Basics
- **Entry Details**: Name and auto-generated slug
- **World Selection**: Choose from available worlds
- **Rulesets**: Multi-select with drag-and-drop ordering
- **Summary**: Review selections before proceeding

### Step 2: NPCs
- **World Filtering**: Show NPCs from selected world
- **Individual NPCs**: Select specific NPCs
- **NPC Packs**: Include entire packs of NPCs
- **Uniqueness Enforcement**: Prevent duplicate selections
- **Selection Summary**: Review chosen NPCs and packs

### Step 3: Segments
- **Segment Checklist**: Visual overview of all required segments
- **Scope Coverage**: Check core, ruleset, world, entry, entry_start, and NPC segments
- **Missing Indicators**: Highlight missing required segments
- **Add Segment**: Quick access to create missing segments
- **Status Overview**: Total segments, missing count, and readiness status

### Step 4: Preview
- **Live Preview**: Real-time prompt assembly without LLM calls
- **Token Meter**: Visual token usage and budget monitoring
- **Lint System**: Automated checks for common issues
- **Assembly Info**: Detailed breakdown of prompt components
- **Test Chat**: Start a test game directly from the wizard

## Token Budgeting

The wizard includes comprehensive token budgeting features:

### Token Meter
- **Visual Progress Bar**: Shows current vs. maximum tokens
- **Status Indicators**: Safe (green), Warning (yellow), Critical (red)
- **Detailed Breakdown**: Remaining tokens and percentage usage
- **Recommendations**: Suggestions for optimization

### Budget Controls
- **Max Tokens**: Configurable limit (400, 800, 1200, 1600, 2000)
- **Locale Support**: Different token estimates per language
- **First Turn Toggle**: Include/exclude entry_start segments

## Linting System

The wizard performs comprehensive linting to catch issues before publishing:

### Required Segments
- **Core**: System-wide prelude (always required)
- **Ruleset**: Mechanics for each selected ruleset
- **World**: Lore and invariants for the selected world
- **Entry**: Scenario-specific context

### Optional Segments
- **Entry Start**: Recommended for first turn experiences
- **NPC**: Character profiles with tiered reveals

### Budget Checks
- **Over Budget**: When estimated tokens exceed maximum
- **Token Efficiency**: Suggestions for optimization

### Reference Validation
- **Scope-Ref Matching**: Ensures segments reference correct entities
- **Missing References**: Catches broken associations

## API Integration

### Preview Endpoint
```
GET /api/entries/:id/preview?locale=en&firstTurn=true&maxTokens=800&npcIds=a,b,c
```

**Response:**
```json
{
  "entry": { "id": "uuid", "name": "string", "slug": "string" },
  "world": { "id": "uuid", "name": "string", "slug": "string" },
  "rulesets": [{ "id": "uuid", "name": "string", "sort_order": 0 }],
  "npcs": [{ "id": "uuid", "name": "string", "tier": 0 }],
  "prompt": "assembled prompt string",
  "meta": {
    "segmentIdsByScope": { "core": ["id1"], "ruleset": ["id2"] },
    "budgets": { "maxTokens": 800, "estTokens": 400 },
    "truncationMeta": {},
    "assemblerVersion": "1.0.0",
    "locale": "en"
  },
  "lints": [
    {
      "code": "missing_world_segment",
      "level": "error",
      "message": "No active world segment found for World Name (en)"
    }
  ]
}
```

## User Experience

### Navigation
- **Step Progress**: Visual progress bar and step indicators
- **URL Persistence**: Step state saved in query parameters
- **Dirty State Guard**: Warns before navigating away with unsaved changes
- **Keyboard Navigation**: Full keyboard accessibility

### Mobile Support
- **Responsive Design**: Optimized for mobile devices
- **Touch Interactions**: Swipe gestures for step navigation
- **Compact Layout**: Efficient use of screen space

### Performance
- **Lazy Loading**: Components loaded on demand
- **Debounced Updates**: Efficient API calls
- **Optimistic UI**: Immediate feedback for user actions

## Testing

### Unit Tests
- **Component Tests**: Individual step components
- **Hook Tests**: Custom hooks for data fetching
- **Utility Tests**: Token calculation and validation

### Integration Tests
- **API Tests**: Preview endpoint functionality
- **E2E Tests**: Complete wizard workflow
- **Accessibility Tests**: Screen reader and keyboard navigation

### Test Coverage
- **Happy Path**: Successful wizard completion
- **Error Handling**: Network failures and validation errors
- **Edge Cases**: Empty states and boundary conditions

## Development

### Component Structure
```
EntryWizard/
├── EntryWizard.tsx          # Main wizard component
├── Steps/
│   ├── BasicsStep.tsx       # Step 1: Basics
│   ├── NPCsStep.tsx         # Step 2: NPCs
│   ├── SegmentsStep.tsx     # Step 3: Segments
│   └── PreviewStep.tsx      # Step 4: Preview
└── PreviewPanel.tsx         # Shared preview component
```

### Key Dependencies
- **React Hook Form**: Form state management
- **Zod**: Schema validation
- **React Router**: Navigation and URL state
- **Tailwind CSS**: Styling and responsive design
- **Lucide React**: Icons and visual indicators

### Custom Hooks
- `useEntry`: Entry data fetching
- `useWorlds`: World list management
- `useRulesets`: Ruleset list management
- `useNPCs`: NPC list management
- `useNPCPacks`: NPC pack management
- `usePromptSegments`: Segment data fetching

## Best Practices

### Performance
- **Memoization**: Use React.memo for expensive components
- **Lazy Loading**: Load step components on demand
- **Debouncing**: Limit API calls during user input

### Accessibility
- **ARIA Labels**: Proper labeling for screen readers
- **Keyboard Navigation**: Full keyboard support
- **Focus Management**: Logical focus flow
- **Color Contrast**: Sufficient contrast ratios

### Error Handling
- **Graceful Degradation**: Fallbacks for failed API calls
- **User Feedback**: Clear error messages and recovery options
- **Validation**: Client-side and server-side validation

### Code Quality
- **TypeScript**: Strict typing throughout
- **ESLint**: Code quality and consistency
- **Prettier**: Code formatting
- **Testing**: Comprehensive test coverage

## Future Enhancements

### Planned Features
- **Template System**: Pre-configured entry templates
- **Bulk Operations**: Mass segment creation and management
- **Advanced Filtering**: Complex NPC and segment filtering
- **Collaboration**: Multi-user editing and review

### Performance Improvements
- **Caching**: Intelligent caching of preview data
- **Optimization**: Reduced bundle size and faster loading
- **Real-time Updates**: Live collaboration features

### Integration
- **Version Control**: Git-like versioning for entries
- **Export/Import**: Backup and restore functionality
- **Analytics**: Usage tracking and optimization insights
