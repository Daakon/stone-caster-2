/**
 * Lore Template Editor
 * Form for creating/editing lore templates
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ArrowLeft, Loader2, Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { chimeraLoreService, type CreateLoreData, type UpdateLoreData, type ChimeraTag } from '@/services/chimera.lore';
import { ComplexAssetSelector } from '@/components/chimera/ComplexAssetSelector';

export default function LoreEditor() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    display_name: '',
    entry_text: '',
    tag_names: [] as string[],
  });
  const [tagSearch, setTagSearch] = useState('');
  const [tagOpen, setTagOpen] = useState(false);

  // Load existing lore if editing
  const { data: existingLore, isLoading: isLoadingLore } = useQuery({
    queryKey: ['chimera-lore', id],
    queryFn: () => (id ? chimeraLoreService.getLore(id) : null),
    enabled: isEditing && !!id,
  });

  // Load approved tags
  const { data: tags, isLoading: isLoadingTags } = useQuery({
    queryKey: ['chimera-tags'],
    queryFn: () => chimeraLoreService.getTags(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Populate form when editing
  useEffect(() => {
    if (existingLore) {
      setFormData({
        display_name: existingLore.display_name || '',
        entry_text: existingLore.content_chunk || '', // Map content_chunk to entry_text
        tag_names: existingLore.tags?.map((t) => t.tag_name) || [],
      });
      // Set world_id if available
      if (existingLore.world_id) {
        setSelectedWorldId(existingLore.world_id);
      }
    }
  }, [existingLore]);

  // Filter tags based on search
  const filteredTags = tags?.filter((tag) =>
    tag.tag_name.toLowerCase().includes(tagSearch.toLowerCase())
  ) || [];

  // Check if search matches an existing tag
  const searchMatchesExisting = filteredTags.some(
    (tag) => tag.tag_name.toLowerCase() === tagSearch.toLowerCase()
  );

  // Check if search matches a selected tag
  const searchMatchesSelected = formData.tag_names.some(
    (name) => name.toLowerCase() === tagSearch.toLowerCase()
  );

  const canCreateNew = tagSearch.trim() && !searchMatchesExisting && !searchMatchesSelected;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate world_id is selected for new lore entries
    if (!isEditing && !selectedWorldId) {
      toast.error('Please select a world for this lore entry.');
      return;
    }

    setIsSubmitting(true);

    try {
      const loreData: CreateLoreData | UpdateLoreData = {
        ...(isEditing ? {} : { world_id: selectedWorldId! }), // Only include world_id for new entries
        display_name: formData.display_name,
        entry_text: formData.entry_text,
        tag_names: formData.tag_names,
      };

      // Debug logging
      console.log('[LoreEditor] Submitting lore:', loreData);

      if (isEditing && id) {
        await chimeraLoreService.updateLore(id, loreData);
        toast.success('Lore template updated successfully');
      } else {
        await chimeraLoreService.createLore(loreData as CreateLoreData);
        toast.success('Lore template created successfully');
      }

      await queryClient.invalidateQueries({ queryKey: ['chimera-my-lore'] });
      navigate('/dashboard/creations/lore');
    } catch (error) {
      console.error('Error saving lore:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save lore template');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEditing && isLoadingLore) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/creations/lore')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{isEditing ? 'Edit' : 'Create New'} Lore Template</h1>
          <p className="text-muted-foreground mt-2">
            Create or edit background information and world-building content
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Lore Template Details</CardTitle>
            <CardDescription>Enter the information for this lore template</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>World {!isEditing && '*'}</Label>
              <ComplexAssetSelector
                assetType="world"
                selectedIds={selectedWorldId ? [selectedWorldId] : []}
                onSelectionChange={(worldIds) => setSelectedWorldId(worldIds[0] || null)}
                mode="single"
                emptyMessage="No worlds available. Create one first!"
                itemLabel="world"
                onCreateNew={() => {
                  window.open('/dashboard/worlds/new', '_blank');
                }}
                createNewLabel="Create New World"
              />
              <p className="text-xs text-muted-foreground mt-2">
                {isEditing 
                  ? 'The world this lore entry belongs to. Lore entries are world-specific and will be used by stories in that world.'
                  : 'Select the world this lore entry belongs to. Lore entries are world-specific and will be used by stories in that world.'}
              </p>
            </div>

            <div>
              <Label htmlFor="display_name">Display Name *</Label>
              <Input
                id="display_name"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                placeholder="Ancient History of the Realm"
                required
              />
            </div>

            <div>
              <Label htmlFor="entry_text">Content *</Label>
              <Textarea
                id="entry_text"
                value={formData.entry_text}
                onChange={(e) => setFormData({ ...formData, entry_text: e.target.value })}
                placeholder="Enter the lore content here..."
                rows={12}
                required
              />
            </div>

            <div>
              <Label>Tags</Label>
              <Popover open={tagOpen} onOpenChange={setTagOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={tagOpen}
                    className="w-full justify-between"
                    type="button"
                  >
                    {formData.tag_names.length > 0
                      ? `${formData.tag_names.length} tag${formData.tag_names.length !== 1 ? 's' : ''} selected`
                      : 'Select tags...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" onInteractOutside={(e) => e.preventDefault()}>
                  <Command shouldFilter={false} loop={true}>
                    <CommandInput
                      placeholder="Search existing tags or type a new name..."
                      value={tagSearch}
                      onValueChange={setTagSearch}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && canCreateNew) {
                          e.preventDefault();
                          const newTagName = tagSearch.trim().toUpperCase().replace(/\s+/g, '_');
                          if (!formData.tag_names.includes(newTagName)) {
                            setFormData({
                              ...formData,
                              tag_names: [...formData.tag_names, newTagName],
                            });
                            setTagSearch('');
                            setTagOpen(false);
                          }
                        }
                      }}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {canCreateNew ? (
                          <div className="py-2 text-center text-sm">
                            <Button
                              type="button"
                              variant="ghost"
                              className="w-full"
                              onClick={() => {
                                const newTagName = tagSearch.trim().toUpperCase().replace(/\s+/g, '_');
                                if (!formData.tag_names.includes(newTagName)) {
                                  setFormData({
                                    ...formData,
                                    tag_names: [...formData.tag_names, newTagName],
                                  });
                                  setTagSearch('');
                                  setTagOpen(false);
                                }
                              }}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Add &quot;{tagSearch.trim()}&quot;
                            </Button>
                          </div>
                        ) : (
                          'No tags found.'
                        )}
                      </CommandEmpty>
                      {canCreateNew && (
                        <CommandGroup heading="Create New">
                          <CommandItem
                            value="__create__"
                            onSelect={() => {
                              const newTagName = tagSearch.trim().toUpperCase().replace(/\s+/g, '_');
                              if (!formData.tag_names.includes(newTagName)) {
                                setFormData({
                                  ...formData,
                                  tag_names: [...formData.tag_names, newTagName],
                                });
                                setTagSearch('');
                                setTagOpen(false);
                              }
                            }}
                            className="cursor-pointer"
                            disabled={false}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const newTagName = tagSearch.trim().toUpperCase().replace(/\s+/g, '_');
                              if (!formData.tag_names.includes(newTagName)) {
                                setFormData({
                                  ...formData,
                                  tag_names: [...formData.tag_names, newTagName],
                                });
                                setTagSearch('');
                                setTagOpen(false);
                              }
                            }}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add &quot;{tagSearch.trim()}&quot;
                          </CommandItem>
                        </CommandGroup>
                      )}
                      <CommandGroup heading="Existing Tags">
                        {filteredTags.map((tag) => {
                          const isSelected = formData.tag_names.includes(tag.tag_name);
                          return (
                            <CommandItem
                              key={tag.id}
                              value={tag.tag_name}
                              onSelect={() => {
                                if (isSelected) {
                                  setFormData({
                                    ...formData,
                                    tag_names: formData.tag_names.filter((n) => n !== tag.tag_name),
                                  });
                                } else {
                                  setFormData({
                                    ...formData,
                                    tag_names: [...formData.tag_names, tag.tag_name],
                                  });
                                }
                                setTagSearch('');
                                setTagOpen(false);
                              }}
                              className={cn(
                                'cursor-pointer !pointer-events-auto !opacity-100',
                                '[&[data-disabled]]:!pointer-events-auto [&[data-disabled]]:!opacity-100'
                              )}
                              disabled={false}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (isSelected) {
                                  setFormData({
                                    ...formData,
                                    tag_names: formData.tag_names.filter((n) => n !== tag.tag_name),
                                  });
                                } else {
                                  setFormData({
                                    ...formData,
                                    tag_names: [...formData.tag_names, tag.tag_name],
                                  });
                                }
                                setTagSearch('');
                                setTagOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  isSelected ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                              {tag.tag_name}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {formData.tag_names.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.tag_names.map((tagName) => (
                    <span
                      key={tagName}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-secondary text-secondary-foreground rounded text-sm"
                    >
                      {tagName}
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            tag_names: formData.tag_names.filter((n) => n !== tagName),
                          });
                        }}
                        className="hover:text-destructive"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Select existing approved tags or create new ones (new tags require admin approval)
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/dashboard/creations/lore')}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || !formData.display_name || !formData.entry_text || (!isEditing && !selectedWorldId)}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Lore Template'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

