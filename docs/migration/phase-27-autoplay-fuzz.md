# Phase 27: Autonomous Playtesting Bots and Fuzz Harness

## Overview

Phase 27 implements a comprehensive autonomous playtesting system that explores game content end-to-end without changing any player-facing UI. The system uses deterministic bots with different behavioral policies to generate high-coverage runs over quest graphs, dialogue/romance rails, economy/party/world-sim, and mods while detecting regressions, soft-locks, and budget violations.

## Key Features

### Bot Core (Deterministic)
- **Heuristic Agents**: Operate on the AWF contract (read bundle, emit input text/choice selection)
- **Bot Modes**: `objective_seeker`, `explorer`, `economy_grinder`, `romance_tester`, `risk_taker`, `safety_max`
- **Model-Free Decisions**: No LLM calls by default, using policies over bundle slices
- **Reproducible Seeding**: `${sessionId}:${turnId}:${botMode}:${rngSeed}` ensures reproducibility
- **Optional LLM-Assist**: Behind a flag for advanced scenarios

### Fuzz Harness
- **Scenario Matrices**: Generate combinations of (world × adventure × locale × experiment variation × module toggles × rngSeed)
- **Mutators**: Tweak budgets (±10%), caps, difficulty, party size, weather regime, vendor stock, mod packs on/off
- **Timeboxed Runs**: Turn cap with oracles to detect failures
- **Parallel Execution**: Multiple shards for efficient testing

### Coverage & Oracles
- **Quest Graph Coverage**: Nodes/edges visited %, frontier reachability
- **Dialogue Coverage**: Unique candidates surfaced/selected, arc steps progressed
- **Mechanics Coverage**: Skill-check bands seen, condition variety, resource curves exercised
- **Economy Coverage**: Loot tiers touched, craft outcomes spectrum, vendor interactions
- **World-Sim Coverage**: Event types triggered, weather states traversed
- **Mods Coverage**: Hook invocations per namespace, violations/quarantines

### Failure Detection (Oracles)
- **Soft-Lock Detection**: N turns without objective progress or no valid graph paths
- **Budget Violations**: Input/output token caps exceeded, repair loops
- **Validator Issues**: Retries > threshold, fallbacks engaged, TIME_ADVANCE rule broken
- **Safety Violations**: Explicit content flags, consent rule breaks
- **Performance Issues**: P95 latency or assembler time over thresholds
- **Integrity Problems**: Acts schema violations, state divergence across replays

## Architecture

### Bot Engine (`backend/src/autoplay/bot-engine.ts`)
- **Deterministic RNG**: Linear congruential generator for reproducible decisions
- **Policy Interface**: `decide(input: AwfBundle, memory) -> { player_text?: string, choice_id?: string }`
- **Composable Policies**: Graph-first, economy-first, romance-gated, etc.
- **Memory Tracking**: Visited nodes, dialogue candidates, skill checks, loot tiers, events, mod hooks
- **Safety Compliance**: Respect module gates and consent rules

### Fuzz Runner (`backend/src/autoplay/fuzz-runner.ts`)
- **Scenario Matrix Generator**: Build comprehensive test matrices
- **Parallel Orchestration**: Run multiple scenarios concurrently
- **Checkpointing & Resume**: Store seed, turn, bot state for recovery
- **Artifact Generation**: JSON reports, HTML summaries, coverage heatmaps, zipped AWF outputs

### Coverage Tracker (`backend/src/autoplay/coverage.ts`)
- **Incremental Coverage**: Stable IDs for consistent tracking
- **Multi-Domain Metrics**: Quest graph, dialogue, mechanics, economy, world-sim, mods
- **Snapshot System**: Turn-by-turn coverage progression
- **Trend Analysis**: Coverage improvement over time

### Oracle Detector (`backend/src/autoplay/oracles.ts`)
- **Configurable Thresholds**: Soft-lock, budget, validator, fallback, safety, performance, integrity
- **Failure Classification**: Critical vs. warning failures
- **History Tracking**: Oracle results over time
- **Summary Generation**: Failure counts and types

### Baseline Manager (`backend/src/autoplay/baselines.ts`)
- **Golden Baselines**: Per (world/adventure/version) combinations
- **Diff Analysis**: Coverage deltas, oracle failures, latency/token drift, behavior drift
- **Tolerance Thresholds**: Allow small % drift, fail CI on significant regressions
- **Verdict System**: Pass/fail/warning based on configurable criteria

