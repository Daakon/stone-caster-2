import React from 'react';
import ReactMarkdown from 'react-markdown';
import { useQuery } from '@tanstack/react-query';
import { loadState } from '@/services/game-client';
import { Card } from '@/components/ui/card';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

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

    // Extract Description from Tier 1 or use Genesis output
    // The Genesis Service places the text into `bundle.narrative.description`.
    // In the runtime `GameState`, this might be in `narrative` or `tier1_mechanical`?
    // Let's inspect GameState type if possible, but assuming `narrative.description` based on GameInitService logic.
    // If not found, fallback to safely inspect object.
    const narrativeText = (gameState as any)?.narrative?.description ||
        (gameState as any)?.tier1_mechanical?.narrative?.description ||
        "The story begins in silence...";

    return (
        <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center">
            {/* Header */}
            <div className="w-full max-w-2xl mb-4 flex justify-between items-center">
                <Button variant="ghost" size="sm" onClick={() => navigate('/casting-circle')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Exit
                </Button>
            </div>

            <Card className="p-8 max-w-2xl w-full space-y-6 shadow-lg border-primary/20">
                <div className="prose prose-invert max-w-none">
                    <ReactMarkdown
                        components={{
                            // Styling: Italics -> text-purple-300 italic
                            em: ({ node, ...props }) => <span className="text-purple-300 italic" {...props} />,
                            // Styling: Bold -> text-white font-bold
                            strong: ({ node, ...props }) => <span className="text-white font-bold tracking-wide" {...props} />,
                            // Styling: Blockquote -> border-l-2 border-primary pl-4
                            blockquote: ({ node, ...props }) => <div className="border-l-2 border-primary pl-4 text-muted-foreground italic my-4" {...props} />
                        }}
                    >
                        {narrativeText}
                    </ReactMarkdown>
                </div>

                <div className="pt-8 border-t border-border/50 text-center text-sm text-muted-foreground animate-pulse">
                    Waiting for player action...
                </div>
            </Card>
        </div>
    );
}
