/**
 * Phase 5: CreateGameForm - V3 game creation with idempotency and test mode
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Switch } from '../ui/switch';
import { postCreateGame } from '../../lib/api';
import { generateIdempotencyKeyV4 } from '../../lib/idempotency';
import { ApiErrorCode } from '@shared/types/api';
import { Loader2, AlertCircle } from 'lucide-react';
import type { CreateGameRequest } from '../../lib/types';

// Toast hook - using a simple toast if available, otherwise console.log
const useToast = () => {
  return {
    toast: (options: { title: string; description?: string; variant?: 'default' | 'destructive' }) => {
      if (options.variant === 'destructive') {
        console.error(`[Toast] ${options.title}: ${options.description || ''}`);
      } else {
        console.log(`[Toast] ${options.title}: ${options.description || ''}`);
      }
    },
  };
};

const createGameSchema = z.object({
  entry_point_id: z.string().min(1, 'Entry point is required'),
  world_id: z.string().uuid('World ID must be a valid UUID'),
  entry_start_slug: z.string().min(1, 'Entry start is required'),
  scenario_slug: z.string().nullable().optional(),
  ruleset_slug: z.string().optional(),
  model: z.string().optional(),
  characterId: z.string().uuid().optional(),
});

type CreateGameFormData = z.infer<typeof createGameSchema>;

interface CreateGameFormProps {
  initialWorldId?: string;
  initialCharacterId?: string;
  entryPoints?: Array<{ id: string; slug: string; name: string; entry_start_slug?: string; scenario_slug?: string | null; ruleset_slug?: string }>;
  onSuccess?: (gameId: string) => void;
}

export function CreateGameForm({
  initialWorldId,
  initialCharacterId,
  entryPoints = [],
  onSuccess,
}: CreateGameFormProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [testRollback, setTestRollback] = useState(false);
  const [idempotencyKey] = useState(() => generateIdempotencyKeyV4());
  const [retryCount, setRetryCount] = useState(0);
  const [conflictingGameId, setConflictingGameId] = useState<string | null>(null);
  const [testTxServerEnabled, setTestTxServerEnabled] = useState<boolean | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateGameFormData>({
    resolver: zodResolver(createGameSchema),
    defaultValues: {
      world_id: initialWorldId || '',
      characterId: initialCharacterId,
      ruleset_slug: 'default',
      model: import.meta.env.VITE_PROMPT_MODEL_DEFAULT || 'gpt-4o-mini',
    },
  });

  const selectedEntryPointId = watch('entry_point_id');
  const selectedEntryPoint = entryPoints.find((ep) => ep.id === selectedEntryPointId);

  // Auto-fill entry_start_slug when entry point is selected
  if (selectedEntryPoint?.entry_start_slug && !watch('entry_start_slug')) {
    setValue('entry_start_slug', selectedEntryPoint.entry_start_slug);
  }

  // Auto-fill scenario_slug if available
  if (selectedEntryPoint?.scenario_slug && !watch('scenario_slug')) {
    setValue('scenario_slug', selectedEntryPoint.scenario_slug);
  }

  // Auto-fill ruleset_slug if available
  if (selectedEntryPoint?.ruleset_slug && !watch('ruleset_slug')) {
    setValue('ruleset_slug', selectedEntryPoint.ruleset_slug || 'default');
  }

  const onSubmit = async (data: CreateGameFormData) => {
    setIsSubmitting(true);
    setFieldErrors({});
    setGlobalError(null);
    setConflictingGameId(null);

    // Phase 6: Log UI event (structured log for observability)
    const eventPayload = {
      event: 'ui.create_game.clicked',
      entry_point_id: data.entry_point_id,
      scenario_slug: data.scenario_slug || null,
      ruleset_slug: data.ruleset_slug || 'default',
      idempotent: true,
      testTx: testRollback && isDevMode,
    };
    console.log(JSON.stringify(eventPayload));

    try {
      const result = await postCreateGame(
        {
          entry_point_id: data.entry_point_id,
          world_id: data.world_id,
          entry_start_slug: data.entry_start_slug,
          scenario_slug: data.scenario_slug || null,
          ruleset_slug: data.ruleset_slug || 'default',
          model: data.model,
          characterId: data.characterId,
        },
        {
          idempotencyKey,
          testRollback: testRollback && import.meta.env.DEV && import.meta.env.VITE_TEST_TX_HEADER_ENABLED === 'true',
        }
      );

      if (!result.ok) {
        // Handle validation errors
        if (result.error.code === ApiErrorCode.VALIDATION_FAILED) {
          const details = result.error.details as { fieldErrors?: Array<{ field: string; message: string }> };
          if (details?.fieldErrors) {
            const fieldErrorMap: Record<string, string> = {};
            details.fieldErrors.forEach((err) => {
              fieldErrorMap[err.field] = err.message;
            });
            setFieldErrors(fieldErrorMap);

            // Focus first invalid field
            const firstField = document.querySelector(`[name="${details.fieldErrors[0]?.field}"]`) as HTMLElement;
            firstField?.focus();
          } else {
            setGlobalError(result.error.message);
          }
          return;
        }

        // Handle specific error codes
        if (
          result.error.code === ApiErrorCode.ENTRY_START_NOT_FOUND ||
          result.error.code === ApiErrorCode.SCENARIO_NOT_FOUND
        ) {
          setGlobalError(result.error.message);
          return;
        }

        // Phase 5.1: Handle conflict errors - retry once with same key, then show resume option
        if (
          result.error.code === ApiErrorCode.DB_CONFLICT ||
          result.error.code === ApiErrorCode.IDEMPOTENCY_CONFLICT
        ) {
          // Do not generate new key - reuse same idempotency key
          if (retryCount === 0) {
            // First retry - use same idempotency key
            setRetryCount(1);
            setTimeout(() => onSubmit(data), 500);
            return;
          }
          
          // Already retried - check if we can extract game_id from error details or cached response
          // Try to get game_id from idempotency cache response
          const details = result.error.details as { game_id?: string; cached_response?: { data?: { game_id?: string } } } | undefined;
          const gameIdFromCache = details?.game_id || details?.cached_response?.data?.game_id;
          
          if (gameIdFromCache) {
            setConflictingGameId(gameIdFromCache);
            setGlobalError(
              'A game with this configuration already exists. Would you like to resume it?'
            );
          } else {
            setGlobalError(
              'Duplicate request detected. If you intended to create a new game, please wait a moment and try again.'
            );
          }
          return;
        }

        // Handle legacy route retired (defensive)
        if (result.error.code === ApiErrorCode.LEGACY_ROUTE_RETIRED) {
          setGlobalError('This flow is no longer available. Please use the "New Game" form.');
          return;
        }

        // Generic error
        setGlobalError(result.error.message);
        toast({
          title: 'Error',
          description: result.error.message,
          variant: 'destructive',
        });
        return;
      }

      // Success - navigate to game
      const gameId = result.data.game_id;
      
      if (onSuccess) {
        onSuccess(gameId);
      } else {
        navigate(`/game/${gameId}`);
      }

      toast({
        title: 'Game Created',
        description: 'Your new game has been created successfully.',
      });
    } catch (error) {
      console.error('Error creating game:', error);
      setGlobalError(error instanceof Error ? error.message : 'Failed to create game');
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDevMode = import.meta.env.DEV && import.meta.env.VITE_TEST_TX_HEADER_ENABLED === 'true';

  // Phase 5.1: Check server test transaction availability
  useEffect(() => {
    if (isDevMode) {
      fetch('/health')
        .then((res) => res.json())
        .then((data: { testTxEnabled?: boolean }) => {
          setTestTxServerEnabled(data.testTxEnabled ?? false);
        })
        .catch(() => {
          setTestTxServerEnabled(false);
        });
    }
  }, [isDevMode]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Game</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" role="form">
          {/* Entry Point Select */}
          <div className="space-y-2">
            <Label htmlFor="entry_point_id">
              Entry Point <span className="text-destructive">*</span>
            </Label>
            <Select
              value={selectedEntryPointId || ''}
              onValueChange={(value) => {
                setValue('entry_point_id', value);
                const ep = entryPoints.find((e) => e.id === value);
                if (ep) {
                  setValue('entry_start_slug', ep.entry_start_slug || '');
                  setValue('scenario_slug', ep.scenario_slug || null);
                  setValue('ruleset_slug', ep.ruleset_slug || 'default');
                  if (ep.world_id) {
                    setValue('world_id', ep.world_id);
                  }
                }
              }}
            >
              <SelectTrigger id="entry_point_id" aria-invalid={!!fieldErrors.entry_point_id}>
                <SelectValue placeholder="Select entry point" />
              </SelectTrigger>
              <SelectContent>
                {entryPoints.map((ep) => (
                  <SelectItem key={ep.id} value={ep.id}>
                    {ep.name || ep.slug}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.entry_point_id && (
              <p className="text-sm text-destructive" role="alert" id="entry_point_id-error">
                {fieldErrors.entry_point_id}
              </p>
            )}
          </div>

          {/* World ID (auto-filled or manual) */}
          <div className="space-y-2">
            <Label htmlFor="world_id">
              World ID (UUID) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="world_id"
              {...register('world_id')}
              type="text"
              placeholder="00000000-0000-0000-0000-000000000000"
              aria-invalid={!!fieldErrors.world_id}
              aria-describedby={fieldErrors.world_id ? 'world_id-error' : undefined}
            />
            {fieldErrors.world_id && (
              <p className="text-sm text-destructive" role="alert" id="world_id-error">
                {fieldErrors.world_id}
              </p>
            )}
          </div>

          {/* Entry Start Slug */}
          <div className="space-y-2">
            <Label htmlFor="entry_start_slug">
              Entry Start Slug <span className="text-destructive">*</span>
            </Label>
            <Input
              id="entry_start_slug"
              {...register('entry_start_slug')}
              placeholder="entry-start-slug"
              aria-invalid={!!fieldErrors.entry_start_slug}
              aria-describedby={fieldErrors.entry_start_slug ? 'entry_start_slug-error' : undefined}
            />
            {fieldErrors.entry_start_slug && (
              <p className="text-sm text-destructive" role="alert" id="entry_start_slug-error">
                {fieldErrors.entry_start_slug}
              </p>
            )}
          </div>

          {/* Scenario Slug (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="scenario_slug">Scenario Slug (Optional)</Label>
            <Input
              id="scenario_slug"
              {...register('scenario_slug')}
              placeholder="scenario-slug"
              aria-invalid={!!fieldErrors.scenario_slug}
            />
          </div>

          {/* Ruleset Slug (Optional, default) */}
          <div className="space-y-2">
            <Label htmlFor="ruleset_slug">Ruleset Slug</Label>
            <Input
              id="ruleset_slug"
              {...register('ruleset_slug')}
              placeholder="default"
              aria-invalid={!!fieldErrors.ruleset_slug}
            />
          </div>

          {/* Model (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Input
              id="model"
              {...register('model')}
              placeholder={import.meta.env.VITE_PROMPT_MODEL_DEFAULT || 'gpt-4o-mini'}
            />
          </div>

          {/* Character ID (Optional) */}
          {initialCharacterId && (
            <div className="space-y-2">
              <Label htmlFor="characterId">Character ID</Label>
              <Input
                id="characterId"
                {...register('characterId')}
                type="text"
                readOnly
                className="bg-muted"
              />
            </div>
          )}

          {/* Phase 5.1: Dev: Ephemeral Test Mode Toggle with server availability guard */}
          {isDevMode && (
            <div className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="test-rollback" className="text-sm font-medium">
                  Ephemeral Test Mode
                </Label>
                <p className="text-xs text-muted-foreground">
                  {testTxServerEnabled === false
                    ? 'Server test rollback disabled. Set TEST_TX_ENABLED=true on the backend.'
                    : 'Enable to test game creation with automatic rollback (dev only)'}
                </p>
              </div>
              <Switch
                id="test-rollback"
                checked={testRollback && testTxServerEnabled !== false}
                onCheckedChange={setTestRollback}
                disabled={testTxServerEnabled === false}
                aria-label="Enable ephemeral test mode"
                aria-describedby={testTxServerEnabled === false ? 'test-tx-disabled-tooltip' : undefined}
              />
              {testTxServerEnabled === false && (
                <span id="test-tx-disabled-tooltip" className="sr-only">
                  Server test rollback disabled. Set TEST_TX_ENABLED=true on the backend.
                </span>
              )}
            </div>
          )}

          {/* Phase 5.1: Resume existing game link */}
          {conflictingGameId && (
            <Alert variant="default">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between gap-4">
                  <span>{globalError}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/game/${conflictingGameId}`)}
                    aria-label={`Resume game ${conflictingGameId}`}
                  >
                    Resume Game
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Global Error */}
          {globalError && (
            <Alert variant="destructive" role="alert">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{globalError}</AlertDescription>
            </Alert>
          )}

      {/* Phase 8: Quickstart Button */}
      {entryPoints.length > 0 && (
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            // Prefill with first entry point
            const firstEntryPoint = entryPoints[0];
            if (firstEntryPoint) {
              setValue('entry_point_id', firstEntryPoint.id);
              setValue('entry_start_slug', firstEntryPoint.entry_start_slug || '');
              setValue('scenario_slug', firstEntryPoint.scenario_slug || null);
              setValue('ruleset_slug', firstEntryPoint.ruleset_slug || 'default');
              if (firstEntryPoint.world_id) {
                setValue('world_id', firstEntryPoint.world_id);
              }
              
              // Auto-submit after a brief delay
              setTimeout(() => {
                const formData = {
                  entry_point_id: firstEntryPoint.id,
                  world_id: firstEntryPoint.world_id || initialWorldId || '',
                  entry_start_slug: firstEntryPoint.entry_start_slug || '',
                  scenario_slug: firstEntryPoint.scenario_slug || null,
                  ruleset_slug: firstEntryPoint.ruleset_slug || 'default',
                };
                handleSubmit(onSubmit)(formData as any);
              }, 100);
            }
          }}
          disabled={isSubmitting}
          className="w-full mb-2"
        >
          Quickstart
        </Button>
      )}

      {/* Submit Button */}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Creating...
          </>
        ) : (
          'Create Game'
        )}
      </Button>
        </form>
      </CardContent>
    </Card>
  );
}

