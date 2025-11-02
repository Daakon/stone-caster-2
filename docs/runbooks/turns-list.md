# Runbook: Turns List Issues

## Symptoms

- Slow pagination queries (> 200ms)
- High 5xx error rate on `GET /api/games/:id/turns`
- Timeouts on turns list requests
- Missing turns or incorrect ordering

## Initial Checks

### 1. Verify Index Presence

```sql
-- Check if index exists on (game_id, turn_number)
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'turns'
  AND indexdef LIKE '%game_id%'
  AND indexdef LIKE '%turn_number%';
```

**Expected**: Index `idx_turns_game_turn_number` or similar

### 2. Run EXPLAIN ANALYZE

```sql
-- Test pagination query performance
EXPLAIN ANALYZE
SELECT * FROM turns
WHERE game_id = 'your-game-id'
  AND turn_number > 0
ORDER BY turn_number ASC
LIMIT 50;
```

**Check for**:
- Index scan (not sequential scan)
- Execution time < 50ms for typical queries
- No "Buffer: shared hit" warnings

### 3. Check Query Patterns

```sql
-- Find slow pagination queries
SELECT 
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE query LIKE '%turns%'
  AND query LIKE '%turn_number%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### 4. Check for QPS Spikes

**Review application metrics**:
- Requests per second for `/api/games/:id/turns`
- Correlation with latency spikes
- Time-of-day patterns

### 5. Verify Turn Ordering

```sql
-- Check for missing or duplicate turn_numbers
SELECT 
  game_id,
  MIN(turn_number) as min_turn,
  MAX(turn_number) as max_turn,
  COUNT(*) as turn_count,
  COUNT(DISTINCT turn_number) as unique_turns
FROM turns
WHERE game_id = 'your-game-id'
GROUP BY game_id;
```

**Expected**: `turn_count == unique_turns`

## Actions

### Action 1: Raise Limit Cap

**If**: High QPS causing contention, but queries are fast individually

**Steps**:
1. Increase default `limit` parameter (currently max 100)
2. Review client-side pagination behavior
3. Monitor impact on database load

**Note**: Only if index is performing well (< 50ms per query)

### Action 2: Add CDN Cache for Immutable Pages

**If**: High read traffic, turns are immutable after creation

**Steps**:
1. Cache first page (turns 1-50) with TTL = 1 hour
2. Cache subsequent pages with longer TTL (turns rarely change)
3. Invalidate cache on new turn creation
4. Monitor cache hit rate

**Implementation**:
- Use Cloudflare Workers cache or similar
- Cache key: `/api/games/:id/turns?afterTurn=X&limit=50`
- Cache-Control: `public, max-age=3600`

### Action 3: Fix Missing Index

**If**: EXPLAIN shows sequential scan

**Steps**:
1. Create index (if missing):
   ```sql
   CREATE INDEX CONCURRENTLY idx_turns_game_turn_number 
   ON turns (game_id, turn_number ASC);
   ```
2. Verify index usage:
   ```sql
   EXPLAIN ANALYZE
   SELECT * FROM turns
   WHERE game_id = 'test'
     AND turn_number > 0
   ORDER BY turn_number ASC
   LIMIT 50;
   ```
3. Monitor query performance improvement

### Action 4: Optimize Query Parameters

**If**: Queries slow even with index

**Steps**:
1. Review `afterTurn` cursor usage (ensure clients using it)
2. Check for queries without `game_id` filter (should never happen)
3. Consider composite index if filtering by other fields

### Action 5: Handle Connection Pool Exhaustion

**If**: High QPS causing connection pool issues

**Steps**:
1. Increase connection pool size
2. Implement query result caching (Redis/Memcached)
3. Add request rate limiting per client
4. Consider read replicas for turn queries

### Action 6: Fix Turn Ordering Issues

**If**: Missing or duplicate turn_numbers

**Steps**:
1. Backfill missing turn_numbers:
   ```sql
   -- This should be handled by trigger, but if not:
   UPDATE turns t1
   SET turn_number = sub.row_num
   FROM (
     SELECT id, ROW_NUMBER() OVER (PARTITION BY game_id ORDER BY created_at, id) as row_num
     FROM turns
     WHERE turn_number IS NULL
   ) sub
   WHERE t1.id = sub.id;
   ```
2. Fix duplicates (keep lowest ID):
   ```sql
   DELETE FROM turns t1
   WHERE EXISTS (
     SELECT 1 FROM turns t2
     WHERE t2.game_id = t1.game_id
       AND t2.turn_number = t1.turn_number
       AND t2.id < t1.id
   );
   ```
3. Verify trigger is working:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname LIKE '%turn_number%';
   ```

## Monitoring

### Key Metrics to Watch

- **Query Latency**: p95 < 200ms
- **Index Usage**: > 95% of queries using index
- **Error Rate**: < 0.5% 5xx
- **Cache Hit Rate**: > 80% (if CDN cache enabled)

### Alert Thresholds

- p95 latency > 200ms for 10 minutes → Alert
- 5xx error rate > 1% for 5 minutes → Alert
- Sequential scans detected → Alert

## Escalation

**Escalate if**:
- Index missing and cannot be created (blocking migration)
- Data corruption (duplicate/missing turn_numbers)
- Database unresponsive
- Error rate > 5% for > 15 minutes

**Escalation Path**:
1. Notify on-call engineer
2. Engage database team
3. Consider read-only mode if severe

