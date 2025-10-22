# Admin Update Plan

## Scope Cleanup & Unification (v3)

### Overview
This update unifies the prompt segment system around 6 core scopes and removes support for deprecated scopes. The system now treats worlds, rulesets, entries, and NPCs as first-class entities with proper associations.

### Database Changes

#### Migration: `20250204_segments_scope_cleanup.sql`
- **Constraint Addition**: Restricts `prompt_segments.scope` to allowed values only
- **Deprecated Scope Handling**: Soft-migrates existing deprecated segments
- **Metadata Preservation**: Tags deprecated segments for author reference

#### Allowed Scopes
- `core` - System-wide prompts
- `ruleset` - Ruleset-specific prompts  
- `world` - World-level prompts
- `entry` - Entry point prompts
- `entry_start` - Entry start prompts (first turn only)
- `npc` - NPC-specific prompts

#### Deprecated Scopes (Auto-Deactivated)
- `game_state` - Now generated dynamically
- `player` - Now generated dynamically
- `rng` - Now generated dynamically
- `input` - Now generated dynamically

### Backend Changes

#### New Validation Service (`src/services/validation.ts`)
- **Scope Validation**: `assertAllowedScope()` rejects deprecated scopes
- **Data Validation**: `validateSegmentData()` ensures proper segment structure
- **Context Help**: `getScopeReferenceHelp()` provides UI guidance

#### Updated Services
- **`admin.segments.ts`**: Added validation to create/update methods
- **Interface Updates**: Removed deprecated scopes from TypeScript types
- **Error Handling**: Proper error codes for scope validation failures

#### Assembler Updates (`src/prompt/assembler/`)
- **Order Constants**: Separated static and dynamic scope orders
- **Database Reads**: Removed reads for deprecated scopes
- **Dynamic Generation**: Runtime generation of state/player/rng/input layers

### Admin UI Changes

#### Segment Form Modal (`SegmentFormModal.tsx`)
- **Scope Dropdown**: Only shows allowed scopes
- **Reference Help**: Contextual guidance for each scope type
- **Validation**: Client-side validation prevents deprecated scope selection

#### Segments List (`prompt-segments/index.tsx`)
- **Filter Updates**: Removed deprecated scopes from filter options
- **Warning System**: Shows deprecation warnings for URL parameters
- **Read-Only View**: Deprecated segments are view-only

#### Entry Editor
- **World Selection**: Single world per entry
- **Ruleset Associations**: Multiple ordered rulesets per entry
- **NPC Bindings**: Both individual NPCs and NPC packs supported

### Testing

#### Unit Tests
- **Scope Validation**: Tests for allowed/deprecated scope handling
- **Service Validation**: CRUD operations with scope constraints
- **UI Component Tests**: Form validation and scope selection

#### Integration Tests
- **Assembly Order**: Verifies correct layer ordering
- **Database Constraints**: Ensures database-level validation
- **End-to-End**: Complete workflow from creation to assembly

### Documentation Updates

#### Core Documentation
- **`ASSEMBLER.md`**: Updated assembly order and scope restrictions
- **`ADMIN_UPDATE_PLAN.md`**: This document with migration details
- **API Documentation**: Updated service interfaces and validation

#### Migration Guide
- **Deprecated Content**: How to handle existing deprecated segments
- **Content Migration**: Steps to move content to allowed scopes
- **Best Practices**: Guidelines for new segment creation

### Rollback Plan

#### If Issues Arise
1. **Database Rollback**: Remove constraint, reactivate deprecated segments
2. **Code Rollback**: Revert to previous scope handling
3. **UI Rollback**: Restore deprecated scope options
4. **Content Recovery**: Restore from backup if needed

#### Rollback Steps
```sql
-- Remove constraint
ALTER TABLE prompt_segments DROP CONSTRAINT chk_prompt_segments_scope;

-- Reactivate deprecated segments
UPDATE prompt_segments 
SET active = true, metadata = metadata - 'deprecated_scope' - 'deprecated_at'
WHERE scope IN ('game_state', 'player', 'rng', 'input');
```

### Post-Migration Tasks

#### Immediate (Day 1)
- [ ] Verify database constraint is active
- [ ] Test segment creation with allowed scopes
- [ ] Verify deprecated segments are inactive
- [ ] Check admin UI scope filtering

#### Short-term (Week 1)
- [ ] Monitor for any scope-related errors
- [ ] Review deprecated segment content for migration
- [ ] Update any custom integrations
- [ ] Train admin users on new scope system

#### Long-term (Month 1)
- [ ] Migrate any important deprecated content
- [ ] Optimize segment queries for new structure
- [ ] Consider advanced features (versioning, dependencies)
- [ ] Gather feedback on new system

### Success Metrics

#### Technical Metrics
- [ ] Zero scope validation errors in logs
- [ ] All tests passing
- [ ] No deprecated scope references in code
- [ ] Proper assembly order in all cases

#### User Experience Metrics
- [ ] Admin users can create/edit segments successfully
- [ ] Entry editor works with new associations
- [ ] Prompt assembly produces correct output
- [ ] No confusion about scope options

#### Performance Metrics
- [ ] Segment queries perform within acceptable limits
- [ ] Assembly time remains reasonable
- [ ] Database constraint doesn't impact performance
- [ ] UI responsiveness maintained

### Communication Plan

#### Pre-Migration
- [ ] Notify admin users of scope changes
- [ ] Provide migration guide for deprecated content
- [ ] Schedule maintenance window if needed

#### Post-Migration
- [ ] Confirm successful migration
- [ ] Provide updated documentation
- [ ] Offer training on new scope system
- [ ] Monitor for questions/issues

### Risk Assessment

#### Low Risk
- **Database Constraint**: Well-tested, reversible
- **UI Updates**: Cosmetic changes, no data loss
- **Service Validation**: Additive changes, backward compatible

#### Medium Risk
- **Assembler Changes**: Could affect prompt output
- **Deprecated Segment Handling**: Content might be lost if not migrated
- **Admin Workflow**: Users need to adapt to new scope system

#### Mitigation Strategies
- **Thorough Testing**: Comprehensive test coverage
- **Gradual Rollout**: Phased deployment if possible
- **Content Backup**: Full backup before migration
- **Monitoring**: Close monitoring of system behavior
- **Quick Rollback**: Prepared rollback procedures

### Future Enhancements

#### Planned Features
- **Segment Versioning**: Track changes to segments over time
- **Dependency Management**: Handle segment dependencies
- **Advanced Caching**: Optimize segment retrieval
- **Custom Orders**: Per-entry-type assembly orders

#### Potential Improvements
- **Segment Templates**: Reusable segment patterns
- **Bulk Operations**: Mass segment management
- **Analytics**: Segment usage and performance metrics
- **Integration**: Better integration with other systems