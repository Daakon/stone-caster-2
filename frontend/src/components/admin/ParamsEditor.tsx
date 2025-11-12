/**
 * Params Editor Component
 * Generic form renderer for module params (Zod-based)
 */

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { ObjectField } from './fields/ObjectField';

interface ParamsEditorProps {
  schema?: string; // e.g., "zod:RelationshipsParams"
  defaults: Record<string, unknown>;
  presets?: Array<{
    id: string;
    label: string;
    overrides: Record<string, unknown>;
  }>;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  errors?: Record<string, string>;
}

export function ParamsEditor({
  schema,
  defaults,
  presets = [],
  value,
  onChange,
  errors = {},
}: ParamsEditorProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  // Apply preset
  useEffect(() => {
    if (selectedPreset && presets.length > 0) {
      const preset = presets.find(p => p.id === selectedPreset);
      if (preset) {
        // Merge defaults with preset overrides
        const merged = {
          ...defaults,
          ...preset.overrides,
        };
        onChange(merged);
      }
    }
  }, [selectedPreset, presets, defaults, onChange]);

  const handleReset = () => {
    onChange({ ...defaults });
    setSelectedPreset('');
  };

  // Build a simple schema object from defaults structure
  const schemaObj = useMemo(() => {
    const buildSchema = (obj: Record<string, unknown>): Record<string, unknown> => {
      const properties: Record<string, unknown> = {};
      
      for (const [key, val] of Object.entries(obj)) {
        if (val === null || val === undefined) {
          properties[key] = { type: 'string' };
        } else if (typeof val === 'boolean') {
          properties[key] = { type: 'boolean' };
        } else if (typeof val === 'number') {
          properties[key] = { type: 'number' };
        } else if (typeof val === 'string') {
          properties[key] = { type: 'string' };
        } else if (Array.isArray(val)) {
          properties[key] = { type: 'array', items: { type: 'string' } };
        } else if (typeof val === 'object') {
          properties[key] = {
            type: 'object',
            properties: buildSchema(val as Record<string, unknown>),
          };
        }
      }
      
      return { type: 'object', properties };
    };

    return buildSchema(defaults);
  }, [defaults]);

  return (
    <div className="space-y-4">
      {presets.length > 0 && (
        <div className="flex items-center gap-4">
          <Label>Preset</Label>
          <Select value={selectedPreset} onValueChange={setSelectedPreset}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select preset..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None (custom)</SelectItem>
              {presets.map(preset => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to defaults
          </Button>
        </div>
      )}

      {Object.keys(errors).length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-semibold mb-2">Validation Errors</div>
            <ul className="list-disc list-inside space-y-1">
              {Object.entries(errors).map(([key, msg]) => (
                <li key={key}>{key}: {msg}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <ObjectField
        value={value}
        onChange={onChange}
        schema={schemaObj as Record<string, unknown>}
        path=""
        title=""
      />
    </div>
  );
}

