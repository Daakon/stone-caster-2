import React, { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import type { PlayerV3, WorldCharacterConfig } from '@shared';
import { 
  DEFAULT_CHARACTER_CREATION_CONFIG, 
  SKILL_CONSTANTS, 
  getWorldConfig,
  getRemainingSkillPoints
} from '@shared/config/character-creation.config';
import { IdentityStep } from './wizard/IdentityStep.tsx';
import { TraitsStep } from './wizard/TraitsStep.tsx';
import { SkillsStep } from './wizard/SkillsStep.tsx';
import { SummaryStep } from './wizard/SummaryStep.tsx';
import { createPlayerV3 } from '../../lib/api';

interface PlayerV3WizardProps {
  worldSlug: string;
  onCharacterCreated: (character: PlayerV3) => void;
  onCancel: () => void;
}

type WizardStep = 'identity' | 'traits' | 'skills' | 'summary';

const STEPS: WizardStep[] = ['identity', 'traits', 'skills', 'summary'];

export const PlayerV3Wizard: React.FC<PlayerV3WizardProps> = ({
  worldSlug,
  onCharacterCreated,
  onCancel
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Partial<PlayerV3>>({
    id: crypto.randomUUID(),
    name: '',
    role: '',
    race: '',
    essence: [],
    age: '',
    build: '',
    eyes: '',
    traits: [],
    skills: {
      combat: SKILL_CONSTANTS.BASELINE,
      stealth: SKILL_CONSTANTS.BASELINE,
      social: SKILL_CONSTANTS.BASELINE,
      lore: SKILL_CONSTANTS.BASELINE,
      survival: SKILL_CONSTANTS.BASELINE,
      medicine: SKILL_CONSTANTS.BASELINE,
      craft: SKILL_CONSTANTS.BASELINE
    },
    relationships: {},
    goals: { short_term: [], long_term: [] },
    flags: {},
    reputation: {}
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Get world config based on worldSlug
  const worldConfig: WorldCharacterConfig = getWorldConfig(worldSlug);

  const createPlayerMutation = useMutation({
    mutationFn: async (player: PlayerV3) => {
      const result = await createPlayerV3(worldSlug, player);
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to create character');
      }
      return result.data;
    },
    onSuccess: (data) => {
      onCharacterCreated(data.player);
    }
  });

  const updateFormData = useCallback((updates: Partial<PlayerV3>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    // Clear errors when data changes
    setErrors({});
  }, []);


  const handleNext = () => {
    const step = STEPS[currentStep];
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 'identity':
        if (!formData.name?.trim()) newErrors.name = 'Name is required';
        if (!formData.role?.trim()) newErrors.role = 'Role is required';
        if (!formData.race?.trim()) newErrors.race = 'Race is required';
        if (!formData.essence?.length || formData.essence.length !== 2) newErrors.essence = 'Exactly 2 essences are required';
        if (!formData.age?.trim()) newErrors.age = 'Age is required';
        if (!formData.build?.trim()) newErrors.build = 'Build is required';
        if (!formData.eyes?.trim()) newErrors.eyes = 'Eyes is required';
        break;
        
      case 'traits':
        if (!formData.traits?.length || formData.traits.length < DEFAULT_CHARACTER_CREATION_CONFIG.traitCount.min) {
          newErrors.traits = `Select at least ${DEFAULT_CHARACTER_CREATION_CONFIG.traitCount.min} traits`;
        }
        if (formData.traits && formData.traits.length > DEFAULT_CHARACTER_CREATION_CONFIG.traitCount.max) {
          newErrors.traits = `Select no more than ${DEFAULT_CHARACTER_CREATION_CONFIG.traitCount.max} traits`;
        }
        break;
        
      case 'skills':
        if (!formData.skills) {
          newErrors.skills = 'Skills are required';
        } else {
          const remainingPoints = getRemainingSkillPoints(formData.skills, DEFAULT_CHARACTER_CREATION_CONFIG.skillBudget);
          if (remainingPoints !== 0) {
            newErrors.skills = `You have ${remainingPoints} points remaining to allocate`;
          }
        }
        break;
        
    }

    setErrors(newErrors);
    
    if (Object.keys(newErrors).length === 0) {
      if (currentStep < STEPS.length - 1) {
        setCurrentStep(prev => prev + 1);
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};

    // Final validation
    if (!formData.name || !formData.role || !formData.race || !formData.essence?.length) {
      newErrors.general = 'Please complete all required fields';
    }

    setErrors(newErrors);
    
    if (Object.keys(newErrors).length === 0) {
      const player: PlayerV3 = {
        id: formData.id!,
        name: formData.name!,
        role: formData.role!,
        race: formData.race!,
        essence: formData.essence!,
        age: formData.age!,
        build: formData.build!,
        eyes: formData.eyes!,
        traits: formData.traits!,
        backstory: formData.backstory,
        motivation: formData.motivation,
        skills: formData.skills!,
        inventory: [],
        relationships: {},
        goals: { short_term: [], long_term: [] },
        flags: {},
        reputation: {}
      };

      createPlayerMutation.mutate(player);
    }
  };

  const renderCurrentStep = () => {
    const step = STEPS[currentStep];
    
    switch (step) {
      case 'identity':
        return (
          <IdentityStep
            data={formData}
            worldConfig={worldConfig}
            onChange={updateFormData}
            errors={errors}
          />
        );
      case 'traits':
        return (
          <TraitsStep
            data={formData}
            worldConfig={worldConfig}
            onChange={updateFormData}
            errors={errors}
          />
        );
      case 'skills':
        return (
          <SkillsStep
            data={formData}
            config={DEFAULT_CHARACTER_CREATION_CONFIG}
            onChange={updateFormData}
            errors={errors}
          />
        );
      case 'summary':
        return (
          <SummaryStep
            data={formData as PlayerV3}
            worldConfig={worldConfig}
          />
        );
      default:
        return null;
    }
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;
  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">Create Your Character</CardTitle>
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Step {currentStep + 1} of {STEPS.length}</span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardHeader>
        <CardContent>
          {renderCurrentStep()}
          
          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
            
            {isLastStep ? (
              <Button
                onClick={handleSubmit}
                disabled={createPlayerMutation.isPending}
              >
                {createPlayerMutation.isPending ? (
                  'Creating...'
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Create Character
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
