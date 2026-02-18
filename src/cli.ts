#!/usr/bin/env node

import { Command } from 'commander';

import { initCommand } from './commands/init';
import { migrateCommand } from './commands/migrate';
import { exportCommand } from './commands/export';
import { installCommand } from './commands/install';
import { gitMessageCommand } from './commands/git-message';
import { configCommand } from './commands/config';
import { mapCommand } from './commands/map';
import { worktreeAddCommand } from './commands/worktree-add';
import { worktreeMergeCommand } from './commands/worktree-merge';
import { initiativeListCommand } from './commands/initiatives';
import { todoCommand } from './commands/todo';
import { progressCommand } from './commands/progress';
import { providerCommand } from './commands/provider';
import { helpCommand } from './commands/help';
import { infoCommand } from './commands/info';
import { migrateMultiInitiativeCommand } from './commands/migrate-multi-initiative';
import { initiativeSwitchCommand } from './commands/initiative-switch';
import { refreshCommand } from './commands/refresh';
import { askCommand } from './commands/ask';
import { doCommand } from './commands/do';

const program = new Command();

program
  .name('fuska')
  .description('Fuska - Get stuff done with MegaMemory: CLI tool for installing, exporting, and migrating')
  .version(require('../package.json').version);

initCommand(program);
exportCommand(program);
installCommand(program);
providerCommand(program);
helpCommand(program);
configCommand(program);
mapCommand(program);
todoCommand(program);
progressCommand(program);
infoCommand(program);
refreshCommand(program);
askCommand(program);
doCommand(program);

const gitCmd = program.command('git').description('Git utilities');
gitMessageCommand(gitCmd);

const worktreeCmd = gitCmd.command('worktree').description('Manage git worktrees with MegaMemory context');
worktreeAddCommand(worktreeCmd);
worktreeMergeCommand(worktreeCmd);

const initiativeCmd = program.command('initiative').description('Manage Fuska initiatives');
initiativeListCommand(initiativeCmd);
initiativeSwitchCommand(initiativeCmd);

const migrateCmd = program.command('migrate').description('Migration utilities');
migrateCommand(migrateCmd);
migrateMultiInitiativeCommand(migrateCmd);

program.parse(process.argv);
