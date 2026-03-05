#!/usr/bin/env node

import { Command, Help } from 'commander';

import { initCommand } from './commands/init';
import { migrateCommand } from './commands/migrate';
import { migrateRoadmapCommand } from './commands/migrate-roadmap';
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
import { migrateTerminologyCommand } from './commands/migrate-terminology';
import { migrateStatusesCommand } from './commands/migrate-statuses';
import { initiativeSwitchCommand } from './commands/initiative-switch';
import { initiativeNewCommand } from './commands/initiative-new';
import { refreshCommand } from './commands/refresh';
import { askCommand } from './commands/ask';
import { doCommand } from './commands/do';
import { lessonsCommand } from './commands/lessons';
import { decisionCommand } from './commands/decision';

const AI_COMMANDS = new Set(['do', 'map', 'ask', 'refresh']);
const GROUP_COMMANDS = new Set(['git', 'initiative', 'migrate', 'decision']);

const program = new Command();

program
  .name('fuska')
  .description('Lean solo agentic development with MegaMemory')
  .version(require('../package.json').version);

program.configureHelp({
  formatHelp(cmd: Command, helper: Help): string {
    // Only apply custom grouping for the root program command
    if (cmd.parent) {
      return Help.prototype.formatHelp.call(helper, cmd, helper);
    }

    const termWidth = helper.padWidth(cmd, helper);
    const helpWidth = helper.helpWidth || 80;

    function formatItem(term: string, description: string): string {
      const padding = ' '.repeat(Math.max(termWidth - term.length + 2, 2));
      const fullText = `  ${term}${padding}${description}`;
      return helper.wrap(fullText, helpWidth, termWidth + 4);
    }

    const output: string[] = [];

    // Usage
    output.push(`Usage: ${helper.commandUsage(cmd)}`, '');

    // Description
    const desc = helper.commandDescription(cmd);
    if (desc) {
      output.push(desc, '');
    }

    // Options
    const options = helper.visibleOptions(cmd);
    if (options.length) {
      output.push('Options:');
      for (const opt of options) {
        output.push(formatItem(helper.optionTerm(opt), helper.optionDescription(opt)));
      }
      output.push('');
    }

    // Partition commands into groups
    const commands = helper.visibleCommands(cmd);
    const aiCmds: Command[] = [];
    const localCmds: Command[] = [];
    const groupCmds: Command[] = [];

    for (const sub of commands) {
      const name = sub.name();
      if (AI_COMMANDS.has(name)) {
        aiCmds.push(sub);
      } else if (GROUP_COMMANDS.has(name)) {
        groupCmds.push(sub);
      } else if (name !== 'help') {
        localCmds.push(sub);
      }
    }

    function renderGroup(title: string, cmds: Command[]): void {
      if (!cmds.length) return;
      output.push(title);
      for (const sub of cmds) {
        output.push(formatItem(helper.subcommandTerm(sub), helper.subcommandDescription(sub)));
      }
      output.push('');
    }

    renderGroup('AI-Powered Commands (spawn an AI agent):', aiCmds);
    renderGroup('Local Commands:', localCmds);
    renderGroup('Command Groups:', groupCmds);

    return output.join('\n');
  },
});

initCommand(program);
exportCommand(program);
installCommand(program);
providerCommand(program);
helpCommand(program);
configCommand(program);
mapCommand(program);
todoCommand(program);
lessonsCommand(program);
progressCommand(program);
infoCommand(program);
refreshCommand(program);
askCommand(program);
doCommand(program);
decisionCommand(program);

const gitCmd = program.command('git').description('Git utilities');
gitMessageCommand(gitCmd);

const worktreeCmd = gitCmd.command('worktree').description('Manage git worktrees with MegaMemory context');
worktreeAddCommand(worktreeCmd);
worktreeMergeCommand(worktreeCmd);

const initiativeCmd = program.command('initiative').description('Manage Fuska initiatives');
initiativeListCommand(initiativeCmd);
initiativeSwitchCommand(initiativeCmd);
initiativeNewCommand(initiativeCmd);

const migrateCmd = program.command('migrate').description('Migration utilities');
migrateCommand(migrateCmd);
migrateRoadmapCommand(migrateCmd);
migrateMultiInitiativeCommand(migrateCmd);
migrateTerminologyCommand(migrateCmd);
migrateStatusesCommand(migrateCmd);

program.parse(process.argv);
