# Architect's Feedback - Admin Media Phase 1b

## Detected ID Types

After introspection of the schema:

- **`worlds.id`**: `TEXT` (PRIMARY KEY)
- **`entry_points.id`**: `TEXT` (PRIMARY KEY)
- **`npcs.id`**: `UUID` (PRIMARY KEY)

The migration uses these exact types for the typed columns in `media_links`.

## Foreign Key Feasibility

### Current State

Foreign keys are **not feasible** at this time due to:

1. **Type mismatch**: `worlds.id` and `entry_points.id` are `TEXT`, while `npcs.id` is `UUID`. The `media_links` table uses nullable columns for each type, which prevents a single foreign key constraint.

2. **Circular dependency risk**: Adding FKs would require ensuring `media_assets` and `media_links` are created in the correct order, and that entity tables exist first. While this is manageable, it adds migration complexity.

3. **Polymorphic relationship**: The one-of-three constraint (CHECK) is enforced, but PostgreSQL cannot enforce referential integrity across three different tables with a single FK.

### Future Recommendation

**Option A: Add separate FK constraints** (Recommended for Phase 2+)
```sql
ALTER TABLE media_links
  ADD CONSTRAINT fk_media_links_world
    FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_media_links_story
    FOREIGN KEY (story_id) REFERENCES entry_points(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_media_links_npc
    FOREIGN KEY (npc_id) REFERENCES npcs(id) ON DELETE CASCADE;
```

**Pros:**
- Enforces referential integrity at DB level
- Automatic cascade deletes
- Query planner can optimize joins

**Cons:**
- Requires all three entity tables to exist
- Migration order matters
- Slightly more complex migration

**Migration steps:**
1. Ensure `worlds`, `entry_points`, and `npcs` tables exist
2. Add FKs in a separate migration after Phase 1b
3. Use `ADD CONSTRAINT ... NOT VALID` then `VALIDATE CONSTRAINT` for large tables

**Option B: Keep current approach** (Current)
- Rely on application-level validation
- Use CHECK constraint for one-of-three
- Simpler migration, no FK dependencies

**Recommendation**: Add FKs in Phase 2 when API layer is implemented. The typed columns make this straightforward.

## Alternative Approaches Considered

### 1. Polymorphic Join Table with Single UUID Column

**Approach**: Use `entity_kind` + `entity_uuid` where all IDs are stored as UUID (convert TEXT to UUID).

**Pros:**
- Single column, simpler queries
- Could use a single FK if we had a union type

**Cons:**
- **Type loss**: `worlds.id` and `entry_points.id` are TEXT, not UUID. Converting would break existing data and require a major migration.
- **Performance**: TEXT to UUID conversion on every query
- **Not aligned with existing schema**: Would require changing entity table IDs

**Verdict**: ❌ Not viable without major schema changes to entity tables.

### 2. Postgres Enums for Status Fields

**Approach**: Replace `text CHECK (...)` with native Postgres enums for `publish_status`, `visibility`, `status`, etc.

**Pros:**
- Type safety at DB level
- Smaller storage (enum is 4 bytes vs variable text)
- Better query performance
- Prevents invalid values

**Cons:**
- Migration complexity: need to create enum, migrate data, alter columns
- Enum changes require migration (can't just add values)
- Some fields already use enums (e.g., `visibility_state` in Phase 0)

**Verdict**: ✅ **Recommend for Phase 2+**. The codebase already uses enums for `visibility_state` and `review_state_enum`. We should align `publish_status` and media status fields with this pattern.

**Migration path:**
```sql
CREATE TYPE publish_status_enum AS ENUM ('draft', 'in_review', 'published', 'rejected');
ALTER TABLE worlds ALTER COLUMN publish_status TYPE publish_status_enum USING publish_status::publish_status_enum;
-- Repeat for entry_points, npcs
```

### 3. Materialized View for Search Cards

**Approach**: Create a materialized view that denormalizes media links with entity metadata for fast card rendering.

**Pros:**
- Fast reads for gallery/card views
- Pre-computed joins
- Can include entity metadata (name, slug, etc.)

**Cons:**
- Refresh overhead (needs triggers or scheduled refresh)
- Storage duplication
- Complexity for Phase 1 (premature optimization)

**Verdict**: ⏸️ **Consider for Phase 3+** when we have performance requirements. Not needed for Phase 1/2.

### 4. Single Table Inheritance for Entities

**Approach**: Unify `worlds`, `entry_points`, `npcs` into a single `entities` table with a discriminator.

**Pros:**
- Single FK from `media_links` to `entities`
- Simpler queries
- Consistent ID type

**Cons:**
- **Major breaking change**: Would require rewriting all entity queries
- **Schema divergence**: Entity tables have different structures (worlds has `doc jsonb`, entry_points has `content jsonb`, etc.)
- **Migration risk**: High complexity, high risk
- **Not aligned with existing codebase**: All DAL and queries assume separate tables

**Verdict**: ❌ **Not recommended**. Too disruptive for the benefit gained.

## Final Recommendations

1. **Keep current typed columns approach** ✅ - Best balance of type safety, performance, and migration simplicity.

2. **Add FKs in Phase 2** ✅ - When API layer is implemented, add foreign key constraints for referential integrity.

3. **Migrate to enums in Phase 2+** ✅ - Align `publish_status` and media status fields with existing enum pattern (`visibility_state`, `review_state_enum`).

4. **Consider materialized view in Phase 3+** ⏸️ - Only if performance profiling shows it's needed.

## Trade-offs Summary

| Approach | Type Safety | Performance | Migration Complexity | Alignment with Codebase |
|----------|-------------|-------------|---------------------|------------------------|
| **Current (typed columns)** | ✅ High | ✅ Good | ✅ Low | ✅ High |
| Polymorphic UUID | ❌ Low | ⚠️ Medium | ❌ High | ❌ Low |
| Postgres Enums | ✅ High | ✅ Excellent | ⚠️ Medium | ✅ High |
| Materialized View | ✅ High | ✅ Excellent | ⚠️ Medium | ✅ High |
| Single Table Inheritance | ✅ High | ✅ Good | ❌ Very High | ❌ Very Low |

**Conclusion**: The current approach (typed columns) is the right choice for Phase 1b. Future phases should add FKs and consider enums for status fields.



