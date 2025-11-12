# 🎲 Stonecaster

An AI-driven role-playing game platform featuring dynamic character creation, persistent game saves, world templates, and AI-powered storytelling with emotional continuity and NPC agency.

## 🌟 Features

- **🤖 AI-Powered Storytelling**: Dynamic narratives powered by OpenAI with emotional continuity
- **⚔️ Dynamic Character Creation**: Rich character customization with attributes, skills, and backstories
- **💾 Persistent Game Saves**: Your adventures are automatically saved and can be resumed anytime
- **🌍 World Templates**: Choose from fantasy, sci-fi, horror, and custom world settings
- **🎭 NPC Agency**: Non-player characters with personalities, goals, and evolving relationships
- **🎲 Structured Game Mechanics**: D20-based dice rolling system with skill checks
- **📱 Mobile-First Design**: Responsive interface optimized for all devices
- **♿ Accessibility**: WCAG 2.1 compliant with ARIA labels and keyboard navigation
- **🧪 Comprehensive Testing**: Unit tests with Vitest and E2E tests with Playwright

## 📋 API Pagination

The `GET /api/games/:id/turns` endpoint supports cursor-based pagination:

- **Query Parameters:**
  - `afterTurn` (optional): Return turns after this turn number
  - `limit` (optional, default: 20, max: 100): Number of turns to return

- **Response Format:**
  ```json
  {
    "ok": true,
    "data": {
      "turns": [...],
      "next": { "afterTurn": 20 }  // Only present if more turns exist
    }
  }
  ```

- **Example:**
  ```bash
  # First page
  GET /api/games/{gameId}/turns?limit=20
  
  # Next page
  GET /api/games/{gameId}/turns?afterTurn=20&limit=20
  ```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Supabase project (for OAuth)

### Setup

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   
   Create `frontend/.env`:
   ```bash
   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-key>
   ```
   
   Create `backend/.env.local`:
   ```bash
   SUPABASE_URL=https://<your-project-ref>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   OPENAI_API_KEY=<your-openai-key>
   SESSION_SECRET=<generate-a-random-secret>
   ```
   
   **Note**: `WEB_BASE_URL` and `API_BASE_URL` have defaults for development (`http://localhost:5173` and `http://localhost:3000`), but Supabase variables are required for OAuth.

3. **Start development servers:**
   ```bash
   npm run dev
   ```

   This starts both frontend (port 5173) and backend (port 3000).

See [docs/auth.md](./docs/auth.md) for detailed authentication configuration.

## 🏗️ Architecture

### Monorepo Structure

```
stone-caster-2/
├── frontend/          # React + Vite frontend
├── backend/           # Node + Express API
├── shared/            # Shared types and utilities
├── supabase/          # Database migrations
└── docs/              # Documentation
```

### Tech Stack

**Frontend:**
- React 19 with TypeScript
- Vite for fast builds
- React Router for navigation
- TanStack Query for data fetching
- Zustand for state management
- Vitest + Playwright for testing

**Backend:**
- Node.js + Express
- TypeScript
- Supabase for database and auth
- OpenAI for AI storytelling
- Zod for validation

**Infrastructure:**
- Supabase for PostgreSQL database
- Cloudflare Workers for frontend deployment
- Fly.io for backend deployment

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Supabase account
- OpenAI API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Daakon/stone-caster-2.git
cd stone-caster-2
```

2. Install dependencies:
```bash
npm install
```

### Early Access Setup

The application supports an Early Access mode with role-based access control.

#### Environment Variables

Set the `EARLY_ACCESS_MODE` flag in both environments:

**Backend (Fly.io):**
```bash
flyctl secrets set EARLY_ACCESS_MODE=on
```

**Frontend Worker (Cloudflare):**
```bash
wrangler secret put EARLY_ACCESS_MODE
# Enter: on
```

#### Database Migration

Run the Phase 0 migration to create the profiles table:

```bash
# Apply migration via Supabase CLI or dashboard
supabase db push
```

#### Creating an Admin User

See [supabase/seed/README.md](./supabase/seed/README.md) for detailed instructions on:
- Creating the first admin user
- Promoting users to early access
- Managing roles via SQL

Quick admin setup:
```sql
-- After creating a user via Supabase Auth
UPDATE public.profiles
SET role = 'admin',
    approved_by = id,
    approval_note = 'Initial admin setup'
