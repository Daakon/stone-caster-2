/**
 * Object Field Component
 * Renders nested object fields
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StringField } from './StringField';
import { NumberField } from './NumberField';
import { BooleanField } from './BooleanField';
import { EnumField } from './EnumField';
import { ArrayField } from './ArrayField';

interface ObjectFieldProps {
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  schema: Record<string, unknown>;
  path: string;
  title?: string;
}

export function ObjectField({ value, onChange, schema, path, title }: ObjectFieldProps) {
  const properties = (schema.properties || {}) as Record<string, Record<string, unknown>>;
  const required = (schema.required || []) as string[];

  const handleFieldChange = (key: string, fieldValue: unknown) => {
    onChange({ ...value, [key]: fieldValue });
  };

  const renderField = (key: string, fieldSchema: Record<string, unknown>) => {
    const fieldValue = value[key];
    const isRequired = required.includes(key);
    const fieldPath = `${path}.${key}`;

    if (fieldSchema.type === 'string') {
      if (fieldSchema.enum) {
        return (
          <EnumField
            key={key}
            label={key}
            value={fieldValue as string | number | null}
            onChange={(v) => handleFieldChange(key, v)}
            required={isRequired}
            schema={{ enum: fieldSchema.enum as (string | number)[], description: fieldSchema.description as string }}
          />
        );
      }
      return (
        <StringField
          key={key}
          label={key}
          value={(fieldValue as string) || ''}
          onChange={(v) => handleFieldChange(key, v)}
          required={isRequired}
          schema={fieldSchema}
        />
      );
    }

    if (fieldSchema.type === 'number' || fieldSchema.type === 'integer') {
      return (
        <NumberField
          key={key}
          label={key}
          value={(fieldValue as number) || ''}
          onChange={(v) => handleFieldChange(key, v)}
          required={isRequired}
          schema={fieldSchema}
          isInteger={fieldSchema.type === 'integer'}
        />
      );
    }

    if (fieldSchema.type === 'boolean') {
      return (
        <BooleanField
          key={key}
          label={key}
          value={(fieldValue as boolean) || false}
          onChange={(v) => handleFieldChange(key, v)}
          required={isRequired}
          schema={fieldSchema}
        />
      );
    }

    if (fieldSchema.type === 'array') {
      return (
        <ArrayField
          key={key}
          label={key}
          value={(fieldValue as unknown[]) || []}
          onChange={(v) => handleFieldChange(key, v)}
          required={isRequired}
          schema={fieldSchema}
          path={fieldPath}
        />
      );
    }

    if (fieldSchema.type === 'object') {
      return (
        <div key={key} className="border rounded p-4">
          <ObjectField
            value={(fieldValue as Record<string, unknown>) || {}}
            onChange={(v) => handleFieldChange(key, v)}
            schema={fieldSchema}
            path={fieldPath}
            title={key}
          />
        </div>
      );
    }

    return (
      <div key={key} className="text-sm text-muted-foreground">
        Unsupported type: {String(fieldSchema.type)}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {title && <h4 className="font-medium">{title}</h4>}
      {Object.entries(properties).map(([key, fieldSchema]) => renderField(key, fieldSchema))}
    </div>
  );
}

