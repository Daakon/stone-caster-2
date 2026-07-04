import { useRef, useEffect, useMemo } from 'react';

import { TurnBlock } from './TurnBlock';
import type { LogEntry } from './types';

interface NarrativeStreamProps {
    logs: LogEntry[];
    /** Input currently being processed by the server — renders a pending turn block */
    pendingInput?: string | null;
}

interface TurnData {
    id: string;
    input?: LogEntry;
    system: LogEntry[];
    narrative: LogEntry[];
}

// Helper to handle double-encoded JSON from DB
const recursiveParse = (data: any): any => {
    if (typeof data === 'string') {
        try {
            const parsed = JSON.parse(data);
            return recursiveParse(parsed);
        } catch { return data; }
    }
    return data || {};
};

export function NarrativeStream({ logs, pendingInput }: NarrativeStreamProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    // Group Logs into Turns
    const turns = useMemo(() => {
        const groups: TurnData[] = [];
        let currentTurn: TurnData | null = null;

        logs.forEach(log => {
            // [ROBUST PARSING]
            let rawTxt = log.text || "";
            // Use recursiveParse as requested, but careful handling for string literals vs JSON
            let parsed = {};
            if (rawTxt.trim().startsWith('{') || rawTxt.trim().startsWith('[')) {
                parsed = recursiveParse(rawTxt);
            }

            const anyLog = log as any;

            // 1. Resolve User Input
            const userText = anyLog.player_input
                || anyLog.playerInput
                || anyLog.input
                || anyLog.text
                || parsed.intent?.raw // In case it was JSON with intent
                || parsed.text
                || "Action";

            // 2. Resolve System Narrative
            const systemText = typeof parsed === 'object'
                ? (parsed.narration || parsed.text || parsed.content || "")
                : parsed;

            // Select final text based on role
            let txt = "";
            if (log.role === 'player') {
                txt = userText;
            } else {
                // For narrator/system, we want the systemText
                // If rawTxt was just a string (not JSON), recursiveParse wasn't called or failed, so parsed is {}.
                // In that case, we should fallback to rawTxt.
                if (!systemText && rawTxt && !rawTxt.trim().startsWith('{')) {
                    txt = rawTxt;
                } else {
                    txt = systemText;
                }
            }

            if (log.role === 'narrator') {
                if (typeof txt === 'string') {
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
            }

            // [DEBUG] Check for Thought Chains
            if (typeof txt === 'string' && txt.includes('[THOUGHT]')) {
                console.debug('%c[AI Thought Chain]', 'color: cyan; font-weight: bold;', txt.replace('[THOUGHT]', '').trim());
                return;
            }

            if (!txt) return;

            const cleanLog = { ...log, text: txt };

            if (log.role === 'player') {
                currentTurn = {
                    id: log.id,
                    input: cleanLog,
                    system: [],
                    narrative: []
                };
                groups.push(currentTurn);
            } else if (log.role === 'narrator') {
                if (!currentTurn) {
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
    }, [turns.length, pendingInput]);

    return (
        <div className="flex-1 w-full px-4 md:px-0">
            <div className="flex flex-col-reverse justify-start min-h-full pb-24 md:pb-32 space-y-4 space-y-reverse max-w-2xl mx-auto">
                <div ref={bottomRef} className="h-1 scroll-mt-20" />

                {pendingInput && (
                    <div data-testid="turn-pending" aria-live="polite" className="space-y-3">
                        <div className="flex justify-end">
                            <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-2 max-w-[85%] text-sm">
                                {pendingInput}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground text-sm italic">
                            <span className="flex gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.3s]" />
                                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.15s]" />
                                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" />
                            </span>
                            The story unfolds…
                        </div>
                    </div>
                )}

                {[...turns].reverse().map((turn) => (
                    <TurnBlock key={turn.id} data={turn} />
                ))}
            </div>
        </div>
    );
}
