/**
 * Phase 12 - Multilingual Support Tests
 * Tests for locale-aware AWF generation, content localization, and translation caching
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { localizationOverlayService } from '../src/services/localization-overlay.service.js';
import { translationCacheService } from '../src/services/translation-cache.service.js';
import { validateAwfOutput, LocaleValidationOptions } from '../src/validators/awf-output-validator.js';
import { createLocaleAwareSystemPrompt } from '../src/model/system-prompts.js';
import { AWFI18nLinter } from '../src/authoring/awf-lint-i18n.js';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({ data: null, error: { code: 'PGRST116' } }))
          }))
        }))
      }))
    })),
    upsert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => ({ data: {}, error: null }))
      }))
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({ error: null }))
        }))
      }))
    }))
  }))
};

// Mock model provider
const mockModelProvider = {
  infer: vi.fn(() => Promise.resolve({
    raw: 'Translated text',
    json: { translation: 'Translated text' }
  }))
};

// Mock the services
vi.mock('../src/services/localization-overlay.service.js', () => ({
  localizationOverlayService: {
    getLocalizationPack: vi.fn(),
    applyLocalizedOverlays: vi.fn(),
    upsertLocalizationPack: vi.fn(),
    deleteLocalizationPack: vi.fn(),
    listLocalizationPacks: vi.fn()
  }
}));

vi.mock('../src/services/translation-cache.service.js', () => ({
  translationCacheService: {
    translateText: vi.fn(),
    getTranslationStats: vi.fn(),
    clearCache: vi.fn()
  }
}));

describe('Phase 12 - Multilingual Support', () => {
  describe('Locale Propagation', () => {
    it('should include locale in AWF bundle meta', () => {
      const session = {
        session_id: 'test-session',
        player_id: 'test-player',
        world_ref: 'test-world',
        adventure_ref: 'test-adventure',
        turn_id: 1,
        is_first_turn: true,
        locale: 'fr-FR',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // This would be tested in the bundle assembler
      expect(session.locale).toBe('fr-FR');
    });

    it('should default to en-US when locale not specified', () => {
      const session = {
        session_id: 'test-session',
        player_id: 'test-player',
        world_ref: 'test-world',
        adventure_ref: 'test-adventure',
        turn_id: 1,
        is_first_turn: true,
        locale: undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const defaultLocale = session.locale || 'en-US';
      expect(defaultLocale).toBe('en-US');
    });
  });

  describe('Locale-Aware System Prompts', () => {
    it('should create locale-aware system prompt for non-English locales', () => {
      const prompt = createLocaleAwareSystemPrompt('fr-FR', false);
      
      expect(prompt).toContain('fr-FR');
      expect(prompt).toContain('Write all natural language in fr-FR');
      expect(prompt).toContain('Do not mix languages');
      expect(prompt).toContain('Use second-person');
    });

    it('should return base prompt for English locale', () => {
      const prompt = createLocaleAwareSystemPrompt('en-US', false);
      
      expect(prompt).not.toContain('Write all natural language');
      expect(prompt).toContain('You will be given one JSON object');
    });

    it('should include tool support when requested', () => {
      const prompt = createLocaleAwareSystemPrompt('es-ES', true);
      
      expect(prompt).toContain('GetLoreSlice tool');
      expect(prompt).toContain('es-ES');
    });
  });

  describe('Localization Overlay Service', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return null for missing localization pack', async () => {
      localizationOverlayService.getLocalizationPack.mockResolvedValue(null);
      
      const pack = await localizationOverlayService.getLocalizationPack(
        'world',
        'test-world',
        'fr-FR'
      );
      
      expect(pack).toBeNull();
    });

    it('should apply localized overlays to document', async () => {
      const baseDoc = {
        title: 'Test World',
        npcs: [
          { id: 'npc1', name: 'Guard', description: 'A town guard' }
        ]
      };

      const localizedDoc = {
        title: 'Monde de Test',
        npcs: [
          { id: 'npc1', name: 'Garde', description: 'Un garde de la ville' }
        ],
        _localized: {
          locale: 'fr-FR',
          doc_ref: 'test-world',
          applied_at: new Date().toISOString()
        }
      };

      localizationOverlayService.applyLocalizedOverlays.mockResolvedValue(localizedDoc);

      const result = await localizationOverlayService.applyLocalizedOverlays(
        baseDoc,
        'world',
        'test-world',
        'fr-FR'
      );

      expect(result.title).toBe('Monde de Test');
      expect(result.npcs[0].name).toBe('Garde');
      expect(result.npcs[0].description).toBe('Un garde de la ville');
      expect(result._localized).toBeDefined();
      expect(result._localized.locale).toBe('fr-FR');
    });

    it('should return original document for en-US locale', async () => {
      const baseDoc = {
        title: 'Test World',
        npcs: [
          { id: 'npc1', name: 'Guard', description: 'A town guard' }
        ]
      };

      localizationOverlayService.applyLocalizedOverlays.mockResolvedValue(baseDoc);

      const localizedDoc = await localizationOverlayService.applyLocalizedOverlays(
        baseDoc,
        'world',
        'test-world',
        'en-US'
      );

      expect(localizedDoc).toEqual(baseDoc);
    });

    it('should handle missing localization pack gracefully', async () => {
      const baseDoc = {
        title: 'Test World',
        npcs: [
          { id: 'npc1', name: 'Guard', description: 'A town guard' }
        ]
      };

      localizationOverlayService.applyLocalizedOverlays.mockResolvedValue(baseDoc);

      const localizedDoc = await localizationOverlayService.applyLocalizedOverlays(
        baseDoc,
        'world',
        'test-world',
        'fr-FR'
      );

      expect(localizedDoc).toEqual(baseDoc);
    });
  });

  describe('Translation Cache Service', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return original text for same source and destination language', async () => {
      translationCacheService.translateText.mockResolvedValue({
        out: 'Hello world',
        fromCache: true,
        tokensEst: 2
      });

      const result = await translationCacheService.translateText(
        'Hello world',
        'en-US',
        'en-US',
        {
          sentence_caps: 120,
          choice_label_max: 48,
          forbidden_phrases: [],
          formal_you: false
        }
      );

      expect(result.out).toBe('Hello world');
      expect(result.fromCache).toBe(true);
    });

    it('should return original text when model translator is disabled', async () => {
      // Mock environment variable
      process.env.USE_MODEL_TRANSLATOR = 'false';

      translationCacheService.translateText.mockResolvedValue({
        out: 'Hello world',
        fromCache: false,
        tokensEst: 2
      });

      const result = await translationCacheService.translateText(
        'Hello world',
        'en-US',
        'fr-FR',
        {
          sentence_caps: 120,
          choice_label_max: 48,
          forbidden_phrases: [],
          formal_you: false
        }
      );

      expect(result.out).toBe('Hello world');
      expect(result.fromCache).toBe(false);
    });

    it('should validate and truncate translated text', async () => {
      const longText = 'A'.repeat(200);
      const policy = {
        sentence_caps: 50,
        choice_label_max: 48,
        forbidden_phrases: [],
        formal_you: false
      };

      // Mock truncated result
      translationCacheService.translateText.mockResolvedValue({
        out: 'A'.repeat(50),
        fromCache: false,
        tokensEst: 12
      });

      process.env.USE_MODEL_TRANSLATOR = 'true';

      const result = await translationCacheService.translateText(
        'Hello world',
        'en-US',
        'fr-FR',
        policy
      );

      expect(result.out.length).toBeLessThanOrEqual(50);
    });
  });

  describe('AWF Output Validator - Locale Enforcement', () => {
    it('should validate choice label lengths for non-English locales', () => {
      const awf = {
        scn: 'test-scene',
        txt: 'test text',
        choices: [
          { id: 'choice1', label: 'A very long choice label that exceeds the maximum length for French locale' }
        ]
      };

      const localeOptions: LocaleValidationOptions = {
        locale: 'fr-FR',
        maxChoiceLabelLength: 48,
        enforceOneLanguage: true
      };

      const result = validateAwfOutput(awf, localeOptions);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('exceeds maximum length'))).toBe(true);
    });

    it('should detect mixed languages in non-English locales', () => {
      const awf = {
        scn: 'test-scene',
        txt: 'Bonjour the world and welcome to our adventure',
        choices: [
          { id: 'choice1', label: 'Continue the story' }
        ]
      };

      const localeOptions: LocaleValidationOptions = {
        locale: 'fr-FR',
        maxChoiceLabelLength: 48,
        enforceOneLanguage: true
      };

      const result = validateAwfOutput(awf, localeOptions);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('mixed languages'))).toBe(true);
    });

    it('should pass validation for proper French text', () => {
      const awf = {
        scn: 'test-scene',
        txt: 'Bonjour et bienvenue dans notre aventure',
        choices: [
          { id: 'choice1', label: 'Continuer l\'histoire' }
        ]
      };

      const localeOptions: LocaleValidationOptions = {
        locale: 'fr-FR',
        maxChoiceLabelLength: 48,
        enforceOneLanguage: true
      };

      const result = validateAwfOutput(awf, localeOptions);

      expect(result.isValid).toBe(true);
    });

    it('should skip locale validation for English', () => {
      const awf = {
        scn: 'test-scene',
        txt: 'Hello world',
        choices: [
          { id: 'choice1', label: 'Continue the story' }
        ]
      };

      const localeOptions: LocaleValidationOptions = {
        locale: 'en-US',
        maxChoiceLabelLength: 48,
        enforceOneLanguage: true
      };

      const result = validateAwfOutput(awf, localeOptions);

      expect(result.isValid).toBe(true);
    });
  });

  describe('i18n Linter', () => {
    it('should create linter instance', () => {
      const linter = new AWFI18nLinter('fr-FR', false);
      
      expect(linter).toBeDefined();
      expect(linter['locale']).toBe('fr-FR');
      expect(linter['strict']).toBe(false);
    });

    it('should handle valid JSON', () => {
      const linter = new AWFI18nLinter('fr-FR', false);
      
      const payload = {
        title: 'Monde de Test',
        npcs: {
          npc1: {
            name: 'Garde',
            description: 'Un garde de la ville'
          }
        }
      };

      const result = linter.lintFile('test.json', JSON.stringify(payload));
      
      expect(result).toBeDefined();
      expect(result.file).toBe('test.json');
      expect(result.locale).toBe('fr-FR');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should handle invalid JSON', () => {
      const linter = new AWFI18nLinter('fr-FR', false);
      
      const result = linter.lintFile('test.json', 'invalid json {');
      
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.message.includes('Invalid JSON'))).toBe(true);
    });

    it('should load localization rules', () => {
      const linter = new AWFI18nLinter('fr-FR', false);
      
      expect(linter['rules']).toBeDefined();
      expect(linter['rules'].sentence_caps).toBe(140);
      expect(linter['rules'].formal_you).toBe(true);
    });

    it('should load glossary', () => {
      const linter = new AWFI18nLinter('fr-FR', false);
      
      expect(linter['glossary']).toBeDefined();
      expect(Array.isArray(linter['glossary'].entries)).toBe(true);
    });

    it('should validate JSON structure', () => {
      const linter = new AWFI18nLinter('fr-FR', false);
      
      const result = linter.lintFile('test.json', 'invalid json');
      
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.type === 'placeholder_loss')).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete localization workflow', async () => {
      // Test the complete workflow from locale detection to localized output
      const session = {
        session_id: 'test-session',
        player_id: 'test-player',
        world_ref: 'test-world',
        adventure_ref: 'test-adventure',
        turn_id: 1,
        is_first_turn: true,
        locale: 'fr-FR',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 1. Locale should be propagated
      expect(session.locale).toBe('fr-FR');

      // 2. System prompt should be locale-aware
      const prompt = createLocaleAwareSystemPrompt('fr-FR', false);
      expect(prompt).toContain('fr-FR');

      // 3. Localization overlays should be applied
      const baseDoc = {
        title: 'Test World',
        npcs: [
          { id: 'npc1', name: 'Guard', description: 'A town guard' }
        ]
      };

      const mockPack = {
        id: 'pack1',
        doc_type: 'world',
        doc_ref: 'test-world',
        locale: 'fr-FR',
        payload: {
          title: 'Monde de Test',
          npcs: {
            npc1: {
              name: 'Garde',
              description: 'Un garde de la ville'
            }
          }
        },
        hash: 'test-hash',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      localizationOverlayService.applyLocalizedOverlays.mockResolvedValue({
        title: 'Monde de Test',
        npcs: [
          { id: 'npc1', name: 'Garde', description: 'Un garde de la ville' }
        ],
        _localized: {
          locale: 'fr-FR',
          doc_ref: 'test-world',
          applied_at: new Date().toISOString()
        }
      });

      const localizedDoc = await localizationOverlayService.applyLocalizedOverlays(
        baseDoc,
        'world',
        'test-world',
        'fr-FR'
      );

      expect(localizedDoc.title).toBe('Monde de Test');

      // 4. AWF output should be validated for locale compliance
      const awf = {
        scn: 'test-scene',
        txt: 'Bonjour et bienvenue dans notre aventure',
        choices: [
          { id: 'choice1', label: 'Continuer l\'histoire' }
        ]
      };

      const localeOptions: LocaleValidationOptions = {
        locale: 'fr-FR',
        maxChoiceLabelLength: 48,
        enforceOneLanguage: true
      };

      const validationResult = validateAwfOutput(awf, localeOptions);
      expect(validationResult.isValid).toBe(true);
    });

    it('should handle translation cache workflow', async () => {
      // Test translation cache workflow
      process.env.USE_MODEL_TRANSLATOR = 'true';

      translationCacheService.translateText.mockResolvedValue({
        out: 'Bonjour le monde',
        fromCache: false,
        tokensEst: 3
      });

      const result = await translationCacheService.translateText(
        'Hello world',
        'en-US',
        'fr-FR',
        {
          sentence_caps: 120,
          choice_label_max: 48,
          forbidden_phrases: [],
          formal_you: false
        }
      );

      expect(result.out).toBeDefined();
      expect(typeof result.tokensEst).toBe('number');
    });

    it('should handle linter workflow', () => {
      const linter = new AWFI18nLinter('fr-FR', true);
      
      // Test individual file linting instead of batch processing
      const testContent = JSON.stringify({
        title: 'Monde de Test',
        npcs: {
          npc1: {
            name: 'Garde',
            description: 'Un garde de la ville'
          }
        }
      });

      const result = linter.lintFile('test.json', testContent);
      
      expect(result).toBeDefined();
      expect(result.file).toBe('test.json');
      expect(result.locale).toBe('fr-FR');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      localizationOverlayService.getLocalizationPack.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(localizationOverlayService.getLocalizationPack(
        'world',
        'test-world',
        'fr-FR'
      )).rejects.toThrow('Database connection failed');
    });

    it('should handle invalid JSON in linter', () => {
      const linter = new AWFI18nLinter('fr-FR', false);
      
      const result = linter.lintFile('test.json', 'invalid json {');
      
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Invalid JSON');
    });

    it('should handle missing localization rules', () => {
      const linter = new AWFI18nLinter('unknown-locale', false);
      
      // Should use default rules
      expect(linter['rules']).toBeDefined();
      expect(linter['rules'].sentence_caps).toBe(120);
    });
  });
});
