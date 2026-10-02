import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../../db/supabase-client.js";
import { NarrativeService } from "./narrative.service.js";
import { ResolutionService } from "./resolution.service.js";
// REFACTOR: Import StoriesRepository (The new DAL)
import { StoriesRepository } from "../../db/repos/stories.repo.js";
// Import proper Director, Engine, and Narrator services for the game loop
import { DirectorService } from "../runtime/director.service.js";
import { EngineService } from "../runtime/engine.service.js";
import { Mas2Service } from "../runtime/mas2.service.js";
import { StateService } from "../runtime/state.service.js";
import {
  resolveConditionRules,
  type ConditionRules,
  type ConditionTransition,
} from "../runtime/condition-rules.js";
import { TIER_MULTIPLIERS } from "../runtime/tier-value-mapper.js";

import {
  GameStateBundle,
  MechanicalState,
  NarrativeFocus,
  SceneRegistry,
} from "../../domain/game-state.types.js";
import type { DirectorUnifiedIntent } from "@shared/types/chimera-runtime";
import { ServiceError } from "../../utils/serviceError.js";
import { ApiErrorCode } from "@shared";
import { applyLocationChange } from "../runtime/scene-context.js";
import {
  startLlmUsageCapture,
  summarizeLlmCalls,
  type LlmCallRecord,
} from "../runtime/llm-telemetry.js";
import {
  isJevCanaryEnabled,
  readJevCanaryConfig,
  JevShadowService,
  type JevShadowTelemetry,
} from "../runtime/jev-shadow.service.js";
import {
  TurnTimelineTracker,
  type TurnTimeline,
} from "../runtime/turn-timeline.js";

interface TurnResult {
  success: boolean;
  state?: GameStateBundle;
  turn?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  delta?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  new_logs?: any[]; // The new dialogue entries created during this turn
  message?: string;
  runtime_timeline?: TurnTimeline;
}

export class GameTurnService {
  private storiesRepo: StoriesRepository; // REFACTOR: Use Repo
  private narrativeService: NarrativeService;
  private resolutionService: ResolutionService; // Legacy - kept for fallback
  private directorService: DirectorService;
  private engineService: EngineService; // NEW: Resolution Ladder Engine
  private mas2Service: Mas2Service;
  private jevShadowService: JevShadowService;

  constructor(
    private supabase: SupabaseClient<Database>,
    narrativeService?: NarrativeService,
    directorService?: DirectorService,
    engineService?: EngineService,
    mas2Service?: Mas2Service,
    jevShadowService?: JevShadowService,
  ) {
    this.storiesRepo = new StoriesRepository(supabase); // Initialize Repo
    this.narrativeService = narrativeService || new NarrativeService();
    this.resolutionService = new ResolutionService(); // Legacy fallback
    // Director and Narrator can have mock AI, but Engine is deterministic
    this.directorService = directorService || new DirectorService();
    this.engineService = engineService || new EngineService(); // NEW: Use Resolution Ladder Engine
    this.mas2Service = mas2Service || new Mas2Service();
    this.jevShadowService = jevShadowService || new JevShadowService();
  }

