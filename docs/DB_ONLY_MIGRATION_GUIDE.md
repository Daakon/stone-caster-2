# Database-Only Prompt Migration Guide

## Overview
This guide helps you migrate from the hybrid file/database prompt system to the new database-only prompt assembly system.

## Prerequisites
- Database access with prompt schema deployed
- `npm run ingest:prompts` command available
- Backup of existing prompt files (if any)

## Migration Steps

### 1. Environment Configuration
Update your environment variables:

```bash
# Set mandatory database-only mode
PROMPT_SOURCE_STRATEGY=database

# Ensure database connectivity
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
```

### 2. Database Schema
Ensure the prompt schema is deployed:

```sql
-- Run the prompt schema migration
-- This should be in your migrations folder
-- Example: 20250103000000_create_prompting_schema.sql
```

### 3. Prompt Content Migration
If you have existing prompt files, migrate them to the database:

```bash
# Ingest prompts from files to database
npm run ingest:prompts

# Verify prompts are loaded
npm run verify:prompts
```

### 4. Application Updates
The application code has been updated to use database-only assembly. Key changes:

- `PromptsService` now requires `DatabasePromptService` constructor parameter
- All file-based prompt loading has been removed
- Runtime guards prevent any filesystem prompt access

### 5. Testing
Run the updated tests to ensure everything works:

```bash
# Run database-only tests
npm test -- --grep "database-prompt"

# Run integration tests
npm run test:integration
```

## Verification

### Check Database Content
Verify prompts are available in the database:

```sql
-- Check prompt segments
SELECT COUNT(*) FROM prompt_segments;

-- Check specific world prompts
SELECT * FROM prompt_segments WHERE world_slug = 'mystika';

-- Check core system prompts
SELECT * FROM prompt_segments WHERE layer = 'core';
```

### Test Prompt Assembly
Test that prompts can be assembled:

```bash
# Test initial prompt creation
curl -X POST http://localhost:3001/api/games/spawn \
  -H "Content-Type: application/json" \
  -d '{"adventureSlug": "adv.whispercross.start.v3", "worldSlug": "mystika"}'
```

## Troubleshooting

### Common Issues

#### 1. DB_PROMPTS_UNAVAILABLE Error
**Cause**: Database connection or RPC function not available
**Solution**:
```bash
# Check database connectivity
npm run test:db-connection

# Verify RPC functions exist
psql -c "SELECT * FROM pg_proc WHERE proname = 'get_cached_prompt_segments';"
```

#### 2. DB_PROMPTS_EMPTY Error
**Cause**: No prompt segments found for the requested parameters
**Solution**:
```bash
# Ingest prompts from files
npm run ingest:prompts

# Check if prompts exist
npm run verify:prompts -- --world mystika --adventure adv.whispercross.start.v3
```

#### 3. Runtime Guard Errors
**Cause**: Code attempting to use file-based prompt loading
**Solution**:
- Remove any imports of `PromptLoader`, `PromptManifest`, or `FilesystemPromptAssembler`
- Update any code using `getFileBasedTemplateForWorld`
- Ensure `PROMPT_SOURCE_STRATEGY=database` is set

### Debug Commands

```bash
# Check prompt assembly
npm run debug:prompts -- --world mystika --adventure adv.whispercross.start.v3 --scene forest_meet

# Verify database schema
npm run verify:schema

# Test prompt repository
npm run test:prompt-repository
```

## Rollback Plan

If you need to temporarily revert to file-based prompts:

1. **Restore File Components**:
   ```bash
   # Restore from archive
   cp docs/archive/legacy-file-prompts/* backend/src/prompts/
   ```

2. **Update Configuration**:
   ```bash
   # Allow file-based loading (temporary)
   PROMPT_SOURCE_STRATEGY=hybrid
   ```

3. **Ensure Files Exist**:
   ```bash
   # Ensure AI API Prompts directory exists
   mkdir -p "AI API Prompts"
   # Restore prompt files if needed
   ```

**Note**: Rollback is only recommended for emergency situations. The database-only approach provides significant benefits and should be the long-term solution.

## Performance Considerations

### Database Optimization
- Ensure proper indexing on `prompt_segments` table
- Use connection pooling for database access
- Monitor query performance and add caching if needed

### Caching Strategy
The system includes built-in caching for prompt segments:
- Segments are cached by the `PromptRepository`
- Cache is invalidated when segments are updated
- Use `clearCache()` method to force refresh

## Monitoring

### Key Metrics
- Prompt assembly success rate
- Database query performance
- Cache hit rates
- Error rates by type

### Alerts
Set up alerts for:
- Database connectivity issues
- High prompt assembly failure rates
- Performance degradation
- Missing prompt segments

## Support

If you encounter issues during migration:

1. Check the troubleshooting section above
2. Review the ADR-001 document for architectural details
3. Check the test files for usage examples
4. Verify your database schema matches the expected structure

## Next Steps

After successful migration:

1. Remove any remaining file-based prompt references
2. Update your deployment scripts to not include `AI API Prompts/` directory
3. Set up monitoring for the new database-only system
4. Consider implementing prompt versioning and A/B testing capabilities
