/**
 * Node Inspector Component
 * Edit node properties
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2 } from 'lucide-react';

interface ScenarioNode {
  id: string;
  label: string;
  kind: 'scene' | 'choice' | 'event' | 'end';
  metadata?: Record<string, unknown>;
}

interface NodeInspectorProps {
  node: ScenarioNode;
  onUpdate: (node: ScenarioNode) => void;
  onDelete: () => void;
}

export function NodeInspector({ node, onUpdate, onDelete }: NodeInspectorProps) {
  const [id, setId] = useState(node.id);
  const [label, setLabel] = useState(node.label);
  const [kind, setKind] = useState(node.kind);

  useEffect(() => {
    setId(node.id);
    setLabel(node.label);
    setKind(node.kind);
  }, [node]);

  const handleSave = () => {
    onUpdate({
      id,
      label,
      kind,
      metadata: node.metadata,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Node Properties</CardTitle>
        <CardDescription>Edit node details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>ID</Label>
          <Input
            value={id}
            onChange={(e) => setId(e.target.value)}
            className="font-mono"
          />
        </div>
        <div>
          <Label>Label</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div>
          <Label>Kind</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="scene">Scene</SelectItem>
              <SelectItem value="choice">Choice</SelectItem>
              <SelectItem value="event">Event</SelectItem>
              <SelectItem value="end">End</SelectItem>
            </SelectContent>
          </Select>
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

