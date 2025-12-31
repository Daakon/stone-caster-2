
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Wand2 } from 'lucide-react';
import { useForm, FormProvider } from 'react-hook-form';
import { splitSchema, type SplittedSchema } from './utils/schemaSplitter';
import { Step1_Identity } from './steps/Step1_Identity';
import { Step2_Attributes } from './steps/Step2_Attributes';
import { Step3_Personality } from './steps/Step3_Personality';
import { LiveCharacterSheet } from './components/LiveCharacterSheet';
import { apiPost } from '@/lib/api';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface CharacterCreatorWizardProps {
    storyId: string;
    mergedSchema: any; // Tier1Schema
    activeRulesets?: any[];
    onCancel: () => void;
}

export default function CharacterCreatorWizard({ storyId, mergedSchema, activeRulesets = [], onCancel }: CharacterCreatorWizardProps) {
    const navigate = useNavigate();

    // 1. Split schema into steps
    const schemaParts = useMemo<SplittedSchema>(() => splitSchema(mergedSchema), [mergedSchema]);

    // Debug logging
    console.log('[Wizard] Active Rulesets:', activeRulesets);
    console.log('[Wizard] Schema Capabilities:', Object.keys(schemaParts.capabilities));

    // 2. Determine active steps (Skip empty steps logic)
    // Always Step 1 (Identity)
    // Step 2 only if capabilities exist OR if we have active rulesets (to show empty state/debug)
    // Step 3 (Personality) usually exists, but conditional
    const steps = useMemo(() => {
        const _steps: { id: string; label: string; component: any; schema: any; extraProps?: any }[] = [
            { id: 'identity', label: 'Identity', component: Step1_Identity, schema: schemaParts.identity },
        ];

        if (Object.keys(schemaParts.capabilities).length > 0 || (activeRulesets && activeRulesets.length > 0)) {
            _steps.push({
                id: 'capabilities',
                label: 'Attributes',
                component: Step2_Attributes,
                schema: schemaParts.capabilities,
                extraProps: { activeRulesets }
            });
        }

        _steps.push({ id: 'personality', label: 'Personality', component: Step3_Personality, schema: schemaParts.personality });

        return _steps;
    }, [schemaParts, activeRulesets]);

    const [currentStepIdx, setCurrentStepIdx] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initialize React Hook Form
    const methods = useForm<Record<string, any>>({
        mode: 'onChange',
        defaultValues: {
            // Can extract defaults from schema if needed
        }
    });

    // Sync formData for LiveCharacterSheet (optional, can use watch() inside Sheet)
    const formData = methods.watch();

    const currentStep = steps[currentStepIdx];
    const isFirstStep = currentStepIdx === 0;
    const isLastStep = currentStepIdx === steps.length - 1;

    // Helper to update specific fields manually if needed (legacy compat)
    const updateData = (key: string, value: any) => {
        methods.setValue(key, value, { shouldValidate: true, shouldDirty: true });
    };

    const handleNext = () => {
        if (!validateStep()) return;
        if (isLastStep) {
            handleSubmit();
        } else {
            setCurrentStepIdx(prev => prev + 1);
        }
    };

    const handleBack = () => {
        if (isFirstStep) {
            onCancel();
        } else {
            setCurrentStepIdx(prev => prev - 1);
        }
    };

    const validateStep = async () => {
        // Trigger validation for current step fields if possible
        // For MVP, we'll do simple checks or rely on form state
        if (currentStep.id === 'identity') {
            const name = methods.getValues('name');
            if (!name) {
                toast.error("Name required", { description: "Please give your character a name." });
                return false;
            }
        }
        return true;
    };

    const handleSubmit = async () => {
        try {
            setIsSubmitting(true);

            // Construct payload matching InitializeGameRequestSchema
            const allData = methods.getValues() as any;
            const { name, pronouns, appearance, backstory, race_handle, species, archetype_handle, user_role, role, ...overrides } = allData;

            // Map special fields
            const tier1_overrides = { ...overrides };
            if (race_handle) tier1_overrides.race_handle = race_handle;
            if (species) tier1_overrides.species = species;
            if (archetype_handle) tier1_overrides.archetype_handle = archetype_handle;
            if (role) tier1_overrides.role = role;

            const payload = {
                storyId,
                playerInput: {
                    identity: {
                        name,
                        pronouns,
                        role: role || archetype_handle
                    },
                    appearance: { description: appearance },
                    backstory,
                    ...tier1_overrides
                }
            };

            const result = await apiPost<{ id: string }>('/api/chimera/game/init', payload);

            if (!result.ok) {
                throw new Error(result.error.message);
            }

            toast.success("Adventure begins!", { description: "Your character has been created." });
            navigate(`/play/${result.data.id}`); // Correct navigation to Game Page

        } catch (error: any) {
            console.error('Submission error', error);
            toast.error("Error", { description: error.message || "Failed to create character" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex h-[calc(100vh-3.5rem)] md:h-screen w-full bg-background overflow-hidden flex-col md:flex-row">
            {/* Left Panel: Wizard Steps */}
            <div className="flex-1 flex flex-col min-h-0 border-r border-border">

                {/* Progress Bar */}
                <div className="w-full h-1 bg-secondary shrink-0">
                    <div
                        className="h-full bg-primary transition-all duration-300 ease-out"
                        style={{ width: `${((currentStepIdx + 1) / steps.length) * 100}%` }}
                    />
                </div>

                {/* Scrollable Content Area */}
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-8">
                    <div className="max-w-2xl mx-auto w-full flex flex-col min-h-[500px]">
                        <div className="mb-8">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                Step {currentStepIdx + 1} of {steps.length}
                            </span>
                            <h1 className="text-3xl font-extrabold mt-1">{currentStep.label}</h1>
                        </div>

                        <FormProvider {...methods}>
                            <form onSubmit={methods.handleSubmit(handleSubmit)}>
                                <currentStep.component
                                    data={formData}
                                    updateData={updateData}
                                    schema={currentStep.schema as any}
                                    {...(currentStep.extraProps || {})}
                                />
                            </form>
                        </FormProvider>
                    </div>
                </div>

                {/* Bottom Navigation Bar */}
                <div className="p-6 border-t border-border bg-background/95 backdrop-blur shrink-0 pb-8 flex justify-between items-center w-full">
                    <div className="max-w-2xl mx-auto w-full flex justify-between items-center">
                        <Button
                            variant="ghost"
                            onClick={handleBack}
                            disabled={isSubmitting}
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" /> {isFirstStep ? 'Cancel' : 'Back'}
                        </Button>

                        <Button
                            size="lg"
                            onClick={handleNext}
                            disabled={isSubmitting}
                            className={isLastStep ? 'bg-amber-600 hover:bg-amber-700' : ''}
                        >
                            {isLastStep ? (
                                <>Begin Adventure <Wand2 className="ml-2 h-4 w-4" /></>
                            ) : (
                                <>Next Step <ArrowRight className="ml-2 h-4 w-4" /></>
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Right Panel: Character Sheet */}
            <div className="hidden lg:block w-[400px] xl:w-[480px] bg-[#121212] p-8 h-full overflow-y-auto custom-scrollbar relative">
                <LiveCharacterSheet data={formData} />
            </div>
        </div>
    );
}

// Add generic styles for custom scrollbar if needed or rely on Tailwind
