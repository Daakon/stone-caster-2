# Phase 7: Rollout and Decommission Plan - AWF Pipeline

This document describes the production rollout strategy and decommission plan for the AWF pipeline migration, including golden tests, canary rollout controls, SLO monitoring, and legacy system retirement.

## Overview

Phase 7 implements a comprehensive production rollout strategy with high confidence through:

- **Golden Test Harness**: Deterministic E2E testing with stable outputs
- **Canary Rollout Controls**: Percentage-based enablement with overrides
- **SLO Monitoring**: Service level objectives with alerting
- **Audit Logging**: Complete admin action tracking
- **Decommission Plan**: Safe retirement of legacy systems

## Golden Test Harness

### Scenario Files

Golden test scenarios are stored in `backend/goldens/` as JSON files:

```json
{
  "name": "first-meet-kiera",
  "description": "First encounter with Kiera in the forest glade",
  "sessionSeed": 424242,
  "turns": [
    {
      "input": "I step into the glade and look toward the eyes.",
      "expect": {
        "mustInclude": ["glade", "eyes"],
        "choicesAtMost": 5,
        "sceneChange": true
      }
    }
  ]
}
```

### Test Runner

The golden test runner (`backend/src/goldens/runner.ts`) provides:

- **Record Mode**: Capture stable outputs for scenarios
- **Verify Mode**: Compare current outputs against golden files
- **Test Mode**: Validate outputs against expectations

### Usage

```bash
# Record golden outputs
npm run awf:golden:record

# Verify against golden files
npm run awf:golden:test

# Run individual scenario
tsx backend/src/goldens/runner.ts --scenario first-meet-kiera
```

## Canary Rollout Controls

### Percentage Rollout

The canary rollout system (`backend/src/rollout/canary-rollout.ts`) provides:

- **Consistent Bucketing**: Hash-based assignment for stable user experience
- **Percentage Control**: 0-100% rollout with environment variable
- **Override System**: Per-user and per-session overrides
- **Audit Logging**: Complete change tracking

### Configuration

```bash
# Environment variables
AWF_BUNDLE_ON=true                    # Global enablement
AWF_PERCENT_ROLLOUT=25                # Percentage rollout (0-100)
```

### Rollout Scripts

```bash
# Set rollout percentage
tsx backend/scripts/awf-rollout-set.ts --percent 25 --actor admin

# Set user override
tsx backend/scripts/awf-override.ts --user user-123 --enable --actor admin

# Set session override
tsx backend/scripts/awf-override.ts --session session-456 --disable --actor admin

# List current overrides
tsx backend/scripts/awf-override.ts --list
```

## SLO Monitoring and Alerting

### Service Level Objectives

The SLO system (`backend/src/slos/awf-slos.ts`) monitors:

- **Turn Latency P95**: 95th percentile turn latency (default: 8000ms)
- **Invalid Retry Rate**: Percentage of turns requiring validator retry (default: 5%)
- **Fallback Rate**: Percentage of turns falling back to legacy (default: 1%)

### Configuration

```bash
# SLO thresholds
SLO_TURN_P95_MS=8000
SLO_INVALID_RETRY_RATE=5.0
SLO_FALLBACK_RATE=1.0
```

### Alerting

When SLOs are violated, the system:

1. **Logs Warnings**: Console warnings with current values
2. **Suggests Actions**: Specific remediation steps
3. **Triggers Callbacks**: Custom alert handlers
4. **Records Metrics**: Historical SLO data

### Suggested Actions

- **High Latency**: Investigate model provider, check bundle size, reduce rollout
- **High Retry Rate**: Review validator rules, check model quality, adjust temperature
- **High Fallback Rate**: Investigate validation failures, check model health, reduce rollout

## Audit Logging

### Audit Events

The audit system (`backend/src/audit/audit-logger.ts`) tracks:

- **Flag Changes**: Global AWF enablement changes
- **Rollout Changes**: Percentage rollout adjustments
- **Override Changes**: User/session override modifications
- **SLO Alerts**: Service level objective violations

### Audit Log Structure

```typescript
interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  entity: string;
  details: Record<string, any>;
  createdAt: string;
}
```

### Querying Audit Logs

```typescript
import { getAuditLogger } from '../src/audit/audit-logger.js';

const logger = getAuditLogger();

// Get recent logs
const recent = logger.getRecentLogs();

// Get logs by actor
const adminLogs = logger.getLogsByActor('admin');

// Get flag change logs
const flagChanges = logger.getFlagChangeLogs();
```

## Rollout Plan

### Phase 1: 0% → 5% (Week 1)
- Enable golden tests
- Set `AWF_PERCENT_ROLLOUT=5`
- Monitor SLOs closely
- Ready to rollback if issues

### Phase 2: 5% → 25% (Week 2)
- Increase to 25% if SLOs healthy
- Monitor user feedback
- Check audit logs for issues

### Phase 3: 25% → 50% (Week 3)
- Increase to 50% if stable
- Monitor performance metrics
- Validate golden tests

### Phase 4: 50% → 100% (Week 4)
- Full rollout if all SLOs healthy
- Monitor for 7 days
- Prepare for decommission

## Rollback Plan

### Immediate Rollback
```bash
# Set rollout to 0%
tsx backend/scripts/awf-rollout-set.ts --percent 0 --actor admin

# Disable global flag
export AWF_BUNDLE_ON=false
```

