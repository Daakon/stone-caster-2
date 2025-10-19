# Phase 22: Mod System & Procedural Hooks

## Overview

Phase 22 introduces a deterministic, sandboxed mod system that allows external/world-pack authors to extend content safely through procedural event hooks. The system provides namespace isolation, hot-loadable modules, a comprehensive hook bus, strict validation/quotas, and token-efficient context exposure.

## Key Features

### Namespaced Mod Packs
- **Namespace Isolation**: Each mod pack operates in its own namespace with isolated IDs and RNG seeds
- **Manifest System**: JSON-based manifest with version, compatibility, declared hooks, and content references
- **Hot-Loading**: Mod packs can be installed, enabled, disabled, and upgraded without server restart
- **Certification**: Optional certification pipeline for production-ready mods

### Procedural Hook Bus
- **Turn Hooks**: `onTurnStart`, `onAssemble`, `onBeforeInfer`, `onAfterInfer`, `onApplyActs`, `onTurnEnd`
- **Graph Hooks**: `onNodeEnter`, `onNodeExit`
- **World Sim Hooks**: `onWeatherChange`, `onRegionDrift`, `onEventTrigger`
- **Party Hooks**: `onRecruit`, `onDismiss`
- **Economy Hooks**: `onLootRoll`, `onVendorRefresh`, `onCraftResult`

### Determinism & Safety
- **No User Code Execution**: Hooks are data-driven rules and DSL expressions
- **Safe DSL Interpreter**: Bounded operations, no loops, deterministic evaluation
- **Seeded RNG**: Stable outcomes using `${namespace}:${session_id}:${turn_id}:${hook_id}`
- **Quota Enforcement**: Per-turn limits on hooks, acts, and tokens

### Token Efficiency
- **Micro-Slices**: Mods can request specific game state slices
- **Token Caps**: Per-namespace and global token limits with automatic trimming
- **Priority System**: Lower-priority slices are trimmed first when limits are exceeded

## Database Schema

