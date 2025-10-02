import { supabaseAdmin } from './supabase.js';
import { configService } from './config.service.js';

export interface DailyRegenResult {
  guestGroupsUpdated: number;
  userWalletsUpdated: number;
  ledgerEntriesCreated: number;
}

export interface PurgeResult {
  staleMembersRemoved: number;
  emptyGroupsRemoved: number;
}

export class JobsService {
  /**
   * Daily regeneration job for casting stones
   * Adds configured amount to both guest groups and user wallets
   */
  static async dailyRegenJob(): Promise<DailyRegenResult> {
    try {
      const config = await configService.getConfig();
      const regenAmount = config.pricing?.guest_daily_regen?.value || 0;

      if (regenAmount === 0) {
        return {
          guestGroupsUpdated: 0,
          userWalletsUpdated: 0,
          ledgerEntriesCreated: 0,
        };
      }

      // Get all guest wallets
      const { data: guestWallets, error: guestError } = await supabaseAdmin
        .from('guest_stone_wallets')
        .select('*')
        .order('group_id');

      if (guestError) throw guestError;

      // Get all user wallets
      const { data: userWallets, error: userError } = await supabaseAdmin
        .from('stone_wallets')
        .select('*')
        .order('user_id');

      if (userError) throw userError;

      let guestGroupsUpdated = 0;
      let userWalletsUpdated = 0;
      let ledgerEntriesCreated = 0;

      // Update guest wallets
      for (const wallet of guestWallets || []) {
        const newBalance = wallet.casting_stones + regenAmount;
        
        const { error: updateError } = await supabaseAdmin
          .from('guest_stone_wallets')
          .update({ casting_stones: newBalance })
          .eq('group_id', wallet.group_id);

        if (updateError) throw updateError;
        guestGroupsUpdated++;
      }

      // Update user wallets and create ledger entries
      for (const wallet of userWallets || []) {
        const newBalance = wallet.casting_stones + regenAmount;
        
        const { error: updateError } = await supabaseAdmin
          .from('stone_wallets')
          .update({ casting_stones: newBalance })
          .eq('id', wallet.id);

        if (updateError) throw updateError;
        userWalletsUpdated++;

        // Create ledger entry
        const { error: ledgerError } = await supabaseAdmin
          .from('stone_ledger')
          .insert({
            wallet_id: wallet.id,
            user_id: wallet.user_id,
            amount: regenAmount,
            reason: 'DAILY_REGEN',
            metadata: { job: 'daily_regen' },
          });

        if (ledgerError) throw ledgerError;
        ledgerEntriesCreated++;
      }

      return {
        guestGroupsUpdated,
        userWalletsUpdated,
        ledgerEntriesCreated,
      };
    } catch (error) {
      console.error('Error in daily regen job:', error);
      throw error;
    }
  }

  /**
   * Purge stale guest data based on TTL
   * Removes cookie group members not seen after TTL and empty groups
   */
  static async purgeGuestsJob(): Promise<PurgeResult> {
    try {
      const config = await configService.getConfig();
      const ttlDays = config.app?.cookie_ttl_days?.value || 60;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - ttlDays);

      // Get stale cookie group members
      const { data: staleMembers, error: staleError } = await supabaseAdmin
        .from('cookie_group_members')
        .select('*')
        .lt('last_seen_at', cutoffDate.toISOString())
        .order('last_seen_at', { ascending: true });

      if (staleError) throw staleError;

      // Remove stale members
      const { error: deleteMembersError } = await supabaseAdmin
        .from('cookie_group_members')
        .delete()
        .lt('last_seen_at', cutoffDate.toISOString());

      if (deleteMembersError) throw deleteMembersError;

      // Get empty groups (groups with no members and no games)
      const { data: emptyGroups, error: emptyError } = await supabaseAdmin
        .from('cookie_groups')
        .select(`
          id,
          user_id
        `)
        .is('user_id', null)
        .not('id', 'in', supabaseAdmin
          .from('cookie_group_members')
          .select('group_id')
        )
        .not('id', 'in', supabaseAdmin
          .from('game_saves')
          .select('cookie_id')
          .join('cookie_group_members', 'game_saves.cookie_id', 'cookie_group_members.cookie_id')
          .select('cookie_group_members.group_id')
        )
        .order('created_at', { ascending: true });

      if (emptyError) throw emptyError;

      // Remove empty groups
      const { error: deleteGroupsError } = await supabaseAdmin
        .from('cookie_groups')
        .delete()
        .is('user_id', null)
        .not('id', 'in', supabaseAdmin
          .from('cookie_group_members')
          .select('group_id')
        )
        .not('id', 'in', supabaseAdmin
          .from('game_saves')
          .select('cookie_id')
          .join('cookie_group_members', 'game_saves.cookie_id', 'cookie_group_members.cookie_id')
          .select('cookie_group_members.group_id')
        );

      if (deleteGroupsError) throw deleteGroupsError;

      return {
        staleMembersRemoved: staleMembers?.length || 0,
        emptyGroupsRemoved: emptyGroups?.length || 0,
      };
    } catch (error) {
      console.error('Error in purge guests job:', error);
      throw error;
    }
  }

  /**
   * Check rate limit for cookie issuance
   */
  static async checkRateLimit(ipAddress: string): Promise<boolean> {
    try {
      const config = await configService.getConfig();
      const rateLimit = config.app?.guest_cookie_issue_rate_limit_per_hour?.value || 10;

      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      // Get recent requests from this IP
      const { data: recentRequests, error } = await supabaseAdmin
        .from('cookie_issue_requests')
        .select('*')
        .eq('ip_address', ipAddress)
        .gte('created_at', oneHourAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (recentRequests?.length || 0) < rateLimit;
    } catch (error) {
      console.error('Error checking rate limit:', error);
      throw error;
    }
  }
}
