# Prompt System Migration Plan

## Overview

This document outlines the migration from filesystem-based prompt loading to a database-backed system using Supabase. The migration maintains backward compatibility while providing improved performance, versioning, and access control.

## Migration Goals

1. **Replace filesystem prompt loading** with database-backed storage
2. **Maintain existing behavior** while swapping the data source
3. **Preserve prompt content** unchanged apart from metadata wrapping
4. **Provide role-based access control** for prompt management
5. **Enable prompt versioning** and change detection
6. **Improve performance** with caching and optimized queries

## Database Schema

### `prompting.prompts` Table

```sql
CREATE TABLE prompting.prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layer VARCHAR(50) NOT NULL, -- foundation, core, engine, ai_behavior, data_management, performance, content, enhancement
    world_slug VARCHAR(100), -- NULL for core/system prompts
    adventure_slug VARCHAR(100), -- NULL for non-adventure prompts
    scene_id VARCHAR(100), -- NULL for non-scene prompts
    turn_stage VARCHAR(50) DEFAULT 'any', -- start, ongoing, end, any
    sort_order INTEGER NOT NULL DEFAULT 0, -- Load order within layer
    version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    hash VARCHAR(64) NOT NULL, -- SHA256 hash for change detection
    content TEXT NOT NULL, -- The actual prompt content
    metadata JSONB DEFAULT '{}', -- Variables, dependencies, etc.
    active BOOLEAN NOT NULL DEFAULT true,
    locked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);
```

### RPC Function

```sql
CREATE OR REPLACE FUNCTION prompting.prompt_segments_for_context(
    p_world_slug VARCHAR(100) DEFAULT NULL,
    p_adventure_slug VARCHAR(100) DEFAULT NULL,
    p_include_start BOOLEAN DEFAULT true,
    p_scene_id VARCHAR(100) DEFAULT NULL,
    p_include_enhancements BOOLEAN DEFAULT true
)
```

## Migration Steps

### 1. Database Setup

- [x] Create Supabase migration for `prompting` schema
- [x] Create `prompting.prompts` table with proper indexes
- [x] Set up RLS policies for role-based access
- [x] Create RPC function for segment retrieval
- [x] Add utility functions for statistics and validation

### 2. Ingestion Script

- [x] Create `backend/scripts/ingest-prompts.ts`
- [x] Parse existing prompt files from `backend/AI API Prompts/`
- [x] Map files to database segments with proper layer/sort_order
- [x] Generate hashes for change detection
- [x] Upsert segments to database with idempotent operations

### 3. Backend Refactoring

- [x] Create `PromptRepository` for database operations
- [x] Create `DatabasePromptAssembler` to replace filesystem-based assembler
- [x] Create `DatabasePromptService` for service layer
- [x] Create `DatabaseAIService` for AI integration
- [x] Maintain backward compatibility with file inclusions

### 4. Testing

- [x] Unit tests for `PromptRepository`
- [x] Unit tests for `DatabasePromptAssembler`
- [x] Integration tests for prompt assembly
- [x] Performance tests for caching
- [x] Error handling tests for database failures

### 5. Documentation Updates

- [x] Update `docs/FEATURES.md` with database-backed prompt system
- [x] Update `docs/API_CONTRACT.md` with RPC function details
- [x] Update `docs/TEST_PLAN.md` with new test coverage
- [x] Create `docs/PROMPT_MIGRATION_PLAN.md` (this document)

## Layer Mapping

The migration maps existing prompt files to database layers:

| Layer | Load Order | Description | Example Files |
|-------|-------------|-------------|---------------|
| foundation | 1-2 | World lore and logic | `world-codex.mystika-lore.md`, `world-codex.mystika-logic.json` |
| core | 3-4 | Universal mechanics | `systems.unified.json`, `style.ui-global.json` |
| engine | 5-7 | Core narrative protocols | `core.rpg-storyteller.json`, `engine.system.json`, `awf.scheme.json` |
| ai_behavior | 8 | AI behavior controls | `agency.presence-and-guardrails.json` |
| data_management | 9-12 | Save/load protocols | `save.instructions.json`, `validation.*.json` |
| performance | 13 | Performance guidelines | `performance.benchmarks.json` |
| content | 14 | Adventure context | `adventure.*.json` |
| enhancement | 15-16 | Enhancement prompts | `essence-integration-enhancement.json` |

