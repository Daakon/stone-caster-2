import { describe, it, expect } from 'vitest';
import { LlmResultV1 } from '../../src/model/jsonSchema';

describe('JSON Schema Validation', () => {
  describe('Valid Samples', () => {
    it('should pass with minimal valid object', () => {
      const valid = {
        version: "1",
        narrator: { text: "The forest whispers secrets." }
      };

      expect(() => LlmResultV1.parse(valid)).not.toThrow();
    });

    it('should pass with full object including all optional fields', () => {
      const valid = {
        version: "1",
        narrator: { text: "The ancient temple holds many secrets." },
        deltas: {
          npcRelationships: [
            { npcId: "kiera", trust: 5, warmth: 3 },
            { npcId: "thorne", respect: 8, awe: 2 }
          ],
          flags: { hasVisitedTemple: true, knowsSecret: false }
        },
        hints: {
          requestedTierRecalc: true
        },
        meta: {
          locale: "en-US"
        }
      };

      expect(() => LlmResultV1.parse(valid)).not.toThrow();
    });

    it('should pass with partial deltas', () => {
      const valid = {
        version: "1",
        narrator: { text: "You discover a hidden passage." },
        deltas: {
          flags: { foundSecret: true }
        }
      };

      expect(() => LlmResultV1.parse(valid)).not.toThrow();
    });
  });

  describe('Invalid Samples', () => {
    it('should fail when version is not "1"', () => {
      const invalid = {
        version: "2",
        narrator: { text: "Test" }
      };

      expect(() => LlmResultV1.parse(invalid)).toThrow();
    });

    it('should fail when narrator.text is missing', () => {
      const invalid = {
        version: "1",
        narrator: {}
      };

      expect(() => LlmResultV1.parse(invalid)).toThrow();
    });

    it('should fail when narrator.text is empty string', () => {
      const invalid = {
        version: "1",
        narrator: { text: "" }
      };

      expect(() => LlmResultV1.parse(invalid)).toThrow();
    });

    it('should fail when npcId is missing in npcRelationships', () => {
      const invalid = {
        version: "1",
        narrator: { text: "Test" },
        deltas: {
          npcRelationships: [{ trust: 5 }] // missing npcId
        }
      };

      expect(() => LlmResultV1.parse(invalid)).toThrow();
    });

    it('should fail when npcId is empty string', () => {
      const invalid = {
        version: "1",
        narrator: { text: "Test" },
        deltas: {
          npcRelationships: [{ npcId: "", trust: 5 }]
        }
      };

      expect(() => LlmResultV1.parse(invalid)).toThrow();
    });

    it('should fail when flags values are not boolean', () => {
      const invalid = {
        version: "1",
        narrator: { text: "Test" },
        deltas: {
          flags: { hasVisitedTemple: "true" } // should be boolean
        }
      };

      expect(() => LlmResultV1.parse(invalid)).toThrow();
    });

    it('should fail when requestedTierRecalc is not boolean', () => {
      const invalid = {
        version: "1",
        narrator: { text: "Test" },
        hints: {
          requestedTierRecalc: "yes" // should be boolean
        }
      };

      expect(() => LlmResultV1.parse(invalid)).toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty npcRelationships array', () => {
      const valid = {
        version: "1",
        narrator: { text: "Test" },
        deltas: {
          npcRelationships: []
        }
      };

      expect(() => LlmResultV1.parse(valid)).not.toThrow();
    });

    it('should handle empty flags object', () => {
      const valid = {
        version: "1",
        narrator: { text: "Test" },
        deltas: {
          flags: {}
        }
      };

      expect(() => LlmResultV1.parse(valid)).not.toThrow();
    });

    it('should handle npcRelationships with only npcId', () => {
      const valid = {
        version: "1",
        narrator: { text: "Test" },
        deltas: {
          npcRelationships: [{ npcId: "kiera" }]
        }
      };

      expect(() => LlmResultV1.parse(valid)).not.toThrow();
    });
  });
});
