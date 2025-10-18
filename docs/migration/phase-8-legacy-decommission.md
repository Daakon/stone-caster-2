# Phase 8: Legacy Decommission and Full Enablement - AWF Pipeline

This document describes the final phase of the AWF migration, which removes the legacy markdown prompt system, makes AWF the default runtime, and establishes post-launch monitoring and maintenance procedures.

## Overview

Phase 8 completes the AWF migration by:

- **Making AWF the default**: Unified mode control with AWF_MODE
- **Removing legacy systems**: Complete elimination of markdown prompt templates
- **Emergency fallback**: Temporary emergency legacy toggle for critical situations
- **Migration audit**: 14-day monitoring and validation period
- **Post-launch monitoring**: Weekly reports and ongoing maintenance

## Configuration Changes

### Unified AWF_MODE

The complex `AWF_BUNDLE_ON` + `AWF_PERCENT_ROLLOUT` system has been replaced with a unified `AWF_MODE`:

```typescript
export type AwfMode = "legacy" | "awf" | "mixed";
```

**Environment Variable:**
```bash
AWF_MODE=awf  # Default: AWF always on
```

**Mode Behaviors:**
- `"legacy"` → Force legacy path (emergency only)
- `"awf"` → AWF always on, no fallback
- `"mixed"` → Respect per-session overrides and canary rules

### Emergency Fallback

**Environment Variable:**
```bash
AWF_EMERGENCY_LEGACY=true  # Emergency legacy override
```

When enabled:
- Logs CRITICAL warning
- Forces all sessions to legacy path
- Recorded in audit logs
- Should only be used in emergencies

## Removed Legacy Components

### Deleted Files

The following legacy files have been removed:

```
backend/src/prompts/assembler.ts              # Legacy prompt assembler
backend/src/prompts/db-assembler.ts          # Database assembler
backend/tests/prompts/assembler.test.ts      # Assembler tests
backend/tests/prompts/db-assembler.test.ts  # DB assembler tests
backend/AI API Prompts/worlds/mystika/adventures/whispercross/adventure.start.prompt.md
```

### Removed Methods

From `backend/src/services/prompts.service.ts`:
- `createInitialPromptLegacy()` - Legacy fallback method
- All references to legacy prompt generation
- Fallback logic that used legacy systems

### Cleaned Up Code

- **Turns Service**: Simplified to use `AWF_MODE` instead of complex feature flags
- **Feature Flags**: Updated to use unified AWF mode manager
- **Prompt Service**: Removed all legacy fallback paths

## Migration Audit System

### Daily Audit Job

**Script:** `backend/jobs/awf-migration-audit.ts`

**Purpose:** Runs daily for 14 days post-enablement to compare AWF vs legacy metrics

**Usage:**
```bash
# Run daily audit
npm run awf:audit

# Get 7-day summary
npm run awf:audit:summary
```

**Metrics Tracked:**
- Turn latency (P95)
- Invalid output retry rate
- Fallback count (should be 0)
- Total turns processed
- SLO health status

**Output:** `logs/awf-audit/YYYY-MM-DD.json`

### Weekly Report

**Script:** `backend/scripts/awf-weekly-report.ts`

**Purpose:** Generate weekly rollup reports for AWF metrics

**Usage:**
```bash
npm run awf:weekly
```

**Report Contents:**
- Weekly metrics summary
- SLO status breakdown
- Trend analysis (improving/stable/degrading)
- Recommendations
- Performance KPIs

## Post-Launch Monitoring

### Key Performance Indicators (KPIs)

**14-Day Validation Criteria:**
- **Latency**: P95 ≤ 8 seconds
- **Retry Rate**: ≤ 5% of turns require validator retry
- **Fallback Rate**: 0% (no fallbacks to legacy)
- **Uptime**: 99.9% availability
- **Error Rate**: ≤ 1% of turns fail

### Monitoring Commands

```bash
# Check current AWF mode
tsx -e "import { getAwfModeManager } from './src/config/awf-mode.js'; console.log(getAwfModeManager().getStatus());"

# Run daily audit
npm run awf:audit

# Generate weekly report
npm run awf:weekly

# Check audit summary
npm run awf:audit:summary
```

### Alert Thresholds

**Critical Alerts:**
- Fallback rate > 0%
- P95 latency > 10 seconds
- Error rate > 5%

**Warning Alerts:**
- P95 latency > 8 seconds
- Retry rate > 5%
- SLO violations > 2 days

## Emergency Procedures

### Emergency Legacy Activation

If critical issues are detected:

