// Phase 27: Autonomous Playtesting Bots and Fuzz Harness
// Oracle detection system for failure conditions

export interface OracleResults {
  soft_lock: boolean;
  budget_violation: boolean;
  validator_retries_exceeded: boolean;
  fallback_engagements: boolean;
  safety_violation: boolean;
  performance_violation: boolean;
  integrity_violation: boolean;
  details: {
    soft_lock_reason?: string;
    budget_violation_details?: any;
    validator_retry_count?: number;
    fallback_count?: number;
    safety_violation_type?: string;
    performance_metrics?: any;
    integrity_issues?: string[];
  };
}

export interface OracleConfig {
  soft_lock_threshold: number; // turns without progress
  budget_violation_threshold: number; // token usage percentage
  validator_retry_threshold: number; // max retries allowed
  fallback_threshold: number; // max fallbacks allowed
  performance_latency_threshold: number; // ms
  performance_p95_threshold: number; // ms
  safety_keywords: string[];
  integrity_checks: boolean;
}

export class OracleDetector {
  private config: OracleConfig;
  private results: OracleResults;
  private history: Array<{
    turn: number;
    timestamp: Date;
    results: OracleResults;
  }> = [];

  constructor(config?: Partial<OracleConfig>) {
    this.config = {
      soft_lock_threshold: 10,
      budget_violation_threshold: 0.95,
      validator_retry_threshold: 5,
      fallback_threshold: 3,
      performance_latency_threshold: 5000,
      performance_p95_threshold: 10000,
      safety_keywords: ['explicit', 'adult', 'violence', 'gore', 'nsfw'],
      integrity_checks: true,
      ...config
    };

    this.results = this.initializeResults();
  }

  private initializeResults(): OracleResults {
    return {
      soft_lock: false,
      budget_violation: false,
      validator_retries_exceeded: false,
      fallback_engagements: false,
      safety_violation: false,
      performance_violation: false,
      integrity_violation: false,
      details: {}
    };
  }

  checkOracles(bundle: any, context: any, turnResult: any, turnNumber: number): OracleResults {
    // Reset results for this turn
    this.results = this.initializeResults();

    // Check soft lock
    this.checkSoftLock(bundle, context, turnResult, turnNumber);
    
    // Check budget violations
    this.checkBudgetViolation(bundle, context, turnResult, turnNumber);
    
    // Check validator retries
    this.checkValidatorRetries(bundle, context, turnResult, turnNumber);
    
    // Check fallback engagements
    this.checkFallbackEngagements(bundle, context, turnResult, turnNumber);
    
    // Check safety violations
    this.checkSafetyViolation(bundle, context, turnResult, turnNumber);
    
    // Check performance violations
    this.checkPerformanceViolation(bundle, context, turnResult, turnNumber);
    
    // Check integrity violations
    this.checkIntegrityViolation(bundle, context, turnResult, turnNumber);

    // Store in history
    this.history.push({
      turn: turnNumber,
      timestamp: new Date(),
      results: { ...this.results }
    });

    return this.results;
  }

  private checkSoftLock(bundle: any, context: any, turnResult: any, turnNumber: number): void {
    // Check if we've been stuck without objective progress
    const stuckTurns = this.calculateStuckTurns(bundle, context, turnResult);
    
    if (stuckTurns >= this.config.soft_lock_threshold) {
      this.results.soft_lock = true;
      this.results.details.soft_lock_reason = `No objective progress for ${stuckTurns} turns`;
    }

    // Check if there are no valid graph paths
    const validPaths = this.findValidPaths(bundle, context);
    if (validPaths.length === 0) {
      this.results.soft_lock = true;
      this.results.details.soft_lock_reason = 'No valid paths available in quest graph';
    }
  }

  private calculateStuckTurns(bundle: any, context: any, turnResult: any): number {
    // Simple heuristic: count turns without new nodes or objective progress
    const hasNewNodes = turnResult.new_nodes && turnResult.new_nodes.length > 0;
    const hasObjectiveProgress = turnResult.objective_progress && turnResult.objective_progress > 0;
    
    if (hasNewNodes || hasObjectiveProgress) {
      return 0; // Reset stuck counter
    }
    
    // Get last stuck count from history
    const lastEntry = this.history[this.history.length - 1];
    return lastEntry ? (lastEntry.results.details.soft_lock_reason ? 
      parseInt(lastEntry.results.details.soft_lock_reason.split(' ')[4]) + 1 : 1) : 1;
  }

