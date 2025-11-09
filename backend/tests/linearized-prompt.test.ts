/**
 * Linearized Prompt Tests
 * Tests for stable concatenation order
 */

import { describe, it, expect } from 'vitest';
import { buildLinearizedPrompt } from '../src/utils/linearized-prompt.js';
import type { TurnPacketV3 } from '../src/types/turn-packet-v3.js';

describe('Linearized Prompt Builder', () => {
  it('should maintain stable concatenation order', () => {
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

    const linearized = buildLinearizedPrompt(tp);

    // Verify order: CORE → RULESET → MODULES → WORLD → SCENARIO → NPCS → STATE → INPUT
    const coreIndex = linearized.indexOf('# CORE');
    const rulesetIndex = linearized.indexOf('# RULESET');
    const modulesIndex = linearized.indexOf('# MODULES');
    const worldIndex = linearized.indexOf('# WORLD');
    const scenarioIndex = linearized.indexOf('# SCENARIO');
    const npcsIndex = linearized.indexOf('# NPCS');
    const stateIndex = linearized.indexOf('# STATE');
    const inputIndex = linearized.indexOf('# INPUT');

    expect(coreIndex).toBeGreaterThan(-1);
    expect(rulesetIndex).toBeGreaterThan(coreIndex);
    expect(modulesIndex).toBeGreaterThan(rulesetIndex);
    expect(worldIndex).toBeGreaterThan(modulesIndex);
    expect(scenarioIndex).toBeGreaterThan(worldIndex);
    expect(npcsIndex).toBeGreaterThan(scenarioIndex);
    expect(stateIndex).toBeGreaterThan(npcsIndex);
    expect(inputIndex).toBeGreaterThan(stateIndex);
  });

  it('should handle minimal TurnPacketV3', () => {
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

    const linearized = buildLinearizedPrompt(tp);

    // Should still have INPUT section
    expect(linearized).toContain('# INPUT');
    expect(linearized).toContain('Test');
  });
});

