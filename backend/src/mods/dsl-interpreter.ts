/**
 * Phase 22: Safe DSL Interpreter
 * Evaluates hook guards and expressions with security constraints
 */

import { createHash } from 'crypto';

// Types
export interface GuardExpression {
  path: string;
  op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'has' | 'contains' | 'in' | 'not_in';
  val: any;
}

export interface DSLContext {
  session_id: string;
  turn_id: number;
  game_state: any;
  slices: Record<string, any>;
  timestamp: number;
}

export interface GuardResult {
  passed: boolean;
  value?: any;
  error?: string;
}

export interface ExpressionResult {
  value: any;
  error?: string;
}

export class DSLInterpreter {
  private maxOperations = 100;
  private maxDepth = 10;
  private operationCount = 0;
  private depth = 0;

  /**
   * Evaluate a guard expression
   */
  async evaluateGuard(
    guard: GuardExpression,
    context: DSLContext
  ): Promise<GuardResult> {
    this.resetCounters();

    try {
      // Get value from path
      const value = this.getValueFromPath(guard.path, context);
      
      // Evaluate operation
      const result = this.evaluateOperation(guard.op, value, guard.val);
      
      return {
        passed: result,
        value: value,
      };

    } catch (error) {
      return {
        passed: false,
        error: `Guard evaluation error: ${error}`,
      };
    }
  }

  /**
   * Evaluate a probability expression
   */
  evaluateProbability(expression: string, context: DSLContext): number {
    this.resetCounters();

    try {
      if (expression.startsWith('seeded(')) {
        const match = expression.match(/seeded\(([0-9.]+)\)/);
        if (match) {
          const value = parseFloat(match[1]);
          const seed = `${context.session_id}:${context.turn_id}:${Date.now()}`;
          return this.seededRandom(seed, value);
        }
      }
      
      return parseFloat(expression) || 0;
    } catch (error) {
      console.error(`Probability evaluation error: ${error}`);
      return 0;
    }
  }

  /**
   * Generate seeded random number
   */
  seededRandom(seed: string, max: number = 1): number {
    const hash = createHash('sha256').update(seed).digest('hex');
    const hashInt = parseInt(hash.substring(0, 8), 16);
    return (hashInt / 0xffffffff) * max;
  }

  /**
   * Get value from JSON path
   */
  private getValueFromPath(path: string, context: DSLContext): any {
    this.incrementDepth();
    
    try {
      const parts = path.split('.');
      let current: any = context;

      for (const part of parts) {
        if (part === '*') {
          // Handle wildcard - return array of values
          if (Array.isArray(current)) {
            return current;
          }
          return [];
        }

        if (part.startsWith('[') && part.endsWith(']')) {
          // Handle array index
          const index = parseInt(part.slice(1, -1));
          if (Array.isArray(current) && index >= 0 && index < current.length) {
            current = current[index];
          } else {
            return undefined;
          }
        } else {
          // Handle object property
          if (current && typeof current === 'object' && part in current) {
            current = current[part];
          } else {
            return undefined;
          }
        }

        this.incrementOperations();
      }

      return current;

    } finally {
      this.decrementDepth();
    }
  }

  /**
   * Evaluate operation
   */
  private evaluateOperation(
    op: string,
    value: any,
    expected: any
  ): boolean {
    this.incrementOperations();

    switch (op) {
      case 'eq':
        return this.deepEqual(value, expected);
      
      case 'ne':
        return !this.deepEqual(value, expected);
      
      case 'gt':
        return this.compareNumbers(value, expected) > 0;
      
      case 'gte':
        return this.compareNumbers(value, expected) >= 0;
      
      case 'lt':
        return this.compareNumbers(value, expected) < 0;
      
      case 'lte':
        return this.compareNumbers(value, expected) <= 0;
      
      case 'has':
        return this.hasValue(value, expected);
      
      case 'contains':
        return this.containsValue(value, expected);
      
      case 'in':
        return this.isInArray(value, expected);
      
      case 'not_in':
        return !this.isInArray(value, expected);
      
      default:
        throw new Error(`Unknown operation: ${op}`);
    }
  }

  /**
   * Deep equality check
   */
  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;
    
