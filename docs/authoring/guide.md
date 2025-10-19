# AWF Authoring Guide

This guide explains how to create and maintain AWF (Adventure World Framework) content for the StoneCaster application.

## Overview

AWF content consists of four main document types:
- **Core Contracts**: Define the rules and structure for adventures
- **Worlds**: Define the setting, NPCs, locations, and time systems
- **Adventures**: Define specific storylines within a world
- **Adventure Starts**: Define how adventures begin

## Document Structure

### Core Contracts

Core contracts define the fundamental rules for all adventures in a world.

```json
{
  "contract": {
    "acts": {
      "allowed": ["SCENE_SET", "TIME_ADVANCE", "RELATION_DELTA"],
      "exemplars": {
        "SCENE_SET": "Set the current scene",
        "TIME_ADVANCE": "Advance time by one tick"
      }
    },
    "txt": {
      "policy": "Write in second person, present tense. Keep responses engaging and immersive."
    },
    "choices": [
      { "id": "choice1", "label": "Continue" },
      { "id": "choice2", "label": "Investigate" }
    ],
    "output": {
      "budget": {
        "max_acts": 8,
        "max_choices": 5
      }
    }
  }
}
```

**Key Rules:**
- `acts.allowed`: List of permitted act types
- `acts.exemplars`: Examples for each act type
- `txt.policy`: Writing guidelines (2-6 sentences)
- `choices`: Available player choices (≤48 characters each)
- `output.budget`: Limits for generated content

### Worlds

Worlds define the setting, characters, and time system.

```json
{
  "world": {
    "id": "mystika",
    "name": "Mystika",
    "description": "A world of magic and mystery",
    "npcs": [
      {
        "id": "kiera",
        "name": "Kiera",
        "description": "A mysterious figure in the forest"
      }
    ],
    "places": [
      {
        "id": "forest_glade",
        "name": "Forest Glade",
        "description": "A peaceful clearing in the woods"
      }
    ],
    "timeworld": {
      "bands": [
        { "id": "dawn", "name": "Dawn", "ticks": 1 },
        { "id": "day", "name": "Day", "ticks": 2 },
        { "id": "dusk", "name": "Dusk", "ticks": 1 },
        { "id": "night", "name": "Night", "ticks": 2 }
      ]
    },
    "slices": {
      "npcs.essential": {
        "description": "Essential NPCs only",
        "fields": ["npcs.*.name", "npcs.*.description"]
      }
    }
  }
}
```

**Key Rules:**
- `id`: Must be lowercase, no spaces (use underscores or kebab-case)
- `npcs` and `places`: Array of characters and locations
- `timeworld.bands`: At least 4 time bands for cyclic schedule
- `slices`: Optional token optimization definitions

### Adventures

Adventures define specific storylines within a world.

```json
{
  "adventure": {
    "id": "whispercross",
    "name": "Whispercross",
    "description": "A journey through the mystical forest",
    "scenes": [
      {
        "id": "forest_meet",
        "name": "Forest Meeting",
        "description": "The player encounters Kiera in the forest"
      }
    ],
    "objectives": [
      {
        "id": "find_kiera",
        "name": "Find Kiera",
        "description": "Locate the mysterious figure"
      }
    ],
    "slices": {
      "scenes.current": {
        "description": "Current scene only",
        "fields": ["scenes.*.name", "scenes.*.description"]
      }
    }
  }
}
```

**Key Rules:**
- `id`: Must be lowercase, no spaces
- `scenes`: Array of story locations
- `objectives`: Array of story goals
- `slices`: Optional token optimization

### Adventure Starts

Adventure starts define how adventures begin.

```json
{
  "adventure_start": {
    "narrative": "You step into the glade and look toward the eyes. The forest seems to hold its breath.",
    "rules": {
      "no_time_advance": true
    },
    "initial_scene": "forest_meet",
    "choices": [
      { "id": "greet", "label": "Greet softly" },
      { "id": "approach", "label": "Approach cautiously" }
    ]
  }
}
```

**Key Rules:**
- `narrative`: Opening story text
- `rules.no_time_advance`: Must be `true` for first turn
- `initial_scene`: Starting scene ID
- `choices`: Initial player options

## Best Practices

### Writing Guidelines

1. **Tone Policy**: Write in second person, present tense
2. **Sentence Count**: Keep policy text between 2-6 sentences
3. **Choice Labels**: Keep under 48 characters
4. **No Mechanics**: Don't include game mechanics in narrative text

### ID Naming

1. **Lowercase Only**: Use `snake_case` or `kebab-case`
2. **No Spaces**: Use underscores or hyphens
3. **Descriptive**: Make IDs clear and meaningful
4. **Stable**: Don't change IDs once published

### Time Systems

1. **Cyclic Schedule**: Use at least 4 time bands
2. **Balanced Ticks**: Ensure bands sum to a complete cycle
3. **Descriptive Names**: Use clear band names (dawn, day, dusk, night)

### Token Optimization

1. **Use Slices**: Define slice summaries for large documents
2. **Essential Content**: Focus on current scene and active NPCs
3. **Progressive Detail**: Add detail as needed, not all at once

