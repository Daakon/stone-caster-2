/**
 * NPC Portrait Uploader Component
 * Phase 6: Portrait upload with preview and validation
 */

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, X, AlertTriangle, Image, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface NpcPortraitUploaderProps {
  currentUrl?: string;
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
}

export default function NpcPortraitUploader({ 
  currentUrl, 
  onUpload, 
  disabled = false 
}: NpcPortraitUploaderProps) {
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Only JPEG, PNG, and WebP are allowed.');
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size too large. Maximum 5MB allowed.');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    try {
      setUploading(true);
      setError(null);
      await onUpload(file);
    } catch (error) {
      setError('Failed to upload portrait');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="space-y-4">
      {/* Current Portrait */}
      {preview && (
        <div className="space-y-2">
          <Label>Current Portrait</Label>
          <div className="relative inline-block">
            <img
              src={preview}
              alt="NPC Portrait"
              className="h-24 w-24 rounded-lg object-cover border"
            />
            {!disabled && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                onClick={handleRemove}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Upload Area */}
      {!preview && (
        <div className="space-y-2">
          <Label>Upload Portrait</Label>
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              disabled 
                ? 'border-muted bg-muted cursor-not-allowed' 
                : 'border-muted-foreground hover:border-primary hover:bg-muted/50'
            }`}
            onClick={handleClick}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Uploading...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Click to upload</p>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG, WebP up to 5MB
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload Button */}
      {preview && !disabled && (
        <Button
          type="button"
          variant="outline"
          onClick={handleClick}
          disabled={uploading}
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? 'Uploading...' : 'Change Portrait'}
        </Button>
      )}

      {/* Hidden File Input */}
      <Input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />

      {/* Error Display */}
      {error && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Upload Guidelines */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>• Supported formats: JPEG, PNG, WebP</p>
        <p>• Maximum file size: 5MB</p>
        <p>• Recommended size: 400x400px or larger</p>
        <p>• Square aspect ratio works best</p>
      </div>
    </div>
  );
}

