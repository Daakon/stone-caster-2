/**
 * Chimera Ruleset Template Editor
 * Create or edit ruleset templates
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Save, Loader2, Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { chimeraService, type CreateRulesetTemplateData, type UpdateRulesetTemplateData } from '@/services/admin.chimera';

const RULE_TYPES = ['MAIN_SYSTEM', 'SUBSYSTEM', 'MODIFIER'] as const;
const RULE_CATEGORIES = [
  'CHARACTER_INIT',
  'SKILL_CHECK',
  'COMBAT_DAMAGE',
  'TIME_TRACKING',
  'RESOURCE_MANAGEMENT',
  'STATUS_EFFECTS',
  'INVENTORY_CAPACITY',
  'REPUTATION_CHANGE',
  'RELATIONSHIPS',
  'QUESTS',
] as const;

export default function RulesetTemplateEditor() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  const [formData, setFormData] = useState<CreateRulesetTemplateData>({
    display_name: '',
    description_short: null,
    description_long: null,
    rule_type: 'MAIN_SYSTEM',
    main_system_dependency: null,
    exclusion_group_id: null,
    new_exclusion_group_name: null,
    rule_category: 'SKILL_CHECK',
    definition: {},
  });

  const [exclusionGroupInput, setExclusionGroupInput] = useState<string>('');
  const [exclusionGroupSearch, setExclusionGroupSearch] = useState<string>('');
  const [isCreatingNewGroup, setIsCreatingNewGroup] = useState(false);
  const [exclusionGroupOpen, setExclusionGroupOpen] = useState<boolean>(false);

  const [definitionJson, setDefinitionJson] = useState('{}');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Load existing template if editing
  const { data: existingTemplate, isLoading: isLoadingTemplate } = useQuery({
    queryKey: ['chimera-ruleset-template', id],
    queryFn: () => chimeraService.getRulesetTemplate(id!),
    enabled: isEditing && !!id,
  });

  // Load exclusion groups
  const { data: exclusionGroups } = useQuery({
    queryKey: ['chimera-exclusion-groups'],
    queryFn: () => chimeraService.listExclusionGroups(),
    staleTime: 5 * 60 * 1000,
  });

  // Populate form when template loads
  useEffect(() => {
    if (existingTemplate) {
      console.log('[Editor] Loading existing template:', existingTemplate);
      setFormData({
        display_name: existingTemplate.display_name || '',
        description_short: existingTemplate.description_short,
        description_long: existingTemplate.description_long,
        rule_type: existingTemplate.rule_type || 'MAIN_SYSTEM',
        main_system_dependency: existingTemplate.main_system_dependency,
        exclusion_group_id: existingTemplate.exclusion_group_id,
        new_exclusion_group_name: null, // Always reset to null when loading existing
        rule_category: existingTemplate.rule_category || 'SKILL_CHECK',
        definition: existingTemplate.definition || {},
      });
      setDefinitionJson(JSON.stringify(existingTemplate.definition || {}, null, 2));
      
      // Set exclusion group input based on existing data
      if (existingTemplate.exclusion_group) {
        console.log('[Editor] Setting exclusion group from template:', existingTemplate.exclusion_group);
        setExclusionGroupInput(existingTemplate.exclusion_group.group_name);
        setIsCreatingNewGroup(false);
      } else if (existingTemplate.exclusion_group_id) {
        // If we have an ID but no relation loaded, try to find it in the list
        console.log('[Editor] Template has exclusion_group_id but no relation:', existingTemplate.exclusion_group_id);
        const foundGroup = exclusionGroups?.find((g) => g.id === existingTemplate.exclusion_group_id);
        if (foundGroup) {
          setExclusionGroupInput(foundGroup.group_name);
          setIsCreatingNewGroup(false);
        } else {
          setExclusionGroupInput('');
          setIsCreatingNewGroup(false);
        }
      } else {
        setExclusionGroupInput('');
        setIsCreatingNewGroup(false);
      }
    }
  }, [existingTemplate, exclusionGroups]);

  const handleChange = (field: keyof CreateRulesetTemplateData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateJson = (jsonString: string): boolean => {
    try {
      JSON.parse(jsonString);
      setJsonError(null);
      return true;
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : 'Invalid JSON');
      return false;
    }
  };

  const handleDefinitionChange = (value: string) => {
    setDefinitionJson(value);
    if (validateJson(value)) {
      handleChange('definition', JSON.parse(value));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate JSON before submit
    if (!validateJson(definitionJson)) {
      toast.error('Please fix JSON errors before submitting');
      return;
    }

    setIsSubmitting(true);
    try {
      // Prepare exclusion group data
      // Priority: use formData.new_exclusion_group_name if set, otherwise check formData.exclusion_group_id
      const exclusionGroupData: { exclusion_group_id?: string | null; new_exclusion_group_name?: string | null } = {};
      if (formData.new_exclusion_group_name && formData.new_exclusion_group_name.trim()) {
        // Creating a new exclusion group
        exclusionGroupData.new_exclusion_group_name = formData.new_exclusion_group_name.trim();
        exclusionGroupData.exclusion_group_id = null;
        console.log('[Editor] Creating new exclusion group:', exclusionGroupData.new_exclusion_group_name);
      } else if (formData.exclusion_group_id) {
        // Using an existing exclusion group
        exclusionGroupData.exclusion_group_id = formData.exclusion_group_id;
        exclusionGroupData.new_exclusion_group_name = null;
        console.log('[Editor] Using existing exclusion group:', exclusionGroupData.exclusion_group_id);
      } else {
        // No exclusion group
        exclusionGroupData.exclusion_group_id = null;
        exclusionGroupData.new_exclusion_group_name = null;
        console.log('[Editor] No exclusion group set');
      }

      console.log('[Editor] Form data before submit:', {
        formData,
        exclusionGroupData,
        isCreatingNewGroup,
        exclusionGroupInput,
      });

      if (isEditing && id) {
        const updateData: UpdateRulesetTemplateData = {
          ...formData,
          ...exclusionGroupData,
          definition: JSON.parse(definitionJson),
        };
        console.log('[Editor] Submitting update with data:', JSON.stringify(updateData, null, 2));
        console.log('[Editor] Update data keys:', Object.keys(updateData));
        console.log('[Editor] exclusion_group_id in updateData:', updateData.exclusion_group_id);
        console.log('[Editor] new_exclusion_group_name in updateData:', updateData.new_exclusion_group_name);
        await chimeraService.updateRulesetTemplate(id, updateData);
        toast.success('Ruleset template updated successfully');
      } else {
        const createData: CreateRulesetTemplateData = {
          ...formData,
          ...exclusionGroupData,
          definition: JSON.parse(definitionJson),
        };
        console.log('[Editor] Submitting create with data:', createData);
        await chimeraService.createRulesetTemplate(createData);
        toast.success('Ruleset template created successfully');
      }

      // Invalidate and refetch queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['chimera-ruleset-templates'] });
      await queryClient.invalidateQueries({ queryKey: ['chimera-ruleset-template', id] });
      await queryClient.invalidateQueries({ queryKey: ['chimera-exclusion-groups'] });
      
      // Refetch exclusion groups in case a new one was created
      await queryClient.refetchQueries({ queryKey: ['chimera-exclusion-groups'] });
      
      // If editing, refetch the template to show updated data
      if (isEditing && id) {
        await queryClient.refetchQueries({ queryKey: ['chimera-ruleset-template', id] });
      }
      
      navigate('/admin/chimera/rulesets');
    } catch (error) {
      console.error('Error saving ruleset template:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save ruleset template');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEditing && isLoadingTemplate) {
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
            {isEditing ? 'Edit Ruleset Template' : 'Create Ruleset Template'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isEditing ? 'Update the ruleset template details' : 'Create a new ruleset template for the Chimera V2 engine'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Template Details</CardTitle>
            <CardDescription>
              Configure the ruleset template properties
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="display_name">Display Name *</Label>
                <Input
                  id="display_name"
                  value={formData.display_name}
                  onChange={(e) => handleChange('display_name', e.target.value)}
                  placeholder="Enter display name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rule_type">Rule Type *</Label>
                <Select
                  key={`rule-type-${existingTemplate?.id || 'new'}-${formData.rule_type}`}
                  value={formData.rule_type ? String(formData.rule_type) : undefined}
                  onValueChange={(value) => handleChange('rule_type', value as typeof formData.rule_type)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select rule type" />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description_short">Short Description</Label>
              <Input
                id="description_short"
                value={formData.description_short || ''}
                onChange={(e) => handleChange('description_short', e.target.value || null)}
                placeholder="Brief description (max 500 characters)"
                maxLength={500}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description_long">Long Description</Label>
              <Textarea
                id="description_long"
                value={formData.description_long || ''}
                onChange={(e) => handleChange('description_long', e.target.value || null)}
                placeholder="Detailed description"
                rows={4}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rule_category">Rule Category *</Label>
                <Select
                  key={`rule-category-${existingTemplate?.id || 'new'}-${formData.rule_category}`}
                  value={formData.rule_category ? String(formData.rule_category) : undefined}
                  onValueChange={(value) => handleChange('rule_category', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select rule category" />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.rule_type === 'SUBSYSTEM' && (
                <div className="space-y-2">
                  <Label htmlFor="main_system_dependency">Main System Dependency *</Label>
                  <Input
                    id="main_system_dependency"
                    value={formData.main_system_dependency || ''}
                    onChange={(e) => handleChange('main_system_dependency', e.target.value || null)}
                    placeholder="ID of MAIN_SYSTEM template"
                    required={formData.rule_type === 'SUBSYSTEM'}
                  />
                  <p className="text-xs text-muted-foreground">
                    Reference to a MAIN_SYSTEM template this depends on
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="exclusion_group">Exclusion Group</Label>
              <Popover 
                open={exclusionGroupOpen} 
                onOpenChange={(open) => {
                  setExclusionGroupOpen(open);
                  // Reset search when opening/closing
                  if (open) {
                    // When opening, set search to current selection or empty
                    if (formData.exclusion_group_id) {
                      const selectedGroup = exclusionGroups?.find((g) => g.id === formData.exclusion_group_id);
                      setExclusionGroupSearch(selectedGroup?.group_name || '');
                    } else {
                      setExclusionGroupSearch('');
                    }
                  } else {
                    // When closing, clear search
                    setExclusionGroupSearch('');
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={exclusionGroupOpen}
                    className={cn(
                      'w-full justify-between',
                      !formData.exclusion_group_id && !isCreatingNewGroup && 'text-muted-foreground'
                    )}
                  >
                    {isCreatingNewGroup
                      ? `Create: ${exclusionGroupInput || 'New Group'}`
                      : formData.exclusion_group_id
                      ? exclusionGroups?.find((g) => g.id === formData.exclusion_group_id)?.group_name || 'Select group...'
                      : 'Select or create exclusion group...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-full p-0" 
                  align="start"
                  onOpenAutoFocus={(e) => {
                    // Prevent auto-focus on open to avoid form interference
                    e.preventDefault();
                  }}
                  onInteractOutside={(e) => {
                    // Prevent form from interfering when clicking outside
                    e.preventDefault();
                  }}
                >
                  <Command shouldFilter={false} loop={true}>
                    <CommandInput
                      placeholder="Search existing groups or type a new name..."
                      value={exclusionGroupSearch}
                      onValueChange={setExclusionGroupSearch}
                      onKeyDown={(e) => {
                        // Prevent form submission on Enter in search
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.stopPropagation();
                        }
                      }}
                    />
                    <CommandList>
                      <CommandGroup>
                        <CommandItem
                          value="none"
                          disabled={false}
                          onSelect={() => {
                            setExclusionGroupInput('');
                            setExclusionGroupSearch('');
                            setIsCreatingNewGroup(false);
                            setFormData({ ...formData, exclusion_group_id: null, new_exclusion_group_name: null });
                            setExclusionGroupOpen(false);
                          }}
                          className={cn(
                            "cursor-pointer",
                            "!pointer-events-auto !opacity-100",
                            "[&[data-disabled]]:!pointer-events-auto [&[data-disabled]]:!opacity-100"
                          )}
                          data-disabled="false"
                          style={{ 
                            pointerEvents: 'auto', 
                            opacity: 1,
                            cursor: 'pointer'
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setExclusionGroupInput('');
                            setExclusionGroupSearch('');
                            setIsCreatingNewGroup(false);
                            setFormData({ ...formData, exclusion_group_id: null, new_exclusion_group_name: null });
                            setExclusionGroupOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              !formData.exclusion_group_id && !isCreatingNewGroup ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          None
                        </CommandItem>
                        {exclusionGroups
                          ?.filter((group) => {
                            // Filter groups based on search
                            if (!exclusionGroupSearch.trim()) return true;
                            return group.group_name.toLowerCase().includes(exclusionGroupSearch.toLowerCase());
                          })
                          .map((group) => {
                            const handleSelect = () => {
                              setExclusionGroupInput(group.group_name);
                              setExclusionGroupSearch(group.group_name);
                              setIsCreatingNewGroup(false);
                              setFormData({
                                ...formData,
                                exclusion_group_id: group.id,
                                new_exclusion_group_name: null,
                              });
                              setExclusionGroupOpen(false);
                            };

                            return (
                              <CommandItem
                                key={group.id}
                                value={group.group_name}
                                disabled={false}
                                onSelect={handleSelect}
                                className={cn(
                                  "cursor-pointer",
                                  "!pointer-events-auto !opacity-100",
                                  "[&[data-disabled]]:!pointer-events-auto [&[data-disabled]]:!opacity-100"
                                )}
                                data-disabled="false"
                                style={{ 
                                  pointerEvents: 'auto', 
                                  opacity: 1,
                                  cursor: 'pointer'
                                }}
                                onMouseDown={(e) => {
                                  // Handle mousedown to ensure click works
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                onClick={(e) => {
                                  // Direct click handler - primary method
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleSelect();
                                }}
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    formData.exclusion_group_id === group.id ? 'opacity-100' : 'opacity-0'
                                  )}
                                />
                                {group.group_name}
                              </CommandItem>
                            );
                          })}
                      </CommandGroup>
                      {/* Show "Add New" option when search doesn't match any existing group */}
                      {exclusionGroupSearch.trim() && 
                       !exclusionGroups?.some((g) => 
                         g.group_name.toLowerCase() === exclusionGroupSearch.trim().toLowerCase()
                       ) && (
                        <CommandGroup heading="Create New">
                          <CommandItem
                            value={`add-${exclusionGroupSearch.trim()}`}
                            disabled={false}
                            onSelect={() => {
                              const newName = exclusionGroupSearch.trim();
                              console.log('[Editor] Add New clicked, setting new exclusion group:', newName);
                              setExclusionGroupInput(newName);
                              setIsCreatingNewGroup(true);
                              setFormData({
                                ...formData,
                                exclusion_group_id: null,
                                new_exclusion_group_name: newName,
                              });
                              console.log('[Editor] Form data after Add New:', {
                                exclusion_group_id: null,
                                new_exclusion_group_name: newName,
                              });
                              setExclusionGroupOpen(false);
                            }}
                            className={cn(
                              "cursor-pointer font-medium",
                              "!pointer-events-auto !opacity-100",
                              "[&[data-disabled]]:!pointer-events-auto [&[data-disabled]]:!opacity-100"
                            )}
                            data-disabled="false"
                            style={{ 
                              pointerEvents: 'auto', 
                              opacity: 1,
                              cursor: 'pointer'
                            }}
                            onMouseDown={(e) => {
                              // Handle mousedown to ensure click works
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onClick={(e) => {
                              // Direct click handler - primary method
                              e.preventDefault();
                              e.stopPropagation();
                              const newName = exclusionGroupSearch.trim();
                              console.log('[Editor] Add New onClick, setting new exclusion group:', newName);
                              setExclusionGroupInput(newName);
                              setIsCreatingNewGroup(true);
                              setFormData({
                                ...formData,
                                exclusion_group_id: null,
                                new_exclusion_group_name: newName,
                              });
                              console.log('[Editor] Form data after Add New onClick:', {
                                exclusion_group_id: null,
                                new_exclusion_group_name: newName,
                              });
                              setExclusionGroupOpen(false);
                            }}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add &quot;{exclusionGroupSearch.trim()}&quot;
                          </CommandItem>
                        </CommandGroup>
                      )}
                      <CommandEmpty>
                        {exclusionGroupSearch.trim() ? (
                          <div className="py-2 text-center text-sm text-muted-foreground">
                            No matching groups found. Use &quot;Add&quot; option above to create a new one.
                          </div>
                        ) : (
                          'Type to search or create a new exclusion group.'
                        )}
                      </CommandEmpty>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Rules in the same exclusion group cannot be active simultaneously. Select an existing group or type a new name to create one.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="definition">Definition (JSON) *</Label>
              <Textarea
                id="definition"
                value={definitionJson}
                onChange={(e) => handleDefinitionChange(e.target.value)}
                placeholder='{"key": "value"}'
                rows={12}
                className="font-mono text-sm"
              />
              {jsonError && (
                <Alert variant="destructive">
                  <AlertDescription>{jsonError}</AlertDescription>
                </Alert>
              )}
              <p className="text-xs text-muted-foreground">
                JSON definition for the ruleset template. Must be valid JSON.
              </p>
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/admin/chimera/rulesets')}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !!jsonError}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {isEditing ? 'Update Template' : 'Create Template'}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

