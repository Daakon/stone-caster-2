# Worker Early Access Toggle Guide

## Quick Toggle Steps

### Option 1: Update wrangler.toml and Deploy

1. **Edit `wrangler.toml`**:
   ```toml
   [vars]
   EARLY_ACCESS_MODE = "off"  # or "on"
   ```

2. **Deploy**:
   ```bash
   npx wrangler deploy --config wrangler.toml
   ```

### Option 2: Cloudflare Dashboard

1. Navigate to **Workers & Pages** → Your Worker (`stone-caster`)
2. Go to **Settings** → **Variables**
3. Find `EARLY_ACCESS_MODE` variable
4. Set value to `on` or `off`
5. Click **Save**
6. The change takes effect immediately (no redeploy needed for variable changes)

### Option 3: Wrangler CLI (Temporary)

For temporary changes without editing files:

```bash
# Set variable
npx wrangler secret put EARLY_ACCESS_MODE

# Enter value: "off" or "on"
```

**Note**: This stores it as a secret. For persistent vars, use `wrangler.toml` `[vars]` section.

## Verify Change

### Check Worker Variable

```bash
# View current vars
npx wrangler whoami
npx wrangler deployments list
```

### Test Worker Behavior

1. **Navigate to protected route** (e.g., `/play`)
2. **Expected when `on`**: Redirect to `/request-access` (if not authorized)
3. **Expected when `off`**: Page loads normally

### Check Worker Logs

```bash
# View recent logs
npx wrangler tail --format pretty
```

Look for:
- `[EarlyAccess]` log messages
- `ea_redirect` telemetry events
- `role_cache_hit/miss` events

## Environment-Specific Toggles

### Development (Local)

Set in `.env` or `.dev.vars`:
```bash
EARLY_ACCESS_MODE=off
```

Then run:
```bash
npx wrangler dev
```

### Staging/Preview

Update `wrangler.toml`:
```toml
[env.staging]
[vars]
EARLY_ACCESS_MODE = "on"
```

Deploy to staging:
```bash
npx wrangler deploy --env staging --config wrangler.toml
```

### Production

1. Update `wrangler.toml`:
   ```toml
   [vars]
   EARLY_ACCESS_MODE = "on"
   ```

2. Deploy:
   ```bash
   npx wrangler deploy --config wrangler.toml
   ```

## Troubleshooting

### Variable Not Taking Effect

1. **Check variable name**: Must be `EARLY_ACCESS_MODE` (case-sensitive)
2. **Redeploy**: Variable changes in `wrangler.toml` require redeploy
3. **Clear cache**: Worker may cache env vars briefly

### Can't Access Dashboard

1. Verify Cloudflare account permissions
2. Check Worker is in correct account
3. Use CLI method instead

### Deployment Fails

1. Check `wrangler.toml` syntax
2. Verify Cloudflare API token has permissions
3. Check network connectivity

## Quick Reference

```bash
# Toggle ON
echo 'EARLY_ACCESS_MODE = "on"' >> wrangler.toml && npx wrangler deploy

# Toggle OFF  
echo 'EARLY_ACCESS_MODE = "off"' >> wrangler.toml && npx wrangler deploy

# Check current value
grep EARLY_ACCESS_MODE wrangler.toml
```

