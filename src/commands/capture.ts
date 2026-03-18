import { Command } from 'commander';
import { runOpenCodeJson } from './utils/json-output';

export function captureCommand(program: Command) {
  program
    .command('capture [description...]')
    .description('Capture current context as adhoc-plan or chapter (assesses complexity, delegates to planner)')
    .option('--dry-run', 'Show assessment without creating artifact')
    .action(async (description: string[], options: { dryRun?: boolean }) => {
      const args = [];
      if (options.dryRun) {
        args.push('--dry-run');
      }
      args.push(...description);

      try {
        const code = await runOpenCodeJson({
          command: '/fuska-capture',
          args,
          progressLabel: 'Assessing context'
        });
        process.exit(code);
      } catch (err: any) {
        console.error(`\nError: ${err.message}`);
        process.exit(1);
      }
    });
}
