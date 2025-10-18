# Phase 28: LiveOps Remote Configuration System

## Overview

Phase 28 implements a comprehensive LiveOps (Live Operations) system that enables real-time tweaking of game balance, pacing, token budgets, and content parameters. The system provides safe, deterministic, and auditable remote configuration management without changing any player-facing UI.

## Key Features

### 🎛️ **Remote Config Hierarchy**
- **Hierarchical scopes**: global → world → adventure → experiment → session
- **Deterministic resolution**: Seeded by scope keys, no time-of-day dependence
- **Type-safe merging**: Last-writer-wins with bounds validation
- **Audit logging**: Full trail of changes and resolved configs

### 🔧 **LiveOps Levers (Typed)**
- **Token & Model**: Input/output caps, tool-call quota, model tier allowlist
- **Pacing & Difficulty**: Quest tempo, soft-lock hints, skill-check policies
- **Mechanics & Economy**: Drop rates, vendor margins, crafting quality
- **World Sim**: Event rates, weather volatility, region drift
- **Dialogue/Romance**: Candidate caps, cooldowns, consent strictness
- **Party**: Max members, delegate rates, intent mix bias
- **Module Gates**: Off/readonly/full for all subsystems

### 🎯 **Rollout & Targeting**
- **Targeting expressions**: Safe DSL for include/exclude rules
- **Scheduled changes**: Start/end windows with preview
- **Dry-run evaluation**: Impact estimation before deployment

### 🛡️ **Safety & Guardrails**
- **Strong validation**: Min/max bounds per lever
- **Kill-switches**: Global freeze capability
- **Shadow mode**: Evaluate without applying changes
- **Full audit logging**: All changes and resolutions tracked

### 📊 **Observability**
- **Metrics per lever**: Adoption %, error rate delta, latency impact
- **Dashboard integration**: "What changed?" diffs with before/after KPIs
- **Authoring IDE interop**: Read-only overlays in Preview Panel

## Architecture

### Database Schema

```sql
-- Main configs table
CREATE TABLE liveops_configs (
  config_id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  scope liveops_config_scope NOT NULL,
  scope_ref TEXT NOT NULL,
  status liveops_config_status NOT NULL,
  payload JSONB NOT NULL,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

-- Audit trail
CREATE TABLE liveops_audit (
  id UUID PRIMARY KEY,
  config_id UUID NOT NULL,
  action liveops_audit_action NOT NULL,
  actor UUID NOT NULL,
  diff JSONB,
  ts TIMESTAMPTZ NOT NULL
);

-- Sampled resolved configs
CREATE TABLE liveops_snapshots (
  id UUID PRIMARY KEY,
  session_id TEXT NOT NULL,
  turn_id INTEGER NOT NULL,
  resolved JSONB NOT NULL,
  ts TIMESTAMPTZ NOT NULL
);
```

### Core Components

#### 1. **Schema & Validation** (`backend/src/liveops/levers-schema.ts`)
- Zod schemas for all lever types with bounds validation
- Normalization and coercion (percentages, enums, durations)
- Type-safe config merging and diffing utilities

#### 2. **Config Resolver** (`backend/src/liveops/config-resolver.ts`)
- Deterministic resolution with scope precedence
- Memoized per (session_id, turn_id) for performance
- Structured explain output showing which levers applied from which scope

#### 3. **Safety Mechanisms** (`backend/src/liveops/safety-mechanisms.ts`)
- Bounds validation with critical/warning/error severity
- Dry-run impact estimation using autoplay simulation
- Kill-switch and shadow mode support

#### 4. **Integration Points** (`backend/src/liveops/integration-points.ts`)
- Wired into all game systems: assembler, pacing, mechanics, economy, dialogue
- Shadow mode logging without runtime changes
- Module gate enforcement

#### 5. **Admin API** (`backend/src/routes/awf-liveops.ts`)
- CRUD operations for configs with audit logging
- Preview and dry-run endpoints
- Cache management and status monitoring