  /**
   * The Standard Turn Loop (Phase 7.1)
   * Proper Flow: MAS1 (Interpreter) -> Engine (Deterministic) -> MAS2 (Narrator)
   * Mocks ONLY for MAS1 and MAS2 AI results, Engine is fully deterministic
   */
  async processTurn(
    gameStateId: string,
    playerInput: string,
    userId: string,
    timeline = new TurnTimelineTracker(),
  ): Promise<TurnResult> {
    const turnStarted = Date.now();
    timeline.mark("request_received");
    console.log(`[Turn Start] Game: ${gameStateId}, Input: "${playerInput}"`);
    const llmCalls = startLlmUsageCapture();
    console.log(
      "[Turn] 🚀 NEW FLOW: MAS1 -> Engine -> MAS2 (Proper Architecture)",
    );

    try {
      // Step 1: Load State and Compiled Story
      const state = await this.loadState(gameStateId, userId);
      if (
        !state.compiled_story_id ||
        !state.player_character_id ||
        state.state_initialization_version !== 1
      ) {
        throw new Error("Game state is missing required frozen-session pins");
      }

      // The session pin is the only runtime source of compiled content.
      const compiledStory = await this.storiesRepo.getCompiledStoryById(
        state.compiled_story_id,
      );
      if (!compiledStory) {
        throw new Error(
          `Pinned compiled story not found: ${state.compiled_story_id}`,
        );
      }

      // Extract actionsMap and condition rules from the compiled story —
      // the rules engine defines how vitals map to conditions; the
      // deterministic engine only evaluates those rules.
      const actionsMap = this.extractActionsMap(compiledStory);
      const conditionRules = resolveConditionRules(compiledStory);

      // Step 2: Director (Strategic Lead) - Can have mock AI results
      // Converts player input into Unified Intent DTO with intent_queue, unseen_ripples, and proximity_cluster
      console.log("[Turn] Step 2: Calling Director (Strategic Lead)...");
      const gameState = this.convertStateToGameState(state);
      const jevCanaryConfig = readJevCanaryConfig();
      let directorIntent: DirectorUnifiedIntent;
      let jevShadowPromise: Promise<JevShadowTelemetry>;
      const evaluateJev = (
        mode: "shadow" | "canary",
        intent?: DirectorUnifiedIntent,
      ): Promise<JevShadowTelemetry> => {
        timeline.mark("jev_start");
        return this.jevShadowService
          .evaluate(playerInput, gameState, intent, actionsMap, mode)
          .finally(() => timeline.mark("jev_end"));
      };
      const resolveDirector = (): Promise<DirectorUnifiedIntent> => {
        timeline.mark("director_start");
        return this.directorService
          .resolve(
            playerInput,
            gameState,
            actionsMap,
            [],
            compiledStory.prompt_interpreter_logic,
          )
          .finally(() => timeline.mark("director_end"));
      };

      if (isJevCanaryEnabled()) {
        // Canary mode evaluates Jev before the Director result is consumed by the Engine.
        // Jev can only constrain the two explicitly enabled fields; the Engine remains the
        // only state authority and the Director remains the immediate fallback.
        console.log("[Turn] Jev canary enabled:", jevCanaryConfig);
        const jevCanaryPromise = evaluateJev("canary");
        const runDirector =
          jevCanaryConfig.compare || !jevCanaryConfig.skip_gpt;
        const directorPromise = runDirector
          ? resolveDirector()
          : Promise.resolve(null);
        const [jevCanaryTelemetry, gptDirectorIntent] = await Promise.all([
          jevCanaryPromise,
          directorPromise,
        ]);
        let application = this.jevShadowService.applyCanaryAuthority(
          jevCanaryTelemetry,
          gptDirectorIntent,
          gameState,
          actionsMap,
          jevCanaryConfig,
        );

        if (!application.intent) {
          // Jev failed validation/confidence or could not safely construct a minimal
          // intent. Invoke the existing Director path immediately as the fallback.
          const fallbackIntent = gptDirectorIntent || (await resolveDirector());
          application = this.jevShadowService.applyCanaryAuthority(
            jevCanaryTelemetry,
            fallbackIntent,
            gameState,
            actionsMap,
            jevCanaryConfig,
          );
          application.telemetry.canary = application.telemetry.canary
            ? {
                ...application.telemetry.canary,
                gpt_director_ran: true,
                primary_model_called: true,
                final_authority: "primary",
                fallback_occurred: true,
                gpt_cost_avoided_usd: 0,
                fallback_reason: [
                  application.telemetry.canary.fallback_reason,
                  "GPT Director fallback invoked",
                ]
                  .filter(Boolean)
                  .join(" | "),
              }
            : undefined;
          application.telemetry.primary_model_called = true;
          application.telemetry.final_authority = "primary";
          application.telemetry.fallback_occurred = true;
        }
        directorIntent = application.intent!;
        jevShadowPromise = Promise.resolve(application.telemetry);
      } else {
        // Default path is unchanged: GPT/OpenRouter Director is authoritative and Jev,
        // when shadow mode is enabled, runs only as an independent observer.
        console.log("[Turn] Step 2: Calling Director (Strategic Lead)...");
        directorIntent = await resolveDirector();
        jevShadowPromise = evaluateJev("shadow", directorIntent);
      }
      console.log("[Turn] Director Result:", {
        resolutionMode: directorIntent.turn_meta.resolution_mode,
        intentQueueLength: directorIntent.intent_queue.length,
        unseenRipplesCount: directorIntent.unseen_ripples.length,
        firstIntent: directorIntent.intent_queue[0]
          ? {
              trigger_id: directorIntent.intent_queue[0].trigger_id,
              target_count:
                directorIntent.intent_queue[0].intended_targets.length,
              proximity_cluster_size:
                directorIntent.intent_queue[0].proximity_cluster.length,
              verb: directorIntent.intent_queue[0].parameters.verb,
            }
          : null,
      });

      // Convert Director intent_queue to Mas1Intent[] format for Engine (temporary bridge)
      const mas1Intents = directorIntent.intent_queue.map((intent) => ({
        trigger_id: intent.trigger_id as any,
        target_ids: intent.intended_targets,
        parameters: {
          verb: intent.parameters.verb,
          tactic_tag: intent.parameters.tactic_tag,
          skill_id: intent.parameters.skill_id,
          difficulty_mod: 0,
        },
        duration_tag: "moment" as const,
        situational_tags: [],
        original_text: intent.parameters.verb,
      }));

      // Step 3: Engine (Deterministic) - NO MOCKS, pure logic
      // Uses Resolution Ladder (4-tier priority system) for D100 resolution
      console.log(
        "[Turn] Step 3: Calling Engine (Deterministic with Resolution Ladder)...",
      );

      // Extract schema from CompiledStory for strict validation
      const schema = compiledStory.master_schema
        ? {
            tier1_allowlist: compiledStory.master_schema.tier1_allowlist || [],
            tier0_allowlist: compiledStory.master_schema.tier0_allowlist || [],
          }
        : undefined;

      // Initialize StateService (Single Source of Truth) with schema validation
      const stateService = new StateService(gameState, schema);

      // Execute all intents via EngineService (uses Resolution Ladder)
      // Run the Director's intent_queue directly: actor_id (NPC counter-actions), impact_tier and
      // proximity_cluster (fumble cascade) all matter. The legacy mas1 bridge dropped them.
      timeline.mark("engine_start");
      const engineResult = await this.engineService.executeIntentQueue(
        directorIntent,
        stateService.getState(),
        actionsMap,
      );
      timeline.mark("engine_end");

      console.log("[Turn] Engine Result:", {
        success: engineResult.success,
        deltaKeys: Object.keys(engineResult.numeric_deltas),
        stateUpdated: Object.keys(engineResult.numeric_deltas).length > 0,
      });

      // The Director ruled the attempt impossible (flight, conjured items, reality edits):
      // nothing changes in the world and the Narrator must render the attempt failing.
      if (directorIntent.turn_meta.feasibility === "impossible") {
        engineResult.success = false;
        engineResult.outcome_summary = `Impossible: ${directorIntent.turn_meta.feasibility_reason || "the world does not allow this"}. The attempt does not work and nothing changes.`;
      }

      // Convert Director unseen_ripples into relationship deltas on the
      // target entity (0-20 scale, tier-based magnitude). 'status'
      // ripples erode the relationship; relationship/emotional build it.
      const combinedDeltas: Record<string, number> = {
        ...engineResult.numeric_deltas,
      };
      for (const ripple of directorIntent.unseen_ripples ?? []) {
        const axis = ripple.property_path?.split(".").pop();
        if (!axis || !ripple.target_id) continue;
        const multiplier =
          TIER_MULTIPLIERS[ripple.delta_tier] ?? TIER_MULTIPLIERS.Moderate;
        const magnitude = Math.max(1, Math.round(20 * multiplier));
        const sign = ripple.type === "status" ? -1 : 1;
        const path = `entities.${ripple.target_id}.relationships.${axis}`;
        combinedDeltas[path] = (combinedDeltas[path] || 0) + sign * magnitude;
      }

      // Apply all deterministic deltas ONCE. Only what actually landed in
      // state (after clamping / dropped writes) is reported to the client,
      // so the system log can never claim a change that didn't persist.
      const appliedDeltas = stateService.applyDeltas(combinedDeltas);

      // Derive injury/collapse/surrender conditions from the vitals that
      // just changed, per the story's condition rules, BEFORE the
      // Narrator runs — the transitions are handed to MAS2 as facts to
      // render as fiction, never printed to the player directly.
      const conditionTransitions =
        stateService.deriveConditionChanges(conditionRules);

      // Get final authoritative state from StateService
      const finalGameState = stateService.getState();

      // Convert back to GameStateBundle format for compatibility
      // Map tier1_mechanical back to mechanical, tier0_narrative back to narrative
      const engineProcessedState: GameStateBundle = {
        ...state,
        mechanical:
          (finalGameState as any).tier1_mechanical || state.mechanical,
        narrative: (finalGameState as any).tier0_narrative || state.narrative,
      };

      // Convert the APPLIED deltas to nested structure for the client
      const delta = this.nestNumericDeltas(appliedDeltas);
      this.mergeConditionChanges(delta, conditionTransitions);

      const engineResultFormatted = {
        success: engineResult.success,
        state: engineProcessedState, // Authoritative final state from StateService
        delta,
        outcome_summary: engineResult.outcome_summary,
      };

      // CRITICAL: Use the authoritative final state from engineResult
      // This is the state after all intents have been processed sequentially
      // Do NOT fall back to the original state - use the mutated state
      let processedState = engineResultFormatted.state;

      if (!processedState) {
        console.error(
          "[Turn] ❌ Engine did not return state! Using original state as fallback.",
        );
        processedState = state;
      }

      // Verify the state structure is correct
      if (!processedState.mechanical) {
        console.error(
          "[Turn] ❌ Processed state missing mechanical property! State keys:",
          Object.keys(processedState),
        );
        // Try to recover by using original state
        processedState = state;
      }

      // The Director ruled the player moved: update scene location + who is present BEFORE narration
      if (
        applyLocationChange(
          processedState,
          directorIntent.turn_meta.location_change,
        )
      ) {
        console.log(
          "[Turn] Location change:",
          directorIntent.turn_meta.location_change?.name,
        );
      }

      // Step 4: MAS2 (Narrator) - Can have mock AI results
      // Generates narrative and may trigger additional relationship changes
      console.log("[Turn] Step 4: Calling MAS2 (Narrator)...");
      timeline.mark("narrator_start");
      const mas2Result = await this.mas2Service.narrate(
        {
          ...engineResult,
          outcome_summary:
            engineResult.outcome_summary ||
            (engineResult.success ? "Action executed" : "Action failed"),
          numeric_deltas: engineResult.numeric_deltas || {},
          target_results: engineResult.target_results || [],
          status_tags: engineResult.status_tags || {},
        },
        this.convertStateToGameState(processedState),
        mas1Intents[0]?.trigger_id, // Use first intent's trigger_id
        undefined, // worldStyle
        compiledStory,
        directorIntent, // Ripple reasons + accident context for the Narrator
        playerInput, // test_* scenario bypass detection
        conditionTransitions, // Injury/collapse/surrender facts to render as fiction
      );
      timeline.mark("narrator_end");
      console.log("[Turn] MAS2 Result:", {
        ripple_narrative: mas2Result.ripple_narrative?.substring(0, 100),
        hasMutations: !!(
          mas2Result.tier0_mutations &&
          Object.keys(mas2Result.tier0_mutations).length > 0
        ),
      });

      // Step 5: Process MAS2 Mutations (e.g., relationship changes from NPC reactions)
      // If MAS2 detected NPC reactions (e.g., guard's friend gets mad), process them
      if (
        mas2Result.tier0_mutations &&
        Object.keys(mas2Result.tier0_mutations).length > 0
      ) {
        const mutationResult = await this.processMas2Mutations(
          processedState,
          mas2Result.tier0_mutations,
          actionsMap,
          conditionRules,
        );
        processedState = mutationResult.state || processedState;
        // Merge deltas
        if (mutationResult.delta) {
          engineResultFormatted.delta = this.mergeDeltas(
            engineResultFormatted.delta || {},
            mutationResult.delta,
          );
        }
      }

      // Step 5b: Process MAS2 State Updates (social ripple effects)
      // Apply entity relationship changes and world updates from MAS2
      if (mas2Result.state_updates) {
        const stateUpdateDelta = await this.processMas2StateUpdates(
          processedState,
          mas2Result.state_updates,
          actionsMap,
        );
        processedState = stateUpdateDelta.state || processedState;
        if (stateUpdateDelta.delta) {
          engineResultFormatted.delta = this.mergeDeltas(
            engineResultFormatted.delta || {},
            stateUpdateDelta.delta,
          );
        }
      }

      // Step 6: Record History (The Log)
      const nextIndex = await this.storiesRepo.getNextTurnIndex(state.id);
      console.log("[GameLoop] Preparing Turn:", { nextIndex, gameStateId });

      // Convert MAS1 intents to intent format for storage (use first intent)
      const firstIntent = mas1Intents[0];
      const mas1Intent = {
        type:
          firstIntent?.trigger_id === "combat_action" ? "COMBAT" : "NARRATIVE",
        intent: firstIntent?.trigger_id || "attempt_action",
        skill_id: firstIntent?.parameters.skill_id || "root_force",
        difficulty_mod: firstIntent?.parameters.difficulty_mod || 0,
        duration_tag: firstIntent?.duration_tag || "moment",
        confidence: 1.0,
        analysis: "neutral",
        parameters: firstIntent?.parameters || {},
      };

      const jevTelemetry = await jevShadowPromise;
      if (jevTelemetry.canary) {
        const directorCall = llmCalls.find((call) => call.role === "director");
        const gptDirectorRan =
          !!directorCall || jevTelemetry.canary.gpt_director_ran;
        const stateUpdated =
          Object.keys(engineResultFormatted.delta || {}).length > 0;
        jevTelemetry.canary = {
          ...jevTelemetry.canary,
          gpt_director_ran: gptDirectorRan,
          gpt_cost_avoided_usd: gptDirectorRan
            ? 0
            : jevTelemetry.canary.gpt_cost_avoided_usd,
          end_to_end_latency_ms: Date.now() - turnStarted,
          gameplay_outcome: {
            success: engineResultFormatted.success,
            state_updated: stateUpdated,
            delta_keys: Object.keys(engineResultFormatted.delta || {}),
            outcome_summary: engineResultFormatted.outcome_summary || null,
            possible_divergence:
              jevTelemetry.canary.disagreement === true &&
              (stateUpdated ||
                directorIntent.turn_meta.feasibility === "impossible"),
          },
        };
      }

      timeline.mark("persistence_start");
      const recordedTurn = await this.storiesRepo.recordTurn({
        gameStateId: state.id,
        turnIndex: nextIndex,
        playerInput: playerInput,
        directorIntent: {
          ...directorIntent,
          engine_intent: mas1Intent,
          // Persist the comparison beside the authoritative Director result so it can
          // be aggregated later without changing the gameplay state contract.
          jev_shadow: jevTelemetry,
        },
        mechanicalDelta: engineResultFormatted.delta || {},
        narratorOutput: {
          narration: mas2Result.ripple_narrative || "",
          thought_chain: mas2Result.thought_chain || "",
        },
      });

      // [TELEMETRY] One audit row per turn, linked at insert: the turn's real model usage
      // (per-role tokens/cost/latency) captured by llm-telemetry. Legacy meta.traceId rows are
      // still linked when a narrator path supplies one.
      await this.recordTurnAudit(
        state.id!,
        recordedTurn,
        playerInput,
        mas2Result.ripple_narrative || "",
        llmCalls,
        mas2Result.meta?.traceId,
      );

      console.log("[GameLoop] Turn Recorded:", {
        id: recordedTurn.id,
        index: recordedTurn.turn_index,
      });

      // Step 7: Merge & Persist State (The Snapshot)
      // CRITICAL: Ensure processedState is in the correct GameStateBundle format
      // The engine may have mutated the state structure, so we need to ensure it matches
      const finalState: GameStateBundle = {
        id: processedState.id || state.id,
        mechanical: processedState.mechanical || state.mechanical,
        narrative: processedState.narrative || state.narrative,
        registry: processedState.registry || state.registry,
        compiled_system_prompt:
          processedState.compiled_system_prompt || state.compiled_system_prompt,
        updated_at: state.updated_at, // Concurrency token from load time
      };

      // Use finalState (the authoritative, validated state)
      const suggestedActions =
        (directorIntent.turn_meta as any)?.suggested_actions ?? [];
      const newLogs = await this.applyTurnResult(
        finalState,
        {
          narration: mas2Result.ripple_narrative || "",
          thought_chain: mas2Result.thought_chain || "",
        },
        {
          mechanicalDelta: engineResultFormatted.delta || {},
          intent: mas1Intent,
        },
        nextIndex,
        playerInput,
        suggestedActions,
      );
      timeline.mark("persistence_end");

      return {
        success: true,
        state: finalState, // Return the validated final state
        turn: recordedTurn,
        delta: {
          ...(engineResultFormatted.delta || {}),
          ...(suggestedActions.length > 0
            ? { action_queue: suggestedActions }
            : {}),
        },
        new_logs: newLogs,
        runtime_timeline: timeline.snapshot(),
      };
    } catch (error) {
      // NO FALLBACK: Fail fast with clear error message
      console.error("[Turn] ❌ Error in MAS1 -> Engine -> MAS2 flow:", error);
      throw error;
    }
  }

