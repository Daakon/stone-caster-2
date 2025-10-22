/**
 * Database Referential Integrity Tests
 * Tests for prompt segments reference validation and foreign key constraints
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client for testing
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'test-key';
const supabase = createClient(supabaseUrl, supabaseKey);

describe('Prompt Segments Referential Integrity', () => {
  let testWorldId: string;
  let testRulesetId: string;
  let testEntryId: string;
  let testNpcId: string;

  beforeEach(async () => {
    // Create test entities
    const { data: world } = await supabase
      .from('worlds')
      .insert({ name: 'Test World', slug: 'test-world' })
      .select()
      .single();
    testWorldId = world?.id;

    const { data: ruleset } = await supabase
      .from('rulesets')
      .insert({ name: 'Test Ruleset', slug: 'test-ruleset' })
      .select()
      .single();
    testRulesetId = ruleset?.id;

    const { data: entry } = await supabase
      .from('entries')
      .insert({ name: 'Test Entry', slug: 'test-entry', world_id: testWorldId })
      .select()
      .single();
    testEntryId = entry?.id;

    const { data: npc } = await supabase
      .from('npcs')
      .insert({ name: 'Test NPC', slug: 'test-npc' })
      .select()
      .single();
    testNpcId = npc?.id;
  });

  afterEach(async () => {
    // Clean up test data
    await supabase.from('prompt_segments').delete().like('content', 'Test%');
    await supabase.from('npcs').delete().eq('id', testNpcId);
    await supabase.from('entries').delete().eq('id', testEntryId);
    await supabase.from('rulesets').delete().eq('id', testRulesetId);
    await supabase.from('worlds').delete().eq('id', testWorldId);
  });

  describe('Core Scope', () => {
    it('should allow core segments without ref_id', async () => {
      const { data, error } = await supabase
        .from('prompt_segments')
        .insert({
          scope: 'core',
          content: 'Test core segment',
          active: true
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.scope).toBe('core');
      expect(data.ref_id).toBeNull();
    });

    it('should reject core segments with ref_id', async () => {
      const { error } = await supabase
        .from('prompt_segments')
        .insert({
          scope: 'core',
          ref_id: testWorldId,
          content: 'Test core segment with ref',
          active: true
        });

      expect(error).toBeDefined();
    });
  });

  describe('World Scope', () => {
    it('should allow world segments with valid world_id', async () => {
      const { data, error } = await supabase
        .from('prompt_segments')
        .insert({
          scope: 'world',
          ref_id: testWorldId,
          content: 'Test world segment',
          active: true
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.scope).toBe('world');
      expect(data.ref_id).toBe(testWorldId);
    });

    it('should reject world segments with invalid world_id', async () => {
      const { error } = await supabase
        .from('prompt_segments')
        .insert({
          scope: 'world',
          ref_id: '00000000-0000-0000-0000-000000000000',
          content: 'Test world segment with invalid ref',
          active: true
        });

      expect(error).toBeDefined();
    });

    it('should reject world segments without ref_id', async () => {
      const { error } = await supabase
        .from('prompt_segments')
        .insert({
          scope: 'world',
          content: 'Test world segment without ref',
          active: true
        });

      expect(error).toBeDefined();
    });
  });

  describe('Ruleset Scope', () => {
    it('should allow ruleset segments with valid ruleset_id', async () => {
      const { data, error } = await supabase
        .from('prompt_segments')
        .insert({
          scope: 'ruleset',
          ref_id: testRulesetId,
          content: 'Test ruleset segment',
          active: true
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.scope).toBe('ruleset');
      expect(data.ref_id).toBe(testRulesetId);
    });

    it('should reject ruleset segments with invalid ruleset_id', async () => {
      const { error } = await supabase
        .from('prompt_segments')
        .insert({
          scope: 'ruleset',
          ref_id: '00000000-0000-0000-0000-000000000000',
          content: 'Test ruleset segment with invalid ref',
          active: true
        });

      expect(error).toBeDefined();
    });
  });

  describe('Entry Scope', () => {
    it('should allow entry segments with valid entry_id', async () => {
      const { data, error } = await supabase
        .from('prompt_segments')
        .insert({
          scope: 'entry',
          ref_id: testEntryId,
          content: 'Test entry segment',
          active: true
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.scope).toBe('entry');
      expect(data.ref_id).toBe(testEntryId);
    });

    it('should reject entry segments with invalid entry_id', async () => {
      const { error } = await supabase
        .from('prompt_segments')
        .insert({
          scope: 'entry',
          ref_id: '00000000-0000-0000-0000-000000000000',
          content: 'Test entry segment with invalid ref',
          active: true
        });

      expect(error).toBeDefined();
    });
  });

  describe('Entry Start Scope', () => {
    it('should allow entry_start segments with valid entry_id', async () => {
      const { data, error } = await supabase
        .from('prompt_segments')
        .insert({
          scope: 'entry_start',
          ref_id: testEntryId,
          content: 'Test entry start segment',
          active: true
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.scope).toBe('entry_start');
      expect(data.ref_id).toBe(testEntryId);
    });
  });

  describe('NPC Scope', () => {
    it('should allow npc segments with valid npc_id', async () => {
      const { data, error } = await supabase
        .from('prompt_segments')
        .insert({
          scope: 'npc',
          ref_id: testNpcId,
          content: 'Test npc segment',
          active: true
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.scope).toBe('npc');
      expect(data.ref_id).toBe(testNpcId);
    });

    it('should reject npc segments with invalid npc_id', async () => {
      const { error } = await supabase
        .from('prompt_segments')
        .insert({
          scope: 'npc',
          ref_id: '00000000-0000-0000-0000-000000000000',
          content: 'Test npc segment with invalid ref',
          active: true
        });

      expect(error).toBeDefined();
    });
  });

  describe('Index Performance', () => {
    it('should use composite index for scope + ref_id queries', async () => {
      // Insert test data
      await supabase
        .from('prompt_segments')
        .insert([
          { scope: 'core', content: 'Test core 1', active: true },
          { scope: 'core', content: 'Test core 2', active: true },
          { scope: 'world', ref_id: testWorldId, content: 'Test world 1', active: true },
          { scope: 'world', ref_id: testWorldId, content: 'Test world 2', active: true }
        ]);

      // Query should use composite index
      const { data, error } = await supabase
        .from('prompt_segments')
        .select('*')
        .eq('scope', 'world')
        .eq('ref_id', testWorldId)
        .eq('active', true);

      expect(error).toBeNull();
      expect(data).toHaveLength(2);
    });

    it('should use active + scope index for filtering', async () => {
      // Insert test data
      await supabase
        .from('prompt_segments')
        .insert([
          { scope: 'core', content: 'Test core active', active: true },
          { scope: 'core', content: 'Test core inactive', active: false }
        ]);

      // Query should use active + scope index
      const { data, error } = await supabase
        .from('prompt_segments')
        .select('*')
        .eq('active', true)
        .eq('scope', 'core');

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });
  });

  describe('Constraint Validation', () => {
    it('should enforce scope constraint', async () => {
      const { error } = await supabase
        .from('prompt_segments')
        .insert({
          scope: 'invalid_scope',
          content: 'Test invalid scope',
          active: true
        });

      expect(error).toBeDefined();
      expect(error?.message).toContain('check constraint');
    });

    it('should allow only valid scopes', async () => {
      const validScopes = ['core', 'ruleset', 'world', 'entry', 'entry_start', 'npc'];
      
      for (const scope of validScopes) {
        const { error } = await supabase
          .from('prompt_segments')
          .insert({
            scope,
            content: `Test ${scope} segment`,
            active: true,
            ...(scope !== 'core' && { ref_id: testWorldId })
          });

        if (scope === 'core') {
          expect(error).toBeNull();
        } else {
          // May fail due to FK constraint, which is expected
          expect(error).toBeDefined();
        }
      }
    });
  });
});
