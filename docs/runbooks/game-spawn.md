# Runbook: Game Spawn Issues

## Symptoms

- 409 conflicts on `POST /api/games`
- Slow stored procedure execution (> 500ms)
- Idempotency key collisions
- Database deadlocks/timeouts
- High error rates on create-game endpoint

## Initial Checks

### 1. Check Stored Procedure Logs

```sql
-- Check for errors in recent spawn attempts
SELECT 
  error_code,
  error_message,
  COUNT(*) as count
FROM (
  -- Query spawn_game_v3_atomic logs or application logs
  -- This would typically come from application logs, not directly from DB
) 
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY error_code, error_message
ORDER BY count DESC;
```

### 2. Check for Deadlocks

```sql
-- PostgreSQL deadlock detection
SELECT 
  pid,
  now() - pg_stat_activity.query_start AS duration,
  query,
  state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes'
  AND state = 'active'
ORDER BY duration DESC;
```

### 3. Check Unique Constraint Violations

```sql
-- Check for (game_id, turn_number) violations
SELECT 
  game_id,
  COUNT(*) as duplicate_count
FROM turns
GROUP BY game_id, turn_number
HAVING COUNT(*) > 1;
```

### 4. Review Application Logs

```bash
# Search for spawn errors
grep -i "spawn.*error\|DB_CONFLICT\|IDEMPOTENCY_CONFLICT" /var/log/app/*.log | tail -50

# Check for stored procedure timeouts
grep -i "statement_timeout\|idle_in_transaction" /var/log/app/*.log | tail -50
```

## Actions

### Action 1: Rotate Idempotency Key Range

**If**: High idempotency key collision rate

**Steps**:
1. Temporarily change idempotency key generation algorithm (add timestamp suffix)
2. Monitor collision rate
3. Review key generation logic for uniqueness guarantees

### Action 2: Increase Statement Timeout

**If**: Stored procedure timeouts

**Steps**:
1. Increase `statement_timeout` in stored procedure:
   ```sql
   SET LOCAL statement_timeout = '30s';  -- Increase from 10s
   ```
2. Monitor execution times
3. Investigate slow queries (see Action 4)

### Action 3: Enable DEBUG Route Temporarily

**If**: Need to inspect prompt assembly or stored procedure behavior

**Steps**:
1. Set `DEBUG_ROUTES_ENABLED=true` (temporary, remove after debugging)
2. Set `DEBUG_ROUTES_TOKEN` to a secure random value
3. Use `GET /api/dev/debug/prompt-assembly` to inspect prompt building
4. Use `GET /api/dev/debug/game/:gameId/turns` to inspect game state
5. **IMPORTANT**: Disable debug routes after investigation

### Action 4: Investigate Slow Queries

**If**: Stored procedure taking > 500ms

**Steps**:
1. Run EXPLAIN ANALYZE on stored procedure:
   ```sql
   EXPLAIN ANALYZE
   SELECT * FROM spawn_game_v3_atomic(...);
   ```
2. Check index usage:
   ```sql
   SELECT indexname, idx_scan, idx_tup_read, idx_tup_fetch
   FROM pg_stat_user_indexes
   WHERE schemaname = 'public'
   ORDER BY idx_scan DESC;
   ```
3. Review slow query log (if enabled)

### Action 5: Check Connection Pool

**If**: Connection pool exhaustion

**Steps**:
1. Check active connections:
   ```sql
   SELECT count(*) FROM pg_stat_activity WHERE state = 'active';
   ```
2. Increase pool size if needed
3. Check for connection leaks (connections not released)

### Action 6: Handle High Concurrent Load

**If**: Deadlocks under high concurrency

**Steps**:
1. Implement request queuing/throttling
2. Review transaction isolation levels
3. Consider using advisory locks for critical sections
4. Add retry logic with exponential backoff

## Escalation

**Escalate if**:
- Error rate > 5% for > 15 minutes
- Database unresponsive
- Stored procedure consistently timing out
- Data corruption suspected

**Escalation Path**:
1. Notify on-call engineer
2. Engage database team if DB-related
3. Contact platform team if infrastructure issue

