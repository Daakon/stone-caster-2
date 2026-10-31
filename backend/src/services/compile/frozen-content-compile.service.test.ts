import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { ContentCatalogRow } from "../../db/repos/content-catalog.repo.js";
import { FrozenCompileRetryError } from "../../db/repos/compiled-stories.repo.js";
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

describe("frozen compile GC conflicts", () => {
  const selection = {
    world: {
      kind: "world" as const,
      owner_namespace: "first_party",
      key: "mystika",
    },
    rulesets: [
      {
        kind: "ruleset" as const,
        owner_namespace: "first_party",
        key: "fixture",
      },
    ],
    entities: [],
    lore: [],
  };
  function fixture() {
    const catalog = {
      getGeneration: vi.fn().mockResolvedValue(1),
      find: vi.fn(async (ref: ContentCatalogRow) => ({
        ...ref,
        content_kind: ref.kind,
        content_key: ref.key,
        content_format_version: 1,
        content_hash: "a".repeat(64),
        content_refs: [],
        release_state: "internal" as const,
        catalog_generation: 1,
        body: { key: ref.key },
      })),
    };
    const compiled = { publishFrozen: vi.fn() };
    return {
      catalog,
      compiled,
      service: new FrozenContentCompileService(
        catalog as ConstructorParameters<typeof FrozenContentCompileService>[0],
        compiled as ConstructorParameters<
          typeof FrozenContentCompileService
        >[1],
      ),
    };
  }
  it("re-resolves a GC serialization conflict even when catalog generation did not change", async () => {
    const { catalog, compiled, service } = fixture();
    compiled.publishFrozen
      .mockRejectedValueOnce(new FrozenCompileRetryError("GC race"))
      .mockResolvedValueOnce("published");
    expect(await service.compile(selection)).toBe("published");
    expect(catalog.find).toHaveBeenCalledTimes(4);
    expect(compiled.publishFrozen).toHaveBeenCalledTimes(2);
  });
  it("bounds repeated GC conflicts to three full attempts", async () => {
    const { compiled, service } = fixture();
    compiled.publishFrozen.mockRejectedValue(
      new FrozenCompileRetryError("GC race"),
    );
    await expect(service.compile(selection)).rejects.toThrow("GC race");
    expect(compiled.publishFrozen).toHaveBeenCalledTimes(3);
  });
  it("does not retry ordinary publication failures at a stable generation", async () => {
    const { compiled, service } = fixture();
    compiled.publishFrozen.mockRejectedValue(new Error("permission denied"));
    await expect(service.compile(selection)).rejects.toThrow(
      "permission denied",
    );
    expect(compiled.publishFrozen).toHaveBeenCalledOnce();
  });
});
