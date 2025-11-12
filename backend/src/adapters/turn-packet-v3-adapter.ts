/**
 * TurnPacketV3 Adapter
 * Wraps existing AWF/V3 prompt builders to create TurnPacketV3 structure
 */

import type { TurnPacketV3 } from '../types/turn-packet-v3.js';
import { renderSlotsForPack, type SlotPack } from '../slots/render-db.js';
import type { EntryPointAssemblerV3Output } from '../prompts/entry-point-assembler-v3.js';

/**
 * Extract core style/safety/output_rules from system prompt text
 */
function extractCoreFromSystemPrompt(systemPrompt: string): {
  style?: string;
  safety: string[];
  output_rules?: string;
} {
  const safety: string[] = [];
  let output_rules: string | undefined;
  let style: string | undefined;

  // Extract output rules (look for JSON format instructions)
  const outputMatch = systemPrompt.match(/Return\s+exactly\s+one\s+JSON\s+object[^.]*\./i);
  if (outputMatch) {
    output_rules = outputMatch[0];
  }

  // Extract safety guidelines (look for safety-related keywords)
  if (systemPrompt.includes('safety') || systemPrompt.includes('guardrails')) {
    safety.push('guardrails_enabled');
  }
  if (systemPrompt.includes('consent')) {
    safety.push('consent_required');
  }

  // Extract style (look for narrative style instructions)
  if (systemPrompt.includes('immersive') || systemPrompt.includes('cinematic')) {
    style = 'immersive';
  }

  return {
    style,
    safety,
    output_rules,
  };
}

/**
 * Preview overrides (non-persisting)
 */
export interface TurnPacketV3Overrides {
  moduleParamsOverrides?: Record<string /* moduleId */, Record<string, unknown>>;
  extrasOverrides?: {
    world?: Record<string, unknown>;
    ruleset?: Record<string, unknown>;
    scenario?: Record<string, unknown>;
    npcs?: Record<string /* npcId */, Record<string, unknown>>;
  };
}

/**
 * Build TurnPacketV3 from V3 Entry-Point Assembler output
 */
