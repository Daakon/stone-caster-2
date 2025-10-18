/**
 * Phase 22: Assembler Integration for Mod Micro-Slices
 * Handles onAssemble hooks and token-efficient context exposure
 */

import { z } from 'zod';
import { HookBus, HookContext, HOOK_TYPES } from './hook-bus';
import { ModPacksService } from './packs-service';

// Types
export interface ModSlice {
  namespace: string;
  path: string;
  data: any;
  tokens: number;
  priority: number;
}

export interface ModContext {
  namespace: string;
  slices: ModSlice[];
  total_tokens: number;
  trimmed: boolean;
}

export interface AssemblerModResult {
  mod_ctx: Record<string, ModContext>;
  total_tokens: number;
  trimmed_namespaces: string[];
  violations: string[];
}

export class AssemblerModIntegration {
  private modPacksService: ModPacksService;
  private hookBus: HookBus;
  private config: any;

  constructor(
    modPacksService: ModPacksService,
    hookBus: HookBus,
    config: any
  ) {
    this.modPacksService = modPacksService;
    this.hookBus = hookBus;
    this.config = config;
  }

  /**
   * Process onAssemble hooks and build mod context
   */
  async processAssembleHooks(
    sessionId: string,
    turnId: number,
    gameState: any,
    baseSlices: Record<string, any>
  ): Promise<AssemblerModResult> {
    const startTime = Date.now();
    const violations: string[] = [];
    const trimmedNamespaces: string[] = [];

    try {
      // Create hook context
      const context: HookContext = {
        session_id: sessionId,
        turn_id: turnId,
        hook_type: HOOK_TYPES.ASSEMBLE,
        game_state: gameState,
        slices: baseSlices,
        timestamp: Date.now(),
      };

      // Run onAssemble hooks
      const hookResults = await this.hookBus.runHooks(HOOK_TYPES.ASSEMBLE, context);
      
      // Collect slice requests from hooks
      const sliceRequests = this.collectSliceRequests(hookResults);
      
      // Build mod context with token limits
      const modContext = await this.buildModContext(
        sliceRequests,
        gameState,
        baseSlices
      );

      // Apply token limits and trimming
      const trimmedContext = this.applyTokenLimits(modContext);
      
      // Record metrics
      const executionMs = Date.now() - startTime;
      await this.recordAssembleMetrics(trimmedContext, executionMs);

      return {
        mod_ctx: trimmedContext.mod_ctx,
        total_tokens: trimmedContext.total_tokens,
        trimmed_namespaces: trimmedContext.trimmed_namespaces,
        violations: violations,
      };

    } catch (error) {
      console.error('Assembler mod integration failed:', error);
      return {
        mod_ctx: {},
        total_tokens: 0,
        trimmed_namespaces: [],
        violations: [`Integration error: ${error}`],
      };
    }
  }

  /**
   * Collect slice requests from hook results
   */
  private collectSliceRequests(hookResults: any[]): Array<{
    namespace: string;
    slices: string[];
    priority: number;
  }> {
    const requests: Array<{
      namespace: string;
      slices: string[];
      priority: number;
    }> = [];

    for (const result of hookResults) {
      if (result.executed && result.acts) {
        for (const act of result.acts) {
          if (act.type === 'REQUEST_SLICE' && act.slices) {
            requests.push({
              namespace: result.namespace,
              slices: act.slices,
              priority: act.priority || 0,
            });
          }
        }
      }
    }

    return requests;
  }

  /**
   * Build mod context from slice requests
   */
  private async buildModContext(
    sliceRequests: Array<{
      namespace: string;
      slices: string[];
      priority: number;
    }>,
    gameState: any,
    baseSlices: Record<string, any>
  ): Promise<Record<string, ModContext>> {
    const modContext: Record<string, ModContext> = {};

    for (const request of sliceRequests) {
      const namespace = request.namespace;
      
      if (!modContext[namespace]) {
        modContext[namespace] = {
          namespace: namespace,
          slices: [],
          total_tokens: 0,
          trimmed: false,
        };
      }

      // Process requested slices
      for (const slicePath of request.slices) {
        const sliceData = this.extractSliceData(slicePath, gameState, baseSlices);
        const tokens = this.calculateTokens(sliceData);
        
        modContext[namespace].slices.push({
          namespace: namespace,
          path: slicePath,
          data: sliceData,
          tokens: tokens,
          priority: request.priority,
        });
        
        modContext[namespace].total_tokens += tokens;
      }
    }

    return modContext;
  }

