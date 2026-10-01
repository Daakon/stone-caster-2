import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyMutation,
  applyMutations,
} from "../../src/services/play/mutation-applier.js";
import { validateMutations } from "../../src/services/play/mutation-validator.js";
import { processEngineRequests } from "../../src/services/play/engine-request-processor.js";
import { resolveAction } from "../../src/services/play/action-resolver.js";
import { parseAction } from "../../src/services/play/action-parser.js";
import { generateNarrative } from "../../src/services/play/mas-context-provider.js";
import { createInitialState } from "../../src/services/play/state-factory.js";
import type { GameStateTiers } from "../../src/services/play/action-parser.js";
import type { CompiledStoryJson } from "../../src/services/chimera/rebuild-service.js";
import type { MutationDto } from "../../src/services/play/action-resolver.js";

const db = vi.hoisted(() => ({
  single: vi.fn(),
  insert: vi.fn<[Record<string, unknown>], unknown>(),
}));
vi.mock("../../src/services/supabase.js", () => ({
  supabaseAdmin: {
    from: () => ({ insert: db.insert, select: () => ({ single: db.single }) }),
  },
}));
const state = (): GameStateTiers => ({
  tier0_tracked_state: { location: "Inn" },
  tier1_singular_state: {
    world_time: "2026-01-01T00:00:00.000Z",
    actor_health: { player: 75, enemy: 60 },
  },
  tier2_relational_state: {
    player_skills: { lockpicking: 10, combat: 10, invalid: "bad" },
  },
});
const compiled = (schema: Record<string, unknown>): CompiledStoryJson => ({
  final_state_schema: schema,
  action_context_json: { action_rules: {}, elements: {} },
  parser_context_json: {
    prompt_rules: [],
    available_actions: [],
    available_entities: [],
  },
  narrative_context_json: { prompt_rules_with_guardrails: [], rag_index: [] },
});
beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  db.insert.mockImplementation(() => ({
    select: () => ({ single: db.single }),
  }));
  db.single.mockResolvedValue({ data: { id: "game" }, error: null });
});
describe("Strict play mutations", () => {
  it("applies nested set, numeric and array add, array and property removal", () => {
    const target: Record<string, unknown> = {
      tier1_singular_state: { count: 3, list: ["a", "b"], malformed: 2 },
    };
    applyMutations(target, [
      {
        op: "set",
        path: "/tier1_singular_state/malformed/child",
        value: "valid",
      },
      { op: "add", path: "/tier1_singular_state/count", value: 2 },
      { op: "add", path: "/tier1_singular_state/list", value: "c" },
      { op: "remove", path: "/tier1_singular_state/list", value: "a" },
      { op: "remove", path: "/tier1_singular_state/list", value: "missing" },
      { op: "set", path: "/new/deep/key", value: 5 },
      { op: "remove", path: "/new/deep/key", value: null },
    ]);
    expect(target).toEqual({
      tier1_singular_state: {
        count: 5,
        list: ["b", "c"],
        malformed: { child: "valid" },
      },
      new: { deep: {} },
    });
  });
  it.each(["/", "", "/__proto__/polluted", "/constructor/prototype"])(
    "rejects unsafe path %s",
    (path) => {
      expect(() => {
        applyMutation({}, { op: "set", path, value: true });
      }).toThrow();
      expect(Object.prototype).not.toHaveProperty("polluted");
    },
  );
  it("rejects invalid arithmetic and overwrites array parents safely", () => {
    expect(() => {
      applyMutation({ count: "bad" }, { op: "add", path: "/count", value: 2 });
    }).toThrow(/Cannot add/);
    const target = { nested: ["old"] } as Record<string, unknown>;
    applyMutation(target, { op: "set", path: "/nested/new", value: 2 });
    expect(target).toEqual({ nested: { new: 2 } });
  });
  it("allows tier zero mutations and rejects mechanical changes", () => {
    const good: MutationDto = {
      op: "set",
      path: "/tier0_tracked_state/memory",
      value: "Known",
    };
    expect(
      validateMutations([
        good,
        { op: "set", path: "/tier1_singular_state/health", value: 100 },
      ]),
    ).toEqual([good]);
  });
  it("limits AI time, health and skill requests and rejects unknown actions", () => {
    const context = {
      elements: {},
      action_rules: {
        time: { type: "time_update", max_ticks: 3 },
        health: { type: "health_update", max_delta: 5 },
        skill: { type: "skill_check", max_dc: 60 },
        unknown: { type: "other" },
        missingType: {},
      },
    };
    expect(
      processEngineRequests(
        [
          { action: "time", parameters: { ticks: 2 } },
          { action: "time", parameters: { ticks: 4 } },
          { action: "health", parameters: { delta: 2 } },
          { action: "health", parameters: { delta: -6 } },
          { action: "skill", parameters: { dc: 50 } },
          { action: "skill", parameters: { dc: 70 } },
          { action: "unknown" },
          { action: "missingType" },
          { action: "absent" },
        ],
        context,
      ),
    ).toEqual([
      expect.objectContaining({
        path: "/tier1_singular_state/world_time",
      }) as unknown,
      {
        op: "set",
        path: "/tier1_singular_state/actor_health/player",
        value: 2,
      },
    ]);
    expect(
      processEngineRequests(
        [
          { action: "time" },
          { action: "health", target: "npc" },
          { action: "skill" },
        ],
        {
          elements: {},
          action_rules: {
            time: { type: "time_update" },
            health: { type: "health_update" },
            skill: { type: "skill_check" },
          },
        },
      ),
    ).toHaveLength(2);
  });
});
describe("Strict action resolution", () => {
  it.each([0, 0.05, 0.5, 0.8, 0.99])(
    "reports graded skill outcomes at deterministic roll %s",
    async (random) => {
      vi.spyOn(Math, "random").mockReturnValue(random);
      const result = await resolveAction(
        { action: "pick_lock", target: "door" },
        state(),
        {
          elements: {},
          action_rules: {
            pick_lock: { type: "skill_check", skill: "lockpicking", dc: 50 },
          },
        },
      );
      const roll = Math.floor(random * 100) + 1;
      expect(result.outcome.success).toBe(roll + 10 >= 50);
      expect(result.outcome.details).toMatchObject({
        roll,
        skillValue: 10,
        dc: 50,
        total: roll + 10,
      });
      expect(result.mutations).toHaveLength(result.outcome.success ? 1 : 0);
    },
  );
  it("handles unknown action, missing type and missing skill names", async () => {
    expect(
      (
        await resolveAction({ action: "none" }, state(), {
          action_rules: {},
          elements: {},
        })
      ).outcome.success,
    ).toBe(true);
    expect(
      (
        await resolveAction({ action: "none" }, state(), {
          action_rules: { none: {} },
          elements: {},
        })
      ).mutations,
    ).toEqual([]);
    expect(
      (
        await resolveAction({ action: "check" }, state(), {
          action_rules: { check: { type: "skill_check" } },
          elements: {},
        })
      ).outcome.success,
    ).toBe(false);
  });
  it.each(["missing", "invalid", "lockpicking"])(
    "uses numeric skills and safely falls back for %s",
    async (skill) => {
      const result = await resolveAction(
        { action: "check", parameters: { skill } },
        state(),
        {
          elements: {},
          action_rules: { check: { type: "skill_check", difficulty: 20 } },
        },
      );
      expect(result.outcome.details?.skillValue).toBe(
        skill === "lockpicking" ? 10 : 0,
      );
    },
  );
  it("handles absent skill tables and default difficulty", async () => {
    const s = state();
    s.tier2_relational_state = {};
    expect(
      (
        await resolveAction(
          { action: "check", parameters: { skill: "missing" } },
          s,
          { elements: {}, action_rules: { check: { type: "skill_check" } } },
        )
      ).outcome.details,
    ).toMatchObject({ dc: 50, skillValue: 0 });
  });
  it("advances existing time and initializes absent time", async () => {
    const context = {
      elements: {},
      action_rules: { wait: { type: "time_update" } },
    };
    const result = await resolveAction(
      { action: "wait", parameters: { ticks: 3 } },
      state(),
      context,
    );
    expect(result.mutations[0]?.value).toBe("2026-01-01T00:03:00.000Z");
    const s = state();
    s.tier1_singular_state = {};
    expect(
      (await resolveAction({ action: "wait" }, s, context)).outcome.details
        ?.ticks,
    ).toBe(1);
  });
  it.each([-100, -5, 5, 100])(
    "clamps health delta %s to its allowed range",
    async (delta) => {
      const result = await resolveAction(
        { action: "heal", target: "player", parameters: { delta } },
        state(),
        { elements: {}, action_rules: { heal: { type: "health_update" } } },
      );
      expect(result.mutations[0]?.value).toBe(
        Math.max(0, Math.min(100, 75 + delta)),
      );
    },
  );
  it("uses default target and health when no health exists", async () => {
    const s = state();
    s.tier1_singular_state = {};
    const result = await resolveAction({ action: "heal" }, s, {
      elements: {},
      action_rules: { heal: { type: "health_update" } },
    });
    expect(result.mutations[0]?.value).toBe(100);
  });
  it.each([0, 0.99])("applies combat damage only on a hit", async (random) => {
    vi.spyOn(Math, "random").mockReturnValue(random);
    const result = await resolveAction({ action: "attack" }, state(), {
      elements: {},
      action_rules: { attack: { type: "combat", defense: 50 } },
    });
    expect(result.mutations).toHaveLength(random > 0.5 ? 1 : 0);
    if (random > 0.5) expect(result.mutations[0]?.value).toBe(50);
  });
  it("uses attack skill fallback and target health fallback", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const s = state();
    s.tier2_relational_state = { player_skills: { attack: 30 } };
    s.tier1_singular_state = {};
    const result = await resolveAction({ action: "attack", target: "npc" }, s, {
      elements: {},
      action_rules: { attack: { type: "combat", damage: 12 } },
    });
    expect(result.mutations[0]?.value).toBe(88);
  });
});
describe("Parser, narrator and state factory", () => {
  it.each([
    "look",
    "pick the lock",
    "talk to the guide",
    "attack the enemy",
    "move north",
  ])("parses supported input %s", async (input) => {
    const result = await parseAction(
      input,
      { prompt_rules: [], available_actions: [], available_entities: [] },
      state(),
    );
    expect(result.actionDto.action).toBe(
      input === "look"
        ? "look"
        : input.startsWith("pick")
          ? "pick_lock"
          : input.startsWith("talk")
            ? "talk"
            : input.startsWith("attack")
              ? "attack"
              : "move",
    );
  });
  it("includes declared actions and entities and handles empty state", async () => {
    const result = await parseAction(
      "look",
      {
        prompt_rules: ["Respect agency"],
        available_actions: ["move"],
        available_entities: ["guide"],
      },
      {
        tier0_tracked_state: {},
        tier1_singular_state: {},
        tier2_relational_state: {},
      },
    );
    expect(result.detectedSentiment).toEqual({ tone: "neutral", intensity: 5 });
  });
  it.each([true, false])(
    "creates narrative for successful outcome %s",
    async (success) => {
      const result = await generateNarrative(
        { success },
        state(),
        {
          prompt_rules_with_guardrails: ["NEVER take agency", "Tell the story"],
          rag_index: [[1], [2]],
        },
        {
          actionDto: { action: "look" },
          resolvedQuery: "Room",
          detectedSentiment: { tone: "curious", intensity: 5 },
        },
      );
      expect(result.ripple_narrative).toBeTruthy();
      expect(result.mutations[0]?.path).toMatch(/^\/tier0_tracked_state/);
    },
  );
  it("handles empty narrative state, rules and lore", async () => {
    const result = await generateNarrative(
      { success: false },
      {
        tier0_tracked_state: {},
        tier1_singular_state: {},
        tier2_relational_state: {},
      },
      { prompt_rules_with_guardrails: [], rag_index: [] },
      {
        actionDto: { action: "look" },
        resolvedQuery: "",
        detectedSentiment: { tone: "neutral", intensity: 0 },
      },
    );
    expect(result.engine_requests).toEqual([]);
  });
  it("deep clones tier defaults and preserves an explicit zero health", async () => {
    const source = {
      tier0_tracked_state: { events: ["old"] },
      tier1_singular_state: {
        world_time: "saved",
        actor_health: { player: 0 },
      },
      tier2_relational_state: { skills: { stealth: 2 } },
    };
    expect(await createInitialState("story", compiled(source), "user")).toEqual(
      { id: "game" },
    );
    expect(db.insert).toHaveBeenCalledWith(
      expect.objectContaining({ current_game_state: source }),
    );
    expect(source.tier1_singular_state.actor_health.player).toBe(0);
  });
  it("initializes missing defaults and propagates persistence errors", async () => {
    await createInitialState(
      "story",
      compiled({ tier1_singular_state: { actor_health: {} } }),
      "user",
    );
    const inserted: unknown = db.insert.mock.calls[0]?.[0];
    expect(inserted).toMatchObject({
      current_game_state: {
        tier1_singular_state: { actor_health: { player: 100 } },
      },
    });
    db.single.mockResolvedValue({
      data: null,
      error: { message: "Unavailable" },
    });
    await expect(
      createInitialState("story", compiled({}), "user"),
    ).rejects.toThrow("Unavailable");
  });
});
