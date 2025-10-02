import React from 'react';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Slider } from '../ui/slider';
import { cn } from '../../lib/utils';

interface WorldFieldRendererProps {
  field: any;
  value: any;
  onChange: (value: any) => void;
  error?: string;
}

export const WorldFieldRenderer: React.FC<WorldFieldRendererProps> = ({
  field,
  value,
  onChange,
  error
}) => {
  const renderField = () => {
    switch (field.type) {
      case 'text':
        return (
          <Input
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className={cn(error && 'border-red-500')}
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            maxLength={field.maxLength}
            className={cn(error && 'border-red-500')}
          />
        );

      case 'select':
        return (
          <Select value={value || ''} onValueChange={onChange}>
            <SelectTrigger className={cn(error && 'border-red-500')}>
              <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((option: any) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    {option.image && (
                      <img
                        src={option.image}
                        alt={option.label}
                        className="w-6 h-6 rounded"
                      />
                    )}
                    <div>
                      <div className="font-medium">{option.label}</div>
                      {option.description && (
                        <div className="text-xs text-muted-foreground">
                          {option.description}
                        </div>
                      )}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'radio':
        return (
          <RadioGroup
            value={value || ''}
            onValueChange={onChange}
            className={cn(error && 'border-red-500')}
          >
            {field.options.map((option: any) => (
              <div key={option.value} className="flex items-start space-x-2">
                <RadioGroupItem value={option.value} id={option.value} />
                <Label htmlFor={option.value} className="flex-1 cursor-pointer">
                  <div className="font-medium">{option.label}</div>
                  {option.description && (
                    <div className="text-sm text-muted-foreground">
                      {option.description}
                    </div>
                  )}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case 'slider':
        return (
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span>{field.labels?.min || 'Min'}</span>
              <span className="font-medium">{value || field.default || 0}</span>
              <span>{field.labels?.max || 'Max'}</span>
            </div>
            <Slider
              value={[value || field.default || 0]}
              onValueChange={(value: number[]) => onChange(value[0])}
              min={field.min}
              max={field.max}
              step={1}
              className="w-full"
            />
          </div>
        );

      case 'chips':
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {field.options.map((option: any) => {
                const isSelected = Array.isArray(value) && value.includes(option.value);
                return (
                  <Button
                    key={option.value}
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      const currentValues = Array.isArray(value) ? value : [];
                      if (isSelected) {
                        onChange(currentValues.filter((v: any) => v !== option.value));
                      } else {
                        const newValues = [...currentValues, option.value];
                        if (field.maxSelections && newValues.length > field.maxSelections) {
                          return; // Don't add if max selections reached
                        }
                        onChange(newValues);
                      }
                    }}
                    disabled={!isSelected && field.maxSelections && Array.isArray(value) && value.length >= field.maxSelections}
                    className="h-auto p-2 flex flex-col items-start text-left"
                  >
                    <div className="font-medium">{option.label}</div>
                    {option.description && (
                      <div className="text-xs text-muted-foreground">
                        {option.description}
                      </div>
                    )}
                  </Button>
                );
              })}
            </div>
            {field.minSelections && (
              <p className="text-xs text-muted-foreground">
                Select at least {field.minSelections} option{field.minSelections > 1 ? 's' : ''}
              </p>
            )}
            {field.maxSelections && (
              <p className="text-xs text-muted-foreground">
                Select up to {field.maxSelections} option{field.maxSelections > 1 ? 's' : ''}
              </p>
            )}
          </div>
        );

      default:
        return (
          <div className="text-muted-foreground">
            Unknown field type: {field.type}
          </div>
        );
    }
  };

  return (
    <div className="space-y-2">
      {renderField()}
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
};
