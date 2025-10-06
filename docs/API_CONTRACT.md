# Stone Caster API Contract

## Overview

This document defines the API contract for Stone Caster, including endpoints, request/response formats, authentication, and error handling. The API supports both guest users (cookie-based) and authenticated users (JWT-based).

## Base URL

- **Development**: `http://localhost:3001`
- **Production**: `https://api.stonecaster.com`

## Authentication

### Guest Authentication
Guest users are authenticated using browser cookies:
- **Cookie Name**: `guestId`
- **Cookie Properties**: HttpOnly, Secure (in production), SameSite=Lax
- **Header Alternative**: `x-guest-cookie-id` header
- **Session Duration**: 1 year

### Authenticated User Authentication
Authenticated users use JWT tokens:
- **Header**: `Authorization: Bearer <jwt-token>`
- **Token Source**: Supabase Auth
- **Token Validation**: Server-side JWT verification

## Common Response Format

All API responses follow this format:

```typescript
interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta: {
    traceId: string;
    timestamp: string;
  };
}
```

## Error Codes

```typescript
enum ApiErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  NOT_FOUND = 'NOT_FOUND',
  INSUFFICIENT_STONES = 'INSUFFICIENT_STONES',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UPSTREAM_TIMEOUT = 'UPSTREAM_TIMEOUT',
  INVALID_PACK = 'INVALID_PACK',
  PAYMENT_FAILED = 'PAYMENT_FAILED'
}
```

## Endpoints

### Games

#### POST /api/games
Spawn a new game.

**Authentication**: Guest or Authenticated

#### GET /api/games
List active adventures for the current owner (used by the `/my-adventures` UI).

**Authentication**: Guest cookie (`guestId` or `X-Guest-Cookie-Id`) or authenticated user token

**Query Params**:
- `limit` (optional, default 20)
- `offset` (optional, default 0)

**Response**: `GameListDTO[]` sorted by `lastPlayedAt` descending.

**Request Body**:
```typescript
interface CreateGameRequest {
  adventureId: string;
  characterId?: string; // Optional for guest users
}
```

**Response** (201):
```typescript
interface GameDTO {
  id: string;
  adventureId: string;
  adventureTitle: string;
  adventureDescription: string;
  characterId?: string;
  characterName?: string;
  worldSlug: string;
  worldName: string;
  turnCount: number;
  status: 'active' | 'completed' | 'paused';
  createdAt: string;
  updatedAt: string;
  lastPlayedAt: string;
}
```

**Error Responses**:
- `400`: Validation failed
- `401`: Authentication required
- `422`: Invalid adventure or character

#### GET /api/games/:id
Fetch a single game by ID.

**Authentication**: Guest or Authenticated

**Response** (200):
```typescript
interface GameDetailDTO extends GameDTO {
  currentScene: {
    id: string;
    title: string;
    description: string;
    options: GameOption[];
  };
  history: TurnDTO[];
}
```

**Error Responses**:
- `401`: Authentication required
- `404`: Game not found

#### POST /api/games/:id/turn
Submit a turn for a game.

**Authentication**: Guest or Authenticated

**Headers**:
- `Idempotency-Key`: Required for duplicate request prevention

**Request Body**:
```typescript
interface GameTurnRequest {
  optionId: string;
}
```

**Response** (200):
```typescript
interface TurnDTO {
  id: string;
  game_id: string;
  option_id: string;
  ai_response: {
    narrative: string;
    emotion: string;
    suggestedActions: string[];
  };
  created_at: string;
}
```

**Error Responses**:
- `400`: Insufficient stones, invalid option, or validation failed
- `401`: Authentication required
- `404`: Game not found
- `409`: Duplicate request (idempotency)

### Wallet & Stones

#### GET /api/wallet
Get user's wallet balance.

**Authentication**: Guest or Authenticated

**Response** (200):
```typescript
interface StoneWallet {
  id: string;
  userId: string;
  castingStones: number;
  inventoryShard: number;
  inventoryCrystal: number;
  inventoryRelic: number;
  createdAt: string;
  updatedAt: string;
}
```

#### POST /api/wallet/spend
Spend casting stones (internal use).

**Authentication**: Guest or Authenticated

**Request Body**:
```typescript
interface SpendStonesRequest {
  amount: number;
  idempotencyKey: string;
  gameId: string;
  reason: string;
}
```

**Response** (200):
```typescript
interface SpendResult {
  success: boolean;
  newBalance: number;
  error?: string;
  message?: string;
}
```

### Adventures

#### GET /api/adventures
List available adventures.

**Authentication**: None required

**Response** (200):
```typescript
interface AdventureDTO {
  id: string;
  slug: string;
  title: string;
  description?: string;
  worldSlug: string;
  worldName: string;
  tags: string[];
  scenarios: string[];
}
```

#### GET /api/adventures/:id
Get adventure details by ID.

**Authentication**: None required

**Response** (200):
```typescript
interface AdventureDetailDTO extends AdventureDTO {
  // Same as AdventureDTO for now
}
```

#### GET /api/adventures/slug/:slug
Get adventure details by slug.

**Authentication**: None required

**Response** (200):
```typescript
interface AdventureDetailDTO extends AdventureDTO {
  // Same as AdventureDTO for now
}
```

### Characters

#### GET /api/characters
List user's characters.

**Authentication**: Authenticated only

**Response** (200):
```typescript
interface CharacterDTO {
  id: string;
  name: string;
  class: string;
  level: number;
  stats: CharacterStats;
  backstory: string;
  createdAt: string;
  updatedAt: string;
}
```

#### POST /api/characters
Create a new character.

**Authentication**: Authenticated only

