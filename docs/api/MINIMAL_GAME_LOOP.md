# Minimal Game Loop API Documentation

This document describes the three core API endpoints that form the minimal game loop: browse entry points, start games, and handle turns.

## Overview

The game loop consists of three main operations:
1. **Browse** - Discover available entry points (adventures, scenarios, etc.)
2. **Start** - Create a new game with entry_start bootstrap
3. **Turn** - Process player input and generate narrator responses

All endpoints respect Row-Level Security (RLS) policies and use the prompt assembler for consistent AI interactions.

## Authentication

All endpoints use Supabase authentication with RLS enforcement:
- **Anonymous users**: Can browse public entry points only
- **Authenticated users**: Can create and access their own games
- **Service role**: Full access for server-side operations

## Endpoints

### 1. GET /api/entry-points

Browse and search available entry points.

#### Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `query` | string | Free text search | `forest` |
| `world_id` | string | Filter by world | `world.mystika` |
| `type` | string | Comma-separated types | `scenario,sandbox` |
| `tags` | string | Comma-separated tags | `mystery,forest` |
| `limit` | number | Results per page (max 100) | `20` |
| `cursor` | string | Pagination cursor | `eyJzb3J0X3dlaWdodCI6...` |

#### Response Format

```json
{
  "items": [
    {
      "id": "ep.mystika.whispercross",
      "slug": "whispercross-forest",
      "type": "scenario",
      "title": "Whispercross Forest",
      "synopsis": "A spark in the trees.",
      "world_id": "world.mystika",
      "ruleset_id": "ruleset.classic_v1",
      "tags": ["mystery", "forest", "low-combat"],
      "content_rating": "safe"
    }
  ],
  "nextCursor": "eyJzb3J0X3dlaWdodCI6OTAsImNyZWF0ZWRfYXQiOiIyMDI0LTAxLTAyVDAwOjAwOjAwWiIsImlkIjoiZXAubXlzdGlrYS50ZW1wbGUifQ=="
}
```

#### Example Usage

```bash
# Basic search
curl "https://api.stonecaster.com/api/entry-points?limit=10"

# Filter by world and type
curl "https://api.stonecaster.com/api/entry-points?world_id=world.mystika&type=scenario"

# Text search with tags
curl "https://api.stonecaster.com/api/entry-points?query=forest&tags=mystery,low-combat"

# Pagination
curl "https://api.stonecaster.com/api/entry-points?cursor=eyJzb3J0X3dlaWdodCI6..."
```

#### RLS Behavior

- **Anonymous users**: See only `lifecycle='active'` AND `visibility='public'` entries
- **Authenticated users**: Same as anonymous (public catalog only)
- **Creators**: Can see their own drafts via separate endpoints

### 2. POST /api/games/start

Create a new game and get the first narrator turn.

#### Request Body

```json
{
  "entry_point_id": "ep.mystika.whispercross",
  "locale": "en-US"
}
```

#### Response Format

```json
{
  "game_id": "550e8400-e29b-41d4-a716-446655440000",
  "first_turn": {
    "idx": 1,
    "role": "narrator",
    "content": {
      "text": "The ancient forest whispers secrets as you step into the Whispering Woods..."
    },
    "prompt_meta": {
      "segmentIdsByScope": {
        "core": [1, 2],
        "ruleset": [3],
        "world": [4],
        "entry": [5],
        "entry_start": [6, 7],
        "npc": [8, 9],
        "game_state": [],
        "player": [],
        "rng": [],
        "input": []
      },
      "tokensEstimated": 1234,
      "truncated": {}
    }
  }
}
```

#### Example Usage

```bash
curl -X POST "https://api.stonecaster.com/api/games/start" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt-token>" \
  -d '{
    "entry_point_id": "ep.mystika.whispercross",
    "locale": "en-US"
  }'
```

#### Behavior

1. **Creates game record** with `owner_user_id = auth.uid()`
2. **Assembles prompt** with `isFirstTurn=true` and NPC args
3. **Generates narrator turn** using model adapter
4. **Sets bootstrap flag** `state.cold.flags.entry_bootstrapped=true`
5. **Increments turn count** to 1

#### Entry Start Bootstrap

The first turn includes special `entry_start` segments that provide:
- Opening scene description
- Initial atmosphere and mood
- First-time setup instructions

These segments are **only included on the first turn** and never appear again.

### 3. POST /api/games/:id/turns

Process player input and generate narrator response.

#### Request Body

```json
{
  "input": "I examine the ancient runes carefully.",
  "locale": "en-US"
}
```

#### Response Format

```json
{
  "turn": {
    "idx": 3,
    "role": "narrator",
    "content": {
      "text": "The runes glow faintly as you study them. They appear to be in an ancient language..."
    },
    "prompt_meta": {
      "segmentIdsByScope": {
        "core": [1, 2],
        "ruleset": [3],
        "world": [4],
        "entry": [5],
        "entry_start": [],
        "npc": [8, 9],
        "game_state": [10],
        "player": [11],
        "rng": [],
        "input": [12]
      },
      "tokensEstimated": 1456,
      "truncated": {}
    }
  }
}
```

#### Example Usage

```bash
curl -X POST "https://api.stonecaster.com/api/games/550e8400-e29b-41d4-a716-446655440000/turns" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt-token>" \
  -d '{
    "input": "I examine the ancient runes carefully.",
    "locale": "en-US"
  }'
```

#### Behavior

