/**
 * AWF Assembler World/Adventure Tests
 * Tests for world/adventure compaction and token discipline
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  compactWorld, 
  compactAdventure, 
  applyWorldTokenDiscipline, 
  applyAdventureTokenDiscipline 
} from '../src/assemblers/world-adv-compact.js';

describe('World/Adventure Compaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('compactWorld', () => {
    it('should compact world with all fields', () => {
      const doc = {
        id: "world.mystika",
        name: "Mystika",
        timeworld: {
          timezone: "UTC",
          calendar: "gregorian",
          seasons: ["spring", "summer", "autumn", "winter"]
        },
        custom_field: "value"
      };

      const result = compactWorld(doc);
      
      expect(result).toEqual({
        id: "world.mystika",
        name: "Mystika",
        timeworld: {
          timezone: "UTC",
          calendar: "gregorian",
          seasons: ["spring", "summer", "autumn", "winter"]
        }
      });
    });

    it('should apply locale overlay when provided', () => {
      const doc = {
        id: "world.mystika",
        name: "Mystika",
        timeworld: {
          timezone: "UTC",
          calendar: "gregorian"
        },
        i18n: {
          es: {
            name: "Místika"
          }
        }
      };

      const result = compactWorld(doc, 'es');
      
      expect(result).toEqual({
        id: "world.mystika",
        name: "Místika",
        timeworld: {
          timezone: "UTC",
          calendar: "gregorian"
        }
      });
    });

    it('should handle missing optional fields', () => {
      const doc = {
        id: "world.mystika",
        name: "Mystika"
      };

      const result = compactWorld(doc);
      
      expect(result).toEqual({
        id: "world.mystika",
        name: "Mystika",
        timeworld: null
      });
    });

    it('should handle null timeworld', () => {
      const doc = {
        id: "world.mystika",
        name: "Mystika",
        timeworld: null
      };

      const result = compactWorld(doc);
      
      expect(result).toEqual({
        id: "world.mystika",
        name: "Mystika",
        timeworld: null
      });
    });
  });

  describe('compactAdventure', () => {
    it('should compact adventure with all fields', () => {
      const doc = {
        id: "adv.whispercross",
        name: "Whispercross",
        synopsis: "A mysterious adventure.",
        cast: [
          { npc_ref: "npc.kiera@1.0.0" },
          { npc_ref: "npc.tavern_keeper@1.0.0" }
        ],
        custom_field: "value"
      };

      const result = compactAdventure(doc);
      
      expect(result).toEqual({
        id: "adv.whispercross",
        name: "Whispercross",
        synopsis: "A mysterious adventure.",
        cast: [
          { npc_ref: "npc.kiera@1.0.0" },
          { npc_ref: "npc.tavern_keeper@1.0.0" }
        ]
      });
    });

    it('should apply locale overlay when provided', () => {
      const doc = {
        id: "adv.whispercross",
        name: "Whispercross",
        synopsis: "A mysterious adventure.",
        cast: [{ npc_ref: "npc.kiera@1.0.0" }],
        i18n: {
          es: {
            name: "Crucesusurro",
            synopsis: "Una aventura misteriosa."
          }
        }
      };

      const result = compactAdventure(doc, 'es');
      
      expect(result).toEqual({
        id: "adv.whispercross",
        name: "Crucesusurro",
        synopsis: "Una aventura misteriosa.",
        cast: [{ npc_ref: "npc.kiera@1.0.0" }]
      });
    });

    it('should cap cast at 12 items', () => {
      const doc = {
        id: "adv.test",
        name: "Test Adventure",
        cast: Array(15).fill({ npc_ref: "npc.test@1.0.0" })
      };

      const result = compactAdventure(doc);
      
      expect(result.cast).toHaveLength(12);
    });

    it('should handle missing optional fields', () => {
      const doc = {
        id: "adv.test",
        name: "Test Adventure"
      };

      const result = compactAdventure(doc);
      
      expect(result).toEqual({
        id: "adv.test",
        name: "Test Adventure",
        synopsis: "",
        cast: []
      });
    });

    it('should truncate synopsis to 280 characters', () => {
      const doc = {
        id: "adv.test",
        name: "Test Adventure",
        synopsis: "A".repeat(300)
      };

      const result = compactAdventure(doc);
      
      expect(result.synopsis).toHaveLength(280);
      expect(result.synopsis).toBe("A".repeat(280));
    });
  });

  describe('applyWorldTokenDiscipline', () => {
    it('should not modify world under token limit', () => {
      const compacted = {
        id: "world.mystika",
        name: "Mystika",
        timeworld: {
          timezone: "UTC",
          calendar: "gregorian"
        }
      };

      const result = applyWorldTokenDiscipline(compacted, 300);
      
      expect(result).toEqual(compacted);
    });

    it('should drop timeworld.seasons when over limit', () => {
      const compacted = {
        id: "world.mystika",
        name: "Mystika",
        timeworld: {
          timezone: "UTC",
          calendar: "gregorian",
          seasons: Array(20).fill("season") // Large seasons array
        }
      };

      const result = applyWorldTokenDiscipline(compacted, 50); // Low limit
      
      expect(result.timeworld.seasons).toBeUndefined();
      expect(result.timeworld.timezone).toBe("UTC");
      expect(result.timeworld.calendar).toBe("gregorian");
    });

    it('should omit timeworld entirely when still over limit', () => {
      const compacted = {
        id: "world.mystika",
        name: "Mystika",
        timeworld: {
          timezone: "UTC",
          calendar: "gregorian",
          seasons: Array(50).fill("season") // Very large
        }
      };

      const result = applyWorldTokenDiscipline(compacted, 20); // Very low limit
      
      expect(result.timeworld).toBeNull();
    });
  });

  describe('applyAdventureTokenDiscipline', () => {
    it('should not modify adventure under token limit', () => {
      const compacted = {
        id: "adv.test",
        name: "Test Adventure",
        synopsis: "A test adventure.",
        cast: [{ npc_ref: "npc.test@1.0.0" }]
      };

      const result = applyAdventureTokenDiscipline(compacted, 300);
      
      expect(result).toEqual(compacted);
    });

    it('should drop cast beyond 8 when over limit', () => {
      const compacted = {
        id: "adv.test",
        name: "Test Adventure",
        synopsis: "A test adventure.",
        cast: Array(15).fill({ npc_ref: "npc.test@1.0.0" })
      };

      const result = applyAdventureTokenDiscipline(compacted, 100); // Medium limit
      
      expect(result.cast).toHaveLength(8);
    });

    it('should drop cast beyond 4 when still over limit', () => {
      const compacted = {
        id: "adv.test",
        name: "Test Adventure",
        synopsis: "A test adventure.",
        cast: Array(10).fill({ npc_ref: "npc.test@1.0.0" })
      };

      const result = applyAdventureTokenDiscipline(compacted, 30); // Very low limit
      
      expect(result.cast).toHaveLength(4);
    });

    it('should elide synopsis when still over limit', () => {
      const compacted = {
        id: "adv.test",
        name: "Test Adventure",
        synopsis: "A".repeat(200), // Long synopsis
        cast: Array(8).fill({ npc_ref: "npc.test@1.0.0" })
      };

      const result = applyAdventureTokenDiscipline(compacted, 20); // Very low limit
      
      expect(result.synopsis).toBe("");
    });
  });
});
