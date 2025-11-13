/**
 * Media URL Builder
 * Phase 2a: Cloudflare Images delivery URL helper
 * Phase 3a: Frontend-compatible version
 */

export type ImageVariant = 'thumb' | 'avatar' | 'card' | 'banner' | 'public';

/**
 * Build a Cloudflare Images delivery URL for a specific image and variant
 * @param imageId Cloudflare Images ID (provider_key from media_assets)
 * @param variant Image variant name (optional - defaults to 'public' if not provided)
 * @param deliveryUrl Optional delivery URL (defaults to env var)
 * @returns Full delivery URL
 */
export function buildImageUrl(imageId: string, variant?: ImageVariant | null, deliveryUrl?: string): string {
  // Get delivery URL from env or parameter
  const baseUrl = deliveryUrl || import.meta.env.VITE_CF_IMAGES_DELIVERY_URL || '';
  
  if (!baseUrl) {
    console.warn('CF_IMAGES_DELIVERY_URL is not configured. Image URLs will be incomplete.');
    // Default to 'public' variant if none specified
    const defaultVariant = variant || 'public';
    return `/images/${imageId}/${defaultVariant}`; // Fallback placeholder
  }

  // Remove trailing slash if present
  const cleanUrl = baseUrl.replace(/\/$/, '');

  // Cloudflare Images requires a variant - default to 'public' if none specified
  // Format: https://imagedelivery.net/{accountHash}/{imageId}/{variant}
  const finalVariant = variant || 'public';
  return `${cleanUrl}/${imageId}/${finalVariant}`;
}