    if (typeof a === 'object') {
      if (Array.isArray(a) !== Array.isArray(b)) return false;
      
      if (Array.isArray(a)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
          if (!this.deepEqual(a[i], b[i])) return false;
        }
        return true;
      }
      
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      
      for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!this.deepEqual(a[key], b[key])) return false;
      }
      return true;
    }
    
    return false;
  }

  /**
   * Compare numbers
   */
  private compareNumbers(a: any, b: any): number {
    const numA = this.toNumber(a);
    const numB = this.toNumber(b);
    
    if (isNaN(numA) || isNaN(numB)) {
      throw new Error('Cannot compare non-numeric values');
    }
    
    return numA - numB;
  }

  /**
   * Convert to number
   */
  private toNumber(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value);
    return NaN;
  }

  /**
   * Check if value has property
   */
  private hasValue(value: any, expected: any): boolean {
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        return value.includes(expected);
      }
      return expected in value;
    }
    return false;
  }

  /**
   * Check if value contains substring
   */
  private containsValue(value: any, expected: any): boolean {
    if (typeof value === 'string') {
      return value.includes(expected);
    }
    if (Array.isArray(value)) {
      return value.some(item => 
        typeof item === 'string' && item.includes(expected)
      );
    }
    return false;
  }

  /**
   * Check if value is in array
   */
  private isInArray(value: any, array: any[]): boolean {
    if (!Array.isArray(array)) return false;
    return array.includes(value);
  }

  /**
   * Increment operation counter
   */
  private incrementOperations(): void {
    this.operationCount++;
    if (this.operationCount > this.maxOperations) {
      throw new Error('Maximum operations exceeded');
    }
  }

  /**
   * Increment depth counter
   */
  private incrementDepth(): void {
    this.depth++;
    if (this.depth > this.maxDepth) {
      throw new Error('Maximum depth exceeded');
    }
  }

  /**
   * Decrement depth counter
   */
  private decrementDepth(): void {
    this.depth = Math.max(0, this.depth - 1);
  }

  /**
   * Reset counters
   */
  private resetCounters(): void {
    this.operationCount = 0;
    this.depth = 0;
  }

  /**
   * Validate expression syntax
   */
  validateExpression(expression: string): {
    valid: boolean;
    error?: string;
  } {
    try {
      // Check for dangerous patterns
      const dangerousPatterns = [
        /eval\s*\(/,
        /Function\s*\(/,
        /setTimeout\s*\(/,
        /setInterval\s*\(/,
        /require\s*\(/,
        /import\s*\(/,
        /__proto__/,
        /constructor/,
        /prototype/,
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(expression)) {
          return {
            valid: false,
            error: `Dangerous pattern detected: ${pattern}`,
          };
        }
      }

      // Check for balanced parentheses
      let parenCount = 0;
      for (const char of expression) {
        if (char === '(') parenCount++;
        if (char === ')') parenCount--;
        if (parenCount < 0) {
          return {
            valid: false,
            error: 'Unbalanced parentheses',
          };
        }
      }

      if (parenCount !== 0) {
        return {
          valid: false,
          error: 'Unbalanced parentheses',
        };
      }

      return { valid: true };

    } catch (error) {
      return {
        valid: false,
        error: `Expression validation error: ${error}`,
      };
    }
  }

  /**
   * Get expression complexity score
   */
  getComplexityScore(expression: string): number {
    let score = 0;
    
    // Count operators
    const operators = ['+', '-', '*', '/', '==', '!=', '<', '>', '<=', '>=', '&&', '||'];
    for (const op of operators) {
      const matches = expression.match(new RegExp(op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
      if (matches) {
        score += matches.length;
      }
    }
    
    // Count function calls
    const functionCalls = expression.match(/\w+\s*\(/g);
    if (functionCalls) {
      score += functionCalls.length;
    }
    
    // Count nested expressions
    const nestedParens = expression.match(/\([^)]*\(/g);
    if (nestedParens) {
      score += nestedParens.length;
    }
    
    return score;
  }
}

// Singleton instance
let dslInterpreter: DSLInterpreter | null = null;

export function getDSLInterpreter(): DSLInterpreter {
  if (!dslInterpreter) {
    dslInterpreter = new DSLInterpreter();
  }
  return dslInterpreter;
}