### Mod Packs Table
```sql
CREATE TABLE mod_packs (
  namespace TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'installed',
  manifest JSONB NOT NULL,
  hash TEXT NOT NULL,
  certified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Mod Hooks Table
```sql
CREATE TABLE mod_hooks (
  namespace TEXT NOT NULL REFERENCES mod_packs(namespace),
  hook_id TEXT NOT NULL,
  hook_type TEXT NOT NULL,
  doc JSONB NOT NULL,
  hash TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (namespace, hook_id)
);
```

### Mod Quarantine Table
```sql
CREATE TABLE mod_quarantine (
  namespace TEXT NOT NULL REFERENCES mod_packs(namespace),
  reason TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (namespace)
);
```

### Mod Metrics Table
```sql
CREATE TABLE mod_metrics (
  namespace TEXT NOT NULL REFERENCES mod_packs(namespace),
  hook_id TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  value NUMERIC NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (namespace, hook_id, metric_type, timestamp)
);
```

## API Reference

### Mod Packs Service
```typescript
class ModPacksService {
  async installModPack(zipBuffer: Buffer, adminUserId: string): Promise<InstallResult>
  async enableModPack(namespace: string, adminUserId: string): Promise<ActionResult>
  async disableModPack(namespace: string, adminUserId: string): Promise<ActionResult>
  async quarantineModPack(namespace: string, reason: string, details: any, adminUserId: string): Promise<ActionResult>
  async certifyModPack(namespace: string, adminUserId: string): Promise<ActionResult>
  async getEnabledModPacks(): Promise<ModPack[]>
  async getModHooks(hookType: string): Promise<ModHook[]>
  async recordMetrics(namespace: string, hookId: string, metricType: string, value: number): Promise<void>
  async validateModPack(namespace: string): Promise<ValidationResult>
}
```

### Hook Bus
```typescript
class HookBus {
  async runHooks(hookType: HookType, context: HookContext): Promise<HookResult[]>
  getMetrics(): Map<string, HookMetrics>
  clearMetrics(): void
}
```

### DSL Interpreter
```typescript
class DSLInterpreter {
  async evaluateGuard(guard: GuardExpression, context: DSLContext): Promise<GuardResult>
  evaluateProbability(expression: string, context: DSLContext): number
  seededRandom(seed: string, max: number): number
  validateExpression(expression: string): ValidationResult
  getComplexityScore(expression: string): number
}
```

### Assembler Integration
```typescript
class AssemblerModIntegration {
  async processAssembleHooks(sessionId: string, turnId: number, gameState: any, baseSlices: Record<string, any>): Promise<AssemblerModResult>
  validateSliceRequests(requests: SliceRequest[]): ValidationResult
  getModContextForBundle(modContext: Record<string, ModContext>): Record<string, any>
}
```

### Orchestrator Integration
```typescript
class OrchestratorModIntegration {
  async runTurnHooks(context: OrchestratorContext): Promise<TurnHookResult>
  async runGraphHooks(context: OrchestratorContext, nodeId: string, action: 'enter' | 'exit'): Promise<any[]>
  async runWorldSimHooks(context: OrchestratorContext, eventType: string, eventData: any): Promise<any[]>
  async runPartyHooks(context: OrchestratorContext, action: 'recruit' | 'dismiss', characterData: any): Promise<any[]>
  async runEconomyHooks(context: OrchestratorContext, eventType: string, eventData: any): Promise<any[]>
  async processAssembleHooks(context: OrchestratorContext, baseSlices: Record<string, any>): Promise<AssembleResult>
  async isModSystemEnabled(): Promise<boolean>
  async getModSystemMetrics(): Promise<ModSystemMetrics>
}
```

## Authoring Guide

### Mod Pack Manifest
```json
{
  "namespace": "author.mystika_additions",
  "version": "1.0.0",
  "awf_core": ">=1.12.0",
  "declares": {
    "hooks": ["onTurnStart", "onNodeEnter", "onLootRoll"],
    "slices": ["sim.weather", "hot.objectives", "warm.relationships"]
  },
  "permissions": {
    "acts": ["OBJECTIVE_UPDATE", "RESOURCE_DELTA", "ITEM_ADD", "APPLY_STATUS"],
    "perTurnActsMax": 3,
    "requiresCertification": true
  }
}
```

### Hook Definition
```json
{
  "hook_id": "weather_bonus_foragers",
  "type": "onTurnStart",
  "guards": [
    {"path": "sim.weather.state", "op": "eq", "val": "rain"},
    {"path": "party.members.*.tags", "op": "has", "val": "forager"}
  ],
  "prob": "seeded(0.35)",
  "effects": [
    {"act": "RESOURCE_DELTA", "key": "energy", "delta": -1, "clamp": "soft"},
    {"act": "ITEM_ADD", "target": "player", "id": "itm.healing_leaf", "qty": 1}
  ]
}
```

### Guard Operations
- `eq`: Equal to
- `ne`: Not equal to
- `gt`: Greater than
- `gte`: Greater than or equal to
- `lt`: Less than
- `lte`: Less than or equal to
- `has`: Has property or contains value
- `contains`: Contains substring
- `in`: Value is in array
- `not_in`: Value is not in array

### Probability Expressions
- `seeded(0.5)`: Seeded random with 50% probability
- `0.25`: Fixed 25% probability
- `1.0`: Always trigger (100% probability)

### Allowed Acts
- `OBJECTIVE_UPDATE`: Update quest objectives
- `RESOURCE_DELTA`: Modify character resources
- `ITEM_ADD`: Add items to inventory
- `ITEM_REMOVE`: Remove items from inventory
- `APPLY_STATUS`: Apply status effects
- `REMOVE_STATUS`: Remove status effects
- `REQUEST_SLICE`: Request additional game state slices

## Safety Policies

### Content Safety
- **No Explicit Content**: All hooks are scanned for explicit sexual content
- **No Dangerous Patterns**: Blocked patterns include `eval()`, `Function()`, `setTimeout()`, etc.
- **Bounded Operations**: DSL interpreter has operation and depth limits
- **Seeded Random**: All random operations use deterministic seeds

### Quota Enforcement
- **Per-Turn Limits**: Maximum hooks, acts, and tokens per turn
- **Namespace Limits**: Per-namespace token caps with automatic trimming
- **Global Limits**: Overall system limits to prevent resource exhaustion
- **Violation Tracking**: Automatic quarantine when thresholds are exceeded

### Certification Requirements
- **Score Threshold**: Minimum 80% score for certification
- **Test Coverage**: All tests must pass
- **Safety Checks**: No explicit content or dangerous patterns
- **Performance**: Must meet execution time limits

## Configuration

### Environment Variables
```bash
AWF_MODS_ENABLED=true
AWF_MODS_MAX_HOOKS_PER_TURN=12
AWF_MODS_MAX_ACTS_PER_TURN=6
AWF_MODS_MAX_NAMESPACE_TOKENS=80
AWF_MODS_MAX_GLOBAL_TOKENS=200
AWF_MODS_MAX_EVAL_MS=15
AWF_MODS_QUARANTINE_THRESHOLD=5
AWF_MODS_CERT_REQUIRED=true
```

### Mod Configuration Table
```sql
CREATE TABLE mod_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  mods_enabled BOOLEAN DEFAULT true,
  max_hooks_per_turn INTEGER DEFAULT 12,
  max_acts_per_turn INTEGER DEFAULT 6,
  max_namespace_tokens INTEGER DEFAULT 80,
  max_global_tokens INTEGER DEFAULT 200,
  max_eval_ms INTEGER DEFAULT 15,
  quarantine_threshold INTEGER DEFAULT 5,
  cert_required BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Admin API Routes

