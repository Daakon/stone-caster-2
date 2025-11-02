#!/usr/bin/env tsx
/**
 * QA Scan Entry Points
 * Batch audit all active entry points with v3 preview and QA checks
 */

import { supabaseAdmin } from '../src/services/supabase.js';
import { AdminPreviewService } from '../src/services/admin-preview.service.js';
import { ContentQAService } from '../src/services/content-qa.service.js';
import { config } from '../src/config/index.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface QAScanResult {
  worldSlug: string;
  entryPointId: string;
  entryPointSlug: string;
  title: string;
  defaultBudget: {
    tokenPctPreNpc: number;
    tokenPctPost: number;
    npcBefore: number;
    npcAfter: number;
    byScope: Record<string, number>;
    qaReport: Array<{
      type: string;
      severity: 'error' | 'warn' | 'info';
      pct?: number;
    }>;
  };
  tightBudget: {
    tokenPctPreNpc: number;
    tokenPctPost: number;
    npcBefore: number;
    npcAfter: number;
    byScope: Record<string, number>;
    qaReport: Array<{
      type: string;
      severity: 'error' | 'warn' | 'info';
      pct?: number;
    }>;
  };
  oversizedPiecePct: number;
  qaSeverityMax: 'error' | 'warn' | 'info' | null;
}

