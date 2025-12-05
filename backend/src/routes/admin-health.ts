/**
 * Template & Prompt Health Dashboard Routes
 * GET /api/admin/templates/health
 */

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.unified.js';
import { supabaseAdmin } from '../services/supabase.js';
import { listSlots } from '../services/slots.service.js';
import { getActiveTemplates } from '../services/templates.service.js';
import type { SlotType } from '../slots/registry.js';

const router = Router();

/**
 * GET /api/admin/templates/health
 * Get template and prompt health metrics
 */
/**
 * GET /api/system/health
 * Check database connectivity using Chimera tables
 */
router.get('/health', requireRole(['admin', 'moderator', 'viewer']), async (req, res) => {
  try {
    // Check connectivity using chimera_worlds table
    const { data, error } = await supabaseAdmin
      .from('chimera_worlds')
      .select('id')
      .limit(1);

    if (error) {
      return res.status(500).json({
        ok: false,
        error: 'Database connectivity check failed',
        details: error.message,
      });
    }

    res.json({
      ok: true,
      data: {
        connected: true,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error checking health:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to check health',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/templates/health', requireRole(['admin', 'moderator', 'viewer']), async (req, res) => {
  try {
    const { fromDate, toDate, worldId, rulesetId, storyId } = req.query;
    
    const from = fromDate ? new Date(fromDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const to = toDate ? new Date(toDate as string) : new Date();

    // 1. Missing/Unpublished Slots
    const allSlots = await listSlots();
    
    // Get active templates - handle case where templates table doesn't exist
    let activeTemplates: Awaited<ReturnType<typeof getActiveTemplates>> = [];
    try {
      activeTemplates = await getActiveTemplates();
    } catch (error: any) {
      // Templates table may not exist - this is OK, templates are legacy
      if (error?.code === 'PGRST205' || error?.message?.includes('Could not find the table')) {
        console.log('[admin-health] Templates table not found - skipping template analysis (legacy table)');
        activeTemplates = [];
      } else {
        // Other error - rethrow
        throw error;
      }
    }
    
    const slotsByType = new Map<SlotType, Set<string>>();
    const templatesBySlot = new Map<string, boolean>();
    
    for (const slot of allSlots) {
      if (!slotsByType.has(slot.type)) {
        slotsByType.set(slot.type, new Set());
      }
      slotsByType.get(slot.type)!.add(slot.name);
    }
    
    for (const template of activeTemplates) {
      templatesBySlot.set(`${template.type}:${template.slot}`, true);
    }
    
    const missingSlots: Array<{ type: SlotType; slot: string }> = [];
    for (const [type, slotNames] of slotsByType.entries()) {
      for (const slotName of slotNames) {
        if (!templatesBySlot.has(`${type}:${slotName}`)) {
          missingSlots.push({ type, slot: slotName });
        }
      }
    }

    // 2. Template Churn (rapid publish cycles)
    // Note: templates table may not exist in all environments (legacy table)
    let templateChurn: Array<{ type: SlotType; slot: string; publishCount: number }> = [];
    const { data: templateHistory, error: templatesError } = await supabaseAdmin
      .from('templates')
      .select('type, slot, version, created_at, status')
      .eq('status', 'published')
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString())
      .order('created_at', { ascending: false });

    if (templatesError) {
      // Templates table doesn't exist - this is OK, templates are legacy
      if (templatesError.code === 'PGRST205' || templatesError.message?.includes('Could not find the table')) {
        // Table doesn't exist - skip template churn analysis
        templateChurn = [];
      } else {
        // Other error - log but continue
        console.warn('[admin-health] Error fetching template history:', templatesError);
        templateChurn = [];
      }
    } else {
      const churnBySlot = new Map<string, number>();
      if (templateHistory) {
        for (const template of templateHistory) {
          const key = `${template.type}:${template.slot}`;
          churnBySlot.set(key, (churnBySlot.get(key) || 0) + 1);
        }
      }
      
      templateChurn = Array.from(churnBySlot.entries())
        .filter(([_, count]) => count >= 3) // 3+ publishes in time range
        .map(([key, count]) => {
          const [type, slot] = key.split(':');
          return { type: type as SlotType, slot, publishCount: count };
        });
    }

    // 3. Orphaned Templates (published but slot no longer exists)
    const orphanedTemplates: Array<{ type: SlotType; slot: string; version: number }> = [];
    for (const template of activeTemplates) {
      const slotExists = allSlots.some(s => s.type === template.type && s.name === template.slot);
      if (!slotExists) {
        orphanedTemplates.push({
          type: template.type,
          slot: template.slot,
          version: template.version,
        });
      }
    }

    // 4. High-Trim Stories (from prompt_snapshots with budget_report)
    let snapshotsQuery = supabaseAdmin
      .from('prompt_snapshots')
      .select('id, game_id, budget_report, created_at')
      .not('budget_report', 'is', null)
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString());

    if (storyId) {
      snapshotsQuery = snapshotsQuery.eq('game_id', storyId);
    }

    const { data: snapshots } = await snapshotsQuery;

    const trimCountByStory = new Map<string, number>();
    const totalByStory = new Map<string, number>();
    
    if (snapshots) {
      for (const snapshot of snapshots) {
        const storyId = snapshot.game_id || 'unknown';
        totalByStory.set(storyId, (totalByStory.get(storyId) || 0) + 1);
        
        const budgetReport = snapshot.budget_report as any;
        if (budgetReport?.trims && Array.isArray(budgetReport.trims) && budgetReport.trims.length > 0) {
          trimCountByStory.set(storyId, (trimCountByStory.get(storyId) || 0) + 1);
        }
      }
    }

    const highTrimStories = Array.from(totalByStory.entries())
      .map(([storyId, total]) => {
        const trims = trimCountByStory.get(storyId) || 0;
        const trimRate = total > 0 ? (trims / total) * 100 : 0;
        return { storyId, total, trims, trimRate };
      })
      .filter(s => s.trimRate >= 30) // 30%+ trim rate
      .sort((a, b) => b.trimRate - a.trimRate)
      .slice(0, 20); // Top 20

    // 5. Oversized Sections (from budget_report trims)
    const slotTrimCounts = new Map<string, { count: number; totalTokens: number }>();
    
    if (snapshots) {
      for (const snapshot of snapshots) {
        const budgetReport = snapshot.budget_report as any;
        if (budgetReport?.trims && Array.isArray(budgetReport.trims)) {
          for (const trim of budgetReport.trims) {
            if (trim.key) {
              const existing = slotTrimCounts.get(trim.key) || { count: 0, totalTokens: 0 };
              slotTrimCounts.set(trim.key, {
                count: existing.count + 1,
                totalTokens: existing.totalTokens + (trim.removedTokens || 0),
              });
            }
          }
        }
      }
    }

    const oversizedSections = Array.from(slotTrimCounts.entries())
      .map(([key, stats]) => ({
        slot: key,
        trimCount: stats.count,
        avgTokensRemoved: stats.totalTokens / stats.count,
      }))
      .filter(s => s.trimCount >= 5) // Trimmed in 5+ snapshots
      .sort((a, b) => b.trimCount - a.trimCount)
      .slice(0, 20);

    res.json({
      ok: true,
      data: {
        missingSlots,
        templateChurn,
        orphanedTemplates,
        highTrimStories,
        oversizedSections,
        timeRange: {
          from: from.toISOString(),
          to: to.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('Error getting template health:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to get template health',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

