# AWF Lint Rules Reference

This document provides a comprehensive reference for all AWF linting rules, their severity levels, and how to fix common violations.

## Rule Categories

### Schema Validation Rules

#### `schema_validation` (Error)
**Purpose**: Ensures documents have required fields based on their type.

**Violations**:
- Missing `contract` field in core documents
- Missing `world` field in world documents  
- Missing `adventure` field in adventure documents
- Missing `adventure_start` field in start documents

**Fix**: Add the missing required field with appropriate content.

**Example**:
```json
// ❌ Missing contract field
{
  "world": { "id": "test" }
}

// ✅ Has required contract field
{
  "contract": {
    "acts": { "allowed": ["SCENE_SET"] },
    "txt": { "policy": "Write in second person." }
  }
}
```

### Tone Policy Rules

#### `tone_policy` (Error)
**Purpose**: Enforces writing guidelines and content limits.

**Violations**:
- `txt.policy` has fewer than 2 or more than 6 sentences
- `txt.policy` contains game mechanics (should be in acts)
- Choice labels exceed 48 characters

**Fix**: 
- Adjust sentence count in policy text
- Move mechanics to acts section
- Shorten choice labels

**Example**:
```json
// ❌ Too few sentences, mechanics in text, long choice
{
  "contract": {
    "txt": {
      "policy": "Write in second person." // Only 1 sentence
    },
    "choices": [
      { "id": "choice1", "label": "This is a very long choice label that exceeds the 48 character limit and should be shortened" }
    ]
  }
}

// ✅ Proper sentence count, no mechanics, short choice
{
  "contract": {
    "txt": {
      "policy": "Write in second person. Use present tense. Keep it engaging and immersive."
    },
    "choices": [
      { "id": "choice1", "label": "Continue" }
    ]
  }
}
```

### Acts Budget Rules

#### `acts_budget` (Warning)
**Purpose**: Ensures acts are properly defined and exemplars are used.

**Violations**:
- No acts listed in `contract.acts.allowed`
- Unused exemplars in `contract.acts.exemplars`

**Fix**:
- Add allowed acts to the list
- Remove unused exemplars or add them to allowed acts

**Example**:
```json
// ❌ No allowed acts, unused exemplar
{
  "contract": {
    "acts": {
      "allowed": [], // Empty list
      "exemplars": {
        "SCENE_SET": "Set the scene",
        "TIME_ADVANCE": "Advance time" // Not in allowed list
      }
    }
  }
}

// ✅ Proper acts configuration
{
  "contract": {
    "acts": {
      "allowed": ["SCENE_SET", "TIME_ADVANCE"],
      "exemplars": {
        "SCENE_SET": "Set the scene",
        "TIME_ADVANCE": "Advance time"
      }
    }
  }
}
```

### First Turn Rules

#### `first_turn_rules` (Error)
**Purpose**: Ensures start documents have proper first-turn configuration.

**Violations**:
- Missing `rules.no_time_advance` in start documents
- `rules.no_time_advance` not set to `true`

**Fix**: Add the required rule to start documents.

**Example**:
```json
// ❌ Missing no_time_advance rule
{
  "adventure_start": {
    "narrative": "You begin your adventure...",
    "choices": [
      { "id": "start", "label": "Begin" }
    ]
  }
}

// ✅ Has required rule
{
  "adventure_start": {
    "narrative": "You begin your adventure...",
    "rules": {
      "no_time_advance": true
    },
    "choices": [
      { "id": "start", "label": "Begin" }
    ]
  }
}
```

### Slice Coverage Rules

#### `slice_coverage` (Warning)
**Purpose**: Encourages use of slice definitions for token optimization.

**Violations**:
- Missing slice definitions in world documents
- Missing slice definitions in adventure documents

**Fix**: Add slice definitions to reduce token usage.

**Example**:
```json
// ❌ No slice definitions
{
  "world": {
    "id": "mystika",
    "name": "Mystika",
    "npcs": [
      { "id": "kiera", "name": "Kiera", "description": "A mysterious figure" }
    ]
  }
}

// ✅ Has slice definitions
{
  "world": {
    "id": "mystika",
    "name": "Mystika",
    "npcs": [
      { "id": "kiera", "name": "Kiera", "description": "A mysterious figure" }
    ],
    "slices": {
      "npcs.essential": {
        "description": "Essential NPCs only",
        "fields": ["npcs.*.name", "npcs.*.description"]
      }
    }
  }
}
```

### Stable ID Rules

#### `stable_ids` (Error)
**Purpose**: Ensures IDs follow naming conventions.

**Violations**:
- IDs contain uppercase letters
- IDs contain whitespace
- IDs are not descriptive

**Fix**: Convert to lowercase, replace spaces with underscores.

