
import { Card } from '@/components/ui/card';

interface ActiveGameInterfaceProps {
    gameStateId: string;
}

export function ActiveGameInterface({ gameStateId }: ActiveGameInterfaceProps) {
    return (
        <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center">
            <Card className="p-6 max-w-2xl w-full text-center space-y-4">
                <h1 className="text-3xl font-bold text-primary">Game Ready</h1>
                <p className="text-muted-foreground">
                    Context verified. Waiting for turns...
                </p>
                <div className="bg-muted p-4 rounded-md text-sm font-mono text-left">
                    Session ID: {gameStateId}
                </div>
            </Card>
        </div>
    );
}
