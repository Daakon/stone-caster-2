import { z } from "zod";

export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
const json: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(json),
    z.record(json),
  ]),
);
const safeKey = z
  .string()
  .regex(/^[a-z][a-z0-9_]*$/i)
  .refine(
    (key) => !["__proto__", "prototype", "constructor"].includes(key),
    "Unsafe runtime field",
  );
const target = z
  .array(z.enum(["player", "npc", "global_rules"]))
  .min(1)
  .optional();
const section = z
  .object({
    target_kind: target,
    definitions: z.record(
      safeKey,
      z.object({ value: json, target_kind: target }).passthrough(),
    ),
    form_hints: z
      .record(
        safeKey,
        z
          .object({
            label: z.string().optional(),
            control: z.string().optional(),
            min: z.number().finite().optional(),
            max: z.number().finite().optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();
const contributions = z.record(
  z.enum(["tier1_entity", "tier1_world", "tier2_system"]),
  section,
);
type StateContributions = z.infer<typeof contributions>;
export type StateScope = keyof StateContributions;
export interface StateSource {
  key: string;
  hash: string;
  kind: "world" | "ruleset";
  contributions: StateContributions;
}
const object = z.record(z.unknown());
const rule = z.object({
  key: z.string().min(1),
  content_hash: z.string().regex(/^[a-f0-9]{64}$/),
  definition: object,
});

function readContributions(value: unknown, source: string): StateContributions {
  // Validate keys before Zod's object copy can discard an own __proto__ key.
  const walk = (value: unknown, path: string): void => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (["__proto__", "prototype", "constructor"].includes(key))
        throw Error(`${path}.${key}: unsafe runtime field`);
      walk(child, `${path}.${key}`);
    }
  };
  walk(value, source);
  if (value && typeof value === "object")
    for (const [scope, raw] of Object.entries(value)) {
      if (raw && typeof raw === "object") {
        const definitions = (raw as Record<string, unknown>).definitions;
        if (definitions && typeof definitions === "object")
          for (const [key, field] of Object.entries(
            definitions as Record<string, unknown>,
          )) {
            if (
              !field ||
              typeof field !== "object" ||
              !Object.hasOwn(field, "value") ||
              (field as Record<string, unknown>).value === undefined
            )
              throw Error(
                `${source}.${scope}.definitions.${key} has no starting value`,
              );
          }
      }
    }
  const result = contributions.safeParse(value ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    throw Error(
      `${source}.${issue?.path.join(".") ?? ""}: invalid starting declaration (${issue?.message ?? "Invalid declaration"})`,
    );
  }
  for (const [scope, section] of Object.entries(result.data)) {
    const allowed =
      scope === "tier1_entity" ? ["player", "npc"] : ["global_rules"];
    for (const targets of [
      section.target_kind,
      ...Object.values(section.definitions).map((field) => field.target_kind),
    ]) {
      if (targets?.some((kind) => !allowed.includes(kind)))
        throw Error(`${source}.${scope}: invalid target_kind`);
    }
  }
  return result.data;
}

/** Read exact definitions from a frozen payload and verify their manifest pins. */
export function readPinnedStateSources(
  compiled: Record<string, unknown>,
): StateSource[] {
  const engine = object.parse(compiled.config_engine);
  const rules = z.array(rule).min(1).parse(engine.active_rulesets);
  const world = object.parse(compiled.snapshot_world);
  const manifest = z
    .array(
      z.object({
        kind: z.string(),
        key: z.string(),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      }),
    )
    .parse(compiled.source_manifest);
  const worldRef = manifest.find(
    (ref) => ref.kind === "world" && ref.key === world.key,
  );
  if (!worldRef)
    throw Error(`Frozen world:${String(world.key)} has no manifest pin`);
  const sources: StateSource[] = [
    {
      kind: "world",
      key: String(world.key),
      hash: worldRef.sha256,
      contributions: readContributions(
        world.character_schema_contributions,
        `world:${String(world.key)}@${worldRef.sha256}`,
      ),
    },
  ];
  const seen = new Set<string>();
  for (const row of rules) {
    if (seen.has(row.key)) throw Error(`Duplicate pinned ruleset:${row.key}`);
    seen.add(row.key);
    if (
      !manifest.some(
        (ref) =>
          ref.kind === "ruleset" &&
          ref.key === row.key &&
          ref.sha256 === row.content_hash,
      )
    ) {
      throw Error(
        `ruleset:${row.key}@${row.content_hash}: manifest pin mismatch`,
      );
    }
    sources.push({
      kind: "ruleset",
      key: row.key,
      hash: row.content_hash,
      contributions: readContributions(
        row.definition.state_contributions,
        `ruleset:${row.key}@${row.content_hash}`,
      ),
    });
  }
  return sources;
}

export function stateDefaults(
  sources: StateSource[],
): Partial<Record<StateScope, Record<string, JsonValue>>> {
  const defaults: Partial<Record<StateScope, Record<string, JsonValue>>> = {};
  for (const source of sources) {
    for (const [scope, section] of Object.entries(source.contributions)) {
      const bag = (defaults[scope as StateScope] ??= {});
      for (const [key, field] of Object.entries(section.definitions)) {
        if (Object.hasOwn(bag, key) && !sameJson(bag[key], field.value)) {
          throw Error(
            `${source.kind}:${source.key}@${source.hash}.${scope}.${key}: conflicting starting values`,
          );
        }
        bag[key] = structuredClone(field.value);
      }
    }
  }
  return defaults;
}

export function sameJson(left: unknown, right: unknown): boolean {
  const canonical = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    if (value && typeof value === "object")
      return `{${Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
        .join(",")}}`;
    return value === undefined ? "undefined" : JSON.stringify(value);
  };
  return canonical(left) === canonical(right);
}

/** Defaults fill absent leaves; supplied values retain precedence and their type. */
export function startingValue(
  current: unknown,
  initial: JsonValue,
  path: string,
): JsonValue {
  if (current === undefined) return structuredClone(initial);
  const parsed = json.safeParse(current);
  if (
    !parsed.success ||
    typeof current !== typeof initial ||
    Array.isArray(current) !== Array.isArray(initial) ||
    (current === null) !== (initial === null)
  )
    throw Error(`${path}: invalid starting value type`);
  if (
    initial !== null &&
    typeof initial === "object" &&
    !Array.isArray(initial)
  ) {
    const result = structuredClone(parsed.data) as Record<string, JsonValue>;
    for (const [key, value] of Object.entries(initial))
      result[key] = startingValue(result[key], value, `${path}.${key}`);
    return result;
  }
  return structuredClone(parsed.data);
}
