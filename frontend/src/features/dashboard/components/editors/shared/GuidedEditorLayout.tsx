import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Save, Loader2, Check, ArrowRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export interface WizardStep {
    id: string;
    label: string;
    isComplete?: boolean;
    isValid?: boolean;
}

interface GuidedEditorLayoutProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    steps: WizardStep[];
    currentStepId: string;
    onStepChange: (stepId: string) => void;
    onSaveExit: () => void;
    onManualSave?: () => Promise<void> | void;
    isSaving: boolean;
    isValid?: boolean;
    isSubEditorActive?: boolean;
    children: ReactNode;
}

export function GuidedEditorLayout({
    open,
    onOpenChange,
    title,
    steps,
    currentStepId,
    onStepChange,
    onSaveExit,
    onManualSave,
    isSaving,
    isValid = true,
    isSubEditorActive = false,
    children
}: GuidedEditorLayoutProps) {
    const currentIndex = steps.findIndex(s => s.id === currentStepId);
    const isLastStep = currentIndex === steps.length - 1;
    const nextStep = isLastStep ? null : steps[currentIndex + 1];
    const currentStep = steps[currentIndex];

    // Determine if Next should be disabled (blocking validation)
    // Default to true (valid) if isValid is undefined
    const isStepValid = currentStep?.isValid !== false;
    const isNextDisabled = isSaving || isSubEditorActive || !isStepValid;

    const handleNext = () => {
        if (nextStep) {
            onStepChange(nextStep.id);
        } else {
            // Finish (Save & Exit)
            onSaveExit();
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 gap-0 bg-stone-950 border-stone-800 focus:outline-none focus-visible:outline-none [&>button]:hidden">
                {/* Header with Title and Stepper */}
                <div className="flex flex-col border-b border-stone-800 bg-stone-900/50">
                    {/* Top Bar */}
                    <div className="flex items-center justify-between px-6 py-3 border-b border-stone-800/50">
                        <div className="flex items-center gap-3">
                            <DialogTitle className="text-lg font-bold text-white tracking-tight">{title}</DialogTitle>
                            <Badge variant="outline" className="uppercase text-[10px] tracking-wider border-stone-700 text-stone-400">
                                WIZARD
                            </Badge>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-full text-stone-500 hover:text-white"
                            onClick={() => onOpenChange(false)}
                            disabled={isSaving}
                        >
                            <X className="w-4 h-4" />
                            <span className="sr-only">Close</span>
                        </Button>
                    </div>

                    {/* Stepper */}
                    <div className="flex items-center justify-center px-6 py-4 bg-stone-950/30">
                        <div className="flex items-center gap-2">
                            {steps.map((step, idx) => {
                                const isActive = step.id === currentStepId;
                                const isPast = idx < currentIndex;

                                return (
                                    <div key={step.id} className="flex items-center">
                                        {/* Step Circle & Label */}
                                        <button
                                            onClick={() => !isSubEditorActive && onStepChange(step.id)}
                                            disabled={isSubEditorActive || isSaving}
                                            className={cn(
                                                "group flex items-center gap-3 px-3 py-1.5 rounded-full transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 cursor-pointer",
                                                isActive ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-stone-900"
                                            )}
                                        >
                                            {/* Circle Indicator */}
                                            <div className={cn(
                                                "flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all border",
                                                isActive
                                                    ? (isSaving ? "border-primary text-primary" : "bg-primary border-primary text-secondary")
                                                    : step.isComplete
                                                        ? "bg-emerald-900/30 border-emerald-700/50 text-emerald-500"
                                                        : "bg-stone-900 border-stone-700 text-stone-500"
                                            )}>
                                                {isActive && isSaving ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : step.isComplete && !isActive ? (
                                                    <Check className="w-3.5 h-3.5" />
                                                ) : (
                                                    <span>{idx + 1}</span>
                                                )}
                                            </div>

                                            {/* Label */}
                                            <span className={cn(
                                                "text-sm font-medium transition-colors",
                                                isActive
                                                    ? "text-primary shadow-sm"
                                                    : step.isComplete
                                                        ? "text-stone-300"
                                                        : "text-stone-500 group-hover:text-stone-300"
                                            )}>
                                                {step.label}
                                            </span>
                                        </button>

                                        {/* Connector Line */}
                                        {idx < steps.length - 1 && (
                                            <div className={cn(
                                                "w-8 h-px mx-2 transition-colors duration-300",
                                                isPast ? "bg-emerald-900/50" : "bg-stone-800"
                                            )} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8 bg-stone-950/50 relative">
                    {/* Hidden Description for Accessibility */}
                    <DialogDescription className="sr-only">
                        {title} - Step {currentIndex + 1} of {steps.length}: {steps[currentIndex].label}
                    </DialogDescription>
                    {children}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between px-8 py-5 border-t border-stone-800 bg-stone-900/80 backdrop-blur-sm">
                    <div className="flex items-center gap-2">
                        {onManualSave && (
                            <Button
                                variant="outline"
                                onClick={onManualSave}
                                disabled={isSaving || isSubEditorActive || !isValid}
                                className={cn(
                                    "border-stone-700 text-stone-300 hover:text-white hover:bg-stone-800 hover:border-stone-600",
                                    !isValid && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                Save
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            onClick={onSaveExit}
                            disabled={isSaving || isSubEditorActive || !isValid}
                            className={cn(
                                "text-stone-400 hover:text-white hover:bg-stone-800",
                                !isValid && "opacity-50 cursor-not-allowed"
                            )}
                        >
                            <Save className="w-4 h-4 mr-2" />
                            Save & Exit
                        </Button>
                        {isSubEditorActive && (
                            <div className="flex items-center gap-2 text-amber-500/80 text-xs px-3 py-1 rounded-md bg-amber-950/20 border border-amber-900/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                Finishing Lore Edit...
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            onClick={handleNext}
                            disabled={isNextDisabled}
                            className={cn(
                                "min-w-[140px] shadow-lg transition-all",
                                isLastStep
                                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-900/20"
                                    : "bg-primary hover:bg-primary/90 text-secondary shadow-primary/20"
                            )}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : isLastStep ? (
                                <>
                                    <Check className="w-4 h-4 mr-2" />
                                    Finish
                                </>
                            ) : (
                                <>
                                    Next: {nextStep?.label}
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
