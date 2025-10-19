/**
 * AWF Turn Orchestrator
 * Phase 5: Turn Pipeline Integration - Orchestrates the complete AWF turn flow
 */

import { createClient } from '@supabase/supabase-js';
import { assembleBundleCached } from '../assemblers/awf-bundle-assembler-cached.js';
import { assembleBundle } from '../assemblers/awf-bundle-assembler.js';
import { applyActs } from '../interpreters/apply-acts.js';
import { createModelProvider, AwfToolCall, AwfToolResult } from '../model/awf-model-provider.js';
import { SYSTEM_AWF_RUNTIME, SYSTEM_AWF_RUNTIME_WITH_TOOLS, createSystemPromptWithRepairHint } from '../model/system-prompts.js';
import { validateAwfOutput, extractAwfFromOutput } from '../validators/awf-output-validator.js';
import { isAwfBundleEnabled } from '../utils/feature-flags.js';
import { awfBudgetEnforcer } from '../config/awf-budgets.js';
import { AWFMetricsUtils, AWFMetrics } from '../metrics/awf-metrics.js';
import { createGetLoreSliceTool } from '../tools/get-lore-slice.js';

/**
 * Estimate output tokens from raw response
 */
function estimateOutputTokens(raw: string): number {
  // Rough approximation: 1 token ≈ 4 characters
  return Math.ceil(raw.length / 4);
}

export interface AwfTurnParams {
  sessionId: string;
  inputText: string;
}

export interface AwfTurnResult {
  txt: string;
  choices: Array<{ id: string; label: string }>;
  meta: { scn: string };
}

export interface AwfTurnMetrics {
  bundleSize: number;
  estimatedTokens: number;
  modelLatency: number;
  validationPassed: boolean;
  retryUsed: boolean;
  toolCalls: {
    count: number;
    denied: number;
    tokensReturned: number;
    cacheHits: number;
  };
  actSummary: {
    relChanges: number;
    objectives: number;
    flags: number;
    resources: number;
    memoryAdded: number;
    memoryPinned: number;
    memoryTrimmed: number;
  };
}

/**
 * Run a complete AWF turn with all phases
 */
