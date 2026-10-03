import type {
  ContentKeyRef,
  ContentKind,
  FirstPartyCompileSelectionV1,
} from "@shared/types/chimera-content.js";
import {
  ContentCatalogRepository,
  type ContentCatalogRow,
} from "../../db/repos/content-catalog.repo.js";
import {
  CompiledStoriesRepository,
  FrozenCompileRetryError,
} from "../../db/repos/compiled-stories.repo.js";
import {
  readPinnedStateSources,
  stateDefaults,
} from "../../../../shared/src/types/chimera-state-contributions.js";

const identity = (ref: ContentKeyRef) =>
  `${ref.kind}\u0000${ref.owner_namespace}\u0000${ref.key}`;
const instructionText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value === undefined || value === null) return "";
  return JSON.stringify(value);
};

export class FrozenContentCompileService {
  constructor(
    private readonly catalog: ContentCatalogRepository,
    private readonly compiledStories: CompiledStoriesRepository,
  ) {}

  async compile(selection: FirstPartyCompileSelectionV1): Promise<string> {
    // A sync can commit between catalog reads and the database publish fence.
    // Discard the entire candidate and resolve every key again at the new generation.
    for (let attempt = 0; attempt < 3; attempt++) {
      const generation = await this.catalog.getGeneration();
      try {
        return await this.compileAtGeneration(selection, generation);
      } catch (error) {
        if (
          attempt === 2 ||
          (!(error instanceof FrozenCompileRetryError) &&
            (await this.catalog.getGeneration()) === generation)
        )
          throw error;
      }
    }
    throw new Error("Content catalog changed repeatedly during compile");
  }