  /**
   * Applies the AI's deterministic output to the DB state
   */
  private async applyTurnResult(
    state: GameStateBundle,
    result: any,
    resolution: any,
    newTurnIndex: number,
    playerInput: string,
    suggestedActions: string[] = [],
  ): Promise<any[]> {
    const newLogs: any[] = [];

    // 1. Append Player Input first (The Action)
    // Note: the thought chain is persisted in chimera_turns.narrator_output,
    // never in the player-facing dialogue_history.
    if (state.narrative.dialogue_history) {
      const entry = {
        id: crypto.randomUUID(),
        role: "player",
        content: playerInput,
        timestamp: new Date(Date.now() - 200).toISOString(), // Slightly in past
      };
      state.narrative.dialogue_history.push(entry);
      newLogs.push(entry);
    }

    // 2. Append Mechanical Delta Log (System)
    if (resolution && resolution.mechanicalDelta) {
      const delta = resolution.mechanicalDelta;
      const logLines: string[] = [];

      // Helper to format deep objects into readable strings (e.g., "Stamina: -5")
      const formatRecursive = (obj: any, prefix = ""): string[] => {
        const parts: string[] = [];
        for (const [key, value] of Object.entries(obj)) {
          // Derived conditions are the Narrator's material, not log
          // output — the player learns "he surrendered" as prose,
          // never as a game-result line.
          if (key === "combat_condition" || key === "physical_condition") {
            continue;
          }
          // Skip technical keys or flatten them
          if (key === "properties" || key === "stats") {
            // auto-flatten common containers
            parts.push(...formatRecursive(value, prefix));
            continue;
          }

          if (typeof value === "object" && value !== null) {
            parts.push(
              ...formatRecursive(value, prefix ? `${prefix} ${key}` : key),
            );
          } else {
            // No-op deltas add noise without information
            if (typeof value === "number" && value === 0) {
              continue;
            }
            // Formatting: "current_stamina" -> "Stamina"
            let niceKey = (prefix ? `${prefix} ${key}` : key)
              .replace(/^current_/, "")
              .replace(/_/g, " ");
            niceKey = niceKey
              .split(" ")
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(" ");
            const displayValue =
              typeof value === "number" && value > 0 ? `+${value}` : `${value}`;
            parts.push(`${niceKey}: ${displayValue}`);
          }
        }
        return parts;
      };

      // A. Handle Entities
      if (delta.entities) {
        for (const [entityId, changes] of Object.entries(delta.entities)) {
          // Resolve Entity Name robustly (matching frontend logic)
          const entity = state.mechanical?.entities?.[entityId];
          const entityName =
            entity?.display_name ||
            entity?.name ||
            entity?.properties?.display_name ||
            entity?.properties?.name ||
            entity?.raw_data?.identity?.name ||
            "Unknown Entity";

          const changesFull = formatRecursive(changes);
          if (changesFull.length > 0) {
            logLines.push(`${entityName} [${changesFull.join(", ")}]`);
          }
        }
      }

      // B. Handle World/Global
      if (delta.world) {
        const worldChanges = formatRecursive(delta.world, "World");
        if (worldChanges.length > 0) {
          logLines.push(`World [${worldChanges.join(", ")}]`);
        }
      }

      // C. Fallback (if old flat format is somehow used)
      const remainingKeys = Object.keys(delta).filter(
        (k) => k !== "entities" && k !== "world",
      );
      if (remainingKeys.length > 0) {
        const otherProps: Record<string, any> = {};
        remainingKeys.forEach((k) => (otherProps[k] = delta[k]));
        const otherChanges = formatRecursive(otherProps);
        if (otherChanges.length > 0) {
          logLines.push(`Global [${otherChanges.join(", ")}]`);
        }
      }

      if (logLines.length > 0) {
        if (state.narrative.dialogue_history) {
          const entry = {
            id: crypto.randomUUID(),
            role: "system",
            content: `${logLines.join(" | ")}`, // Removed [SYSTEM] prefix to let UI handle styling
            timestamp: new Date(Date.now() - 50).toISOString(),
          };
          state.narrative.dialogue_history.push(entry);
          newLogs.push(entry);
        }
      }
    }

    // 4. Append Narrator Response (The Result)
    if (result.narration && state.narrative.dialogue_history) {
      const entry = {
        id: crypto.randomUUID(),
        role: "narrator",
        content: result.narration,
        timestamp: new Date().toISOString(),
      };
      state.narrative.dialogue_history.push(entry);
      newLogs.push(entry);
    }

    // 5. Persist
    // CRITICAL: Use the authoritative state passed to this method
    // This should be the final processedState from processTurn, not a stale copy
    if (!state.mechanical) {
      console.error(
        "[PERSIST] ❌ State missing mechanical property! State keys:",
        Object.keys(state),
      );
      throw new Error("Cannot persist state: missing mechanical property");
    }

    const updatePayload = {
      mechanical_state: state.mechanical, // Use the authoritative state from processTurn
      narrative_focus: { ...state.narrative, committed_turn: newTurnIndex }, // Published with the authoritative snapshot
      // Who is where (presence/location changes) must survive to the next turn
      ...(state.registry ? { scene_registry: state.registry } : {}),
      action_queue: suggestedActions, // Next-turn suggestions from the Director
      // turn_index updated by Repo
    };

    // Optimistic concurrency: reject if another turn persisted since we loaded
    await this.storiesRepo.updateGameState(
      state.id,
      updatePayload,
      state.updated_at,
    );

    return newLogs;
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  /**
   * Extract actionsMap from compiled story
   */
  private extractActionsMap(compiledStory: any): Record<string, unknown> {
    // Try config_mechanics first (new architecture)
    if (compiledStory.config_mechanics?.runtime?.actions) {
      return compiledStory.config_mechanics.runtime.actions;
    }
    // Fallback to legacy config_engine
    if (compiledStory.config_engine?.runtime?.actions) {
      return compiledStory.config_engine.runtime.actions;
    }
    // Fallback to master_schema
    if (compiledStory.master_schema?.actions_map) {
      const actionsMap: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(
        compiledStory.master_schema.actions_map,
      )) {
        try {
          actionsMap[key] =
            typeof value === "string" ? JSON.parse(value) : value;
        } catch {
          actionsMap[key] = value;
        }
      }
      return actionsMap;
    }
    return {};
  }

