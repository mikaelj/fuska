#!/usr/bin/env node

import { Command } from 'commander';

import { migrateCommand } from './commands/migrate';
import { exportCommand } from './commands/export';
import { installCommand } from './commands/install';

const program = new Command();

program
  .name('gsd-mm')
  .description('GSD-MM - Get stuff done with MegaMemory: CLI tool for installing, exporting, and migrating')
  .version(require('../package.json').version);

migrateCommand(program);
exportCommand(program);
installCommand(program);

program.parse(process.argv);
