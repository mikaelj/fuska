import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';

interface NodeData {
  id: string;
  name: string;
  kind: string;
  summary: string;
  parent_id: string | null;
}

class MigrateMultiInitiativeRunner {
  private projectDir: string;
  private db: any;

  constructor(options: { projectDir: string }) {
    this.projectDir = options.projectDir;
  }

  async run(): Promise<void> {
    await this.preflightCheck();
    await this.migrate();
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

  private async migrate(): Promise<void> {
    console.log('Migrating to multi-initiative support...\n');

    const nodes = this.db.getAllActiveNodes();
    
    const initiativeRoot = this.findInitiativeRoot(nodes);
    if (!initiativeRoot) {
      console.log('No initiative root found. Nothing to migrate.');
      return;
    }

    const initiativeSlug = initiativeRoot.name;
    const initiativeName = this.extractName(initiativeRoot);
    
    console.log(`Found initiative: ${initiativeSlug}`);
    console.log(`  Name: ${initiativeName}`);

    const configNode = nodes.find((n: NodeData) => n.name === 'config');
    if (!configNode) {
      console.log('Creating config with current_initiative...');
      await this.createConfigWithInitiative(initiativeSlug);
    } else {
      console.log('Updating config with current_initiative...');
      await this.updateConfigWithInitiative(configNode, initiativeSlug);
    }

    if (!this.hasNameField(initiativeRoot)) {
      console.log('Adding name field to initiative root...');
      await this.addNameToInitiative(initiativeRoot, initiativeName);
    }

    console.log('\nMigration complete!');
    console.log(`Current initiative set to: ${initiativeSlug}`);
  }

  private findInitiativeRoot(nodes: NodeData[]): NodeData | null {
    const candidates = nodes.filter((n: NodeData) => {
      if (n.parent_id !== null) return false;
      if (n.kind === 'config' || n.kind === 'component' || n.kind === 'domain') return false;
      if (n.name.startsWith('task-')) return false;
      if (n.name.includes('command') || n.name.endsWith('-cmd') || n.name.includes('cli')) return false;
      if (n.name === 'git-message-megamemory-integration') return false;
      
      return n.kind === 'feature';
    });

    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    const withInitiativeChildren = candidates.filter((n: NodeData) => {
      const children = nodes.filter((child: NodeData) => child.parent_id?.includes(n.name));
      return children.some((c: NodeData) => 
        c.name === 'state' || 
        c.name === 'roadmap' || 
        c.name === 'config' ||
        c.name.startsWith('phase-') ||
        c.name === 'milestones'
      );
    });

    return withInitiativeChildren.length > 0 ? withInitiativeChildren[0] : candidates[0];
  }

  private extractName(node: NodeData): string {
    try {
      const summary = JSON.parse(node.summary);
      if (summary.name) return summary.name;
      if (summary.initiative_name) return summary.initiative_name;
    } catch {}
    
    return node.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  private hasNameField(node: NodeData): boolean {
    try {
      const summary = JSON.parse(node.summary);
      return !!summary.name;
    } catch {
      return false;
    }
  }

  private async createConfigWithInitiative(initiativeSlug: string): Promise<void> {
    const { createConcept } = await import('megamemory/dist/tools.js');
    
    const configSummary = JSON.stringify({
      depth: 'balanced',
      autonomous_mode: false,
      current_initiative: initiativeSlug
    });

    await createConcept(this.db, {
      name: 'config',
      kind: 'config',
      summary: configSummary,
      parent_id: undefined,
      edges: [],
      why: undefined
    });
  }

  private async updateConfigWithInitiative(configNode: NodeData, initiativeSlug: string): Promise<void> {
    const { updateConcept } = await import('megamemory/dist/tools.js');
    
    let configData: any = {};
    try {
      configData = JSON.parse(configNode.summary);
    } catch {}

    if (configData.current_initiative) {
      console.log(`  Config already has current_initiative: ${configData.current_initiative}`);
      return;
    }

    if (configData.initiative_name) {
      delete configData.initiative_name;
    }

    configData.current_initiative = initiativeSlug;

    await updateConcept(this.db, {
      id: configNode.id,
      changes: { summary: JSON.stringify(configData) }
    });
  }

  private async addNameToInitiative(node: NodeData, name: string): Promise<void> {
    const { updateConcept } = await import('megamemory/dist/tools.js');
    
    let summaryData: any = {};
    try {
      summaryData = JSON.parse(node.summary);
    } catch {
      summaryData = {};
    }

    if (!summaryData.name) {
      summaryData.name = name;
    }

    await updateConcept(this.db, {
      id: node.id,
      changes: { summary: JSON.stringify(summaryData) }
    });
  }
}

export function migrateMultiInitiativeCommand(program: Command) {
  program
    .command('migrate-multi-initiative [project-path]')
    .description('Migrate existing initiative to multi-initiative support (adds current_initiative to config)')
    .action(async (projectPath?: string) => {
      const runner = new MigrateMultiInitiativeRunner({
        projectDir: projectPath || process.cwd()
      });
      await runner.run();
    });
}
