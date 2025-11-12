#!/usr/bin/env node
/**
 * Author CLI
 * Import/export tool for authoring assets
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { exportCommand } from './commands/export.js';
import { importCommand } from './commands/import.js';

const argv = await yargs(hideBin(process.argv))
  .scriptName('author')
  .version('1.0.0')
  .command(exportCommand)
  .command(importCommand)
  .demandCommand(1, 'You need at least one command before moving on')
  .help()
  .parse();