## Database Schema

### Tables
- **`autoplay_runs`**: Run metadata, scenario, seed, mode, status, metrics, pass/fail
- **`autoplay_artifacts`**: Generated artifacts (JSON, HTML, PNG, SVG, ZIP)
- **`autoplay_baselines`**: Golden baselines for comparison
- **RLS Policies**: Admin-only access to all autoplay data

### Indexes
- Performance indexes on status, mode, started_at, scenario (GIN), metrics (GIN)
- Artifact indexes on run_id, kind
- Baseline indexes on key

## API Endpoints

### Admin Endpoints
- `POST /api/admin/autoplay/run-matrix`: Start matrix run
- `GET /api/admin/autoplay/runs`: List all runs
- `GET /api/admin/autoplay/runs/:runId`: Get specific run
- `POST /api/admin/autoplay/runs/:runId/stop`: Stop running test
- `POST /api/admin/autoplay/runs/:runId/compare-baseline`: Compare with baseline
- `GET /api/admin/autoplay/artifacts/:runId/:artifactPath`: Download artifact
- `POST /api/admin/autoplay/baselines`: Save baseline
- `GET /api/admin/autoplay/baselines`: List baselines
- `DELETE /api/admin/autoplay/baselines/:key`: Delete baseline
- `GET /api/admin/autoplay/status`: System status

## Frontend UI

### Test Lab (`frontend/src/pages/admin/TestLab.tsx`)
- **Run Configuration**: Worlds, adventures, locales, seeds, bot modes
- **Live Progress**: Real-time run status and progress bars
- **Results Browser**: Filter by status, mode, scenario with pass/fail badges
- **Baseline Comparison**: Side-by-side comparison with tolerance indicators
- **Artifact Viewer**: Download JSON reports, HTML summaries, coverage heatmaps
- **Dashboard**: Summary metrics, trend analysis, failure breakdown

## CI Integration

### Smoke Tests (`backend/scripts/awf-autoplay-smoke.ts`)
- **Lightweight Matrix**: 2 seeds × 1 locale × 1 variation
- **Fast Execution**: < 8 minutes in CI
- **Critical Checks**: Soft-locks, budget violations, safety violations
- **Coverage Thresholds**: Minimum 30% coverage required

### Nightly Matrix (`backend/scripts/awf-autoplay-nightly.ts`)
- **Broad Coverage**: Multiple worlds, adventures, locales, experiments
- **Artifact Uploads**: Comprehensive reports and heatmaps
- **Baseline Updates**: Automatic baseline refresh from successful runs
- **Failure Analysis**: Detailed breakdown of regression causes

## Configuration

### Environment Variables
```bash
AUTOPLAY_ENABLED=true
AUTOPLAY_MAX_TURNS=80
AUTOPLAY_SMOKE_SEEDS=2
AUTOPLAY_NIGHTLY_SEEDS=12
AUTOPLAY_PARALLEL_SHARDS=6
AUTOPLAY_TIMEOUT_MS=900000
AUTOPLAY_FAIL_ON_SOFTLOCKS=true
AUTOPLAY_ALLOW_LLM_ASSIST=false
AUTOPLAY_BASELINE_TOLERANCE=0.05
```

### Oracle Thresholds
```bash
AUTOPLAY_SOFT_LOCK_THRESHOLD=10
AUTOPLAY_BUDGET_VIOLATION_THRESHOLD=0.95
AUTOPLAY_VALIDATOR_RETRY_THRESHOLD=5
AUTOPLAY_FALLBACK_THRESHOLD=3
AUTOPLAY_PERFORMANCE_LATENCY_THRESHOLD=5000
AUTOPLAY_PERFORMANCE_P95_THRESHOLD=10000
```

## Bot Modes

### Objective Seeker
- **Focus**: Complete objectives and progress main quest
- **Strategy**: Prefer choices that advance current objective
- **Fallback**: Coverage-based selection for exploration
- **Use Case**: Main quest validation

### Explorer
- **Focus**: Maximize content coverage
- **Strategy**: Prioritize unexplored nodes and new paths
- **Fallback**: Random exploration when all areas visited
- **Use Case**: Content discovery and edge case finding

### Economy Grinder
- **Focus**: Economic activities (trading, crafting, looting)
- **Strategy**: Seek economic opportunities and dialogue
- **Fallback**: Coverage-based selection
- **Use Case**: Economy system validation

