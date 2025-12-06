/**
 * String Field Component
 * Renders a string input with validation
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface StringFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  schema: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    format?: string;
    examples?: string[];
    description?: string;
  };
}

export function StringField({ label, value, onChange, error, required, schema }: StringFieldProps) {
  const isMultiline = schema.format === 'textarea' || (schema.maxLength && schema.maxLength > 200);
  const placeholder = schema.examples?.[0] || '';
  const helpText = schema.description || 
    (schema.minLength && schema.maxLength ? `${schema.minLength}-${schema.maxLength} characters` : 
     schema.maxLength ? `Max ${schema.maxLength} characters` : '');

  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {isMultiline ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className={error ? 'border-red-500' : ''}
        />
      ) : (
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={error ? 'border-red-500' : ''}
        />
      )}
      {helpText && !error && (
        <p className="text-sm text-muted-foreground">{helpText}</p>
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