## Access Control

### Roles

- **Service Role**: Full access to all prompt operations
- **prompt_admin**: Full access to prompt management
- **Authenticated Users**: Read-only access to active, unlocked prompts

### RLS Policies

```sql
-- Service role and prompt_admin full access
CREATE POLICY "Service role and prompt_admin full access" ON prompting.prompts
    FOR ALL USING (
        auth.role() = 'service_role' OR 
        EXISTS (
            SELECT 1 FROM auth.users u 
            WHERE u.id = auth.uid() 
            AND u.raw_user_meta_data->>'role' = 'prompt_admin'
        )
    );

-- Authenticated users read active prompts
CREATE POLICY "Authenticated users read active prompts" ON prompting.prompts
    FOR SELECT USING (
        auth.role() = 'authenticated' AND 
        active = true AND 
        locked = false
    );
```

## Performance Optimizations

### Caching

- In-memory caching of prompt segments with 5-minute TTL
- Cache key based on context parameters
- Automatic cache invalidation on updates

### Database Indexes

```sql
CREATE INDEX idx_prompts_world_adventure ON prompting.prompts(world_slug, adventure_slug) WHERE active = true;
CREATE INDEX idx_prompts_layer_sort ON prompting.prompts(layer, sort_order) WHERE active = true;
CREATE INDEX idx_prompts_scene ON prompting.prompts(scene_id) WHERE active = true AND scene_id IS NOT NULL;
CREATE INDEX idx_prompts_turn_stage ON prompting.prompts(turn_stage) WHERE active = true;
CREATE INDEX idx_prompts_hash ON prompting.prompts(hash);
CREATE INDEX idx_prompts_active_locked ON prompting.prompts(active, locked);
```

## Backward Compatibility

### File Inclusions

The system maintains support for legacy file inclusions using `<<<FILE path >>>` syntax:

```typescript
// Process file inclusions in segments (replace <<<FILE ... >>> with actual content)
private async processFileInclusions(segment: string, context: Record<string, any>): Promise<string> {
  const filePattern = /<<<FILE\s+([^>]+)\s*>>>/g;
  // ... file loading logic
}
```

### Variable Replacement

All existing variable replacement logic is preserved:

- Character variables (`character.name`, `character.skills`, etc.)
- Game variables (`game.id`, `game.turn_index`, etc.)
- World variables (`world.name`, `world.setting`, etc.)
- Adventure variables (`adventure.name`, `adventure.scenes`, etc.)
- Runtime variables (`runtime.ticks`, `runtime.presence`, etc.)

## Rollback Plan

If issues arise, the system can be rolled back by:

1. **Reverting service imports** to use filesystem-based prompt loading
2. **Keeping database intact** for future migration attempts
3. **Maintaining file structure** for immediate fallback
4. **Preserving existing prompt files** during migration

## Monitoring and Validation

### Health Checks

- Database connection validation
- RPC function availability
- Cache performance metrics
- Prompt assembly success rates

### Validation Functions

```sql
-- Validate prompt dependencies
CREATE OR REPLACE FUNCTION prompting.validate_prompt_dependencies()

-- Get prompt statistics
CREATE OR REPLACE FUNCTION prompting.get_prompt_stats()
```

## Deployment Checklist

- [ ] Run database migration
- [ ] Execute ingestion script
- [ ] Deploy backend changes
- [ ] Verify prompt assembly works
- [ ] Monitor performance metrics
- [ ] Validate all game flows
- [ ] Update documentation

## Future Enhancements

### Planned Features

1. **Prompt Versioning**: Track changes and enable rollbacks
2. **A/B Testing**: Support for multiple prompt variants
3. **Analytics**: Track prompt performance and effectiveness
4. **Dynamic Loading**: Load prompts based on game state
5. **Template System**: Reusable prompt templates

### Performance Improvements

1. **Connection Pooling**: Optimize database connections
2. **Query Optimization**: Fine-tune RPC function performance
3. **Cache Strategies**: Implement more sophisticated caching
4. **CDN Integration**: Cache prompts at edge locations

## Conclusion

This migration provides a robust, scalable foundation for prompt management while maintaining backward compatibility and improving performance. The database-backed system enables better versioning, access control, and monitoring while preserving all existing functionality.