export async function buildTurnPacketV3FromV3(
  v3Output: EntryPointAssemblerV3Output,
  systemPrompt: string,
  stateSnapshot?: any,
  userIntentText?: string,
  buildId?: string,
  templatesVersion?: number,
  overrides?: TurnPacketV3Overrides
): Promise<TurnPacketV3> {
  const core = extractCoreFromSystemPrompt(systemPrompt);

  // Load extras from database
  const { supabaseAdmin } = await import('../services/supabase.js');
  
  // Load ruleset extras
  let rulesetExtras: Record<string, unknown> | null = null;
  try {
    const { data: rulesetData } = await supabaseAdmin
      .from('rulesets')
      .select('extras')
      .eq('id', v3Output.meta.rulesetSlug)
      .single();
    if (rulesetData?.extras) {
      rulesetExtras = rulesetData.extras as Record<string, unknown>;
    }
  } catch (err) {
    // Silently fail - extras are optional
  }

  // Apply extras overrides (preview only, non-persisting)
  if (overrides?.extrasOverrides?.ruleset) {
    rulesetExtras = {
      ...(rulesetExtras || {}),
      ...overrides.extrasOverrides.ruleset,
    };
  }

  // Load world extras (handle UUID mapping)
  let worldExtras: Record<string, unknown> | null = null;
  try {
    let worldId = v3Output.meta.worldId;
    // Check if worldId is UUID and needs mapping
    if (worldId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      const { data: mapping } = await supabaseAdmin
        .from('world_id_mapping')
        .select('text_id')
        .eq('uuid_id', worldId)
        .single();
      if (mapping) {
        worldId = mapping.text_id;
      }
    }
    const { data: worldData } = await supabaseAdmin
      .from('worlds')
      .select('extras')
      .eq('id', worldId)
      .single();
    if (worldData?.extras) {
      worldExtras = worldData.extras as Record<string, unknown>;
    }
  } catch (err) {
    // Silently fail - extras are optional
  }

  // Apply extras overrides (preview only, non-persisting)
  if (overrides?.extrasOverrides?.world) {
    worldExtras = {
      ...(worldExtras || {}),
      ...overrides.extrasOverrides.world,
    };
  }

  // Build ruleset pack for slot rendering
  const rulesetPack: SlotPack = {
    type: 'ruleset',
    id: v3Output.meta.rulesetSlug,
    version: '1.0.0', // V3 doesn't expose ruleset version, use default
    data: {
      ruleset: {
        id: v3Output.meta.rulesetSlug,
        slug: v3Output.meta.rulesetSlug,
        // Add any ruleset data from doc if available
      },
      ...(rulesetExtras ? { extras: rulesetExtras } : {}),
    },
  };

  // Build world pack for slot rendering
  const worldPack: SlotPack = {
    type: 'world',
    id: v3Output.meta.worldId,
    version: '1.0.0', // V3 doesn't expose world version, use default
    data: {
      world: {
        id: v3Output.meta.worldId,
        slug: v3Output.meta.worldSlug,
        name: v3Output.meta.worldSlug,
      },
      ...(worldExtras ? { extras: worldExtras } : {}),
    },
  };

  // Render slots (with optional templatesVersion from env)
  const envTemplatesVersion = process.env.TEMPLATES_VERSION 
    ? parseInt(process.env.TEMPLATES_VERSION, 10)
    : undefined;
  
  // Use parameter templatesVersion if provided, otherwise fall back to env
  const effectiveTemplatesVersion = templatesVersion ?? envTemplatesVersion;
  const rulesetSlots = await renderSlotsForPack(rulesetPack, { templatesVersion: effectiveTemplatesVersion });
  const worldSlots = await renderSlotsForPack(worldPack, { templatesVersion: effectiveTemplatesVersion });

  // Build NPC packs (if any NPCs are present)
  const npcPacks: SlotPack[] = [];
  // Note: V3 output doesn't expose NPC details directly, so we'll leave npcs empty for now
  // This can be enhanced later when NPC data is available

  // Compute scenario reachability if scenario is present
  let scenarioReachability: { reachableNodes: string[] } | undefined;
  if (v3Output.meta.scenarioSlug) {
    try {
      const { getGraph, reachableNodes: computeReachable } = await import('../services/scenario-graph.service.js');
      const guardEval = await import('../services/guard-eval.js');
      
      const graph = await getGraph(v3Output.meta.scenarioSlug);
      if (graph) {
        // Build guard context from state snapshot
        const ctx: guardEval.GuardContext = {
          rel: stateSnapshot?.rel || {},
          inv: stateSnapshot?.inv || {},
          currency: stateSnapshot?.currency || {},
          flag: stateSnapshot?.flag || {},
          state: stateSnapshot?.state || {},
        };
        
        const reachable = computeReachable(graph, ctx);
        scenarioReachability = { reachableNodes: reachable };
      }
    } catch (error) {
      console.warn('[turn-packet-v3] Failed to compute scenario reachability:', error);
      // Continue without reachability
    }
  }

  // Load and render modules if entry point is present
  const modules: Array<{
    id: string;
    version: string;
    params: Record<string, unknown> | null;
    slots: Record<string, string>;
    state: Record<string, unknown> | null;
  }> = [];
  
  if (v3Output.meta.entryPointId) {
    try {
      const Mustache = (await import('mustache')).default;
      
      // Load attached modules with params
      const { data: storyModules, error: modulesError } = await supabaseAdmin
        .from('story_modules')
        .select(`
          module_id,
          params,
          modules (*)
        `)
        .eq('story_id', v3Output.meta.entryPointId);

      if (!modulesError && storyModules && storyModules.length > 0) {
        // Load module params service for getting merged params
        const { getModuleParams, getModuleParamsDef } = await import('../services/module-params.service.js');
        
        for (const row of storyModules) {
          const module = (row as any).modules;
          if (!module) continue;

          // Get story params (or use overrides for preview)
          let storyParams: Record<string, unknown> | null = row.params as Record<string, unknown> | null;
          const hasOverride = overrides?.moduleParamsOverrides?.[module.id];
          
          if (hasOverride) {
            // Preview override: use override instead of DB
            storyParams = overrides.moduleParamsOverrides[module.id];
          }

          // Get params definition for merging
          const paramsDef = await getModuleParamsDef(module.id);
          
          // Merge params (defaults + story/override)
          let mergedParams: Record<string, unknown> | null = null;
          if (hasOverride) {
            // Preview override: merge with defaults
            const defaults = paramsDef?.defaults || {};
            mergedParams = {
              ...defaults,
              ...storyParams,
            };
          } else if (storyParams) {
            // Normal flow: merge story params with defaults
            const defaults = paramsDef?.defaults || {};
            mergedParams = {
              ...defaults,
              ...storyParams,
            };
          } else {
            // No story params: use defaults only (or load from DB for normal flow)
            if (v3Output.meta.entryPointId && v3Output.meta.entryPointId !== 'preview-entry') {
              mergedParams = await getModuleParams(v3Output.meta.entryPointId, module.id);
            } else {
              mergedParams = paramsDef?.defaults || null;
            }
          }

          // Render module slots using Mustache
          const moduleSlots: Record<string, string> = {};
          
          // Render module.hints slot with params-aware content
          let hintsTemplate = `Mechanic: {{title}}. {{#ai_hints}}{{.}} {{/ai_hints}}`;
          if (mergedParams && paramsDef) {
            // Build concise hint from key params
            const hintParts: string[] = [];
            
            // Relationships-specific hints
            if (mergedParams.gainCurve?.scale !== undefined) {
              hintParts.push(`Gains scale ${mergedParams.gainCurve.scale}`);
            }
            if (mergedParams.minTrustToRomance !== undefined) {
              hintParts.push(`romance gated at trust ≥ ${mergedParams.minTrustToRomance}`);
            }
            if (mergedParams.consent?.requireMutual) {
              hintParts.push('respect consent');
            }
            
            if (hintParts.length > 0) {
              hintsTemplate = `Mechanic: {{title}}. ${hintParts.join('; ')}. {{#ai_hints}}{{.}} {{/ai_hints}}`;
            }
          }
          
          const hintsContext = {
            title: module.title,
            ai_hints: module.ai_hints || [],
            params: mergedParams || {},
          };
          moduleSlots['module.hints'] = Mustache.render(hintsTemplate, hintsContext).trim();

          // Render module.actions slot
          const actionsTemplate = `{{#exports.actions}}{{type}}; {{/exports.actions}}`;
          const actionsContext = {
            exports: {
              actions: (module.exports as any)?.actions || [],
            },
          };
          moduleSlots['module.actions'] = Mustache.render(actionsTemplate, actionsContext).trim();

          modules.push({
            id: module.id,
            version: String(module.version),
            params: hasOverride ? storyParams : (storyParams || null), // Use override or story params (null if absent)
            slots: moduleSlots,
            state: null,
          });
        }
      }
    } catch (error) {
      console.warn('[turn-packet-v3] Failed to load modules:', error);
      // Continue without modules
    }
  }

  const tp: TurnPacketV3 = {
    tp_version: '3',
    contract: 'awf.v1',
    core,
    ruleset: {
      id: v3Output.meta.rulesetSlug,
      version: '1.0.0',
      slots: rulesetSlots,
    },
    modules,
    world: {
      id: v3Output.meta.worldId,
      version: '1.0.0',
      slots: worldSlots,
    },
    scenario: v3Output.meta.scenarioSlug ? {
      id: v3Output.meta.scenarioSlug,
      version: '1.0.0',
      slots: {}, // Scenario slots would be rendered here if needed
      ...(scenarioReachability ? { reachability: scenarioReachability } : {}),
    } : undefined,
    npcs: [],
    state: stateSnapshot || {},
    input: {
      kind: 'choice',
      text: userIntentText || '',
    },
    meta: {
      budgets: {
        max_ctx_tokens: v3Output.meta.tokenEst.budget,
      },
      buildId,
    },
  };

  return tp;
}

