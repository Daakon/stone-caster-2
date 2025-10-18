# Phase 21: Dynamic Dialogue System with Story Arcs & Romance

## Overview

Phase 21 introduces a comprehensive dialogue system with deterministic line selection, story arcs, romance rails with explicit consent gates, and multi-speaker scene control. The system integrates with personality (Phase 14), quest graph (Phase 15), mechanics (Phase 16), party (Phase 18), world sim (Phase 19), i18n (Phase 12), and economy (Phase 17).

## Key Features

### Dialogue Kernel
- **Authorable Dialogue Graphs**: DAG structure with nodes (line, branch, gate, banter, interrupt, reaction)
- **Multi-Speaker Support**: Player + companions/NPCs with deterministic speaker turns
- **Cooldowns & Repetition Damping**: Prevents repetitive dialogue
- **Inline Emotion Cues**: Compact tags that bias tone without mechanics leakage

### Story Arcs
- **Arc Registry**: Personal arcs (per NPC) & relationship arcs (NPC↔player or NPC↔NPC)
- **State Machine**: locked → available → active → completed → epilogue
- **Quest Graph Integration**: Hooks into Phase 15 quest nodes
- **World Event Integration**: Hooks into Phase 19 world events

### Romance Rails & Consent
- **Consent Gating**: Opt-in flags, minimum trust, recent behavior checks
- **Safety Rails**: Configurable per NPC with boundaries and pacing
- **Fade-to-Black**: Soft stops handled by acts only
- **Explicit Content Blocking**: No sexual explicit content in any field

## Database Schema

### Dialogue Graphs
```sql
CREATE TABLE dialogue_graphs (
  id TEXT PRIMARY KEY,
  world_ref TEXT NOT NULL,
  adventure_ref TEXT,
  doc JSONB NOT NULL,
  hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Story Arcs
```sql
CREATE TABLE story_arcs (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('npc', 'relationship')),
  world_ref TEXT NOT NULL,
  adventure_ref TEXT,
  doc JSONB NOT NULL,
  hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Game State Extensions
```sql
-- Extend game_states with dialogue state
ALTER TABLE game_states 
ADD COLUMN dialogue JSONB DEFAULT '{
  "active_conv": null,
  "speaker_queue": [],
  "cooldowns": {},
  "emotions": {},
  "last_lines": []
}'::jsonb;

-- Extend game_states with relationships state
ALTER TABLE game_states 
ADD COLUMN relationships JSONB DEFAULT '{
  "consent_map": {},
  "boundaries": {},
  "trust_levels": {},
  "romance_flags": {}
}'::jsonb;
```

## Dialogue Graph Schema

### Node Types
- **line**: Standard dialogue line with speaker, synopsis, emotions
- **branch**: Conditional branching based on guards
- **gate**: Access control with requirements
- **banter**: Casual conversation with cooldown
- **interrupt**: Handles player actions or events
- **reaction**: NPC agency conflicts with player actions

### Example Node
```json
{
  "id": "line.kiera.greeting",
  "type": "line",
  "speaker": "npc.kiera",
  "syn": "Warm greeting by the glade.",
  "emotion": ["warm", "curious"],
  "cooldown": 3
}
```

### Example Edge
```json
{
  "from": "line.kiera.greeting",
  "to": "branch.kiera.trust",
  "condition": "trust_high"
}
```

## Story Arc Schema

### Arc Structure
```json
{
  "id": "arc.kiera.trust",
  "scope": "npc",
  "world_ref": "world.forest_glade",
  "adventure_ref": "adv.herbal_journey",
  "npc_id": "npc.kiera",
  "phases": [
    { "id": "locked", "name": "Locked", "description": "Arc not yet available" },
    { "id": "available", "name": "Available", "description": "Arc can be started" },
    { "id": "active", "name": "Active", "description": "Arc in progress" },
    { "id": "completed", "name": "Completed", "description": "Arc finished" },
    { "id": "epilogue", "name": "Epilogue", "description": "Arc aftermath" }
  ],
  "steps": [
    {
      "id": "earn_trust",
      "name": "Earn Trust",
      "description": "Build trust with Kiera",
      "guards": [{"type": "relationship", "npc": "kiera", "min_trust": 40}],
      "rewards": [{"type": "RELATIONSHIP_DELTA", "npc": "kiera", "trust_delta": 10}]
    }
  ],
  "romance_flags": {
    "eligible": true,
    "min_trust": 65,
    "consent_required": true,
    "cooldown_turns": 3
  }
}
```

