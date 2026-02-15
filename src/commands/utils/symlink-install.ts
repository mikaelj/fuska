import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import inquirer from 'inquirer';

const DIST_DIR = __dirname;
export const PACKAGE_ROOT = path.resolve(DIST_DIR, '../../..');

export interface RollbackEntry {
  target: string;
  action: 'created' | 'removed';
  previousState?: { type: 'dir' | 'file' | 'symlink'; backupPath?: string };
}

export const rollbackStack: RollbackEntry[] = [];

export async function rollback(): Promise<void> {
  console.log('Rolling back changes...');
  for (const entry of rollbackStack.reverse()) {
    try {
      if (entry.action === 'created') {
        await fs.remove(entry.target);
        console.log(`  Removed: ${entry.target}`);
      }
    } catch (e) {
      console.error(`  Failed to rollback ${entry.target}: ${e}`);
    }
  }
}

export interface SymlinkOptions {
  force: boolean;
  dryRun: boolean;
}

export async function createSymlink(
  source: string,
  target: string,
  options: SymlinkOptions
): Promise<{ created: boolean; skipped: boolean; error?: string }> {
  if (options.dryRun) {
    console.log(`  [DRY-RUN] Would create: ${target} → ${source}`);
    return { created: true, skipped: false };
  }

  const targetExists = await fs.pathExists(target);

  if (targetExists) {
    const stats = fs.lstatSync(target);
    const isSymlink = stats.isSymbolicLink();

    if (isSymlink) {
      const currentTarget = await fs.readlink(target);
      if (currentTarget === source) {
        console.log(`  [SKIP] Already correct: ${target}`);
        return { created: false, skipped: true };
      }
      rollbackStack.push({ target, action: 'removed' });
      await fs.remove(target);
      console.log(`  [UPDATE] Removed old symlink: ${target}`);
    } else {
      if (!options.force) {
        const { migrate } = await inquirer.prompt([{
          type: 'confirm',
          name: 'migrate',
          message: `Old installation detected at ${target}. Replace with symlink?`,
          default: true
        }]);
        if (!migrate) {
          return { created: false, skipped: true, error: `Skipped: ${target}` };
        }
      }
      rollbackStack.push({ target, action: 'removed' });
      await fs.remove(target);
      console.log(`  [MIGRATE] Removed old directory: ${target}`);
    }
  }

  await fs.ensureDir(path.dirname(target));

  const symlinkType: fs.SymlinkType = os.platform() === 'win32' ? 'junction' : 'dir';
  await fs.symlink(source, target, symlinkType);

  rollbackStack.push({ target, action: 'created' });
  console.log(`  [OK] ${target} → ${source}`);
  return { created: true, skipped: false };
}

export async function createIndividualSymlinks(
  sourceDir: string,
  targetDir: string,
  pattern: string,
  options: SymlinkOptions
): Promise<{ created: number; skipped: number }> {
  const { glob: globFn } = await import('glob');
  const items = await globFn(pattern, { cwd: sourceDir, absolute: false });
  
  let created = 0;
  let skipped = 0;

  for (const item of items) {
    const source = path.join(sourceDir, item);
    const target = path.join(targetDir, item);
    
    const result = await createSymlink(source, target, options);
    if (result.created) created++;
    if (result.skipped) skipped++;
  }

  return { created, skipped };
}
