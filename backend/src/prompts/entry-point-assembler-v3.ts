/**
 * Entry-Point Assembler v3
 * 
 * Assembles prompts exclusively from first-class gameplay entities:
 * - core: code-owned (always included)
 * - ruleset: from rulesets table (selected by entry point)
 * - world: from worlds table (linked via entry_points.world_id)
 * - entry: from entry_points (uses doc.entryStartSlug and optional doc.prompt.text)
 * - npc: from npcs linked via entry_point_npcs (ordered by sort_order)
 * 
 * Scope order: core → ruleset → world → entry → npc
 * No legacy prompt/segment usage.
 */

import { supabaseAdmin } from '../services/supabase.js';
import type { Scope, AssemblePiece, PolicyAction } from './assembler-types.js';
import {
  SCOPE_PRIORITY,
  PROTECTED_SCOPES,
  POLICY_ACTIONS,
} from './assembler-types.js';
import {
  roughTokenCount,
  getEnvNumber,
  getEnvPercentage,
  formatPieceId,
} from './assembler-utils.js';

// Environment configuration with fallbacks
const PROMPT_TOKEN_BUDGET_DEFAULT = getEnvNumber('PROMPT_TOKEN_BUDGET_DEFAULT', 8_000);
const PROMPT_BUDGET_WARN_PCT = getEnvPercentage('PROMPT_BUDGET_WARN_PCT', 0.9);

// Core prompt (code-owned, always included)
const CORE_PROMPT = `# RPG Storyteller AI System

## Core Rules

You are an AI Game Master. Generate immersive, consistent narrative responses.

- Follow the rules and guidelines provided below
- Maintain consistency with the established world and story
- Create engaging choices and consequences
- Respond in JSON format (AWF v1)

## Output Format

Return a single JSON object:

\`\`\`json
{
  "scn": {"id": "scene_id", "ph": "scene_phase"},
  "txt": "Narrative text describing what happens",
  "choices": [{"id": "choice_id", "label": "Choice text"}],
  "acts": [{"eid": "action_id", "t": "ACTION_TYPE", "payload": {}}],
  "val": {"ok": true, "errors": [], "repairs": []}
}
\`\`\`

Keep responses immersive and consistent with the world tone.
`;

export interface EntryPointAssemblerV3Input {
  entryPointId: string;
  entryStartSlug?: string; // Optional override from entry point doc
  model?: string;
  budgetTokens?: number;
  // For ongoing turns (not initialization)
  stateSnapshot?: any; // Current game state (JSON)
  conversationWindow?: Array<{
    turnNumber: number;
    narrative: string;
    userChoice?: string; // User's choice text from previous turn
  }>; // Last N turns for context (default: last 3)
  userIntentText?: string; // User's latest choice/text input
}

export interface EntryPointAssemblerV3Output {
  prompt: string;
  pieces: AssemblePiece[];
  meta: {
    included: string[];
    dropped: string[];
    policy?: string[];
    model: string;
    worldId: string;
    worldSlug: string;
    rulesetSlug: string;
    entryPointId: string;
    entryPointSlug: string;
    entryStartSlug: string;
    tokenEst: {
      input: number;
      budget: number;
      pct: number;
    };
    source: 'entry-point';
    version: 'v3';
    npcTrimmedCount: number;
    selectionContext: {
      worldId: string;
      worldSlug: string;
      entryPointId: string;
      entryStartSlug: string;
      rulesetSlug: string;
      npcCountBefore: number;
      npcCountAfter: number;
      budget: number;
      warnPct: number;
    };
  };
}

export class EntryPointAssemblerError extends Error {
  constructor(
    public readonly code: 
      | 'ENTRY_POINT_NOT_FOUND'
      | 'WORLD_NOT_ACTIVE'
      | 'RULESET_NOT_ALLOWED'
      | 'ENTRY_START_NOT_FOUND'
      | 'VALIDATION_FAILED',
    message: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'EntryPointAssemblerError';
  }
}

interface EntryPointData {
  id: string;
  slug: string;
  type: string;
  world_id: string;
  content: Record<string, any>;
}

interface WorldData {
  id: string;
  slug?: string;
  version: string;
  doc: Record<string, any>;
}

interface RulesetData {
  id: string;
  slug: string;
  version: string;
  doc: Record<string, any>;
}

