/**
 * Soft-Lock Prevention System
 * Detects stuck states and provides recovery hints and actions
 */

import { GameState } from '../graph/quest-graph-engine.js';
import { QuestGraph } from '../graph/quest-graph-engine.js';

export interface StuckState {
  isStuck: boolean;
  reason: string;
  severity: 'low' | 'medium' | 'high';
  suggestions: string[];
  recoveryActions: RecoveryAction[];
}

export interface RecoveryAction {
  type: 'AUTO_HINT' | 'RECOVERY' | 'RESET';
  priority: number;
  description: string;
  tokenCost: number;
  conditions?: any[];
}

export interface RecoveryHint {
  hint: string;
  context: string;
  urgency: 'low' | 'medium' | 'high';
  tokenCost: number;
}

export class SoftLockPrevention {
  private readonly maxHintLength = 120;
  private readonly maxRecoveryActions = 3;
  private readonly stuckThresholds = {
    noProgress: 5, // turns without progress
    invalidPreconditions: 3, // turns with invalid preconditions
    resourceDepletion: 2, // turns with depleted resources
    maxRetries: 3, // maximum retries before intervention
  };

  /**
   * Detect stuck state and provide recovery options
   */
  detectStuckState(
    gameState: GameState,
    graph: QuestGraph,
    turnHistory: any[],
    currentTurn: number
  ): StuckState {
    const stuckChecks = [
      this.checkNoProgress(gameState, turnHistory),
      this.checkInvalidPreconditions(gameState, graph),
      this.checkResourceDepletion(gameState),
      this.checkMaxRetries(gameState),
      this.checkDeadEnds(gameState, graph),
    ];

    const activeStuckChecks = stuckChecks.filter(check => check.isStuck);
    
    if (activeStuckChecks.length === 0) {
      return {
        isStuck: false,
        reason: '',
        severity: 'low',
        suggestions: [],
        recoveryActions: [],
      };
    }

    // Determine severity based on number and type of stuck conditions
    const severity = this.determineSeverity(activeStuckChecks);
    const suggestions = this.generateSuggestions(activeStuckChecks);
    const recoveryActions = this.generateRecoveryActions(activeStuckChecks, gameState);

    return {
      isStuck: true,
      reason: activeStuckChecks.map(check => check.reason).join('; '),
      severity,
      suggestions,
      recoveryActions,
    };
  }

  /**
   * Generate recovery hints for stuck state
   */
  generateRecoveryHints(stuckState: StuckState, gameState: GameState): RecoveryHint[] {
    const hints: RecoveryHint[] = [];

    for (const action of stuckState.recoveryActions) {
      if (action.type === 'AUTO_HINT') {
        const hint = this.generateHintForAction(action, gameState);
        if (hint) {
          hints.push(hint);
        }
      }
    }

    // Sort by urgency and limit to max hints
    return hints
      .sort((a, b) => this.getUrgencyPriority(b.urgency) - this.getUrgencyPriority(a.urgency))
      .slice(0, this.maxRecoveryActions);
  }

  /**
   * Check for no progress in recent turns
   */
  private checkNoProgress(gameState: GameState, turnHistory: any[]): StuckState {
    const recentTurns = turnHistory.slice(-this.stuckThresholds.noProgress);
    
    if (recentTurns.length < this.stuckThresholds.noProgress) {
      return { isStuck: false, reason: '', severity: 'low', suggestions: [], recoveryActions: [] };
    }

    const hasProgress = recentTurns.some(turn => 
      turn.objectives?.some((obj: any) => obj.status === 'complete') ||
      turn.flags?.some((flag: any) => flag.set === true) ||
      turn.resources?.some((res: any) => res.delta > 0)
    );

    if (!hasProgress) {
      return {
        isStuck: true,
        reason: 'No progress in recent turns',
        severity: 'medium',
        suggestions: [
          'Try different approaches to current objectives',
          'Look for alternative paths or solutions',
          'Consider asking NPCs for guidance',
          'Check if you have all required items or information'
        ],
        recoveryActions: [
          {
            type: 'AUTO_HINT',
            priority: 1,
            description: 'Provide gentle guidance on current objectives',
            tokenCost: 20,
          }
        ]
      };
    }

    return { isStuck: false, reason: '', severity: 'low', suggestions: [], recoveryActions: [] };
  }

  /**
   * Check for invalid preconditions
   */
  private checkInvalidPreconditions(gameState: GameState, graph: QuestGraph): StuckState {
    // This would check if current node requirements are met
    // For now, return not stuck
    return { isStuck: false, reason: '', severity: 'low', suggestions: [], recoveryActions: [] };
  }

  /**
   * Check for resource depletion
   */
  private checkResourceDepletion(gameState: GameState): StuckState {
    const criticalResources = ['health', 'mana', 'stamina', 'energy'];
    const depletedResources = criticalResources.filter(resource => 
      (gameState.resources[resource] || 0) <= 0
    );

    if (depletedResources.length > 0) {
      return {
        isStuck: true,
        reason: `Critical resources depleted: ${depletedResources.join(', ')}`,
        severity: 'high',
        suggestions: [
          'Find ways to restore depleted resources',
          'Look for alternative approaches that don\'t require these resources',
          'Seek help from NPCs or use items',
          'Consider resting or waiting for resources to regenerate'
        ],
        recoveryActions: [
          {
            type: 'RECOVERY',
            priority: 1,
            description: 'Restore critical resources',
            tokenCost: 30,
            conditions: [{ resource: 'health', min: 0 }]
          },
          {
            type: 'AUTO_HINT',
            priority: 2,
            description: 'Hint about resource restoration',
            tokenCost: 15,
          }
        ]
      };
    }

    return { isStuck: false, reason: '', severity: 'low', suggestions: [], recoveryActions: [] };
  }

