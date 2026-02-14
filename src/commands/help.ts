import { Command } from 'commander';
import { runOpenCodeJson } from './utils/json-output';

export function helpCommand(program: Command) {
  program
    .command('help [args...]')
    .description('Show Fuska usage guide and available commands')
    .action(async (args: string[]) => {
      try {
        const code = await runOpenCodeJson({
          command: '/fuska-help',
          args,
          progressLabel: 'Loading help'
        });
        process.exit(code);
      } catch (err: any) {
        console.error(`\nError: ${err.message}`);
        process.exit(1);
      }
    });
}
