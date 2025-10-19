# AWF Playtest Guide

This guide explains how to create, run, and maintain playtest scenarios for AWF content to ensure quality and catch regressions.

## Overview

Playtests are deterministic simulations that run AWF content through the complete pipeline to verify:
- **Content Quality**: Responses match expectations
- **Performance**: Token usage and latency within limits
- **Rules Compliance**: First-turn rules, TIME_ADVANCE usage
- **Regression Prevention**: Changes don't break existing functionality

## Scenario Structure

### Basic Scenario

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
    }
  ]
}
```

### Advanced Scenario

```json
{
  "name": "whispercross-full-test",
  "description": "Complete test for Whispercross adventure",
  "sessionSeed": 54321,
  "expectedMetrics": {
    "maxTokens": 6000,
    "maxActs": 8,
    "maxChoices": 5,
    "timeAdvanceCount": 1
  },
  "turns": [
    {
      "input": "I step into the glade and look toward the eyes",
      "expect": {
        "mustInclude": ["glade", "eyes"],
        "choicesAtMost": 5,
        "acts": {
          "requireOne": ["SCENE_SET"],
          "forbid": ["TIME_ADVANCE"]
        },
        "firstTurn": true
      }
    },
    {
      "input": "I greet softly",
      "expect": {
        "mustInclude": ["greet", "softly"],
        "acts": {
          "requireOne": ["TIME_ADVANCE"]
        }
      }
    },
    {
      "input": "I present the token",
      "expect": {
        "mustInclude": ["token", "present"],
        "acts": {
          "requireOne": ["TIME_ADVANCE"]
        }
      }
    }
  ]
}
```

## Scenario Fields

### Required Fields

- **`name`**: Unique identifier for the scenario
- **`description`**: Human-readable description
- **`sessionSeed`**: Fixed seed for deterministic RNG
- **`turns`**: Array of turn definitions

### Optional Fields

- **`expectedMetrics`**: Performance expectations
  - `maxTokens`: Maximum token usage
  - `maxActs`: Maximum number of acts
  - `maxChoices`: Maximum number of choices
  - `timeAdvanceCount`: Expected TIME_ADVANCE count

## Turn Definitions

### Basic Turn

```json
{
  "input": "I look around",
  "expect": {
    "mustInclude": ["look"],
    "choicesAtMost": 5
  }
}
```

### Advanced Turn

```json
{
  "input": "I greet the mysterious figure",
  "expect": {
    "mustInclude": ["greet", "mysterious", "figure"],
    "choicesAtMost": 5,
    "acts": {
      "requireOne": ["SCENE_SET", "RELATION_DELTA"],
      "forbid": ["TIME_ADVANCE"]
    },
    "firstTurn": true
  }
}
```

### Turn Fields

#### Input
- **`input`**: Player input text

#### Expectations
- **`mustInclude`**: Required text in response
- **`choicesAtMost`**: Maximum number of choices
- **`acts.requireOne`**: Required act types (at least one)
- **`acts.forbid`**: Forbidden act types (none allowed)
- **`firstTurn`**: First turn rules (no TIME_ADVANCE)

## Creating Scenarios

### 1. Identify Test Cases

Consider these scenarios:
- **Smoke Tests**: Basic functionality
- **Edge Cases**: Boundary conditions
- **Error Handling**: Invalid inputs
- **Performance**: High token usage
- **Rules**: First-turn and TIME_ADVANCE rules

### 2. Design Turn Sequences

```json
{
  "name": "first-meet-kiera",
  "description": "First encounter with Kiera",
  "sessionSeed": 424242,
  "turns": [
    {
      "input": "I step into the glade and look toward the eyes",
      "expect": {
        "mustInclude": ["glade", "eyes"],
        "choicesAtMost": 5,
        "firstTurn": true
      }
    },
    {
      "input": "I greet softly",
      "expect": {
        "mustInclude": ["greet", "softly"],
        "acts": {
          "requireOne": ["SCENE_SET"],
          "forbid": ["TIME_ADVANCE"]
        }
      }
    },
    {
      "input": "I present the token",
      "expect": {
        "mustInclude": ["token", "present"],
        "acts": {
          "requireOne": ["TIME_ADVANCE"]
        }
      }
    }
  ]
}
```

### 3. Set Expectations

- **Content**: What should be in the response
- **Structure**: How many choices, acts
- **Rules**: First-turn and TIME_ADVANCE compliance
- **Performance**: Token and latency limits

## Running Playtests

### Record Mode

Record mode captures real model outputs for later verification:

```bash
# Record a specific scenario
yarn awf:playtest:record --scenario scenarios/whispercross-smoke.json

