
import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';

interface DynamicControlProps {
    fieldKey: string;
    schema: any; // SchemaField definition
    value: any;
    onChange: (val: any) => void;
    hint?: any; // Form hint
}

export function DynamicControl({ fieldKey, schema, value, onChange, hint }: DynamicControlProps) {
    const label = schema.label || fieldKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const description = schema.description || '';

    // 1. Enums / Selects
    if (schema.enum) {
        return (
            <div className="space-y-2">
                <Label>{label}</Label>
                <Select value={value || ''} onValueChange={onChange}>
                    <SelectTrigger>
                        <SelectValue placeholder={`Select ${label}...`} />
                    </SelectTrigger>
                    <SelectContent>
                        {schema.enum.map((opt: string) => (
                            <SelectItem key={opt} value={opt}>
                                {opt.replace(/_/g, ' ')}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>
        );
    }

    // 2. Numbers (Sliders or Inputs)
    if (schema.type === 'number' || schema.type === 'integer') {
        // If it has a range (min/max), prefer slider
        if (schema.minimum !== undefined && schema.maximum !== undefined) {
            const min = schema.minimum;
            const max = schema.maximum;
            const val = value ?? min;

            return (
                <div className="space-y-3">
                    <div className="flex justify-between">
                        <Label>{label}</Label>
                        <span className="text-sm font-mono text-primary">{val}</span>
                    </div>
                    <Slider
                        min={min}
                        max={max}
                        step={schema.type === 'integer' ? 1 : 0.1}
                        value={[val]}
                        onValueChange={(vals) => onChange(vals[0])}
                    />
                    {description && <p className="text-xs text-muted-foreground">{description}</p>}
                </div>
            );
        }

        return (
            <div className="space-y-2">
                <Label>{label}</Label>
                <Input
                    type="number"
                    value={value ?? ''}
                    onChange={(e) => onChange(Number(e.target.value))}
                />
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>
        );
    }

    // 3. Arrays (Tag Lists)
    if (schema.type === 'array' || hint?.ui_widget === 'tag_list') {
        const currentTags: string[] = Array.isArray(value) ? value : [];
        const [inputVal, setInputVal] = React.useState('');

        const addTag = () => {
            if (inputVal.trim() && !currentTags.includes(inputVal.trim())) {
                onChange([...currentTags, inputVal.trim()]);
                setInputVal('');
            }
        };

        const removeTag = (tag: string) => {
            onChange(currentTags.filter(t => t !== tag));
        };

        return (
            <div className="space-y-2">
                <Label>{label}</Label>
                <div className="flex gap-2">
                    <Input
                        value={inputVal}
                        onChange={e => setInputVal(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                        placeholder="Add a trait..."
                        className="flex-1"
                    />
                    <Button type="button" size="icon" variant="secondary" onClick={addTag}>
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[2rem]">
                    {currentTags.map(tag => (
                        <Badge key={tag} variant="secondary" className="pr-1 gap-1">
                            {tag}
                            <button
                                type="button"
                                className="hover:text-destructive transition-colors"
                                onClick={() => removeTag(tag)}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    ))}
                    {currentTags.length === 0 && (
                        <span className="text-xs text-muted-foreground italic py-1">No tags added yet.</span>
                    )}
                </div>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>
        );
    }

    // 4. Text Areas (Long text)
    if (hint?.ui_widget === 'textarea' || (schema.maxLength && schema.maxLength > 100)) {
        return (
            <div className="space-y-2">
                <Label>{label}</Label>
                <Textarea
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className="min-h-[100px]"
                />
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>
        );
    }

    // 5. Default Text Input
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <Input
                type="text"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
            />
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
    );
}
