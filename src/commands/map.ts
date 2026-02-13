import { Command } from 'commander';
import { spawn } from 'child_process';

export function mapCommand(program: Command) {
  program
    .command('map [area]')
    .description('Map codebase structure to MegaMemory using parallel analysis agents')
    .option('--domains-only', 'Run only domain discovery (faster)')
    .action((area: string | undefined, options: { domainsOnly?: boolean }) => {
      let command = '/fuska-map-codebase';
      
      if (options.domainsOnly) {
        command += ' --domains-only';
      }
      if (area) {
        command += ` ${area}`;
      }
      
      console.log('Launching codebase mapper...\n');
      
      const child = spawn('opencode', ['run', command], {
        env: process.env,
        stdio: 'inherit'
      });

      child.on('error', (err) => {
        console.error(`\nError: Failed to spawn opencode: ${err.message}`);
        console.error('Ensure opencode is installed and available in PATH');
        process.exit(1);
      });

      child.on('close', (code) => {
        process.exit(code ?? 0);
      });
    });
}
