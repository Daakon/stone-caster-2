# Phase 18: Companions & Party System

## Overview

Phase 18 introduces a deterministic, token-efficient Companions & Party System on top of AWF. This system handles companion recruitment, party formation, shared inventory hooks, follower AI intents, and party-wide acts — all invisible to players with state changes via acts.

## Core Features

### Party Model
- **Leader**: Player character (always present)
- **Companions**: Active party members (max 4)
- **Reserve**: Inactive companions (max 6)
- **Marching Order**: Formation sequence for combat/exploration
- **Intents**: Per-companion AI behavior preferences

### Companion Lifecycle
- **Recruitment**: Based on trust, quest completion, world events
- **Dismissal**: Remove from party (temporary or permanent)
- **Reserve Management**: Auto-promote when party has space
- **Persistence**: Maintains state across sessions

### Follower AI Intents
- **Support**: Assist with skills and healing
- **Guard**: Protect party members
- **Scout**: Explore and gather information
- **Assist Skill**: Help with specific skill checks
- **Harass**: Aggressive tactics against enemies
- **Heal**: Focus on healing and support

## Data Model

### Companions Registry
```sql
CREATE TABLE companions_registry (
  id TEXT PRIMARY KEY,
  doc JSONB NOT NULL,
  hash TEXT NOT NULL,
  world_ref TEXT,
  adventure_ref TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Party State Extension
```json
{
  "leader": "player",
  "companions": ["npc.kiera", "npc.talan"],
  "reserve": [],
  "marching_order": ["player", "npc.kiera", "npc.talan"],
  "intents": {
    "npc.kiera": "support",
    "npc.talan": "scout"
  }
}
```

### Companion Schema
```json
{
  "id": "npc.kiera",
  "name": "Kiera",
  "role": "herbalist",
  "traits": ["healing", "nature", "wise"],
  "recruitment_conditions": {
    "trust_min": 30,
    "quests_completed": ["quest.herbal_garden"],
    "world_events": []
  },
  "join_banter": "banter.kiera.join",
  "leave_banter": "banter.kiera.leave",
  "party_rules": {
    "refuses_hard_difficulty": true,
    "trust_threshold": 50,
    "preferred_intent": "support"
  },
  "equipment_slots": {
    "main_hand": null,
    "off_hand": null,
    "armor": null,
    "accessory": null
  },
  "skill_baselines": {
    "healing": 60,
    "nature": 70,
    "survival": 45
  }
}
```

## New Acts

### Party Lifecycle Acts
- `PARTY_RECRUIT { npcId }` - Recruit companion to party
- `PARTY_DISMISS { npcId }` - Dismiss companion from party
- `PARTY_SWAP { a, b }` - Swap companions in marching order
- `PARTY_SET_FORMATION { order: string[] }` - Set party formation

### Intent Management Acts
- `PARTY_SET_INTENT { npcId, intent }` - Set companion intent
- `PARTY_DELEGATE_CHECK { npcId, skill, diff, mods?, mode? }` - Delegate skill check

### Item Management Acts
- `PARTY_PASS_ITEM { fromId, toId, itemId, qty }` - Pass item between members
- `PARTY_EQUIP { npcId, slot, itemId }` - Equip item on companion
- `PARTY_UNEQUIP { npcId, slot }` - Unequip item from companion

## Engines & Services

### Party Engine (`backend/src/party/party-engine.ts`)
- **Recruitment Logic**: Trust/quest/event requirements
- **Formation Management**: Marching order and swaps
- **Capacity Rules**: Max active (4), max reserve (6)
- **State Validation**: Ensure party consistency

### Intent Policy (`backend/src/policies/party-intent-policy.ts`)
- **Context Analysis**: Node type, difficulty, resources, pacing
- **Trait Integration**: Role and personality-based intent selection
- **Deterministic Selection**: Seeded RNG for consistent behavior
- **Auto-Updates**: Per-turn intent adjustments

### Acts Integration (`backend/src/party/party-acts-integration.ts`)
- **Act Processing**: Handle all party-related acts
- **Validation**: Ensure act parameters and limits
- **State Updates**: Modify party state atomically
- **Error Handling**: Graceful failure with clear messages

## Admin & Tooling

### Admin Routes (`backend/src/routes/awf-party-admin.ts`)
- `GET /api/admin/awf/companions` - List all companions
- `POST /api/admin/awf/companions` - Create companion
- `PUT /api/admin/awf/companions/:id` - Update companion
- `DELETE /api/admin/awf/companions/:id` - Delete companion
- `GET /api/admin/awf/party/:gameStateId` - Get party state
- `PUT /api/admin/awf/party/:gameStateId` - Update party state

### Party Linter (`backend/scripts/awf-lint-party.ts`)
- **Capacity Validation**: Check party size limits
- **Formation Sanity**: Validate marching order
- **Reference Checks**: Ensure companion IDs exist
- **Skill Validation**: Check skill baselines
- **Recruitment Logic**: Validate conditions

## Configuration

### Environment Variables
```bash
AWF_PARTY_MAX_ACTIVE=4
AWF_PARTY_MAX_RESERVE=6
AWF_PARTY_MAX_ACTS_PER_TURN=3
AWF_PARTY_DEFAULT_INTENT=support
AWF_PARTY_MODULE=full
```

### Module Modes
- **off**: Party system disabled
- **readonly**: View-only access to party state
- **full**: Complete party functionality

## Assembler Integration

### Token-Efficient Party Slice
```json
{
  "members": [
    {
      "id": "npc.kiera",
      "role": "herbalist",
      "summary": "wise healer",
      "weaponKey": "staff_healing"
    }
  ],
  "intents": {
    "npc.kiera": "support"
  },
  "caps": {
    "maxParty": 4,
    "maxReserve": 6
  }
}
```

### Token Limits
- **Party Slice**: ≤ 220 tokens
- **Member Summary**: ≤ 12 tokens per companion
- **Intent Descriptions**: Concise, action-oriented

## Quest Graph Integration

### Auto-Recruitment
```json
{
  "node_metadata": {
    "auto_recruit": ["npc.kiera"],
    "auto_part": ["npc.talan"]
  }
}
```

### Trust Thresholds
- **Recruitment**: Minimum trust required
- **Retention**: Trust level to maintain party membership
- **Difficulty Refusal**: Some companions refuse hard/extreme nodes

## Testing

### Unit Tests
- **Recruitment Logic**: Trust/quest/event requirements
- **Formation Management**: Swaps and order changes
- **Intent Selection**: Context-based AI decisions
- **Act Processing**: All party act types
- **Validation**: Party state consistency

### Integration Tests
- **Quest Graph Hooks**: Auto-recruit/auto-part
- **Inventory Integration**: Item passing and equipment
- **Skill Delegation**: Companion skill checks
- **State Persistence**: Cross-session party maintenance

### Performance Tests
- **Party Operations**: < 2ms average
- **Token Efficiency**: No inflation in assembler slice
- **Memory Usage**: Efficient state management

## Authoring Guide

### Companion Creation
1. **Define Role**: herbalist, scout, warrior, mage
2. **Set Traits**: personality and skill indicators
3. **Recruitment Conditions**: trust, quests, events
4. **Party Rules**: difficulty preferences, trust thresholds
5. **Skill Baselines**: combat, social, exploration skills

### Intent Policy
1. **Role-Based**: Each role has preferred intents
2. **Trait-Driven**: Personality influences behavior
3. **Context-Aware**: Node type and difficulty matter
4. **Resource-Sensitive**: Health/mana affect decisions
5. **Pacing-Responsive**: Fast/slow pacing changes tactics

### Quest Integration
1. **Auto-Recruit Lists**: NPCs that join automatically
2. **Auto-Part Lists**: NPCs that leave at specific nodes
3. **Trust Requirements**: Minimum levels for recruitment
4. **Difficulty Gates**: Some companions refuse hard content

## Troubleshooting

### Common Issues
- **Recruitment Failures**: Check trust, quests, events
- **Formation Errors**: Ensure all members in marching order
- **Intent Conflicts**: Validate intent against companion traits
- **Capacity Limits**: Check active/reserve party sizes

### Debug Tools
- **Party State Viewer**: Admin interface for current state
- **Companion Registry**: Browse available companions
- **Intent History**: Track companion behavior changes
- **Recruitment Log**: See why recruitment succeeded/failed

## Migration Notes

### Database Changes
- New `companions_registry` table
- Extended `game_states.party` JSONB column
- Added `npc_personalities.party_rules` column
- New `party_config` table for settings

### Backward Compatibility
- Existing game states get default party structure
- NPC personalities without party rules use defaults
- Old saves maintain party state across updates

### Performance Considerations
- Party state stored in hot JSONB for fast access
- Companion registry cached for quick lookups
- Intent policy uses deterministic RNG for consistency
- Token limits prevent assembler bloat

## Future Enhancements

### Planned Features
- **Companion Relationships**: Inter-companion dynamics
- **Advanced Formations**: Tactical positioning benefits
- **Group Skills**: Combined companion abilities
- **Party Quests**: Companion-specific storylines

### Integration Opportunities
- **Phase 19**: Advanced AI and decision trees
- **Phase 20**: Multiplayer party coordination
- **Phase 21**: Companion progression and growth
- **Phase 22**: Party-based world events

## Conclusion

Phase 18 provides a robust foundation for companion and party management while maintaining the narrative-first approach. The system is designed to be invisible to players while providing rich mechanical depth for the AWF runtime. All party operations are deterministic, token-efficient, and fully integrated with the existing AWF architecture.


