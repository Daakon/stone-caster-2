import React, { useEffect } from 'react';
import { useFormContext, useWatch, Controller } from 'react-hook-form';
import type { FormHint } from '@/types/chimera-form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

interface DynamicSchemaFieldProps {
    name: string;
    hint: FormHint;
}

export function DynamicSchemaField({ name, hint }: DynamicSchemaFieldProps) {
    const { control } = useFormContext();

    // Watch usage for dependency logic
    const dependencyValue = useWatch({
        control,
        name: hint.depends_on?.field || '',
    });

    // Check visibility
    const isVisible = (() => {
        if (!hint.depends_on) return true;
        // Simple equality check for now. Can be expanded for arrays/regex later.
        return dependencyValue === hint.depends_on.value;
    })();

    // Effect: reset value when hidden? 
    // Usually desirable to clear data if it's hidden, but maybe not for stepping back/forth.
    // Let's leave data intact for now unless explicitly requested.

    if (!isVisible) return null;

    const label = hint.label || name;

    const renderControl = () => {
        const placeholder = hint.placeholder || `Enter ${hint.label || name}`;

        // Control: Dropdown / Select
        // Cast hint to any to access potentially unmapped properties like 'enum' if schemaSplitter puts them there
        const anyHint = hint as any;
        if (hint.control === 'dropdown' || (hint.options && hint.options.length > 0) || anyHint.enum) {
            const options = hint.options || anyHint.enum || [];
            return (
                <Controller
                    name={name}
                    control={control}
                    defaultValue={hint.default || ''}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                            <SelectTrigger>
                                <SelectValue placeholder={placeholder} />
                            </SelectTrigger>
                            <SelectContent>
                                {hint.groups ? (
                                    hint.groups.map(group => (
                                        <SelectGroup key={group.label}>
                                            <SelectLabel>{group.label}</SelectLabel>
                                            {group.options.map((opt: string) => (
                                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                            ))}
                                        </SelectGroup>
                                    ))
                                ) : (
                                    options.map((opt: string) => (
                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    )}
                />
            );
        }

        // Control: Slider
        if (hint.control === 'slider' || (hint.min !== undefined && hint.max !== undefined)) {
            const min = hint.min ?? 0;
            const max = hint.max ?? 100;
            const step = (hint as any).step ?? 1;

            return (
                <Controller
                    name={name}
                    control={control}
                    defaultValue={hint.default ?? min}
                    render={({ field }) => (
                        <div className="flex items-center gap-4">
                            <Slider
                                min={min}
                                max={max}
                                step={step}
                                value={[Number(field.value ?? min)]}
                                onValueChange={(vals) => field.onChange(vals[0])}
                                className="flex-1"
                            />
                            <span className="w-12 text-right font-mono text-sm">
                                {field.value ?? min}
                            </span>
                        </div>
                    )}
                />
            );
        }

        // Default: Text Input
        return (
            <Input
                id={name}
                placeholder={placeholder}
                {...control.register(name)}
            />
        );
    };

    return (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <Label htmlFor={name}>{label}</Label>
            {renderControl()}
            {hint.description && <p className="text-xs text-muted-foreground">{hint.description}</p>}
        </div>
    );
}
