import { Command } from 'commander';
import { runOpenCodeJson } from './utils/json-output';

export function progressCommand(program: Command) {
  program
    .command('progress [phase]')
    .description('Check project progress and show next action')
    .option('--verify', 'Include verification status')
    .action(async (phase: string | undefined, options: { verify?: boolean }) => {
      const args: string[] = [];
      if (phase) args.push(phase);
      if (options.verify) args.push('--verify');
      
      try {
        const code = await runOpenCodeJson({
          command: '/fuska-progress',
          args,
          progressLabel: 'Checking progress'
        });
        process.exit(code);
      } catch (err: any) {
        console.error(`\nError: ${err.message}`);
        process.exit(1);
      }
    });
}
