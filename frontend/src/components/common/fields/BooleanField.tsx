/**
 * Boolean Field Component
 * Renders a switch/toggle
 */

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface BooleanFieldProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  error?: string;
  required?: boolean;
  schema: {
    description?: string;
  };
}

export function BooleanField({ label, value, onChange, error, required, schema }: BooleanFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <Switch
          id={label}
          checked={value}
          onCheckedChange={onChange}
        />
        <Label htmlFor={label} className="cursor-pointer">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      </div>
      {schema.description && !error && (
        <p className="text-sm text-muted-foreground ml-8">{schema.description}</p>
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

