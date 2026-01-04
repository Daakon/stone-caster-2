import React from 'react';
import ReactMarkdown from 'react-markdown';
import { useQuery } from '@tanstack/react-query';
import { loadState } from '@/services/game-client';
import { Card } from '@/components/ui/card';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { GameLog } from '@/components/game/NarrativeFeed';

interface ActiveGameInterfaceProps {
    gameStateId: string;
}

export function ActiveGameInterface({ gameStateId }: ActiveGameInterfaceProps) {
    const navigate = useNavigate();

    const { data: gameState, isLoading, error } = useQuery({
        queryKey: ['game-state', gameStateId],
        queryFn: async () => {
            if (!gameStateId) throw new Error('Game ID required');
            return await loadState(gameStateId);
        }
    });

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4">
                <p className="text-destructive">Failed to load game state.</p>
                <Button onClick={() => navigate('/casting-circle')}>Back</Button>
            </div>
        );
    }

    // Extract History
    const history = (gameState as any)?.narrative?.dialogue_history ||
        (gameState as any)?.narrative?.history ||
        [];

    // Map to LogEntry[]
    const logEntries = history.map((entry: any, index: number) => ({
        id: `history-${index}`,
        role: entry.speaker === 'Narrator' ? 'narrator' : 'player',
        text: entry.text || entry.content || '',
        timestamp: new Date(entry.timestamp || Date.now())
    }));

    // Generate Turn 0 text for fallback if empty
    if (logEntries.length === 0) {
        const narrativeText = (gameState as any)?.narrative?.description ||
            (gameState as any)?.tier1_mechanical?.narrative?.description ||
            "The story begins...";

        logEntries.push({
            id: 'init-0',
            role: 'narrator',
            text: narrativeText,
            timestamp: new Date()
        });
    }

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center">
            {/* Header */}
            <div className="w-full max-w-2xl p-4 border-b flex justify-between items-center bg-background/95 backdrop-blur z-10 sticky top-0">
                <Button variant="ghost" size="sm" onClick={() => navigate('/casting-circle')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Exit
                </Button>
            </div>

            {/* Game Log */}
            <div className="flex-1 w-full max-w-2xl overflow-hidden relative">
                <GameLog entries={logEntries} />
            </div>

            {/* Hint Footer */}
            <div className="p-4 w-full max-w-2xl border-t text-center text-sm text-muted-foreground animate-pulse">
                Waiting for player action...
            </div>
        </div>
    );
}
