/**
 * AWF Ruleset Resolver Tests
 * Phase 1: Tests for games-only state ruleset resolution
 */

import { describe, it, expect } from 'vitest';
import { resolveRulesetRef, parseRulesetRef, isValidRulesetRef } from '../src/utils/awf-ruleset-resolver.js';

describe('AWF Ruleset Resolver', () => {
  describe('resolveRulesetRef', () => {
    it('should resolve from game meta when no session override', () => {
      const game = {
        state_snapshot: {
          meta: {
            ruleset_ref: 'ruleset.custom@2.0.0',
            locale: 'es-ES'
          }
        }
      };

      const result = resolveRulesetRef({ game, session: null });
      
      expect(result.ruleset_ref).toBe('ruleset.custom@2.0.0');
      expect(result.locale).toBe('es-ES');
    });

    it('should use session override when present', () => {
      const game = {
        state_snapshot: {
          meta: {
            ruleset_ref: 'ruleset.game@1.0.0',
            locale: 'en-US'
          }
        }
      };

      const session = {
        ruleset_ref: 'ruleset.session@3.0.0',
        locale: 'fr-FR'
      };

      const result = resolveRulesetRef({ game, session });
      
      expect(result.ruleset_ref).toBe('ruleset.session@3.0.0');
      expect(result.locale).toBe('fr-FR');
    });

    it('should fall back to defaults when no game meta', () => {
      const game = {
        state_snapshot: {}
      };

      const result = resolveRulesetRef({ game, session: null });
      
      expect(result.ruleset_ref).toBe('ruleset.core.default@1.0.0');
      expect(result.locale).toBe('en-US');
    });

    it('should fall back to defaults when no game state_snapshot', () => {
      const game = {};

      const result = resolveRulesetRef({ game, session: null });
      
      expect(result.ruleset_ref).toBe('ruleset.core.default@1.0.0');
      expect(result.locale).toBe('en-US');
    });

    it('should handle partial session override', () => {
      const game = {
        state_snapshot: {
          meta: {
            ruleset_ref: 'ruleset.game@1.0.0',
            locale: 'en-US'
          }
        }
      };

      const session = {
        ruleset_ref: 'ruleset.session@2.0.0'
        // No locale override
      };

      const result = resolveRulesetRef({ game, session });
      
      expect(result.ruleset_ref).toBe('ruleset.session@2.0.0');
      expect(result.locale).toBe('en-US'); // From game meta
    });
  });

  describe('parseRulesetRef', () => {
    it('should parse valid ruleset reference', () => {
      const result = parseRulesetRef('ruleset.core.default@1.0.0');
      
      expect(result.id).toBe('ruleset.core.default');
      expect(result.version).toBe('1.0.0');
    });

    it('should parse complex ruleset reference', () => {
      const result = parseRulesetRef('ruleset.custom.narrative@2.1.0');
      
      expect(result.id).toBe('ruleset.custom.narrative');
      expect(result.version).toBe('2.1.0');
    });

    it('should fall back to default when parsing fails', () => {
      const result = parseRulesetRef('invalid-ref');
      
      expect(result.id).toBe('ruleset.core.default');
      expect(result.version).toBe('1.0.0');
    });

    it('should handle empty string', () => {
      const result = parseRulesetRef('');
      
      expect(result.id).toBe('ruleset.core.default');
      expect(result.version).toBe('1.0.0');
    });
  });

  describe('isValidRulesetRef', () => {
    it('should validate correct format', () => {
      expect(isValidRulesetRef('ruleset.core.default@1.0.0')).toBe(true);
      expect(isValidRulesetRef('ruleset.custom@2.1.0')).toBe(true);
      expect(isValidRulesetRef('ruleset.narrative@1.0.0')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(isValidRulesetRef('invalid-ref')).toBe(false);
      expect(isValidRulesetRef('ruleset.core.default')).toBe(false);
      expect(isValidRulesetRef('@1.0.0')).toBe(false);
      expect(isValidRulesetRef('ruleset.core.default@')).toBe(false);
      expect(isValidRulesetRef('')).toBe(false);
    });

    it('should handle special characters', () => {
      expect(isValidRulesetRef('ruleset.custom-narrative@1.0.0')).toBe(true);
      expect(isValidRulesetRef('ruleset.custom_narrative@1.0.0')).toBe(true);
      expect(isValidRulesetRef('ruleset.custom.narrative@1.0.0')).toBe(true);
    });
  });
});




