// Phase 26: Dependency Solver
// Handles dependency resolution, compatibility matrix, and install plan generation

import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import semver from 'semver';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Validation schemas
const DependencyRequestSchema = z.object({
  namespace: z.string(),
  version: z.string(),
  awf_core_version: z.string()
});

const InstallPlanRequestSchema = z.object({
  packs: z.array(z.object({
    namespace: z.string(),
    version_range: z.string()
  })),
  awf_core_version: z.string(),
  token_budget: z.number().optional()
});

export interface DependencyNode {
  namespace: string;
  version: string;
  version_range: string;
  type: 'required' | 'optional' | 'conflicts';
  awf_core_range: string;
  dependencies: DependencyNode[];
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: Map<string, string[]>;
  conflicts: Array<{
    pack1: string;
    pack2: string;
    reason: string;
  }>;
}

export interface InstallPlan {
  success: boolean;
  plan?: Array<{
    namespace: string;
    version: string;
    order: number;
    token_budget_used: number;
    token_budget_remaining: number;
  }>;
  conflicts?: Array<{
    pack1: string;
    pack2: string;
    reason: string;
  }>;
  token_budget_exceeded?: boolean;
  error?: string;
}

export interface CompatibilityMatrix {
  awf_core_version: string;
  compatible_packs: Array<{
    namespace: string;
    version: string;
    compatibility: 'full' | 'partial' | 'none';
    issues: string[];
  }>;
  incompatible_packs: Array<{
    namespace: string;
    version: string;
    reason: string;
  }>;
}

export class DependencySolverService {
  private supabase: any;

  constructor() {
    this.supabase = supabase;
  }

