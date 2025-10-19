// Phase 24: Rollup Jobs Runner
// Hourly and daily ETL jobs for metrics warehouse

import { rollupJobs } from '../src/metrics/rollup-jobs.js';
import { sloAlerts } from '../src/slos/awf-slo-alerts.js';

async function runHourlyRollup() {
  console.log('Starting hourly rollup job...');
  
  try {
    await rollupJobs.runHourlyRollup();
    console.log('Hourly rollup completed successfully');
  } catch (error) {
    console.error('Hourly rollup failed:', error);
    process.exit(1);
  }
}

async function runDailyRollup() {
  console.log('Starting daily rollup job...');
  
  try {
    await rollupJobs.runDailyRollup();
    console.log('Daily rollup completed successfully');
  } catch (error) {
    console.error('Daily rollup failed:', error);
    process.exit(1);
  }
}

async function runAlerts() {
  console.log('Starting SLO alerts evaluation...');
  
  try {
    await sloAlerts.evaluateThresholds();
    console.log('SLO alerts evaluation completed successfully');
  } catch (error) {
    console.error('SLO alerts evaluation failed:', error);
    process.exit(1);
  }
}

// Main execution
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'hourly':
      await runHourlyRollup();
      break;
    case 'daily':
      await runDailyRollup();
      break;
    case 'alerts':
      await runAlerts();
      break;
    case 'all':
      await runHourlyRollup();
      await runDailyRollup();
      await runAlerts();
      break;
    default:
      console.log('Usage: npm run rollups [hourly|daily|alerts|all]');
      process.exit(1);
  }
}

main().catch(error => {
  console.error('Rollup job failed:', error);
  process.exit(1);
});
