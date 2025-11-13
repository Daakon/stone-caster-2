/**
 * ApprovalsPage Component
 * Phase 3c: Admin page for reviewing pending images
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, XCircle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePendingMedia } from '@/hooks/usePendingMedia';
import { ApprovalsTable } from '@/components/admin/media/ApprovalsTable';
import { reviewMedia, bulkReviewMedia } from '@/services/admin.media';
import { isAdminMediaEnabled } from '@/lib/feature-flags';
import type { MediaAssetDTO } from '@shared/types/media';

export default function ApprovalsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [inFlightIds, setInFlightIds] = useState<Set<string>>(new Set());
  const [optimisticItems, setOptimisticItems] = useState<MediaAssetDTO[] | null>(null);

  // Read filters from URL
  const kind = (searchParams.get('kind') as 'npc' | 'world' | 'story' | 'site' | 'all') || 'all';
  const owner = searchParams.get('owner') || undefined;
  const cursor = searchParams.get('cursor') || undefined;
  const limit = parseInt(searchParams.get('limit') || '25', 10);

  // Fetch pending media
  const { items, nextCursor, loading, error, refetch } = usePendingMedia({
    limit,
    cursor,
    kind: kind === 'all' ? undefined : kind,
    owner,
    enabled: isAdminMediaEnabled(),
  });

  // Use optimistic items if available, otherwise use fetched items
  const displayItems = optimisticItems !== null ? optimisticItems : items;

  // Update URL when filters change
  const updateFilters = useCallback((updates: { kind?: string; owner?: string; cursor?: string }) => {
    const newParams = new URLSearchParams(searchParams);
    if (updates.kind !== undefined) {
      if (updates.kind === 'all') {
        newParams.delete('kind');
      } else {
        newParams.set('kind', updates.kind);
      }
    }
    if (updates.owner !== undefined) {
      if (updates.owner === '') {
        newParams.delete('owner');
      } else {
        newParams.set('owner', updates.owner);
      }
    }
    if (updates.cursor !== undefined) {
      if (updates.cursor === '') {
        newParams.delete('cursor');
      } else {
        newParams.set('cursor', updates.cursor);
      }
    }
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  // Handle single review
  const handleReview = useCallback(async (id: string, review: 'approved' | 'rejected') => {
    setInFlightIds(prev => new Set(prev).add(id));

    // Optimistically remove the item
    setOptimisticItems(prev => {
      const current = prev || items;
      return current.filter(item => item.id !== id);
    });

    try {
      const result = await reviewMedia({ id, review });
      if (!result.ok) {
        throw new Error(result.error?.message || 'Failed to review image');
      }

      toast.success(`Image ${review === 'approved' ? 'approved' : 'rejected'} successfully`);
      
      // Refetch to get updated list
      await refetch();
      setOptimisticItems(null);
    } catch (error) {
      // Restore optimistic update on error
      setOptimisticItems(null);
      toast.error(error instanceof Error ? error.message : 'Failed to review image');
    } finally {
      setInFlightIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [items, refetch]);

  // Handle bulk review
  const handleBulkReview = useCallback(async (review: 'approved' | 'rejected') => {
    if (selectedIds.size === 0) return;

    const idsArray = Array.from(selectedIds);
    setInFlightIds(prev => {
      const next = new Set(prev);
      idsArray.forEach(id => next.add(id));
      return next;
    });

    // Optimistically remove items
    setOptimisticItems(prev => {
      const current = prev || items;
      return current.filter(item => !selectedIds.has(item.id));
    });

    const previousSelection = selectedIds;
    setSelectedIds(new Set());

    try {
      const result = await bulkReviewMedia({ ids: idsArray, review });
      if (!result.ok) {
        throw new Error(result.error?.message || 'Failed to bulk review images');
      }

      const { updated, skipped } = result.data;
      if (skipped.length > 0) {
        toast.warning(`Updated ${updated.length}, skipped ${skipped.length} images`);
      } else {
        toast.success(`Successfully ${review === 'approved' ? 'approved' : 'rejected'} ${updated.length} image(s)`);
      }

      // Refetch to get updated list
      await refetch();
      setOptimisticItems(null);
    } catch (error) {
      // Restore optimistic update on error
      setOptimisticItems(null);
      setSelectedIds(previousSelection);
      toast.error(error instanceof Error ? error.message : 'Failed to bulk review images');
    } finally {
      setInFlightIds(prev => {
        const next = new Set(prev);
        idsArray.forEach(id => next.delete(id));
        return next;
      });
    }
  }, [selectedIds, items, refetch]);

  // Handle pagination
  const handleNext = useCallback(() => {
    if (nextCursor) {
      updateFilters({ cursor: nextCursor });
      // Clear selection when changing pages
      setSelectedIds(new Set());
    }
  }, [nextCursor, updateFilters]);

  const handlePrevious = useCallback(() => {
    // For keyset pagination, we'd need to track previous cursors
    // For MVP, just go back to first page
    updateFilters({ cursor: '' });
    // Clear selection when changing pages
    setSelectedIds(new Set());
  }, [updateFilters]);

  // Reset optimistic items when items change from refetch
  useEffect(() => {
    if (optimisticItems === null) {
      return;
    }
    // If items changed and we have optimistic items, reset
    if (items.length !== optimisticItems.length) {
      setOptimisticItems(null);
    }
  }, [items, optimisticItems]);

  // Feature flag check
  if (!isAdminMediaEnabled()) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Media Approvals</CardTitle>
            <CardDescription>
              This feature is disabled. Enable VITE_FF_ADMIN_MEDIA to use it.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold">Image Approvals</h1>
          <p className="text-muted-foreground mt-2">
            Review and approve pending image uploads
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kind">Kind</Label>
                <Select
                  value={kind}
                  onValueChange={(value) => {
                    updateFilters({ kind: value, cursor: '' });
                    // Clear selection when filter changes
                    setSelectedIds(new Set());
                  }}
                >
                  <SelectTrigger id="kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="world">World</SelectItem>
                    <SelectItem value="story">Story</SelectItem>
                    <SelectItem value="npc">NPC</SelectItem>
                    <SelectItem value="site">Site</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner">Owner ID (UUID)</Label>
                <Input
                  id="owner"
                  type="text"
                  placeholder="Filter by owner UUID"
                  value={owner || ''}
                  onChange={(e) => {
                    updateFilters({ owner: e.target.value || '', cursor: '' });
                    // Clear selection when filter changes
                    setSelectedIds(new Set());
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <Card className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {selectedIds.size} image{selectedIds.size !== 1 ? 's' : ''} selected
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleBulkReview('approved')}
                    disabled={inFlightIds.size > 0}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Approve Selected
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleBulkReview('rejected')}
                    disabled={inFlightIds.size > 0}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject Selected
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="text-destructive">
                Error loading pending images: {error.message}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Table */}
        <Card>
          <CardContent className="pt-6">
            <ApprovalsTable
              items={displayItems}
              loading={loading}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onReview={handleReview}
              onBulkReview={handleBulkReview}
              inFlightIds={inFlightIds}
            />
          </CardContent>
        </Card>

        {/* Pagination */}
        {(nextCursor || cursor) && (
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={!cursor || loading}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            <div className="text-sm text-muted-foreground">
              {displayItems.length} image{displayItems.length !== 1 ? 's' : ''} shown
            </div>
            <Button
              variant="outline"
              onClick={handleNext}
              disabled={!nextCursor || loading}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
  );
}

