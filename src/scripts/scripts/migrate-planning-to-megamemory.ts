#!/usr/bin/env ts-node

import * as fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';
import { InitiativeData } from '../types';
import { InitiativeConceptTemplates } from '../initiative-templates';
import { ChapterConceptTemplates as ChapterTemplates } from '../chapter-templates';
import { extractJson } from '../helpers';
import { KnowledgeDB } from 'megamemory/dist/db.js';
import { understand, createConcept, updateConcept, link, removeConcept, listRoots, makeId } from 'megamemory/dist/tools.js';
import type { RelationType } from 'megamemory/dist/types.js';

interface MegaMemoryClient {
  understand(query: {query: string; top_k?: number}): Promise<{matches: any[]}>;
  create_concept(concept: any): Promise<{id: string; concept: any}>;
  update_concept(params: {id: string; changes: any}): Promise<{success: boolean}>;
  remove_concept(params: {id: string; reason?: string}): Promise<{success: boolean}>;
  link(params: {from: string; to: string; relation: string}): Promise<{success: boolean}>;
  list_roots(): Promise<{roots: any[]}>;
}

interface PlanningFiles {
  project: string | null;
  requirements: string | null;
  roadmap: string | null;
  state: string | null;
  milestones: string | null;
  milestoneRoadmaps: Map<string, string>;
  config: any;
  chapters: Map<string, ChapterFiles>;
  research: Map<string, string>;
  todos: string[];
}

interface ChapterFiles {
  context: string | null;
  plans: Map<number, string>;
  research: string | null;
  summaries: Map<number, string>;
  uat: string | null;
}