/**
 * Build TurnPacketV3 from AWF Bundle
 */
export async function buildTurnPacketV3FromAWF(
  awfBundle: any,
  systemPrompt: string,
  inputText: string,
  buildId?: string
): Promise<TurnPacketV3> {
  const core = extractCoreFromSystemPrompt(systemPrompt);

  // Extract ruleset info from bundle
  const rulesetId = awfBundle?.core?.ruleset?.ruleset?.name || 'unknown';
  const rulesetVersion = '1.0.0'; // AWF bundle doesn't expose version

  // Build ruleset pack
  const rulesetPack: SlotPack = {
    type: 'ruleset',
    id: rulesetId,
    version: rulesetVersion,
    data: {
      ruleset: awfBundle?.core?.ruleset || {},
    },
  };

  // Extract world info from bundle
  const worldRef = awfBundle?.world?.ref || 'unknown';
  const worldVersion = '1.0.0';

  // Build world pack
  const worldPack: SlotPack = {
    type: 'world',
    id: worldRef,
    version: worldVersion,
    data: {
      world: {
        id: worldRef,
        name: worldRef,
        ...awfBundle?.world?.doc,
      },
    },
  };

  // Render slots (use provided templatesVersion or fallback to env)
  const versionToUse = templatesVersion ?? (process.env.TEMPLATES_VERSION 
    ? parseInt(process.env.TEMPLATES_VERSION, 10)
    : undefined);
  const rulesetSlots = await renderSlotsForPack(rulesetPack, { templatesVersion: versionToUse });
  const worldSlots = await renderSlotsForPack(worldPack, { templatesVersion: versionToUse });

  // Build NPC packs from bundle
  const npcPacks: SlotPack[] = [];
  const npcs = awfBundle?.npcs?.active || [];
  for (const npc of npcs) {
    const npcPack: SlotPack = {
      type: 'npc',
      id: npc.id,
      name: npc.name,
      data: {
        npc: {
          id: npc.id,
          name: npc.name,
          description: npc.description,
          role: npc.role,
          ...npc.metadata,
        },
      },
    };
    npcPacks.push(npcPack);
  }

  // Render NPC slots
  const npcsWithSlots = await Promise.all(
    npcPacks.map(async npcPack => {
      const slots = await renderSlotsForPack(npcPack, { templatesVersion: versionToUse });
      return {
        id: npcPack.id!,
        name: npcPack.name!,
        slots,
      };
    })
  );

  const tp: TurnPacketV3 = {
    tp_version: '3',
    contract: 'awf.v1',
    core,
    ruleset: {
      id: rulesetId,
      version: rulesetVersion,
      slots: rulesetSlots,
    },
    modules: [],
    world: {
      id: worldRef,
      version: worldVersion,
      slots: worldSlots,
    },
    npcs: npcsWithSlots,
    state: awfBundle?.game_state || {},
    input: {
      kind: 'choice',
      text: inputText,
    },
    meta: {
      budgets: {
        max_ctx_tokens: awfBundle?.meta?.token_budget?.input_max,
      },
      seed: awfBundle?.rng?.seed,
      buildId,
    },
  };

  return tp;
}