## Linting and Validation

### Running the Linter

```bash
# Lint specific files
yarn awf:lint --paths "worlds/*,adventures/*,start/*"

# Lint with strict mode (warnings as errors)
yarn awf:lint --paths "**/*.json" --strict

# Save report to file
yarn awf:lint --paths "**/*.json" --output "./reports/lint-report.json"
```

### Common Lint Issues

1. **Schema Validation**: Missing required fields
2. **Tone Policy**: Too few/many sentences, mechanics in text
3. **Choice Labels**: Exceeding 48 character limit
4. **Acts Budget**: Unused exemplars, missing allowed acts
5. **First Turn Rules**: Missing `no_time_advance` flag
6. **Stable IDs**: Uppercase or spaces in IDs
7. **Time Bands**: Insufficient bands or zero ticks

### Fixing Issues

1. **Add Missing Fields**: Include all required schema fields
2. **Adjust Text**: Rewrite to meet sentence and character limits
3. **Clean IDs**: Convert to lowercase, replace spaces with underscores
4. **Add Time Bands**: Include at least 4 bands with non-zero ticks
5. **Set Rules**: Add `no_time_advance: true` to start documents

## Schema Evolution

### Versioning

Documents are versioned using semantic versioning (major.minor.patch):
- **Major**: Breaking changes
- **Minor**: New features, backward compatible
- **Patch**: Bug fixes

### Migration

```bash
# Migrate a document
yarn awf:migrate --type adventure --id whispercross --from 1.0.0 --to 1.1.0 --write

# Generate backup
yarn awf:migrate --type world --id mystika --from 1.0.0 --to 2.0.0 --backup
```

### Breaking Changes

Breaking changes include:
- Removing required fields
- Changing field types
- Removing enum values
- Changing array to non-array (or vice versa)

## Playtesting

### Creating Scenarios

```json
{
  "name": "whispercross-smoke-test",
  "description": "Basic smoke test for Whispercross adventure",
  "sessionSeed": 12345,
  "turns": [
    {
      "input": "I step into the glade and look toward the eyes",
      "expect": {
        "mustInclude": ["glade", "eyes"],
        "choicesAtMost": 5
      }
    },
    {
      "input": "I greet softly",
      "expect": {
        "acts": {
          "requireOne": ["SCENE_SET"],
          "forbid": ["TIME_ADVANCE"]
        },
        "firstTurn": true
      }
    }
  ]
}
```

### Running Playtests

```bash
# Record new fixtures
yarn awf:playtest:record --scenario scenarios/whispercross-smoke.json

# Verify against fixtures
yarn awf:playtest:verify --all

# Run specific scenario
yarn awf:playtest:verify --scenario scenarios/whispercross-smoke.json
```

### Scenario Expectations

- **mustInclude**: Required text in response
- **choicesAtMost**: Maximum number of choices
- **acts.requireOne**: Required act types
- **acts.forbid**: Forbidden act types
- **firstTurn**: First turn rules (no TIME_ADVANCE)

## Publishing

### Publish Readiness

Documents must pass all checks before publishing:

1. **Lint Pass**: No errors, warnings allowed (configurable)
2. **Playtest Pass**: All scenarios pass, within performance limits
3. **Admin Approval**: Manual review and approval

### Setting Publish Ready

```bash
# Check readiness
yarn awf:publish --check adventure.whispercross.1.0.0 --lint lint-report.json --playtest playtest-report.json

# Set publish ready
yarn awf:publish --set adventure.whispercross true --actor admin

# Check status
yarn awf:publish --status adventure.whispercross
```

### Publish Gate Report

```bash
# Generate report
yarn awf:publish --report --output publish-report.json
```

## CI Integration

### GitHub Actions

```yaml
name: AWF Content Checks
on: [pull_request]
jobs:
  awf-checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: yarn install
      - name: Run AWF lint
        run: yarn awf:lint --strict
      - name: Run AWF playtest
        run: yarn awf:playtest:verify --all
      - name: Upload reports
        uses: actions/upload-artifact@v3
        with:
          name: awf-reports
          path: reports/
```

### Local CI

```bash
# Run all checks
yarn awf:ci --files "worlds/*,adventures/*"

# Upload artifacts
yarn awf:ci --upload
```

## Troubleshooting

### Common Issues

1. **Lint Failures**: Check schema, tone, and ID requirements
2. **Playtest Failures**: Verify expectations match actual output
3. **Migration Errors**: Ensure migration path exists
4. **Publish Blocked**: Check lint and playtest reports

### Getting Help

1. **Check Logs**: Review error messages and suggestions
2. **Run Linter**: Use `yarn awf:lint` to identify issues
3. **Test Scenarios**: Use `yarn awf:playtest:verify` to check content
4. **Review Docs**: Check this guide and related documentation

## Resources

- [Lint Rules Reference](./lint-rules.md)
- [Playtest Guide](./playtests.md)
- [Schema Evolution](./schema-evolution.md)
- [CI Integration Guide](../migration/ci-integration.md)


