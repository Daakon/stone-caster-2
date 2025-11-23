// [CHIMERA V3] Architecture: Greenfield | Layer: Frontend
/**
 * Chimera Ruleset Template Editor (V3)
 * Create or edit ruleset templates using V3 schema
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createRuleset, getRuleset, updateRuleset, getRulesets } from '@/services/chimera-api';
import type { RulesetDefinition } from '@shared/types/chimera-authoring';

export default function RulesetTemplateEditor() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  const [formData, setFormData] = useState<{
    name: string;
    description_short: string;
    description_long: string;
    ui_category: 'foundation' | 'expansion' | 'flavor';
    exclusion_group: string;
  }>({
    name: '',
    description_short: '',
    description_long: '',
    ui_category: 'foundation', // Default to foundation to ensure it's never empty
    exclusion_group: '',
  });

  const [jsonFields, setJsonFields] = useState({
    state_contributions: '{}',
    actions: '{}',
    ai_instructions: '{}',
  });

  const [dependencies, setDependencies] = useState<string[]>([]);
  const [availableRulesets, setAvailableRulesets] = useState<RulesetDefinition[]>([]);
  const [isLoadingRulesets, setIsLoadingRulesets] = useState(true);

  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load existing ruleset if editing
  const { data: existingRuleset, isLoading: isLoadingRuleset } = useQuery({
    queryKey: ['chimera-ruleset', id],
    queryFn: () => getRuleset(id!),
    enabled: isEditing && !!id,
  });

  // Load available rulesets for dependencies
  useEffect(() => {
    setIsLoadingRulesets(true);
    getRulesets()
      .then((data) => {
        // Filter out the current ruleset (cannot depend on self)
        // When editing, id might be a UUID, but ruleset.id is the key (string)
        // We need to compare by the ruleset's key (id field in RulesetDefinition)
        let others = data;
        if (id && existingRuleset) {
          // Compare by the ruleset's key (id field), not the UUID
          others = data.filter((r) => r.id !== existingRuleset.id);
        } else if (id) {
          // If we don't have existingRuleset yet, filter by UUID (less reliable but better than nothing)
          // This will be refined once existingRuleset loads
          others = data.filter((r) => {
            // If id is a UUID, we can't match it to r.id (which is a key)
            // So we'll include all for now, and re-filter when existingRuleset loads
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
            return !isUUID || r.id !== id;
          });
        }
        setAvailableRulesets(others);
      })
      .catch((error) => {
        console.error('Failed to load rulesets for dependencies:', error);
        toast.error('Failed to load available rulesets');
      })
      .finally(() => {
        setIsLoadingRulesets(false);
      });
  }, [id, existingRuleset]);

  // Populate form when ruleset loads
  useEffect(() => {
    if (existingRuleset) {
      console.log('[Editor] Loading ruleset data:', existingRuleset);
      const uiCategory = existingRuleset.ui_category;
      console.log('[Editor] Raw ui_category from API:', uiCategory, typeof uiCategory);
      
      // Ensure the category is one of the valid values
      const validCategory: 'foundation' | 'expansion' | 'flavor' = 
        (uiCategory === 'foundation' || uiCategory === 'expansion' || uiCategory === 'flavor')
          ? uiCategory
          : 'foundation';
      
      console.log('[Editor] Validated category:', validCategory);
      
      const newFormData = {
        name: existingRuleset.name || '',
        description_short: existingRuleset.description_short || '',
        description_long: existingRuleset.description_long || '',
        ui_category: validCategory,
        exclusion_group: existingRuleset.exclusion_group || '',
      };
      
      console.log('[Editor] Setting formData to:', newFormData);
      
      // Directly set the formData - don't use functional update here since we're replacing the whole object
      setFormData(newFormData);
      
      setJsonFields({
        state_contributions: JSON.stringify(existingRuleset.state_contributions || {}, null, 2),
        actions: JSON.stringify(existingRuleset.actions || {}, null, 2),
        ai_instructions: JSON.stringify(existingRuleset.ai_instructions || {}, null, 2),
      });
      setDependencies(existingRuleset.dependencies || []);
    } else if (!isEditing) {
      // Reset form when creating new (not editing)
      setFormData({
        name: '',
        description_short: '',
        description_long: '',
        ui_category: 'foundation',
        exclusion_group: '',
      });
    }
  }, [existingRuleset, isEditing]);

  // Debug: Log formData changes
  useEffect(() => {
    console.log('[Editor] formData changed:', formData);
  }, [formData]);

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

  const handleJsonFieldChange = (fieldName: string, value: string) => {
    setJsonFields((prev) => ({ ...prev, [fieldName]: value }));
    // Validate on blur
    try {
      parseJsonField(value, fieldName);
    } catch {
      // Error already set in parseJsonField
    }
  };

  const handleDependencyToggle = (rulesetId: string, checked: boolean) => {
    if (checked) {
      setDependencies((prev) => [...prev, rulesetId]);
    } else {
      setDependencies((prev) => prev.filter((id) => id !== rulesetId));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all JSON fields
    let stateContributions: Record<string, unknown>;
    let actions: Record<string, unknown>;
    let aiInstructions: Record<string, unknown>;

    try {
      stateContributions = parseJsonField(jsonFields.state_contributions, 'state_contributions') as Record<string, unknown>;
      actions = parseJsonField(jsonFields.actions, 'actions') as Record<string, unknown>;
      aiInstructions = parseJsonField(jsonFields.ai_instructions, 'ai_instructions') as Record<string, unknown>;
    } catch {
      toast.error('Please fix JSON errors before submitting');
      return;
    }

    setIsSubmitting(true);
    try {
      // Ensure ui_category is always a valid value
      const validUiCategory: 'foundation' | 'expansion' | 'flavor' = 
        (formData.ui_category === 'foundation' || 
         formData.ui_category === 'expansion' || 
         formData.ui_category === 'flavor')
          ? formData.ui_category
          : (existingRuleset?.ui_category === 'foundation' || 
             existingRuleset?.ui_category === 'expansion' || 
             existingRuleset?.ui_category === 'flavor')
            ? existingRuleset.ui_category
            : 'foundation';

      const rulesetData: RulesetDefinition = {
        id: id || '', // Will be generated by backend if empty
        name: formData.name,
        description_short: formData.description_short || null,
        description_long: formData.description_long || null,
        ui_category: validUiCategory,
        exclusion_group: formData.exclusion_group || null,
        dependencies,
        provides_tags: [],
        state_contributions: stateContributions,
        actions,
        ai_instructions: aiInstructions,
      };

      if (isEditing && id) {
        await updateRuleset(id, rulesetData);
        toast.success('Ruleset updated successfully');
      } else {
        await createRuleset(rulesetData);
        toast.success('Ruleset created successfully');
      }

      // Invalidate and refetch queries
      await queryClient.invalidateQueries({ queryKey: ['chimera-rulesets'] });
      await queryClient.invalidateQueries({ queryKey: ['chimera-ruleset', id] });
      
      navigate('/admin/chimera/rulesets');
    } catch (error) {
      console.error('Error saving ruleset:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save ruleset');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEditing && isLoadingRuleset) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/chimera/rulesets')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            {isEditing ? 'Edit Ruleset' : 'Create Ruleset'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isEditing ? 'Update the ruleset details' : 'Create a new ruleset (V3 Architecture)'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Configure the ruleset properties
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter ruleset name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ui_category">Rule Category *</Label>
                <Select
                  value={formData.ui_category || existingRuleset?.ui_category || 'foundation'}
                  onValueChange={(value) => {
                    console.log('[Editor] Category changed to:', value);
                    // Ensure we only set valid enum values
                    if (value === 'foundation' || value === 'expansion' || value === 'flavor') {
                      setFormData((prev) => ({ ...prev, ui_category: value }));
                    } else {
                      console.warn('[Editor] Invalid ui_category value:', value, 'defaulting to foundation');
                      setFormData((prev) => ({ ...prev, ui_category: 'foundation' }));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select rule category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="foundation">Foundation</SelectItem>
                    <SelectItem value="expansion">Expansion</SelectItem>
                    <SelectItem value="flavor">Flavor</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Foundation: Core game system. Expansion: Additional mechanics. Flavor: Thematic additions.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description_short">Short Description</Label>
              <Input
                id="description_short"
                value={formData.description_short}
                onChange={(e) => setFormData((prev) => ({ ...prev, description_short: e.target.value }))}
                placeholder="Brief description (max 255 chars) - shown in lists and dependency views"
                maxLength={255}
              />
              <p className="text-xs text-muted-foreground">
                {formData.description_short.length}/255 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description_long">Long Description</Label>
              <Textarea
                id="description_long"
                value={formData.description_long}
                onChange={(e) => setFormData((prev) => ({ ...prev, description_long: e.target.value }))}
                placeholder="Detailed description (max 2000 chars) - shown in detail views"
                rows={4}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground">
                {formData.description_long.length}/2000 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="exclusion_group">Exclusion Group (optional)</Label>
              <Input
                id="exclusion_group"
                value={formData.exclusion_group}
                onChange={(e) => setFormData((prev) => ({ ...prev, exclusion_group: e.target.value }))}
                placeholder="e.g., combat-system, magic-system"
              />
              <p className="text-xs text-muted-foreground">
                Rulesets with the same exclusion group are mutually exclusive
              </p>
            </div>
          </CardContent>
        </Card>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle>Compiler Configuration</CardTitle>
            <CardDescription>
              Define how this ruleset contributes to the compiled game state
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="state_contributions">State Contributions (JSON)</Label>
              <Textarea
                id="state_contributions"
                value={jsonFields.state_contributions}
                onChange={(e) => handleJsonFieldChange('state_contributions', e.target.value)}
                onBlur={(e) => handleJsonFieldChange('state_contributions', e.target.value)}
                placeholder='{"tier1_entity": ["hp", "mana"], "tier0_narrative": ["memories"]}'
                rows={8}
                className={`font-mono text-sm ${jsonErrors.state_contributions ? 'border-red-500' : ''}`}
              />
              {jsonErrors.state_contributions && (
                <Alert variant="destructive">
                  <AlertDescription>{jsonErrors.state_contributions}</AlertDescription>
                </Alert>
              )}
              <p className="text-xs text-muted-foreground">
                Define which state keys this ruleset contributes. Use <code>tier1_entity</code> for mechanical keys (hp, mana) and <code>tier0_narrative</code> for narrative keys (memories, relationships).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="actions">Actions (JSON)</Label>
              <Textarea
                id="actions"
                value={jsonFields.actions}
                onChange={(e) => handleJsonFieldChange('actions', e.target.value)}
                onBlur={(e) => handleJsonFieldChange('actions', e.target.value)}
                placeholder='{"attack": {...}, "defend": {...}}'
                rows={8}
                className={`font-mono text-sm ${jsonErrors.actions ? 'border-red-500' : ''}`}
              />
              {jsonErrors.actions && (
                <Alert variant="destructive">
                  <AlertDescription>{jsonErrors.actions}</AlertDescription>
                </Alert>
              )}
              <p className="text-xs text-muted-foreground">
                Define the actions/moves this ruleset provides
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai_instructions">AI Instructions (JSON)</Label>
              <Textarea
                id="ai_instructions"
                value={jsonFields.ai_instructions}
                onChange={(e) => handleJsonFieldChange('ai_instructions', e.target.value)}
                onBlur={(e) => handleJsonFieldChange('ai_instructions', e.target.value)}
                placeholder='{"mas1_hints": [...], "mas2_style": [...]}'
                rows={8}
                className={`font-mono text-sm ${jsonErrors.ai_instructions ? 'border-red-500' : ''}`}
              />
              {jsonErrors.ai_instructions && (
                <Alert variant="destructive">
                  <AlertDescription>{jsonErrors.ai_instructions}</AlertDescription>
                </Alert>
              )}
              <p className="text-xs text-muted-foreground">
                Define AI instructions for MAS1 (parser) and MAS2 (narrator) prompts. Use <code>mas1_hints</code> for parser guidance and <code>mas2_style</code> for narrative style instructions.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Dependencies</Label>
              <div className="border rounded-md p-4 max-h-64 overflow-y-auto">
                {isLoadingRulesets ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading available rulesets...</span>
                  </div>
                ) : availableRulesets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No other rulesets available</p>
                ) : (
                  <div className="space-y-3">
                    {availableRulesets.map((ruleset) => {
                      const isChecked = dependencies.includes(ruleset.id);
                      return (
                        <div key={ruleset.id} className="flex items-start space-x-3">
                          <Checkbox
                            id={`dependency-${ruleset.id}`}
                            checked={isChecked}
                            onCheckedChange={(checked) =>
                              handleDependencyToggle(ruleset.id, checked === true)
                            }
                          />
                          <Label
                            htmlFor={`dependency-${ruleset.id}`}
                            className="flex-1 cursor-pointer font-normal"
                          >
                            <div className="font-medium">{ruleset.name}</div>
                            {ruleset.description_short && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {ruleset.description_short}
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground mt-1">
                              {ruleset.ui_category} • {ruleset.id}
                            </div>
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Select other rulesets that this ruleset depends on. Dependencies are stored as ruleset keys for portability.
              </p>
              {dependencies.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-1">
                    Selected ({dependencies.length}): {dependencies.join(', ')}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/admin/chimera/rulesets')}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || Object.keys(jsonErrors).length > 0}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {isEditing ? 'Update Ruleset' : 'Create Ruleset'}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