# Record multiple scenarios
yarn awf:playtest:record --scenario scenarios/*.json
```

**When to Use**:
- First time running a scenario
- After content changes
- When updating fixtures

### Verify Mode

Verify mode replays recorded fixtures to check for regressions:

```bash
# Verify all scenarios
yarn awf:playtest:verify --all

# Verify specific scenario
yarn awf:playtest:verify --scenario scenarios/whispercross-smoke.json

# Verify with output report
yarn awf:playtest:verify --all --output playtest-report.json
```

**When to Use**:
- CI/CD pipelines
- Regression testing
- Performance validation

## Fixture Management

### Fixture Storage

Fixtures are stored in `playtests/fixtures/` with naming pattern:
```
{sessionId}_turn_{turnIndex}.json
```

Example:
```
playtests/fixtures/
├── test-12345_turn_0.json
├── test-12345_turn_1.json
└── test-12345_turn_2.json
```

### Fixture Content

Fixtures contain the complete AWF response:

```json
{
  "AWF": {
    "scn": "forest_meet",
    "txt": "You step into the glade and look toward the eyes. The forest seems to hold its breath.",
    "choices": [
      { "id": "greet", "label": "Greet softly" },
      { "id": "approach", "label": "Approach cautiously" }
    ],
    "acts": [
      { "mode": "SCENE_SET", "key": "current_scene", "value": "forest_meet" }
    ]
  }
}
```

### Fixture Updates

When content changes:
1. **Delete old fixtures**: Remove outdated fixtures
2. **Re-record**: Run scenarios in record mode
3. **Verify**: Check that new fixtures work
4. **Commit**: Include fixtures in version control

## Performance Metrics

### Token Usage

Track token consumption per turn:
- **Input tokens**: From player input and context
- **Output tokens**: From generated response
- **Total tokens**: Combined usage

### Latency

Measure response time:
- **Model latency**: Time for model inference
- **Total latency**: End-to-end processing time
- **P95 latency**: 95th percentile response time

### Act Usage

Monitor act application:
- **Act count**: Number of acts per turn
- **Act types**: Which acts are used
- **TIME_ADVANCE**: Proper time progression

## Scenario Examples

### Smoke Test

```json
{
  "name": "basic-functionality",
  "description": "Basic AWF functionality test",
  "sessionSeed": 11111,
  "turns": [
    {
      "input": "I look around",
      "expect": {
        "mustInclude": ["look"],
        "choicesAtMost": 5
      }
    }
  ]
}
```

### First Turn Test

```json
{
  "name": "first-turn-rules",
  "description": "Verify first turn rules",
  "sessionSeed": 22222,
  "turns": [
    {
      "input": "I begin my adventure",
      "expect": {
        "mustInclude": ["adventure"],
        "acts": {
          "forbid": ["TIME_ADVANCE"]
        },
        "firstTurn": true
      }
    }
  ]
}
```

### Time Progression Test

```json
{
  "name": "time-progression",
  "description": "Test time advancement",
  "sessionSeed": 33333,
  "turns": [
    {
      "input": "I wait",
      "expect": {
        "acts": {
          "requireOne": ["TIME_ADVANCE"]
        }
      }
    }
  ]
}
```

### Performance Test

```json
{
  "name": "performance-test",
  "description": "Test performance limits",
  "sessionSeed": 44444,
  "expectedMetrics": {
    "maxTokens": 6000,
    "maxActs": 8,
    "maxChoices": 5
  },
  "turns": [
    {
      "input": "I perform a complex action with many details",
      "expect": {
        "choicesAtMost": 5
      }
    }
  ]
}
```

## CI Integration

### GitHub Actions

```yaml
name: AWF Playtests
on: [pull_request]
jobs:
  playtest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: yarn install
      - name: Run playtests
        run: yarn awf:playtest:verify --all
      - name: Upload reports
        uses: actions/upload-artifact@v3
        with:
          name: playtest-reports
          path: reports/
```

### Local CI

```bash
# Run all playtests
yarn awf:playtest:verify --all

# Run with output
yarn awf:playtest:verify --all --output playtest-report.json

# Check specific scenarios
yarn awf:playtest:verify --scenario scenarios/smoke-test.json
```

## Troubleshooting

### Common Issues

1. **Fixture Missing**: Run in record mode first
2. **Expectation Failures**: Check content and expectations
3. **Performance Issues**: Review token usage and latency
4. **Rule Violations**: Verify first-turn and TIME_ADVANCE rules

### Debugging

1. **Check Logs**: Review error messages and suggestions
2. **Verify Fixtures**: Ensure fixtures are up to date
3. **Test Manually**: Run scenarios manually to verify
4. **Update Expectations**: Adjust expectations if needed

### Best Practices

1. **Regular Testing**: Run playtests frequently
2. **Update Fixtures**: Keep fixtures current with content
3. **Clear Expectations**: Make expectations specific and testable
4. **Performance Monitoring**: Track metrics over time
5. **Documentation**: Document complex scenarios

## Advanced Usage

### Custom Mock Models

```typescript
import { PlaytestHarness } from '../src/playtest/harness.js';

const harness = new PlaytestHarness();
harness.setMockModel({
  generateMockModelResponse: async (input) => {
    // Custom mock response logic
    return {
      AWF: {
        scn: 'test_scene',
        txt: 'Mock response',
        choices: [],
        acts: []
      }
    };
  }
});
```

### Programmatic Testing

```typescript
import { PlaytestHarness } from '../src/playtest/harness.js';

const harness = new PlaytestHarness();
const results = await harness.runScenario('scenarios/test.json');
console.log('Results:', results);
```

### Custom Metrics

```typescript
// Add custom metrics to scenarios
{
  "expectedMetrics": {
    "maxTokens": 6000,
    "maxActs": 8,
    "maxChoices": 5,
    "customMetric": 100
  }
}
```

## Resources

- [Authoring Guide](./guide.md)
- [Lint Rules Reference](./lint-rules.md)
- [Schema Evolution](../migration/schema-evolution.md)
- [CI Integration Guide](../migration/ci-integration.md)


