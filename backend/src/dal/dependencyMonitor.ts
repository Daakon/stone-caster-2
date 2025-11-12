/**
 * Dependency Monitor Data Access Layer
 * Phase 4: Auto-maintain dependency_invalid flags for stories/NPCs
 */

import { supabaseAdmin } from '../services/supabase.js';
import { isWorldApprovedPublic, deriveDependencyInvalidFromWorld } from '../utils/publishing.js';
import { emitPublishingEvent } from '../telemetry/publishingTelemetry.js';

/**
 * Batch update dependency_invalid flags for stories and NPCs linked to a world
 * Only updates rows where the flag differs from the desired state
 */
export async function markDependenciesForWorld(params: {
  worldId: string;
  dependencyInvalid: boolean;
  limit?: number;
}): Promise<{ storiesUpdated: number; npcsUpdated: number }> {
  const { worldId, dependencyInvalid, limit = 5000 } = params;

  let storiesUpdated = 0;
  let npcsUpdated = 0;

  // Update entry_points (stories) in batches
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    // Fetch stories that need updating (where dependency_invalid differs)
    const { data: stories, error: storiesError } = await supabaseAdmin
      .from('entry_points')
      .select('id, dependency_invalid')
      .eq('world_id', worldId)
      .neq('dependency_invalid', dependencyInvalid)
      .range(offset, offset + limit - 1);

    if (storiesError) {
      console.error('[dependencyMonitor] Error fetching stories:', storiesError);
      break;
    }

    if (!stories || stories.length === 0) {
      hasMore = false;
    } else {
      // Update in batch
      const storyIds = stories.map((s) => s.id);
      const { error: updateError } = await supabaseAdmin
        .from('entry_points')
        .update({ dependency_invalid: dependencyInvalid })
        .in('id', storyIds);

      if (updateError) {
        console.error('[dependencyMonitor] Error updating stories:', updateError);
        break;
      }

      storiesUpdated += storyIds.length;

      // Write audit rows for cleared dependencies
      if (!dependencyInvalid) {
        // Only audit when clearing (invalid → valid)
        for (const storyId of storyIds) {
          await supabaseAdmin
            .from('publishing_audit')
            .insert({
              entity_type: 'story',
              entity_id: storyId,
              action: 'auto-clear',
            })
            .catch((err) => {
              // Don't fail if audit write fails
              console.error('[dependencyMonitor] Failed to write audit for story:', err);
            });
          
          // Phase 5: Emit telemetry event
          emitPublishingEvent('dependency.invalid.cleared', {
            type: 'story',
            id: storyId,
            worldId,
          });
        }
      } else {
        // Phase 5: Emit telemetry event when setting invalid
        for (const storyId of storyIds) {
          emitPublishingEvent('dependency.invalid.set', {
            type: 'story',
            id: storyId,
            worldId,
          });
        }
      }

      if (stories.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }
    }
  }

  // Update NPCs in batches
  offset = 0;
  hasMore = true;

  while (hasMore) {
    // Fetch NPCs that need updating
    const { data: npcs, error: npcsError } = await supabaseAdmin
      .from('npcs')
      .select('id, dependency_invalid')
      .eq('world_id', worldId)
      .neq('dependency_invalid', dependencyInvalid)
      .range(offset, offset + limit - 1);

    if (npcsError) {
      console.error('[dependencyMonitor] Error fetching NPCs:', npcsError);
      break;
    }

    if (!npcs || npcs.length === 0) {
      hasMore = false;
    } else {
      // Update in batch
      const npcIds = npcs.map((n) => n.id);
      const { error: updateError } = await supabaseAdmin
        .from('npcs')
        .update({ dependency_invalid: dependencyInvalid })
        .in('id', npcIds);

      if (updateError) {
        console.error('[dependencyMonitor] Error updating NPCs:', updateError);
        break;
      }

      npcsUpdated += npcIds.length;

      // Write audit rows for cleared dependencies
      if (!dependencyInvalid) {
        // Only audit when clearing (invalid → valid)
        for (const npcId of npcIds) {
          await supabaseAdmin
            .from('publishing_audit')
            .insert({
              entity_type: 'npc',
              entity_id: npcId,
              action: 'auto-clear',
            })
            .catch((err) => {
              // Don't fail if audit write fails
              console.error('[dependencyMonitor] Failed to write audit for NPC:', err);
            });
          
          // Phase 5: Emit telemetry event
          emitPublishingEvent('dependency.invalid.cleared', {
            type: 'npc',
            id: npcId,
            worldId,
          });
        }
      } else {
        // Phase 5: Emit telemetry event when setting invalid
        for (const npcId of npcIds) {
          emitPublishingEvent('dependency.invalid.set', {
            type: 'npc',
            id: npcId,
            worldId,
          });
        }
      }

      if (npcs.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }
    }
  }

  return { storiesUpdated, npcsUpdated };
}

