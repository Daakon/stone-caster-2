
import React from 'react';
import { DynamicControl } from '../components/DynamicControl';

interface Step3Props {
    data: any;
    updateData: (key: string, value: any) => void;
    schema: Record<string, any>; // SplittedSchema['personality']
}

export function Step3_Personality({ data, updateData, schema }: Step3Props) {
    const keys = Object.keys(schema);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Soul & Drive</h2>
                <p className="text-muted-foreground">
                    What motivates your character? Define their inner world.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6 pt-2">
                {keys.length === 0 && (
                    <div className="text-muted-foreground italic">
                        No additional personality traits defined. You're ready to start!
                    </div>
                )}

                {keys.map(key => (
                    <DynamicControl
                        key={key}
                        fieldKey={key}
                        schema={schema[key]}
                        value={data[key]}
                        onChange={(val) => updateData(key, val)}
                        hint={{ ui_widget: schema[key].type === 'array' ? 'tag_list' : undefined }}
                    />
                ))}
            </div>
        </div>
    );
}