### Romance Tester
- **Focus**: Romance-related content and dialogue
- **Strategy**: Prioritize romance choices and dialogue
- **Fallback**: Coverage-based selection
- **Use Case**: Romance system validation

### Risk Taker
- **Focus**: Risky choices and skill checks
- **Strategy**: Prefer risky options and trigger skill checks
- **Fallback**: Coverage-based selection
- **Use Case**: Difficulty and challenge validation

### Safety Max
- **Focus**: Safe, conservative choices
- **Strategy**: Avoid risky options, prefer safe dialogue
- **Fallback**: Coverage-based selection
- **Use Case**: Safety and accessibility validation

## Coverage Metrics

### Quest Graph Coverage
- **Nodes Visited**: Percentage of quest nodes reached
- **Edges Traversed**: Percentage of quest edges taken
- **Frontier Reachability**: Ability to reach unexplored areas
- **Path Diversity**: Variety of routes through quest graph

### Dialogue Coverage
- **Candidates Surfaced**: Unique dialogue options presented
- **Candidates Selected**: Dialogue options chosen by bots
- **Arc Steps Progressed**: Dialogue arc progression
- **Engagement Rate**: Frequency of dialogue interactions

### Mechanics Coverage
- **Skill Checks**: Different skills and difficulty bands tested
- **Condition Variety**: Various game conditions encountered
- **Resource Curves**: Different resource types and changes
- **System Interactions**: Mechanics working together

### Economy Coverage
- **Loot Tiers**: Different rarity levels obtained
- **Craft Outcomes**: Success/failure rates for crafting
- **Vendor Interactions**: Trading and commerce activities
- **Economic Balance**: Resource flow and value systems

### World Simulation Coverage
- **Event Types**: Different world events triggered
- **Weather States**: Various weather conditions experienced
- **Environmental Changes**: World state modifications
- **Simulation Depth**: Complex world interactions

### Mods Coverage
- **Hook Invocations**: Mod hooks called per namespace
- **Violations Detected**: Mod rule violations found
- **Quarantines Triggered**: Mod isolation events
- **Integration Testing**: Mod-system interactions

## Oracle Detection

### Soft-Lock Detection
- **Objective Stagnation**: No progress on main objectives
- **Graph Dead Ends**: No valid paths from current position
- **Resource Exhaustion**: No valid actions available
- **Loop Detection**: Repetitive behavior patterns

### Budget Violations
- **Token Limits**: Input/output token caps exceeded
- **Repair Loops**: Excessive token usage in single turn
- **Quota Breaches**: Per-namespace limits exceeded
- **Resource Depletion**: Budget exhaustion

### Validator Issues
- **Retry Thresholds**: Too many validation attempts
- **Fallback Engagements**: Excessive fallback usage
- **Rule Violations**: TIME_ADVANCE and other rules broken
- **Schema Errors**: Data structure violations

### Safety Violations
- **Content Flags**: Explicit or inappropriate content
- **Consent Breaches**: Privacy and consent rule violations
- **Age Ratings**: Inappropriate content for target audience
- **Accessibility**: Barriers to user access

### Performance Issues
- **Latency Thresholds**: Turn processing time exceeded
- **P95 Violations**: 95th percentile latency too high
- **Assembler Time**: Content generation delays
- **Resource Usage**: CPU, memory, or network limits

### Integrity Violations
- **Schema Violations**: Data structure inconsistencies
- **State Divergence**: Different states across replays
- **Data Corruption**: Invalid or corrupted data
- **Version Mismatches**: Incompatible data versions

## Baseline Management

### Golden Baselines
- **Per-Scenario Baselines**: Unique baselines for each (world/adventure/version/locale/variation)
- **Metric Aggregation**: Coverage, performance, oracle, and behavior metrics
- **Historical Tracking**: Baseline evolution over time
- **Version Control**: Baseline versioning and rollback

### Comparison System
- **Delta Calculation**: Percentage changes from baseline
- **Tolerance Thresholds**: Configurable acceptance criteria
- **Verdict Generation**: Pass/fail/warning decisions
- **Drill-Down Analysis**: Detailed failure investigation

### Regression Detection
- **Coverage Drops**: Significant coverage decreases
- **Performance Degradation**: Latency and throughput issues
- **New Failures**: Previously passing scenarios now failing
- **Behavior Drift**: Changes in bot behavior patterns

## Artifact Generation

