# Operational Dashboards

## SLO Summary Panel

### Metrics Displayed

- **Availability**: Current 30-day rolling percentage for create-game and get-turns
- **Error Budget Remaining**: Percentage of error budget still available
- **Latency Compliance**: Percentage of requests meeting p95 targets
- **Status Indicators**: Green (within SLO), Yellow (warning), Red (breach)

### Refresh Rate
- Real-time (1-minute granularity)
- 30-day rolling window calculation

## Latency Panels

### Request Latency Distribution

**Panel 1: Create Game (POST /api/games)**
- p50, p95, p99 latency over time
- Histogram: `http_request_duration_ms{route="/api/games",method="POST"}`
- Target: p95 < 600ms
- Alert threshold: p95 > 600ms for 10 minutes

**Panel 2: Get Turns (GET /api/games/:id/turns)**
- p50, p95, p99 latency over time
- Histogram: `http_request_duration_ms{route="/api/games/:id/turns",method="GET"}`
- Target: p95 < 200ms (cache warm)
- Separate line for cache cold vs warm states

### Stored Procedure Performance

**Panel 3: spawn_game_v3_atomic Duration**
- Histogram: `spawn_v3_duration_ms`
- Track stored procedure execution time
- Alert on p95 > 500ms

**Panel 4: Turns Query Duration**
- Histogram: `turns_query_duration_ms`
- Track pagination query performance
- Alert on p95 > 150ms

## Error Rates Panel

### 5xx Error Rate

- Percentage of 5xx responses vs total requests
- Separate lines for create-game and get-turns
- Target: < 0.5%
- Alert threshold: > 1% for 5 minutes

### Error Breakdown by Code

- Stacked bar chart showing error code distribution
- Focus on: DB_CONFLICT, INTERNAL_ERROR, UPSTREAM_TIMEOUT
- Trend over time to identify patterns

## Idempotency Hit Rate

### Panel: Idempotency Cache Efficiency

- Percentage of requests served from idempotency cache
- Metric: `idempotency_hit_rate = cached_responses / total_requests`
- Expected: > 80% for repeated requests with same key
- Alert: Hit rate < 50% (may indicate key generation issues)

## Policy Distribution Panel

### Prompt Policy Actions

**Metrics:**
- Percentage of requests with `SCENARIO_DROPPED`
- Percentage of requests with `NPC_DROPPED`
- Percentage of requests with `SCENARIO_POLICY_UNDECIDED` (warn only)

**Visualization:**
- Pie chart showing policy action distribution
- Stacked area chart over time to track policy decisions
- Alert: `SCENARIO_DROPPED` rate > 50% (may indicate budget too low)

## Request Volume

### QPS (Queries Per Second)

- Line chart showing requests/sec for create-game and get-turns
- Identify traffic patterns and spikes
- Correlate with latency/error spikes

## Database Metrics

### Connection Pool Usage

- Active connections vs pool size
- Connection wait time
- Alert: Pool exhaustion (wait time > 100ms)

### Query Performance

- Slow query log (queries > 200ms)
- Index usage statistics
- Deadlock/timestamp contention metrics

## Implementation Notes

### Metrics Export Format

All metrics emitted as structured JSON logs compatible with Prometheus/Grafana:

```json
{
  "event": "metric.histogram",
  "name": "http_request_duration_ms",
  "labels": { "route": "/api/games", "method": "POST", "status": "201" },
  "value": 450,
  "timestamp": "2025-02-05T12:34:56Z"
}
```

### Dashboard Tools

- **Recommended**: Grafana (if Prometheus available)
- **Alternative**: Custom dashboard consuming structured logs
- **Fallback**: Metrics service snapshot endpoint (`GET /api/metrics`)

