import { Command } from 'commander';
import { runOpenCodeJson } from './utils/json-output';

export function mapCommand(program: Command) {
  program
    .command('map [area]')
    .description('Map codebase structure to MegaMemory using parallel analysis agents')
    .option('--domains-only', 'Run only domain discovery (faster)')
    .option('--force', 'Force refresh all codebase concepts, domains, and file/code index')
    .action(async (area: string | undefined, options: { domainsOnly?: boolean; force?: boolean }) => {
      const command = options.domainsOnly 
        ? '/fuska-map-domains' 
        : '/fuska-map-codebase';
      
      const args: string[] = [];
      if (area) args.push(area);
      if (options.force) args.push('--force');
      
      const label = options.domainsOnly ? 'Mapping domains' : 'Mapping codebase';
      
      if (!options.domainsOnly) {
        console.log('This will take several minutes to finish. Please wait...\n');
      }
      
      try {
        const code = await runOpenCodeJson({
          command,
          args,
          progressLabel: label
        });
        process.exit(code);
      } catch (err: any) {
        console.error(`\nError: ${err.message}`);
        process.exit(1);
      }
    });
}
