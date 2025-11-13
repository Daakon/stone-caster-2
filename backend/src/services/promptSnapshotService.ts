/**
 * Phase 5: Prompt Snapshot Service
 * Captures frozen prompt configurations at publish time
 */

import { supabaseAdmin } from './supabase.js';
import { EntryPointAssemblerV3, CORE_PROMPT } from '../prompts/entry-point-assembler-v3.js';
import type { PromptSnapshotData } from '@shared/types/publishing';
import { emitPublishingEvent } from '../telemetry/publishingTelemetry.js';

export interface CreateSnapshotParams {
  entityType: 'world' | 'story';
  entityId: string;
  approvedByUserId: string;
  sourcePublishRequestId?: string | null;
}

export interface SnapshotResult {
  snapshotId: string;
  version: number;
}

/**
 * Create a prompt snapshot for an entity at publish time
 * Resolves all prompt slices and media references, then stores them
 */
export async function createPromptSnapshotForEntity(
  params: CreateSnapshotParams
): Promise<SnapshotResult> {
  const { entityType, entityId, approvedByUserId, sourcePublishRequestId } = params;

  // For now, only stories are supported (worlds can be added later)
  if (entityType !== 'story') {
    throw new Error(`Snapshot creation for ${entityType} not yet implemented`);
  }

  // Load entry point (story) - Phase 5: Include cover_media_id for snapshot
  const { data: entryPoint, error: entryPointError } = await supabaseAdmin
    .from('entry_points')
    .select('id, slug, type, world_id, prompt, doc, cover_media_id')
    .eq('id', entityId)
    .single();

  if (entryPointError || !entryPoint) {
    throw new Error(`Entry point '${entityId}' not found`);
  }

  // Load world
  const worldId = entryPoint.world_id;
  if (!worldId) {
    throw new Error(`Entry point '${entityId}' has no world_id`);
  }

  // Resolve world UUID if needed
  let worldUuidId: string = worldId;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(worldId)) {
    const { data: worldMapping } = await supabaseAdmin
      .from('world_id_mapping')
      .select('uuid_id')
      .eq('text_id', worldId)
      .single();
    worldUuidId = worldMapping?.uuid_id || worldId;
  }

  const { data: world, error: worldError } = await supabaseAdmin
    .from('worlds')
    .select('id, version, doc')
    .or(`id.eq.${worldId},doc->>slug.eq.${worldId}`)
    .eq('status', 'active')
    .maybeSingle();

  if (worldError || !world) {
    throw new Error(`World '${worldId}' not found or not active`);
  }

  // Load default ruleset for entry point
  const { data: rulesetBinding } = await supabaseAdmin
    .from('entry_point_rulesets')
    .select('rulesets:ruleset_id (id, slug, version, doc)')
    .eq('entry_point_id', entityId)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!rulesetBinding || !(rulesetBinding as any).rulesets) {
    throw new Error(`No ruleset found for entry point '${entityId}'`);
  }

  const ruleset = (rulesetBinding as any).rulesets;

  // Use assembler to resolve prompts (reuse existing logic)
  const assembler = new EntryPointAssemblerV3();
  
  // Extract prompts using assembler's extraction methods
  // Access private methods via type casting (they're private but we need them)
  const corePrompt = CORE_PROMPT;

  // Extract ruleset prompt (reuse assembler's logic)
  const rulesetPrompt = (assembler as any).extractRulesetPrompt(ruleset.doc || {});

  // Extract world prompt (reuse assembler's logic)
  const worldPrompt = (assembler as any).extractWorldPrompt(world.doc || {});

  // Extract story/entry prompt
  // Entry point prompt can be in prompt field or doc.prompt
  // Use assembler's logic to extract entry prompt (similar to how it's done in assemble())
  const entryPromptDoc = entryPoint.doc || {};
  const entryPromptText = entryPromptDoc.prompt?.text ||
                          entryPromptDoc.prompt ||
                          entryPoint.prompt?.text ||
                          entryPoint.prompt ||
                          `# Entry: ${entryPoint.slug}\n\nBegin your adventure here.`;
  const storyPrompt = typeof entryPromptText === 'string' 
    ? entryPromptText 
    : JSON.stringify(entryPromptText);

  // Resolve media references
  const coverMediaId = entryPoint.cover_media_id || null;

  // Load gallery media links (only approved and ready)
  const { data: galleryLinks } = await supabaseAdmin
    .from('media_links')
    .select('media_id, media_assets:media_id (id, status, image_review_status)')
    .eq('story_id', entityId)
    .order('sort_order', { ascending: true });

  const galleryMediaIds: string[] = [];
  if (galleryLinks) {
    for (const link of galleryLinks) {
      const media = (link as any).media_assets;
      if (
        media &&
        media.status === 'ready' &&
        media.image_review_status === 'approved'
      ) {
        galleryMediaIds.push(media.id);
      }
    }
  }

  // Extract mechanics and relationship config from world/ruleset
  const mechanics = extractMechanics(world.doc || {}, ruleset.doc || {});
  const relationshipConfig = extractRelationshipConfig(world.doc || {}, ruleset.doc || {});

  // Compute next version
  const { data: existingSnapshots } = await supabaseAdmin
    .from('prompt_snapshots')
    .select('version')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('version', { ascending: false })
    .limit(1);

  const nextVersion = existingSnapshots && existingSnapshots.length > 0
    ? (existingSnapshots[0] as any).version + 1
    : 1;

  // Build snapshot data
  const snapshotData: PromptSnapshotData = {
    schemaVersion: 1, // Phase 5 refinement: Schema version for future-proofing
    corePrompt,
    rulesetPrompt,
    worldPrompt,
    storyPrompt,
    mechanics,
    relationshipConfig,
    coverMediaId: coverMediaId || undefined,
    coverMediaVariant: 'card', // Phase 5 refinement: Freeze variant at snapshot time
    galleryMediaIds: galleryMediaIds.length > 0 ? galleryMediaIds : undefined,
  };

  // Insert snapshot
  const { data: snapshot, error: insertError } = await supabaseAdmin
    .from('prompt_snapshots')
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      version: nextVersion,
      created_by: approvedByUserId,
      source_publish_request_id: sourcePublishRequestId || null,
      data: snapshotData,
    })
    .select('id, version')
    .single();

  if (insertError || !snapshot) {
    // Phase 5 refinement: Explicit error with consistent code for telemetry
    const errorMessage = insertError?.message || 'Unknown error';
    console.error(`[snapshot.create_failed] entityType=${entityType}, entityId=${entityId}, error=${errorMessage}`);
    throw new Error(`Failed to create prompt snapshot: ${errorMessage}`);
  }

  // Emit telemetry with correlation IDs
  emitPublishingEvent('publish.snapshot_created', {
    entity_type: entityType,
    entity_id: entityId,
    snapshot_id: snapshot.id,
    version: snapshot.version,
    prompt_snapshot_id: snapshot.id, // Phase 5 refinement: explicit field for correlation
    source_publish_request_id: sourcePublishRequestId || undefined, // Phase 5 refinement: correlation with publish event
  });

  return {
    snapshotId: snapshot.id,
    version: snapshot.version,
  };
}

