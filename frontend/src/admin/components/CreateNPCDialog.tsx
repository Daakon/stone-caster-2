import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { X, Plus } from 'lucide-react';
import { apiPost } from '@/lib/api';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

// Comprehensive schema for NPC creation following NPCDocV1
const createNPCSchema = z.object({
  // Basic fields
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  world_id: z.string().uuid('World ID must be a valid UUID').optional(),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  visibility: z.enum(['private', 'public', 'unlisted']).default('private'),
  
  // Additional NPC fields
  portrait_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  role_tags: z.array(z.string()).optional(),
  
  // NPC Doc fields (NPCDocV1 schema)
  display_name: z.string().min(1, 'Display name is required').max(64, 'Display name must be 64 characters or less'),
  archetype: z.string().max(48, 'Archetype must be 48 characters or less').optional(),
  summary: z.string().min(1, 'Summary is required').max(160, 'Summary must be 160 characters or less'),
  tags: z.array(z.string().min(1)).max(16, 'Maximum 16 tags allowed').optional(),
  
  // Traits (key-value pairs, values 0-100)
  traits: z.array(z.object({
    key: z.string().min(1),
    value: z.number().min(0).max(100),
  })).optional(),
  
  // Skills (key-value pairs, values 0-100)
  skills: z.array(z.object({
    key: z.string().min(1),
    value: z.number().min(0).max(100),
  })).optional(),
  
  // Style section
  style: z.object({
    voice: z.string().max(120, 'Voice must be 120 characters or less').optional(),
    register: z.string().max(32, 'Register must be 32 characters or less').optional(),
    taboos: z.array(z.string().min(1)).max(12, 'Maximum 12 taboos allowed').optional(),
  }).optional(),
  
  // Links section
  links: z.object({
    world_ref: z.string().optional(),
    adventure_refs: z.array(z.string().min(1)).optional(),
  }).optional(),
  
  // Slices
  slices: z.array(z.string().min(1)).optional(),
  
  // i18n (translations) - simplified for now, can be expanded
  i18n: z.record(z.object({
    display_name: z.string().max(64).optional(),
    summary: z.string().max(160).optional(),
  })).optional(),
});

type CreateNPCFormData = z.infer<typeof createNPCSchema>;

interface CreateNPCDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (npcId: string) => void;
  worldId?: string;
}

