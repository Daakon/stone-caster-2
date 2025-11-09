/**
 * Snapshot Override Tests
 * Tests for override safeguards and validation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createPromptSnapshot, getPromptSnapshot } from '../src/services/prompt-snapshots.service.js';
import { TurnPacketV3Schema } from '../src/validators/turn-packet-v3.schema.js';
import type { TurnPacketV3 } from '../src/types/turn-packet-v3.js';
import { supabaseAdmin } from '../src/services/supabase.js';

describe('Snapshot Override Safeguards', () => {
  let originalSnapshotId: string;

  beforeAll(async () => {
    // Create a test snapshot
    const tp: TurnPacketV3 = {
      tp_version: '3',
      contract: 'awf.v1',
      core: { safety: [] },
      ruleset: { id: 'test', version: '1.0.0', slots: {} },
      modules: [],
      world: { id: 'test', version: '1.0.0', slots: {} },
      npcs: [],
      state: {},
      input: { kind: 'choice', text: 'test' },
    };

    const snapshot = await createPromptSnapshot({
      tp,
      linearized_prompt_text: 'Test prompt',
      source: 'auto',
    });

    originalSnapshotId = snapshot.snapshot_id;
  });

  afterAll(async () => {
    // Cleanup
    if (originalSnapshotId) {
      await supabaseAdmin
        .from('prompt_snapshots')
        .delete()
        .eq('snapshot_id', originalSnapshotId);
    }
  });

  it('should validate TurnPacketV3 schema', () => {
    const invalidTp = {
      tp_version: '2', // Invalid version
      contract: 'awf.v1',
    };

    const result = TurnPacketV3Schema.safeParse(invalidTp);
    expect(result.success).toBe(false);
  });

  it('should reject invalid contract', () => {
    const invalidTp: TurnPacketV3 = {
      tp_version: '3',
      contract: 'awf.v2' as any, // Invalid contract
      core: { safety: [] },
      ruleset: { id: 'test', version: '1.0.0', slots: {} },
      modules: [],
      world: { id: 'test', version: '1.0.0', slots: {} },
      npcs: [],
      state: {},
      input: { kind: 'choice', text: 'test' },
    };

    const result = TurnPacketV3Schema.safeParse(invalidTp);
    expect(result.success).toBe(false);
  });

  it('should create override snapshot with parent_id', async () => {
    const original = await getPromptSnapshot(originalSnapshotId);
    expect(original).toBeDefined();

    const overrideTp: TurnPacketV3 = {
      tp_version: '3',
      contract: 'awf.v1',
      core: { safety: ['override'] },
      ruleset: { id: 'test', version: '1.0.0', slots: {} },
      modules: [],
      world: { id: 'test', version: '1.0.0', slots: {} },
      npcs: [],
      state: {},
      input: { kind: 'choice', text: 'override test' },
    };

    const override = await createPromptSnapshot({
      templates_version: original!.templates_version,
      pack_versions: original!.pack_versions,
      tp: overrideTp,
      linearized_prompt_text: 'Override prompt',
      source: 'manual',
      parent_id: original!.id,
    });

    expect(override.source).toBe('manual');
    expect(override.parent_id).toBe(original!.id);

    // Cleanup
    await supabaseAdmin
      .from('prompt_snapshots')
      .delete()
      .eq('id', override.id);
  });
});

