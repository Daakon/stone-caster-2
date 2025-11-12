/**
 * TurnPacketV3 Tests
 * Unit tests for TurnPacketV3 and AwfV1 validators
 */

import { describe, it, expect } from 'vitest';
import { TurnPacketV3Schema, AwfV1Schema } from '../src/validators/turn-packet-v3.schema.js';
import type { TurnPacketV3, AwfV1 } from '../src/types/turn-packet-v3.js';

describe('TurnPacketV3 Schema', () => {
  it('should validate a minimal valid TurnPacketV3', () => {
    const valid: TurnPacketV3 = {
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
        text: 'Test input',
      },
    };

    const result = TurnPacketV3Schema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate a complete TurnPacketV3 with all fields', () => {
    const valid: TurnPacketV3 = {
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
        params: { difficulty: 'normal' },
        slots: {
          principles: 'Test principles',
          choice_style: 'Test style',
        },
      },
      modules: [
        {
          id: 'test-module',
          version: '1.0.0',
          params: { enabled: true },
        },
      ],
      world: {
        id: 'test-world',
        version: '1.0.0',
        slots: {
          tone: 'dark fantasy',
        },
      },
      scenario: {
        id: 'test-scenario',
        version: '1.0.0',
        slots: {},
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
      state: {
        flags: { test: true },
      },
      input: {
        kind: 'choice',
        text: 'Test input',
      },
      meta: {
        budgets: {
          max_ctx_tokens: 8000,
        },
        seed: 'test-seed',
        buildId: 'build-123',
      },
    };

    const result = TurnPacketV3Schema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should reject invalid tp_version', () => {
    const invalid = {
      tp_version: '2',
      contract: 'awf.v1',
      core: { safety: [] },
      ruleset: { id: 'test', version: '1.0.0', slots: {} },
      modules: [],
      world: { id: 'test', version: '1.0.0', slots: {} },
      npcs: [],
      state: {},
      input: { kind: 'choice', text: 'test' },
    };

    const result = TurnPacketV3Schema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject missing required fields', () => {
    const invalid = {
      tp_version: '3',
      contract: 'awf.v1',
      // Missing core, ruleset, world, input
    };

    const result = TurnPacketV3Schema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('AwfV1 Schema', () => {
  it('should validate a minimal valid AwfV1', () => {
    const valid: AwfV1 = {
      scn: {
        id: 'scene-1',
        ph: 'scene_body',
      },
      txt: 'Test narrative',
      choices: [],
      acts: [],
      val: {
        ok: true,
        errors: [],
        repairs: [],
      },
    };

    const result = AwfV1Schema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate a complete AwfV1 with all fields', () => {
    const valid: AwfV1 = {
      scn: {
        id: 'scene-1',
        ph: 'scene_body',
      },
      txt: 'Test narrative text',
      choices: [
        { id: 'choice-1', label: 'Choice 1' },
        { id: 'choice-2', label: 'Choice 2' },
      ],
      acts: [
        { eid: 'act-1', t: 'TIME_ADVANCE', payload: { ticks: 1 } },
      ],
      val: {
        ok: true,
        errors: [],
        repairs: [],
      },
    };

    const result = AwfV1Schema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should reject missing required fields', () => {
    const invalid = {
      txt: 'Test',
      // Missing scn, val
    };

    const result = AwfV1Schema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

