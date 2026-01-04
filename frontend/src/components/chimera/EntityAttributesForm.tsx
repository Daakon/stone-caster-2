import React from 'react';
import type { Control } from 'react-hook-form';
import type { StepDefinition } from '@/hooks/chimera/useEntitySchema';
import { DynamicSchemaField } from './DynamicSchemaField';
import { Separator } from '@/components/ui/separator';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface EntityAttributesFormProps {
    step: StepDefinition;
    control: Control<any>;
}

export function EntityAttributesForm({ step, control }: EntityAttributesFormProps) {
    if (!step || !step.groups) {
        return <div className="p-4 text-muted-foreground">No configuration available for this step.</div>;
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">{step.label}</h2>
                <p className="text-muted-foreground">
                    Configure the details for this section. Changes are saved automatically.
                </p>
                <Separator className="my-4" />
            </div>

            {step.groups.map((group) => (
                <Card key={group.id} className="mb-6 border-2 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold">
                            {group.label}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {group.fields.map((field) => (
                            <DynamicSchemaField
                                key={field.key}
                                field={field}
                                control={control}
                            />
                        ))}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
