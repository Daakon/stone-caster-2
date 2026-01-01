import React from 'react';
import { Controller } from 'react-hook-form';
import type { Control } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { StepField } from '@/hooks/chimera/useEntitySchema';

interface DynamicSchemaFieldProps {
    field: StepField;
    control: Control<any>;
}

export function DynamicSchemaField({ field, control }: DynamicSchemaFieldProps) {
    const name = field.key;

    // Normalize control type
    const controlType = field.control?.toLowerCase();

    // Helper to render the specific control
    const renderControl = () => {
        // SLIDER
        if (controlType === 'slider') {
            return (
                <Controller
                    name={name}
                    control={control}
                    defaultValue={field.default ?? field.min ?? 0}
                    render={({ field: { value, onChange } }) => (
                        <div className="flex items-center gap-4">
                            <Slider
                                min={field.min ?? 0}
                                max={field.max ?? 100}
                                step={1}
                                value={[Number(value) || 0]}
                                onValueChange={(vals) => onChange(vals[0])}
                                className="flex-1"
                            />
                            <Badge variant="secondary" className="w-12 justify-center font-mono text-center">
                                {Number(value) || 0}
                            </Badge>
                        </div>
                    )}
                />
            );
        }

        // TEXTAREA
        if (controlType === 'textarea' || controlType === 'text_area') {
            return (
                <Controller
                    name={name}
                    control={control}
                    defaultValue={field.default ?? ''}
                    render={({ field: { value, onChange, onBlur } }) => (
                        <Textarea
                            value={value}
                            onChange={onChange}
                            onBlur={onBlur}
                            placeholder={field.loading_placeholder}
                            className="min-h-[120px] resize-y"
                        />
                    )}
                />
            );
        }

        // SELECT / DROPDOWN
        if (controlType === 'select' || controlType === 'dropdown') {
            return (
                <Controller
                    name={name}
                    control={control}
                    defaultValue={field.default ?? ''}
                    render={({ field: { value, onChange } }) => (
                        <Select onValueChange={onChange} value={value}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                                {(field.options || []).map((opt) => (
                                    <SelectItem key={opt} value={opt}>
                                        {opt}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
            );
        }

        // TAG LIST
        if (controlType === 'tag_list') {
            return (
                <Controller
                    name={name}
                    control={control}
                    defaultValue={field.default ?? ''}
                    render={({ field: { value, onChange, onBlur } }) => (
                        <div className="relative">
                            <Input
                                value={value}
                                onChange={onChange}
                                onBlur={onBlur}
                                placeholder={field.loading_placeholder || 'Tag 1, Tag 2, Tag 3...'}
                            />
                            <span className="text-[10px] text-muted-foreground absolute right-3 top-3 bg-background px-1">
                                Comma separated
                            </span>
                        </div>
                    )}
                />
            );
        }

        // DEFAULT: INPUT (Text/Number)
        return (
            <Controller
                name={name}
                control={control}
                defaultValue={field.default ?? ''}
                render={({ field: { value, onChange, onBlur } }) => (
                    <Input
                        value={value}
                        onChange={onChange}
                        onBlur={onBlur}
                        type={field.control === 'number' ? 'number' : 'text'}
                        placeholder={field.loading_placeholder}
                    />
                )}
            />
        );
    };

    return (
        <div className="space-y-2">
            <Label htmlFor={name} className="flex items-center justify-between">
                {field.label}
                {field.min !== undefined && field.max !== undefined && controlType !== 'slider' && (
                    <span className="text-xs text-muted-foreground">
                        ({field.min} - {field.max})
                    </span>
                )}
            </Label>

            {renderControl()}

            {field.description && (
                <p className="text-[0.8rem] text-muted-foreground">
                    {field.description}
                </p>
            )}
        </div>
    );
}
