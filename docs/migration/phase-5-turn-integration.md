# Phase 5: AWF Turn Pipeline Integration

This document outlines the implementation of Phase 5 of the AWF migration, which integrates the complete AWF turn flow into the existing turn endpoint. This phase wires together bundle assembly, model inference, output validation, and act application while preserving the legacy response contract.

## Overview

Phase 5 creates a complete turn orchestrator that:
1. **Assembles** the AWF bundle using Phase 3 components
2. **Calls** the model with the bundle and system prompt
3. **Validates** the AWF output with retry/repair logic
4. **Applies** acts transactionally using Phase 4 components
5. **Returns** the same API response format the UI expects

## Architecture

### Turn Orchestrator Flow

```
Player Input → Feature Flag Check → AWF Orchestrator
                                        ↓
                              [Assemble Bundle] → [Model Inference] → [Validate Output]
                                        ↓                              ↓
                              [Apply Acts] ← [Retry with Repair Hint] ← [Validation Failed]
                                        ↓
                              [Return Legacy Response]
```

### Key Components

#### 1. Model Provider Abstraction
- **File**: `backend/src/model/awf-model-provider.ts`
- **Purpose**: Abstracts model inference with configurable providers
- **Features**:
  - OpenAI integration with JSON-only output
  - Configurable model name and timeout
  - Mock provider for testing
  - Raw response capture for debugging

#### 2. System Prompts
- **File**: `backend/src/model/system-prompts.ts`
- **Purpose**: Minimal system prompt for AWF runtime
- **Features**:
  - Engine contract compliance
  - Repair hint injection for retry logic
  - Configurable repair guidance

#### 3. Output Validator
- **File**: `backend/src/validators/awf-output-validator.ts`
- **Purpose**: Validates AWF model output against schema
- **Features**:
  - Required field validation (scn, txt)
  - Array length constraints (choices ≤ 5, acts ≤ 8)
  - Structure validation for choices and acts
  - Extra key detection
  - Repair hint generation

#### 4. Turn Orchestrator
- **File**: `backend/src/orchestrators/awf-turn-orchestrator.ts`
- **Purpose**: Orchestrates the complete AWF turn flow
- **Features**:
  - Full turn flow (assemble → infer → validate → apply)
  - Dry-run mode for testing
  - Retry logic with repair hints
  - Legacy response format conversion
  - Comprehensive metrics and logging

## Implementation Details

### Model Provider Configuration

```typescript
// Environment variables
AWF_MODEL_NAME=gpt-4o-mini          // Default model
AWF_MODEL_TIMEOUT_MS=120000         // 2 minute timeout
AWF_MODEL_MAX_RETRIES=2              // Retry attempts

// Model provider creation
const provider = createModelProvider();
```

### System Prompt

The minimal system prompt ensures model compliance:

```
You will be given one JSON object `awf_bundle`. Return exactly one JSON object named `AWF` with keys `scn`, `txt`, and optional `choices`, `acts`, `val`. No markdown, no code fences, no extra keys. Follow `awf_bundle.contract`.
```

### Output Validation Schema

The validator enforces strict schema compliance:

#### Required Fields
- `scn`: string (scene identifier)
- `txt`: string (response text)

#### Optional Fields
- `choices`: array of objects with `id` and `label` (max 5)
- `acts`: array of objects with `type` and `data` (max 8)
- `val`: string (validation hint)

#### Constraints
- No extra keys allowed
- Proper data types for all fields
- Valid choice and act structures

### Retry Logic

When validation fails, the system:

1. **Generates Repair Hint**: Based on validation errors
2. **Injects Hint**: Adds `contract.val_hint` to bundle
3. **Retries Model**: Calls model with repair hint
4. **Re-validates**: Checks output again
5. **Fails Gracefully**: Returns 422 error if still invalid

### Legacy Response Conversion

The orchestrator converts AWF output to legacy format:

```typescript
// AWF Output
{
  scn: 'forest_clearing',
  txt: 'You enter a peaceful forest clearing.',
  choices: [
    { id: 'explore', label: 'Explore the area' },
    { id: 'rest', label: 'Rest here' }
  ]
}

// Legacy Response
{
  txt: 'You enter a peaceful forest clearing.',
  choices: [
    { id: 'explore', text: 'Explore the area' },
    { id: 'rest', text: 'Rest here' }
  ],
  meta: { scn: 'forest_clearing' }
}
```

## Feature Flag Integration

The turn endpoint checks the feature flag before routing:

```typescript
if (isAwfBundleEnabled({ sessionId })) {
  // Use AWF orchestrator
  const result = await runAwfTurn({ sessionId, inputText });
  return convertToLegacyFormat(result);
} else {
  // Use legacy path
  return await runLegacyTurn(...);
}
```

### Session-Level Overrides

Sessions can be individually enabled/disabled:

```typescript
// Enable for specific session
setAwfBundleOverride('session-123', true);

// Disable for specific session
setAwfBundleOverride('session-123', false);

// Clear override (use global setting)
clearAwfBundleOverride('session-123');
```

## Error Handling

### Circuit Breaker Pattern

The system implements a circuit breaker for repeated failures:

1. **Track Failures**: Count consecutive failures per session
2. **Disable AWF**: After 2 consecutive failures
3. **Fallback**: Use legacy path for disabled sessions
4. **Log Warnings**: Alert on session disable