WHERE id = '<user-uuid>';
```

3. Set up environment variables:

**Backend** (`backend/.env`):
```env
PORT=3000
NODE_ENV=development
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4-turbo-preview
CORS_ORIGIN=http://localhost:5173
```

**Frontend** (`frontend/.env`):
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:3000
```

4. Set up Supabase:
```bash
# Run the migration
# In Supabase SQL Editor, execute: supabase/migrations/001_initial_schema.sql
```

5. Start development servers:
```bash
# Start both frontend and backend
npm run dev

# Or start individually
npm run dev --workspace=frontend
npm run dev --workspace=backend
```

The frontend will be available at `http://localhost:5173` and the backend at `http://localhost:3000`.

## 🧪 Testing

### Unit Tests

```bash
# Run all tests
npm test

# Run frontend tests
npm test --workspace=frontend

# Run backend tests
npm test --workspace=backend

# Run with coverage
npm test -- --coverage
```

### E2E Tests

```bash
# Install Playwright browsers (first time only)
npx playwright install

# Run E2E tests
npm run test:e2e --workspace=frontend

# Run in UI mode
npx playwright test --ui
```

## 🔨 Building

```bash
# Build all packages
npm run build

# Build frontend only
npm run build --workspace=frontend

# Build backend only
npm run build --workspace=backend
```

## 📦 Deployment

### Frontend (Cloudflare Workers)

1. Install Wrangler CLI:
```bash
npm install -g wrangler
```

2. Login to Cloudflare:
```bash
wrangler login
```

3. Deploy:
```bash
cd frontend
npm run build
wrangler deploy
```

### Backend (Fly.io)

1. Install Fly CLI:
```bash
curl -L https://fly.io/install.sh | sh
```

2. Login to Fly:
```bash
fly auth login
```

3. Deploy:
```bash
cd backend
fly launch  # First time only
fly deploy
```

## 🎮 Usage

### Creating a Character

1. Sign up or sign in
2. Navigate to "My Characters"
3. Click "Create New Character"
4. Choose race, class, and attributes
5. AI will generate a backstory suggestion

### Starting an Adventure

1. Select a character from your list
2. Choose a world template (Fantasy, Sci-Fi, Horror, etc.)
3. Start your adventure!

### Playing the Game

- Type actions in the input field
- The AI Game Master responds with narrative
- Use suggested actions for quick responses
- Your progress is automatically saved

## 🎨 Game Mechanics

### Attributes
- Strength, Dexterity, Constitution
- Intelligence, Wisdom, Charisma
- Each ranges from 1-20

### Dice Rolling
- D20-based system
- Advantage/Disadvantage support
- Automatic skill checks

### Story System
- Dynamic narrative generation
- Emotional continuity tracking
- NPC relationship management
- World state persistence

## ♿ Accessibility Features

- ARIA labels and roles throughout
- Keyboard navigation support
- Screen reader friendly
- High contrast mode support
- Reduced motion support
- Focus indicators
- Mobile-first responsive design

## 📚 API Documentation

### Characters
- `GET /api/characters` - List characters
- `GET /api/characters/:id` - Get character
- `POST /api/characters` - Create character
- `PUT /api/characters/:id` - Update character
- `DELETE /api/characters/:id` - Delete character

### Game Saves
- `GET /api/games` - List game saves
- `GET /api/games/:id` - Get game save
- `POST /api/games` - Create game save (Phase 3.1)
- `PUT /api/games/:id` - Update game save
- `DELETE /api/games/:id` - Delete game save

#### POST /api/games - Create Game (Phase 3.1)

**Request Format:**
```json
{
  "entry_point_id": "string (required)",
  "world_id": "uuid (required)",
  "entry_start_slug": "string (required)",
  "scenario_slug": "string | null (optional)",
  "ruleset_slug": "string (optional, defaults to entry point's primary ruleset)",
  "model": "string (optional, defaults to PROMPT_MODEL_DEFAULT)",
  "characterId": "uuid (optional)",
  "idempotency_key": "string (optional, can also use Idempotency-Key header)"
}
```

**Idempotency:**
- Provide `Idempotency-Key` header or `idempotency_key` in body to ensure safe retries
- Duplicate requests with the same key return the same response (200 OK) without creating a duplicate game