class PlanningToMegaMemoryMigration {
  private projectDir: string;
  private planningDir: string;
  private megamemory!: MegaMemoryClient;
  private clean: boolean;
  private stats = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    yamlErrors: 0,
    duplicateKeysRemoved: 0,
    escapeSequencesFixed: 0,
    backticksQuoted: 0,
    atSymbolsQuoted: 0,
    embeddedQuotesFixed: 0,
    skippedDirectories: 0,
    chaptersMerged: 0
  };

  private deduplicateYamlKeys(content: string): { content: string; duplicates: number } {
    const yamlStart = content.indexOf('---');
    const yamlEnd = content.indexOf('---', yamlStart + 3);
    if (yamlStart === -1 || yamlEnd === -1) return { content, duplicates: 0 };

    const yamlEndFull = yamlEnd + 3; // Include the closing '---'
    let yamlContent = content.substring(yamlStart + 3, yamlEnd);
    const lines = yamlContent.split('\n');
    const seenKeys = new Map<string, number>();
    let duplicatesRemoved = 0;

    lines.forEach((line, i) => {
      const keyMatch = line.match(/^(\s*)(\w+):/);
      if (keyMatch) {
        const indent = keyMatch[1];
        const key = keyMatch[2];
        const context = `${indent}${key}`;
        if (seenKeys.has(context)) {
          duplicatesRemoved++;
          lines[i] = '';
        } else {
          seenKeys.set(context, i);
        }
      }
    });

    const beforeYaml = content.substring(0, yamlStart);
    const afterYaml = content.substring(yamlEndFull);
    const cleanedYaml = lines.filter(l => l !== '').join('\n');
    // Ensure proper spacing around delimiters
    const newContent = `${beforeYaml}---\n${cleanedYaml}\n---\n${afterYaml}`;
    return { content: newContent, duplicates: duplicatesRemoved };
  }

  private fixEscapeSequences(content: string): string {
    let fixed = 0;
    const newContent = content.replace(/"([^"]*)\\([.sSrnt0efxvuclLDd])([^"]*)"/g, (match, prefix, escaped, suffix) => {
      fixed++;
      return `"${prefix}\\\\${escaped}${suffix}"`;
    });
    this.stats.escapeSequencesFixed += fixed;
    return newContent;
  }

  private quoteListItemsWithBackticks(content: string): string {
    let quoted = 0;
    // Quote entire list items if they contain backticks and aren't already quoted
    const newContent = content.replace(/^(\s+-\s+)(.+)$/gm, (match, prefix, item) => {
      if (item.includes('`') && !item.startsWith('"') && !item.startsWith("'")) {
        quoted++;
        const escaped = item.replace(/'/g, "''");
        return `${prefix}'${escaped}'`;
      }
      return match;
    });
    this.stats.backticksQuoted += quoted;
    return newContent;
  }

  private quoteAtSymbols(content: string): string {
    let quoted = 0;
    // Quote list items that contain @ symbol and aren't already quoted
    const newContent = content.replace(/^(\s+-\s+)(.+)$/gm, (match, prefix, item) => {
      if (item.includes('@') && !item.startsWith('"') && !item.startsWith("'")) {
        quoted++;
        const escaped = item.replace(/'/g, "''");
        return `${prefix}'${escaped}'`;
      }
      return match;
    });
    this.stats.atSymbolsQuoted += quoted;
    return newContent;
  }

  private quoteEmbeddedDoubleQuotes(content: string): string {
    let quoted = 0;
    // Handle list items where embedded double quotes confuse the YAML parser
    // e.g. `- "Keep selected" button to confirm...` where "Keep selected" is NOT meant to quote the whole value
    const newContent = content.replace(/^(\s+-\s+)(.+)$/gm, (match, prefix, item) => {
      // Skip items already properly wrapped in quotes (entire value is one quoted string)
      if (item.startsWith('"') && item.endsWith('"') && item.indexOf('"', 1) === item.length - 1) {
        return match;
      }
      if (item.startsWith("'") && item.endsWith("'")) {
        return match;
      }

      // If item contains double quotes but isn't properly wrapped, wrap in single quotes
      if (item.includes('"')) {
        quoted++;
        const escaped = item.replace(/'/g, "''");
        return `${prefix}'${escaped}'`;
      }
      return match;
    });
    this.stats.embeddedQuotesFixed = (this.stats.embeddedQuotesFixed || 0) + quoted;
    return newContent;
  }

  private cleanYamlContent(content: string, filename: string): string {
    try {
      // First try to parse as-is
      matter(content);
      return content;
    } catch (e: any) {
      // Only apply fixes if initial parse fails
      console.log(`YAML parse error in ${filename}, applying fixes: ${e.message.substring(0, 100)}`);

      let cleaned = content;
      let currentDups = 0;

      // Apply fixes in order
      const dedupResult = this.deduplicateYamlKeys(cleaned);
      cleaned = dedupResult.content;
      this.stats.duplicateKeysRemoved += dedupResult.duplicates;
      currentDups += dedupResult.duplicates;

      cleaned = this.fixEscapeSequences(cleaned);
      cleaned = this.quoteListItemsWithBackticks(cleaned);
      cleaned = this.quoteAtSymbols(cleaned);

      if (currentDups > 0) {
        console.log(`  - Removed ${currentDups} duplicate keys`);
      }

      // Verify initial fixes worked
      try {
        matter(cleaned);
        return cleaned;
      } catch (e2: any) {
        // Apply additional fixes for embedded double quotes
        console.log(`  - Still failing, applying embedded quote fixes: ${e2.message.substring(0, 100)}`);
        cleaned = this.quoteEmbeddedDoubleQuotes(cleaned);

        try {
          matter(cleaned);
          return cleaned;
        } catch (e3: any) {
          // Return best effort - caller will handle the parse error
          console.log(`  - YAML still invalid after all fixes: ${e3.message.substring(0, 100)}`);
          return cleaned;
        }
      }
    }
  }

  constructor(projectDir: string, private megamemoryPath: string = '.megamemory', clean: boolean = false) {
    this.projectDir = projectDir;
    this.planningDir = path.join(projectDir, '.planning');
    this.clean = clean;
  }

  private async createMegaMemoryClient(): Promise<void> {
    const dbPath = path.isAbsolute(this.megamemoryPath)
      ? path.join(this.megamemoryPath, 'knowledge.db')
      : path.join(this.projectDir, this.megamemoryPath, 'knowledge.db');
    const db = new KnowledgeDB(dbPath);
    this.megamemory = {
      async understand(query: {query: string; top_k?: number}) {
        return await understand(db, query);
      },
      async create_concept(concept: any) {
        const result = await createConcept(db, concept);
        return { id: result.id, concept: { ...concept, id: result.id } };
      },
      async update_concept(params: {id: string; changes: any}) {
        await updateConcept(db, params);
        return { success: true };
      },
      async remove_concept(params: {id: string; reason?: string}) {
        removeConcept(db, { id: params.id, reason: params.reason || '' });
        return { success: true };
      },
      async link(params: {from: string; to: string; relation: string}) {
        link(db, { from: params.from, to: params.to, relation: params.relation as RelationType });
        return { success: true };
      },
      async list_roots() {
        return await listRoots(db);
      }
    };
  }

  private async cleanDatabase(): Promise<void> {
    const dbPath = path.isAbsolute(this.megamemoryPath)
      ? path.join(this.megamemoryPath, 'knowledge.db')
      : path.join(this.projectDir, this.megamemoryPath, 'knowledge.db');

    if (await fs.pathExists(dbPath)) {
      console.log('Cleaning existing database...');
      await fs.remove(dbPath);
      console.log('Database removed.\n');
    }
  }

  async migrate(): Promise<void> {
    console.log('Starting migration from .planning/ to MegaMemory...\n');

    try {
      if (this.clean) {
        await this.cleanDatabase();
      }
      await this.createMegaMemoryClient();
      await this.backupPlanningDir();

      const planningFiles = await this.readPlanningFiles();

      await this.migrateProject(planningFiles);
      await this.migrateChapters(planningFiles);
      await this.migrateResearch(planningFiles);
      await this.migrateTodos(planningFiles);

      await this.verifyMigration();
      this.reportStats();
    } catch (error) {
      console.error('\nMigration failed:', error);
      throw error;
    }
  }

  private async backupPlanningDir(): Promise<void> {
    const backupDir = path.join(path.dirname(this.planningDir), '.planning.backup');

    if (await fs.pathExists(backupDir)) {
      console.log('Backup already exists at .planning.backup');
      return;
    }

    console.log('Creating backup at .planning.backup...');
    await fs.copy(this.planningDir, backupDir);
    console.log('Backup created.\n');
  }

  private async readPlanningFiles(): Promise<PlanningFiles> {
    console.log('Reading .planning/ files...');

    const files: PlanningFiles = {
      project: null,
      requirements: null,
      roadmap: null,
      state: null,
      milestones: null,
      milestoneRoadmaps: new Map(),
      config: {},
      chapters: new Map(),
      research: new Map(),
      todos: []
    };

    const projectFile = path.join(this.planningDir, 'PROJECT.md');
    if (await fs.pathExists(projectFile)) {
      files.project = await fs.readFile(projectFile, 'utf-8');
    }

    const requirementsFile = path.join(this.planningDir, 'REQUIREMENTS.md');
    if (await fs.pathExists(requirementsFile)) {
      files.requirements = await fs.readFile(requirementsFile, 'utf-8');
    }

    const roadmapFile = path.join(this.planningDir, 'ROADMAP.md');
    if (await fs.pathExists(roadmapFile)) {
      files.roadmap = await fs.readFile(roadmapFile, 'utf-8');
    }

    const stateFile = path.join(this.planningDir, 'STATE.md');
    if (await fs.pathExists(stateFile)) {
      files.state = await fs.readFile(stateFile, 'utf-8');
    }

    const milestonesFile = path.join(this.planningDir, 'MILESTONES.md');
    if (await fs.pathExists(milestonesFile)) {
      files.milestones = await fs.readFile(milestonesFile, 'utf-8');
    }

    const milestoneDir = path.join(this.planningDir, 'milestones');
    if (await fs.pathExists(milestoneDir)) {
      const mfiles = await glob.glob('*ROADMAP.md', { cwd: milestoneDir, absolute: true });
      for (const file of mfiles) {
        const basename = path.basename(file);
        const name = basename.replace('-ROADMAP.md', '');
        files.milestoneRoadmaps.set(name, await fs.readFile(file, 'utf-8'));
      }
      console.log(`Read ${files.milestoneRoadmaps.size} milestone roadmap files`);
    }

    const configFile = path.join(this.planningDir, 'config.json');
    if (await fs.pathExists(configFile)) {
      files.config = await fs.readJson(configFile);
    }

    const phasesDir = path.join(this.planningDir, 'phases');
    if (await fs.pathExists(phasesDir)) {
      const chapterDirs = await fs.readdir(phasesDir);

      for (const chapterDir of chapterDirs) {
        const chapterPath = path.join(phasesDir, chapterDir);
        const stat = await fs.stat(chapterPath);

        if (stat.isDirectory()) {
          files.chapters.set(chapterDir, await this.readChapterFiles(chapterPath));
        }
      }
    }

    const researchDir = path.join(this.planningDir, 'research');
    if (await fs.pathExists(researchDir)) {
      const researchFiles = await glob.glob('*.md', { cwd: researchDir, absolute: true });
      for (const file of researchFiles) {
        const name = path.basename(file, '.md');
        files.research.set(name, await fs.readFile(file, 'utf-8'));
      }
    }

    const todosDir = path.join(this.planningDir, 'todos/pending');
    if (await fs.pathExists(todosDir)) {
      const todoFiles = await glob.glob('*.md', { cwd: todosDir, absolute: true });
      for (const file of todoFiles) {
        files.todos.push(await fs.readFile(file, 'utf-8'));
      }
    }

    console.log(`Read ${files.chapters.size} chapters, ${files.research.size} research docs, ${files.todos.length} todos\n`);
    return files;
  }

  private async readChapterFiles(phasePath: string): Promise<ChapterFiles> {
    const files: ChapterFiles = {
      context: null,
      plans: new Map(),
      research: null,
      summaries: new Map(),
      uat: null
    };

    const allFiles = await glob.glob('*.md', { cwd: phasePath, absolute: true });

    for (const file of allFiles) {
      const basename = path.basename(file);

      if (basename.endsWith('-CONTEXT.md')) {
        files.context = await fs.readFile(file, 'utf-8');
      } else if (basename.endsWith('-RESEARCH.md')) {
        files.research = await fs.readFile(file, 'utf-8');
      } else if (basename.endsWith('-UAT.md')) {
        files.uat = await fs.readFile(file, 'utf-8');
      } else if (basename.endsWith('-SUMMARY.md')) {
        const match = basename.match(/-(\d+)-SUMMARY\.md/);
        if (match) {
          files.summaries.set(parseInt(match[1]), await fs.readFile(file, 'utf-8'));
        }
      } else if (basename.endsWith('-PLAN.md')) {
        files.plans.set(1, await fs.readFile(file, 'utf-8'));
      } else {
        const match = basename.match(/-(\d+)-PLAN\.md/);
        if (match) {
          files.plans.set(parseInt(match[1]), await fs.readFile(file, 'utf-8'));
        }
      }
    }

    return files;
  }

  private mergeDuplicateChapters(chapters: Map<string, ChapterFiles>): Map<string, ChapterFiles> {
    const chapterNumberMap = new Map<number, string[]>();
    const merged = new Map<string, ChapterFiles>();

    // Group chapters by number
    for (const [dir, files] of chapters) {
      const match = dir.match(/^(\d+)-/);
      if (match) {
        const num = parseInt(match[1]);
        if (!chapterNumberMap.has(num)) {
          chapterNumberMap.set(num, []);
        }
        chapterNumberMap.get(num)!.push(dir);
      } else {
        merged.set(dir, files);  // Non-standard naming, keep as-is
      }
    }

    // Merge duplicates
    for (const [num, dirs] of chapterNumberMap) {
      if (dirs.length === 1) {
        merged.set(dirs[0], chapters.get(dirs[0])!);
      } else {
        // Merge chapters with same number
        console.log(`Merging ${dirs.length} chapters with number ${num}: ${dirs.join(', ')}`);
        this.stats.chaptersMerged++;
        const mergedFiles = this.mergeChapterFiles(
          dirs.map(d => chapters.get(d)!)
        );
        // Use first directory name for merged result
        merged.set(dirs[0], mergedFiles);
      }
    }

    return merged;
  }

  private mergeChapterFiles(chapterFiles: ChapterFiles[]): ChapterFiles {
    const merged: ChapterFiles = {
      context: null,
      plans: new Map(),
      research: null,
      summaries: new Map(),
      uat: null
    };

    for (const files of chapterFiles) {
      if (files.context) merged.context = files.context;
      if (files.research && !merged.research) merged.research = files.research;
      if (files.uat && !merged.uat) merged.uat = files.uat;

      // Merge all plans and summaries
      for (const [num, plan] of files.plans) {
        merged.plans.set(num, plan);
      }
      for (const [num, summary] of files.summaries) {
        merged.summaries.set(num, summary);
      }
    }

    return merged;
  }

  private async migrateProject(files: PlanningFiles): Promise<void> {
    console.log('Migrating project-level concepts...');

    const projectData = this.parseProjectFile(files.project, files.config);

    const projectRoot = InitiativeConceptTemplates.createInitiativeRoot(projectData);
    await this.createConcept(projectRoot);

    const requirementsModule = InitiativeConceptTemplates.createRequirementsModule(projectData.slug);
    await this.createConcept(requirementsModule);

    if (files.requirements) {
      const requirements = this.parseRequirementsFile(files.requirements);
      for (const req of requirements) {
        const concept = InitiativeConceptTemplates.createRequirement(
          projectData.slug,
          req.id,
          req.description,
          req.status
        );
        await this.createConcept(concept);
      }
    }

    const roadmapModule = InitiativeConceptTemplates.createRoadmapModule(projectData.slug);
    await this.createConcept(roadmapModule);

    const allChapters = new Map<number, any>();

    if (files.roadmap) {
      const roadmapChapters = this.parseRoadmapFile(files.roadmap);
      for (const chapter of roadmapChapters) {
        allChapters.set(chapter.number, chapter);
      }
    }

    for (const [name, content] of files.milestoneRoadmaps) {
      const roadmapChapters = this.parseRoadmapFile(content);
      for (const chapter of roadmapChapters) {
        if (!allChapters.has(chapter.number)) {
          allChapters.set(chapter.number, chapter);
        }
      }
    }

    for (const chapter of allChapters.values()) {
      const concept = InitiativeConceptTemplates.createChapter(
        projectData.slug,
        chapter.number,
        chapter.slug,
        chapter.name,
        chapter.goal
      );
      await this.createConcept(concept);
    }

    if (files.state) {
      const state = this.parseStateFile(files.state);
      const concept = InitiativeConceptTemplates.createState(projectData.slug, state);
      await this.createConcept(concept);
    }

    const config = InitiativeConceptTemplates.createConfig(files.config);
    await this.createConcept(config);

    if (files.milestones) {
      const milestonesModule = InitiativeConceptTemplates.createMilestonesModule(projectData.slug);
      await this.createConcept(milestonesModule);

      const milestones = this.parseMilestonesFile(files.milestones);
      for (const milestone of milestones) {
        const concept = InitiativeConceptTemplates.createMilestone(projectData.slug, milestone.name, milestone);
        await this.createConcept(concept);
      }
    }

    const todosModule = InitiativeConceptTemplates.createTodosModule(projectData.slug);
    await this.createConcept(todosModule);

    const researchModule = InitiativeConceptTemplates.createResearchModule(projectData.slug);
    await this.createConcept(researchModule);

    console.log('Project-level concepts migrated.\n');
  }

  private async migrateChapters(files: PlanningFiles): Promise<void> {
    console.log('Migrating chapter-level concepts...');

    const projectData = this.parseProjectFile(files.project, files.config);

    // Merge duplicate chapters before migrating
    const mergedChapters = this.mergeDuplicateChapters(files.chapters);

    // Track chapter numbers to detect duplicates
    const createdChapterNumbers = new Set<number>();

    // Chapter concepts are already created from roadmap in migrateProject()
    // Now create chapter-level child concepts (context, plans, research, summaries, UAT)
    for (const [chapterDir, chapterFiles] of mergedChapters) {
      // Skip directories that don't match the expected chapter format (NN-name)
      if (!/^\d+-.+/.test(chapterDir)) {
        console.log(`Skipping non-chapter directory: ${chapterDir}`);
        this.stats.skippedDirectories++;
        continue;
      }

      const chapterNum = parseInt(chapterDir.split('-')[0]);
      const chapterSuffix = chapterDir.substring(chapterDir.split('-')[0].length + 1);
      const chapterName = `chapter-${chapterNum}`;
      const chapterParentId = makeId(chapterName, `${projectData.slug}/roadmap`);

      // Check for duplicate chapter numbers
      if (createdChapterNumbers.has(chapterNum)) {
        console.warn(`Duplicate chapter number detected: ${chapterNum} (directory: ${chapterDir})`);
        console.warn(`  Using unique name: chapter-${chapterNum}-${chapterSuffix}`);
      }
      createdChapterNumbers.add(chapterNum);

      if (chapterFiles.context) {
        const contextData = this.parseContextFile(chapterFiles.context);
        const concept = ChapterTemplates.createContext(chapterName, contextData);
        concept.parent_id = chapterParentId;
        await this.createConcept(concept);
      }

      for (const [planNum, planContent] of chapterFiles.plans) {
        const planData = this.parsePlanFile(planContent);
        if (planData && Object.keys(planData).length > 0) {
          const concept = ChapterTemplates.createPlan(chapterName, planNum, planData);
          concept.parent_id = chapterParentId;
          concept.edges = [{ to: chapterParentId, relation: 'implements' as const }];
          await this.createConcept(concept);
        }
      }

      if (chapterFiles.research) {
        const researchData = this.parseResearchFile(chapterFiles.research);
        if (researchData && Object.keys(researchData).length > 0) {
          const concept = ChapterTemplates.createResearch(chapterName, researchData);
          concept.parent_id = chapterParentId;
          concept.edges = [{ to: chapterParentId, relation: 'connects_to' as const }];
          await this.createConcept(concept);
        }
      }

      for (const [summaryNum, summaryContent] of chapterFiles.summaries) {
        const summaryData = this.parseSummaryFile(summaryContent);
        if (summaryData && Object.keys(summaryData).length > 0) {
          const concept = ChapterTemplates.createSummary(chapterName, summaryNum, summaryData);
          concept.parent_id = chapterParentId;
          concept.edges = [
            { to: makeId(`${chapterName}-plan-${summaryNum}`, chapterParentId), relation: 'connects_to' as const },
            { to: chapterParentId, relation: 'connects_to' as const }
          ];
          await this.createConcept(concept);
        }
      }

      if (chapterFiles.uat) {
        const uatData = this.parseUATFile(chapterFiles.uat);
        if (uatData) {
          const concept = ChapterTemplates.createUAT(chapterName, uatData);
          concept.parent_id = chapterParentId;
          concept.edges = [
            { to: chapterParentId, relation: 'connects_to' as const },
            ...uatData.concepts_reviewed.map((c: string) => ({ to: c, relation: 'connects_to' as const }))
          ];
          await this.createConcept(concept);
        }
      }
    }

    console.log('Chapter-level concepts migrated.\n');
  }

  private async migrateResearch(files: PlanningFiles): Promise<void> {
    console.log('Migrating research documents...');

    const projectData = this.parseProjectFile(files.project, files.config);
    const researchParentId = makeId('research', projectData.slug);

    for (const [name, content] of files.research) {
      const researchData = this.parseResearchFile(content);
      const concept = {
        name: `research-${name}`,
        kind: 'pattern' as const,
        summary: content,
        parent_id: researchParentId,
        edges: [{ to: researchParentId, relation: 'connects_to' } as const]
      };
      await this.createConcept(concept);
    }

    console.log('Research documents migrated.\n');
  }

  private async migrateTodos(files: PlanningFiles): Promise<void> {
    console.log('Migrating todos...');

    const projectData = this.parseProjectFile(files.project, files.config);

    for (let i = 0; i < files.todos.length; i++) {
      const todoContent = files.todos[i];

      const frontmatterMatch = todoContent.match(/^---\n(.+?)\n---/s);
      let description = 'Todo';
      if (frontmatterMatch) {
        const titleMatch = frontmatterMatch[1].match(/^title:\s*(.+)$/m);
        if (titleMatch) {
          description = titleMatch[1].trim();
        }
      }

      if (description === 'Todo') {
        const markdownMatch = todoContent.match(/^#\s+(.+)$/m);
        if (markdownMatch) {
          description = markdownMatch[1];
        }
      }

      const chapterRefMatch = todoContent.match(/Chapter:\s+(.+)$/m);
      const chapterRef = chapterRefMatch ? chapterRefMatch[1] : undefined;

      const concept = InitiativeConceptTemplates.createTodo(projectData.slug, (i + 1).toString(), description, chapterRef);
      await this.createConcept(concept);
    }

    console.log('Todos migrated.\n');
  }

  private async createConcept(concept: any): Promise<void> {
    try {
      const result = await this.megamemory.create_concept(concept);
      this.stats.created++;
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        try {
          // Calculate the expected full ID using makeId
          const expectedId = makeId(concept.name, concept.parent_id);
          // Remove edges from changes to avoid parent reference issues
          const changesWithoutEdges = { ...concept };
          delete changesWithoutEdges.edges;
          await this.megamemory.update_concept({ id: expectedId, changes: changesWithoutEdges });
          this.stats.updated++;
        } catch (updateError: any) {
          console.error(`Error updating concept ${concept.name} (expected id: ${makeId(concept.name, concept.parent_id)}):`, updateError.message);
          this.stats.errors++;
        }
      } else if (error.message?.includes('does not exist') || error.message?.includes('not found')) {
        // Parent concept doesn't exist yet - will be created later, so skip for now
        // This can happen when phase-level concepts reference parents before they're created
        console.log(`Skipping concept ${concept.name} (parent: ${concept.parent_id} doesn't exist yet)`);
        this.stats.skipped++;
      } else {
        console.error(`Error creating concept ${concept.name}:`, error.message);
        this.stats.errors++;
      }
    }
  }

  private async verifyMigration(): Promise<void> {
    console.log('Verifying migration...');

    const roots = await this.megamemory.list_roots();
    console.log(`Found ${roots.roots.length} root concepts`);

    try {
      const stateResult = await this.megamemory.understand({ query: 'state' });
      if (stateResult.matches.length > 0) {
        console.log('State concept found');
      }
    } catch (error: any) {
      console.log('Note: Semantic search requires embeddings (generated by MegaMemory server)');
    }

    console.log('Verification complete.\n');
  }

  private reportStats(): void {
    console.log('=== Migration Statistics ===');
    console.log(`Created: ${this.stats.created}`);
    console.log(`Updated: ${this.stats.updated}`);
    console.log(`Skipped: ${this.stats.skipped}`);
    console.log(`Errors: ${this.stats.errors}`);
    if (this.stats.yamlErrors > 0 || this.stats.duplicateKeysRemoved > 0 ||
        this.stats.escapeSequencesFixed > 0 || this.stats.backticksQuoted > 0 ||
        this.stats.atSymbolsQuoted > 0 || this.stats.embeddedQuotesFixed > 0) {
      console.log('\n=== YAML Error Fixes ===');
      console.log(`Files with errors: ${this.stats.yamlErrors}`);
      console.log(`Duplicate keys removed: ${this.stats.duplicateKeysRemoved}`);
      console.log(`Escape sequences fixed: ${this.stats.escapeSequencesFixed}`);
      console.log(`Backticks quoted: ${this.stats.backticksQuoted}`);
      console.log(`@ symbols quoted: ${this.stats.atSymbolsQuoted}`);
      console.log(`Embedded quotes fixed: ${this.stats.embeddedQuotesFixed}`);
    }
    if (this.stats.skippedDirectories > 0) {
      console.log(`\nSkipped directories: ${this.stats.skippedDirectories}`);
    }
    if (this.stats.chaptersMerged > 0) {
      console.log(`\nPhases merged: ${this.stats.chaptersMerged}`);
    }
    console.log('============================\n');
  }

  private phaseDirToSlug(phaseDir: string): string {
    return phaseDir.toLowerCase().replace(/\s+/g, '-');
  }

  private parseProjectFile(content: string | null, config: any): InitiativeData {
    if (!content) {
      return {
        slug: 'project',
        name: 'Project',
        what_this_is: 'Project documentation',
        core_value: '',
        requirements: [],
        chapters: []
      };
    }

    const lines = content.split('\n');
    const data: InitiativeData = {
      slug: 'project',
      name: 'Project',
      what_this_is: '',
      core_value: '',
      requirements: [],
      chapters: []
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('# Project:')) {
        data.name = line.replace('# Project:', '').trim();
      } else if (line.startsWith('# ') && data.name === 'Project') {
        data.name = line.replace(/^#\s+/, '').trim();
      } else if (line.startsWith('## What This Is')) {
        data.what_this_is = lines[i + 1].trim();
      } else if (line.startsWith('## Core Value')) {
        data.core_value = lines[i + 1].trim();
      }
    }

    if (config && config.slug) {
      data.slug = config.slug;
    } else {
      data.slug = makeId(data.name, undefined);
    }

    return data;
  }

  private parseRequirementsFile(content: string): Array<{id: string; description: string; status: 'validated' | 'active' | 'out_of_scope'}> {
    const requirements: Array<{id: string; description: string; status: 'validated' | 'active' | 'out_of_scope'}> = [];
    const lines = content.split('\n');
    let currentStatus: 'validated' | 'active' | 'out_of_scope' = 'active';

    for (const line of lines) {
      if (line.startsWith('## ')) {
        const status = line.replace('## ', '').toLowerCase().trim();
        if (status === 'validated' || status === 'active' || status === 'out_of_scope') {
          currentStatus = status;
        }
      } else if (line.match(/^\d+\./)) {
        const match = line.match(/^(\d+)\.\s+(.+)$/);
        if (match) {
          requirements.push({
            id: match[1],
            description: match[2],
            status: currentStatus
          });
        }
      }
    }

    return requirements;
  }

  private parseRoadmapFile(content: string): Array<{number: number; slug: string; name: string; goal: string}> {
    const chapters: Array<{number: number; slug: string; name: string; goal: string}> = [];
    const lines = content.split('\n');

    for (const line of lines) {
      // Try "### Chapter N: Name" format first (also accepts old "### Phase N:" format)
      let match = line.match(/^### (?:Phase|Chapter) (\d+):\s+(.+)$/);
      if (!match) {
        // Try "- [x] Chapter N: Name" format (with or without checkmark)
        match = line.match(/^-\s+\[[x ]\]\s+(?:Phase|Chapter) (\d+):\s+(.+)$/);
      }

      if (match) {
        const num = parseInt(match[1]);
        chapters.push({
          number: num,
          slug: `chapter-${num.toString().padStart(2, '0')}`,
          name: match[2],
          goal: ''
        });
      }
    }

    return chapters;
  }

  private parseStateFile(content: string): any {
    return extractJson(content);
  }

  private parseMilestonesFile(content: string): Array<{name: string; status: 'shipped' | 'in_progress' | 'planned'; chapters: string[]; description: string}> {
    const milestones: Array<{name: string; status: 'shipped' | 'in_progress' | 'planned'; chapters: string[]; description: string}> = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const match = line.match(/^## (.+?)\s+\[(.+?)\]$/);
      if (match) {
        const status = match[2].toLowerCase().trim();
        let validStatus: 'shipped' | 'in_progress' | 'planned' = 'planned';
        if (status === 'shipped' || status === 'in_progress' || status === 'planned') {
          validStatus = status;
        }
        milestones.push({
          name: match[1],
          status: validStatus,
          chapters: [],
          description: ''
        });
      }
    }

    return milestones;
  }

  private parseContextFile(content: string): any {
    const cleaned = this.cleanYamlContent(content, 'context file');
    const parsed = matter(cleaned);
    return {
      chapter_boundary: parsed.data?.chapter_boundary || '',
      decisions: parsed.data?.decisions || {},
      open_code_discretion: parsed.data?.open_code_discretion || [],
      specifics: parsed.data?.specifics || [],
      deferred: parsed.data?.deferred || [],
      gathered: new Date().toISOString().split('T')[0]
    };
  }

  private parsePlanFile(content: string): any {
    try {
      const cleaned = this.cleanYamlContent(content, 'plan file');
      const parsed = matter(cleaned);
      return parsed.data || {};
    } catch (e: any) {
      this.stats.yamlErrors++;
      console.warn(`Failed to parse YAML in plan file: ${e.message}`);
      return {};
    }
  }

  private parseResearchFile(content: string): any {
    try {
      const cleaned = this.cleanYamlContent(content, 'research file');
      const parsed = matter(cleaned);
      return parsed.data || {};
    } catch (e: any) {
      this.stats.yamlErrors++;
      console.warn(`Failed to parse YAML in research file: ${e.message}`);
      return {};
    }
  }

  private parseSummaryFile(content: string): any {
    try {
      const cleaned = this.cleanYamlContent(content, 'summary file');
      const parsed = matter(cleaned);
      return parsed.data || {};
    } catch (e: any) {
      this.stats.yamlErrors++;
      console.warn(`Failed to parse YAML in summary file: ${e.message}`);
      return {};
    }
  }

  private parseUATFile(content: string): any {
    try {
      const cleaned = this.cleanYamlContent(content, 'UAT file');
      const parsed = matter(cleaned);
      const data = parsed.data || {};
      // Provide default values for missing required properties
      return {
        ...data,
        verification_results: Array.isArray(data.verification_results) ? data.verification_results : [],
        issues_found: Array.isArray(data.issues_found) ? data.issues_found : [],
        recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
        concepts_reviewed: Array.isArray(data.concepts_reviewed) ? data.concepts_reviewed : []
      };
    } catch (e: any) {
      this.stats.yamlErrors++;
      console.warn(`Failed to parse YAML in UAT file: ${e.message}`);
      return {
        verification_results: [],
        issues_found: [],
        recommendations: [],
        concepts_reviewed: []
      };
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const projectDir = args[0] || process.cwd();
  const clean = args.includes('--clean');

  console.log(`Migrating project at: ${projectDir}`);
  if (clean) {
    console.log('Clean mode: will delete existing database before migration\n');
  } else {
    console.log('');
  }

  const migration = new PlanningToMegaMemoryMigration(projectDir, '.megamemory', clean);

  try {
    await migration.migrate();
    console.log('Migration completed successfully!');
    console.log('\nTo rollback, restore from .planning.backup and remove .megamemory/knowledge.db');
  } catch (error) {
    console.error('\nMigration failed. Backup is available at .planning.backup');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
