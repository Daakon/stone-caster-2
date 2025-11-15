/**
 * Chimera Story Wizard
 * Multi-step form for creating stories
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { chimeraStoriesService, type CreateStoryData } from '@/services/chimera.stories';
import { chimeraWorldsService } from '@/services/chimera.worlds';
import { chimeraService, type RulesetTemplate } from '@/services/admin.chimera';
import { apiFetch } from '@/lib/api';
import { ComplexAssetSelector } from '@/components/chimera/ComplexAssetSelector';

const STEPS = [
  { id: 1, title: 'Basic Info', description: 'Name and description' },
  { id: 2, title: 'Choose World', description: 'Select a world' },
  { id: 3, title: 'Review Rules', description: 'Inherited modifiers' },
  { id: 4, title: 'Main System', description: 'Select main system' },
  { id: 5, title: 'Subsystems', description: 'Add subsystems' },
  { id: 6, title: 'Content Packs', description: 'Add content packs' },
];

interface StoryWizardData {
  display_name: string;
  description_short: string;
  world_id: string | null;
  main_system_id: string | null;
  ruleset_template_ids: string[];
  pack_ids: string[];
}

export default function StoryWizard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [wizardData, setWizardData] = useState<StoryWizardData>({
    display_name: '',
    description_short: '',
    world_id: null,
    main_system_id: null,
    ruleset_template_ids: [],
    pack_ids: [],
  });


  // Load world rulesets when world is selected
  const { data: worldRulesets, isLoading: isLoadingWorldRulesets } = useQuery({
    queryKey: ['chimera-world-rulesets', wizardData.world_id],
    queryFn: async () => {
      if (!wizardData.world_id) return [];
      const result = await apiFetch<RulesetTemplate[]>(`/api/v2/chimera/worlds/${wizardData.world_id}/rulesets`);
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to fetch world rulesets');
      }
      return result.data || [];
    },
    enabled: !!wizardData.world_id && currentStep >= 3,
  });

  // Load all ruleset templates
  const { data: allRulesets, isLoading: isLoadingRulesets } = useQuery({
    queryKey: ['chimera-ruleset-templates'],
    queryFn: () => chimeraService.listRulesetTemplates(),
    staleTime: 5 * 60 * 1000,
  });


  // Filter rulesets by type
  const mainSystemRulesets = (allRulesets || []).filter((r) => r.rule_type === 'MAIN_SYSTEM');
  const subsystemRulesets = (allRulesets || []).filter(
    (r) => r.rule_type === 'SUBSYSTEM' && r.main_system_dependency === wizardData.main_system_id
  );


  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!wizardData.display_name.trim()) {
      toast.error('Please enter a display name');
      return;
    }

    if (!wizardData.main_system_id) {
      toast.error('Please select a main system');
      return;
    }

    setIsSubmitting(true);
    try {
      const createData: CreateStoryData = {
        display_name: wizardData.display_name,
        description_short: wizardData.description_short || null,
        world_id: wizardData.world_id || null,
        ruleset_template_ids: [
          wizardData.main_system_id,
          ...wizardData.ruleset_template_ids.filter((id) => id !== wizardData.main_system_id),
        ],
        pack_ids: wizardData.pack_ids,
      };

      await chimeraStoriesService.createStory(createData);
      toast.success('Story created successfully');
      await queryClient.invalidateQueries({ queryKey: ['chimera-my-stories'] });
      navigate('/dashboard/creations/stories');
    } catch (error) {
      console.error('Error creating story:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create story');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="display_name">Display Name *</Label>
              <Input
                id="display_name"
                value={wizardData.display_name}
                onChange={(e) => setWizardData({ ...wizardData, display_name: e.target.value })}
                placeholder="Enter story name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description_short">Short Description</Label>
              <Textarea
                id="description_short"
                value={wizardData.description_short}
                onChange={(e) => setWizardData({ ...wizardData, description_short: e.target.value })}
                placeholder="Brief description of your story"
                rows={4}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <Label>Select World (Optional)</Label>
            <ComplexAssetSelector
              assetType="world"
              selectedIds={wizardData.world_id ? [wizardData.world_id] : []}
              onSelectionChange={(ids) => setWizardData({ ...wizardData, world_id: ids[0] || null })}
              mode="single"
              emptyMessage="No worlds available. Create one first!"
              itemLabel="world"
              onCreateNew={() => navigate('/dashboard/worlds/new')}
              createNewLabel="Create New World"
            />
            {wizardData.world_id && (
              <Alert>
                <AlertDescription>
                  World selected. You'll review inherited rules in the next step.
                </AlertDescription>
              </Alert>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Inherited Modifiers from World</h3>
              {isLoadingWorldRulesets ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !wizardData.world_id ? (
                <Alert>
                  <AlertDescription>No world selected. No inherited rules.</AlertDescription>
                </Alert>
              ) : !worldRulesets || worldRulesets.length === 0 ? (
                <Alert>
                  <AlertDescription>This world has no linked modifiers.</AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  {worldRulesets.map((ruleset) => (
                    <Card key={ruleset.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{ruleset.display_name}</p>
                            {ruleset.description_short && (
                              <p className="text-sm text-muted-foreground">{ruleset.description_short}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              Category: {ruleset.rule_category}
                            </p>
                          </div>
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <Label>Select Main System *</Label>
            {isLoadingRulesets ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : mainSystemRulesets.length === 0 ? (
              <Alert>
                <AlertDescription>No MAIN_SYSTEM rulesets available.</AlertDescription>
              </Alert>
            ) : (
              <RadioGroup
                value={wizardData.main_system_id || ''}
                onValueChange={(value) => setWizardData({ ...wizardData, main_system_id: value })}
              >
                <div className="space-y-3">
                  {mainSystemRulesets.map((ruleset) => (
                    <div key={ruleset.id} className="flex items-start space-x-3">
                      <RadioGroupItem value={ruleset.id} id={`main-${ruleset.id}`} />
                      <Label htmlFor={`main-${ruleset.id}`} className="flex-1 cursor-pointer">
                        <div>
                          <p className="font-medium">{ruleset.display_name}</p>
                          {ruleset.description_short && (
                            <p className="text-sm text-muted-foreground">{ruleset.description_short}</p>
                          )}
                        </div>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            )}
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <div>
              <Label>Add Subsystems</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Select subsystems that depend on your chosen main system.
              </p>
            </div>
            {!wizardData.main_system_id ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>Please select a main system first.</AlertDescription>
              </Alert>
            ) : isLoadingRulesets ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : subsystemRulesets.length === 0 ? (
              <Alert>
                <AlertDescription>No subsystems available for the selected main system.</AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3 border rounded-lg p-4 max-h-96 overflow-y-auto">
                {subsystemRulesets.map((ruleset) => {
                  const isChecked = wizardData.ruleset_template_ids.includes(ruleset.id);
                  return (
                    <div key={ruleset.id} className="flex items-start space-x-3">
                      <Checkbox
                        id={`sub-${ruleset.id}`}
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setWizardData({
                              ...wizardData,
                              ruleset_template_ids: [...wizardData.ruleset_template_ids, ruleset.id],
                            });
                          } else {
                            setWizardData({
                              ...wizardData,
                              ruleset_template_ids: wizardData.ruleset_template_ids.filter((id) => id !== ruleset.id),
                            });
                          }
                        }}
                      />
                      <Label htmlFor={`sub-${ruleset.id}`} className="flex-1 cursor-pointer">
                        <div>
                          <p className="font-medium">{ruleset.display_name}</p>
                          {ruleset.description_short && (
                            <p className="text-sm text-muted-foreground">{ruleset.description_short}</p>
                          )}
                        </div>
                      </Label>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <div>
              <Label>Add Content Packs (Optional)</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Select content packs to include. Packs provide additional rulesets, entities, and lore.
              </p>
            </div>
            <ComplexAssetSelector
              assetType="pack"
              selectedIds={wizardData.pack_ids}
              onSelectionChange={(ids) => setWizardData({ ...wizardData, pack_ids: ids })}
              mode="multi"
              emptyMessage="No content packs available. Create one first!"
              itemLabel="content pack"
              onCreateNew={() => navigate('/dashboard/packs/new')}
              createNewLabel="Create New Content Pack"
            />
          </div>
        );

      default:
        return <div>Unknown step</div>;
    }
  };

  const progress = (currentStep / STEPS.length) * 100;
  const canProceed = currentStep === 1 ? wizardData.display_name.trim() : true;
  const isLastStep = currentStep === STEPS.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/creations/stories')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Create New Story</h1>
          <p className="text-muted-foreground mt-2">Step {currentStep} of {STEPS.length}</p>
        </div>
      </div>

      <div className="space-y-4">
        <Progress value={progress} className="h-2" />
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          {STEPS.map((step) => (
            <div key={step.id} className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step.id < currentStep
                    ? 'bg-green-600 text-white'
                    : step.id === currentStep
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {step.id < currentStep ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <span>{step.id}</span>
                )}
              </div>
              <span className="mt-1 text-xs text-center max-w-20">{step.title}</span>
            </div>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[currentStep - 1].title}</CardTitle>
          <CardDescription>{STEPS[currentStep - 1].description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {renderStep()}

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            {isLastStep ? (
              <Button onClick={handleSubmit} disabled={isSubmitting || !canProceed}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Story'
                )}
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={!canProceed}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

