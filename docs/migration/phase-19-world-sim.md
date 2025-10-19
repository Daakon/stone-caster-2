# Phase 19: World Simulation & Timeflow

## Overview

Phase 19 introduces a lightweight but deterministic world simulation loop that advances in ticks/bands, drives ambient systems (NPC schedules, regions/events, weather), and surfaces compact, token-capped context to the model. This system integrates with earlier phases while remaining invisible to players.

## Core Features

### World Tick Engine
- **Deterministic Updates**: Keyed by (world_ref, band_id, day_index, seed)
- **No Wall-Clock Dependence**: Pure simulation time
- **Compact Deltas**: Region states, NPC schedules, weather, global flags
- **Background Processing**: Runs on each TIME_ADVANCE and admin fast-forward

### NPC Schedules
- **Authorable Schedule Blocks**: Location/time-band/intent per NPC
- **Exception Handling**: Events/quests override normal schedules
- **Personality Integration**: Small trait-driven variance within bounds
- **Schedule Resolver**: Returns where NPCs are and what they're doing

### Region & Event System
- **Region State**: Threat, prosperity, travel risk with per-tick drift
- **Event Templates**: Festival, market, patrol, storm_damage, beast_activity
- **Quest Graph Hooks**: Events can unlock/lock nodes or alter guards
- **Deterministic Triggers**: Based on guards and rarity weights

### Weather/Day-Night Integration
- **Weather Model**: Band-based transitions and fronts per region
- **Deterministic Seeds**: Ensure reproducibility across sessions
- **Compact Summary**: ≤ 40 tokens with effects via mechanics acts only
- **No Text Leakage**: Weather effects are pure mechanics

## Data Model