**Example**:
```json
// ❌ Invalid IDs
{
  "world": {
    "places": [
      { "id": "Forest Glade", "name": "Forest Glade" }, // Contains space
      { "id": "UPPERCASE", "name": "Uppercase Place" }  // Contains uppercase
    ]
  }
}

// ✅ Valid IDs
{
  "world": {
    "places": [
      { "id": "forest_glade", "name": "Forest Glade" },
      { "id": "mystic_grove", "name": "Mystic Grove" }
    ]
  }
}
```

### Time Bands Rules

#### `time_bands` (Error)
**Purpose**: Ensures proper time system configuration.

**Violations**:
- Fewer than 4 time bands
- Time bands with zero ticks
- Missing time band configuration

**Fix**: Add at least 4 time bands with non-zero ticks.

**Example**:
```json
// ❌ Insufficient time bands
{
  "world": {
    "timeworld": {
      "bands": [
        { "id": "dawn", "name": "Dawn", "ticks": 1 },
        { "id": "day", "name": "Day", "ticks": 2 }
        // Only 2 bands, need at least 4
      ]
    }
  }
}

// ✅ Proper time bands
{
  "world": {
    "timeworld": {
      "bands": [
        { "id": "dawn", "name": "Dawn", "ticks": 1 },
        { "id": "day", "name": "Day", "ticks": 2 },
        { "id": "dusk", "name": "Dusk", "ticks": 1 },
        { "id": "night", "name": "Night", "ticks": 2 }
      ]
    }
  }
}
```

## Severity Levels

### Error (Blocking)
- **Schema Validation**: Missing required fields
- **Tone Policy**: Sentence count, mechanics in text, choice length
- **First Turn Rules**: Missing no_time_advance flag
- **Stable IDs**: Invalid ID format
- **Time Bands**: Insufficient bands or zero ticks

### Warning (Non-blocking)
- **Acts Budget**: Unused exemplars, missing allowed acts
- **Slice Coverage**: Missing slice definitions

## Configuration

### Lint Config File

Create `awf.lint.config.json` to customize rules:

```json
{
  "rules": {
    "schema_validation": {
      "enabled": true,
      "severity": "error"
    },
    "tone_policy": {
      "enabled": true,
      "severity": "error",
      "options": {
        "maxChoiceLength": 48,
        "minSentences": 2,
        "maxSentences": 6
      }
    },
    "acts_budget": {
      "enabled": true,
      "severity": "warning"
    },
    "first_turn_rules": {
      "enabled": true,
      "severity": "error"
    },
    "slice_coverage": {
      "enabled": true,
      "severity": "warning"
    },
    "stable_ids": {
      "enabled": true,
      "severity": "error"
    },
    "time_bands": {
      "enabled": true,
      "severity": "error",
      "options": {
        "minBands": 4
      }
    }
  },
  "ignore": [
    "node_modules/**",
    ".git/**",
    "**/*.test.json"
  ],
  "strict": false
}
```

### Command Line Options

```bash
# Basic linting
yarn awf:lint --paths "worlds/*,adventures/*"

# Strict mode (warnings as errors)
yarn awf:lint --paths "**/*.json" --strict

# Custom config
yarn awf:lint --paths "**/*.json" --config custom-lint.json

# Save report
yarn awf:lint --paths "**/*.json" --output lint-report.json
```

## Exit Codes

- **0**: Clean (no errors, warnings allowed)
- **1**: Errors found
- **2**: Warnings only (when --strict off)

## Common Fixes

### Schema Issues
1. **Missing Fields**: Add required fields based on document type
2. **Wrong Type**: Ensure fields have correct data types
3. **Invalid Structure**: Follow the documented schema

### Tone Issues
1. **Sentence Count**: Adjust policy text to 2-6 sentences
2. **Mechanics in Text**: Move game mechanics to acts section
3. **Choice Length**: Shorten labels to ≤48 characters

### ID Issues
1. **Uppercase**: Convert to lowercase
2. **Spaces**: Replace with underscores or hyphens
3. **Descriptive**: Use clear, meaningful names

### Time Issues
1. **Band Count**: Add at least 4 time bands
2. **Zero Ticks**: Set appropriate tick values
3. **Cyclic Schedule**: Ensure bands form a complete cycle

### Acts Issues
1. **Missing Allowed**: Add act types to allowed list
2. **Unused Exemplars**: Remove or add to allowed list
3. **Empty Lists**: Define at least one allowed act

## Best Practices

1. **Run Linter Early**: Check content during development
2. **Fix Errors First**: Address blocking issues before warnings
3. **Use Config**: Customize rules for your project needs
4. **CI Integration**: Run linter in continuous integration
5. **Documentation**: Keep this reference handy for team members

## Troubleshooting

### Common Problems

1. **False Positives**: Adjust rule configuration or document structure
2. **Missing Rules**: Ensure all required fields are present
3. **Performance**: Use ignore patterns for large directories
4. **Integration**: Check CI configuration and exit codes

### Getting Help

1. **Check Logs**: Review error messages and suggestions
2. **Test Config**: Validate configuration file syntax
3. **Run Examples**: Use provided examples to understand rules
4. **Team Review**: Discuss complex issues with the team


