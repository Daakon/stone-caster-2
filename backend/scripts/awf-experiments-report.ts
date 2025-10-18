/**
 * AWF Experiments Report Script
 * CLI tool to generate experiment reports and analytics
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ExperimentReport {
  experimentKey: string;
  experimentName: string;
  dateRange: {
    from: string;
    to: string;
  };
  totalEvents: number;
  variations: Array<{
    variationKey: string;
    totalEvents: number;
    avgLatency: number;
    avgTokens: number;
    totalRetries: number;
    totalFallbacks: number;
    avgActs: number;
    avgChoices: number;
    avgToolCalls: number;
    avgTimeAdvance: number;
  }>;
  locales: Array<{
    locale: string;
    totalEvents: number;
    avgLatency: number;
    avgTokens: number;
  }>;
  summary: {
    overallAvgLatency: number;
    overallAvgTokens: number;
    overallRetryRate: number;
    overallFallbackRate: number;
  };
}

/**
 * Generate experiment report
 */
export async function generateExperimentReport(
  experimentKey: string,
  fromDate: string,
  toDate: string,
  format: 'json' | 'csv' = 'json'
): Promise<ExperimentReport> {
  console.log(`[Experiment Report] Generating report for ${experimentKey} from ${fromDate} to ${toDate}`);

  // Get experiment details
  const { data: experiment, error: expError } = await supabase
    .from('experiments')
    .select('*')
    .eq('key', experimentKey)
    .single();

  if (expError || !experiment) {
    throw new Error(`Experiment ${experimentKey} not found`);
  }

  // Get analytics events
  const { data: events, error: eventsError } = await supabase
    .from('analytics_events')
    .select('*')
    .eq('experiment_key', experimentKey)
    .gte('ts', fromDate)
    .lte('ts', toDate);

  if (eventsError) {
    throw new Error(`Failed to fetch events: ${eventsError.message}`);
  }

  if (!events || events.length === 0) {
    console.log(`[Experiment Report] No events found for ${experimentKey}`);
    return {
      experimentKey,
      experimentName: experiment.name,
      dateRange: { from: fromDate, to: toDate },
      totalEvents: 0,
      variations: [],
      locales: [],
      summary: {
        overallAvgLatency: 0,
        overallAvgTokens: 0,
        overallRetryRate: 0,
        overallFallbackRate: 0,
      },
    };
  }

  console.log(`[Experiment Report] Processing ${events.length} events`);

  // Aggregate by variation
  const variationAggregates: Record<string, any> = {};
  const localeAggregates: Record<string, any> = {};

  for (const event of events) {
    const { variation_key, locale, metrics } = event;

    // Aggregate by variation
    if (variation_key) {
      if (!variationAggregates[variation_key]) {
        variationAggregates[variation_key] = {
          variationKey: variation_key,
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

      const agg = variationAggregates[variation_key];
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

      const agg = localeAggregates[locale];
      agg.totalEvents++;
      agg.avgLatency = (agg.avgLatency * (agg.totalEvents - 1) + (metrics.turnLatencyMs || 0)) / agg.totalEvents;
      agg.avgTokens = (agg.avgTokens * (agg.totalEvents - 1) + (metrics.outputTokens || 0)) / agg.totalEvents;
    }
  }

  // Calculate overall summary
  const totalEvents = events.length;
  const totalRetries = events.reduce((sum, event) => sum + (event.metrics?.retries || 0), 0);
  const totalFallbacks = events.reduce((sum, event) => sum + (event.metrics?.fallbacks || 0), 0);
  const avgLatency = events.reduce((sum, event) => sum + (event.metrics?.turnLatencyMs || 0), 0) / totalEvents;
  const avgTokens = events.reduce((sum, event) => sum + (event.metrics?.outputTokens || 0), 0) / totalEvents;

  const report: ExperimentReport = {
    experimentKey,
    experimentName: experiment.name,
    dateRange: { from: fromDate, to: toDate },
    totalEvents,
    variations: Object.values(variationAggregates),
    locales: Object.values(localeAggregates),
    summary: {
      overallAvgLatency: avgLatency,
      overallAvgTokens: avgTokens,
      overallRetryRate: totalRetries / totalEvents,
      overallFallbackRate: totalFallbacks / totalEvents,
    },
  };

  // Save report
  if (format === 'json') {
    const outputDir = join(process.cwd(), 'experiment-reports');
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const jsonFile = join(outputDir, `experiment-${experimentKey}-${fromDate}-to-${toDate}.json`);
    writeFileSync(jsonFile, JSON.stringify(report, null, 2));
    console.log(`[Experiment Report] JSON report saved to ${jsonFile}`);
  } else if (format === 'csv') {
    const outputDir = join(process.cwd(), 'experiment-reports');
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const csvFile = join(outputDir, `experiment-${experimentKey}-${fromDate}-to-${toDate}.csv`);
    const csv = generateCSV(report);
    writeFileSync(csvFile, csv);
    console.log(`[Experiment Report] CSV report saved to ${csvFile}`);
  }

  return report;
}

/**
 * Generate CSV from report data
 */
function generateCSV(report: ExperimentReport): string {
  const lines: string[] = [];
  
  // Header
  lines.push('Experiment,Variation,Total Events,Avg Latency,Avg Tokens,Total Retries,Total Fallbacks,Avg Acts,Avg Choices,Avg Tool Calls,Avg Time Advance');
  
  // Variation data
  for (const variation of report.variations) {
    lines.push([
      report.experimentKey,
      variation.variationKey,
      variation.totalEvents,
      variation.avgLatency.toFixed(2),
      variation.avgTokens.toFixed(2),
      variation.totalRetries,
      variation.totalFallbacks,
      variation.avgActs.toFixed(2),
      variation.avgChoices.toFixed(2),
      variation.avgToolCalls.toFixed(2),
      variation.avgTimeAdvance.toFixed(2),
    ].join(','));
  }
  
  // Locale data
  for (const locale of report.locales) {
    lines.push([
      report.experimentKey,
      `locale-${locale.locale}`,
      locale.totalEvents,
      locale.avgLatency.toFixed(2),
      locale.avgTokens.toFixed(2),
      '',
      '',
      '',
      '',
      '',
      '',
    ].join(','));
  }
  
  return lines.join('\n');
}

/**
 * List all experiments
 */
export async function listExperiments(): Promise<void> {
  const { data: experiments, error } = await supabase
    .from('experiments')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch experiments:', error);
    return;
  }

  console.log('Available experiments:');
  for (const exp of experiments || []) {
    console.log(`  ${exp.key}: ${exp.name} (${exp.status})`);
  }
}

/**
 * CLI entry point
 */
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'report':
      const experimentKey = args[1];
      const fromDate = args[2];
      const toDate = args[3];
      const format = args[4] as 'json' | 'csv' || 'json';

      if (!experimentKey || !fromDate || !toDate) {
        console.error('Usage: npm run experiments-report report <experiment-key> <from-date> <to-date> [format]');
        console.error('Example: npm run experiments-report report my-experiment 2025-01-01 2025-01-31 json');
        process.exit(1);
      }

      generateExperimentReport(experimentKey, fromDate, toDate, format).catch(console.error);
      break;
      
    case 'list':
      listExperiments().catch(console.error);
      break;
      
    default:
      console.log('Usage:');
      console.log('  npm run experiments-report report <experiment-key> <from-date> <to-date> [format]');
      console.log('  npm run experiments-report list');
      process.exit(1);
  }
}


