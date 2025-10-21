# CHAT_RUNBOOK (Gemini JSON-only, non-streaming)

**Date**: 2025-01-21  
**Phase**: 0 - Config & Safety  
**Status**: Active

---

## Environment Setup

### 1. Copy Environment Template

Copy `.env.example` to `.env.local` (or `.env` for development):

```bash
cp .env.example .env.local
```

### 2. Configure Required Variables

Set the following in your `.env.local`:

```bash
# === Model Provider (Gemini JSON-only) ===
MODEL_PROVIDER=gemini
MODEL_NAME=gemini-1.5-pro
GEMINI_API_KEY=<your-api-key-here>  # âš ï¸ Rotate if key was ever shared

# === Generation defaults (non-streaming) ===
MODEL_JSON_STRICT=1
MODEL_TIMEOUT_MS=30000
MODEL_MAX_TOKENS=800
MODEL_TEMPERATURE=0.7

# === Chat quotas ===
CHAT_DAILY_TOKENS_CAP=50000

# === App basics ===
NODE_ENV=development
```

### 3. Get a Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and paste it into `GEMINI_API_KEY` in `.env.local`

---

## Sanity Checks

Before running the application, verify your setup:

### Check for Hardcoded Secrets

```bash
npm run scan:secrets
```

**Expected output**: `âœ“ OK: no obvious hardcoded API keys found.`

**If secrets found**: Remove them immediately and use environment variables instead.

### Verify Environment Configuration

```bash
npm run verify:env
```

**Expected output**:
```
[env] MODEL_PROVIDER: gemini
[env] MODEL_NAME: gemini-1.5-pro
[env] TIMEOUT(ms): 30000
[env] MAX_TOKENS: 800
[env] DAILY_CAP: 50000
[env] JSON_STRICT: on
[env] TEMPERATURE: 0.7
âœ“ OK: environment validated.
```

**If errors**: Check that all required variables are set in `.env.local`.

---

## Behavior

### Non-Streaming JSON-Only

- **Non-streaming**: Server computes prompt, calls Gemini once, expects **strict JSON** response
- **No token streaming**: Client shows "processing..." indicator until complete response received
- **JSON validation**: All responses validated against `TurnResponseSchema` before processing
- **Timeout**: Requests abort after 30 seconds (configurable via `MODEL_TIMEOUT_MS`)

### Request Flow

```
Client â†’ POST /api/games/:id/turns
  â†“
Server assembles prompt (core â†’ ruleset â†’ world â†’ entry â†’ npc â†’ game_state â†’ player â†’ rng â†’ input)
  â†“
Call Gemini API with response_format: json
  â†“
Gemini returns strict JSON (one payload, no streaming)
  â†“
Validate JSON against TurnResponseSchema
  â†“
Apply deltas (relationships, flags, state)
  â†“
Persist turns + costs + metadata
  â†“
Server â†’ Client: Full narrator turn response
```

### Next Phases

- **Phase 1**: Implement Gemini adapter (`generateJson`)
- **Phase 2**: Wire `/api/games/:id/turns` to Gemini adapter
- **Phase 3**: Add JSON schema validation and error handling
- **Phase 4**: Update UI for non-streaming UX
- **Phase 5**: Add telemetry and cost tracking
- **Phase 6**: Production hardening (moderation, quotas, monitoring)

---

## Safety & Security

### Secrets Management

âš ï¸ **CRITICAL**: Do not commit `.env*` files (except `.env.example`)

- Store production keys in environment managers:
  - Supabase: Environment Variables
  - Vercel: Environment Variables
  - Railway: Environment Variables
  - AWS: Secrets Manager
  - GCP: Secret Manager

### Key Rotation

If a key was ever:
- Committed to git
- Shared in chat/email
- Exposed in logs
- Stored in plaintext

â†’ **Rotate immediately** at [Google AI Studio](https://makersuite.google.com/app/apikey)

### Pre-commit Checks

Add to your git pre-commit hook:

```bash
#!/bin/bash
npm run scan:secrets || exit 1
npm run verify:env || exit 1
```

---

## Troubleshooting

### Error: `Missing required env var: GEMINI_API_KEY`

**Cause**: Environment variable not set or still set to `__REPLACE_ME__`

**Fix**: Set valid API key in `.env.local`

### Error: `Only 'gemini' is supported in this build`

**Cause**: `MODEL_PROVIDER` set to something other than `gemini`

**Fix**: Set `MODEL_PROVIDER=gemini` in `.env.local`

### Error: `GEMINI_API_KEY is invalid`

**Cause**: API key is malformed or revoked

**Fix**: Generate new key at [Google AI Studio](https://makersuite.google.com/app/apikey)

### Timeout Errors

**Cause**: Request taking longer than `MODEL_TIMEOUT_MS`

**Fix**: 
1. Increase `MODEL_TIMEOUT_MS` in `.env.local` (e.g., `45000` for 45 seconds)
2. Check prompt size (may be too large)
3. Verify Gemini API status

### Rate Limit Errors

**Cause**: Exceeded Gemini API quota

**Fix**:
1. Check quota at [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Reduce `CHAT_DAILY_TOKENS_CAP` to stay within limits
3. Implement request throttling (Phase 6)

---

## Configuration Reference

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MODEL_PROVIDER` | Yes | `gemini` | Model provider (must be `gemini`) |
| `MODEL_NAME` | No | `gemini-1.5-pro` | Gemini model variant |
| `GEMINI_API_KEY` | Yes | - | Gemini API key from Google AI Studio |
| `MODEL_JSON_STRICT` | No | `1` | Force JSON-only responses (1=on, 0=off) |
| `MODEL_TIMEOUT_MS` | No | `30000` | Request timeout in milliseconds |
| `MODEL_MAX_TOKENS` | No | `800` | Maximum output tokens per request |
| `MODEL_TEMPERATURE` | No | `0.7` | Sampling temperature (0.0-1.0) |
| `CHAT_DAILY_TOKENS_CAP` | No | `50000` | Daily token quota per user |
| `NODE_ENV` | No | `development` | Application environment |

### Model Variants

- `gemini-1.5-pro`: Best quality, higher cost
- `gemini-1.5-flash`: Faster, lower cost (not yet tested)

---

## References

- [CHAT_AUDIT.md](./CHAT_AUDIT.md) - Codebase readiness audit
- [CHAT_GAP_PLAN.md](./CHAT_GAP_PLAN.md) - Implementation plan
- [JSON_PROTOCOL.md](./JSON_PROTOCOL.md) - JSON schema specification
- [Google AI Studio](https://makersuite.google.com/app/apikey) - API key management
- [Gemini API Docs](https://ai.google.dev/docs) - Official documentation