#### 6. **Dashboard UI** (`frontend/src/pages/admin/LiveOpsPanel.tsx`)
- LiveOps panel in admin dashboard
- Configuration management interface
- Impact analysis and history views

## Configuration

### Environment Variables

```env
# LiveOps System
LIVEOPS_ENABLED=true
LIVEOPS_GLOBAL_FREEZE=false
LIVEOPS_DRYRUN_TURNS=50
LIVEOPS_PREVIEW_MAX_DOCS=50
LIVEOPS_RESOLVER_CACHE_TTL_MS=60000
LIVEOPS_BOUNDS_STRICT=true
```

### Lever Catalog & Bounds

#### Token & Model Levers
```typescript
AWF_MAX_INPUT_TOKENS: 1000-12000 (critical)
AWF_MAX_OUTPUT_TOKENS: 500-8000 (critical)
AWF_INPUT_TOKEN_MULTIPLIER: 0.1-2.0 (critical)
AWF_OUTPUT_TOKEN_MULTIPLIER: 0.1-2.0 (critical)
AWF_TOOL_CALL_QUOTA: 1-20
AWF_MOD_MICRO_SLICE_CAP: 100-2000
AWF_MODEL_TIER_ALLOWLIST: ['gpt-4', 'gpt-3.5-turbo', 'claude-3', 'claude-2']
```

#### Pacing & Difficulty Levers
```typescript
QUEST_PACING_TEMPO_MULTIPLIER: 0.1-3.0
QUEST_OBJECTIVE_HINT_FREQUENCY: 0.0-1.0
SOFT_LOCK_HINT_FREQUENCY: 0.0-1.0
SOFT_LOCK_MAX_TURNS_WITHOUT_PROGRESS: 5-50
SKILL_CHECK_DIFFICULTY_BIAS: -0.5-0.5
SKILL_CHECK_SUCCESS_RATE_MULTIPLIER: 0.0-1.0
RESOURCE_REGEN_MULTIPLIER: 0.0-1.0
RESOURCE_DECAY_MULTIPLIER: 0.0-1.0
TURN_PACING_MULTIPLIER: 0.0-1.0
TURN_TIMEOUT_MULTIPLIER: 0.0-1.0
```

#### Economy Levers
```typescript
DROP_RATE_COMMON_MULTIPLIER: 0.0-5.0
DROP_RATE_UNCOMMON_MULTIPLIER: 0.0-5.0
DROP_RATE_RARE_MULTIPLIER: 0.0-5.0
DROP_RATE_EPIC_MULTIPLIER: 0.0-5.0
DROP_RATE_LEGENDARY_MULTIPLIER: 0.0-10.0 (critical)
VENDOR_MARGIN_MIN: 0.0-0.5
VENDOR_MARGIN_MAX: 0.1-0.8
VENDOR_STOCK_REFRESH_MULTIPLIER: 0.0-1.0
CRAFTING_QUALITY_BIAS: -0.5-0.5
CRAFTING_SUCCESS_RATE_MULTIPLIER: 0.0-1.0
CURRENCY_SINK_DAILY_CAP: 0-10000
CURRENCY_SOURCE_DAILY_CAP: 0-10000
ECONOMIC_ACTIVITY_MULTIPLIER: 0.0-1.0
TRADE_FREQUENCY_MULTIPLIER: 0.0-1.0
```

#### World Simulation Levers
```typescript
WORLD_EVENT_RATE_MULTIPLIER: 0.0-5.0
WORLD_EVENT_SEVERITY_MULTIPLIER: 0.0-1.0
WEATHER_VOLATILITY_MULTIPLIER: 0.0-3.0
WEATHER_FRONT_FREQUENCY_MULTIPLIER: 0.0-1.0
REGION_DRIFT_STEP_CAP: 1-10
REGION_DRIFT_FREQUENCY_MULTIPLIER: 0.0-1.0
WORLD_STATE_PERSISTENCE_MULTIPLIER: 0.0-1.0
WORLD_STATE_DECAY_MULTIPLIER: 0.0-1.0
```

