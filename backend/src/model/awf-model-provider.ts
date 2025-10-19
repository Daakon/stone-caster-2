/**
 * AWF Model Provider
 * Phase 5: Turn Pipeline Integration - Model abstraction for AWF inference
 */

import OpenAI from 'openai';

export interface AwfToolCall {
  name: "GetLoreSlice";
  arguments: { 
    scope: "world" | "adventure"; 
    ref: string; 
    slice: string; 
    maxTokens?: number 
  };
}

export interface AwfToolResult {
  name: "GetLoreSlice";
  result: { 
    ref: string; 
    slice: string; 
    compact: string; 
    tokensEst: number; 
    hash: string 
  };
}

export interface AwfModelProvider {
  infer(input: { system: string; awf_bundle: object }): Promise<{ raw: string; json?: any }>;
  inferWithTools(input: { 
    system: string; 
    awf_bundle: object; 
    tools: AwfToolCall[];
    onToolCall?: (toolCall: AwfToolCall) => Promise<AwfToolResult>;
  }): Promise<{ raw: string; json?: any; toolCalls?: AwfToolCall[] }>;
}

export interface ModelConfig {
  modelName: string;
  timeoutMs: number;
  maxRetries: number;
}

export class OpenAIModelProvider implements AwfModelProvider {
  private client: OpenAI;
  private config: ModelConfig;

  constructor(apiKey: string, config: ModelConfig) {
    this.client = new OpenAI({ apiKey });
    this.config = config;
  }

  async infer(input: { system: string; awf_bundle: object }): Promise<{ raw: string; json?: any }> {
    const { system, awf_bundle } = input;
    
    console.log(`[AWF Model] Starting inference with model ${this.config.modelName}`);
    const startTime = Date.now();
    
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.modelName,
        messages: [
          {
            role: 'system',
            content: system
          },
          {
            role: 'user',
            content: JSON.stringify(awf_bundle, null, 2)
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      });

      const raw = response.choices[0]?.message?.content || '';
      const latency = Date.now() - startTime;
      
      console.log(`[AWF Model] Inference completed in ${latency}ms`);
      
      // Try to parse JSON from response
      let json: any = undefined;
      try {
        json = JSON.parse(raw);
      } catch (parseError) {
        console.warn(`[AWF Model] Failed to parse JSON response:`, parseError);
      }
      
      return { raw, json };
      
    } catch (error) {
      const latency = Date.now() - startTime;
      console.error(`[AWF Model] Inference failed after ${latency}ms:`, error);
      throw error;
    }
  }

  async inferWithTools(input: { 
    system: string; 
    awf_bundle: object; 
    tools: AwfToolCall[];
    onToolCall?: (toolCall: AwfToolCall) => Promise<AwfToolResult>;
  }): Promise<{ raw: string; json?: any; toolCalls?: AwfToolCall[] }> {
    const { system, awf_bundle, tools, onToolCall } = input;
    
    console.log(`[AWF Model] Starting tool-enabled inference with model ${this.config.modelName}`);
    const startTime = Date.now();
    
    try {
      // Define tool schema for OpenAI
      const toolSchema = {
        type: "function" as const,
        function: {
          name: "GetLoreSlice",
          description: "Retrieve a compact lore slice from world or adventure content",
          parameters: {
            type: "object",
            properties: {
              scope: {
                type: "string",
                enum: ["world", "adventure"],
                description: "Whether to fetch from world or adventure content"
              },
              ref: {
                type: "string",
                description: "Reference ID of the world or adventure document"
              },
              slice: {
                type: "string",
                description: "Name of the slice to retrieve"
              },
              maxTokens: {
                type: "number",
                description: "Maximum tokens for the returned slice (default: 350)"
              }
            },
            required: ["scope", "ref", "slice"]
          }
        }
      };

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: system
        },
        {
          role: 'user',
          content: JSON.stringify(awf_bundle, null, 2)
        }
      ];

      // Add tool results to conversation if available
      for (const tool of tools) {
        if (onToolCall) {
          try {
            const toolResult = await onToolCall(tool);
            messages.push({
              role: 'assistant',
              content: `Tool call: GetLoreSlice(${JSON.stringify(tool.arguments)})`
            });
            messages.push({
              role: 'user',
              content: `Tool result: ${JSON.stringify(toolResult.result)}`
            });
          } catch (error) {
            console.error(`[AWF Model] Tool call failed:`, error);
            messages.push({
              role: 'assistant',
              content: `Tool call: GetLoreSlice(${JSON.stringify(tool.arguments)})`
            });
            messages.push({
              role: 'user',
              content: `Tool error: Failed to retrieve slice ${tool.arguments.slice}`
            });
          }
        }
      }

      const response = await this.client.chat.completions.create({
        model: this.config.modelName,
        messages,
        tools: [toolSchema],
        tool_choice: "auto",
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      });

      const message = response.choices[0]?.message;
      const raw = message?.content || '';
      const latency = Date.now() - startTime;
      
      console.log(`[AWF Model] Tool-enabled inference completed in ${latency}ms`);
      
      // Check for tool calls in the response
      const toolCalls: AwfToolCall[] = [];
      if (message?.tool_calls) {
        for (const toolCall of message.tool_calls) {
          if (toolCall.type === 'function' && toolCall.function.name === 'GetLoreSlice') {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              toolCalls.push({
                name: 'GetLoreSlice',
                arguments: args
              });
            } catch (error) {
              console.error(`[AWF Model] Failed to parse tool call arguments:`, error);
            }
          }
        }
      }
      
      // Try to parse JSON from response
      let json: any = undefined;
      try {
        json = JSON.parse(raw);
      } catch (parseError) {
        console.warn(`[AWF Model] Failed to parse JSON response:`, parseError);
      }
      
      return { raw, json, toolCalls };
      
    } catch (error) {
      const latency = Date.now() - startTime;
      console.error(`[AWF Model] Tool-enabled inference failed after ${latency}ms:`, error);
      throw error;
    }
  }
}