async function qaScanEntryPoints(): Promise<void> {
  console.log('🔍 QA Scanning active entry points...');

  // Get all active entry points with world info
  const { data: entryPoints, error } = await supabaseAdmin
    .from('entry_points')
    .select('id, slug, title, world_id, status')
    .eq('status', 'active')
    .order('slug');

  if (error || !entryPoints) {
    console.error('❌ Failed to fetch entry points:', error);
    process.exit(1);
  }

  // Get world slugs
  const worldIds = [...new Set(entryPoints.map(ep => ep.world_id))];
  const { data: worlds } = await supabaseAdmin
    .from('worlds')
    .select('id, slug')
    .in('id', worldIds);

  const worldSlugMap = new Map((worlds || []).map(w => [w.id, w.slug || w.id]));

  console.log(`✅ Found ${entryPoints.length} active entry points`);

  const previewService = new AdminPreviewService();
  const qaService = new ContentQAService();
  const defaultBudget = config.prompt.tokenBudgetDefault;
  const tightBudget = Math.floor(defaultBudget * 0.5);
  const results: QAScanResult[] = [];

  for (const entryPoint of entryPoints) {
    console.log(`\n📋 Scanning: ${entryPoint.slug} (${entryPoint.id})`);

    try {
      // Default budget preview
      const defaultResult = await previewService.previewEntryPoint(entryPoint.id);
      const defaultQa = await qaService.checkPieces(defaultResult.pieces, defaultBudget);

      // Tight budget preview
      const tightResult = await previewService.previewEntryPoint(entryPoint.id, {
        budget: tightBudget,
      });
      const tightQa = await qaService.checkPieces(tightResult.pieces, tightBudget);

      // Calculate pre-NPC token percentage
      const preNpcTokens = Object.entries(defaultResult.diagnostics.byScope || {})
        .filter(([scope]) => scope !== 'npc')
        .reduce((sum, [, tokens]) => sum + tokens, 0);
      const tokenPctPreNpc = defaultBudget > 0 ? preNpcTokens / defaultBudget : 0;

      // Find max oversized piece
      const oversizedPieces = defaultQa
        .filter(qa => qa.type === 'OVERSIZED_PIECE' && qa.pct !== undefined)
        .map(qa => qa.pct!);
      const oversizedPiecePct = oversizedPieces.length > 0 ? Math.max(...oversizedPieces) : 0;

      // Find max severity
      const severities = [...defaultQa, ...tightQa].map(qa => qa.severity);
      const severityOrder = { error: 3, warn: 2, info: 1 };
      const qaSeverityMax = severities.length > 0
        ? severities.reduce((max, sev) => 
            severityOrder[sev] > severityOrder[max] ? sev : max
          )
        : null;

      results.push({
        worldSlug: worldSlugMap.get(entryPoint.world_id) || entryPoint.world_id,
        entryPointId: entryPoint.id,
        entryPointSlug: entryPoint.slug,
        title: entryPoint.title || entryPoint.slug,
        defaultBudget: {
          tokenPctPreNpc,
          tokenPctPost: defaultResult.meta.tokenEst.pct,
          npcBefore: defaultResult.diagnostics.npcBefore,
          npcAfter: defaultResult.diagnostics.npcAfter,
          byScope: defaultResult.diagnostics.byScope || {},
          qaReport: defaultQa,
        },
        tightBudget: {
          tokenPctPreNpc: tightBudget > 0 ? preNpcTokens / tightBudget : 0,
          tokenPctPost: tightResult.meta.tokenEst.pct,
          npcBefore: tightResult.diagnostics.npcBefore,
          npcAfter: tightResult.diagnostics.npcAfter,
          byScope: tightResult.diagnostics.byScope || {},
          qaReport: tightQa,
        },
        oversizedPiecePct,
        qaSeverityMax,
      });

      console.log(`  ✅ Default: ${Math.round(tokenPctPreNpc * 100)}% pre-NPC, ${Math.round(defaultResult.meta.tokenEst.pct * 100)}% post`);
      console.log(`  ✅ Tight: ${Math.round(tightResult.meta.tokenEst.pct * 100)}% post`);
      
      if (qaSeverityMax === 'error') {
        console.log(`  ⚠️  ERROR severity found`);
      } else if (qaSeverityMax === 'warn') {
        console.log(`  ⚠️  WARN severity found`);
      }
    } catch (error) {
      console.error(`  ❌ Error scanning ${entryPoint.slug}:`, error);
      // Continue with other entry points
    }
  }

  // Generate reports directory
  const reportsDir = join(process.cwd(), 'docs', 'reports', 'qa');
  mkdirSync(reportsDir, { recursive: true });

  // Generate JSON report
  const jsonPath = join(reportsDir, 'entry-points.json');
  writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 JSON report written to: ${jsonPath}`);

  // Generate CSV report
  const csvPath = join(reportsDir, 'entry-points.csv');
  const csvRows = [
    ['world', 'entry_point_slug', 'token_pct_pre_npc', 'token_pct_post', 'npc_before', 'npc_after', 'oversized_piece_pct', 'qa_severity_max'].join(','),
    ...results.map(r => [
      r.worldSlug,
      r.entryPointSlug,
      r.defaultBudget.tokenPctPreNpc.toFixed(4),
      r.defaultBudget.tokenPctPost.toFixed(4),
      r.defaultBudget.npcBefore,
      r.defaultBudget.npcAfter,
      r.oversizedPiecePct.toFixed(4),
      r.qaSeverityMax || '',
    ].join(',')),
  ];
  writeFileSync(csvPath, csvRows.join('\n'));
  console.log(`📄 CSV report written to: ${csvPath}`);

  // Generate Markdown top offenders
  const mdPath = join(reportsDir, 'top-offenders.md');
  const sorted = [...results].sort((a, b) => {
    // Sort by token_pct_pre_npc desc, then oversized_piece_pct desc
    if (Math.abs(a.defaultBudget.tokenPctPreNpc - b.defaultBudget.tokenPctPreNpc) > 0.001) {
      return b.defaultBudget.tokenPctPreNpc - a.defaultBudget.tokenPctPreNpc;
    }
    return b.oversizedPiecePct - a.oversizedPiecePct;
  });
  
  const md = generateMarkdownReport(sorted);
  writeFileSync(mdPath, md);
  console.log(`📄 Markdown report written to: ${mdPath}`);

  // Check for errors
  const hasErrors = results.some(r => r.qaSeverityMax === 'error');
  if (hasErrors) {
    console.error('\n❌ QA scan found ERROR severity issues. Failing.');
    process.exit(1);
  }

  // Print summary
  const errorCount = results.filter(r => r.qaSeverityMax === 'error').length;
  const warnCount = results.filter(r => r.qaSeverityMax === 'warn').length;
  const over90Pct = results.filter(r => r.defaultBudget.tokenPctPreNpc > 0.9).length;
  
  console.log(`\n📊 Summary:`);
  console.log(`  Total entry points: ${results.length}`);
  console.log(`  Exceeding 90% pre-NPC: ${over90Pct}`);
  console.log(`  With errors: ${errorCount}`);
  console.log(`  With warnings: ${warnCount}`);

  if (errorCount === 0) {
    console.log('\n✅ No errors found. QA scan passed.');
  }
}

function generateMarkdownReport(sorted: QAScanResult[]): string {
  return `# Entry Point QA - Top Offenders

Generated: ${new Date().toISOString()}

## Overview

Sorted by token_pct_pre_npc (descending), then oversized_piece_pct (descending).

## Top Offenders

| World | Entry Point | Pre-NPC % | Post % | NPCs Before | NPCs After | Oversized % | Max Severity |
|-------|-------------|-----------|--------|-------------|------------|-------------|--------------|
${sorted.map(r => {
  return [
    r.worldSlug,
    r.entryPointSlug,
    `${Math.round(r.defaultBudget.tokenPctPreNpc * 100)}%`,
    `${Math.round(r.defaultBudget.tokenPctPost * 100)}%`,
    r.defaultBudget.npcBefore,
    r.defaultBudget.npcAfter,
    `${Math.round(r.oversizedPiecePct * 100)}%`,
    r.qaSeverityMax || 'none',
  ].join(' | ');
}).join('\n')}

## Recommendations

- Target < 75% token usage before NPCs
- Fix all error-level QA issues
- Review oversized pieces (> 40% of budget)
- Monitor NPC trimming in tight budget scenarios

`;
}

// CLI handling
if (import.meta.url === `file://${process.argv[1]}`) {
  qaScanEntryPoints()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ QA scan failed:', error);
      process.exit(1);
    });
}

