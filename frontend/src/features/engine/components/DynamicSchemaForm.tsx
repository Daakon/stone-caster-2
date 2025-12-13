import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Info } from 'lucide-react';
import { useWatch, type Control, Controller } from 'react-hook-form';
// Removing unused Form imports for now to clear linter. 
// If we decide to use FormField later, we can re-add.

export interface SchemaField {
    type?: string;
    control?: string;
    label?: string;
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
    groups?: { label: string; options: string[] }[];
    depends_on?: { field: string; value: any };
    hint?: string;
    description?: string;
    long?: boolean; // for textarea
}

interface DynamicSchemaFormProps {
    schema: any;
    control: Control<any>;
    readOnly?: boolean;
    className?: string;
}

export function DynamicSchemaForm({ schema, control, readOnly = false, className }: DynamicSchemaFormProps) {

    // Watch all values for dependency checking
    // Note: watching everything might be expensive on huge forms, but necessary for dynamic dependencies without strict graph
    const formValues = useWatch({ control });

    // --- Render Logic ---

    // Note: We use Controller directly or Shadcn FormField. 
    // Since Shadcn FormField creates FormItem/FormLabel, well use that pattern where appropriate.

    const renderFieldInput = (schemaDef: SchemaField, field: any) => {
        const { value, onChange } = field;
        const controlType = schemaDef.control;
        const type = schemaDef.type || 'string';
        const isReadOnly = readOnly;

        if (controlType === 'slider') {
            const min = schemaDef.min ?? 0;
            const max = schemaDef.max ?? 100;
            const step = schemaDef.step || 1;
            const val = Number(value ?? min);

            return (
                <div className="flex items-center gap-4 animate-in fade-in slide-in-from-top-1 duration-300">
                    <Slider
                        disabled={isReadOnly}
                        min={min}
                        max={max}
                        step={step}
                        value={[val]}
                        onValueChange={(vals) => onChange(vals[0])}
                        className="flex-1"
                    />
                    <span className="w-12 text-sm text-right text-stone-400 font-mono">
                        {val}
                    </span>
                </div>
            );
        }

        if (controlType === 'tag_list') {
            return (
                <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                    <ArrayField
                        value={value}
                        onChange={onChange}
                        disabled={isReadOnly}
                    />
                </div>
            );
        }

        if (controlType === 'dropdown') {
            const hasGroups = schemaDef.groups && schemaDef.groups.length > 0;
            const hasOptions = schemaDef.options && schemaDef.options.length > 0;

            if (!hasGroups && !hasOptions) return null;

            return (
                <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                    <Select
                        disabled={isReadOnly}
                        value={value || ''}
                        onValueChange={onChange}
                    >
                        <SelectTrigger className="bg-stone-900 border-stone-800">
                            <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                            {hasGroups ? (
                                schemaDef.groups!.map((group) => (
                                    <SelectGroup key={group.label}>
                                        <SelectLabel>{group.label}</SelectLabel>
                                        {group.options.map((opt) => (
                                            <SelectItem key={opt} value={opt}>
                                                {opt}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                ))
                            ) : (
                                schemaDef.options!.map((opt: any) => (
                                    <SelectItem key={opt} value={opt}>
                                        {opt}
                                    </SelectItem>
                                ))
                            )}
                        </SelectContent>
                    </Select>
                </div>
            );
        }

        if (controlType === 'complex_list' || type === 'object') {
            return (
                <div className="p-4 rounded border border-dashed border-stone-800 bg-stone-900/50 animate-in fade-in slide-in-from-top-1 duration-300">
                    <p className="text-xs text-stone-500 mb-2 font-mono">Complex Type (Object)</p>
                    <Textarea
                        disabled={isReadOnly}
                        value={typeof value === 'object' ? JSON.stringify(value, null, 2) : (value || '')}
                        onChange={(e) => {
                            try {
                                const parsed = JSON.parse(e.target.value);
                                onChange(parsed);
                            } catch (err) {
                                // Ignore
                            }
                        }}
                        className="bg-black font-mono text-xs border-stone-800 min-h-[100px]"
                        placeholder="{ ... }"
                    />
                </div>
            );
        }

        // --- Fallbacks ---

        switch (type) {
            case 'number':
                if (schemaDef.min !== undefined && schemaDef.max !== undefined) {
                    const min = schemaDef.min ?? 0;
                    const max = schemaDef.max ?? 100;
                    const val = Number(value ?? min);
                    return (
                        <div className="flex items-center gap-4 animate-in fade-in slide-in-from-top-1 duration-300">
                            <Slider
                                disabled={isReadOnly}
                                min={min}
                                max={max}
                                step={schemaDef.step || 1}
                                value={[val]}
                                onValueChange={(vals) => onChange(vals[0])}
                                className="flex-1"
                            />
                            <span className="w-12 text-sm text-right text-stone-400 font-mono">
                                {val}
                            </span>
                        </div>
                    );
                }
                return (
                    <Input
                        type="number"
                        disabled={isReadOnly}
                        value={value ?? ''}
                        onChange={(e) => onChange(Number(e.target.value))}
                        className="bg-stone-900 border-stone-800 animate-in fade-in slide-in-from-top-1 duration-300"
                    />
                );

            case 'string':
                if (schemaDef.options && Array.isArray(schemaDef.options)) {
                    return (
                        <Select
                            disabled={isReadOnly}
                            value={value || ''}
                            onValueChange={onChange}
                        >
                            <SelectTrigger className="bg-stone-900 border-stone-800 animate-in fade-in slide-in-from-top-1 duration-300">
                                <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                                {schemaDef.options.map((opt: any) => (
                                    <SelectItem key={opt} value={opt}>
                                        {opt}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    );
                }
                if (schemaDef.long) {
                    return (
                        <Textarea
                            disabled={isReadOnly}
                            value={value || ''}
                            onChange={(e) => onChange(e.target.value)}
                            className="bg-stone-900 border-stone-800 min-h-[80px] animate-in fade-in slide-in-from-top-1 duration-300"
                        />
                    );
                }
                return (
                    <Input
                        type="text"
                        disabled={isReadOnly}
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value)}
                        className="bg-stone-900 border-stone-800 animate-in fade-in slide-in-from-top-1 duration-300"
                    />
                );

            case 'array':
                return (
                    <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                        <ArrayField
                            value={value}
                            onChange={onChange}
                            disabled={isReadOnly}
                        />
                    </div>
                );

            default:
                return (
                    <Input
                        disabled={isReadOnly}
                        value={value ?? ''}
                        onChange={(e) => onChange(e.target.value)}
                        className="bg-stone-900 border-stone-800 animate-in fade-in slide-in-from-top-1 duration-300"
                    />
                );
        }
    };

    const isTechnicalKey = (key: string) => {
        return key.startsWith('tier1_') || key.startsWith('tier2_') || key.startsWith('tier3_');
    };

    const isMetadataKey = (key: string) => {
        return key === 'definitions' || key === 'metadata' || key === 'version';
    };

    const renderNodeOrSection = (key: string, schemaNode: any, path: string[], level: number = 0): React.ReactNode => {
        const currentPath = [...path, key];
        const fieldName = currentPath.join('.'); // Dot notation for RHF

        // LOGIC: IGNORE METADATA
        if (isMetadataKey(key)) return null;

        // CASE 0: Handle "form_hints" Wrapper
        if (schemaNode && typeof schemaNode === 'object' && schemaNode.form_hints) {
            return (
                <React.Fragment key={key}>
                    {Object.entries(schemaNode.form_hints).map(([childKey, childDef]) =>
                        renderNodeOrSection(childKey, childDef, currentPath, level)
                    )}
                </React.Fragment>
            );
        }
        if (key === 'form_hints') {
            return (
                <React.Fragment key={key}>
                    {Object.entries(schemaNode).map(([childKey, childDef]) =>
                        renderNodeOrSection(childKey, childDef, path, level)
                    )}
                </React.Fragment>
            );
        }

        // CASE 1: It's a Field
        if (schemaNode.type || schemaNode.control) {

            // Check Dependency Visibility using WATCHED values
            if (schemaNode.depends_on) {
                const depField = schemaNode.depends_on.field;
                const requiredVal = schemaNode.depends_on.value;

                // Access watched values. Need to handle nesting if depField is relative or absolute?
                // Usually depends_on.field is a key in the data structure.
                // We assume data structure is flat-ish or we access by path.
                // simple access: formValues[depField]
                // deep access: resolvePath(formValues, depField)

                // Basic lookup:
                const currentDepValue = formValues ? formValues[depField] : undefined;

                if (currentDepValue !== requiredVal) {
                    return null;
                }
            }

            // Determine Column Span (12-col system)
            // Short: 6 cols (half width)
            // Long: 12 cols (full width)
            const isLong = schemaNode.long || schemaNode.type === 'array' || schemaNode.control === 'complex_list' || schemaNode.control === 'tag_list' || schemaNode.control === 'textarea';

            // Mobile: col-span-12 (full stack)
            // Desktop: md:col-span-6 or md:col-span-12
            const colSpan = isLong ? 'col-span-12' : 'col-span-12 md:col-span-6';

            return (
                <div key={fieldName} className={cn(colSpan)}>
                    <Controller
                        control={control}
                        name={fieldName}
                        render={({ field }) => (
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <Label className="capitalize font-semibold text-stone-300">
                                        {schemaNode.label || key.replace(/_/g, ' ')}
                                    </Label>
                                    {schemaNode.description && (
                                        <div title={schemaNode.description} className="cursor-help text-stone-500 hover:text-stone-300">
                                            <Info className="w-3 h-3" />
                                        </div>
                                    )}
                                </div>
                                {renderFieldInput(schemaNode, field)}
                                {schemaNode.hint && <p className="text-[10px] text-stone-500 uppercase tracking-wide">{schemaNode.hint}</p>}
                            </div>
                        )}
                    />
                </div>
            );
        }

        // CASE 2: It's a Container (Object)
        if (typeof schemaNode === 'object' && schemaNode !== null) {

            // Flatten technical keys
            if (isTechnicalKey(key)) {
                return (
                    <React.Fragment key={key}>
                        {Object.entries(schemaNode).map(([childKey, childDef]) =>
                            renderNodeOrSection(childKey, childDef, currentPath, level)
                        )}
                    </React.Fragment>
                );
            }

            const entries = Object.entries(schemaNode);
            const childFields = entries.filter(([_, val]: any) => val.type || val.control);
            const childContainers = entries.filter(([k, val]: any) => !val.type && !val.control && typeof val === 'object' && !isMetadataKey(k));

            if (childFields.length === 0 && childContainers.length === 0) return null;

            return (
                <Card key={fieldName} className="w-full bg-stone-950/20 border-stone-800 mb-6">
                    <CardHeader className="pb-3 border-b border-stone-800/50">
                        <CardTitle className="text-sm font-bold uppercase tracking-widest text-stone-400 flex items-center gap-2">
                            {key.replace(/_/g, ' ')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 grid grid-cols-12 gap-6">
                        {/* Render Fields in Grid */}
                        {childFields.map(([fKey, fDef]) =>
                            renderNodeOrSection(fKey, fDef, currentPath, level + 1)
                        )}

                        {childContainers.length > 0 && (
                            <div className="col-span-12 space-y-6 mt-2">
                                {childContainers.map(([cKey, cDef]) =>
                                    renderNodeOrSection(cKey, cDef, currentPath, level + 1)
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            );
        }

        return null;
    };


    // --- Top Level Logic ---
    const schemaEntries = Object.entries(schema);
    const topLevelFields = schemaEntries.filter(([_, v]: any) => v?.type || v?.control);
    const topLevelContainers = schemaEntries.filter(([k, v]: any) => !v?.type && !v?.control && typeof v === 'object' && !isMetadataKey(k));

    return (
        <div className={cn("w-full space-y-6", className)}>

            {/* General Section */}
            {topLevelFields.length > 0 && (
                <Card className="w-full bg-stone-950/20 border-stone-800">
                    <CardHeader className="pb-3 border-b border-stone-800/50">
                        <CardTitle className="text-sm font-bold uppercase tracking-widest text-stone-400">General Properties</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 grid grid-cols-12 gap-6">
                        {topLevelFields.map(([key, def]) =>
                            renderNodeOrSection(key, def, [], 0)
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Sections */}
            {topLevelContainers.map(([key, def]) =>
                renderNodeOrSection(key, def, [], 0)
            )}

            {schemaEntries.length === 0 && (
                <div className="text-stone-500 italic text-sm p-4 text-center border border-dashed border-stone-800 rounded-lg">
                    No dynamic schema configured.
                </div>
            )}
        </div>
    );
}

// --- Array Field Sub-Component ---

function ArrayField({ value, onChange, disabled }: { value: any, onChange: (val: string[]) => void, disabled?: boolean }) {
    const [localValue, setLocalValue] = React.useState<string>('');
    const [touched, setTouched] = React.useState(false);

    React.useEffect(() => {
        if (!touched) {
            if (Array.isArray(value)) {
                setLocalValue(value.join(', '));
            } else if (value) {
                setLocalValue(String(value));
            } else {
                setLocalValue('');
            }
        }
    }, [value, touched]);

    const handleBlur = () => {
        setTouched(false);
        const arr = localValue.split(',').map(s => s.trim()).filter(Boolean);
        const currentArr = Array.isArray(value) ? value : [];
        if (JSON.stringify(arr) !== JSON.stringify(currentArr)) {
            onChange(arr);
        }
    };

    return (
        <div className="space-y-2">
            <Input
                disabled={disabled}
                placeholder="e.g. Tag 1, Tag 2"
                value={localValue}
                onChange={(e) => { setTouched(true); setLocalValue(e.target.value); }}
                onBlur={handleBlur}
                className="bg-stone-900 border-stone-800 focus-visible:ring-stone-700"
            />
            <div className="flex flex-wrap gap-2">
                {Array.isArray(value) && value.map((v: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-xs border-stone-700 text-stone-400 bg-stone-950">
                        {v}
                    </Badge>
                ))}
            </div>
        </div>
    );
}