## New AWF Acts

### Dialogue Acts
- **DIALOGUE_ADVANCE**: Progress conversation to next node
- **DIALOGUE_SET_SPEAKER**: Change active speaker
- **DIALOGUE_SET_EMOTION**: Set emotion tags for speaker
- **DIALOGUE_SET_COOLDOWN**: Set cooldown for dialogue node

### Arc Acts
- **ARC_SET_STATE**: Change arc state (available/active/completed/epilogue)
- **ARC_PROGRESS**: Progress arc to next step

### Romance Acts
- **ROMANCE_CONSENT_SET**: Set consent for NPC (yes/no/later)
- **BOUNDARY_SET**: Set boundary for NPC
- **REACTION_MENU**: Offer reaction choices for agency conflicts

## Dialogue Engine

### Core Functionality
- **Line Selection**: Deterministic scoring based on personality, intent, arc phase, pacing, recent acts, sim context
- **Speaker Management**: Multi-speaker support with turn-based progression
- **Cooldown Enforcement**: Prevents repetitive dialogue
- **Interrupt Handling**: Responds to player actions and world events

### Scoring Algorithm
```typescript
Score = weighted sum of {
  personality: 15,    // Phase 14 personality alignment
  intent: 10,         // Phase 18 party intent alignment
  arc: 5,             // Current arc phase
  pacing: 3,          // Phase 15 quest pacing
  recent: 2,          // Recent dialogue history
  sim: 0              // Phase 19 simulation context
}
```

### Deterministic Tie-Breaking
```typescript
Seed = `${sessionId}:${turnId}:${convId}:${nodeId}`
// Use seeded RNG for consistent results
```

## Arc Engine

### State Machine
- **locked**: Arc not available (requirements not met)
- **available**: Arc can be started
- **active**: Arc in progress
- **completed**: Arc finished
- **epilogue**: Arc aftermath

### Guard Types
- **relationship**: Check trust level with NPC
- **presence**: Check if NPCs are present
- **quest**: Check quest node status
- **sim**: Check world simulation events
- **arc**: Check other arc states

### Romance Integration
- **Consent Gates**: Required before romance progression
- **Trust Requirements**: Minimum trust level for romance
- **Cooldown Enforcement**: Prevents rapid romance progression
- **Boundary Respect**: Honors established boundaries

## Romance Safety Policy

### Consent Management
- **Opt-in Flags**: Player/session-level consent
- **NPC Consent**: Individual NPC consent tracking
- **Boundary Setting**: Configurable boundaries per NPC
- **Cooldown Management**: Prevents rapid consent changes

### Safety Features
- **Explicit Content Blocking**: No sexual explicit content
- **Fade-to-Black**: Soft stops for intimate scenes
- **Time-Skip**: Alternative to explicit content
- **Boundary Enforcement**: Respects established limits

### Safety Rules
```typescript
// Consent required for romance
if (romance_flags.consent_required && relationship.consent !== 'yes') {
  return { allowed: false, reason: 'Consent not given' };
}

// Trust level check
if (relationship.trust < romance_flags.min_trust) {
  return { allowed: false, reason: 'Trust level too low' };
}

// Cooldown enforcement
if (recentRomanceActs.length > 0 && timeSinceLastAct < cooldownTurns) {
  return { allowed: false, reason: 'Cooldown active' };
}
```

## Assembler Integration