export function CreateNPCDialog({ open, onOpenChange, onCreated, worldId }: CreateNPCDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();
  
  const form = useForm<CreateNPCFormData>({
    resolver: zodResolver(createNPCSchema),
    defaultValues: {
      name: '',
      description: '',
      world_id: worldId || '',
      status: 'draft',
      visibility: 'private',
      portrait_url: '',
      role_tags: [],
      display_name: '',
      archetype: '',
      summary: '',
      tags: [],
      traits: [],
      skills: [],
      style: undefined,
      links: undefined,
      slices: [],
      i18n: undefined,
    },
  });

  // Update world_id when prop changes
  useEffect(() => {
    if (worldId) {
      form.setValue('world_id', worldId);
    }
  }, [worldId, form]);

  // Auto-fill display_name from name
  const watchedName = form.watch('name');
  useEffect(() => {
    if (watchedName && !form.getValues('display_name')) {
      form.setValue('display_name', watchedName);
    }
  }, [watchedName, form]);

  // Field arrays for dynamic fields
  const { fields: tagFields, append: appendTag, remove: removeTag } = useFieldArray({
    control: form.control,
    name: 'tags',
  });

  const { fields: roleTagFields, append: appendRoleTag, remove: removeRoleTag } = useFieldArray({
    control: form.control,
    name: 'role_tags',
  });

  const { fields: traitFields, append: appendTrait, remove: removeTrait } = useFieldArray({
    control: form.control,
    name: 'traits',
  });

  const { fields: skillFields, append: appendSkill, remove: removeSkill } = useFieldArray({
    control: form.control,
    name: 'skills',
  });

  const { fields: tabooFields, append: appendTaboo, remove: removeTaboo } = useFieldArray({
    control: form.control,
    name: 'style.taboos',
  });

  const { fields: adventureRefFields, append: appendAdventureRef, remove: removeAdventureRef } = useFieldArray({
    control: form.control,
    name: 'links.adventure_refs',
  });

  const { fields: sliceFields, append: appendSlice, remove: removeSlice } = useFieldArray({
    control: form.control,
    name: 'slices',
  });

  const onSubmit = async (data: CreateNPCFormData) => {
    setIsSubmitting(true);

    try {
      // Build doc.npc object following NPCDocV1 schema
      const npcDoc: Record<string, unknown> = {
        display_name: data.display_name,
      };

      if (data.archetype) npcDoc.archetype = data.archetype;
      if (data.summary) npcDoc.summary = data.summary;
      if (data.tags && data.tags.length > 0) npcDoc.tags = data.tags;

      // Traits
      if (data.traits && data.traits.length > 0) {
        const traits: Record<string, number> = {};
        data.traits.forEach(trait => {
          if (trait.key) traits[trait.key] = trait.value;
        });
        if (Object.keys(traits).length > 0) npcDoc.traits = traits;
      }

      // Skills
      if (data.skills && data.skills.length > 0) {
        const skills: Record<string, number> = {};
        data.skills.forEach(skill => {
          if (skill.key) skills[skill.key] = skill.value;
        });
        if (Object.keys(skills).length > 0) npcDoc.skills = skills;
      }

      // Style
      if (data.style) {
        const style: Record<string, unknown> = {};
        if (data.style.voice) style.voice = data.style.voice;
        if (data.style.register) style.register = data.style.register;
        if (data.style.taboos && data.style.taboos.length > 0) style.taboos = data.style.taboos;
        if (Object.keys(style).length > 0) npcDoc.style = style;
      }

      // Links
      if (data.links) {
        const links: Record<string, unknown> = {};
        if (data.links.world_ref) links.world_ref = data.links.world_ref;
        if (data.links.adventure_refs && data.links.adventure_refs.length > 0) {
          links.adventure_refs = data.links.adventure_refs;
        }
        if (Object.keys(links).length > 0) npcDoc.links = links;
      }

      // Slices
      if (data.slices && data.slices.length > 0) {
        npcDoc.slices = data.slices;
      }

      // i18n
      if (data.i18n && Object.keys(data.i18n).length > 0) {
        npcDoc.i18n = data.i18n;
      }

      const doc = { npc: npcDoc };

      // Submit to API
      const result = await apiPost<{ ok: boolean; data: { id: string; name: string } }>('/api/admin/npcs', {
        name: data.name,
        description: data.description || '',
        world_id: data.world_id || worldId || null,
        status: data.status,
        visibility: data.visibility,
        portrait_url: data.portrait_url || null,
        role_tags: data.role_tags && data.role_tags.length > 0 ? data.role_tags : null,
        doc: doc,
      });
      
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to create NPC');
      }
      
      toast.success('NPC created successfully');
      
      // Invalidate NPCs queries to refresh the list
      await queryClient.invalidateQueries({ queryKey: ['npcs'] });
      await queryClient.invalidateQueries({ queryKey: ['npcs', 'my'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-npcs'] });
      
      // Call onCreated with the new NPC ID
      onCreated(result.data.data.id);
      
      // Reset form and close dialog
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create NPC:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create NPC');
    } finally {
      setIsSubmitting(false);
    }
  };

  const watchedSummary = form.watch('summary');
  const summaryLength = watchedSummary?.length || 0;
  const summaryMaxLength = 160;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New NPC</DialogTitle>
          <DialogDescription>
            Create a new NPC with all its details. Required fields: Name, Display Name, Summary.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Basic Information</h3>
            
            <div>
              <Label htmlFor="npc-name">Name *</Label>
              <Input
                id="npc-name"
                {...form.register('name')}
                placeholder="Enter NPC name"
                autoFocus
              />
              {form.formState.errors.name && (
                <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="npc-display-name">Display Name *</Label>
              <Input
                id="npc-display-name"
                {...form.register('display_name')}
                placeholder="Display name (max 64 chars)"
                maxLength={64}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {form.watch('display_name')?.length || 0} / 64 characters
              </p>
              {form.formState.errors.display_name && (
                <p className="text-sm text-red-600 mt-1">{form.formState.errors.display_name.message}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="npc-description">Description</Label>
              <Textarea
                id="npc-description"
                {...form.register('description')}
                placeholder="Enter NPC description (optional)"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="npc-summary">Summary *</Label>
              <Textarea
                id="npc-summary"
                {...form.register('summary')}
                placeholder="Brief summary (max 160 chars)"
                rows={3}
                maxLength={160}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {summaryLength} / {summaryMaxLength} characters
              </p>
              {form.formState.errors.summary && (
                <p className="text-sm text-red-600 mt-1">{form.formState.errors.summary.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="npc-status">Status</Label>
                <Select
                  value={form.watch('status')}
                  onValueChange={(value) => form.setValue('status', value as 'draft' | 'active' | 'archived')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="npc-visibility">Visibility</Label>
                <Select
                  value={form.watch('visibility')}
                  onValueChange={(value) => form.setValue('visibility', value as 'private' | 'public' | 'unlisted')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="unlisted">Unlisted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="npc-portrait-url">Portrait URL</Label>
              <Input
                id="npc-portrait-url"
                {...form.register('portrait_url')}
                placeholder="https://example.com/portrait.jpg"
                type="url"
              />
              {form.formState.errors.portrait_url && (
                <p className="text-sm text-red-600 mt-1">{form.formState.errors.portrait_url.message}</p>
              )}
            </div>
          </div>

          {/* NPC Doc Fields */}
          <Accordion type="multiple" className="w-full">
            {/* Core Attributes */}
            <AccordionItem value="core">
              <AccordionTrigger>Core Attributes</AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div>
                  <Label htmlFor="npc-archetype">Archetype</Label>
                  <Input
                    id="npc-archetype"
                    {...form.register('archetype')}
                    placeholder="e.g., Warrior, Scholar, Rogue"
                    maxLength={48}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {form.watch('archetype')?.length || 0} / 48 characters
                  </p>
                </div>

                <div>
                  <Label>Tags</Label>
                  <div className="space-y-2">
                    {tagFields.map((field, index) => (
                      <div key={field.id} className="flex gap-2">
                        <Input
                          {...form.register(`tags.${index}`)}
                          placeholder="Tag"
                        />
                        <Button type="button" variant="outline" size="icon" onClick={() => removeTag(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {tagFields.length < 16 && (
                      <Button type="button" variant="outline" size="sm" onClick={() => appendTag('')}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Tag (max 16)
                      </Button>
                    )}
                  </div>
                </div>

                <div>
                  <Label>Role Tags</Label>
                  <div className="space-y-2">
                    {roleTagFields.map((field, index) => (
                      <div key={field.id} className="flex gap-2">
                        <Input
                          {...form.register(`role_tags.${index}`)}
                          placeholder="Role tag"
                        />
                        <Button type="button" variant="outline" size="icon" onClick={() => removeRoleTag(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => appendRoleTag('')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Role Tag
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Traits */}
            <AccordionItem value="traits">
              <AccordionTrigger>Traits</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {traitFields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-4 gap-2">
                      <Input
                        {...form.register(`traits.${index}.key`)}
                        placeholder="Trait name"
                        className="col-span-2"
                      />
                      <Input
                        type="number"
                        {...form.register(`traits.${index}.value`, { valueAsNumber: true })}
                        placeholder="Value (0-100)"
                        min={0}
                        max={100}
                      />
                      <Button type="button" variant="outline" size="icon" onClick={() => removeTrait(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => appendTrait({ key: '', value: 0 })}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Trait
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Skills */}
            <AccordionItem value="skills">
              <AccordionTrigger>Skills</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {skillFields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-4 gap-2">
                      <Input
                        {...form.register(`skills.${index}.key`)}
                        placeholder="Skill name"
                        className="col-span-2"
                      />
                      <Input
                        type="number"
                        {...form.register(`skills.${index}.value`, { valueAsNumber: true })}
                        placeholder="Value (0-100)"
                        min={0}
                        max={100}
                      />
                      <Button type="button" variant="outline" size="icon" onClick={() => removeSkill(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => appendSkill({ key: '', value: 0 })}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Skill
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Style */}
            <AccordionItem value="style">
              <AccordionTrigger>Style</AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div>
                  <Label htmlFor="style-voice">Voice</Label>
                  <Textarea
                    id="style-voice"
                    {...form.register('style.voice')}
                    placeholder="e.g., wry, concise, observant"
                    rows={2}
                    maxLength={120}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {form.watch('style.voice')?.length || 0} / 120 characters
                  </p>
                </div>

                <div>
                  <Label htmlFor="style-register">Register</Label>
                  <Select
                    value={form.watch('style.register') || ''}
                    onValueChange={(value) => form.setValue('style.register', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select register" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="formal">Formal</SelectItem>
                      <SelectItem value="playful">Playful</SelectItem>
                      <SelectItem value="stoic">Stoic</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    className="mt-2"
                    {...form.register('style.register')}
                    placeholder="Or enter custom register"
                    maxLength={32}
                  />
                </div>

                <div>
                  <Label>Taboos</Label>
                  <div className="space-y-2">
                    {tabooFields.map((field, index) => (
                      <div key={field.id} className="flex gap-2">
                        <Input
                          {...form.register(`style.taboos.${index}`)}
                          placeholder="Content the NPC avoids"
                        />
                        <Button type="button" variant="outline" size="icon" onClick={() => removeTaboo(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {tabooFields.length < 12 && (
                      <Button type="button" variant="outline" size="sm" onClick={() => appendTaboo('')}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Taboo (max 12)
                      </Button>
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Links */}
            <AccordionItem value="links">
              <AccordionTrigger>Links</AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div>
                  <Label htmlFor="links-world-ref">World Reference</Label>
                  <Input
                    id="links-world-ref"
                    {...form.register('links.world_ref')}
                    placeholder="World ID or reference"
                  />
                </div>

                <div>
                  <Label>Adventure References</Label>
                  <div className="space-y-2">
                    {adventureRefFields.map((field, index) => (
                      <div key={field.id} className="flex gap-2">
                        <Input
                          {...form.register(`links.adventure_refs.${index}`)}
                          placeholder="Adventure ID or reference"
                        />
                        <Button type="button" variant="outline" size="icon" onClick={() => removeAdventureRef(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => appendAdventureRef('')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Adventure Reference
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Slices */}
            <AccordionItem value="slices">
              <AccordionTrigger>Slices</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {sliceFields.map((field, index) => (
                    <div key={field.id} className="flex gap-2">
                      <Input
                        {...form.register(`slices.${index}`)}
                        placeholder="Slice name (e.g., core, bio, lore)"
                      />
                      <Button type="button" variant="outline" size="icon" onClick={() => removeSlice(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => appendSlice('')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Slice
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                form.reset();
                onOpenChange(false);
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create NPC'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
