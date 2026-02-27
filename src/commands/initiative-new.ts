import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import inquirer from 'inquirer';
import {
  findInitiativeBySlug,
  setCurrentInitiative,
} from './utils/initiative-utils';

class InitiativeNewRunner {
  private projectDir: string;
  private db: any;

  constructor(options: { projectDir: string }) {
    this.projectDir = options.projectDir;
  }

  async run(slug?: string, description?: string): Promise<void> {
    await this.preflightCheck();

    if (!slug) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'slug',
          message: 'Enter initiative slug:',
          validate: (input) => this.validateSlug(input)
        },
        {
          type: 'input',
          name: 'description',
          message: 'Description (optional):'
        }
      ]);
      slug = answers.slug;
      description = answers.description || undefined;
    } else {
      const error = this.validateSlug(slug);
      if (error !== true) {
        console.error(error);
        process.exit(1);
      }
    }

    if (!slug) {
      console.error('Slug is required.');
      process.exit(1);
    }

    const existing = findInitiativeBySlug(this.db, slug);
    if (existing) {
      console.error(`Initiative '${slug}' already exists.`);
      process.exit(1);
    }

    try {
      await this.createInitiative(slug, description);
    } catch (err: any) {
      this.handleMegaMemoryError(err);
      process.exit(1);
    }

    await setCurrentInitiative(this.db, slug);

    const name = this.slugToName(slug);
    console.log(`\nCreated initiative: ${name} (${slug})`);
    console.log(`Switched to initiative: ${slug}`);
    console.log('\nNext: Run `/fuska-configure` to complete setup.');
  }

  private validateSlug(slug: string): string | true {
    if (!slug || slug.trim().length === 0) {
      return 'Slug is required';
    }
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(slug)) {
      return 'Slug must be lowercase alphanumeric with hyphens (e.g., my-app, app2)';
    }
    return true;
  }

  private async preflightCheck(): Promise<void> {
    const resolvedPath = path.resolve(this.projectDir);
    const dbPath = path.join(resolvedPath, '.megamemory', 'knowledge.db');

    if (!await fs.pathExists(dbPath)) {
      console.error('No .megamemory found. Run `fuska init` first.');
      process.exit(1);
    }

    const { KnowledgeDB } = await import('megamemory/dist/db.js');
    this.db = new KnowledgeDB(dbPath);
  }

  private handleMegaMemoryError(err: any): void {
    const message = err?.message || String(err);
    console.error(`\nMegaMemory error: ${message}`);
  }

  private convertParentId(concept: any): any {
    return {
      ...concept,
      parent_id: concept.parent_id === null ? undefined : concept.parent_id
    };
  }

  private async createInitiative(slug: string, description: string | undefined): Promise<void> {
    const { createConcept } = await import('megamemory/dist/tools.js');
    const { InitiativeConceptTemplates } = await import('../scripts/initiative-templates');

    const name = this.slugToName(slug);

    const rootConcept = {
      name: slug,
      kind: 'feature' as const,
      summary: `Initiative: ${name}\n\n${description || ''}`,
      why: '',
      parent_id: null,
      edges: []
    };
    await createConcept(this.db, this.convertParentId(rootConcept));

    const stateConcept = InitiativeConceptTemplates.createState(slug, {
      current_chapter: '',
      current_plan: null,
      status: 'initialized',
      progress: 0,
      last_activity: new Date().toISOString()
    });
    await createConcept(this.db, this.convertParentId(stateConcept));

    const roadmapModule = InitiativeConceptTemplates.createRoadmapModule(slug);
    await createConcept(this.db, this.convertParentId(roadmapModule));

    const milestonesModule = InitiativeConceptTemplates.createMilestonesModule(slug);
    await createConcept(this.db, this.convertParentId(milestonesModule));

    const todosModule = InitiativeConceptTemplates.createTodosModule(slug);
    await createConcept(this.db, this.convertParentId(todosModule));

    const researchModule = InitiativeConceptTemplates.createResearchModule(slug);
    await createConcept(this.db, this.convertParentId(researchModule));
  }

  private slugToName(slug: string): string {
    return slug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

export function initiativeNewCommand(program: Command) {
  program
    .command('new [slug] [description...]')
    .description('Create a new initiative')
    .action(async (slug?: string, ...descriptionParts: string[]) => {
      const description = descriptionParts.length > 0 ? descriptionParts.join(' ') : undefined;
      const runner = new InitiativeNewRunner({ projectDir: process.cwd() });
      await runner.run(slug, description);
    });
}
