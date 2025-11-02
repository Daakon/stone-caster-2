# Release Checklist

## v3 Canary Deployment

### Pre-Deployment

- [ ] Run `pnpm canary:env-check` - verify config consistency
- [ ] Run `pnpm ops:explain-v3` - verify query performance (p95/p99)
- [ ] Verify SLO thresholds: `SLO_SPAWN_P95_MS=600`, `SLO_TURN_P95_MS=200`
- [ ] Verify `PROMPT_TRACING_ENABLED=false` (default off)
- [ ] Run `pnpm seed:v3` to populate test fixtures (if needed)

### Deployment

- [ ] Deploy backend to Fly.io
- [ ] Verify `/api/health/ready` returns 200 with all checks passing
- [ ] Check cache stats via `/api/dev/debug/cache-stats` (should show entries after first request)
- [ ] Run k6 smoke test: `k6 run ops/load/v3-spawn.js --vus 1 --duration 10s`

### Post-Deployment

- [ ] Monitor SLO violations in logs (should see `[SLO_VIOLATION]` if p95 exceeds thresholds)
- [ ] Verify metrics are recording: check `/api/dev/debug/metrics` (if exposed)
- [ ] Verify cache is working: multiple spawns should show cache hits
- [ ] Test debug payload: create game with `?debug=1`, verify `Cache-Control: no-store`
- [ ] Verify trace writes (if enabled): check `prompting.prompt_traces` table

### Rollback Plan

- [ ] Set `V3_ENABLED=false` (if feature flag exists) or revert to previous version
- [ ] Clear cache: `pnpm ops:cache-stats` then manually clear if needed
- [ ] Verify legacy prompts still work (if fallback exists)
