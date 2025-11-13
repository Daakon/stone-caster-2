/**
 * My Worlds Page
 * Phase 8: User-facing list of user's worlds with quota and actions
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
// Format date helper (avoid date-fns dependency for now)
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

interface World {
  id: string;
  name: string;
  description?: string;
  publish_status?: PublishStatus;
  created_at: string;
  updated_at: string;
}

interface MyWorldsResponse {
  items: World[];
  total: number;
  quotas: {
    limit: number;
    used: number;
    remaining: number;
  };
}

export default function MyWorldsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { submit, isLoading: isSubmitting } = useSubmitForPublish('world');

  // Fetch user's worlds
  const { data, isLoading, error } = useQuery<MyWorldsResponse>({
    queryKey: ['myWorlds'],
    queryFn: async () => {
      const result = await apiGet<MyWorldsResponse>('/api/worlds');
      if (!result.ok) {
        throw new Error(result.error?.message || 'Failed to fetch worlds');
      }
      return result.data;
    },
  });

  // Create world mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const result = await apiPost<World>('/api/worlds', {
        name: 'New World',
        description: '',
      });
      if (!result.ok) {
        throw new Error(result.error?.message || 'Failed to create world');
      }
      return result.data;
    },
    onSuccess: (world) => {
      queryClient.invalidateQueries({ queryKey: ['myWorlds'] });
      navigate(`/admin/worlds/${world.id}/edit`);
    },
  });

  const handleSubmitForPublish = async (worldId: string) => {
    try {
      await submit(worldId);
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
            Failed to load worlds: {error instanceof Error ? error.message : 'Unknown error'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const quotas = data?.quotas || { limit: USER_QUOTAS.worlds, used: 0, remaining: USER_QUOTAS.worlds };
  const isAtQuota = quotas.remaining <= 0;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">My Worlds</h1>
        <p className="text-muted-foreground">Manage your world creations</p>
      </div>

      {/* Quota Bar */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                Worlds: {quotas.used} / {quotas.limit}
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
                  Create World
                </>
              )}
            </Button>
          </div>
          {isAtQuota && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You've reached the limit of {quotas.limit} world{quotas.limit === 1 ? '' : 's'}. Delete a draft or wait for review to complete.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Worlds List */}
      {!data || data.items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No worlds yet. Create your first world to get started!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data.items.map((world) => {
            const status = (world.publish_status || 'draft') as PublishStatus;
            const canEdit = status === 'draft' || status === 'rejected';
            const canSubmit = status === 'draft' || status === 'rejected';

            return (
              <Card key={world.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl">{world.name}</CardTitle>
                      {world.description && (
                        <CardDescription className="mt-1">{world.description}</CardDescription>
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
                      <p>Updated {formatDate(world.updated_at)}</p>
                      {status === 'in_review' && (
                        <p className="mt-1 text-yellow-600">Under review</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {canEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/admin/worlds/${world.id}/edit`)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      )}
                      {canSubmit && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleSubmitForPublish(world.id)}
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
                          onClick={() => navigate(`/worlds/${world.slug || world.id}`)}
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

