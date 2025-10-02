import { CookieGroupService } from './cookieGroup.service.js';
import { RateLimitService } from './rateLimit.service.js';

export interface AuthCallbackParams {
  userId: string;
  deviceCookieId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthCallbackResult {
  success: boolean;
  canonicalGroupId?: string;
  mergedGroups?: string[];
  error?: string;
}

/**
 * Internal service for handling authentication callbacks
 * This function is called internally when a user authenticates
 * and needs to link their device to their canonical group
 */
export class AuthCallbackService {
  /**
   * Handle authentication callback - link device to user's canonical group
   * This is an internal function, not exposed as a public API
   */
  static async handleAuthCallback(params: AuthCallbackParams): Promise<AuthCallbackResult> {
    try {
      const { userId, deviceCookieId, ipAddress, userAgent } = params;

      // Validate parameters
      if (!userId || !deviceCookieId) {
        return {
          success: false,
          error: 'Missing required parameters: userId and deviceCookieId are required',
        };
      }

      // Optional: Check rate limit for auth callbacks (if IP provided)
      if (ipAddress) {
        const isAllowed = await RateLimitService.checkCookieIssueRateLimit(ipAddress);
        if (!isAllowed) {
          return {
            success: false,
            error: 'Rate limit exceeded for authentication callback',
          };
        }
      }

      // Link the device to the user's canonical group
      const canonicalGroup = await CookieGroupService.linkDeviceToUser({
        userId,
        deviceCookieId,
      });

      // Update last seen for the device
      await CookieGroupService.updateMemberLastSeen(deviceCookieId);

      // Optional: Record the auth callback request (if IP provided)
      if (ipAddress) {
        try {
          await RateLimitService.recordCookieIssueRequest({
            ipAddress,
            userAgent,
          });
        } catch (error) {
          // Don't fail the auth callback if rate limit recording fails
          console.warn('Failed to record auth callback request:', error);
        }
      }

      return {
        success: true,
        canonicalGroupId: canonicalGroup.id,
      };
    } catch (error) {
      console.error('Error in auth callback:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get user's canonical group information
   * This is an internal function for debugging/admin purposes
   */
  static async getUserCanonicalGroupInfo(userId: string): Promise<{
    groupId?: string;
    memberCount?: number;
    guestGamesCount?: number;
    guestWalletBalance?: number;
  }> {
    try {
      const canonicalGroup = await CookieGroupService.getUserCanonicalGroup(userId);
      if (!canonicalGroup) {
        return {};
      }

      const [members, guestGames, guestWallet] = await Promise.all([
        CookieGroupService.getGroupMembers(canonicalGroup.id),
        CookieGroupService.getGuestGamesForGroup(canonicalGroup.id),
        CookieGroupService.getGuestWallet(canonicalGroup.id),
      ]);

      return {
        groupId: canonicalGroup.id,
        memberCount: members.length,
        guestGamesCount: guestGames.length,
        guestWalletBalance: guestWallet?.casting_stones || 0,
      };
    } catch (error) {
      console.error('Error getting user canonical group info:', error);
      return {};
    }
  }

  /**
   * Migrate a game to user ownership (internal helper)
   * This is called by future flows, not exposed as public API
   */
  static async migrateGameToUser(gameId: string, userId: string): Promise<boolean> {
    try {
      // This would be implemented when we have the game migration logic
      // For now, just return true as a placeholder
      console.log(`Migrating game ${gameId} to user ${userId}`);
      return true;
    } catch (error) {
      console.error('Error migrating game to user:', error);
      return false;
    }
  }

  /**
   * Migrate a character to user ownership (internal helper)
   * This is called by future flows, not exposed as public API
   */
  static async migrateCharacterToUser(characterId: string, userId: string): Promise<boolean> {
    try {
      // This would be implemented when we have the character migration logic
      // For now, just return true as a placeholder
      console.log(`Migrating character ${characterId} to user ${userId}`);
      return true;
    } catch (error) {
      console.error('Error migrating character to user:', error);
      return false;
    }
  }
}
