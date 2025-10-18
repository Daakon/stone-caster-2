# Phase 15: Quest Graph & Pacing Implementation

## Overview

Phase 15 formalizes adventure structure as a quest/beat graph, adds a pacing governor for difficulty and tempo management, and introduces soft-lock prevention to avoid narrative dead-ends. This improves consistency, reduces token usage by sending only active graph slices, and prevents player frustration.

## Features Implemented

### 1. Quest Graph Model

**Location**: `backend/src/graph/quest-graph-engine.ts`

- **DAG-like Structure**: Adventures represented as directed acyclic graphs of nodes and edges
- **Node Types**: beat, objective, gate, setpiece with specific behaviors
- **Entry Conditions**: Configurable preconditions for node entry
- **Success/Fail Outputs**: OBJECTIVE_UPDATE, FLAG_SET, RESOURCE_UPDATE actions
- **Compact Hints**: ≤ 120 character hints for player guidance
- **Scene Alignment**: Assembler selects minimal relevant slices

### 2. Pacing Governor

**Location**: `backend/src/pacing/pacing-governor.ts`

- **Tempo Control**: slow/normal/fast pacing based on turn cadence
- **Tension Management**: 0-100 tension scale based on success/failure
- **Difficulty Bands**: story/easy/normal/hard difficulty adjustment
- **Input Analysis**: Turn cadence, recent acts, resource deltas, NPC behavior
- **Analytics Integration**: Retry rate, fallback rate, latency heuristics
- **Deterministic Output**: Seeded RNG for consistent behavior

### 3. Soft-Lock Prevention

**Location**: `backend/src/recovery/soft-lock-prevention.ts`

- **Stuck Detection**: N turns without progress, invalid preconditions, resource depletion
- **Recovery Actions**: AUTO_HINT, RECOVERY, RESET actions
- **Hint Generation**: Contextual hints ≤ 120 characters
- **Severity Assessment**: low/medium/high stuck state severity
- **Token Budget**: Respects token limits for recovery actions

### 4. Admin & Authoring

**Location**: `backend/src/routes/awf-quest-graph-admin.ts`

- **Graph CRUD**: Create, read, update, delete quest graphs
- **Import/Export**: JSON/YAML import and export functionality
- **Graph Validation**: Structure validation with detailed error reporting
- **Node Analysis**: Dependency analysis and reachability checking
- **RBAC Security**: Admin-only access with proper authentication

### 5. Graph Linter

**Location**: `backend/scripts/awf-lint-graph.ts`

- **Cycle Detection**: Identifies and reports graph cycles
- **Reachability Analysis**: Finds unreachable nodes from start
- **Text Limit Checking**: Validates synopsis ≤ 160, hints ≤ 120
- **Objective Consistency**: Checks referenced vs defined objectives
- **Guard Validation**: Validates guard condition references

## Database Schema

### Tables Added

#### `quest_graphs`
```sql
CREATE TABLE quest_graphs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    adventure_ref TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0.0',
    doc JSONB NOT NULL DEFAULT '{}'::jsonb,
    hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(adventure_ref, version)
);
```