**Success Response (201 Created):**
```json
{
  "ok": true,
  "data": {
    "game_id": "uuid",
    "first_turn": {
      "turn_number": 1,
      "role": "narrator",
      "content": "string (assembled prompt)",
      "meta": {
        "included": ["core:slug@version", "ruleset:slug@version", ...],
        "dropped": ["scenario:slug@version", "npc:slug@version", ...],
        "policy": ["SCENARIO_POLICY_UNDECIDED", "SCENARIO_DROPPED", "NPC_DROPPED"],
        "model": "gpt-4o-mini",
        "worldId": "uuid",
        "rulesetSlug": "string",
        "scenarioSlug": "string | null",
        "entryStartSlug": "string",
        "tokenEst": {
          "input": 7500,
          "budget": 8000,
          "pct": 0.9375
        },
        "pieces": [
          {
            "scope": "core",
            "slug": "core-system",
            "version": "1.0.0",
            "tokens": 500
          },
          ...
        ]
      },
      "created_at": "2025-02-04T12:00:00Z"
    }
  },
  "meta": {
    "traceId": "uuid"
  }
}
```

**Error Response Format:**
```json
{
  "ok": false,
  "error": {
    "code": "ENTRY_START_NOT_FOUND | SCENARIO_NOT_FOUND | RULESET_NOT_FOUND | WORLD_MISMATCH | IDEMPOTENCY_CONFLICT | DB_CONFLICT | VALIDATION_FAILED",
    "message": "Human-readable error message",
    "details": {
      "fieldErrors": [
        { "field": "entry_start_slug", "message": "entry_start_slug is required" }
      ]
    }
  },
  "meta": {
    "traceId": "uuid"
  }
}
```

**Metadata Notes:**
- **Pieces Order:** Deterministic order: `core → ruleset → world → scenario? → entry → npc`
- **Policy Flags:**
  - `SCENARIO_POLICY_UNDECIDED`: Token usage ≥90% of budget (warning, no drop)
  - `SCENARIO_DROPPED`: Scenario segment dropped due to budget
  - `NPC_DROPPED`: One or more NPC segments dropped due to budget
- **Protected Segments:** `core`, `ruleset`, and `world` are never dropped
- **Token Budget:** Configured via `PROMPT_TOKEN_BUDGET_DEFAULT` (default: 8,000 tokens)

**Standardized Error Codes:**
- `ENTRY_START_NOT_FOUND`: Entry start slug not found in prompt_segments
- `SCENARIO_NOT_FOUND`: Scenario slug not found or invalid
- `RULESET_NOT_FOUND`: Ruleset slug not found or inactive
- `WORLD_NOT_FOUND`: World UUID not found in world_id_mapping
- `WORLD_MISMATCH`: Character and entry point world mismatch
- `IDEMPOTENCY_CONFLICT`: Idempotency key conflict (should not happen)
- `DB_CONFLICT`: Unique constraint violation (game_id, turn_number)
- `VALIDATION_FAILED`: Request validation failed (with fieldErrors in details)

**Example:**
```bash
# Create game with idempotency
curl -X POST http://localhost:3000/api/games \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: my-unique-key-123" \
  -d '{
    "entry_point_id": "test-entry-point-1",
    "world_id": "00000000-0000-0000-0000-000000000001",
    "entry_start_slug": "test-entry-start-1",
    "scenario_slug": "test-scenario-1",
    "ruleset_slug": "default"
  }'
```

### World Templates
- `GET /api/worlds` - List world templates
- `GET /api/worlds/:id` - Get world template
- `POST /api/worlds` - Create world template

### Developer Debug Routes (Feature-Flagged)

⚠️ **WARNING: For developer use only. Do not enable in public environments.**

Debug routes are only available when `DEBUG_ROUTES_ENABLED=true` and require a valid `X-Debug-Token` header matching `DEBUG_ROUTES_TOKEN`.

#### GET /api/dev/debug/prompt-assembly

Inspect prompt assembly without hitting the model or writing to DB.

**Query Parameters:**
- `world_id` (uuid, required) - World UUID
- `entry_start_slug` (string, required) - Entry start segment slug
- `scenario_slug` (string, optional) - Scenario slug
- `ruleset_slug` (string, optional) - Ruleset slug
- `model` (string, optional) - Model identifier
- `budget` (number, optional) - Token budget override

