import type { LogEntry } from './types';
import { NarrativeBlock } from '@/components/game/feed/NarrativeBlock';
import { SystemLine } from './SystemLine';
import { SystemMessage } from '@/components/game/feed/SystemMessage';
import { cn } from '@/lib/utils';

interface TurnBlockProps {
    data: {
        id: string; // usually turn index or input id
        input?: LogEntry;
        system: LogEntry[];
        narrative: LogEntry[];
    };
}

export function TurnBlock({ data }: TurnBlockProps) {
    const { input, system, narrative } = data;

    return (
        <div className="flex flex-col gap-6 py-6 w-full max-w-3xl mx-auto">

            {/* 1. Player Input (Action Block) */}
            {input && (
                <div className="flex flex-col items-end w-full mb-2">
                    <div className="ml-auto w-fit max-w-[85%] border-r-2 border-primary pl-4 pr-3 py-1 text-right">
                        <p className="text-base text-foreground font-medium italic leading-relaxed">
                            {input.text}
                        </p>
                    </div>
                </div>
            )}

            {/* 2. System Logs (Center) */}
            {system.length > 0 && (
                <div className="flex flex-col items-center gap-1 my-2 w-full">
                    {system.map(log => (
                        <div key={log.id} className="w-full text-center my-1 px-4 py-2 text-xs font-mono bg-slate-950/50 border border-slate-800 rounded-md text-cyan-500/90 shadow-sm backdrop-blur-[2px] animate-in fade-in zoom-in-95 duration-300">
                            <div className="flex items-center justify-center gap-2">
                                <span className="opacity-50 uppercase tracking-widest text-[10px] text-cyan-700 font-bold border border-cyan-900/30 px-1 rounded-[2px]">[SYSTEM]</span>
                                <span className="tracking-wide">{log.text}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 3. Mechanics & Narrative (Prose) */}
            {narrative.length > 0 && (
                <div className="flex flex-col gap-4 w-full mb-4">
                    {/* Render Mechanics Chip if present */}
                    {narrative[0]?.metadata?.mechanics && (
                        <div className="flex justify-start">
                            <SystemMessage
                                type={narrative[0].metadata.mechanics.outcome === 'success' ? 'success' : 'failure'}
                                label={narrative[0].metadata.mechanics.skill_check || 'Check'}
                                details={
                                    narrative[0].metadata.mechanics.roll
                                        ? `Rolled ${narrative[0].metadata.mechanics.roll} vs ${narrative[0].metadata.mechanics.target}`
                                        : undefined
                                }
                            />
                        </div>
                    )}

                    {narrative.map(log => (
                        <div key={log.id} className="w-full max-w-none text-left text-foreground prose prose-invert leading-loose">
                            <NarrativeBlock
                                text={log.text}
                                role="narrator"
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