/**
 * Helper to extract ruleset prompt text
 */
function extractRulesetPrompt(rulesetDoc: Record<string, any>): string {
  // Extract from ruleset.doc.prompt.text or similar structure
  return rulesetDoc.prompt?.text || 
         rulesetDoc.prompt || 
         rulesetDoc.rules || 
         '# Ruleset\n\nNo ruleset prompt available.';
}

/**
 * Helper to extract world prompt text
 */
function extractWorldPrompt(worldDoc: Record<string, any>): string {
  // Extract from world.doc.prompt.text or similar structure
  return worldDoc.prompt?.text || 
         worldDoc.prompt || 
         worldDoc.description || 
         '# World\n\nNo world prompt available.';
}

/**
 * Helper to extract story/entry prompt text
 */
function extractStoryPrompt(entryPromptOrDoc: Record<string, any> | string): string {
  if (typeof entryPromptOrDoc === 'string') {
    return entryPromptOrDoc;
  }
  // Extract from entry point prompt structure
  return entryPromptOrDoc.prompt?.text || 
         entryPromptOrDoc.prompt || 
         entryPromptOrDoc.text || 
         '# Story\n\nBegin your adventure here.';
}

/**
 * Helper to extract mechanics config
 */
function extractMechanics(worldDoc: Record<string, any>, rulesetDoc: Record<string, any>): Record<string, unknown> {
  return {
    ...(worldDoc.mechanics || {}),
    ...(rulesetDoc.mechanics || {}),
  };
}

/**
 * Helper to extract relationship config
 */
function extractRelationshipConfig(worldDoc: Record<string, any>, rulesetDoc: Record<string, any>): Record<string, unknown> {
  return {
    ...(worldDoc.relationshipConfig || {}),
    ...(rulesetDoc.relationshipConfig || {}),
  };
}

/**
 * Get the latest snapshot for an entity
 */
export async function getLatestSnapshot(
  entityType: 'world' | 'story',
  entityId: string
): Promise<{ id: string; version: number; data: PromptSnapshotData } | null> {
  const { data, error } = await supabaseAdmin
    .from('prompt_snapshots')
    .select('id, version, data')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    version: (data as any).version,
    data: (data as any).data as PromptSnapshotData,
  };
}

/**
 * Get a snapshot by ID
 */
export async function getSnapshotById(
  snapshotId: string
): Promise<{ id: string; version: number; data: PromptSnapshotData; entity_type: string; entity_id: string } | null> {
  const { data, error } = await supabaseAdmin
    .from('prompt_snapshots')
    .select('id, version, data, entity_type, entity_id')
    .eq('id', snapshotId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    version: (data as any).version,
    data: (data as any).data as PromptSnapshotData,
    entity_type: (data as any).entity_type,
    entity_id: (data as any).entity_id,
  };
}