export async function runAwfTurn(params: AwfTurnParams): Promise<AwfTurnResult> {
  const { sessionId, inputText } = params;
  
  console.log(`[AWF Turn] Starting turn for session ${sessionId}`);
  const turnStartTime = Date.now();
  
  // Initialize Supabase client
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Check feature flag
  if (!isAwfBundleEnabled({ sessionId })) {
    throw new Error('AWF bundle not enabled for this session');
  }
  
  let metrics: AwfTurnMetrics = {
    bundleSize: 0,
    estimatedTokens: 0,
    modelLatency: 0,
    validationPassed: false,
    retryUsed: false,
    toolCalls: {
      count: 0,
      denied: 0,
      tokensReturned: 0,
      cacheHits: 0
    },
    actSummary: {
      relChanges: 0,
      objectives: 0,
      flags: 0,
      resources: 0,
      memoryAdded: 0,
      memoryPinned: 0,
      memoryTrimmed: 0
    }
  };
  
  try {
    // Phase 1: Assemble bundle with caching
    console.log(`[AWF Turn] Phase 1: Assembling cached bundle for session ${sessionId}`);
    const bundleResult = await assembleBundleCached({ sessionId, inputText });
    const { bundle, metrics: bundleMetrics, budgetResult } = bundleResult as any;
    
    metrics.bundleSize = bundleMetrics.byteSize;
    metrics.estimatedTokens = bundleMetrics.estimatedTokens;
    
    console.log(`[AWF Turn] Bundle assembled: ${metrics.bundleSize} bytes, ~${metrics.estimatedTokens} tokens`);
    
    // Log budget enforcement results
    if (budgetResult.reductions.length > 0) {
      console.log(`[AWF Turn] Budget reductions applied:`, budgetResult.reductions.map((r: any) => r.description).join(', '));
    }
    
    // Phase 2: Call model with tool support
    console.log(`[AWF Turn] Phase 2: Calling model with tools for session ${sessionId}`);
    const modelProvider = createModelProvider();
    const modelConfig = awfBudgetEnforcer.getModelConfig();
    const modelStartTime = Date.now();
    
    // Create GetLoreSlice tool
    const loreSliceTool = createGetLoreSliceTool(supabase);
    const quotaInfo = loreSliceTool.getQuotaInfo();
    
    // Track tool calls for this turn
    let toolCalls: AwfToolCall[] = [];
    let toolResults: AwfToolResult[] = [];
    let toolCallCount = 0;
    
    // Tool call handler
    const handleToolCall = async (toolCall: AwfToolCall): Promise<AwfToolResult> => {
      toolCallCount++;
      
      // Check quota
      if (toolCallCount > quotaInfo.maxCallsPerTurn) {
        console.log(`[AWF Turn] Tool call quota exceeded (${toolCallCount}/${quotaInfo.maxCallsPerTurn}), denying call`);
        metrics.toolCalls.denied++;
        
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
      
      console.log(`[AWF Turn] Processing tool call ${toolCallCount}/${quotaInfo.maxCallsPerTurn}: ${toolCall.arguments.scope}/${toolCall.arguments.ref}/${toolCall.arguments.slice}`);
      
      try {
        const result = await loreSliceTool.handleToolCall(toolCall);
        metrics.toolCalls.count++;
        metrics.toolCalls.tokensReturned += result.result.tokensEst;
        
        if (result.result.hash !== 'error' && result.result.hash !== 'not-found') {
          metrics.toolCalls.cacheHits++;
        }
        
        console.log(`[AWF Turn] Tool call completed: ${result.result.tokensEst} tokens returned`);
        return result;
      } catch (error) {
        console.error(`[AWF Turn] Tool call failed:`, error);
        metrics.toolCalls.denied++;
        
        return {
          name: 'GetLoreSlice',
          result: {
            ref: toolCall.arguments.ref,
            slice: toolCall.arguments.slice,
            compact: `Tool call failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            tokensEst: 0,
            hash: 'error'
          }
        };
      }
    };
    
    // First model call with tool support
    let modelResult = await modelProvider.inferWithTools({
      system: SYSTEM_AWF_RUNTIME_WITH_TOOLS,
      awf_bundle: bundle,
      tools: toolCalls,
      onToolCall: handleToolCall
    });
    
    // Handle tool calls if any were made
    if (modelResult.toolCalls && modelResult.toolCalls.length > 0) {
      console.log(`[AWF Turn] Model requested ${modelResult.toolCalls.length} tool calls`);
      
      // Process tool calls
      for (const toolCall of modelResult.toolCalls) {
        const toolResult = await handleToolCall(toolCall);
        toolResults.push(toolResult);
      }
      
      // Second model call with tool results
      console.log(`[AWF Turn] Making second model call with tool results`);
      modelResult = await modelProvider.inferWithTools({
        system: SYSTEM_AWF_RUNTIME_WITH_TOOLS,
        awf_bundle: bundle,
        tools: toolCalls,
        onToolCall: handleToolCall
      });
    }
    
    metrics.modelLatency = Date.now() - modelStartTime;
    console.log(`[AWF Turn] Model inference completed in ${metrics.modelLatency}ms with ${metrics.toolCalls.count} tool calls`);
    
    // Record model metrics
    AWFMetricsUtils.recordModelInference(
      sessionId,
      'awf-model',
      metrics.modelLatency,
      estimateOutputTokens(modelResult.raw)
    );
    
    // Record tool call metrics
    if (metrics.toolCalls.count > 0) {
      AWFMetricsUtils.recordToolCalls(
        sessionId,
        metrics.toolCalls.count,
        metrics.toolCalls.denied,
        metrics.toolCalls.tokensReturned,
        metrics.toolCalls.cacheHits
      );
    }
    
    // Phase 3: Validate output
    console.log(`[AWF Turn] Phase 3: Validating model output for session ${sessionId}`);
    let awf = extractAwfFromOutput(modelResult.json);
    
    if (!awf) {
      throw new Error('Model output does not contain valid AWF structure');
    }
    
    let validationResult = validateAwfOutput(awf);
    
    // Retry with repair hint if validation fails
    if (!validationResult.isValid) {
      console.log(`[AWF Turn] Validation failed, retrying with repair hint for session ${sessionId}`);
      console.log(`[AWF Turn] Validation errors:`, validationResult.errors);
      
      metrics.retryUsed = true;
      
      // Record validation metrics
      AWFMetricsUtils.recordValidation(sessionId, 1, 0);
      
      // Inject repair hint into bundle contract
      const bundleWithHint = {
        ...bundle,
        awf_bundle: {
          ...bundle.awf_bundle,
          contract: {
            ...bundle.awf_bundle.contract,
            val_hint: validationResult.repairHint
          }
        }
      };
      
      // Retry model call
      const retryStartTime = Date.now();
      modelResult = await modelProvider.infer({
        system: createSystemPromptWithRepairHint(validationResult.repairHint || ''),
        awf_bundle: bundleWithHint
      });
      
      const retryLatency = Date.now() - retryStartTime;
      metrics.modelLatency += retryLatency;
      
      console.log(`[AWF Turn] Retry completed in ${retryLatency}ms`);
      
      // Re-validate
      awf = extractAwfFromOutput(modelResult.json);
      if (!awf) {
        throw new Error('Retry output does not contain valid AWF structure');
      }
      
      validationResult = validateAwfOutput(awf);
      
      if (!validationResult.isValid) {
        console.error(`[AWF Turn] Validation still failed after retry for session ${sessionId}`);
        console.error(`[AWF Turn] Retry validation errors:`, validationResult.errors);
        throw new Error(`AWF validation failed after retry: ${validationResult.errors.map(e => e.message).join(', ')}`);
      }
    }
    
    metrics.validationPassed = true;
    console.log(`[AWF Turn] Validation passed for session ${sessionId}`);
    
    // Phase 4: Apply acts
    console.log(`[AWF Turn] Phase 4: Applying acts for session ${sessionId}`);
    const actResult = await applyActs({ sessionId, awf }, supabase);
    
    // Update metrics with act summary
    metrics.actSummary = {
      relChanges: actResult.summary.relChanges.length,
      objectives: actResult.summary.objectives.length,
      flags: actResult.summary.flags.length,
      resources: actResult.summary.resources.length,
      memoryAdded: actResult.summary.memory.added,
      memoryPinned: actResult.summary.memory.pinned,
      memoryTrimmed: actResult.summary.memory.trimmed
    };
    
    console.log(`[AWF Turn] Acts applied for session ${sessionId}:`, metrics.actSummary);
    
    // Record act application metrics
    AWFMetricsUtils.recordActApplication(sessionId, metrics.actSummary, 0);
    
    // Phase 5: Return legacy-compatible response
    const result: AwfTurnResult = {
      txt: awf.txt,
      choices: (awf.choices || []).map((choice: any) => ({
        id: choice.id,
        label: choice.label
      })),
      meta: { scn: awf.scn }
    };
    
    const totalTime = Date.now() - turnStartTime;
    const turnLatency = totalTime;
    
    // Record complete turn metrics
    const awfMetrics: AWFMetrics = {
      bundleBytes: metrics.bundleSize,
      bundleTokensEst: metrics.estimatedTokens,
      modelLatencyMs: metrics.modelLatency,
      modelOutputTokensEst: estimateOutputTokens(modelResult.raw),
      turnLatencyMs: totalTime,
      validatorRetries: metrics.retryUsed ? 1 : 0,
      fallbacksCount: 0,
      toolCalls: metrics.toolCalls,
      actSummary: metrics.actSummary
    };
    
    AWFMetricsUtils.recordTurnComplete(sessionId, 0, totalTime, awfMetrics);
    
    // Record structured log
    const structuredLog = {
      sessionId,
      turnId: 0, // TODO: get actual turn ID
      bundleTokens: metrics.estimatedTokens,
      outputTokens: estimateOutputTokens(modelResult.raw),
      retries: metrics.retryUsed ? 1 : 0,
      reductions: budgetResult.reductions.map((r: any) => r.description),
      actSummary: metrics.actSummary,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    };
    
    console.log(`[AWF Turn] Turn completed for session ${sessionId} in ${totalTime}ms`);
    console.log(`[AWF Turn] Final metrics:`, metrics);
    console.log(`[AWF Turn] Structured log:`, JSON.stringify(structuredLog));
    
    return result;
    
  } catch (error) {
    const totalTime = Date.now() - turnStartTime;
    console.error(`[AWF Turn] Turn failed for session ${sessionId} after ${totalTime}ms:`, error);
    
    // Record fallback metrics
    AWFMetricsUtils.recordFallback(sessionId, 'error');
    
    // Check if we should disable AWF for this session due to repeated failures
    await checkAndHandleRepeatedFailures(sessionId, error instanceof Error ? error : new Error(String(error)));
    
    throw error;
  }
}

/**
 * Check for repeated failures and disable AWF if necessary
 */
async function checkAndHandleRepeatedFailures(sessionId: string, error: Error): Promise<void> {
  // This is a simplified implementation - in production you'd want to track
  // failure counts in a database or Redis cache
  const failureKey = `awf_failures_${sessionId}`;
  
  // For now, just log the failure - in production you'd implement proper tracking
  console.warn(`[AWF Turn] Session ${sessionId} failed: ${error.message}`);
  
  // TODO: Implement circuit breaker logic
  // - Track consecutive failures per session
  // - Disable AWF for session after 2 consecutive failures
  // - Log WARN when disabling
}

/**
 * Run AWF turn in dry-run mode (assemble + validate, no acts)
 */
export async function runAwfTurnDry(params: AwfTurnParams): Promise<{
  bundle: any;
  awf: any;
  metrics: AwfTurnMetrics;
}> {
  const { sessionId, inputText } = params;
  
  console.log(`[AWF Turn Dry] Starting dry run for session ${sessionId}`);
  
  // Initialize Supabase client
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Check feature flag
  if (!isAwfBundleEnabled({ sessionId })) {
    throw new Error('AWF bundle not enabled for this session');
  }
  
  let metrics: AwfTurnMetrics = {
    bundleSize: 0,
    estimatedTokens: 0,
    modelLatency: 0,
    validationPassed: false,
    retryUsed: false,
    toolCalls: {
      count: 0,
      denied: 0,
      tokensReturned: 0,
      cacheHits: 0
    },
    actSummary: {
      relChanges: 0,
      objectives: 0,
      flags: 0,
      resources: 0,
      memoryAdded: 0,
      memoryPinned: 0,
      memoryTrimmed: 0
    }
  };
  
  try {
    // Phase 1: Assemble bundle
    console.log(`[AWF Turn Dry] Phase 1: Assembling bundle for session ${sessionId}`);
    const bundleResult = await assembleBundle({ sessionId, inputText });
    const { bundle, metrics: bundleMetrics } = bundleResult;
    
    metrics.bundleSize = bundleMetrics.byteSize;
    metrics.estimatedTokens = bundleMetrics.estimatedTokens;
    
    // Phase 2: Call model
    console.log(`[AWF Turn Dry] Phase 2: Calling model for session ${sessionId}`);
    const modelProvider = createModelProvider();
    const modelStartTime = Date.now();
    
    const modelResult = await modelProvider.infer({
      system: SYSTEM_AWF_RUNTIME,
      awf_bundle: bundle
    });
    
    metrics.modelLatency = Date.now() - modelStartTime;
    
    // Phase 3: Validate output
    console.log(`[AWF Turn Dry] Phase 3: Validating model output for session ${sessionId}`);
    const awf = extractAwfFromOutput(modelResult.json);
    
    if (!awf) {
      throw new Error('Model output does not contain valid AWF structure');
    }
    
    const validationResult = validateAwfOutput(awf);
    metrics.validationPassed = validationResult.isValid;
    
    if (!validationResult.isValid) {
      console.log(`[AWF Turn Dry] Validation failed:`, validationResult.errors);
    }
    
    console.log(`[AWF Turn Dry] Dry run completed for session ${sessionId}`);
    
    return { bundle, awf, metrics };
    
  } catch (error) {
    console.error(`[AWF Turn Dry] Dry run failed for session ${sessionId}:`, error);
    throw error;
  }
}
