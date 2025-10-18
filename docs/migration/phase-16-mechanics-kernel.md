# Phase 16: AWF Mechanics Kernel Implementation

## Overview

Phase 16 standardizes core mechanics behind the AWF runtime: a Skill Check engine, Conditions/Status system, and Balance & Simulation harness. All mechanics remain invisible to players (text stays narrative-only) while the model signals mechanics via acts. This provides deterministic, seeded mechanics for consistent gameplay.

## Features Implemented

### 1. Skill Check Engine

**Location**: `backend/src/mechanics/skill-checks.ts`

- **Deterministic Rolling**: Seeded checks with pluggable policies (2d6 bell, d20 linear, percent)
- **Input Support**: actor, skill, difficulty (0-100), modifiers[], advantage/disadvantage
- **Output Acts**: CHECK_RESULT with fields { id, skill, roll, total, threshold, outcome, margin }
- **Policy Support**: linear_d20, bell_2d6, percent_1d100, bell_3d6
- **Outcome Bands**: crit, success, mixed, fail, critfail with configurable margins

### 2. Conditions/Status System

**Location**: `backend/src/mechanics/conditions.ts`

- **Canonical Registry**: Standardized conditions (poisoned, stunned, bleeding, blessed, etc.)
- **Stacking Rules**: none, add, cap with configurable limits
- **Cleansing System**: Automatic condition removal based on cleanse keys
- **Per-Tick Hooks**: Resource deltas and other effects on TIME_ADVANCE
- **Status Storage**: Under game_state.hot.status[targetKey]

### 3. Resource Curves & Clamp Policies

**Location**: `backend/src/mechanics/resources.ts`

- **Standardized Resources**: hp, energy, mana, stress, favor, stamina with caps and floors
- **Clamp Policies**: soft (gentle pressure) and hard (strict bounds) clamping
- **Regen/Decay Curves**: Per-TIME_ADVANCE resource changes with diminishing returns
- **Resource Validation**: Bounds checking and value validation

### 4. Acts Integration

**Location**: `backend/src/mechanics/acts-integration.ts`

- **Extended Acts**: CHECK_RESULT, APPLY_STATUS, REMOVE_STATUS, TICK_STATUS, RESOURCE_DELTA
- **Validation**: Bounded act counts and field validation
- **Processing**: Mechanics acts processed in interpreter with state updates
- **Time Advance**: Automatic status ticking and resource curve application

### 5. Balance & Simulation Harness

**Location**: `backend/src/sim/sim-runner.ts`

- **Monte Carlo Testing**: Configurable encounter simulation with N trials
- **Input Analysis**: Skills distribution, difficulty, status presets, resource curves
- **Output Metrics**: Success rate, TTK (turns to KO), average resource burn, condition uptimes
- **Export Support**: CSV and JSON output for offline analysis
- **Reproducible Results**: Seeded random number generation

### 6. Admin & Authoring

**Location**: `backend/src/routes/awf-mechanics-admin.ts`

- **Skills Registry**: CRUD operations for skill definitions and baselines
- **Conditions Registry**: Stacking rules, cleanse keys, tick hooks management
- **Resources Registry**: Min/max values, regen/decay curves configuration
- **RBAC Security**: Admin-only access with proper authentication

### 7. Mechanics Linter

**Location**: `backend/scripts/awf-lint-mechanics.ts`

- **Registry Validation**: Skills, conditions, and resources consistency checks
- **Conflict Detection**: ID conflicts, circular dependencies, invalid references
- **Threshold Analysis**: Missing baselines, extreme values, balance issues
- **Comprehensive Reporting**: Errors, warnings, and suggestions

## Database Schema

### Tables Added

