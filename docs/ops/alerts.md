# Operational Alerts

## Alert Definitions

### A1: Latency SLO Breach

**Condition**: p95 latency exceeds SLO for 10 consecutive minutes
- **Create-game**: p95 > 600ms
- **Get-turns**: p95 > 200ms (cache warm)

**Severity**: High
**Notification**: PagerDuty/Slack #alerts channel
**Runbook**: `docs/runbooks/game-spawn.md` (create-game) or `docs/runbooks/turns-list.md` (get-turns)

**Remediation Steps**:
1. Check database query performance (EXPLAIN ANALYZE)
2. Review connection pool usage
3. Check for concurrent request spikes
4. Review stored procedure execution time

### A2: High 5xx Error Rate

**Condition**: 5xx error rate > 1% for 5 minutes

**Severity**: Critical
**Notification**: PagerDuty (on-call), Slack #alerts
**Runbook**: `docs/runbooks/game-spawn.md` or `docs/runbooks/turns-list.md`

**Remediation Steps**:
1. Check application logs for error patterns
2. Review database connection health
3. Check for recent deployments
4. Review stored procedure error logs
5. Check Supabase/Postgres health

### A3: Stored Procedure Error Rate

**Condition**: `spawn_game_v3_atomic` error rate > 0.25%

**Severity**: High
**Notification**: Slack #alerts
**Runbook**: `docs/runbooks/game-spawn.md`

**Remediation Steps**:
1. Check stored procedure logs for unique constraint violations
2. Review idempotency key collision patterns
3. Check for deadlock/timeout errors
4. Review transaction isolation level settings

### A4: Legacy Prompt Usage (Illegal State)

**Condition**: `legacy_prompt_used_total` increments while `LEGACY_PROMPTS_ENABLED=false`

**Severity**: Medium
**Notification**: Slack #alerts
**Runbook**: Check config, verify feature flag enforcement

**Remediation Steps**:
1. Verify `LEGACY_PROMPTS_ENABLED` environment variable
2. Check for code paths bypassing the flag
3. Review route handler enforcement
4. If legitimate (e.g., config drift), fix immediately

### A5: Availability Budget Exhausted

**Condition**: 30-day availability < 99.9% (error budget < 0.05%)

**Severity**: Critical
**Notification**: PagerDuty (on-call), management escalation
**Runbook**: Error budget policy (pause rollouts, focus on remediation)

### A6: Idempotency Cache Miss Rate

**Condition**: Idempotency hit rate < 50% for 15 minutes

**Severity**: Medium
**Notification**: Slack #alerts
**Runbook**: Review idempotency key generation, check cache retention

**Remediation Steps**:
1. Review idempotency key generation logic
2. Check cache TTL settings
3. Verify cache storage availability
4. Review request patterns (duplicate keys expected?)

## Alert Configuration

### Alerting System

- **Primary**: Prometheus Alertmanager (if available)
- **Fallback**: Log-based alerting via log aggregation (Datadog, Splunk, etc.)
- **Notification Channels**: PagerDuty (critical), Slack (all), Email (summary)

### Alert Evaluation

- **Evaluation Interval**: 1 minute
- **Grouping**: By alert type, route, severity
- **Deduplication**: 5-minute window for same alert type

### Alert Response Time

- **Critical**: On-call engineer paged immediately
- **High**: Respond within 30 minutes
- **Medium**: Respond within 2 hours

## Alert Testing

### Test Alerts Monthly

- Manually trigger test alerts to verify:
  - Notification delivery
  - Runbook accessibility
  - Response time expectations
  - Escalation paths

### False Positive Reduction

- Review alert thresholds quarterly
- Adjust thresholds based on actual incident patterns
- Tune alert sensitivity based on noise level

