import type { LogEntry } from './types';
import { StoryBlock } from './StoryBlock';
import { SystemLine } from './SystemLine';
import { cn } from '@/lib/utils';
import { User } from 'lucide-react';

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
        <div className="flex flex-col gap-4 py-6 border-b border-border/40 last:border-0 relative group">

            {/* 1. Player Input (Header) */}
            {input && (
                <div className="flex items-center justify-end gap-3 opacity-90 group-hover:opacity-100 transition-opacity">
                    <div className="flex flex-col items-end">
                        <span className="text-sm font-bold text-primary italic">
                            "{input.text}"
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                            Command
                        </span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                        <User className="w-4 h-4 text-primary" />
                    </div>
                </div>
            )}

            {/* 2. System Logs (Collapsible or Block) */}
            {system.length > 0 && (
                <div className="flex flex-col gap-1 pl-4 border-l-2 border-secondary/30 my-2">
                    {system.map(log => (
                        <SystemLine
                            key={log.id}
                            text={log.text}
                            type={log.metadata?.type as any || 'info'}
                        />
                    ))}
                </div>
            )}

            {/* 3. Narrative Prose */}
            {narrative.length > 0 && (
                <div className="flex flex-col gap-4">
                    {narrative.map(log => (
                        <StoryBlock
                            key={log.id}
                            text={log.text}
                            role="narrator"
                            timestamp={log.timestamp}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