  /**
   * Resolve dependencies for a pack
   */
  async resolveDependencies(
    data: z.infer<typeof DependencyRequestSchema>
  ): Promise<{
    success: boolean;
    data?: DependencyGraph;
    error?: string;
  }> {
    try {
      const validated = DependencyRequestSchema.parse(data);
      
      // Get pack data
      const { data: packData, error: packError } = await this.supabase
        .from('mod_pack_registry')
        .select('*')
        .eq('namespace', validated.namespace)
        .eq('version', validated.version)
        .single();

      if (packError) {
        throw new Error(`Pack not found: ${packError.message}`);
      }

      // Check AWF core compatibility
      if (!semver.satisfies(validated.awf_core_version, packData.awf_core_range)) {
        throw new Error(`Pack requires AWF core ${packData.awf_core_range}, but ${validated.awf_core_version} is provided`);
      }

      // Build dependency graph
      const graph = await this.buildDependencyGraph(validated.namespace, validated.version, validated.awf_core_version);

      // Detect cycles
      const cycles = this.detectCycles(graph);
      if (cycles.length > 0) {
        throw new Error(`Circular dependencies detected: ${cycles.join(', ')}`);
      }

      // Detect conflicts
      const conflicts = this.detectConflicts(graph);
      if (conflicts.length > 0) {
        console.warn('Dependency conflicts detected:', conflicts);
      }

      return {
        success: true,
        data: {
          nodes: graph.nodes,
          edges: graph.edges,
          conflicts: conflicts
        }
      };
    } catch (error) {
      console.error('Dependency resolution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate install plan
   */
  async generateInstallPlan(
    data: z.infer<typeof InstallPlanRequestSchema>
  ): Promise<InstallPlan> {
    try {
      const validated = InstallPlanRequestSchema.parse(data);
      
      const graph = new Map<string, DependencyNode>();
      const conflicts: Array<{ pack1: string; pack2: string; reason: string }> = [];
      let tokenBudgetUsed = 0;
      const tokenBudget = validated.token_budget || 1000; // Default budget

      // Resolve each requested pack
      for (const pack of validated.packs) {
        try {
          const depGraph = await this.buildDependencyGraph(
            pack.namespace, 
            pack.version_range, 
            validated.awf_core_version
          );

          // Merge into main graph
          for (const [key, node] of depGraph.nodes) {
            if (graph.has(key)) {
              // Check for conflicts
              const existing = graph.get(key)!;
              if (existing.version !== node.version) {
                conflicts.push({
                  pack1: existing.namespace,
                  pack2: node.namespace,
                  reason: `Version conflict: ${existing.namespace}@${existing.version} vs ${node.namespace}@${node.version}`
                });
              }
            } else {
              graph.set(key, node);
            }
          }
        } catch (error) {
          conflicts.push({
            pack1: pack.namespace,
            pack2: 'system',
            reason: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Check for circular dependencies
      const cycles = this.detectCycles({ nodes: graph, edges: new Map() });
      if (cycles.length > 0) {
        return {
          success: false,
          conflicts: [{
            pack1: 'system',
            pack2: 'system',
            reason: `Circular dependencies detected: ${cycles.join(', ')}`
          }]
        };
      }

      // Generate topological sort for install order
      const installOrder = this.topologicalSort(graph);
      
      // Calculate token budget usage
      for (const node of installOrder) {
        const tokenUsage = await this.calculateTokenUsage(node.namespace, node.version);
        tokenBudgetUsed += tokenUsage;
        
        if (tokenBudgetUsed > tokenBudget) {
          return {
            success: false,
            token_budget_exceeded: true,
            conflicts: [{
              pack1: node.namespace,
              pack2: 'system',
              reason: `Token budget exceeded: ${tokenBudgetUsed}/${tokenBudget}`
            }]
          };
        }
      }

      // Generate install plan
      const plan = installOrder.map((node, index) => ({
        namespace: node.namespace,
        version: node.version,
        order: index + 1,
        token_budget_used: tokenBudgetUsed,
        token_budget_remaining: tokenBudget - tokenBudgetUsed
      }));

      return {
        success: true,
        plan: plan,
        conflicts: conflicts.length > 0 ? conflicts : undefined
      };
    } catch (error) {
      console.error('Install plan generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get compatibility matrix
   */
  async getCompatibilityMatrix(awfCoreVersion: string): Promise<{
    success: boolean;
    data?: CompatibilityMatrix;
    error?: string;
  }> {
    try {
      // Get all listed packs
      const { data: packs, error: packsError } = await this.supabase
        .from('mod_pack_registry')
        .select('namespace, version, awf_core_range, manifest')
        .eq('status', 'listed')
        .order('created_at', { ascending: false });

      if (packsError) {
        throw new Error(`Failed to get packs: ${packsError.message}`);
      }

      const compatiblePacks: Array<{
        namespace: string;
        version: string;
        compatibility: 'full' | 'partial' | 'none';
        issues: string[];
      }> = [];

      const incompatiblePacks: Array<{
        namespace: string;
        version: string;
        reason: string;
      }> = [];

      for (const pack of packs || []) {
        const compatibility = this.checkCompatibility(pack.awf_core_range, awfCoreVersion);
        
        if (compatibility.compatible) {
          compatiblePacks.push({
            namespace: pack.namespace,
            version: pack.version,
            compatibility: compatibility.type,
            issues: compatibility.issues
          });
        } else {
          incompatiblePacks.push({
            namespace: pack.namespace,
            version: pack.version,
            reason: compatibility.reason
          });
        }
      }

      return {
        success: true,
        data: {
          awf_core_version: awfCoreVersion,
          compatible_packs: compatiblePacks,
          incompatible_packs: incompatiblePacks
        }
      };
    } catch (error) {
      console.error('Compatibility matrix generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Build dependency graph
   */
  private async buildDependencyGraph(
    namespace: string, 
    versionRange: string, 
    awfCoreVersion: string
  ): Promise<DependencyGraph> {
    const nodes = new Map<string, DependencyNode>();
    const edges = new Map<string, string[]>();
    const visited = new Set<string>();

    const queue: Array<{ namespace: string; version_range: string }> = [
      { namespace, version_range: versionRange }
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const key = `${current.namespace}@${current.version_range}`;
      
      if (visited.has(key)) continue;
      visited.add(key);

      // Find best matching version
      const { data: packData, error: packError } = await this.supabase
        .from('mod_pack_registry')
        .select('*')
        .eq('namespace', current.namespace)
        .eq('status', 'listed')
        .order('created_at', { ascending: false });

      if (packError || !packData || packData.length === 0) {
        throw new Error(`Pack not found: ${current.namespace}`);
      }

      // Find version that satisfies range
      const compatibleVersions = packData.filter(pack => 
        semver.satisfies(pack.version, current.version_range) &&
        semver.satisfies(awfCoreVersion, pack.awf_core_range)
      );

      if (compatibleVersions.length === 0) {
        throw new Error(`No compatible version found for ${current.namespace}@${current.version_range}`);
      }

      // Use latest compatible version
      const selectedPack = compatibleVersions.sort((a, b) => 
        semver.compare(b.version, a.version)
      )[0];

      const node: DependencyNode = {
        namespace: selectedPack.namespace,
        version: selectedPack.version,
        version_range: current.version_range,
        type: 'required',
        awf_core_range: selectedPack.awf_core_range,
        dependencies: []
      };

      nodes.set(key, node);

      // Get dependencies
      const { data: deps, error: depsError } = await this.supabase
        .from('mod_pack_dependencies')
        .select('dep_namespace, dep_version_range, dep_type')
        .eq('namespace', selectedPack.namespace)
        .eq('version', selectedPack.version);

      if (depsError) {
        console.warn(`Failed to get dependencies for ${selectedPack.namespace}@${selectedPack.version}:`, depsError.message);
      }

      if (deps && deps.length > 0) {
        const depKeys: string[] = [];
        
        for (const dep of deps) {
          if (dep.dep_type === 'conflicts') {
            // Handle conflicts
            continue;
          }
          
          const depKey = `${dep.dep_namespace}@${dep.dep_version_range}`;
          depKeys.push(depKey);
          
          if (!visited.has(depKey)) {
            queue.push({
              namespace: dep.dep_namespace,
              version_range: dep.dep_version_range
            });
          }
        }
        
        edges.set(key, depKeys);
      }
    }

    return { nodes, edges, conflicts: [] };
  }

  /**
   * Detect circular dependencies
   */
  private detectCycles(graph: DependencyGraph): string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[] = [];

    const dfs = (nodeKey: string, path: string[]): void => {
      if (recursionStack.has(nodeKey)) {
        const cycleStart = path.indexOf(nodeKey);
        cycles.push(path.slice(cycleStart).join(' -> '));
        return;
      }

      if (visited.has(nodeKey)) return;

      visited.add(nodeKey);
      recursionStack.add(nodeKey);

      const dependencies = graph.edges.get(nodeKey) || [];
      for (const dep of dependencies) {
        dfs(dep, [...path, nodeKey]);
      }

      recursionStack.delete(nodeKey);
    };

    for (const nodeKey of graph.nodes.keys()) {
      if (!visited.has(nodeKey)) {
        dfs(nodeKey, []);
      }
    }

    return cycles;
  }

  /**
   * Detect conflicts
   */
  private detectConflicts(graph: DependencyGraph): Array<{
    pack1: string;
    pack2: string;
    reason: string;
  }> {
    const conflicts: Array<{ pack1: string; pack2: string; reason: string }> = [];
    const nodeMap = new Map<string, DependencyNode>();

    // Build node map
    for (const [key, node] of graph.nodes) {
      nodeMap.set(key, node);
    }

    // Check for version conflicts
    const namespaceVersions = new Map<string, string>();
    
    for (const [key, node] of graph.nodes) {
      const existing = namespaceVersions.get(node.namespace);
      if (existing && existing !== node.version) {
        conflicts.push({
          pack1: `${node.namespace}@${existing}`,
          pack2: `${node.namespace}@${node.version}`,
          reason: `Version conflict for ${node.namespace}`
        });
      } else {
        namespaceVersions.set(node.namespace, node.version);
      }
    }

    return conflicts;
  }

  /**
   * Topological sort for install order
   */
  private topologicalSort(graph: DependencyGraph): DependencyNode[] {
    const visited = new Set<string>();
    const result: DependencyNode[] = [];

    const dfs = (nodeKey: string): void => {
      if (visited.has(nodeKey)) return;

      visited.add(nodeKey);

      const dependencies = graph.edges.get(nodeKey) || [];
      for (const dep of dependencies) {
        dfs(dep);
      }

      const node = graph.nodes.get(nodeKey);
      if (node) {
        result.push(node);
      }
    };

    for (const nodeKey of graph.nodes.keys()) {
      if (!visited.has(nodeKey)) {
        dfs(nodeKey);
      }
    }

    return result;
  }

  /**
   * Check compatibility between AWF core versions
   */
  private checkCompatibility(
    requiredRange: string, 
    providedVersion: string
  ): {
    compatible: boolean;
    type: 'full' | 'partial' | 'none';
    issues: string[];
    reason?: string;
  } {
    const issues: string[] = [];
    
    try {
      if (semver.satisfies(providedVersion, requiredRange)) {
        return {
          compatible: true,
          type: 'full',
          issues: []
        };
      } else {
        return {
          compatible: false,
          type: 'none',
          issues: [],
          reason: `AWF core ${providedVersion} does not satisfy requirement ${requiredRange}`
        };
      }
    } catch (error) {
      return {
        compatible: false,
        type: 'none',
        issues: [],
        reason: `Invalid version range: ${requiredRange}`
      };
    }
  }

  /**
   * Calculate token usage for a pack
   */
  private async calculateTokenUsage(namespace: string, version: string): Promise<number> {
    try {
      // Get pack metrics
      const { data: metrics, error: metricsError } = await this.supabase
        .from('mod_pack_metrics')
        .select('token_budget_usage')
        .eq('namespace', namespace)
        .eq('version', version)
        .order('metric_date', { ascending: false })
        .limit(1);

      if (metricsError || !metrics || metrics.length === 0) {
        // Return default token usage if no metrics available
        return 10; // Default token usage per pack
      }

      return metrics[0].token_budget_usage || 10;
    } catch (error) {
      console.warn(`Failed to calculate token usage for ${namespace}@${version}:`, error);
      return 10; // Default fallback
    }
  }
}

export const dependencySolverService = new DependencySolverService();
