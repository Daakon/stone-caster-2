# Phase 11 - Tool-Calling Interface

This document covers the implementation of Phase 11 of the AWF migration, which adds dynamic lore slice fetching via a tool-calling interface. This allows the model to request only relevant lore slices at turn time instead of pre-inlining larger summaries.

## Overview

Phase 11 implements a tool-calling interface that enables the model to dynamically fetch lore slices during turn processing:

- **GetLoreSlice Tool**: Model can call `GetLoreSlice({ scope, ref, slice, maxTokens })` to retrieve compact lore slices
- **Caching Layer**: Results are cached with content hash deduplication
- **Quota Enforcement**: Maximum tool calls per turn and token budgets
- **Deterministic Behavior**: Same inputs produce identical outputs
- **No Player UI Changes**: All functionality behind existing AWF runtime

## Architecture

### Tool Call Flow

```
Model Request → Tool Call Detection → GetLoreSlice Tool → Cache Check → Document Fetch → Slice Extraction → Compaction → Cache Store → Return Result
```

### Data Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Model Call    │    │  Tool Handler   │    │  Cache Layer   │
│   (inferWithTools) │ → │  (GetLoreSlice)  │ → │  (Content Hash) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  Document DB    │
                    │  (World/Adv)    │
                    └─────────────────┘
```

## Features

### 1. GetLoreSlice Tool

#### Tool Interface
```typescript
interface AwfToolCall {
  name: "GetLoreSlice";
  arguments: {
    scope: "world" | "adventure";
    ref: string;
    slice: string;
    maxTokens?: number;
  };
}
```

#### Tool Result
```typescript
interface AwfToolResult {
  name: "GetLoreSlice";
  result: {
    ref: string;
    slice: string;
    compact: string;
    tokensEst: number;
    hash: string;
  };
}
```

#### Tool Policy
- **Quota**: Maximum 2 tool calls per turn (configurable)
- **Token Budget**: Maximum 350 tokens per tool result (configurable)
- **Usage Guidelines**: Request smallest slices first, avoid duplicates, integrate naturally

### 2. Caching System

#### Cache Keys
- Format: `awf:slice:{scope}:{ref}:{slice}:{maxTokens}`
- TTL: 1 hour (configurable)
- Deduplication: Content hash-based

#### Cache Behavior
- **Cache Hit**: Return cached result immediately
- **Cache Miss**: Compute, compact, and cache result
- **Invalidation**: Automatic on content hash change

### 3. Token Budget Enforcement

#### Input Budget Integration
- Tool results count toward input token budget
- Truncation when approaching budget limits
- Minimum 80 tokens preserved for readability

#### Output Budget
- Unchanged from Phase 6
- Tool results don't affect output generation

### 4. Quota Management

#### Per-Turn Limits
- **Max Calls**: 2 tool calls per turn (configurable via `AWF_TOOL_MAX_CALLS_PER_TURN`)
- **Max Tokens**: 350 tokens per result (configurable via `AWF_TOOL_MAX_RETURN_TOKENS`)
- **Denial Handling**: Graceful degradation with quota exceeded messages

#### Quota Enforcement
```typescript
if (toolCallCount > quotaInfo.maxCallsPerTurn) {
  return {
    name: 'GetLoreSlice',
    result: {
      ref: toolCall.arguments.ref,
      slice: toolCall.arguments.slice,
      compact: `Tool call quota exceeded (${toolCallCount}/${quotaInfo.maxCallsPerTurn})`,
      tokensEst: 0,
      hash: 'quota-exceeded'
    }
  };
}
```

## Implementation

### 1. Model Provider Extensions

#### Tool-Enabled Interface
```typescript
interface AwfModelProvider {
  infer(input: { system: string; awf_bundle: object }): Promise<{ raw: string; json?: any }>;
  inferWithTools(input: { 
    system: string; 
    awf_bundle: object; 
    tools: AwfToolCall[];
    onToolCall?: (toolCall: AwfToolCall) => Promise<AwfToolResult>;
  }): Promise<{ raw: string; json?: any; toolCalls?: AwfToolCall[] }>;
}
```

#### OpenAI Integration
- Tool schema definition for GetLoreSlice
- Tool call detection and parsing
- Conversation management with tool results
- Response format preservation

### 2. GetLoreSlice Tool Implementation

#### Core Functionality
```typescript
class GetLoreSliceTool {
  async handleToolCall(toolCall: AwfToolCall): Promise<AwfToolResult>
  async getLoreSlice(params: GetLoreSliceParams): Promise<GetLoreSliceResult>
  getQuotaInfo(): { maxCallsPerTurn: number; maxTokens: number }
}
```

#### Document Fetching
- **World Documents**: Fetch from `worlds` table
- **Adventure Documents**: Fetch from `adventures` table
- **Slice Validation**: Verify slice exists in document
- **Content Extraction**: Extract slice content as string

#### Compaction Process
- **Token Estimation**: Rough approximation (1 token ≈ 4 characters)
- **Content Truncation**: Respect maxTokens parameter
- **Key Point Preservation**: Maintain important information
- **Quality Validation**: Ensure readable output

### 3. Orchestrator Integration

#### Tool Call Workflow
1. **First Model Call**: Send bundle with tool schema
2. **Tool Call Detection**: Parse tool calls from model response
3. **Tool Execution**: Process each tool call sequentially
4. **Second Model Call**: Send bundle with tool results
5. **Final Response**: Extract AWF output and validate

#### Quota Tracking
```typescript
let toolCallCount = 0;
const handleToolCall = async (toolCall: AwfToolCall) => {
  toolCallCount++;
  if (toolCallCount > quotaInfo.maxCallsPerTurn) {
    // Deny with quota exceeded message
  }
  // Process tool call
};
```

### 4. System Prompt Integration

#### Tool-Enabled Prompt
```
You will be given one JSON object `awf_bundle`. Return exactly one JSON object named `AWF` with keys `scn`, `txt`, and optional `choices`, `acts`, `val`. No markdown, no code fences, no extra keys. Follow `awf_bundle.contract`.

