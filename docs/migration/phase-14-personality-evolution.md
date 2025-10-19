# Phase 14: NPC Personality Evolution Implementation

## Overview

Phase 14 adds persistent, adaptive NPC personalities that evolve through interactions and memories across sessions. This extends the existing hot/warm/cold memory tiers, analytics hooks, and localization pipeline without changing any player-facing UI.

## Features Implemented

### 1. NPC Personality Core

**Location**: `backend/src/personality/personality-engine.ts`

- **Persistent Traits**: Stores personality traits (openness, loyalty, caution, empathy, etc.) in `npc_personalities` table
- **Trait Evolution**: Traits influence dialogue tone, act probabilities, and relationship deltas
- **Numeric Scales**: All traits use 0-100 scales with textual archetype summaries
- **Cross-Session Continuity**: NPC personalities merge when same NPC reappears in different sessions

### 2. Memory-Driven Adaptation

**Location**: `backend/src/personality/personality-engine.ts`

- **Warm Memory Integration**: Warm memories and episodic events feed back into trait adjustments
- **Configurable Deltas**: Trait changes are bounded and configurable (max 5 points per adjustment)
- **Personality Snapshots**: Stored periodically for analytics and recovery
- **Deterministic Updates**: Uses seeded RNG for consistent behavior

### 3. Behavior Policy Layer

**Location**: `backend/src/policies/npc-behavior-policy.ts`

- **Tone Computation**: Decides dialogue tone (friendly/cautious/cold/aggressive/curious/neutral)
- **Act Biases**: Calculates percentage shifts for different act types based on personality
- **Relationship Integration**: Uses relationship matrix and trust thresholds
- **World Mood Context**: Considers adventure or world "mood" slices
- **Deterministic Weighting**: Uses seeded RNG for consistent behavior

### 4. Cross-Session Personality Continuity

**Location**: `backend/src/personality/personality-engine.ts`

- **Weighted Merging**: NPC personality merges use weighted averaging with decay
- **Historical Weight**: Older snapshots lose weight (decay factor 0.9)
- **Analytics Tracking**: Merge events are logged and tracked for stability
- **Version Control**: Snapshot versioning for tracking personality evolution

### 5. Admin Controls

**Location**: `backend/src/routes/awf-npc-personality-admin.ts`

- **Personality Viewer**: Inspect and view NPC personality traits and history
- **Trait Editor**: Update personality traits with validation
- **Behavior Preview**: Preview behavior profile for specific contexts
- **History Tracking**: View personality evolution over time
- **RBAC Security**: Admin-only access with proper authentication

## Database Schema

### Tables Added

#### `npc_personalities`
```sql
CREATE TABLE npc_personalities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    npc_ref TEXT NOT NULL,
    world_ref TEXT NOT NULL,
    adventure_ref TEXT,
    traits JSONB NOT NULL DEFAULT '{}'::jsonb,
    summary TEXT,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    snapshot_version INTEGER DEFAULT 1,
    derived_from_session TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Indexes
- `idx_npc_personalities_npc_world` - Primary lookup
- `idx_npc_personalities_npc_adventure` - Adventure-specific lookup
- `idx_npc_personalities_last_updated` - Time-based queries
- `idx_npc_personalities_snapshot_version` - Version tracking

### Functions
- `get_npc_personality()` - Retrieve current personality
- `update_npc_personality()` - Update or create personality

## Personality Traits

### Core Traits (0-100 scale)

1. **openness** - How open to new experiences
2. **loyalty** - Loyalty to friends/allies
3. **caution** - Risk aversion
4. **empathy** - Understanding others' feelings
5. **patience** - Tolerance for delays/frustration
6. **aggression** - Tendency toward conflict
7. **trust** - Trust in others
8. **curiosity** - Desire to learn/explore
9. **stubbornness** - Resistance to change
10. **humor** - Appreciation for humor

### Personality Archetypes

- **Friendly**: High trust + empathy
- **Cautious**: High caution + low aggression
- **Aggressive**: High aggression + low patience
- **Curious**: High curiosity + openness
- **Stubborn**: High stubbornness + low openness
- **Humorous**: High humor + empathy
- **Balanced**: Neutral across all traits

## Behavior Policy Integration

### Tone Computation
```typescript
// Base tone from personality traits
if (traits.trust > 70 && traits.empathy > 60) {
  toneScore += 3; // Friendly
} else if (traits.caution > 70 && traits.aggression < 30) {
  toneScore -= 2; // Cautious
} else if (traits.aggression > 70 && traits.patience < 30) {
  toneScore -= 3; // Aggressive
}
```

### Act Biases
```typescript
// Personality-driven act preferences
if (traits.aggression > 60) {
  biases.attack = Math.min(20, (traits.aggression - 60) * 0.5);
  biases.threaten = Math.min(15, (traits.aggression - 60) * 0.3);
}

