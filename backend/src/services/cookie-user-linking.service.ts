import { supabaseAdmin } from './supabase.js';
import { ApiErrorCode } from 'shared';

export interface CookieUserLink {
  id: string;
  cookieId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export class CookieUserLinkingService {
  /**
   * Link a cookie ID to a user ID for seamless migration
   */
  static async linkCookieToUser(cookieId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin.rpc('link_cookie_to_user', {
        p_cookie_id: cookieId,
        p_user_id: userId
      });

      if (error) {
        console.error('Error linking cookie to user:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Unexpected error in linkCookieToUser:', error);
      return false;
    }
  }

  /**
   * Get user ID from cookie ID if linked
   */
  static async getUserIdFromCookie(cookieId: string): Promise<string | null> {
    try {
      const { data, error } = await supabaseAdmin.rpc('get_user_id_from_cookie', {
        p_cookie_id: cookieId
      });

      if (error) {
        console.error('Error getting user ID from cookie:', error);
        return null;
      }

      return data || null;
    } catch (error) {
      console.error('Unexpected error in getUserIdFromCookie:', error);
      return null;
    }
  }

  /**
   * Migrate all characters from cookie ID to user ID
   */
  static async migrateCharactersToUser(cookieId: string, userId: string): Promise<number> {
    try {
      const { data, error } = await supabaseAdmin.rpc('migrate_characters_to_user', {
        p_cookie_id: cookieId,
        p_user_id: userId
      });

      if (error) {
        console.error('Error migrating characters to user:', error);
        throw new Error('Failed to migrate characters');
      }

      return data || 0;
    } catch (error) {
      console.error('Unexpected error in migrateCharactersToUser:', error);
      throw error;
    }
  }

  /**
   * Get all characters for a user, including those linked via cookie
   */
  static async getCharactersForUser(userId: string, cookieId?: string): Promise<any[]> {
    try {
      let query = supabaseAdmin
        .from('characters')
        .select('*')
        .or(`user_id.eq.${userId}${cookieId ? `,cookie_id.eq.${cookieId}` : ''}`)
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error('Error getting characters for user:', error);
        throw new Error('Failed to get characters');
      }

      return data || [];
    } catch (error) {
      console.error('Unexpected error in getCharactersForUser:', error);
      throw error;
    }
  }

  /**
   * Check if a cookie ID is linked to a user
   */
  static async isCookieLinkedToUser(cookieId: string): Promise<boolean> {
    try {
      const userId = await this.getUserIdFromCookie(cookieId);
      return userId !== null;
    } catch (error) {
      console.error('Error checking cookie link:', error);
      return false;
    }
  }
}