  private async compileAtGeneration(
    selection: FirstPartyCompileSelectionV1,
    generation: number,
  ): Promise<string> {
    const selected = new Map<
      string,
      { row: ContentCatalogRow; role: string }
    >();
    const resolving = new Set<string>();
    const resolve = async (
      ref: ContentKeyRef,
      role: string,
    ): Promise<ContentCatalogRow> => {
      if (ref.owner_namespace !== "first_party")
        throw new Error("F0a compiles accept first-party keys only");
      const id = identity(ref);
      if (resolving.has(id))
        throw new Error(
          `Content dependency cycle detected at ${ref.kind}:${ref.key}`,
        );
      const cached = selected.get(id);
      if (cached) return cached.row;
      resolving.add(id);
      const row = await this.catalog.find(ref);
      if (!row) throw new Error(`Content not found: ${ref.kind}:${ref.key}`);
      if (row.release_state !== "internal" && row.release_state !== "published")
        throw new Error(`Invalid release state for ${ref.kind}:${ref.key}`);
      selected.set(id, { row, role });
      for (const childRef of row.content_refs ?? [])
        await resolve(childRef, "dependency");
      resolving.delete(id);
      return row;
    };

    const worldRef = this.assertKind(selection.world, "world");
    const world = await resolve(worldRef, "world");
    const worldRulesets = Array.isArray(world.body.ruleset_keys)
      ? world.body.ruleset_keys.filter(
          (key): key is string => typeof key === "string",
        )
      : [];
    const requestedRulesets = selection.rulesets.length
      ? selection.rulesets
      : worldRulesets.map((key) => ({
          kind: "ruleset" as const,
          owner_namespace: "first_party",
          key,
        }));
    if (!requestedRulesets.length)
      throw new Error(
        `World ${worldRef.key} has no default rulesets and none were selected`,
      );
    const resolvedRulesets = await Promise.all(
      requestedRulesets.map((ref) =>
        resolve(this.assertKind(ref, "ruleset"), "ruleset"),
      ),
    );
    const selectedRuleKeys = new Set(resolvedRulesets.map((row) => row.key));

    for (const ruleset of resolvedRulesets) {
      const body = ruleset.body;
      const dependencies = Array.isArray(body.dependencies)
        ? body.dependencies.filter(
            (key): key is string => typeof key === "string",
          )
        : [];
      for (const dependency of dependencies)
        if (!selectedRuleKeys.has(dependency))
          throw new Error(
            `Ruleset ${ruleset.key} depends on unselected ruleset ${dependency}`,
          );
    }
    const groups = new Map<string, string>();
    for (const ruleset of resolvedRulesets) {
      const group = ruleset.body.exclusion_group;
      if (typeof group !== "string" || !group) continue;
      const existing = groups.get(group);
      if (existing)
        throw new Error(
          `Exclusion conflict: rulesets ${existing} and ${ruleset.key} share ${group}`,
        );
      groups.set(group, ruleset.key);
    }

    const entities = await Promise.all(
      selection.entities.map((ref) =>
        resolve(this.assertKind(ref, "entity"), "entity"),
      ),
    );
    const lore = await Promise.all(
      (selection.lore ?? []).map((ref) =>
        resolve(this.assertKind(ref, "lore"), "lore"),
      ),
    );
    for (const entity of entities)
      if (entity.body.world_key !== worldRef.key)
        throw new Error(
          `Entity ${entity.key} does not belong to world ${worldRef.key}`,
        );
    for (const fragment of lore)
      if (fragment.body.world_key !== worldRef.key)
        throw new Error(
          `Lore ${fragment.key} does not belong to world ${worldRef.key}`,
        );

    const refs = [...selected.values()].map(({ row, role }) => ({
      role,
      kind: row.content_kind,
      owner_namespace: row.owner_namespace,
      key: row.content_key,
      sha256: row.content_hash,
    }));
    const actions: Record<string, unknown> = {};
    const activeRulesets: Record<string, unknown>[] = [];
    for (const ruleset of resolvedRulesets) {
      const definition = (ruleset.body.definition ?? {}) as Record<
        string,
        unknown
      >;
      Object.assign(
        actions,
        definition.actions && typeof definition.actions === "object"
          ? definition.actions
          : {},
      );
      activeRulesets.push({
        key: ruleset.key,
        definition,
        content_hash: ruleset.content_hash,
      });
    }
    const interpreterInstructions = resolvedRulesets
      .map((row) =>
        instructionText(
          (row.body.definition as any)?.ai_instructions?.mas1_interpreter,
        ),
      )
      .filter(Boolean);
    const narratorInstructions = resolvedRulesets
      .map((row) =>
        instructionText(
          (row.body.definition as any)?.ai_instructions?.mas2_narrator,
        ),
      )
      .filter(Boolean);
    const title =
      selection.title?.trim() || String(world.body.name ?? worldRef.key);
    const defaults = stateDefaults(
      readPinnedStateSources({
        config_engine: { active_rulesets: activeRulesets },
        snapshot_world: world.body,
        source_manifest: refs,
      }),
    );
    const payload = {
      config_engine: {
        runtime: { actions, state_defaults: defaults },
        active_rulesets: activeRulesets,
      },
      config_mechanics: { runtime: { actions, state_defaults: defaults } },
      config_interpreter: { active_rulesets: activeRulesets },
      config_narrator: { active_rulesets: activeRulesets },
      config_ui: { creation_manifest: {}, active_rulesets: activeRulesets },
      creation_manifest: {},
      prompt_interpreter_logic: interpreterInstructions.join("\n\n"),
      prompt_narrator_style: narratorInstructions.join("\n\n"),
      snapshot_world: world.body,
      snapshot_entities: entities.map((entity) => entity.body),
      snapshot_lore: lore.map((fragment) => fragment.body),
      genesis_config: {},
      frozen_title: title,
    };
    return this.compiledStories.publishFrozen(
      generation,
      null,
      title,
      refs,
      payload,
    );
  }

  private assertKind(ref: ContentKeyRef, expected: ContentKind): ContentKeyRef {
    if (
      ref.kind !== expected ||
      ref.owner_namespace !== "first_party" ||
      typeof ref.key !== "string" ||
      !ref.key
    ) {
      throw new Error(`Expected a first-party ${expected} key reference`);
    }
    return ref;
  }
}
