// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * Director Service (The Strategic Lead)
 * Phase 2: Director-Narrator Pivot Implementation
 * Converts player input into Unified Intent DTO with unseen_ripples, intent_queue, and proximity_cluster
 */

import type { GameState, DirectorUnifiedIntent } from '@shared/types/chimera-runtime';
import { DirectorUnifiedIntentSchema } from '@shared/types/chimera-runtime';
import { LlmService } from '../llm/llm.service';
import { z } from 'zod';
import { entityDisplayName, readSceneEntities, presentEntityIds } from './scene-context';

/**
 * Schema for Director response: Object wrapper (required by OpenAI json_object format)
 */
const DirectorResponseSchema = z.object({
  turn_meta: z.object({
    resolution_mode: z.enum(['engine', 'narrative']),
    atmosphere_shift: z.string().optional(),
    time_jump_minutes: z.number().int().default(0),
    suggested_actions: z.array(z.string()).max(6).default([]),
  }),
  unseen_ripples: z.array(z.object({
    target_id: z.string().uuid(),
    type: z.enum(['relationship', 'emotional', 'status']),
    delta_tier: z.enum(['Minor', 'Moderate', 'Major', 'Severe']),
    property_path: z.string(),
    reason: z.string(),
  })).default([]),
  intent_queue: z.array(z.object({
    actor_id: z.string().uuid(),
    trigger_id: z.string(),
    intended_targets: z.array(z.string().uuid()),
    proximity_cluster: z.array(z.string().uuid()).default([]),
    parameters: z.object({
      verb: z.string(),
      impact_tier: z.enum(['Low', 'Moderate', 'High', 'Severe']).optional(),
      tactic_tag: z.string().optional(),
      skill_id: z.string().optional(),
    }),
  })).default([]),
});

export { entityDisplayName, readSceneEntities };

/**
 * Models sometimes put a value from the wrong field into turn_meta.resolution_mode
 * ("impossible", "navigate", "social_action"...). Map those to what they meant instead of
 * failing the whole turn on a labelling slip.
 */
const DEFAULT_VERBS: Record<string, string> = {
  navigate: 'travel', eat_action: 'eat', social_action: 'speak', rest_action: 'rest', combat_action: 'attack', attempt_action: 'attempt',
};

export function normalizeDirectorOutput(raw: unknown, playerId?: string): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const out: any = { ...(raw as any) };

  // Repair intents the model left incomplete (a missing verb on a navigate intent is common)
  if (Array.isArray(out.intent_queue)) {
    out.intent_queue = out.intent_queue.map((q: any) => {
      if (!q || typeof q !== 'object') return q;
      const params = q.parameters && typeof q.parameters === 'object' ? { ...q.parameters } : {};
      if (typeof params.verb !== 'string' || !params.verb.trim()) params.verb = DEFAULT_VERBS[q.trigger_id] ?? 'attempt';
      return {
        ...q,
        actor_id: q.actor_id ?? playerId,
        intended_targets: Array.isArray(q.intended_targets) ? q.intended_targets : [],
        parameters: params,
      };
    });
  }
  const meta = out.turn_meta && typeof out.turn_meta === 'object' ? { ...out.turn_meta } : undefined;
  if (!meta) return out;
  const mode = typeof meta.resolution_mode === 'string' ? meta.resolution_mode.trim().toLowerCase() : meta.resolution_mode;
  if (mode !== 'engine' && mode !== 'narrative') {
    const queued = Array.isArray(out.intent_queue) && out.intent_queue.length > 0;
    if (mode === 'impossible' || mode === 'infeasible') {
      meta.feasibility = 'impossible';
      meta.resolution_mode = 'narrative';
    } else if (typeof mode === 'string' && /combat|attack|engine|physical|skill/.test(mode)) {
      meta.resolution_mode = 'engine';
    } else {
      meta.resolution_mode = queued && out.intent_queue.some((q: any) => q?.trigger_id !== 'social_action') ? 'engine' : 'narrative';
    }
    console.warn('[DirectorService] Normalized invalid resolution_mode:', mode, '->', meta.resolution_mode);
  } else {
    meta.resolution_mode = mode;
  }
  out.turn_meta = meta;
  return out;
}

