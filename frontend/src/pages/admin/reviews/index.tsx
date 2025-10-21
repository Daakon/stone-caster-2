/**
 * Reviews Admin Page
 * Phase 5: Moderation queue with filters and quick actions
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield, Clock, CheckCircle, XCircle, AlertTriangle, Search, Eye, User } from 'lucide-react';
import { toast } from 'sonner';
import { reviewsService, type ContentReview, type ReviewFilters, type ReviewState, type ReviewTargetType } from '@/services/admin.reviews';
import { useAppRoles } from '@/admin/routeGuard';

export default function ReviewsAdmin() {
  const { isModerator, isAdmin } = useAppRoles();
  const [reviews, setReviews] = useState<ContentReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ReviewFilters>({});
  const [search, setSearch] = useState('');

  // Load reviews
  useEffect(() => {
    loadReviews();
  }, [filters, search]);

  const loadReviews = async () => {
    try {
      setLoading(true);
      const response = await reviewsService.listReviews({
        ...filters,
        q: search || undefined
      });
      setReviews(response.data);
    } catch (error) {
      toast.error('Failed to load reviews');
      console.error('Error loading reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignToMe = async (reviewId: string) => {
    try {
      await reviewsService.attachReviewer(reviewId);
      toast.success('Review assigned to you');
      loadReviews();
    } catch (error) {
      toast.error('Failed to assign review');
      console.error('Error assigning review:', error);
    }
  };

  const handleQuickAction = async (reviewId: string, action: ReviewState) => {
    if (!confirm(`Are you sure you want to ${action} this review?`)) {
      return;
    }

    try {
      await reviewsService.updateReviewState(reviewId, action);
      toast.success(`Review ${action} successfully`);
      loadReviews();
    } catch (error) {
      toast.error(`Failed to ${action} review`);
      console.error(`Error ${action} review:`, error);
    }
  };

  const getStateBadge = (state: ReviewState) => {
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

    const Icon = icons[state];

    return (
      <Badge variant={variants[state] || 'outline'} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {state.replace('_', ' ')}
      </Badge>
    );
  };

  const getTargetTypeBadge = (targetType: ReviewTargetType) => {
    const variants = {
      entry_point: 'default',
      prompt_segment: 'secondary',
      npc: 'outline'
    } as const;

    return (
      <Badge variant={variants[targetType] || 'outline'}>
        {targetType.replace('_', ' ')}
      </Badge>
    );
  };

  const canModerate = isModerator || isAdmin;

  if (!canModerate) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">
            You need moderator or admin permissions to access the reviews queue.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Content Reviews</h1>
          <p className="text-muted-foreground">
            Moderate user-generated content and manage review workflows
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {reviews.filter(r => r.state === 'open').length} pending
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search reviews..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Select
                value={filters.state?.[0] || ''}
                onValueChange={(value) => 
                  setFilters(prev => ({ 
                    ...prev, 
                    state: value ? [value as ReviewState] : undefined 
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All states" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All states</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="changes_requested">Changes Requested</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target_type">Target Type</Label>
              <Select
                value={filters.target_type?.[0] || ''}
                onValueChange={(value) => 
                  setFilters(prev => ({ 
                    ...prev, 
                    target_type: value ? [value as ReviewTargetType] : undefined 
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All types</SelectItem>
                  <SelectItem value="entry_point">Entry Point</SelectItem>
                  <SelectItem value="prompt_segment">Prompt Segment</SelectItem>
                  <SelectItem value="npc">NPC</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reviewer">Reviewer</Label>
              <Select
                value={filters.reviewer || ''}
                onValueChange={(value) => 
                  setFilters(prev => ({ 
                    ...prev, 
                    reviewer: value as 'me' | 'all' || undefined 
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All reviewers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All reviewers</SelectItem>
                  <SelectItem value="me">Assigned to me</SelectItem>
                  <SelectItem value="all">All reviewers</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reviews Table */}
      <Card>
        <CardHeader>
          <CardTitle>Review Queue ({reviews.length})</CardTitle>
          <CardDescription>
            Manage content reviews and moderation workflow
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground">Loading...</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Target</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Submitter</TableHead>
                  <TableHead>Reviewer</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((review) => (
                  <TableRow key={review.id}>
                    <TableCell>
                      <div className="max-w-xs truncate">
                        {review.target_title}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getTargetTypeBadge(review.target_type)}
                    </TableCell>
                    <TableCell>
                      {getStateBadge(review.state)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{review.submitter_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{review.reviewer_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(review.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/admin/reviews/${review.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>

                        {review.state === 'open' && !review.reviewer_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAssignToMe(review.id)}
                          >
                            Assign to Me
                          </Button>
                        )}

                        {review.state === 'open' && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleQuickAction(review.id, 'approved')}
                              className="text-green-600 hover:text-green-700"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleQuickAction(review.id, 'changes_requested')}
                              className="text-orange-600 hover:text-orange-700"
                            >
                              <AlertTriangle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleQuickAction(review.id, 'rejected')}
                              className="text-red-600 hover:text-red-700"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}