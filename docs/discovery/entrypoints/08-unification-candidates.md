# Unification Candidates

## Overview
This document proposes a unified EntryPoint abstraction that consolidates the current fragmented system of Adventures, Scenarios, and Sandbox modes.

## Proposed EntryPoint Schema

### Core Fields
```typescript
interface EntryPoint {
  // Identity
  id: string;                    // Unique identifier
  slug: string;                  // URL-friendly identifier
  type: 'adventure' | 'scenario' | 'sandbox' | 'quest';
  
  // Content
  title: string;                 // Display title
  subtitle?: string;             // Optional subtitle
  description: string;           // Description text
  synopsis?: string;            // Short synopsis
  
  // Relationships
  world_id: string;             // Required world reference
  adventure_id?: string;        // Optional adventure reference
  scenario_id?: string;         // Optional scenario reference
  
  // Metadata
  version: string;              // Version string
  status: 'draft' | 'active' | 'archived';
  visibility: 'public' | 'unlisted' | 'private';
  
  // Content Rating
  content_rating: 'safe' | 'mature' | 'explicit';
  age_rating?: string;          // Optional age rating
  
  // Media
  thumbnail_url?: string;       // Thumbnail image
  cover_url?: string;           // Cover image
  
  // Organization
  tags: string[];              // Tags array
  categories: string[];         // Categories array
  
  // Search and Discovery
  search_text: string;         // Denormalized search text
  sort_weight: number;          // Sort priority
  popularity_score: number;     // Popularity metric
  
  // Content
  content: EntryPointContent;   // Type-specific content
  
  // Internationalization
  i18n: Record<string, I18nContent>;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  published_at?: string;
  
  // Ownership
  owner_id?: string;           // Creator/owner
  created_by: string;          // User who created
}

interface EntryPointContent {
  // Common content
  display_name: string;
  synopsis: string;
  start_scene: string;
  
  // Type-specific content
  adventure?: AdventureContent;
  scenario?: ScenarioContent;
  sandbox?: SandboxContent;
  quest?: QuestContent;
}

interface AdventureContent {
  storyline: string;
  key_events: string[];
  cast: NPCReference[];
  locations: LocationReference[];
  items: ItemReference[];
  rules: GameRules;
}

interface ScenarioContent {
  start_scene: string;
  initial_conditions: InitialConditions;
  fixed_npcs: NPCReference[];
  starting_party: NPCReference[];
  starting_inventory: InventoryItem[];
  starting_resources: ResourceState;
  starting_flags: Record<string, boolean>;
  starting_objectives: Objective[];
}

interface SandboxContent {
  world_settings: WorldSettings;
  constraints: SandboxConstraints;
  available_tools: ToolReference[];
  starting_resources: ResourceState;
}

interface QuestContent {
  objectives: Objective[];
  rewards: Reward[];
  prerequisites: Prerequisite[];
  time_limit?: number;
}

interface I18nContent {
  title?: string;
  subtitle?: string;
  description?: string;
  synopsis?: string;
  display_name?: string;
}
```

## Field Mapping from Current Sources

### From Legacy Adventures Table
```typescript
// Current: adventures (legacy)
id: string → EntryPoint.id
slug: string → EntryPoint.slug
title: string → EntryPoint.title
description: string → EntryPoint.description
world_slug: string → EntryPoint.world_id
tags: jsonb → EntryPoint.tags
scenarios: jsonb → EntryPoint.scenario_id (if applicable)
is_active: boolean → EntryPoint.status
created_at: timestamptz → EntryPoint.created_at
updated_at: timestamptz → EntryPoint.updated_at
```

### From AWF Adventures Table
```typescript
// Current: adventures (AWF)
id: string → EntryPoint.id
world_ref: string → EntryPoint.world_id
version: string → EntryPoint.version
doc: jsonb → EntryPoint.content.adventure
hash: string → EntryPoint.content_hash (new field)
created_at: timestamptz → EntryPoint.created_at
updated_at: timestamptz → EntryPoint.updated_at

// From doc JSONB:
doc.name → EntryPoint.title
doc.synopsis → EntryPoint.synopsis
doc.cast → EntryPoint.content.adventure.cast
doc.slices → EntryPoint.content.adventure.rules.slices
doc.i18n → EntryPoint.i18n
```

### From AWF Scenarios Table
```typescript
// Current: scenarios (AWF)
id: string → EntryPoint.id
version: string → EntryPoint.version
doc: jsonb → EntryPoint.content.scenario
created_at: timestamptz → EntryPoint.created_at
updated_at: timestamptz → EntryPoint.updated_at

// From doc JSONB:
doc.world_ref → EntryPoint.world_id
doc.adventure_ref → EntryPoint.adventure_id
doc.scenario.display_name → EntryPoint.title
doc.scenario.synopsis → EntryPoint.synopsis
doc.scenario.start_scene → EntryPoint.content.scenario.start_scene
doc.scenario.tags → EntryPoint.tags
doc.scenario.i18n → EntryPoint.i18n
```

