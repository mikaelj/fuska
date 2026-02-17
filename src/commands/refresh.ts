import { Command } from 'commander';
import { runOpenCodeJson } from './utils/json-output';

export function refreshCommand(program: Command) {
  program
    .command('refresh [args...]')
    .description('Refresh import graph with file and symbol-level indexing')
    .action(async (args: string[]) => {
      try {
        const code = await runOpenCodeJson({
          command: '/fuska-refresh',
          args,
          progressLabel: 'Refreshing import graph'
        });
        process.exit(code);
      } catch (err: any) {
        console.error(`\nError: ${err.message}`);
        process.exit(1);
      }
    });
}
