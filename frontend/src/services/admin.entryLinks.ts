/**
 * Entry Links Service
 * Handles associations between entries and rulesets/NPCs/packs
 */

import { supabase } from '@/lib/supabase';

export interface EntryRulesetLink {
  entry_id: string;
  ruleset_id: string;
  sort_order: number;
}

export interface EntryNPCLink {
  entry_id: string;
  npc_id: string;
}

export interface EntryNPCPackLink {
  entry_id: string;
  pack_id: string;
}

export class EntryLinksService {
  /**
   * Update ruleset associations for an entry
   * This replaces all existing ruleset associations with the new ones
   */
  async updateEntryRulesets(
    entryId: string, 
    rulesetIds: string[]
  ): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Start a transaction by deleting existing associations
    const { error: deleteError } = await supabase
      .from('entry_rulesets')
      .delete()
      .eq('entry_id', entryId);

    if (deleteError) {
      throw new Error(`Failed to clear existing ruleset associations: ${deleteError.message}`);
    }

    // Insert new associations with sort order
    if (rulesetIds.length > 0) {
      const associations = rulesetIds.map((rulesetId, index) => ({
        entry_id: entryId,
        ruleset_id: rulesetId,
        sort_order: index
      }));

      const { error: insertError } = await supabase
        .from('entry_rulesets')
        .insert(associations);

      if (insertError) {
        throw new Error(`Failed to create ruleset associations: ${insertError.message}`);
      }
    }
  }

  /**
   * Update NPC associations for an entry
   * This replaces all existing NPC associations with the new ones
   */
  async updateEntryNPCs(
    entryId: string, 
    npcIds: string[]
  ): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Start a transaction by deleting existing associations
    const { error: deleteError } = await supabase
      .from('entry_npcs')
      .delete()
      .eq('entry_id', entryId);

    if (deleteError) {
      throw new Error(`Failed to clear existing NPC associations: ${deleteError.message}`);
    }

    // Insert new associations
    if (npcIds.length > 0) {
      const associations = npcIds.map(npcId => ({
        entry_id: entryId,
        npc_id: npcId
      }));

      const { error: insertError } = await supabase
        .from('entry_npcs')
        .insert(associations);

      if (insertError) {
        throw new Error(`Failed to create NPC associations: ${insertError.message}`);
      }
    }
  }

  /**
   * Update NPC pack associations for an entry
   * This replaces all existing NPC pack associations with the new ones
   */
  async updateEntryNPCPacks(
    entryId: string, 
    packIds: string[]
  ): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Start a transaction by deleting existing associations
    const { error: deleteError } = await supabase
      .from('entry_npc_packs')
      .delete()
      .eq('entry_id', entryId);

    if (deleteError) {
      throw new Error(`Failed to clear existing NPC pack associations: ${deleteError.message}`);
    }

    // Insert new associations
    if (packIds.length > 0) {
      const associations = packIds.map(packId => ({
        entry_id: entryId,
        pack_id: packId
      }));

      const { error: insertError } = await supabase
        .from('entry_npc_packs')
        .insert(associations);

      if (insertError) {
        throw new Error(`Failed to create NPC pack associations: ${insertError.message}`);
      }
    }
  }

  /**
   * Get all ruleset associations for an entry
   */
  async getEntryRulesets(entryId: string): Promise<EntryRulesetLink[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('entry_rulesets')
      .select('*')
      .eq('entry_id', entryId)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch entry rulesets: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get all NPC associations for an entry
   */
  async getEntryNPCs(entryId: string): Promise<EntryNPCLink[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('entry_npcs')
      .select('*')
      .eq('entry_id', entryId);

    if (error) {
      throw new Error(`Failed to fetch entry NPCs: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get all NPC pack associations for an entry
   */
  async getEntryNPCPacks(entryId: string): Promise<EntryNPCPackLink[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('entry_npc_packs')
      .select('*')
      .eq('entry_id', entryId);

    if (error) {
      throw new Error(`Failed to fetch entry NPC packs: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Reorder rulesets for an entry
   */
  async reorderEntryRulesets(
    entryId: string, 
    rulesetIds: string[]
  ): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Update sort order for each ruleset
    const updates = rulesetIds.map((rulesetId, index) => 
      supabase
        .from('entry_rulesets')
        .update({ sort_order: index })
        .eq('entry_id', entryId)
        .eq('ruleset_id', rulesetId)
    );

    const results = await Promise.all(updates);
    
    for (const result of results) {
      if (result.error) {
        throw new Error(`Failed to reorder rulesets: ${result.error.message}`);
      }
    }
  }

  /**
   * Batch update all associations for an entry
   * This is the main method used by the entry editor
   */
  async updateEntryAssociations(
    entryId: string,
    associations: {
      rulesetIds?: string[];
      npcIds?: string[];
      packIds?: string[];
    }
  ): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const promises: Promise<void>[] = [];

    if (associations.rulesetIds !== undefined) {
      promises.push(this.updateEntryRulesets(entryId, associations.rulesetIds));
    }

    if (associations.npcIds !== undefined) {
      promises.push(this.updateEntryNPCs(entryId, associations.npcIds));
    }

    if (associations.packIds !== undefined) {
      promises.push(this.updateEntryNPCPacks(entryId, associations.packIds));
    }

    await Promise.all(promises);
  }
}

export const entryLinksService = new EntryLinksService();
