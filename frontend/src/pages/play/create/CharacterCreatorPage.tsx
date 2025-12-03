/**
 * Character Creator Page
 * Phase 5: Character Creator & Game Initialization
 * 
 * Route: /play/create/:storyId
 * 
 * Allows players to create their character based on the CompiledStory's schema
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, User, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { getCompiledStory, initializeGame, getWorld } from '@/services/chimera-api';
import type { CompiledStory } from '@shared/types/chimera-compiled';
import type { WorldDefinition } from '@shared/types/chimera-authoring';

// Base character form schema
const baseCharacterSchema = z.object({
  identity: z.object({
    name: z.string().min(1, 'Name is required'),
    pronouns: z.string().optional(),
    role: z.string().optional(),
    age: z.number().optional(),
  }),
  appearance: z.string().optional(),
  backstory: z.string().optional(),
  personality_traits: z.string().optional(), // Comma-separated
  drive: z.string().optional(),
  flaw: z.string().optional(),
});

type BaseCharacterForm = z.infer<typeof baseCharacterSchema>;

export default function CharacterCreatorPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();

  // Fetch compiled story
  const { data: compiledStory, isLoading: isLoadingStory } = useQuery({
    queryKey: ['compiled-story', storyId],
    queryFn: () => getCompiledStory(storyId!),
    enabled: !!storyId,
  });

  // Extract world ID from compiled story and fetch world for schema extensions
  const worldId = compiledStory?.meta.source_ids.find((id) => {
    // World IDs are UUIDs, ruleset IDs might not be
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  });

  const { data: world, isLoading: isLoadingWorld } = useQuery({
    queryKey: ['world', worldId],
    queryFn: () => getWorld(worldId!),
    enabled: !!worldId,
  });

  // Build dynamic schema based on world extensions
  const dynamicSchema = world?.character_schema_extensions
    ? baseCharacterSchema.extend(
        Object.keys(world.character_schema_extensions).reduce(
          (acc, key) => {
            acc[key] = z.unknown().optional();
            return acc;
          },
          {} as Record<string, z.ZodTypeAny>
        )
      )
    : baseCharacterSchema;

  const form = useForm<BaseCharacterForm & Record<string, unknown>>({
    resolver: zodResolver(dynamicSchema),
    defaultValues: {
      identity: {
        name: '',
        pronouns: '',
        role: '',
      },
      appearance: '',
      backstory: '',
      personality_traits: '',
      drive: '',
      flaw: '',
    },
  });

  // Initialize game mutation
  const initializeMutation = useMutation({
    mutationFn: initializeGame,
    onSuccess: (data) => {
      toast.success('Character created! Starting game...');
      navigate(`/play/${data.gameStateId}`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to create character');
    },
  });

  const onSubmit = (data: BaseCharacterForm & Record<string, unknown>) => {
    if (!storyId) {
      toast.error('Story ID is missing');
      return;
    }

    // Transform form data to PlayerInputDto format
    const playerInput = {
      identity: {
        name: data.identity.name,
        pronouns: data.identity.pronouns,
        role: data.identity.role,
        age: data.identity.age,
      },
      appearance: data.appearance ? { summary: data.appearance } : undefined,
      backstory: data.backstory,
      personality_traits: data.personality_traits
        ? data.personality_traits.split(',').map((t) => t.trim()).filter(Boolean)
        : undefined,
      drive: data.drive,
      flaw: data.flaw,
      // Include any world-specific extensions
      ...Object.keys(data).reduce((acc, key) => {
        if (
          !['identity', 'appearance', 'backstory', 'personality_traits', 'drive', 'flaw'].includes(
            key
          )
        ) {
          acc[key] = data[key];
        }
        return acc;
      }, {} as Record<string, unknown>),
    };

    initializeMutation.mutate({
      storyId,
      playerInput,
    });
  };

  const isLoading = isLoadingStory || isLoadingWorld;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!compiledStory) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">Story not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const worldName = world?.name || 'Unknown World';
  const schemaExtensions = world?.character_schema_extensions || {};

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <User className="h-6 w-6 text-purple-500" />
          <h1 className="text-3xl font-bold">Create Your Character</h1>
        </div>
        <p className="text-muted-foreground">
          Welcome to <strong>{worldName}</strong>. Define your character to begin your adventure.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
            <CardDescription>Basic information about your character</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                {...form.register('identity.name')}
                placeholder="Enter your character's name"
              />
              {form.formState.errors.identity?.name && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.identity.name.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="pronouns">Pronouns</Label>
              <Input
                id="pronouns"
                {...form.register('identity.pronouns')}
                placeholder="e.g., they/them, he/him, she/her"
              />
            </div>

            <div>
              <Label htmlFor="role">Role / Occupation</Label>
              <Input
                id="role"
                {...form.register('identity.role')}
                placeholder="e.g., Hedge Knight, Starship Pilot, Detective"
              />
            </div>

            <div>
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                {...form.register('identity.age', { valueAsNumber: true })}
                placeholder="Enter age"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Describe your character's appearance</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              {...form.register('appearance')}
              placeholder="Describe your character's appearance, style, and first impressions..."
              rows={4}
            />
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Backstory</CardTitle>
            <CardDescription>Your character's origin and history</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              {...form.register('backstory')}
              placeholder="Where they came from and what drives them..."
              rows={4}
            />
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Personality</CardTitle>
            <CardDescription>Define your character's traits and motivations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="personality_traits">Personality Traits</Label>
              <Input
                id="personality_traits"
                {...form.register('personality_traits')}
                placeholder="Comma-separated: Brave, Stubborn, Curious"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter traits separated by commas
              </p>
            </div>

            <div>
              <Label htmlFor="drive">Primary Goal / Ideal</Label>
              <Input
                id="drive"
                {...form.register('drive')}
                placeholder="What drives your character?"
              />
            </div>

            <div>
              <Label htmlFor="flaw">Major Flaw / Weakness</Label>
              <Input
                id="flaw"
                {...form.register('flaw')}
                placeholder="What is your character's greatest weakness?"
              />
            </div>
          </CardContent>
        </Card>

        {/* World-specific extensions */}
        {Object.keys(schemaExtensions).length > 0 && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>World-Specific Attributes</CardTitle>
              <CardDescription>
                Additional attributes specific to {worldName}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(schemaExtensions).map(([key, extension]) => {
                const ext = extension as Record<string, unknown>;
                const label = (ext.label as string) || key;
                const type = (ext.type as string) || 'text';
                const options = ext.options as string[] | undefined;
                const required = (ext.required as boolean) || false;

                return (
                  <div key={key}>
                    <Label htmlFor={key}>
                      {label}
                      {required && ' *'}
                    </Label>
                    {type === 'dropdown' || type === 'radio' ? (
                      <Select
                        onValueChange={(value) => form.setValue(key, value)}
                        defaultValue={form.watch(key) as string}
                      >
                        <SelectTrigger id={key}>
                          <SelectValue placeholder={`Select ${label}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {options?.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : type === 'textarea' ? (
                      <Textarea
                        id={key}
                        {...form.register(key)}
                        placeholder={(ext.placeholder as string) || `Enter ${label}`}
                        rows={3}
                      />
                    ) : (
                      <Input
                        id={key}
                        type={type === 'number' ? 'number' : 'text'}
                        {...form.register(key)}
                        placeholder={(ext.placeholder as string) || `Enter ${label}`}
                      />
                    )}
                    {ext.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {ext.description as string}
                      </p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-4 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={initializeMutation.isPending}
          >
            {initializeMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Create Character & Start Game
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

