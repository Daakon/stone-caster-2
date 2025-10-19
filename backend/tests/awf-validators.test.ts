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
        id: 'world.test',
        name: 'Test World',
        version: '1.0.0',
        slices: []
      };
      expect(() => WorldDocSchema.parse(validDoc)).not.toThrow();
    });

    it('should validate a world document with optional timeworld', () => {
      const validDoc = {
        id: 'world.test',
        name: 'Test World',
        version: '1.0.0',
        timeworld: {
          timezone: 'UTC',
          calendar: 'Gregorian',
          seasons: ['Spring', 'Summer', 'Autumn', 'Winter']
        },
        slices: []
      };
      expect(() => WorldDocSchema.parse(validDoc)).not.toThrow();
    });

    it('should validate a world document with top-level sections', () => {
      const validDoc = {
        id: 'world.test',
        name: 'Test World',
        version: '1.0.0',
        bands: [
          { id: 'dawn_to_mid_day', label: 'Dawn→Mid-Day', ticks: 60 },
          { id: 'mid_day_to_evening', label: 'Mid-Day→Evening', ticks: 60 }
        ],
        weather_states: ['clear', 'overcast', 'rain', 'fog'],
        weather_transition_bias: { 'clear->rain': 0.10, 'rain->clear': 0.25 },
        magic: {
          domains: ['Creation', 'Destruction', 'Arcane', 'Void'],
          rules: ['Great workings require time and focus.']
        },
        essence_behavior: {
          Life: 'empathetic, restorative',
          Death: 'stoic, accepts hardship',
          Order: 'dutiful, plans ahead',
          Chaos: 'impulsive, playful volatility'
        },
        slices: []
      };
      expect(() => WorldDocSchema.parse(validDoc)).not.toThrow();
    });

    it('should validate a world document with custom sections', () => {
      const validDoc = {
        id: 'world.test',
        name: 'Test World',
        version: '1.0.0',
        custom_section: {
          custom_field: 'custom_value',
          another_field: 123
        },
        another_custom: ['item1', 'item2'],
        slices: []
      };
      expect(() => WorldDocSchema.parse(validDoc)).not.toThrow();
    });

    it('should reject world documents missing required fields', () => {
      const invalidDocs = [
        {}, // Missing all required fields
        { id: 'world.test' }, // Missing name, version
        { id: 'world.test', name: 'Test World' }, // Missing version
        { name: 'Test World', version: '1.0.0' }, // Missing id
        { id: 'world.test', version: '1.0.0' }, // Missing name
        { id: 'world.test', name: 'Test World' } // Missing version
      ];

      for (const doc of invalidDocs) {
        expect(() => WorldDocSchema.parse(doc)).toThrow();
      }
    });

    it('should reject world documents with invalid field types', () => {
      const invalidDocs = [
        { id: 123, name: 'Test World', version: '1.0.0', slices: [] }, // Invalid id type
        { id: 'world.test', name: 123, version: '1.0.0', slices: [] }, // Invalid name type
        { id: 'world.test', name: 'Test World', version: 123, slices: [] }, // Invalid version type
        { id: 'world.test', name: 'Test World', version: '1.0.0', slices: 'not-array' } // Invalid slices type
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
        { id: 'adv.test.v1' }, // Missing world_ref
        { world_ref: 'world.test.v1' }, // Missing id
        {
          id: 123, // Invalid id type
          world_ref: 'world.test.v1',
        },
        {
          id: 'adv.test.v1',
          world_ref: 123, // Invalid world_ref type
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
        { start: {} }, // Missing start.scene (required)
        { start: { scene: 123 } }, // Invalid start.scene type
        {
          start: {
            scene: 'loc.1',
            description: 'Test',
          },
          rules: {
            no_time_advance: 'invalid', // Invalid type for boolean
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


