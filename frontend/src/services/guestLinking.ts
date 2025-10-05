import { ProfileService } from './profile';
import { GuestCookieService } from './guestCookie';
// import { useToast } from '../hooks/use-toast';

export interface GuestLinkingResult {
  success: boolean;
  alreadyLinked: boolean;
  message: string;
  traceId?: string;
  migrationSummary?: {
    charactersMigrated: number;
    gamesMigrated: number;
    stonesMigrated: number;
    ledgerEntriesCreated: number;
  };
}

export class GuestLinkingService {
  /**
   * Link guest account to authenticated user
   * This should be called after successful authentication
   */
  static async linkGuestAccount(): Promise<GuestLinkingResult> {
    try {
      const guestCookieId = GuestCookieService.getGuestCookieForApi();
      
      if (!guestCookieId) {
        return {
          success: true,
          alreadyLinked: false,
          message: 'No guest account to link',
        };
      }

      console.log('[GuestLinking] Linking guest account:', guestCookieId);
      
      const result = await ProfileService.linkGuestAccount(guestCookieId);
      
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to link guest account');
      }

      console.log('[GuestLinking] Guest account linked successfully:', result.data);
      
      return {
        success: true,
        alreadyLinked: result.data.alreadyLinked,
        message: result.data.message,
        traceId: (result as any).error?.traceId,
        migrationSummary: result.data.migrationSummary,
      };
    } catch (error) {
      console.error('[GuestLinking] Error linking guest account:', error);
      
      return {
        success: false,
        alreadyLinked: false,
        message: error instanceof Error ? error.message : 'Failed to link guest account',
        traceId: (error as any)?.traceId,
      };
    }
  }

  /**
   * Check if there's a guest account that can be linked
   */
  static hasGuestAccountToLink(): boolean {
    return GuestCookieService.hasGuestCookie();
  }

  /**
   * Get guest cookie ID for linking
   */
  static getGuestCookieId(): string | null {
    return GuestCookieService.getGuestCookieForApi();
  }

  /**
   * Get guest account summary before linking
   */
  static async getGuestAccountSummary(cookieGroupId: string): Promise<{
    success: boolean;
    summary?: any;
    message?: string;
  }> {
    try {
      const result = await ProfileService.getGuestAccountSummary(cookieGroupId);
      
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to get guest account summary');
      }

      return {
        success: true,
        summary: result.data,
      };
    } catch (error) {
      console.error('[GuestLinking] Error getting guest account summary:', error);
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get guest account summary',
      };
    }
  }

  /**
   * Clear guest cookie after successful linking
   * This should be called after the guest account is successfully linked
   */
  static clearGuestCookie(): void {
    GuestCookieService.clearGuestCookie();
    console.log('[GuestLinking] Guest cookie cleared after successful linking');
  }
}

/**
 * Hook for managing guest account linking
 * Note: Toast functionality would need to be implemented with proper toast system
 */
export function useGuestLinking() {
  // const { toast } = useToast();

  const linkGuestAccount = async (): Promise<GuestLinkingResult> => {
    const result = await GuestLinkingService.linkGuestAccount();
    
    if (result.success) {
      // Clear guest cookie after successful linking
      GuestLinkingService.clearGuestCookie();
    }
    
    return result;
  };

  return {
    linkGuestAccount,
    hasGuestAccountToLink: GuestLinkingService.hasGuestAccountToLink(),
    getGuestCookieId: GuestLinkingService.getGuestCookieId(),
  };
}
