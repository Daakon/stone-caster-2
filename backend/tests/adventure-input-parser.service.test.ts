/**
 * Tests for Adventure Input Parser Service
 * 
 * Covers input grammar parsing and normalization.
 */

import { describe, it, expect } from 'vitest';
import { adventureInputParserService, type ParsedAdventureCommand } from '../src/services/adventure-input-parser.service.js';

describe('Adventure Input Parser Service', () => {
  describe('Command Parsing', () => {
    it('should parse "Begin the adventure" command', () => {
      const result = adventureInputParserService.parseAdventureCommand('Begin the adventure');
      
      expect(result.command).toBe('begin_adventure');
      expect(result.adventureId).toBeUndefined();
      expect(result.sceneId).toBeUndefined();
    });

    it('should parse "Begin adventure" command', () => {
      const result = adventureInputParserService.parseAdventureCommand('Begin adventure');
      
      expect(result.command).toBe('begin_adventure');
      expect(result.adventureId).toBeUndefined();
    });

    it('should parse "Begin adventure <id>" command', () => {
      const result = adventureInputParserService.parseAdventureCommand('Begin adventure "whispercross"');
      
      expect(result.command).toBe('begin_adventure');
      expect(result.adventureId).toBe('whispercross');
      expect(result.sceneId).toBeUndefined();
    });

    it('should parse "Begin adventure <id> from <scene>" command', () => {
      const result = adventureInputParserService.parseAdventureCommand('Begin adventure "whispercross" from "forest_meet"');
      
      expect(result.command).toBe('begin_adventure');
      expect(result.adventureId).toBe('whispercross');
      expect(result.sceneId).toBe('forest_meet');
    });

    it('should parse "Start adventure <id>" command', () => {
      const result = adventureInputParserService.parseAdventureCommand('Start adventure mystika-tutorial');
      
      expect(result.command).toBe('begin_adventure');
      expect(result.adventureId).toBe('mystika-tutorial');
    });

    it('should parse "Start adventure <id> from <scene>" command', () => {
      const result = adventureInputParserService.parseAdventureCommand('Start adventure mystika-tutorial from character_creation');
      
      expect(result.command).toBe('begin_adventure');
      expect(result.adventureId).toBe('mystika-tutorial');
      expect(result.sceneId).toBe('character_creation');
    });

    it('should parse "Begin scene <id>" command', () => {
      const result = adventureInputParserService.parseAdventureCommand('Begin scene forest_meet');
      
      expect(result.command).toBe('begin_scene');
      expect(result.sceneId).toBe('forest_meet');
    });

    it('should handle case variations', () => {
      const result = adventureInputParserService.parseAdventureCommand('BEGIN THE ADVENTURE');
      
      expect(result.command).toBe('begin_adventure');
    });

    it('should handle extra whitespace', () => {
      const result = adventureInputParserService.parseAdventureCommand('  Begin   the   adventure  ');
      
      expect(result.command).toBe('begin_adventure');
    });

    it('should handle trailing punctuation', () => {
      const result = adventureInputParserService.parseAdventureCommand('Begin the adventure!');
      
      expect(result.command).toBe('begin_adventure');
    });

    it('should return invalid for unrecognized commands', () => {
      const result = adventureInputParserService.parseAdventureCommand('Random text here');
      
      expect(result.command).toBe('invalid');
    });
  });

  describe('Input Normalization', () => {
    it('should normalize input consistently', () => {
      const inputs = [
        'Begin the adventure',
        'BEGIN THE ADVENTURE',
        '  Begin   the   adventure  ',
        'Begin the adventure!',
        'Begin the adventure.',
        'Begin the adventure;'
      ];

      inputs.forEach(input => {
        const result = adventureInputParserService.parseAdventureCommand(input);
        expect(result.command).toBe('begin_adventure');
      });
    });

    it('should clean IDs properly', () => {
      const result = adventureInputParserService.parseAdventureCommand('Begin adventure "  MYSTIKA-TUTORIAL  "');
      
      expect(result.adventureId).toBe('mystika-tutorial');
    });

    it('should handle IDs with spaces', () => {
      const result = adventureInputParserService.parseAdventureCommand('Begin adventure "mystika tutorial"');
      
      expect(result.adventureId).toBe('mystika_tutorial');
    });
  });

  describe('Command Validation', () => {
    it('should validate valid commands', () => {
      const result = adventureInputParserService.parseAdventureCommand('Begin adventure whispercross');
      const validation = adventureInputParserService.validateParsedCommand(result);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should validate commands with scene IDs', () => {
      const result = adventureInputParserService.parseAdventureCommand('Begin adventure whispercross from forest_meet');
      const validation = adventureInputParserService.validateParsedCommand(result);
      
      expect(validation.valid).toBe(true);
    });

    it('should reject invalid commands', () => {
      const result = adventureInputParserService.parseAdventureCommand('Random text');
      const validation = adventureInputParserService.validateParsedCommand(result);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Invalid command format');
    });

    it('should validate scene ID format', () => {
      const result = adventureInputParserService.parseAdventureCommand('Begin adventure test from "invalid scene id!"');
      const validation = adventureInputParserService.validateParsedCommand(result);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Invalid scene ID format');
    });
  });

  describe('Help Message Generation', () => {
    it('should generate helpful error message', () => {
      const helpMessage = adventureInputParserService.generateHelpMessage();
      
      expect(helpMessage).toContain('Valid adventure start commands');
      expect(helpMessage).toContain('Begin the adventure');
      expect(helpMessage).toContain('Begin adventure <id>');
      expect(helpMessage).toContain('Examples');
    });
  });
});
