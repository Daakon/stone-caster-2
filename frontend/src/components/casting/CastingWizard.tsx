/**
 * CastingWizard Component
 * Phase 3-C: Guided Wizard Flow & Logic Integration
 * Linear wizard flow: Intent -> World -> Forces -> Review
 */

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, ArrowRight, Loader2, Sparkles, AlertTriangle, Zap } from 'lucide-react';
import { getWorlds, getRulesets, getEntities, compileStory } from '@/services/chimera-api';
import { startGame } from '@/services/game-client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import type { WorldDefinition, RulesetDefinition, EntityTemplate } from '@shared/types/chimera-authoring';
import { useCastingStore, type WizardStep, type IntentGenre } from '@/stores/useCastingStore';
import { WizardStepIntent } from './WizardStepIntent';
import { RulesetSelector } from './RulesetSelector';

const STEPS: WizardStep[] = ['intent', 'world', 'forces', 'review'];
const STEP_LABELS: Record<WizardStep, string> = {
  intent: 'Intent',
  world: 'World Stone',
  forces: 'Forces Stone',
  review: 'Review',
};

export function CastingWizard() {
  const navigate = useNavigate();
  const [isCompiling, setIsCompiling] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [hasAutoPopulated, setHasAutoPopulated] = useState(false);

  const store = useCastingStore();
  const {
    currentStep,
    intent,
    worldId,
    selectedRulesetIds,
    entityIds,
    selectedFoundationId,
    setIntent,
    setStep,
    setWorld,
    validateDependencies,
    autoSelectDefaults,
  } = store;

  const currentStepIndex = STEPS.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  // Fetch data
  const { data: worlds, isLoading: isLoadingWorlds } = useQuery({
    queryKey: ['chimera-worlds'],
    queryFn: () => getWorlds(),
    staleTime: 30 * 1000,
  });

  const { data: rulesets, isLoading: isLoadingRulesets } = useQuery({
    queryKey: ['chimera-rulesets'],
    queryFn: () => getRulesets(),
    staleTime: 30 * 1000,
  });

  const { data: entities, isLoading: isLoadingEntities } = useQuery({
    queryKey: ['chimera-entities'],
    queryFn: () => getEntities(),
    staleTime: 30 * 1000,
  });

  // Filter worlds by intent
  const filteredWorlds = useMemo(() => {
    if (!worlds) return [];
    if (!intent || intent === 'custom') return worlds;

    // Filter worlds by genre tags (assuming worlds have tags or genre metadata)
    return worlds.filter((world) => {
      const worldDef = world as any;
      const tags = worldDef.tags || [];
      const genre = worldDef.genre || '';
      
      // Match intent to tags/genre
      const intentMap: Record<IntentGenre, string[]> = {
        'high-fantasy': ['fantasy', 'high-fantasy', 'magic', 'medieval'],
        'sci-fi': ['sci-fi', 'science-fiction', 'space', 'futuristic', 'technology'],
        'horror': ['horror', 'dark', 'gothic', 'thriller'],
        'survival': ['survival', 'post-apocalyptic', 'resource-management'],
        'custom': [],
      };

      const matchingTags = intentMap[intent] || [];
      return matchingTags.some((tag) => 
        tags.some((t: string) => t.toLowerCase().includes(tag.toLowerCase())) ||
        genre.toLowerCase().includes(tag.toLowerCase())
      );
    });
  }, [worlds, intent]);

  // Handle intent selection
  const handleIntentSelect = (selectedIntent: IntentGenre) => {
    setIntent(selectedIntent);
    setStep('world');
  };

  // Handle world selection
  const handleWorldSelect = (selectedWorldId: string) => {
    const world = worlds?.find((w) => w.id === selectedWorldId);
    if (world) {
      setWorld(selectedWorldId, worlds || [], rulesets || []);
    }
  };

  // Handle Quick Start
  const handleQuickStart = () => {
    if (!worldId || !worlds || !rulesets) {
      toast.error('Please select a world first');
      return;
    }

    const world = worlds.find((w) => w.id === worldId);
    if (world) {
      // Auto-populate defaults
      autoSelectDefaults(world, rulesets);
      setHasAutoPopulated(true);
      // Skip to review
      setStep('review');
    }
  };

  // Handle navigation
  const handleNext = () => {
    // Gatekeeping logic
    if (currentStep === 'world') {
      if (!worldId) {
        toast.error('Please select a world to continue');
        return;
      }
      // Auto-populate defaults when moving from world to forces
      if (!hasAutoPopulated && worlds && rulesets) {
        const world = worlds.find((w) => w.id === worldId);
        if (world) {
          autoSelectDefaults(world, rulesets);
          setHasAutoPopulated(true);
        }
      }
      setStep('forces');
    } else if (currentStep === 'forces') {
      // Validate dependencies before proceeding
      if (!rulesets) {
        toast.error('Rulesets not loaded');
        return;
      }
      const validation = validateDependencies(selectedRulesetIds, rulesets);
      if (!validation.valid) {
        toast.error('Please resolve dependency errors before continuing');
        return;
      }
      if (!selectedFoundationId) {
        toast.error('Please select a foundation ruleset');
        return;
      }
      setStep('review');
    } else if (currentStep === 'intent') {
      if (!intent) {
        toast.error('Please select an intent');
        return;
      }
      setStep('world');
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      setStep(STEPS[currentStepIndex - 1]);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'intent':
        return intent !== null;
      case 'world':
        return worldId !== null;
      case 'forces':
        if (!rulesets) return false;
        const validation = validateDependencies(selectedRulesetIds, rulesets);
        return validation.valid && selectedFoundationId !== null;
      case 'review':
        return worldId !== null && selectedFoundationId !== null && selectedRulesetIds.size > 0;
      default:
        return false;
    }
  };

  // Check for dependency errors
  const dependencyErrors = useMemo(() => {
    if (!rulesets || currentStep !== 'forces') return null;
    const validation = validateDependencies(selectedRulesetIds, rulesets);
    return validation.valid ? null : validation.errors;
  }, [rulesets, selectedRulesetIds, currentStep, validateDependencies]);

  const handleStartGame = async () => {
    if (!worldId || selectedRulesetIds.size === 0) {
      toast.error('Please select a world and at least one ruleset');
      return;
    }

    setIsCompiling(true);
    try {
      const compileResult = await compileStory({
        worldId,
        rulesetIds: Array.from(selectedRulesetIds),
        entityIds: Array.from(entityIds),
      });

      setIsCompiling(false);
      setIsStarting(true);

      const gameResult = await startGame(compileResult.compiledStoryId);

      toast.success('Game started!');
      navigate(`/play/${gameResult.gameStateId}`);
    } catch (error) {
      console.error('Error starting game:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to start game');
      setIsCompiling(false);
      setIsStarting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'intent':
        return <WizardStepIntent selectedIntent={intent} onSelectIntent={handleIntentSelect} />;
      case 'world':
        return (
          <WorldStep
            worlds={filteredWorlds}
            selectedWorldId={worldId}
            onSelect={handleWorldSelect}
            onQuickStart={handleQuickStart}
            canQuickStart={!!worldId}
          />
        );
      case 'forces':
        return (
          <ForcesStep
            rulesets={rulesets || []}
            selectedRulesetIds={selectedRulesetIds}
            onSelectionChange={() => {}}
            dependencyErrors={dependencyErrors}
          />
        );
      case 'review':
        return (
          <ReviewStep
            worldId={worldId}
            rulesetIds={selectedRulesetIds}
            entityIds={entityIds}
            worlds={worlds || []}
            rulesets={rulesets || []}
            entities={entities || []}
          />
        );
      default:
        return null;
    }
  };

  const isLoading = isLoadingWorlds || isLoadingRulesets || isLoadingEntities;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-6 w-6 text-purple-500" />
          <h1 className="text-3xl font-bold">The Casting Circle</h1>
        </div>
        <p className="text-muted-foreground">
          Create a new game configuration through a guided wizard
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span>Step {currentStepIndex + 1} of {STEPS.length}</span>
          <span>{STEP_LABELS[currentStep]}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step Content */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {renderStep()}

          {/* Navigation */}
          <div className="flex justify-between mt-6">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStepIndex === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            {currentStep !== 'review' ? (
              <Button onClick={handleNext} disabled={!canProceed()}>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleStartGame}
                disabled={!canProceed() || isCompiling || isStarting}
              >
                {isCompiling || isStarting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isCompiling ? 'Compiling...' : 'Starting...'}
                  </>
                ) : (
                  'Start Game'
                )}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// World Step Component
