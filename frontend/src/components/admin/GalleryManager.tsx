/**
 * Gallery Manager Component
 * Phase 3b: Admin UI for managing gallery images with drag-and-drop reordering
 */

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Plus, X, GripVertical, Lock, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { MediaAssetDTO, MediaLinkDTO } from '@shared/types/media';
import { buildImageUrl } from '@shared/media/url';
import { createMediaLink, deleteMediaLink, reorderMediaLinks, listRecentUploads } from '@/services/admin.media';
import type { EntityKind } from '@/services/admin.media';

export interface GalleryItem extends MediaLinkDTO {
  media: MediaAssetDTO;
}

export interface GalleryManagerProps {
  entityKind: EntityKind;
  entityId: string;
  items: GalleryItem[];
  disabled?: boolean;
  onChange?: () => void;
  entityName?: string;
}

export function GalleryManager({
  entityKind,
  entityId,
  items,
  disabled = false,
  onChange,
  entityName,
}: GalleryManagerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [recentUploads, setRecentUploads] = useState<MediaAssetDTO[]>([]);
  const [loadingUploads, setLoadingUploads] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [localOrder, setLocalOrder] = useState<GalleryItem[]>(items);
  const dragStartPos = useRef<number | null>(null);

  // Sync local order when items prop changes
  useEffect(() => {
    setLocalOrder(items);
  }, [items]);

  const loadRecentUploads = async () => {
    setLoadingUploads(true);
    try {
      const result = await listRecentUploads({
        kind: entityKind,
        limit: 20,
      });

      if (result.ok && result.data?.items) {
        setRecentUploads(result.data.items);
      }
    } catch (err) {
      console.error('Failed to load recent uploads:', err);
    } finally {
      setLoadingUploads(false);
    }
  };

  const handleOpenPicker = () => {
    setPickerOpen(true);
    loadRecentUploads();
  };

  const handleAddToGallery = async (mediaId: string) => {
    setLoading(true);
    setError(null);

    try {
      const result = await createMediaLink({
        target: {
          kind: entityKind,
          id: entityId,
        },
        mediaId,
        role: 'gallery',
        sortOrder: localOrder.length,
      });

      if (!result.ok) {
        // Handle 409 conflict (duplicate)
        if (result.error?.code === 'CONFLICT' || result.error?.message?.includes('already linked')) {
          throw new Error('This image is already in the gallery');
        }
        throw new Error(result.error?.message || 'Failed to add image to gallery');
      }

      toast.success('Image added to gallery');
      setPickerOpen(false);
      if (onChange) {
        onChange();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add image';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (linkId: string) => {
    setLoading(true);
    setError(null);

    try {
      const result = await deleteMediaLink(linkId);

      if (!result.ok) {
        throw new Error(result.error?.message || 'Failed to remove image');
      }

      toast.success('Image removed from gallery');
      if (onChange) {
        onChange();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove image';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Simple drag-and-drop handlers (no external library)
  const handleDragStart = (index: number) => {
    if (disabled) return;
    setDraggedIndex(index);
    dragStartPos.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (disabled || draggedIndex === null) return;
    e.preventDefault();

    if (draggedIndex !== index) {
      const newOrder = [...localOrder];
      const draggedItem = newOrder[draggedIndex];
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(index, 0, draggedItem);
      setLocalOrder(newOrder);
      setDraggedIndex(index);
    }
  };

  const handleDragEnd = async () => {
    if (disabled || draggedIndex === null || dragStartPos.current === null) {
      setDraggedIndex(null);
      dragStartPos.current = null;
      return;
    }

    // Check if order actually changed
    if (draggedIndex === dragStartPos.current) {
      setDraggedIndex(null);
      dragStartPos.current = null;
      return;
    }

    // Persist new order
    setLoading(true);
    setError(null);

    try {
      const orders = localOrder.map((item, idx) => ({
        linkId: item.id,
        sortOrder: idx,
      }));

      const result = await reorderMediaLinks({
        target: {
          kind: entityKind,
          id: entityId,
        },
        orders,
      });

      if (!result.ok) {
        // Revert on failure
        setLocalOrder(items);
        throw new Error(result.error?.message || 'Failed to reorder gallery');
      }

      toast.success('Gallery order updated');
      if (onChange) {
        onChange();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reorder gallery';
      setError(errorMessage);
      toast.error(errorMessage);
      // Revert to original order
      setLocalOrder(items);
    } finally {
      setLoading(false);
      setDraggedIndex(null);
      dragStartPos.current = null;
    }
  };

  const getReviewStatusChip = (status: string) => {
    if (status === 'approved') {
      return <Badge variant="default" className="text-xs">Approved</Badge>;
    } else if (status === 'pending') {
      return <Badge variant="secondary" className="text-xs">Pending</Badge>;
    } else if (status === 'rejected') {
      return <Badge variant="destructive" className="text-xs">Rejected</Badge>;
    }
    return null;
  };

  const getStatusChip = (status: string) => {
    if (status === 'ready') {
      return <Badge variant="outline" className="text-xs">Ready</Badge>;
    } else if (status === 'pending') {
      return <Badge variant="secondary" className="text-xs">Pending</Badge>;
    }
    return null;
  };

  const deliveryUrl = import.meta.env.VITE_CF_IMAGES_DELIVERY_URL;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gallery</CardTitle>
              <CardDescription>
                Additional images for this {entityKind}. Drag to reorder.
              </CardDescription>
            </div>
            {disabled && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground" title="Locked after publish">
                <Lock className="h-3 w-3" />
                <span>Locked</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Gallery Grid */}
          {localOrder.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {localOrder.map((item, index) => {
                // Use 'public' variant (default Cloudflare Images variant)
                // To use 'thumb' variant, create it in Cloudflare Images dashboard first
                const thumbUrl = item.media.provider_key && deliveryUrl
                  ? buildImageUrl(item.media.provider_key, 'public', deliveryUrl)
                  : null;

                return (
                  <div
                    key={item.id}
                    draggable={!disabled}
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`relative group rounded-lg overflow-hidden border bg-muted ${
                      disabled ? '' : 'cursor-move hover:border-primary'
                    } ${draggedIndex === index ? 'opacity-50' : ''}`}
                  >
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={entityName ? `Gallery image ${index + 1} for ${entityName}` : `Gallery image ${index + 1}`}
                        className="w-full aspect-square object-cover"
                      />
                    ) : (
                      <div className="w-full aspect-square flex items-center justify-center bg-muted">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    
                    {/* Status chips overlay */}
                    <div className="absolute top-1 left-1 flex flex-col gap-1">
                      {getStatusChip(item.media.status)}
                      {getReviewStatusChip(item.media.image_review_status)}
                    </div>

                    {/* Remove button */}
                    {!disabled && (
                      <button
                        onClick={() => handleRemove(item.id)}
                        disabled={loading}
                        className="absolute top-1 right-1 p-1 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Remove from gallery"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}

                    {/* Drag handle */}
                    {!disabled && (
                      <div className="absolute bottom-1 right-1 p-1 rounded bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No gallery images yet</p>
            </div>
          )}

          {/* Add to Gallery Button */}
          {!disabled && (
            <Button
              onClick={handleOpenPicker}
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add to Gallery
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Image Picker Modal */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Image to Add</DialogTitle>
            <DialogDescription>
              Choose from your recent uploads for this {entityKind}
            </DialogDescription>
          </DialogHeader>

          {loadingUploads ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : recentUploads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No recent uploads found. Upload an image first.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {recentUploads.map((media) => {
                // Use 'public' variant (default Cloudflare Images variant)
                const thumbUrl = media.provider_key && deliveryUrl
                  ? buildImageUrl(media.provider_key, 'public', deliveryUrl)
                  : null;

                // Check if already in gallery
                const alreadyLinked = localOrder.some(item => item.media_id === media.id);

                return (
                  <button
                    key={media.id}
                    onClick={() => !alreadyLinked && handleAddToGallery(media.id)}
                    disabled={alreadyLinked || loading}
                    className={`relative rounded-lg overflow-hidden border aspect-square ${
                      alreadyLinked
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:border-primary cursor-pointer'
                    }`}
                  >
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={`Image ${media.id}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    
                    {/* Status chips */}
                    <div className="absolute top-1 left-1 flex flex-col gap-1">
                      {getStatusChip(media.status)}
                      {getReviewStatusChip(media.image_review_status)}
                    </div>

                    {/* Already linked indicator */}
                    {alreadyLinked && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                        <Badge variant="secondary">Already in gallery</Badge>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