### JSON Reports
- **Structured Data**: Machine-readable test results
- **Coverage Metrics**: Detailed coverage breakdowns
- **Oracle Results**: Failure detection details
- **Performance Data**: Latency and throughput metrics

### HTML Summaries
- **Human-Readable**: Formatted reports for review
- **Interactive Elements**: Expandable sections and filters
- **Visual Indicators**: Color-coded pass/fail status
- **Navigation**: Easy browsing of results

### Coverage Heatmaps
- **Visual Coverage**: SVG heatmaps showing coverage patterns
- **Scenario Comparison**: Side-by-side coverage comparison
- **Mode Analysis**: Bot mode effectiveness visualization
- **Trend Analysis**: Coverage improvement over time

### Performance Charts
- **Latency Distributions**: P50, P95, P99 latency charts
- **Throughput Metrics**: Turns per second, tokens per turn
- **Resource Usage**: CPU, memory, network utilization
- **Bottleneck Analysis**: Performance constraint identification

## Troubleshooting

### Flaky Seeds
- **Seed Analysis**: Identify problematic random seeds
- **Determinism Checks**: Verify reproducible behavior
- **Seed Rotation**: Regular seed pool updates
- **Failure Patterns**: Common failure modes and solutions

### Nondeterminism
- **State Tracking**: Monitor state consistency
- **Timing Issues**: Race condition detection
- **Resource Conflicts**: Shared resource problems
- **Environment Differences**: Test environment variations

### Performance Issues
- **Resource Limits**: CPU, memory, network constraints
- **Bottleneck Identification**: Slow components and processes
- **Optimization Opportunities**: Performance improvement areas
- **Scaling Strategies**: Horizontal and vertical scaling

### Coverage Gaps
- **Unreachable Content**: Content that bots cannot access
- **Edge Cases**: Unusual scenarios not covered
- **Integration Points**: System interaction gaps
- **Manual Testing**: Areas requiring human validation

## Best Practices

### Bot Design
- **Policy Composition**: Combine multiple policies for comprehensive coverage
- **Memory Management**: Efficient state tracking and cleanup
- **Decision Diversity**: Avoid repetitive behavior patterns
- **Safety Compliance**: Respect all safety and consent rules

### Test Design
- **Scenario Selection**: Choose representative test scenarios
- **Seed Management**: Use diverse and meaningful seeds
- **Threshold Tuning**: Balance sensitivity and noise
- **Baseline Maintenance**: Regular baseline updates and validation

### CI Integration
- **Fast Feedback**: Quick smoke tests for immediate feedback
- **Comprehensive Coverage**: Thorough nightly testing
- **Artifact Management**: Efficient storage and retrieval
- **Failure Analysis**: Quick identification of regression causes

### Monitoring
- **Metrics Tracking**: Key performance and quality indicators
- **Alert Systems**: Proactive failure detection
- **Trend Analysis**: Long-term quality trends
- **Capacity Planning**: Resource usage and scaling needs

## Future Enhancements

### Advanced Bot Modes
- **Collaborative Bots**: Multiple bots working together
- **Adaptive Policies**: Learning from previous runs
- **Specialized Modes**: Domain-specific testing strategies
- **Human-in-the-Loop**: Hybrid automated and manual testing

### Enhanced Coverage
- **Semantic Coverage**: Meaning-based content analysis
- **User Journey Coverage**: End-to-end user experience testing
- **Accessibility Coverage**: Inclusive design validation
- **Performance Coverage**: Load and stress testing

### AI Integration
- **LLM-Assisted Testing**: AI-powered test generation
- **Natural Language Analysis**: Content quality assessment
- **Behavioral Modeling**: Human-like bot behavior
- **Intelligent Oracles**: AI-powered failure detection

### Advanced Analytics
- **Predictive Analysis**: Failure prediction and prevention
- **Root Cause Analysis**: Automated failure investigation
- **Quality Metrics**: Comprehensive quality assessment
- **Trend Forecasting**: Long-term quality predictions

## Conclusion

Phase 27 establishes a comprehensive autonomous playtesting system that provides thorough content validation while maintaining high performance and reliability. The system's deterministic nature ensures reproducible results, while its comprehensive coverage and oracle detection capabilities provide confidence in content quality and system stability.

The modular architecture allows for easy extension and customization, while the CI integration ensures continuous quality validation. The extensive documentation and troubleshooting guides support effective system operation and maintenance.
