# Phase 4: AWF Act Interpreter

This document outlines the implementation of the AWF Act Interpreter, a core component responsible for applying AWF.acts[] to the session's persisted state using the injection_map.acts configuration. This phase focuses on transactional act application with full contract rule enforcement and state management.

## `applyActs` Function

The primary function implemented in this phase is `applyActs`:

```typescript
export async function applyActs(params: {
  sessionId: string;
  awf: { scn: string; txt: string; choices?: any[]; acts?: any[]; val?: string | null };
}, supabase: SupabaseClient): Promise<{ newState: GameState; summary: ActApplicationSummary }>;
```

### Inputs
- `sessionId`: The unique identifier for the current game session
- `awf`: The AWF response object containing scene, text, choices, acts, and validation
- `supabase`: An initialized Supabase client instance for database access

### Output
- `newState`: The updated game state after applying all acts
- `summary`: A detailed summary of all changes made during act application

## Act Application Process

The `applyActs` function performs the following steps:

1. **Transaction Initialization**: Begins a database transaction to ensure atomicity
2. **Data Loading**: Retrieves current session, game state, injection map, and world configuration
3. **Contract Validation**: Enforces first-turn and TIME_ADVANCE rules
4. **Act Application**: Applies each act using the configured injection map modes
5. **Memory Hygiene**: Trims episodic memory to maintain size limits
6. **State Updates**: Updates session turn_id and is_first_turn flags
7. **Transaction Commit**: Commits all changes atomically

## Supported Act Types and Modes

### Act Types
- `REL_CHANGE`: Relationship changes with NPCs
- `OBJECTIVE_UPDATE`: Objective status and progress updates
- `FLAG_SET`: Setting game flags
- `RESOURCE_CHANGE`: Resource value changes (HP, energy, etc.)
- `SCENE_SET`: Scene transitions
- `TIME_ADVANCE`: Time progression with band rolling
- `MEMORY_ADD`: Adding episodic memories
- `PIN_ADD`: Adding memory pins
- `MEMORY_TAG`: Tagging memory entries
- `MEMORY_REMOVE`: Removing memory entries

### Act Modes
- `merge_delta_by_npc`: Applies delta changes to NPC relations with baseline of 50
- `upsert_by_id`: Updates or creates objectives by ID
- `set_by_key`: Sets flag values by key
- `merge_delta_by_key`: Applies delta changes to resource values
- `set_value`: Sets scene values
- `add_number`: Adds ticks to time with band rolling
- `append_unique_by_key`: Adds unique episodic memories
- `add_unique`: Adds unique pins
- `tag_by_key`: Modifies memory entry tags
- `remove_by_key`: Removes memory entries

## Contract Rules

### First Turn Rules
- **Forbidden**: TIME_ADVANCE acts are not allowed on the first turn
- **Allowed**: All other act types are permitted

### Subsequent Turn Rules
- **Required**: Exactly one TIME_ADVANCE act must be present
- **Allowed**: All other act types are permitted

## Time Band Rolling

The system implements sophisticated time management using world-configured time bands:

### Configuration
Time bands are defined in the world document:
```json
{
  "time": {
    "bands": [
      { "name": "Dawn", "maxTicks": 60, "next": "Morning" },
      { "name": "Morning", "maxTicks": 60, "next": "Afternoon" },
      { "name": "Afternoon", "maxTicks": 60, "next": "Evening" },
      { "name": "Evening", "maxTicks": 60, "next": "Dawn" }
    ],
    "defaultBand": "Dawn"
  }
}
```

### Rolling Logic
When adding ticks to time:
1. Calculate total ticks (current + added)
2. While total >= current band's maxTicks:
   - Subtract band's maxTicks from total
   - Advance to next band
   - Wrap around at the end
3. Set final band and remaining ticks

## Memory Hygiene

The system maintains warm episodic memory within size limits:

### Capping
- Maximum episodic entries: 60 (configurable)
- Maximum note length: 120 characters (truncated with "...")

