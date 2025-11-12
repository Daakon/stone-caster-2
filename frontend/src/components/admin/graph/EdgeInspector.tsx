/**
 * Edge Inspector Component
 * Edit edge properties including guard
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, AlertTriangle } from 'lucide-react';
import Ajv from 'ajv';
import { GuardSchema } from '@shared/validators/guard-dsl.schema';

interface ScenarioEdge {
  from: string;
  to: string;
  guard?: any;
  label?: string;
  metadata?: Record<string, unknown>;
}

interface EdgeInspectorProps {
  edge: ScenarioEdge;
  edgeIndex: number;
  nodes: Array<{ id: string; label: string }>;
  onUpdate: (edge: ScenarioEdge) => void;
  onDelete: () => void;
}

const ajv = new Ajv({ allErrors: true });

export function EdgeInspector({ edge, edgeIndex, nodes, onUpdate, onDelete }: EdgeInspectorProps) {
  const [from, setFrom] = useState(edge.from);
  const [to, setTo] = useState(edge.to);
  const [label, setLabel] = useState(edge.label || '');
  const [guardJson, setGuardJson] = useState(JSON.stringify(edge.guard || null, null, 2));
  const [guardError, setGuardError] = useState<string | null>(null);

  useEffect(() => {
    setFrom(edge.from);
    setTo(edge.to);
    setLabel(edge.label || '');
    setGuardJson(JSON.stringify(edge.guard || null, null, 2));
    setGuardError(null);
  }, [edge]);

  const validateGuard = (jsonStr: string): boolean => {
    try {
      const parsed = jsonStr.trim() ? JSON.parse(jsonStr) : null;
      if (parsed === null) {
        setGuardError(null);
        return true;
      }
      // Note: GuardSchema would need to be imported from shared
      // For now, basic JSON validation
      setGuardError(null);
      return true;
    } catch (error) {
      setGuardError(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  };

  const handleSave = () => {
    if (!validateGuard(guardJson)) {
      return;
    }

    const guard = guardJson.trim() ? JSON.parse(guardJson) : undefined;
    onUpdate({
      from,
      to,
      label: label || undefined,
      guard,
      metadata: edge.metadata,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edge Properties</CardTitle>
        <CardDescription>Edit edge {edgeIndex + 1}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>From</Label>
          <Select value={from} onValueChange={setFrom}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {nodes.map((node) => (
                <SelectItem key={node.id} value={node.id}>
                  {node.label} ({node.id})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>To</Label>
          <Select value={to} onValueChange={setTo}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {nodes.map((node) => (
                <SelectItem key={node.id} value={node.id}>
                  {node.label} ({node.id})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Label (optional)</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Edge label"
          />
        </div>
        <div>
          <Label>Guard (JSON)</Label>
          <Textarea
            value={guardJson}
            onChange={(e) => {
              setGuardJson(e.target.value);
              validateGuard(e.target.value);
            }}
            rows={8}
            className="font-mono text-xs"
            placeholder='{"gte": ["rel.npc.kiera.trust", 8]}'
          />
          {guardError && (
            <Alert variant="destructive" className="mt-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{guardError}</AlertDescription>
            </Alert>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} size="sm" className="flex-1">
            Save
          </Button>
          <Button variant="destructive" onClick={onDelete} size="sm">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

