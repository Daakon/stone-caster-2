/**
 * NPC Collector for AWF Bundle System
 * Collects candidate NPC refs from multiple sources and applies token caps
 */

export interface NpcCollectorInput {
  game: any;              // games.state_snapshot
  scenario?: any;         // assembled scenario block (if any)
  adventure?: any;        // assembled adventure block (if any)
  ruleset?: any;          // injected ruleset (for caps)
}

/**
 * Collect candidate NPC refs from multiple places, de-dup, cap.
 * 
 * Sources:
 * 1. Scenario fixed party/cast
 * 2. Adventure cast if present
 * 3. Game hot/warm state (relationships, pins, active encounters)
 * 
 * Applies cap from ruleset or default 5
 */
export function collectNpcRefs(input: NpcCollectorInput): string[] {
  const refs = new Set<string>();

  // 1) From scenario fixed party/cast
  (input.scenario?.fixed_npcs ?? []).forEach((x: any) => {
    if (x?.npc_ref) {
      refs.add(x.npc_ref);
    }
  });

  // 2) From adventure cast if present
  (input.adventure?.cast ?? []).forEach((x: any) => {
    if (x?.npc_ref) {
      refs.add(x.npc_ref);
    }
  });

  // 3) From game hot/warm state (relationships, pins, active encounters)
  Object.keys(input.game?.warm?.relationships ?? {}).forEach(npcId => {
    if (npcId) {
      refs.add(npcId);
    }
  });

  (input.game?.warm?.pins ?? []).forEach((p: any) => {
    if (p?.npc_ref) {
      refs.add(p.npc_ref);
    }
  });

  (input.game?.hot?.active_npcs ?? []).forEach((id: string) => {
    if (id) {
      refs.add(id);
    }
  });

  // Apply cap from ruleset or default 5
  const cap = input.ruleset?.token_discipline?.npcs_active_cap ?? 5;
  return Array.from(refs).slice(0, cap);
}
