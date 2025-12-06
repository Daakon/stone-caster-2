/**
 * Array Field Component
 * Renders array inputs (tags for strings, nested for objects)
 */

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, X, Plus } from 'lucide-react';
import { ObjectField } from './ObjectField';

interface ArrayFieldProps {
  label: string;
  value: unknown[];
  onChange: (value: unknown[]) => void;
  error?: string;
  required?: boolean;
  schema: {
    items?: Record<string, unknown>;
    minItems?: number;
    maxItems?: number;
    description?: string;
  };
  path: string;
}

export function ArrayField({ label, value, onChange, error, required, schema, path }: ArrayFieldProps) {
  const [newItem, setNewItem] = useState('');

  const isStringArray = schema.items?.type === 'string';
  const isObjectArray = schema.items?.type === 'object';

  const handleAddString = () => {
    if (newItem.trim()) {
      onChange([...value, newItem.trim()]);
      setNewItem('');
    }
  };

  const handleRemoveString = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleAddObject = () => {
    onChange([...value, {}]);
  };

  const handleRemoveObject = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleObjectChange = (index: number, obj: Record<string, unknown>) => {
    const newValue = [...value];
    newValue[index] = obj;
    onChange(newValue);
  };

  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>

      {isStringArray ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddString();
                }
              }}
              placeholder="Add item..."
            />
            <Button type="button" onClick={handleAddString} size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {value.map((item, index) => (
              <Badge key={index} variant="secondary" className="flex items-center gap-1">
                {String(item)}
                <button
                  type="button"
                  onClick={() => handleRemoveString(index)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      ) : isObjectArray ? (
        <div className="space-y-4 border rounded p-4">
          {value.map((item, index) => (
            <div key={index} className="border-b pb-4 last:border-b-0 last:pb-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Item {index + 1}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemoveObject(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <ObjectField
                value={item as Record<string, unknown>}
                onChange={(obj) => handleObjectChange(index, obj)}
                schema={schema.items as Record<string, unknown>}
                path={`${path}[${index}]`}
              />
            </div>
          ))}
          <Button type="button" variant="outline" onClick={handleAddObject} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">
          Array type not fully supported (items: {JSON.stringify(schema.items)})
        </div>
      )}

      {schema.description && !error && (
        <p className="text-sm text-muted-foreground">{schema.description}</p>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

