/**
 * Stories Tab Component
 * Fetches and displays user's stories - only loads when tab is active
 */

import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { chimeraStoriesService } from '@/services/chimera.stories';
import { isChimeraEnabled } from '@/config/features';
import { useState } from 'react';

const VISIBILITY_COLORS = {
  private: 'secondary',
  pending: 'default',
  public: 'default',
} as const;

export function StoriesTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deletingStoryId, setDeletingStoryId] = useState<string | null>(null);
  const [creatingStory, setCreatingStory] = useState(false);

  // Data fetching - only runs when this component is mounted (active tab)
  const { data: stories, isLoading: isLoadingStories, error: storiesError } = useQuery({
    queryKey: ['chimera-my-stories'],
    queryFn: () => chimeraStoriesService.getMyStories(),
    staleTime: 30 * 1000, // 30 seconds
  });

  const handleCreateStory = async () => {
    // Navigate to the Casting Circle wizard instead of creating a draft story
    navigate('/casting-circle');
  };

  const handleDeleteStory = async (id: string, displayName: string) => {
    if (!confirm(`Are you sure you want to delete "${displayName}"? This action cannot be undone.`)) {
      return;
    }
    setDeletingStoryId(id);
    try {
      await chimeraStoriesService.deleteStory(id);
      toast.success('Story deleted successfully');
      await queryClient.invalidateQueries({ queryKey: ['chimera-my-stories'] });
    } catch (error) {
      console.error('Error deleting story:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete story');
    } finally {
      setDeletingStoryId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>My Stories</CardTitle>
            <CardDescription>
              {stories?.length || 0} stor{stories?.length !== 1 ? 'ies' : 'y'} found
            </CardDescription>
          </div>
          <Button onClick={handleCreateStory} disabled={creatingStory}>
            {creatingStory ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Create New Story
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {storiesError ? (
          <div className="text-center text-destructive py-8">
            <p>Failed to load stories</p>
            <p className="text-sm text-muted-foreground mt-2">
              {storiesError instanceof Error ? storiesError.message : 'Unknown error'}
            </p>
          </div>
        ) : isLoadingStories ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !stories || stories.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No stories found.</p>
            <Button onClick={handleCreateStory} disabled={creatingStory} className="mt-4">
              {creatingStory ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Story
                </>
              )}
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Display Name</TableHead>
                <TableHead>World</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stories.map((story) => (
                <TableRow key={story.id}>
                  <TableCell className="font-medium">{story.display_name}</TableCell>
                  <TableCell>
                    {story.world ? (
                      <span className="text-sm">{story.world.display_name}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">No world</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={VISIBILITY_COLORS[story.visibility]}>
                      {story.visibility.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {isChimeraEnabled ? (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => navigate(`/dashboard/stories/${story.id}/studio`)}
                        >
                          Studio
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/stories/${story.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Story
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteStory(story.id, story.display_name)}
                        disabled={deletingStoryId === story.id}
                      >
                        {deletingStoryId === story.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-destructive" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

