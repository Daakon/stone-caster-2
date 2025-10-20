/**
 * AWF Adventure Schema Tests (Flexible)
 * Tests for AdventureDocV1Schema with passthrough validation
 */

import { describe, it, expect } from 'vitest';
import { AdventureDocV1Schema } from '../src/validators/awf-adventure.schema.js';

describe('AdventureDocV1Schema (Flexible)', () => {
  const validAdventureDoc = {
    id: "adv.whispercross",
    name: "Whispercross",
    version: "1.0.0",
    world_ref: "world.mystika@1.0.0",
    synopsis: "A mysterious adventure in the Whispercross region.",
    cast: [
      { npc_ref: "npc.kiera@1.0.0" },
      { npc_ref: "npc.tavern_keeper@1.0.0" }
    ],
    slices: ["core", "combat", "social"],
    i18n: {
      es: {
        name: "Crucesusurro",
        synopsis: "Una aventura misteriosa en la región de Crucesusurro."
      },
      fr: {
        name: "Croixmurmure",
        synopsis: "Une aventure mystérieuse dans la région de Croixmurmure."
      }
    },
    // Custom fields (should pass through)
    custom_mechanics: {
      stealth_system: {
        difficulty_modifier: 1.2,
        detection_threshold: 0.8
      }
    },
    story_beats: [
      { act: 1, description: "Introduction to the mystery" },
      { act: 2, description: "Investigation phase" },
      { act: 3, description: "Climax and resolution" }
    ]
  };

  const invalidAdventureDoc = {
    id: "", // Invalid: empty string
    name: "A".repeat(81), // Invalid: too long
    version: "1.0.0",
    world_ref: "", // Invalid: empty string
    synopsis: "A".repeat(281), // Invalid: too long
    cast: Array(25).fill({ npc_ref: "npc.test@1.0.0" }), // Invalid: too many
    slices: Array(25).fill("slice"), // Invalid: too many slices
    i18n: {
      es: {
        name: "A".repeat(81), // Invalid: too long
        synopsis: "A".repeat(281) // Invalid: too long
      }
    }
  };

  describe('Valid adventure documents', () => {
    it('should parse valid adventure with all fields', () => {
      const result = AdventureDocV1Schema.parse(validAdventureDoc);
      expect(result.id).toBe("adv.whispercross");
      expect(result.name).toBe("Whispercross");
      expect(result.world_ref).toBe("world.mystika@1.0.0");
      expect(result.synopsis).toBe("A mysterious adventure in the Whispercross region.");
      expect(result.cast).toHaveLength(2);
      expect(result.slices).toEqual(["core", "combat", "social"]);
      expect(result.custom_mechanics).toBeDefined();
      expect(result.story_beats).toBeDefined();
    });

    it('should parse valid adventure with minimal fields', () => {
      const minimalDoc = {
        id: "adv.test",
        name: "Test Adventure",
        version: "1.0.0",
        world_ref: "world.test@1.0.0"
      };

      const result = AdventureDocV1Schema.parse(minimalDoc);
      expect(result.id).toBe("adv.test");
      expect(result.name).toBe("Test Adventure");
      expect(result.world_ref).toBe("world.test@1.0.0");
    });

    it('should parse adventure without optional fields', () => {
      const docWithoutOptional = {
        id: "adv.test",
        name: "Test Adventure",
        version: "1.0.0",
        world_ref: "world.test@1.0.0",
        custom_field: "value"
      };

      const result = AdventureDocV1Schema.parse(docWithoutOptional);
      expect(result.synopsis).toBeUndefined();
      expect(result.cast).toBeUndefined();
      expect(result.slices).toBeUndefined();
      expect(result.i18n).toBeUndefined();
      expect(result.custom_field).toBe("value");
    });

    it('should parse adventure with cast at limit', () => {
      const docWithMaxCast = {
        id: "adv.test",
        name: "Test Adventure",
        version: "1.0.0",
        world_ref: "world.test@1.0.0",
        cast: Array(24).fill({ npc_ref: "npc.test@1.0.0" })
      };

      const result = AdventureDocV1Schema.parse(docWithMaxCast);
      expect(result.cast).toHaveLength(24);
    });

    it('should preserve custom fields', () => {
      const docWithCustomFields = {
        id: "adv.test",
        name: "Test Adventure",
        version: "1.0.0",
        world_ref: "world.test@1.0.0",
        custom_field1: "value1",
        custom_field2: {
          nested: "value"
        },
        custom_array: [1, 2, 3]
      };

      const result = AdventureDocV1Schema.parse(docWithCustomFields);
      expect(result.custom_field1).toBe("value1");
      expect((result as any).custom_field2.nested).toBe("value");
      expect(result.custom_array).toEqual([1, 2, 3]);
    });
  });

  describe('Invalid adventure documents', () => {
    it('should reject documents with missing id', () => {
      expect(() => {
        AdventureDocV1Schema.parse({
          name: "Test Adventure",
          version: "1.0.0",
          world_ref: "world.test@1.0.0"
        });
      }).toThrow();
    });

    it('should reject documents with empty id', () => {
      expect(() => {
        AdventureDocV1Schema.parse({
          id: "",
          name: "Test Adventure",
          version: "1.0.0",
          world_ref: "world.test@1.0.0"
        });
      }).toThrow();
    });

    it('should reject documents with missing name', () => {
      expect(() => {
        AdventureDocV1Schema.parse({
          id: "adv.test",
          version: "1.0.0",
          world_ref: "world.test@1.0.0"
        });
      }).toThrow();
    });

    it('should reject documents with missing version', () => {
      expect(() => {
        AdventureDocV1Schema.parse({
          id: "adv.test",
          name: "Test Adventure",
          world_ref: "world.test@1.0.0"
        });
      }).toThrow();
    });

    it('should reject documents with missing world_ref', () => {
      expect(() => {
        AdventureDocV1Schema.parse({
          id: "adv.test",
          name: "Test Adventure",
          version: "1.0.0"
        });
      }).toThrow();
    });

    it('should reject documents with empty world_ref', () => {
      expect(() => {
        AdventureDocV1Schema.parse({
          id: "adv.test",
          name: "Test Adventure",
          version: "1.0.0",
          world_ref: ""
        });
      }).toThrow();
    });

    it('should reject documents with synopsis too long', () => {
      expect(() => {
        AdventureDocV1Schema.parse({
          id: "adv.test",
          name: "Test Adventure",
          version: "1.0.0",
          world_ref: "world.test@1.0.0",
          synopsis: "A".repeat(281)
        });
      }).toThrow();
    });

    it('should reject documents with too many cast members', () => {
      expect(() => {
        AdventureDocV1Schema.parse({
          id: "adv.test",
          name: "Test Adventure",
          version: "1.0.0",
          world_ref: "world.test@1.0.0",
          cast: Array(25).fill({ npc_ref: "npc.test@1.0.0" })
        });
      }).toThrow();
    });

    it('should reject documents with too many slices', () => {
      expect(() => {
        AdventureDocV1Schema.parse({
          id: "adv.test",
          name: "Test Adventure",
          version: "1.0.0",
          world_ref: "world.test@1.0.0",
          slices: Array(25).fill("slice")
        });
      }).toThrow();
    });

    it('should reject documents with invalid i18n name length', () => {
      expect(() => {
        AdventureDocV1Schema.parse({
          id: "adv.test",
          name: "Test Adventure",
          version: "1.0.0",
          world_ref: "world.test@1.0.0",
          i18n: {
            es: {
              name: "A".repeat(81)
            }
          }
        });
      }).toThrow();
    });

    it('should reject documents with invalid i18n synopsis length', () => {
      expect(() => {
        AdventureDocV1Schema.parse({
          id: "adv.test",
          name: "Test Adventure",
          version: "1.0.0",
          world_ref: "world.test@1.0.0",
          i18n: {
            es: {
              synopsis: "A".repeat(281)
            }
          }
        });
      }).toThrow();
    });

    it('should reject documents with invalid cast npc_ref', () => {
      expect(() => {
        AdventureDocV1Schema.parse({
          id: "adv.test",
          name: "Test Adventure",
          version: "1.0.0",
          world_ref: "world.test@1.0.0",
          cast: [
            { npc_ref: "" } // Invalid: empty npc_ref
          ]
        });
      }).toThrow();
    });
  });
});