### Dialogue Slice
```json
{
  "conv": "conv.kiera.intro",
  "speaker_queue": ["npc.kiera", "player"],
  "candidates": [
    {
      "id": "line.kiera.greeting",
      "syn": "Warm greeting by the glade.",
      "emotion": ["warm", "curious"]
    }
  ],
  "arc": {
    "id": "arc.kiera.trust",
    "state": "active",
    "step": "earn_trust"
  },
  "emotions": {
    "npc.kiera": ["warm", "curious"]
  }
}
```

### Token Management
- **Hard Cap**: ≤ 220 tokens for dialogue slice
- **Trimming**: Drop lowest-score candidates first
- **Synopsis Limit**: ≤ 80 characters per candidate
- **Emotion Limit**: ≤ 4 emotions per speaker

## Validator Updates

### Module Gates
- **dialogue="off"**: Disable dialogue system
- **dialogue="readonly"**: Read-only mode
- **dialogue="full"**: Full functionality

### Act Limits
- **DIALOGUE_* acts**: ≤ 3 per turn
- **ARC_* acts**: ≤ 2 per turn
- **ROMANCE_*/BOUNDARY_* acts**: ≤ 1 per turn

### Safety Validation
- **Explicit Content**: No sexual explicit text in any field
- **Consent Gates**: Required before romance progression
- **Cooldown Enforcement**: Prevents rapid progression
- **Speaker Validation**: Valid speaker IDs only

## Authoring & IDE

### Dialogue Graph Editor
- **Node/Edge Canvas**: Visual graph editing
- **Inline JSON Inspector**: Monaco editor with schema
- **Emotion Picker**: Tag list for emotions
- **Guard Builder**: Relationship/quest/sim guards
- **Live Lints**: Real-time validation

### Arc Editor
- **Step List**: Manage arc steps
- **Guard Configuration**: Set step requirements
- **Romance Rules**: Configure romance settings
- **Cooldown Settings**: Set timing constraints

### Linter Integration
- **Node/Edge Validity**: Check graph structure
- **Synopsis Length**: ≤ 80 characters
- **Emotion Tags**: ≤ 4 per node
- **Branch Coverage**: Every branch has valid edges
- **Romance Gates**: Required for romance content
- **i18n Overlays**: Localization support

## Configuration

### Environment Variables
```bash
AWF_DIALOGUE_MODULE=full                    # off|readonly|full
AWF_DIALOGUE_MAX_TOKENS=220                 # Token limit for dialogue slice
AWF_DIALOGUE_MAX_CANDIDATES=3               # Max candidate lines
AWF_ROMANCE_ENABLED=true                    # Enable romance system
AWF_ROMANCE_MIN_TRUST=65                    # Minimum trust for romance
AWF_ROMANCE_COOLDOWN_TURNS=3                # Cooldown between romance scenes
AWF_SAFETY_EXPLICIT_BLOCK=true              # Block explicit content
```

### Module Configuration
```json
{
  "module_mode": "full",
  "max_tokens": 220,
  "max_candidates": 3,
  "romance_enabled": true,
  "romance_min_trust": 65,
  "romance_cooldown_turns": 3,
  "safety_explicit_block": true
}
```

## Testing

### Unit Tests
- **Dialogue Scoring**: Deterministic line selection with fixed seeds
- **Cooldown Enforcement**: Prevents repeat lines
- **Reaction Menus**: Agency conflict handling
- **Arc Transitions**: State machine validation
- **Romance Safety**: Consent and boundary enforcement

### Integration Tests
- **Conversation Flow**: 5-8 turn dialogue sequences
- **Arc Progression**: Start → progress → complete
- **Interrupt Handling**: Player actions and world events
- **i18n Integration**: Localization overlay application
- **Token Management**: Cap enforcement and trimming

### Performance Tests
- **Candidate Scoring**: ≤ 3ms average
- **Dialogue Slice Assembly**: ≤ 1ms average
- **Token Calculation**: Efficient counting
- **Memory Usage**: Minimal overhead

## Observability

