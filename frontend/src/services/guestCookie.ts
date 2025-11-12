import { v4 as uuidv4 } from 'uuid';

const GUEST_COOKIE_NAME = 'guestId';
const GUEST_COOKIE_EXPIRY_DAYS = 365; // 1 year

/**
 * Guest Cookie Management Service
 * Handles creation, retrieval, and management of guest cookies for anonymous users
 */
export class GuestCookieService {
  /**
   * Get or create a guest cookie ID
   * If no guest cookie exists, creates a new one
   */
  static getOrCreateGuestCookie(): string {
    const existingCookie = this.getGuestCookie();
    if (existingCookie) {
      return existingCookie;
    }

    const newGuestId = uuidv4();
    this.setGuestCookie(newGuestId);
    return newGuestId;
  }

  /**
   * Get the current guest cookie ID
   */
  static getGuestCookie(): string | null {
    if (typeof document === 'undefined') {
      return null; // SSR safety
    }

    const cookies = document.cookie.split(';');
    const guestCookie = cookies.find(cookie => 
      cookie.trim().startsWith(`${GUEST_COOKIE_NAME}=`)
    );

    if (guestCookie) {
      return guestCookie.split('=')[1];
    }

    return null;
  }

  /**
   * Set a guest cookie with proper expiry
   */
  static setGuestCookie(guestId: string): void {
    if (typeof document === 'undefined') {
      return; // SSR safety
    }

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + GUEST_COOKIE_EXPIRY_DAYS);

    document.cookie = `${GUEST_COOKIE_NAME}=${guestId}; expires=${expiryDate.toUTCString()}; path=/; SameSite=Lax`;
  }

  /**
   * Clear the guest cookie
   */
  static clearGuestCookie(): void {
    if (typeof document === 'undefined') {
      return; // SSR safety
    }

    document.cookie = `${GUEST_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  }

  /**
   * Check if a guest cookie exists
   */
  static hasGuestCookie(): boolean {
    return this.getGuestCookie() !== null;
  }

  /**
   * Get guest cookie for API requests
   * Returns the guest cookie ID if it exists, null otherwise
   */
  static getGuestCookieForApi(): string | null {
    return this.getGuestCookie();
  }
}
