/**
 * OpenAI Chat Completions service with streaming and retries
 * Uses gpt-4o-mini model with env-based configuration
 */

import OpenAI from 'openai';
import { configService } from '../config/index.js';

const env = configService.getEnv();

export interface OpenAIResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIStreamResponse {
  stream: AsyncIterable<string>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAIService {
  private client: OpenAI;
  private readonly model = 'gpt-4o-mini';
  private readonly maxRetries = 3;
  private readonly baseDelay = 1000; // 1 second

  constructor() {
    if (!env.openaiApiKey || env.openaiApiKey.includes('your_ope')) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.client = new OpenAI({
      apiKey: env.openaiApiKey,
    });
  }

  /**
   * Generate response with streaming support
   */
  async generateStreamingResponse(
    prompt: string,
    onToken?: (token: string) => void
  ): Promise<OpenAIStreamResponse> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`[OPENAI_SERVICE] Attempt ${attempt}/${this.maxRetries} for streaming response`);
        
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: 0.8,
          max_tokens: 2000,
          stream: true,
        });

        const stream = this.createTokenStream(response, onToken);
        
        return {
          stream,
          usage: undefined, // Usage info not available for streaming
        };
      } catch (error) {
        lastError = error as Error;
        console.error(`[OPENAI_SERVICE] Attempt ${attempt} failed:`, error);
        
        if (attempt < this.maxRetries) {
          const delay = this.baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`[OPENAI_SERVICE] Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(`OpenAI request failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Generate buffered response (no streaming)
   */
  async generateBufferedResponse(prompt: string): Promise<OpenAIResponse> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`[OPENAI_SERVICE] Attempt ${attempt}/${this.maxRetries} for buffered response`);
        
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: 0.8,
          max_tokens: 2000,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No response content from OpenAI');
        }

        return {
          content,
          usage: response.usage ? {
            prompt_tokens: response.usage.prompt_tokens,
            completion_tokens: response.usage.completion_tokens,
            total_tokens: response.usage.total_tokens,
          } : undefined,
        };
      } catch (error) {
        lastError = error as Error;
        console.error(`[OPENAI_SERVICE] Attempt ${attempt} failed:`, error);
        
        if (attempt < this.maxRetries) {
          const delay = this.baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`[OPENAI_SERVICE] Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(`OpenAI request failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Parse and validate AI response as JSON
   */
  parseAIResponse(response: string): any {
    try {
      return JSON.parse(response);
    } catch (error) {
      console.error('[OPENAI_SERVICE] Failed to parse AI response as JSON:', error);
      throw new Error('Invalid JSON response from AI');
    }
  }

  /**
   * Attempt to repair malformed JSON response
   */
  async repairJSONResponse(malformedResponse: string, originalPrompt: string): Promise<any> {
    console.log('[OPENAI_SERVICE] Attempting to repair malformed JSON response');
    
    const repairPrompt = `${this.getSystemPreamble()}

The previous response was malformed JSON. Please re-emit the response as valid JSON:

${malformedResponse}`;

    try {
      const response = await this.generateBufferedResponse(repairPrompt);
      return this.parseAIResponse(response.content);
    } catch (error) {
      console.error('[OPENAI_SERVICE] JSON repair failed:', error);
      throw new Error('Failed to repair malformed JSON response');
    }
  }

  /**
   * Create token stream from OpenAI response
   */
  private async* createTokenStream(
    response: any,
    onToken?: (token: string) => void
  ): AsyncIterable<string> {
    for await (const chunk of response) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        if (onToken) {
          onToken(content);
        }
        yield content;
      }
    }
  }

  /**
   * Get system preamble for JSON repair
   */
  private getSystemPreamble(): string {
    return `You are the runtime engine. Return ONE JSON object (AWF) with keys: scn, txt, optional choices, optional acts, optional val. No markdown, no code fences, no extra keys.`;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if service is properly configured
   */
  isConfigured(): boolean {
    return !!(env.openaiApiKey && !env.openaiApiKey.includes('your_ope'));
  }

  /**
   * Get model information
   */
  getModelInfo(): { model: string; maxTokens: number; temperature: number } {
    return {
      model: this.model,
      maxTokens: 2000,
      temperature: 0.8,
    };
  }
}
