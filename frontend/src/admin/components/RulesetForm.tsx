// [CHIMERA V3] Architecture: Greenfield | Layer: Frontend
/**
 * Ruleset Form Component (V3 Architecture)
 * Create/edit ruleset with V3 taxonomy and compiler configuration
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { createRuleset, getRuleset, updateRuleset } from '@/services/chimera-api';
import type { RulesetDefinition } from '@shared/types/chimera-authoring';

const rulesetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  ui_category: z.enum(['foundation', 'expansion', 'flavor'], {
    required_error: 'UI Category is required',
  }),
  exclusion_group: z.string().max(100).nullable().optional(),
  dependencies: z.array(z.string()).default([]),
  state_contributions: z.record(z.unknown()).default({}),
  actions: z.record(z.unknown()).default({}),
  ai_instructions: z.record(z.unknown()).default({}),
  provides_tags: z.array(z.string()).default([]),
});

type RulesetFormData = z.infer<typeof rulesetSchema>;

interface RulesetFormProps {
  rulesetId?: string; // For editing existing ruleset
  onSubmit?: (data: RulesetDefinition) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function RulesetForm({ rulesetId, onSubmit, onCancel, loading = false }: RulesetFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingRuleset, setIsLoadingRuleset] = useState(!!rulesetId);
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<RulesetFormData>({
    resolver: zodResolver(rulesetSchema),
    defaultValues: {
      name: '',
      ui_category: 'foundation',
      exclusion_group: null,
      dependencies: [],
      state_contributions: {},
      actions: {},
      ai_instructions: {},
      provides_tags: [],
    },
  });

  const watchedStateContributions = watch('state_contributions') || {};
  const watchedActions = watch('actions') || {};
  const watchedDependencies = watch('dependencies') || [];

  // Load existing ruleset if editing
  useEffect(() => {
    if (rulesetId) {
      loadRuleset(rulesetId);
    }
  }, [rulesetId]);

  const loadRuleset = async (id: string) => {
    try {
      setIsLoadingRuleset(true);
      const ruleset = await getRuleset(id);
      setValue('name', ruleset.name);
      setValue('ui_category', ruleset.ui_category);
      setValue('exclusion_group', ruleset.exclusion_group || null);
      setValue('dependencies', ruleset.dependencies || []);
      setValue('state_contributions', ruleset.state_contributions || {});
      setValue('actions', ruleset.actions || {});
      setValue('ai_instructions', ruleset.ai_instructions || {});
      setValue('provides_tags', ruleset.provides_tags || []);
    } catch (error) {
      console.error('Failed to load ruleset:', error);
      toast.error('Failed to load ruleset');
    } finally {
      setIsLoadingRuleset(false);
    }
  };

  const parseJsonField = (value: string, fieldName: string): unknown => {
    if (!value.trim()) {
      return fieldName === 'dependencies' ? [] : {};
    }
    try {
      const parsed = JSON.parse(value);
      setJsonErrors((prev) => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
      return parsed;
    } catch (error) {
      setJsonErrors((prev) => ({
        ...prev,
        [fieldName]: error instanceof Error ? error.message : 'Invalid JSON',
      }));
      throw error;
    }
  };

  const handleFormSubmit = async (data: RulesetFormData) => {
    try {
      setIsSubmitting(true);

      // Validate JSON fields
      const stateContributionsText = (document.getElementById('state_contributions') as HTMLTextAreaElement)?.value || '{}';
      const actionsText = (document.getElementById('actions') as HTMLTextAreaElement)?.value || '{}';
      const dependenciesText = (document.getElementById('dependencies') as HTMLTextAreaElement)?.value || '[]';

      let stateContributions: Record<string, unknown>;
      let actions: Record<string, unknown>;
      let dependencies: string[];

      try {
        stateContributions = parseJsonField(stateContributionsText, 'state_contributions') as Record<string, unknown>;
        actions = parseJsonField(actionsText, 'actions') as Record<string, unknown>;
        dependencies = parseJsonField(dependenciesText, 'dependencies') as string[];
      } catch {
        toast.error('Please fix JSON errors before submitting');
        return;
      }

      const rulesetData: RulesetDefinition = {
        id: rulesetId || '', // Will be generated by backend if empty
        name: data.name,
        ui_category: data.ui_category,
        exclusion_group: data.exclusion_group || null,
        dependencies,
        provides_tags: data.provides_tags || [],
        state_contributions: stateContributions,
        actions,
        ai_instructions: data.ai_instructions || {},
      };

      if (onSubmit) {
        await onSubmit(rulesetData);
      } else {
        if (rulesetId) {
          await updateRuleset(rulesetId, rulesetData);
          toast.success('Ruleset updated successfully');
        } else {
          await createRuleset(rulesetData);
          toast.success('Ruleset created successfully');
        }
      }
    } catch (error) {
      console.error('Failed to save ruleset:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save ruleset');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingRuleset) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">Loading ruleset...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{rulesetId ? 'Edit Ruleset' : 'Create Ruleset'}</CardTitle>
        <CardDescription>
          {rulesetId ? 'Update ruleset information' : 'Create a new game ruleset (V3 Architecture)'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Basic Information</h3>
            
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="Enter ruleset name"
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && (
                <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="ui_category">UI Category *</Label>
              <Select
                value={watch('ui_category')}
                onValueChange={(value) => setValue('ui_category', value as 'foundation' | 'expansion' | 'flavor')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select UI category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="foundation">Foundation</SelectItem>
                  <SelectItem value="expansion">Expansion</SelectItem>
                  <SelectItem value="flavor">Flavor</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-1">
                Foundation: Core game system. Expansion: Additional mechanics. Flavor: Thematic additions.
              </p>
            </div>

            <div>
              <Label htmlFor="exclusion_group">Exclusion Group (optional)</Label>
              <Input
                id="exclusion_group"
                {...register('exclusion_group')}
                placeholder="e.g., combat-system, magic-system"
                className={errors.exclusion_group ? 'border-red-500' : ''}
              />
              {errors.exclusion_group && (
                <p className="text-sm text-red-600 mt-1">{errors.exclusion_group.message}</p>
              )}
              <p className="text-sm text-muted-foreground mt-1">
                Rulesets with the same exclusion group are mutually exclusive
              </p>
            </div>
          </div>

          <Separator />

          {/* Compiler Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Compiler Configuration</h3>
            <p className="text-sm text-muted-foreground">
              Define how this ruleset contributes to the compiled game state
            </p>

            <div>
              <Label htmlFor="state_contributions">State Contributions (JSON)</Label>
              <Textarea
                id="state_contributions"
                defaultValue={JSON.stringify(watchedStateContributions, null, 2)}
                placeholder='{"tier1_entity": ["hp", "mana"], "tier0_narrative": ["memories"]}'
                rows={8}
                className={`font-mono text-sm ${jsonErrors.state_contributions ? 'border-red-500' : ''}`}
                onBlur={(e) => {
                  try {
                    const parsed = parseJsonField(e.target.value, 'state_contributions');
                    setValue('state_contributions', parsed as Record<string, unknown>);
                  } catch {
                    // Error already set in parseJsonField
                  }
                }}
              />
              {jsonErrors.state_contributions && (
                <p className="text-sm text-red-600 mt-1">{jsonErrors.state_contributions}</p>
              )}
              <p className="text-sm text-muted-foreground mt-1">
                Define which state keys this ruleset contributes. Use <code>tier1_entity</code> for mechanical keys (hp, mana) and <code>tier0_narrative</code> for narrative keys (memories, relationships).
              </p>
            </div>

            <div>
              <Label htmlFor="actions">Actions (JSON)</Label>
              <Textarea
                id="actions"
                defaultValue={JSON.stringify(watchedActions, null, 2)}
                placeholder='{"attack": {...}, "defend": {...}}'
                rows={8}
                className={`font-mono text-sm ${jsonErrors.actions ? 'border-red-500' : ''}`}
                onBlur={(e) => {
                  try {
                    const parsed = parseJsonField(e.target.value, 'actions');
                    setValue('actions', parsed as Record<string, unknown>);
                  } catch {
                    // Error already set in parseJsonField
                  }
                }}
              />
              {jsonErrors.actions && (
                <p className="text-sm text-red-600 mt-1">{jsonErrors.actions}</p>
              )}
              <p className="text-sm text-muted-foreground mt-1">
                Define the actions/moves this ruleset provides
              </p>
            </div>

            <div>
              <Label htmlFor="dependencies">Dependencies (JSON Array)</Label>
              <Textarea
                id="dependencies"
                defaultValue={JSON.stringify(watchedDependencies, null, 2)}
                placeholder='["ruleset-id-1", "ruleset-id-2"]'
                rows={4}
                className={`font-mono text-sm ${jsonErrors.dependencies ? 'border-red-500' : ''}`}
                onBlur={(e) => {
                  try {
                    const parsed = parseJsonField(e.target.value, 'dependencies');
                    setValue('dependencies', parsed as string[]);
                  } catch {
                    // Error already set in parseJsonField
                  }
                }}
              />
              {jsonErrors.dependencies && (
                <p className="text-sm text-red-600 mt-1">{jsonErrors.dependencies}</p>
              )}
              <p className="text-sm text-muted-foreground mt-1">
                Array of ruleset IDs that this ruleset depends on
              </p>
            </div>
          </div>

          <Separator />

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || loading}>
              {isSubmitting ? 'Saving...' : (rulesetId ? 'Update Ruleset' : 'Create Ruleset')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