You may use the GetLoreSlice tool to retrieve specific lore slices when needed. Tool policy: At most 2 GetLoreSlice calls per turn; request smallest slices first; avoid duplicates; do not echo retrieved text verbatim into txt; integrate naturally.
```

## Configuration

### Environment Variables
```bash
# Tool Call Configuration
AWF_TOOL_MAX_CALLS_PER_TURN=2
AWF_TOOL_MAX_RETURN_TOKENS=350

# Cache Configuration (inherited from Phase 6)
REDIS_URL=
AWF_INLINE_SLICE_SUMMARIES=false
```

### Tool Policy
- **Max Calls**: Configurable per-turn limit
- **Max Tokens**: Configurable per-result limit
- **Usage Guidelines**: Built into system prompt
- **Error Handling**: Graceful degradation

## Monitoring and Metrics

### Tool Call Metrics
- `awf.tools.calls.count` - Total tool calls made
- `awf.tools.denied.count` - Tool calls denied (quota exceeded)
- `awf.tools.tokens_returned` - Total tokens returned by tools
- `awf.tools.cache.hit_ratio` - Cache hit ratio

### Logging
```typescript
console.log(`[AWF Turn] Processing tool call ${toolCallCount}/${quotaInfo.maxCallsPerTurn}: ${scope}/${ref}/${slice}`);
console.log(`[AWF Turn] Tool call completed: ${result.result.tokensEst} tokens returned`);
console.log(`[AWF Turn] Model inference completed in ${metrics.modelLatency}ms with ${metrics.toolCalls.count} tool calls`);
```

### Performance Tracking
- **Tool Call Latency**: Time to process each tool call
- **Cache Hit Rate**: Percentage of cache hits vs misses
- **Token Usage**: Total tokens consumed by tool results
- **Quota Utilization**: Percentage of quota used per turn

## Testing

### Unit Tests
- **Tool Call Handling**: Valid and invalid tool calls
- **Cache Behavior**: Hit/miss scenarios and key generation
- **Quota Enforcement**: Over-quota handling
- **Token Budgets**: Truncation and limits
- **Error Handling**: Graceful failure scenarios

### Integration Tests
- **Complete Workflow**: Tool call → model response → validation
- **Determinism**: Same inputs produce identical outputs
- **Performance**: Latency and throughput under load
- **Cache Efficiency**: Hit rates and invalidation

### Test Scenarios
```typescript
// Valid tool call
const toolCall: AwfToolCall = {
  name: 'GetLoreSlice',
  arguments: {
    scope: 'world',
    ref: 'world-1',
    slice: 'history',
    maxTokens: 200
  }
};

