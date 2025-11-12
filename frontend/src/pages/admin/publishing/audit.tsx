/**
 * Publishing Audit Viewer Page
 * Phase 5: Filter and paginate through publishing_audit
 * Only visible when FF_PUBLISHING_AUDIT_VIEWER is enabled
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, X } from 'lucide-react';
import { isPublishingAuditViewerEnabled } from '@/lib/feature-flags';
import { apiFetch } from '@/lib/api';
import type { PublishingAuditRow } from '@shared/types/publishing';

export default function PublishingAuditPage() {
  const [filters, setFilters] = useState({
    entity_type: '',
    entity_id: '',
    action: '',
    owner_user_id: '',
  });
  const [items, setItems] = useState<PublishingAuditRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPublishingAuditViewerEnabled()) {
      return;
    }
    loadAudit();
  }, [filters]);

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (filters.entity_type) params.set('entity_type', filters.entity_type);
    if (filters.entity_id) params.set('entity_id', filters.entity_id);
    if (filters.action) params.set('action', filters.action);
    if (filters.owner_user_id) params.set('owner_user_id', filters.owner_user_id);
    params.set('limit', '25');
    return params.toString();
  };

  const loadAudit = async (cursor?: string) => {
    try {
      if (cursor) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setItems([]);
        setNextCursor(undefined);
      }
      setError(null);

      const query = buildQueryParams();
      if (cursor) {
        const params = new URLSearchParams(query);
        params.set('cursor', cursor);
        const response = await apiFetch<{ items: PublishingAuditRow[]; next_cursor?: string }>(
          `/api/admin/publishing/audit?${params.toString()}`
        );
        if (response.ok && response.data) {
          setItems((prev) => [...prev, ...response.data.items]);
          setNextCursor(response.data.next_cursor);
        } else {
          setError(response.error?.message || 'Failed to load audit');
        }
      } else {
        const response = await apiFetch<{ items: PublishingAuditRow[]; next_cursor?: string }>(
          `/api/admin/publishing/audit?${query}`
        );
        if (response.ok && response.data) {
          setItems(response.data.items);
          setNextCursor(response.data.next_cursor);
        } else {
          setError(response.error?.message || 'Failed to load audit');
        }
      }
    } catch (err) {
      console.error('[publishing] Audit load error:', err);
      setError('Failed to load audit');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (nextCursor) {
      loadAudit(nextCursor);
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

  const clearFilters = () => {
    setFilters({
      entity_type: '',
      entity_id: '',
      action: '',
      owner_user_id: '',
    });
  };

  if (!isPublishingAuditViewerEnabled()) {
    return (
      <div className="text-center py-8">
        <h2 className="text-2xl font-bold mb-2">Audit Viewer Disabled</h2>
        <p className="text-muted-foreground">
          The publishing audit viewer is not currently enabled.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Publishing Audit</h1>
        <p className="text-muted-foreground">
          View and filter publishing audit logs
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter audit logs by entity, action, or owner</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="entity_type">Entity Type</Label>
              <Select
                value={filters.entity_type}
                onValueChange={(v) => setFilters({ ...filters, entity_type: v })}
              >
                <SelectTrigger id="entity_type">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All types</SelectItem>
                  <SelectItem value="world">World</SelectItem>
                  <SelectItem value="story">Story</SelectItem>
                  <SelectItem value="npc">NPC</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="entity_id">Entity ID</Label>
              <Input
                id="entity_id"
                placeholder="UUID"
                value={filters.entity_id}
                onChange={(e) => setFilters({ ...filters, entity_id: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="action">Action</Label>
              <Select
                value={filters.action}
                onValueChange={(v) => setFilters({ ...filters, action: v })}
              >
                <SelectTrigger id="action">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All actions</SelectItem>
                  <SelectItem value="request">Request</SelectItem>
                  <SelectItem value="approve">Approve</SelectItem>
                  <SelectItem value="reject">Reject</SelectItem>
                  <SelectItem value="auto-clear">Auto-Clear</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="owner_user_id">Owner User ID</Label>
              <Input
                id="owner_user_id"
                placeholder="UUID"
                value={filters.owner_user_id}
                onChange={(e) => setFilters({ ...filters, owner_user_id: e.target.value })}
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Logs</CardTitle>
          <CardDescription>
            {items.length > 0 && `${items.length} result${items.length !== 1 ? 's' : ''}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading audit logs...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => loadAudit()} className="mt-4">
                Retry
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No audit logs found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity Type</TableHead>
                      <TableHead>Entity ID</TableHead>
                      <TableHead>Requested By</TableHead>
                      <TableHead>Reviewed By</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const entityLink = getEntityLink(item.entity_type, item.entity_id);
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(item.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getActionBadge(item.action)}>
                              {getActionLabel(item.action)}
                            </Badge>
                          </TableCell>
                          <TableCell className="capitalize">{item.entity_type}</TableCell>
                          <TableCell>
                            {entityLink ? (
                              <a
                                href={entityLink}
                                className="text-sm font-mono hover:underline"
                              >
                                {item.entity_id.substring(0, 8)}...
                              </a>
                            ) : (
                              <span className="text-sm font-mono">
                                {item.entity_id.substring(0, 8)}...
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.requested_by ? (
                              <span className="font-mono">{item.requested_by.substring(0, 8)}...</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.reviewed_by ? (
                              <span className="font-mono">{item.reviewed_by.substring(0, 8)}...</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                            {item.reason || <span className="text-muted-foreground">—</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {nextCursor && (
                <div className="mt-4 text-center">
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Load More'
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

