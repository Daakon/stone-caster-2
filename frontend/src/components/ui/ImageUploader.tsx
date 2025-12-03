/**
 * Image Uploader Component
 * Drag & drop image uploader for Worlds and Entities
 * Phase 9: UX Repair, World Filtering & Asset Restoration
 */

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Upload, Image as ImageIcon, X, AlertCircle } from 'lucide-react';
import { apiPost } from '@/lib/api';
import { toast } from 'sonner';

export interface ImageUploaderProps {
  onUploadComplete: (publicUrl: string) => void;
  folder?: string;
  className?: string;
  maxSizeMB?: number;
}

const DEFAULT_MAX_SIZE = 10; // 10MB

export function ImageUploader({
  onUploadComplete,
  folder = 'worlds',
  className = '',
  maxSizeMB = DEFAULT_MAX_SIZE,
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): string | null => {
    if (!file.type.startsWith('image/')) {
      return 'File must be an image (JPEG, PNG, GIF, WebP, etc.)';
    }

    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return `File size (${sizeMB}MB) exceeds maximum of ${maxSizeMB}MB`;
    }

    return null;
  };

  const handleFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        toast.error(validationError);
        return;
      }

      setError(null);
      setIsUploading(true);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      try {
        // Step 1: Request signed upload URL
        const signResult = await apiPost<{
          uploadUrl: string;
          accessUrl: string;
          path: string;
        }>('/api/chimera/assets/sign-upload', {
          filename: file.name,
          fileType: file.type,
          folder,
        });

        if (!signResult.ok) {
          throw new Error(signResult.error?.message || 'Failed to get upload URL');
        }

        if (!signResult.data) {
          throw new Error('Failed to get upload URL: no data returned');
        }

        const { uploadUrl, accessUrl } = signResult.data;

        // Step 2: Upload file to Cloudflare
        // Cloudflare Images direct upload requires POST with FormData
        // The uploadURL is pre-signed and should NOT include Authorization headers
        const formData = new FormData();
        formData.append('file', file);

        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          // Do NOT include Authorization header - the uploadURL is pre-signed
          body: formData,
        });

        if (!uploadResponse.ok) {
          const cfError = await uploadResponse.json().catch(() => ({}));
          const errorMessage = cfError.errors?.[0]?.message || `Cloudflare upload failed: ${uploadResponse.status}`;
          throw new Error(errorMessage);
        }

        // Cloudflare returns JSON response with success status
        const uploadData = await uploadResponse.json();
        if (!uploadData.success) {
          throw new Error(uploadData.errors?.[0]?.message || 'Cloudflare upload failed');
        }

        // Step 3: Call completion callback
        onUploadComplete(accessUrl);
        toast.success('Image uploaded successfully');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Upload failed';
        setError(errorMessage);
        toast.error(errorMessage);
        setPreviewUrl(null);
      } finally {
        setIsUploading(false);
      }
    },
    [folder, maxSizeMB, onUploadComplete]
  );

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Upload image"
      />

      {previewUrl ? (
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full h-48 object-cover rounded-md"
              />
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2"
                onClick={handleRemove}
                aria-label="Remove image"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {isUploading && (
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`cursor-pointer transition-colors ${
            isDragging ? 'border-primary bg-primary/5' : ''
          }`}
        >
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <div className="rounded-full bg-muted p-4">
                {isUploading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium">
                  {isUploading ? 'Uploading...' : 'Drag & drop an image here'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  or click to browse (max {maxSizeMB}MB)
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                <Upload className="h-4 w-4 mr-2" />
                Select Image
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

