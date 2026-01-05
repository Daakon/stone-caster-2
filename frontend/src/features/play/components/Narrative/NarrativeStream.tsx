import { useRef, useEffect, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TurnBlock } from './TurnBlock';
import type { LogEntry } from './types';

interface NarrativeStreamProps {
    logs: LogEntry[];
}

interface TurnData {
    id: string;
    input?: LogEntry;
    system: LogEntry[];
    narrative: LogEntry[];
}

export function NarrativeStream({ logs }: NarrativeStreamProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    // Group Logs into Turns
    const turns = useMemo(() => {
        const groups: TurnData[] = [];
        let currentTurn: TurnData | null = null;

        logs.forEach(log => {
            // Clean Text Logic (Mirrored from previous version)
            let txt = log.text || "";
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
            if (!txt) return;

            const cleanLog = { ...log, text: txt };

            if (log.role === 'player') {
                // New Turn Started by Player
                currentTurn = {
                    id: log.id,
                    input: cleanLog,
                    system: [],
                    narrative: []
                };
                groups.push(currentTurn);
            } else if (log.role === 'narrator') {
                if (!currentTurn) {
                    // Turn 0 (Genesis) or orphaned/initialator narrator
                    currentTurn = {
                        id: log.id,
                        system: [],
                        narrative: [cleanLog]
                    };
                    groups.push(currentTurn);
                } else {
                    currentTurn.narrative.push(cleanLog);
                }
            } else if (log.role === 'system') {
                if (!currentTurn) {
                    // Orphaned system log
                    currentTurn = {
                        id: log.id,
                        system: [cleanLog],
                        narrative: []
                    };
                    groups.push(currentTurn);
                } else {
                    currentTurn.system.push(cleanLog);
                }
            }
        });

        return groups;
    }, [logs]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [turns.length]); // Scroll on new turn (or log count if improved)

    return (
        <ScrollArea className="flex-1 w-full px-4 md:px-0">
            <div className="flex flex-col-reverse justify-start min-h-full pb-24 md:pb-32 space-y-4 space-y-reverse max-w-2xl mx-auto">
                <div ref={bottomRef} className="h-1" />

                {[...turns].reverse().map((turn) => (
                    <TurnBlock key={turn.id} data={turn} />
                ))}
            </div>
        </ScrollArea>
    );
}