  /**
   * Check for maximum retries exceeded
   */
  private checkMaxRetries(gameState: GameState): StuckState {
    if (gameState.retries >= this.stuckThresholds.maxRetries) {
      return {
        isStuck: true,
        reason: 'Maximum retries exceeded',
        severity: 'high',
        suggestions: [
          'Try a completely different approach',
          'Look for alternative paths or solutions',
          'Consider asking for help or guidance',
          'Take a step back and reassess the situation'
        ],
        recoveryActions: [
          {
            type: 'RESET',
            priority: 1,
            description: 'Reset retry counter and provide fresh start',
            tokenCost: 25,
          },
          {
            type: 'AUTO_HINT',
            priority: 2,
            description: 'Provide alternative approach suggestions',
            tokenCost: 20,
          }
        ]
      };
    }

    return { isStuck: false, reason: '', severity: 'low', suggestions: [], recoveryActions: [] };
  }

  /**
   * Check for dead ends in the graph
   */
  private checkDeadEnds(gameState: GameState, graph: QuestGraph): StuckState {
    // This would check if there are any valid paths forward
    // For now, return not stuck
    return { isStuck: false, reason: '', severity: 'low', suggestions: [], recoveryActions: [] };
  }

  /**
   * Determine severity based on stuck conditions
   */
  private determineSeverity(stuckChecks: StuckState[]): 'low' | 'medium' | 'high' {
    const highSeverityCount = stuckChecks.filter(check => check.severity === 'high').length;
    const mediumSeverityCount = stuckChecks.filter(check => check.severity === 'medium').length;

    if (highSeverityCount > 0) return 'high';
    if (mediumSeverityCount > 1) return 'high';
    if (mediumSeverityCount > 0) return 'medium';
    return 'low';
  }

  /**
   * Generate suggestions from stuck conditions
   */
  private generateSuggestions(stuckChecks: StuckState[]): string[] {
    const allSuggestions = stuckChecks.flatMap(check => check.suggestions);
    const uniqueSuggestions = [...new Set(allSuggestions)];
    return uniqueSuggestions.slice(0, 5); // Limit to 5 suggestions
  }

  /**
   * Generate recovery actions from stuck conditions
   */
  private generateRecoveryActions(stuckChecks: StuckState[], gameState: GameState): RecoveryAction[] {
    const allActions = stuckChecks.flatMap(check => check.recoveryActions);
    
    // Sort by priority and remove duplicates
    const uniqueActions = allActions.reduce((acc, action) => {
      const existing = acc.find(a => a.type === action.type);
      if (!existing || action.priority > existing.priority) {
        return acc.filter(a => a.type !== action.type).concat([action]);
      }
      return acc;
    }, [] as RecoveryAction[]);

    return uniqueActions
      .sort((a, b) => a.priority - b.priority)
      .slice(0, this.maxRecoveryActions);
  }

  /**
   * Generate hint for a recovery action
   */
  private generateHintForAction(action: RecoveryAction, gameState: GameState): RecoveryHint | null {
    let hint = '';
    let context = '';
    let urgency: 'low' | 'medium' | 'high' = 'low';

    switch (action.type) {
      case 'AUTO_HINT':
        hint = this.generateGentleHint(gameState);
        context = 'gentle_guidance';
        urgency = 'medium';
        break;
      case 'RECOVERY':
        hint = this.generateRecoveryHint(gameState);
        context = 'resource_recovery';
        urgency = 'high';
        break;
      case 'RESET':
        hint = this.generateResetHint(gameState);
        context = 'fresh_start';
        urgency = 'high';
        break;
      default:
        return null;
    }

    // Ensure hint is within length limit
    if (hint.length > this.maxHintLength) {
      hint = hint.substring(0, this.maxHintLength - 3) + '...';
    }

    return {
      hint,
      context,
      urgency,
      tokenCost: action.tokenCost,
    };
  }

  /**
   * Generate gentle hint for stuck player
   */
  private generateGentleHint(gameState: GameState): string {
    const hints = [
      'Sometimes stepping back and looking at the bigger picture helps.',
      'Consider what you might have missed in your current approach.',
      'NPCs often have valuable information if you ask the right questions.',
      'There might be alternative paths you haven\'t considered yet.',
      'Sometimes the solution is simpler than it appears.',
    ];

    // Select hint based on current state
    const hintIndex = gameState.retries % hints.length;
    return hints[hintIndex];
  }

  /**
   * Generate recovery hint for resource issues
   */
  private generateRecoveryHint(gameState: GameState): string {
    const depletedResources = Object.entries(gameState.resources)
      .filter(([_, value]) => value <= 0)
      .map(([key, _]) => key);

    if (depletedResources.length > 0) {
      return `Your ${depletedResources.join(' and ')} is depleted. Look for ways to restore it.`;
    }

    return 'You may need to restore your resources before continuing.';
  }

  /**
   * Generate reset hint for max retries
   */
  private generateResetHint(gameState: GameState): string {
    return 'You\'ve tried this approach several times. Consider a completely different strategy.';
  }

  /**
   * Get urgency priority for sorting
   */
  private getUrgencyPriority(urgency: 'low' | 'medium' | 'high'): number {
    switch (urgency) {
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }
}

// Singleton instance
export const softLockPrevention = new SoftLockPrevention();


