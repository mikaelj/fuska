import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import { execSync } from 'child_process';
import { runOpenCodeJson } from './utils/json-output';
import { findInitiativeBySlug } from './utils/initiative-utils';
import { readProviderConfig } from './utils/provider-config';

class InitRunner {
  private projectDir: string;
  private db: any;

  constructor(options: { projectDir: string }) {
    this.projectDir = options.projectDir;
  }

  async run(description: string | undefined, options: { noMap?: boolean }): Promise<void> {
    if (await this.isAlreadyInitialized()) {
      this.printAlreadyInitialized();
      return;
    }

    await this.ensureGitRepo();
    await this.createMegaMemory();
    await this.createInitiative(description);
    await this.ensureMegaMemoryMcp();

    if (!options.noMap) {
      await this.runCodeMapping();
      this.printNextSteps(false);
    } else {
      this.printNextSteps(true);
    }
  }

  private async isAlreadyInitialized(): Promise<boolean> {
    const resolvedPath = path.resolve(this.projectDir);
    const dbPath = path.join(resolvedPath, '.megamemory', 'knowledge.db');

    if (!await fs.pathExists(dbPath)) {
      return false;
    }

    const { KnowledgeDB } = await import('megamemory/dist/db.js');
    this.db = new KnowledgeDB(dbPath);

    return !!findInitiativeBySlug(this.db, 'main');
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
    this.db = new KnowledgeDB(megamemoryPath);
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
    console.log('  fuska initiatives         List all initiatives');
    console.log('  fuska initiative-switch   Switch to a different initiative');
    console.log('  fuska progress            View current status');
    console.log('\nConfigure current initiative:');
    console.log('  opencode → /fuska-configure-initiative');
  }

  private printNextSteps(noMap: boolean): void {
    console.log();
    if (noMap) {
      console.log('  fuska map                 Run codebase analysis later');
    }
    console.log('\nMegaMemory MCP: registered automatically (or run `megamemory install --target claudecode|opencode` manually).');
    console.log('Next: Run `opencode` then `/fuska-configure-initiative` to complete setup.');
  }
}

export function initCommand(program: Command) {
  program
    .command('init [description...]')
    .description('Initialize current directory with a "main" initiative')
    .option('--no-map', 'Skip codebase mapping (run "fuska map" later)')
    .action(async (descriptionParts: string[] | undefined, options: { noMap?: boolean }) => {
      const description = descriptionParts?.join(' ');
      const runner = new InitRunner({
        projectDir: process.cwd()
      });
      await runner.run(description, options);
    });
}