const directorOutputSchema = (playerId?: string) =>
  z.preprocess((raw) => normalizeDirectorOutput(raw, playerId), DirectorUnifiedIntentSchema);

/**
 * Deterministic guard between the Director's JSON and the Engine:
 *  - ripples may only target existing NON-player entities (the player does not "react" to themselves)
 *  - intended_targets / proximity_cluster keep only existing entities
 *  - an unknown actor_id is the player (the Director may only act as known entities)
 * Without this, an invented UUID silently mutates or corrupts state.
 */
export function sanitizeDirectorIntent(intent: DirectorUnifiedIntent, gameState: any): DirectorUnifiedIntent {
  // An impossible action changes nothing in the world: no intents, no ripples
  if (intent.turn_meta?.feasibility === 'impossible') {
    return { ...intent, intent_queue: [], unseen_ripples: [] };
  }
  const { entities, playerId } = readSceneEntities(gameState);
  // Only entities present with the player can be targeted or react; absent NPCs are not in the scene
  const known = new Set(presentEntityIds(gameState));
  if (Object.keys(entities).length === 0) return intent;

  const dropped: string[] = [];
  const keepKnown = (ids: string[]) => ids.filter((id) => {
    if (known.has(id)) return true;
    dropped.push(id);
    return false;
  });

  const location_change = intent.turn_meta.location_change
    ? { ...intent.turn_meta.location_change, companions: intent.turn_meta.location_change.companions.filter((id) => !!entities[id] && id !== playerId) }
    : undefined;

  const cleaned: DirectorUnifiedIntent = {
    ...intent,
    turn_meta: { ...intent.turn_meta, ...(location_change ? { location_change } : {}) },
    unseen_ripples: intent.unseen_ripples.filter((r) => {
      const ok = known.has(r.target_id) && r.target_id !== playerId;
      if (!ok) dropped.push(r.target_id);
      return ok;
    }),
    intent_queue: intent.intent_queue.map((q) => ({
      ...q,
      actor_id: known.has(q.actor_id) ? q.actor_id : (playerId ?? q.actor_id),
      intended_targets: keepKnown(q.intended_targets),
      proximity_cluster: keepKnown(q.proximity_cluster),
    })),
  };
  if (dropped.length > 0) {
    console.warn('[DirectorService] Dropped references to unknown/invalid entities:', [...new Set(dropped)]);
  }
  return cleaned;
}

export class DirectorService {
  private llmService: LlmService;

  constructor(llmService?: LlmService) {
    this.llmService = llmService || new LlmService(undefined, undefined, 'director');
  }

  /**
   * Resolve user text input into Unified Intent DTO using LLM
   * @param userText - The player's input text
   * @param gameState - Current game state for context
   * @param actionsMap - Map of available actions from compiled story
   * @param loreFragments - Optional RAG-retrieved lore fragments for context
   * @returns DirectorUnifiedIntent with intent_queue, unseen_ripples, and proximity_cluster
   * @throws Error if LLM provider fails or validation fails - NO FALLBACK
   */
  async resolve(
    userText: string,
    gameState: GameState,
    actionsMap: Record<string, unknown>,
    loreFragments?: Array<{ id: string; content: string; title?: string }>,
    pinnedInstructions?: string,
  ): Promise<DirectorUnifiedIntent> {
    const systemPrompt = this.buildSystemPrompt(gameState, actionsMap, loreFragments)
      + (pinnedInstructions ? `\n\n## Frozen story rules\n${pinnedInstructions}` : '');
    
    console.log('[DirectorService] Resolving user input:', userText);
    console.log('[DirectorService] Resolution mode detection enabled');
    
    // Call LLM provider - Expect DirectorUnifiedIntent structure
    const response = await this.llmService.generateJSON<DirectorUnifiedIntent>(
      systemPrompt,
      userText,
      directorOutputSchema(readSceneEntities(gameState).playerId) as unknown as z.ZodType<DirectorUnifiedIntent>
    );
    
    console.log('[DirectorService] LLM response received:', {
      resolutionMode: response.turn_meta?.resolution_mode,
      intentQueueLength: response.intent_queue?.length || 0,
      unseenRipplesCount: response.unseen_ripples?.length || 0,
      firstIntent: response.intent_queue?.[0] ? {
        trigger_id: response.intent_queue[0].trigger_id,
        proximity_cluster_size: response.intent_queue[0].proximity_cluster?.length || 0
      } : null
    });
    
    // Validate, then drop anything that references entities that do not exist (models invent ids)
    return sanitizeDirectorIntent(DirectorUnifiedIntentSchema.parse(response), gameState);
  }