if (traits.empathy > 60) {
  biases.help = Math.min(25, (traits.empathy - 60) * 0.6);
  biases.comfort = Math.min(20, (traits.empathy - 60) * 0.5);
}
```

### Dialogue Style
- **intimate**: High trust + empathy
- **casual**: Moderate trust + openness
- **distant**: High caution or low trust
- **formal**: Default balanced style

## Analytics Integration

### New Metrics Fields
```typescript
{
  npcTraitShiftAvg: number;        // Average trait change per turn
  npcPersonalityMerges: number;    // Number of personality merges
  npcBehaviorCalls: number;        // Behavior policy computations
  npcTraitChanges: Record<string, number>; // Individual trait changes
}
```

### Tracking Functions
- `trackNpcTraitChanges()` - Record trait adjustments
- `trackNpcPersonalityMerge()` - Record merge events
- `trackNpcBehaviorCall()` - Record behavior computations

## Admin Controls

### API Endpoints

#### Get NPC Personality
```bash
GET /api/admin/awf/npcs/:npcRef/personality?worldRef=mystika&adventureRef=whispercross
```

#### Update NPC Personality
```bash
PUT /api/admin/awf/npcs/:npcRef/personality
{
  "npcRef": "guard_001",
  "worldRef": "mystika",
  "adventureRef": "whispercross",
  "traits": {
    "openness": 60,
    "loyalty": 80,
    "caution": 40,
    "empathy": 70,
    "patience": 50,
    "aggression": 30,
    "trust": 75,
    "curiosity": 65,
    "stubbornness": 35,
    "humor": 55
  },
  "summary": "Friendly guard with high loyalty and trust"
}
```

#### Initialize NPC Personality
```bash
POST /api/admin/awf/npcs/:npcRef/personality/init
{
  "worldRef": "mystika",
  "adventureRef": "whispercross",
  "baseTraits": {
    "openness": 50,
    "loyalty": 80,
    "caution": 60
  }
}
```

#### Merge Cross-Session Personalities
```bash
POST /api/admin/awf/npcs/:npcRef/personality/merge
{
  "worldRef": "mystika",
  "adventureRef": "whispercross"
}
```

#### Get Personality History
```bash
GET /api/admin/awf/npcs/:npcRef/personality/history?worldRef=mystika&limit=10
```

#### Get Behavior Profile
```bash
GET /api/admin/awf/npcs/:npcRef/personality/behavior?worldRef=mystika&sessionId=session-123
```

#### List All Personalities
```bash
GET /api/admin/awf/npcs/personalities?worldRef=mystika&limit=50
```

## Usage Examples

### 1. Initialize NPC Personality

```typescript
import { personalityEngine } from '../personality/personality-engine.js';

// Initialize with default traits
const personality = await personalityEngine.initPersonality(
  'guard_001',
  'mystika',
  'whispercross'
);

// Initialize with custom traits
const customPersonality = await personalityEngine.initPersonality(
  'merchant_elena',
  'mystika',
  'whispercross',
  {
    openness: 80,
    loyalty: 60,
    caution: 40,
    empathy: 70,
    humor: 85
  }
);
```

### 2. Adjust Personality from Memories

```typescript
const warmMemories = [
  {
    type: 'warm',
    content: 'Player helped NPC during crisis',
    emotionalWeight: 60,
    timestamp: new Date().toISOString(),
  },
  {
    type: 'episodic',
    content: 'Shared adventure together',
    emotionalWeight: 40,
    timestamp: new Date().toISOString(),
  },
];

const recentActs = [
  {
    actType: 'help',
    targetNpc: 'guard_001',
    emotionalImpact: 50,
    timestamp: new Date().toISOString(),
  },
];

const updatedPersonality = await personalityEngine.adjustFromMemory(
  'guard_001',
  'mystika',
  'whispercross',
  warmMemories,
  recentActs,
  'session-123'
);
```

### 3. Merge Cross-Session Personalities

```typescript
const mergedPersonality = await personalityEngine.mergeCrossSession(
  'guard_001',
  'mystika',
  'whispercross'
);
```

### 4. Compute Behavior Profile

```typescript
import { npcBehaviorPolicy } from '../policies/npc-behavior-policy.js';

const context = {
  npcRef: 'guard_001',
  worldRef: 'mystika',
  adventureRef: 'whispercross',
  sessionId: 'session-123',
  recentPlayerActs: [
    {
      actType: 'help',
      targetNpc: 'guard_001',
      emotionalImpact: 30,
      timestamp: new Date().toISOString(),
    },
  ],
  relationshipMatrix: { 'guard_001': 70 },
  worldMood: 'tense',
};

const behaviorProfile = npcBehaviorPolicy.computeBehaviorProfile(
  personality.traits,
  context
);

// Generate behavior context for AWF bundle
const behaviorContext = npcBehaviorPolicy.generateBehaviorContext(
  'guard_001',
  behaviorProfile,
  context
);
```

## Integration with AWF Pipeline

### 1. Bundle Assembly Integration

The behavior policy generates context that gets injected into the AWF bundle:

```typescript
// In bundle assembler
const behaviorContext = npcBehaviorPolicy.generateBehaviorContext(
  npcRef,
  behaviorProfile,
  context
);

