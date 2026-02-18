import { Command } from 'commander';
import { runOpenCodeJson } from './utils/json-output';

export function doCommand(program: Command) {
  program
    .command('do <mode> [description...]')
    .description('Execute an unplanned task with mode-aware agent chain (planned|checked|researched|verified)')
    .action(async (mode: string, description: string[]) => {
      const args = ['--no-review', '--auto-commit', mode, ...description];
      try {
        const code = await runOpenCodeJson({
          command: '/fuska-do',
          args,
          progressLabel: 'Executing task'
        });
        process.exit(code);
      } catch (err: any) {
        console.error(`\nError: ${err.message}`);
        process.exit(1);
      }
    });
}
