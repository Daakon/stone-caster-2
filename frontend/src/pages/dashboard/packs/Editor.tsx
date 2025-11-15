/**
 * Content Pack Editor
 * Multi-step form for creating/editing content packs
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
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { chimeraPacksService, type CreatePackData, type UpdatePackData } from '@/services/chimera.packs';
import { chimeraEntitiesService } from '@/services/chimera.entities';
import { chimeraService, type RulesetTemplate } from '@/services/admin.chimera';
import { chimeraLoreService } from '@/services/chimera.lore';

const STEPS = [
  { id: 1, title: 'Basic Info', description: 'Name and description' },
  { id: 2, title: 'Dependencies', description: 'Add dependencies' },
  { id: 3, title: 'Entities', description: 'Add entities' },
  { id: 4, title: 'Rulesets', description: 'Add modifiers' },
  { id: 5, title: 'Lore', description: 'Add lore (stub)' },
  { id: 6, title: 'Relationships', description: 'Inter-entity state' },
];

interface PackWizardData {
  display_name: string;
  description_short: string;
  pack_type: 'NPC' | 'ITEM' | 'LORE' | 'MIXED';
  depends_on_pack_ids: string[];
  entity_template_ids: string[];
  ruleset_template_ids: string[];
  lore_template_ids: string[];
  inter_entity_state: string; // JSON string for textarea
}

export default function PackEditor() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [wizardData, setWizardData] = useState<PackWizardData>({
    display_name: '',
    description_short: '',
    pack_type: 'MIXED',
    depends_on_pack_ids: [],
    entity_template_ids: [],
    ruleset_template_ids: [],
    lore_template_ids: [],
    inter_entity_state: '{}',
  });

  // Load existing pack if editing
  const { data: existingPack, isLoading: isLoadingPack } = useQuery({
    queryKey: ['chimera-pack', id],
    queryFn: () => (id ? chimeraPacksService.getPack(id) : null),
    enabled: isEditing && !!id,
  });

  // Load selectable packs for dependencies
  const { data: selectablePacks, isLoading: isLoadingPacks } = useQuery({
    queryKey: ['chimera-selectable-packs'],
    queryFn: () => chimeraPacksService.getSelectablePacks(),
  });

  // Load selectable entities
  const { data: selectableEntities, isLoading: isLoadingEntities } = useQuery({
    queryKey: ['chimera-selectable-entities'],
    queryFn: () => chimeraEntitiesService.getSelectableEntities(),
  });

  // Load all ruleset templates (admin endpoint)
  const { data: allRulesets, isLoading: isLoadingRulesets } = useQuery({
    queryKey: ['chimera-ruleset-templates'],
    queryFn: () => chimeraService.listRulesetTemplates(),
    staleTime: 5 * 60 * 1000,
  });

  // Load selectable lore templates
  const { data: selectableLore, isLoading: isLoadingLore } = useQuery({
    queryKey: ['chimera-selectable-lore'],
    queryFn: () => chimeraLoreService.getSelectableLore(),
  });

  // Filter rulesets to only MODIFIER type
  const modifierRulesets = (allRulesets || []).filter((r) => r.rule_type === 'MODIFIER');

  // Populate form when editing
  useEffect(() => {
    if (existingPack) {
      setWizardData({
        display_name: existingPack.display_name || '',
        description_short: existingPack.description_short || '',
        pack_type: existingPack.pack_type || 'MIXED',
        depends_on_pack_ids: existingPack.dependencies?.map((d) => d.depends_on_pack_id) || [],
        entity_template_ids: existingPack.entity_links?.map((l) => l.entity_template_id) || [],
        ruleset_template_ids: existingPack.ruleset_links?.map((l) => l.ruleset_template_id) || [],
        lore_template_ids: existingPack.lore_links?.map((l) => l.lore_template_id) || [],
        inter_entity_state: existingPack.inter_entity_state
          ? JSON.stringify(existingPack.inter_entity_state, null, 2)
          : '{}',
      });
    }
  }, [existingPack]);

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
    setIsSubmitting(true);
    try {
      // Validate inter_entity_state JSON
      let parsedInterEntityState: Record<string, unknown> | null = null;
      if (wizardData.inter_entity_state.trim()) {
        try {
          parsedInterEntityState = JSON.parse(wizardData.inter_entity_state);
        } catch (e) {
          toast.error('Invalid JSON in Inter-Entity State field');
          setIsSubmitting(false);
          return;
        }
      }

      const packData: CreatePackData | UpdatePackData = {
        display_name: wizardData.display_name,
        description_short: wizardData.description_short || null,
        pack_type: wizardData.pack_type,
        depends_on_pack_ids: wizardData.depends_on_pack_ids,
        entity_template_ids: wizardData.entity_template_ids,
        ruleset_template_ids: wizardData.ruleset_template_ids,
        lore_template_ids: wizardData.lore_template_ids,
        inter_entity_state: parsedInterEntityState,
      };

      if (isEditing && id) {
        await chimeraPacksService.updatePack(id, packData);
        toast.success('Content pack updated successfully');
      } else {
        await chimeraPacksService.createPack(packData as CreatePackData);
        toast.success('Content pack created successfully');
      }

      await queryClient.invalidateQueries({ queryKey: ['chimera-my-packs'] });
      navigate('/dashboard/creations/packs');
    } catch (error) {
      console.error('Error saving pack:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save pack');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="display_name">Display Name *</Label>
              <Input
                id="display_name"
                value={wizardData.display_name}
                onChange={(e) => setWizardData({ ...wizardData, display_name: e.target.value })}
                placeholder="My Content Pack"
              />
            </div>
            <div>
              <Label htmlFor="description_short">Short Description</Label>
              <Textarea
                id="description_short"
                value={wizardData.description_short}
                onChange={(e) => setWizardData({ ...wizardData, description_short: e.target.value })}
                placeholder="A brief description of this content pack"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="pack_type">Pack Type *</Label>
              <Select
                value={wizardData.pack_type}
                onValueChange={(value: 'NPC' | 'ITEM' | 'LORE' | 'MIXED') =>
                  setWizardData({ ...wizardData, pack_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NPC">NPC</SelectItem>
                  <SelectItem value="ITEM">ITEM</SelectItem>
                  <SelectItem value="LORE">LORE</SelectItem>
                  <SelectItem value="MIXED">MIXED</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <Label>Select Dependencies</Label>
            {isLoadingPacks ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {selectablePacks?.map((pack) => (
                  <div key={pack.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`dep-${pack.id}`}
                      checked={wizardData.depends_on_pack_ids.includes(pack.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setWizardData({
                            ...wizardData,
                            depends_on_pack_ids: [...wizardData.depends_on_pack_ids, pack.id],
                          });
                        } else {
                          setWizardData({
                            ...wizardData,
                            depends_on_pack_ids: wizardData.depends_on_pack_ids.filter((id) => id !== pack.id),
                          });
                        }
                      }}
                    />
                    <Label htmlFor={`dep-${pack.id}`} className="flex-1 cursor-pointer">
                      {pack.display_name} (v{pack.version}, {pack.pack_type})
                    </Label>
                  </div>
                ))}
                {(!selectablePacks || selectablePacks.length === 0) && (
                  <p className="text-sm text-muted-foreground">No packs available</p>
                )}
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <Label>Select Entities</Label>
            {isLoadingEntities ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {selectableEntities?.map((entity) => (
                  <div key={entity.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`entity-${entity.id}`}
                      checked={wizardData.entity_template_ids.includes(entity.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setWizardData({
                            ...wizardData,
                            entity_template_ids: [...wizardData.entity_template_ids, entity.id],
                          });
                        } else {
                          setWizardData({
                            ...wizardData,
                            entity_template_ids: wizardData.entity_template_ids.filter((id) => id !== entity.id),
                          });
                        }
                      }}
                    />
                    <Label htmlFor={`entity-${entity.id}`} className="flex-1 cursor-pointer">
                      {entity.display_name} ({entity.entity_type})
                    </Label>
                  </div>
                ))}
                {(!selectableEntities || selectableEntities.length === 0) && (
                  <p className="text-sm text-muted-foreground">No entities available</p>
                )}
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <Label>Select Modifier Rulesets</Label>
            {isLoadingRulesets ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {modifierRulesets.map((ruleset) => (
                  <div key={ruleset.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`ruleset-${ruleset.id}`}
                      checked={wizardData.ruleset_template_ids.includes(ruleset.id)}
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
                    <Label htmlFor={`ruleset-${ruleset.id}`} className="flex-1 cursor-pointer">
                      {ruleset.display_name} ({ruleset.rule_category})
                    </Label>
                  </div>
                ))}
                {modifierRulesets.length === 0 && (
                  <p className="text-sm text-muted-foreground">No modifier rulesets available</p>
                )}
              </div>
            )}
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <Label>Select Lore Templates</Label>
            {isLoadingLore ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {selectableLore?.map((lore) => (
                  <div key={lore.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`lore-${lore.id}`}
                      checked={wizardData.lore_template_ids.includes(lore.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setWizardData({
                            ...wizardData,
                            lore_template_ids: [...wizardData.lore_template_ids, lore.id],
                          });
                        } else {
                          setWizardData({
                            ...wizardData,
                            lore_template_ids: wizardData.lore_template_ids.filter((id) => id !== lore.id),
                          });
                        }
                      }}
                    />
                    <Label htmlFor={`lore-${lore.id}`} className="flex-1 cursor-pointer">
                      {lore.display_name} (v{lore.version})
                      {lore.tags && lore.tags.length > 0 && (
                        <span className="text-xs text-muted-foreground ml-2">
                          [{lore.tags.map((t) => t.tag_name).join(', ')}]
                        </span>
                      )}
                    </Label>
                  </div>
                ))}
                {(!selectableLore || selectableLore.length === 0) && (
                  <p className="text-sm text-muted-foreground">No lore templates available</p>
                )}
              </div>
            )}
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <Label htmlFor="inter_entity_state">Inter-Entity State (JSON)</Label>
            <Textarea
              id="inter_entity_state"
              value={wizardData.inter_entity_state}
              onChange={(e) => setWizardData({ ...wizardData, inter_entity_state: e.target.value })}
              placeholder='{"entity1_id": {"relationship": "entity2_id", "status": "friendly"}}'
              rows={12}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Enter JSON object defining relationships between entities in this pack.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  if (isEditing && isLoadingPack) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/creations/packs')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{isEditing ? 'Edit' : 'Create New'} Content Pack</h1>
          <p className="text-muted-foreground mt-2">
            Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1].title}
          </p>
        </div>
      </div>

      <Progress value={(currentStep / STEPS.length) * 100} className="w-full" />

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[currentStep - 1].title}</CardTitle>
          <CardDescription>{STEPS[currentStep - 1].description}</CardDescription>
        </CardHeader>
        <CardContent>{renderStep()}</CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="flex gap-2">
          {currentStep < STEPS.length ? (
            <Button onClick={handleNext}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting || !wizardData.display_name}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Pack'
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

