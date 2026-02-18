import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import {
  findAllInitiatives,
  setCurrentInitiative,
  extractInitiativeName,
  NodeData,
} from './utils/initiative-utils';

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

    const initiatives = findAllInitiatives(this.db);

    if (initiatives.length === 0) {
      console.log('No initiative root found. Nothing to migrate.');
      return;
    }

    const initiative = initiatives[0];
    const initiativeSlug = initiative.slug;
    const initiativeName = initiative.name;

    console.log(`Found initiative: ${initiativeSlug}`);
    console.log(`  Name: ${initiativeName}`);

    if (initiative.isCurrent) {
      console.log(`  Config already has current_initiative: ${initiativeSlug}`);
    } else {
      console.log('Setting current_initiative in config...');
      await setCurrentInitiative(this.db, initiativeSlug);
    }

    if (!this.hasNameField(initiative.node)) {
      console.log('Adding name field to initiative root...');
      await this.addNameToInitiative(initiative.node, initiativeName);
    }

    console.log('\nMigration complete!');
    console.log(`Current initiative set to: ${initiativeSlug}`);
  }

  private hasNameField(node: NodeData): boolean {
    try {
      const summary = JSON.parse(node.summary);
      return !!summary.name;
    } catch {
      return false;
    }
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
    .command('multi-initiative [project-path]')
    .description('Migrate existing initiative to multi-initiative support (adds current_initiative to config)')
    .action(async (projectPath?: string) => {
      const runner = new MigrateMultiInitiativeRunner({
        projectDir: projectPath || process.cwd()
      });
      await runner.run();
    });
}
