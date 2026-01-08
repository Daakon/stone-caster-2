import type { PropsWithChildren, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useGameSettings } from '@/stores/useGameSettings';

interface GameLayoutProps extends PropsWithChildren {
    /** The main header content (e.g. Scene Deck) */
    header?: ReactNode;
    /** The sidebar content (Left) */
    sidebar?: ReactNode;
    /** The Vitals Cluster content (Bottom Left) */
    vitals?: ReactNode;
    /** The Cast Tray content (Right / Bottom Right) */
    tray?: ReactNode;
    /** The footer content (e.g. InputDeck) */
    footer?: ReactNode;
}

export function GameLayout({
    children,
    header,
    sidebar,
    vitals,
    tray,
    footer,
}: GameLayoutProps) {
    const { zenMode } = useGameSettings();

    return (
        <div className="relative min-h-screen w-full bg-slate-950 overflow-hidden text-slate-200 selection:bg-brand-primary/30">

            {/* Layer 0: Background (Placeholder for dynamic atmosphere) */}
            <div className="fixed inset-0 z-0 bg-gradient-to-b from-slate-900 to-black pointer-events-none" />

            {/* Layer 1: Main Content (Narrative Feed) */}
            {/* 
                - z-10 to sit above background but below HUD 
                - pt-20 to clear the fixed header 
                - pb-32 to clear the fixed footer 
            */}
            <main className="relative z-10 w-full max-w-3xl mx-auto h-screen overflow-y-auto pt-20 pb-32 px-4 no-scrollbar scroll-smooth">
                {children}
            </main>

            {/* Layer 2: HUD Slots */}

            {/* Header Slot (SceneDeck) - Fixed Top */}
            <div className="fixed top-0 inset-x-0 z-50 pointer-events-none child-events-auto">
                {/* Ensure children have pointer-events-auto if needed, but SceneDeck handles it */}
                {header}
            </div>

            {/* Sidebar Slot - Fixed Left (Desktop) */}
            <div
                className={cn(
                    "fixed top-24 left-4 w-64 z-40 transition-opacity duration-500 hidden md:block",
                    zenMode ? "opacity-0" : "opacity-100"
                )}
            >
                {sidebar}
            </div>

            {/* Vitals Slot - Fixed Bottom Left */}
            <div
                className={cn(
                    "fixed bottom-24 left-4 z-40 transition-opacity duration-500 pointer-events-none",
                    zenMode ? "opacity-0" : "opacity-100"
                )}
            >
                {/* Offset bottom-24 to sit above InputDeck (which is usually h-auto ~20) */}
                {vitals}
            </div>

            {/* Tray Slot - Fixed Right (Desktop) or Bottom Right (Mobile) */}
            <div
                className={cn(
                    "fixed z-50 transition-all duration-500 pointer-events-none",
                    // Desktop Position: Right edge, centered vertically or aligned top
                    "md:right-4 md:top-24 md:bottom-auto",
                    // Mobile Position: Bottom Right
                    "bottom-24 right-4",
                    zenMode ? "opacity-0" : "opacity-100"
                )}
            >
                {/* Tray component handles its own pointer events */}
                {tray}
            </div>

            {/* Footer Slot (Input Deck) - Fixed Bottom */}
            <div className="fixed bottom-0 inset-x-0 z-30 pointer-events-auto">
                {footer}
            </div>

        </div>
    );
}
