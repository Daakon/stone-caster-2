/**
 * Admin Media Configuration
 * Phase 1: Config defaults (no behavior yet)
 * Phase 2a: Cloudflare Images integration
 */

/**
 * Image variant names supported by the system
 * These are the standard sizes/variants for image delivery
 */
export const IMAGE_VARIANTS = ['thumb', 'avatar', 'card', 'banner'] as const;

/**
 * Cloudflare Images delivery URL
 * Read from environment variable CF_IMAGES_DELIVERY_URL
 * Do not hardcode values here
 */
export function getCloudflareImagesDeliveryUrl(): string | undefined {
  return process.env.CF_IMAGES_DELIVERY_URL;
}

/**
 * Cloudflare Images configuration
 * Validates required environment variables at startup
 */
export interface CloudflareImagesConfig {
  accountId: string;
  apiToken: string;
  accountHash: string;
  deliveryUrl: string | undefined;
}

let cloudflareConfig: CloudflareImagesConfig | null = null;

/**
 * Validate Cloudflare Images environment variables
 * Logs warnings if missing but does not crash (feature gated by FF_ADMIN_MEDIA)
 * @returns Config object if all vars present, null otherwise
 */
export function validateCloudflareImagesConfig(): CloudflareImagesConfig | null {
  if (cloudflareConfig !== null) {
    return cloudflareConfig;
  }

  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;
  const accountHash = process.env.CF_IMAGES_ACCOUNT_HASH;
  const deliveryUrl = process.env.CF_IMAGES_DELIVERY_URL;

  const missing: string[] = [];
  if (!accountId) missing.push('CF_ACCOUNT_ID');
  if (!apiToken) missing.push('CF_API_TOKEN');
  if (!accountHash) missing.push('CF_IMAGES_ACCOUNT_HASH');
  if (!deliveryUrl) missing.push('CF_IMAGES_DELIVERY_URL');

  if (missing.length > 0) {
    console.warn(
      `[Media Config] Cloudflare Images configuration incomplete. Missing: ${missing.join(', ')}. ` +
      `Feature will be disabled until all variables are set.`
    );
    cloudflareConfig = null;
    return null;
  }

  cloudflareConfig = {
    accountId,
    apiToken,
    accountHash,
    deliveryUrl,
  };

  return cloudflareConfig;
}

// Validate on module load (non-blocking)
validateCloudflareImagesConfig();