#### `quest_graph_indexes`
```sql
CREATE TABLE quest_graph_indexes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    graph_id UUID NOT NULL REFERENCES quest_graphs(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL,
    deps JSONB NOT NULL DEFAULT '[]'::jsonb,
    type TEXT NOT NULL,
    synopsis TEXT,
    hint TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Game State Extension
```sql
-- Add hot.graph pointer to game_states table
ALTER TABLE game_states ADD COLUMN graph JSONB DEFAULT '{}'::jsonb;
```

## Graph Schema

### Node Structure
```typescript
interface GraphNode {
  id: string;                    // Unique node identifier
  type: 'beat' | 'objective' | 'gate' | 'setpiece';
  synopsis: string;              // ≤ 160 characters
  enterIf?: Array<{              // Entry conditions
    flag?: string;
    objective?: string;
    resource?: string;
    op: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte';
    val: any;
  }>;
  onSuccess?: Array<{            // Success actions
    act: string;
    id?: string;
    key?: string;
    val?: any;
    status?: string;
  }>;
  onFail?: Array<{               // Failure actions
    act: string;
    id?: string;
    key?: string;
    val?: any;
    status?: string;
  }>;
  hint?: string;                 // ≤ 120 characters
}
```

### Edge Structure
```typescript
interface GraphEdge {
  from: string;                  // Source node ID
  to: string;                    // Target node ID
  guard?: Array<{                // Guard conditions
    objective?: string;
    flag?: string;
    resource?: string;
    op: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte';
    val: any;
  }>;
}
```

### Complete Graph Example
```json
{
  "graphId": "adv.whispercross.v1.g1",
  "start": "beat.intro",
  "nodes": [
    {
      "id": "beat.intro",
      "type": "beat",
      "synopsis": "Moonlit glade, first contact with Kiera.",
      "enterIf": [{"flag": "met_kiera", "op": "ne", "val": true}],
      "onSuccess": [{"act": "OBJECTIVE_UPDATE", "id": "meet_kiera", "status": "complete"}],
      "onFail": [{"act": "FLAG_SET", "key": "intro_failed", "val": true}],
      "hint": "Try a calm greeting or show a harmless token."
    },
    {
      "id": "beat.trust_test",
      "type": "objective",
      "synopsis": "Prove your worth to Kiera through actions.",
      "enterIf": [{"objective": "meet_kiera", "op": "eq", "val": "complete"}],
      "onSuccess": [{"act": "OBJECTIVE_UPDATE", "id": "gain_trust", "status": "complete"}],
      "onFail": [{"act": "FLAG_SET", "key": "trust_failed", "val": true}],
      "hint": "Show kindness or help others in need."
    }
  ],
  "edges": [
    {
      "from": "beat.intro",
      "to": "beat.trust_test",
      "guard": [{"objective": "meet_kiera", "op": "eq", "val": "complete"}]
    }
  ]
}
```

## Pacing Governor

### Input Analysis
```typescript
interface PacingInputs {
  turnCadence: number;           // Turns per minute
  recentActs: Array<{            // Recent player actions
    type: string;
    success: boolean;
    timestamp: string;
  }>;
  resourceDeltas: Record<string, number>;  // Resource changes
  npcBehaviorProfile: {          // From Phase 14
    tone: string;
    trustThreshold: number;
    riskTolerance: number;
  };
  analyticsHeuristics: {         // Analytics data
    retryRate: number;
    fallbackRate: number;
    avgLatency: number;
  };
  sessionId: string;
  turnId: number;
}
```

### Output State
```typescript
interface PacingState {
  tempo: 'slow' | 'normal' | 'fast';
  tension: number;               // 0-100
  difficulty: 'story' | 'easy' | 'normal' | 'hard';
  directive: string;             // ≤ 80 tokens
}
```

### Pacing Logic
- **Tempo**: Based on turn cadence, success rate, NPC engagement, player frustration
- **Tension**: Calculated from success rate, resource stability, NPC behavior, analytics
- **Difficulty**: Adjusted based on success rate, player frustration, NPC risk tolerance
- **Directive**: Generated based on tempo, tension, and difficulty state

## Soft-Lock Prevention

### Stuck State Detection
1. **No Progress**: N turns without objective progress
2. **Invalid Preconditions**: Current node requirements not met
3. **Resource Depletion**: Critical resources (health, mana, stamina) at 0
4. **Max Retries**: Retry counter exceeded
5. **Dead Ends**: No valid paths forward in graph

### Recovery Actions
- **AUTO_HINT**: Gentle guidance hints (≤ 120 chars)
- **RECOVERY**: Resource restoration actions
- **RESET**: Fresh start with retry counter reset

### Hint Generation
- **Gentle Guidance**: "Sometimes stepping back and looking at the bigger picture helps."
- **Resource Recovery**: "Your health is depleted. Look for ways to restore it."
- **Reset Guidance**: "You've tried this approach several times. Consider a completely different strategy."

## Admin Controls

### API Endpoints

#### List Quest Graphs
```bash
GET /api/admin/awf/graphs?adventureRef=whispercross
```

#### Create Quest Graph
```bash
POST /api/admin/awf/graphs
{
  "adventureRef": "whispercross",
  "version": "1.0.0",
  "graph": {
    "graphId": "adv.whispercross.v1.g1",
    "start": "beat.intro",
    "nodes": [...],
    "edges": [...]
  }
}
```

#### Update Quest Graph
```bash
PUT /api/admin/awf/graphs/:id
{
  "graph": {
    "graphId": "adv.whispercross.v1.g1",
    "start": "beat.intro",
    "nodes": [...],
    "edges": [...]
  }
}
```

#### Import Graph
```bash
POST /api/admin/awf/graphs/import
{
  "adventureRef": "whispercross",
  "version": "1.0.0",
  "graphData": {...}
}
```

#### Export Graph
```bash
GET /api/admin/awf/graphs/:id/export?format=json
GET /api/admin/awf/graphs/:id/export?format=yaml
```

#### Validate Graph
```bash
POST /api/admin/awf/graphs/:id/validate
```

#### Get Graph Analysis
```bash
GET /api/admin/awf/graphs/:id/analysis
```

## Graph Linter

### CLI Usage
```bash
# Lint graph from file
npm run awf:lint:graph lint path/to/graph.json

