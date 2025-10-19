/**
 * AWF Graph Linter
 * Validates quest graphs for cycles, reachability, and text limits
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { questGraphsRepo } from '../src/repos/quest-graphs-repo.js';
import { QuestGraph } from '../src/graph/quest-graph-engine.js';

interface LintResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

interface LintOptions {
  checkCycles: boolean;
  checkReachability: boolean;
  checkTextLimits: boolean;
  checkObjectives: boolean;
  checkGuards: boolean;
  verbose: boolean;
}

class GraphLinter {
  private options: LintOptions;

  constructor(options: Partial<LintOptions> = {}) {
    this.options = {
      checkCycles: true,
      checkReachability: true,
      checkTextLimits: true,
      checkObjectives: true,
      checkGuards: true,
      verbose: false,
      ...options,
    };
  }

  /**
   * Lint a quest graph
   */
  lintGraph(graph: QuestGraph): LintResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Basic validation
    const validation = questGraphsRepo.validateGraph(graph);
    errors.push(...validation.errors);
    warnings.push(...validation.warnings);

    // Additional checks
    if (this.options.checkCycles) {
      const cycleResults = this.checkCycles(graph);
      errors.push(...cycleResults.errors);
      warnings.push(...cycleResults.warnings);
      suggestions.push(...cycleResults.suggestions);
    }

    if (this.options.checkReachability) {
      const reachabilityResults = this.checkReachability(graph);
      errors.push(...reachabilityResults.errors);
      warnings.push(...reachabilityResults.warnings);
      suggestions.push(...reachabilityResults.suggestions);
    }

    if (this.options.checkTextLimits) {
      const textResults = this.checkTextLimits(graph);
      errors.push(...textResults.errors);
      warnings.push(...textResults.warnings);
      suggestions.push(...textResults.suggestions);
    }

    if (this.options.checkObjectives) {
      const objectiveResults = this.checkObjectives(graph);
      errors.push(...objectiveResults.errors);
      warnings.push(...objectiveResults.warnings);
      suggestions.push(...objectiveResults.suggestions);
    }

    if (this.options.checkGuards) {
      const guardResults = this.checkGuards(graph);
      errors.push(...guardResults.errors);
      warnings.push(...guardResults.warnings);
      suggestions.push(...guardResults.suggestions);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  /**
   * Check for cycles in graph
   */
  private checkCycles(graph: QuestGraph): LintResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    const cycles = this.detectCycles(graph);
    if (cycles.length > 0) {
      errors.push(`Cycles detected: ${cycles.join(', ')}`);
      suggestions.push('Consider breaking cycles by adding exit conditions or marking nodes as loop:true');
    }

    return { valid: errors.length === 0, errors, warnings, suggestions };
  }

  /**
   * Check reachability from start node
   */
  private checkReachability(graph: QuestGraph): LintResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    const unreachableNodes = this.findUnreachableNodes(graph);
    if (unreachableNodes.length > 0) {
      warnings.push(`Unreachable nodes: ${unreachableNodes.join(', ')}`);
      suggestions.push('Consider adding paths to unreachable nodes or removing them');
    }

    // Check if start node exists
    const startNode = graph.nodes.find(n => n.id === graph.start);
    if (!startNode) {
      errors.push(`Start node '${graph.start}' not found in graph`);
    }

    return { valid: errors.length === 0, errors, warnings, suggestions };
  }

  /**
   * Check text length limits
   */
  private checkTextLimits(graph: QuestGraph): LintResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    for (const node of graph.nodes) {
      if (node.synopsis.length > 160) {
        errors.push(`Node ${node.id}: synopsis too long (${node.synopsis.length} > 160)`);
        suggestions.push(`Consider shortening synopsis for node ${node.id}`);
      }
      if (node.hint && node.hint.length > 120) {
        errors.push(`Node ${node.id}: hint too long (${node.hint.length} > 120)`);
        suggestions.push(`Consider shortening hint for node ${node.id}`);
      }
    }

    return { valid: errors.length === 0, errors, warnings, suggestions };
  }

  /**
   * Check objectives consistency
   */
  private checkObjectives(graph: QuestGraph): LintResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    const referencedObjectives = new Set<string>();
    const definedObjectives = new Set<string>();

    // Collect referenced objectives
    for (const node of graph.nodes) {
      if (node.enterIf) {
        for (const condition of node.enterIf) {
          if (condition.objective) {
            referencedObjectives.add(condition.objective);
          }
        }
      }
    }

    for (const edge of graph.edges || []) {
      if (edge.guard) {
        for (const guard of edge.guard) {
          if (guard.objective) {
            referencedObjectives.add(guard.objective);
          }
        }
      }
    }

    // Collect defined objectives
    for (const node of graph.nodes) {
      if (node.onSuccess) {
        for (const action of node.onSuccess) {
          if (action.act === 'OBJECTIVE_UPDATE' && action.id) {
            definedObjectives.add(action.id);
          }
        }
      }
    }

    // Check for missing objectives
    const missingObjectives = Array.from(referencedObjectives).filter(obj => !definedObjectives.has(obj));
    if (missingObjectives.length > 0) {
      warnings.push(`Missing objectives: ${missingObjectives.join(', ')}`);
      suggestions.push('Consider adding OBJECTIVE_UPDATE actions for referenced objectives');
    }

    // Check for unused objectives
    const unusedObjectives = Array.from(definedObjectives).filter(obj => !referencedObjectives.has(obj));
    if (unusedObjectives.length > 0) {
      warnings.push(`Unused objectives: ${unusedObjectives.join(', ')}`);
      suggestions.push('Consider removing unused objectives or adding references to them');
    }

    return { valid: errors.length === 0, errors, warnings, suggestions };
  }

  /**
   * Check guard conditions
   */
  private checkGuards(graph: QuestGraph): LintResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    for (const edge of graph.edges || []) {
      if (edge.guard) {
        for (const guard of edge.guard) {
          // Check if guard references exist
          if (guard.objective) {
            const objectiveExists = graph.nodes.some(node => 
              node.onSuccess?.some(action => 
                action.act === 'OBJECTIVE_UPDATE' && action.id === guard.objective
              )
            );
            if (!objectiveExists) {
              errors.push(`Edge ${edge.from} -> ${edge.to}: references undefined objective '${guard.objective}'`);
            }
          }

          if (guard.flag) {
            // Check if flag is set somewhere
            const flagSet = graph.nodes.some(node => 
              node.onSuccess?.some(action => 
                action.act === 'FLAG_SET' && action.key === guard.flag
              ) ||
              node.onFail?.some(action => 
                action.act === 'FLAG_SET' && action.key === guard.flag
              )
            );
            if (!flagSet) {
              warnings.push(`Edge ${edge.from} -> ${edge.to}: references flag '${guard.flag}' that may not be set`);
            }
          }
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings, suggestions };
  }

  /**
   * Detect cycles in graph
   */
  private detectCycles(graph: QuestGraph): string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[] = [];

    const dfs = (nodeId: string, path: string[]) => {
      if (recursionStack.has(nodeId)) {
        cycles.push(path.join(' -> ') + ' -> ' + nodeId);
        return;
      }

      if (visited.has(nodeId)) {
        return;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const outgoingEdges = graph.edges?.filter(edge => edge.from === nodeId) || [];
      for (const edge of outgoingEdges) {
        dfs(edge.to, [...path, nodeId]);
      }

      recursionStack.delete(nodeId);
    };

    for (const node of graph.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    }

    return cycles;
  }

  /**
   * Find unreachable nodes
   */
  private findUnreachableNodes(graph: QuestGraph): string[] {
    const reachable = new Set<string>();
    
    const dfs = (nodeId: string) => {
      if (reachable.has(nodeId)) return;
      
      reachable.add(nodeId);
      const outgoingEdges = graph.edges?.filter(edge => edge.from === nodeId) || [];
      for (const edge of outgoingEdges) {
        dfs(edge.to);
      }
    };

    // Start from start node
    dfs(graph.start);

    return graph.nodes
      .map(node => node.id)
      .filter(id => !reachable.has(id));
  }
}

