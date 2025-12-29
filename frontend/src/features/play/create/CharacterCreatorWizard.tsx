
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Wand2 } from 'lucide-react';
import { splitSchema, type SplittedSchema } from './utils/schemaSplitter';
import { Step1_Identity } from './steps/Step1_Identity';
import { Step2_Capabilities } from './steps/Step2_Capabilities';
import { Step3_Personality } from './steps/Step3_Personality';
import { LiveCharacterSheet } from './components/LiveCharacterSheet';
import { apiPost } from '@/lib/api';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface CharacterCreatorWizardProps {
    storyId: string;
    mergedSchema: mergedSchema;
    onCancel: () => void;
}

export default function CharacterCreatorWizard({ storyId, mergedSchema, onCancel }: CharacterCreatorWizardProps) {
    const navigate = useNavigate();

    // 1. Split schema into steps
    const schemaParts = useMemo<SplittedSchema>(() => splitSchema(mergedSchema), [mergedSchema]);

    // 2. Determine active steps (Skip empty steps logic)
    // Always Step 1 (Identity)
    // Step 2 only if capabilities exist
    // Step 3 (Personality) usually exists, but conditional
    const steps = useMemo(() => {
        const _steps = [
            { id: 'identity', label: 'Identity', component: Step1_Identity, schema: schemaParts.identity },
        ];

        if (Object.keys(schemaParts.capabilities).length > 0) {
            _steps.push({ id: 'capabilities', label: 'Capabilities', component: Step2_Capabilities, schema: schemaParts.capabilities });
        }

        _steps.push({ id: 'personality', label: 'Personality', component: Step3_Personality, schema: schemaParts.personality });

        return _steps;
    }, [schemaParts]);

    const [currentStepIdx, setCurrentStepIdx] = useState(0);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const currentStep = steps[currentStepIdx];
    const isFirstStep = currentStepIdx === 0;
    const isLastStep = currentStepIdx === steps.length - 1;

    const updateData = (key: string, value: any) => {
        setFormData(prev => ({ ...prev, [key]: value }));
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

    const validateStep = () => {
        if (currentStep.id === 'identity') {
            if (!formData.name) {
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
            // We need to separate universal fields from tier1_overrides
            const { name, pronouns, appearance, backstory, race_handle, species, archetype_handle, user_role, role, ...overrides } = formData;

            // Map special fields
            // race/species might need to go into overrides depending on backend implementation
            // The prompt says: "tier1_overrides: { ...dynamic_field_values... }"
            // race_handle/archetype_handle are usually top-level Tier 1 properties, so they should go in overrides.

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
                        role: role || archetype_handle // Use either local var
                    },
                    appearance: { description: appearance }, // Backend expects record? Prompt said "appearance": "..." but Schema said z.record. Let's send object.
                    // Wait, Looking at InitializeGameRequestSchema in Backend:
                    // appearance: z.record(z.unknown()).optional()
                    // Prompt said: { "appearance": "..." }
                    // I'll send { description: appearance } to be safe and rich.
                    backstory,
                    // We need to pass the dynamic fields. The Schema has .passthrough() !!
                    // So we can put tier1_overrides at the top level of playerInput?
                    // "allow additional world-specific fields" -> Yes.
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
        <div className="flex h-screen w-full bg-background overflow-hidden">
            {/* Left Panel: Wizard Steps */}
            <div className="flex-1 flex flex-col h-full overflow-y-auto border-r border-border custom-scrollbar">

                {/* Progress Bar */}
                <div className="w-full h-1 bg-secondary sticky top-0 z-10">
                    <div
                        className="h-full bg-primary transition-all duration-300 ease-out"
                        style={{ width: `${((currentStepIdx + 1) / steps.length) * 100}%` }}
                    />
                </div>

                <div className="p-8 pb-32 max-w-2xl mx-auto w-full flex-1 flex flex-col justify-center min-h-[600px]">
                    <div className="mb-8">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                            Step {currentStepIdx + 1} of {steps.length}
                        </span>
                        <h1 className="text-3xl font-extrabold mt-1">{currentStep.label}</h1>
                    </div>

                    <currentStep.component
                        data={formData}
                        updateData={updateData}
                        schema={currentStep.schema}
                    />
                </div>

                {/* Buttom Navigation Bar */}
                <div className="p-6 border-t border-border bg-background/95 backdrop-blur sticky bottom-0 z-10 flex justify-between items-center max-w-2xl mx-auto w-full">
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

            {/* Right Panel: Character Sheet */}
            <div className="hidden lg:block w-[400px] xl:w-[480px] bg-[#121212] p-8 h-full overflow-y-auto custom-scrollbar relative">
                <LiveCharacterSheet data={formData} />
            </div>
        </div>
    );
}

// Add generic styles for custom scrollbar if needed or rely on Tailwind
