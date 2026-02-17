import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import {
  findInitiativeBySlug,
  getCurrentInitiativeSlug,
  setCurrentInitiative,
  extractInitiativeName,
  NodeData,
} from './utils/initiative-utils';

class InitiativeArchiveRunner {
  private projectDir: string;
  private db: any;

  constructor(options: { projectDir: string }) {
    this.projectDir = options.projectDir;
  }

  async run(): Promise<void> {
    await this.preflightCheck();

    const currentSlug = getCurrentInitiativeSlug(this.db);

    if (!currentSlug) {
      console.log('No current initiative to archive.');
      return;
    }

    const initiative = findInitiativeBySlug(this.db, currentSlug);

    if (!initiative) {
      console.log(`Initiative '${currentSlug}' not found.`);
      return;
    }

    const name = initiative.name;

    await this.archiveInitiative(initiative.node);
    await setCurrentInitiative(this.db, null);

    console.log(`Archived initiative: ${name} (${currentSlug})`);
    console.log('No active initiative. Use /fuska-initiative-switch to activate another.');
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
  }
}

export function initiativeArchiveCommand(program: Command) {
  program
    .command('initiative-archive')
    .description('Archive the current initiative')
    .action(async () => {
      const runner = new InitiativeArchiveRunner({
        projectDir: process.cwd()
      });
      await runner.run();
    });
}