### Mod Management
- `POST /api/awf-mods/install` - Install mod pack
- `POST /api/awf-mods/enable` - Enable mod pack
- `POST /api/awf-mods/disable` - Disable mod pack
- `POST /api/awf-mods/certify` - Certify mod pack
- `POST /api/awf-mods/quarantine` - Quarantine mod pack

### Mod Information
- `GET /api/awf-mods/packs` - List all mod packs
- `GET /api/awf-mods/packs/:namespace` - Get mod pack details
- `GET /api/awf-mods/metrics/:namespace` - Get mod metrics
- `GET /api/awf-mods/config` - Get mod configuration
- `PUT /api/awf-mods/config` - Update mod configuration

### Validation & Testing
- `POST /api/awf-mods/validate/:namespace` - Validate mod pack
- `GET /api/awf-mods/hooks/metrics` - Get hook metrics
- `POST /api/awf-mods/hooks/clear-metrics` - Clear hook metrics

## Linting & Certification

### Mod Linter
```bash
# Lint mod pack
yarn awf:mods:lint --namespace=author.mystika_additions

# Certify mod pack
yarn awf:mods:certify --namespace=author.mystika_additions
```

### Lint Checks
- **Manifest Validation**: Schema compliance and format validation
- **Hook Validation**: Guard expressions, probability expressions, and effects
- **Safety Checks**: Explicit content detection and dangerous pattern detection
- **Performance Checks**: Complexity scoring and execution time estimation
- **Reference Validation**: Hook types, slice paths, and act permissions

### Certification Pipeline
1. **Lint Validation**: Run all lint checks
2. **Test Execution**: Run mod tests with various scenarios
3. **Performance Testing**: Measure execution time and resource usage
4. **Safety Verification**: Confirm no explicit content or dangerous patterns
5. **Score Calculation**: Calculate overall certification score
6. **Certification Decision**: Approve or reject based on score and test results

## Troubleshooting

### Common Issues

#### Mod Installation Fails
- **Cause**: Invalid manifest or incompatible AWF core version
- **Solution**: Check manifest schema and AWF core compatibility

#### Hook Execution Fails
- **Cause**: Invalid guard expressions or probability expressions
- **Solution**: Validate DSL expressions and check for dangerous patterns

