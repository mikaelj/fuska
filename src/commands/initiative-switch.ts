import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import inquirer from 'inquirer';
import {
  findAllInitiatives,
  setCurrentInitiative,
  InitiativeInfo,
} from './utils/initiative-utils';

class InitiativeSwitchRunner {
  private projectDir: string;
  private db: any;

  constructor(options: { projectDir: string }) {
    this.projectDir = options.projectDir;
  }

  async run(targetSlug?: string): Promise<void> {
    await this.preflightCheck();

    const initiatives = findAllInitiatives(this.db);

    if (initiatives.length === 0) {
      console.log('No initiatives found. Use /fuska-configure-initiative to create one.');
      return;
    }

    if (!targetSlug) {
      const selected = await this.selectInitiative(initiatives);
      if (!selected) return;
      targetSlug = selected;
    }

    const target = initiatives.find(i => i.slug === targetSlug);
    if (!target) {
      console.log(`Initiative '${targetSlug}' not found.`);
      return;
    }

    await setCurrentInitiative(this.db, targetSlug);

    console.log(`\nSwitched to initiative: ${target.name} (${targetSlug})`);
  }

  private async preflightCheck(): Promise<void> {
    const resolvedPath = path.resolve(this.projectDir);
    const dbPath = path.join(resolvedPath, '.megamemory', 'knowledge.db');

    if (!await fs.pathExists(dbPath)) {
      console.error(`No .megamemory/knowledge.db found at ${resolvedPath}`);
      console.error('Run /fuska-configure-initiative first.');
      process.exit(1);
    }

    const { KnowledgeDB } = await import('megamemory/dist/db.js');
    this.db = new KnowledgeDB(dbPath);
  }

  private async selectInitiative(initiatives: InitiativeInfo[]): Promise<string | null> {
    const choices = initiatives.map(i => {
      const marker = i.isCurrent ? ' [current]' : '';

      return {
        name: `${i.name} (${i.slug})${marker}`,
        value: i.slug
      };
    });

    const { slug } = await inquirer.prompt([{
      type: 'list',
      name: 'slug',
      message: 'Select initiative to switch to:',
      choices
    }]);

    return slug;
  }
}

export function initiativeSwitchCommand(program: Command) {
  program
    .command('switch [slug]')
    .description('Switch to a different initiative')
    .action(async (slug?: string) => {
      const runner = new InitiativeSwitchRunner({
        projectDir: process.cwd()
      });
      await runner.run(slug);
    });
}
