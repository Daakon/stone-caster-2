/**
 * AWF Scenario Schema Tests
 * Tests for ScenarioDocV1Schema validation
 */

import { describe, it, expect } from 'vitest';
import { ScenarioDocV1Schema } from '../src/validators/awf-scenario.schema.js';

describe('ScenarioDocV1Schema', () => {
  const validScenarioDoc = {
    world_ref: "world.mystika@1.0.0",
    adventure_ref: "adv.whispercross@1.0.0",
    scenario: {
      display_name: "Last Ember — Common Room",
      synopsis: "A busy inn evening with travelers and rumors.",
      start_scene: "inn.last_ember.common_room",
      fixed_npcs: [
        { npc_ref: "npc.kiera@1.0.0" },
        { npc_ref: "npc.tavern_keeper@1.0.0" }
      ],
      starting_party: [
        { npc_ref: "npc.kiera@1.0.0" }
      ],
      starting_inventory: [
        { item_id: "coin", qty: 10 },
        { item_id: "map" }
      ],
      starting_resources: {
        hp: 100,
        energy: 80
      },
      starting_flags: {
        has_room_key: false
      },
      starting_objectives: [
        { id: "find_room", label: "Find your room", status: "active" }
      ],
      tags: ["inn", "social", "low_combat"],
      slices: ["core", "bio"],
      i18n: {
        es: {
          display_name: "Última Brasa — Sala Común",
          synopsis: "Una noche ocupada en la posada con viajeros y rumores.",
          start_scene: "inn.last_ember.common_room"
        }
      }
    }
  };

  const invalidScenarioDoc = {
    world_ref: "", // Invalid: empty string
    scenario: {
      display_name: "A".repeat(65), // Invalid: too long
      start_scene: "", // Invalid: empty string
      fixed_npcs: Array(13).fill({ npc_ref: "npc.test@1.0.0" }), // Invalid: too many
      starting_party: Array(7).fill({ npc_ref: "npc.test@1.0.0" }), // Invalid: too many
      starting_inventory: Array(41).fill({ item_id: "test" }), // Invalid: too many
      starting_objectives: Array(13).fill({ id: "test", label: "Test" }), // Invalid: too many
      tags: Array(17).fill("tag"), // Invalid: too many
      slices: Array(17).fill("slice") // Invalid: too many
    }
  };

  describe('Valid scenario documents', () => {
    it('should parse valid scenario with all fields', () => {
      const result = ScenarioDocV1Schema.parse(validScenarioDoc);
      expect(result.world_ref).toBe("world.mystika@1.0.0");
      expect(result.scenario.display_name).toBe("Last Ember — Common Room");
      expect(result.scenario.fixed_npcs).toHaveLength(2);
      expect(result.scenario.tags).toEqual(["inn", "social", "low_combat"]);
    });

    it('should parse valid scenario with minimal fields', () => {
      const minimalDoc = {
        world_ref: "world.test@1.0.0",
        scenario: {
          display_name: "Test Scenario",
          start_scene: "test.scene"
        }
      };

      const result = ScenarioDocV1Schema.parse(minimalDoc);
      expect(result.world_ref).toBe("world.test@1.0.0");
      expect(result.scenario.display_name).toBe("Test Scenario");
    });

    it('should parse scenario without adventure_ref', () => {
      const docWithoutAdventure = {
        ...validScenarioDoc,
        adventure_ref: undefined
      };
      delete docWithoutAdventure.adventure_ref;

      const result = ScenarioDocV1Schema.parse(docWithoutAdventure);
      expect(result.adventure_ref).toBeUndefined();
    });
  });

  describe('Invalid scenario documents', () => {
    it('should reject documents with missing world_ref', () => {
      expect(() => {
        ScenarioDocV1Schema.parse({
          scenario: {
            display_name: "Test",
            start_scene: "test.scene"
          }
        });
      }).toThrow();
    });

    it('should reject documents with empty world_ref', () => {
      expect(() => {
        ScenarioDocV1Schema.parse({
          world_ref: "",
          scenario: {
            display_name: "Test",
            start_scene: "test.scene"
          }
        });
      }).toThrow();
    });

    it('should reject documents with missing scenario', () => {
      expect(() => {
        ScenarioDocV1Schema.parse({
          world_ref: "world.test@1.0.0"
        });
      }).toThrow();
    });

    it('should reject documents with missing display_name', () => {
      expect(() => {
        ScenarioDocV1Schema.parse({
          world_ref: "world.test@1.0.0",
          scenario: {
            start_scene: "test.scene"
          }
        });
      }).toThrow();
    });

    it('should reject documents with missing start_scene', () => {
      expect(() => {
        ScenarioDocV1Schema.parse({
          world_ref: "world.test@1.0.0",
          scenario: {
            display_name: "Test"
          }
        });
      }).toThrow();
    });

    it('should reject documents with display_name too long', () => {
      expect(() => {
        ScenarioDocV1Schema.parse({
          world_ref: "world.test@1.0.0",
          scenario: {
            display_name: "A".repeat(65),
            start_scene: "test.scene"
          }
        });
      }).toThrow();
    });

    it('should reject documents with synopsis too long', () => {
      expect(() => {
        ScenarioDocV1Schema.parse({
          world_ref: "world.test@1.0.0",
          scenario: {
            display_name: "Test",
            synopsis: "A".repeat(161),
            start_scene: "test.scene"
          }
        });
      }).toThrow();
    });

    it('should reject documents with too many fixed_npcs', () => {
      expect(() => {
        ScenarioDocV1Schema.parse({
          world_ref: "world.test@1.0.0",
          scenario: {
            display_name: "Test",
            start_scene: "test.scene",
            fixed_npcs: Array(13).fill({ npc_ref: "npc.test@1.0.0" })
          }
        });
      }).toThrow();
    });

    it('should reject documents with too many starting_party', () => {
      expect(() => {
        ScenarioDocV1Schema.parse({
          world_ref: "world.test@1.0.0",
          scenario: {
            display_name: "Test",
            start_scene: "test.scene",
            starting_party: Array(7).fill({ npc_ref: "npc.test@1.0.0" })
          }
        });
      }).toThrow();
    });

    it('should reject documents with too many starting_inventory', () => {
      expect(() => {
        ScenarioDocV1Schema.parse({
          world_ref: "world.test@1.0.0",
          scenario: {
            display_name: "Test",
            start_scene: "test.scene",
            starting_inventory: Array(41).fill({ item_id: "test" })
          }
        });
      }).toThrow();
    });

    it('should reject documents with too many tags', () => {
      expect(() => {
        ScenarioDocV1Schema.parse({
          world_ref: "world.test@1.0.0",
          scenario: {
            display_name: "Test",
            start_scene: "test.scene",
            tags: Array(17).fill("tag")
          }
        });
      }).toThrow();
    });

    it('should reject documents with invalid objective status', () => {
      expect(() => {
        ScenarioDocV1Schema.parse({
          world_ref: "world.test@1.0.0",
          scenario: {
            display_name: "Test",
            start_scene: "test.scene",
            starting_objectives: [
              { id: "test", label: "Test", status: "invalid" }
            ]
          }
        });
      }).toThrow();
    });
  });
});
