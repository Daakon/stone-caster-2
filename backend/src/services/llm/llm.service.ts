// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * LLM Service (Adapter)
 * Phase 6-B: Real LLM Integration
 * Wraps LLM provider with JSON mode enforcement and creative text generation
 */

import { z, type ZodSchema } from 'zod';
import { createLlmProvider, type LlmProvider } from '../runtime/llm.provider';
import { chatCompletion, createChatEndpoint, EmptyContentError } from '../runtime/openai-compatible';
import { resolveLlmRoleConfig, type LlmRole } from '../../config/llm-config';
import { ServiceError } from '../../utils/serviceError';
import { ApiErrorCode } from '@shared';

export class LlmService {
  private provider: LlmProvider;
  private role: LlmRole;
  private modelOverride?: string;

  /**
   * @param role - Pipeline role whose provider/model config applies (director | narrator | genesis)
   */
  constructor(provider?: LlmProvider, model?: string, role: LlmRole = 'narrator') {
    this.role = role;
    this.modelOverride = model;
    this.provider = provider || createLlmProvider(role);
  }

  /**
   * Generate structured JSON response with schema validation
   * @param system - System prompt with instructions
   * @param user - User prompt/input
   * @param schema - Optional Zod schema for validation
   * @returns Parsed and validated JSON response
   */
  async generateJSON<T>(
    system: string,
    user: string,
    schema?: ZodSchema<T>
  ): Promise<T> {
    // Routed free models (openrouter/free) re-roll the underlying model per request, so a
    // schema-invalid answer (wrong types, invented ids) is worth a couple of fresh attempts.
    const attempts = resolveLlmRoleConfig(this.role).provider === 'openrouter' ? 3 : 1;
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.generateJSONOnce(system, user, schema);
      } catch (error) {
        const invalid = error instanceof ServiceError && error.error?.code === ApiErrorCode.VALIDATION_FAILED;
        if (!invalid || attempt >= attempts) throw error;
        console.warn(`[LlmService] ${this.role}: schema-invalid output (attempt ${attempt}/${attempts}); retrying`);
      }
    }
  }

  private async generateJSONOnce<T>(
    system: string,
    user: string,
    schema?: ZodSchema<T>
  ): Promise<T> {
    try {
      console.log('[LlmService] Calling provider.generateJson, provider type:', this.provider.constructor.name);
      const response = await this.provider.generateJson<T>(system, user);
      console.log('[LlmService] Raw provider response:', JSON.stringify(response, null, 2).substring(0, 500));

      // Validate against schema if provided
      if (schema) {
        try {
          console.log('[LlmService] Validating response against schema...');
          const validated = schema.parse(response);
          console.log('[LlmService] Validation successful');
          return validated;
        } catch (validationError) {
          // Log detailed validation error for debugging
          if (validationError instanceof z.ZodError) {
            console.error('[LlmService] ❌ Validation failed:', {
              userInput: user.substring(0, 100),
              errorCount: validationError.errors.length,
              errors: validationError.errors,
              responseType: Array.isArray(response) ? 'array' : typeof response,
              responseLength: Array.isArray(response) ? response.length : 'N/A',
              responseSample: Array.isArray(response) && response.length > 0 
                ? JSON.stringify(response[0], null, 2).substring(0, 500)
                : JSON.stringify(response, null, 2).substring(0, 500)
            });
          }
          throw validationError;
        }
      }

      return response;
    } catch (error) {
      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        throw new ServiceError(500, {
          code: ApiErrorCode.VALIDATION_FAILED,
          message: 'LLM response validation failed',
          details: error.errors,
        });
      }

      // Handle API failures
      if (error instanceof Error) {
        throw LlmService.mapError(error);
      }

      // Unknown error type
      throw new ServiceError(500, {
        code: ApiErrorCode.INTERNAL_ERROR,
        message: 'Unknown LLM service error',
        details: { error: String(error) },
      });
    }
  }

  /** Map provider/transport failures to ServiceErrors (shared by JSON and text paths). */
  private static mapError(error: Error): ServiceError {
    if (error.message.includes('API key') || error.message.includes('_API_KEY')) {
      return new ServiceError(500, {
        code: ApiErrorCode.INTERNAL_ERROR,
        message: 'LLM API key not configured. Set OPENAI_API_KEY or OPENROUTER_API_KEY for the selected provider.',
        details: { originalError: error.message },
      });
    }
    if (error.message.includes('timed out')) {
      return new ServiceError(504, {
        code: ApiErrorCode.UPSTREAM_TIMEOUT,
        message: 'The storyteller is taking too long to respond. Please try again.',
        details: { originalError: error.message },
      });
    }
    if (error.message.includes('rate limit') || error.message.includes('429')) {
      return new ServiceError(429, {
        code: ApiErrorCode.RATE_LIMITED,
        message: 'LLM API rate limit exceeded',
        details: { originalError: error.message },
      });
    }
    return new ServiceError(500, {
      code: ApiErrorCode.INTERNAL_ERROR,
      message: `LLM API error: ${error.message}`,
      details: { originalError: error.message },
    });
  }

  /**
   * Generate creative text response (non-JSON mode)
   * @param system - System prompt with instructions
   * @param user - User prompt/input
   * @param options - generic options
   * @returns Generated text response
   */
  async generateText(
    system: string,
    user: string,
    options?: { maxTokens?: number; temperature?: number; jsonMode?: boolean }
  ): Promise<string> {
    try {
      // [MOCK AI] Cost-Saving Toggle — must run before the key check so mock
      // mode works without any API key configured
      const config = { ...resolveLlmRoleConfig(this.role) };
      if (this.modelOverride && config.provider !== 'mock') config.model = this.modelOverride;
      if (config.unconfigured) {
        throw new Error('LLM API key not configured (set OPENAI_API_KEY or OPENROUTER_API_KEY, or set ENABLE_MOCK_AI=true)');
      }
      if (config.provider === 'mock') {
        console.log(`[LlmService] ${this.role}: mock provider - skipping API call`);

        // If JSON mode, return structured mock
        if (options?.jsonMode) {
          return JSON.stringify({
            narrative: "[MOCK] The gears of the Chimera Engine turn silently. The prompt was assembled successfully.",
            thought_chain: "Mocking response to verify prompt assembly without cost.",
            scene_context: {
              location: "Debug Void",
              time: "Static Now",
              atmosphere: "Efficient"
            },
            state_updates: {
              player_hp_change: 0,
              player_stamina_change: 0,
              entity_updates: []
            }
          });
        }

        // Otherwise return simple text
        return "[MOCK] Narrative text generated by Mock AI.";
      }

      const endpoint = createChatEndpoint({ ...config, role: this.role });
      const attempts = 1 + (endpoint.contentRetries ?? 0);
      for (let attempt = 1; ; attempt++) {
        try {
          return await chatCompletion(endpoint, system, user, {
            temperature: options?.temperature ?? 0.8, // Higher temperature for creative writing
            maxTokens: options?.maxTokens ?? 1000,
            jsonMode: options?.jsonMode,
          });
        } catch (error) {
          if (error instanceof EmptyContentError && attempt < attempts) {
            console.warn(`[LlmService] ${this.role}: empty model output (attempt ${attempt}/${attempts}); retrying`);
            continue;
          }
          throw error;
        }
      }
    } catch (error) {
      // Handle API failures
      if (error instanceof ServiceError) {
        throw error;
      }

      if (error instanceof Error) {
        throw LlmService.mapError(error);
      }

      // Unknown error type
      throw new ServiceError(500, {
        code: ApiErrorCode.INTERNAL_ERROR,
        message: 'Unknown LLM service error',
        details: { error: String(error) },
      });
    }
  }
}

