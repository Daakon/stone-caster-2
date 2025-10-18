# Phase 24: Metrics Dashboards & Analytics

## Overview

Phase 24 delivers production-grade live telemetry, balance analytics, and dashboards on top of the analytics/experiments pipeline (Phase 13). This system provides queryable aggregates, cohort views, alerting, and a web UI for live balance & narrative health monitoring.

## Architecture

### Metrics Warehouse Layer

The system creates rollup tables and incremental jobs over `analytics_events`, `experiments`, and world/adventure data to power dashboards.

**Dimensions:**
- `world`, `adventure`, `locale`, `model`, `experiment`/`variation`, `content_version`
- `session_age_bucket`, `time` (hour/day)

**Measures:**
- **Performance**: turns, P50/P95 latency, token in/out, retries, fallbacks, validator retries
- **Gameplay**: TIME_ADVANCE ticks, acts/choices counts, tool calls, sim ticks
- **Economy**: loot/craft/vendor rates, party events, dialogue candidates/selected
- **Narrative**: romance consent rates, quest completion rates

### Balance KPIs & Funnels

**Design KPIs:**
- Completion rate per adventure
- Stuck-rate (≥N turns no objective progress)
- Economy velocity (gold delta, item acquisition rate)
- TTK distributions (from sim/sessions)
- Arc progress rate, Choice diversity

**Funnels:**
- Start → First Choice → First NPC Join → First Craft → First Vendor → First Boss → Completion

### Live Dashboards (Admin UI)

**Real-time boards (auto-refresh):**

1. **Overview**: SLO health, traffic, errors, fallbacks, retries
2. **Narrative Health**: quest-node drop-offs, soft-lock hints, dialogue cooldown blocks
3. **Economy**: currency inflow/outflow, vendor margins, crafting success
4. **Party/NPC**: recruits, dismissals, delegated checks outcomes
5. **World Sim**: event triggers, region drift, weather distribution
6. **Experiments**: variation comparison, KPI deltas, significance badges

### Alerting & SLO Guardrails

**SLOs (extend Phase 7):**
- Latency P95, invalid retry rate, fallback rate, validator-repair rate
- Stuck-rate, token budget overrun rate

**Configurable thresholds** with alert callbacks that file concise incident notes with suggested levers:
- Budget trims, module toggles, experiment param flips

### Experiment Readouts

- Per-variation deltas for KPIs (with significance heuristics)
- Parameter overlays (budgets, tool quotas, party caps) and outcome charts
- Export CSV/JSON reports for stakeholders

## Data Model

### Database Schema

