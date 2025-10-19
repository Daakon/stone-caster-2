/**
 * AWF Analytics Daily Rollup Job
 * Creates daily summaries of analytics data for reporting
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RollupData {
  date: string;
  experimentKey?: string;
  variationKey?: string;
  locale: string;
  worldRef: string;
  adventureRef: string;
  totalEvents: number;
  avgLatency: number;
  avgTokens: number;
  totalRetries: number;
  totalFallbacks: number;
  avgActs: number;
  avgChoices: number;
  avgToolCalls: number;
  avgTimeAdvance: number;
}

/**
 * Run daily rollup for a specific date
 */
export async function runDailyRollup(date: string): Promise<void> {
  console.log(`[Analytics Rollup] Starting rollup for ${date}`);

  try {
    // Get all events for the date
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);

    const { data: events, error } = await supabase
      .from('analytics_events')
      .select('*')
      .gte('ts', startDate.toISOString())
      .lt('ts', endDate.toISOString());

    if (error) {
      throw new Error(`Failed to fetch events: ${error.message}`);
    }

    if (!events || events.length === 0) {
      console.log(`[Analytics Rollup] No events found for ${date}`);
      return;
    }

    console.log(`[Analytics Rollup] Processing ${events.length} events for ${date}`);

    // Aggregate data
    const rollupData = aggregateEvents(events);

    // Create output directory
    const outputDir = join(process.cwd(), 'analytics-rollups');
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Save JSON rollup
    const jsonFile = join(outputDir, `rollup-${date}.json`);
    writeFileSync(jsonFile, JSON.stringify(rollupData, null, 2));
    console.log(`[Analytics Rollup] JSON rollup saved to ${jsonFile}`);

    // Save CSV rollup
    const csvFile = join(outputDir, `rollup-${date}.csv`);
    const csv = generateCSV(rollupData);
    writeFileSync(csvFile, csv);
    console.log(`[Analytics Rollup] CSV rollup saved to ${csvFile}`);

    console.log(`[Analytics Rollup] Completed rollup for ${date}`);
  } catch (error) {
    console.error(`[Analytics Rollup] Error processing ${date}:`, error);
    throw error;
  }
}

/**
 * Aggregate events into rollup data
 */
function aggregateEvents(events: any[]): RollupData[] {
  const aggregates: Record<string, RollupData> = {};

  for (const event of events) {
    const key = `${event.experiment_key || 'no-experiment'}-${event.variation_key || 'no-variation'}-${event.locale}-${event.world_ref}-${event.adventure_ref}`;
    
    if (!aggregates[key]) {
      aggregates[key] = {
        date: event.ts.split('T')[0],
        experimentKey: event.experiment_key,
        variationKey: event.variation_key,
        locale: event.locale,
        worldRef: event.world_ref,
        adventureRef: event.adventure_ref,
        totalEvents: 0,
        avgLatency: 0,
        avgTokens: 0,
        totalRetries: 0,
        totalFallbacks: 0,
        avgActs: 0,
        avgChoices: 0,
        avgToolCalls: 0,
        avgTimeAdvance: 0,
      };
    }

    const agg = aggregates[key];
    const metrics = event.metrics || {};

    agg.totalEvents++;
    agg.avgLatency = (agg.avgLatency * (agg.totalEvents - 1) + (metrics.turnLatencyMs || 0)) / agg.totalEvents;
    agg.avgTokens = (agg.avgTokens * (agg.totalEvents - 1) + (metrics.outputTokens || 0)) / agg.totalEvents;
    agg.totalRetries += metrics.retries || 0;
    agg.totalFallbacks += metrics.fallbacks || 0;
    agg.avgActs = (agg.avgActs * (agg.totalEvents - 1) + (metrics.actsCount || 0)) / agg.totalEvents;
    agg.avgChoices = (agg.avgChoices * (agg.totalEvents - 1) + (metrics.choicesCount || 0)) / agg.totalEvents;
    agg.avgToolCalls = (agg.avgToolCalls * (agg.totalEvents - 1) + (metrics.toolCalls || 0)) / agg.totalEvents;
    agg.avgTimeAdvance = (agg.avgTimeAdvance * (agg.totalEvents - 1) + (metrics.timeAdvanceTicks || 0)) / agg.totalEvents;
  }

  return Object.values(aggregates);
}

/**
 * Generate CSV from rollup data
 */
function generateCSV(rollupData: RollupData[]): string {
  const lines: string[] = [];
  
  // Header
  lines.push('Date,Experiment,Variation,Locale,World,Adventure,Total Events,Avg Latency,Avg Tokens,Total Retries,Total Fallbacks,Avg Acts,Avg Choices,Avg Tool Calls,Avg Time Advance');
  
  // Data rows
  for (const item of rollupData) {
    lines.push([
      item.date,
      item.experimentKey || '',
      item.variationKey || '',
      item.locale,
      item.worldRef,
      item.adventureRef,
      item.totalEvents,
      item.avgLatency.toFixed(2),
      item.avgTokens.toFixed(2),
      item.totalRetries,
      item.totalFallbacks,
      item.avgActs.toFixed(2),
      item.avgChoices.toFixed(2),
      item.avgToolCalls.toFixed(2),
      item.avgTimeAdvance.toFixed(2),
    ].join(','));
  }
  
  return lines.join('\n');
}

/**
 * Run rollup for the last N days
 */
export async function runBackfillRollup(days: number = 7): Promise<void> {
  console.log(`[Analytics Rollup] Starting backfill rollup for last ${days} days`);

  const today = new Date();
  
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    try {
      await runDailyRollup(dateStr);
    } catch (error) {
      console.error(`[Analytics Rollup] Failed to process ${dateStr}:`, error);
    }
  }

  console.log(`[Analytics Rollup] Completed backfill rollup for last ${days} days`);
}

/**
 * CLI entry point
 */
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  const param = args[1];

  switch (command) {
    case 'daily':
      if (!param) {
        console.error('Usage: npm run rollup daily YYYY-MM-DD');
        process.exit(1);
      }
      runDailyRollup(param).catch(console.error);
      break;
      
    case 'backfill':
      const days = param ? parseInt(param) : 7;
      runBackfillRollup(days).catch(console.error);
      break;
      
    default:
      console.log('Usage:');
      console.log('  npm run rollup daily YYYY-MM-DD  - Run rollup for specific date');
      console.log('  npm run rollup backfill [days]  - Run rollup for last N days (default: 7)');
      process.exit(1);
  }
}


