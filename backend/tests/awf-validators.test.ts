/**
 * Unit tests for AWF (Adventure World Format) bundle validators
 * Phase 1: Data Model - Validator testing
 */

import { describe, it, expect } from 'vitest';
import {
  CoreContractDocSchema,
  WorldDocSchema,
  AdventureDocSchema,
  AdventureStartDocSchema,
  InjectionMapDocSchema,
} from '../src/validators/awf-validators.js';

describe('AWF Validators', () => {
  describe('CoreContractDocSchema', () => {
    it('should validate a minimal core contract document', () => {
      const validDoc = {
        contract: {
          version: 'v4',
          name: 'Test Contract',
          description: 'A test contract',
        },
        acts: {
          allowed: ['move', 'interact'],
        },
      };

      expect(() => CoreContractDocSchema.parse(validDoc)).not.toThrow();
    });

    it('should validate a core contract with memory exemplars', () => {
      const validDoc = {
        contract: {
          version: 'v4',
          name: 'Test Contract',
          description: 'A test contract',
        },
        acts: {
          allowed: ['move', 'interact'],
        },
        memory: {
          exemplars: [
            {
              id: 'exemplar-1',
              content: 'Test exemplar content',
            },
          ],
        },
      };

      expect(() => CoreContractDocSchema.parse(validDoc)).not.toThrow();
    });

    it('should reject invalid core contract documents', () => {
      const invalidDocs = [
        {}, // Missing required fields
        { contract: {} }, // Missing contract fields
        { contract: { version: 'v4' } }, // Missing name and description
        { contract: { version: 'v4', name: 'Test' } }, // Missing description
        { acts: { allowed: [] } }, // Missing contract
        { contract: { version: 'v4', name: 'Test', description: 'Test' } }, // Missing acts
      ];

      for (const doc of invalidDocs) {
        expect(() => CoreContractDocSchema.parse(doc)).toThrow();
      }
    });
  });

  describe('WorldDocSchema', () => {
    it('should validate a minimal world document', () => {
      const validDoc = {
        id: 'world.test.v1',
        name: 'Test World',
        version: 'v1',
        hash: 'abc123',
      };

      expect(() => WorldDocSchema.parse(validDoc)).not.toThrow();
    });

    it('should validate a world document with timeworld and slices', () => {
      const validDoc = {
        id: 'world.test.v1',
        name: 'Test World',
        version: 'v1',
        hash: 'abc123',
        timeworld: {
          timezone: 'UTC',
          calendar: 'test_calendar',
          seasons: ['spring', 'summer'],
        },
        slices: [
          {
            id: 'slice.1',
            name: 'Test Slice',
            description: 'A test slice',
            type: 'location',
          },
        ],
      };

      expect(() => WorldDocSchema.parse(validDoc)).not.toThrow();
    });

    it('should reject invalid world documents', () => {
      const invalidDocs = [
        {}, // Missing required fields
        { id: 'world.test.v1' }, // Missing name, version, hash
        { id: 'world.test.v1', name: 'Test' }, // Missing version, hash
        { id: 'world.test.v1', name: 'Test', version: 'v1' }, // Missing hash
        {
          id: 'world.test.v1',
          name: 'Test',
          version: 'v1',
          hash: 'abc123',
          slices: [
            {
              id: 'slice.1',
              name: 'Test Slice',
              description: 'A test slice',
              type: 'invalid_type', // Invalid type
            },
          ],
        },
      ];

      for (const doc of invalidDocs) {
        expect(() => WorldDocSchema.parse(doc)).toThrow();
      }
    });
  });

  describe('AdventureDocSchema', () => {
    it('should validate a minimal adventure document', () => {
      const validDoc = {
        id: 'adv.test.v1',
        world_ref: 'world.test.v1',
        version: 'v1',
        hash: 'abc123',
      };

      expect(() => AdventureDocSchema.parse(validDoc)).not.toThrow();
    });

    it('should validate an adventure document with all optional fields', () => {
      const validDoc = {
        id: 'adv.test.v1',
        world_ref: 'world.test.v1',
        version: 'v1',
        hash: 'abc123',
        locations: [
          {
            id: 'loc.1',
            name: 'Test Location',
            description: 'A test location',
          },
        ],
        objectives: [
          {
            id: 'obj.1',
            title: 'Test Objective',
            description: 'A test objective',
            type: 'main',
            status: 'active',
          },
        ],
        npcs: [
          {
            id: 'npc.1',
            name: 'Test NPC',
            description: 'A test NPC',
            role: 'guide',
          },
        ],
        slices: [
          {
            id: 'slice.1',
            name: 'Test Slice',
            description: 'A test slice',
            type: 'scene',
          },
        ],
      };

      expect(() => AdventureDocSchema.parse(validDoc)).not.toThrow();
    });

    it('should reject invalid adventure documents', () => {
      const invalidDocs = [
        {}, // Missing required fields
        { id: 'adv.test.v1' }, // Missing world_ref, version, hash
        { id: 'adv.test.v1', world_ref: 'world.test.v1' }, // Missing version, hash
        {
          id: 'adv.test.v1',
          world_ref: 'world.test.v1',
          version: 'v1',
          hash: 'abc123',
          objectives: [
            {
              id: 'obj.1',
              title: 'Test Objective',
              description: 'A test objective',
              type: 'invalid_type', // Invalid type
              status: 'active',
            },
          ],
        },
      ];

      for (const doc of invalidDocs) {
        expect(() => AdventureDocSchema.parse(doc)).toThrow();
      }
    });
  });

  describe('AdventureStartDocSchema', () => {
    it('should validate a minimal adventure start document', () => {
      const validDoc = {
        start: {
          scene: 'loc.forest_clearing',
          description: 'You find yourself in a forest clearing.',
        },
        rules: {
          no_time_advance: true,
        },
      };

      expect(() => AdventureStartDocSchema.parse(validDoc)).not.toThrow();
    });

    it('should validate an adventure start document with additional rules', () => {
      const validDoc = {
        start: {
          scene: 'loc.forest_clearing',
          description: 'You find yourself in a forest clearing.',
          initial_state: {
            time: 'morning',
            weather: 'clear',
          },
        },
        rules: {
          no_time_advance: true,
          allow_save: true,
          allow_load: true,
        },
      };

      expect(() => AdventureStartDocSchema.parse(validDoc)).not.toThrow();
    });

    it('should reject invalid adventure start documents', () => {
      const invalidDocs = [
        {}, // Missing required fields
        { start: {} }, // Missing start fields
        { start: { scene: 'loc.1' } }, // Missing description
        { start: { scene: 'loc.1', description: 'Test' } }, // Missing rules
        {
          start: {
            scene: 'loc.1',
            description: 'Test',
          },
          rules: {
            no_time_advance: 'invalid', // Invalid type
          },
        },
      ];

      for (const doc of invalidDocs) {
        expect(() => AdventureStartDocSchema.parse(doc)).toThrow();
      }
    });
  });

  describe('InjectionMapDocSchema', () => {
    it('should validate a minimal injection map document', () => {
      const validDoc = {
        build: {
          'core.contract': '/core/contract',
        },
        acts: {
          'move': '/acts/move',
        },
      };

      expect(() => InjectionMapDocSchema.parse(validDoc)).not.toThrow();
    });

    it('should validate an injection map document with multiple entries', () => {
      const validDoc = {
        build: {
          'core.contract': '/core/contract',
          'world.data': '/world/data',
          'adventure.data': '/adventure/data',
        },
        acts: {
          'move': '/acts/move',
          'interact': '/acts/interact',
          'inventory': '/acts/inventory',
        },
      };

      expect(() => InjectionMapDocSchema.parse(validDoc)).not.toThrow();
    });

    it('should reject invalid injection map documents', () => {
      const invalidDocs = [
        {}, // Missing required fields
        { build: {} }, // Missing acts
        { acts: {} }, // Missing build
        {
          build: {
            'core.contract': '/core/contract',
          },
          acts: {
            'move': 123, // Invalid type (should be string)
          },
        },
      ];

      for (const doc of invalidDocs) {
        expect(() => InjectionMapDocSchema.parse(doc)).toThrow();
      }
    });
  });
});


