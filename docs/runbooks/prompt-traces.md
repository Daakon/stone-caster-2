# Prompt Traces Runbook

## Overview

Prompt traces provide an optional audit trail for prompt assembly during game turns. Traces are stored in `prompting.prompt_traces` and are admin-only diagnostic data.

## Retention Policy

Traces are kept for 14 days by default. After 14 days, traces should be cleaned up to manage database growth.

### Manual Cleanup (Recommended Until Scheduler Configured)

Run this SQL manually or via a scheduled job:

```sql
DELETE FROM prompting.prompt_traces
WHERE created_at < NOW() - INTERVAL '14 days';
```

### Automated Cleanup (Future)

Once a scheduler is configured (e.g., pg_cron, Supabase Edge Functions, external cron), add a scheduled job:

```sql
-- Example pg_cron job (if pg_cron extension is enabled)
SELECT cron.schedule(
  'cleanup-prompt-traces',
  '0 2 * * *', -- Daily at 2 AM
  $$
    DELETE FROM prompting.prompt_traces
    WHERE created_at < NOW() - INTERVAL '14 days';
  $$
);
```

## Safety Checks

- **RLS**: Traces table has RLS enabled; only service role can access
- **Admin Guard**: API route `/api/dev/debug/traces/:gameId` requires admin role
- **Redaction**: All prompt snippets are redacted before storage
- **Capping**: Prompt snippets are capped to 2000 chars (configurable via `PROMPT_TRACING_MAX_SNIPPET`)
- **Opt-in**: Tracing is disabled by default (`PROMPT_TRACING_ENABLED=false`)

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `PROMPT_TRACING_ENABLED` | `false` | Enable trace writing |
| `PROMPT_TRACING_MAX_SNIPPET` | `2000` | Max chars for prompt snippet |

## Monitoring

Check trace growth:

```sql
SELECT 
  COUNT(*) as total_traces,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day') as last_24h,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_7d,
  pg_size_pretty(pg_total_relation_size('prompting.prompt_traces')) as table_size
FROM prompting.prompt_traces;
```

## Troubleshooting

### Traces not being written

1. Check `PROMPT_TRACING_ENABLED=true`
2. Verify user is admin role
3. Check logs for `[PROMPT_TRACE]` errors

### Traces table growing too large

1. Check retention policy (should be 14 days)
2. Run manual cleanup if automated job not configured
3. Consider reducing `PROMPT_TRACING_MAX_SNIPPET` if needed

