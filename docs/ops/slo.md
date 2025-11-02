# Operational SLOs & Error Budget

## Service Level Objectives (SLOs)

### Availability SLO

**Target: 99.9% for create-game and get-turns endpoints**

- **Measurement Window**: Rolling 30-day period
- **Calculation**: `(total_requests - 5xx_errors) / total_requests >= 0.999`
- **Alert Threshold**: Availability drops below 99.9% for 5 minutes
- **Remediation**: Pause feature rollouts, investigate root cause, apply fixes

### Latency SLOs

**Targets:**
- **create-game**: p95 < 600ms
- **get-turns** (cache warm): p95 < 200ms

**Measurement:**
- p95 latency calculated over 1-minute windows
- Separate tracking for cold vs warm cache states
- Alert threshold: p95 exceeds SLO for 10 consecutive minutes

**Remediation:**
- Review slow queries (EXPLAIN ANALYZE)
- Check database index usage
- Consider connection pooling adjustments
- Review stored procedure performance

### Error SLO

**Target: < 0.5% 5xx errors on both endpoints**

- **Measurement**: Percentage of 5xx responses vs total requests
- **Alert Threshold**: 5xx rate > 1% for 5 minutes
- **Remediation**: Immediate investigation, check application logs, database health

## Error Budget Policy

### Budget Allocation

- **Availability Budget**: 0.1% downtime allowed (8.76 hours per year)
- **Error Budget**: 0.5% 5xx errors allowed
- **Latency Budget**: p95 violations < 10% of requests

### Budget Breach Response

1. **On Breach**: Pause all feature rollouts
2. **Focus**: 100% team effort on remediation
3. **Investigation**: Root cause analysis (RCA) within 2 hours
4. **Fix**: Deploy hotfix within 24 hours if possible
5. **Documentation**: Update runbooks with learnings

### Budget Reset

- Error budgets reset at the start of each calendar month
- Carry-over of breached budget to next month if significant (< 0.05% remaining)

## Metrics Collection

- **Source**: Application logs, metrics service, load balancer logs
- **Aggregation**: 1-minute windows, rolling 30-day calculations
- **Reporting**: Daily SLO summary dashboard

