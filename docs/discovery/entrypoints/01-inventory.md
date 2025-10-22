# Entry Points Inventory

## Overview
This document inventories all user chat entry points across the Stone Caster codebase, including Adventures, Scenarios, and Sandbox modes.

## Entry Point Types Identified

### 1. Adventures (Legacy + AWF)
**Location**: Multiple implementations
- **Legacy Adventures**: `supabase/migrations/011_m2_games_schema.sql` (lines 5-16)
- **AWF Adventures**: `supabase/migrations/20250119_awf_adventures.sql`
- **Admin UI**: `frontend/src/pages/admin/AwfAdventuresAdmin.tsx`
- **API Routes**: `backend/src/routes/admin.ts` (lines 1039-1094)

**Key Fields**:
- Legacy: `id`, `slug`, `title`, `description`, `world_slug`, `tags`, `scenarios`, `is_active`
- AWF: `id`, `world_ref`, `version`, `doc` (JSONB), `hash`

### 2. Scenarios (AWF)
**Location**: AWF bundle system
- **Schema**: `supabase/migrations/20250129_awf_scenarios.sql`
- **Admin UI**: `frontend/src/pages/admin/AwfScenariosAdmin.tsx`
- **Player UI**: `frontend/src/pages/player/ScenarioPicker.tsx`
- **API Routes**: `backend/src/routes/admin.ts` (lines 1474-1525)

**Key Fields**:
- `id`, `version`, `doc` (JSONB with scenario metadata)
- Document structure: `world_ref`, `adventure_ref`, `scenario.display_name`, `scenario.tags`

### 3. Sandbox Mode
**Location**: Referenced in multiple files but implementation unclear
- **Mentioned in**: `frontend/src/pages/player/ScenarioPicker.tsx` (line 3 comment)
- **Related**: `docs/Product Design/stone_caster_chat_system_mvp.md`
- **Status**: Appears to be planned but not fully implemented

## Database Tables

### Core Tables
1. **adventures** (Legacy)
   - Primary key: `id` (UUID)
   - Fields: `slug`, `title`, `description`, `world_slug`, `tags`, `scenarios`, `is_active`
   - Indexes: slug, world_slug, is_active

2. **adventures** (AWF)
   - Primary key: `(id, version)` (TEXT)
   - Fields: `world_ref`, `doc` (JSONB), `hash`
   - Indexes: world_ref, created_at, id

3. **scenarios** (AWF)
   - Primary key: `(id, version)` (TEXT)
   - Fields: `doc` (JSONB)
   - Indexes: id, world_ref (from doc), adventure_ref (from doc), tags (GIN)

4. **worlds** (AWF)
   - Primary key: `(id, version)` (TEXT)
   - Fields: `doc` (JSONB), `hash`
   - Indexes: created_at, id

### Supporting Tables
- **games**: Active game instances
- **turns**: Individual game turns
- **characters**: Player characters
- **user_profiles**: User management

## API Endpoints

### Adventure Endpoints
- `GET /api/admin/awf/adventures` - List adventures
- `POST /api/admin/awf/adventures` - Create/update adventure
- `DELETE /api/admin/awf/adventures/:id/:version` - Delete adventure

### Scenario Endpoints
- `GET /api/player/scenarios` - List public scenarios
- `POST /api/player/games/start` - Start game from scenario
- `GET /api/admin/awf/scenarios` - List scenarios (admin)
- `POST /api/admin/awf/scenarios` - Create/update scenario

### Game Start Endpoints
- `POST /api/player/games/start` - Start from scenario
- `POST /api/games/:id/auto-initialize` - Auto-initialize game

## Frontend Components

### Listing/Browse Components
- `frontend/src/pages/player/ScenarioPicker.tsx` - Main scenario picker
- `frontend/src/pages/admin/AwfAdventuresAdmin.tsx` - Adventure admin
- `frontend/src/pages/admin/AwfScenariosAdmin.tsx` - Scenario admin

### Game Start Components
- `frontend/src/hooks/useStartAdventure.ts` - Adventure start logic
- `frontend/src/pages/CharacterSelectionPage.tsx` - Character selection
- `frontend/src/pages/UnifiedGamePage.tsx` - Game interface

## Search and Filtering

### Scenario Picker Features
- Text search across `display_name`, `synopsis`, `tags`
- World filtering by `world_ref`
- Tag filtering by `scenario.tags`
- Results limited to 50 items

### Admin Features
- JSON editor for document editing
- Validation using Zod schemas
- Import/export functionality

## Prompt Assembly

### Database Prompt Assembly
- `backend/src/prompts/database-prompt-assembler.ts` - Main assembler
- `backend/src/services/prompts.service.ts` - Service layer
- `backend/src/prompts/wrapper.ts` - Prompt wrapper

### Prompt Sources
- Core system prompts
- World-specific prompts
- Adventure/scenario prompts
- Player data
- Game state

## Key Files by Category

### Database Migrations
- `supabase/migrations/011_m2_games_schema.sql` - Legacy adventures
- `supabase/migrations/20250119_awf_adventures.sql` - AWF adventures
- `supabase/migrations/20250129_awf_scenarios.sql` - AWF scenarios
- `supabase/migrations/20250119_awf_worlds.sql` - AWF worlds

### Backend Services
- `backend/src/services/prompts.service.ts` - Prompt assembly
- `backend/src/services/games.service.ts` - Game management
- `backend/src/services/game-state.service.ts` - Game state
- `backend/src/routes/player.ts` - Player API routes
- `backend/src/routes/admin.ts` - Admin API routes

### Frontend Pages
- `frontend/src/pages/player/ScenarioPicker.tsx` - Scenario selection
- `frontend/src/pages/admin/AwfAdventuresAdmin.tsx` - Adventure admin
- `frontend/src/pages/admin/AwfScenariosAdmin.tsx` - Scenario admin
- `frontend/src/pages/UnifiedGamePage.tsx` - Game interface

### Types and Schemas
- `backend/src/types/awf-scenario.ts` - Scenario types
- `backend/src/validators/awf-scenario.schema.ts` - Validation schemas
- `backend/src/repositories/awf-scenario-repository.ts` - Data access

## Navigation Structure
- `/adventures` - Adventure listing
- `/scenarios` - Scenario picker
- `/my-adventures` - User's adventures
- `/game/:id` - Active game
- `/admin/awf/adventures` - Adventure admin
- `/admin/awf/scenarios` - Scenario admin