/**
 * Recompute dependency flags for all stories/NPCs linked to a world
 * Reads world status and updates dependency_invalid accordingly
 */
export async function recomputeDependenciesForWorld(params: {
  worldId: string;
}): Promise<{ storiesUpdated: number; npcsUpdated: number }> {
  const { worldId } = params;

  // Fetch world
  const { data: world, error } = await supabaseAdmin
    .from('worlds')
    .select('id, visibility, review_state')
    .eq('id', worldId)
    .single();

  if (error || !world) {
    throw {
      code: 'WORLD_NOT_FOUND',
      message: `World ${worldId} not found`,
    };
  }

  // Compute desired dependency_invalid flag
  const dependencyInvalid = deriveDependencyInvalidFromWorld(world);

  // Update all linked stories and NPCs
  return await markDependenciesForWorld({
    worldId,
    dependencyInvalid,
  });
}

/**
 * Recompute dependency flags for all worlds
 * Processes worlds in batches with optional concurrency control
 */
export async function recomputeDependenciesForAllWorlds(params?: {
  concurrency?: number;
  batch?: number;
}): Promise<{
  worldsProcessed: number;
  storiesUpdated: number;
  npcsUpdated: number;
}> {
  const { concurrency = 4, batch = 1000 } = params || {};

  let worldsProcessed = 0;
  let totalStoriesUpdated = 0;
  let totalNpcsUpdated = 0;

  // Fetch all worlds in batches
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: worlds, error } = await supabaseAdmin
      .from('worlds')
      .select('id, visibility, review_state')
      .range(offset, offset + batch - 1);

    if (error) {
      console.error('[dependencyMonitor] Error fetching worlds:', error);
      break;
    }

    if (!worlds || worlds.length === 0) {
      hasMore = false;
      break;
    }

    // Process worlds with concurrency limit
    const worldChunks: typeof worlds[] = [];
    for (let i = 0; i < worlds.length; i += concurrency) {
      worldChunks.push(worlds.slice(i, i + concurrency));
    }

    for (const chunk of worldChunks) {
      const results = await Promise.all(
        chunk.map(async (world) => {
          try {
            const result = await recomputeDependenciesForWorld({ worldId: world.id });
            return { success: true, result };
          } catch (error) {
            console.error(`[dependencyMonitor] Error recomputing world ${world.id}:`, error);
            return { success: false, result: { storiesUpdated: 0, npcsUpdated: 0 } };
          }
        })
      );

      for (const { result } of results) {
        worldsProcessed++;
        totalStoriesUpdated += result.storiesUpdated;
        totalNpcsUpdated += result.npcsUpdated;
      }
    }

    if (worlds.length < batch) {
      hasMore = false;
    } else {
      offset += batch;
    }
  }

  return {
    worldsProcessed,
    storiesUpdated: totalStoriesUpdated,
    npcsUpdated: totalNpcsUpdated,
  };
}

