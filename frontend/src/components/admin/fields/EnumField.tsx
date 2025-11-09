/**
 * Enum Field Component
 * Renders a select dropdown
 */

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface EnumFieldProps {
  label: string;
  value: string | number | null;
  onChange: (value: string | number) => void;
  error?: string;
  required?: boolean;
  schema: {
    enum: (string | number)[];
    description?: string;
  };
}

export function EnumField({ label, value, onChange, error, required, schema }: EnumFieldProps) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <Select
        value={value !== null ? String(value) : undefined}
        onValueChange={(v) => {
          // Try to preserve type
          const enumVal = schema.enum.find(e => String(e) === v);
          onChange(enumVal !== undefined ? enumVal : v);
        }}
      >
        <SelectTrigger className={error ? 'border-red-500' : ''}>
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          {schema.enum.map((option) => (
            <SelectItem key={String(option)} value={String(option)}>
              {String(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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