#### `mechanics_skills`
```sql
CREATE TABLE mechanics_skills (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    baseline INTEGER NOT NULL DEFAULT 10,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `mechanics_conditions`
```sql
CREATE TABLE mechanics_conditions (
    id TEXT PRIMARY KEY,
    stacking TEXT NOT NULL DEFAULT 'none' CHECK (stacking IN ('none', 'add', 'cap')),
    cap INTEGER,
    cleanse_keys TEXT[] DEFAULT '{}',
    tick_hooks JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `mechanics_resources`
```sql
CREATE TABLE mechanics_resources (
    id TEXT PRIMARY KEY,
    min_value INTEGER NOT NULL DEFAULT 0,
    max_value INTEGER NOT NULL DEFAULT 100,
    regen_per_tick DECIMAL(5,2) DEFAULT 0,
    decay_per_tick DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Game State Extension
```sql
-- Add status map to game_states if not present
ALTER TABLE game_states ADD COLUMN status JSONB DEFAULT '{}'::jsonb;
```

## Mechanics Design

### Skill Check System

#### Check Policies
```typescript
interface CheckPolicy {
  name: string;
  roll: (seed: number) => number;
  getOutcome: (total: number, threshold: number, margin: number) => string;
}
```

**Available Policies**:
- **linear_d20**: Linear distribution, 1-20 range
- **bell_2d6**: Bell curve distribution, 2-12 range
- **percent_1d100**: Percentile system, 1-100 range
- **bell_3d6**: Stronger bell curve, 3-18 range

#### Skill Check Context
```typescript
interface SkillCheckContext {
  actor: string;
  skill: string;
  difficulty: number; // 0-100
  modifiers: number[];
  advantage?: boolean;
  disadvantage?: boolean;
  sessionId: string;
  turnId: number;
  checkId: string;
}
```

#### Check Result
```typescript
interface SkillCheckResult {
  id: string;
  skill: string;
  roll: number;
  total: number;
  threshold: number;
  outcome: 'crit' | 'success' | 'mixed' | 'fail' | 'critfail';
  margin: number;
}
```

### Conditions System

#### Status Condition
```typescript
interface StatusCondition {
  id: string;
  stacking: 'none' | 'add' | 'cap';
  cap?: number;
  cleanseKeys: string[];
  tickHooks: {
    resourceDeltas?: Array<{
      key: string;
      delta: number;
    }>;
    [key: string]: any;
  };
}
```

#### Status Instance
```typescript
interface StatusInstance {
  conditionId: string;
  stacks: number;
  duration: number; // turns remaining
  potency?: number; // additional effect strength
  appliedAt: string;
}
```

#### Stacking Rules
- **none**: Only one instance allowed
- **add**: Additive stacking (unlimited)
- **cap**: Capped stacking with maximum limit

#### Cleansing System
- **Automatic Removal**: Conditions with cleanse keys are removed when conflicting conditions are applied
- **Circular Dependencies**: Detected and warned by linter
- **Override Behavior**: New conditions can override existing ones

### Resources System

#### Resource Definition
```typescript
interface ResourceDefinition {
  id: string;
  minValue: number;
  maxValue: number;
  regenPerTick: number;
  decayPerTick: number;
}
```

#### Clamp Policies
- **soft**: Gentle pressure toward bounds (allows temporary over/under)
- **hard**: Strict bounds enforcement (immediate clamping)

#### Resource Curves
- **Regeneration**: Diminishing returns as value approaches maximum
- **Decay**: Increasing rate as value moves away from minimum
- **Per-Tick Application**: Applied automatically on TIME_ADVANCE

## Acts System

### New Act Types

#### CHECK_RESULT
```typescript
{
  type: 'CHECK_RESULT';
  id: string;
  skill: string;
  roll: number;
  total: number;
  threshold: number;
  outcome: 'crit' | 'success' | 'mixed' | 'fail' | 'critfail';
  margin: number;
}
```

#### APPLY_STATUS
```typescript
{
  type: 'APPLY_STATUS';
  target: string;
  key: string;
  stacks?: number;
  duration?: number;
  potency?: number;
}
```

#### REMOVE_STATUS
```typescript
{
  type: 'REMOVE_STATUS';
  target: string;
  key: string;
}
```

#### TICK_STATUS
```typescript
{
  type: 'TICK_STATUS';
  target: string;
  key: string;
  stacks?: number;
  duration?: number;
  potency?: number;
}
```

#### RESOURCE_DELTA
```typescript
{
  type: 'RESOURCE_DELTA';
  key: string;
  delta: number;
  clamp?: 'soft' | 'hard';
}
```

### Act Processing

#### Validation
- **Field Validation**: Required fields checked for each act type
- **Count Limits**: Maximum acts per turn enforced
- **Type Safety**: TypeScript strict mode for all act definitions

#### Processing Flow
1. **Act Validation**: Check required fields and count limits
2. **State Updates**: Apply changes to game state
3. **New Acts**: Generate additional acts from hooks and effects
4. **Time Advance**: Process status ticking and resource curves

## Simulation System

### Configuration
```typescript
interface SimulationConfig {
  name: string;
  description: string;
  trials: number;
  seed: number;
  skills: {
    [skillId: string]: {
      baseline: number;
      modifiers: number[];
    };
  };
  difficulty: number;
  statusPresets: {
    [target: string]: {
      [conditionId: string]: {
        stacks: number;
        duration: number;
        potency?: number;
      };
    };
  };
  resources: {
    [resourceId: string]: number;
  };
  encounter: {
    maxTurns: number;
    winCondition: string;
    loseCondition: string;
  };
}
```

### Simulation Results
```typescript
interface SimulationResult {
  config: SimulationConfig;
  stats: {
    successRate: number;
    averageTurns: number;
    averageResources: Record<string, number>;
    conditionUptimes: Record<string, number>;
    skillCheckDistribution: Record<string, number>;
  };
  percentiles: {
    turns: { p50: number; p95: number; };
    resources: {
      [resourceId: string]: { p50: number; p95: number; };
    };
  };
  rawData: {
    trials: Array<{
      success: boolean;
      turns: number;
      resources: Record<string, number>;
      conditions: Record<string, number>;
      skillChecks: Record<string, number>;
    }>;
  };
}
```

### CLI Usage
```bash
# Run simulation
npm run awf:sim:encounter sims/whispercross_wolves.json --trials 5000 --seed 1337 --csv

# Export results
npm run awf:sim:encounter sims/test.json --output results --format json
```

## Admin Controls

### API Endpoints

#### Skills Management
```bash
# List skills
GET /api/admin/awf/mechanics/skills

# Create skill
POST /api/admin/awf/mechanics/skills
{
  "id": "strength",
  "description": "Physical power and muscle",
  "baseline": 10,
  "tags": ["physical", "combat"]
}

# Update skill
PUT /api/admin/awf/mechanics/skills/:id

# Delete skill
DELETE /api/admin/awf/mechanics/skills/:id
```

#### Conditions Management
```bash
# List conditions
GET /api/admin/awf/mechanics/conditions

# Create condition
POST /api/admin/awf/mechanics/conditions
{
  "id": "poisoned",
  "stacking": "add",
  "cap": 5,
  "cleanseKeys": ["antidote", "cure_poison"],
  "tickHooks": {
    "resourceDeltas": [{"key": "hp", "delta": -1}]
  }
}

# Update condition
PUT /api/admin/awf/mechanics/conditions/:id

# Delete condition
DELETE /api/admin/awf/mechanics/conditions/:id
```

#### Resources Management
```bash
# List resources
GET /api/admin/awf/mechanics/resources

# Create resource
POST /api/admin/awf/mechanics/resources
{
  "id": "hp",
  "minValue": 0,
  "maxValue": 100,
  "regenPerTick": 0,
  "decayPerTick": 0
}

# Update resource
PUT /api/admin/awf/mechanics/resources/:id

# Delete resource
DELETE /api/admin/awf/mechanics/resources/:id
```

## Mechanics Linter

### CLI Usage
```bash
# Lint all mechanics
npm run awf:lint:mechanics lint
```

### Lint Checks
1. **Registry Validation**: Skills, conditions, and resources consistency
2. **Conflict Detection**: ID conflicts, circular dependencies
3. **Threshold Analysis**: Missing baselines, extreme values
4. **Reference Validation**: Undefined resource references in conditions
5. **Balance Warnings**: Extreme values that may affect gameplay

### Lint Output
```
Mechanics Lint Results:
Valid: ❌

Errors:
  ❌ Duplicate skill ID: strength
  ❌ Condition poisoned: references undefined resource mana

Warnings:
  ⚠️  Skill dexterity: baseline 95 very high, may make checks too easy
  ⚠️  Resource hp: very large range (1000) may be difficult to balance

Suggestions:
  💡 Skill intelligence: consider adding tags for categorization
  💡 Resource energy: has both regen and decay - consider if this is intended
```

## Usage Examples

### 1. Skill Check

```typescript
import { skillCheckEngine } from '../mechanics/skill-checks.js';

const context: SkillCheckContext = {
  actor: 'player',
  skill: 'strength',
  difficulty: 15,
  modifiers: [2, 3],
  advantage: true,
  sessionId: 'session-123',
  turnId: 5,
  checkId: 'check-001',
};

const result = skillCheckEngine.rollCheck(context);
// result.outcome: 'crit' | 'success' | 'mixed' | 'fail' | 'critfail'
```

### 2. Status Application

```typescript
import { conditionsEngine } from '../mechanics/conditions.js';

// Apply poisoned status
const actions = conditionsEngine.applyStatus('player', 'poisoned', 2, 5, 1.5);

// Remove status
const removeActions = conditionsEngine.removeStatus('player', 'poisoned');

// Tick statuses on TIME_ADVANCE
const tickActions = conditionsEngine.tickStatuses(statusMap);
```

### 3. Resource Management

```typescript
import { resourcesEngine } from '../mechanics/resources.js';

// Apply resource delta
const result = resourcesEngine.applyResourceDelta(50, 'hp', 25, 'soft');

// Process resource curves on TIME_ADVANCE
const actions = resourcesEngine.processResourceCurves(resources);
```

### 4. Simulation

```typescript
import { simulationRunner } from '../sim/sim-runner.js';

const config: SimulationConfig = {
  name: 'Whispercross Wolves',
  description: 'Encounter with wolf pack',
  trials: 2000,
  seed: 1337,
  skills: {
    strength: { baseline: 10, modifiers: [2] },
    dexterity: { baseline: 12, modifiers: [1] },
  },
  difficulty: 15,
  statusPresets: {
    player: {
      blessed: { stacks: 1, duration: 5 },
    },
  },
  resources: {
    hp: 100,
    energy: 50,
    mana: 30,
  },
  encounter: {
    maxTurns: 10,
    winCondition: 'hp > 0',
    loseCondition: 'hp <= 0',
  },
};

const result = await simulationRunner.runSimulation(config);
console.log(`Success rate: ${result.stats.successRate * 100}%`);
```

### 5. Acts Integration

```typescript
import { mechanicsActsIntegration } from '../mechanics/acts-integration.js';

const acts: MechanicsAct[] = [
  {
    type: 'CHECK_RESULT',
    id: 'check-001',
    skill: 'strength',
    roll: 15,
    total: 18,
    threshold: 15,
    outcome: 'success',
    margin: 3,
  },
  {
    type: 'RESOURCE_DELTA',
    key: 'hp',
    delta: -5,
    clamp: 'soft',
  },
];

const context: MechanicsContext = {
  sessionId: 'session-123',
  turnId: 5,
  actor: 'player',
  gameState: {
    resources: { hp: 100, energy: 50 },
    status: {},
    flags: {},
    objectives: {},
  },
};

const result = await mechanicsActsIntegration.processMechanicsActs(acts, context);
```

## Integration with AWF Pipeline

### 1. Turn Orchestrator Integration

```typescript
// In turn orchestrator
const skillCheckResult = skillCheckEngine.rollCheck(context);
const checkAct = mechanicsActsIntegration.generateSkillCheckAct(context, skillCheckResult);

// Process mechanics acts
const result = await mechanicsActsIntegration.processMechanicsActs([checkAct], context);

// Apply to game state
gameState.resources = result.updatedGameState.resources;
gameState.status = result.updatedGameState.status;
```

### 2. Bundle Assembly Integration

```typescript
// In bundle assembler
const mechanicsActs = [
  // ... other acts
  ...result.newActs,
];

// Validate acts
const validation = mechanicsActsIntegration.validateMechanicsActs(mechanicsActs);
if (!validation.valid) {
  throw new Error(`Invalid mechanics acts: ${validation.errors.join(', ')}`);
}
```

### 3. Time Advance Processing

```typescript
// In time advance handler
const timeAdvanceActs = mechanicsActsIntegration.processTimeAdvance(gameState);
acts.push(...timeAdvanceActs);
```

## Security & Performance

### Security
- **Admin Access**: All mechanics management requires admin role
- **Input Validation**: Zod schemas for all mechanics data
- **RBAC Enforcement**: Proper authentication and authorization
- **Audit Logging**: All mechanics changes logged with timestamps

### Performance
- **Deterministic RNG**: Seeded random number generation for consistency
- **Efficient Processing**: Optimized algorithms for status ticking and resource curves
- **Token Budget**: Mechanics metadata limited to ≤ 200 tokens total
- **Caching**: Registry data cached for fast access

## Testing

### Unit Tests
- **Skill Checks**: Deterministic rolling, policy support, advantage/disadvantage
- **Conditions**: Status application, stacking rules, cleansing, per-tick hooks
- **Resources**: Delta application, clamping, regen/decay curves
- **Acts Integration**: Act processing, validation, time advance
- **Simulation**: Monte Carlo testing, result analysis, export functions

### Integration Tests
- **End-to-End Flow**: Skill check → status application → resource management
- **Deterministic Behavior**: Same inputs produce same outputs
- **Performance**: Efficient processing within time limits
- **Validation**: Comprehensive error handling and edge cases

### Performance Tests
- **Skill Checks**: < 100ms for 100 checks
- **Resource Processing**: < 100ms for 100 operations
- **Simulation**: < 1000ms for 1000 trials
- **Memory Usage**: Efficient memory management for large simulations

## Troubleshooting

### Common Issues

1. **Skill Check Failures**
   - Check skill baseline values
   - Verify difficulty settings
   - Review modifier calculations

2. **Status Application Issues**
   - Check condition registry
   - Verify stacking rules
   - Review cleanse key references

3. **Resource Management Issues**
   - Check resource definitions
   - Verify clamp policies
   - Review regen/decay curves

4. **Simulation Issues**
   - Check configuration validity
   - Verify win/lose conditions
   - Review trial count and seed

### Debug Commands

```bash
# Lint mechanics
npm run awf:lint:mechanics lint

# Run simulation
npm run awf:sim:encounter sims/test.json --trials 100 --verbose

# Check admin access
curl "http://localhost:3000/api/admin/awf/mechanics/skills"
```

## Future Enhancements

### Planned Features
1. **Advanced Policies**: Custom check policies for specific game modes
2. **Condition Templates**: Pre-configured condition sets for common scenarios
3. **Resource Curves**: More sophisticated regen/decay algorithms
4. **Simulation Analytics**: Integration with experiment tracking
5. **Visualization**: Admin UI for mechanics management and simulation results

### Scalability Considerations
1. **Registry Caching**: Redis-based caching for large registries
2. **Batch Processing**: Bulk operations for mechanics management
3. **Performance Monitoring**: Real-time mechanics metrics
4. **Data Archival**: Old simulation data cleanup

## Conclusion

Phase 16 provides comprehensive mechanics support for the AWF runtime with deterministic, seeded systems that enhance gameplay consistency while remaining invisible to players. The implementation is production-ready with proper security, performance, and monitoring considerations.

## Migration Notes

### Database Migration
The migration `20250125_awf_mechanics_kernel.sql` includes:
- All required tables and indexes
- RLS policies for admin access
- Helper functions for mechanics management
- Game state extension for status tracking

### Backward Compatibility
- No changes to existing AWF pipeline
- Mechanics system is opt-in per adventure
- All existing functionality preserved
- Graceful degradation when mechanics data unavailable

### Rollback Plan
1. Stop all mechanics processing
2. Run down migration to remove tables
3. Remove mechanics integration code
4. Clean up analytics metrics


