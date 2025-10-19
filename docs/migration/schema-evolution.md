# Schema Evolution Guide

This guide explains how to manage schema evolution for AWF content, including versioning, migration, and breaking changes.

## Overview

Schema evolution allows AWF content to evolve over time while maintaining backward compatibility and providing clear migration paths for breaking changes.

## Versioning Strategy

### Semantic Versioning

AWF uses semantic versioning (major.minor.patch):
- **Major (X.0.0)**: Breaking changes
- **Minor (0.X.0)**: New features, backward compatible
- **Patch (0.0.X)**: Bug fixes, backward compatible

### Version Examples

```
1.0.0 → 1.1.0  # Minor: New features
1.1.0 → 1.1.1  # Patch: Bug fixes
1.1.1 → 2.0.0  # Major: Breaking changes
```

## Migration System

### Migration Steps

Migrations are defined as transform functions:

```typescript
interface MigrationStep {
  from: string;
  to: string;
  transform: (doc: any) => any;
  description: string;
}
```

### Example Migration

```typescript
// Core contract v4 → v5
{
  from: '4.0.0',
  to: '5.0.0',
  transform: (doc: any) => {
    const migrated = { ...doc };
    
    // Rename beats.policy → beats.rules
    if (migrated.contract?.beats?.policy) {
      migrated.contract.beats.rules = migrated.contract.beats.policy;
      delete migrated.contract.beats.policy;
    }
    
    // Add output.budget.max_acts default
    if (!migrated.contract?.output?.budget?.max_acts) {
      migrated.contract = migrated.contract || {};
      migrated.contract.output = migrated.contract.output || {};
      migrated.contract.output.budget = migrated.contract.output.budget || {};
      migrated.contract.output.budget.max_acts = 8;
    }
    
    return migrated;
  },
  description: 'Rename beats.policy to beats.rules, add max_acts default'
}
```

## Migration Commands

### Basic Migration

```bash
# Migrate a document
yarn awf:migrate --type adventure --id whispercross --from 1.0.0 --to 1.1.0 --write

# Generate backup
yarn awf:migrate --type world --id mystika --from 1.0.0 --to 2.0.0 --backup

# Dry run (no changes)
yarn awf:migrate --type core --id contract --from 4.0.0 --to 5.0.0
```

### Migration Options

- **`--write`**: Write migrated document to file
- **`--backup`**: Create backup of original document
- **`--dry-run`**: Show what would be migrated (default)

## Breaking Changes

### Definition

Breaking changes are changes that:
- Remove required fields
- Change field types
- Remove enum values
- Change array to non-array (or vice versa)
- Modify required behavior

### Examples

#### Field Removal
```json
// v1.0.0
{
  "contract": {
    "acts": { "allowed": ["SCENE_SET"] },
    "oldField": "deprecated"  // Will be removed
  }
}

// v2.0.0 (breaking)
{
  "contract": {
    "acts": { "allowed": ["SCENE_SET"] }
    // oldField removed
  }
}
```

#### Type Changes
```json
// v1.0.0
{
  "contract": {
    "acts": { "allowed": ["SCENE_SET"] }  // Array
  }
}

// v2.0.0 (breaking)
{
  "contract": {
    "acts": { "allowed": "SCENE_SET" }  // String
  }
}
```

#### Enum Changes
```json
// v1.0.0
{
  "contract": {
    "acts": { "allowed": ["SCENE_SET", "TIME_ADVANCE", "OLD_ACT"] }
  }
}

// v2.0.0 (breaking)
{
  "contract": {
    "acts": { "allowed": ["SCENE_SET", "TIME_ADVANCE"] }
    // OLD_ACT removed
  }
}
```

## Non-Breaking Changes

### New Fields
```json
// v1.0.0
{
  "contract": {
    "acts": { "allowed": ["SCENE_SET"] }
  }
}

// v1.1.0 (non-breaking)
{
  "contract": {
    "acts": { "allowed": ["SCENE_SET"] },
    "newField": "value"  // Added field
  }
}
```

### Optional Fields
```json
// v1.0.0
{
  "contract": {
    "acts": { "allowed": ["SCENE_SET"] }
  }
}

// v1.1.0 (non-breaking)
{
  "contract": {
    "acts": { "allowed": ["SCENE_SET"] },
    "optionalField": "value"  // Optional field
  }
}
```

### Default Values
```json
// v1.0.0
{
  "contract": {
    "acts": { "allowed": ["SCENE_SET"] }
  }
}

// v1.1.0 (non-breaking)
{
  "contract": {
    "acts": { "allowed": ["SCENE_SET"] },
    "newField": "default"  // Default value
  }
}
```

## Migration Patterns

### Field Renaming
```typescript
// Rename field
if (migrated.contract?.oldField) {
  migrated.contract.newField = migrated.contract.oldField;
  delete migrated.contract.oldField;
}
```

### Field Addition
```typescript
// Add field with default
if (!migrated.contract?.newField) {
  migrated.contract.newField = 'default';
}
```

### Field Removal
```typescript
// Remove deprecated field
if (migrated.contract?.deprecatedField) {
  delete migrated.contract.deprecatedField;
}
```

