import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import inquirer from 'inquirer';

interface NodeData {
  id: string;
  name: string;
  kind: string;
  summary: string;
  parent_id: string | null;
}

interface ConfigData {
  depth: string;
  autonomous_mode: boolean;
  current_initiative?: string | null;
}

class InitiativeNewRunner {
  private projectDir: string;
  private db: any;

  constructor(options: { projectDir: string }) {
    this.projectDir = options.projectDir;
  }

  async run(slug?: string, name?: string): Promise<void> {
    await this.preflightCheck();
    
    const config = await this.getConfig();
    
    if (config?.current_initiative) {
      const currentInitiative = await this.getInitiative(config.current_initiative);
      if (currentInitiative) {
        const currentName = this.extractName(currentInitiative);
        
        const { archive } = await inquirer.prompt([{
          type: 'confirm',
          name: 'archive',
          message: `Archive existing initiative '${currentName}' first?`,
          default: false
        }]);
        
        if (!archive) {
          console.log('Aborted. Use /fuska-initiative-switch to switch initiatives.');
          return;
        }
        
        await this.archiveInitiative(currentInitiative);
      }
    }

    if (!slug) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'slug',
          message: 'Initiative slug (e.g., push-notifications):',
          validate: (input) => /^[a-z0-9-]+$/.test(input) || 'Use lowercase letters, numbers, and hyphens only'
        }
      ]);
      slug = answers.slug;
    }

    if (!name) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Initiative display name:',
          default: slug!.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        }
      ]);
      name = answers.name;
    }

    await this.createInitiative(slug!, name!);
    await this.setCurrentInitiative(slug!);
    
    console.log(`\nCreated initiative: ${name} (${slug})`);
    console.log('Set as current initiative.');
  }

  private async preflightCheck(): Promise<void> {
    const resolvedPath = path.resolve(this.projectDir);
    const dbPath = path.join(resolvedPath, '.megamemory', 'knowledge.db');

    if (!await fs.pathExists(dbPath)) {
      console.error(`No .megamemory/knowledge.db found at ${resolvedPath}`);
      console.error('Run /fuska-new-initiative first.');
      process.exit(1);
    }

    const { KnowledgeDB } = await import('megamemory/dist/db.js');
    this.db = new KnowledgeDB(dbPath);
  }

  private async getConfig(): Promise<ConfigData | null> {
    const nodes = this.db.getAllActiveNodes();
    const configNode = nodes.find((n: NodeData) => n.name === 'config');
    
    if (!configNode) return null;
    
    try {
      return JSON.parse(configNode.summary);
    } catch {
      return null;
    }
  }

  private async getInitiative(slug: string): Promise<NodeData | null> {
    const nodes = this.db.getAllActiveNodes();
    return nodes.find((n: NodeData) => n.name === slug && n.parent_id === null) || null;
  }

  private extractName(node: NodeData): string {
    try {
      const summary = JSON.parse(node.summary);
      return summary.name || node.name;
    } catch {
      return node.name;
    }
  }

  private async archiveInitiative(node: NodeData): Promise<void> {
    const { updateConcept } = await import('megamemory/dist/tools.js');
    
    let summaryData: any = {};
    try {
      summaryData = JSON.parse(node.summary);
    } catch {}
    
    summaryData.archived_at = new Date().toISOString();
    
    await updateConcept(this.db, {
      id: node.id,
      changes: { summary: JSON.stringify(summaryData) }
    });
    
    console.log(`Archived initiative: ${this.extractName(node)}`);
  }

  private async createInitiative(slug: string, name: string): Promise<void> {
    const { createConcept } = await import('megamemory/dist/tools.js');
    const { InitiativeConceptTemplates } = await import('../scripts/initiative-templates');
    
    const initiativeData = {
      slug,
      name,
      what_this_is: '',
      core_value: '',
      requirements: [],
      phases: []
    };
    
    const rootConcept = InitiativeConceptTemplates.createInitiativeRoot(initiativeData);
    await createConcept(this.db, this.convertParentId(rootConcept));
    
    const roadmapModule = InitiativeConceptTemplates.createRoadmapModule(slug);
    await createConcept(this.db, this.convertParentId(roadmapModule));
    
    const stateConcept = InitiativeConceptTemplates.createState(slug, {
      current_phase: '',
      current_plan: null,
      status: 'initialized',
      progress: 0,
      last_activity: new Date().toISOString()
    } as any);
    await createConcept(this.db, this.convertParentId(stateConcept));
    
    const milestonesModule = InitiativeConceptTemplates.createMilestonesModule(slug);
    await createConcept(this.db, this.convertParentId(milestonesModule));
    
    const todosModule = InitiativeConceptTemplates.createTodosModule(slug);
    await createConcept(this.db, this.convertParentId(todosModule));
    
    const researchModule = InitiativeConceptTemplates.createResearchModule(slug);
    await createConcept(this.db, this.convertParentId(researchModule));
  }

  private convertParentId(concept: any): any {
    return {
      ...concept,
      parent_id: concept.parent_id === null ? undefined : concept.parent_id
    };
  }

  private async setCurrentInitiative(slug: string): Promise<void> {
    const { createConcept, updateConcept } = await import('megamemory/dist/tools.js');
    
    const nodes = this.db.getAllActiveNodes();
    const configNode = nodes.find((n: NodeData) => n.name === 'config');
    
    if (!configNode) {
      await createConcept(this.db, {
        name: 'config',
        kind: 'config',
        summary: JSON.stringify({
          depth: 'balanced',
          autonomous_mode: false,
          current_initiative: slug
        }),
        parent_id: undefined,
        edges: []
      });
    } else {
      let configData: any = {};
      try {
        configData = JSON.parse(configNode.summary);
      } catch {}
      
      configData.current_initiative = slug;
      
      await updateConcept(this.db, {
        id: configNode.id,
        changes: { summary: JSON.stringify(configData) }
      });
    }
  }
}

export function initiativeNewCommand(program: Command) {
  program
    .command('initiative-new [slug]')
    .description('Create a new initiative and set it as current')
    .option('-n, --name <name>', 'Display name for the initiative')
    .action(async (slug?: string, options?: { name?: string }) => {
      const runner = new InitiativeNewRunner({
        projectDir: process.cwd()
      });
      await runner.run(slug, options?.name);
    });
}
