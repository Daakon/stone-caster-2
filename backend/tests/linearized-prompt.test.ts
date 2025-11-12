/**
 * Linearized Prompt Tests
 * Tests for stable concatenation order
 */

import { describe, it, expect, vi } from 'vitest';
import { buildLinearizedPrompt } from '../src/utils/linearized-prompt.js';
import type { TurnPacketV3 } from '../src/types/turn-packet-v3.js';

vi.mock('../src/services/slots.service.js', () => ({
  getSlotByTypeAndName: vi.fn().mockResolvedValue(null),
}));

describe('Linearized Prompt Builder', () => {
  it('should maintain stable concatenation order', async () => {
    const tp: TurnPacketV3 = {
      tp_version: '3',
      contract: 'awf.v1',
      core: {
        style: 'immersive',
        safety: ['guardrails_enabled'],
        output_rules: 'Return exactly one JSON object',
      },
      ruleset: {
        id: 'test-ruleset',
        version: '1.0.0',
        slots: {
          principles: 'Test principles',
          choice_style: 'Test choice style',
        },
      },
      modules: [
        {
          id: 'test-module',
          version: '1.0.0',
          slots: {
            'module.hints': 'Hint one',
            'module.actions': 'Action one',
          },
          params: { hints: ['hint1'], actions: ['action1'] },
        },
      ],
      world: {
        id: 'test-world',
        version: '1.0.0',
        slots: {
          tone: 'dark fantasy',
          taboos: 'No explicit violence',
        },
      },
      scenario: {
        id: 'test-scenario',
        version: '1.0.0',
        slots: {
          setup: 'Test setup',
          beats: 'Test beats',
        },
      },
      npcs: [
        {
          id: 'npc-1',
          name: 'Test NPC',
          slots: {
            bio: 'Test bio',
            persona: 'Test persona',
          },
        },
      ],
      state: { flags: { test: true } },
      input: {
        kind: 'choice',
        text: 'Test input',
      },
    };

    const linearized = await buildLinearizedPrompt(tp);

    const markers = [
      '# CORE',
      '## Principles',
      '### test-module Hints',
      '## Tone',
      '## Setup',
      '## Test NPC Bio',
      '# STATE',
      '# INPUT',
    ];

    const positions = markers.map(marker => linearized.indexOf(marker));
    positions.forEach(pos => expect(pos).toBeGreaterThan(-1));
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });

  it('should handle minimal TurnPacketV3', async () => {
    const tp: TurnPacketV3 = {
      tp_version: '3',
      contract: 'awf.v1',
      core: {
        safety: [],
      },
      ruleset: {
        id: 'test-ruleset',
        version: '1.0.0',
        slots: {},
      },
      modules: [],
      world: {
        id: 'test-world',
        version: '1.0.0',
        slots: {},
      },
      npcs: [],
      state: {},
      input: {
        kind: 'choice',
        text: 'Test',
      },
    };

    const linearized = await buildLinearizedPrompt(tp);

    // Should still have INPUT section
    expect(linearized).toContain('# INPUT');
    expect(linearized).toContain('Test');
  });
});

