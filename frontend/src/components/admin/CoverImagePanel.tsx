/**
 * Cover Image Panel Component
 * Phase 3b: Admin UI for setting/clearing primary (cover) images
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Image as ImageIcon, X, Lock } from 'lucide-react';
import { toast } from 'sonner';
import type { MediaAssetDTO } from '@shared/types/media';
import { buildImageUrl } from '@shared/media/url';
import { setCoverMedia } from '@/services/admin.media';
import type { EntityKind } from '@/services/admin.media';

export interface CoverImagePanelProps {
  entityKind: EntityKind;
  entityId: string;
  coverMedia?: MediaAssetDTO | null;
  selectedMediaId?: string | null;
  disabled?: boolean;
  onChange?: (mediaId: string | null) => void;
  entityName?: string;
}

export function CoverImagePanel({
  entityKind,
  entityId,
  coverMedia,
  selectedMediaId,
  disabled = false,
  onChange,
  entityName,
}: CoverImagePanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSetCover = async () => {
    if (!selectedMediaId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await setCoverMedia({
        entityKind,
        entityId,
        mediaId: selectedMediaId,
      });

      if (!result.ok) {
        throw new Error(result.error?.message || 'Failed to set cover image');
      }

      toast.success('Cover image set successfully');
      if (onChange) {
        onChange(selectedMediaId);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set cover image';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClearCover = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await setCoverMedia({
        entityKind,
        entityId,
        mediaId: null,
      });

      if (!result.ok) {
        throw new Error(result.error?.message || 'Failed to clear cover image');
      }

      toast.success('Cover image cleared');
      if (onChange) {
        onChange(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear cover image';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const deliveryUrl = import.meta.env.VITE_CF_IMAGES_DELIVERY_URL;
  // Use 'public' variant (default Cloudflare Images variant)
  // To use optimized variants like 'card', create them in Cloudflare Images dashboard first
  const coverPreviewUrl = coverMedia?.provider_key && deliveryUrl
    ? buildImageUrl(coverMedia.provider_key, 'public', deliveryUrl)
    : null;

  const getReviewStatusChip = (status: string) => {
    if (status === 'approved') {
      return <Badge variant="default" className="text-xs">Approved</Badge>;
    } else if (status === 'pending') {
      return <Badge variant="secondary" className="text-xs">Pending review</Badge>;
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
    } else if (status === 'failed') {
      return <Badge variant="destructive" className="text-xs">Failed</Badge>;
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Primary (Cover) Image</CardTitle>
        <CardDescription>
          The primary image displayed for this {entityKind}. Required for publishing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Current Cover Preview */}
        {coverPreviewUrl && coverMedia ? (
          <div className="space-y-2">
            {/* NPCs use 3:4 portrait, Worlds/Stories use 16:9 landscape */}
            <div className={`relative rounded-lg overflow-hidden border bg-muted ${
              entityKind === 'npc' ? 'aspect-[3/4]' : 'aspect-video'
            }`}>
              <img
                src={coverPreviewUrl}
                alt={entityName ? `Cover image for ${entityName}` : 'Cover image'}
                className="w-full h-full object-cover"
              />
              {/* Status chips overlay */}
              <div className="absolute top-2 right-2 flex gap-2">
                {getStatusChip(coverMedia.status)}
                {getReviewStatusChip(coverMedia.image_review_status)}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {coverMedia.width} × {coverMedia.height}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearCover}
                disabled={disabled || loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <X className="h-4 w-4 mr-2" />
                    Clear Primary
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className={`flex items-center justify-center rounded-lg border-2 border-dashed bg-muted ${
            entityKind === 'npc' ? 'aspect-[3/4]' : 'aspect-video'
          }`}>
            <div className="text-center text-muted-foreground">
              <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No cover image set</p>
            </div>
          </div>
        )}

        {/* Set as Primary Button */}
        <div className="flex items-center gap-2">
          <Button
            onClick={handleSetCover}
            disabled={disabled || loading || !selectedMediaId}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Setting...
              </>
            ) : (
              'Set as Primary'
            )}
          </Button>
          {disabled && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground" title="Locked after publish">
              <Lock className="h-3 w-3" />
              <span>Locked</span>
            </div>
          )}
        </div>

        {!selectedMediaId && !coverMedia && (
          <p className="text-xs text-muted-foreground">
            Upload an image above, then select it to set as primary.
          </p>
        )}
      </CardContent>
    </Card>
  );
}


