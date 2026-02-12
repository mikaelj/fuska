import { Command } from 'commander';
import { spawn } from 'child_process';

const VALID_MODES = ['direct', 'quick', 'fast', 'balanced', 'thorough', 'standard'] as const;
type Mode = typeof VALID_MODES[number];

const MODE_DESCRIPTIONS: Record<Mode, string> = {
  direct: 'Planner → Executor only. ~80% faster. Best when you know exactly what to do.',
  quick: 'Planner → Executor with deviation handling. ~70% faster. Small tasks with known solutions.',
  fast: '+Plan Checker. ~50% faster. Validated plans for familiar tech stacks.',
  balanced: '+Researcher. ~35% faster. Moderate tech uncertainty, avoid wrong library choices.',
  thorough: 'Research + Plan Check. ~20% faster. New domains, need verified plans but will manually verify.',
  standard: 'Full chain with Verifier. 0% saved. Critical systems, high stakes, production code.',
};

interface DoOptions {
  mode: string;
}

export function doCommand(program: Command) {
  program
    .command('do [description...]')
    .description('Execute an ad-hoc task using GSD-MM workflow')
    .option('-m, --mode <mode>', 'Workflow mode (direct|quick|fast|balanced|thorough|standard)', 'standard')
    .action((descriptionParts: string[], options: DoOptions) => {
      const mode = validateMode(options.mode);
      const description = descriptionParts.join(' ').trim();
      
      if (!description) {
        console.error('Error: Task description is required');
        process.exit(1);
      }

      if (options.mode === 'standard' && !process.argv.includes('-m') && !process.argv.includes('--mode')) {
        console.log('Using standard mode. Use -m/--mode to specify: direct, quick, fast, balanced, thorough, standard\n');
      }

      const command = `/gsd-mm-do ${mode} ${description}`;
      const child = spawn('opencode', ['run', command], {
        stdio: 'inherit',
        env: process.env
      });
      
      child.on('error', (err) => {
        console.error(`Error: Failed to spawn opencode: ${err.message}`);
        console.error('Ensure opencode is installed and available in PATH');
        process.exit(1);
      });
      
      child.on('close', (code) => {
        process.exit(code ?? 0);
      });
    });
}

function validateMode(mode: string): Mode {
  if (!VALID_MODES.includes(mode as Mode)) {
    console.error(`Error: Invalid mode '${mode}'. Valid modes: ${VALID_MODES.join(', ')}`);
    process.exit(1);
  }
  return mode as Mode;
}
