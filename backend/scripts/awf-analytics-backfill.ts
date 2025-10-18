/**
 * AWF Analytics Backfill Script
 * Re-aggregate analytics data for quick viewing
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface BackfillData {
  date: string;
  totalEvents: number;
  experiments: Array<{
    experimentKey: string;
    totalEvents: number;
    variations: Array<{
      variationKey: string;
      totalEvents: number;
      avgLatency: number;
      avgTokens: number;
    }>;
  }>;
  locales: Array<{
    locale: string;
    totalEvents: number;
    avgLatency: number;
    avgTokens: number;
  }>;
  worlds: Array<{
    worldRef: string;
    totalEvents: number;
    avgLatency: number;
    avgTokens: number;
  }>;
}

/**
 * Backfill analytics data for a date range
 */
export async function backfillAnalytics(
  fromDate: string,
  toDate: string,
  format: 'json' | 'csv' = 'json'
): Promise<BackfillData[]> {
  console.log(`[Analytics Backfill] Processing data from ${fromDate} to ${toDate}`);

  const results: BackfillData[] = [];
  const startDate = new Date(fromDate);
  const endDate = new Date(toDate);

  for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    const dateStr = date.toISOString().split('T')[0];
    console.log(`[Analytics Backfill] Processing ${dateStr}`);

    try {
      const dayData = await processDayData(dateStr);
      results.push(dayData);
    } catch (error) {
      console.error(`[Analytics Backfill] Error processing ${dateStr}:`, error);
    }
  }

  // Save aggregated results
  if (format === 'json') {
    const outputDir = join(process.cwd(), 'analytics-backfill');
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const jsonFile = join(outputDir, `backfill-${fromDate}-to-${toDate}.json`);
    writeFileSync(jsonFile, JSON.stringify(results, null, 2));
    console.log(`[Analytics Backfill] JSON data saved to ${jsonFile}`);
  } else if (format === 'csv') {
    const outputDir = join(process.cwd(), 'analytics-backfill');
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const csvFile = join(outputDir, `backfill-${fromDate}-to-${toDate}.csv`);
    const csv = generateCSV(results);
    writeFileSync(csvFile, csv);
    console.log(`[Analytics Backfill] CSV data saved to ${csvFile}`);
  }

  console.log(`[Analytics Backfill] Completed processing ${results.length} days`);
  return results;
}

/**
 * Process analytics data for a single day
 */
