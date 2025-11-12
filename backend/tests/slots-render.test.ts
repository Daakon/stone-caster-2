/**
 * Slot Rendering Tests
 * Unit tests for renderSlots() function
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderSlots, renderSlotsForPack, type SlotPack } from '../src/slots/render.js';
import { seedSlotsAndTemplates } from '../src/slots/registry.js';

describe('renderSlots', () => {
  beforeEach(() => {
    // Re-seed templates before each test
    seedSlotsAndTemplates();
  });

  it('should render all 5 slots for sample packs', () => {
    const packs: SlotPack[] = [
      {
        type: 'world',
        id: 'test-world',
        name: 'Test World',
        version: '1.0.0',
        data: {
          world: {
            id: 'test-world',
            name: 'Test World',
            tone: 'dark fantasy',
            tone_description: 'A grim and foreboding atmosphere',
          },
        },
      },
      {
        type: 'ruleset',
        id: 'test-ruleset',
        version: '1.0.0',
        data: {
          ruleset: {
            id: 'test-ruleset',
            principles_text: 'Focus on player agency and meaningful choices',
            choice_style: 'direct',
            choice_style_guidance: 'Present choices clearly and concisely',
          },
        },
      },
      {
        type: 'npc',
        id: 'npc-1',
        name: 'Test NPC',
        data: {
          npc: {
            id: 'npc-1',
            name: 'Test NPC',
            bio_text: 'A mysterious traveler',
            bio_background: 'They arrived from the northern lands',
            persona_traits: 'cautious and observant',
            persona_behavior: 'They prefer to watch before acting',
          },
        },
      },
    ];

    const result = renderSlots(packs);

    // Check world slots
    expect(result['test-world']).toBeDefined();
    expect(result['test-world'].find(s => s.slot === 'tone')).toBeDefined();

    // Check ruleset slots
    expect(result['test-ruleset']).toBeDefined();
    expect(result['test-ruleset'].find(s => s.slot === 'principles')).toBeDefined();
    expect(result['test-ruleset'].find(s => s.slot === 'choice_style')).toBeDefined();

    // Check NPC slots
    expect(result['npc-1']).toBeDefined();
    expect(result['npc-1'].find(s => s.slot === 'bio')).toBeDefined();
    expect(result['npc-1'].find(s => s.slot === 'persona')).toBeDefined();
  });

  it('should render slots for a single pack', () => {
    const pack: SlotPack = {
      type: 'world',
      id: 'test-world',
      data: {
        world: {
          id: 'test-world',
          name: 'Test World',
          tone: 'epic fantasy',
          tone_description: 'A grand adventure awaits',
        },
      },
    };

    const result = renderSlotsForPack(pack);

    expect(result.tone).toBeDefined();
    expect(result.tone).toContain('Test World');
    expect(result.tone).toContain('epic fantasy');
  });

  it('should handle missing template data gracefully', () => {
    const pack: SlotPack = {
      type: 'world',
      id: 'test-world',
      data: {
        world: {
          id: 'test-world',
          // Missing tone and tone_description
        },
      },
    };

    const result = renderSlotsForPack(pack);

    // Should still render, but with empty/undefined values
    expect(result.tone).toBeDefined();
  });

  it('should respect max_len constraints', () => {
    const pack: SlotPack = {
      type: 'world',
      id: 'test-world',
      data: {
        world: {
          id: 'test-world',
          name: 'Test World',
          tone: 'dark fantasy',
          tone_description: 'A'.repeat(1000), // Very long description
        },
      },
    };

    const result = renderSlotsForPack(pack);

    // Should be truncated to max_len (500) + '...'
    expect(result.tone.length).toBeLessThanOrEqual(503);
  });
});