#### Dialogue & Romance Levers
```typescript
DIALOGUE_CANDIDATE_CAP: 1-20
DIALOGUE_CANDIDATE_SCORE_THRESHOLD: 0.0-1.0
DIALOGUE_COOLDOWN_MULTIPLIER: 0.0-1.0
ROMANCE_COOLDOWN_TURNS: 1-100
ROMANCE_PROGRESSION_MULTIPLIER: 0.0-1.0
ROMANCE_CONSENT_STRICTNESS: 'strict' | 'moderate' | 'lenient'
DIALOGUE_ENGAGEMENT_MULTIPLIER: 0.0-1.0
DIALOGUE_DEPTH_MULTIPLIER: 0.0-1.0
```

#### Party Management Levers
```typescript
PARTY_MAX_ACTIVE_MEMBERS: 1-8
PARTY_DELEGATE_CHECK_RATE: 0.0-1.0
PARTY_INTENT_MIX_BIAS: {
  COOPERATIVE: 0.0-1.0,
  COMPETITIVE: 0.0-1.0,
  NEUTRAL: 0.0-1.0
}
PARTY_COHESION_MULTIPLIER: 0.0-1.0
PARTY_CONFLICT_MULTIPLIER: 0.0-1.0
PARTY_MEMBER_SATISFACTION_MULTIPLIER: 0.0-1.0
PARTY_MEMBER_LOYALTY_MULTIPLIER: 0.0-1.0
```

#### Module Gates
```typescript
DIALOGUE_GATE: 'off' | 'readonly' | 'full'
WORLDSIM_GATE: 'off' | 'readonly' | 'full'
PARTY_GATE: 'off' | 'readonly' | 'full'
MODS_GATE: 'off' | 'readonly' | 'full'
TOOLS_GATE: 'off' | 'readonly' | 'full'
ECONOMY_KERNEL_GATE: 'off' | 'readonly' | 'full'
```

## Usage Guide

### Creating Configurations

#### 1. **Global Configuration**
```typescript
const globalConfig = {
  name: "Global Token Optimization",
  scope: "global",
  scope_ref: "global",
  payload: {
    AWF_MAX_INPUT_TOKENS: 5000,
    AWF_MAX_OUTPUT_TOKENS: 2500,
    AWF_INPUT_TOKEN_MULTIPLIER: 1.1
  },
  valid_from: "2024-01-01T00:00:00Z",
  valid_to: "2024-12-31T23:59:59Z"
};
```

#### 2. **World-Specific Configuration**
```typescript
const worldConfig = {
  name: "Forest Glade Economy Boost",
  scope: "world",
  scope_ref: "world.forest_glade",
  payload: {
    DROP_RATE_LEGENDARY_MULTIPLIER: 1.5,
    ECONOMIC_ACTIVITY_MULTIPLIER: 1.2,
    VENDOR_MARGIN_MIN: 0.05
  }
};
```

#### 3. **Adventure-Specific Configuration**
```typescript
const adventureConfig = {
  name: "Tutorial Pacing Adjustment",
  scope: "adventure",
  scope_ref: "adventure.tutorial",
  payload: {
    QUEST_PACING_TEMPO_MULTIPLIER: 0.8,
    SOFT_LOCK_HINT_FREQUENCY: 0.2,
    SKILL_CHECK_SUCCESS_RATE_MULTIPLIER: 1.1
  }
};
```

### API Usage

#### **Create Configuration**
```bash
POST /api/awf-liveops/configs
{
  "name": "Test Configuration",
  "scope": "global",
  "scope_ref": "global",
  "payload": {
    "AWF_INPUT_TOKEN_MULTIPLIER": 1.2
  }
}
```