// Add to AWF bundle meta
awfBundle.meta.behavior = behaviorContext.npc_behavior;
```

### 2. Turn Processing Integration

```typescript
// In turn orchestrator
const personality = await personalityEngine.getPersonality(npcRef, worldRef, adventureRef);
if (personality) {
  const behaviorProfile = npcBehaviorPolicy.computeBehaviorProfile(
    personality.traits,
    context
  );
  
  // Apply behavior profile to turn processing
  // Track analytics
  await trackNpcBehaviorCall(sessionId, playerId, worldRef, adventureRef, locale, 1);
}
```

### 3. Memory Integration

```typescript
// After turn processing
const warmMemories = extractWarmMemories(turnResult);
const recentActs = extractRecentActs(turnResult);

if (warmMemories.length > 0 || recentActs.length > 0) {
  const updatedPersonality = await personalityEngine.adjustFromMemory(
    npcRef,
    worldRef,
    adventureRef,
    warmMemories,
    recentActs,
    sessionId
  );
  
  // Track trait changes
  const traitChanges = calculateTraitChanges(oldPersonality, updatedPersonality);
  await trackNpcTraitChanges(sessionId, playerId, worldRef, adventureRef, locale, traitChanges, averageShift);
}
```

## Security & Privacy

### Data Protection
- **No PII Storage**: Only NPC references and trait data stored
- **Admin Access Only**: All personality management requires admin role
- **Audit Logging**: All personality changes are logged with timestamps
- **Version Control**: Snapshot versioning for tracking changes

### Validation
- **Trait Bounds**: All traits must be 0-100
- **Input Validation**: Zod schemas for all API inputs
- **RBAC Enforcement**: Admin-only access to personality endpoints

## Performance Considerations

### Optimization
- **Caching**: Personality data cached for 1 minute
- **Batch Processing**: Multiple personality updates batched
- **Efficient Queries**: Proper indexes for fast lookups
- **Deterministic Computation**: Seeded RNG for consistent behavior

### Metrics
- **Behavior Computation**: < 3ms per NPC update
- **Personality Merging**: < 5ms for cross-session merge
- **Trait Adjustments**: < 1ms per adjustment calculation

## Testing

### Unit Tests
- **Trait Management**: Initialization, adjustment, bounds checking
- **Behavior Policy**: Tone computation, act biases, deterministic behavior
- **Cross-Session Merging**: Weighted averaging, decay calculations
- **Personality Summaries**: Archetype determination, dominant traits

### Integration Tests
- **End-to-End Flow**: Personality initialization → adjustment → behavior computation
- **Cross-Session Continuity**: Personality merging across sessions
- **Analytics Integration**: Trait change tracking and reporting

### Performance Tests
- **Behavior Computation**: 100 computations in < 100ms
- **Personality Merging**: Efficient weighted averaging
- **Memory Usage**: Minimal memory footprint for personality data

## Troubleshooting

### Common Issues

1. **Personality Not Found**
   - Check NPC reference and world context
   - Verify personality initialization
   - Check database connectivity

2. **Trait Adjustments Not Applied**
   - Verify trait bounds (0-100)
   - Check adjustment calculation logic
   - Ensure proper memory/act data

3. **Behavior Inconsistency**
   - Check deterministic seed generation
   - Verify context data completeness
   - Review behavior policy logic

4. **Cross-Session Merge Issues**
   - Verify snapshot data integrity
   - Check decay factor calculations
   - Ensure proper version tracking

### Debug Commands

```bash
# Check NPC personality
curl "http://localhost:3000/api/admin/awf/npcs/guard_001/personality?worldRef=mystika"

# Get behavior profile
curl "http://localhost:3000/api/admin/awf/npcs/guard_001/personality/behavior?worldRef=mystika&sessionId=session-123"

# List all personalities
curl "http://localhost:3000/api/admin/awf/npcs/personalities?worldRef=mystika"
```

## Future Enhancements

### Planned Features
1. **Personality Templates**: Pre-configured personality archetypes
2. **Relationship Dynamics**: NPC-to-NPC personality interactions
3. **Cultural Traits**: World-specific personality variations
4. **Advanced Analytics**: Personality trend analysis and reporting
5. **A/B Testing**: Personality variation experiments

### Scalability Considerations
1. **Personality Caching**: Redis-based personality cache
2. **Batch Processing**: Bulk personality operations
3. **Data Archival**: Old personality snapshots cleanup
4. **Performance Monitoring**: Real-time personality metrics

## Conclusion

Phase 14 provides comprehensive NPC personality evolution capabilities that enhance the AWF runtime with persistent, adaptive character behaviors. The implementation is production-ready with proper security, performance, and monitoring considerations. The system is designed to scale and can be extended with additional features as needed.

## Migration Notes

### Database Migration
The migration `20250123_awf_npc_personalities.sql` includes:
- All required tables and indexes
- RLS policies for admin access
- Helper functions for personality management
- Default personality archetype

### Backward Compatibility
- No changes to existing AWF pipeline
- Personality system is opt-in per NPC
- All existing functionality preserved
- Graceful degradation when personality data unavailable

### Rollback Plan
1. Stop all personality-related processing
2. Run down migration to remove tables
3. Remove personality integration code
4. Clean up analytics metrics