interface NPCData {
  id: string;
  name: string;
  slug: string | null;
  prompt: Record<string, any> | null;
  doc: Record<string, any> | null;
}

interface EntryPointNPCBinding {
  npc_id: string;
  npc_slug: string | null;
  sort_order: number;
}

// Cache for static lookups (LRU with TTL)
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class SimpleLRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly ttl: number;

  constructor(ttlMs: number = 60_000) {
    this.ttl = ttlMs;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: T): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.ttl,
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

/**
 * Entry-Point Assembler v3
 * Reads from entry_points → worlds → rulesets → npcs only
 */
export class EntryPointAssemblerV3 {
  // Caches for performance (TTL: 60s)
  private readonly worldCache = new SimpleLRUCache<{ worldId: string; worldSlug: string }>();
  private readonly rulesetCache = new SimpleLRUCache<RulesetData>();
  private readonly npcListCache = new SimpleLRUCache<EntryPointNPCBinding[]>();

  /**
   * Assemble prompt from entry point and its linked entities
   */
  async assemble(input: EntryPointAssemblerV3Input): Promise<EntryPointAssemblerV3Output> {
    const assembleStartTime = Date.now();

    // Structured log: assemble start
    console.log(JSON.stringify({
      event: 'v3.assemble.start',
      entryPointId: input.entryPointId,
    }));

    try {
      // 1. Load entry point
      const entryPoint = await this.loadEntryPoint(input.entryPointId);
      if (!entryPoint) {
        throw new EntryPointAssemblerError(
          'ENTRY_POINT_NOT_FOUND',
          `Entry point '${input.entryPointId}' not found or not active`,
          { entryPointId: input.entryPointId }
        );
      }

      // 2. Load world (with cache and active check)
      const world = await this.loadWorld(entryPoint.world_id);
      if (!world) {
        throw new EntryPointAssemblerError(
          'WORLD_NOT_ACTIVE',
          `World '${entryPoint.world_id}' not found or not active`,
          { worldId: entryPoint.world_id }
        );
      }

      // 3. Load ruleset (default first, then by sort_order)
      const { ruleset, multipleDefaults } = await this.loadDefaultRulesetForEntryPoint(input.entryPointId);
      if (!ruleset) {
        throw new EntryPointAssemblerError(
          'RULESET_NOT_ALLOWED',
          `No default ruleset found for entry point '${input.entryPointId}'`,
          { entryPointId: input.entryPointId }
        );
      }

      // Track multiple defaults in policy (will be added to final policy array)
      const hasMultipleDefaults = multipleDefaults;

      // 4. Load NPCs (from entry_point_npcs, ordered by sort_order ASC, npc_slug ASC)
      const npcBindings = await this.loadEntryPointNPCs(input.entryPointId);
      const npcs = await this.loadNPCs(npcBindings.map(b => b.npc_id));
      const npcCountBefore = npcs.length;

    // 5. Extract entry start slug (from input override or entry point doc)
    const entryStartSlug = input.entryStartSlug || 
                           entryPoint.content?.doc?.entryStartSlug ||
                           entryPoint.content?.entryStartSlug ||
                           entryPoint.slug;

    // 6. Extract entry prompt text (from entry point doc)
    const entryPromptText = entryPoint.content?.doc?.prompt?.text ||
                           entryPoint.content?.prompt?.text ||
                           `# Entry: ${entryPoint.slug}\n\nBegin your adventure here.`;

    // 7. Extract world prompt content
    const worldPromptText = this.extractWorldPrompt(world.doc);

    // 8. Extract ruleset prompt content
    const rulesetPromptText = this.extractRulesetPrompt(ruleset.doc);

    // 9. Build pieces array
    const pieces: AssemblePiece[] = [];

    // Core (always included)
    const coreTokens = roughTokenCount(CORE_PROMPT);
    pieces.push({
      scope: 'core',
      slug: 'core-system',
      version: '1.0.0',
      tokens: coreTokens,
    });

    // Ruleset
    const rulesetTokens = roughTokenCount(rulesetPromptText);
    pieces.push({
      scope: 'ruleset',
      slug: ruleset.slug || ruleset.id,
      version: ruleset.version,
      tokens: rulesetTokens,
    });

    // World
    const worldTokens = roughTokenCount(worldPromptText);
    pieces.push({
      scope: 'world',
      slug: world.id,
      version: world.version,
      tokens: worldTokens,
    });

    // Entry
    const entryTokens = roughTokenCount(entryPromptText);
    pieces.push({
      scope: 'entry',
      slug: entryPoint.slug,
      version: '1.0.0', // Entry points don't have version in schema
      tokens: entryTokens,
    });

      // NPCs: deterministic ordering by sort_order ASC, then npc_slug ASC
      // Map bindings to NPCs with sort info
      const npcBindingMap = new Map(
        npcBindings.map(b => [b.npc_id, b])
      );

      const orderedNPCsFinal = npcs
        .map(npc => {
          const binding = npcBindingMap.get(npc.id);
          if (!binding) return null;
          return { npc, binding };
        })
        .filter((item): item is { npc: NPCData; binding: EntryPointNPCBinding } => item !== null)
        .sort((a, b) => {
          // First by sort_order
          const orderDiff = a.binding.sort_order - b.binding.sort_order;
          if (orderDiff !== 0) return orderDiff;
          
          // Then by npc_slug (or name, or id as fallback)
          const aSlug = a.binding.npc_slug || a.npc.slug || a.npc.name || a.npc.id;
          const bSlug = b.binding.npc_slug || b.npc.slug || b.npc.name || b.npc.id;
          return aSlug.localeCompare(bSlug);
        })
        .map(item => item.npc);

      // Deduplicate by ID (shouldn't happen with PK, but defensive)
      const seen = new Set<string>();
      const deduplicatedNPCs: NPCData[] = [];
      for (const npc of orderedNPCsFinal) {
        if (!seen.has(npc.id)) {
          seen.add(npc.id);
          deduplicatedNPCs.push(npc);
        }
      }
      const orderedNPCs = deduplicatedNPCs;

      for (const npc of orderedNPCs) {
        const npcPromptText = this.extractNPCPrompt(npc);
        if (npcPromptText) {
          const npcTokens = roughTokenCount(npcPromptText);
          pieces.push({
            scope: 'npc',
            slug: npc.slug || npc.name || npc.id,
            version: '1.0.0',
            tokens: npcTokens,
          });
        }
      }

      // 10. Apply budget policy
      const budget = input.budgetTokens || PROMPT_TOKEN_BUDGET_DEFAULT;
      const { finalPieces, dropped, policy: budgetPolicy, npcTrimmedCount } = this.applyBudgetPolicy(
        pieces,
        budget,
        orderedNPCs.length
      );

      // Combine policies (multiple defaults + budget)
      const policy = [...budgetPolicy];
      if (hasMultipleDefaults) {
        policy.push('MULTIPLE_DEFAULT_RULESETS' as PolicyAction);
        
        // Record metric
        const { metricsCollector } = await import('../utils/metrics.js');
        metricsCollector.incrementCounter('v3_multiple_default_rulesets_total');
      }

    // 11. Assemble final prompt
    const segments: string[] = [];

    // Core
    segments.push(CORE_PROMPT);

    // Ruleset
    if (finalPieces.some(p => p.scope === 'ruleset')) {
      segments.push(rulesetPromptText);
    }

    // World
    if (finalPieces.some(p => p.scope === 'world')) {
      segments.push(worldPromptText);
    }

    // Entry
    if (finalPieces.some(p => p.scope === 'entry')) {
      segments.push(entryPromptText);
    }

    // NPCs (only those that weren't dropped)
    const includedNPCIds = new Set(
      finalPieces
        .filter(p => p.scope === 'npc')
        .map(p => {
          const npc = orderedNPCs.find(n => (n.slug || n.name || n.id) === p.slug);
          return npc?.id;
        })
        .filter((id): id is string => id !== undefined)
    );

      for (const npc of orderedNPCs) {
        if (includedNPCIds.has(npc.id)) {
          const npcPromptText = this.extractNPCPrompt(npc);
          if (npcPromptText) {
            segments.push(npcPromptText);
          }
        }
      }

    // Add game state and conversation history for ongoing turns
    if (input.stateSnapshot || input.conversationWindow || input.userIntentText) {
      segments.push('# Current Game State\n');
      
      if (input.stateSnapshot) {
        // Include minimal state snapshot (flags, ledgers, metadata)
        const stateSummary = JSON.stringify({
          flags: input.stateSnapshot.flags || {},
          ledgers: input.stateSnapshot.ledgers || {},
          metadata: input.stateSnapshot.metadata || {},
          character: input.stateSnapshot.character ? {
            id: input.stateSnapshot.character.id,
            name: input.stateSnapshot.character.name,
          } : undefined,
          adventure: input.stateSnapshot.adventure ? {
            id: input.stateSnapshot.adventure.id,
            slug: input.stateSnapshot.adventure.slug,
          } : undefined,
        }, null, 2);
        segments.push(`## State Snapshot\n\`\`\`json\n${stateSummary}\n\`\`\`\n`);
      }
      
      if (input.conversationWindow && input.conversationWindow.length > 0) {
        segments.push('## Recent Story History\n');
        for (const turn of input.conversationWindow) {
          if (turn.userChoice) {
            segments.push(`**Turn ${turn.turnNumber} - Player:** ${turn.userChoice}`);
          }
          if (turn.narrative) {
            segments.push(`**Turn ${turn.turnNumber} - Story:** ${turn.narrative}`);
          }
        }
        segments.push(''); // Blank line after history
      }
      
      if (input.userIntentText) {
        segments.push(`## Player Action\n\nThe player chooses: "${input.userIntentText}"\n`);
      }
    }

    // Join with single blank line between scopes, add trailing newline
    const prompt = segments.join('\n\n') + '\n';

      // 12. Calculate token estimates
      const inputTokens = roughTokenCount(prompt);
      const tokenPct = inputTokens / budget;
      const npcCountAfter = finalPieces.filter(p => p.scope === 'npc').length;
      const assembleMs = Date.now() - assembleStartTime;

      // Structured log: assemble done
      console.log(JSON.stringify({
        event: 'v3.assemble.done',
        entryPointId: input.entryPointId,
        tokenPct: Math.round(tokenPct * 100) / 100,
        npcTrimmed: npcTrimmedCount,
        ms: assembleMs,
      }));

      return {
        prompt,
        pieces: finalPieces,
        meta: {
          included: finalPieces.map(p => formatPieceId(p.scope, p.slug, p.version)),
          dropped: dropped.map(p => formatPieceId(p.scope, p.slug, p.version)),
          policy: policy.length > 0 ? (policy as string[]) : undefined,
          model: input.model || process.env.PROMPT_MODEL_DEFAULT || 'gpt-4o-mini',
          worldId: world.id,
          worldSlug: world.slug || world.id,
          rulesetSlug: ruleset.slug || ruleset.id,
          entryPointId: entryPoint.id,
          entryPointSlug: entryPoint.slug,
          entryStartSlug,
          tokenEst: {
            input: inputTokens,
            budget,
            pct: tokenPct,
          },
          source: 'entry-point',
          version: 'v3',
          npcTrimmedCount,
          selectionContext: {
            worldId: world.id,
            worldSlug: world.slug || world.id,
            entryPointId: entryPoint.id,
            entryStartSlug,
            rulesetSlug: ruleset.slug || ruleset.id,
            npcCountBefore,
            npcCountAfter,
            budget,
            warnPct: PROMPT_BUDGET_WARN_PCT,
          },
        },
      };
    } catch (error) {
      if (error instanceof EntryPointAssemblerError) {
        throw error;
      }
      // Wrap unexpected errors
      throw new EntryPointAssemblerError(
        'VALIDATION_FAILED',
        error instanceof Error ? error.message : 'Unknown error during assembly',
        { entryPointId: input.entryPointId, originalError: String(error) }
      );
    }
  }

