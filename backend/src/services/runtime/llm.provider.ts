// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * LLM Provider
 * Abstracts LLM API calls with OpenAI adapter and mock fallback
 */

export interface LlmProvider {
  /**
   * Generate structured JSON response from system and user prompts
   * @param systemPrompt - System-level instructions
   * @param userPrompt - User input/query
   * @returns Parsed JSON response of type T
   */
  generateJson<T>(systemPrompt: string, userPrompt: string): Promise<T>;
}

/**
 * OpenAI LLM Provider Implementation
 */
export class OpenAILlmProvider implements LlmProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model: string = 'gpt-4o-mini') {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    this.model = model;
  }

  async generateJson<T>(systemPrompt: string, userPrompt: string): Promise<T> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${error}`);
      }

      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      return JSON.parse(content) as T;
    } catch (error) {
      console.error('[LLM Provider] OpenAI API error:', error);
      throw error;
    }
  }
}

/**
 * Mock LLM Provider
 * Returns hardcoded responses for testing without API costs
 */
export class MockLlmProvider implements LlmProvider {
  async generateJson<T>(systemPrompt: string, userPrompt: string): Promise<T> {
    console.log('[LLM Provider] Mock mode - logging prompts:');
    console.log('[LLM Provider] System:', systemPrompt);
    console.log('[LLM Provider] User:', userPrompt);

    // Return a mock response based on the prompt content
    // This is a simple heuristic - in production, you might want more sophisticated mocking
    if (systemPrompt.includes('Action Interpreter') || systemPrompt.includes('map the user')) {
      // Mock MAS1 response
      return {
        action_slug: 'attack',
        parameters: { target: 'enemy', weapon: 'sword' },
        sentiment: 'aggressive',
      } as T;
    } else if (systemPrompt.includes('Narrate') || systemPrompt.includes('narrative')) {
      // Mock MAS2 response
      return {
        ripple_narrative: 'You swing your sword with determination, striking the enemy for 5 damage.',
        tier0_mutations: {
          memories: ['Combat encounter with enemy'],
        },
      } as T;
    }

    // Default mock response
    return {} as T;
  }
}

/**
 * Factory function to create the appropriate LLM provider
 */
export function createLlmProvider(): LlmProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (apiKey) {
    return new OpenAILlmProvider(apiKey);
  }
  
  console.warn('[LLM Provider] No OPENAI_API_KEY found, using Mock provider');
  return new MockLlmProvider();
}