### Metrics
- **awf.dialogue.candidates**: Candidate line count
- **awf.dialogue.selected**: Selected line count
- **awf.dialogue.interrupts**: Interrupt handling count
- **awf.arcs.state_changes**: Arc state transitions
- **awf.romance.consent_set**: Consent changes
- **awf.romance.cooldown_blocks**: Cooldown blocks
- **awf.dialogue.tokens_injected**: Token usage
- **awf.dialogue.trimmed_candidates**: Trimming events

### Logging
- **Chosen Node ID**: Selected dialogue node
- **Reason Scores**: Scoring breakdown
- **Trimmed Nodes**: Dropped candidates
- **Romance/Safety Blocks**: Safety enforcement
- **No Sensitive Text**: IDs only, no content

## Best Practices

### Dialogue Authoring
- **Keep Synopses Concise**: ≤ 80 characters
- **Use Emotion Tags Sparingly**: ≤ 4 per node
- **Avoid Explicit Content**: Use fade-to-black
- **Test Cooldowns**: Ensure reasonable timing
- **Validate Guards**: Check all conditions

### Arc Design
- **Clear Progression**: Logical step sequence
- **Appropriate Guards**: Reasonable requirements
- **Romance Boundaries**: Clear consent gates
- **Cooldown Management**: Prevent rapid progression
- **Epilogue Hooks**: Meaningful conclusions

### Safety Considerations
- **Consent First**: Always check consent
- **Respect Boundaries**: Honor established limits
- **Fade-to-Black**: Use for intimate scenes
- **Cooldown Enforcement**: Prevent rapid progression
- **Content Validation**: No explicit material

## Troubleshooting

### Common Issues
- **Token Overruns**: Check synopsis length and candidate count
- **Cooldown Blocks**: Verify timing and recent acts
- **Consent Issues**: Check consent state and boundaries
- **Guard Failures**: Verify guard conditions
- **Arc Stuck**: Check state machine transitions

### Performance Problems
- **Slow Scoring**: Check personality weights
- **Memory Usage**: Verify candidate limits
- **Token Calculation**: Optimize counting
- **Database Queries**: Check indexing

### Safety Issues
- **Explicit Content**: Use content validation
- **Consent Violations**: Check consent gates
- **Boundary Crossings**: Verify boundary enforcement
- **Cooldown Bypass**: Check cooldown logic

## Migration Guide

### From Phase 20
- **Authoring IDE**: Extend with dialogue/arc editors
- **WorldBuilder API**: Add dialogue/arc endpoints
- **Validators Hub**: Include dialogue validators
- **Preview Assembler**: Add dialogue slice assembly

### Database Migration
```sql
-- Run migration script
\i supabase/migrations/20250127_awf_dialogue_arcs.sql

-- Verify tables created
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('dialogue_graphs', 'story_arcs', 'dialogue_config');

-- Check game_states extensions
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'game_states' 
AND column_name IN ('dialogue', 'relationships');
```

### Configuration Update
```bash
# Add to .env.example
AWF_DIALOGUE_MODULE=full
AWF_DIALOGUE_MAX_TOKENS=220
AWF_DIALOGUE_MAX_CANDIDATES=3
AWF_ROMANCE_ENABLED=true
AWF_ROMANCE_MIN_TRUST=65
AWF_ROMANCE_COOLDOWN_TURNS=3
AWF_SAFETY_EXPLICIT_BLOCK=true
```

## Future Enhancements

### Planned Features
- **Real-Time Collaboration**: Multi-user dialogue editing
- **Advanced AI Integration**: LLM-powered dialogue generation
- **Voice Acting Support**: Audio file integration
- **Emotion Recognition**: Player emotion detection

### Integration Opportunities
- **External Editors**: Support for external dialogue tools
- **Version Control**: Git-based dialogue versioning
- **Analytics**: Dialogue usage and effectiveness metrics
- **A/B Testing**: Dialogue variant testing

## Conclusion

Phase 21 provides a comprehensive dialogue system with deterministic line selection, story arcs, romance rails, and safety features. The system integrates seamlessly with existing phases while maintaining strict safety and consent requirements. The authoring tools and validation ensure high-quality dialogue content while the performance optimizations keep the system responsive and efficient.


