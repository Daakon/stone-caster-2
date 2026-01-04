import React from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Save, Check } from 'lucide-react';
import type { StepDefinition } from '@/hooks/chimera/useEntitySchema';

interface CharacterForgeLayoutProps {
    steps: StepDefinition[];
    currentStepId: string;
    onStepChange: (stepId: string) => void;
    onSave: () => void;
    onSaveAndExit?: () => void;
    onFinish: () => void;
    isSaving?: boolean;
    children: React.ReactNode;
}

export function CharacterForgeLayout({
    steps,
    currentStepId,
    onStepChange,
    onSave,
    onSaveAndExit,
    onFinish,
    isSaving = false,
    children
}: CharacterForgeLayoutProps) {
    const currentIndex = steps.findIndex(s => s.id === currentStepId);
    const isFirstStep = currentIndex <= 0;
    const isLastStep = currentIndex === steps.length - 1;

    const handleBack = () => {
        if (!isFirstStep) {
            onStepChange(steps[currentIndex - 1].id);
        }
    };

    const handleNext = () => {
        if (isLastStep) {
            onFinish();
        } else {
            onStepChange(steps[currentIndex + 1].id);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-background text-foreground">
            {/* Header & Nav */}
            <header className="border-b bg-card z-10">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={onSaveAndExit} className="mr-2 md:hidden">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <h1 className="text-xl font-bold tracking-tight">Character Forge</h1>
                        <span className="text-sm text-muted-foreground hidden sm:inline-block">/ New Character</span>
                    </div>
                    {/* Optional: Add session/user info here if needed */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onSaveAndExit}
                        className="text-muted-foreground hidden md:flex"
                    >
                        Save & Exit
                    </Button>
                </div>

                {/* Navigation Tabs (Scrollable on mobile) */}
                <div className="container mx-auto px-0 sm:px-4">
                    <ScrollArea className="w-full whitespace-nowrap">
                        <div className="flex w-full items-center">
                            {steps.map((step, index) => {
                                const isActive = step.id === currentStepId;
                                return (
                                    <button
                                        key={step.id}
                                        onClick={() => onStepChange(step.id)}
                                        className={cn(
                                            "relative px-4 py-3 text-sm font-medium transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                            isActive
                                                ? "text-primary border-b-2 border-primary"
                                                : "text-muted-foreground hover:bg-muted/50"
                                        )}
                                    >
                                        <span className="mr-2 text-xs opacity-70">{index + 1}.</span>
                                        {step.label}
                                    </button>
                                );
                            })}
                        </div>
                    </ScrollArea>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto bg-muted/10">
                <div className="container mx-auto px-4 py-8 max-w-4xl">
                    {children}
                </div>
            </main>

            {/* Sticky Footer */}
            <footer className="border-t bg-card p-4 z-10 shadow-up">
                <div className="container mx-auto max-w-4xl flex items-center justify-between">
                    <Button
                        variant="outline"
                        onClick={handleBack}
                        disabled={isFirstStep}
                        className={cn("w-24", isFirstStep && "invisible")}
                    >
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back
                    </Button>

                    <Button variant="ghost" size="sm" onClick={onSave} disabled={isSaving} className="text-muted-foreground text-xs">
                        {isSaving ? 'Saving...' : 'Auto-saving enabled'}
                    </Button>

                    <Button
                        onClick={handleNext}
                        disabled={isSaving}
                        className="w-32"
                    >
                        {isLastStep ? (
                            <>
                                Finish
                                <Check className="ml-2 h-4 w-4" />
                            </>
                        ) : (
                            <>
                                Next
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </>
                        )}
                    </Button>
                </div>
            </footer>
        </div>
    );
}
