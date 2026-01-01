import React from 'react';
import { useEntitySchema } from '../../hooks/chimera/useEntitySchema';
import type { WorldDefinition, RulesetDefinition } from '@shared/types/chimera-authoring';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SchemaDebugProps {
    world?: WorldDefinition;
    rulesets?: RulesetDefinition[];
}

export function SchemaDebug({ world, rulesets }: SchemaDebugProps) {
    const playerSchema = useEntitySchema(world, rulesets, { targetKind: 'player' });
    const npcSchema = useEntitySchema(world, rulesets, { targetKind: 'npc' });

    return (
        <div className="p-8 space-y-8 bg-slate-50 min-h-screen text-slate-900">
            <h1 className="text-3xl font-bold">Schema Engine Debug</h1>

            <div className="grid grid-cols-2 gap-4">
                <Card className="h-[800px] flex flex-col">
                    <CardHeader>
                        <CardTitle>Player Schema ({playerSchema.length} Steps)</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-0">
                        <ScrollArea className="h-full">
                            <pre className="text-xs font-mono p-4 bg-slate-100 rounded">
                                {JSON.stringify(playerSchema, null, 2)}
                            </pre>
                        </ScrollArea>
                    </CardContent>
                </Card>

                <Card className="h-[800px] flex flex-col">
                    <CardHeader>
                        <CardTitle>NPC Schema ({npcSchema.length} Steps)</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-0">
                        <ScrollArea className="h-full">
                            <pre className="text-xs font-mono p-4 bg-slate-100 rounded">
                                {JSON.stringify(npcSchema, null, 2)}
                            </pre>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-4">
                <h2 className="text-xl font-semibold">Raw Source Inputs</h2>
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border rounded bg-white">
                        <h3 className="font-bold">World</h3>
                        <pre className="text-xs overflow-auto max-h-60 mt-2">
                            {world ? `${world.name} (${world.id})` : 'No World Loaded'}
                            {'\n'}
                            {JSON.stringify(world?.character_schema_extensions, null, 2)}
                        </pre>
                    </div>
                    <div className="p-4 border rounded bg-white">
                        <h3 className="font-bold">Rulesets ({rulesets?.length || 0})</h3>
                        <pre className="text-xs overflow-auto max-h-60 mt-2">
                            {rulesets?.map(r => `${r.name} (${r.ui_category})`).join('\n')}
                        </pre>
                    </div>
                </div>
            </div>
        </div>
    );
}
