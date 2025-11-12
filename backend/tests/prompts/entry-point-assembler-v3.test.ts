import { describe, it, expect, vi } from 'vitest';
import { EntryPointAssemblerV3, EntryPointAssemblerError } from '../../src/prompts/entry-point-assembler-v3.js';
import { POLICY_ACTIONS } from '../../src/prompts/assembler-types.js';

type EntryPointFixture = {
  entryPoint?: any;
  world?: any;
  ruleset?: any;
  multipleDefaults?: boolean;
  npcBindings?: Array<{ npc_id: string; npc_slug: string | null; sort_order: number }>;
  npcs?: Array<{ id: string; name: string; slug: string | null; prompt?: any; doc?: any }>;
};

const defaultEntryPoint = {
  id: 'ep-1',
  slug: 'entry-1',
  type: 'adventure',
  world_id: 'world-1',
  content: {
    doc: {
      entryStartSlug: 'start-1',
      prompt: { text: '# Entry\n\nBegin here.' },
    },
  },
};

const defaultWorld = {
  id: 'world-1',
  slug: 'world-1',
  version: '1.0.0',
  doc: {
    prompt: { text: '# World\n\nWorld content.' },
  },
};

const defaultRuleset = {
  id: 'ruleset-1',
  slug: 'core',
  version: '1.0.0',
  doc: {
    prompt: { text: '# Ruleset\n\nRuleset content.' },
  },
};

const defaultNPCBindings: EntryPointFixture['npcBindings'] = [];
const defaultNPCs: EntryPointFixture['npcs'] = [];

function buildAssembler(overrides: EntryPointFixture = {}) {
  const assembler = new EntryPointAssemblerV3();

  (assembler as any).loadEntryPoint = vi
    .fn()
    .mockResolvedValue(overrides.entryPoint ?? defaultEntryPoint);

  const worldValue = Object.prototype.hasOwnProperty.call(overrides, 'world')
    ? overrides.world
    : defaultWorld;
  (assembler as any).loadWorld = vi.fn().mockResolvedValue(worldValue);

  const rulesetValue = Object.prototype.hasOwnProperty.call(overrides, 'ruleset')
    ? overrides.ruleset
    : defaultRuleset;
  const multipleDefaults = Object.prototype.hasOwnProperty.call(overrides, 'multipleDefaults')
    ? overrides.multipleDefaults
    : false;
  (assembler as any).loadDefaultRulesetForEntryPoint = vi.fn().mockResolvedValue({
    ruleset: rulesetValue,
    multipleDefaults,
  });

  (assembler as any).loadEntryPointNPCs = vi
    .fn()
    .mockResolvedValue(overrides.npcBindings ?? defaultNPCBindings);

  (assembler as any).loadNPCs = vi.fn().mockResolvedValue(overrides.npcs ?? defaultNPCs);

  return assembler;
}

describe('EntryPointAssemblerV3', () => {
  it('assembles scopes in expected order with metadata', async () => {
    const assembler = buildAssembler({
      npcBindings: [{ npc_id: 'npc-1', npc_slug: 'npc-alpha', sort_order: 1 }],
      npcs: [
        {
          id: 'npc-1',
          name: 'NPC Alpha',
          slug: 'npc-alpha',
          prompt: { text: '# NPC Alpha\n\nHelps the hero.' },
        },
      ],
    });

    const result = await assembler.assemble({ entryPointId: 'ep-1' });

    expect(result.pieces.map(p => p.scope)).toEqual(['core', 'ruleset', 'world', 'entry', 'npc']);
    expect(result.meta.source).toBe('entry-point');
    expect(result.meta.version).toBe('v3');
    expect(result.meta.included).toContain('core:core-system@1.0.0');
  });

  it('applies budget policy and trims NPCs when over budget', async () => {
    const longText = '# NPC\n\n' + 'x'.repeat(500);
    const assembler = buildAssembler({
      npcBindings: [
        { npc_id: 'npc-1', npc_slug: 'npc-a', sort_order: 1 },
        { npc_id: 'npc-2', npc_slug: 'npc-b', sort_order: 2 },
      ],
      npcs: [
        { id: 'npc-1', name: 'NPC A', slug: 'npc-a', prompt: { text: longText } },
        { id: 'npc-2', name: 'NPC B', slug: 'npc-b', prompt: { text: longText } },
      ],
    });

    const result = await assembler.assemble({
      entryPointId: 'ep-1',
      budgetTokens: 200,
    });

    expect(result.meta.policy).toContain(POLICY_ACTIONS.NPC_DROPPED);
    const npcPieces = result.pieces.filter(p => p.scope === 'npc');
    expect(npcPieces.length).toBeLessThan(2); // trimmed at least one NPC
  });

  it('orders NPCs by sort order and slug deterministically', async () => {
    const assembler = buildAssembler({
      npcBindings: [
        { npc_id: 'npc-1', npc_slug: 'beta', sort_order: 5 },
        { npc_id: 'npc-2', npc_slug: 'alpha', sort_order: 5 },
      ],
      npcs: [
        { id: 'npc-1', name: 'Beta', slug: 'beta', prompt: { text: '# Beta' } },
        { id: 'npc-2', name: 'Alpha', slug: 'alpha', prompt: { text: '# Alpha' } },
      ],
    });

    const result = await assembler.assemble({ entryPointId: 'ep-1' });
    const npcPieces = result.pieces.filter(p => p.scope === 'npc');
    expect(npcPieces.map(p => p.slug)).toEqual(['alpha', 'beta']);
  });

  it('throws EntryPointAssemblerError when world is missing', async () => {
    const assembler = buildAssembler({ world: null });

    await expect(assembler.assemble({ entryPointId: 'ep-1' })).rejects.toThrow(
      EntryPointAssemblerError
    );
  });
});
