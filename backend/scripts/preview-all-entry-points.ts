#!/usr/bin/env tsx
/**
 * Preview All Entry Points
 * Batch preview script for generating reports across all active entry points
 */

import { supabaseAdmin } from '../src/services/supabase.js';
import { AdminPreviewService } from '../src/services/admin-preview.service.js';
import { ContentQAService } from '../src/services/content-qa.service.js';
import { config } from '../src/config/index.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface EntryPointPreview {
  entryPointId: string;
  slug: string;
  title: string;
  defaultBudget: any;
  tightBudget: any;
  exceeds90Pct: boolean;
  qaReport: any[];
}

async function previewAllEntryPoints(): Promise<void> {
  console.log('🔍 Fetching active entry points...');

  // Get all active entry points
  const { data: entryPoints, error } = await supabaseAdmin
    .from('entry_points')
    .select('id, slug, title')
    .eq('status', 'active')
    .order('slug');

  if (error || !entryPoints) {
    console.error('❌ Failed to fetch entry points:', error);
    process.exit(1);
  }

  console.log(`✅ Found ${entryPoints.length} active entry points`);

  const previewService = new AdminPreviewService();
  const qaService = new ContentQAService();
  const defaultBudget = config.prompt.tokenBudgetDefault;
  const tightBudget = Math.floor(defaultBudget * 0.5);
  const results: EntryPointPreview[] = [];

  for (const entryPoint of entryPoints) {
    console.log(`\n📋 Previewing: ${entryPoint.slug} (${entryPoint.id})`);

    try {
      // Default budget preview
      const defaultResult = await previewService.previewEntryPoint(entryPoint.id);
      const defaultQa = await qaService.checkPieces(defaultResult.pieces, defaultBudget);

      // Tight budget preview
      const tightResult = await previewService.previewEntryPoint(entryPoint.id, {
        budget: tightBudget,
      });
      const tightQa = await qaService.checkPieces(tightResult.pieces, tightBudget);

      const exceeds90Pct =
        defaultResult.meta.tokenEst.pct >= 0.9;

      results.push({
        entryPointId: entryPoint.id,
        slug: entryPoint.slug,
        title: entryPoint.title || entryPoint.slug,
        defaultBudget: {
          tokenEst: defaultResult.meta.tokenEst,
          npcBefore: defaultResult.diagnostics.npcBefore,
          npcAfter: defaultResult.diagnostics.npcAfter,
          piecesCount: defaultResult.pieces.length,
        },
        tightBudget: {
          tokenEst: tightResult.meta.tokenEst,
          npcBefore: tightResult.diagnostics.npcBefore,
          npcAfter: tightResult.diagnostics.npcAfter,
          piecesCount: tightResult.pieces.length,
        },
        exceeds90Pct,
        qaReport: [...defaultQa, ...tightQa],
      });

      console.log(`  ✅ Default: ${Math.round(defaultResult.meta.tokenEst.pct * 100)}% (${defaultResult.pieces.length} pieces)`);
      console.log(`  ✅ Tight: ${Math.round(tightResult.meta.tokenEst.pct * 100)}% (${tightResult.pieces.length} pieces)`);
      
      if (exceeds90Pct) {
        console.log(`  ⚠️  WARNING: Exceeds 90% of budget`);
      }
    } catch (error) {
      console.error(`  ❌ Error previewing ${entryPoint.slug}:`, error);
    }
  }

  // Generate JSON report
  const reportDir = join(process.cwd(), 'docs', 'reports');
  mkdirSync(reportDir, { recursive: true });

  const reportPath = join(reportDir, 'v3-entry-point-preview.json');
  writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 JSON report written to: ${reportPath}`);

  // Generate Markdown summary
  const summaryPath = join(reportDir, 'v3-entry-point-preview-summary.md');
  const summary = generateMarkdownSummary(results);
  writeFileSync(summaryPath, summary);
  console.log(`📄 Markdown summary written to: ${summaryPath}`);

  // Print summary stats
  const exceeds90Count = results.filter(r => r.exceeds90Pct).length;
  const totalQA = results.reduce((sum, r) => sum + r.qaReport.length, 0);
  
  console.log(`\n📊 Summary:`);
  console.log(`  Total entry points: ${results.length}`);
  console.log(`  Exceeding 90% budget: ${exceeds90Count}`);
  console.log(`  Total QA issues: ${totalQA}`);
}

function generateMarkdownSummary(results: EntryPointPreview[]): string {
  const exceeds90 = results.filter(r => r.exceeds90Pct);
  const hasQA = results.filter(r => r.qaReport.length > 0);

  return `# Entry Point Preview Summary

Generated: ${new Date().toISOString()}

## Overview

- **Total Entry Points**: ${results.length}
- **Exceeding 90% Budget**: ${exceeds90.length}
- **With QA Issues**: ${hasQA.length}

## Entry Points Exceeding 90% Budget

${exceeds90.length === 0 
  ? 'None ✅' 
  : exceeds90.map(r => `- **${r.title}** (${r.slug}): ${Math.round(r.defaultBudget.tokenEst.pct * 100)}%`).join('\n')
}

## QA Issues Summary

${hasQA.length === 0 
  ? 'No QA issues found ✅' 
  : hasQA.map(r => {
      const errors = r.qaReport.filter(qa => qa.severity === 'error').length;
      const warns = r.qaReport.filter(qa => qa.severity === 'warn').length;
      return `- **${r.title}**: ${errors} errors, ${warns} warnings`;
    }).join('\n')
}

## Recommendations

- Target token usage < 75% before NPCs
- Fix all error-level QA issues
- Review warnings for potential improvements

`;
}

// CLI handling
if (import.meta.url === `file://${process.argv[1]}`) {
  previewAllEntryPoints()
    .then(() => {
      console.log('\n✨ Preview complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Preview failed:', error);
      process.exit(1);
    });
}

