# StoneCaster Configuration Spine

This document describes the configuration system implemented for StoneCaster, providing a single source of truth for all runtime configuration.

## Overview

The configuration spine consists of:
- **Database tables** for storing configuration values
- **Config service** for loading and managing configuration
- **API endpoint** for public configuration access
- **Hot-reload** mechanism for configuration updates
- **ETag-based caching** for efficient client-side caching

## Database Schema

### Configuration Tables

#### `app_config`
General application configuration with type validation.
```sql
key TEXT PRIMARY KEY
value JSONB NOT NULL
type TEXT NOT NULL CHECK (type IN ('string', 'number', 'boolean', 'json'))
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

#### `pricing_config`
Pricing and economy settings.
```sql
key TEXT PRIMARY KEY
value JSONB NOT NULL
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

#### `ai_config`
AI model and prompt configuration.
```sql
key TEXT PRIMARY KEY
value JSONB NOT NULL
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

#### `feature_flags`
Feature toggles with optional payload.
```sql
key TEXT PRIMARY KEY
enabled BOOLEAN NOT NULL DEFAULT FALSE
payload JSONB NOT NULL DEFAULT '{}'::jsonb
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

#### `config_meta`
Versioning and ETag support (single row).
```sql
id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE)
version BIGINT NOT NULL DEFAULT 1
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

## Configuration Service

### Usage


```typescript
import { configService } from './services/config.service.js';

// Ensure configuration is ready before reading values
await configService.whenReady();

// Get configuration sections
const pricing = configService.getPricing();
const ai = configService.getAi();
const app = configService.getApp();
const features = configService.getFeatures();

// Get ETag for caching
const etag = configService.getEtag();

// Get public DTO (safe for client consumption)
const publicConfig = configService.toPublicDTO();

// Force refresh configuration when needed
await configService.refreshNow();
```

### TypeScript Interfaces

```typescript
interface PricingConfig {
  turnCostDefault: number;
  turnCostByWorld: Record<string, number>;
  guestStarterCastingStones: number;
  guestDailyRegen: number;
  conversionRates: { shard: number; crystal: number; relic: number };
}

interface AiRuntimeConfig {
  activeModel: string;
  promptSchemaVersion: string;
  maxTokensIn: number;
  maxTokensOut: number;
}

interface AppRuntimeConfig {
  cookieTtlDays: number;
  idempotencyRequired: boolean;
  allowAsyncTurnFallback: boolean;
  telemetrySampleRate: number;
  drifterEnabled: boolean;
}

interface FeatureFlag {
  key: string;
  enabled: boolean;
  payload: Record<string, unknown>;
}
```

## API Endpoint

### GET /api/config

Returns public configuration with ETag-based caching.

**Headers:**
- `If-None-Match`: ETag from previous response

**Response:**
- `200 OK`: Configuration data with ETag header
- `304 Not Modified`: When ETag matches
- `Cache-Control: public, max-age=15`

**Example Response:**
```json
{
  "etag": "abc123def456...",
  "pricing": {
    "turnCostDefault": 2,
    "turnCostByWorld": {},
    "conversionRates": {
      "shard": 10,
      "crystal": 100,
      "relic": 500
    }
  },
  "features": [
    {
      "key": "stones_show_guest_pill",
      "enabled": true,
      "payload": {}
    }
  ],
  "ai": {
    "promptSchemaVersion": "1.0.0"
  },
  "app": {
    "drifterEnabled": true
  }
}
```

## Environment Variables

Required environment variables:
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anon key for public client operations
- `SUPABASE_SERVICE_KEY`: Supabase service role key
- `OPENAI_API_KEY`: OpenAI API key
- `PRIMARY_AI_MODEL`: Primary AI model identifier
- `SESSION_SECRET`: Session encryption secret
- `CORS_ORIGIN`: Allowed origin for the public API (defaults to http://localhost:5173)

## Hot Reload

The configuration service automatically polls for changes every 15 seconds by checking the `config_meta.version` field. When the version changes:

1. All configuration tables are reloaded
2. ETag is recomputed
3. In-memory cache is updated
4. No server restart required

To trigger a reload:
1. Update any configuration value in the database
2. Increment `config_meta.version`
3. Changes will be picked up within 15 seconds

## Setup and Usage

### 1. Run Migrations
```bash
npm run setup-config
```

### 2. Start Server
```bash
npm run dev
```

### 3. Test Configuration
```bash
# Test API endpoint
curl -i http://localhost:3000/api/config

# Test ETag caching
curl -i http://localhost:3000/api/config -H "If-None-Match: <ETAG>"

# Run verification script
npm run verify-config
```

### 4. Run Tests
```bash
npm test
```

## Security Considerations

- **No RLS**: Configuration tables don't have Row Level Security (future step will decide client access)
- **Server-only access**: All configuration access is through the server
- **Public DTO filtering**: The public API endpoint only exposes safe configuration values
- **No secrets in public config**: Sensitive values like API keys and model names are never exposed

## Baseline Configuration

The system comes with safe baseline values:

### Pricing Config
- `turn_cost_default`: 2
- `turn_cost_by_world`: {}
- `guest_starter_casting_stones`: 15
- `guest_daily_regen`: 0
- `conversion_rates`: { shard: 10, crystal: 100, relic: 500 }

### AI Config
- `active_model`: "PRIMARY_AI_MODEL"
- `prompt_schema_version`: "1.0.0"
- `max_tokens_in`: 4096
- `max_tokens_out`: 1024

### App Config
- `cookie_ttl_days`: 60
- `idempotency_required`: true
- `allow_async_turn_fallback`: true
- `telemetry_sample_rate`: 1.0
- `drifter_enabled`: true

### Feature Flags
- `stones_show_guest_pill`: true
- `drifter_onboarding`: true
- `ws_push_enabled`: false

## Testing

The configuration system includes comprehensive tests:

- **Unit tests**: Config service functionality
- **API tests**: Endpoint behavior and ETag handling
- **Hot-reload tests**: Version polling and configuration updates
- **Integration tests**: End-to-end verification

Run tests with:
```bash
npm test
```

## Future Enhancements

- Admin UI for configuration management
- WebSocket notifications for config changes
- Configuration validation schemas
- Audit logging for configuration changes
- Rollback capabilities



