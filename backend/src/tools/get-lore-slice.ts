/**
 * GetLoreSlice Tool
 * Phase 11: Tool-Calling Interface - Server implementation for dynamic lore slice retrieval
 */

import { createClient } from '@supabase/supabase-js';
import { compactSlice } from '../compactors/slice-compactor.js';
import { CacheProvider } from '../cache/CacheProvider.js';
import { InMemoryCacheProvider } from '../cache/CacheProvider.js';
import { AwfToolCall, AwfToolResult } from '../model/awf-model-provider.js';
import crypto from 'crypto';

export interface GetLoreSliceParams {
  scope: 'world' | 'adventure';
  ref: string;
  slice: string;
  maxTokens?: number;
}

export interface GetLoreSliceResult {
  ref: string;
  slice: string;
  compact: string;
  tokensEst: number;
  hash: string;
  cacheHit: boolean;
  violation?: string;
}

export class GetLoreSliceTool {
  private supabase: any;
  private cache: CacheProvider;
  private maxTokens: number;
  private maxCallsPerTurn: number;
  private currentTurnCalls: number = 0;

  constructor(supabase: any, cache?: CacheProvider) {
    this.supabase = supabase;
    this.cache = cache || new InMemoryCacheProvider();
    this.maxTokens = parseInt(process.env.AWF_TOOL_MAX_RETURN_TOKENS || '350', 10);
    this.maxCallsPerTurn = parseInt(process.env.AWF_TOOL_MAX_CALLS_PER_TURN || '2', 10);
  }