// Quota exceeded
const tooManyCalls = Array.from({ length: 3 }, (_, i) => ({
  name: 'GetLoreSlice',
  arguments: {
    scope: 'world',
    ref: 'world-1',
    slice: `slice${i}`,
    maxTokens: 200
  }
}));

// Token budget enforcement
const lowTokenLimit = {
  name: 'GetLoreSlice',
  arguments: {
    scope: 'world',
    ref: 'world-1',
    slice: 'long-slice',
    maxTokens: 50
  }
};
```

## Security Considerations

### Tool Call Validation
- **Scope Validation**: Only 'world' and 'adventure' allowed
- **Reference Validation**: Verify document exists before processing
- **Slice Validation**: Check slice exists in document
- **Token Limits**: Enforce maximum token returns

### Content Safety
- **Text-Only Output**: No JSON blobs in tool results
- **Content Filtering**: Remove sensitive information
- **Error Messages**: Safe error responses for failures
- **Quota Enforcement**: Prevent abuse through limits

### Access Control
- **Document Access**: Respect existing document permissions
- **Tool Availability**: Only available in AWF runtime
- **Admin Override**: No admin bypass for tool calls

## Performance Considerations

### Caching Strategy
- **Content Hash**: Efficient deduplication
- **TTL Management**: Automatic cache expiration
- **Memory Usage**: Bounded cache size
- **Hit Rate Optimization**: Smart cache key generation

### Token Management
- **Budget Integration**: Tool results count toward input budget
- **Truncation Logic**: Intelligent content shortening
- **Quality Preservation**: Maintain readability
- **Performance Impact**: Minimal overhead

### Scalability
- **Concurrent Calls**: Handle multiple tool calls per turn
- **Database Load**: Efficient document fetching
- **Cache Performance**: Fast lookup and storage
- **Memory Usage**: Bounded tool result storage

## Troubleshooting

### Common Issues

#### Tool Call Failures
- **Symptom**: Tool calls return error results
- **Cause**: Document not found or slice missing
- **Solution**: Verify document exists and slice is declared

#### Quota Exceeded
- **Symptom**: Tool calls denied with quota message
- **Cause**: Model making too many tool calls
- **Solution**: Adjust quota limits or model behavior

#### Cache Misses
- **Symptom**: High cache miss rate
- **Cause**: Cache invalidation or memory limits
- **Solution**: Check cache configuration and memory usage

#### Token Budget Issues
- **Symptom**: Tool results truncated unexpectedly
- **Cause**: Approaching input token budget
- **Solution**: Reduce tool result size or increase budget

### Debugging Commands
```bash
# Check tool call metrics
npm run awf:metrics -- --tool-calls

# Test tool call functionality
npm run awf:test-tool -- --scope world --ref world-1 --slice history

# Monitor cache performance
npm run awf:cache-stats
```

## Future Enhancements

### Planned Features
- **Additional Tools**: More tool types beyond GetLoreSlice
- **Tool Chaining**: Sequential tool calls with dependencies
- **Advanced Caching**: Smarter cache invalidation strategies
- **Tool Analytics**: Detailed usage analytics and optimization

### Integration Opportunities
- **Content Management**: Integration with content authoring tools
- **Performance Monitoring**: Real-time tool call performance
- **A/B Testing**: Tool usage optimization experiments
- **Machine Learning**: Predictive tool call optimization

## Conclusion

Phase 11 provides a robust tool-calling interface that enables dynamic lore slice fetching while maintaining:

- **Performance**: Efficient caching and token management
- **Reliability**: Quota enforcement and error handling
- **Security**: Content validation and access control
- **Observability**: Comprehensive metrics and logging
- **Determinism**: Consistent behavior across runs

The implementation allows the model to request only relevant lore slices at turn time, reducing bundle size and improving performance while maintaining the same player experience.


