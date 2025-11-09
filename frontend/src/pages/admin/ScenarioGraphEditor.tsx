/**
 * Scenario Graph Editor
 * Visual editor for scenario graphs with guard DSL
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Eye, AlertTriangle, CheckCircle, Loader2, Info, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { GraphCanvas } from '@/components/admin/graph/GraphCanvas';
import { NodeInspector } from '@/components/admin/graph/NodeInspector';
import { EdgeInspector } from '@/components/admin/graph/EdgeInspector';
import { LintPanel } from '@/components/admin/graph/LintPanel';
import { PromptAuthoringSection } from '@/components/admin/prompt-authoring/PromptAuthoringSection';
import { ContextChips } from '@/components/admin/prompt-authoring/ContextChips';
import { isAdminPromptFormsEnabled } from '@/lib/feature-flags';
import { trackAdminEvent } from '@/lib/admin-telemetry';

// Types (inline for now)
interface ScenarioNode {
  id: string;
  label: string;
  kind: 'scene' | 'choice' | 'event' | 'end';
  metadata?: Record<string, unknown>;
}

interface ScenarioEdge {
  from: string;
  to: string;
  guard?: any;
  label?: string;
  metadata?: Record<string, unknown>;
}

interface ScenarioGraph {
  nodes: ScenarioNode[];
  edges: ScenarioEdge[];
  entry_node?: string;
}

export default function ScenarioGraphEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [graph, setGraph] = useState<ScenarioGraph>({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState<ScenarioNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<ScenarioEdge | null>(null);
  const [lintIssues, setLintIssues] = useState<Array<{ severity: 'error' | 'warning'; message: string; nodeId?: string; edgeIndex?: number }>>([]);

  // Fetch graph
  const { data: graphData, isLoading } = useQuery({
    queryKey: ['admin', 'scenario-graph', id],
    queryFn: async () => {
      const res = await api.get(`/api/admin/scenarios/${id}/graph`);
      if (!res.ok) throw new Error('Failed to fetch graph');
      return res.data as ScenarioGraph;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (graphData) {
      setGraph(graphData);
    }
  }, [graphData]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (graphToSave: ScenarioGraph) => {
      const res = await api.put(`/api/admin/scenarios/${id}/graph`, {
        scene_graph: graphToSave,
      });
      if (!res.ok) throw new Error(res.error || 'Failed to save graph');
      return res.data;
    },
    onSuccess: () => {
      toast.success('Graph saved successfully');
      queryClient.invalidateQueries({ queryKey: ['admin', 'scenario-graph', id] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save graph');
    },
  });

  // Validate mutation
  const validateMutation = useMutation({
    mutationFn: async () => {
      // Client-side validation
      const nodeIds = new Set(graph.nodes.map(n => n.id));
      const issues: Array<{ severity: 'error' | 'warning'; message: string; nodeId?: string; edgeIndex?: number }> = [];

      // Check duplicate IDs
      if (nodeIds.size !== graph.nodes.length) {
        issues.push({ severity: 'error', message: 'Duplicate node IDs found' });
      }

      // Check edge references
      for (let i = 0; i < graph.edges.length; i++) {
        const edge = graph.edges[i];
        if (!nodeIds.has(edge.from)) {
          issues.push({ severity: 'error', message: `Edge ${i} references unknown source: ${edge.from}`, edgeIndex: i });
        }
        if (!nodeIds.has(edge.to)) {
          issues.push({ severity: 'error', message: `Edge ${i} references unknown target: ${edge.to}`, edgeIndex: i });
        }
      }

      setLintIssues(issues);
      return issues;
    },
  });

  const handleAddNode = useCallback(() => {
    const newNode: ScenarioNode = {
      id: `node_${Date.now()}`,
      label: 'New Node',
      kind: 'scene',
    };
    setGraph({ ...graph, nodes: [...graph.nodes, newNode] });
    setSelectedNode(newNode);
  }, [graph]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    setGraph({
      ...graph,
      nodes: graph.nodes.filter(n => n.id !== nodeId),
      edges: graph.edges.filter(e => e.from !== nodeId && e.to !== nodeId),
    });
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
  }, [graph, selectedNode]);

  const handleUpdateNode = useCallback((updatedNode: ScenarioNode) => {
    setGraph({
      ...graph,
      nodes: graph.nodes.map(n => n.id === updatedNode.id ? updatedNode : n),
    });
    setSelectedNode(updatedNode);
  }, [graph]);

  const handleAddEdge = useCallback((from: string, to: string) => {
    const newEdge: ScenarioEdge = {
      from,
      to,
    };
    setGraph({ ...graph, edges: [...graph.edges, newEdge] });
    setSelectedEdge(newEdge);
  }, [graph]);

  const handleDeleteEdge = useCallback((edgeIndex: number) => {
    setGraph({
      ...graph,
      edges: graph.edges.filter((_, i) => i !== edgeIndex),
    });
    setSelectedEdge(null);
  }, [graph]);

  const handleUpdateEdge = useCallback((edgeIndex: number, updatedEdge: ScenarioEdge) => {
    setGraph({
      ...graph,
      edges: graph.edges.map((e, i) => i === edgeIndex ? updatedEdge : e),
    });
    setSelectedEdge(updatedEdge);
  }, [graph]);

  const handleSave = async () => {
    // Validate first
    const issues = await validateMutation.mutateAsync();
    
    // Check for errors
    const hasErrors = issues.some(i => i.severity === 'error');
    if (hasErrors) {
      toast.error('Please fix validation errors before saving');
      return;
    }

    saveMutation.mutate(graph);
  };

  if (isLoading) {
    return <div className="p-6">Loading graph...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/admin/scenarios')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Scenario Graph Editor</h1>
            <p className="text-muted-foreground">Edit scenario graph with guards</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => validateMutation.mutate()}>
            <Eye className="h-4 w-4 mr-2" />
            Validate
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save
              </>
            )}
          </Button>
        </div>
      </div>

      {lintIssues.length > 0 && (
        <LintPanel issues={lintIssues} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Graph Canvas</CardTitle>
              <CardDescription>
                Click to add nodes, drag to connect edges
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GraphCanvas
                graph={graph}
                onAddNode={handleAddNode}
                onDeleteNode={handleDeleteNode}
                onNodeClick={setSelectedNode}
                onAddEdge={handleAddEdge}
                onEdgeClick={setSelectedEdge}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {selectedNode && (
            <NodeInspector
              node={selectedNode}
              onUpdate={handleUpdateNode}
              onDelete={() => handleDeleteNode(selectedNode.id)}
            />
          )}

          {selectedEdge && (
            <EdgeInspector
              edge={selectedEdge}
              edgeIndex={graph.edges.findIndex(e => e === selectedEdge)}
              nodes={graph.nodes}
              onUpdate={(updated) => {
                const index = graph.edges.findIndex(e => e === selectedEdge);
                handleUpdateEdge(index, updated);
              }}
              onDelete={() => {
                const index = graph.edges.findIndex(e => e === selectedEdge);
                handleDeleteEdge(index);
              }}
            />
          )}

          {!selectedNode && !selectedEdge && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground text-center">
                  Select a node or edge to edit
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Prompt Authoring Section - shown when feature flag is on */}
      {isAdminPromptFormsEnabled() && id && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Prompt Authoring (Preview)</CardTitle>
                <CardDescription>
                  Preview and analyze the prompt that will be generated for this scenario
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" disabled>
                <ExternalLink className="h-4 w-4 mr-2" />
                Graph Editor (Current Page)
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <ContextChips
                context={{
                  scenarioId: id,
                }}
                showTemplatesLink={true}
              />
            </div>
            <Alert className="mb-4">
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Partial context:</strong> Only scenario data is available. For a complete preview, provide world and ruleset IDs in the context.
              </AlertDescription>
            </Alert>
            <PromptAuthoringSection
              initialContext={{
                scenarioId: id,
                // templatesVersion can be added later when story/game pin is available
              }}
              initialExtrasOverrides={{
                scenario: (scenarioData as any)?.extras || {},
              }}
              onResult={async (result) => {
                const contextFlags = {
                  hasWorld: false,
                  hasRuleset: false,
                  hasScenario: true,
                  npcCount: 0,
                  templatesVersion: undefined, // TODO: Get from story/game if available
                };

                if (!result.data) {
                  if (result.type === 'preview') {
                    await trackAdminEvent('scenario.promptAuthoring.preview.failed', {
                      scenarioId: id,
                      ...contextFlags,
                    });
                  } else if (result.type === 'budget') {
                    await trackAdminEvent('scenario.promptAuthoring.budget.failed', {
                      scenarioId: id,
                      ...contextFlags,
                    });
                  }
                  return;
                }

                if (result.type === 'preview') {
                  await trackAdminEvent('scenario.promptAuthoring.preview.success', {
                    scenarioId: id,
                    ...contextFlags,
                  });
                } else if (result.type === 'budget') {
                  await trackAdminEvent('scenario.promptAuthoring.budget.success', {
                    scenarioId: id,
                    ...contextFlags,
                    tokensBefore: result.data?.tokens?.before,
                    tokensAfter: result.data?.tokens?.after,
                  });
                }
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

