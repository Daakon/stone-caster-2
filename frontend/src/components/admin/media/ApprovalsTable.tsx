/**
 * ApprovalsTable Component
 * Phase 3c: Table for displaying pending images with approve/reject actions
 */

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle2, XCircle, Clock, Image as ImageIcon, Loader2 } from 'lucide-react';
import { buildImageUrl } from '@shared/media/url';
import type { MediaAssetDTO } from '@shared/types/media';
import { reviewMedia, type ReviewMediaParams } from '@/services/admin.media';

export interface ApprovalsTableProps {
  items: MediaAssetDTO[];
  loading?: boolean;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onReview: (id: string, review: 'approved' | 'rejected') => Promise<void>;
  onBulkReview?: (ids: string[], review: 'approved' | 'rejected') => Promise<void>;
  inFlightIds?: Set<string>;
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

/**
 * Get entity edit link for a media asset
 */
function getEntityLink(media: MediaAssetDTO): string | null {
  // Note: We don't have entity_id in MediaAssetDTO anymore (Phase 1b removed it)
  // For MVP, we'll skip entity links. Can be enhanced later with a join query.
  return null;
}

export function ApprovalsTable({
  items,
  loading,
  selectedIds,
  onSelectionChange,
  onReview,
  onBulkReview,
  inFlightIds = new Set(),
}: ApprovalsTableProps) {
  const allSelected = items.length > 0 && items.every(item => selectedIds.has(item.id));
  const someSelected = !allSelected && items.some(item => selectedIds.has(item.id));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(new Set(items.map(item => item.id)));
    } else {
      onSelectionChange(new Set());
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const newSelection = new Set(selectedIds);
    if (checked) {
      newSelection.add(id);
    } else {
      newSelection.delete(id);
    }
    onSelectionChange(newSelection);
  };

  const handleApprove = async (id: string) => {
    await onReview(id, 'approved');
  };

  const handleReject = async (id: string) => {
    if (!confirm('Are you sure you want to reject this image? You can optionally provide a reason.')) {
      return;
    }
    const reason = prompt('Rejection reason (optional):');
    await onReview(id, 'rejected');
  };

  // Show loading state when loading and no items
  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <div className="text-sm text-muted-foreground">Loading pending images...</div>
        </div>
      </div>
    );
  }

  // Show empty state only when not loading and no items
  if (!loading && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="mb-4 text-4xl">✨</div>
        <div className="text-lg font-medium">No pending images</div>
        <div className="text-sm text-muted-foreground mt-2">You're all clear!</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead>Thumbnail</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const isInFlight = inFlightIds.has(item.id);
            const deliveryUrl = import.meta.env.VITE_CF_IMAGES_DELIVERY_URL;
            const hasDeliveryUrl = !!deliveryUrl && deliveryUrl.trim() !== '';
            const imageUrl = hasDeliveryUrl ? buildImageUrl(item.provider_key, 'thumb') : null;
            const entityLink = getEntityLink(item);
            const exactTimestamp = new Date(item.created_at).toLocaleString();

            return (
              <TableRow key={item.id}>
                <TableCell>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => handleSelectRow(item.id, checked as boolean)}
                    disabled={isInFlight}
                    aria-label={`Select ${item.id}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="relative h-12 w-12 overflow-hidden rounded border">
                      {hasDeliveryUrl && item.status === 'ready' ? (
                        <img
                          src={imageUrl!}
                          alt={`${item.kind} image`}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            // Fallback to icon if image fails to load
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if (parent && !parent.querySelector('.fallback-icon')) {
                              const icon = document.createElement('div');
                              icon.className = 'fallback-icon flex h-full w-full items-center justify-center bg-muted';
                              icon.innerHTML = '<svg class="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>';
                              parent.appendChild(icon);
                            }
                          }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted">
                          <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {item.kind}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-sm text-muted-foreground">
                    {item.owner_user_id.substring(0, 8)}...
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm" title={exactTimestamp}>
                      {formatRelativeTime(item.created_at)}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="flex items-center gap-1 w-fit">
                    <Clock className="h-3 w-3" />
                    Pending review
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {entityLink && (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="h-8"
                      >
                        <a href={entityLink} target="_blank" rel="noopener noreferrer">
                          View
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleApprove(item.id)}
                      disabled={isInFlight}
                      className="h-8"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleReject(item.id)}
                      disabled={isInFlight}
                      className="h-8"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

