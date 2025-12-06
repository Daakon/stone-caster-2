/**
 * Budget Report Admin Routes
 * GET /api/system/budget - Get Chimera table statistics
 * POST /api/admin/prompt-budget-report - Generate budget report
 */

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.unified.js';
import { supabase, supabaseAdmin } from '../services/supabase.js';

const router = Router();

/**
 * GET /api/system/budget
 * Get Chimera table statistics (modernized from legacy tables)
 */
router.get('/', requireRole(['admin', 'moderator', 'viewer']), async (req, res) => {
  try {
    // Get counts from Chimera tables
    const [worldsResult, entitiesResult, rulesetsResult, storiesResult] = await Promise.all([
      supabaseAdmin
        .from('chimera_worlds')
        .select('id', { count: 'exact', head: true }),
      supabaseAdmin
        .from('chimera_entities')
        .select('id', { count: 'exact', head: true })
        .eq('definition->>kind', 'npc'), // Filter for NPCs
      supabaseAdmin
        .from('chimera_ruleset_templates')
        .select('id', { count: 'exact', head: true }),
      supabaseAdmin
        .from('chimera_stories')
        .select('id', { count: 'exact', head: true }),
    ]);

    res.json({
      ok: true,
      data: {
        worlds: worldsResult.count || 0,
        npcs: entitiesResult.count || 0,
        rulesets: rulesetsResult.count || 0,
        stories: storiesResult.count || 0,
        // Legacy table names for backward compatibility (will be 0 after migration)
        legacy: {
          worlds: 0,
          npcs: 0,
          rulesets: 0,
          scenarios: 0,
        },
      },
    });
  } catch (error) {
    console.error('Error getting budget stats:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to get budget stats',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/admin/prompt-budget-report
 * Generate budget report without persisting
 */
router.post('/prompt-budget-report', requireRole(['admin', 'publisher']), async (req, res) => {
  try {
    const { 
      worldId, 
      rulesetId, 
      scenarioId, 
      npcIds, 
      templatesVersion, 
      moduleParamsOverrides,
      extrasOverrides,
      maxTokens,
    } = req.body;

    // Validate required fields
    if (!worldId || !rulesetId) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: worldId and rulesetId are required',
      });
    }

    // Validate maxTokens
    const maxTokensValue = maxTokens || parseInt(process.env.CTX_MAX_TOKENS_DEFAULT || '8000', 10);
    if (maxTokensValue < 50 || maxTokensValue > 1_000_000) {
      return res.status(400).json({
        ok: false,
        error: 'maxTokens must be between 50 and 1,000,000',
      });
    }

    // Load extras from database if IDs provided (using Chimera tables)
    const extrasMap: Record<string, Record<string, unknown>> = {};
    
    if (worldId) {
      const { data: world } = await supabaseAdmin
        .from('chimera_worlds')
        .select('definition')
        .eq('id', worldId)
        .single();
      if (world?.definition && typeof world.definition === 'object' && 'extras' in world.definition) {
        extrasMap.world = (world.definition as any).extras as Record<string, unknown>;
      }
    }
    
    if (rulesetId) {
      const { data: ruleset } = await supabaseAdmin
        .from('chimera_ruleset_templates')
        .select('definition')
        .eq('id', rulesetId)
        .single();
      if (ruleset?.definition && typeof ruleset.definition === 'object' && 'extras' in ruleset.definition) {
        extrasMap.ruleset = (ruleset.definition as any).extras as Record<string, unknown>;
      }
    }
    
    if (scenarioId) {
      // scenarioId maps to chimera_stories
      const { data: story } = await supabaseAdmin
        .from('chimera_stories')
        .select('definition')
        .eq('id', scenarioId)
        .single();
      if (story?.definition && typeof story.definition === 'object' && 'extras' in story.definition) {
        extrasMap.scenario = (story.definition as any).extras as Record<string, unknown>;
      }
    }
    
    if (npcIds && Array.isArray(npcIds)) {
      // NPCs are entities with kind='npc'
      const { data: entities } = await supabaseAdmin
        .from('chimera_entities')
        .select('id, definition')
        .eq('definition->>kind', 'npc')
        .in('id', npcIds);
      if (entities) {
        for (const entity of entities) {
          if (entity.definition && typeof entity.definition === 'object' && 'extras' in entity.definition) {
            extrasMap[`npc_${entity.id}`] = (entity.definition as any).extras as Record<string, unknown>;
          }
        }
      }
    }

    // Build TurnPacketV3 from provided context
    const { buildTurnPacketV3FromV3 } = await import('../adapters/turn-packet-v3-adapter.js');
    const { buildLinearizedSections } = await import('../utils/linearized-prompt.js');
    const { applyBudget } = await import('../budget/budget-engine.js');
    const { CORE_PROMPT } = await import('../prompts/entry-point-assembler-v3.js');
    
    // Build overrides object
    const hasOverrides = !!(moduleParamsOverrides || extrasOverrides);
    const overrides = hasOverrides ? {
      moduleParamsOverrides,
      extrasOverrides,
    } : undefined;

    const mockV3Output = {
      prompt: '',
      pieces: [],
      meta: {
        worldId: worldId || 'preview-world',
        worldSlug: worldId || 'preview-world',
        rulesetSlug: rulesetId || 'preview-ruleset',
        entryPointId: 'preview-entry',
        entryPointSlug: 'preview-entry',
        entryStartSlug: 'preview-start',
        tokenEst: { input: 0, budget: 8000, pct: 0 },
        model: 'gpt-4o-mini',
        source: 'preview',
        version: 'v3',
        npcTrimmedCount: 0,
        selectionContext: {} as any,
      },
      extras: extrasMap,
    };
    
    const tp = await buildTurnPacketV3FromV3(
      mockV3Output as any,
      CORE_PROMPT,
      {},
      'Preview input',
      'preview-build',
      templatesVersion,
      overrides
    );

    // Build sections and apply budget
    const sections = await buildLinearizedSections(tp);
    const budgetResult = await applyBudget({
      linearSections: sections,
      maxTokens: maxTokensValue,
    });

    // Build section summary
    const sectionSummary = sections.map((section, idx) => {
      const budgetedSection = budgetResult.sections[idx];
      const originalTokens = Math.ceil(section.text.length / 4); // Rough estimate
      const afterTokens = Math.ceil(budgetedSection.text.length / 4);
      return {
        key: section.key,
        tokensBefore: originalTokens,
        tokensAfter: afterTokens,
        trimmed: budgetedSection.text.includes('… [[trimmed]]'),
      };
    });

    res.json({
      ok: true,
      data: {
        tokens: {
          before: budgetResult.totalTokensBefore,
          after: budgetResult.totalTokensAfter,
        },
        trims: budgetResult.trims,
        warnings: budgetResult.warnings,
        sections: sectionSummary,
      }
    });
  } catch (error) {
    console.error('Error generating budget report:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to generate budget report',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

