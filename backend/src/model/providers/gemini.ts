import { ModelConfig } from '../../config/model';
import { LlmResultV1, LlmResultV1 as LlmResultV1Type } from '../jsonSchema';

export class ModelJsonValidationError extends Error {
  constructor(message: string, public readonly rawJson: string) {
    super(`JSON validation failed: ${message}`);
    this.name = 'ModelJsonValidationError';
  }
}

export class ModelTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Model request timed out after ${timeoutMs}ms`);
    this.name = 'ModelTimeoutError';
  }
}

export async function generateJsonWithGemini(args: {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}): Promise<{ json: LlmResultV1Type; tokensOut: number }> {
  const system = `You are a game narrator. Output ONLY minified JSON that conforms EXACTLY to:
type LlmResultV1 = { version:"1"; narrator:{text:string}; deltas?:{ npcRelationships?: Array<{ npcId:string; trust?:number; warmth?:number; respect?:number; romance?:number; awe?:number; fear?:number; desire?:number }>; flags?: Record<string, boolean> }; hints?:{ requestedTierRecalc?: boolean }; meta?:{ locale?: string } };
No markdown. No comments. No trailing commas.`;

  const body = {
    contents: [{ 
      role: "user", 
      parts: [{ text: system + "\n\n" + args.prompt }] 
    }],
    generationConfig: {
      response_mime_type: "application/json",
      maxOutputTokens: args.maxTokens ?? ModelConfig.maxTokens,
      temperature: args.temperature ?? ModelConfig.temperature,
    }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), args.timeoutMs ?? ModelConfig.timeoutMs);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${ModelConfig.modelName}:generateContent?key=${ModelConfig.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const rawJson = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawJson) {
      throw new Error('No content returned from Gemini');
    }

    // First attempt: parse and validate
    try {
      const parsed = JSON.parse(rawJson);
      const validated = LlmResultV1.parse(parsed);
      
      // Calculate tokens out
      const tokensOut = result.usage?.candidatesTokenCount || 
                       result.usage?.totalTokenCount || 
                       Math.ceil(validated.narrator.text.length / 4);

      return { json: validated, tokensOut };
    } catch (validationError) {
      // Repair attempt
      try {
        const repairPrompt = `Fix to match the schema exactly. Output valid minified JSON onlyâ€”no extra keys or text.
        
Validation error: ${validationError instanceof Error ? validationError.message : 'Unknown error'}
Raw JSON: ${rawJson}`;

        const repairBody = {
          contents: [{ 
            role: "user", 
            parts: [{ text: system + "\n\n" + repairPrompt }] 
          }],
          generationConfig: {
            response_mime_type: "application/json",
            maxOutputTokens: args.maxTokens ?? ModelConfig.maxTokens,
            temperature: 0.1, // Lower temperature for repair
          }
        };

        const repairResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${ModelConfig.modelName}:generateContent?key=${ModelConfig.apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(repairBody),
            signal: controller.signal,
          }
        );

        if (!repairResponse.ok) {
          throw new Error(`Gemini repair API error: ${repairResponse.status} ${repairResponse.statusText}`);
        }

        const repairResult = await repairResponse.json();
        const repairRawJson = repairResult.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!repairRawJson) {
          throw new ModelJsonValidationError('No content returned from repair attempt', rawJson);
        }

        const repairParsed = JSON.parse(repairRawJson);
        const repairValidated = LlmResultV1.parse(repairParsed);
        
        const tokensOut = repairResult.usage?.candidatesTokenCount || 
                         repairResult.usage?.totalTokenCount || 
                         Math.ceil(repairValidated.narrator.text.length / 4);

        return { json: repairValidated, tokensOut };
      } catch (repairError) {
        throw new ModelJsonValidationError(
          `Repair attempt failed: ${repairError instanceof Error ? repairError.message : 'Unknown error'}`,
          rawJson
        );
      }
    }
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ModelTimeoutError(args.timeoutMs ?? ModelConfig.timeoutMs);
    }
    
    throw error;
  }
}