#### **Activate Configuration**
```bash
POST /api/awf-liveops/configs/{id}/activate
{
  "immediate": true
}
```

#### **Preview Configuration**
```bash
GET /api/awf-liveops/resolve/preview?session_id=test&world_id=world.forest_glade
```

#### **Dry-Run Impact Estimation**
```bash
POST /api/awf-liveops/dry-run
{
  "context": {
    "session_id": "test-session",
    "world_id": "world.forest_glade"
  },
  "proposed_config": {
    "AWF_INPUT_TOKEN_MULTIPLIER": 1.5
  }
}
```

### Dashboard Usage

#### **LiveOps Panel**
1. **Configurations Tab**: View and manage all configurations
2. **Preview Tab**: Preview effective configuration for specific contexts
3. **Impact Analysis Tab**: Analyze impact of configuration changes
4. **History Tab**: View audit trail of configuration changes

#### **Key Features**
- **Real-time Status**: Monitor active configurations and system status
- **Impact Metrics**: View latency, token usage, coverage, and oracle failures
- **Safety Validation**: Automatic bounds checking and critical issue detection
- **Rollback Support**: Easy rollback to previous configurations

## Safety Mechanisms

### **Bounds Validation**
- **Critical bounds**: Token limits, model tiers (block deployment)
- **Warning bounds**: Pacing multipliers, economy rates (allow with warning)
- **Error bounds**: Invalid values, type mismatches (block deployment)

### **Dry-Run Impact Estimation**
- **Simulation**: 50 synthetic turns using autoplay policies
- **Metrics**: Latency, token usage, coverage, oracle failures
- **Confidence**: Based on simulation quality and extreme values
- **Recommendations**: Gradual rollout, monitoring suggestions

### **Kill-Switch Support**
- **Global Freeze**: `LIVEOPS_GLOBAL_FREEZE=true` halts all changes
- **Shadow Mode**: Evaluate changes without applying them
- **Rollback**: Create new configs that revert to previous state

## Integration Points

### **Game Systems Integration**
- **Bundle Assembler**: Token budgets, slice caps, model tiers
- **Pacing Governor**: Quest tempo, soft-lock hints, skill checks
- **Economy Engine**: Drop rates, vendor margins, crafting quality
- **World Sim**: Event rates, weather volatility, region drift
- **Dialogue Engine**: Candidate caps, cooldowns, romance progression
- **Party Management**: Max members, delegate rates, intent mix

### **Authoring IDE Integration**
- **Preview Panel**: Read-only "Effective LiveOps" overlay
- **Tooltips**: Per-lever explanations and origin scope
- **Preview Mode**: Emulate configs on mocked sessions
- **No DB Mutation**: Preview-only, no persistent changes

## Monitoring & Observability

### **Metrics**
- `awf.liveops.configs.active`: Number of active configurations
- `awf.liveops.configs.changes`: Configuration change rate
- `awf.liveops.impact.latency_p95`: P95 latency impact
- `awf.liveops.impact.tokens_total`: Total token usage impact
- `awf.liveops.impact.coverage_*`: Coverage metrics per system
- `awf.liveops.impact.oracles_*`: Oracle failure rates
- `awf.liveops.safety.violations`: Safety bound violations
- `awf.liveops.cache.hit_rate`: Config resolver cache performance

### **Dashboard Views**
- **LiveOps Panel**: Active configs, upcoming schedules, impact deltas
- **Change History**: Timeline with incident and experiment links
- **Impact Analysis**: Before/after KPIs with drill-downs
- **Safety Monitoring**: Violation alerts and recommendations

## Troubleshooting

### **Common Issues**

#### **Configuration Not Applying**
1. Check scope precedence (global → world → adventure → experiment → session)
2. Verify valid_from/valid_to timestamps
3. Check for global freeze status
4. Review cache TTL and clear if needed

