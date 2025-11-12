/**
 * Budget Report Admin Routes
 * POST /api/admin/prompt-budget-report
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { supabase } from '../services/supabase.js';

const router = Router();

/**
 * POST /api/admin/prompt-budget-report
 * Generate budget report without persisting
 */
router.post('/prompt-budget-report', authenticateToken, requireRole('publisher'), async (req, res) => {
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

    // Load extras from database if IDs provided
    const extrasMap: Record<string, Record<string, unknown>> = {};
    
    if (worldId) {
      const { data: world } = await supabase
        .from('worlds')
        .select('extras')
        .eq('id', worldId)
        .single();
      if (world?.extras) {
        extrasMap.world = world.extras as Record<string, unknown>;
      }
    }
    
    if (rulesetId) {
      const { data: ruleset } = await supabase
        .from('rulesets')
        .select('extras')
        .eq('id', rulesetId)
        .single();
      if (ruleset?.extras) {
        extrasMap.ruleset = ruleset.extras as Record<string, unknown>;
      }
    }
    
    if (scenarioId) {
      const { data: scenario } = await supabase
        .from('scenarios')
        .select('extras')
        .eq('id', scenarioId)
        .single();
      if (scenario?.extras) {
        extrasMap.scenario = scenario.extras as Record<string, unknown>;
      }
    }
    
    if (npcIds && Array.isArray(npcIds)) {
      const { data: npcs } = await supabase
        .from('npcs')
        .select('id, extras')
        .in('id', npcIds);
      if (npcs) {
        for (const npc of npcs) {
          if (npc.extras) {
            extrasMap[`npc_${npc.id}`] = npc.extras as Record<string, unknown>;
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

