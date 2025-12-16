
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRulesetSchema } from '@/features/engine/hooks/useRulesetSchema';
import { DynamicSchemaForm } from '@/features/engine/components/DynamicSchemaForm';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface EntityDetailsFormProps {
    worldId: string;
    data: Record<string, any>;
    onChange: (newData: any) => void;
    entityType: string;
    archetype?: string;
    onArchetypeChange: (val: string) => void;
}

export function EntityDetailsForm({ worldId, data, onChange, entityType, archetype, onArchetypeChange }: EntityDetailsFormProps) {
    const [manualKeys, setManualKeys] = React.useState<string[]>([]);
    const [selectedOptional, setSelectedOptional] = React.useState<string>('');
    const { schema, availableOptionalRulesets, isLoading, error } = useRulesetSchema({ worldId, targetType: entityType, manualKeys });

    // Initialize RHF
    const form = useForm({
        defaultValues: data,
        values: data, // Keep in sync if parent updates
        mode: 'onChange'
    });

    // Sync RHF changes back to parent via onChange
    React.useEffect(() => {
        const subscription = form.watch((value) => {
            onChange(value);
        });
        return () => subscription.unsubscribe();
    }, [form.watch, onChange]);


    // Auto-Discovery: Check if raw_data has keys that belong to an optional ruleset
    React.useEffect(() => {
        if (availableOptionalRulesets.length === 0) return;

        const discoveredKeys = new Set(manualKeys);
        let hasNewDiscovery = false;

        for (const ruleset of availableOptionalRulesets) {
            if (discoveredKeys.has(ruleset.id)) continue;

            const contributions = (ruleset as any).state_contributions || {};
            const tier1 = contributions.tier1_entity;

            // Helper to check data existence
            const checkData = (keys: string[]) => keys.some(key => data && data[key] !== undefined);

            if (tier1 && tier1.form_hints) {
                if (checkData(Object.keys(tier1.form_hints))) {
                    discoveredKeys.add(ruleset.id);
                    hasNewDiscovery = true;
                }
            } else if (ruleset.state_contributions) {
                if (checkData(Object.keys(ruleset.state_contributions))) {
                    discoveredKeys.add(ruleset.id);
                    hasNewDiscovery = true;
                }
            }
        }

        if (hasNewDiscovery) {
            console.log('[SchemaEngine] Auto-Discovered Optional Rulesets:', Array.from(discoveredKeys));
            setManualKeys(Array.from(discoveredKeys));
        }
    }, [availableOptionalRulesets, data]);


    const handleAddOptional = () => {
        if (!selectedOptional) return;
        if (!manualKeys.includes(selectedOptional)) {
            setManualKeys(prev => [...prev, selectedOptional]);
            setSelectedOptional('');
        }
    };

    return (
        <Card className="bg-stone-900 border-stone-800">
            <CardContent className="space-y-6 pt-6">
                {entityType === 'NPC' && (
                    <div className="space-y-2 p-4 rounded-lg bg-stone-950/50 border border-stone-800/50">
                        <Label htmlFor="archetype" className="text-stone-300">Archetype / Class</Label>
                        <Input
                            id="archetype"
                            placeholder="e.g. Scribe, Warrior, Merchant (Optional)"
                            value={archetype || ''}
                            onChange={(e) => onArchetypeChange(e.target.value)}
                            className="bg-stone-900 border-stone-800"
                        />
                        <p className="text-xs text-muted-foreground character-help-text">
                            Character class or role template. (Example: "Human Paladin")
                        </p>
                    </div>
                )}

                {/* Dynamic Section */}
                <div className="min-h-[100px]">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8 text-stone-500">
                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                            Loading Rulesets...
                        </div>
                    ) : error ? (
                        <div className="flex items-center gap-2 text-amber-500 bg-amber-950/20 p-4 rounded border border-amber-900/50">
                            <AlertTriangle className="w-4 h-4" />
                            <span className="text-sm">Failed to load rulesets.</span>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            <DynamicSchemaForm
                                schema={schema}
                                control={form.control}
                            />

                            {/* Optional Ruleset Selector */}
                            {availableOptionalRulesets.length > 0 && (
                                <div className="pt-6 border-t border-stone-800">
                                    <Label className="text-xs text-stone-500 uppercase tracking-wider mb-2 block">
                                        Add Optional Configuration
                                    </Label>
                                    <div className="flex gap-2">
                                        <Select
                                            value={selectedOptional}
                                            onValueChange={setSelectedOptional}
                                        >
                                            <SelectTrigger className="bg-stone-950 border-stone-800 w-full md:w-[300px]">
                                                <SelectValue placeholder="Select optional ruleset..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableOptionalRulesets.map(r => (
                                                    <SelectItem key={r.id} value={r.id}>
                                                        {r.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            variant="secondary"
                                            onClick={handleAddOptional}
                                            disabled={!selectedOptional}
                                        >
                                            <Plus className="w-4 h-4 mr-2" />
                                            Add
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {!isLoading && !error && Object.keys(schema).length === 0 && availableOptionalRulesets.length === 0 && (
                        <div className="p-4 border border-dashed border-stone-800 rounded-lg bg-stone-950/50 text-center">
                            <p className="text-sm text-stone-500">
                                No specific rulesets found for {entityType}.
                            </p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