  /**
   * Extract slice data from game state
   */
  private extractSliceData(
    slicePath: string,
    gameState: any,
    baseSlices: Record<string, any>
  ): any {
    // Check if slice is already in base slices
    if (baseSlices[slicePath]) {
      return baseSlices[slicePath];
    }

    // Extract from game state using path
    const parts = slicePath.split('.');
    let current: any = gameState;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return null;
      }
    }

    return current;
  }

  /**
   * Calculate tokens for data
   */
  private calculateTokens(data: any): number {
    if (data === null || data === undefined) {
      return 0;
    }
    
    const jsonString = JSON.stringify(data);
    return Math.ceil(jsonString.length / 4); // Rough token estimation
  }

  /**
   * Apply token limits and trimming
   */
  private applyTokenLimits(
    modContext: Record<string, ModContext>
  ): {
    mod_ctx: Record<string, ModContext>;
    total_tokens: number;
    trimmed_namespaces: string[];
  } {
    const trimmedNamespaces: string[] = [];
    let totalTokens = 0;

    // Apply per-namespace limits
    for (const [namespace, context] of Object.entries(modContext)) {
      const maxNamespaceTokens = this.config.max_namespace_tokens || 80;
      
      if (context.total_tokens > maxNamespaceTokens) {
        // Trim slices by priority (lowest first)
        context.slices.sort((a, b) => a.priority - b.priority);
        
        let remainingTokens = maxNamespaceTokens;
        const trimmedSlices: ModSlice[] = [];
        
        for (const slice of context.slices) {
          if (remainingTokens >= slice.tokens) {
            trimmedSlices.push(slice);
            remainingTokens -= slice.tokens;
          } else {
            break;
          }
        }
        
        context.slices = trimmedSlices;
        context.total_tokens = trimmedSlices.reduce((sum, s) => sum + s.tokens, 0);
        context.trimmed = true;
        trimmedNamespaces.push(namespace);
      }
      
      totalTokens += context.total_tokens;
    }

    // Apply global token limit
    const maxGlobalTokens = this.config.max_global_tokens || 200;
    if (totalTokens > maxGlobalTokens) {
      // Trim by namespace priority (lowest total tokens first)
      const sortedNamespaces = Object.entries(modContext)
        .sort(([, a], [, b]) => a.total_tokens - b.total_tokens);
      
      let remainingGlobalTokens = maxGlobalTokens;
      
      for (const [namespace, context] of sortedNamespaces) {
        if (remainingGlobalTokens >= context.total_tokens) {
          remainingGlobalTokens -= context.total_tokens;
        } else {
          // Trim this namespace further
          const maxAllowed = remainingGlobalTokens;
          context.slices.sort((a, b) => a.priority - b.priority);
          
          let remainingTokens = maxAllowed;
          const trimmedSlices: ModSlice[] = [];
          
          for (const slice of context.slices) {
            if (remainingTokens >= slice.tokens) {
              trimmedSlices.push(slice);
              remainingTokens -= slice.tokens;
            } else {
              break;
            }
          }
          
          context.slices = trimmedSlices;
          context.total_tokens = trimmedSlices.reduce((sum, s) => sum + s.tokens, 0);
          context.trimmed = true;
          trimmedNamespaces.push(namespace);
          remainingGlobalTokens = 0;
        }
      }
      
      totalTokens = Object.values(modContext)
        .reduce((sum, context) => sum + context.total_tokens, 0);
    }

    return {
      mod_ctx: modContext,
      total_tokens: totalTokens,
      trimmed_namespaces: trimmedNamespaces,
    };
  }

  /**
   * Record assemble metrics
   */
  private async recordAssembleMetrics(
    result: {
      mod_ctx: Record<string, ModContext>;
      total_tokens: number;
      trimmed_namespaces: string[];
    },
    executionMs: number
  ): Promise<void> {
    // Record metrics for each namespace
    for (const [namespace, context] of Object.entries(result.mod_ctx)) {
      await this.modPacksService.recordMetrics(
        namespace,
        'assemble',
        'tokens_used',
        context.total_tokens
      );
      
      await this.modPacksService.recordMetrics(
        namespace,
        'assemble',
        'execution_ms',
        executionMs
      );
      
      if (context.trimmed) {
        await this.modPacksService.recordMetrics(
          namespace,
          'assemble',
          'trimmed',
          1
        );
      }
    }
  }

  /**
   * Get mod context for AWF bundle
   */
  getModContextForBundle(modContext: Record<string, ModContext>): Record<string, any> {
    const bundleContext: Record<string, any> = {};
    
    for (const [namespace, context] of Object.entries(modContext)) {
      bundleContext[namespace] = {
        slices: context.slices.map(slice => ({
          path: slice.path,
          data: slice.data,
        })),
        total_tokens: context.total_tokens,
        trimmed: context.trimmed,
      };
    }
    
    return bundleContext;
  }

  /**
   * Validate slice requests
   */
  validateSliceRequests(
    sliceRequests: Array<{
      namespace: string;
      slices: string[];
      priority: number;
    }>
  ): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    for (const request of sliceRequests) {
      // Check namespace format
      if (!/^[a-z0-9._-]+$/.test(request.namespace)) {
        errors.push(`Invalid namespace format: ${request.namespace}`);
      }
      
      // Check slice paths
      for (const slice of request.slices) {
        if (!/^[a-z0-9._-]+$/.test(slice)) {
          errors.push(`Invalid slice path format: ${slice}`);
        }
      }
      
      // Check priority range
      if (request.priority < 0 || request.priority > 100) {
        errors.push(`Priority out of range: ${request.priority}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Singleton instance
let assemblerModIntegration: AssemblerModIntegration | null = null;

export function getAssemblerModIntegration(
  modPacksService: ModPacksService,
  hookBus: HookBus,
  config: any
): AssemblerModIntegration {
  if (!assemblerModIntegration) {
    assemblerModIntegration = new AssemblerModIntegration(
      modPacksService,
      hookBus,
      config
    );
  }
  return assemblerModIntegration;
}