### Emergency Rollback
```bash
# Clear all overrides
tsx backend/scripts/awf-override.ts --clear-all --actor admin

# Disable global flag
export AWF_BUNDLE_ON=false
```

## Decommission Plan

### Prerequisites

Before decommissioning the legacy system:

1. **SLOs Healthy**: All SLOs within thresholds for 7 days
2. **Golden Tests Pass**: All scenarios pass verification
3. **User Feedback**: No significant user complaints
4. **Performance**: Latency and error rates acceptable

### Decommission Steps

#### Step 1: Make AWF Default
```bash
# Set global flag to true
export AWF_BUNDLE_ON=true

# Set rollout to 100%
tsx backend/scripts/awf-rollout-set.ts --percent 100 --actor admin
```

#### Step 2: Remove Legacy Code (Behind Build Flag)
```typescript
// Add build flag for legacy code
const LEGACY_TURN_ENABLED = process.env.LEGACY_TURN_ENABLED === 'true';

if (isAwfBundleEnabled({ sessionId }) && !LEGACY_TURN_ENABLED) {
  return await runAwfTurn({ sessionId, inputText });
} else {
  return await runLegacyTurn({ sessionId, inputText });
}
```

#### Step 3: Dark Launch Toggle
```typescript
// Keep emergency fallback for one release
const EMERGENCY_FALLBACK = process.env.EMERGENCY_FALLBACK === 'true';

if (EMERGENCY_FALLBACK) {
  return await runLegacyTurn({ sessionId, inputText });
}
```

#### Step 4: Complete Decommission
- Remove legacy code entirely
- Remove build flags
- Remove emergency fallback
- Update documentation

## Monitoring and Observability

### Key Metrics

- **Turn Latency**: P95 latency for turn processing
- **Retry Rate**: Percentage of turns requiring retry
- **Fallback Rate**: Percentage of turns falling back to legacy
- **Bundle Size**: Average bundle size in bytes
- **Token Usage**: Input/output token consumption

### Alerting Thresholds

- **Critical**: Fallback rate > 1%
- **Warning**: Retry rate > 5%
- **Warning**: Turn latency P95 > 8000ms

### Dashboard Metrics

- Real-time SLO status
- Rollout percentage and distribution
- Audit log activity
- Golden test results

## Testing Strategy

### Golden Tests
- Deterministic scenarios with fixed seeds
- Stable output verification
- Regression detection

### Integration Tests
- End-to-end turn processing
- Rollout percentage validation
- SLO monitoring verification

### Load Tests
- High-volume turn processing
- SLO threshold validation
- Performance under load

## Security Considerations

### Audit Logging
- All admin actions logged
- Immutable audit trail
- Access control for audit logs

### Override Security
- Actor authentication required
- Override expiration (optional)
- Rate limiting on changes

### SLO Data
- Sensitive metrics protection
- Access control for SLO data
- Data retention policies

## Troubleshooting

### Common Issues

#### High Latency
1. Check model provider health
2. Review bundle size and token counts
3. Consider reducing rollout percentage
4. Check for resource constraints

#### High Retry Rate
1. Review validator rules
2. Check model output quality
3. Adjust model temperature
4. Review input bundle structure

#### High Fallback Rate
1. Investigate consecutive validation failures
2. Check model provider health
3. Review SLO thresholds
4. Consider emergency rollback

### Debug Commands

```bash
# Check current rollout status
tsx backend/scripts/awf-override.ts --list

# View recent audit logs
tsx backend/scripts/audit-logs.ts --recent

# Check SLO status
tsx backend/scripts/slo-status.ts

# Run golden tests
npm run awf:golden:test
```

## Success Criteria

### Phase 7 Complete When:
- ✅ Golden test harness implemented and working
- ✅ Canary rollout controls functional
- ✅ SLO monitoring and alerting operational
- ✅ Audit logging capturing all admin actions
- ✅ Decommission plan documented and tested
- ✅ All tests passing
- ✅ Documentation complete

### Production Ready When:
- ✅ SLOs healthy for 7 days at 100% rollout
- ✅ Golden tests passing consistently
- ✅ No critical user feedback
- ✅ Performance metrics acceptable
- ✅ Audit logs clean
- ✅ Team trained on new system

## Configuration Reference

### Environment Variables

```bash
# Feature Flags
AWF_BUNDLE_ON=true
AWF_PERCENT_ROLLOUT=25

# SLO Thresholds
SLO_TURN_P95_MS=8000
SLO_INVALID_RETRY_RATE=5.0
SLO_FALLBACK_RATE=1.0

# Legacy Support
LEGACY_TURN_ENABLED=false
EMERGENCY_FALLBACK=false
```

### Scripts

```bash
# Golden Tests
npm run awf:golden:record
npm run awf:golden:test

# Rollout Control
tsx backend/scripts/awf-rollout-set.ts --percent 25 --actor admin
tsx backend/scripts/awf-override.ts --user user-123 --enable --actor admin

# Monitoring
tsx backend/scripts/slo-status.ts
tsx backend/scripts/audit-logs.ts --recent
```

This completes the Phase 7 rollout and decommission plan, providing a comprehensive strategy for safely transitioning to the AWF pipeline in production.