  /**
   * Load entry point from database
   */
  private async loadEntryPoint(entryPointId: string): Promise<EntryPointData | null> {
    const { data, error } = await supabaseAdmin
      .from('entry_points')
      .select('id, slug, type, world_id, content')
      .eq('id', entryPointId)
      .eq('lifecycle', 'active')  // entry_points use 'lifecycle', not 'status'
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      slug: data.slug,
      type: data.type,
      world_id: data.world_id,
      content: (data.content as Record<string, any>) || {},
    };
  }

  /**
   * Load world from database
   */
  private async loadWorld(worldId: string): Promise<WorldData | null> {
    // Accept either UUID (from world_id_mapping.uuid_id) or text id/slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(worldId);

    let worldTextId: string | null = null;

    // If UUID: try to resolve to text_id via mapping
    if (isUUID) {
      const { data: mapping } = await supabaseAdmin
        .from('world_id_mapping')
        .select('text_id')
        .eq('uuid_id', worldId)
        .single();
      worldTextId = mapping?.text_id || null;
    } else {
      worldTextId = worldId;
    }

    // Primary lookup: worlds by id (text_id) and active
    if (worldTextId) {
      const { data, error } = await supabaseAdmin
        .from('worlds')
        .select('id, version, doc')
        .or(`id.eq.${worldTextId},doc->>slug.eq.${worldTextId}`)
        .eq('status', 'active')
        .maybeSingle();

      if (!error && data) {
        return {
          id: isUUID ? worldId : (worldTextId || data.id),
          version: (data as any).version,
          doc: ((data as any).doc as Record<string, any>) || {},
        };
      }
    }

    // Fallback: worlds_admin view by UUID id or slug
    const { data: adminWorld } = await supabaseAdmin
      .from('worlds_admin')
      .select('id, slug, doc')
      .or(`id.eq.${worldId},slug.eq.${worldTextId || worldId}`)
      .maybeSingle();

    if (adminWorld) {
      return {
        id: isUUID ? worldId : adminWorld.id,
        version: (adminWorld as any).version || '1',
        doc: ((adminWorld as any).doc as Record<string, any>) || {},
      };
    }

    console.error(`[EntryPointAssemblerV3] World '${worldTextId || worldId}' (resolved from '${worldId}') not found or not active`);
    return null;
  }

  /**
   * Load default ruleset for entry point (with cache and multiple defaults handling)
   */
  private async loadDefaultRulesetForEntryPoint(entryPointId: string): Promise<{ ruleset: RulesetData | null; multipleDefaults: boolean }> {
    // Check cache first
    const cacheKey = `ruleset:${entryPointId}`;
    const cached = this.rulesetCache.get(cacheKey);
    if (cached) {
      return { ruleset: cached, multipleDefaults: false }; // Cache doesn't track multiple defaults
    }

    // Get default ruleset (is_default=true) first
    const { data: defaultBinding, error: defaultError } = await supabaseAdmin
      .from('entry_point_rulesets')
      .select('ruleset_id')
      .eq('entry_point_id', entryPointId)
      .eq('is_default', true)
      .limit(10) // Check for multiple defaults
      .maybeSingle();

    let selectedRulesetId: string | null = null;
    let multipleDefaults = false;

    if (!defaultError && defaultBinding) {
      // Got at least one default, check for multiples
      const { data: allDefaults } = await supabaseAdmin
        .from('entry_point_rulesets')
        .select('ruleset_id')
        .eq('entry_point_id', entryPointId)
        .eq('is_default', true);

      if (allDefaults && allDefaults.length > 1) {
        multipleDefaults = true;
        // Log anomaly
        console.log(JSON.stringify({
          event: 'v3.rulesets.multiple_defaults',
          entryPointId,
          rulesetIds: allDefaults.map(b => b.ruleset_id),
        }));
        // Choose lexicographically smallest ruleset_id (stable selection)
        selectedRulesetId = allDefaults
          .map(b => b.ruleset_id)
          .sort((a, b) => a.localeCompare(b))[0];
      } else {
        selectedRulesetId = defaultBinding.ruleset_id;
      }
    } else {
      // No default, get first by sort_order
      const { data: firstBinding } = await supabaseAdmin
        .from('entry_point_rulesets')
        .select('ruleset_id')
        .eq('entry_point_id', entryPointId)
        .order('sort_order', { ascending: true })
        .limit(1)
        .single();

      if (firstBinding) {
        selectedRulesetId = firstBinding.ruleset_id;
      }
    }

    if (!selectedRulesetId) {
      return { ruleset: null, multipleDefaults: false };
    }

    // Load ruleset (include both prompt and doc columns)
    const { data, error } = await supabaseAdmin
      .from('rulesets')
      .select('id, slug, version, doc, prompt, name, description')
      .eq('id', selectedRulesetId)
      .eq('status', 'active')
      .single();

    if (error || !data) {
      return { ruleset: null, multipleDefaults: false };
    }

    // Build doc object from available fields
    // Merge prompt (top-level) and doc fields
    const rulesetDoc: Record<string, any> = {
      ...((data.doc as Record<string, any>) || {}),
      // If prompt exists at top level but not in doc, add it
      ...((data.prompt && !(data.doc as any)?.prompt) ? { prompt: data.prompt } : {}),
      // Include name and description if not in doc
      ...((data.name && !(data.doc as any)?.name) ? { name: data.name } : {}),
      ...((data.description && !(data.doc as any)?.description) ? { description: data.description } : {}),
    };

    const ruleset: RulesetData = {
      id: data.id,
      slug: (data as any).slug || data.id,
      version: String((data as any).version || '1.0.0'),
      doc: rulesetDoc,
    };

    // Cache ruleset
    this.rulesetCache.set(cacheKey, ruleset);
    return { ruleset, multipleDefaults };
  }

  /**
   * Load entry point NPC bindings (ordered by sort_order ASC, npc_slug ASC) with cache
   */
  private async loadEntryPointNPCs(entryPointId: string): Promise<EntryPointNPCBinding[]> {
    // Check cache first
    const cacheKey = `npcs:${entryPointId}`;
    const cached = this.npcListCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Load with deterministic ordering: sort_order ASC, then npc_id (as proxy for slug)
    const { data, error } = await supabaseAdmin
      .from('entry_point_npcs')
      .select('npc_id, sort_order')
      .eq('entry_point_id', entryPointId)
      .order('sort_order', { ascending: true })
      .order('npc_id', { ascending: true }); // Secondary sort for determinism

    if (error || !data) {
      return [];
    }

    // Get NPC slugs for proper ordering
    const npcIds = data.map((row: any) => row.npc_id);
    const { data: npcs } = await supabaseAdmin
      .from('npcs')
      .select('id, slug')
      .in('id', npcIds);

    const npcSlugMap = new Map((npcs || []).map((n: any) => [n.id, n.slug || null]));

    const bindings: EntryPointNPCBinding[] = data.map((row: any) => ({
      npc_id: row.npc_id,
      npc_slug: npcSlugMap.get(row.npc_id) || null,
      sort_order: row.sort_order || 1000,
    }));

    // Final sort by sort_order, then npc_slug (or npc_id as fallback)
    bindings.sort((a, b) => {
      const orderDiff = a.sort_order - b.sort_order;
      if (orderDiff !== 0) return orderDiff;
      const aSlug = a.npc_slug || a.npc_id;
      const bSlug = b.npc_slug || b.npc_id;
      return aSlug.localeCompare(bSlug);
    });

    // Cache bindings
    this.npcListCache.set(cacheKey, bindings);
    return bindings;
  }

  /**
   * Load NPCs by IDs
   */
  private async loadNPCs(npcIds: string[]): Promise<NPCData[]> {
    if (npcIds.length === 0) {
      return [];
    }

    const { data, error } = await supabaseAdmin
      .from('npcs')
      .select('id, name, slug, prompt, doc')
      .in('id', npcIds)
      .eq('status', 'active');

    if (error || !data) {
      return [];
    }

    return data.map((row: any) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      prompt: (row.prompt as Record<string, any>) || null,
      doc: (row.doc as Record<string, any>) || null,
    }));
  }

  /**
   * Extract world prompt content from doc
   */
  private extractWorldPrompt(doc: Record<string, any>): string {
    // Try various paths for world prompt content
    if (doc.prompt?.text) {
      return doc.prompt.text;
    }
    if (doc.prompt) {
      return typeof doc.prompt === 'string' ? doc.prompt : JSON.stringify(doc.prompt);
    }
    if (doc.description) {
      return `# World\n\n${doc.description}`;
    }
    if (doc.name) {
      return `# World: ${doc.name}`;
    }
    return '# World\n\n[World content not specified]';
  }

  /**
   * Extract ruleset prompt content from doc
   * Handles multiple structures: prompt.text, prompt (string), prompt (object), description, name
   * Also checks for AWF CoreRulesetV1 structure (doc.ruleset)
   */
  private extractRulesetPrompt(doc: Record<string, any>): string {
    // Try various paths for ruleset prompt content
    // 1. Check for prompt.text (structured format)
    if (doc.prompt?.text && typeof doc.prompt.text === 'string') {
      return doc.prompt.text;
    }
    
    // 2. Check for prompt as string
    if (typeof doc.prompt === 'string' && doc.prompt.trim()) {
      return doc.prompt;
    }
    
    // 3. Check for prompt as object (try to extract meaningful content)
    if (doc.prompt && typeof doc.prompt === 'object') {
      // If it has a text property but we didn't catch it above
      if (doc.prompt.text) {
        return doc.prompt.text;
      }
      // Try to extract narrative/policy content from prompt object
      if (doc.prompt.narrative || doc.prompt.policy) {
        return `# Ruleset\n\n${JSON.stringify(doc.prompt, null, 2)}`;
      }
      // Fallback: stringify the prompt object
      const promptStr = JSON.stringify(doc.prompt);
      if (promptStr.length > 20) { // Only use if meaningful
        return `# Ruleset\n\n${promptStr}`;
      }
    }
    
    // 4. Check for AWF CoreRulesetV1 structure (doc.ruleset)
    if (doc.ruleset) {
      const ruleset = doc.ruleset;
      const parts: string[] = [];
      
      if (ruleset.name) {
        parts.push(`# Ruleset: ${ruleset.name}`);
      }
      
      if (ruleset['txt.policy']) {
        parts.push(`\n## Text Policy\n${ruleset['txt.policy']}`);
      }
      
      if (ruleset['choices.policy']) {
        parts.push(`\n## Choices Policy\n${ruleset['choices.policy']}`);
      }
      
      if (ruleset['scn.phases'] && Array.isArray(ruleset['scn.phases'])) {
        parts.push(`\n## Scene Phases\n${ruleset['scn.phases'].join(', ')}`);
      }
      
      if (parts.length > 0) {
        return parts.join('\n');
      }
    }
    
    // 5. Fallback to description
    if (doc.description && typeof doc.description === 'string') {
      return `# Ruleset\n\n${doc.description}`;
    }
    
    // 6. Fallback to name
    if (doc.name && typeof doc.name === 'string') {
      return `# Ruleset: ${doc.name}\n\n[Add ruleset content in the Rulesets admin page]`;
    }
    
    // 7. Last resort - indicate what's missing
    return '# Ruleset\n\n[Ruleset content not specified - please add prompt content in the Rulesets admin page]';
  }

  /**
   * Extract NPC prompt content from prompt or doc
   */
  private extractNPCPrompt(npc: NPCData): string | null {
    // Try prompt field first
    if (npc.prompt) {
      if (typeof npc.prompt === 'object' && npc.prompt.text) {
        return npc.prompt.text;
      }
      if (typeof npc.prompt === 'string') {
        return npc.prompt;
      }
    }

    // Try doc field
    if (npc.doc) {
      if (npc.doc.prompt?.text) {
        return npc.doc.prompt.text;
      }
      if (npc.doc.description) {
        return `# NPC: ${npc.name}\n\n${npc.doc.description}`;
      }
    }

    // Fallback to name
    return `# NPC: ${npc.name}\n\n[NPC content not specified]`;
  }

  /**
   * Apply budget policy: warn at threshold, trim only NPCs from end
   * Never drop core, ruleset, world, or entry
   */
  private applyBudgetPolicy(
    pieces: AssemblePiece[],
    budget: number,
    npcCountBefore: number
  ): {
    finalPieces: AssemblePiece[];
    dropped: AssemblePiece[];
    policy: PolicyAction[];
    npcTrimmedCount: number;
  } {
    const policy: PolicyAction[] = [];
    let currentTokens = pieces.reduce((sum, p) => sum + p.tokens, 0);

    // Check warn threshold
    const pct = currentTokens / budget;
    if (pct >= PROMPT_BUDGET_WARN_PCT) {
      policy.push(POLICY_ACTIONS.SCENARIO_POLICY_UNDECIDED); // Reuse existing action constant
    }

    // If over budget, trim NPCs from end only
    const protectedScopes = ['core', 'ruleset', 'world', 'entry'];
    const npcPieces = pieces.filter(p => p.scope === 'npc');
    const nonNPCPieces = pieces.filter(p => !npcPieces.includes(p));

    let finalNPCPieces = [...npcPieces];
    let droppedNPCs: AssemblePiece[] = [];

    // Trim NPCs from end until under budget
    while (currentTokens > budget && finalNPCPieces.length > 0) {
      const dropped = finalNPCPieces.pop()!;
      droppedNPCs.push(dropped);
      currentTokens -= dropped.tokens;
      policy.push(POLICY_ACTIONS.NPC_DROPPED);
    }

    const finalPieces = [...nonNPCPieces, ...finalNPCPieces];
    const npcTrimmedCount = droppedNPCs.length;

    return {
      finalPieces,
      dropped: droppedNPCs,
      policy,
      npcTrimmedCount,
    };
  }
}

