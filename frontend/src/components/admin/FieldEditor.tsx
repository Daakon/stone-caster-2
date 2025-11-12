/**
 * Field Editor Component
 * Create/edit field definitions with JSON Schema validation
 */

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

type PackType = 'world' | 'ruleset' | 'npc' | 'scenario';

interface FieldDefinition {
  id: number;
  pack_type: PackType;
  key: string;
  label: string;
  group_label: string | null;
  schema_json: Record<string, unknown>;
  default_json: unknown | null;
  help: string | null;
  status: 'active' | 'deprecated';
}

interface FieldEditorProps {
  field: FieldDefinition | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function FieldEditor({ field, onClose, onSuccess }: FieldEditorProps) {
  const [packType, setPackType] = useState<PackType>('world');
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [groupLabel, setGroupLabel] = useState('');
  const [schemaJson, setSchemaJson] = useState('');
  const [defaultJson, setDefaultJson] = useState('');
  const [help, setHelp] = useState('');
  const [status, setStatus] = useState<'active' | 'deprecated'>('active');
  const [schemaError, setSchemaError] = useState<string | null>(null);

  useEffect(() => {
    if (field) {
      setPackType(field.pack_type);
      setKey(field.key);
      setLabel(field.label);
      setGroupLabel(field.group_label || '');
      setSchemaJson(JSON.stringify(field.schema_json, null, 2));
      setDefaultJson(field.default_json ? JSON.stringify(field.default_json, null, 2) : '');
      setHelp(field.help || '');
      setStatus(field.status);
    }
  }, [field]);

  // Validate JSON Schema on client
  const validateSchema = (jsonStr: string): boolean => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (typeof parsed !== 'object' || parsed === null) {
        setSchemaError('Schema must be a JSON object');
        return false;
      }
      if (!parsed.type && !parsed.$ref) {
        setSchemaError('Schema must have a type or $ref property');
        return false;
      }
      setSchemaError(null);
      return true;
    } catch (error) {
      setSchemaError(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  };

  const upsertMutation = useMutation({
    mutationFn: async () => {
      if (!validateSchema(schemaJson)) {
        throw new Error('Invalid schema JSON');
      }

      const parsedSchema = JSON.parse(schemaJson);
      const parsedDefault = defaultJson.trim() ? JSON.parse(defaultJson) : null;

      const res = await api.post('/api/admin/field-defs', {
        pack_type: packType,
        key,
        label,
        group_label: groupLabel || null,
        schema_json: parsedSchema,
        default_json: parsedDefault,
        help: help || null,
        status,
      });

      if (!res.ok) throw new Error(res.error || 'Failed to save field');
      return res.data;
    },
    onSuccess: () => {
      toast.success(field ? 'Field updated' : 'Field created');
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save field');
    },
  });

  const handleSubmit = () => {
    if (!key.trim() || !label.trim() || !schemaJson.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    upsertMutation.mutate();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{field ? 'Edit Field' : 'Create Field'}</DialogTitle>
          <DialogDescription>
            Define a custom field for pack extras with JSON Schema validation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Pack Type *</Label>
              <Select value={packType} onValueChange={(v) => setPackType(v as PackType)} disabled={!!field}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="world">World</SelectItem>
                  <SelectItem value="ruleset">Ruleset</SelectItem>
                  <SelectItem value="npc">NPC</SelectItem>
                  <SelectItem value="scenario">Scenario</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Key *</Label>
              <Input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="e.g., soft_taboos"
                disabled={!!field}
                className="font-mono"
              />
            </div>
          </div>

          <div>
            <Label>Label *</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Soft Taboos"
            />
          </div>

          <div>
            <Label>Group Label</Label>
            <Input
              value={groupLabel}
              onChange={(e) => setGroupLabel(e.target.value)}
              placeholder="e.g., Content Guidelines"
            />
          </div>

          <div>
            <Label>JSON Schema *</Label>
            <Textarea
              value={schemaJson}
              onChange={(e) => {
                setSchemaJson(e.target.value);
                validateSchema(e.target.value);
              }}
              onBlur={() => validateSchema(schemaJson)}
              rows={8}
              className="font-mono text-xs"
              placeholder='{"type": "string", "description": "..."}'
            />
            {schemaError && (
              <Alert className="mt-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{schemaError}</AlertDescription>
              </Alert>
            )}
          </div>

          <div>
            <Label>Default Value (JSON)</Label>
            <Textarea
              value={defaultJson}
              onChange={(e) => setDefaultJson(e.target.value)}
              rows={3}
              className="font-mono text-xs"
              placeholder='"default value" or {"key": "value"}'
            />
          </div>

          <div>
            <Label>Help Text</Label>
            <Textarea
              value={help}
              onChange={(e) => setHelp(e.target.value)}
              rows={2}
              placeholder="Help text shown to users"
            />
          </div>

          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as 'active' | 'deprecated')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="deprecated">Deprecated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={upsertMutation.isPending || !!schemaError}
          >
            {upsertMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

