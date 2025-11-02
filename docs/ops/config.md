# Configuration Matrix

## Environment Variables

### Prompt Assembly Configuration

| Variable | Default | Production Recommended | Description |
|----------|---------|------------------------|-------------|
| `PROMPT_MODEL_DEFAULT` | `gpt-4o-mini` | `gpt-4o-mini` | Default AI model for prompt assembly |
| `PROMPT_TOKEN_BUDGET_DEFAULT` | `8000` | `8000` | Default token budget (tokens) |
| `PROMPT_BUDGET_WARN_PCT` | `0.9` | `0.9` | Warning threshold (90% of budget) |

**Validation**:
- `PROMPT_TOKEN_BUDGET_DEFAULT` must be > 0
- `PROMPT_BUDGET_WARN_PCT` must be between 0 and 1

### Test Transaction Configuration

| Variable | Default | Production Recommended | Description |
|----------|---------|------------------------|-------------|
| `TEST_TX_ENABLED` | `false` | `false` | Enable ephemeral test transactions |

**Security**: Must be `false` in production. Only enable in staging/dev.

### Debug Routes Configuration

| Variable | Default | Production Recommended | Description |
|----------|---------|------------------------|-------------|
| `DEBUG_ROUTES_ENABLED` | `false` | `false` | Enable developer debug routes |
| `DEBUG_ROUTES_TOKEN` | (none) | (none, or long random string if enabled) | Token required for debug route access |
| `DEBUG_ROUTES_RATELIMIT_PER_MIN` | `30` | `30` | Rate limit (requests/minute) for debug routes |

**Security**:
- `DEBUG_ROUTES_ENABLED=false` in production
- `DEBUG_ROUTES_TOKEN` must be set if `DEBUG_ROUTES_ENABLED=true`
- Token should be a long random string (32+ characters)

### Legacy Prompts Configuration

| Variable | Default | Production Recommended | Description |
|----------|---------|------------------------|-------------|
| `LEGACY_PROMPTS_ENABLED` | `false` | `false` | Enable legacy prompt assembly paths |
| `LEGACY_PROMPTS_SUNSET` | `2025-12-31` | `2025-12-31` | Sunset date for legacy prompts |

**Deprecation**:
- `LEGACY_PROMPTS_ENABLED=false` in production (default)
- Legacy routes return `410 Gone` when disabled
- See `docs/deprecations/legacy-prompts.md` for removal timeline

## Configuration Validation

### Startup Validation

**Required at Boot**:
- All environment variables with no defaults must be set
- Application fails fast (logs error and exits) if required vars missing

**Validation Logic**:
```typescript
// Example validation (implemented in config service)
if (DEBUG_ROUTES_ENABLED && !DEBUG_ROUTES_TOKEN) {
  console.error('ERROR: DEBUG_ROUTES_TOKEN required when DEBUG_ROUTES_ENABLED=true');
  process.exit(1);
}
```

### Recommended Production Values

```bash
# Prompt Configuration
PROMPT_MODEL_DEFAULT=gpt-4o-mini
PROMPT_TOKEN_BUDGET_DEFAULT=8000
PROMPT_BUDGET_WARN_PCT=0.9

# Test Transaction (must be false)
TEST_TX_ENABLED=false

# Debug Routes (must be false)
DEBUG_ROUTES_ENABLED=false

# Legacy Prompts (must be false)
LEGACY_PROMPTS_ENABLED=false
LEGACY_PROMPTS_SUNSET=2025-12-31
```

## Configuration Loading

### Config Service

Location: `backend/src/config/index.ts`

**Loading Order**:
1. Read from `process.env`
2. Apply defaults (if variable not set)
3. Validate required variables
4. Export typed config object

### Type Safety

All configuration values are typed:
- String values validated as non-empty (if required)
- Numeric values parsed and validated
- Boolean values normalized (`'true'` → `true`, etc.)

## Configuration Changes

### Deployment Process

1. **Update Environment Variables**: Set new values in deployment platform
2. **Restart Application**: Graceful restart to load new config
3. **Verify**: Check `/health` endpoint for config exposure (if implemented)
4. **Monitor**: Watch logs for any configuration-related errors

### Rollback

If configuration change causes issues:
1. Revert environment variables to previous values
2. Restart application
3. Verify functionality restored

## Configuration Documentation

### Adding New Variables

1. Add to config service (`backend/src/config/index.ts`)
2. Update this document with:
   - Variable name
   - Default value
   - Production recommended value
   - Description
   - Validation rules
3. Add validation logic if needed
4. Update startup validation if required

