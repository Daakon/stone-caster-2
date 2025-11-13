/**
 * OAuth redirect URL helpers
 * Always uses environment-specific base URLs
 */
import { getWebBaseUrl } from '@shared/config/appConfig';

/**
 * Get the OAuth callback redirect URL
 * Always uses environment-specific base URL (never hardcoded)
 */
export function getRedirectUrl(): string {
  const webBaseUrl = getWebBaseUrl();
  return `${webBaseUrl}/auth/callback`;
}





