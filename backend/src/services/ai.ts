import OpenAI from 'openai';
import { configService } from '../config/index.js';
import type { AIResponse, StoryAction, GameSave, Character } from '@shared';

const env = configService.getEnv();
const openai = new OpenAI({
  apiKey: env.openaiApiKey,
});

interface StoryContext {
  gameSave: GameSave;
  character: Character;
  action: StoryAction;
}

export class AIService {
  private async getActiveModel(): Promise<string> {
    try {
      await configService.whenReady();
    } catch {
      await configService.refreshNow();
    }

    return configService.getAi().activeModel;
  }

  private buildSystemPrompt(context: StoryContext): string {
    return `You are an AI Game Master for a role-playing game. Your role is to:
- Create engaging, immersive narratives
- Respond to player actions dynamically
- Maintain emotional continuity and world consistency
- Give NPCs agency and believable personalities
- Apply game mechanics fairly

Current Context:
- Character: ${context.character.name} (Level ${context.character.level} ${context.character.race} ${context.character.class})
- Setting: ${context.gameSave.storyState.currentScene}
- World State: ${JSON.stringify(context.gameSave.storyState.worldState)}

Respond with narrative text that advances the story, considering:
1. The player's recent action
2. NPC personalities and relationships
3. World state and consequences
4. Emotional tone and atmosphere
5. Suggest 2-3 possible next actions

Format your response as JSON with:
- narrative: string (the story text)
- emotion: string (overall emotional tone)
- npcResponses: array of NPC reactions (if applicable)
- worldStateChanges: object with any world state updates
- suggestedActions: array of suggested player actions`;
  }

  private buildConversationHistory(gameSave: GameSave): Array<{ role: 'user' | 'assistant'; content: string }> {
    return gameSave.storyState.history.slice(-10).map(entry => ({
      role: entry.role === 'player' ? 'user' as const : 'assistant' as const,
      content: entry.content,
    }));
  }

  async generateStoryResponse(context: StoryContext): Promise<AIResponse> {
    try {
      const model = await this.getActiveModel();
      const systemPrompt = this.buildSystemPrompt(context);
      const conversationHistory = this.buildConversationHistory(context.gameSave);

      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory,
          { role: 'user', content: context.action.content },
        ],
        temperature: 0.8,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      const aiResponse = JSON.parse(content) as AIResponse;
      return aiResponse;
    } catch (error) {
      console.error('AI Service error:', error);
      return {
        narrative: 'The world seems to pause for a moment as reality stabilizes...',
        emotion: 'neutral',
        suggestedActions: ['Look around', 'Continue forward', 'Check inventory'],
      };
    }
  }

  async generateCharacterSuggestions(race: string, characterClass: string): Promise<{
    backstory: string;
    personality: string;
    goals: string[];
  }> {
    try {
      const model = await this.getActiveModel();
      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a creative character designer for RPGs. Generate interesting character details.',
          },
          {
            role: 'user',
            content: `Create a backstory, personality description, and 3 goals for a ${race} ${characterClass} character. Respond in JSON format with fields: backstory, personality, goals (array).`,
          },
        ],
        temperature: 0.9,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      return JSON.parse(content);
    } catch (error) {
      console.error('Character suggestion error:', error);
      return {
        backstory: `A brave ${race} ${characterClass} with a mysterious past.`,
        personality: 'Determined and resourceful',
        goals: ['Seek adventure', 'Protect the innocent', 'Uncover the truth'],
      };
    }
  }

  async processSkillCheck(
    skill: string,
    difficulty: number,
    rollResult: number,
    context: StoryContext
  ): Promise<string> {
    const success = rollResult >= difficulty;

    try {
      const model = await this.getActiveModel();
      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are narrating the outcome of a skill check in an RPG.',
          },
          {
            role: 'user',
            content: `${context.character.name} attempted a ${skill} check (DC ${difficulty}) and rolled ${rollResult}. They ${success ? 'succeeded' : 'failed'}. Narrate the outcome in 2-3 sentences.`,
          },
        ],
        temperature: 0.7,
        max_tokens: 150,
      });

      return response.choices[0]?.message?.content || `You ${success ? 'succeed' : 'fail'} at your ${skill} check.`;
    } catch (error) {
      console.error('Skill check narration error:', error);
      return `You ${success ? 'succeed' : 'fail'} at your ${skill} check.`;
    }
  }

  /**
   * Generate a turn response from a prompt (for TurnsService integration)
   */
  async generateTurnResponse(prompt: string): Promise<string> {
    try {
      console.log('[AI_SERVICE] Starting turn response generation...');
      
      // Check if we're in test mode (no real AI API calls)
      const env = configService.getEnv();
      if (!env.openaiApiKey || env.openaiApiKey.includes('your_ope')) {
        console.log('[AI_SERVICE] Test mode: OpenAI API key not configured, returning test response');
        
        // Generate proper UUIDs for test choices
        const { v4: uuidv4 } = await import('uuid');
        const choice1Id = uuidv4();
        const choice2Id = uuidv4();
        const choice3Id = uuidv4();
        
        return JSON.stringify({
          narrative: 'The world seems to pause for a moment as reality stabilizes... This is a test response while the prompt engine is being validated.',
          emotion: 'neutral',
          choices: [
            { id: choice1Id, label: 'Look around', description: 'Examine your surroundings carefully' },
            { id: choice2Id, label: 'Continue forward', description: 'Press on with determination' },
            { id: choice3Id, label: 'Check inventory', description: 'Review your belongings' }
          ],
          npcResponses: [],
          worldStateChanges: {},
          relationshipDeltas: {},
          factionDeltas: {}
        });
      }
      
      const model = await this.getActiveModel();
      console.log(`[AI_SERVICE] Using model: ${model}`);
      
      console.log('[AI_SERVICE] Calling OpenAI API...');
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      console.log('[AI_SERVICE] Successfully received AI response');
      return content;
    } catch (error) {
      console.error('[AI_SERVICE] Error generating turn response:', error);
      
      // Generate proper UUIDs for fallback choices
      const { v4: uuidv4 } = await import('uuid');
      const choice1Id = uuidv4();
      const choice2Id = uuidv4();
      const choice3Id = uuidv4();
      
      // Return a fallback JSON response with proper schema
      return JSON.stringify({
        narrative: 'The world seems to pause for a moment as reality stabilizes...',
        emotion: 'neutral',
        choices: [
          { id: choice1Id, label: 'Look around', description: 'Examine your surroundings carefully' },
          { id: choice2Id, label: 'Continue forward', description: 'Press on with determination' },
          { id: choice3Id, label: 'Check inventory', description: 'Review your belongings' }
        ],
        npcResponses: [],
        worldStateChanges: {},
        relationshipDeltas: {},
        factionDeltas: {}
      });
    }
  }
}

export const aiService = new AIService();
