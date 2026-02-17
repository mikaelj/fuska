import { Command } from 'commander';
import { runOpenCodeJson } from './utils/json-output';

export function askCommand(program: Command) {
  program
    .command('ask [args...]')
    .description('Ask questions about the codebase using import graph data')
    .action(async (args: string[]) => {
      try {
        const code = await runOpenCodeJson({
          command: '/fuska-ask',
          args,
          progressLabel: 'Querying codebase'
        });
        process.exit(code);
      } catch (err: any) {
        console.error(`\nError: ${err.message}`);
        process.exit(1);
      }
    });
}
