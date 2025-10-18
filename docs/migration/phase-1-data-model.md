# Phase 1: AWF Bundle Migration - Data Model

This document outlines the implementation of Phase 1 for the AWF (Adventure World Format) bundle migration. This phase focuses on establishing the data model foundation with versioned content tables, session management, and typed repositories.

## Overview

Phase 1 establishes the core data infrastructure for the AWF bundle system without changing any player-facing functionality. It provides the foundation for future phases that will implement the actual bundle assembly and act application logic.

## Database Schema

### Entity Relationship Diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   core_contracts │    │     worlds      │    │   adventures    │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ id (text)       │    │ id (text)       │    │ id (text)       │
│ version (text)   │    │ version (text)  │    │ world_ref (text)│
│ doc (jsonb)     │    │ doc (jsonb)     │    │ version (text)  │
│ hash (text)     │    │ hash (text)     │    │ doc (jsonb)     │
│ active (bool)   │    │ created_at      │    │ hash (text)     │
│ created_at      │    │ updated_at      │    │ created_at      │
│ updated_at      │    └─────────────────┘    │ updated_at      │
└─────────────────┘                          └─────────────────┘
                                                       │
                                                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ adventure_starts │    │    sessions     │    │  game_states    │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ adventure_ref   │    │ session_id (uuid)│    │ session_id (uuid)│
│ doc (jsonb)     │    │ player_id (text)│    │ hot (jsonb)     │
│ use_once (bool) │    │ world_ref (text)│    │ warm (jsonb)    │
│ created_at      │    │ adventure_ref   │    │ cold (jsonb)    │
│ updated_at      │    │ turn_id (int)    │    │ updated_at      │
└─────────────────┘    │ is_first_turn   │    └─────────────────┘
                       │ created_at      │
                       │ updated_at      │
                       └─────────────────┘
                                │
                                │
                       ┌─────────────────┐
                       │ injection_map   │
                       ├─────────────────┤
                       │ id (text)       │
                       │ doc (jsonb)     │
                       │ created_at      │
                       │ updated_at      │
                       └─────────────────┘
