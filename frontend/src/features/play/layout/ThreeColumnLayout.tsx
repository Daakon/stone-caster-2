import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
// import { Button } from '@/components/ui/button'; // Not used in strict rigid layout yet

interface ThreeColumnLayoutProps {
    header?: ReactNode;
    leftSidebar?: ReactNode;
    rightSidebar?: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
}

export function ThreeColumnLayout({ header, leftSidebar, rightSidebar, children, footer }: ThreeColumnLayoutProps) {
    return (
        <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
            {/* Global Header */}
            {header}

            <div className="flex-1 flex flex-row overflow-hidden">
                {/* LEFT SIDEBAR - Collapsible on Mobile */}
                <aside className="hidden md:flex w-64 flex-col border-r bg-card/30 overflow-y-auto flex-shrink-0">
                    {leftSidebar}
                </aside>

                {/* CENTER STAGE - Primary Focus */}
                <main className="flex-1 flex flex-col min-w-[320px] relative bg-background/50">
                    {/* Scrollable Log Area */}
                    <div className="flex-1 overflow-y-auto p-4 scroll-smooth">
                        <div className="max-w-3xl mx-auto w-full pb-4">
                            {children}
                        </div>
                    </div>

                    {/* Fixed Footer */}
                    <div className="flex-none p-4 border-t bg-background/95 backdrop-blur z-10 w-full">
                        <div className="max-w-3xl mx-auto w-full">
                            {footer}
                        </div>
                    </div>
                </main>

                {/* RIGHT SIDEBAR - Collapsible on Mobile */}
                <aside className="hidden lg:flex w-80 flex-col border-l bg-card/30 overflow-y-auto flex-shrink-0">
                    {rightSidebar}
                </aside>
            </div>
        </div>
    );
}
