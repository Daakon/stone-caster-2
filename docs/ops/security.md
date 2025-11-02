# Security & Data Operations

## Database Security

### SECURITY DEFINER Functions

**Stored Procedures**: `spawn_game_v3_atomic` uses `SECURITY DEFINER`

**Security Review**:
- Function limited to `INSERT` operations on `games` and `turns` tables only
- No dynamic SQL execution
- No access to sensitive system tables
- Timeout guards in place (`statement_timeout`, `idle_in_transaction_session_timeout`)

**Recommendations**:
- Regular audit of function permissions
- Review function changes in code review
- Document any future functions using `SECURITY DEFINER`

### Row Level Security (RLS)

**Current Posture**: Service role used for API operations

**RLS Policies**:
- API uses Supabase service role (bypasses RLS for backend operations)
- Client-facing queries should enforce RLS (if user-scoped data)
- Verify RLS policies on `games` and `turns` tables if user-owned

**Best Practices**:
- Service role only for API backend operations
- User role for client queries (enforces RLS)
- Regular review of RLS policies for coverage gaps

## Dev Debug Routes

### Token Management

**Configuration**:
- `DEBUG_ROUTES_ENABLED=false` in production (default)
- `DEBUG_ROUTES_TOKEN` required if enabled (long random string)
- Token rotated quarterly or on security events

**Access Control**:
- Routes require `X-Debug-Token` header matching `DEBUG_ROUTES_TOKEN`
- Rate limiting: 30 requests/minute per token (configurable via `DEBUG_ROUTES_RATELIMIT_PER_MIN`)
- Log all debug route access for audit trail

### Security Considerations

- **PII Redaction**: Debug responses redact API keys, secrets, PII
- **Rate Limiting**: Prevents abuse and enumeration attacks
- **IP Whitelist**: Consider adding IP whitelist for production debug routes (if enabled)

## Backups

### Daily Logical Backups

**Schedule**: Daily at 2:00 AM UTC (low-traffic period)

**Scope**:
- Full database dump (`pg_dump`)
- Include all tables: `games`, `turns`, `entry_points`, `idempotency_keys`
- Exclude: temp tables, logs

**Retention**: 30 days

**Verification**:
- Weekly restore test to verify backup integrity
- Test restore time < 1 hour for full database

### Weekly Physical Snapshots

**Schedule**: Weekly on Sunday at 3:00 AM UTC

**Scope**:
- Filesystem-level snapshot (if using managed Postgres)
- Point-in-time recovery capability
- Full database state

**Retention**: 12 weeks

**Storage**:
- Off-site backup storage (S3, GCS, etc.)
- Encrypted at rest
- Access-controlled

### Backup Testing

- **Monthly**: Full restore test in staging environment
- **Document**: Restore procedure and RTO/RPO targets

## PII Handling

### Data Classification

**Turns Meta Field**:
- `turns.meta` JSONB column contains prompt assembly metadata
- **No PII expected**: Only technical metadata (included pieces, policy actions, token estimates)
- **Redaction**: Any accidental API keys/secrets redacted in debug responses

### PII Review Process

**Quarterly Review**:
1. Audit `turns.meta` for accidental PII
2. Review logs for sensitive data leakage
3. Check error messages for PII exposure
4. Verify redaction in debug routes

**If PII Found**:
1. Immediate redaction/removal
2. Audit logs for exposure period
3. Document incident and remediation
4. Update runbooks with prevention measures

## Access Control

### API Authentication

- JWT tokens for authenticated requests
- Guest cookies for unauthenticated users
- Idempotency keys for request deduplication (not authentication)

### Database Access

- **Production**: Service role only, no direct user access
- **Staging**: Limited developer access (read-only for non-admins)
- **Audit**: Log all database connection attempts

## Security Monitoring

### Log Review

**Daily**:
- Review error logs for security-related patterns
- Check for unusual access patterns
- Monitor debug route usage (should be zero in production)

**Weekly**:
- Review authentication failures
- Check for privilege escalation attempts
- Audit feature flag changes

### Incident Response

**Security Incident Procedure**:
1. Immediate containment (disable affected features if needed)
2. Investigate scope and impact
3. Remediate (patch, rotate secrets, revoke access)
4. Document incident and lessons learned
5. Update security documentation

