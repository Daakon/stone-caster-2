/**
 * Admin Publishing Page
 * Phase 3: Review queue with approve/reject actions
 * Only visible when FF_PUBLISHING_WIZARD_ENTRY is enabled
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { isPublishingWizardEntryEnabled, isAdminReviewQueueEnabled, isDependencyMonitorEnabled, isPublishingAuditViewerEnabled, isPublishingChecklistsEnabled } from '@/lib/feature-flags';
import { apiFetch } from '@/lib/api';
import { ApiErrorCode } from '@shared';
import type { PublishingFlagsResponse, PendingSubmission, PublishingAuditRow } from '@shared/types/publishing';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock } from 'lucide-react';

export default function PublishingAdminPage() {
  const [flags, setFlags] = useState<PublishingFlagsResponse | null>(null);
  const [queue, setQueue] = useState<PendingSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [queueLoading, setQueueLoading] = useState(false);
  
  // Modal states
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [blockedModalOpen, setBlockedModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PendingSubmission | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [blockedReasons, setBlockedReasons] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Dependency monitor states
  const [worldIdInput, setWorldIdInput] = useState('');
  const [recomputeLoading, setRecomputeLoading] = useState(false);
  const [recomputeResult, setRecomputeResult] = useState<{
    worldId?: string;
    worldsProcessed?: number;
    storiesUpdated: number;
    npcsUpdated: number;
  } | null>(null);
  
  // Activity feed states
  const [activeTab, setActiveTab] = useState('queue');
  const [activity, setActivity] = useState<PublishingAuditRow[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityTimeWindow, setActivityTimeWindow] = useState<'24h' | '7d' | '30d'>('24h');
  const [activityActions, setActivityActions] = useState<string[]>([]);
  
  // Checklist states
  const [checklistModalOpen, setChecklistModalOpen] = useState(false);
  const [checklistItems, setChecklistItems] = useState<Array<{ key: string; label: string; checked: boolean; note?: string }>>([
    { key: 'clear_title', label: 'Clear title', checked: false },
    { key: 'clear_description', label: 'Clear description', checked: false },
    { key: 'tone_appropriate', label: 'Tone and content appropriate', checked: false },
    { key: 'dependencies_valid', label: 'Parent dependencies valid', checked: false },
  ]);
  const [checklistScore, setChecklistScore] = useState(0);
  const [checklistLoading, setChecklistLoading] = useState(false);

  useEffect(() => {
    if (!isPublishingWizardEntryEnabled()) {
      return;
    }

    loadFlags();
    if (isAdminReviewQueueEnabled()) {
      loadQueue();
    }
    if (isPublishingAuditViewerEnabled()) {
      loadActivity();
    }
  }, []);

  // Auto-refresh activity when tab is active
  useEffect(() => {
    if (!isPublishingAuditViewerEnabled() || activeTab !== 'activity') {
      return;
    }

    const interval = setInterval(() => {
      loadActivity();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [activeTab]);

  const loadFlags = async () => {
    try {
      const response = await apiFetch<PublishingFlagsResponse>('/api/admin/publishing/flags');
      if (response.ok && response.data) {
        setFlags(response.data);
      }
    } catch (error) {
      console.error('[publishing] Failed to load flags:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadQueue = async () => {
    try {
      setQueueLoading(true);
      const response = await apiFetch<PendingSubmission[]>('/api/admin/publishing/review/queue');
      if (response.ok && response.data) {
        setQueue(response.data);
      }
    } catch (error) {
      console.error('[publishing] Failed to load queue:', error);
    } finally {
      setQueueLoading(false);
    }
  };

  const handleApprove = async (item: PendingSubmission) => {
    try {
      setActionLoading(`${item.type}-${item.id}-approve`);
      const response = await apiFetch<{ code: string; entity: unknown }>(
        `/api/admin/publishing/review/${item.type}/${item.id}/approve`,
        {
          method: 'POST',
        }
      );

      if (response.ok && response.data?.code === 'APPROVED') {
        toast.success('Approved');
        // Remove from queue
        setQueue(queue.filter((q) => q.id !== item.id || q.type !== item.type));
        // Reload queue to ensure consistency
        await loadQueue();
      } else if (response.error?.code === ApiErrorCode.APPROVAL_BLOCKED) {
        // Show blocked reasons modal
        const reasons = (response.error?.details as { reasons?: string[] })?.reasons || [];
        setBlockedReasons(reasons);
        setSelectedItem(item);
        setBlockedModalOpen(true);
      } else {
        toast.error(response.error?.message || 'Failed to approve submission');
      }
    } catch (error) {
      console.error('[publishing] Approve error:', error);
      toast.error('Failed to approve submission');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectClick = (item: PendingSubmission) => {
    setSelectedItem(item);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const handleChecklistClick = (item: PendingSubmission) => {
    setSelectedItem(item);
    // Reset checklist items
    setChecklistItems([
      { key: 'clear_title', label: 'Clear title', checked: false },
      { key: 'clear_description', label: 'Clear description', checked: false },
      { key: 'tone_appropriate', label: 'Tone and content appropriate', checked: false },
      { key: 'dependencies_valid', label: 'Parent dependencies valid', checked: false },
    ]);
    setChecklistScore(0);
    setChecklistModalOpen(true);
  };

  const handleChecklistSubmit = async () => {
    if (!selectedItem) return;

    try {
      setChecklistLoading(true);
      const checkedCount = checklistItems.filter((item) => item.checked).length;
      const computedScore = Math.round((checkedCount / checklistItems.length) * 100);

      const response = await apiFetch<{ code: string; score: number }>(
        `/api/admin/publishing/review/${selectedItem.type}/${selectedItem.id}/checklist`,
        {
          method: 'POST',
          body: JSON.stringify({
            items: checklistItems,
            score: checklistScore || computedScore,
          }),
        }
      );

      if (response.ok && response.data) {
        toast.success('Checklist saved');
        setChecklistModalOpen(false);
        await loadQueue(); // Reload to show updated score badge
      } else {
        toast.error(response.error?.message || 'Failed to save checklist');
      }
    } catch (error) {
      console.error('[publishing] Checklist save error:', error);
      toast.error('Failed to save checklist');
    } finally {
      setChecklistLoading(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!selectedItem) return;

    if (!rejectReason.trim() || rejectReason.trim().length === 0) {
      toast.error('Rejection reason is required');
      return;
    }

    if (rejectReason.length > 500) {
      toast.error('Rejection reason must be 500 characters or less');
      return;
    }

    try {
      setActionLoading(`${selectedItem.type}-${selectedItem.id}-reject`);
      const response = await apiFetch<{ code: string; entity: unknown }>(
        `/api/admin/publishing/review/${selectedItem.type}/${selectedItem.id}/reject`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: rejectReason.trim() }),
        }
      );

      if (response.ok && response.data?.code === 'REJECTED') {
        toast.success('Rejected');
        setRejectModalOpen(false);
        // Remove from queue
        setQueue(queue.filter((q) => q.id !== selectedItem.id || q.type !== selectedItem.type));
        // Reload queue to ensure consistency
        await loadQueue();
      } else {
        toast.error(response.error?.message || 'Failed to reject submission');
      }
    } catch (error) {
      console.error('[publishing] Reject error:', error);
      toast.error('Failed to reject submission');
    } finally {
      setActionLoading(null);
    }
  };

  const loadActivity = async () => {
    try {
      setActivityLoading(true);
      const response = await apiFetch<{ items: PublishingAuditRow[] }>('/api/admin/publishing/activity?limit=50');
      if (response.ok && response.data) {
        setActivity(response.data.items);
      }
    } catch (error) {
      console.error('[publishing] Failed to load activity:', error);
    } finally {
      setActivityLoading(false);
    }
  };

  const handleRecomputeWorld = async () => {
    if (!worldIdInput.trim()) {
      toast.error('Please enter a world ID');
      return;
    }

    try {
      setRecomputeLoading(true);
      setRecomputeResult(null);

      const response = await apiFetch<{
        worldId: string;
        storiesUpdated: number;
        npcsUpdated: number;
      }>(`/api/admin/publishing/deps/recompute/world/${worldIdInput.trim()}`, {
        method: 'POST',
      });

      if (response.ok && response.data) {
        setRecomputeResult(response.data);
        toast.success('Dependencies recomputed successfully');
      } else {
        toast.error(response.error?.message || 'Failed to recompute dependencies');
      }
    } catch (error) {
      console.error('[publishing] Recompute world error:', error);
      toast.error('Failed to recompute dependencies');
    } finally {
      setRecomputeLoading(false);
    }
  };

  const handleRecomputeAll = async () => {
    try {
      setRecomputeLoading(true);
      setRecomputeResult(null);

      const response = await apiFetch<{
        worldsProcessed: number;
        storiesUpdated: number;
        npcsUpdated: number;
      }>('/api/admin/publishing/deps/recompute/all', {
        method: 'POST',
      });

      if (response.ok && response.data) {
        setRecomputeResult(response.data);
        toast.success('All dependencies recomputed successfully');
      } else {
        toast.error(response.error?.message || 'Failed to recompute dependencies');
      }
    } catch (error) {
      console.error('[publishing] Recompute all error:', error);
      toast.error('Failed to recompute dependencies');
    } finally {
      setRecomputeLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    const variantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      request: 'default',
      approve: 'default',
      reject: 'destructive',
      'auto-reject': 'destructive',
      'auto-clear': 'secondary',
    };
    return variantMap[action] || 'outline';
  };

  const getActionLabel = (action: string) => {
    const labelMap: Record<string, string> = {
      request: 'Requested',
      approve: 'Approved',
      reject: 'Rejected',
      'auto-reject': 'Auto-Rejected',
      'auto-clear': 'Dependency Cleared',
    };
    return labelMap[action] || action;
  };

  const getEntityLink = (type: string, id: string) => {
    if (type === 'world') return `/admin/worlds/${id}`;
    if (type === 'story') return `/admin/entry-points/${id}`;
    if (type === 'npc') return `/admin/npcs/${id}`;
    return null;
  };

  const filterActivity = (items: PublishingAuditRow[]) => {
    let filtered = [...items];

    // Time window filter
    const now = Date.now();
    const windowMs = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    }[activityTimeWindow];

    filtered = filtered.filter((item) => {
      const itemTime = new Date(item.created_at).getTime();
      return now - itemTime <= windowMs;
    });

    // Action filter
    if (activityActions.length > 0) {
      filtered = filtered.filter((item) => activityActions.includes(item.action));
    }

    return filtered;
  };

  const getWorldStatusBadge = (item: PendingSubmission) => {
    if (item.type === 'world') {
      return null; // Worlds don't have parent
    }

    if (!item.parent_world) {
      return <Badge variant="destructive">No World</Badge>;
    }

    const world = item.parent_world;
    if (world.visibility === 'public' && world.review_state === 'approved') {
      return <Badge variant="default" className="bg-green-600">Public & Approved</Badge>;
    }

    if (world.visibility !== 'public') {
      return <Badge variant="destructive">Not Public</Badge>;
    }

    if (world.review_state !== 'approved') {
      return <Badge variant="destructive">Not Approved</Badge>;
    }

    return <Badge variant="secondary">Unknown</Badge>;
  };

  if (!isPublishingWizardEntryEnabled()) {
    return (
      <div className="text-center py-8">
        <h2 className="text-2xl font-bold mb-2">Publishing Feature Disabled</h2>
        <p className="text-muted-foreground">
          The publishing wizard is not currently enabled.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Publishing (Beta)</h1>
        <p className="text-muted-foreground">
          Manage content publication and review workflow
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          {isAdminReviewQueueEnabled() && (
            <TabsTrigger value="queue">Queue</TabsTrigger>
          )}
          {isDependencyMonitorEnabled() && (
            <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
          )}
          {isPublishingAuditViewerEnabled() && (
            <TabsTrigger value="activity">Activity</TabsTrigger>
          )}
        </TabsList>

        {/* Queue Tab */}
        {isAdminReviewQueueEnabled() && (
          <TabsContent value="queue" className="space-y-6">
            {/* Flags Status */}
            <Card>
              <CardHeader>
                <CardTitle>Feature Flags</CardTitle>
                <CardDescription>Current publishing feature flag states</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-sm text-muted-foreground">Loading...</div>
                ) : flags ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Publish Gates (Owner)</span>
                      <span className={`text-sm font-medium ${flags.publishGatesOwner ? 'text-green-600' : 'text-gray-500'}`}>
                        {flags.publishGatesOwner ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Admin Review Queue</span>
                      <span className={`text-sm font-medium ${flags.adminReviewQueue ? 'text-green-600' : 'text-gray-500'}`}>
                        {flags.adminReviewQueue ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Dependency Monitor</span>
                      <span className={`text-sm font-medium ${flags.dependencyMonitor ? 'text-green-600' : 'text-gray-500'}`}>
                        {flags.dependencyMonitor ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Publishing Wizard Entry</span>
                      <span className={`text-sm font-medium ${flags.publishingWizardEntry ? 'text-green-600' : 'text-gray-500'}`}>
                        {flags.publishingWizardEntry ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Failed to load flags</div>
                )}
              </CardContent>
            </Card>

            {/* Review Queue */}
            {isAdminReviewQueueEnabled() && (
              <Card>
                <CardHeader>
                  <CardTitle>Review Queue</CardTitle>
                  <CardDescription>Pending submissions awaiting review</CardDescription>
                </CardHeader>
                <CardContent>
                  {queueLoading ? (
                    <div className="text-sm text-muted-foreground">Loading queue...</div>
                  ) : queue.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No pending submissions</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Owner</TableHead>
                            <TableHead>World Status</TableHead>
                            <TableHead>Submitted</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {queue.map((item) => {
                            const approveKey = `${item.type}-${item.id}-approve`;
                            const rejectKey = `${item.type}-${item.id}-reject`;
                            const isApproving = actionLoading === approveKey;
                            const isRejecting = actionLoading === rejectKey;
                            
                            return (
                              <TableRow key={`${item.type}-${item.id}`}>
                                <TableCell className="font-medium capitalize">{item.type}</TableCell>
                                <TableCell>{item.name || 'Unnamed'}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {item.owner_user_id ? item.owner_user_id.substring(0, 8) + '...' : 'Unknown'}
                                </TableCell>
                                <TableCell>
                                  {getWorldStatusBadge(item)}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {new Date(item.submitted_at).toLocaleDateString()}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      size="sm"
                                      variant="default"
                                      onClick={() => handleApprove(item)}
                                      disabled={isApproving || isRejecting}
                                    >
                                      {isApproving ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <CheckCircle2 className="h-4 w-4 mr-1" />
                                      )}
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handleRejectClick(item)}
                                      disabled={isApproving || isRejecting}
                                    >
                                      {isRejecting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <XCircle className="h-4 w-4 mr-1" />
                                      )}
                                      Reject
                                    </Button>
                                    {isPublishingChecklistsEnabled() && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleChecklistClick(item)}
                                        disabled={isApproving || isRejecting}
                                      >
                                        Checklist
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        {/* Dependencies Tab */}
        {isDependencyMonitorEnabled() && (
          <TabsContent value="dependencies" className="space-y-6">
            {/* Dependencies Monitor */}
            <Card>
              <CardHeader>
                <CardTitle>Dependencies</CardTitle>
                <CardDescription>
                  Manually recompute dependency flags for stories and NPCs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="world-id">World ID</Label>
                  <div className="flex gap-2">
                    <input
                      id="world-id"
                      type="text"
                      value={worldIdInput}
                      onChange={(e) => setWorldIdInput(e.target.value)}
                      placeholder="Enter world UUID"
                      className="flex-1 px-3 py-2 border rounded-md text-sm"
                    />
                    <Button
                      onClick={handleRecomputeWorld}
                      disabled={!worldIdInput.trim() || recomputeLoading}
                      size="sm"
                    >
                      {recomputeLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Recompute World'
                      )}
                    </Button>
                  </div>
                </div>
                
                <div className="pt-2 border-t">
                  <Button
                    onClick={handleRecomputeAll}
                    disabled={recomputeLoading}
                    variant="outline"
                    size="sm"
                  >
                    {recomputeLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Recomputing...
                      </>
                    ) : (
                      'Recompute All Worlds'
                    )}
                  </Button>
                </div>

                {recomputeResult && (
                  <div className="mt-4 p-3 bg-muted rounded-md">
                    <p className="text-sm font-medium mb-2">Results:</p>
                    <div className="space-y-1 text-sm">
                      {recomputeResult.worldId && (
                        <p>World: {recomputeResult.worldId}</p>
                      )}
                      {recomputeResult.worldsProcessed !== undefined && (
                        <p>Worlds Processed: {recomputeResult.worldsProcessed}</p>
                      )}
                      <p>Stories Updated: {recomputeResult.storiesUpdated}</p>
                      <p>NPCs Updated: {recomputeResult.npcsUpdated}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Activity Tab */}
        {isPublishingAuditViewerEnabled() && (
          <TabsContent value="activity" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>Publishing actions and events</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadActivity}
                    disabled={activityLoading}
                  >
                    {activityLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Clock className="h-4 w-4 mr-2" />
                        Refresh
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filters */}
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <Label>Time Window</Label>
                    <Select value={activityTimeWindow} onValueChange={(v) => setActivityTimeWindow(v as '24h' | '7d' | '30d')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24h">Last 24 hours</SelectItem>
                        <SelectItem value="7d">Last 7 days</SelectItem>
                        <SelectItem value="30d">Last 30 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Label>Actions (optional)</Label>
                    <Select
                      value={activityActions.join(',')}
                      onValueChange={(v) => setActivityActions(v ? v.split(',') : [])}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All actions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All actions</SelectItem>
                        <SelectItem value="request">Requested</SelectItem>
                        <SelectItem value="approve">Approved</SelectItem>
                        <SelectItem value="reject">Rejected</SelectItem>
                        <SelectItem value="auto-clear">Dependency Cleared</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Activity List */}
                {activityLoading && activity.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">Loading activity...</div>
                ) : filterActivity(activity).length === 0 ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">No activity found</div>
                ) : (
                  <div className="space-y-2">
                    {filterActivity(activity).map((item) => {
                      const entityLink = getEntityLink(item.entity_type, item.entity_id);
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-4 p-3 border rounded-md hover:bg-muted/50"
                        >
                          <div className="text-sm text-muted-foreground w-32">
                            {new Date(item.created_at).toLocaleString()}
                          </div>
                          <Badge variant={getActionBadge(item.action)}>
                            {getActionLabel(item.action)}
                          </Badge>
                          <div className="flex-1">
                            {entityLink ? (
                              <a
                                href={entityLink}
                                className="text-sm font-medium hover:underline capitalize"
                              >
                                {item.entity_type} {item.entity_id.substring(0, 8)}...
                              </a>
                            ) : (
                              <span className="text-sm capitalize">
                                {item.entity_type} {item.entity_id.substring(0, 8)}...
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {item.requested_by && (
                              <span>Owner: {item.requested_by.substring(0, 8)}...</span>
                            )}
                            {item.reviewed_by && (
                              <span className="ml-2">Reviewer: {item.reviewed_by.substring(0, 8)}...</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Reject Modal */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Submission</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this submission. This will be visible to the content owner.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reject-reason">Rejection Reason *</Label>
              <Textarea
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter rejection reason (1-500 characters)"
                rows={4}
                maxLength={500}
                className="resize-none"
              />
              <div className="text-xs text-muted-foreground text-right">
                {rejectReason.length} / 500 characters
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectModalOpen(false);
                setRejectReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectSubmit}
              disabled={!rejectReason.trim() || rejectReason.length > 500 || actionLoading !== null}
            >
              {actionLoading?.endsWith('-reject') ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : (
                'Reject'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Blocked Approval Modal */}
      <Dialog open={blockedModalOpen} onOpenChange={setBlockedModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Approval Blocked
            </DialogTitle>
            <DialogDescription>
              This submission cannot be approved due to the following issues:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <ul className="list-disc list-inside space-y-2">
              {blockedReasons.map((reason, index) => (
                <li key={index} className="text-sm">
                  {reason.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </li>
              ))}
            </ul>
            {selectedItem && selectedItem.parent_world && (
              <div className="mt-4 p-3 bg-muted rounded-md">
                <p className="text-sm font-medium mb-1">Parent World Status:</p>
                <p className="text-sm text-muted-foreground">
                  {selectedItem.parent_world.name || 'Unknown'} -{' '}
                  {selectedItem.parent_world.visibility || 'unknown'} /{' '}
                  {selectedItem.parent_world.review_state || 'unknown'}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockedModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checklist Modal */}
      {isPublishingChecklistsEnabled() && (
        <Dialog open={checklistModalOpen} onOpenChange={setChecklistModalOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Review Checklist</DialogTitle>
              <DialogDescription>
                Complete the checklist for {selectedItem?.name || 'this submission'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-3">
                {checklistItems.map((item, index) => (
                  <div key={item.key} className="flex items-start gap-3 p-3 border rounded-md">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(e) => {
                        const updated = [...checklistItems];
                        updated[index].checked = e.target.checked;
                        setChecklistItems(updated);
                        // Auto-update score
                        const checkedCount = updated.filter((i) => i.checked).length;
                        setChecklistScore(Math.round((checkedCount / updated.length) * 100));
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label className="font-medium">{item.label}</Label>
                      <Textarea
                        placeholder="Optional note..."
                        value={item.note || ''}
                        onChange={(e) => {
                          const updated = [...checklistItems];
                          updated[index].note = e.target.value;
                          setChecklistItems(updated);
                        }}
                        rows={2}
                        className="mt-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t">
                <Label>Score: {checklistScore}%</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Score is automatically calculated from checked items, or enter manually below
                </p>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={checklistScore}
                  onChange={(e) => setChecklistScore(parseInt(e.target.value, 10) || 0)}
                  className="mt-2"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setChecklistModalOpen(false);
                  setChecklistItems([
                    { key: 'clear_title', label: 'Clear title', checked: false },
                    { key: 'clear_description', label: 'Clear description', checked: false },
                    { key: 'tone_appropriate', label: 'Tone and content appropriate', checked: false },
                    { key: 'dependencies_valid', label: 'Parent dependencies valid', checked: false },
                  ]);
                  setChecklistScore(0);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleChecklistSubmit}
                disabled={checklistLoading}
              >
                {checklistLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Checklist'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Coming Soon */}
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>Publishing workflow features</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            <p>Phase 3 adds approval/rejection workflows with revalidation.</p>
            <p className="mt-2">
              Phase 4 adds dependency monitoring and automated dependency checks.
            </p>
            <p className="mt-2">
              Phase 5 adds unified messaging, audit views, and telemetry.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