# Validate graph in database
npm run awf:lint:graph validate graph-id
```

### Lint Checks
1. **Cycles**: Detects and reports graph cycles
2. **Reachability**: Finds unreachable nodes from start
3. **Text Limits**: Validates synopsis ≤ 160, hints ≤ 120
4. **Objectives**: Checks referenced vs defined objectives
5. **Guards**: Validates guard condition references

### Lint Output
```
Graph Lint Results for graph.json:
Valid: ❌

Errors:
  ❌ Node beat.intro: synopsis too long (200 > 160)
  ❌ Cycles detected: beat.intro -> beat.trust_test -> beat.intro

Warnings:
  ⚠️  Unreachable nodes: beat.orphan
  ⚠️  Missing objectives: meet_kiera

Suggestions:
  💡 Consider shortening synopsis for node beat.intro
  💡 Consider breaking cycles by adding exit conditions
  💡 Consider adding paths to unreachable nodes or removing them
```

## Assembler Integration

### Graph Slice Embedding
```typescript
// In AWF bundle assembler
const graphSlice = questGraphEngine.generateGraphSlice(gameState, graph);

awfBundle.meta.graph = {
  activeNode: graphSlice.activeNode,
  frontier: graphSlice.frontier,
  hash: graphSlice.hash,
};

// Seed RNG with active node ID
awfBundle.meta.rng = {
  seed: activeNodeId,
  // ... other RNG config
};
```

### Token Budget Management
- **Active Node**: Current node synopsis (≤ 160 chars)
- **Frontier**: Neighbor nodes with minimal guard info
- **Hash Reference**: Graph integrity verification
- **Total Budget**: Graph slice ≤ 500 tokens

## Usage Examples

### 1. Create Quest Graph

```typescript
import { questGraphsRepo } from '../repos/quest-graphs-repo.js';

const graph: QuestGraph = {
  graphId: 'adv.whispercross.v1.g1',
  start: 'beat.intro',
  nodes: [
    {
      id: 'beat.intro',
      type: 'beat',
      synopsis: 'Moonlit glade, first contact with Kiera.',
      enterIf: [{ flag: 'met_kiera', op: 'ne', val: true }],
      onSuccess: [{ act: 'OBJECTIVE_UPDATE', id: 'meet_kiera', status: 'complete' }],
      onFail: [{ act: 'FLAG_SET', key: 'intro_failed', val: true }],
      hint: 'Try a calm greeting or show a harmless token.',
    },
  ],
  edges: [],
};

const graphRecord = await questGraphsRepo.createGraph(
  'whispercross',
  '1.0.0',
  graph
);
```

### 2. Select Active Node

```typescript
import { questGraphEngine } from '../graph/quest-graph-engine.js';

const gameState: GameState = {
  currentNodeId: 'beat.intro',
  visited: [],
  failures: [],
  retries: 0,
  flags: { met_kiera: false },
  objectives: {},
  resources: { health: 100, mana: 50 },
};

const activeNode = questGraphEngine.selectActiveNode(gameState, graph);
```

### 3. Compute Pacing State

```typescript
import { pacingGovernor } from '../pacing/pacing-governor.js';

const inputs: PacingInputs = {
  turnCadence: 3,
  recentActs: [
    { type: 'greet', success: true, timestamp: new Date().toISOString() },
  ],
  resourceDeltas: { health: 0, mana: -10, stamina: 5 },
  npcBehaviorProfile: {
    tone: 'friendly',
    trustThreshold: 60,
    riskTolerance: 70,
  },
  analyticsHeuristics: {
    retryRate: 0.1,
    fallbackRate: 0.05,
    avgLatency: 2000,
  },
  sessionId: 'session-123',
  turnId: 5,
};

const pacingState = pacingGovernor.computePacingState(inputs);
```

### 4. Detect Stuck State

```typescript
import { softLockPrevention } from '../recovery/soft-lock-prevention.js';

const stuckState = softLockPrevention.detectStuckState(
  gameState,
  graph,
  turnHistory,
  currentTurn
);

if (stuckState.isStuck) {
  const hints = softLockPrevention.generateRecoveryHints(stuckState, gameState);
  // Apply hints to AWF bundle
}
```

## Integration with AWF Pipeline

### 1. Turn Orchestrator Integration

```typescript
// In turn orchestrator
const activeNode = questGraphEngine.selectActiveNode(gameState, graph);
if (activeNode) {
  // Apply node to turn processing
  const graphSlice = questGraphEngine.generateGraphSlice(gameState, graph);
  awfBundle.meta.graph = graphSlice;
}

// Compute pacing state
const pacingState = pacingGovernor.computePacingState(inputs);
awfBundle.meta.pacing = pacingState;

