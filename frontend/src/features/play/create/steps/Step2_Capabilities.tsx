
import React from 'react';
import { DynamicControl } from '../components/DynamicControl';

interface Step2Props {
    data: any;
    updateData: (key: string, value: any) => void;
    schema: Record<string, any>; // SplittedSchema['capabilities']
}

export function Step2_Capabilities({ data, updateData, schema }: Step2Props) {
    // Sort keys to look nicer (maybe by hint.order or alphabetical)
    // For now, alphabetical is decent, or just native object order.
    const keys = Object.keys(schema);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Capabilities</h2>
                <p className="text-muted-foreground">
                    Determine your strengths, weaknesses, and skills.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6 pt-2">
                {keys.length === 0 && (
                    <div className="text-muted-foreground italic">
                        This story has no numeric stats to configure. Proceed to the next step.
                    </div>
                )}

                {keys.map(key => (
                    <DynamicControl
                        key={key}
                        fieldKey={key}
                        schema={schema[key]}
                        value={data[key]}
                        onChange={(val) => updateData(key, val)}
                    />
                ))}
            </div>
        </div>
    );
}
