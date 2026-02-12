#!/usr/bin/env node

import { Command } from 'commander';

import { migrateCommand } from './commands/migrate';
import { exportCommand } from './commands/export';
import { installCommand } from './commands/install';
import { gitMessageCommand } from './commands/git-message';
import { doCommand } from './commands/do';
import { configCommand } from './commands/config';
import { mapCommand } from './commands/map';

const program = new Command();

program
  .name('gsd-mm')
  .description('GSD-MM - Get stuff done with MegaMemory: CLI tool for installing, exporting, and migrating')
  .version(require('../package.json').version);

migrateCommand(program);
exportCommand(program);
installCommand(program);
gitMessageCommand(program);
doCommand(program);
configCommand(program);
mapCommand(program);

program.parse(process.argv);
