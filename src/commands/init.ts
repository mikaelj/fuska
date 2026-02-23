import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as jsonc from 'jsonc-parser';
import { execSync } from 'child_process';
import { runOpenCodeJson } from './utils/json-output';
import { findInitiativeBySlug } from './utils/initiative-utils';
import { readProviderConfig, ProviderType } from './utils/provider-config';

const OPENCODE_FUSKA_PERMISSIONS: Record<string, string> = {
  '~/.config/opencode/fuska/*': 'allow',
  '~/.config/opencode/commands/fuska/*': 'allow',
  '~/.config/opencode/agents/fuska/*': 'allow',
};

const CLAUDE_FUSKA_PERMISSIONS: string[] = [
  'Read(~/.claude/fuska/**)',
  'Read(~/.claude/skills/fuska*/**)',
  'Read(~/.claude/agents/fuska/**)',
];

async function updateOpenCodePermissions(projectRoot: string): Promise<void> {
  const opencodeDir = path.join(projectRoot, '.opencode');
  const jsonPath = path.join(opencodeDir, 'opencode.json');
  const jsoncPath = path.join(opencodeDir, 'opencode.jsonc');

  const useJson = await fs.pathExists(jsonPath);
  const targetPath = useJson ? jsonPath : jsoncPath;

  let content = '{}';
  if (await fs.pathExists(targetPath)) {
    content = await fs.readFile(targetPath, 'utf-8');
  }

  const config = jsonc.parse(content) as Record<string, unknown>;

  if (!config.permission) {
    config.permission = {};
  }
  if (!(config.permission as Record<string, unknown>).external_directory) {
    (config.permission as Record<string, unknown>).external_directory = {};
  }

  const externalDir = (config.permission as Record<string, unknown>).external_directory as Record<string, string>;
  let added = 0;

  for (const [key, value] of Object.entries(OPENCODE_FUSKA_PERMISSIONS)) {
    if (externalDir[key] !== value) {
      externalDir[key] = value;
      added++;
    }
  }

  if (added === 0) {
    console.log('  OpenCode permissions already configured');
    return;
  }

  await fs.ensureDir(opencodeDir);

  if (useJson || !(await fs.pathExists(targetPath))) {
    await fs.writeFile(targetPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  } else {
    const existingContent = await fs.readFile(targetPath, 'utf-8');
    const edits: jsonc.Edit[] = [];

    if (!jsonc.parse(existingContent).permission) {
      edits.push(...jsonc.modify(existingContent, ['permission'], {}, {}));
    }
    if (!jsonc.parse(existingContent).permission?.external_directory) {
      edits.push(...jsonc.modify(existingContent, ['permission', 'external_directory'], {}, {}));
    }

    for (const [key, value] of Object.entries(OPENCODE_FUSKA_PERMISSIONS)) {
      const currentPath = ['permission', 'external_directory', key];
      edits.push(...jsonc.modify(existingContent, currentPath, value, {}));
    }

    if (edits.length > 0) {
      const newContent = jsonc.applyEdits(existingContent, edits);
      await fs.writeFile(targetPath, newContent, 'utf-8');
    }
  }

  console.log(`  Updated ${path.relative(projectRoot, targetPath)} with ${added} fuska permission(s)`);
}

async function updateClaudePermissions(projectRoot: string): Promise<void> {
  const claudeDir = path.join(projectRoot, '.claude');
  const settingsPath = path.join(claudeDir, 'settings.json');

  let config: Record<string, unknown> = {};

  if (await fs.pathExists(settingsPath)) {
    const content = await fs.readFile(settingsPath, 'utf-8');
    config = jsonc.parse(content) as Record<string, unknown>;
  }

  if (!config.permissions) {
    config.permissions = {};
  }
  if (!(config.permissions as Record<string, unknown>).allow) {
    (config.permissions as Record<string, unknown>).allow = [];
  }

  const allowList = (config.permissions as Record<string, unknown>).allow as string[];
  let added = 0;

  for (const permission of CLAUDE_FUSKA_PERMISSIONS) {
    if (!allowList.includes(permission)) {
      allowList.push(permission);
      added++;
    }
  }

  if (added === 0) {
    console.log('  Claude permissions already configured');
    return;
  }

  await fs.ensureDir(claudeDir);
  await fs.writeFile(settingsPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  console.log(`  Updated ${path.relative(projectRoot, settingsPath)} with ${added} fuska permission(s)`);
}

async function updatePermissions(projectRoot: string, provider: ProviderType): Promise<void> {
  if (provider === 'opencode') {
    await updateOpenCodePermissions(projectRoot);
  } else {
    await updateClaudePermissions(projectRoot);
  }
}

class InitRunner {
  private projectDir: string;
  private db: any;

  constructor(options: { projectDir: string }) {
    this.projectDir = options.projectDir;
  }

  async run(description: string | undefined, options: { map?: boolean; permissionsOnly?: boolean }): Promise<void> {
    const config = await readProviderConfig();

    if (options.permissionsOnly) {
      if (!config) {
        console.error('Error: No provider configured. Run `fuska install` first.');
        process.exit(1);
      }
      console.log(`Updating ${config.provider} permissions...`);
      await updatePermissions(this.projectDir, config.provider);
      if (config.provider === 'claude') {
        await this.ensureClaudePermissions();
      }
      return;
    }

    if (await this.isAlreadyInitialized()) {
      this.printAlreadyInitialized();
      return;
    }

    await this.ensureGitRepo();

    try {
      await this.createMegaMemory();
      await this.createInitiative(description);
    } catch (err: any) {
      this.handleMegaMemoryError(err);
      process.exit(1);
    }

    await this.ensureMegaMemoryMcp();

    if (config) {
      console.log('\nUpdating local permissions...');
      await updatePermissions(this.projectDir, config.provider);
    }

    if (options.map !== false) {
      await this.runCodeMapping();
      this.printNextSteps(false);
    } else {
      this.printNextSteps(true);
    }
  }

  private handleMegaMemoryError(err: any): void {
    const message = err?.message || String(err);

    console.error('');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(' MEGAMEMORY ERROR');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('');
    console.error(`Failed to initialize MegaMemory: ${message}`);
    console.error('');
    console.error('To fix:');
    console.error('  1. Ensure MegaMemory is installed: npm install -g megamemory');
    console.error('  2. Check the database is not locked by another process');
    console.error('  3. Run fuska init again');
    console.error('');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  private async isAlreadyInitialized(): Promise<boolean> {
    const resolvedPath = path.resolve(this.projectDir);
    const dbPath = path.join(resolvedPath, '.megamemory', 'knowledge.db');

    if (!await fs.pathExists(dbPath)) {
      return false;
    }

    try {
      const { KnowledgeDB } = await import('megamemory/dist/db.js');
      this.db = new KnowledgeDB(dbPath);

      return !!findInitiativeBySlug(this.db, 'main');
    } catch (err: any) {
      this.handleMegaMemoryError(err);
      process.exit(1);
    }
  }

  private async ensureGitRepo(): Promise<void> {
    const gitPath = path.join(this.projectDir, '.git');
    
    if (await fs.pathExists(gitPath)) {
      return;
    }

    try {
      execSync('git init', { cwd: this.projectDir, stdio: 'pipe' });
    } catch {
      console.warn('Warning: Failed to initialize git repo, continuing...');
    }
  }

  private async createMegaMemory(): Promise<void> {
    const megamemoryPath = path.join(this.projectDir, '.megamemory');
    await fs.ensureDir(megamemoryPath);

    const { KnowledgeDB } = await import('megamemory/dist/db.js');
    this.db = new KnowledgeDB(path.join(megamemoryPath, 'knowledge.db'));
  }

  private async createInitiative(description: string | undefined): Promise<void> {
    const { createConcept } = await import('megamemory/dist/tools.js');
    const { InitiativeConceptTemplates } = await import('../scripts/initiative-templates');

    const slug = 'main';
    const name = 'Main';

    const rootConcept = {
      name: slug,
      kind: 'feature' as const,
      summary: `Initiative: ${name}\n\n${description || ''}`,
      why: '',
      parent_id: undefined,
      edges: []
    };
    await createConcept(this.db, rootConcept);

    const stateConcept = InitiativeConceptTemplates.createState(slug, {
      current_phase: '',
      current_plan: null,
      status: 'initialized',
      progress: 0,
      last_activity: new Date().toISOString()
    } as any);
    await createConcept(this.db, this.convertParentId(stateConcept));

    const roadmapModule = InitiativeConceptTemplates.createRoadmapModule(slug);
    await createConcept(this.db, this.convertParentId(roadmapModule));

    const milestonesModule = InitiativeConceptTemplates.createMilestonesModule(slug);
    await createConcept(this.db, this.convertParentId(milestonesModule));

    const todosModule = InitiativeConceptTemplates.createTodosModule(slug);
    await createConcept(this.db, this.convertParentId(todosModule));

    const researchModule = InitiativeConceptTemplates.createResearchModule(slug);
    await createConcept(this.db, this.convertParentId(researchModule));

    await this.createOrUpdateConfig(slug);

    console.log(`\nCreated initiative: ${name}`);
  }

  private convertParentId(concept: any): any {
    return {
      ...concept,
      parent_id: concept.parent_id === null ? undefined : concept.parent_id
    };
  }

  private async createOrUpdateConfig(initiativeSlug: string): Promise<void> {
    const { createConcept } = await import('megamemory/dist/tools.js');

    await createConcept(this.db, {
      name: 'config',
      kind: 'config',
      summary: JSON.stringify({
        current_initiative: initiativeSlug
      }),
      parent_id: undefined,
      edges: []
    });
  }

  private async ensureMegaMemoryMcp(): Promise<void> {
    const config = await readProviderConfig();
    if (!config) {
      console.log('  Hint: Run `fuska install` first to configure a provider, then `megamemory install --target <claudecode|opencode>` to register MegaMemory as an MCP server.');
      return;
    }

    const target = config.provider === 'claude' ? 'claudecode' : 'opencode';

    try {
      execSync(`megamemory install --target ${target}`, { cwd: this.projectDir, stdio: 'pipe' });
      console.log(`MegaMemory MCP configured for ${config.provider}`);
    } catch {
      console.warn(`Warning: Failed to run megamemory install --target ${target}. Run it manually to enable MCP integration.`);
    }

    if (config.provider === 'claude') {
      await this.ensureClaudePermissions();
    }
  }

  private async ensureClaudePermissions(): Promise<void> {
    const settingsPath = path.join(this.projectDir, '.claude', 'settings.local.json');
    let settings: any = {};

    if (await fs.pathExists(settingsPath)) {
      try {
        const content = await fs.readFile(settingsPath, 'utf-8');
        settings = JSON.parse(content);
      } catch {
        settings = {};
      }
    }

    if (!settings.permissions) {
      settings.permissions = {};
    }
    if (!Array.isArray(settings.permissions.allow)) {
      settings.permissions.allow = [];
    }

    const rule = 'mcp__megamemory';
    if (!settings.permissions.allow.includes(rule)) {
      settings.permissions.allow.push(rule);
    }

    await fs.ensureDir(path.dirname(settingsPath));
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  }

  private async runCodeMapping(): Promise<void> {
    try {
      await runOpenCodeJson({
        command: '/fuska-map-codebase',
        args: [],
        progressLabel: 'Mapping codebase'
      });
    } catch (err: any) {
      console.warn(`Warning: Code mapping failed: ${err.message}`);
    }
  }

  private printAlreadyInitialized(): void {
    console.log('\nAlready initialized: "main" initiative exists.\n');
    console.log('Manage initiatives:');
    console.log('  fuska initiative list       List all initiatives');
    console.log('  fuska initiative switch     Switch to a different initiative');
    console.log('  fuska progress              View current status');
    console.log('\nConfigure current initiative:');
    console.log('  opencode → /fuska-configure');
  }

  private printNextSteps(noMap: boolean): void {
    console.log();
    if (noMap) {
      console.log('  fuska map                 Run codebase analysis later');
    }
    console.log('\nMegaMemory MCP: registered automatically (or run `megamemory install --target claudecode|opencode` manually).');
    console.log('Next: Run `opencode` then `/fuska-configure` to complete setup.');
  }
}

export function initCommand(program: Command) {
  program
    .command('init [description...]')
    .description('Initialize current directory with a "main" initiative')
    .option('--no-map', 'Skip codebase mapping (run "fuska map" later)')
    .option('--permissions-only', 'Only update local permissions for the configured provider')
    .action(async (descriptionParts: string[] | undefined, options: { map?: boolean; permissionsOnly?: boolean }) => {
      const description = descriptionParts?.join(' ');
      const runner = new InitRunner({
        projectDir: process.cwd()
      });
      await runner.run(description, options);
    });
}
