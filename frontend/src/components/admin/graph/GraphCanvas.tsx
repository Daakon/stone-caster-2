/**
 * Graph Canvas Component
 * Visual graph editor using React Flow
 */

import { useCallback, useMemo, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@/components/ui/button';

// Types (inline for now, can be moved to shared later)
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

interface GraphCanvasProps {
  graph: ScenarioGraph;
  onAddNode: () => void;
  onDeleteNode: (nodeId: string) => void;
  onNodeClick: (node: ScenarioNode) => void;
  onAddEdge: (from: string, to: string) => void;
  onEdgeClick: (edge: ScenarioEdge) => void;
}

export function GraphCanvas({
  graph,
  onAddNode,
  onDeleteNode,
  onNodeClick,
  onAddEdge,
  onEdgeClick,
}: GraphCanvasProps) {
  // Convert graph to React Flow format
  const initialNodes: Node[] = useMemo(() => {
    return graph.nodes.map((node, idx) => ({
      id: node.id,
      type: 'default',
      position: { x: (idx % 3) * 200, y: Math.floor(idx / 3) * 150 },
      data: {
        label: (
          <div>
            <div className="font-semibold">{node.label}</div>
            <div className="text-xs text-muted-foreground">{node.kind}</div>
          </div>
        ),
      },
      style: {
        background: node.kind === 'scene' ? '#e0f2fe' : node.kind === 'choice' ? '#fef3c7' : '#f3e8ff',
        border: '2px solid #1e40af',
        borderRadius: '8px',
        padding: '10px',
      },
    }));
  }, [graph.nodes]);

  const initialEdges: Edge[] = useMemo(() => {
    return graph.edges.map((edge, index) => ({
      id: `edge-${index}`,
      source: edge.from,
      target: edge.to,
      label: edge.label || '',
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: '#64748b' },
    }));
  }, [graph.edges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  
  // Update nodes/edges when graph changes
  useEffect(() => {
    const flowNodes: Node[] = graph.nodes.map((node, idx) => {
      const existingNode = nodes.find(n => n.id === node.id);
      return {
        id: node.id,
        type: 'default',
        position: existingNode?.position || { x: (idx % 3) * 200, y: Math.floor(idx / 3) * 150 },
        data: {
          label: (
            <div>
              <div className="font-semibold">{node.label}</div>
              <div className="text-xs text-muted-foreground">{node.kind}</div>
            </div>
          ),
        },
        style: {
          background: node.kind === 'scene' ? '#e0f2fe' : node.kind === 'choice' ? '#fef3c7' : '#f3e8ff',
          border: '2px solid #1e40af',
          borderRadius: '8px',
          padding: '10px',
        },
      };
    });
    setNodes(flowNodes);
    
    const flowEdges: Edge[] = graph.edges.map((edge, index) => ({
      id: `edge-${index}`,
      source: edge.from,
      target: edge.to,
      label: edge.label || '',
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: '#64748b' },
    }));
    setEdges(flowEdges);
  }, [graph.nodes, graph.edges, nodes, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (params.source && params.target) {
        onAddEdge(params.source, params.target);
        setEdges((eds) => addEdge(params, eds));
      }
    },
    [onAddEdge, setEdges]
  );

  const onNodeClickHandler = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const scenarioNode = graph.nodes.find((n) => n.id === node.id);
      if (scenarioNode) {
        onNodeClick(scenarioNode);
      }
    },
    [graph.nodes, onNodeClick]
  );

  const onEdgeClickHandler = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      const edgeIndex = parseInt(edge.id.replace('edge-', ''), 10);
      const scenarioEdge = graph.edges[edgeIndex];
      if (scenarioEdge) {
        onEdgeClick(scenarioEdge);
      }
    },
    [graph.edges, onEdgeClick]
  );

  return (
    <div style={{ width: '100%', height: '600px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClickHandler}
        onEdgeClick={onEdgeClickHandler}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
      <div className="mt-4">
        <Button onClick={onAddNode} size="sm">
          Add Node
        </Button>
      </div>
    </div>
  );
}

