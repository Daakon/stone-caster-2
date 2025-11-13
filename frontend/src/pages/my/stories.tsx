/**
 * My Stories Page
 * Phase 8: User-facing list of user's stories with quota and actions
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Plus, Edit, Send, Eye, AlertCircle } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { useSubmitForPublish } from '@/hooks/useSubmitForPublish';
import { PUBLISH_STATUS_LABELS, type PublishStatus } from '@shared/types/publishing';
import { USER_QUOTAS } from '@/lib/constants';

interface Story {
  id: string;
  name: string;
  title: string;
  description?: string;
  publish_status?: PublishStatus;
  created_at: string;
  updated_at: string;
}

interface MyStoriesResponse {
  items: Story[];
  total: number;
  quotas: {
    limit: number;
    used: number;
    remaining: number;
  };
}

// Format date helper
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString();
  } catch {
    return dateString;
  }
}

export default function MyStoriesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { submit, isLoading: isSubmitting } = useSubmitForPublish('story');

  // Fetch user's stories
  const { data, isLoading, error } = useQuery<MyStoriesResponse>({
    queryKey: ['myStories'],
    queryFn: async () => {
      const result = await apiGet<MyStoriesResponse>('/api/stories');
      if (!result.ok) {
        throw new Error(result.error?.message || 'Failed to fetch stories');
      }
      return result.data;
    },
  });

  // Create story mutation (simplified - would need world_id and rulesetIds in real flow)
  const createMutation = useMutation({
    mutationFn: async () => {
      // In real implementation, this would open a dialog to select world/rulesets
      // For now, return error prompting user to use admin interface
      throw new Error('Please use the admin interface to create stories with world and ruleset selection');
    },
    onError: (error) => {
      // Show error toast
      alert(error.message);
    },
  });

  const handleSubmitForPublish = async (storyId: string) => {
    try {
      await submit(storyId);
    } catch (error) {
      // Error handled by hook
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load stories: {error instanceof Error ? error.message : 'Unknown error'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const quotas = data?.quotas || { limit: USER_QUOTAS.stories, used: 0, remaining: USER_QUOTAS.stories };
  const isAtQuota = quotas.remaining <= 0;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">My Stories</h1>
        <p className="text-muted-foreground">Manage your story creations</p>
      </div>

      {/* Quota Bar */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                Stories: {quotas.used} / {quotas.limit}
              </p>
              <p className="text-xs text-muted-foreground">
                {quotas.remaining > 0
                  ? `${quotas.remaining} slot${quotas.remaining === 1 ? '' : 's'} remaining`
                  : 'Quota reached'}
              </p>
            </div>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={isAtQuota || createMutation.isPending}
              size="sm"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Story
                </>
              )}
            </Button>
          </div>
          {isAtQuota && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You've reached the limit of {quotas.limit} stor{quotas.limit === 1 ? 'y' : 'ies'}. Delete a draft or wait for review to complete.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Stories List */}
      {!data || data.items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No stories yet. Create your first story to get started!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data.items.map((story) => {
            const status = (story.publish_status || 'draft') as PublishStatus;
            // Phase 8: Allow edit/submit for draft and rejected (user can fix and resubmit)
            const canEdit = status === 'draft' || status === 'rejected';
            const canSubmit = status === 'draft' || status === 'rejected';

            return (
              <Card key={story.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl">{story.title || story.name}</CardTitle>
                      {story.description && (
                        <CardDescription className="mt-1">{story.description}</CardDescription>
                      )}
                    </div>
                    <Badge
                      variant={
                        status === 'published'
                          ? 'default'
                          : status === 'in_review'
                          ? 'secondary'
                          : status === 'rejected'
                          ? 'destructive'
                          : 'outline'
                      }
                    >
                      {PUBLISH_STATUS_LABELS[status]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      <p>Updated {formatDate(story.updated_at)}</p>
                      {status === 'in_review' && (
                        <p className="mt-1 text-yellow-600">Under review</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {canEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/admin/entry-points/${story.id}`)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      )}
                      {canSubmit && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleSubmitForPublish(story.id)}
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Submitting...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              Submit for Publish
                            </>
                          )}
                        </Button>
                      )}
                      {status === 'published' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/stories/${story.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