### From AWF Worlds Table
```typescript
// Current: worlds (AWF)
id: string → EntryPoint.world_id (for world entries)
version: string → EntryPoint.version
doc: jsonb → EntryPoint.content (for world entries)
hash: string → EntryPoint.content_hash
created_at: timestamptz → EntryPoint.created_at
updated_at: timestamptz → EntryPoint.updated_at
```

## API Unification

### Generic Entry Point API
```typescript
// Single API for all entry point types
GET /api/entry-points
POST /api/entry-points
GET /api/entry-points/:id
PUT /api/entry-points/:id
DELETE /api/entry-points/:id

// Filtered by type
GET /api/entry-points?type=adventure
GET /api/entry-points?type=scenario
GET /api/entry-points?type=sandbox

// Filtered by world
GET /api/entry-points?world_id=world.mystika@1.0.0

// Search and filter
GET /api/entry-points?search=magic&tags=fantasy&status=active
```

### Game Start API
```typescript
// Single game start endpoint
POST /api/games/start
{
  entry_point_id: string;
  entry_point_type: 'adventure' | 'scenario' | 'sandbox';
  character_id?: string;
  ruleset_ref?: string;
  locale?: string;
}
```

## Frontend Unification

### Generic Entry Point Picker
```typescript
interface EntryPointPickerProps {
  type?: 'adventure' | 'scenario' | 'sandbox' | 'all';
  worldId?: string;
  onSelect: (entryPoint: EntryPoint) => void;
  filters?: {
    tags?: string[];
    status?: string[];
    contentRating?: string[];
  };
}
```

### Generic Admin Interface
```typescript
interface EntryPointAdminProps {
  type: 'adventure' | 'scenario' | 'sandbox';
  onSave: (entryPoint: EntryPoint) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}
```

## Database Schema Unification

### Single Entry Points Table
```sql
CREATE TABLE entry_points (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('adventure', 'scenario', 'sandbox', 'quest')),
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT NOT NULL,
  synopsis TEXT,
  world_id TEXT NOT NULL,
  adventure_id TEXT,
  scenario_id TEXT,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted', 'private')),
  content_rating TEXT NOT NULL DEFAULT 'safe' CHECK (content_rating IN ('safe', 'mature', 'explicit')),
  age_rating TEXT,
  thumbnail_url TEXT,
  cover_url TEXT,
  tags TEXT[] DEFAULT '{}',
  categories TEXT[] DEFAULT '{}',
  search_text TEXT,
  sort_weight INTEGER DEFAULT 0,
  popularity_score INTEGER DEFAULT 0,
  content JSONB NOT NULL,
  i18n JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  owner_id TEXT,
  created_by TEXT NOT NULL,
  
  -- Indexes
  INDEX idx_entry_points_type ON entry_points(type);
  INDEX idx_entry_points_world_id ON entry_points(world_id);
  INDEX idx_entry_points_status ON entry_points(status);
  INDEX idx_entry_points_visibility ON entry_points(visibility);
  INDEX idx_entry_points_tags ON entry_points USING GIN(tags);
  INDEX idx_entry_points_search_text ON entry_points USING GIN(to_tsvector('english', search_text));
);
```

## Migration Strategy

### Phase 1: Schema Creation
1. Create new `entry_points` table
2. Create migration scripts for data transformation
3. Create new API endpoints
4. Create new frontend components

### Phase 2: Data Migration
1. Migrate legacy adventures to entry points
2. Migrate AWF adventures to entry points
3. Migrate AWF scenarios to entry points
4. Migrate AWF worlds to entry points (if applicable)

### Phase 3: API Migration
1. Update frontend to use new API
2. Update admin interfaces
3. Update game start logic
4. Update prompt assembly

### Phase 4: Cleanup
1. Remove old tables
2. Remove old API endpoints
3. Remove old frontend components
4. Update documentation

## Benefits of Unification

### 1. Simplified Data Model
- Single table for all entry point types
- Consistent field naming
- Unified relationships

### 2. Reduced Code Duplication
- Single API for all entry point types
- Generic frontend components
- Unified admin interface

### 3. Improved Maintainability
- Single codebase for entry point logic
- Consistent error handling
- Unified testing

### 4. Better Performance
- Single table queries
- Unified caching
- Optimized indexes

### 5. Enhanced User Experience
- Consistent interface across entry point types
- Unified search and filtering
- Better discoverability

## Implementation Considerations

### 1. Backward Compatibility
- Maintain old API endpoints during transition
- Provide migration tools
- Gradual rollout strategy

### 2. Data Validation
- Comprehensive validation schemas
- Cross-reference validation
- Content quality checks

### 3. Performance Optimization
- Proper indexing strategy
- Caching implementation
- Query optimization

### 4. Security
- Unified access control
- Data encryption
- Audit logging

### 5. Monitoring
- Performance monitoring
- Error tracking
- Usage analytics














