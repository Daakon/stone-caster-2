import { describe, expect, it } from "vitest";
import { RulesetSchema } from "./schemas.js";

describe("compiled ruleset definition round trip", () => {
  it("preserves definition extensions and hash provenance through parsing", () => {
    const input = {
      id: "rule",
      key: "custom",
      content_hash: "a".repeat(64),
      definition: {
        state_contributions: {
          tier1_entity: { definitions: { score: { value: 0 } } },
        },
        hud_manifest: { version: 1, modules: [] },
        future_extension: { kept: true },
      },
    };
    expect(RulesetSchema.parse(input)).toEqual(input);
    expect(
      RulesetSchema.parse({
        ...input,
        definition: JSON.stringify(input.definition),
      }),
    ).toEqual(input);
  });
});
