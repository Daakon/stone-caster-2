import { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StoryBlock } from './StoryBlock';
import { SystemLine } from './SystemLine';

export interface LogEntry {
    id: string;
    role: 'narrator' | 'player' | 'system';
    text: string;
    timestamp: Date;
    metadata?: Record<string, any>;
}

interface NarrativeStreamProps {
    logs: LogEntry[];
}

export function NarrativeStream({ logs }: NarrativeStreamProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    return (
        <ScrollArea className="flex-1 w-full px-4 md:px-0">
            {/* 
              Mobile Ergonomics: flex-col-reverse 
              - Anchors content to the bottom (Thumb Zone).
              - New messages appear at the visual bottom (but are first in DOM if we matched array order).
              - Wait, if I use flex-col-reverse, the FIRST child is at the BOTTOM.
              - So I must render [Newest, ..., Oldest]. 
            */}
            <div className="flex flex-col-reverse justify-start min-h-full pb-24 md:pb-32 space-y-4 space-y-reverse max-w-2xl mx-auto">
                <div ref={bottomRef} />
                {/* Note: In flex-col-reverse, bottomRef (if last) goes to top? 
                    Actually, if I reserve the array: 
                    Logs: [Oldest ... Newest]
                    Reversed: [Newest ... Oldest]
                    Flex-col-reverse: 
                        Newest (Bottom)
                        ...
                        Oldest (Top)
                    This logic holds.
                */}
                {[...logs]

                    .map(log => {
                        let txt = log.text || "";
                        // Clean: Remove prompt leakage lines
                        if (log.role === 'narrator') {
                            const lines = txt.split('\n');
                            const cleanLines = lines.filter(line => {
                                const l = line.trim();
                                if (l.includes("NARRATOR LENS")) return false;
                                if (l.includes("DIRECTOR'S NOTE")) return false;
                                if (l.startsWith("ROLE:")) return false;
                                if (l.startsWith("PERSPECTIVE:")) return false;
                                return true;
                            });
                            txt = cleanLines.join('\n').trim();
                        }
                        return { ...log, text: txt };
                    })
                    .filter(log => log.text.length > 0)
                    .reverse()
                    .map((log) => {

                        if (log.role === 'system') {
                            return (
                                <SystemLine
                                    key={log.id}
                                    text={log.text}
                                    type={log.metadata?.type || 'info'}
                                />
                            );
                        }

                        return (
                            <StoryBlock
                                key={log.id}
                                text={log.text}
                                role={log.role as 'narrator' | 'player'}
                                timestamp={log.timestamp}
                            />
                        );
                    })}
            </div>
        </ScrollArea>
    );
}
