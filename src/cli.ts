#!/usr/bin/env node

import { Command } from 'commander';

import { migrateCommand } from './commands/migrate';
import { exportCommand } from './commands/export';
import { installCommand } from './commands/install';
import { gitMessageCommand } from './commands/git-message';
import { configCommand } from './commands/config';
import { mapCommand } from './commands/map';
import { worktreeAddCommand } from './commands/worktree-add';
import { worktreeMergeCommand } from './commands/worktree-merge';
import { projectsCommand } from './commands/projects';
import { todoCommand } from './commands/todo';
import { progressCommand } from './commands/progress';
import { helpCommand } from './commands/help';

const program = new Command();

program
  .name('fuska')
  .description('Fuska - Get stuff done with MegaMemory: CLI tool for installing, exporting, and migrating')
  .version(require('../package.json').version);

migrateCommand(program);
exportCommand(program);
installCommand(program);
helpCommand(program);
gitMessageCommand(program);
configCommand(program);
mapCommand(program);
worktreeAddCommand(program);
worktreeMergeCommand(program);
projectsCommand(program);
todoCommand(program);
progressCommand(program);

program.parse(process.argv);
