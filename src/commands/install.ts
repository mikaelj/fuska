import { Command } from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';

const HOME = process.env.HOME || '';
const OPENCODE_CONFIG = path.join(HOME, '.config/opencode');
const CLAUDE_CONFIG = path.join(HOME, '.claude');
const OPENCODE_SOURCE = path.join(__dirname, '../../opencode');

interface InstallSummary {
  source: string;
  target: string;
  fileCount: number;
}

interface InstallTarget {
  name: 'opencode' | 'claude';
  configDir: string;
}

const TOOL_MAPPINGS: Record<string, string> = {
  question: 'AskUserQuestion'
};

export function installCommand(program: Command) {
  program
    .command('install')
    .description('Install Fuska commands and agents to target tool')
    .option('--opencode', 'Install to ~/.config/opencode/')
    .option('--claude', 'Install to ~/.claude/')
    .option('--both', 'Install to both locations')
    .option('--force', 'Overwrite existing directories')
    .action(async (options) => {
      if (!options.opencode && !options.claude && !options.both) {
        console.error('Error: Must specify --opencode, --claude, or --both');
        process.exit(1);
      }

      const targets: InstallTarget[] = [];
      if (options.opencode || options.both) {
        targets.push({ name: 'opencode', configDir: OPENCODE_CONFIG });
      }
      if (options.claude || options.both) {
        targets.push({ name: 'claude', configDir: CLAUDE_CONFIG });
      }

      for (const target of targets) {
        console.log(`\nInstalling Fuska to ${target.configDir}...\n`);
        await installToTarget(target, options.force);
      }
    });
}

async function installToTarget(target: InstallTarget, force: boolean): Promise<void> {
  await fs.ensureDir(target.configDir);

  const summaries: InstallSummary[] = [];

  if (target.name === 'opencode') {
    summaries.push(await installDirectory('fuska', 'fuska', target, force));
    summaries.push(await installDirectory('command/fuska', 'command/fuska', target, force));
    summaries.push(await installDirectory('agents/fuska', 'agents/fuska', target, force));
  } else {
    summaries.push(await installDirectory('fuska', 'fuska', target, force));
    summaries.push(await installCommandsToSkills(target, force));
    summaries.push(await installAgentsToSubagents(target, force));
  }

  showSummary(summaries, target);
}

async function installDirectory(
  sourceRel: string,
  targetRel: string,
  target: InstallTarget,
  force: boolean
): Promise<InstallSummary> {
  const sourceDir = path.join(OPENCODE_SOURCE, sourceRel);
  const targetDir = path.join(target.configDir, targetRel);

  console.log(`Installing ${targetRel}...`);

  if (!await fs.pathExists(sourceDir)) {
    throw new Error(`Source directory not found: ${sourceDir}`);
  }

  if (await fs.pathExists(targetDir)) {
    if (force) {
      console.log(`  Removing existing directory (--force)`);
      await fs.remove(targetDir);
    } else {
      console.error(`  Target directory already exists: ${targetDir}`);
      console.error(`  Use --force to overwrite`);
      throw new Error(`Directory exists: ${targetDir}`);
    }
  }

  await fs.ensureDir(path.dirname(targetDir));
  await fs.copy(sourceDir, targetDir, { overwrite: true });

  const files = await glob('**/*', {
    cwd: targetDir,
    absolute: false,
    nodir: true,
    ignore: ['node_modules', '.git', '**/*.test.ts', '**/__tests__/**']
  });

  console.log(`  [OK] Copied ${files.length} files`);

  return {
    source: sourceRel,
    target: targetRel,
    fileCount: files.length
  };
}

async function installCommandsToSkills(
  target: InstallTarget,
  force: boolean
): Promise<InstallSummary> {
  const sourceDir = path.join(OPENCODE_SOURCE, 'command/fuska');
  const files = await glob('*.md', { cwd: sourceDir, absolute: false });
  
  let installedCount = 0;

  console.log('Installing commands as skills...');

  for (const file of files) {
    const sourcePath = path.join(sourceDir, file);
    const transformed = transformCommandToSkill(sourcePath);
    
    const skillDir = path.join(target.configDir, 'skills', transformed.name);
    
    if (await fs.pathExists(skillDir) && !force) {
      console.log(`  Skipping ${transformed.name} (exists, use --force)`);
      continue;
    }

    if (await fs.pathExists(skillDir)) {
      await fs.remove(skillDir);
    }

    await fs.ensureDir(skillDir);
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), transformed.content);
    installedCount++;
  }

  console.log(`  [OK] Installed ${installedCount} skills`);

  return {
    source: 'command/fuska',
    target: 'skills/fuska-*',
    fileCount: installedCount
  };
}

