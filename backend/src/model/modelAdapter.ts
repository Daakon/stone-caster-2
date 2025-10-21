// Model Adapter Interface and Implementation
// Provides a pluggable interface for LLM model calls

import { ModelConfig } from '../config/model';
import { generateJsonWithGemini } from './providers/gemini';
import { LlmResultV1 } from './jsonSchema';

export interface ModelAdapter {
  generate(input: {
    prompt: string;
    maxTokens?: number;
    temperature?: number;
    stop?: string[];
  }): Promise<{
    text: string;
    tokensOut: number;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }>;
}

export interface JsonModelAdapter {
  generateJson(input: {
    prompt: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<{
    json: LlmResultV1;
    tokensOut: number;
  }>;
}

/**
 * Mock model adapter for development and testing
 * Returns deterministic responses based on prompt content
 */
export const mockModel: ModelAdapter = {
  async generate({ prompt, maxTokens = 1000, temperature = 0.7, stop }) {
    // Simple mock response based on prompt content
    let responseText = "The boughs shift. A thread of crystal hums in the fog. What do you do?";
    
    // Customize response based on prompt content
    if (prompt.includes('entry_start') || prompt.includes('opening')) {
      responseText = "The ancient forest whispers secrets as you step into the Whispering Woods. The path ahead is shrouded in mist, and you can hear the distant sound of crystal chimes. What do you do?";
    } else if (prompt.includes('npc') && prompt.includes('Kiera')) {
      responseText = "Kiera watches the horizon with alert eyes, her hand resting on the hilt of her blade. 'The forest holds many secrets,' she says in her clipped manner. 'Stay close, and trust your instincts.' What do you do?";
    } else if (prompt.includes('npc') && prompt.includes('Thorne')) {
      responseText = "Thorne adjusts his spectacles and peers at the ancient runes. 'Fascinating... these markings are from the Third Age,' he mumbles to himself. 'The temple's layout matches the ancient texts exactly.' What do you do?";
    } else if (prompt.includes('npc') && prompt.includes('Zara')) {
      responseText = "Zara stands with her hand on her sword, scanning for threats. 'Stay behind me,' she says firmly. 'I've seen what these ancient places can do to the unwary.' What do you do?";
    } else if (prompt.includes('combat') || prompt.includes('fight')) {
      responseText = "The creature lunges forward with a snarl! Roll for initiative as the battle begins. What do you do?";
    } else if (prompt.includes('treasure') || prompt.includes('gold')) {
      responseText = "You discover a chest filled with ancient coins and magical artifacts. The treasure glitters in the dim light. What do you do?";
    } else if (prompt.includes('mystery') || prompt.includes('secret')) {
      responseText = "The mystery deepens as you uncover more clues. The pieces of the puzzle are starting to come together. What do you do?";
    } else {
      // Default response
      responseText = "The adventure continues as you explore the mysterious realm. The path ahead holds both danger and opportunity. What do you do?";
    }

    // Truncate if over max tokens (rough estimate)
    const estimatedTokens = Math.ceil(responseText.length / 4);
    if (estimatedTokens > maxTokens) {
      responseText = responseText.substring(0, maxTokens * 4);
    }

    return {
      text: responseText,
      tokensOut: Math.ceil(responseText.length / 4),
      usage: {
        promptTokens: Math.ceil(prompt.length / 4),
        completionTokens: Math.ceil(responseText.length / 4),
        totalTokens: Math.ceil(prompt.length / 4) + Math.ceil(responseText.length / 4)
      }
    };
  }
};

/**
 * Generate JSON response using the configured model provider
 * Routes to Gemini when ModelConfig.provider === 'gemini'
 */
export async function generateJson(input: {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<{
  json: LlmResultV1;
  tokensOut: number;
}> {
  if (ModelConfig.provider !== 'gemini') {
    throw new Error(`Only 'gemini' provider is supported. Got: ${ModelConfig.provider}`);
  }

  return generateJsonWithGemini({
    prompt: input.prompt,
    maxTokens: input.maxTokens,
    temperature: input.temperature,
    timeoutMs: ModelConfig.timeoutMs,
  });
}
