/**
 * AWF Lint World/Adventure Tests
 * Tests for flexible world/adventure validation in the linter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AwfLinter } from '../src/authoring/awf-lint-corrected.js';

describe('World/Adventure Lint Validation (Flexible)', () => {
  let linter: AwfLinter;

  beforeEach(() => {
    linter = new AwfLinter();
  });

  describe('world_validation rule', () => {
    it('should pass valid world document', () => {
      const doc = {
        id: "world.mystika",
        name: "Mystika",
        version: "1.0.0",
        timeworld: {
          timezone: "UTC",
          calendar: "gregorian"
        },
        custom_field: "value"
      };

      const result = linter.lintDocument(doc, 'worlds/mystika.json');
      
      expect(result.errorCount).toBe(0);
      expect(result.warningCount).toBe(0);
    });

    it('should fail on missing name', () => {
      const doc = {
        id: "world.mystika",
        version: "1.0.0"
      };

      const result = linter.lintDocument(doc, 'worlds/mystika.json');
      
      expect(result.errorCount).toBe(1);
      expect(result.issues[0].message).toContain('missing required name');
    });

    it('should warn on missing timeworld', () => {
      const doc = {
        id: "world.mystika",
        name: "Mystika",
        version: "1.0.0"
      };

      const result = linter.lintDocument(doc, 'worlds/mystika.json');
      
      expect(result.warningCount).toBe(1);
      expect(result.issues[0].message).toContain('missing timeworld (recommended)');
    });

    it('should warn on large custom field', () => {
      const doc = {
        id: "world.mystika",
        name: "Mystika",
        version: "1.0.0",
        large_custom_field: {
          data: "A".repeat(3000) // Exceeds 2KB
        }
      };

      const result = linter.lintDocument(doc, 'worlds/mystika.json');
      
      expect(result.warningCount).toBe(2); // 1 for missing timeworld + 1 for large custom field
      expect(result.issues.some(issue => issue.message.includes('exceeds 2KB'))).toBe(true);
    });

    it('should not warn on small custom fields', () => {
      const doc = {
        id: "world.mystika",
        name: "Mystika",
        version: "1.0.0",
        small_custom_field: "value",
        another_field: {
          nested: "data"
        }
      };

      const result = linter.lintDocument(doc, 'worlds/mystika.json');
      
      expect(result.warningCount).toBe(1); // Only timeworld warning
      expect(result.issues[0].message).toContain('timeworld');
    });

    it('should skip validation for non-world documents', () => {
      const doc = {
        id: "adv.test",
        name: "Test Adventure",
        version: "1.0.0",
        world_ref: "world.test@1.0.0"
      };

      const result = linter.lintDocument(doc, 'adventures/test.json');
      
      expect(result.errorCount).toBe(0);
    });
  });

  describe('adventure_validation rule', () => {
    it('should pass valid adventure document', () => {
      const doc = {
        id: "adv.whispercross",
        name: "Whispercross",
        version: "1.0.0",
        world_ref: "world.mystika@1.0.0",
        synopsis: "A mysterious adventure.",
        cast: [
          { npc_ref: "npc.kiera@1.0.0" }
        ],
        custom_field: "value"
      };

      const result = linter.lintDocument(doc, 'adventures/whispercross.json');
      
      expect(result.errorCount).toBe(0);
      expect(result.warningCount).toBe(0);
    });

    it('should fail on missing name', () => {
      const doc = {
        id: "adv.test",
        version: "1.0.0",
        world_ref: "world.test@1.0.0"
      };

      const result = linter.lintDocument(doc, 'adventures/test.json');
      
      expect(result.errorCount).toBe(1);
      expect(result.issues[0].message).toContain('missing required name');
    });

    it('should fail on missing world_ref', () => {
      const doc = {
        id: "adv.test",
        name: "Test Adventure",
        version: "1.0.0"
      };

      const result = linter.lintDocument(doc, 'adventures/test.json');
      
      expect(result.errorCount).toBe(1);
      expect(result.issues[0].message).toContain('missing required world_ref');
    });

    it('should warn on large cast', () => {
      const doc = {
        id: "adv.test",
        name: "Test Adventure",
        version: "1.0.0",
        world_ref: "world.test@1.0.0",
        cast: Array(15).fill({ npc_ref: "npc.test@1.0.0" })
      };

      const result = linter.lintDocument(doc, 'adventures/test.json');
      
      expect(result.warningCount).toBe(1);
      expect(result.issues[0].message).toContain('exceeds recommended limit of 12');
    });

    it('should warn on large custom field', () => {
      const doc = {
        id: "adv.test",
        name: "Test Adventure",
        version: "1.0.0",
        world_ref: "world.test@1.0.0",
        large_custom_field: {
          data: "A".repeat(3000) // Exceeds 2KB
        }
      };

      const result = linter.lintDocument(doc, 'adventures/test.json');
      
      expect(result.warningCount).toBe(1);
      expect(result.issues[0].message).toContain('exceeds 2KB');
    });

    it('should not warn on small custom fields', () => {
      const doc = {
        id: "adv.test",
        name: "Test Adventure",
        version: "1.0.0",
        world_ref: "world.test@1.0.0",
        small_custom_field: "value",
        another_field: {
          nested: "data"
        }
      };

      const result = linter.lintDocument(doc, 'adventures/test.json');
      
      expect(result.warningCount).toBe(0);
    });

    it('should skip validation for non-adventure documents', () => {
      const doc = {
        id: "world.mystika",
        name: "Mystika",
        version: "1.0.0"
      };

      const result = linter.lintDocument(doc, 'worlds/mystika.json');
      
      expect(result.errorCount).toBe(0);
    });
  });

  describe('bundle_world_adv_validation rule', () => {
    it('should pass valid bundle with world and adventure', () => {
      const doc = {
        awf_bundle: {
          world: {
            id: "world.mystika",
            name: "Mystika",
            timeworld: {
              timezone: "UTC",
              calendar: "gregorian"
            }
          },
          adventure: {
            id: "adv.whispercross",
            name: "Whispercross",
            synopsis: "A mysterious adventure.",
            cast: [
              { npc_ref: "npc.kiera@1.0.0" }
            ]
          }
        }
      };

      const result = linter.lintDocument(doc, 'bundles/test.json');
      
      expect(result.errorCount).toBe(0);
      expect(result.warningCount).toBe(0);
    });

    it('should fail on missing world name', () => {
      const doc = {
        awf_bundle: {
          world: {
            id: "world.mystika"
          }
        }
      };

      const result = linter.lintDocument(doc, 'bundles/test.json');
      
      expect(result.errorCount).toBe(1);
      expect(result.issues[0].message).toContain('Bundle world missing name');
    });

    it('should fail on missing adventure name', () => {
      const doc = {
        awf_bundle: {
          adventure: {
            id: "adv.test"
          }
        }
      };

      const result = linter.lintDocument(doc, 'bundles/test.json');
      
      expect(result.errorCount).toBe(1);
      expect(result.issues[0].message).toContain('Bundle adventure missing name');
    });

    it('should warn on large adventure cast', () => {
      const doc = {
        awf_bundle: {
          adventure: {
            id: "adv.test",
            name: "Test Adventure",
            cast: Array(15).fill({ npc_ref: "npc.test@1.0.0" })
          }
        }
      };

      const result = linter.lintDocument(doc, 'bundles/test.json');
      
      expect(result.warningCount).toBe(1);
      expect(result.issues[0].message).toContain('may have been trimmed');
    });

    it('should skip validation when no world/adventure in bundle', () => {
      const doc = {
        awf_bundle: {
          contract: {
            name: "Test Contract"
          }
        }
      };

      const result = linter.lintDocument(doc, 'bundles/test.json');
      
      expect(result.warningCount).toBe(0);
    });

    it('should skip validation for non-bundle documents', () => {
      const doc = {
        world: {
          id: "world.mystika",
          name: "Mystika"
        }
      };

      const result = linter.lintDocument(doc, 'worlds/mystika.json');
      
      expect(result.warningCount).toBe(1); // 1 for missing timeworld
    });
  });
});