**Response:**
```json
{
  "ok": true,
  "data": {
    "promptPreview": "<first 400 chars>...",
    "promptLength": 7523,
    "pieces": [
      { "scope": "core", "slug": "core-system", "version": "1.0.0", "tokens": 500 },
      ...
    ],
    "meta": {
      "included": ["core:slug@version", "ruleset:slug@version", ...],
      "dropped": ["scenario:slug@version", "npc:slug@version", ...],
      "policy": ["SCENARIO_POLICY_UNDECIDED", "SCENARIO_DROPPED", "NPC_DROPPED"],
      "tokenEst": { "input": 7123, "budget": 8000, "pct": 0.89 },
      "model": "gpt-4o-mini",
      "worldId": "uuid",
      "rulesetSlug": "default",
      "scenarioSlug": null,
      "entryStartSlug": "test-entry-start"
    }
  }
}
```

**Common Failures:**
- `SCENARIO_DROPPED`: Scenario segment dropped due to budget. Tune by increasing `PROMPT_TOKEN_BUDGET_DEFAULT` or reducing scenario content length.
- `NPC_DROPPED`: One or more NPC segments dropped. Same tuning options as scenario.
- `SCENARIO_POLICY_UNDECIDED`: Token usage ≥90% of budget (warning only, no drop).

**Example:**
```bash
curl -H "X-Debug-Token: your-token-here" \
  "http://localhost:3000/api/dev/debug/prompt-assembly?world_id=00000000-0000-0000-0000-000000000001&entry_start_slug=test-entry-start"
```

#### GET /api/dev/test/prompt-preview

Preview prompts for a game without executing them. Works for both start (initial) and turn modes.

**Query Parameters:**
- `gameId` (uuid, required) - Game ID
- `mode` (string, optional) - Preview mode: `start` (default) or `turn`
- `turnNumber` (number, required for `mode=turn`) - Turn number to preview
- `playerMessage` (string, optional) - Simulate user message
- `model` (string, optional) - Override model
- `budgetTokens` (number, optional) - Override token budget

**Headers:**
- `X-Debug-Token` (required) - Debug token matching `DEBUG_ROUTES_TOKEN`
- `X-Test-Rollback: 1` (optional) - Use ephemeral transaction (requires `TEST_TX_ENABLED=true`)

**Response:**
```json
{
  "ok": true,
  "data": {
    "prompt": "Full assembled prompt text...",
    "pieces": [
      { "scope": "core", "slug": "core-system", "version": "1.0.0", "tokens": 500 },
      ...
    ],
    "meta": {
      "included": ["core:slug@version", "ruleset:slug@version", ...],
      "dropped": ["scenario:slug@version", "npc:slug@version", ...],
      "policy": ["SCENARIO_DROPPED", "NPC_DROPPED"],
      "tokenEst": { "input": 7123, "budget": 8000, "pct": 0.89 },
      "model": "gpt-4o-mini",
      "worldId": "uuid",
      "rulesetSlug": "default",
      "scenarioSlug": null,
      "entryStartSlug": "test-entry-start",
      "phase": "start"
    },
    "context": {
      "gameId": "uuid",
      "turnNumber": null,
      "playerMessage": null
    }
  },
  "meta": {
    "traceId": "uuid",
    "testRollback": false
  }
}
```

**Examples:**

Preview a START prompt (dev route; no persistence if test rollback):
```bash
curl -sS "http://localhost:3000/api/dev/test/prompt-preview?gameId=<GAME_UUID>&mode=start" \
  -H "X-Debug-Token: $DEBUG_ROUTES_TOKEN" \
  -H "X-Test-Rollback: 1" | jq .
```

Preview a TURN 3 prompt simulating a message:
```bash
curl -sS "http://localhost:3000/api/dev/test/prompt-preview?gameId=<GAME_UUID>&mode=turn&turnNumber=3&playerMessage=Hello" \
  -H "X-Debug-Token: $DEBUG_ROUTES_TOKEN" \
  -H "X-Test-Rollback: 1" | jq .
```

**CLI variant (runs locally, prints a report):**
```bash
# Preview start prompt
pnpm tsx backend/scripts/prompt-preview.ts --game <GAME_UUID> --mode start

# Preview turn prompt
pnpm tsx backend/scripts/prompt-preview.ts --game <GAME_UUID> --mode turn --turn 2 --message "test"
```

The CLI script prints a concise report with:
- Header showing phase, model, and token estimates
- Included/dropped pieces by scope
- First 400 characters of the prompt
- Exit code 0 on success, non-zero on failure

