import { Command } from 'commander';
import * as path from 'path';
import * as os from 'os';
import inquirer from 'inquirer';
import {
  PACKAGE_ROOT,
  createSymlink,
  createIndividualSymlinks,
  removeSymlink,
  removeGlobSymlinks,
  rollback,
  rollbackStack,
  SymlinkOptions
} from './utils/symlink-install';
import {
  readProviderConfig,
  writeProviderConfig,
  detectInstalledProviders,
  ProviderType
} from './utils/provider-config';

const HOME = os.homedir();
const OPENCODE_CONFIG = path.join(HOME, '.config/opencode');
const CLAUDE_CONFIG = path.join(HOME, '.claude');
const FUSKA_CONFIG_DIR = path.join(HOME, '.config/fuska');
const FUSKA_CONFIG_FILE = path.join(FUSKA_CONFIG_DIR, 'fuska.jsonc');

function getTargetDir(provider: ProviderType): string {
  return provider === 'opencode' ? OPENCODE_CONFIG : CLAUDE_CONFIG;
}

interface SymlinkMapping {
  targetRel: string;
  sourceRel: string;
  isGlob?: boolean;
  globPattern?: string;
}

const OPENCODE_SYMLINKS: SymlinkMapping[] = [
  { targetRel: 'fuska', sourceRel: 'provider/opinkode/fuska' },
  { targetRel: 'commands/fuska', sourceRel: 'provider/opinkode/command/fuska' },
  { targetRel: 'agents/fuska', sourceRel: 'provider/opinkode/agents/fuska' },
];

const CLAUDE_SYMLINKS: SymlinkMapping[] = [
  { targetRel: 'fuska', sourceRel: 'provider/klod/fuska' },
  { targetRel: 'skills', sourceRel: 'provider/klod/skills', isGlob: true, globPattern: 'fuska*' },
  { targetRel: 'agents/fuska', sourceRel: 'provider/klod/agents/fuska' },
];

const OPENCODE_CLEANUP_PATHS: string[] = [
  'fuska',
  'command/fuska',
  'commands/fuska',
  'agents/fuska',
];

const CLAUDE_CLEANUP_PATHS: string[] = [
  'fuska',
  'agents/fuska',
];

const CLAUDE_SKILLS_PATTERN = 'fuska*';

export function installCommand(program: Command) {
  program
    .command('install [target]')
    .description('Install Fuska commands and agents to target tool via symlinks')
    .option('--force', 'Replace existing directories without prompting')
    .option('--dry-run', 'Show what would be done without making changes')
    .action(async (target: string | undefined, options) => {
      const symlinkOptions: SymlinkOptions = {
        force: options.force || false,
        dryRun: options.dryRun || false
      };

      try {
        let provider = await determineProvider(target, options);
        
        if (provider === 'both') {
          console.log(`\nInstalling to opencode at ${OPENCODE_CONFIG}`);
          await installToProvider('opencode', symlinkOptions);
          console.log(`\nInstalling to claude at ${CLAUDE_CONFIG}`);
          await installToProvider('claude', symlinkOptions);
        } else {
          const cleanupResult = await cleanupOtherProvider(provider, symlinkOptions);
          if (cleanupResult.removed > 0) {
            console.log(`Removed ${cleanupResult.removed} old symlinks from previous provider.`);
          }

          if (target) {
            console.log(`\nInstalling to ${provider} at ${getTargetDir(provider)}`);
          }
          await installToProvider(provider, symlinkOptions);
        }
      } catch (err) {
        console.error(`\n[ERROR] ${(err as Error).message}`);
        if (!options.dryRun && rollbackStack.length > 0) {
          await rollback();
        }
        process.exit(1);
      }
    });
}

async function determineProvider(target: string | undefined, options: any): Promise<ProviderType | 'both'> {
  if (target === 'opencode') return 'opencode';
  if (target === 'claude') return 'claude';
  if (target === 'both') return 'both';
  
  if (target) {
    throw new Error(`Unknown target: ${target}. Use 'opencode', 'claude', or 'both'.`);
  }

  const config = await readProviderConfig();
  if (config) {
    console.log(`Installing to ${config.provider} at ${getTargetDir(config.provider)}`);
    return config.provider;
  }

  const installed = await detectInstalledProviders();

  if (installed.length === 1) {
    const provider = installed[0];
    console.log(`Installing to ${provider} at ${getTargetDir(provider)}`);
    await writeProviderConfig({ provider });
    return provider;
  }

  if (installed.length === 0) {
    console.log('No provider configured. Which should fuska install to?');
  }

  return await promptForProvider();
}

async function promptForProvider(): Promise<ProviderType | 'both'> {
  const { provider } = await inquirer.prompt([{
    type: 'list',
    name: 'provider',
    message: 'Select provider:',
    choices: [
      { name: 'opencode (~/.config/opencode/)', value: 'opencode' },
      { name: 'claude (~/.claude/)', value: 'claude' },
      { name: 'both', value: 'both' }
    ]
  }]);

  if (provider !== 'both') {
    await writeProviderConfig({ provider });
  }

  return provider;
}

async function cleanupOtherProvider(
  keepProvider: ProviderType,
  options: SymlinkOptions
): Promise<{ removed: number; skipped: number }> {
  const otherProvider = keepProvider === 'opencode' ? 'claude' : 'opencode';
  const targetBase = getTargetDir(otherProvider);

  const cleanupPaths = otherProvider === 'opencode'
    ? OPENCODE_CLEANUP_PATHS
    : CLAUDE_CLEANUP_PATHS;

  let removed = 0;
  let skipped = 0;

  console.log(`\nCleaning up old symlinks from ${otherProvider}...`);

  for (const relPath of cleanupPaths) {
    const target = path.join(targetBase, relPath);
    const result = await removeSymlink(target, options);
    if (result.removed) removed++;
    if (result.skipped) skipped++;
  }

  if (otherProvider === 'claude') {
    const skillsDir = path.join(targetBase, 'skills');
    const result = await removeGlobSymlinks(skillsDir, CLAUDE_SKILLS_PATTERN, options);
    removed += result.removed;
    skipped += result.skipped;
  }

  return { removed, skipped };
}

async function installToProvider(
  provider: ProviderType,
  options: SymlinkOptions
): Promise<void> {
  const targetBase = getTargetDir(provider);
  const symlinks = provider === 'opencode' ? OPENCODE_SYMLINKS : CLAUDE_SYMLINKS;

  console.log('\nCreating symlinks...');

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const mapping of symlinks) {
    const source = path.join(PACKAGE_ROOT, mapping.sourceRel);
    const target = path.join(targetBase, mapping.targetRel);

    if (mapping.isGlob) {
      const { created, skipped } = await createIndividualSymlinks(
        source,
        target,
        mapping.globPattern || 'fuska-*',
        options
      );
      totalCreated += created;
      totalSkipped += skipped;
    } else {
      const result = await createSymlink(source, target, options);
      if (result.created) totalCreated++;
      if (result.skipped) totalSkipped++;
      if (result.error) {
        throw new Error(result.error);
      }
    }
  }

  console.log(`\nDone! ${totalCreated} symlinks created, ${totalSkipped} skipped.`);
  console.log(`Provider preference saved to ${FUSKA_CONFIG_FILE}`);
}
