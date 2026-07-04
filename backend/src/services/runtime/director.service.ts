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

export class DirectorService {
  private llmService: LlmService;

  constructor(llmService?: LlmService) {
    this.llmService = llmService || new LlmService();
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
    loreFragments?: Array<{ id: string; content: string; title?: string }>
  ): Promise<DirectorUnifiedIntent> {
    const systemPrompt = this.buildSystemPrompt(gameState, actionsMap, loreFragments);
    
    console.log('[DirectorService] Resolving user input:', userText);
    console.log('[DirectorService] Resolution mode detection enabled');
    
    // Call LLM provider - Expect DirectorUnifiedIntent structure
    const response = await this.llmService.generateJSON<DirectorUnifiedIntent>(
      systemPrompt,
      userText,
      DirectorUnifiedIntentSchema
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
    
    // Validate and return
    return DirectorUnifiedIntentSchema.parse(response);
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
    "suggested_actions": ["Question the bartender", "Search the room", "Head for the door"]
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
      "trigger_id": "combat_action" | "social_action" | "rest_action" | "attempt_action" | "navigate",
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

1. **Bifurcation**: If the player asks a simple question or makes a low-stakes social comment, set \`resolution_mode: "narrative"\` and the Engine will be bypassed.
2. **Lore Integration**: ALWAYS use provided Lore fragments to inform NPC reactions. If lore says an NPC protects someone, that NPC MUST react when that person is threatened.
3. **Proximity**: For ANY physical action (combat, throwing, etc.), populate \`proximity_cluster\` with nearby entity IDs.
4. **Tiered Magnitudes**: Be consistent with tier assignments. A "glance" is Minor, a "crushing blow" is Severe.
5. **NPC Reactions**: NPCs should react based on their personality, relationships, and lore. A "noble, fiercely loyal" NPC will have a Major/Severe negative reaction to violence against their allies.`;
  }

  /**
   * Summarize game state for Director context
   */
  private summarizeGameState(gameState: GameState): string {
    const summary: string[] = [];

    // Extract mechanical state (Tier 1)
    const mechanical = gameState.mechanical_state || {};
    const entities = (mechanical as any).tier1_entities || {};
    const entityKeys = Object.keys(entities);

    if (entityKeys.length > 0) {
      summary.push(`**Entities Present**: ${entityKeys.length} entities in scene`);
      entityKeys.forEach(id => {
        const entity = entities[id] as any;
        const name = entity?.properties?.display_name || entity?.display_name || `entity-${id.substring(0, 8)}`;
        const stats = entity?.stats ? JSON.stringify(entity.stats) : 'No stats';
        summary.push(`  - ${name} (${id}): ${stats}`);
        
        // Include relationship info if available
        if (entity?.social?.relationships?.player) {
          const rel = entity.social.relationships.player;
          summary.push(`    Relationships: affinity=${rel.affinity || 'unknown'}, resentment=${rel.resentment || 'unknown'}`);
        }
      });
    }

    // Extract narrative state (Tier 0)
    const narrative = gameState.narrative_focus || {};
    if (Object.keys(narrative).length > 0) {
      summary.push(`**Narrative Context**: ${JSON.stringify(narrative)}`);
    }

    // Extract scene registry
    const scene = gameState.scene_registry || {};
    if (Object.keys(scene).length > 0) {
      summary.push(`**Scene Registry**: ${JSON.stringify(scene)}`);
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
