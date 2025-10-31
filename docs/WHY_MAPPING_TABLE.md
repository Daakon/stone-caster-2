# Why We Need the world_id_mapping Table

## The Core Problem

Your `worlds` table has a **versioned, TEXT-based primary key**:

```sql
CREATE TABLE worlds (
  id TEXT NOT NULL,        -- e.g., "mystika"
  version TEXT NOT NULL,   -- e.g., "1.0", "1.1"  
  doc JSONB NOT NULL,
  PRIMARY KEY (id, version)  -- Composite key!
);
```

This design makes sense for versioned content, but creates a problem for foreign keys.

## Why Not TEXT Foreign Keys?

If we use TEXT foreign keys directly:

```sql
-- BAD: Can't reference a composite primary key
entry_points.world_id TEXT REFERENCES worlds(id)  
-- ERROR: Can't reference just one column of a composite key!
```

Even if we could, we'd have problems:
- ❌ No referential integrity (can reference non-existent worlds)
- ❌ If world slug changes, all references break
- ❌ Can't tell which version of the world is referenced

## Why Not Make worlds.id a UUID?

We can't change `worlds.id` from TEXT to UUID because:
- Would break the existing versioning system
- Would break all existing world content
- TEXT slugs are human-readable and used in URLs/content

## The Solution: Mapping Table

The `world_id_mapping` table provides stable UUID identity:

```sql
world_id_mapping
├── uuid_id UUID PRIMARY KEY  ← All foreign keys point here (stable, never changes)
└── text_id TEXT UNIQUE       → Points to worlds.id (can have multiple versions)
```

Now foreign keys work properly:

```sql
entry_points.world_id UUID REFERENCES world_id_mapping(uuid_id)
characters.world_id UUID REFERENCES world_id_mapping(uuid_id)
premade_characters.world_id UUID REFERENCES world_id_mapping(uuid_id)
```

## Benefits

1. **Referential Integrity**: Database enforces valid world references
2. **Stable IDs**: UUID never changes even if world slug/version changes
3. **Proper Versioning**: Can update world content without breaking references
4. **Standard Practice**: UUIDs for relations, TEXT for content identifiers

## The Alternative (What We Tried)

Using TEXT everywhere without mapping:
- ❌ No foreign key enforcement (your error proved this!)
- ❌ Can insert invalid world references
- ❌ No referential integrity
- ❌ Breaks if world slugs change

## Summary

The `world_id_mapping` table is **essential** because:
1. Your `worlds` table has a TEXT composite key (can't be referenced directly)
2. You need stable UUID identity for foreign keys
3. You want referential integrity enforced by the database
4. You need to version world content independently of references

**This is proper database design for your specific schema.**

