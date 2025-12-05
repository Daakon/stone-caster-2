/**
 * Number Field Component
 * Renders a number input with validation
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface NumberFieldProps {
  label: string;
  value: number | '';
  onChange: (value: number | '') => void;
  error?: string;
  required?: boolean;
  schema: {
    minimum?: number;
    maximum?: number;
    multipleOf?: number;
    examples?: number[];
    description?: string;
  };
  isInteger?: boolean;
}

export function NumberField({ label, value, onChange, error, required, schema, isInteger }: NumberFieldProps) {
  const placeholder = schema.examples?.[0]?.toString() || '';
  const helpText = schema.description || 
    (schema.minimum !== undefined && schema.maximum !== undefined 
      ? `${schema.minimum} to ${schema.maximum}` :
     schema.minimum !== undefined ? `Min ${schema.minimum}` :
     schema.maximum !== undefined ? `Max ${schema.maximum}` : '');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      onChange('');
    } else {
      const num = isInteger ? parseInt(val, 10) : parseFloat(val);
      if (!isNaN(num)) {
        onChange(num);
      }
    }
  };

  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <Input
        type="number"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        step={isInteger ? 1 : schema.multipleOf || 'any'}
        className={error ? 'border-red-500' : ''}
      />
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

