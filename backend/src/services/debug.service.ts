import type { PromptAssemblyResult } from '../prompts/schemas.js';

/**
 * Debug service for viewing assembled prompts, AI responses, and state changes
 */
export class DebugService {
  private static instance: DebugService;
  private debugData: {
    prompts: Array<{
      id: string;
      timestamp: string;
      gameId: string;
      turnIndex: number;
      world: string;
      character?: string;
      prompt: string;
      audit: any;
      metadata: any;
    }>;
    aiResponses: Array<{
      id: string;
      timestamp: string;
      gameId: string;
      turnIndex: number;
      promptId: string;
      response: any;
      processingTime: number;
      tokenCount?: number;
    }>;
    stateChanges: Array<{
      id: string;
      timestamp: string;
      gameId: string;
      turnIndex: number;
      responseId: string;
      actions: any[];
      changes: any[];
      beforeState: any;
      afterState: any;
    }>;
  };

  private constructor() {
    this.debugData = {
      prompts: [],
      aiResponses: [],
      stateChanges: [],
    };
  }

  static getInstance(): DebugService {
    if (!DebugService.instance) {
      DebugService.instance = new DebugService();
    }
    return DebugService.instance;
  }

  /**
   * Log an assembled prompt
   */
  logPrompt(
    gameId: string,
    turnIndex: number,
    world: string,
    character: string | undefined,
    result: PromptAssemblyResult
  ): string {
    const promptId = this.generateId();
    const entry = {
      id: promptId,
      timestamp: new Date().toISOString(),
      gameId,
      turnIndex,
      world,
      character,
      prompt: result.prompt,
      audit: result.audit,
      metadata: result.metadata,
    };

    this.debugData.prompts.push(entry);
    
    // Keep only last 50 prompts to prevent memory bloat
    if (this.debugData.prompts.length > 50) {
      this.debugData.prompts = this.debugData.prompts.slice(-50);
    }

    console.log(`[DEBUG] Prompt assembled for ${gameId} turn ${turnIndex}:`, {
      promptId,
      templateCount: result.metadata.totalSegments,
      tokenCount: result.audit.tokenCount,
      world,
      character,
    });

    // Log the actual cleaned prompt content for debugging
    console.log(`[DEBUG] Cleaned prompt content (${result.prompt.length} chars):`);
    console.log('─'.repeat(80));
    console.log(result.prompt);
    console.log('─'.repeat(80));

    return promptId;
  }

  /**
   * Log an AI response
   */
  logAiResponse(
    gameId: string,
    turnIndex: number,
    promptId: string,
    response: any,
    processingTime: number,
    tokenCount?: number
  ): string {
    const responseId = this.generateId();
    const entry = {
      id: responseId,
      timestamp: new Date().toISOString(),
      gameId,
      turnIndex,
      promptId,
      response,
      processingTime,
      tokenCount,
    };

    this.debugData.aiResponses.push(entry);
    
    // Keep only last 50 responses
    if (this.debugData.aiResponses.length > 50) {
      this.debugData.aiResponses = this.debugData.aiResponses.slice(-50);
    }

    console.log(`[DEBUG] AI response received for ${gameId} turn ${turnIndex}:`, {
      responseId,
      promptId,
      processingTime: `${processingTime}ms`,
      tokenCount,
      hasActions: response.acts?.length > 0,
      hasChoices: response.choices?.length > 0,
    });

    return responseId;
  }

  /**
   * Log state changes from actions
   */
  logStateChanges(
    gameId: string,
    turnIndex: number,
    responseId: string,
    actions: any[],
    changes: any[],
    beforeState: any,
    afterState: any
  ): string {
    const changeId = this.generateId();
    const entry = {
      id: changeId,
      timestamp: new Date().toISOString(),
      gameId,
      turnIndex,
      responseId,
      actions,
      changes,
      beforeState,
      afterState,
    };

    this.debugData.stateChanges.push(entry);
    
    // Keep only last 50 state changes
    if (this.debugData.stateChanges.length > 50) {
      this.debugData.stateChanges = this.debugData.stateChanges.slice(-50);
    }

    console.log(`[DEBUG] State changes applied for ${gameId} turn ${turnIndex}:`, {
      changeId,
      responseId,
      actionCount: actions.length,
      changeCount: changes.length,
    });

    return changeId;
  }

  /**
   * Get debug data for a specific game
   */
  getGameDebugData(gameId: string): {
    prompts: any[];
    aiResponses: any[];
    stateChanges: any[];
  } {
    return {
      prompts: this.debugData.prompts.filter(p => p.gameId === gameId),
      aiResponses: this.debugData.aiResponses.filter(r => r.gameId === gameId),
      stateChanges: this.debugData.stateChanges.filter(s => s.gameId === gameId),
    };
  }

  /**
   * Get all debug data
   */
  getAllDebugData(): typeof this.debugData {
    return this.debugData;
  }

  /**
   * Clear debug data
   */
  clearDebugData(): void {
    this.debugData = {
      prompts: [],
      aiResponses: [],
      stateChanges: [],
    };
    console.log('[DEBUG] Debug data cleared');
  }

  /**
   * Get debug data for a specific turn
   */
  getTurnDebugData(gameId: string, turnIndex: number): {
    prompt?: any;
    aiResponse?: any;
    stateChanges?: any;
  } {
    const prompt = this.debugData.prompts.find(p => p.gameId === gameId && p.turnIndex === turnIndex);
    const aiResponse = this.debugData.aiResponses.find(r => r.gameId === gameId && r.turnIndex === turnIndex);
    const stateChanges = this.debugData.stateChanges.find(s => s.gameId === gameId && s.turnIndex === turnIndex);

    return {
      prompt,
      aiResponse,
      stateChanges,
    };
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `debug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get debug statistics
   */
  getDebugStats(): {
    totalPrompts: number;
    totalResponses: number;
    totalStateChanges: number;
    games: string[];
    latestActivity: string;
  } {
    const games = new Set([
      ...this.debugData.prompts.map(p => p.gameId),
      ...this.debugData.aiResponses.map(r => r.gameId),
      ...this.debugData.stateChanges.map(s => s.gameId),
    ]);

    const allTimestamps = [
      ...this.debugData.prompts.map(p => p.timestamp),
      ...this.debugData.aiResponses.map(r => r.timestamp),
      ...this.debugData.stateChanges.map(s => s.timestamp),
    ].sort();

    return {
      totalPrompts: this.debugData.prompts.length,
      totalResponses: this.debugData.aiResponses.length,
      totalStateChanges: this.debugData.stateChanges.length,
      games: Array.from(games),
      latestActivity: allTimestamps[allTimestamps.length - 1] || 'No activity',
    };
  }
}

export const debugService = DebugService.getInstance();
