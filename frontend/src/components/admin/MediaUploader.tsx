/**
 * Media Uploader Component
 * Phase 3a: Admin-only image uploader with Cloudflare Direct Upload
 */

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, Image as ImageIcon, AlertCircle, RefreshCw } from 'lucide-react';
import type { MediaAssetDTO } from '@shared/types/media';
import { buildImageUrl } from '@shared/media/url';
import { apiUrl } from '@/lib/apiBase';
import { apiPost } from '@/lib/api';
import { trackAdminEvent } from '@/lib/admin-telemetry';

export interface MediaUploaderProps {
  kind: 'world' | 'story' | 'npc' | 'site';
  onUploaded?: (media: MediaAssetDTO) => void;
  buttonLabel?: string;
  className?: string;
  entityName?: string; // For alt text and telemetry
}

type UploadState = 'idle' | 'uploading' | 'finalizing' | 'error' | 'success';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function MediaUploader({
  kind,
  onUploaded,
  buttonLabel = 'Upload image',
  className,
  entityName,
}: MediaUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<UploadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [uploadedMedia, setUploadedMedia] = useState<MediaAssetDTO | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [finalizeError, setFinalizeError] = useState<boolean>(false);
  const [pendingMediaId, setPendingMediaId] = useState<string | null>(null);

  // Announce to screen readers
  const announce = (message: string) => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = message;
      // Clear after announcement
      setTimeout(() => {
        if (liveRegionRef.current) {
          liveRegionRef.current.textContent = '';
        }
      }, 1000);
    }
  };

  const validateFile = (file: File): string | null => {
    // Check MIME type
    if (!file.type.startsWith('image/')) {
      return 'File must be an image (JPEG, PNG, GIF, WebP, etc.)';
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return `File size (${sizeMB}MB) exceeds maximum of 10MB`;
    }

    return null;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Phase 3a refinement: Client file guards
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setState('error');
      announce(`Upload failed: ${validationError}`);
      return;
    }

    // Reset state
    setError(null);
    setFinalizeError(false);
    setState('uploading');
    setUploadedMedia(null);
    setPreviewUrl(null);
    setPendingMediaId(null);
    announce('Upload started');

    const fileSizeKB = Math.round(file.size / 1024);

    try {
      // Phase 3a refinement: Telemetry breadcrumbs
      await trackAdminEvent('ui_media_upload_started', {
        kind,
        fileSizeKB,
      });

      // Step 1: Request direct upload URL
      const uploadRequestResult = await apiPost('/api/media/uploads', { kind });

      if (!uploadRequestResult.ok || !uploadRequestResult.data) {
        throw new Error(uploadRequestResult.error?.message || 'Upload request failed');
      }

      const { uploadURL, media } = uploadRequestResult.data;
      setPendingMediaId(media.id);

      // Step 2: Upload file to Cloudflare
      // Note: Direct upload URLs are pre-signed and should NOT include Authorization headers
      // The uploadURL itself contains the authentication needed
      const formData = new FormData();
      formData.append('file', file);

      const cfUploadResponse = await fetch(uploadURL, {
        method: 'POST',
        // Do NOT include Authorization header - the uploadURL is pre-signed
        body: formData,
      });

      if (!cfUploadResponse.ok) {
        const cfError = await cfUploadResponse.json().catch(() => ({}));
        throw new Error(cfError.errors?.[0]?.message || `Cloudflare upload failed: ${cfUploadResponse.status}`);
      }

      const cfUploadData = await cfUploadResponse.json();
      console.log('[MediaUploader] Cloudflare upload response:', cfUploadData);
      
      if (!cfUploadData.success) {
        throw new Error(cfUploadData.errors?.[0]?.message || 'Cloudflare upload failed');
      }

      // Cloudflare returns the final image ID in the upload response
      // The direct upload request returns a draft ID, but after upload we get the real ID
      const finalImageId = cfUploadData.result?.id;
      console.log(`[MediaUploader] Upload response image ID: ${finalImageId}, stored provider_key: ${media.provider_key}`);
      
      // Step 3: Finalize upload
      setState('finalizing');
      announce('Finalizing upload');

      // Pass the final image ID from Cloudflare upload response to finalize endpoint
      // The backend will update provider_key if it's different
      const finalizeResult = await apiPost(`/api/media/${media.id}/finalize`, {
        provider_key: finalImageId || media.provider_key,
      });

      if (!finalizeResult.ok || !finalizeResult.data?.media) {
        // Phase 3a refinement: Retry finalize for transient errors
        const isTransientError = finalizeResult.error?.message?.includes('Cloudflare') || 
                                 finalizeResult.error?.message?.includes('timeout') ||
                                 finalizeResult.error?.message?.includes('502');
        
        if (isTransientError) {
          setFinalizeError(true);
          setPendingMediaId(media.id);
          throw new Error(finalizeResult.error?.message || 'Finalize failed. You can retry finalization.');
        }
        
        throw new Error(finalizeResult.error?.message || 'Finalize failed');
      }

      const finalizedMedia: MediaAssetDTO = finalizeResult.data.media;

      // Build preview URL (using 'public' variant - default Cloudflare Images variant)
      // To use optimized variants like 'card', create them in Cloudflare Images dashboard first
      const deliveryUrl = import.meta.env.VITE_CF_IMAGES_DELIVERY_URL;
      if (deliveryUrl && finalizedMedia.provider_key) {
        const preview = buildImageUrl(finalizedMedia.provider_key, 'public', deliveryUrl);
        setPreviewUrl(preview);
      }

      setUploadedMedia(finalizedMedia);
      setState('success');
      setPendingMediaId(null);
      announce('Upload completed successfully');

      // Phase 3a refinement: Telemetry breadcrumbs
      await trackAdminEvent('ui_media_upload_succeeded', {
        kind,
        fileSizeKB,
        mediaId: finalizedMedia.id,
        width: finalizedMedia.width,
        height: finalizedMedia.height,
      });

      // Call callback
      if (onUploaded) {
        onUploaded(finalizedMedia);
      }
    } catch (err) {
      console.error('Upload error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      setState('error');
      announce(`Upload failed: ${errorMessage}`);

      // Phase 3a refinement: Telemetry breadcrumbs
      await trackAdminEvent('ui_media_upload_failed', {
        kind,
        fileSizeKB,
        error: errorMessage,
      });
    } finally {
      // Reset file input to allow re-upload
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Phase 3a refinement: Retry finalize handler
  const handleRetryFinalize = async () => {
    if (!pendingMediaId) return;

    setError(null);
    setFinalizeError(false);
    setState('finalizing');
    announce('Retrying finalization');

    try {
      const finalizeResult = await apiPost(`/api/media/${pendingMediaId}/finalize`, {});

      if (!finalizeResult.ok || !finalizeResult.data?.media) {
        throw new Error(finalizeResult.error?.message || 'Finalize failed');
      }

      const finalizedMedia: MediaAssetDTO = finalizeResult.data.media;

      // Build preview URL (using 'public' variant - default Cloudflare Images variant)
      const deliveryUrl = import.meta.env.VITE_CF_IMAGES_DELIVERY_URL;
      if (deliveryUrl && finalizedMedia.provider_key) {
        const preview = buildImageUrl(finalizedMedia.provider_key, 'public', deliveryUrl);
        setPreviewUrl(preview);
      }

      setUploadedMedia(finalizedMedia);
      setState('success');
      setPendingMediaId(null);
      announce('Finalization completed successfully');

      if (onUploaded) {
        onUploaded(finalizedMedia);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Finalize failed';
      setError(errorMessage);
      setState('error');
      setFinalizeError(true);
      announce(`Finalization failed: ${errorMessage}`);
    }
  };

  const handleRetry = () => {
    setError(null);
    setFinalizeError(false);
    setState('idle');
    fileInputRef.current?.click();
  };

  // Phase 3a refinement: Get review status chip
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

  return (
    <div className={className}>
      {/* Phase 3a refinement: ARIA live region for announcements */}
      <div
        ref={liveRegionRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0"
        style={{ clip: 'rect(0, 0, 0, 0)', clipPath: 'inset(50%)' }}
      />

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Upload Button */}
            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id={`media-upload-${kind}`}
                aria-label="Select image file"
                disabled={state === 'uploading' || state === 'finalizing'}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={state === 'uploading' || state === 'finalizing'}
                aria-busy={state === 'uploading' || state === 'finalizing'}
              >
                {(state === 'uploading' || state === 'finalizing') ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {state === 'uploading' ? 'Uploading...' : 'Finalizing...'}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    {buttonLabel}
                  </>
                )}
              </Button>
              {state === 'error' && !finalizeError && (
                <Button variant="outline" size="sm" onClick={handleRetry}>
                  Retry
                </Button>
              )}
              {/* Phase 3a refinement: Retry finalize button */}
              {state === 'error' && finalizeError && pendingMediaId && (
                <Button variant="outline" size="sm" onClick={handleRetryFinalize}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry finalize
                </Button>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Preview */}
            {previewUrl && uploadedMedia && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Preview</div>
                  {/* Phase 3a refinement: Inline status chip */}
                  {getReviewStatusChip(uploadedMedia.image_review_status)}
                </div>
                {/* NPCs use 3:4 portrait, Worlds/Stories use 16:9 landscape */}
                <div className={`relative rounded-lg overflow-hidden border bg-muted ${
                  kind === 'npc' ? 'aspect-[3/4]' : 'aspect-video'
                }`}>
                  <img
                    src={previewUrl}
                    alt={entityName ? `Cover image for ${entityName}` : 'Uploaded image preview'}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{uploadedMedia.width} × {uploadedMedia.height}</span>
                  <span>•</span>
                  <span className="capitalize">{uploadedMedia.status}</span>
                  {uploadedMedia.status !== 'ready' && (
                    <>
                      <span>•</span>
                      <span className="capitalize">{uploadedMedia.image_review_status} review</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Success State (no preview if no delivery URL) */}
            {state === 'success' && !previewUrl && uploadedMedia && (
              <Alert>
                <ImageIcon className="h-4 w-4" />
                <AlertDescription>
                  Image uploaded successfully. Preview unavailable (delivery URL not configured).
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