// Check for stuck state
const stuckState = softLockPrevention.detectStuckState(gameState, graph, turnHistory, currentTurn);
if (stuckState.isStuck) {
  const hints = softLockPrevention.generateRecoveryHints(stuckState, gameState);
  awfBundle.meta.recovery = {
    hints: hints,
    actions: stuckState.recoveryActions,
  };
}
```

### 2. Bundle Assembly Integration

```typescript
// In bundle assembler
const graphSlice = questGraphEngine.generateGraphSlice(gameState, graph);
const pacingState = pacingGovernor.computePacingState(inputs);

awfBundle.meta = {
  ...awfBundle.meta,
  graph: graphSlice,
  pacing: pacingState,
  recovery: recoveryHints,
};
```

### 3. Analytics Integration

```typescript
// Track graph metrics
await trackGraphMetrics(sessionId, playerId, worldRef, adventureRef, locale, {
  activeNodeId: activeNode.id,
  pacingState: pacingState.tempo,
  stuckState: stuckState.isStuck,
  recoveryHints: hints.length,
});
```

## Security & Performance

### Security
- **Admin Access**: All graph management requires admin role
- **Input Validation**: Zod schemas for all graph data
- **RBAC Enforcement**: Proper authentication and authorization
- **Audit Logging**: All graph changes logged with timestamps

### Performance
- **Graph Indexing**: Precomputed indexes for fast node lookups
- **Deterministic RNG**: Seeded random number generation for consistency
- **Token Budget**: Strict limits on graph slice size
- **Efficient Queries**: Optimized database queries with proper indexes

## Testing

### Unit Tests
- **Graph Engine**: Node selection, neighbor computation, outcome application
- **Pacing Governor**: Tempo, tension, difficulty computation
- **Soft-Lock Prevention**: Stuck state detection, recovery hint generation
- **Graph Validation**: Structure validation, cycle detection, reachability

### Integration Tests
- **End-to-End Flow**: Graph selection → pacing → soft-lock prevention
- **Deterministic Behavior**: Same inputs produce same outputs
- **Token Budget**: Graph slices respect token limits
- **Performance**: Efficient computation within time limits

### Performance Tests
- **Pacing Computation**: < 100ms for 100 computations
- **Graph Selection**: < 50ms for complex graphs
- **Stuck Detection**: < 25ms for stuck state analysis

## Troubleshooting

### Common Issues

1. **Graph Validation Failures**
   - Check text length limits (synopsis ≤ 160, hints ≤ 120)
   - Verify node IDs are unique
   - Check for cycles in graph structure

2. **Pacing State Issues**
   - Verify input data completeness
   - Check analytics heuristics accuracy
   - Review NPC behavior profile data

3. **Soft-Lock Detection Issues**
   - Check turn history data quality
   - Verify resource state accuracy
   - Review stuck state thresholds

4. **Token Budget Exceeded**
   - Reduce graph slice size
   - Optimize node synopses
   - Limit frontier nodes

### Debug Commands

```bash
# Lint graph file
npm run awf:lint:graph lint path/to/graph.json

# Validate graph in database
npm run awf:lint:graph validate graph-id

# Check graph analysis
curl "http://localhost:3000/api/admin/awf/graphs/:id/analysis"
```

## Future Enhancements

### Planned Features
1. **Graph Templates**: Pre-configured graph patterns
2. **Dynamic Pacing**: Real-time pacing adjustment based on player behavior
3. **Advanced Recovery**: Machine learning-based stuck state detection
4. **Graph Visualization**: Admin UI for graph editing and visualization
5. **A/B Testing**: Graph variation experiments

### Scalability Considerations
1. **Graph Caching**: Redis-based graph caching
2. **Batch Processing**: Bulk graph operations
3. **Data Archival**: Old graph version cleanup
4. **Performance Monitoring**: Real-time graph metrics

## Conclusion

Phase 15 provides comprehensive quest graph management, pacing control, and soft-lock prevention capabilities that enhance the AWF runtime with structured narrative flow and player experience optimization. The implementation is production-ready with proper security, performance, and monitoring considerations.

## Migration Notes

### Database Migration
The migration `20250124_awf_quest_graphs.sql` includes:
- All required tables and indexes
- RLS policies for admin access
- Helper functions for graph management
- Game state extension for graph tracking

### Backward Compatibility
- No changes to existing AWF pipeline
- Graph system is opt-in per adventure
- All existing functionality preserved
- Graceful degradation when graph data unavailable

### Rollback Plan
1. Stop all graph-related processing
2. Run down migration to remove tables
3. Remove graph integration code
4. Clean up analytics metrics