  /**
   * Build system prompt for Director (Strategic Lead)
   * This prompt instructs the AI to:
   * 1. Determine resolution_mode (engine vs narrative)
   * 2. Identify unseen_ripples (internal state changes)
   * 3. Populate intent_queue with player and NPC actions
   * 4. Map proximity_cluster for physical actions
   * 5. Assign tiered magnitudes (Minor/Moderate/Major/Severe)
   */
  private buildSystemPrompt(
    gameState: GameState,
    actionsMap: Record<string, unknown>,
    loreFragments?: Array<{ id: string; content: string; title?: string }>
  ): string {
    const stateSummary = this.summarizeGameState(gameState);
    const actionKeys = Object.keys(actionsMap);
    const loreContext = this.formatLoreFragments(loreFragments);
    
    return `You are the **Director**, the Strategic Lead of the Chimera Engine. Your role is to convert raw player input into a **Unified Intent DTO** that defines the social, emotional, and tactical reality of the turn.

## Your Core Responsibilities

### 1. Bifurcation Routing (Resolution Mode)
You must determine the \`resolution_mode\` for the turn:
- **"engine"**: Required if ANY intent involves:
  - Skill Checks (combat, climbing, sneaking, etc.)
  - Stamina Cost (physical exertion)
  - Physical Conflict (attacks, grappling, etc.)
  - Resource Usage (consuming items, spending wealth, etc.)
- **"narrative"**: Use ONLY for:
  - Low-stakes social flavor (asking questions, casual conversation)
  - Simple exploration (looking around, observing)
  - Atmospheric interaction where failure is impossible or uninteresting

### 2. Unseen Ripples (Internal State Changes)
Ripples are how NPCs feel about the PLAYER after this action. Rules:
- Only NPCs listed under "Others present" can have ripples. NEVER target the player.
- Only emit a ripple when an NPC plausibly witnessed or was addressed by the action AND their feelings would genuinely shift. Passive actions (looking around, walking, resting, thinking) or actions nobody sees produce NO ripples: use an empty array.
- Emit at most 3 ripples per turn, and match magnitude to what happened: idle chatter is Minor at most.
Identify immediate internal shifts that occur the moment an action is *declared*, BEFORE physical resolution:
- **Relationship Shifts**: Direct changes to NPC \`affinity\` or \`resentment\` based on perceived intent
- **Emotional State**: Updates to NPC \`mood\` (e.g., Jovial → Terrified)
- **Tiered Magnitudes**: ALL ripples MUST be assigned: **Minor**, **Moderate**, **Major**, or **Severe**
  - Minor: 5% change (slight annoyance, mild surprise)
  - Moderate: 15% change (clear emotional reaction, noticeable shift)
  - Major: 30% change (strong emotional response, significant relationship impact)
  - Severe: 50%+ change (traumatic event, relationship-altering moment)

**Lore-Driven Reactions**: Use the provided Lore fragments to determine if an NPC has a specific reaction based on their history, relationships, or world knowledge. For example:
- If lore mentions "The Guard protects the Bard at all costs", and the player attacks the Bard, the Guard should have a **Severe** relationship shift (resentment increase).

### 3. Intent Queue (Action Queue)
Choose the trigger that matches the player's action: \`social_action\` (talking, asking, persuading, flirting, threatening), \`combat_action\` (violence), \`rest_action\` (resting, sitting down to recover, sleeping, camping), \`eat_action\` (eating or drinking), \`navigate\` (going somewhere else), \`attempt_action\` (any other physical or skill attempt). Set \`intended_targets\` to the UUIDs of the NPCs the player addresses or acts upon, matched by NAME (e.g. "ask Kiera" => Kiera's UUID). If the player speaks to, asks, greets, persuades or otherwise addresses a specific NPC, the intent_queue MUST contain a \`social_action\` targeting that NPC (never leave it empty for conversation). Purely observational actions ("I look around") may have an empty \`intent_queue\` with resolution_mode "narrative".
Populate the \`intent_queue\` with:
- **Player Action**: The primary action from the player's input
- **NPC Reactions**: Counter-actions from NPCs based on:
  - Their personality traits
  - Their relationships with the player
  - Lore-driven motivations
  - Proximity to the action

**Priority Ordering**: Order intents based on tactical logic (e.g., a Guard may preemptively block an attack before the player's strike lands).

### 4. Proximity Mapping
For EVERY physical action in the queue, identify a \`proximity_cluster\`:
- List entity IDs of NPCs/entities standing near the \`intended_targets\`
- This enables the Engine to handle "accidents" (fumbles hitting bystanders)
- Include at least 2-3 nearby entities for combat actions
- Can be empty for non-physical actions

### 5. Impact Tiers
Assign \`impact_tier\` to each intent's parameters:
- **Low**: Glancing blow, minor effect
- **Moderate**: Clear impact, noticeable effect
- **High**: Significant impact, major effect
- **Severe**: Devastating impact, life-altering effect

### 6. Suggested Actions
Propose 3-5 \`suggested_actions\` in \`turn_meta\`: short, player-phrased next moves that fit the scene AFTER this turn resolves (e.g. "Question the bartender", "Search the body", "Slip out the back door"). Keep each under 6 words. Vary the mix (social, physical, exploratory).

### 7. Feasibility
Set \`turn_meta.feasibility\` to "impossible" (with a short \`feasibility_reason\`, and an EMPTY \`intent_queue\` and \`unseen_ripples\`) when the player attempts something this world or this character cannot do: supernatural feats they have no means for (flying, teleporting, mind control, summoning), producing extraordinary items, money or allies from nowhere (the player carries only ordinary travel gear: a pack, simple tools, a knife, food and water), controlling or speaking for other characters, or rewriting reality by fiat ("everyone falls asleep"). Otherwise omit it or use "possible". NOTE: \`resolution_mode\` must ALWAYS be exactly "engine" or "narrative" (an impossible action uses "narrative"); trigger names like "navigate" belong only in \`intent_queue[].trigger_id\`, never in \`resolution_mode\`. Ordinary attempts that might fail (climbing, persuading, fighting) are "possible": the Engine decides how they turn out.

### 8. Movement
When the player moves to a distinct new place (enters a building, leaves town, follows a road to somewhere else), add \`turn_meta.location_change\` with \`name\` (a short place name: reuse names from the Scene when they fit, e.g. "The Copper Kettle") and \`companions\` (UUIDs of present characters who would plausibly go along: those the player invited, or whose loyalty is to the player). Everyone not listed stays behind and is no longer in the scene. Also use the \`navigate\` trigger for the move. Moving within the same place is NOT a location change.

## Available Context

**Available Actions**: ${actionKeys.join(', ') || 'None specified'}

**Current Game State**:
${stateSummary}

${loreContext}

## Output Format

Return a JSON object matching the DirectorUnifiedIntent schema:
\`\`\`json
{
  "turn_meta": {
    "resolution_mode": "engine" | "narrative",
    "atmosphere_shift": "Brief description of scene atmosphere change (optional)",
    "time_jump_minutes": 0,
    "suggested_actions": ["Question the bartender", "Search the room", "Head for the door"],
    "feasibility": "possible" | "impossible",
    "feasibility_reason": "Only when impossible: one short sentence (e.g. 'humans cannot fly')",
    "location_change": null | { "name": "New place name", "companions": ["uuid-of-present-character-who-goes-along"] }
  },
  "unseen_ripples": [
    {
      "target_id": "uuid-of-affected-entity",
      "type": "relationship" | "emotional" | "status",
      "delta_tier": "Minor" | "Moderate" | "Major" | "Severe",
      "property_path": "tier1_entities.{entity_id}.social.relationships.player.affinity",
      "reason": "Clear explanation of why this ripple occurs (e.g., 'The Guard witnessed violence against his protected ally, the Bard')"
    }
  ],
  "intent_queue": [
    {
      "actor_id": "uuid-of-actor",
      "trigger_id": "combat_action" | "social_action" | "rest_action" | "eat_action" | "attempt_action" | "navigate",
      "intended_targets": ["uuid-of-primary-target"],
      "proximity_cluster": ["uuid-of-nearby-entity-1", "uuid-of-nearby-entity-2"],
      "parameters": {
        "verb": "slash" | "attack" | "intimidate" | etc,
        "impact_tier": "Low" | "Moderate" | "High" | "Severe",
        "tactic_tag": "aggressive" | "defensive" | "trickery" | etc (optional),
        "skill_id": "root_force" | "root_finesse" | etc (optional)
      }
    }
  ]
}
\`\`\`

## Critical Rules

0. **Check feasibility FIRST.** Before anything else ask: can this character actually do this in this world with what they have? If not (flying, teleporting, pulling a glowing dragon egg or any magical/rare item out of a pack, mind control, reality edits), output \`"feasibility": "impossible"\` with a \`feasibility_reason\`, \`"resolution_mode": "narrative"\`, and empty \`intent_queue\` and \`unseen_ripples\`.
0a. **Fights have consequences.** When the player attacks someone, the intent_queue MUST also contain that NPC's reaction, listed AFTER the player's action: a \`combat_action\` with \`actor_id\` = the NPC's UUID and \`intended_targets\` = [the player's UUID] if they fight back (guards, soldiers, fighters, anyone cornered), or a \`navigate\`-free flee/defend/call-for-help expressed as \`attempt_action\` by that NPC. Cowardly or unarmed NPCs may flee instead of attacking. Loyal companions present (see traits) may intervene against the attacker. Skip a reaction only if that NPC is already incapacitated. NEVER put the player's own actions under an NPC actor_id.
0b. **Movement.** ALWAYS include the \`location_change\` key in \`turn_meta\`: \`null\` when the player stays where they are, otherwise an object with the destination name. Whenever you emit a \`navigate\` intent it MUST be an object with the destination name. If the player goes to a different place (enters the tavern, leaves town, takes the road north), include \`location_change\`. Omit it if they stay where they are.

1. **Bifurcation**: If the player asks a simple question or makes a low-stakes social comment, set \`resolution_mode: "narrative"\` and the Engine will be bypassed.
2. **Lore Integration**: ALWAYS use provided Lore fragments to inform NPC reactions. If lore says an NPC protects someone, that NPC MUST react when that person is threatened.
3. **Proximity**: For ANY physical action (combat, throwing, etc.), populate \`proximity_cluster\` with nearby entity IDs.
4. **Tiered Magnitudes**: Be consistent with tier assignments. A "glance" is Minor, a "crushing blow" is Severe.
5. **NPC Reactions**: NPCs should react based on their personality, relationships, and lore. A "noble, fiercely loyal" NPC will have a Major/Severe negative reaction to violence against their allies.
6. **IDs are exact UUIDs**: Every \`actor_id\`, \`target_id\`, \`intended_targets\` and \`proximity_cluster\` value MUST be a UUID copied verbatim from the Current Game State above (the player's own intents use the Player actor_id). NEVER invent ids or use names/slugs like "stranger_001". If the player addresses someone who is not in the entity list, leave \`intended_targets\` and \`unseen_ripples\` empty and set \`resolution_mode: "narrative"\`.`;
  }

