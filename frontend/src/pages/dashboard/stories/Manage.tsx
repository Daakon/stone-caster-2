/**
 * Story Management Page
 * Phase 3: Story Editor and Compiler
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Loader2, RefreshCw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { chimeraStoriesService } from '@/services/chimera.stories';

export default function StoryManage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [storyDefinitionJson, setStoryDefinitionJson] = useState('');

  // Fetch story details
  const { data: story, isLoading, error } = useQuery({
    queryKey: ['chimera-story', id],
    queryFn: () => chimeraStoriesService.getStory(id!),
    enabled: !!id,
  });

  // Initialize JSON editor when story loads
  useEffect(() => {
    if (story?.story_definition) {
      setStoryDefinitionJson(JSON.stringify(story.story_definition, null, 2));
    } else if (story && !story.story_definition) {
      setStoryDefinitionJson('{}');
    }
  }, [story]);

  const updateStoryDefinitionMutation = useMutation({
    mutationFn: (data: { story_definition: Record<string, unknown> }) =>
      chimeraStoriesService.updateStoryDefinition(id!, data.story_definition),
    onSuccess: () => {
      toast.success('Story definition saved successfully');
      queryClient.invalidateQueries({ queryKey: ['chimera-story', id] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to save story definition');
    },
  });

  const handleSaveStoryDefinition = () => {
    if (!id) return;

    try {
      const parsed = JSON.parse(storyDefinitionJson);
      updateStoryDefinitionMutation.mutate({ story_definition: parsed });
    } catch (error) {
      toast.error('Invalid JSON. Please check your syntax.');
    }
  };

  const handleRebuild = async () => {
    if (!id) return;

    setIsRebuilding(true);
    try {
      const result = await chimeraStoriesService.rebuildStory(id);
      toast.success('Story rebuilt successfully!', {
        description: `Compiled ${result.source_manifest.length} ruleset templates.`,
      });
    } catch (error) {
      console.error('Error rebuilding story:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to rebuild story');
    } finally {
      setIsRebuilding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-destructive">
              <p>Failed to load story</p>
              <p className="text-sm text-muted-foreground mt-2">
                {error instanceof Error ? error.message : 'Unknown error'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <p>Story not found</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/creations/stories')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Story Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage and rebuild the compiled ruleset for &quot;{story.display_name}&quot;
          </p>
        </div>
      </div>

      <Tabs defaultValue="editor" className="space-y-4">
        <TabsList>
          <TabsTrigger value="editor">Story Editor</TabsTrigger>
          <TabsTrigger value="compiler">Compiler</TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Story Definition</CardTitle>
              <CardDescription>
                Edit the JSON definition for this story. This will be merged with compiled rulesets during compilation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="story-definition">Story Definition JSON</Label>
                <Textarea
                  id="story-definition"
                  value={storyDefinitionJson}
                  onChange={(e) => setStoryDefinitionJson(e.target.value)}
                  className="font-mono text-sm min-h-[400px]"
                  placeholder='{"scenes": [], "choices": []}'
                />
              </div>
              <Button
                onClick={handleSaveStoryDefinition}
                disabled={updateStoryDefinitionMutation.isPending}
                className="w-full sm:w-auto"
              >
                {updateStoryDefinitionMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Story Definition
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compiler" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rebuild Story</CardTitle>
              <CardDescription>
                Compile all linked ruleset templates into a single merged ruleset. This will:
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                  <li>Fetch all ruleset templates linked to this story (Main System & Subsystems)</li>
                  <li>Fetch all modifiers from the story&apos;s world (if applicable)</li>
                  <li>Resolve content pack dependencies and fetch modifiers from all linked packs</li>
                  <li>Merge them in the correct load order (Main System → Subsystems → World Modifiers → Content Pack Modifiers)</li>
                  <li>Merge the story_definition JSON (highest priority)</li>
                  <li>Save the compiled result for use by the game engine</li>
                </ul>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleRebuild}
                disabled={isRebuilding}
                size="lg"
                className="w-full sm:w-auto"
              >
                {isRebuilding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Rebuilding...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Rebuild Story
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