export class MockModelProvider implements AwfModelProvider {
  private responses: Array<{ raw: string; json?: any }> = [];
  private currentIndex = 0;

  constructor(responses: Array<{ raw: string; json?: any }> = []) {
    this.responses = responses;
  }

  async infer(input: { system: string; awf_bundle: object }): Promise<{ raw: string; json?: any }> {
    console.log(`[AWF Model Mock] Simulating inference`);
    
    if (this.responses.length === 0) {
      // Default mock response
      return {
        raw: JSON.stringify({
          scn: 'test_scene',
          txt: 'This is a test response from the mock model.',
          choices: [
            { id: 'choice1', label: 'Option 1' },
            { id: 'choice2', label: 'Option 2' }
          ],
          acts: [
            { type: 'SCENE_SET', data: { scn: 'test_scene' } }
          ]
        }),
        json: {
          scn: 'test_scene',
          txt: 'This is a test response from the mock model.',
          choices: [
            { id: 'choice1', label: 'Option 1' },
            { id: 'choice2', label: 'Option 2' }
          ],
          acts: [
            { type: 'SCENE_SET', data: { scn: 'test_scene' } }
          ]
        }
      };
    }

    const response = this.responses[this.currentIndex % this.responses.length];
    this.currentIndex++;
    
    return response;
  }

  async inferWithTools(input: { 
    system: string; 
    awf_bundle: object; 
    tools: AwfToolCall[];
    onToolCall?: (toolCall: AwfToolCall) => Promise<AwfToolResult>;
  }): Promise<{ raw: string; json?: any; toolCalls?: AwfToolCall[] }> {
    const { tools } = input;
    console.log(`[AWF Model Mock] Simulating tool-enabled inference`);
    
    // Simulate tool calls if any are provided
    const toolCalls: AwfToolCall[] = [];
    if (tools && tools.length > 0) {
      // Mock tool calls for testing
      toolCalls.push(...tools);
    }
    
    if (this.responses.length === 0) {
      // Default mock response
      return {
        raw: JSON.stringify({
          scn: 'test_scene',
          txt: 'This is a test response from the mock model with tools.',
          choices: [
            { id: 'choice1', label: 'Option 1' },
            { id: 'choice2', label: 'Option 2' }
          ],
          acts: [
            { type: 'SCENE_SET', data: { scn: 'test_scene' } }
          ]
        }),
        json: {
          scn: 'test_scene',
          txt: 'This is a test response from the mock model with tools.',
          choices: [
            { id: 'choice1', label: 'Option 1' },
            { id: 'choice2', label: 'Option 2' }
          ],
          acts: [
            { type: 'SCENE_SET', data: { scn: 'test_scene' } }
          ]
        },
        toolCalls
      };
    }

    const response = this.responses[this.currentIndex % this.responses.length];
    this.currentIndex++;
    
    return { ...response, toolCalls };
  }

  addResponse(response: { raw: string; json?: any }): void {
    this.responses.push(response);
  }

  reset(): void {
    this.currentIndex = 0;
  }
}

/**
 * Create model provider from environment configuration
 */
export function createModelProvider(): AwfModelProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[AWF Model] No OpenAI API key found, using mock provider');
    return new MockModelProvider();
  }

  const modelName = process.env.AWF_MODEL_NAME || 'gpt-4o-mini';
  const timeoutMs = parseInt(process.env.AWF_MODEL_TIMEOUT_MS || '120000', 10);
  const maxRetries = parseInt(process.env.AWF_MODEL_MAX_RETRIES || '2', 10);

  const config: ModelConfig = {
    modelName,
    timeoutMs,
    maxRetries
  };

  console.log(`[AWF Model] Creating OpenAI provider with config:`, config);
  return new OpenAIModelProvider(apiKey, config);
}