### Trimming Strategy
When memory exceeds capacity:
1. Sort by salience (ascending) - lowest salience first
2. Sort by turn ID (ascending) - oldest first
3. Remove excess entries from the beginning

## Transaction Management

All act applications are wrapped in database transactions:

### Transaction Flow
1. **Begin**: Start transaction with `begin_transaction`
2. **Lock**: Read session and game state with `FOR UPDATE`
3. **Apply**: Process all acts and update state
4. **Commit**: Commit transaction with `commit_transaction`
5. **Rollback**: On any error, rollback with `rollback_transaction`

### Idempotence
Multiple applications of the same AWF response produce identical results:
- No duplicate memory keys
- Deduplicated pins
- Stable objective upserts
- Consistent state changes

## Act Application Summary

The system provides detailed summaries of all changes:

```typescript
interface ActApplicationSummary {
  relChanges: Array<{ npc: string; delta: number; newVal: number }>;
  objectives: Array<{ id: string; prev?: string; next: string }>;
  flags: string[];
  resources: Array<{ key: string; delta: number; newVal: number }>;
  scene?: string;
  time?: { 
    prev: { band: string; ticks: number }; 
    next: { band: string; ticks: number }; 
    added: number 
  };
  memory: { added: number; pinned: number; trimmed: number };
  violations: string[];
}
```

## Development Script: `apply-acts.ts`

A utility script is provided for testing act application:

### Usage
```bash
npm run awf:apply -- --session <sessionId> --awf-file <path>
```

### Features
- Loads AWF JSON from file
- Applies acts to session
- Displays detailed summary
- Shows current hot state
- Reports violations

### Example Output
```
=== ACT APPLICATION SUMMARY ===
✅ Acts applied successfully
📊 Relations changed: 2
📊 Objectives updated: 1
📊 Flags set: 1
📊 Resources changed: 1
📊 Memory entries added: 1
📊 Memory entries pinned: 1
📊 Memory entries trimmed: 0
⚠️  Violations: 0

🎭 Scene set to: forest_clearing
⏰ Time advanced: 30 ticks
⏰ From: Dawn (0 ticks)
⏰ To: Morning (30 ticks)
```

## Error Handling

The system provides comprehensive error handling:

### Validation Errors
- Unknown act types are logged as violations
- Invalid objective statuses are rejected
- Contract rule violations throw errors

### Transaction Errors
- Database errors trigger rollback
- Partial state is never persisted
- Clear error messages for debugging

### Memory Violations
- Truncated notes are logged
- Unknown act types are reported
- Invalid configurations are flagged

## Testing

Comprehensive unit and integration tests cover:

### Contract Rules
- First turn TIME_ADVANCE rejection
- Subsequent turn TIME_ADVANCE requirement
- Valid act combinations

### Act Modes
- All supported act types and modes
- Edge cases and error conditions
- Idempotence verification

### Time Management
- Band rolling at boundaries
- Wrap-around behavior
- Tick accumulation

### Memory Management
- Capping and trimming
- Deduplication
- Tag management

### Transaction Safety
- Rollback on errors
- Atomic state updates
- Concurrent access handling

## Integration

The act interpreter integrates with:

- **AWF Repository Factory**: For data access
- **Supabase Database**: For transaction management
- **Injection Map System**: For act configuration
- **World Configuration**: For time band management

## Performance Considerations

- **Transaction Scope**: Minimal transaction duration
- **Memory Limits**: Configurable episodic memory caps
- **Batch Operations**: Efficient database updates
- **Error Recovery**: Fast rollback on failures

## Security

- **Input Validation**: All act data is validated
- **SQL Injection**: Parameterized queries only
- **Access Control**: Session-based authorization
- **Data Integrity**: Transactional consistency

## Future Enhancements

- **Custom Act Types**: Plugin system for new act types
- **Advanced Memory**: ML-based salience scoring
- **Time Zones**: Multi-timezone support
- **Audit Trail**: Complete change history