  private findValidPaths(bundle: any, context: any): string[] {
    // Find valid paths from current node
    const currentNode = context.current_node;
    if (!currentNode || !bundle.quest_graph) return [];

    const graph = bundle.quest_graph;
    const validPaths: string[] = [];

    // Simple path finding - look for reachable nodes
    const visited = new Set<string>();
    const queue = [currentNode];

    while (queue.length > 0) {
      const node = queue.shift()!;
      if (visited.has(node)) continue;
      visited.add(node);

      // Find edges from this node
      const edges = graph.edges?.filter((edge: any) => edge.from === node) || [];
      for (const edge of edges) {
        if (!visited.has(edge.to)) {
          validPaths.push(edge.to);
          queue.push(edge.to);
        }
      }
    }

    return validPaths;
  }

  private checkBudgetViolation(bundle: any, context: any, turnResult: any, turnNumber: number): void {
    // Check token usage against budget
    const budgetUsage = this.calculateBudgetUsage(context, turnResult);
    const budgetPercentage = budgetUsage.used / budgetUsage.total;

    if (budgetPercentage > this.config.budget_violation_threshold) {
      this.results.budget_violation = true;
      this.results.details.budget_violation_details = {
        used: budgetUsage.used,
        total: budgetUsage.total,
        percentage: budgetPercentage,
        threshold: this.config.budget_violation_threshold
      };
    }

    // Check for repair loops (excessive token usage in single turn)
    if (turnResult.token_usage && turnResult.token_usage > 1000) {
      this.results.budget_violation = true;
      this.results.details.budget_violation_details = {
        ...this.results.details.budget_violation_details,
        repair_loop: true,
        single_turn_usage: turnResult.token_usage
      };
    }
  }

  private calculateBudgetUsage(context: any, turnResult: any): { used: number; total: number } {
    const baseUsage = context.budget_usage || { tokens_in: 0, tokens_out: 0, max_tokens: 1000 };
    const turnUsage = turnResult.token_usage || 0;
    
    return {
      used: baseUsage.tokens_in + baseUsage.tokens_out + turnUsage,
      total: baseUsage.max_tokens
    };
  }

  private checkValidatorRetries(bundle: any, context: any, turnResult: any, turnNumber: number): void {
    // Check if validator retries exceed threshold
    const retryCount = turnResult.validator_retries || 0;
    
    if (retryCount > this.config.validator_retry_threshold) {
      this.results.validator_retries_exceeded = true;
      this.results.details.validator_retry_count = retryCount;
    }

    // Check cumulative retries across turns
    const cumulativeRetries = this.history.reduce((sum, entry) => 
      sum + (entry.results.details.validator_retry_count || 0), 0);
    
    if (cumulativeRetries > this.config.validator_retry_threshold * 2) {
      this.results.validator_retries_exceeded = true;
      this.results.details.validator_retry_count = cumulativeRetries;
    }
  }

  private checkFallbackEngagements(bundle: any, context: any, turnResult: any, turnNumber: number): void {
    // Check if fallbacks are being engaged too frequently
    const fallbackCount = turnResult.fallback_engagements || 0;
    
    if (fallbackCount > this.config.fallback_threshold) {
      this.results.fallback_engagements = true;
      this.results.details.fallback_count = fallbackCount;
    }

    // Check for TIME_ADVANCE rule violations
    if (turnResult.time_advance_violation) {
      this.results.fallback_engagements = true;
      this.results.details.fallback_count = (this.results.details.fallback_count || 0) + 1;
    }
  }

  private checkSafetyViolation(bundle: any, context: any, turnResult: any, turnNumber: number): void {
    // Check for explicit content flags
    const contentFlags = turnResult.content_flags || [];
    const hasExplicitContent = contentFlags.some((flag: string) => 
      this.config.safety_keywords.some(keyword => 
        flag.toLowerCase().includes(keyword.toLowerCase())
      )
    );

    if (hasExplicitContent) {
      this.results.safety_violation = true;
      this.results.details.safety_violation_type = 'explicit_content';
    }

    // Check for consent rule breaks
    if (turnResult.consent_violation) {
      this.results.safety_violation = true;
      this.results.details.safety_violation_type = 'consent_violation';
    }

    // Check for age-inappropriate content
    if (turnResult.age_rating_violation) {
      this.results.safety_violation = true;
      this.results.details.safety_violation_type = 'age_rating_violation';
    }
  }