  /**
   * Convert GameStateBundle to GameState format expected by MAS1/MAS2
   */
  private async recordTurnAudit(
    gameId: string,
    recordedTurn: { id?: string; turn_index?: number } | undefined,
    playerInput: string,
    narration: string,
    llmCalls: LlmCallRecord[],
    legacyTraceId?: string,
  ): Promise<void> {
    if (!recordedTurn?.id) {
      console.warn("[GameLoop] Turn audit skipped: turn was not recorded", {
        gameId,
      });
      return;
    }
    try {
      if (legacyTraceId)
        await this.storiesRepo.linkAuditLogToTurn(
          legacyTraceId,
          recordedTurn.id,
        );
      const usage = summarizeLlmCalls(llmCalls);
      const models = [...new Set(llmCalls.map((c) => c.served))];
      await this.storiesRepo.recordTurnAudit({
        gameId,
        turnId: recordedTurn.id,
        turnIndex: recordedTurn.turn_index ?? 0,
        actionType: "TURN",
        promptText: playerInput,
        rawResponse: narration,
        tokenUsage: usage,
        modelUsed: models.length ? models.join(",") : "mock",
      });
    } catch (err) {
      console.warn(
        "[GameLoop] Turn audit failed (non-fatal):",
        err instanceof Error ? err.message : err,
      );
    }
  }