**Request Body**:
```typescript
interface CreateCharacterRequest {
  name: string;
  class: string;
  stats: CharacterStats;
  backstory: string;
}
```

### Stone Packs

#### GET /api/stones/packs
List available stone packs for purchase.

**Authentication**: None required

**Response** (200):
```typescript
interface StonePackDTO {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  stones_shard: number;
  stones_crystal: number;
  stones_relic: number;
  bonus_shard: number;
  bonus_crystal: number;
  bonus_relic: number;
  isActive: boolean;
}
```

#### POST /api/stones/purchase
Create a checkout session for stone pack purchase.

**Authentication**: Authenticated only

**Request Body**:
```typescript
interface PurchaseStonesRequest {
  packId: string;
}
```

**Response** (200):
```typescript
interface CheckoutSession {
  sessionUrl: string;
}
```

## Layer P0 Specific Endpoints

### Guest Game Flow

The following endpoints specifically support guest users:

#### Guest Game Spawning
- **Endpoint**: `POST /api/games`
- **Authentication**: Guest cookie or `x-guest-cookie-id` header
- **Behavior**: Creates new guest ID if none exists, sets guest cookie
- **Response**: Standard GameDTO with `characterId: undefined` for guests

#### Guest Game Fetching
- **Endpoint**: `GET /api/games/:id`
- **Authentication**: Guest cookie or `x-guest-cookie-id` header
- **Behavior**: Returns game data for guest users without 401 errors
- **Response**: Standard GameDetailDTO

#### Guest Turn Submission
- **Endpoint**: `POST /api/games/:id/turn`
- **Authentication**: Guest cookie or `x-guest-cookie-id` header
- **Behavior**: Processes turns for guest users, spends stones from guest wallet
- **Error Handling**: Returns `INSUFFICIENT_STONES` error when guest has no stones

### Guest Wallet Operations

#### Guest Wallet Creation
- **Automatic**: Guest wallets are created automatically on first game spawn
- **Starter Stones**: New guests receive starter casting stones (configurable amount)
- **Persistence**: Guest wallets persist across browser sessions

#### Guest Stone Spending
- **Internal Endpoint**: `WalletService.spendCastingStones()`
- **Parameters**: Includes `isGuest: boolean` parameter
- **Behavior**: Uses guest-specific wallet lookup and ledger recording
- **Idempotency**: Supports idempotency keys for duplicate request prevention

### Worlds

#### GET /api/worlds
List available worlds.

**Authentication**: None required

**Response** (200):
```typescript
interface WorldDTO {
  id: string;
  name: string;
  title?: string;
  tagline?: string;
  description: string;
  genre: 'fantasy' | 'scifi' | 'horror' | 'mystery' | 'historical' | 'modern' | 'custom';
  setting: string;
  themes: string[];
  availableRaces: string[];
  availableClasses: string[];
  rules: {
    allowMagic: boolean;
    allowTechnology: boolean;
    difficultyLevel: 'easy' | 'medium' | 'hard' | 'deadly';
    combatSystem: 'd20' | 'narrative' | 'custom';
  };
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}
```

#### GET /api/worlds/:id
Get world details by ID.

**Authentication**: None required

**Response** (200):
```typescript
interface WorldDetailDTO extends WorldDTO {
  // Same as WorldDTO for now
}
```

### Wallet/Stones

#### GET /api/stones/wallet
Get user's stone wallet balance.

**Authentication**: Guest cookie or JWT token

**Response** (200):
```typescript
interface StonesWalletDTO {
  shard: number;
  crystal: number;
  relic: number;
  dailyRegen: number;
  lastRegenAt?: string;
  balance: number; // Frontend compatibility field
}
```

## Error Handling

### Standard Error Response
```typescript
interface ErrorResponse {
  ok: false;
  error: ApiErrorCode;
  message: string;
  details?: any;
  meta: {
    traceId: string;
    timestamp: string;
  };
}
```

### Common Error Scenarios

#### Authentication Errors
- **401 Unauthorized**: No valid authentication provided
- **403 Forbidden**: Valid authentication but insufficient permissions

#### Validation Errors
- **400 Bad Request**: Invalid request data
- **422 Unprocessable Entity**: Valid format but invalid business logic

#### Resource Errors
- **404 Not Found**: Requested resource doesn't exist
- **409 Conflict**: Resource conflict (e.g., duplicate idempotency key)

#### Business Logic Errors
- **400 Insufficient Stones**: User doesn't have enough casting stones
- **400 Invalid Option**: Selected game option is not valid
- **500 Internal Error**: Unexpected server error

## Rate Limiting

- **Default**: 100 requests per minute per IP
- **Turn Submission**: 10 requests per minute per user
- **Game Spawning**: 5 requests per minute per user

## Idempotency

Critical operations support idempotency keys:
- **Game Turn Submission**: Prevents duplicate turns
- **Stone Spending**: Prevents duplicate charges
- **Game Spawning**: Prevents duplicate games

**Header**: `Idempotency-Key: <unique-key>`

## CORS

- **Allowed Origins**: Configured per environment
- **Methods**: GET, POST, PUT, DELETE, OPTIONS
- **Headers**: Authorization, Content-Type, Idempotency-Key, x-guest-cookie-id

## Versioning

- **Current Version**: v1
- **Version Header**: `API-Version: v1`
- **Backward Compatibility**: Maintained for at least 6 months

## Monitoring & Observability

- **Trace IDs**: All requests include unique trace IDs
- **Structured Logging**: JSON-formatted logs with correlation IDs
- **Metrics**: Request counts, response times, error rates
- **Health Checks**: `/health` endpoint for system status






