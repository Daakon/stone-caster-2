
import { Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';

export function GameGenesisLoader() {
    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <Card className="p-8 max-w-md w-full text-center space-y-6">
                <div className="flex justify-center">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold tracking-tight">Initializing World...</h2>
                    <p className="text-muted-foreground">
                        The Loom is weaving your story. This may take a moment.
                    </p>
                </div>
            </Card>
        </div>
    );
}
