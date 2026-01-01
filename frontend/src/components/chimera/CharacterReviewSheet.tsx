
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import type { CreationManifest } from '@shared/types/chimera-authoring';

interface CharacterReviewSheetProps {
    manifest: CreationManifest;
    data: Record<string, any>;
}

export function CharacterReviewSheet({ manifest, data }: CharacterReviewSheetProps) {
    // Sort logic could go here, but for now we follow step order

    const formatValue = (value: any, control: string): React.ReactNode => {
        if (value === undefined || value === null || value === '') {
            return <span className="text-muted-foreground italic">Not Set</span>;
        }

        if (control === 'tag_list') {
            const tags = Array.isArray(value) ? value : String(value).split(',');
            if (tags.length === 0 || (tags.length === 1 && !tags[0])) return <span className="text-muted-foreground italic">None</span>;

            return (
                <div className="flex flex-wrap gap-1">
                    {tags.map((tag, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                            {tag.trim()}
                        </Badge>
                    ))}
                </div>
            );
        }

        if (control === 'slider') {
            return <span className="font-mono font-medium">{value}</span>;
        }

        if (typeof value === 'boolean') {
            return value ? 'Yes' : 'No';
        }

        return <span>{String(value)}</span>;
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
            <div className="space-y-2 text-center">
                <h2 className="text-3xl font-bold tracking-tight">Review Your Character</h2>
                <p className="text-muted-foreground">
                    Review your choices before embarking on your journey.
                </p>
                <Separator className="my-4" />
            </div>

            <div className="grid gap-6">
                {manifest.steps.map((step) => {
                    const stepGroups = step.groups;
                    if (stepGroups.length === 0) return null;

                    return (
                        <div key={step.id} className="space-y-4">
                            <h3 className="text-xl font-semibold border-l-4 border-primary pl-3 bg-muted/20 py-1">
                                {step.label}
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {stepGroups.map((group) => (
                                    <Card key={group.id} className="overflow-hidden">
                                        <CardHeader className="bg-secondary/30 pb-3">
                                            <CardTitle className="text-base font-medium">
                                                {group.label}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="pt-4 grid gap-y-4">
                                            {group.fields.map(field => (
                                                <div key={field.key} className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-border/50 pb-2 last:border-0 last:pb-0">
                                                    <span className="text-sm font-medium text-muted-foreground">
                                                        {field.label}
                                                    </span>
                                                    <div className="text-sm text-right font-medium">
                                                        {formatValue(data[field.key], field.control)}
                                                    </div>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
