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
            {/* Global Header - Fixed Height z-20 */}
            <div className="flex-none h-14 z-20 relative">
                {header}
            </div>

            {/* Body - Flex Row */}
            <div className="flex-1 flex flex-row overflow-hidden relative">
                {/* LEFT SIDEBAR - Responsive Width (Icon-only md -> Full lg) */}
                <aside className="hidden md:flex flex-col border-r bg-card/30 overflow-y-auto flex-shrink-0 transition-all duration-300 w-20 lg:w-72">
                    {leftSidebar}
                </aside>

                {/* CENTER STAGE - Primary Focus */}
                <main className="flex-1 flex flex-col min-w-[320px] relative bg-background/50">
                    {/* Scrollable Log Area */}
                    <div className="flex-1 overflow-y-auto scroll-smooth">
                        <div className="max-w-3xl mx-auto w-full min-h-full pb-0">
                            {children}
                        </div>
                    </div>

                    {/* Fixed Footer (Game Input) */}
                    <div className="flex-none border-t bg-background/95 backdrop-blur z-10 w-full mb-0">
                        <div className="max-w-3xl mx-auto w-full">
                            {footer}
                        </div>
                    </div>
                </main>

                {/* RIGHT SIDEBAR - Responsive Width (Icon-only lg -> Full xl) */}
                <aside className="hidden lg:flex flex-col border-l bg-card/30 overflow-y-auto flex-shrink-0 transition-all duration-300 w-20 xl:w-80">
                    {rightSidebar}
                </aside>
            </div>
        </div>
    );
}
