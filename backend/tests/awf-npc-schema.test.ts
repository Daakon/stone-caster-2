import { describe, it, expect } from 'vitest';
import { NPCDocV1Schema } from '../src/validators/awf-npc.schema.js';

describe('AWF NPC Schema Validation', () => {
  const validNPCDoc = {
    npc: {
      display_name: "Kiera",
      archetype: "ranger",
      summary: "Sharp-eyed scout who watches from the treeline.",
      tags: ["ally", "scout", "whispercross"],
      traits: { 
        curiosity: 60, 
        caution: 55 
      },
      skills: { 
        tracking: 68, 
        archery: 62 
      },
      style: { 
        voice: "wry, concise, observant", 
        register: "casual" 
      },
      links: { 
        world_ref: "world.mystika@1.0.0", 
        adventure_refs: ["adv.whispercross@1.0.0"] 
      },
      slices: ["core", "bio"]
    }
  };

  const minimalValidNPCDoc = {
    npc: {
      display_name: "Test NPC",
      summary: "A simple test character."
    }
  };

  describe('Valid NPC documents', () => {
    it('should accept a valid NPC with all fields', () => {
      expect(() => NPCDocV1Schema.parse(validNPCDoc)).not.toThrow();
    });

    it('should accept a minimal valid NPC', () => {
      expect(() => NPCDocV1Schema.parse(minimalValidNPCDoc)).not.toThrow();
    });

    it('should parse valid NPC with schema', () => {
      const result = NPCDocV1Schema.parse(validNPCDoc);
      expect(result.npc.display_name).toBe("Kiera");
      expect(result.npc.summary).toBe("Sharp-eyed scout who watches from the treeline.");
      expect(result.npc.tags).toEqual(["ally", "scout", "whispercross"]);
      expect(result.npc.traits?.curiosity).toBe(60);
    });
  });

  describe('Invalid NPC documents', () => {
    it('should reject documents with missing npc', () => {
      expect(() => NPCDocV1Schema.parse({})).toThrow();
    });

    it('should reject documents with missing display_name', () => {
      const invalid = {
        npc: {
          summary: "A test character."
        }
      };
      expect(() => NPCDocV1Schema.parse(invalid)).toThrow();
    });

    it('should reject documents with missing summary', () => {
      const invalid = {
        npc: {
          display_name: "Test NPC"
        }
      };
      expect(() => NPCDocV1Schema.parse(invalid)).toThrow();
    });

    it('should reject documents with empty display_name', () => {
      const invalid = {
        npc: {
          display_name: "",
          summary: "A test character."
        }
      };
      expect(() => NPCDocV1Schema.parse(invalid)).toThrow();
    });

    it('should reject documents with empty summary', () => {
      const invalid = {
        npc: {
          display_name: "Test NPC",
          summary: ""
        }
      };
      expect(() => NPCDocV1Schema.parse(invalid)).toThrow();
    });

    it('should reject documents with display_name too long', () => {
      const invalid = {
        npc: {
          display_name: "A".repeat(65), // 65 chars, max is 64
          summary: "A test character."
        }
      };
      expect(() => NPCDocV1Schema.parse(invalid)).toThrow();
    });

    it('should reject documents with summary too long', () => {
      const invalid = {
        npc: {
          display_name: "Test NPC",
          summary: "A".repeat(161) // 161 chars, max is 160
        }
      };
      expect(() => NPCDocV1Schema.parse(invalid)).toThrow();
    });

    it('should reject documents with too many tags', () => {
      const invalid = {
        npc: {
          display_name: "Test NPC",
          summary: "A test character.",
          tags: Array(17).fill("tag") // 17 tags, max is 16
        }
      };
      expect(() => NPCDocV1Schema.parse(invalid)).toThrow();
    });

    it('should reject documents with invalid trait values', () => {
      const invalid = {
        npc: {
          display_name: "Test NPC",
          summary: "A test character.",
          traits: {
            curiosity: 150 // Invalid: > 100
          }
        }
      };
      expect(() => NPCDocV1Schema.parse(invalid)).toThrow();
    });

    it('should reject documents with negative trait values', () => {
      const invalid = {
        npc: {
          display_name: "Test NPC",
          summary: "A test character.",
          traits: {
            curiosity: -10 // Invalid: < 0
          }
        }
      };
      expect(() => NPCDocV1Schema.parse(invalid)).toThrow();
    });

    it('should reject documents with invalid skill values', () => {
      const invalid = {
        npc: {
          display_name: "Test NPC",
          summary: "A test character.",
          skills: {
            tracking: 101 // Invalid: > 100
          }
        }
      };
      expect(() => NPCDocV1Schema.parse(invalid)).toThrow();
    });

    it('should reject documents with voice too long', () => {
      const invalid = {
        npc: {
          display_name: "Test NPC",
          summary: "A test character.",
          style: {
            voice: "A".repeat(121) // 121 chars, max is 120
          }
        }
      };
      expect(() => NPCDocV1Schema.parse(invalid)).toThrow();
    });

    it('should reject documents with register too long', () => {
      const invalid = {
        npc: {
          display_name: "Test NPC",
          summary: "A test character.",
          style: {
            register: "A".repeat(33) // 33 chars, max is 32
          }
        }
      };
      expect(() => NPCDocV1Schema.parse(invalid)).toThrow();
    });

    it('should reject documents with too many taboos', () => {
      const invalid = {
        npc: {
          display_name: "Test NPC",
          summary: "A test character.",
          style: {
            taboos: Array(13).fill("taboo") // 13 taboos, max is 12
          }
        }
      };
      expect(() => NPCDocV1Schema.parse(invalid)).toThrow();
    });

    it('should reject documents with invalid i18n structure', () => {
      const invalid = {
        npc: {
          display_name: "Test NPC",
          summary: "A test character.",
          i18n: {
            "en-US": {
              display_name: "A".repeat(65) // Too long
            }
          }
        }
      };
      expect(() => NPCDocV1Schema.parse(invalid)).toThrow();
    });
  });

  describe('Edge cases', () => {
    it('should accept exactly 64 character display_name', () => {
      const valid = {
        npc: {
          display_name: "A".repeat(64),
          summary: "A test character."
        }
      };
      expect(() => NPCDocV1Schema.parse(valid)).not.toThrow();
    });

    it('should accept exactly 160 character summary', () => {
      const valid = {
        npc: {
          display_name: "Test NPC",
          summary: "A".repeat(160)
        }
      };
      expect(() => NPCDocV1Schema.parse(valid)).not.toThrow();
    });

    it('should accept exactly 16 tags', () => {
      const valid = {
        npc: {
          display_name: "Test NPC",
          summary: "A test character.",
          tags: Array(16).fill("tag")
        }
      };
      expect(() => NPCDocV1Schema.parse(valid)).not.toThrow();
    });

    it('should accept trait values at boundaries', () => {
      const valid = {
        npc: {
          display_name: "Test NPC",
          summary: "A test character.",
          traits: {
            min: 0,
            max: 100
          }
        }
      };
      expect(() => NPCDocV1Schema.parse(valid)).not.toThrow();
    });
  });
});