```bash
# Activate emergency legacy mode
export AWF_EMERGENCY_LEGACY=true

# Restart services
npm run start
```

**What happens:**
- All sessions immediately switch to legacy path
- CRITICAL warning logged
- Audit trail created
- Legacy system handles all requests

### Emergency Deactivation

```bash
# Deactivate emergency mode
export AWF_EMERGENCY_LEGACY=false

# Restart services
npm run start
```

### Rollback Procedure

If AWF system needs to be completely disabled:

```bash
# Set mode to legacy
export AWF_MODE=legacy

# Restart services
npm run start
```

## Final Cleanup (After 14 Days)

### Prerequisites

Before removing emergency fallback:

1. **SLOs Healthy**: All SLOs within thresholds for 14 days
2. **No Fallbacks**: 0% fallback rate for 14 days
3. **Performance**: P95 latency ≤ 8 seconds
4. **Stability**: Error rate ≤ 1%

### Cleanup Steps

1. **Remove Emergency Flag:**
   ```bash
   # Remove from environment
   unset AWF_EMERGENCY_LEGACY
   ```

2. **Update Documentation:**
   - Remove emergency procedures
   - Update runbooks
   - Archive migration docs

3. **Final Validation:**
   ```bash
   # Run final audit
   npm run awf:audit:summary 14
   
   # Generate final report
   npm run awf:weekly
   ```

## Configuration Reference

### Environment Variables

```bash
# AWF Mode (required)
AWF_MODE=awf                    # Default: AWF always on

# Emergency Override (temporary)
AWF_EMERGENCY_LEGACY=false     # Emergency legacy override

# SLO Thresholds
SLO_TURN_P95_MS=8000          # Turn latency threshold
SLO_INVALID_RETRY_RATE=5.0    # Retry rate threshold
SLO_FALLBACK_RATE=0.0         # Fallback rate threshold
```

### Scripts

```bash
# Migration Audit
npm run awf:audit              # Run daily audit
npm run awf:audit:summary      # Get 7-day summary

# Weekly Reports
npm run awf:weekly             # Generate weekly report

# Golden Tests
npm run awf:golden:record     # Record golden outputs
npm run awf:golden:test        # Verify against golden files
```

## Troubleshooting

### Common Issues

#### High Latency
1. Check model provider health
2. Review bundle size and token counts
3. Consider reducing concurrent requests
4. Check for resource constraints

#### High Retry Rate
1. Review validator rules and thresholds
2. Check model output quality
3. Adjust model temperature
4. Review input bundle structure

#### Fallbacks Detected
1. Investigate consecutive validation failures
2. Check model provider health
3. Review SLO thresholds
4. Consider emergency rollback

### Debug Commands

```bash
# Check AWF mode status
tsx -e "import { getAwfModeManager } from './src/config/awf-mode.js'; console.log(JSON.stringify(getAwfModeManager().getStatus(), null, 2));"

# Check SLO status
tsx -e "import { getSLOMonitor } from './src/slos/awf-slos.js'; console.log(JSON.stringify(getSLOMonitor().getStatus(), null, 2));"

# Check audit logs
tsx -e "import { getAuditLogger } from './src/audit/audit-logger.js'; console.log(getAuditLogger().getRecentLogs().slice(0, 10));"
```

## Success Criteria

### Phase 8 Complete When:
- ✅ AWF_MODE controls runtime; default="awf"
- ✅ Legacy markdown prompt system fully removed
- ✅ Emergency fallback flag works and logs CRITICAL
- ✅ Daily audit job runs and logs metrics comparisons
- ✅ Weekly rollup report script operational
- ✅ Documentation and runbook completed
- ✅ CI/lint/tests all green

### Production Ready When:
- ✅ SLOs healthy for 14 days at 100% AWF
- ✅ No fallbacks detected for 14 days
- ✅ Performance metrics within thresholds
- ✅ Emergency procedures tested and documented
- ✅ Team trained on new system
- ✅ Legacy system completely removed

## Impact

**The AWF migration is now complete:**

1. **AWF is the default runtime** - All new sessions use AWF system
2. **Legacy system removed** - No more markdown prompt templates
3. **Unified configuration** - Single AWF_MODE controls everything
4. **Emergency fallback** - Temporary safety net for critical issues
5. **Comprehensive monitoring** - Daily audits and weekly reports
6. **Post-launch validation** - 14-day monitoring period

**The system now:**
- Uses only the AWF bundle system for all turn processing
- Has no legacy code paths or fallbacks
- Provides comprehensive monitoring and alerting
- Includes emergency procedures for critical situations
- Is ready for long-term production operation

**AWF migration complete!** 🎉