  /**
   * Summarize game state for Director context
   */
  private summarizeGameState(gameState: GameState): string {
    const summary: string[] = [];
    // The turn pipeline passes { player_id, tier1_mechanical, tier0_narrative, tier2_spatial };
    // older callers/tests use { mechanical_state, narrative_focus, scene_registry }.
    const gs = gameState as any;
    const { entities, playerId } = readSceneEntities(gs);

    if (playerId) {
      const playerName = entityDisplayName(entities[playerId], 'the player');
      summary.push(`**Player**: ${playerName} - actor_id (use for the player's own intents): ${playerId}`);
    }

    const presentIds = new Set(presentEntityIds(gs));
    const npcIds = Object.keys(entities).filter((id) => id !== playerId && presentIds.has(id));
    const away = Object.keys(entities).filter((id) => id !== playerId && !presentIds.has(id));
    if (npcIds.length > 0) {
      summary.push(`**Others present** (${npcIds.length}) - these are the ONLY valid UUIDs for targets, proximity and ripples:`);
      npcIds.forEach((id) => {
        const entity = entities[id] as any;
        const props = entity?.properties || {};
        const name = entityDisplayName(entity, `entity-${id.substring(0, 8)}`);
        const bits = [
          props.species && `species: ${props.species}`,
          props.archetype && `role: ${props.archetype}`,
          Array.isArray(props.traits) && props.traits.length && `traits: ${props.traits.join(', ')}`,
          Array.isArray(props.personality) && props.personality.length && `personality: ${props.personality.join(', ')}`,
          typeof props.description === 'string' && props.description,
          entity?.status && entity.status !== 'active' && `status: ${entity.status}`,
        ].filter(Boolean).join('; ');
        summary.push(`  - ${name} (${id})${bits ? ' - ' + bits : ''}`);
        if (entity?.social?.relationships?.player) {
          const rel = entity.social.relationships.player;
          summary.push(`    Relationships: affinity=${rel.affinity || 'unknown'}, resentment=${rel.resentment || 'unknown'}`);
        }
      });
    } else {
      summary.push('**Others present**: nobody besides the player. Do not invent NPC ids.');
    }
    if (away.length > 0) {
      summary.push(`**Elsewhere (NOT present, cannot be targeted or react)**: ${away.map((id) => entityDisplayName(entities[id], id.slice(0, 8))).join(', ')}`);
    }

    const narrative = gs.tier0_narrative || gs.narrative_focus || {};
    const scene = narrative.scene_context;
    if (scene) {
      summary.push(`**Scene**: ${[scene.location, scene.time, scene.atmosphere].filter(Boolean).join(' | ')}${scene.description ? ' - ' + scene.description : ''}`);
    }
    const history = Array.isArray(narrative.dialogue_history) ? narrative.dialogue_history.slice(-4) : [];
    if (history.length > 0) {
      summary.push(`**Recent events**:\n${history.map((h: any) => `  ${h.role}: ${String(h.content).slice(0, 240)}`).join('\n')}`);
    }

    return summary.length > 0 ? summary.join('\n') : 'No significant state information available.';
  }

  /**
   * Format lore fragments for prompt context
   */
  private formatLoreFragments(
    loreFragments?: Array<{ id: string; content: string; title?: string }>
  ): string {
    if (!loreFragments || loreFragments.length === 0) {
      return '';
    }

    const fragments = loreFragments.map(f => {
      const title = f.title ? `**${f.title}**` : `Lore Fragment ${f.id.substring(0, 8)}`;
      return `${title}:\n${f.content}`;
    }).join('\n\n---\n\n');

    return `**Relevant Lore Fragments** (Use these to inform NPC reactions and world knowledge):\n\n${fragments}`;
  }
}
