# Release Checklist

## Pre-Deployment

### Database Migrations

- [ ] All migrations reviewed and tested in staging
- [ ] `turns.meta` NOT NULL constraint verified (migration `20250205_ensure_turns_meta_not_null.sql`)
- [ ] `turn_number` trigger in place and tested
- [ ] Migration rollback scripts documented
- [ ] Backup taken before migration (if schema change)

### Feature Flags

- [ ] `DEBUG_ROUTES_ENABLED=false` in production
- [ ] `TEST_TX_ENABLED=false` in production (or `true` only for staging)
- [ ] `LEGACY_PROMPTS_ENABLED=false` in production
- [ ] All feature flags verified via `/health` endpoint

### Code Review

- [ ] All tests passing (unit, integration, e2e)
- [ ] No linter errors
- [ ] Documentation updated (FEATURES.md, API_CONTRACT.md, etc.)
- [ ] Security review completed (no secrets in logs, RLS verified)

### Configuration

- [ ] Environment variables validated (see `docs/ops/config.md`)
- [ ] Required env vars present at boot (fail fast on missing)
- [ ] Config matrix reviewed for production values

## Deployment

### Staging Deployment

- [ ] Deploy to staging environment
- [ ] Run smoke tests (`pnpm test:e2e:ci`)
- [ ] Run k6 smoke test (see `ops/load/`)
- [ ] Verify metrics export working
- [ ] Check logs for errors

### Production Deployment

- [ ] Deployment window scheduled (low-traffic period if possible)
- [ ] Canary deployment plan ready (see Canary Plan below)
- [ ] Rollback plan documented and tested
- [ ] On-call engineer notified

## Canary Plan

### Phase 1: 5% Traffic (30 minutes)

**Route 5% of production traffic to new version**

**Watch Metrics:**
- Error rate (5xx) < 0.5%
- Create-game latency p95 < 600ms
- Get-turns latency p95 < 200ms
- Policy distribution (no unexpected drops)

**Health Check**: Run `scripts/canary-health.sh` every 5 minutes

**If Issues:**
- Immediate rollback
- Investigate logs
- Fix and retry

### Phase 2: 25% Traffic (30 minutes)

**If Phase 1 healthy, increase to 25%**

**Watch Metrics:**
- Same as Phase 1
- Monitor database connection pool usage
- Watch for deadlocks/contention

### Phase 3: 100% Traffic

**If Phase 2 healthy, ramp to 100%**

**Monitor for 2 hours:**
- All SLO metrics
- Error rates
- Latency percentiles
- User-reported issues

### Canary Health Script

Run `scripts/canary-health.sh` to check:
- Error rate < 0.5%
- p95 latency within SLO
- No 5xx errors in last 5 minutes
- Exit code 0 = healthy, non-zero = unhealthy

**Usage:**
```bash
./scripts/canary-health.sh
# Or with custom thresholds:
ERROR_RATE_THRESHOLD=0.005 P95_THRESHOLD=600 ./scripts/canary-health.sh
```

## Post-Deployment

### Verification (First 24 Hours)

- [ ] All endpoints responding correctly
- [ ] Metrics dashboard showing expected values
- [ ] No error rate spikes
- [ ] Latency within SLO
- [ ] Idempotency working (no duplicate games)
- [ ] Pagination working correctly

### Monitoring

- [ ] Set up alerts (if automated deployment)
- [ ] Review logs for anomalies
- [ ] Check user feedback channels
- [ ] Monitor error budget consumption

### Documentation

- [ ] Update release notes
- [ ] Document any deployment issues
- [ ] Update runbooks if new patterns discovered

## Rollback Procedure

### Immediate Rollback Triggers

- Error rate > 1% for 5 minutes
- p95 latency > 2x SLO for 10 minutes
- Database connection pool exhaustion
- User-reported critical bugs

### Rollback Steps

1. **Stop Canary**: Route 100% traffic back to previous version
2. **Verify**: Check health endpoint, confirm traffic routing
3. **Investigate**: Review logs, identify root cause
4. **Fix**: Apply fixes in staging, re-test
5. **Re-deploy**: Retry canary process after fixes

### Rollback Validation

- Verify old version handling traffic correctly
- Confirm error rates return to normal
- Check user-facing features working

