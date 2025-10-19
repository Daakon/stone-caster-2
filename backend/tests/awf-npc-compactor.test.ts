import { describe, it, expect } from 'vitest';
import { compactNpcDoc } from '../src/assemblers/npc-compactor.js';

describe('AWF NPC Compactor', () => {
  const fullNPCDoc = {
    __id: 'npc.kiera',
    __version: '1.0.0',
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
        register: "casual",
        taboos: ["violence", "deception"]
      },
      links: { 
        world_ref: "world.mystika@1.0.0", 
        adventure_refs: ["adv.whispercross@1.0.0"] 
      },
      slices: ["core", "bio"],
      i18n: {
        "es-ES": {
          display_name: "Kiera",
          summary: "Exploradora de vista aguda que observa desde la línea de árboles.",
          style: {
            voice: "irónica, concisa, observadora",
            register: "casual"
          }
        }
      }
    }
  };

  const minimalNPCDoc = {
    __id: 'npc.test',
    __version: '1.0.0',
    npc: {
      display_name: "Test NPC",
      summary: "A simple test character."
    }
  };

  describe('compactNpcDoc', () => {
    it('should compact a full NPC document with default locale', () => {
      const result = compactNpcDoc(fullNPCDoc);
      
      expect(result).toEqual({
        id: 'npc.kiera',
        ver: '1.0.0',
        name: "Kiera",
        archetype: "ranger",
        summary: "Sharp-eyed scout who watches from the treeline.",
        style: {
          voice: "wry, concise, observant",
          register: "casual"
        },
        tags: ["ally", "scout", "whispercross"]
      });
    });

    it('should compact a minimal NPC document', () => {
      const result = compactNpcDoc(minimalNPCDoc);
      
      expect(result).toEqual({
        id: 'npc.test',
        ver: '1.0.0',
        name: "Test NPC",
        archetype: null,
        summary: "A simple test character.",
        style: {
          voice: null,
          register: null
        },
        tags: []
      });
    });

    it('should apply locale overlay when available', () => {
      const result = compactNpcDoc(fullNPCDoc, 'es-ES');
      
      expect(result).toEqual({
        id: 'npc.kiera',
        ver: '1.0.0',
        name: "Kiera", // No i18n display_name, uses original
        archetype: "ranger",
        summary: "Exploradora de vista aguda que observa desde la línea de árboles.",
        style: {
          voice: "irónica, concisa, observadora",
          register: "casual"
        },
        tags: ["ally", "scout", "whispercross"]
      });
    });

    it('should fall back to default when locale not found', () => {
      const result = compactNpcDoc(fullNPCDoc, 'fr-FR');
      
      expect(result).toEqual({
        id: 'npc.kiera',
        ver: '1.0.0',
        name: "Kiera",
        archetype: "ranger",
        summary: "Sharp-eyed scout who watches from the treeline.",
        style: {
          voice: "wry, concise, observant",
          register: "casual"
        },
        tags: ["ally", "scout", "whispercross"]
      });
    });

    it('should truncate summary to 160 characters', () => {
      const longSummaryDoc = {
        __id: 'npc.test',
        __version: '1.0.0',
        npc: {
          display_name: "Test NPC",
          summary: "A".repeat(200) // 200 chars, should be truncated to 160
        }
      };

      const result = compactNpcDoc(longSummaryDoc);
      expect(result.summary).toHaveLength(160);
      expect(result.summary).toBe("A".repeat(160));
    });

    it('should handle missing fields gracefully', () => {
      const incompleteDoc = {
        __id: 'npc.test',
        __version: '1.0.0',
        npc: {
          display_name: "Test NPC"
          // Missing summary
        }
      };

      const result = compactNpcDoc(incompleteDoc);
      expect(result).toEqual({
        id: 'npc.test',
        ver: '1.0.0',
        name: "Test NPC",
        archetype: null,
        summary: "",
        style: {
          voice: null,
          register: null
        },
        tags: []
      });
    });

    it('should handle missing id and version', () => {
      const docWithoutIds = {
        npc: {
          display_name: "Test NPC",
          summary: "A test character."
        }
      };

      const result = compactNpcDoc(docWithoutIds);
      expect(result.id).toBeNull();
      expect(result.ver).toBeNull();
      expect(result.name).toBe("Test NPC");
    });

    it('should handle empty i18n object', () => {
      const docWithEmptyI18n = {
        __id: 'npc.test',
        __version: '1.0.0',
        npc: {
          display_name: "Test NPC",
          summary: "A test character.",
          i18n: {}
        }
      };

      const result = compactNpcDoc(docWithEmptyI18n, 'en-US');
      expect(result.name).toBe("Test NPC");
      expect(result.summary).toBe("A test character.");
    });

    it('should handle partial i18n override', () => {
      const docWithPartialI18n = {
        __id: 'npc.test',
        __version: '1.0.0',
        npc: {
          display_name: "Test NPC",
          summary: "A test character.",
          style: {
            voice: "default voice",
            register: "formal"
          },
          i18n: {
            "es-ES": {
              display_name: "NPC de Prueba"
              // No summary or style override
            }
          }
        }
      };

      const result = compactNpcDoc(docWithPartialI18n, 'es-ES');
      expect(result.name).toBe("NPC de Prueba");
      expect(result.summary).toBe("A test character."); // Falls back to default
      expect(result.style.voice).toBe("default voice"); // Falls back to default
      expect(result.style.register).toBe("formal"); // Falls back to default
    });

    it('should handle null/undefined values in style', () => {
      const docWithNullStyle = {
        __id: 'npc.test',
        __version: '1.0.0',
        npc: {
          display_name: "Test NPC",
          summary: "A test character.",
          style: {
            voice: null,
            register: undefined
          }
        }
      };

      const result = compactNpcDoc(docWithNullStyle);
      expect(result.style.voice).toBeNull();
      expect(result.style.register).toBeNull();
    });

    it('should handle missing npc object', () => {
      const docWithoutNpc = {
        __id: 'npc.test',
        __version: '1.0.0'
      };

      const result = compactNpcDoc(docWithoutNpc);
      expect(result).toEqual({
        id: 'npc.test',
        ver: '1.0.0',
        name: "Unknown",
        archetype: null,
        summary: "",
        style: {
          voice: null,
          register: null
        },
        tags: []
      });
    });
  });
});
