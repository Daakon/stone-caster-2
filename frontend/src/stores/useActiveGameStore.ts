import {
  record,
  text,
  number,
  strings,
  parse,
} from "@/features/play/utils/value";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { toast } from "sonner";
import { activeGameApi } from "@/features/active-game/services/activeGameApi";
import type { GameState } from "@shared/types/chimera-runtime";

type InputMode = "idle" | "drafting" | "thinking" | "locked";

interface Vitals {
  hp: number;
  maxHp: number;
  stamina: number; // 0-100%
  saturation: number; // 0-100%
  inCombat: boolean;
  /** Player's non-default condition (e.g. "Wounded", "Collapsed"), null when fine */
  condition: string | null;
}

interface ActiveGameState {
  // Session State
  activeGameId: string | null;
  gameState: GameState | null; // The Session Truth

  // Input State
  draftText: string;
  inputMode: InputMode;
  /** The input currently being processed by the server (renders as a pending turn in the feed) */
  pendingInput: string | null;
  lastError: string | null;

  // Derived/Buffered Utils (Hydrated from GameState)
  vitals: Vitals;
  entities: Record<string, unknown>;
  suggested_actions: string[];

  // Actions
  setActiveGameId: (id: string) => void;
  setDraft: (text: string) => void;

  // Hybrid Sync Pattern
  syncState: (serverState: GameState) => void;
  commitInput: () => Promise<void>;

  // Utils
  lockInput: () => void;
  unlockInput: () => void;
  clearDraft: () => void;

  // UI State
  selectedEntityId: string | null;
  setSelectedEntity: (id: string | null) => void;
}

/**
 * Implied baselines for entity resource properties that the server creates on first write
 * (mirrors backend StateService.PROPERTY_BASELINES). A delta against an absent resource
 * applies to the baseline, exactly as the server persists it (100 + -9 => 91, not -9).
 */
const RESOURCE_BASELINES: Record<string, number> = {
  hp: 100,
  maxHp: 100,
  max_hp: 100,
  current_stamina: 100,
  stamina: 100,
  satiety: 100,
  saturation: 100,
};

/**
 * Apply a server delta additively: numbers add onto numbers, nested objects
 * merge recursively, everything else overwrites.
 */
const applyAdditiveDelta = (
  target: Record<string, unknown>,
  source: Record<string, unknown>,
) => {
  for (const key of Object.keys(source)) {
    const val = source[key];
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      if (
        !target[key] ||
        typeof target[key] !== "object" ||
        Array.isArray(target[key])
      ) {
        target[key] = {};
      }
      applyAdditiveDelta(record(target[key]), record(val));
    } else if (typeof val === "number" && typeof target[key] === "number") {
      target[key] = number(target[key]) + val;
    } else if (
      typeof val === "number" &&
      target[key] === undefined &&
      key in RESOURCE_BASELINES
    ) {
      target[key] = (RESOURCE_BASELINES[key] ?? 0) + val;
    } else {
      target[key] = val;
    }
  }
};