### World Regions
```sql
CREATE TABLE world_regions (
  id TEXT PRIMARY KEY,
  world_ref TEXT NOT NULL,
  doc JSONB NOT NULL,
  hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### World Events
```sql
CREATE TABLE world_events (
  id TEXT PRIMARY KEY,
  world_ref TEXT NOT NULL,
  doc JSONB NOT NULL,
  hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### NPC Schedules
```sql
CREATE TABLE npc_schedules (
  npc_id TEXT NOT NULL,
  world_ref TEXT NOT NULL,
  doc JSONB NOT NULL,
  hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (npc_id, world_ref)
);
```

### Simulation State Extension
```json
{
  "clock": { "day_index": 0, "band": "Dawn" },
  "weather": { "region": "region.forest_glade", "state": "clear", "front": "none" },
  "regions": {
    "region.forest_glade": {
      "prosperity": 60,
      "threat": 20,
      "travel_risk": 10,
      "last_event": "event.festival_herbal"
    }
  },
  "npcs": {
    "npc.kiera": {
      "current_location": "herbal_garden",
      "current_intent": "gather_herbs",
      "last_update": 1640995200000
    }
  }
}
```

## New Acts

### World Simulation Acts
- `WORLD_FLAG_SET { key, val }` - Set global world flags
- `REGION_DELTA { regionId, threatDelta?, prosperityDelta?, travelRiskDelta? }` - Modify region metrics
- `WEATHER_SET { regionId, state, front? }` - Change weather conditions
- `NPC_SCHEDULE_SET { npcId, band, loc, intent }` - Set NPC schedule (rare, usually preauthored)
- `EVENT_TRIGGER { eventId }` - Trigger event with pre-templated acts

### Act Validation
- **Mechanics Only**: No leakage into narrative text
- **Count Limits**: ≤ 4 sim acts per turn (excluding EVENT_TRIGGER expansions)
- **Module Gates**: Forbid sim acts if `worldsim="off"`
- **One TIME_ADVANCE**: Ensure only one TIME_ADVANCE remains in player turn

## Engines & Services

### World Tick Engine (`backend/src/sim/world-tick-engine.ts`)
- **Advancement Logic**: Roll weather, drift regions, evaluate events, resolve schedules
- **Deterministic Seeding**: `${worldRef}:${day_index}:${band}`
- **State Updates**: Apply deltas atomically
- **Error Handling**: Graceful failure with clear diagnostics

### NPC Schedule Resolver (`backend/src/sim/npc-schedule-resolver.ts`)
- **Schedule Merging**: Authored schedule + exceptions
- **Personality Variance**: Small adjustments based on Phase 14 traits
- **Context Awareness**: Weather, events, quests affect behavior
- **Compact Output**: `{ npcId, locKey, intent }` hints

### Region Event Engine (`backend/src/sim/region-event-engine.ts`)
- **Region Drift**: Bounded random walk based on author config
- **Event Evaluation**: Guards → rarity weight → deterministic sampling
- **Effect Expansion**: Map to AWF acts with proper validation
- **Active Event Tracking**: Duration and cleanup

### Weather Engine (`backend/src/sim/weather-engine.ts`)
- **Markov Chain Transitions**: Band-to-band weather changes
- **Zone-Based Models**: Different weather patterns per region type
- **Effect Generation**: Travel penalties, visibility, status effects
- **Deterministic Seeds**: Consistent weather progression

### Sim Assembler Integration (`backend/src/sim/sim-assembler-integration.ts`)
- **Token-Capped Assembly**: ≤ 260 tokens for entire sim block
- **Nearby Context Only**: Regions/NPCs near player/frontier nodes
- **Smart Trimming**: Drop farthest/lowest-salience items first
- **i18n Integration**: Respect Phase 12 overlays for display names

## Admin & Tooling

### Admin Routes (`backend/src/routes/awf-sim-admin.ts`)
- `POST /api/admin/awf/sim/fast-forward` - Fast forward N bands with dry-run support
- `GET /api/admin/awf/sim/preview` - Deterministic snapshot for specific day/band
- `GET /api/admin/awf/sim/state/:gameStateId` - Get current simulation state
- `PUT /api/admin/awf/sim/state/:gameStateId` - Update simulation state
- `GET /api/admin/awf/sim/config` - Get simulation configuration
- `PUT /api/admin/awf/sim/config` - Update simulation configuration

### CLI Tools
```bash
# Fast forward simulation
yarn awf:sim:fastforward --bands 12 --session <id> --dry

# Preview simulation state
yarn awf:sim:preview --world <ref> --day 5 --band Evening
```

### Sim Linter (`backend/scripts/awf-lint-sim.ts`)
- **Schedule Coverage**: No gaps across bands
- **Event Guards**: Reference valid flags/objectives
- **Region Drift**: Bounds validation
- **Weather Matrix**: Probabilities sum to 1
- **Token Caps**: Respect limits for summaries

## Configuration

### Environment Variables
```bash
AWF_WORLDSIM_MODULE=full                    # off|readonly|full
AWF_WORLDSIM_MAX_SIM_TOKENS=260            # Token limit for sim block
AWF_WORLDSIM_MAX_NEARBY_NPCS=4             # Max NPCs in sim block
AWF_WORLDSIM_MAX_NEARBY_REGIONS=3          # Max regions in sim block
AWF_WORLDSIM_EVENT_RATE=normal             # low|normal|high (multiplier)
AWF_WEATHER_TRANSITION="clear:0.7,overcast:0.2,rain:0.1"  # Default transition row
```

### Module Modes
- **off**: World simulation disabled
- **readonly**: View-only access to simulation state
- **full**: Complete simulation functionality

## Assembler Integration

### Token-Efficient Sim Block
```json
{
  "time": { "band": "Dawn", "day_index": 5 },
  "weather": { "current": "clear", "forecast": "clear skies" },
  "regions": [
    {
      "id": "region.forest_glade",
      "name": "Forest Glade",
      "prosperity": 60,
      "threat": 20,
      "status": "stable"
    }
  ],
  "npcs": [
    {
      "id": "npc.kiera",
      "location": "herbal_garden",
      "intent": "gather_herbs"
    }
  ]
}
```

### Token Limits
- **Sim Block**: ≤ 260 tokens total
- **Region Summary**: ≤ 12 tokens per region
- **NPC Summary**: ≤ 8 tokens per NPC
- **Weather Summary**: ≤ 10 tokens

## Authoring Guide

### Region Configuration
```json
{
  "id": "region.forest_glade",
  "name": "Forest Glade",
  "coords": [45.2, 12.8],
  "tags": ["forest", "safe", "herbal"],
  "base_prosperity": 60,
  "base_threat": 20,
  "base_travel_risk": 10,
  "drift_rules": {
    "prosperity": { "min": 40, "max": 80, "step": 2 },
    "threat": { "min": 10, "max": 40, "step": 1 },
    "travel_risk": { "min": 5, "max": 25, "step": 1 }
  },
  "weather_zone": "temperate",
  "nearby_regions": ["region.mountain_pass", "region.river_crossing"]
}
```

### Event Configuration
```json
{
  "id": "event.festival_herbal",
  "name": "Herbal Festival",
  "type": "festival",
  "guards": {
    "region_prosperity_min": 50,
    "band": ["Dawn", "Morning"],
    "rarity": 0.1
  },
  "trigger_window": {
    "start_day": 0,
    "end_day": 365,
    "frequency": "weekly"
  },
  "effects": [
    { "type": "REGION_DELTA", "regionId": "region.forest_glade", "prosperityDelta": 10 },
    { "type": "WORLD_FLAG_SET", "key": "festival_active", "val": true }
  ],
  "duration": 2,
  "rarity_weight": 10
}
```

### NPC Schedule Configuration
```json
{
  "npc_id": "npc.kiera",
  "world_ref": "world.forest_glade",
  "entries": [
    {
      "band": "Dawn",
      "location": "herbal_garden",
      "intent": "gather_herbs",
      "except": {
        "weather": ["storm"],
        "events": ["event.festival_herbal"]
      }
    }
  ],
  "behavior_variance": {
    "curiosity": 0.1,
    "caution": 0.05,
    "social": 0.15
  }
}
```

### Weather Zone Configuration
```json
{
  "name": "temperate",
  "base_states": ["clear", "overcast", "rain", "storm"],
  "transitions": [
    { "from": "clear", "to": "clear", "probability": 0.7 },
    { "from": "clear", "to": "overcast", "probability": 0.2 },
    { "from": "clear", "to": "rain", "probability": 0.1 }
  ]
}
```

## Integration with Earlier Phases

### Phase 14: NPC Personality
- **Trait-Driven Variance**: Small adjustments to schedule behavior
- **Trust Integration**: Affects NPC willingness to follow schedules
- **Mood Effects**: Influences intent selection within bounds

### Phase 15: Quest Graph
- **Node Guards**: Events can unlock/lock nodes
- **Auto-Recruit/Auto-Part**: NPCs join/leave based on events
- **Quest Flags**: Events can set quest-related flags

### Phase 16: Skill Checks
- **Weather Effects**: Storm conditions affect skill check difficulty
- **Region Effects**: High threat regions increase challenge
- **NPC Assistance**: Scheduled NPCs can provide skill bonuses

### Phase 17: Economy
- **Market Events**: Festival events affect vendor inventories
- **Resource Drift**: Weather affects resource availability
- **Trade Routes**: Region prosperity affects trade opportunities

### Phase 18: Party System
- **Companion Schedules**: Party members follow their own schedules
- **Group Activities**: Coordinated actions based on party formation
- **Shared Resources**: Weather affects entire party

## Performance Considerations

### Tick Engine Performance
- **Target**: < 6ms average with 3 regions + 4 nearby NPCs
- **Optimization**: Efficient RNG, cached lookups, minimal state copying
- **Scaling**: Linear with region/NPC count

### Token Efficiency
- **Assembler Trimming**: Smart dropping of low-salience items
- **Compact Summaries**: Ultra-short display names and descriptions
- **Context Awareness**: Only nearby/relevant information included

### Memory Management
- **State Cleanup**: Expired events and old schedule data
- **Efficient Storage**: JSONB for flexible but indexed queries
- **Caching**: Frequently accessed configuration data

## Testing

### Unit Tests
- **Determinism**: Same seeds → same weather/events/region drifts
- **Schedule Coverage**: All bands covered, exceptions honored
- **Event Guards**: Guard passing + rarity selection stable
- **Weather Transitions**: Matrix respected, effects → mechanics only

### Integration Tests
- **Turn Processing**: TIME_ADVANCE triggers world tick → acts applied atomically
- **Quest Integration**: Node guards toggled by event effects
- **Token Limits**: Sim block ≤ 260 tokens with correct trimming
- **Module Toggles**: worldsim=off|readonly behaves as expected

### Performance Tests
- **Tick Engine**: < 6ms average on CI
- **Token Assembly**: Efficient trimming and context selection
- **Memory Usage**: No leaks in long-running simulations

## Troubleshooting

### Common Issues
- **Determinism Failures**: Check seed generation and RNG usage
- **Token Overruns**: Verify trimming logic and context selection
- **Schedule Gaps**: Ensure all bands covered in NPC schedules
- **Event Loops**: Check for circular event dependencies

### Debug Tools
- **Simulation Preview**: Admin interface for deterministic snapshots
- **Fast Forward**: Test long-term simulation behavior
- **Linter Output**: Validate configuration consistency
- **Token Counter**: Verify assembler output within limits

## Migration Notes

### Database Changes
- New `world_regions`, `world_events`, `npc_schedules` tables
- Extended `game_states.sim` JSONB column
- New `world_sim_config` table for settings

### Backward Compatibility
- Existing game states get default simulation structure
- Old saves maintain simulation state across updates
- Module toggles allow gradual rollout

### Performance Impact
- Simulation state stored in hot JSONB for fast access
- Efficient indexing for region/event/NPC queries
- Minimal overhead when module disabled

## Future Enhancements

### Planned Features
- **Advanced Weather**: Seasonal patterns and climate zones
- **Economic Events**: Market crashes, trade route disruptions
- **Social Dynamics**: NPC relationships and faction conflicts
- **Environmental Storytelling**: Weather and events drive narrative

### Integration Opportunities
- **Phase 20**: Multiplayer simulation coordination
- **Phase 21**: Advanced AI and decision trees
- **Phase 22**: Dynamic world generation
- **Phase 23**: Persistent world changes

## Conclusion

Phase 19 provides a robust foundation for world simulation while maintaining the narrative-first approach. The system is designed to be invisible to players while providing rich mechanical depth for the AWF runtime. All simulation operations are deterministic, token-efficient, and fully integrated with the existing AWF architecture.

The world simulation system creates a living, breathing world that responds to player actions and drives ambient storytelling through weather, events, and NPC behavior — all while respecting strict token limits and maintaining deterministic behavior for consistent gameplay experiences.


