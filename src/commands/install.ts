import { Command } from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';

const OPENCODE_CONFIG = path.join(process.env.HOME || '', '.config/opencode');
const OPENCODE_SOURCE = path.join(process.cwd(), 'opencode');

interface InstallSummary {
  source: string;
  target: string;
  fileCount: number;
}

export function installCommand(program: Command) {
  program
    .command('install')
    .description('Install Fuska commands and agents from opencode/ to ~/.config/opencode')
    .option('--force', 'Overwrite existing directories')
    .action(async (options) => {
      try {
        console.log('Installing Fuska to ~/.config/opencode...\n');

        await fs.ensureDir(OPENCODE_CONFIG);

        const summaries: InstallSummary[] = [];
        summaries.push(await installDirectory('fuska', 'fuska', options.force));
        summaries.push(await installDirectory('command/fuska', 'command/fuska', options.force));
        summaries.push(await installDirectory('agents/fuska', 'agents/fuska', options.force));

        showSummary(summaries);
      } catch (error: any) {
        console.error(`\nInstallation failed: ${error.message}`);
        throw error;
      }
    });
}

async function installDirectory(
  sourceRel: string,
  targetRel: string,
  force: boolean
): Promise<InstallSummary> {
  const sourceDir = path.join(OPENCODE_SOURCE, sourceRel);
  const targetDir = path.join(OPENCODE_CONFIG, targetRel);

  console.log(`Installing ${targetRel}...`);

  if (!await fs.pathExists(sourceDir)) {
    throw new Error(`Source directory not found: ${sourceDir}`);
  }

  if (await fs.pathExists(targetDir)) {
    if (force) {
      console.log(`  🗑  Removing existing directory (--force)`);
      await fs.remove(targetDir);
    } else {
      console.error(`  ❌ Target directory already exists: ${targetDir}`);
      console.error(`     Use --force to overwrite`);
      throw new Error(`Directory exists: ${targetDir}`);
    }
  }

  await fs.ensureDir(path.dirname(targetDir));
  await fs.copy(sourceDir, targetDir, { overwrite: true });

  const files = await glob('**/*', {
    cwd: targetDir,
    absolute: false,
    ignore: ['node_modules', '.git', '**/*.test.ts', '**/__tests__/**']
  });

  console.log(`  [OK] Copied ${files.length} files`);

  return {
    source: sourceRel,
    target: targetRel,
    fileCount: files.length
  };
}

function showSummary(summaries: InstallSummary[]): void {
  console.log('\n✅ Installation complete!\n');
  console.log('Summary:');
  console.log('─────────────────────────────────────');

  const totalFiles = summaries.reduce((sum, s) => sum + s.fileCount, 0);

  summaries.forEach(summary => {
    const fullTarget = path.join('~/.config/opencode', summary.target);
    console.log(`  ${summary.source} → ${fullTarget}`);
    console.log(`    Files copied: ${summary.fileCount}`);
  });

  console.log('─────────────────────────────────────');
  console.log(`  Total files installed: ${totalFiles}`);
  console.log('\nInstalled directories:');
  console.log(`  ${OPENCODE_CONFIG}/fuska/`);
  console.log(`  ${OPENCODE_CONFIG}/command/fuska/`);
  console.log(`  ${OPENCODE_CONFIG}/agents/fuska/`);
}