async function processDayData(date: string): Promise<BackfillData> {
  const startDate = new Date(date);
  const endDate = new Date(date);
  endDate.setDate(endDate.getDate() + 1);

  const { data: events, error } = await supabase
    .from('analytics_events')
    .select('*')
    .gte('ts', startDate.toISOString())
    .lt('ts', endDate.toISOString());

  if (error) {
    throw new Error(`Failed to fetch events for ${date}: ${error.message}`);
  }

  if (!events || events.length === 0) {
    return {
      date,
      totalEvents: 0,
      experiments: [],
      locales: [],
      worlds: [],
    };
  }

  // Aggregate by experiment
  const experimentAggregates: Record<string, any> = {};
  const localeAggregates: Record<string, any> = {};
  const worldAggregates: Record<string, any> = {};

  for (const event of events) {
    const { experiment_key, variation_key, locale, world_ref, metrics } = event;

    // Aggregate by experiment
    if (experiment_key) {
      if (!experimentAggregates[experiment_key]) {
        experimentAggregates[experiment_key] = {
          experimentKey: experiment_key,
          totalEvents: 0,
          variations: {},
        };
      }

      const exp = experimentAggregates[experiment_key];
      exp.totalEvents++;

      if (variation_key) {
        if (!exp.variations[variation_key]) {
          exp.variations[variation_key] = {
            variationKey: variation_key,
            totalEvents: 0,
            avgLatency: 0,
            avgTokens: 0,
          };
        }

        const var_ = exp.variations[variation_key];
        var_.totalEvents++;
        var_.avgLatency = (var_.avgLatency * (var_.totalEvents - 1) + (metrics.turnLatencyMs || 0)) / var_.totalEvents;
        var_.avgTokens = (var_.avgTokens * (var_.totalEvents - 1) + (metrics.outputTokens || 0)) / var_.totalEvents;
      }
    }

    // Aggregate by locale
    if (locale) {
      if (!localeAggregates[locale]) {
        localeAggregates[locale] = {
          locale,
          totalEvents: 0,
          avgLatency: 0,
          avgTokens: 0,
        };
      }

      const loc = localeAggregates[locale];
      loc.totalEvents++;
      loc.avgLatency = (loc.avgLatency * (loc.totalEvents - 1) + (metrics.turnLatencyMs || 0)) / loc.totalEvents;
      loc.avgTokens = (loc.avgTokens * (loc.totalEvents - 1) + (metrics.outputTokens || 0)) / loc.totalEvents;
    }

    // Aggregate by world
    if (world_ref) {
      if (!worldAggregates[world_ref]) {
        worldAggregates[world_ref] = {
          worldRef: world_ref,
          totalEvents: 0,
          avgLatency: 0,
          avgTokens: 0,
        };
      }

      const world = worldAggregates[world_ref];
      world.totalEvents++;
      world.avgLatency = (world.avgLatency * (world.totalEvents - 1) + (metrics.turnLatencyMs || 0)) / world.totalEvents;
      world.avgTokens = (world.avgTokens * (world.totalEvents - 1) + (metrics.outputTokens || 0)) / world.totalEvents;
    }
  }

  return {
    date,
    totalEvents: events.length,
    experiments: Object.values(experimentAggregates).map(exp => ({
      ...exp,
      variations: Object.values(exp.variations),
    })),
    locales: Object.values(localeAggregates),
    worlds: Object.values(worldAggregates),
  };
}

/**
 * Generate CSV from backfill data
 */
function generateCSV(data: BackfillData[]): string {
  const lines: string[] = [];
  
  // Header
  lines.push('Date,Type,Key,SubKey,Total Events,Avg Latency,Avg Tokens');
  
  // Data rows
  for (const day of data) {
    // Experiments
    for (const exp of day.experiments) {
      lines.push([
        day.date,
        'experiment',
        exp.experimentKey,
        '',
        exp.totalEvents,
        '',
        '',
      ].join(','));

      // Variations
      for (const var_ of exp.variations) {
        lines.push([
          day.date,
          'variation',
          exp.experimentKey,
          var_.variationKey,
          var_.totalEvents,
          var_.avgLatency.toFixed(2),
          var_.avgTokens.toFixed(2),
        ].join(','));
      }
    }

    // Locales
    for (const locale of day.locales) {
      lines.push([
        day.date,
        'locale',
        locale.locale,
        '',
        locale.totalEvents,
        locale.avgLatency.toFixed(2),
        locale.avgTokens.toFixed(2),
      ].join(','));
    }

    // Worlds
    for (const world of day.worlds) {
      lines.push([
        day.date,
        'world',
        world.worldRef,
        '',
        world.totalEvents,
        world.avgLatency.toFixed(2),
        world.avgTokens.toFixed(2),
      ].join(','));
    }
  }
  
  return lines.join('\n');
}

/**
 * CLI entry point
 */
if (require.main === module) {
  const args = process.argv.slice(2);
  const fromDate = args[0];
  const toDate = args[1];
  const format = args[2] as 'json' | 'csv' || 'json';

  if (!fromDate || !toDate) {
    console.error('Usage: npm run analytics-backfill <from-date> <to-date> [format]');
    console.error('Example: npm run analytics-backfill 2025-01-01 2025-01-31 json');
    process.exit(1);
  }

  backfillAnalytics(fromDate, toDate, format).catch(console.error);
}