### Error Types

#### Validation Errors
- Missing required fields
- Wrong data types
- Array length violations
- Extra keys detected

#### Model Errors
- API timeouts
- Rate limiting
- Invalid responses
- Network failures

#### Act Application Errors
- Transaction failures
- Database errors
- Contract violations
- State corruption

## Development Tools

### Dev Script: `run-awf-turn.ts`

```bash
# Full turn (assemble → infer → validate → apply)
npm run awf:turn -- --session session-123 --text "I want to explore"

# Dry run (assemble → infer → validate, no acts)
npm run awf:turn -- --session session-123 --text "I want to explore" --dry
```

#### Output Format

```
=== TURN RESULT ===
Text: You enter a peaceful forest clearing.
Scene: forest_clearing
Choices: 2

=== CHOICES ===
1. explore: Explore the area
2. rest: Rest here

✅ Full turn completed successfully
```

### Metrics and Logging

The orchestrator provides comprehensive metrics:

```typescript
interface AwfTurnMetrics {
  bundleSize: number;           // Bundle size in bytes
  estimatedTokens: number;      // Estimated token count
  modelLatency: number;        // Model inference time
  validationPassed: boolean;   // Validation success
  retryUsed: boolean;         // Retry was needed
  actSummary: {               // Act application summary
    relChanges: number;
    objectives: number;
    flags: number;
    resources: number;
    memoryAdded: number;
    memoryPinned: number;
    memoryTrimmed: number;
  };
}
```

## Testing

### Unit Tests

#### Orchestrator Tests
- Complete turn flow success
- Validation failure and retry
- Feature flag behavior
- Error handling scenarios

#### Validator Tests
- Correct output validation
- Missing field detection
- Type validation
- Array length constraints
- Extra key detection
- Repair hint generation

#### Model Provider Tests
- OpenAI integration
- Mock provider behavior
- Error handling
- Timeout scenarios

### Integration Tests

#### End-to-End Flow
- Assemble → Infer → Validate → Apply
- First-turn behavior
- Subsequent-turn behavior
- Act application verification

#### Error Scenarios
- Model failures
- Validation failures
- Act application failures
- Database transaction failures

## Performance Considerations

### Timeouts
- **Model Inference**: 2 minutes (configurable)
- **Database Operations**: 30 seconds
- **Total Turn**: 5 minutes maximum

### Rate Limiting
- **Model API**: Respects provider limits
- **Database**: Connection pooling
- **Concurrent Turns**: Session-based queuing

### Caching
- **Bundle Assembly**: Session state caching
- **Model Responses**: Idempotency keys
- **Database Queries**: Connection reuse

## Security

### Input Validation
- **Bundle Content**: Schema validation
- **Model Input**: Size limits
- **Database**: Parameterized queries

### Output Sanitization
- **Model Output**: JSON validation
- **Act Data**: Type checking
- **Response**: Legacy format conversion

### Access Control
- **Session Authorization**: User-based access
- **Feature Flags**: Admin-controlled
- **Database**: RLS enforcement

## Troubleshooting

### Common Issues

#### Validation Failures
- **Missing Fields**: Check model output format
- **Extra Keys**: Review model instructions
- **Type Errors**: Verify data types
- **Array Length**: Check constraints

#### Model Errors
- **Timeout**: Increase timeout or reduce bundle size
- **Rate Limit**: Implement backoff strategy
- **Invalid JSON**: Check model configuration
- **Wrong Format**: Verify system prompt

#### Act Application Errors
- **Transaction Failures**: Check database state
- **Contract Violations**: Review act types
- **State Corruption**: Verify session data
- **Permission Errors**: Check RLS policies

### Debug Commands

```bash
# Check feature flag status
npm run awf:turn -- --session session-123 --text "debug" --dry

# Validate bundle assembly
npm run dump:awf-bundle -- --session session-123 --text "debug"

# Test act application
npm run awf:apply -- --session session-123 --awf-file test-awf.json
```

## Future Enhancements

### Planned Features
- **Custom Models**: Support for other providers
- **Advanced Retry**: Exponential backoff
- **Metrics Dashboard**: Real-time monitoring
- **A/B Testing**: Gradual rollout

### Performance Optimizations
- **Bundle Caching**: Reduce assembly time
- **Model Batching**: Multiple turns
- **Database Optimization**: Query tuning
- **Memory Management**: Garbage collection

## Migration Strategy

### Phase 5 Rollout
1. **Feature Flag**: Enable for test sessions
2. **Monitoring**: Track metrics and errors
3. **Gradual Rollout**: Increase session percentage
4. **Full Migration**: Disable legacy path

### Rollback Plan
1. **Disable Feature Flag**: Revert to legacy
2. **Session Override**: Disable problematic sessions
3. **Database Rollback**: Restore from backup
4. **Model Fallback**: Use legacy model calls

## Conclusion

Phase 5 successfully integrates the complete AWF turn flow into the existing system while maintaining backward compatibility. The implementation provides robust error handling, comprehensive testing, and detailed monitoring to ensure reliable operation in production.

The system is now ready for gradual rollout with the ability to fall back to the legacy path if needed, ensuring a smooth transition to the new AWF-based turn processing system.