### Type Conversion
```typescript
// Convert array to string
if (Array.isArray(migrated.contract?.acts?.allowed)) {
  migrated.contract.acts.allowed = migrated.contract.acts.allowed[0];
}
```

### Structure Changes
```typescript
// Restructure object
if (migrated.contract?.oldStructure) {
  migrated.contract.newStructure = {
    field1: migrated.contract.oldStructure.field1,
    field2: migrated.contract.oldStructure.field2
  };
  delete migrated.contract.oldStructure;
}
```

## Changelog Generation

### Automatic Changelog

Migrations automatically generate changelog entries:

```markdown
## Migration from 4.0.0 to 5.0.0

- Rename beats.policy to beats.rules
- Add output.budget.max_acts default
- Remove deprecated oldField
```

### Manual Changelog

For complex migrations, add manual entries:

```markdown
## Migration from 1.0.0 to 2.0.0

- **BREAKING**: Remove deprecated oldField
- **BREAKING**: Change acts.allowed from array to string
- Add newField with default value
- Update timeworld.bands structure
```

## Migration Testing

### Test Migrations

```typescript
import { SchemaVersionManager } from '../src/schema/versioning.js';

const manager = new SchemaVersionManager();

// Test migration
const result = await manager.migrateDoc(mockDoc, '1.0.0', '2.0.0', { write: false });
expect(result.success).toBe(true);
expect(result.migratedDoc).toMatchSnapshot();
```

### Idempotence

Migrations should be idempotent:

```typescript
// First migration
const result1 = await manager.migrateDoc(doc, '1.0.0', '2.0.0');
const migrated1 = result1.migratedDoc;

// Second migration (should be no-op)
const result2 = await manager.migrateDoc(migrated1, '2.0.0', '2.0.0');
const migrated2 = result2.migratedDoc;

// Results should be identical
expect(migrated1).toEqual(migrated2);
```

## Semantic Diff

### Generate Diff

```bash
# Compare two documents
yarn awf:diff --old old-doc.json --new new-doc.json

# Save diff report
yarn awf:diff --old old-doc.json --new new-doc.json --output diff-report.md
```

### Diff Report

```markdown
# Schema Diff Report

**Summary:** 2 added, 1 removed, 1 modified (BREAKING CHANGE)

- **Added:** 2
- **Removed:** 1
- **Modified:** 1
- **Total Changes:** 4
- **Breaking:** Yes

## Changes

### ➕ Added (2)

- **contract.newField**: Added property 'newField'
- **contract.optionalField**: Added property 'optionalField'

### ➖ Removed (1)

- **contract.oldField**: Removed property 'oldField'

### 🔄 Modified (1)

- **contract.acts.allowed**: Value changed from ["SCENE_SET"] to "SCENE_SET"
```

## Best Practices

### Migration Design

1. **Backward Compatible**: Prefer non-breaking changes
2. **Clear Paths**: Provide clear migration paths for breaking changes
3. **Idempotent**: Migrations should be repeatable
4. **Tested**: Test migrations thoroughly
5. **Documented**: Document all changes clearly

### Version Management

1. **Semantic Versioning**: Use proper semantic versioning
2. **Changelog**: Maintain detailed changelogs
3. **Deprecation**: Deprecate before removing
4. **Communication**: Communicate breaking changes early

### Content Management

1. **Backup**: Always backup before migration
2. **Test**: Test migrations on copies first
3. **Rollback**: Have rollback plans ready
4. **Monitoring**: Monitor migration success

## Common Patterns

### Gradual Migration

```typescript
// Phase 1: Add new field alongside old
if (migrated.contract?.oldField) {
  migrated.contract.newField = migrated.contract.oldField;
}

// Phase 2: Remove old field
if (migrated.contract?.oldField) {
  delete migrated.contract.oldField;
}
```

### Conditional Migration

```typescript
// Only migrate if field exists
if (migrated.contract?.deprecatedField) {
  migrated.contract.newField = migrated.contract.deprecatedField;
  delete migrated.contract.deprecatedField;
}
```

### Default Values

```typescript
// Add default if missing
if (!migrated.contract?.newField) {
  migrated.contract.newField = 'default';
}
```

## Troubleshooting

### Common Issues

1. **Migration Fails**: Check field existence and types
2. **Data Loss**: Ensure all data is preserved
3. **Performance**: Optimize migration functions
4. **Testing**: Test migrations thoroughly

### Debugging

1. **Log Changes**: Log what's being migrated
2. **Validate Results**: Check migrated output
3. **Test Edge Cases**: Test unusual data
4. **Monitor Performance**: Track migration time

### Recovery

1. **Backup**: Always have backups
2. **Rollback**: Plan rollback procedures
3. **Validation**: Validate migrated content
4. **Monitoring**: Monitor migration success

## Resources

- [Authoring Guide](../authoring/guide.md)
- [Lint Rules Reference](../authoring/lint-rules.md)
- [Playtest Guide](../authoring/playtests.md)
- [CI Integration Guide](./ci-integration.md)