/**
 * CLI entry point
 */
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'lint':
      const filePath = args[1];
      if (!filePath) {
        console.error('Usage: npm run awf:lint:graph lint <file-path>');
        process.exit(1);
      }

      try {
        const graphData = JSON.parse(readFileSync(filePath, 'utf8'));
        const linter = new GraphLinter({ verbose: true });
        const result = linter.lintGraph(graphData);

        console.log(`\nGraph Lint Results for ${filePath}:`);
        console.log(`Valid: ${result.valid ? '✅' : '❌'}`);
        
        if (result.errors.length > 0) {
          console.log('\nErrors:');
          result.errors.forEach(error => console.log(`  ❌ ${error}`));
        }
        
        if (result.warnings.length > 0) {
          console.log('\nWarnings:');
          result.warnings.forEach(warning => console.log(`  ⚠️  ${warning}`));
        }
        
        if (result.suggestions.length > 0) {
          console.log('\nSuggestions:');
          result.suggestions.forEach(suggestion => console.log(`  💡 ${suggestion}`));
        }

        process.exit(result.valid ? 0 : 1);
      } catch (error) {
        console.error('Error linting graph:', error);
        process.exit(1);
      }
      break;

    case 'validate':
      const graphId = args[1];
      if (!graphId) {
        console.error('Usage: npm run awf:lint:graph validate <graph-id>');
        process.exit(1);
      }

      // This would validate a graph in the database
      console.log('Database validation not implemented yet');
      break;

    default:
      console.log('Usage:');
      console.log('  npm run awf:lint:graph lint <file-path>     - Lint graph from file');
      console.log('  npm run awf:lint:graph validate <graph-id>  - Validate graph in database');
      process.exit(1);
  }
}