#### Token Limits Exceeded
- **Cause**: Mod requesting too many slices or large data
- **Solution**: Optimize slice requests and reduce data size

#### Mod Quarantined
- **Cause**: Violation threshold exceeded or explicit content detected
- **Solution**: Review mod content and fix violations

### Debug Commands
```bash
# Check mod system status
yarn awf:mods:status

# View mod metrics
yarn awf:mods:metrics --namespace=author.mystika_additions

# Test mod execution
yarn awf:mods:test --namespace=author.mystika_additions

# Clear mod cache
yarn awf:mods:clear-cache
```

### Log Analysis
- **Hook Execution**: Check for execution errors and performance issues
- **Violation Tracking**: Monitor violation counts and quarantine triggers
- **Token Usage**: Track token consumption and trimming events
- **Metrics Collection**: Analyze hook performance and act generation

## Performance Considerations

### Optimization Tips
- **Minimize Slice Requests**: Only request necessary game state slices
- **Optimize Guard Expressions**: Use simple, efficient guard conditions
- **Limit Effect Complexity**: Keep hook effects simple and focused
- **Use Priority System**: Set appropriate priorities for slice trimming

### Monitoring
- **Execution Time**: Monitor hook execution time and identify slow hooks
- **Token Usage**: Track token consumption and trimming frequency
- **Act Generation**: Monitor act generation rates and patterns
- **Violation Rates**: Track violation frequency and quarantine events

### Scaling
- **Hook Limits**: Adjust per-turn hook limits based on server capacity
- **Token Limits**: Balance token limits between functionality and performance
- **Namespace Isolation**: Ensure proper namespace isolation to prevent conflicts
- **Resource Management**: Monitor overall system resource usage

## Migration Guide

### From Phase 21 to Phase 22
1. **Database Migration**: Run the mod system migration
2. **Configuration Update**: Update environment variables
3. **Admin Setup**: Configure admin routes and permissions
4. **Testing**: Run comprehensive tests to ensure system stability

### Backward Compatibility
- **Existing Systems**: All existing systems continue to work unchanged
- **Player UI**: No changes to player-facing UI
- **API Compatibility**: All existing APIs remain functional
- **Data Integrity**: No impact on existing game data

### Rollback Plan
1. **Disable Mod System**: Set `AWF_MODS_ENABLED=false`
2. **Remove Mod Packs**: Uninstall all mod packs
3. **Database Rollback**: Run down migration if needed
4. **Configuration Reset**: Reset to pre-mod configuration

## Security Considerations

### Access Control
- **Admin Only**: Mod management restricted to admin users
- **RLS Policies**: Row-level security for all mod tables
- **Audit Logging**: All mod operations are logged for audit

### Content Safety
- **Explicit Content**: Automatic detection and blocking
- **Dangerous Patterns**: Blocked execution patterns
- **Resource Limits**: Strict quotas to prevent abuse
- **Quarantine System**: Automatic isolation of problematic mods

### Data Protection
- **Namespace Isolation**: Complete isolation between mod namespaces
- **Seeded Random**: Deterministic but isolated random generation
- **Token Limits**: Prevent excessive resource consumption
- **Violation Tracking**: Monitor and respond to security violations

## Future Enhancements

### Planned Features
- **Mod Marketplace**: Centralized mod distribution and discovery
- **Version Management**: Automatic mod updates and versioning
- **Dependency Resolution**: Mod dependency management
- **Performance Profiling**: Advanced performance monitoring and optimization

### Community Features
- **Mod Ratings**: Community rating and review system
- **Mod Categories**: Organized mod categorization and tagging
- **Mod Documentation**: Integrated documentation and help system
- **Mod Collaboration**: Multi-author mod development support

### Technical Improvements
- **Advanced DSL**: More sophisticated expression language
- **Hook Chaining**: Complex hook dependency chains
- **Real-time Updates**: Live mod updates without restart
- **Advanced Analytics**: Detailed mod usage and performance analytics
