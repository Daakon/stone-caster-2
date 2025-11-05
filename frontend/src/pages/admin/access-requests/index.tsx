/**
 * Access Requests Admin Page
 * Phase B5: Admin panel for managing Early Access requests
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Search, Check, X, Eye, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { accessRequestsService } from '@/services/admin.accessRequests';
import type { AccessRequest, AccessRequestStatus } from '@shared/types/accessRequests';
import { Guarded } from '@/admin/routeGuard';

function StatusBadge({ status }: { status: AccessRequestStatus }) {
  const variants: Record<AccessRequestStatus, 'default' | 'secondary' | 'destructive'> = {
    pending: 'secondary',
    approved: 'default',
    denied: 'destructive',
  };

  return <Badge variant={variants[status]}>{status}</Badge>;
}

function AccessRequestsAdmin() {
  const [statusFilter, setStatusFilter] = useState<AccessRequestStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isDenyDialogOpen, setIsDenyDialogOpen] = useState(false);
  const [isViewDrawerOpen, setIsViewDrawerOpen] = useState(false);
  const [approveNote, setApproveNote] = useState('');
  const [denyReason, setDenyReason] = useState('');
  const queryClient = useQueryClient();

  // Fetch requests
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['access-requests', statusFilter, searchQuery, page],
    queryFn: () =>
      accessRequestsService.list({
        status: statusFilter === 'all' ? undefined : statusFilter,
        q: searchQuery || undefined,
        page,
        pageSize: 50,
      }),
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (requestId: string) => accessRequestsService.approve(requestId, approveNote),
    onSuccess: () => {
      toast.success('Request approved successfully');
      setIsApproveDialogOpen(false);
      setApproveNote('');
      queryClient.invalidateQueries({ queryKey: ['access-requests'] });
      refetch();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to approve request');
    },
  });

  // Deny mutation
  const denyMutation = useMutation({
    mutationFn: (requestId: string) => accessRequestsService.deny(requestId, denyReason),
    onSuccess: () => {
      toast.success('Request denied');
      setIsDenyDialogOpen(false);
      setDenyReason('');
      queryClient.invalidateQueries({ queryKey: ['access-requests'] });
      refetch();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to deny request');
    },
  });

  const handleApprove = (request: AccessRequest) => {
    setSelectedRequest(request);
    setIsApproveDialogOpen(true);
  };

  const handleDeny = (request: AccessRequest) => {
    setSelectedRequest(request);
    setIsDenyDialogOpen(true);
  };

  const handleView = (request: AccessRequest) => {
    setSelectedRequest(request);
    setIsViewDrawerOpen(true);
  };

  const confirmApprove = () => {
    if (selectedRequest) {
      approveMutation.mutate(selectedRequest.id);
    }
  };

  const confirmDeny = () => {
    if (selectedRequest && denyReason.trim()) {
      denyMutation.mutate(selectedRequest.id);
    }
  };

  const requests = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Early Access Requests</CardTitle>
          <CardDescription>Manage user access requests for Early Access</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by email..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    className="pl-8"
                  />
                </div>
              </div>
            </div>

            {/* Status Tabs */}
            <Tabs
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as AccessRequestStatus | 'all');
                setPage(1);
              }}
            >
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="approved">Approved</TabsTrigger>
                <TabsTrigger value="denied">Denied</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Table */}
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No requests found
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">{request.email}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {request.user_id ? (
                            <span className="font-mono text-xs">{request.user_id.slice(0, 8)}...</span>
                          ) : (
                            <span className="text-muted-foreground italic">No account</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={request.status} />
                        </TableCell>
                        <TableCell className="max-w-xs truncate" title={request.note || ''}>
                          {request.note || '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(request.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleView(request)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {request.status === 'pending' && (
                              <>
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => handleApprove(request)}
                                  disabled={approveMutation.isPending}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeny(request)}
                                  disabled={denyMutation.isPending}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {meta && meta.hasMore && (
                  <div className="flex justify-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <span className="flex items-center px-4">
                      Page {meta.page} of {Math.ceil(meta.total / meta.pageSize)}
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={!meta.hasMore}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Access Request</DialogTitle>
            <DialogDescription>
              Approve this request to grant Early Access. This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Set user role to <code>early_access</code></li>
                <li>Increment <code>role_version</code> (instant cache invalidation)</li>
                {!selectedRequest?.user_id && (
                  <li className="text-yellow-600">
                    No linked account yet — approval marks email as preapproved; user still needs to sign in.
                  </li>
                )}
              </ul>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input value={selectedRequest?.email || ''} disabled />
            </div>
            <div>
              <Label htmlFor="approve-note">Optional Note</Label>
              <Textarea
                id="approve-note"
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                placeholder="Optional note for this approval..."
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsApproveDialogOpen(false);
                setApproveNote('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={confirmApprove} disabled={approveMutation.isPending}>
              {approveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Approving...
                </>
              ) : (
                'Approve'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deny Dialog */}
      <Dialog open={isDenyDialogOpen} onOpenChange={setIsDenyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deny Access Request</DialogTitle>
            <DialogDescription>
              Provide a reason for denying this request. This will be stored for audit purposes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input value={selectedRequest?.email || ''} disabled />
            </div>
            <div>
              <Label htmlFor="deny-reason">Reason *</Label>
              <Textarea
                id="deny-reason"
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                placeholder="Reason for denial..."
                maxLength={500}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDenyDialogOpen(false);
                setDenyReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeny}
              disabled={denyMutation.isPending || !denyReason.trim()}
            >
              {denyMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Denying...
                </>
              ) : (
                'Deny'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewDrawerOpen} onOpenChange={setIsViewDrawerOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request Details</DialogTitle>
            <DialogDescription>Full request metadata</DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="px-4 pb-4 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p>{selectedRequest.email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">User ID</Label>
                  <p className="font-mono text-xs">
                    {selectedRequest.user_id || 'Not linked'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <p>
                    <StatusBadge status={selectedRequest.status} />
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Created</Label>
                  <p>{new Date(selectedRequest.created_at).toLocaleString()}</p>
                </div>
                {selectedRequest.note && (
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Note</Label>
                    <p>{selectedRequest.note}</p>
                  </div>
                )}
                {selectedRequest.reason && (
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Reason</Label>
                    <p>{selectedRequest.reason}</p>
                  </div>
                )}
                {selectedRequest.approved_by && (
                  <div>
                    <Label className="text-muted-foreground">Approved By</Label>
                    <p className="font-mono text-xs">{selectedRequest.approved_by}</p>
                  </div>
                )}
                {selectedRequest.approved_at && (
                  <div>
                    <Label className="text-muted-foreground">Approved At</Label>
                    <p>{new Date(selectedRequest.approved_at).toLocaleString()}</p>
                  </div>
                )}
                {selectedRequest.denied_by && (
                  <div>
                    <Label className="text-muted-foreground">Denied By</Label>
                    <p className="font-mono text-xs">{selectedRequest.denied_by}</p>
                  </div>
                )}
                {selectedRequest.denied_at && (
                  <div>
                    <Label className="text-muted-foreground">Denied At</Label>
                    <p>{new Date(selectedRequest.denied_at).toLocaleString()}</p>
                  </div>
                )}
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Metadata</Label>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                    {JSON.stringify(selectedRequest.meta, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AccessRequestsAdminPage() {
  return (
    <Guarded allow="admin">
      <AccessRequestsAdmin />
    </Guarded>
  );
}

