# ADR-001: Database-Only Prompt Assembly

## Status
Accepted

## Context
The Stone Caster application previously used a hybrid approach for prompt assembly, supporting both filesystem-based prompt loading from `AI API Prompts/` directory and database-based prompt storage. This created complexity, maintenance overhead, and potential inconsistencies between file and database content.

## Decision
We will implement a **database-only prompt assembly system** that eliminates all filesystem-based prompt loading and consolidates all prompt content in the database.

## Rationale

### Benefits
1. **Single Source of Truth**: All prompt content is stored in the database, eliminating inconsistencies
2. **Simplified Architecture**: Removes complex file-based loading logic and path resolution
3. **Better Performance**: Database queries with caching are more efficient than filesystem I/O
4. **Improved Security**: Database access is controlled through RLS policies
5. **Easier Deployment**: No need to manage prompt files in deployment artifacts
6. **Better Versioning**: Database provides built-in versioning and audit trails
7. **Dynamic Content**: Database allows for runtime prompt modifications without deployments

### Trade-offs
1. **Migration Required**: Existing file-based prompts must be migrated to database
2. **Database Dependency**: System requires database connectivity for all prompt operations
3. **Initial Setup**: Database must be seeded with prompt content before first use

## Implementation

### Core Components
1. **DatabasePromptAssembler**: Single entry point for all prompt assembly
2. **PromptRepository**: Database access layer with caching
3. **Runtime Guards**: Prevent any filesystem-based prompt loading
4. **Standardized Errors**: Clear error messages for database issues

### Key Changes
1. **Removed Components**:
   - `PromptLoader` (filesystem-based)
   - `PromptManifest` (file-based manifest)
   - `FilesystemPromptAssembler`
   - All `AI API Prompts/` directory references

2. **New Components**:
   - `DatabasePromptAssembler` with standardized API
   - `DatabasePromptError` with specific error codes
   - Runtime guards to prevent file-based loading
   - DB-first test fixtures

3. **Configuration**:
   - `PROMPT_SOURCE_STRATEGY=database` (mandatory)
   - No filesystem fallbacks
   - Database-only error handling

### Error Handling
- `DB_PROMPTS_UNAVAILABLE`: Database/RPC not accessible
- `DB_PROMPTS_EMPTY`: No segments found for given parameters
- Clear remediation messages for each error type

## Migration Path

### Phase 1: Implementation
1. Create `DatabasePromptAssembler` with standardized API
2. Implement runtime guards to prevent file-based loading
3. Update `PromptsService` to use database-only assembly
4. Remove file-based components and references

### Phase 2: Testing
1. Create DB-first test fixtures
2. Update integration tests to use database seeding
3. Remove file-based test dependencies
4. Add CI guards to prevent file-prompt references

### Phase 3: Documentation
1. Update README files to reflect DB-only approach
2. Create migration guides for existing deployments
3. Update API documentation
4. Create troubleshooting guides

## Consequences

### Positive
- Simplified codebase with single prompt source
- Better performance through database caching
- Improved security through RLS policies
- Easier maintenance and deployment
- Better audit trails and versioning

### Negative
- Requires database migration for existing deployments
- No filesystem fallback for prompt content
- Database dependency for all prompt operations

### Risks
- **Database Unavailability**: System cannot generate prompts without database
- **Migration Complexity**: Existing file-based prompts must be migrated
- **Performance**: Database queries may be slower than file reads (mitigated by caching)

## Monitoring
- Track database prompt query performance
- Monitor prompt assembly success rates
- Alert on database connectivity issues
- Track migration completion rates

## Rollback Plan
If issues arise, the system can be temporarily reverted by:
1. Restoring file-based components from archive
2. Updating configuration to allow file-based loading
3. Ensuring `AI API Prompts/` directory is available
4. Reverting to hybrid approach temporarily

However, the long-term goal remains database-only for all the benefits listed above.

## Related Decisions
- Database schema design for prompt storage
- Caching strategy for prompt segments
- RLS policies for prompt access control
- Migration tooling for existing deployments
