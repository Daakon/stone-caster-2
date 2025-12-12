import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface EntityDetailsFormProps {
    entityType: string;
    archetype?: string;
    onArchetypeChange: (val: string) => void;
}

export function EntityDetailsForm({ entityType, archetype, onArchetypeChange }: EntityDetailsFormProps) {
    if (entityType === 'NPC') {
        return (
            <Card className="bg-stone-900 border-stone-800">
                <CardContent className="space-y-4 pt-6">
                    <div className="space-y-2">
                        <Label htmlFor="archetype">Archetype</Label>
                        <Input
                            id="archetype"
                            placeholder="e.g. Scribe, Warrior, Merchant (Optional)"
                            value={archetype || ''}
                            onChange={(e) => onArchetypeChange(e.target.value)}
                            className="bg-stone-950 border-stone-800"
                        />
                        <p className="text-xs text-muted-foreground">
                            Character class or role template. (Example: "Human Paladin")
                        </p>
                    </div>

                    {/* Placeholder for future detailed rules logic */}
                    <div className="p-4 border border-dashed border-stone-800 rounded-lg bg-stone-950/50 text-center">
                        <p className="text-sm text-stone-500">More detailed NPC traits coming soon.</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (entityType === 'LOCATION') {
        return (
            <Card className="bg-stone-900 border-stone-800">
                <CardContent className="space-y-4 pt-6">
                    <div className="p-4 border border-dashed border-stone-800 rounded-lg bg-stone-950/50 text-center">
                        <p className="text-sm text-stone-500">Hierarchy & Geography Editor Placeholder</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-stone-900 border-stone-800">
            <CardContent className="pt-6 text-center text-stone-500">
                No specific details required for {entityType}.
            </CardContent>
        </Card>
    );
}
