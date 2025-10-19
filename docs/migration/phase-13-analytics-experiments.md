# Phase 13: Analytics & Experiments Implementation

## Overview

Phase 13 adds production-grade visibility and controlled experimentation for the AWF runtime. This includes analytics event pipeline, experiments framework, admin controls, and reporting capabilities - all without changing the player-facing UI.

## Features Implemented

### 1. Analytics Event Pipeline

**Location**: `backend/src/analytics/events.ts`

- **PII-Safe Tracking**: Captures key AWF turn metrics with hashed player IDs
- **Batched Processing**: Configurable batch size and flush intervals
- **Graceful Shutdown**: Flushes pending events on process exit
- **Environment Controls**: Respects `ANALYTICS_ENABLED` setting

**Key Metrics Tracked**:
- Turn latency and model latency
- Token usage (bundle and output)
- Retry and fallback counts
- Tool calls and acts/choices counts
- Time advance ticks
- Experiment exposure

### 2. Experiments Framework

**Location**: `backend/src/experiments/`

#### Assignment (`assign.ts`)
- **Deterministic Hashing**: Consistent assignment based on session/player ID
- **Allocation Validation**: Ensures percentages sum to 100%
- **Date Range Support**: Start/stop experiment scheduling
- **Hash Basis Selection**: Session-based or player-based assignment

#### Parameters (`params.ts`)
- **Parameter Merging**: Combines default params with experiment variations
- **Guardrails Validation**: Enforces safety limits on runtime knobs
- **Caching**: 1-minute cache for experiment data
- **Invalid Parameter Handling**: Logs warnings and tracks exposure

**Supported Runtime Knobs**:
- `maxOutputTokens`: Output token budget
- `maxActs`: Maximum acts per turn
- `toolMaxCalls`: Tool call limit
- `timeAdvanceTicks`: Time advancement rate
- `txtSentenceCap`: Sentence length limit
- `maxChoices`: Choice count limit

### 3. Admin Endpoints

**Location**: `backend/src/routes/awf-experiments-admin.ts`

#### Experiment Management
- `GET /api/admin/awf/experiments` - List all experiments
- `POST /api/admin/awf/experiments` - Create experiment
- `PUT /api/admin/awf/experiments/:key` - Update experiment
- `DELETE /api/admin/awf/experiments/:key` - Delete experiment
- `POST /api/admin/awf/experiments/:key/start` - Start experiment
- `POST /api/admin/awf/experiments/:key/stop` - Stop experiment

#### Variation Management
- `GET /api/admin/awf/experiments/:key/variations` - Get variations
- `POST /api/admin/awf/experiments/:key/variations` - Create variation
- `PUT /api/admin/awf/experiments/:key/variations/:variationKey` - Update variation
- `DELETE /api/admin/awf/experiments/:key/variations/:variationKey` - Delete variation

#### Reporting
- `GET /api/admin/awf/experiments/:key/report` - Get experiment report
  - Supports JSON and CSV formats
  - Aggregates metrics by variation and locale
  - Date range filtering

### 4. Reporting & Scripts

#### Daily Rollup Job
**Location**: `backend/jobs/awf-analytics-rollup.ts`

- **Daily Aggregation**: Processes analytics events by date
- **Multi-format Output**: JSON and CSV exports
- **Backfill Support**: Re-process historical data
- **Performance Optimized**: Efficient aggregation queries

#### Experiment Reports
**Location**: `backend/scripts/awf-experiments-report.ts`

- **Comprehensive Metrics**: Latency, tokens, retries, fallbacks
- **Variation Analysis**: Performance comparison across variations
- **Locale Breakdown**: Metrics segmented by language
- **CSV Export**: Spreadsheet-compatible output

#### Analytics Backfill
**Location**: `backend/scripts/awf-analytics-backfill.ts`

- **Historical Processing**: Re-aggregate past analytics data
- **Date Range Support**: Process arbitrary date ranges
- **Multi-dimensional Analysis**: Experiments, locales, worlds

## Database Schema

### Tables Added

