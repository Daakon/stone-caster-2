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
import { Badge } from '@/components/ui/badge';
import { X, Plus, AlertCircle } from 'lucide-react';
import { apiPost, apiPut, apiGet } from '@/lib/api';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { worldsService, type World } from '@/services/admin.worlds';

// Comprehensive schema for world creation
const createWorldSchema = z.object({
  // Basic fields
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  visibility: z.enum(['private', 'public', 'unlisted']).default('private'),
  
  // Doc fields
  slug: z.string().optional(),
  tagline: z.string().optional(),
  short_desc: z.string().optional(),
  hero_quote: z.string().optional(),
  
  // Timeworld section
  timeworld: z.object({
    timezone: z.string().optional(),
    calendar: z.string().optional(),
    seasons: z.array(z.string()).optional(),
    bands: z.array(z.object({
      id: z.string(),
      label: z.string().optional(),
      icon: z.string().optional(),
      ticks: z.number().optional(),
    }).passthrough()).optional(),
    weather_states: z.array(z.string()).optional(),
    weather_transition_bias: z.string().optional(), // JSON string
    notes: z.string().optional(), // JSON string
  }).optional(),
  
  // Special rules (array of JSON strings that become top-level properties)
  special_rules: z.array(z.string()).optional(), // Array of JSON strings
  
  // Identity language (JSON string for linguistic_subs)
  identity_language_linguistic_subs: z.string().optional(), // JSON string
  
  // Lexicon
  lexicon: z.object({
    substitutions: z.string().optional(), // JSON string
    avoid: z.array(z.string()).optional(),
  }).optional(),
  
  // Trade and geography (JSON string)
  trade_and_geography: z.string().optional(), // JSON string
  
  // Lore index
  lore_index: z.object({
    entries: z.array(z.object({
      id: z.string(),
      tags: z.array(z.string()).optional(),
      text: z.string(),
    }).passthrough()).optional(),
    include_policy: z.string().optional(), // JSON string
  }).optional(),
  
  // Tone
  tone: z.object({
    style: z.array(z.string()).optional(),
    taboos: z.array(z.string()).optional(),
  }).optional(),
  
  // Locations
  locations: z.array(z.object({
    id: z.string(),
    name: z.string(),
  }).passthrough()).optional(),
  
  // Slices
  slices: z.array(z.object({
    id: z.string(),
    kind: z.string(),
    text: z.string(),
    tags: z.array(z.string()).optional(),
  }).passthrough()).optional(),
  
  // Custom module rules (JSON)
  custom_module_rules: z.string().optional(), // JSON string, validated on submit
});

type CreateWorldFormData = z.infer<typeof createWorldSchema>;

interface CreateWorldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (worldId: string) => void;
  worldId?: string; // Optional: if provided, edit mode
}