```sql
-- Daily rollup table for comprehensive metrics aggregation
CREATE TABLE awf_rollup_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    world TEXT,
    adventure TEXT,
    locale TEXT,
    model TEXT,
    experiment TEXT,
    variation TEXT,
    content_version TEXT,
    
    -- Session metrics
    turns INTEGER DEFAULT 0,
    sessions INTEGER DEFAULT 0,
    
    -- Performance metrics
    p50_latency_ms INTEGER,
    p95_latency_ms INTEGER,
    avg_in_tokens INTEGER,
    avg_out_tokens INTEGER,
    
    -- Quality metrics
    retry_rate DECIMAL(5,4),
    fallback_rate DECIMAL(5,4),
    validator_retry_rate DECIMAL(5,4),
    stuck_rate DECIMAL(5,4),
    
    -- Game metrics
    avg_ticks DECIMAL(10,2),
    tool_calls_per_turn DECIMAL(5,2),
    acts_per_turn DECIMAL(5,2),
    choices_per_turn DECIMAL(5,2),
    
    -- Narrative health
    softlock_hints_rate DECIMAL(5,4),
    econ_velocity DECIMAL(10,2),
    
    -- Economy metrics
    craft_success_rate DECIMAL(5,4),
    vendor_trade_rate DECIMAL(5,4),
    party_recruits_rate DECIMAL(5,4),
    
    -- Dialogue metrics
    dialogue_candidate_avg DECIMAL(5,2),
    romance_consent_rate DECIMAL(5,4),
    
    -- World simulation
    event_trigger_rate DECIMAL(5,4),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hourly rollup table for real-time monitoring
CREATE TABLE awf_rollup_hourly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date_hour TIMESTAMPTZ NOT NULL,
    world TEXT,
    adventure TEXT,
    locale TEXT,
    model TEXT,
    experiment TEXT,
    variation TEXT,
    
    -- Core metrics (subset of daily)
    turns INTEGER DEFAULT 0,
    sessions INTEGER DEFAULT 0,
    p95_latency_ms INTEGER,
    retry_rate DECIMAL(5,4),
    fallback_rate DECIMAL(5,4),
    stuck_rate DECIMAL(5,4),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Funnel analysis table
CREATE TABLE awf_funnels_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    adventure TEXT NOT NULL,
    world TEXT,
    experiment TEXT,
    variation TEXT,
    
    -- Funnel steps
    start_count INTEGER DEFAULT 0,
    first_choice_count INTEGER DEFAULT 0,
    first_npc_join_count INTEGER DEFAULT 0,
    first_craft_count INTEGER DEFAULT 0,
    first_vendor_count INTEGER DEFAULT 0,
    first_boss_count INTEGER DEFAULT 0,
    completion_count INTEGER DEFAULT 0,
    
    -- Conversion rates
    start_to_choice_rate DECIMAL(5,4),
    choice_to_npc_rate DECIMAL(5,4),
    npc_to_craft_rate DECIMAL(5,4),
    craft_to_vendor_rate DECIMAL(5,4),
    vendor_to_boss_rate DECIMAL(5,4),
    boss_to_completion_rate DECIMAL(5,4),
    overall_completion_rate DECIMAL(5,4),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SLO thresholds and alerting configuration
CREATE TABLE awf_kpi_thresholds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope TEXT NOT NULL, -- 'global', 'world', 'adventure', 'variation'
    scope_ref TEXT, -- world_id, adventure_id, variation_id
    kpi_name TEXT NOT NULL,
    threshold_value DECIMAL(10,4) NOT NULL,
    threshold_operator TEXT NOT NULL CHECK (threshold_operator IN ('>', '<', '>=', '<=', '=', '!=')),
    severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
    enabled BOOLEAN DEFAULT true,
    suggested_actions JSONB,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dashboard views and saved filters
CREATE TABLE awf_dashboard_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    dashboard_type TEXT NOT NULL, -- 'overview', 'narrative', 'economy', 'party', 'sim', 'experiments'
    filters JSONB NOT NULL DEFAULT '{}',
    layout JSONB NOT NULL DEFAULT '{}',
    is_public BOOLEAN DEFAULT false,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Incident tracking for SLO breaches
CREATE TABLE awf_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    threshold_id UUID REFERENCES awf_kpi_thresholds(id),
    severity TEXT NOT NULL,
    kpi_name TEXT NOT NULL,
    current_value DECIMAL(10,4) NOT NULL,
    threshold_value DECIMAL(10,4) NOT NULL,
    scope TEXT NOT NULL,
    scope_ref TEXT,
    suggested_actions JSONB,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'resolved')),
    acknowledged_by UUID REFERENCES auth.users(id),
    acknowledged_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Backend Implementation

### ETL/Rollups

**`backend/src/metrics/rollup-jobs.ts`**
- Incremental jobs to populate `awf_rollup_hourly` and `awf_rollup_daily` from `analytics_events`
- Compute funnels & KPIs; store in `awf_funnels_daily`
- Idempotent with watermarking (last processed event timestamp)

### KPI Calculator

**`backend/src/metrics/kpi.ts`**
- Reusable functions: stuck-rate, economy velocity, TTK percentiles
- Craft/vendor rates, arc progress ratio, choice entropy
- Dialogue diversity, romance consent compliance
- Accepts filters; outputs typed metrics objects

### Alerts & SLOs

**`backend/src/slos/awf-slo-alerts.ts`**
- Evaluate thresholds from `awf_kpi_thresholds`
- On breach: write incident log, trigger callback (webhook/email adapter)
- Include "suggested actions" derived from known levers

### Balance Queries API

**`backend/src/routes/awf-metrics-admin.ts`**
- `GET /metrics/overview?from&to&filters=...`
- `GET /metrics/kpis?scope=adventure&ref=...`
- `GET /metrics/funnel?adventure=...`
- `GET /metrics/experiment?experiment=...`
- `GET /metrics/timeseries?measure=p95_latency_ms&granularity=hour`
- Guard maximum range & row limits; return CSV/JSON

### Experiment Integration

**`backend/src/experiments/reporting.ts`**
- Join variations to rollups; compute diffs & simple significance
- Export to CSV/JSON via `awf-experiments-report` extension

### Cron & Ops

**`backend/scripts/awf-rollups-run.ts`** (hourly & daily)
**`backend/scripts/awf-alerts-run.ts`** (every 5m/15m depending on granularity)

## Frontend Admin UI

### Dashboard Pages

**Pages (React):**
- `OverviewDashboard`: SLO tiles, traffic, retry/fallback trend, incidents list
- `NarrativeHealthDashboard`: quest-node drop-offs heatmap; stuck-rate per node
- `EconomyDashboard`: currency flow, vendor margin charts, crafting success
- `PartyNpcDashboard`: recruits/dismissals over time; delegated check outcomes
- `WorldSimDashboard`: event trigger rates, weather distribution, region drift
- `ExperimentsDashboard`: variation comparison, KPI deltas, significance badges

### Shared UI Components

- **Filter bar**: date range, world, adventure, locale, variation, model
- **Save View / Load View**: persists to `awf_dashboard_views`
- **Auto-refresh toggle**: CSV export for each widget

### Alerting UX

- **SLO config page**: CRUD on `awf_kpi_thresholds`
- **Incident list**: status (new/ack/resolved), suggested actions
- **Webhook/email adapters**: configurable via env

## Privacy & Governance

### PII Safety
- User IDs always hashed
- Locale breakdown aggregated (k-anonymity ≥ 10 sessions)
- No raw text from txt; only metrics

### RBAC
- **Viewer**: read dashboards
- **Editor**: save views, edit thresholds
- **Admin**: all, including exports

## Configuration

Add to `.env.example`:

```env
METRICS_DASHBOARDS_ENABLED=true
METRICS_ROLLUP_HOURLY_CRON="*/15 * * * *"
METRICS_ROLLUP_DAILY_CRON="0 2 * * *"
METRICS_ALERTS_CRON="*/5 * * * *"
METRICS_KANON_MIN=10
METRICS_MAX_RANGE_DAYS=120
EXPORT_MAX_ROWS=200000
ALERTS_WEBHOOK_URL=
ALERTS_EMAIL_FROM=
ALERTS_EMAIL_TO=ops@example.com
```

## Testing

### Unit Tests
- KPI calculators (stuck-rate, economy velocity, consent rate)
- Rollup job idempotency and watermark logic
- Alert threshold evaluation & suggested actions mapping

### Integration Tests
- Populate synthetic `analytics_events`; run hourly/daily jobs
- Query API filters and pagination; CSV exports
- Experiments diffs & significance heuristics

### E2E Tests
- Simulate spike in fallback rate → alert created
- Suggested action includes "reduce input token cap by 10%"

### Performance Tests
- Rollups complete under 60s for 10M events
- Dashboards load < 1.5s for typical ranges

## Operations

### Rollup Job Schedule
- **Hourly**: Process last hour of events
- **Daily**: Process yesterday's events, calculate funnels
- **Alerts**: Evaluate thresholds every 5-15 minutes

### Monitoring
- **Metrics**: `awf.rollup.events_processed`, `awf.rollup.duration_ms`
- **Alerts**: `awf.alerts.incidents_created`, `awf.alerts.resolution_time_ms`
- **Dashboards**: `awf.dashboard.load_time_ms`, `awf.dashboard.queries_per_second`

### Maintenance
- **Data retention**: Configurable per table
- **Index maintenance**: Automated for performance
- **Backup**: Daily incremental exports

## Definition of Done

✅ **Rollup tables populated** by scheduled jobs; KPI & funnel data available
✅ **Admin dashboards live** with filters, auto-refresh, saved views, and exports
✅ **Alerts trigger** on SLO breaches with suggested actions; incidents tracked
✅ **Experiment reports** show variation KPIs and significance
✅ **API query endpoints** implemented with limits and RBAC; k-anonymity enforced
✅ **Tests pass**; CI/lint/format clean; docs complete
✅ **No player-UI changes**

## Migration Path

1. **Deploy database schema** (`supabase/migrations/20250127_awf_metrics_rollups.sql`)
2. **Deploy backend services** (rollup jobs, KPI calculators, alerts, API routes)
3. **Deploy frontend dashboards** (React components, admin UI)
4. **Configure cron jobs** (hourly/daily rollups, alerts)
5. **Set up monitoring** (metrics, alerts, dashboards)
6. **Train operators** (SLO configuration, incident response)

## Rollback Plan

1. **Disable cron jobs** (stop rollup processing)
2. **Disable dashboards** (remove admin UI access)
3. **Archive data** (export rollup tables)
4. **Drop schema** (remove metrics tables)
5. **Clean up** (remove backend services, frontend components)

## Security Considerations

- **RBAC enforcement** on all dashboard access
- **PII protection** with hashed user IDs and k-anonymity
- **Rate limiting** on API endpoints
- **Audit logging** for all admin actions
- **Data encryption** at rest and in transit

## Performance Considerations

- **Indexed queries** for fast dashboard loading
- **Incremental rollups** to minimize processing time
- **Caching** for frequently accessed metrics
- **Batch processing** for large datasets
- **Connection pooling** for database efficiency
