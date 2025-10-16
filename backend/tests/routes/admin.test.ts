import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const LayerSchema = z.string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9_-]+$/i, 'Layer must use letters, numbers, underscores, or hyphens')
  .transform((value) => value.toLowerCase());

const PromptSchema = z.object({
  layer: LayerSchema,
  world_slug: z.string().nullable().optional(),
  adventure_slug: z.string().nullable().optional(),
  scene_id: z.string().nullable().optional(),
  turn_stage: z.enum(['any', 'start', 'ongoing', 'end']).default('any'),
  sort_order: z.number().int().min(0).default(0),
  version: z.union([z.string(), z.number(), z.null()]).transform(val => val === null ? '1.0.0' : String(val)).default('1.0.0'),
  content: z.string().min(1),
  metadata: z.record(z.any()).default({}),
  active: z.boolean().default(true),
  locked: z.boolean().default(false)
});

describe('Admin API Schema Validation', () => {
  describe('layer field normalization', () => {
    it('should normalise layer values to lowercase', () => {
      const input = {
        layer: ' Core ',
        content: 'Test content'
      };

      const result = PromptSchema.parse(input);
      expect(result.layer).toBe('core');
    });

    it('should reject invalid layer characters', () => {
      expect(() => PromptSchema.parse({ layer: 'core rules', content: 'Test content' })).toThrow();
    });
  });

  describe('version field coercion', () => {
    it('should coerce numeric version to string', () => {
      const input = {
        layer: 'core',
        content: 'Test content',
        version: 123
      };

      const result = PromptSchema.parse(input);
      expect(result.version).toBe('123');
      expect(typeof result.version).toBe('string');
    });

    it('should coerce float version to string', () => {
      const input = {
        layer: 'core',
        content: 'Test content',
        version: 1.5
      };

      const result = PromptSchema.parse(input);
      expect(result.version).toBe('1.5');
      expect(typeof result.version).toBe('string');
    });

    it('should keep string version as string', () => {
      const input = {
        layer: 'core',
        content: 'Test content',
        version: '2.0.0'
      };

      const result = PromptSchema.parse(input);
      expect(result.version).toBe('2.0.0');
      expect(typeof result.version).toBe('string');
    });

    it('should use default version when not provided', () => {
      const input = {
        layer: 'core',
        content: 'Test content'
      };

      const result = PromptSchema.parse(input);
      expect(result.version).toBe('1.0.0');
      expect(typeof result.version).toBe('string');
    });

    it('should handle null version by using default', () => {
      const input = {
        layer: 'core',
        content: 'Test content',
        version: null
      };

      const result = PromptSchema.parse(input);
      expect(result.version).toBe('1.0.0');
      expect(typeof result.version).toBe('string');
    });
  });

  describe('metadata with dependencies', () => {
    it('should accept metadata with mixed dependency types', () => {
      const input = {
        layer: 'core',
        content: 'Test content',
        metadata: {
          dependencies: [
            '550e8400-e29b-41d4-a716-446655440000',
            'stats',
            'validate-dependencies',
            'another-uuid-here'
          ]
        }
      };

      const result = PromptSchema.parse(input);

      expect(result.metadata.dependencies).toEqual([
        '550e8400-e29b-41d4-a716-446655440000',
        'stats',
        'validate-dependencies',
        'another-uuid-here'
      ]);
    });
  });
});
