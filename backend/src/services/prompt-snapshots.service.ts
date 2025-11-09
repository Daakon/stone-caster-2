/**
 * Prompt Snapshots Service
 * Handles persistence and retrieval of raw prompt snapshots
 */

import { supabaseAdmin } from './supabase.js';
import type { TurnPacketV3 } from '../types/turn-packet-v3.js';
import { TurnPacketV3Schema } from '../validators/turn-packet-v3.schema.js';
import { randomUUID } from 'crypto';

export interface BudgetReport {
  version: number; // Format version for future-proofing
  before: number;
  after: number;
  trims: Array<{ key: string; removedChars: number; removedTokens: number }>;
  warnings: string[];
}

export interface PromptSnapshot {
  id: string;
  snapshot_id: string;
  templates_version?: string;
  pack_versions: Record<string, string>;
  tp: TurnPacketV3;
  linearized_prompt_text: string;
  awf_contract: string;
  source: 'auto' | 'manual';
  created_at: string;
  created_by?: string;
  game_id?: string;
  turn_id?: string;
  budget_report?: BudgetReport;
}

export interface CreateSnapshotParams {
  templates_version?: string;
  pack_versions?: Record<string, string>;
  tp: TurnPacketV3;
  linearized_prompt_text: string;
  awf_contract?: string;
  source?: 'auto' | 'manual';
  created_by?: string;
  game_id?: string;
  turn_id?: string;
  parent_id?: string;
  budget_report?: BudgetReport;
}

export interface OverrideSnapshotParams {
  tp: TurnPacketV3;
  linearized_prompt_text: string;
  created_by?: string;
}

/**
 * Create a new prompt snapshot
 */
export async function createPromptSnapshot(
  params: CreateSnapshotParams
): Promise<PromptSnapshot> {
  // Validate TurnPacketV3
  const validatedTp = TurnPacketV3Schema.parse(params.tp);

  const snapshotId = randomUUID();
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('prompt_snapshots')
    .insert({
      snapshot_id: snapshotId,
      templates_version: params.templates_version || null,
      pack_versions: params.pack_versions || {},
      tp: validatedTp,
      linearized_prompt_text: params.linearized_prompt_text,
      awf_contract: params.awf_contract || 'awf.v1',
      source: params.source || 'auto',
      created_by: params.created_by || null,
      game_id: params.game_id || null,
      turn_id: params.turn_id || null,
      parent_id: params.parent_id || null,
      budget_report: params.budget_report || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create prompt snapshot: ${error.message}`);
  }

  return {
    id: data.id,
    snapshot_id: data.snapshot_id,
    templates_version: data.templates_version || undefined,
    pack_versions: (data.pack_versions as Record<string, string>) || {},
    tp: data.tp as TurnPacketV3,
    linearized_prompt_text: data.linearized_prompt_text,
    awf_contract: data.awf_contract,
    source: data.source as 'auto' | 'manual',
    created_at: data.created_at,
    created_by: data.created_by || undefined,
    game_id: data.game_id || undefined,
    turn_id: data.turn_id || undefined,
    budget_report: data.budget_report as BudgetReport | undefined,
  };
}

/**
 * Get a prompt snapshot by snapshot_id
 */
export async function getPromptSnapshot(
  snapshotId: string
): Promise<PromptSnapshot | null> {
  const { data, error } = await supabaseAdmin
    .from('prompt_snapshots')
    .select('*')
    .eq('snapshot_id', snapshotId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get prompt snapshot: ${error.message}`);
  }

  return {
    id: data.id,
    snapshot_id: data.snapshot_id,
    templates_version: data.templates_version || undefined,
    pack_versions: (data.pack_versions as Record<string, string>) || {},
    tp: data.tp as TurnPacketV3,
    linearized_prompt_text: data.linearized_prompt_text,
    awf_contract: data.awf_contract,
    source: data.source as 'auto' | 'manual',
    created_at: data.created_at,
    created_by: data.created_by || undefined,
    game_id: data.game_id || undefined,
    turn_id: data.turn_id || undefined,
    budget_report: data.budget_report as BudgetReport | undefined,
  };
}

/**
 * Create a manual override snapshot (new snapshot with source='manual')
 */
export async function createManualOverrideSnapshot(
  originalSnapshotId: string,
  params: OverrideSnapshotParams
): Promise<PromptSnapshot> {
  // Get original snapshot to copy metadata
  const original = await getPromptSnapshot(originalSnapshotId);
  if (!original) {
    throw new Error(`Original snapshot ${originalSnapshotId} not found`);
  }

  // Validate TurnPacketV3
  const validatedTp = TurnPacketV3Schema.parse(params.tp);

  // Create new snapshot with source='manual'
  return createPromptSnapshot({
    templates_version: original.templates_version,
    pack_versions: original.pack_versions,
    tp: validatedTp,
    linearized_prompt_text: params.linearized_prompt_text,
    awf_contract: original.awf_contract,
    source: 'manual',
    created_by: params.created_by,
    game_id: original.game_id,
    turn_id: original.turn_id,
  });
}

