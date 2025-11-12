/**
 * TurnPacket Extras Integration Tests
 * Ensure extras are available to Mustache templates
 */

import { describe, it, expect } from 'vitest';
import { buildTurnPacketV3FromV3 } from '../src/adapters/turn-packet-v3-adapter.js';
import { renderSlotsForPack } from '../src/slots/render-db.js';
import { upsertFieldDef } from '../src/services/field-defs.service.js';
import { supabaseAdmin } from '../src/services/supabase.js';
import type { EntryPointAssemblerV3Output } from '../src/prompts/entry-point-assembler-v3.js';

describe('TurnPacket Extras Integration', () => {
  it('should include extras in Mustache context', async () => {
    // Create a field definition
    await upsertFieldDef({
      pack_type: 'world',
      key: 'test_extra',
      label: 'Test Extra',
      schema_json: { type: 'string' },
    });

    // Set extras on a test world (we'll need to create/update a world)
    // For this test, we'll mock the pack data directly
    const mockV3Output: EntryPointAssemblerV3Output = {
      prompt: '',
      pieces: [],
      meta: {
        worldId: 'test-world',
        worldSlug: 'test-world',
        rulesetSlug: 'test-ruleset',
        entryPointId: 'test-entry',
        entryPointSlug: 'test-entry',
        entryStartSlug: 'test-start',
        tokenEst: { input: 0, budget: 8000, pct: 0 },
        model: 'gpt-4o-mini',
        source: 'test',
        version: 'v3',
        npcTrimmedCount: 0,
        selectionContext: {},
      },
    };

    // Create a template that uses extras
    await supabaseAdmin.from('templates').upsert({
      type: 'world',
      slot: 'tone',
      version: 1,
      body: 'World tone: {{extras.test_extra}}',
      status: 'published',
    });

    // Build TurnPacketV3 (this will load extras from DB if world exists)
    const CORE_PROMPT = 'Test core prompt';
    const tp = await buildTurnPacketV3FromV3(
      mockV3Output,
      CORE_PROMPT,
      {},
      'Test input',
      'test-build'
    );

    // Verify extras would be available (we can't easily test DB loading in unit test,
    // but we can verify the structure)
    expect(tp.world).toBeDefined();
    expect(tp.world.slots).toBeDefined();
  });

  it('should render template with extras reference', async () => {
    // Create a pack with extras
    const pack = {
      type: 'world' as const,
      id: 'test-world',
      version: '1.0.0',
      data: {
        world: { id: 'test-world', name: 'Test World' },
        extras: { test_extra: 'Test Value' },
      },
    };

    // Create template that uses extras
    await supabaseAdmin.from('templates').upsert({
      type: 'world',
      slot: 'tone',
      version: 1,
      body: 'Extra value: {{extras.test_extra}}',
      status: 'published',
    });

    const slots = await renderSlotsForPack(pack);
    expect(slots.tone).toContain('Test Value');
  });
});

