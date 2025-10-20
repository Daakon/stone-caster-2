/**
 * AWF World Schema Tests (Flexible)
 * Tests for WorldDocV1Schema with passthrough validation
 */

import { describe, it, expect } from 'vitest';
import { WorldDocV1Schema, TimeworldSchema } from '../src/validators/awf-world.schema.js';

describe('WorldDocV1Schema (Flexible)', () => {
  const validWorldDoc = {
    id: "world.mystika",
    name: "Mystika",
    version: "1.0.0",
    timeworld: {
      timezone: "UTC",
      calendar: "gregorian",
      seasons: ["spring", "summer", "autumn", "winter"]
    },
    slices: ["core", "magic", "politics"],
    i18n: {
      es: {
        name: "Místika"
      },
      fr: {
        name: "Mystique"
      }
    },
    // Custom fields (should pass through)
    custom_magic_system: {
      essence_types: ["fire", "water", "earth", "air"],
      casting_requirements: {
        mana_cost: true,
        gesture_required: false
      }
    },
    political_structure: {
      government_type: "monarchy",
      ruling_families: ["House of Mystika", "House of Shadows"]
    }
  };

  const invalidWorldDoc = {
    id: "", // Invalid: empty string
    name: "A".repeat(81), // Invalid: too long
    version: "1.0.0",
    timeworld: {
      timezone: "", // Invalid: empty string
      calendar: "", // Invalid: empty string
      seasons: Array(13).fill("season") // Invalid: too many seasons
    },
    slices: Array(25).fill("slice"), // Invalid: too many slices
    i18n: {
      es: {
        name: "A".repeat(81) // Invalid: too long
      }
    }
  };

  describe('Valid world documents', () => {
    it('should parse valid world with all fields', () => {
      const result = WorldDocV1Schema.parse(validWorldDoc);
      expect(result.id).toBe("world.mystika");
      expect(result.name).toBe("Mystika");
      expect(result.timeworld?.timezone).toBe("UTC");
      expect(result.slices).toEqual(["core", "magic", "politics"]);
      expect(result.custom_magic_system).toBeDefined();
      expect(result.political_structure).toBeDefined();
    });

    it('should parse valid world with minimal fields', () => {
      const minimalDoc = {
        id: "world.test",
        name: "Test World",
        version: "1.0.0"
      };

      const result = WorldDocV1Schema.parse(minimalDoc);
      expect(result.id).toBe("world.test");
      expect(result.name).toBe("Test World");
    });

    it('should parse world without timeworld', () => {
      const docWithoutTimeworld = {
        id: "world.test",
        name: "Test World",
        version: "1.0.0",
        custom_field: "value"
      };

      const result = WorldDocV1Schema.parse(docWithoutTimeworld);
      expect(result.timeworld).toBeUndefined();
      expect(result.custom_field).toBe("value");
    });

    it('should parse world with partial timeworld', () => {
      const docWithPartialTimeworld = {
        id: "world.test",
        name: "Test World",
        version: "1.0.0",
        timeworld: {
          timezone: "UTC",
          calendar: "gregorian"
          // seasons is optional
        }
      };

      const result = WorldDocV1Schema.parse(docWithPartialTimeworld);
      expect(result.timeworld?.timezone).toBe("UTC");
      expect(result.timeworld?.seasons).toBeUndefined();
    });

    it('should preserve custom fields', () => {
      const docWithCustomFields = {
        id: "world.test",
        name: "Test World",
        version: "1.0.0",
        custom_field1: "value1",
        custom_field2: {
          nested: "value"
        },
        custom_array: [1, 2, 3]
      };

      const result = WorldDocV1Schema.parse(docWithCustomFields);
      expect(result.custom_field1).toBe("value1");
      expect((result as any).custom_field2.nested).toBe("value");
      expect(result.custom_array).toEqual([1, 2, 3]);
    });
  });

  describe('Invalid world documents', () => {
    it('should reject documents with missing id', () => {
      expect(() => {
        WorldDocV1Schema.parse({
          name: "Test World",
          version: "1.0.0"
        });
      }).toThrow();
    });

    it('should reject documents with empty id', () => {
      expect(() => {
        WorldDocV1Schema.parse({
          id: "",
          name: "Test World",
          version: "1.0.0"
        });
      }).toThrow();
    });

    it('should reject documents with missing name', () => {
      expect(() => {
        WorldDocV1Schema.parse({
          id: "world.test",
          version: "1.0.0"
        });
      }).toThrow();
    });

    it('should reject documents with missing version', () => {
      expect(() => {
        WorldDocV1Schema.parse({
          id: "world.test",
          name: "Test World"
        });
      }).toThrow();
    });

    it('should reject documents with invalid timeworld timezone', () => {
      expect(() => {
        WorldDocV1Schema.parse({
          id: "world.test",
          name: "Test World",
          version: "1.0.0",
          timeworld: {
            timezone: "",
            calendar: "gregorian"
          }
        });
      }).toThrow();
    });

    it('should reject documents with invalid timeworld calendar', () => {
      expect(() => {
        WorldDocV1Schema.parse({
          id: "world.test",
          name: "Test World",
          version: "1.0.0",
          timeworld: {
            timezone: "UTC",
            calendar: ""
          }
        });
      }).toThrow();
    });

    it('should reject documents with too many seasons', () => {
      expect(() => {
        WorldDocV1Schema.parse({
          id: "world.test",
          name: "Test World",
          version: "1.0.0",
          timeworld: {
            timezone: "UTC",
            calendar: "gregorian",
            seasons: Array(13).fill("season")
          }
        });
      }).toThrow();
    });

    it('should reject documents with too many slices', () => {
      expect(() => {
        WorldDocV1Schema.parse({
          id: "world.test",
          name: "Test World",
          version: "1.0.0",
          slices: Array(25).fill("slice")
        });
      }).toThrow();
    });

    it('should reject documents with invalid i18n name length', () => {
      expect(() => {
        WorldDocV1Schema.parse({
          id: "world.test",
          name: "Test World",
          version: "1.0.0",
          i18n: {
            es: {
              name: "A".repeat(81)
            }
          }
        });
      }).toThrow();
    });
  });

  describe('TimeworldSchema', () => {
    it('should parse valid timeworld', () => {
      const timeworld = {
        timezone: "UTC",
        calendar: "gregorian",
        seasons: ["spring", "summer", "autumn", "winter"]
      };

      const result = TimeworldSchema.parse(timeworld);
      expect(result.timezone).toBe("UTC");
      expect(result.calendar).toBe("gregorian");
      expect(result.seasons).toEqual(["spring", "summer", "autumn", "winter"]);
    });

    it('should parse timeworld without seasons', () => {
      const timeworld = {
        timezone: "UTC",
        calendar: "gregorian"
      };

      const result = TimeworldSchema.parse(timeworld);
      expect(result.timezone).toBe("UTC");
      expect(result.calendar).toBe("gregorian");
      expect(result.seasons).toBeUndefined();
    });

    it('should reject timeworld with empty timezone', () => {
      expect(() => {
        TimeworldSchema.parse({
          timezone: "",
          calendar: "gregorian"
        });
      }).toThrow();
    });

    it('should reject timeworld with empty calendar', () => {
      expect(() => {
        TimeworldSchema.parse({
          timezone: "UTC",
          calendar: ""
        });
      }).toThrow();
    });
  });
});
