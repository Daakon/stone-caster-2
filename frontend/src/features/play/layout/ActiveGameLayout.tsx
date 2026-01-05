import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface ActiveGameLayoutProps {
    narrativeStream: ReactNode;
    inputDeck: ReactNode;
    hud?: ReactNode;
    className?: string;
}

export function ActiveGameLayout({ narrativeStream, inputDeck, hud, className }: ActiveGameLayoutProps) {
    return (
        <div className={cn("fixed inset-0 flex flex-col bg-background", className)}>
            {/* Layer 2 (HUD): Absolute overlays */}
            <div className="absolute inset-0 pointer-events-none z-20">
                {hud}
            </div>

            {/* Layer 1 (Base): Narrative Stream */}
            {/* Uses flex-col-reverse to anchor content to bottom for mobile keyboard defense */}
            <main className="flex-1 relative z-10 overflow-hidden flex flex-col-reverse">
                {narrativeStream}
            </main>

            {/* Layer 3 (Deck): Sticky/Fixed bottom Input */}
            {/* High z-index to sit above stream content */}
            <footer className="relative z-30 bg-background/95 backdrop-blur border-t shadow-lg">
                {inputDeck}
            </footer>
        </div>
    );
}
