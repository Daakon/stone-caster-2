
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

interface LiveCharacterSheetProps {
    data: any;
}

export function LiveCharacterSheet({ data }: LiveCharacterSheetProps) {
    const { name, pronouns, appearance, backstory, ...rest } = data;

    // Filter out internal fields if any leaks through
    const stats = Object.entries(rest).filter(([key, val]) =>
        typeof val === 'number' && !key.includes('_id')
    );

    const traits = Object.entries(rest).filter(([key, val]) =>
        Array.isArray(val) || (typeof val === 'string' && val.length < 50 && key !== 'race_handle' && key !== 'archetype_handle')
    );

    // Extract special handles for header
    const race = rest.race_handle || rest.species || 'Unknown';
    const archetype = rest.archetype_handle || rest.class || 'Adventurer';

    return (
        <Card className="h-full border-stone-800 bg-[#1c1c1e] text-stone-200 shadow-2xl overflow-hidden sticky top-6">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-600 via-orange-500 to-amber-700 opacity-80" />

            <CardHeader className="text-center pb-2 pt-8">
                <div className="mx-auto w-24 h-24 mb-4 rounded-full bg-stone-800 border-2 border-stone-700 flex items-center justify-center overflow-hidden shadow-inner">
                    {/* Placeholder for portrait upload integration later */}
                    <span className="text-4xl">👤</span>
                </div>
                <CardTitle className="text-3xl font-serif tracking-wide">{name || 'Unnamed Hero'}</CardTitle>
                <div className="text-sm font-medium text-amber-500/80 uppercase tracking-widest flex justify-center gap-2">
                    <span>{race}</span>
                    <span>•</span>
                    <span>{archetype}</span>
                </div>
                {pronouns && <div className="text-xs text-stone-500 mt-1">{pronouns}</div>}
            </CardHeader>

            <CardContent className="space-y-6 px-6">
                <Separator className="bg-stone-800" />

                {/* Stats Grid */}
                {stats.length > 0 && (
                    <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase text-stone-500 tracking-wider">Capabilities</h4>
                        <div className="grid grid-cols-2 gap-3">
                            {stats.map(([k, v]) => (
                                <div key={k} className="flex justify-between items-center bg-stone-900/50 p-2 rounded border border-stone-800">
                                    <span className="capitalize text-sm text-stone-400">{k.replace(/_/g, ' ')}</span>
                                    <span className="font-mono font-bold text-amber-500">{String(v)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Traits / Tags */}
                {traits.length > 0 && (
                    <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase text-stone-500 tracking-wider">Traits & Identity</h4>
                        <div className="flex flex-wrap gap-2">
                            {traits.map(([k, v]) => {
                                const label = k.replace(/_/g, ' ');
                                const content = Array.isArray(v) ? v.join(', ') : String(v);
                                if (!content) return null;

                                return (
                                    <div key={k} className="w-full text-sm">
                                        <span className="text-stone-500 capitalize mr-2">{label}:</span>
                                        <span className="text-stone-300">{content}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Bio Snippets */}
                {(appearance || backstory) && (
                    <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase text-stone-500 tracking-wider">Biography</h4>
                        {appearance && (
                            <p className="text-xs text-stone-400 leading-relaxed italic border-l-2 border-stone-700 pl-3">
                                "{appearance.slice(0, 150)}{appearance.length > 150 ? '...' : ''}"
                            </p>
                        )}
                        {backstory && (
                            <p className="text-xs text-stone-500 leading-relaxed">
                                {backstory.slice(0, 200)}{backstory.length > 200 ? '...' : ''}
                            </p>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
