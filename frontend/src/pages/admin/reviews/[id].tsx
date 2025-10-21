/**
 * Review Detail Page
 * Phase 5: Review detail with diff view and moderation actions
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Clock, User, FileText, GitCompare } from 'lucide-react';
import { toast } from 'sonner';
import { reviewsService, type ContentReview, type ReviewAction, type ReviewDiff } from '@/services/admin.reviews';
import { useAppRoles } from '@/admin/routeGuard';

export default function ReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isModerator, isAdmin } = useAppRoles();
  const [review, setReview] = useState<ContentReview | null>(null);
  const [actions, setActions] = useState<ReviewAction[]>([]);
  const [targetContent, setTargetContent] = useState<any>(null);
  const [diff, setDiff] = useState<ReviewDiff | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [moderationNote, setModerationNote] = useState('');

  useEffect(() => {
    if (id) {
      loadReview();
    }
  }, [id]);

  const loadReview = async () => {
    try {
      setLoading(true);
      const [reviewData, actionsData] = await Promise.all([
        reviewsService.getReview(id!),
        reviewsService.getReviewActions(id!)
      ]);

      if (!reviewData) {
        toast.error('Review not found');
        navigate('/admin/reviews');
        return;
      }

      setReview(reviewData);
      setActions(actionsData);

      // Load target content and diff
      const [content, diffData] = await Promise.all([
        reviewsService.getTargetContent(reviewData.target_type, reviewData.target_id),
        reviewsService.computeDiff(reviewData.target_type, reviewData.target_id)
      ]);

      setTargetContent(content);
      setDiff(diffData);
    } catch (error) {
      toast.error('Failed to load review');
      console.error('Error loading review:', error);
      navigate('/admin/reviews');
    } finally {
      setLoading(false);
    }
  };

  const handleModerationAction = async (action: 'approved' | 'rejected' | 'changes_requested') => {
    if (!moderationNote.trim() && action !== 'approved') {
      toast.error('Please provide a note for this action');
      return;
    }

    if (!confirm(`Are you sure you want to ${action} this review?`)) {
      return;
    }

    try {
      setActionLoading(true);
      await reviewsService.updateReviewState(id!, action, moderationNote);
      toast.success(`Review ${action} successfully`);
      setModerationNote('');
      loadReview();
    } catch (error) {
      toast.error(`Failed to ${action} review`);
      console.error(`Error ${action} review:`, error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignToMe = async () => {
    try {
      await reviewsService.attachReviewer(id!);
      toast.success('Review assigned to you');
      loadReview();
    } catch (error) {
      toast.error('Failed to assign review');
      console.error('Error assigning review:', error);
    }
  };

  const getStateBadge = (state: string) => {
    const variants = {
      open: 'default',
      changes_requested: 'destructive',
      rejected: 'destructive',
      approved: 'default'
    } as const;

    const icons = {
      open: Clock,
      changes_requested: AlertTriangle,
      rejected: XCircle,
      approved: CheckCircle
    } as const;

    const Icon = icons[state as keyof typeof icons];

    return (
      <Badge variant={variants[state as keyof typeof variants] || 'outline'} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {state.replace('_', ' ')}
      </Badge>
    );
  };

  const getActionIcon = (action: string) => {
    const icons = {
      approve: CheckCircle,
      reject: XCircle,
      request_changes: AlertTriangle,
      assign: User,
      note: FileText
    } as const;

    const Icon = icons[action as keyof typeof icons] || FileText;
    return <Icon className="h-4 w-4" />;
  };

  const canModerate = isModerator || isAdmin;

  if (!canModerate) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">
            You need moderator or admin permissions to view review details.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-muted-foreground">Loading review...</div>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Review Not Found</h2>
          <p className="text-muted-foreground">
            The review you're looking for doesn't exist or has been removed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/admin/reviews')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Reviews
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Review Details</h1>
            <p className="text-muted-foreground">
              {review.target_title} • {review.target_type.replace('_', ' ')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStateBadge(review.state)}
          {review.state === 'open' && !review.reviewer_id && (
            <Button onClick={handleAssignToMe}>
              <User className="h-4 w-4 mr-2" />
              Assign to Me
            </Button>
          )}
        </div>
      </div>

      {/* Review Info */}
      <Card>
        <CardHeader>
          <CardTitle>Review Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Submitter</Label>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{review.submitter_name}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reviewer</Label>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{review.reviewer_name}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Created</Label>
              <span className="text-sm text-muted-foreground">
                {new Date(review.created_at).toLocaleString()}
              </span>
            </div>
            <div className="space-y-2">
              <Label>Last Updated</Label>
              <span className="text-sm text-muted-foreground">
                {new Date(review.updated_at).toLocaleString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Tabs */}
      <Tabs defaultValue="current" className="space-y-4">
        <TabsList>
          <TabsTrigger value="current">Current Content</TabsTrigger>
          <TabsTrigger value="diff">Changes</TabsTrigger>
          <TabsTrigger value="history">Review History</TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Current Content</CardTitle>
              <CardDescription>
                The content being reviewed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {targetContent && (
                  <div className="space-y-2">
                    <Label>Content</Label>
                    <div className="p-4 bg-muted rounded-md">
                      <pre className="whitespace-pre-wrap text-sm">
                        {targetContent.content || targetContent.title || targetContent.description}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diff" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Changes</CardTitle>
              <CardDescription>
                What has changed in this submission
              </CardDescription>
            </CardHeader>
            <CardContent>
              {diff ? (
                <div className="space-y-4">
                  {diff.added.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-green-600">Added</Label>
                      <div className="p-4 bg-green-50 rounded-md">
                        {diff.added.map((line, index) => (
                          <div key={index} className="text-sm text-green-800">
                            + {line}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {diff.removed.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-red-600">Removed</Label>
                      <div className="p-4 bg-red-50 rounded-md">
                        {diff.removed.map((line, index) => (
                          <div key={index} className="text-sm text-red-800">
                            - {line}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {diff.unchanged.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Unchanged</Label>
                      <div className="p-4 bg-muted rounded-md">
                        {diff.unchanged.map((line, index) => (
                          <div key={index} className="text-sm text-muted-foreground">
                            {line}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <GitCompare className="h-12 w-12 mx-auto mb-4" />
                  <p>No previous version available for comparison</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Review History</CardTitle>
              <CardDescription>
                Timeline of review actions and decisions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {actions.map((action, index) => (
                  <div key={action.id} className="flex items-start gap-3 p-3 border rounded-md">
                    <div className="flex-shrink-0">
                      {getActionIcon(action.action)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{action.actor_name}</span>
                        <span className="text-sm text-muted-foreground">
                          {action.action.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(action.created_at).toLocaleString()}
                        </span>
                      </div>
                      {action.notes && (
                        <p className="text-sm text-muted-foreground">{action.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Moderation Actions */}
      {review.state === 'open' && (
        <Card>
          <CardHeader>
            <CardTitle>Moderation Actions</CardTitle>
            <CardDescription>
              Review and decide on this content submission
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="moderation-note">Moderation Note</Label>
              <Textarea
                id="moderation-note"
                placeholder="Add your feedback or notes for this review..."
                value={moderationNote}
                onChange={(e) => setModerationNote(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => handleModerationAction('approved')}
                disabled={actionLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button
                onClick={() => handleModerationAction('changes_requested')}
                disabled={actionLoading}
                variant="outline"
                className="border-orange-600 text-orange-600 hover:bg-orange-50"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Request Changes
              </Button>
              <Button
                onClick={() => handleModerationAction('rejected')}
                disabled={actionLoading}
                variant="outline"
                className="border-red-600 text-red-600 hover:bg-red-50"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                These actions will update the content lifecycle and notify the submitter.
                Changes cannot be undone.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