  /**
   * Handle a GetLoreSlice tool call
   */
  async handleToolCall(toolCall: AwfToolCall): Promise<AwfToolResult> {
    const { scope, ref, slice, maxTokens } = toolCall.arguments;
    const effectiveMaxTokens = Math.min(maxTokens || this.maxTokens, this.maxTokens);

    console.log(`[GetLoreSlice] Handling tool call: ${scope}/${ref}/${slice} (maxTokens: ${effectiveMaxTokens})`);

    // Check quota
    this.currentTurnCalls++;
    if (this.currentTurnCalls > this.maxCallsPerTurn) {
      console.log(`[GetLoreSlice] Tool call quota exceeded (${this.currentTurnCalls}/${this.maxCallsPerTurn}), denying call`);
      
      return {
        name: 'GetLoreSlice',
        result: {
          ref,
          slice,
          compact: `Tool call quota exceeded (${this.currentTurnCalls}/${this.maxCallsPerTurn})`,
          tokensEst: 0,
          hash: 'quota-exceeded'
        }
      };
    }

    try {
      const result = await this.getLoreSlice({
        scope,
        ref,
        slice,
        maxTokens: effectiveMaxTokens
      });

      return {
        name: 'GetLoreSlice',
        result: {
          ref: result.ref,
          slice: result.slice,
          compact: result.compact,
          tokensEst: result.tokensEst,
          hash: result.hash
        }
      };
    } catch (error) {
      console.error(`[GetLoreSlice] Tool call failed:`, error);
      
      // Return error result
      return {
        name: 'GetLoreSlice',
        result: {
          ref,
          slice,
          compact: `Error retrieving slice ${slice}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          tokensEst: 0,
          hash: 'error'
        }
      };
    }
  }

  /**
   * Get a lore slice with caching and validation
   */
  async getLoreSlice(params: GetLoreSliceParams): Promise<GetLoreSliceResult> {
    const { scope, ref, slice, maxTokens } = params;
    const effectiveMaxTokens = Math.min(maxTokens || this.maxTokens, this.maxTokens);

    // Generate cache key
    const cacheKey = this.buildCacheKey(scope, ref, slice, effectiveMaxTokens);
    
    // Try cache first
    const cached = await this.cache.get<GetLoreSliceResult>(cacheKey);
    if (cached) {
      console.log(`[GetLoreSlice] Cache hit for ${scope}/${ref}/${slice}`);
      return { ...cached, cacheHit: true };
    }

    console.log(`[GetLoreSlice] Cache miss for ${scope}/${ref}/${slice}, computing...`);

    // Fetch document and validate slice exists
    const doc = await this.fetchDocument(scope, ref);
    if (!doc) {
      const notFoundResult = this.createNotFoundResult(ref, slice);
      return { ...notFoundResult, cacheHit: false };
    }

    // Validate slice exists in document
    if (!this.validateSliceExists(doc, slice)) {
      const notFoundResult = this.createNotFoundResult(ref, slice);
      return { ...notFoundResult, cacheHit: false, violation: `Slice '${slice}' not found in ${scope} document` };
    }

    // Extract slice content
    const sliceContent = this.extractSliceContent(doc, slice);
    if (!sliceContent) {
      const notFoundResult = this.createNotFoundResult(ref, slice);
      return { ...notFoundResult, cacheHit: false, violation: `Slice '${slice}' is empty in ${scope} document` };
    }

    // Compact the slice
    const compacted = compactSlice(sliceContent, slice, { 
      maxTokens: effectiveMaxTokens,
      preserveKeyPoints: true,
      includeMetadata: false
    });

    // Ensure we don't exceed token limit
    let finalCompact = compacted.content;
    if (compacted.tokenCount > effectiveMaxTokens) {
      finalCompact = this.truncateToTokenLimit(compacted.content, effectiveMaxTokens);
    }

    // Generate content hash
    const hash = crypto.createHash('sha256').update(finalCompact).digest('hex').substring(0, 16);

    const result: GetLoreSliceResult = {
      ref,
      slice,
      compact: finalCompact,
      tokensEst: this.estimateTokens(finalCompact),
      hash,
      cacheHit: false
    };

    // Cache the result
    await this.cache.set(cacheKey, result, { ttlSec: 3600 }); // 1 hour TTL

    console.log(`[GetLoreSlice] Computed and cached ${scope}/${ref}/${slice} (${result.tokensEst} tokens)`);
    return result;
  }

  /**
   * Build cache key for slice
   */
  private buildCacheKey(scope: string, ref: string, slice: string, maxTokens: number): string {
    return `awf:slice:${scope}:${ref}:${slice}:${maxTokens}`;
  }

  /**
   * Fetch document from database
   */
  private async fetchDocument(scope: 'world' | 'adventure', ref: string): Promise<any> {
    const table = scope === 'world' ? 'worlds' : 'adventures';
    
    const { data, error } = await this.supabase
      .from(table)
      .select('*')
      .eq('id', ref)
      .single();

    if (error) {
      console.error(`[GetLoreSlice] Error fetching ${scope} document ${ref}:`, error);
      return null;
    }

    return data;
  }

  /**
   * Validate that slice exists in document
   */
  private validateSliceExists(doc: any, slice: string): boolean {
    // Check if slice is declared in the document
    if (doc.slices && Array.isArray(doc.slices)) {
      return doc.slices.includes(slice);
    }

    // Check if slice exists as a property
    return doc[slice] !== undefined;
  }

  /**
   * Extract slice content from document
   */
  private extractSliceContent(doc: any, slice: string): string | null {
    // Try to get slice content from document
    const sliceContent = doc[slice];
    
    if (typeof sliceContent === 'string') {
      return sliceContent;
    }

    if (typeof sliceContent === 'object' && sliceContent !== null) {
      return JSON.stringify(sliceContent, null, 2);
    }

    return null;
  }

  /**
   * Create a "not found" result for unknown slices
   */
  private createNotFoundResult(ref: string, slice: string): GetLoreSliceResult {
    const notFoundText = `Slice '${slice}' not found in document ${ref}`;
    return {
      ref,
      slice,
      compact: notFoundText,
      tokensEst: this.estimateTokens(notFoundText),
      hash: 'not-found',
      cacheHit: false
    };
  }

  /**
   * Truncate content to fit within token limit
   */
  private truncateToTokenLimit(content: string, maxTokens: number): string {
    const words = content.split(/\s+/);
    let result = '';
    let tokenCount = 0;

    for (const word of words) {
      const testResult = result + (result ? ' ' : '') + word;
      const testTokens = this.estimateTokens(testResult);
      
      if (testTokens > maxTokens) {
        break;
      }
      
      result = testResult;
      tokenCount = testTokens;
    }

    return result.trim();
  }

  /**
   * Estimate token count for text
   */
  private estimateTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Get tool call quota information
   */
  getQuotaInfo(): { maxCallsPerTurn: number; maxTokens: number } {
    return {
      maxCallsPerTurn: this.maxCallsPerTurn,
      maxTokens: this.maxTokens
    };
  }

  /**
   * Reset turn counter (call at start of each turn)
   */
  resetTurnCounter(): void {
    this.currentTurnCalls = 0;
  }
}

/**
 * Create GetLoreSlice tool instance
 */
export function createGetLoreSliceTool(supabase: any, cache?: CacheProvider): GetLoreSliceTool {
  return new GetLoreSliceTool(supabase, cache);
}