#### `analytics_events`
```sql
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    session_id TEXT NOT NULL,
    player_hash TEXT NOT NULL, -- Hashed for privacy
    world_ref TEXT NOT NULL,
    adventure_ref TEXT NOT NULL,
    locale TEXT NOT NULL DEFAULT 'en-US',
    experiment_key TEXT NULL,
    variation_key TEXT NULL,
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `experiments`
```sql
CREATE TABLE experiments (
    key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'stopped')),
    start_at TIMESTAMPTZ NULL,
    stop_at TIMESTAMPTZ NULL,
    hash_basis TEXT NOT NULL DEFAULT 'session' CHECK (hash_basis IN ('session', 'player')),
    allocations JSONB NOT NULL DEFAULT '[]'::jsonb,
    guardrails JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `experiment_variations`
```sql
CREATE TABLE experiment_variations (
    experiment_key TEXT NOT NULL REFERENCES experiments(key) ON DELETE CASCADE,
    variation_key TEXT NOT NULL,
    params JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (experiment_key, variation_key)
);
```

### Indexes
- `idx_analytics_events_ts` - Time-based queries
- `idx_analytics_events_experiment` - Experiment analysis
- `idx_analytics_events_world` - World-based analysis
- `idx_analytics_events_session` - Session tracking

## Configuration

### Environment Variables

```bash
# Analytics Configuration
ANALYTICS_ENABLED=true
ANALYTICS_BATCH_MS=3000
ANALYTICS_BATCH_MAX=500

# Experiments Configuration
EXPERIMENTS_ENABLED=true
EXPERIMENTS_HASH_BASIS=session

# Existing AWF Budget Variables (used as guardrails)
AWF_MODEL_MAX_OUTPUT_TOKENS=2000
AWF_TOOL_MAX_CALLS_PER_TURN=10
```

## Usage Examples

### 1. Creating an Experiment

```bash
# Create experiment via API
curl -X POST http://localhost:3000/api/admin/awf/experiments \
  -H "Content-Type: application/json" \
  -d '{
    "key": "token-budget-test",
    "name": "Token Budget Experiment",
    "status": "draft",
    "hashBasis": "session",
    "allocations": [
      {"variation": "control", "percent": 50},
      {"variation": "high-budget", "percent": 50}
    ],
    "guardrails": {
      "maxOutputTokens": 2000,
      "maxActs": 8,
      "toolMaxCalls": 10
    }
  }'
```

### 2. Adding Variations

```bash
# Add control variation
curl -X POST http://localhost:3000/api/admin/awf/experiments/token-budget-test/variations \
  -H "Content-Type: application/json" \
  -d '{
    "variationKey": "control",
    "params": {
      "maxOutputTokens": 1500,
      "maxActs": 6,
      "toolMaxCalls": 8
    }
  }'

# Add treatment variation
curl -X POST http://localhost:3000/api/admin/awf/experiments/token-budget-test/variations \
  -H "Content-Type: application/json" \
  -d '{
    "variationKey": "high-budget",
    "params": {
      "maxOutputTokens": 2000,
      "maxActs": 8,
      "toolMaxCalls": 10
    }
  }'
```

### 3. Starting an Experiment

```bash
curl -X POST http://localhost:3000/api/admin/awf/experiments/token-budget-test/start
```

### 4. Generating Reports

```bash
# Generate JSON report
curl "http://localhost:3000/api/admin/awf/experiments/token-budget-test/report?from=2025-01-01&to=2025-01-31&format=json"

# Generate CSV report
curl "http://localhost:3000/api/admin/awf/experiments/token-budget-test/report?from=2025-01-01&to=2025-01-31&format=csv" > report.csv
```

### 5. Daily Rollup

```bash
# Run rollup for specific date
npm run rollup daily 2025-01-15

# Run backfill for last 7 days
npm run rollup backfill 7
```

### 6. Experiment Reports

```bash
# Generate experiment report
npm run experiments-report report token-budget-test 2025-01-01 2025-01-31 json

# List all experiments
npm run experiments-report list
```

### 7. Analytics Backfill

```bash
# Backfill analytics data
npm run analytics-backfill 2025-01-01 2025-01-31 json
```

## Integration with AWF Pipeline

### 1. Turn Orchestrator Integration

The experiments framework integrates with the AWF turn orchestrator to:

1. **Check Experiment Assignment**: At the start of each turn
2. **Apply Parameters**: Modify runtime knobs based on variation
3. **Track Exposure**: Record experiment assignment in analytics
4. **Validate Parameters**: Ensure parameters are within guardrails

