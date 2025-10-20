/**
 * Scenario Loader for AWF Bundle System
 * Phase 3: Scenarios & Startpoints - Load and compact scenario data
 */

/**
 * Compact scenario document for token efficiency
 * @param doc - Raw scenario document
 * @param locale - Optional locale for i18n overlays
 * @returns Compacted scenario data
 */
export function compactScenario(doc: any, locale?: string) {
  const s = doc?.scenario ?? {};
  const i = locale && s.i18n?.[locale] ? s.i18n[locale] : {};
  
  return {
    ref: doc.__ref ?? undefined,        // attach id@version in repo layer if available
    world_ref: doc.world_ref,
    display_name: i.display_name ?? s.display_name,
    synopsis: (i.synopsis ?? s.synopsis ?? "").slice(0, 160),
    start_scene: i.start_scene ?? s.start_scene,
    fixed_npcs: (s.fixed_npcs ?? []).slice(0, 8),     // hard cap for token control
    tags: s.tags ?? [],
    npcs_preview: (s.fixed_npcs ?? []).slice(0, 3).map((npc: any) => npc.npc_ref),
    objectives: s.starting_objectives ?? [],
    flags: s.starting_flags ?? {},
    party: s.starting_party ?? [],
    inventory: s.starting_inventory ?? [],
    resources: s.starting_resources ?? { hp: 100, energy: 100 }
  };
}

/**
 * Load scenario by reference
 * @param repos - Repository factory
 * @param scenarioRef - Scenario reference (id@version)
 * @param locale - Optional locale for i18n
 * @returns Compacted scenario or null if not found
 */
export async function loadScenario(
  repos: any,
  scenarioRef: string,
  locale?: string
): Promise<any | null> {
  if (!scenarioRef) {
    return null;
  }

  const [id, version] = scenarioRef.split('@');
  if (!id || !version) {
    console.warn(`[AWF] Invalid scenario reference format: ${scenarioRef}`);
    return null;
  }

  try {
    const scenario = await repos.scenarios.getByIdVersion(id, version);
    if (!scenario) {
      console.warn(`[AWF] Scenario not found: ${scenarioRef}`);
      return null;
    }

    // Attach reference for compactScenario
    const docWithRef = {
      ...scenario.doc,
      __ref: scenarioRef
    };

    return compactScenario(docWithRef, locale);
  } catch (error) {
    console.error(`[AWF] Error loading scenario ${scenarioRef}:`, error);
    return null;
  }
}
