import React from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface FormFieldProps {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'textarea' | 'select';
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  'aria-describedby'?: string;
  options?: { value: string; label: string }[];
  className?: string;
}

export function FormField({
  label,
  name,
  type = 'text',
  placeholder,
  value,
  onChange,
  onBlur,
  error,
  required = false,
  disabled = false,
  autoComplete,
  'aria-describedby': ariaDescribedby,
  options = [],
  className,
}: FormFieldProps) {
  const fieldId = `${name}-field`;
  const errorId = `${name}-error`;
  const describedBy = error ? errorId : ariaDescribedby;

  const handleChange = (newValue: string) => {
    onChange?.(newValue);
  };

  const renderInput = () => {
    const commonProps = {
      id: fieldId,
      name,
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => 
        handleChange(e.target.value),
      onBlur,
      placeholder,
      required,
      disabled,
      autoComplete,
      'aria-describedby': describedBy,
      'aria-invalid': !!error,
      className: cn(
        error && 'border-destructive focus-visible:ring-destructive',
        className
      ),
    };

    switch (type) {
      case 'textarea':
        return <Textarea {...commonProps} />;
      case 'select':
        return (
          <Select value={value} onValueChange={handleChange} disabled={disabled}>
            <SelectTrigger 
              id={fieldId}
              aria-describedby={describedBy}
              aria-invalid={!!error}
              className={cn(
                error && 'border-destructive focus-visible:ring-destructive',
                className
              )}
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      default:
        return <Input type={type} {...commonProps} />;
    }
  };

  return (
    <div className="space-y-2">
      <Label 
        htmlFor={fieldId}
        className={cn(
          'text-sm font-medium',
          error && 'text-destructive',
          disabled && 'text-muted-foreground'
        )}
      >
        {label}
        {required && <span className="text-destructive ml-1" aria-label="required">*</span>}
      </Label>
      
      {renderInput()}
      
      {error && (
        <Alert variant="destructive" role="alert" id={errorId}>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
