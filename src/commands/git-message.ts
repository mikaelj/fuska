import { Command } from 'commander';
import { runOpenCodeJson } from './utils/json-output';

export function gitMessageCommand(program: Command) {
  program
    .command('message [args...]')
    .description('Test and preview commit messages using Fuska commit message rules')
    .action(async (args: string[]) => {
      try {
        const code = await runOpenCodeJson({
          command: '/fuska-git-message',
          args,
          progressLabel: 'Working'
        });
        process.exit(code);
      } catch (err: any) {
        console.error(`\nError: ${err.message}`);
        process.exit(1);
      }
    });
}
