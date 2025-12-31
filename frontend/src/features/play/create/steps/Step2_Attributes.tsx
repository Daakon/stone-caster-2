import type { FormHint } from '@/types/chimera-form';
import { DynamicSchemaField } from '@/components/form/DynamicSchemaField';
import { Separator } from '@/components/ui/separator';

interface Step2Props {
    data: any;
    updateData: (key: string, value: any) => void;
    schema: Record<string, any>;
    activeRulesets: any[];
}

interface GroupedHints {
    rulesetTitle: string;
    hints: Record<string, FormHint>;
}

export function Step2_Attributes({ schema, activeRulesets }: Step2Props) {
    const groups: GroupedHints[] = [];
    const assignedKeys = new Set<string>();

    if (activeRulesets && activeRulesets.length > 0) {
        activeRulesets.forEach(ruleset => {
            const contributions = ruleset.character_schema_contributions?.tier1_entity;
            if (!contributions) return;

            const rulesetHints: Record<string, FormHint> = {};
            let hasMatch = false;

            if (contributions.definitions) {
                Object.keys(contributions.definitions).forEach(key => {
                    if (schema[key]) {
                        rulesetHints[key] = schema[key] as FormHint;
                        assignedKeys.add(key);
                        hasMatch = true;
                    }
                });
            }

            if (hasMatch) {
                groups.push({
                    rulesetTitle: ruleset.display_name || ruleset.name || 'Unknown Ruleset',
                    hints: rulesetHints
                });
            }
        });
    }

    const remainingHints: Record<string, FormHint> = {};
    Object.keys(schema).forEach(key => {
        if (!assignedKeys.has(key)) {
            remainingHints[key] = schema[key] as FormHint;
        }
    });

    if (Object.keys(remainingHints).length > 0) {
        groups.push({
            rulesetTitle: 'General Attributes',
            hints: remainingHints
        });
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Attributes</h2>
                <p className="text-muted-foreground">Define your specific capabilities and stats.</p>
            </div>

            <div className="space-y-8">
                {groups.map((group, idx) => (
                    <div key={idx} className="space-y-4">
                        <div className="flex items-center gap-4">
                            <h3 className="text-lg font-semibold text-primary">{group.rulesetTitle}</h3>
                            <Separator className="flex-1" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                            {Object.entries(group.hints).map(([key, hint]) => (
                                <DynamicSchemaField key={key} name={key} hint={hint} />
                            ))}
                        </div>
                    </div>
                ))}

                {groups.length === 0 && (
                    <div className="text-muted-foreground italic">No attributes to configure.</div>
                )}
            </div>
        </div>
    );
}