### 2. Analytics Integration

The analytics pipeline captures:

- **Turn Metrics**: Latency, tokens, retries, fallbacks
- **Experiment Data**: Assignment and parameter application
- **Content Signals**: Acts, choices, tool calls
- **Performance Data**: Model latency, bundle processing

## Security & Privacy

### PII Protection
- **Hashed Player IDs**: All player identifiers are hashed before storage
- **No User Content**: Only metrics and system data are captured
- **Session-based Tracking**: Uses session IDs for correlation

### Admin Access
- **RBAC Enforcement**: All admin endpoints require admin role
- **Audit Logging**: All experiment changes are logged
- **Parameter Validation**: Guardrails prevent dangerous configurations

## Performance Considerations

### Analytics Pipeline
- **Batched Processing**: Reduces database load
- **Configurable Flush**: Balance between latency and throughput
- **Graceful Degradation**: Continues working if analytics disabled

### Experiments Framework
- **Caching**: 1-minute cache for experiment data
- **Deterministic Assignment**: No database lookups per turn
- **Parameter Validation**: Fast in-memory validation

### Reporting
- **Efficient Aggregation**: Optimized database queries
- **Indexed Access**: Proper indexes for common query patterns
- **CSV Export**: Streaming output for large datasets

## Monitoring & Observability

### Metrics Tracked
- `awf.exp.exposures.count` - Experiment exposure count
- `awf.exp.invalid.count` - Invalid parameter count
- `awf.analytics.flush.count` - Analytics flush count
- `awf.analytics.flush.fail` - Analytics flush failures

### Logging
- Experiment assignment per turn
- Parameter validation results
- Analytics flush operations
- Report generation activities

## Testing

### Unit Tests
- Assignment stability and consistency
- Parameter validation against guardrails
- Analytics batching and flushing
- Report generation accuracy

### Integration Tests
- End-to-end experiment workflow
- Analytics data flow
- Admin endpoint functionality
- Report export formats

### Performance Tests
- Analytics pipeline overhead (< 2ms per turn)
- Assignment consistency under load
- Report generation performance

## Future Enhancements

### Planned Features
1. **Real-time Dashboards**: Live experiment monitoring
2. **A/B Testing UI**: Visual experiment management
3. **Statistical Significance**: Automated significance testing
4. **Experiment Templates**: Pre-configured experiment types
5. **Advanced Segmentation**: User cohort analysis

### Scalability Considerations
1. **Analytics Partitioning**: Time-based data partitioning
2. **Experiment Caching**: Redis-based experiment cache
3. **Report Caching**: Pre-computed report storage
4. **Data Archival**: Automated old data cleanup

## Troubleshooting

### Common Issues

1. **Analytics Not Flushing**
   - Check `ANALYTICS_ENABLED` setting
   - Verify batch size and interval settings
   - Check database connectivity

2. **Experiment Assignment Inconsistent**
   - Verify hash basis setting
   - Check allocation percentages sum to 100
   - Ensure experiment is in 'running' status

3. **Invalid Parameters Applied**
   - Check guardrails configuration
   - Verify parameter validation
   - Review experiment variation settings

4. **Report Generation Fails**
   - Check date range validity
   - Verify experiment key exists
   - Ensure sufficient data for date range

### Debug Commands

```bash
# Check analytics pipeline status
curl http://localhost:3000/api/admin/awf/analytics/stats

# List active experiments
curl http://localhost:3000/api/admin/awf/experiments

# Test experiment assignment
npm run experiments-report list
```

## Migration Notes

### Database Migration
The migration `20250122_awf_analytics_experiments.sql` includes:
- All required tables and indexes
- RLS policies for admin access
- Default experiment for testing
- Proper foreign key relationships

### Backward Compatibility
- No changes to existing AWF pipeline
- Analytics can be disabled without impact
- Experiments are opt-in per session
- All existing functionality preserved

### Rollback Plan
1. Stop all running experiments
2. Disable analytics (`ANALYTICS_ENABLED=false`)
3. Run down migration to remove tables
4. Remove experiment integration code

## Conclusion

Phase 13 provides comprehensive analytics and experimentation capabilities for the AWF runtime. The implementation is production-ready with proper security, performance, and monitoring considerations. The system is designed to scale and can be extended with additional features as needed.