export const useActiveGameStore = create<ActiveGameState>()(
  devtools(
    (set, get) => ({
      // Initial State
      activeGameId: null,
      gameState: null,
      draftText: "",
      inputMode: "idle",
      pendingInput: null,
      lastError: null,

      // Default Derived
      vitals: {
        hp: 100,
        maxHp: 100,
        stamina: 100,
        saturation: 100,
        inCombat: false,
        condition: null,
      },
      entities: {},
      suggested_actions: [],

      // Actions
      setActiveGameId: (id) => {
        set({ activeGameId: id });
      },

      setDraft: (text) => {
        set((state) => ({
          draftText: text,
          inputMode:
            state.inputMode === "thinking" || state.inputMode === "locked"
              ? state.inputMode
              : "drafting",
        }));
      },

      // core sync logic
      syncState: (serverState: GameState) => {
        // 1. Update Truth
        const anyState = record(serverState); // Cast for loose access to shards

        // 2. Extract Shards
        const mech = record(
          anyState.mechanical_state ??
            anyState.tier1_mechanical ??
            record(anyState.state).tier1_mechanical,
        );
        const narrative = record(
          anyState.narrative_focus ??
            anyState.tier0_narrative ??
            anyState.narrative,
        );
        const queue = strings(anyState.action_queue);

        // 3. Locate Player Entity
        // Try mechanical index first (most reliable), then root player_id, then fallback search
        const playerId =
          text(record(mech.index).player_id) || text(anyState.player_id);
        const allEntities = record(mech.entities);

        let playerEntity = playerId ? allEntities[playerId] : undefined;
        if (!playerEntity) {
          // Fallback: search by type if ID lookup fails
          playerEntity = Object.values(allEntities).find(
            (e) => record(e).type === "PLAYER" || record(e).type === "player",
          );
        }

        // 4. Extract Vitals
        let newVitals = get().vitals;
        if (playerEntity && record(playerEntity).properties) {
          const props = record(record(playerEntity).properties);

          // CRITICAL: Read current_stamina (the resource), not stamina (which might be max/static)
          const currentStamina = number(
            props.current_stamina ?? props.stamina,
            100,
          );
          const currentSatiety = number(props.satiety ?? props.saturation, 100);

          // Surface the most urgent non-default condition (combat first)
          const combatCondition =
            props.combat_condition && props.combat_condition !== "Healthy"
              ? text(props.combat_condition)
              : null;
          const physicalCondition =
            props.physical_condition && props.physical_condition !== "Rested"
              ? text(props.physical_condition)
              : null;

          newVitals = {
            hp: number(props.hp, 100),
            maxHp: number(props.maxHp ?? props.max_hp, 100),
            stamina: currentStamina, // Use current_stamina for reactivity
            saturation: currentSatiety, // Use satiety for reactivity
            inCombat: mech.in_combat === true,
            condition: combatCondition || physicalCondition,
          };
        } else if (mech.health) {
          // Fallback to legacy global stats if entities missing
          newVitals = {
            hp: number(record(mech.health).current, 100),
            maxHp: number(record(mech.health).max, 100),
            stamina: number(record(mech.stamina).current, 100),
            saturation: 100,
            inCombat: mech.in_combat === true,
            condition: null,
          };
        }

        // 5. Extract Context
        const ctx = record(narrative.scene_context);

        // [CLIENT-SIDE MIGRATION] Patch legacy states missing location/time
        if (!ctx.location) ctx.location = ctx.name || "Unknown Location";
        if (!ctx.time) ctx.time = "Unknown";

        // Suggestions: Check Queue first, then context
        const newSuggestions =
          queue.length > 0 ? queue : strings(ctx.available_actions);

        // 6. Update Store
        // CRITICAL: Create new object references to ensure React detects changes
        set({
          gameState: serverState,
          vitals: newVitals,
          suggested_actions: newSuggestions,
          entities: { ...allEntities },
        });
      },

      commitInput: async () => {
        const { draftText, activeGameId, inputMode } = get();

        if (
          !draftText.trim() ||
          !activeGameId ||
          inputMode === "locked" ||
          inputMode === "thinking"
        )
          return;

        // 1. Lock UI; surface the in-flight input in the feed
        set({
          inputMode: "thinking",
          pendingInput: draftText,
          lastError: null,
        });

        try {
          // 2. Call API
          const response: unknown = await activeGameApi.submitTurn(
            activeGameId,
            { input: draftText },
          );
          const { delta, new_logs } = record(response);

          // 3. Apply Delta & Append Logs (Event-Driven Update)
          const currentState = get().gameState;
          if (currentState) {
            const stateRecord = record(currentState);
            // A. Identify Keys
            const mechKey = stateRecord.tier1_mechanical
              ? "tier1_mechanical"
              : stateRecord.mechanical_state
                ? "mechanical_state"
                : "mechanical";
            const narrKey = stateRecord.narrative_focus
              ? "narrative_focus"
              : stateRecord.tier0_narrative
                ? "tier0_narrative"
                : "narrative";

            const anyDelta = record(delta);

            // B. Structured delta application — each delta root has a home:
            //    entities → mechanical shard (additive), world.narrative →
            //    narrative shard, action_queue → suggestions. Unknown roots
            //    are ignored rather than blindly merged into mechanics.
            const updatedMechanical = record(
              parse(JSON.stringify(stateRecord[mechKey] ?? {})),
            );
            if (anyDelta.entities) {
              if (!updatedMechanical.entities) updatedMechanical.entities = {};
              applyAdditiveDelta(
                record(updatedMechanical.entities),
                record(anyDelta.entities),
              );
            }

            // C. Append New Logs + narrative-scoped world changes
            const updatedNarrative = record(
              parse(JSON.stringify(stateRecord[narrKey] ?? {})),
            );
            if (record(anyDelta.world).narrative) {
              applyAdditiveDelta(
                updatedNarrative,
                record(record(anyDelta.world).narrative),
              );
            }
            const currentHistory = Array.isArray(
              updatedNarrative.dialogue_history,
            )
              ? (updatedNarrative.dialogue_history as unknown[])
              : [];
            updatedNarrative.dialogue_history = [
              ...currentHistory,
              ...(Array.isArray(new_logs) ? (new_logs as unknown[]) : []),
            ];

            // D. Construct New State
            const newState: GameState = {
              ...currentState,
              [mechKey]: updatedMechanical,
              [narrKey]: updatedNarrative,
              ...(Array.isArray(anyDelta.action_queue) &&
              anyDelta.action_queue.length > 0
                ? { action_queue: strings(anyDelta.action_queue) }
                : {}),
            };

            // E. Sync Store
            get().syncState(newState);
          }

          // 4. Reset UI
          set({ inputMode: "idle", draftText: "", pendingInput: null });
        } catch (error) {
          console.error("[ActiveGameStore] Turn failed:", error);
          const message =
            error instanceof Error && error.message
              ? error.message
              : "Failed to process turn. Please try again.";

          // Keep the draft so the player can retry without retyping
          set({
            inputMode: "drafting",
            pendingInput: null,
            lastError: message,
          });
          toast.error(message, {
            action: {
              label: "Retry",
              onClick: () => {
                void get().commitInput();
              },
            },
          });
        }
      },

      lockInput: () => {
        set({ inputMode: "locked" });
      },
      unlockInput: () => {
        set({ inputMode: "idle" });
      },
      clearDraft: () => {
        set({ draftText: "", inputMode: "idle" });
      },

      selectedEntityId: null,
      setSelectedEntity: (id) => {
        set({ selectedEntityId: id });
      },
    }),
    { name: "ActiveGameStore" },
  ),
);