#### GET /api/dev/debug/game/:gameId/turns

Inspect turn stream for a game with slimmed metadata. Returns ordered turn list with `turn_number`, `role`, `created_at`, and slimmed meta (policy, tokenEst, pieces.length). Does not include full content.

**Response:**
```json
{
  "ok": true,
  "data": {
    "gameId": "uuid",
    "turns": [
      {
        "turn_number": 1,
        "role": "narrator",
        "created_at": "2025-02-04T12:00:00Z",
        "meta": {
          "policy": [],
          "tokenEst": { "input": 7123, "budget": 8000, "pct": 0.89 },
          "piecesCount": 6,
          "includedCount": 6,
          "droppedCount": 0
        }
      },
      ...
    ],
    "count": 10
  }
}
```

### Legacy Prompts (Deprecated)

⚠️ **DEPRECATED: These routes are deprecated and will be retired on 2025-12-31.**

#### POST /api/games/:id/initial-prompt

**Status:** Deprecated (default: returns 410 Gone)

**Migration:** Use `POST /api/games` with Phase 3 format instead.

**Behavior:**

- **Default (LEGACY_PROMPTS_ENABLED=false):** Returns `410 Gone` with error code `LEGACY_ROUTE_RETIRED`
  ```json
  {
    "ok": false,
    "error": {
      "code": "LEGACY_ROUTE_RETIRED",
      "message": "This legacy route has been retired. Use POST /api/games with Phase 3 format instead."
    },
    "meta": {
      "migration": {
        "newEndpoint": "POST /api/games",
        "docs": "https://github.com/your-org/stone-caster/blob/main/docs/API_CONTRACT.md#create-game"
      }
    }
  }
  ```

- **When enabled (LEGACY_PROMPTS_ENABLED=true):** Returns `200 OK` with deprecation headers:
  - `Deprecation: true`
  - `Sunset: 2025-12-31`
  - `Link: <docs-url>; rel="deprecation"`
  
  Normal response body with structured log entry:
  ```json
  {
    "event": "legacy.prompt.used",
    "route": "/api/games/:id/initial-prompt",
    "gameId": "...",
    "userId": "...",
    "sunset": "2025-12-31"
  }
  ```

**Note:** `LEGACY_PROMPTS_ENABLED` is temporary and will be removed after the sunset date. All clients should migrate to Phase 3 game creation.

### Ongoing Turns (V2 Pipeline)

Ongoing turn prompts (player replies after game start) now use the same V2 assembler (`assemblePromptV2`) as game creation, ensuring consistent scope ordering, budget policy, and metadata semantics. Turn rows persist full assembler metadata (`meta` field) with `included`, `dropped`, `policy`, `tokenEst`, and `pieces` arrays in deterministic order.

### Frontend Game Creation (Phase 5)

**V3 Create Game API:**
- `POST /api/games` with `entry_point_id`, `world_id`, `entry_start_slug`, optional `scenario_slug`, `ruleset_slug`, `model`
- Idempotency: Generate v4 UUID and pass via `Idempotency-Key` header
- Dev Mode: Enable "Ephemeral Test Mode" toggle (when `VITE_TEST_TX_HEADER_ENABLED=true`) to test with automatic rollback

**Turns Pagination:**
- `GET /api/games/:id/turns?afterTurn=<number>&limit=<number>` returns `{ turns, next?: { afterTurn } }`
- Frontend `TurnsList` component handles pagination with "Load more" button
- Policy chips displayed on narrator/system turns: "Scenario dropped", "NPC trimmed", "Budget warn"

**Policy/Meta Display:**
- `PromptMetaBar` component shows token usage progress, included pieces by scope, dropped pieces, and policy actions
- Visible on first turn (narrator/system) with full metadata
- Accessible via keyboard navigation and ARIA labels

### Story Actions
- `POST /api/story` - Process story action

### Dice
- `POST /api/dice` - Roll dice
- `POST /api/dice/multiple` - Roll multiple dice

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 📄 License

ISC

## 🔗 Links

- [Supabase Documentation](https://supabase.com/docs)
- [OpenAI API](https://platform.openai.com/docs)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)

## 🙏 Acknowledgments

- OpenAI for powering the AI storytelling
- Supabase for the backend infrastructure
- The open-source community

---

Built with ❤️ for tabletop RPG enthusiasts
