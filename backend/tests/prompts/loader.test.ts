import { describe, it, expect, beforeEach } from 'vitest';
import { PromptLoader } from '../../src/prompts/loader.js';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('PromptLoader', () => {
  let loader: PromptLoader;
  const testPromptsPath = join(process.cwd(), 'GPT Prompts');

  beforeEach(() => {
    loader = new PromptLoader(testPromptsPath);
  });

  describe('JSON Content Cleaning', () => {
    it('should remove JSON comments and minimize whitespace', () => {
      const jsonWithComments = `{
        // This is a comment
        "name": "test",
        /* This is a block comment */
        "version": "1.0.0",
        "rules": {
          "enabled": true
        }
      }`;

      // Access private method for testing
      const cleaned = (loader as any).cleanJsonContent(jsonWithComments);
      const expected = '{"name":"test","version":"1.0.0","rules":{"enabled":true}}';
      
      expect(cleaned).toBe(expected);
    });

    it('should handle invalid JSON gracefully', () => {
      const invalidJson = `{
        "name": "test",
        // Unclosed comment
        "version": "1.0.0"
      `;

      const cleaned = (loader as any).cleanJsonContent(invalidJson);
      
      // Should return the cleaned content as-is when parsing fails
      expect(cleaned).toContain('"name": "test"');
      expect(cleaned).toContain('"version": "1.0.0"');
      expect(cleaned).not.toContain('// Unclosed comment');
    });

    it('should remove empty lines and extra whitespace', () => {
      const jsonWithWhitespace = `{
        
        "name": "test",
        
        "version": "1.0.0"
        
      }`;

      const cleaned = (loader as any).cleanJsonContent(jsonWithWhitespace);
      const expected = '{"name":"test","version":"1.0.0"}';
      
      expect(cleaned).toBe(expected);
    });
  });

  describe('JSON Minimization', () => {
    it('should minimize JSON objects', () => {
      const obj = {
        name: 'test',
        version: '1.0.0',
        rules: {
          enabled: true,
          settings: ['option1', 'option2']
        }
      };

      const minimized = (loader as any).minimizeJson(obj);
      const expected = '{"name":"test","version":"1.0.0","rules":{"enabled":true,"settings":["option1","option2"]}}';
      
      expect(minimized).toBe(expected);
    });

    it('should handle arrays correctly', () => {
      const arr = ['item1', 'item2', { nested: 'object' }];
      const minimized = (loader as any).minimizeJson(arr);
      const expected = '["item1","item2",{"nested":"object"}]';
      
      expect(minimized).toBe(expected);
    });
  });

  describe('JSON Section Formatting', () => {
    it('should format string sections as-is', () => {
      const section = 'This is a string section';
      const formatted = (loader as any).formatJsonSection(section);
      
      expect(formatted).toBe(section);
    });

    it('should format arrays with summary and minimized JSON', () => {
      const section = ['item1', 'item2', 'item3'];
      const formatted = (loader as any).formatJsonSection(section);
      
      expect(formatted).toContain('3 items');
      expect(formatted).toContain('```json');
      expect(formatted).toContain('["item1","item2","item3"]');
    });

    it('should format objects with key summary and minimized JSON', () => {
      const section = {
        key1: 'value1',
        key2: 'value2',
        nested: { inner: 'value' }
      };
      const formatted = (loader as any).formatJsonSection(section);
      
      expect(formatted).toContain('Keys: key1, key2, nested');
      expect(formatted).toContain('```json');
      expect(formatted).toContain('{"key1":"value1","key2":"value2","nested":{"inner":"value"}}');
    });

    it('should handle empty arrays and objects', () => {
      const emptyArray = [];
      const emptyObject = {};
      
      const arrayFormatted = (loader as any).formatJsonSection(emptyArray);
      const objectFormatted = (loader as any).formatJsonSection(emptyObject);
      
      expect(arrayFormatted).toContain('Empty array');
      expect(objectFormatted).toContain('Empty object');
    });
  });

  describe('JSON Prompt Formatting', () => {
    it('should format complete JSON prompt with sections and minimized JSON', () => {
      const parsed = {
        name: 'Test System',
        version: '1.0.0',
        about: 'A test system for validation',
        rules: {
          enabled: true,
          settings: ['option1', 'option2']
        },
        mechanics: {
          type: 'rpg',
          complexity: 'medium'
        }
      };

      const formatted = (loader as any).formatJsonAsPrompt(parsed, 'test-system');
      
      // Check header information
      expect(formatted).toContain('## Test System');
      expect(formatted).toContain('**Name**: Test System');
      expect(formatted).toContain('**Version**: 1.0.0');
      expect(formatted).toContain('**About**: A test system for validation');
      
      // Check section formatting
      expect(formatted).toContain('### Rules');
      expect(formatted).toContain('### Mechanics');
      
      // Check complete configuration section
      expect(formatted).toContain('### Complete Configuration');
      expect(formatted).toContain('```json');
      expect(formatted).toContain('{"name":"Test System","version":"1.0.0"');
    });

    it('should handle JSON without optional fields', () => {
      const parsed = {
        name: 'Minimal System',
        rules: { enabled: true }
      };

      const formatted = (loader as any).formatJsonAsPrompt(parsed, 'minimal-system');
      
      expect(formatted).toContain('## Minimal System');
      expect(formatted).toContain('**Name**: Minimal System');
      expect(formatted).not.toContain('**Version**:');
      expect(formatted).not.toContain('**About**:');
      expect(formatted).toContain('### Rules');
    });
  });

  describe('File Processing Integration', () => {
    it('should process JSON files with cleaned content', async () => {
      // This test would require actual JSON files in the GPT Prompts directory
      // For now, we'll test the method exists and can be called
      expect(typeof loader.loadPromptManifest).toBe('function');
    });
  });
});