  private convertStateToGameState(state: GameStateBundle): any {
    // Extract player_id from mechanical state
    const playerId = state.mechanical?.index?.player_id;

    return {
      story_id: state.id || "", // Use state ID as story_id
      player_id: playerId || "", // Extract player_id from mechanical.index
      tier1_mechanical: state.mechanical || {},
      tier0_narrative: state.narrative || {},
      tier2_spatial: state.registry || {},
    };
  }

  /**
   * Flatten delta to numeric_deltas format for EngineResultDto
   */
  private flattenDeltaToNumeric(
    delta: Record<string, any>,
  ): Record<string, number> {
    const numeric: Record<string, number> = {};
    if (delta.entities) {
      for (const [entityId, changes] of Object.entries(delta.entities)) {
        if (typeof changes === "object" && changes !== null) {
          for (const [key, value] of Object.entries(changes)) {
            if (typeof value === "number") {
              numeric[`entities.${entityId}.${key}`] = value;
            }
          }
        }
      }
    }
    return numeric;
  }

  /**
   * Process MAS2 mutations (e.g., NPC relationship changes)
   * These may trigger additional engine calls for relationship updates
   */
  private async processMas2Mutations(
    state: GameStateBundle,
    mutations: Record<string, unknown>,
    actionsMap: Record<string, unknown>,
    conditionRules: ConditionRules,
  ): Promise<{ state: GameStateBundle; delta?: Record<string, any> }> {
    const gameState = this.convertStateToGameState(state);
    // We reuse the StateService to apply numeric deltas safely
    const stateService = new StateService(gameState, undefined);

    const numericMutations: Record<string, number> = {};
    for (const [key, value] of Object.entries(mutations)) {
      if (typeof value === "number") {
        numericMutations[key] = value;
      } else if (key === "memory_stream" && state.narrative) {
        state.narrative.memory_stream = value as any[];
      }
    }

    const appliedMutations = stateService.applyDeltas(numericMutations);

    // Narrator mutations can move vitals too — recompute conditions
    const conditionTransitions =
      stateService.deriveConditionChanges(conditionRules);

    const finalGameState = stateService.getState();
    const mutatedState: GameStateBundle = {
      ...state,
      mechanical: (finalGameState as any).tier1_mechanical || state.mechanical,
    };

    // Report only the mutations that actually landed in state
    const deltaResult = this.nestNumericDeltas(appliedMutations);
    this.mergeConditionChanges(deltaResult, conditionTransitions);

    return { state: mutatedState, delta: deltaResult };
  }

