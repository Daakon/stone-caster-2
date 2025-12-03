// [CHIMERA V3] Architecture: Greenfield | Layer: Frontend
/**
 * Casting Circle Wizard
 * Multi-step wizard for creating a new game configuration
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { getWorlds, getRulesets, getEntities, compileStory } from '@/services/chimera-api';
import { startGame } from '@/services/game-client';
import { ForcesSelector } from '@/components/chimera/ForcesSelector';
import { WorldCard } from '@/components/casting/WorldCard';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import type { WorldDefinition, RulesetDefinition, EntityTemplate } from '@shared/types/chimera-authoring';
import { useCastingStore } from '@/stores/useCastingStore';

type WizardStep = 'world' | 'forces' | 'elements' | 'summary';

interface WizardState {
  worldId: string | null;
  rulesetIds: Set<string>;
  entityIds: Set<string>;
}

const STEPS: WizardStep[] = ['world', 'forces', 'elements', 'summary'];
const STEP_LABELS: Record<WizardStep, string> = {
  world: 'World Stone',
  forces: 'Forces Stone',
  elements: 'Elements Stone',
  summary: 'Summary',
};

export default function CastingCircleWizard() {
  const navigate = useNavigate();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Use casting store for state management
  const store = useCastingStore();
  const { worldId, selectedRulesetIds, entityIds, setWorld, toggleEntity } = store;

  const currentStep = STEPS[currentStepIndex];
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

  // Sync store with world selection
  const handleWorldSelect = (worldId: string) => {
    setWorld(worldId, worlds || [], rulesets || []);
  };

  // Sync store with ruleset changes from ForcesSelector
  const handleRulesetsChange = (rulesetIds: Set<string>) => {
    // The store already manages this, but we need to ensure sync
    // ForcesSelector will call store methods directly
  };

  const handleEntityToggle = (entityId: string, checked: boolean) => {
    if (checked) {
      toggleEntity(entityId);
    } else {
      toggleEntity(entityId); // Toggle removes if already selected
    }
  };

  // Sync store state to local state for compatibility
  const state: WizardState = {
    worldId,
    rulesetIds: selectedRulesetIds,
    entityIds,
  };

  const handleNext = () => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'world':
        return state.worldId !== null;
      case 'forces':
        // Must have at least one foundation selected
        return store.selectedFoundationId !== null && state.rulesetIds.size > 0;
      case 'elements':
        return true; // Elements are optional
      case 'summary':
        return state.worldId !== null && store.selectedFoundationId !== null && state.rulesetIds.size > 0;
      default:
        return false;
    }
  };

  const handleStartGame = async () => {
    if (!state.worldId || state.rulesetIds.size === 0) {
      toast.error('Please select a world and at least one ruleset');
      return;
    }

    setIsCompiling(true);
    try {
      // Step 1: Compile the story
      const compileResult = await compileStory({
        worldId: state.worldId,
        rulesetIds: Array.from(state.rulesetIds),
        entityIds: Array.from(state.entityIds),
      });

      setIsCompiling(false);
      setIsStarting(true);

      // Step 2: Start the game
      const gameResult = await startGame(compileResult.compiledStoryId);

      toast.success('Game started!');
      navigate(`/play/${gameResult.gameStateId}`);
    } catch (error) {
      console.error('Error starting game:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to start game'
      );
      setIsCompiling(false);
      setIsStarting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'world':
        return <WorldStoneStep worlds={worlds || []} selectedWorldId={state.worldId} onSelect={handleWorldSelect} />;
      case 'forces':
        return (
          <ForcesStoneStep
            rulesets={rulesets || []}
            selectedRulesetIds={state.rulesetIds}
            onSelectionChange={handleRulesetsChange}
          />
        );
      case 'elements':
        return (
          <ElementsStoneStep
            entities={entities || []}
            selectedEntityIds={state.entityIds}
            onToggle={handleEntityToggle}
          />
        );
      case 'summary':
        return <SummaryStep state={state} worlds={worlds || []} rulesets={rulesets || []} entities={entities || []} />;
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
          Create a new game configuration by selecting your world, forces, and elements
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
            {currentStep !== 'summary' ? (
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

function WorldStoneStep({
  worlds,
  selectedWorldId,
  onSelect,
}: {
  worlds: WorldDefinition[];
  selectedWorldId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 1: World Stone</CardTitle>
        <CardDescription>Select the world for your game</CardDescription>
      </CardHeader>
      <CardContent>
        {worlds.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {worlds.map((world) => (
              <WorldCard
                key={world.id}
                world={world}
                isSelected={selectedWorldId === world.id}
                onClick={() => onSelect(world.id)}
              />
            ))}
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

function ForcesStoneStep({
  rulesets,
  selectedRulesetIds,
  onSelectionChange,
}: {
  rulesets: RulesetDefinition[];
  selectedRulesetIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 2: Forces Stone</CardTitle>
        <CardDescription>Select the rulesets that will govern your game</CardDescription>
      </CardHeader>
      <CardContent>
        <ForcesSelector
          rulesets={rulesets}
          selectedRulesetIds={selectedRulesetIds}
          onSelectionChange={onSelectionChange}
        />
      </CardContent>
    </Card>
  );
}

function ElementsStoneStep({
  entities,
  selectedEntityIds,
  onToggle,
}: {
  entities: EntityTemplate[];
  selectedEntityIds: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 3: Elements Stone</CardTitle>
        <CardDescription>Select entities to include in your game</CardDescription>
      </CardHeader>
      <CardContent>
        {entities.length > 0 ? (
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {entities.map((entity) => {
              const isSelected = selectedEntityIds.has(entity.id);
              return (
                <div key={entity.id} className="flex items-start space-x-3">
                  <Checkbox
                    id={`entity-${entity.id}`}
                    checked={isSelected}
                    onCheckedChange={(checked) => onToggle(entity.id, checked === true)}
                  />
                  <Label
                    htmlFor={`entity-${entity.id}`}
                    className="flex-1 cursor-pointer font-normal"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{entity.kind}</span>
                      <span className="text-muted-foreground text-sm font-mono">
                        {entity.id}
                      </span>
                    </div>
                  </Label>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No entities available
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryStep({
  state,
  worlds,
  rulesets,
  entities,
}: {
  state: WizardState;
  worlds: WorldDefinition[];
  rulesets: RulesetDefinition[];
  entities: EntityTemplate[];
}) {
  const selectedWorld = worlds.find((w) => w.id === state.worldId);
  const selectedRulesets = rulesets.filter((r) => state.rulesetIds.has(r.id));
  const selectedEntities = entities.filter((e) => state.entityIds.has(e.id));

  const summary = {
    world: selectedWorld
      ? {
          id: selectedWorld.id,
          name: selectedWorld.name,
        }
      : null,
    rulesets: selectedRulesets.map((r) => ({
      id: r.id,
      name: r.name,
      ui_category: r.ui_category,
    })),
    entities: selectedEntities.map((e) => ({
      id: e.id,
      kind: e.kind,
    })),
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 4: Summary</CardTitle>
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

          <div>
            <h3 className="font-semibold mb-2">JSON Configuration</h3>
            <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-[400px]">
              {JSON.stringify(summary, null, 2)}
            </pre>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

