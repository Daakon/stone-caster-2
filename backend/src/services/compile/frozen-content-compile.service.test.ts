import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { FrozenContentCompileService } from "./frozen-content-compile.service.js";

describe("frozen compile generation race", () => {
  it("re-resolves every source after a sync commits during publish and never emits a mixed-generation manifest", async () => {
    let generation = 1;
    let releaseFirstPublish!: () => void;
    let firstPublishStarted!: () => void;
    const firstPublish = new Promise<void>((resolve) => {
      firstPublishStarted = resolve;
    });
    const syncCommitted = new Promise<void>((resolve) => {
      releaseFirstPublish = resolve;
    });
    const hash = (kind: string, value: number) =>
      createHash("sha256").update(`${kind}-${value}`).digest("hex");
    const catalog = {
      getGeneration: vi.fn(async () => generation),
      find: vi.fn(async (ref: { kind: string; key: string }) => ({
        ...ref,
        content_kind: ref.kind,
        content_key: ref.key,
        owner_namespace: "first_party",
        content_format_version: 1,
        content_refs: [],
        release_state: "internal",
        catalog_generation: generation,
        content_hash: hash(ref.kind, generation),
        body:
          ref.kind === "world"
            ? { key: "mystika", name: "Mystika" }
            : {
                key: "vitality",
                definition: {
                  state_contributions: {
                    tier1_entity: {
                      definitions: {
                        current_stamina: { value: generation * 100 },
                      },
                    },
                  },
                },
              },
      })),
    };
    const published: {
      generation: number;
      refs: Array<{ sha256: string }>;
      payload: any;
    }[] = [];
    const compiled = {
      publishFrozen: vi.fn(
        async (
          expectedGeneration: number,
          _storyId: null,
          _title: string,
          refs: Array<{ sha256: string }>,
          payload: any,
        ) => {
          published.push({ generation: expectedGeneration, refs, payload });
          if (expectedGeneration === 1) {
            firstPublishStarted();
            await syncCommitted;
            throw new Error(
              "content catalog changed during compile: expected 1, found 2",
            );
          }
          return "00000000-0000-4000-8000-000000000002";
        },
      ),
    };
    const service = new FrozenContentCompileService(
      catalog as any,
      compiled as any,
    );
    const result = service.compile({
      world: { kind: "world", owner_namespace: "first_party", key: "mystika" },
      rulesets: [
        { kind: "ruleset", owner_namespace: "first_party", key: "vitality" },
      ],
      entities: [],
      lore: [],
    });
    await firstPublish;
    // The sync commit lands after the first candidate is resolved but before publish returns.
    generation = 2;
    releaseFirstPublish();
    expect(await result).toBe("00000000-0000-4000-8000-000000000002");
    expect(compiled.publishFrozen).toHaveBeenCalledTimes(2);
    expect(published.map((attempt) => attempt.generation)).toEqual([1, 2]);
    expect(published[1].refs.map((ref) => ref.sha256)).toEqual([
      hash("world", 2),
      hash("ruleset", 2),
    ]);
    expect(
      published[1].payload.config_engine.active_rulesets[0].content_hash,
    ).toBe(hash("ruleset", 2));
    expect(
      published[1].payload.config_engine.active_rulesets[0].definition
        .state_contributions.tier1_entity.definitions.current_stamina.value,
    ).toBe(200);
  });
});