  /**
   * Fold derived condition transitions into the nested client delta under
   * entities.<id>.properties. This keeps the HUD state in sync (icons,
   * badges); the system-log formatter explicitly SKIPS these keys — the
   * Narrator, not the log, tells the player what happened.
   */
  private mergeConditionChanges(
    delta: Record<string, any>,
    transitions: ConditionTransition[],
  ): void {
    for (const transition of transitions) {
      if (!delta.entities) delta.entities = {};
      if (!delta.entities[transition.entity_id])
        delta.entities[transition.entity_id] = {};
      if (!delta.entities[transition.entity_id].properties)
        delta.entities[transition.entity_id].properties = {};
      delta.entities[transition.entity_id].properties[transition.property] =
        transition.to;
    }
  }

  /**
   * Convert flat dot-path numeric deltas into a nested delta object.
   * Rewrites top-level `relationships.<entityId>.<axis>` paths to
   * `entities.<entityId>.relationships.<axis>` so every entity-scoped change
   * lives under `entities` — the system-log formatter and the client's
   * additive merge both key entity names off that shape.
   */
  private nestNumericDeltas(flat: Record<string, number>): Record<string, any> {
    const nested: Record<string, any> = {};
    for (const [rawPath, value] of Object.entries(flat)) {
      let path = rawPath;
      const relMatch = /^relationships\.([^.]+)\.(.+)$/.exec(rawPath);
      if (relMatch) {
        path = `entities.${relMatch[1]}.relationships.${relMatch[2]}`;
      }

      if (!path.includes(".")) {
        nested[path] = value;
        continue;
      }

      const parts = path.split(".");
      let current: Record<string, any> = nested;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]] || typeof current[parts[i]] !== "object") {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
    }
    return nested;
  }

  /**
   * Process MAS2 state_updates (social ripple effects)
   * Applies entity relationship changes and world updates
   */
  private async processMas2StateUpdates(
    state: GameStateBundle,
    stateUpdates: {
      entity_updates: Array<{
        id: string;
        path: string;
        value: number | string | boolean;
        description?: string;
      }>;
      world_updates: Record<string, unknown>;
    },
    actionsMap: Record<string, unknown>,
  ): Promise<{ state: GameStateBundle; delta?: Record<string, any> }> {
    const delta: Record<string, any> = {
      entities: {},
      world: {},
    };

    // Process entity updates (relationship changes)
    // Relationships live ON the entity (entities.<id>.relationships.<axis>)
    // — the same location the engine ripples target, the client merges, and
    // the vitals/inspector UI reads. (They previously went to a detached
    // mechanical.ledgers map that nothing displayed or reloaded.)
    for (const update of stateUpdates.entity_updates) {
      // Parse the path (e.g., "relationships.player.trust")
      const pathParts = update.path.split(".");

      if (
        pathParts[0] === "relationships" &&
        pathParts.length >= 3 &&
        typeof update.value === "number"
      ) {
        const mech = ((state as any).mechanical_state ||
          state.mechanical ||
          {}) as MechanicalState;
        const entity = mech.entities?.[update.id];
        if (!entity) {
          console.warn(
            `[Turn] MAS2 relationship update for unknown entity ${update.id} — skipped`,
          );
          continue;
        }

        if (!entity.relationships || typeof entity.relationships !== "object") {
          entity.relationships = {};
        }
        const relationships = entity.relationships as Record<string, number>;

        // Extract relationship axis (e.g., "trust" from "relationships.player.trust")
        const axis = pathParts[pathParts.length - 1];
        // Migrate from the legacy ledger location if the axis was tracked there
        const legacyValue = (mech as any).ledgers?.relationships?.[update.id]?.[
          axis
        ];
        const current =
          relationships[axis] ??
          (typeof legacyValue === "number" ? legacyValue : 5);

        // Apply change (value is a delta, not absolute), clamped to 0-20
        const newValue = Math.max(0, Math.min(20, current + update.value));
        relationships[axis] = newValue;

        // The client applies deltas additively, so record the change
        // that actually landed after clamping — not the absolute value.
        const applied = newValue - current;
        if (applied !== 0) {
          if (!delta.entities[update.id]) {
            delta.entities[update.id] = {};
          }
          if (!delta.entities[update.id].relationships) {
            delta.entities[update.id].relationships = {};
          }
          delta.entities[update.id].relationships[axis] = applied;
        }
      }
    }

    // Process world updates
    for (const [path, value] of Object.entries(stateUpdates.world_updates)) {
      // Parse path (e.g., "narrative.atmosphere")
      const pathParts = path.split(".");
      if (pathParts[0] === "narrative") {
        const narrative = state.narrative || {};
        const targetKey = pathParts.slice(1).join(".");

        // Set nested value
        const setNested = (obj: any, keys: string[], val: unknown) => {
          const [first, ...rest] = keys;
          if (rest.length === 0) {
            obj[first] = val;
          } else {
            if (!obj[first]) obj[first] = {};
            setNested(obj[first], rest, val);
          }
        };

        setNested(narrative, targetKey.split("."), value);
        state.narrative = narrative;

        // Add to delta
        if (!delta.world.narrative) {
          delta.world.narrative = {};
        }
        setNested(delta.world.narrative, targetKey.split("."), value);
      }
    }

    // Clean up empty objects
    if (Object.keys(delta.entities).length === 0) {
      delete delta.entities;
    }
    if (Object.keys(delta.world).length === 0) {
      delete delta.world;
    }

    return { state, delta: Object.keys(delta).length > 0 ? delta : undefined };
  }

  /**
   * Merge two delta objects. Entity sub-objects are merged deeply (a shallow
   * assign would clobber sibling keys like `properties` vs `relationships`),
   * and overlapping numeric deltas are summed since deltas are additive.
   * Stray top-level `relationships.<id>` maps are folded under `entities`.
   */
  private mergeDeltas(
    delta1: Record<string, any>,
    delta2: Record<string, any>,
  ): Record<string, any> {
    const merged = { ...delta1 };

    const entities2: Record<string, any> = { ...(delta2.entities || {}) };
    if (delta2.relationships) {
      for (const [id, rels] of Object.entries(delta2.relationships)) {
        entities2[id] = {
          ...(entities2[id] || {}),
          relationships: {
            ...((entities2[id] || {}).relationships || {}),
            ...(rels as Record<string, any>),
          },
        };
      }
    }

    if (Object.keys(entities2).length > 0) {
      if (!merged.entities) merged.entities = {};
      for (const [id, changes] of Object.entries(entities2)) {
        merged.entities[id] = this.deepMergeDelta(
          merged.entities[id] || {},
          changes as Record<string, any>,
        );
      }
    }

    if (delta2.world) {
      merged.world = this.deepMergeDelta(merged.world || {}, delta2.world);
    }

    return merged;
  }

  private deepMergeDelta(
    base: Record<string, any>,
    patch: Record<string, any>,
  ): Record<string, any> {
    const out = { ...base };
    for (const [key, value] of Object.entries(patch)) {
      if (typeof value === "number" && typeof out[key] === "number") {
        out[key] = out[key] + value;
      } else if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        out[key] &&
        typeof out[key] === "object" &&
        !Array.isArray(out[key])
      ) {
        out[key] = this.deepMergeDelta(out[key], value);
      } else {
        out[key] = value;
      }
    }
    return out;
  }

  private async loadState(
    gameId: string,
    userId: string,
  ): Promise<GameStateBundle> {
    // REFACTOR: Use StoriesRepo
    const data = await this.storiesRepo.loadGameState(gameId);

    if (!data) {
      throw new ServiceError(404, {
        code: ApiErrorCode.NOT_FOUND,
        message: "Game not found.",
      });
    }
    if (data.player_id !== userId)
      throw new ServiceError(403, {
        code: ApiErrorCode.FORBIDDEN,
        message: "This game belongs to another player.",
      });

    // Map GameState (DB DTO) to GameStateBundle (Domain)
    return {
      id: data.id!,
      compiled_story_id: data.compiled_story_id,
      player_character_id: data.player_character_id,
      state_initialization_version: data.state_initialization_version,
      mechanical: data.mechanical_state as MechanicalState,
      narrative: data.narrative_focus as NarrativeFocus,
      registry: data.scene_registry as SceneRegistry,
      queue: data.action_queue as any[],
      compiled_system_prompt: data.compiled_system_prompt || "",
      current_turn_index: 0, // We'd need to count turns or fetch max index. For now, 0 or pass-through.
      updated_at: (data as any).updated_at,
    };
  }
}