async function installAgentsToSubagents(
  target: InstallTarget,
  force: boolean
): Promise<InstallSummary> {
  const sourceDir = path.join(OPENCODE_SOURCE, 'agents/fuska');
  const files = await glob('*.md', { cwd: sourceDir, absolute: false });
  
  let installedCount = 0;
  const agentsDir = path.join(target.configDir, 'agents/fuska');

  console.log('Installing agents as subagents...');

  if (await fs.pathExists(agentsDir) && force) {
    await fs.remove(agentsDir);
  }

  await fs.ensureDir(agentsDir);

  for (const file of files) {
    const sourcePath = path.join(sourceDir, file);
    const transformed = transformAgentToSubagent(sourcePath);
    
    const targetPath = path.join(agentsDir, `${transformed.name}.md`);
    
    if (await fs.pathExists(targetPath) && !force) {
      console.log(`  Skipping ${transformed.name} (exists, use --force)`);
      continue;
    }

    await fs.writeFile(targetPath, transformed.content);
    installedCount++;
  }

  console.log(`  [OK] Installed ${installedCount} subagents`);

  return {
    source: 'agents/fuska',
    target: 'agents/fuska',
    fileCount: installedCount
  };
}

function transformCommandToSkill(sourcePath: string): { name: string; content: string } {
  const raw = fs.readFileSync(sourcePath, 'utf-8');
  const { data, content } = matter(raw);
  
  const tools = (data.tools || []) as string[];
  const allowedTools = tools
    .map((t: string) => TOOL_MAPPINGS[t] || t)
    .join(', ');
  
  const newData: Record<string, any> = {
    name: data.name,
    description: data.description,
  };
  
  if (data['argument-hint']) {
    newData['argument-hint'] = data['argument-hint'];
  }
  
  newData['allowed-tools'] = allowedTools;
  
  return {
    name: data.name,
    content: matter.stringify(content, newData)
  };
}

function transformAgentToSubagent(sourcePath: string): { name: string; content: string } {
  const raw = fs.readFileSync(sourcePath, 'utf-8');
  const { data, content } = matter(raw);
  
  const toolsObj = data.tools || {};
  const tools = Object.entries(toolsObj)
    .filter(([_, v]) => v === true)
    .map(([k]) => k)
    .join(', ');
  
  const newData: Record<string, any> = {
    name: data.name,
    description: data.description,
    tools
  };
  
  return {
    name: data.name,
    content: matter.stringify(content, newData)
  };
}

function showSummary(summaries: InstallSummary[], target: InstallTarget): void {
  console.log('\nInstallation complete!\n');
  console.log('Summary:');
  console.log('─────────────────────────────────────');

  const totalFiles = summaries.reduce((sum, s) => sum + s.fileCount, 0);

  summaries.forEach(summary => {
    const fullTarget = path.join(target.configDir, summary.target);
    console.log(`  ${summary.source} -> ${fullTarget}`);
    console.log(`    Files: ${summary.fileCount}`);
  });

  console.log('─────────────────────────────────────');
  console.log(`  Total: ${totalFiles} files`);
  
  console.log('\nInstalled to:');
  if (target.name === 'opencode') {
    console.log(`  ${OPENCODE_CONFIG}/fuska/`);
    console.log(`  ${OPENCODE_CONFIG}/command/fuska/`);
    console.log(`  ${OPENCODE_CONFIG}/agents/fuska/`);
  } else {
    console.log(`  ${CLAUDE_CONFIG}/fuska/`);
    console.log(`  ${CLAUDE_CONFIG}/skills/fuska-*/`);
    console.log(`  ${CLAUDE_CONFIG}/agents/fuska/`);
  }
}