  private checkPerformanceViolation(bundle: any, context: any, turnResult: any, turnNumber: number): void {
    // Check turn latency
    const turnLatency = turnResult.latency_ms || 0;
    if (turnLatency > this.config.performance_latency_threshold) {
      this.results.performance_violation = true;
      this.results.details.performance_metrics = {
        ...this.results.details.performance_metrics,
        turn_latency: turnLatency,
        threshold: this.config.performance_latency_threshold
      };
    }

    // Check P95 latency
    const p95Latency = this.calculateP95Latency();
    if (p95Latency > this.config.performance_p95_threshold) {
      this.results.performance_violation = true;
      this.results.details.performance_metrics = {
        ...this.results.details.performance_metrics,
        p95_latency: p95Latency,
        p95_threshold: this.config.performance_p95_threshold
      };
    }

    // Check assembler time
    if (turnResult.assembler_time && turnResult.assembler_time > 3000) {
      this.results.performance_violation = true;
      this.results.details.performance_metrics = {
        ...this.results.details.performance_metrics,
        assembler_time: turnResult.assembler_time
      };
    }
  }

  private calculateP95Latency(): number {
    if (this.history.length === 0) return 0;
    
    const latencies = this.history
      .map(entry => entry.results.details.performance_metrics?.turn_latency || 0)
      .filter(latency => latency > 0)
      .sort((a, b) => a - b);
    
    if (latencies.length === 0) return 0;
    
    const p95Index = Math.floor(latencies.length * 0.95);
    return latencies[p95Index] || 0;
  }

  private checkIntegrityViolation(bundle: any, context: any, turnResult: any, turnNumber: number): void {
    if (!this.config.integrity_checks) return;

    const integrityIssues: string[] = [];

    // Check acts schema violations
    if (turnResult.acts_schema_violation) {
      integrityIssues.push('Acts schema violation detected');
    }

    // Check state divergence across replays
    if (turnResult.state_divergence) {
      integrityIssues.push('State divergence detected');
    }

    // Check for invalid state transitions
    if (turnResult.invalid_transition) {
      integrityIssues.push('Invalid state transition detected');
    }

    // Check for data corruption
    if (turnResult.data_corruption) {
      integrityIssues.push('Data corruption detected');
    }

    if (integrityIssues.length > 0) {
      this.results.integrity_violation = true;
      this.results.details.integrity_issues = integrityIssues;
    }
  }

  getResults(): OracleResults {
    return { ...this.results };
  }

  getHistory(): Array<{ turn: number; timestamp: Date; results: OracleResults }> {
    return [...this.history];
  }

  getFailureSummary(): {
    total_failures: number;
    failure_types: string[];
    critical_failures: string[];
  } {
    const failureTypes: string[] = [];
    const criticalFailures: string[] = [];

    if (this.results.soft_lock) {
      failureTypes.push('soft_lock');
      criticalFailures.push('soft_lock');
    }
    if (this.results.budget_violation) {
      failureTypes.push('budget_violation');
      criticalFailures.push('budget_violation');
    }
    if (this.results.validator_retries_exceeded) {
      failureTypes.push('validator_retries');
    }
    if (this.results.fallback_engagements) {
      failureTypes.push('fallback_engagements');
    }
    if (this.results.safety_violation) {
      failureTypes.push('safety_violation');
      criticalFailures.push('safety_violation');
    }
    if (this.results.performance_violation) {
      failureTypes.push('performance_violation');
    }
    if (this.results.integrity_violation) {
      failureTypes.push('integrity_violation');
      criticalFailures.push('integrity_violation');
    }

    return {
      total_failures: failureTypes.length,
      failure_types: failureTypes,
      critical_failures: criticalFailures
    };
  }

  reset(): void {
    this.results = this.initializeResults();
    this.history = [];
  }

  updateConfig(newConfig: Partial<OracleConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
