// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * Logic Tracer - Standardized Flight Recorder for Deterministic Engine
 * Provides structured logging for debugging silent failures
 */

export interface LogicTraceContext {
  action_id?: string;
  trigger_id?: string;
  step_id?: string;
  target_id?: string;
  entity_id?: string;
  path?: string;
  function?: string;
  [key: string]: unknown;
}

/**
 * Standardized logging patterns for Engine debugging
 */
export class LogicTracer {
  /**
   * Log successful step execution
   */
  static trace(message: string, context: LogicTraceContext = {}): void {
    console.log(`[LOGIC_TRACE] ${message}`, { context, timestamp: new Date().toISOString() });
  }

  /**
   * Log handled failures (e.g., condition false, path missing)
   */
  static warning(message: string, context: LogicTraceContext = {}): void {
    console.warn(`[LOGIC_WARNING] ${message}`, { context, timestamp: new Date().toISOString() });
  }

  /**
   * Log errors/crashes
   */
  static error(message: string, error: Error | unknown, context: LogicTraceContext = {}): void {
    const errorDetails = error instanceof Error 
      ? { message: error.message, stack: error.stack }
      : { error: String(error) };
    
    console.error(`[LOGIC_ERROR] ${message}`, { 
      context, 
      error: errorDetails,
      timestamp: new Date().toISOString() 
    });
  }

  /**
   * Log action start
   */
  static actionStart(triggerId: string, targetIds: string[], parameters: Record<string, unknown>): void {
    this.trace(`Starting Action: ${triggerId}`, {
      trigger_id: triggerId,
      target_ids: targetIds,
      target_count: targetIds.length,
      parameters,
    });
  }

  /**
   * Log step execution
   */
  static stepStart(stepId: string, functionName: string, resolvedArgs: Record<string, unknown>): void {
    this.trace(`Step ${stepId} Input`, {
      step_id: stepId,
      function: functionName,
      args: resolvedArgs,
    });
  }

  /**
   * Log step result
   */
  static stepResult(stepId: string, result: unknown): void {
    this.trace(`Step ${stepId} Result`, {
      step_id: stepId,
      result,
    });
  }

  /**
   * Log path write failure
   */
  static pathWriteFailed(
    attemptedPath: string,
    missingSegment: string,
    entityId?: string,
    parentPath?: string
  ): void {
    this.warning(`Write Failed - Path Not Found`, {
      attempted_path: attemptedPath,
      missing_segment: missingSegment,
      entity_id: entityId,
      parent_path: parentPath,
    });
  }

  /**
   * Log relationship delta target resolution
   */
  static relationshipDeltaTarget(
    targetId: string,
    resolvedFrom: string,
    verb: string
  ): void {
    this.trace(`Relationship Delta Target`, {
      target_id: targetId,
      resolved_from: resolvedFrom,
      verb,
    });
  }
}
