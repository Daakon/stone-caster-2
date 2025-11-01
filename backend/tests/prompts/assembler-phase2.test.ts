import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabasePromptAssembler } from '../src/prompts/database-prompt-assembler.js';
import { PromptRepository } from '../src/repositories/prompt.repository.js';
import type { PromptSegment } from '../src/repositories/prompt.repository.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { POLICY_ACTIONS, SCOPE_PRIORITY } from '../src/prompts/assembler-types.js';

// Load fixtures
function loadFixture(name: string): any {
  // Tests run from backend/tests/, fixtures are at backend/tests/fixtures/
  const path = join(__dirname, '..', 'fixtures', 'prompt', `${name}.json`);
  return JSON.parse(readFileSync(path, 'utf-8'));
}

describe('DatabasePromptAssembler - Phase 2 (Strict Order + Budget)', () => {
  let assembler: DatabasePromptAssembler;
  let mockRepository: any;

  beforeEach(() => {
    mockRepository = {
      getCachedPromptSegments: vi.fn(),
    };
    assembler = new DatabasePromptAssembler(mockRepository as any);
  });

  describe('Strict Scope Ordering', () => {
    it('should order pieces in exact order: core → ruleset → world → scenario → entry → npc', async () => {
      const core = loadFixture('core-segment');
      const ruleset = loadFixture('ruleset-segment');
      const world = loadFixture('world-segment');
      const scenario = loadFixture('scenario-segment');
      const entry = loadFixture('entry-segment');
      const npc1 = loadFixture('npc-segment-1');

      const segments: PromptSegment[] = [
        npc1, // Out of order
        entry,
        core,
        scenario,
        world,
        ruleset,
      ].map(s => ({
        id: s.id,
        layer: s.layer,
        world_slug: null,
        adventure_slug: null,
        scene_id: null,
        turn_stage: 'start',
        sort_order: s.sort_order || 0,
        version: s.version,
        content: s.content,
        metadata: s.metadata || {},
      }));

      mockRepository.getCachedPromptSegments.mockResolvedValue(segments);

      const result = await assembler.assemblePrompt({
        worldSlug: 'fantasy-realm',
        adventureSlug: 'forest-clearing',
        startingSceneId: 'forest-edge',
        scenarioSlug: 'dark-forest-quest',
        npcHints: ['wise-wizard'],
        budgetTokens: 10000,
      });

      expect(result.pieces).toBeDefined();
      const scopes = result.pieces!.map(p => p.scope);
      
      // Verify strict ordering
      expect(scopes).toEqual(['core', 'ruleset', 'world', 'scenario', 'entry', 'npc']);
      
      // Verify SCOPE_PRIORITY is respected
      for (let i = 0; i < scopes.length - 1; i++) {
        expect(SCOPE_PRIORITY[scopes[i] as keyof typeof SCOPE_PRIORITY])
          .toBeLessThan(SCOPE_PRIORITY[scopes[i + 1] as keyof typeof SCOPE_PRIORITY]);
      }
    });

    it('should exclude scenario if scenarioSlug not provided', async () => {
      const segments: PromptSegment[] = [
        loadFixture('core-segment'),
        loadFixture('scenario-segment'),
        loadFixture('entry-segment'),
      ].map(s => ({
        id: s.id,
        layer: s.layer,
        world_slug: null,
        adventure_slug: null,
        scene_id: null,
        turn_stage: 'start',
        sort_order: s.sort_order || 0,
        version: s.version,
        content: s.content,
        metadata: s.metadata || {},
      }));

      mockRepository.getCachedPromptSegments.mockResolvedValue(segments);

      const result = await assembler.assemblePrompt({
        worldSlug: 'fantasy-realm',
        adventureSlug: 'forest-clearing',
        startingSceneId: 'forest-edge',
        // No scenarioSlug
        budgetTokens: 10000,
      });

      expect(result.pieces).toBeDefined();
      const scopes = result.pieces!.map(p => p.scope);
      expect(scopes).not.toContain('scenario');
      expect(scopes).toContain('core');
      expect(scopes).toContain('entry');
    });
  });

  describe('Budget Warn Threshold', () => {
    it('should emit SCENARIO_POLICY_UNDECIDED at/above warn threshold (90%)', async () => {
      const segments: PromptSegment[] = [
        loadFixture('core-segment'),
        loadFixture('ruleset-segment'),
        loadFixture('world-segment'),
        loadFixture('scenario-segment'),
        loadFixture('entry-segment'),
      ].map(s => ({
        id: s.id,
        layer: s.layer,
        world_slug: null,
        adventure_slug: null,
        scene_id: null,
        turn_stage: 'start',
        sort_order: s.sort_order || 0,
        version: s.version,
        content: s.content,
        metadata: s.metadata || {},
      }));

      // Make content large enough to hit 90% threshold
      segments[3].content = 'X'.repeat(7200); // ~1800 tokens (90% of 2000 budget)

      mockRepository.getCachedPromptSegments.mockResolvedValue(segments);

      const result = await assembler.assemblePrompt({
        worldSlug: 'fantasy-realm',
        adventureSlug: 'forest-clearing',
        startingSceneId: 'forest-edge',
        scenarioSlug: 'dark-forest-quest',
        budgetTokens: 2000, // Small budget to trigger warning
      });

      expect(result.metadata.policy).toContain(POLICY_ACTIONS.SCENARIO_POLICY_UNDECIDED);
      expect(result.metadata.tokenEst?.pct).toBeGreaterThanOrEqual(0.9);
      // Should not drop anything at warn threshold
      expect(result.metadata.dropped).toEqual([]);
    });
  });

  describe('Budget Drop Sequence', () => {
    it('should drop scenario when over budget, keep npcs', async () => {
      const segments: PromptSegment[] = [
        loadFixture('core-segment'),
        loadFixture('ruleset-segment'),
        loadFixture('world-segment'),
        loadFixture('scenario-segment'),
        loadFixture('entry-segment'),
        loadFixture('npc-segment-1'),
      ].map(s => ({
        id: s.id,
        layer: s.layer,
        world_slug: null,
        adventure_slug: null,
        scene_id: null,
        turn_stage: 'start',
        sort_order: s.sort_order || 0,
        version: s.version,
        content: s.content + 'X'.repeat(5000), // Make large
        metadata: s.metadata || {},
      }));

      mockRepository.getCachedPromptSegments.mockResolvedValue(segments);

      const result = await assembler.assemblePrompt({
        worldSlug: 'fantasy-realm',
        adventureSlug: 'forest-clearing',
        startingSceneId: 'forest-edge',
        scenarioSlug: 'dark-forest-quest',
        npcHints: ['wise-wizard'],
        budgetTokens: 2000, // Small budget
      });

      expect(result.metadata.policy).toContain(POLICY_ACTIONS.SCENARIO_DROPPED);
      expect(result.metadata.dropped?.some(d => d.startsWith('scenario:'))).toBe(true);
      
      // NPCs should still be included
      const npcPieces = result.pieces!.filter(p => p.scope === 'npc');
      expect(npcPieces.length).toBeGreaterThan(0);
      
      // Core/ruleset/world should never be dropped
      const droppedScopes = result.metadata.dropped?.map(d => d.split(':')[0]) || [];
      expect(droppedScopes).not.toContain('core');
      expect(droppedScopes).not.toContain('ruleset');
      expect(droppedScopes).not.toContain('world');
    });

    it('should drop npcs after scenario if still over budget', async () => {
      const segments: PromptSegment[] = [
        loadFixture('core-segment'),
        loadFixture('ruleset-segment'),
        loadFixture('world-segment'),
        loadFixture('scenario-segment'),
        loadFixture('entry-segment'),
        loadFixture('npc-segment-1'),
        loadFixture('npc-segment-2'),
      ].map(s => ({
        id: s.id,
        layer: s.layer,
        world_slug: null,
        adventure_slug: null,
        scene_id: null,
        turn_stage: 'start',
        sort_order: s.sort_order || 0,
        version: s.version,
        content: s.content + 'X'.repeat(4000), // Make very large
        metadata: s.metadata || {},
      }));

      mockRepository.getCachedPromptSegments.mockResolvedValue(segments);

      const result = await assembler.assemblePrompt({
        worldSlug: 'fantasy-realm',
        adventureSlug: 'forest-clearing',
        startingSceneId: 'forest-edge',
        scenarioSlug: 'dark-forest-quest',
        npcHints: ['wise-wizard', 'mysterious-merchant'],
        budgetTokens: 2000, // Very small budget
      });

      expect(result.metadata.policy).toContain(POLICY_ACTIONS.SCENARIO_DROPPED);
      expect(result.metadata.policy?.filter(p => p === POLICY_ACTIONS.NPC_DROPPED).length).toBeGreaterThan(0);
      
      // Some NPCs should be dropped
      const droppedNpcs = result.metadata.dropped?.filter(d => d.startsWith('npc:')).length || 0;
      expect(droppedNpcs).toBeGreaterThan(0);
    });

    it('should never drop core/ruleset/world even if over budget', async () => {
      const segments: PromptSegment[] = [
        loadFixture('core-segment'),
        loadFixture('ruleset-segment'),
        loadFixture('world-segment'),
        loadFixture('entry-segment'),
      ].map(s => ({
        id: s.id,
        layer: s.layer,
        world_slug: null,
        adventure_slug: null,
        scene_id: null,
        turn_stage: 'start',
        sort_order: s.sort_order || 0,
        version: s.version,
        content: s.content + 'X'.repeat(10000), // Make extremely large
        metadata: s.metadata || {},
      }));

      mockRepository.getCachedPromptSegments.mockResolvedValue(segments);

      const result = await assembler.assemblePrompt({
        worldSlug: 'fantasy-realm',
        adventureSlug: 'forest-clearing',
        startingSceneId: 'forest-edge',
        budgetTokens: 1000, // Very small budget
      });

      // Core/ruleset/world should all be included
      const includedScopes = result.pieces!.map(p => p.scope);
      expect(includedScopes).toContain('core');
      expect(includedScopes).toContain('ruleset');
      expect(includedScopes).toContain('world');
      
      // None should be dropped
      const droppedScopes = result.metadata.dropped?.map(d => d.split(':')[0]) || [];
      expect(droppedScopes).not.toContain('core');
      expect(droppedScopes).not.toContain('ruleset');
      expect(droppedScopes).not.toContain('world');
    });
  });

  describe('NPC Deduplication', () => {
    it('should deduplicate NPCs by slug and maintain deterministic order', async () => {
      const npc1 = loadFixture('npc-segment-1');
      const npc1Duplicate = { ...npc1, id: 'npc-001-duplicate', content: 'Different content but same slug' };
      const npc2 = loadFixture('npc-segment-2');

      const segments: PromptSegment[] = [
        loadFixture('core-segment'),
        npc1,
        npc2,
        npc1Duplicate, // Duplicate slug
      ].map(s => ({
        id: s.id,
        layer: s.layer,
        world_slug: null,
        adventure_slug: null,
        scene_id: null,
        turn_stage: 'start',
        sort_order: s.sort_order || 0,
        version: s.version,
        content: s.content,
        metadata: s.metadata || {},
      }));

      mockRepository.getCachedPromptSegments.mockResolvedValue(segments);

      const result = await assembler.assemblePrompt({
        worldSlug: 'fantasy-realm',
        adventureSlug: 'forest-clearing',
        startingSceneId: 'forest-edge',
        npcHints: ['wise-wizard', 'mysterious-merchant'],
        budgetTokens: 10000,
      });

      // Should have only 2 NPCs (deduplicated)
      const npcPieces = result.pieces!.filter(p => p.scope === 'npc');
      expect(npcPieces.length).toBe(2);
      
      // Verify slugs are unique
      const npcSlugs = npcPieces.map(p => p.slug);
      expect(new Set(npcSlugs).size).toBe(2);
      
      // Verify deterministic order (sorted by slug)
      expect(npcSlugs[0] < npcSlugs[1]).toBe(true);
    });
  });

  describe('Metadata Tracking', () => {
    it('should include comprehensive metadata in result', async () => {
      const segments: PromptSegment[] = [
        loadFixture('core-segment'),
        loadFixture('entry-segment'),
      ].map(s => ({
        id: s.id,
        layer: s.layer,
        world_slug: null,
        adventure_slug: null,
        scene_id: null,
        turn_stage: 'start',
        sort_order: s.sort_order || 0,
        version: s.version,
        content: s.content,
        metadata: s.metadata || {},
      }));

      mockRepository.getCachedPromptSegments.mockResolvedValue(segments);

      const result = await assembler.assemblePrompt({
        worldSlug: 'fantasy-realm',
        adventureSlug: 'forest-clearing',
        startingSceneId: 'forest-edge',
        rulesetSlug: 'default-ruleset',
        budgetTokens: 5000,
      });

      expect(result.metadata.included).toBeDefined();
      expect(result.metadata.included!.length).toBeGreaterThan(0);
      expect(result.metadata.dropped).toBeDefined();
      expect(result.metadata.tokenEst).toBeDefined();
      expect(result.metadata.tokenEst?.input).toBeGreaterThan(0);
      expect(result.metadata.tokenEst?.budget).toBe(5000);
      expect(result.metadata.tokenEst?.pct).toBeGreaterThanOrEqual(0);
      expect(result.pieces).toBeDefined();
      expect(result.pieces!.length).toBeGreaterThan(0);
      
      // Verify included pieces format: "scope:slug@version"
      result.metadata.included!.forEach(id => {
        expect(id).toMatch(/^(core|ruleset|world|scenario|entry|npc):.+(@\d+\.\d+\.\d+)?$/);
      });
    });
  });
});

