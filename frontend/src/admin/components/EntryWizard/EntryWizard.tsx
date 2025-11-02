import { useState, useEffect } from 'react';
import { EntryPoint } from '@/services/admin.entryPoints';
import { BasicsStep } from './Steps/BasicsStep';
import { NPCsStep } from './Steps/NPCsStep';
import { PreviewStep } from './Steps/PreviewStep';

export interface WizardData {
  // Step 1: Basics
  name?: string;
  slug?: string;
  worldId?: string;
  rulesetIds?: string[];
  
  // Step 2: NPCs
  npcIds?: string[];
  
  // Step 3: Segments (read-only, for display)
  segments?: Array<{
    scope: string;
    refId: string;
    count: number;
    missing: boolean;
  }>;
  
  // Step 4: Preview
  previewData?: any;
}

interface EntryWizardProps {
  entry: EntryPoint;
  currentStep: number;
  onStepComplete: (stepData: any) => void;
  onDirtyChange: (dirty: boolean) => void;
}

export function EntryWizard({ 
  entry, 
  currentStep, 
  onStepComplete, 
  onDirtyChange 
}: EntryWizardProps) {
  const [wizardData, setWizardData] = useState<WizardData>({});
  const [isDirty, setIsDirty] = useState(false);
  
  // Initialize wizard data from entry
  useEffect(() => {
    if (entry) {
      setWizardData({
        name: entry.name,
        slug: entry.slug,
        worldId: entry.world_id,
        rulesetIds: [], // Will be loaded separately
        npcIds: [], // Will be loaded separately
      });
    }
  }, [entry]);
  
  // Update dirty state
  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);
  
  const updateWizardData = (updates: Partial<WizardData>) => {
    setWizardData(prev => ({ ...prev, ...updates }));
    setIsDirty(true);
  };
  
  const handleStepComplete = (stepData: any) => {
    updateWizardData(stepData);
    setIsDirty(false);
    onStepComplete(stepData);
  };
  
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <BasicsStep
            entry={entry}
            data={wizardData}
            onUpdate={updateWizardData}
            onComplete={handleStepComplete}
          />
        );
      case 1:
        return (
          <NPCsStep
            entry={entry}
            data={wizardData}
            onUpdate={updateWizardData}
            onComplete={handleStepComplete}
          />
        );
      case 2:
        return (
          <PreviewStep
            entry={entry}
            data={wizardData}
            onUpdate={updateWizardData}
            onComplete={handleStepComplete}
          />
        );
      default:
        return <div>Unknown step</div>;
    }
  };
  
  return (
    <div className="space-y-6">
      {renderStep()}
    </div>
  );
}
