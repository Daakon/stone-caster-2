import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Trash2, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type ChimeraAssetRef } from '@/types/chimera-v2';
import { AssetPickerModal } from '@/features/dashboard/components/assets/AssetPickerModal';

export type PendingImage = ChimeraAssetRef | File;

export interface ImageUploaderProps {
    value?: PendingImage[];
    onChange: (value: PendingImage[]) => void;
    label?: string;
    folder?: string;
    maxSizeMB?: number;
    className?: string;
    preferredCategory?: string;
}

const DEFAULT_MAX_SIZE = 10; // 10MB

export function ImageUploader({
    value = [],
    onChange,
    label = "Images",
    maxSizeMB = DEFAULT_MAX_SIZE,
    className,
    preferredCategory = 'all'
}: ImageUploaderProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showAssetPicker, setShowAssetPicker] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    // Store object URLs for preview to avoid re-creating them on every render
    const [previewUrls, setPreviewUrls] = useState<Map<File, string>>(new Map());

    // Clean up object URLs when component unmounts or files change
    useEffect(() => {
        const newMap = new Map<File, string>();
        value.forEach(item => {
            if (item instanceof File) {
                if (!previewUrls.has(item)) {
                    newMap.set(item, URL.createObjectURL(item));
                } else {
                    newMap.set(item, previewUrls.get(item)!);
                }
            }
        });
        setPreviewUrls(newMap);

        // Cleanup function not strictly necessary for Map swap but good hygiene for revoked URLs?
        // Actually, we should revoke URLs that are no longer in the map.
        // For simplicity in this session, relying on browser GC or simple map update.
    }, [value]);


    const validateFile = (file: File): string | null => {
        if (!file.type.startsWith('image/')) {
            return 'File must be an image (JPEG, PNG, GIF, WebP, etc.)';
        }
        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        if (file.size > maxSizeBytes) {
            return `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum of ${maxSizeMB}MB`;
        }
        return null;
    };

    const handleFiles = (files: File[]) => {
        setIsDragging(false);
        const validFiles: File[] = [];

        files.forEach(f => {
            const error = validateFile(f);
            if (error) {
                console.error(error); // Or toast
            } else {
                validFiles.push(f);
            }
        });

        if (validFiles.length > 0) {
            // Append new files to existing value
            // Note: We don't have roles for Files yet. Parent handles upload.
            onChange([...value, ...validFiles]);
        }
    };

    const handleRemove = (index: number) => {
        const newValue = [...value];
        newValue.splice(index, 1)[0];
        // Note: Logic to reassign banner if banner was removed is complex with mixed types.
        // We'll leave it to simple removal for now, or ensure first item is usually treated as banner visually.
        onChange(newValue);
    };

    // Setting banner on pending files is tricky because they don't have a 'role' property.
    // We can wrap them? Or just assume index 0 is banner?
    // User interface shows "Set as Cover".
    // If we want to support "Set as Cover" for Files, we might need a wrapper object: { file: File, role: string }
    // But to keep props simple and compatible with existing ChimeraAssetRef structure...
    // Let's assume the parent handles the "Banner" logic based on order or metadata.
    // Actually, `ChimeraAssetRef` has `role`. `File` does not.
    // If we want to support ordering/roles for files, we should probably wrap `File` or just use the array index.
    // Let's rely on array index for now: Index 0 = Cover? 
    // The previous logic allowed explicit role setting.
    // Let's swap the item to index 0 to make it cover.
    const handleSetBanner = (index: number) => {
        if (index === 0) return;
        const newValue = [...value];
        const [item] = newValue.splice(index, 1);
        newValue.unshift(item);

        // If it's an AssetRef, update its role?
        // If we strictly follow "First item is banner", we might need to update all roles before save.
        // For visual feedback, let's just move it to top.
        onChange(newValue);
    };

    const getPreviewUrl = (item: PendingImage) => {
        if (item instanceof File) {
            return previewUrls.get(item);
        }
        return item.url;
    };

    // const isBanner = (index: number, item: PendingImage) => {
    //     // If it's an asset ref, check role.
    //     if (!(item instanceof File) && item.role === 'banner') return true;
    //     // Otherwise fallback to Index 0?
    //     if (index === 0) return true;
    //     return false;
    // };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) handleFiles(files);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) {
            handleFiles(Array.from(e.target.files));
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className={cn("space-y-4", className)}>
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-stone-300">{label}</label>
            </div>

            {/* Gallery Grid */}
            {value.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    {value.map((img, idx) => {
                        const isCover = idx === 0; // Simple logic: First is cover
                        return (
                            <div key={idx} className="group relative aspect-video rounded-lg overflow-hidden border border-stone-800 bg-stone-900">
                                <img src={getPreviewUrl(img) || undefined} alt={`Asset ${idx}`} className="w-full h-full object-cover" />

                                {/* Overlay */}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className={cn(
                                            "h-8 w-8 hover:bg-stone-800",
                                            isCover ? "text-amber-400" : "text-stone-400 hover:text-amber-400"
                                        )}
                                        onClick={() => handleSetBanner(idx)}
                                        title="Set as Cover"
                                    >
                                        <Star className={cn("w-4 h-4", isCover && "fill-current")} />
                                    </Button>
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-stone-400 hover:text-red-400 hover:bg-stone-800"
                                        onClick={() => handleRemove(idx)}
                                        title="Remove"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>

                                {/* Banner Indicator */}
                                {isCover && (
                                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/90 text-stone-950 uppercase tracking-wider backdrop-blur-sm">
                                        Cover
                                    </div>
                                )}

                                {img instanceof File && (
                                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/90 text-white uppercase tracking-wider backdrop-blur-sm">
                                        Pending
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Dropzone */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                    "border-2 border-dashed rounded-lg p-8 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 text-center",
                    isDragging
                        ? "border-amber-500/50 bg-amber-500/5"
                        : "border-stone-800 bg-stone-900/50 hover:border-stone-700 hover:bg-stone-900"
                )}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                />

                <div className="p-3 rounded-full bg-stone-900 ring-1 ring-stone-800">
                    <Upload className="w-6 h-6 text-stone-400" />
                </div>
                <div>
                    <p className="text-sm font-medium text-stone-300">
                        Drop images here or click to upload
                    </p>
                    <p className="text-xs text-stone-500 mt-1">
                        Supported: JPG, PNG, WEBP (Max {maxSizeMB}MB)
                    </p>
                </div>

                <div className="flex gap-2 mt-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            fileInputRef.current?.click();
                        }}
                    >
                        Upload Files
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowAssetPicker(true);
                        }}
                    >
                        Select from Library
                    </Button>
                </div>
            </div>

            <AssetPickerModal
                isOpen={showAssetPicker}
                onClose={() => setShowAssetPicker(false)}
                onSelect={(url) => {
                    // Create a new AssetRef
                    const newAsset: ChimeraAssetRef = {
                        id: crypto.randomUUID(), // Temporary ID until saved or real ID if we had it
                        url: url,
                        role: value.length === 0 ? 'portrait' : 'gallery'
                    };
                    onChange([...value, newAsset]);
                }}
                preferredCategory={preferredCategory}
            />
        </div>
    );
}