function WorldStep({
  worlds,
  selectedWorldId,
  onSelect,
  onQuickStart,
  canQuickStart,
}: {
  worlds: WorldDefinition[];
  selectedWorldId: string | null;
  onSelect: (id: string) => void;
  onQuickStart: () => void;
  canQuickStart: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Step 1: World Stone</CardTitle>
            <CardDescription>Select the world for your game</CardDescription>
          </div>
          {canQuickStart && (
            <Button variant="outline" onClick={onQuickStart} className="gap-2">
              <Zap className="h-4 w-4" />
              Quick Start
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {worlds.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {worlds.map((world) => {
              const isSelected = selectedWorldId === world.id;
              return (
                <Card
                  key={world.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    isSelected ? 'ring-2 ring-purple-500 ring-offset-2' : ''
                  }`}
                  onClick={() => onSelect(world.id)}
                >
                  {world.images && world.images.length > 0 && world.images[0]?.path ? (
                    <div className="aspect-video bg-muted relative">
                      <img
                        src={world.images[0].path}
                        alt={world.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-muted flex items-center justify-center">
                      <span className="text-muted-foreground text-sm">No image</span>
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="line-clamp-1">{world.name}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {world.description || 'No description'}
                    </CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No worlds available
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Forces Step Component
function ForcesStep({
  rulesets,
  selectedRulesetIds,
  onSelectionChange,
  dependencyErrors,
}: {
  rulesets: RulesetDefinition[];
  selectedRulesetIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  dependencyErrors: Array<{ ruleset: RulesetDefinition; missing: string[] }> | null;
}) {
  return (
    <div className="space-y-4">
      {dependencyErrors && dependencyErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Dependency Errors</AlertTitle>
          <AlertDescription>
            Please resolve these dependency issues before continuing:
            <ul className="list-disc list-inside mt-2 space-y-1">
              {dependencyErrors.map(({ ruleset, missing }) => (
                <li key={ruleset.id}>
                  <strong>{ruleset.name}</strong> requires:{' '}
                  {missing
                    .map((id) => {
                      const dep = rulesets.find((r) => r.id === id || r.name === id);
                      return dep?.name || id;
                    })
                    .join(', ')}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Step 2: Forces Stone</CardTitle>
          <CardDescription>Select the rulesets that will govern your game</CardDescription>
        </CardHeader>
        <CardContent>
          <RulesetSelector
            rulesets={rulesets}
            selectedRulesetIds={selectedRulesetIds}
            onSelectionChange={onSelectionChange}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// Review Step Component
function ReviewStep({
  worldId,
  rulesetIds,
  entityIds,
  worlds,
  rulesets,
  entities,
}: {
  worldId: string | null;
  rulesetIds: Set<string>;
  entityIds: Set<string>;
  worlds: WorldDefinition[];
  rulesets: RulesetDefinition[];
  entities: EntityTemplate[];
}) {
  const selectedWorld = worlds.find((w) => w.id === worldId);
  const selectedRulesets = rulesets.filter((r) => rulesetIds.has(r.id));
  const selectedEntities = entities.filter((e) => entityIds.has(e.id));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 3: Review</CardTitle>
        <CardDescription>Review your configuration before compiling</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Selected World</h3>
            <p className="text-sm text-muted-foreground">
              {selectedWorld ? selectedWorld.name : 'None selected'}
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Selected Rulesets ({selectedRulesets.length})</h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              {selectedRulesets.map((r) => (
                <li key={r.id}>{r.name} ({r.ui_category})</li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Selected Entities ({selectedEntities.length})</h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              {selectedEntities.map((e) => (
                <li key={e.id}>
                  {e.kind} ({e.id.substring(0, 8)}...)
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