```

### Table Descriptions

#### Versioned Content Tables

**core_contracts**
- Stores versioned core contract documents
- Primary key: (id, version)
- Unique constraint ensures only one active version per contract
- Index on `active` for efficient active contract queries

**worlds**
- Stores versioned world documents
- Primary key: (id, version)
- Contains world metadata, timeworld settings, and slices

**adventures**
- Stores versioned adventure documents
- Primary key: (id, version)
- Foreign key: world_ref → worlds(id)
- Contains locations, objectives, NPCs, and adventure-specific slices

**adventure_starts**
- Stores adventure start documents
- Primary key: adventure_ref
- Foreign key: adventure_ref → adventures(id)
- Contains initial scene and rules for adventure starts

#### Runtime Tables

**sessions**
- Stores AWF runtime sessions
- Primary key: session_id (UUID)
- Links player to world and adventure
- Tracks turn progression and first turn status

**game_states**
- Stores AWF runtime game states
- Primary key: session_id (UUID)
- Foreign key: session_id → sessions(session_id)
- Three-tier state: hot (frequently changing), warm (moderately changing), cold (rarely changing)

**injection_map**
- Stores bundle assembly and act application configuration
- Primary key: id (default: 'default')
- Contains JSON Pointer strings for build and acts sections

## Document Types

### Core Contract Document

```typescript
interface CoreContractDoc {
  contract: {
    version: string;
    name: string;
    description: string;
  };
  acts: {
    allowed: string[];
  };
  memory?: {
    exemplars?: Array<{
      id: string;
      content: string;
      metadata?: Record<string, unknown>;
    }>;
  };
}
```

### World Document

```typescript
interface WorldDoc {
  id: string;
  name: string;
  version: string;
  hash: string;
  timeworld?: {
    timezone: string;
    calendar: string;
    seasons?: string[];
  };
  slices?: Array<{
    id: string;
    name: string;
    description: string;
    type: 'location' | 'character' | 'item' | 'event';
    metadata?: Record<string, unknown>;
  }>;
}
```

### Adventure Document

```typescript
interface AdventureDoc {
  id: string;
  world_ref: string;
  version: string;
  hash: string;
  locations?: Array<{
    id: string;
    name: string;
    description: string;
    connections?: string[];
    metadata?: Record<string, unknown>;
  }>;
  objectives?: Array<{
    id: string;
    title: string;
    description: string;
    type: 'main' | 'side' | 'optional';
    status: 'active' | 'completed' | 'failed';
    metadata?: Record<string, unknown>;
  }>;
  npcs?: Array<{
    id: string;
    name: string;
    description: string;
    role: string;
    location?: string;
    metadata?: Record<string, unknown>;
  }>;
  slices?: Array<{
    id: string;
    name: string;
    description: string;
    type: 'scene' | 'encounter' | 'puzzle' | 'dialogue';
    metadata?: Record<string, unknown>;
  }>;
}
```

### Adventure Start Document

```typescript
interface AdventureStartDoc {
  start: {
    scene: string;
    description: string;
    initial_state?: Record<string, unknown>;
  };
  rules: {
    no_time_advance: boolean;
    [key: string]: unknown;
  };
}
```

### Injection Map Document

```typescript
interface InjectionMapDoc {
  build: {
    [key: string]: string; // JSON Pointer strings
  };
  acts: {
    [key: string]: string; // JSON Pointer strings
  };
}
```

## Validation

All documents are validated using Zod schemas:

- `CoreContractDocSchema` - Validates core contract documents
- `WorldDocSchema` - Validates world documents
- `AdventureDocSchema` - Validates adventure documents
- `AdventureStartDocSchema` - Validates adventure start documents
- `InjectionMapDocSchema` - Validates injection map documents

## Hashing

Documents are hashed using SHA-256 with stable JSON stringification:

- Keys are sorted for consistent ordering
- No whitespace in JSON output
- Handles nested objects and arrays
- Same document content always produces the same hash

## Repositories

Each table has a corresponding repository with the following interface:

```typescript
interface BaseRepository<T> {
  getByIdVersion(id: string, version: string): Promise<T | null>;
  upsert(record: T): Promise<T>;
  validate(doc: unknown): boolean;
  computeHash(doc: unknown): string;
}
```

### Available Repositories

- `CoreContractsRepository` - Manages core contracts with active version support
- `WorldsRepository` - Manages world documents with versioning
- `AdventuresRepository` - Manages adventure documents with world references
- `AdventureStartsRepository` - Manages adventure start documents
- `SessionsRepository` - Manages AWF runtime sessions
- `GameStatesRepository` - Manages AWF runtime game states
- `InjectionMapRepository` - Manages injection map configuration

## Seeding & Validation Commands

### Seed Data

```bash
npm run seed:data
```

This command seeds the database with minimal but valid documents:

- Core contract: `core.contract.v4` (active)
- World: `world.mystika.v1`
- Adventure: `adv.whispercross.v1`
- Adventure start for the adventure
- Default injection map

### Validate Documents

```bash
npm run validate:docs
```

This command validates all documents in the database against their schemas and reports:

- Total documents per table
- Valid/invalid counts
- Specific error messages for invalid documents
- Overall validation status

## Rollback Instructions

To rollback Phase 1 changes:

1. **Run the rollback migration:**
   ```bash
   # This will drop all AWF-related tables
   supabase db reset --force
   ```

2. **Or manually drop tables:**
   ```sql
   DROP TABLE IF EXISTS game_states CASCADE;
   DROP TABLE IF EXISTS sessions CASCADE;
   DROP TABLE IF EXISTS injection_map CASCADE;
   DROP TABLE IF EXISTS adventure_starts CASCADE;
   DROP TABLE IF EXISTS adventures CASCADE;
   DROP TABLE IF EXISTS worlds CASCADE;
   DROP TABLE IF EXISTS core_contracts CASCADE;
   ```

3. **Remove migration files:**
   ```bash
   rm supabase/migrations/20250119_awf_*.sql
   ```

## Testing

### Unit Tests

Run the AWF-specific tests:

```bash
npm test tests/awf-validators.test.ts
npm test tests/awf-hashing.test.ts
npm test tests/awf-repositories.test.ts
```

### Integration Tests

Test the complete data flow:

```bash
# Seed data
npm run seed:data

# Validate documents
npm run validate:docs

# Should show all documents as valid
```

## Migration Files

- `20250119_awf_core_contracts.sql` - Core contracts table
- `20250119_awf_worlds.sql` - Worlds table
- `20250119_awf_adventures.sql` - Adventures table
- `20250119_awf_adventure_starts.sql` - Adventure starts table
- `20250119_awf_sessions.sql` - Sessions table
- `20250119_awf_game_states.sql` - Game states table
- `20250119_awf_injection_map.sql` - Injection map table
- `20250119_awf_rollback.sql` - Rollback migration

## Next Steps

Phase 1 provides the foundation for:

- **Phase 2**: Bundle assembly logic
- **Phase 3**: Act application system
- **Phase 4**: Integration with existing turn processing
- **Phase 5**: Performance optimization and monitoring

The data model is designed to be extensible and supports the full AWF bundle system while maintaining backward compatibility with the existing game system.