export function CreateWorldDialog({ open, onOpenChange, onCreated, worldId }: CreateWorldDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();
  const isEditMode = !!worldId;
  
  const form = useForm<CreateWorldFormData>({
    resolver: zodResolver(createWorldSchema),
    defaultValues: {
      name: '',
      description: '',
      status: 'draft',
      visibility: 'private',
      slug: '',
      tagline: '',
      short_desc: '',
      hero_quote: '',
      timeworld: undefined,
      special_rules: [],
      identity_language_linguistic_subs: '',
      lexicon: undefined,
      trade_and_geography: '',
      lore_index: undefined,
      tone: undefined,
      locations: [],
      slices: [],
      custom_module_rules: '',
    },
  });

  // Load world data when editing
  useEffect(() => {
    if (open && worldId && isEditMode) {
      setIsLoading(true);
      worldsService.getWorld(worldId)
        .then((world: World) => {
          // Extract basic fields
          form.setValue('name', world.name || '');
          form.setValue('description', world.description || '');
          form.setValue('status', world.status || 'draft');
          form.setValue('visibility', world.visibility || 'private');
          form.setValue('slug', world.slug || world.doc?.slug || '');

          // Extract doc fields
          const doc = world.doc || {};
          form.setValue('tagline', doc.tagline || '');
          form.setValue('short_desc', doc.short_desc || '');
          form.setValue('hero_quote', doc.hero_quote || '');
          form.setValue('special_rules', doc.special_rules || '');

          // Timeworld - always initialize the object for field arrays to work
          form.setValue('timeworld', {
            timezone: doc.timeworld?.timezone || '',
            calendar: doc.timeworld?.calendar || '',
            seasons: doc.timeworld?.seasons || [],
            bands: doc.timeworld?.bands || [],
            weather_states: doc.timeworld?.weather_states || [],
            weather_transition_bias: doc.timeworld?.weather_transition_bias 
              ? JSON.stringify(doc.timeworld.weather_transition_bias, null, 2) 
              : '',
            notes: doc.timeworld?.notes 
              ? JSON.stringify(doc.timeworld.notes, null, 2) 
              : '',
          });

          // Special rules - extract magic, essence_behavior, species_rules, and any other non-standard top-level properties
          const specialRulesArray: string[] = [];
          const standardFields = ['slug', 'tagline', 'short_desc', 'hero_quote', 'timeworld', 
            'identity_language', 'lexicon', 'trade_and_geography', 'lore_index', 'tone', 'locations', 'slices',
            'id', 'name', 'version'];
          
          // Extract magic if present
          if (doc.magic) {
            specialRulesArray.push(JSON.stringify({ magic: doc.magic }, null, 2));
          }
          
          // Extract essence_behavior if present
          if (doc.essence_behavior) {
            specialRulesArray.push(JSON.stringify({ essence_behavior: doc.essence_behavior }, null, 2));
          }
          
          // Extract species_rules if present
          if (doc.species_rules) {
            specialRulesArray.push(JSON.stringify({ species_rules: doc.species_rules }, null, 2));
          }
          
          // Extract any other non-standard top-level properties
          Object.keys(doc).forEach(key => {
            if (!standardFields.includes(key) && key !== 'magic' && key !== 'essence_behavior' && key !== 'species_rules') {
              specialRulesArray.push(JSON.stringify({ [key]: doc[key] }, null, 2));
            }
          });
          
          form.setValue('special_rules', specialRulesArray);

          // Identity language - serialize linguistic_subs to JSON string
          form.setValue('identity_language_linguistic_subs', doc.identity_language?.linguistic_subs 
            ? JSON.stringify(doc.identity_language.linguistic_subs, null, 2) 
            : '');

          // Lexicon - serialize substitutions to JSON string
          form.setValue('lexicon', {
            substitutions: doc.lexicon?.substitutions 
              ? JSON.stringify(doc.lexicon.substitutions, null, 2) 
              : '',
            avoid: doc.lexicon?.avoid || [],
          });

          // Trade and geography - serialize to JSON string
          form.setValue('trade_and_geography', doc.trade_and_geography 
            ? JSON.stringify(doc.trade_and_geography, null, 2) 
            : '');

          // Lore index - always initialize for field arrays
          form.setValue('lore_index', {
            entries: doc.lore_index?.entries || [],
            include_policy: doc.lore_index?.include_policy 
              ? JSON.stringify(doc.lore_index.include_policy, null, 2) 
              : '',
          });

          // Tone - always initialize for field arrays
          form.setValue('tone', {
            style: doc.tone?.style || [],
            taboos: doc.tone?.taboos || [],
          });

          // Locations
          if (doc.locations) {
            form.setValue('locations', doc.locations);
          }

          // Slices
          if (doc.slices) {
            form.setValue('slices', doc.slices);
          }

          // Custom module rules - extract everything that's not in the standard fields
          // (This should be empty now since special_rules handles all non-standard fields)
          const customRules: Record<string, unknown> = {};
          Object.keys(doc).forEach(key => {
            if (!standardFields.includes(key) && key !== 'magic' && key !== 'essence_behavior' && key !== 'species_rules') {
              // Check if this key was already added to special_rules
              const alreadyInSpecialRules = specialRulesArray.some(rule => {
                try {
                  const parsed = JSON.parse(rule);
                  return Object.keys(parsed).includes(key);
                } catch {
                  return false;
                }
              });
              if (!alreadyInSpecialRules) {
                customRules[key] = doc[key];
              }
            }
          });
          if (Object.keys(customRules).length > 0) {
            form.setValue('custom_module_rules', JSON.stringify(customRules, null, 2));
          }
        })
        .catch((error) => {
          console.error('Failed to load world:', error);
          toast.error('Failed to load world data');
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else if (open && !worldId) {
      // Reset form for create mode
      form.reset();
    }
  }, [open, worldId, isEditMode, form]);

  // Auto-generate slug from name (only in create mode)
  const watchedName = form.watch('name');
  useEffect(() => {
    if (!isEditMode && watchedName && !form.getValues('slug')) {
      const slug = watchedName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      form.setValue('slug', slug);
    }
  }, [watchedName, form, isEditMode]);

  // Field arrays for dynamic fields
  const { fields: seasonFields, append: appendSeason, remove: removeSeason } = useFieldArray({
    control: form.control,
    name: 'timeworld.seasons',
  });

  const { fields: bandFields, append: appendBand, remove: removeBand } = useFieldArray({
    control: form.control,
    name: 'timeworld.bands',
  });

  const { fields: weatherFields, append: appendWeather, remove: removeWeather } = useFieldArray({
    control: form.control,
    name: 'timeworld.weather_states',
  });

  const { fields: locationFields, append: appendLocation, remove: removeLocation } = useFieldArray({
    control: form.control,
    name: 'locations',
  });

  const { fields: sliceFields, append: appendSlice, remove: removeSlice } = useFieldArray({
    control: form.control,
    name: 'slices',
  });

  const { fields: tabooFields, append: appendTaboo, remove: removeTaboo } = useFieldArray({
    control: form.control,
    name: 'tone.taboos',
  });

  const { fields: styleFields, append: appendStyle, remove: removeStyle } = useFieldArray({
    control: form.control,
    name: 'tone.style',
  });

  const { fields: avoidFields, append: appendAvoid, remove: removeAvoid } = useFieldArray({
    control: form.control,
    name: 'lexicon.avoid',
  });

  const { fields: loreEntryFields, append: appendLoreEntry, remove: removeLoreEntry } = useFieldArray({
    control: form.control,
    name: 'lore_index.entries',
  });

  const { fields: specialRulesFields, append: appendSpecialRule, remove: removeSpecialRule } = useFieldArray({
    control: form.control,
    name: 'special_rules',
  });

  const onSubmit = async (data: CreateWorldFormData) => {
    setIsSubmitting(true);
    setJsonError(null);

    try {
      // Helper function to parse JSON strings with error handling
      const parseJSON = (jsonString: string | undefined, fieldName: string): any => {
        if (!jsonString || !jsonString.trim()) return undefined;
        try {
          return JSON.parse(jsonString);
        } catch (e) {
          setJsonError(`Invalid JSON in ${fieldName}`);
          throw new Error(`Invalid JSON in ${fieldName}`);
        }
      };

      // Validate and parse custom_module_rules JSON if provided
      let customModuleRules: Record<string, unknown> | undefined;
      if (data.custom_module_rules && data.custom_module_rules.trim()) {
        try {
          customModuleRules = JSON.parse(data.custom_module_rules);
        } catch (e) {
          setJsonError('Invalid JSON in Custom Module Rules');
          setIsSubmitting(false);
          return;
        }
      }

      // Build doc object from form data
      const doc: Record<string, unknown> = {};

      // Basic doc fields
      if (data.slug) doc.slug = data.slug;
      if (data.tagline) doc.tagline = data.tagline;
      if (data.short_desc) doc.short_desc = data.short_desc;
      if (data.hero_quote) doc.hero_quote = data.hero_quote;

      // Timeworld
      if (data.timeworld) {
        const timeworld: Record<string, unknown> = {};
        if (data.timeworld.timezone) timeworld.timezone = data.timeworld.timezone;
        if (data.timeworld.calendar) timeworld.calendar = data.timeworld.calendar;
        if (data.timeworld.seasons && data.timeworld.seasons.length > 0) timeworld.seasons = data.timeworld.seasons;
        if (data.timeworld.bands && data.timeworld.bands.length > 0) timeworld.bands = data.timeworld.bands;
        if (data.timeworld.weather_states && data.timeworld.weather_states.length > 0) timeworld.weather_states = data.timeworld.weather_states;
        
        // Parse weather_transition_bias JSON string
        const weatherBias = parseJSON(data.timeworld.weather_transition_bias, 'Weather Transition Bias');
        if (weatherBias && Object.keys(weatherBias).length > 0) {
          timeworld.weather_transition_bias = weatherBias;
        }
        
        // Parse notes JSON string
        const notes = parseJSON(data.timeworld.notes, 'Timeworld Notes');
        if (notes && Object.keys(notes).length > 0) {
          timeworld.notes = notes;
        }
        
        if (Object.keys(timeworld).length > 0) doc.timeworld = timeworld;
      }

      // Special rules - parse each JSON string and merge as top-level properties
      if (data.special_rules && data.special_rules.length > 0) {
        for (const ruleJson of data.special_rules) {
          if (ruleJson && ruleJson.trim()) {
            try {
              const parsed = JSON.parse(ruleJson);
              // Merge parsed object as top-level properties
              Object.assign(doc, parsed);
            } catch (e) {
              setJsonError(`Invalid JSON in Special Rules: ${e instanceof Error ? e.message : 'Unknown error'}`);
              setIsSubmitting(false);
              return;
            }
          }
        }
      }

      // Identity language - parse linguistic_subs JSON string
      const linguisticSubs = parseJSON(data.identity_language_linguistic_subs, 'Linguistic Substitutions');
      if (linguisticSubs && Object.keys(linguisticSubs).length > 0) {
        doc.identity_language = { linguistic_subs: linguisticSubs };
      }

      // Lexicon
      if (data.lexicon) {
        const lexicon: Record<string, unknown> = {};
        // Parse substitutions JSON string
        const substitutions = parseJSON(data.lexicon.substitutions, 'Lexicon Substitutions');
        if (substitutions && Object.keys(substitutions).length > 0) {
          lexicon.substitutions = substitutions;
        }
        if (data.lexicon.avoid && data.lexicon.avoid.length > 0) {
          lexicon.avoid = data.lexicon.avoid;
        }
        if (Object.keys(lexicon).length > 0) doc.lexicon = lexicon;
      }

      // Trade and geography - parse JSON string
      const tradeGeo = parseJSON(data.trade_and_geography, 'Trade and Geography');
      if (tradeGeo && Object.keys(tradeGeo).length > 0) {
        doc.trade_and_geography = tradeGeo;
      }

      // Lore index
      if (data.lore_index) {
        const loreIndex: Record<string, unknown> = {};
        if (data.lore_index.entries && data.lore_index.entries.length > 0) {
          loreIndex.entries = data.lore_index.entries;
        }
        // Parse include_policy JSON string
        const includePolicy = parseJSON(data.lore_index.include_policy, 'Lore Index Include Policy');
        if (includePolicy && Object.keys(includePolicy).length > 0) {
          loreIndex.include_policy = includePolicy;
        }
        if (Object.keys(loreIndex).length > 0) doc.lore_index = loreIndex;
      }

      // Tone
      if (data.tone) {
        const tone: Record<string, unknown> = {};
        if (data.tone.style && data.tone.style.length > 0) tone.style = data.tone.style;
        if (data.tone.taboos && data.tone.taboos.length > 0) tone.taboos = data.tone.taboos;
        if (Object.keys(tone).length > 0) doc.tone = tone;
      }

      // Locations
      if (data.locations && data.locations.length > 0) {
        doc.locations = data.locations;
      }

      // Slices
      if (data.slices && data.slices.length > 0) {
        doc.slices = data.slices;
      }

      // Merge custom module rules (preserve existing module-specific rules)
      if (customModuleRules) {
        Object.assign(doc, customModuleRules);
      }

      // Submit to API
      let result;
      if (isEditMode && worldId) {
        // Update existing world
        result = await apiPut<{ ok: boolean; data: { id: string; name: string } }>(`/api/admin/worlds/${worldId}`, {
          name: data.name,
          description: data.description || '',
          status: data.status,
          visibility: data.visibility,
          doc: doc,
        });
        
        if (!result.ok) {
          throw new Error(result.error.message || 'Failed to update world');
        }
        
        toast.success('World updated successfully');
      } else {
        // Create new world
        result = await apiPost<{ ok: boolean; data: { id: string; name: string } }>('/api/admin/worlds', {
          name: data.name,
          description: data.description || '',
          status: data.status,
          visibility: data.visibility,
          doc: doc,
        });
        
        if (!result.ok) {
          throw new Error(result.error.message || 'Failed to create world');
        }
        
        toast.success('World created successfully');
      }
      
      // Only invalidate worlds query when creating a new world
      // When editing, don't invalidate to avoid form resets in parent components
      if (!isEditMode) {
        await queryClient.invalidateQueries({ queryKey: ['worlds'] });
        await queryClient.invalidateQueries({ queryKey: ['admin-worlds'] });
      }
      
      // Call onCreated with the world ID (existing or new)
      const worldIdResult = isEditMode && worldId ? worldId : result.data.data.id;
      onCreated(worldIdResult);
      
      // Reset form and close dialog
      form.reset();
      setJsonError(null);
      onOpenChange(false);
    } catch (error) {
      console.error(`Failed to ${isEditMode ? 'update' : 'create'} world:`, error);
      toast.error(error instanceof Error ? error.message : `Failed to ${isEditMode ? 'update' : 'create'} world`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit World' : 'Create New World'}</DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? 'Edit world details. All fields are optional except name.'
              : 'Create a new world with all its details. All fields are optional except name.'}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-sm text-muted-foreground">Loading world data...</p>
            </div>
          </div>
        ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Basic Information</h3>
            
            <div>
              <Label htmlFor="world-name">Name *</Label>
              <Input
                id="world-name"
                {...form.register('name')}
                placeholder="Enter world name"
                autoFocus
              />
              {form.formState.errors.name && (
                <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="world-slug">Slug</Label>
              <Input
                id="world-slug"
                {...form.register('slug')}
                placeholder="Auto-generated from name"
              />
              <p className="text-xs text-muted-foreground mt-1">
                URL-friendly identifier (auto-generated from name)
              </p>
            </div>
            
            <div>
              <Label htmlFor="world-description">Description</Label>
              <Textarea
                id="world-description"
                {...form.register('description')}
                placeholder="Enter world description"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="world-status">Status</Label>
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
                <Label htmlFor="world-visibility">Visibility</Label>
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
          </div>

          {/* World Doc Fields */}
          <Accordion type="multiple" className="w-full">
            {/* Presentation */}
            <AccordionItem value="presentation">
              <AccordionTrigger>Presentation</AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div>
                  <Label htmlFor="world-tagline">Tagline</Label>
                  <Input
                    id="world-tagline"
                    {...form.register('tagline')}
                    placeholder="Short tagline for the world"
                  />
                </div>

                <div>
                  <Label htmlFor="world-short-desc">Short Description</Label>
                  <Textarea
                    id="world-short-desc"
                    {...form.register('short_desc')}
                    placeholder="Brief description"
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="world-hero-quote">Hero Quote</Label>
                  <Textarea
                    id="world-hero-quote"
                    {...form.register('hero_quote')}
                    placeholder="Inspiring quote about the world"
                    rows={2}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Timeworld */}
            <AccordionItem value="timeworld">
              <AccordionTrigger>Timeworld</AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="timeworld-timezone">Timezone</Label>
                    <Input
                      id="timeworld-timezone"
                      {...form.register('timeworld.timezone')}
                      placeholder="e.g., UTC"
                    />
                  </div>

                  <div>
                    <Label htmlFor="timeworld-calendar">Calendar</Label>
                    <Input
                      id="timeworld-calendar"
                      {...form.register('timeworld.calendar')}
                      placeholder="Calendar system name"
                    />
                  </div>
                </div>

                <div>
                  <Label>Seasons</Label>
                  <div className="space-y-2">
                    {seasonFields.map((field, index) => (
                      <div key={field.id} className="flex gap-2">
                        <Input
                          {...form.register(`timeworld.seasons.${index}`)}
                          placeholder="Season name"
                        />
                        <Button type="button" variant="outline" size="icon" onClick={() => removeSeason(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => appendSeason('')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Season
                    </Button>
                  </div>
                </div>

                <div>
                  <Label>Time Bands</Label>
                  <div className="space-y-2">
                    {bandFields.map((field, index) => (
                      <div key={field.id} className="grid grid-cols-5 gap-2">
                        <Input
                          {...form.register(`timeworld.bands.${index}.id`)}
                          placeholder="ID"
                        />
                        <Input
                          {...form.register(`timeworld.bands.${index}.label`)}
                          placeholder="Label"
                        />
                        <Input
                          {...form.register(`timeworld.bands.${index}.icon`)}
                          placeholder="Icon (emoji)"
                        />
                        <Input
                          type="number"
                          {...form.register(`timeworld.bands.${index}.ticks`, { valueAsNumber: true })}
                          placeholder="Ticks"
                        />
                        <Button type="button" variant="outline" size="icon" onClick={() => removeBand(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => appendBand({ id: '', label: '', icon: '', ticks: 0 })}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Band
                    </Button>
                  </div>
                </div>

                <div>
                  <Label>Weather States</Label>
                  <div className="space-y-2">
                    {weatherFields.map((field, index) => (
                      <div key={field.id} className="flex gap-2">
                        <Input
                          {...form.register(`timeworld.weather_states.${index}`)}
                          placeholder="Weather state"
                        />
                        <Button type="button" variant="outline" size="icon" onClick={() => removeWeather(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => appendWeather('')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Weather State
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="timeworld-weather-bias">Weather Transition Bias</Label>
                  <Textarea
                    id="timeworld-weather-bias"
                    {...form.register('timeworld.weather_transition_bias')}
                    placeholder='Enter as JSON: {"fog->clear": 0.15, "clear->rain": 0.1}'
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Key-value pairs for weather transition probabilities (JSON format)
                  </p>
                </div>

                <div>
                  <Label htmlFor="timeworld-notes">Timeworld Notes</Label>
                  <Textarea
                    id="timeworld-notes"
                    {...form.register('timeworld.notes')}
                    placeholder='Enter as JSON: {"dawn_to_mid_day": "Foraging and quiet travel favored."}'
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Key-value pairs for band-specific notes (JSON format)
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Special Rules */}
            <AccordionItem value="special-rules">
              <AccordionTrigger>Special Rules</AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div>
                  <Label>World-Specific Rules (JSON Objects)</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Add JSON objects that will become top-level properties in the world doc. 
                    Examples: magic, essence_behavior, species_rules, or any other world-specific rules.
                  </p>
                  <div className="space-y-2">
                    {specialRulesFields.map((field, index) => (
                      <div key={field.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Rule {index + 1}</Label>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="icon" 
                            onClick={() => removeSpecialRule(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <Textarea
                          {...form.register(`special_rules.${index}`)}
                          placeholder='{"magic": {"rules": [...], "domains": [...]}}'
                          rows={6}
                          className="font-mono text-sm"
                        />
                      </div>
                    ))}
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={() => appendSpecialRule('{}')}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Special Rule
                    </Button>
                  </div>
                  {jsonError && jsonError.includes('Special Rules') && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{jsonError}</AlertDescription>
                    </Alert>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Identity Language */}
            <AccordionItem value="identity-language">
              <AccordionTrigger>Identity Language</AccordionTrigger>
              <AccordionContent>
                <div>
                  <Label htmlFor="identity-language-linguistic-subs">Linguistic Substitutions</Label>
                  <Textarea
                    id="identity-language-linguistic-subs"
                    {...form.register('identity_language_linguistic_subs')}
                    placeholder='Enter as JSON: {"okay": "very well", "intel": "gleanings", "minutes": "ticks"}'
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Key-value pairs for linguistic substitutions (JSON format)
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Lexicon */}
            <AccordionItem value="lexicon">
              <AccordionTrigger>Lexicon</AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div>
                  <Label htmlFor="lexicon-substitutions">Substitutions</Label>
                  <Textarea
                    id="lexicon-substitutions"
                    {...form.register('lexicon.substitutions')}
                    placeholder='Enter as JSON: {"word": "replacement"}'
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Key-value pairs for word substitutions (JSON format)
                  </p>
                </div>

                <div>
                  <Label>Words to Avoid</Label>
                  <div className="space-y-2">
                    {avoidFields.map((field, index) => (
                      <div key={field.id} className="flex gap-2">
                        <Input
                          {...form.register(`lexicon.avoid.${index}`)}
                          placeholder="Word to avoid"
                        />
                        <Button type="button" variant="outline" size="icon" onClick={() => removeAvoid(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => appendAvoid('')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Word
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Tone */}
            <AccordionItem value="tone">
              <AccordionTrigger>Tone</AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div>
                  <Label>Style</Label>
                  <div className="space-y-2">
                    {styleFields.map((field, index) => (
                      <div key={field.id} className="flex gap-2">
                        <Input
                          {...form.register(`tone.style.${index}`)}
                          placeholder="Style descriptor"
                        />
                        <Button type="button" variant="outline" size="icon" onClick={() => removeStyle(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => appendStyle('')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Style
                    </Button>
                  </div>
                </div>

                <div>
                  <Label>Taboos</Label>
                  <div className="space-y-2">
                    {tabooFields.map((field, index) => (
                      <div key={field.id} className="flex gap-2">
                        <Input
                          {...form.register(`tone.taboos.${index}`)}
                          placeholder="Taboo content"
                        />
                        <Button type="button" variant="outline" size="icon" onClick={() => removeTaboo(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => appendTaboo('')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Taboo
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Locations */}
            <AccordionItem value="locations">
              <AccordionTrigger>Locations</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {locationFields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-3 gap-2">
                      <Input
                        {...form.register(`locations.${index}.id`)}
                        placeholder="Location ID"
                      />
                      <Input
                        {...form.register(`locations.${index}.name`)}
                        placeholder="Location Name"
                      />
                      <Button type="button" variant="outline" size="icon" onClick={() => removeLocation(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => appendLocation({ id: '', name: '' })}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Location
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Slices */}
            <AccordionItem value="slices">
              <AccordionTrigger>Slices</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {sliceFields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-5 gap-2">
                      <Input
                        {...form.register(`slices.${index}.id`)}
                        placeholder="ID"
                      />
                      <Input
                        {...form.register(`slices.${index}.kind`)}
                        placeholder="Kind"
                      />
                      <Textarea
                        {...form.register(`slices.${index}.text`)}
                        placeholder="Text"
                        rows={1}
                        className="col-span-2"
                      />
                      <Button type="button" variant="outline" size="icon" onClick={() => removeSlice(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => appendSlice({ id: '', kind: '', text: '' })}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Slice
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Trade and Geography */}
            <AccordionItem value="trade-geography">
              <AccordionTrigger>Trade and Geography</AccordionTrigger>
              <AccordionContent>
                <div>
                  <Label htmlFor="trade-geography">Trade and Geography</Label>
                  <Textarea
                    id="trade-geography"
                    {...form.register('trade_and_geography')}
                    placeholder='Enter as JSON: {"routes": ["forest_tracks", "old_roads"], "distant_markets": "Far-off cities host wealthy buyers"}'
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Trade routes, markets, and geographical information (JSON format)
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Lore Index */}
            <AccordionItem value="lore-index">
              <AccordionTrigger>Lore Index</AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div>
                  <Label>Lore Entries</Label>
                  <div className="space-y-2">
                    {loreEntryFields.map((field, index) => {
                      const tags = form.watch(`lore_index.entries.${index}.tags`) || [];
                      return (
                        <div key={field.id} className="border p-3 rounded space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              {...form.register(`lore_index.entries.${index}.id`)}
                              placeholder="Entry ID"
                            />
                            <Input
                              {...form.register(`lore_index.entries.${index}.text`)}
                              placeholder="Entry text"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Tags (comma-separated)</Label>
                            <div className="flex gap-2">
                              <Input
                                value={tags.join(', ')}
                                placeholder="species, shifters"
                                onChange={(e) => {
                                  const newTags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                                  form.setValue(`lore_index.entries.${index}.tags`, newTags);
                                }}
                              />
                              <Button type="button" variant="outline" size="icon" onClick={() => removeLoreEntry(index)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => appendLoreEntry({ id: '', text: '', tags: [] })}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Lore Entry
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="lore-index-include-policy">Include Policy</Label>
                  <Textarea
                    id="lore-index-include-policy"
                    {...form.register('lore_index.include_policy')}
                    placeholder='Enter as JSON: {"by_tags": "Only include entries whose tags intersect...", "entry_size": "≤120 chars each", "max_entries": 3}'
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Policy for including lore entries in prompts (JSON format)
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Custom Module Rules */}
            <AccordionItem value="custom-module-rules">
              <AccordionTrigger>Custom Module Rules (Advanced)</AccordionTrigger>
              <AccordionContent>
                <div>
                  <Label htmlFor="custom-module-rules">JSON Module Rules</Label>
                  <Textarea
                    id="custom-module-rules"
                    {...form.register('custom_module_rules')}
                    placeholder='{"magic": {...}, "essence_behavior": {...}, ...}'
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Advanced: Enter any additional world-specific module rules as JSON. 
                    Note: Use "Special Rules" section above for magic, essence_behavior, species_rules, etc.
                  </p>
                  {jsonError && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{jsonError}</AlertDescription>
                    </Alert>
                  )}
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
                setJsonError(null);
                onOpenChange(false);
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isLoading}>
              {isSubmitting ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update World' : 'Create World')}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