#### **Performance Issues**
1. Monitor cache hit rates (should be >95%)
2. Check resolver latency (should be <1ms p50)
3. Review config complexity and bounds
4. Consider reducing cache TTL

#### **Safety Violations**
1. Review bounds validation errors
2. Check critical lever changes
3. Run dry-run impact estimation
4. Consider gradual rollout

#### **Shadow Mode Issues**
1. Verify shadow mode is enabled
2. Check console logs for shadow evaluations
3. Ensure no runtime changes are applied
4. Review impact estimation results

### **Debug Tools**

#### **Config Explanation**
```typescript
const explanation = await integration.getConfigExplanation(context);
console.log('Applied configs:', explanation.explain.appliedConfigs);
console.log('Field sources:', explanation.explain.mergedFields);
```

#### **Cache Statistics**
```typescript
const stats = resolver.getCacheStats();
console.log('Cache size:', stats.size);
console.log('Cache keys:', stats.keys);
console.log('TTL:', stats.ttl);
```

#### **Safety Validation**
```typescript
const validation = safety.validateConfig(proposedConfig);
console.log('Valid:', validation.valid);
console.log('Violations:', validation.violations);
```

## Migration Guide

### **From Manual Configuration**
1. Export existing game balance settings
2. Create LiveOps configurations with equivalent values
3. Test in shadow mode
4. Gradual rollout with monitoring
5. Remove manual configuration code

### **Database Migration**
```sql
-- Run the migration
\i supabase/migrations/20250128_awf_liveops_remote_config.sql

-- Verify tables created
SELECT table_name FROM information_schema.tables 
WHERE table_name LIKE 'liveops_%';

-- Check RLS policies
SELECT policyname FROM pg_policies 
WHERE tablename LIKE 'liveops_%';
```

### **Code Integration**
1. Import LiveOps integration points
2. Replace hardcoded values with config resolution
3. Add error handling for config failures
4. Implement shadow mode support
5. Add monitoring and alerting

## Best Practices

### **Configuration Management**
- **Use descriptive names**: "Forest Glade Economy Boost v1.2"
- **Scope appropriately**: Use most specific scope possible
- **Set expiration dates**: Avoid permanent configurations
- **Document changes**: Include reasoning in config names

### **Safety & Rollout**
- **Test in shadow mode**: Always evaluate before applying
- **Use dry-run estimation**: Understand impact before deployment
- **Gradual rollout**: Start with small changes and monitor
- **Set up monitoring**: Track key metrics and alerts

### **Performance**
- **Cache effectively**: Use appropriate TTL for your use case
- **Monitor resolver latency**: Should be <1ms p50
- **Avoid complex configs**: Keep payloads simple and focused
- **Regular cleanup**: Archive old configurations

### **Team Collaboration**
- **Use version control**: Track configuration changes
- **Document decisions**: Include reasoning in audit logs
- **Coordinate changes**: Avoid conflicting configurations
- **Regular reviews**: Audit active configurations regularly

## Future Enhancements

### **Planned Features**
- **A/B Testing Integration**: Built-in experiment management
- **Machine Learning**: Automated optimization suggestions
- **Real-time Monitoring**: Live metrics and alerting
- **Advanced Targeting**: Complex audience segmentation
- **Configuration Templates**: Reusable configuration patterns

### **API Extensions**
- **Bulk Operations**: Mass configuration management
- **Configuration Comparison**: Side-by-side diff views
- **Export/Import**: Configuration backup and restore
- **Webhook Support**: Real-time change notifications

---

## Conclusion

Phase 28 provides a comprehensive LiveOps system that enables safe, auditable, and performant remote configuration management. The system supports real-time game balance adjustments while maintaining safety through bounds validation, impact estimation, and rollback capabilities.

The implementation follows software engineering best practices with proper separation of concerns, comprehensive testing, and extensive documentation. All features are admin-only with no player-facing UI changes, ensuring a seamless integration with existing game systems.