1. **Verifies game access** via RLS (user owns the game)
2. **Creates player turn** with user input
3. **Assembles prompt** with `isFirstTurn=false` and current game state
4. **Generates narrator response** using model adapter
5. **Increments turn count** by 2 (player + narrator)

#### Key Differences from Start

- **No entry_start**: Subsequent turns don't include entry_start segments
- **Includes game state**: Current game state is included in prompt
- **Includes player input**: User's input is included in prompt
- **NPC tier updates**: NPCs may have different tiers based on relationships

## NPC System Integration

### Tier-Based Content

NPCs have tiered content based on relationship values:

- **Tier 0**: Basic appearance and behavior
- **Tier 1**: Trust-based reveals (trust ≥ 20)
- **Tier 2**: Respect + warmth reveals (respect ≥ 25 & warmth ≥ 20)
- **Tier 3**: Romance + trust reveals (romance ≥ 30 & trust ≥ 30)

### Relationship Calculation

```typescript
const relationshipScore = trust + warmth + respect + romance + awe - fear;
const tier = Math.floor(relationshipScore / 40);
const clampedTier = Math.max(0, Math.min(3, tier));
```

### Budget Management

- **Global budget**: 8000 tokens (configurable)
- **NPC budget**: 600 tokens (configurable)
- **Truncation order**: input → game_state → NPC tiers → drop NPC block

## Model Integration

### Pluggable Adapters

The system uses a pluggable model adapter interface:

```typescript
interface ModelAdapter {
  generate(input: {
    prompt: string;
    maxTokens?: number;
    temperature?: number;
    stop?: string[];
  }): Promise<{
    text: string;
    tokensOut: number;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }>;
}
```

### Available Adapters

- **Mock Model**: For development and testing
- **OpenAI**: GPT-4, GPT-3.5-turbo
- **Anthropic**: Claude-3-sonnet, Claude-3-haiku
- **Custom**: Implement your own adapter

### Replacing the Mock Model

To use a real LLM, replace the mock model in your environment:

```typescript
// In your API handlers
import { openaiModel } from '../model/modelAdapter';

// Replace mockModel with openaiModel
const modelResponse = await openaiModel.generate({
  prompt,
  maxTokens: 1000,
  temperature: 0.7
});
```

## Error Handling

### Common Error Responses

```json
{
  "error": "Entry point not found",
  "message": "The requested entry point does not exist or is not accessible"
}
```

### HTTP Status Codes

- **200**: Success
- **201**: Created (game start, turn creation)
- **400**: Bad request (missing/invalid parameters)
- **401**: Unauthorized (authentication required)
- **403**: Forbidden (access denied)
- **404**: Not found (game/entry point not found)
- **405**: Method not allowed
- **500**: Internal server error

## Rate Limiting

- **Browse**: 100 requests per minute per IP
- **Start**: 10 games per hour per user
- **Turns**: 60 turns per hour per game

## Caching

### Static Content Cache

Core prompt segments (core, ruleset, world, entry) are cached by content hash to reduce latency:

```typescript
const cacheKey = `prompt:${contentHash}`;
const cached = await redis.get(cacheKey);
```

### Cache Invalidation

- **Entry points**: Invalidated when content changes
- **NPCs**: Invalidated when relationship tiers change
- **Games**: Invalidated when game state changes

## Monitoring and Telemetry

### Logged Metrics

- **Token usage**: prompt_tokens, completion_tokens, total_tokens
- **Latency**: Assembly time, model response time
- **NPC tiers**: Which tiers were included
- **Truncation**: What was truncated and why

### Example Log Entry

```json
{
  "timestamp": "2024-01-01T00:00:00Z",
  "game_id": "550e8400-e29b-41d4-a716-446655440000",
  "turn_idx": 3,
  "tokens_estimated": 1456,
  "npc_tiers": {
    "npc.mystika.kiera": 1,
    "npc.mystika.thorne": 0
  },
  "truncated": {
    "input_trimmed": { "fromChars": 500, "toChars": 300 }
  },
  "latency_ms": 1250
}
```

## Development and Testing

### Running Tests

```bash
# Run all API tests
npm test tests/api/

# Run specific test suite
npm test tests/api/entry_points.spec.ts
npm test tests/api/games.spec.ts
```

### Mock Data

The test suite includes comprehensive mock data for:
- Entry points with various types and tags
- NPCs with tiered content
- Game states and relationships
- Model responses

### Local Development

```bash
# Start development server
npm run dev

# Test endpoints locally
curl "http://localhost:3000/api/entry-points?limit=5"
```

## Security Considerations

### RLS Policies

- **Entry points**: Public read for active entries only
- **Games**: Owner-only access
- **Turns**: Owner-only access via game ownership
- **NPCs**: Public read for active NPCs

### Input Validation

- **Entry point IDs**: Must match existing active entries
- **Game IDs**: Must be valid UUIDs
- **Player input**: Sanitized and length-limited
- **Locale**: Validated against supported locales

### Rate Limiting

- **Per-user limits**: Prevent abuse
- **Per-IP limits**: Prevent DDoS
- **Per-game limits**: Prevent spam

## Future Enhancements

### Planned Features

- **Static content caching**: Reduce latency for core segments
- **Telemetry dashboard**: Monitor usage and performance
- **i18n support**: Localized prompt segments
- **Advanced search**: Full-text search with ranking
- **Real-time updates**: WebSocket support for live games

### Extension Points

- **Custom model adapters**: Implement your own LLM integration
- **Custom NPC logic**: Override tier calculation
- **Custom truncation**: Implement domain-specific truncation
- **Custom caching**: Add your own caching layer
