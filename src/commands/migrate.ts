import { Command } from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';

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
  phases: Map<string, PhaseFiles>;
  research: Map<string, string>;
  todos: string[];
}

interface PhaseFiles {
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
    phasesMerged: 0
  };

  constructor(projectDir: string, clean: boolean) {
    this.projectDir = projectDir;
    this.planningDir = path.join(projectDir, '.planning');
    this.clean = clean;
  }

  private deduplicateYamlKeys(content: string): { content: string; duplicates: number } {
    const yamlStart = content.indexOf('---');
    const yamlEnd = content.indexOf('---', yamlStart + 3);
    if (yamlStart === -1 || yamlEnd === -1) return { content, duplicates: 0 };

    const yamlEndFull = yamlEnd + 3;
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
    const newContent = content.replace(/^(\s+-\s+)(.+)$/gm, (match, prefix, item) => {
      if (item.startsWith('"') && item.endsWith('"') && item.indexOf('"', 1) === item.length - 1) {
        return match;
      }
      if (item.startsWith("'") && item.endsWith("'")) {
        return match;
      }
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
      matter(content);
      return content;
    } catch (e: any) {
      console.log(`YAML parse error in ${filename}, applying fixes: ${e.message.substring(0, 100)}`);

      let cleaned = content;
      let currentDups = 0;

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

      try {
        matter(cleaned);
        return cleaned;
      } catch (e2: any) {
        console.log(`  - Still failing, applying embedded quote fixes: ${e2.message.substring(0, 100)}`);
        cleaned = this.quoteEmbeddedDoubleQuotes(cleaned);

        try {
          matter(cleaned);
          return cleaned;
        } catch (e3: any) {
          console.log(`  - YAML still invalid after all fixes: ${e3.message.substring(0, 100)}`);
          return cleaned;
        }
      }
    }
  }

  private async createMegaMemoryClient(): Promise<void> {
    const megamemoryPath = path.join(this.projectDir, '.megamemory');
    const { KnowledgeDB } = await import('megamemory/dist/db.js');
    const { understand, createConcept, updateConcept, link, removeConcept, listRoots } = await import('megamemory/dist/tools.js');

    const db = new KnowledgeDB(megamemoryPath);
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
        link(db, { from: params.from, to: params.to, relation: params.relation as any });
        return { success: true };
      },
      async list_roots() {
        return await listRoots(db);
      }
    };
  }

  private async cleanDatabase(): Promise<void> {
    const dbPath = path.join(this.projectDir, '.megamemory', 'knowledge.db');

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
      await this.migratePhases(planningFiles);
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
      phases: new Map(),
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
      const mfiles = await glob('*ROADMAP.md', { cwd: milestoneDir, absolute: true });
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
      const phaseDirs = await fs.readdir(phasesDir);

      for (const phaseDir of phaseDirs) {
        const phasePath = path.join(phasesDir, phaseDir);
        const stat = await fs.stat(phasePath);

        if (stat.isDirectory()) {
          files.phases.set(phaseDir, await this.readPhaseFiles(phasePath));
        }
      }
    }

    const researchDir = path.join(this.planningDir, 'research');
    if (await fs.pathExists(researchDir)) {
      const researchFiles = await glob('*.md', { cwd: researchDir, absolute: true });
      for (const file of researchFiles) {
        const name = path.basename(file, '.md');
        files.research.set(name, await fs.readFile(file, 'utf-8'));
      }
    }

    const todosDir = path.join(this.planningDir, 'todos/pending');
    if (await fs.pathExists(todosDir)) {
      const todoFiles = await glob('*.md', { cwd: todosDir, absolute: true });
      for (const file of todoFiles) {
        files.todos.push(await fs.readFile(file, 'utf-8'));
      }
    }

    console.log(`Read ${files.phases.size} phases, ${files.research.size} research docs, ${files.todos.length} todos\n`);
    return files;
  }

  private async readPhaseFiles(phasePath: string): Promise<PhaseFiles> {
    const files: PhaseFiles = {
      context: null,
      plans: new Map(),
      research: null,
      summaries: new Map(),
      uat: null
    };

    const allFiles = await glob('*.md', { cwd: phasePath, absolute: true });

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

  private mergeDuplicatePhases(phases: Map<string, PhaseFiles>): Map<string, PhaseFiles> {
    const phaseNumberMap = new Map<number, string[]>();
    const merged = new Map<string, PhaseFiles>();

    for (const [dir, files] of phases) {
      const match = dir.match(/^(\d+)-/);
      if (match) {
        const num = parseInt(match[1]);
        if (!phaseNumberMap.has(num)) {
          phaseNumberMap.set(num, []);
        }
        phaseNumberMap.get(num)!.push(dir);
      } else {
        merged.set(dir, files);
      }
    }

    for (const [num, dirs] of phaseNumberMap) {
      if (dirs.length === 1) {
        merged.set(dirs[0], phases.get(dirs[0])!);
      } else {
        console.log(`Merging ${dirs.length} phases with number ${num}: ${dirs.join(', ')}`);
        this.stats.phasesMerged++;
        const mergedFiles = this.mergePhaseFiles(dirs.map(d => phases.get(d)!));
        merged.set(dirs[0], mergedFiles);
      }
    }

    return merged;
  }

  private mergePhaseFiles(phaseFiles: PhaseFiles[]): PhaseFiles {
    const merged: PhaseFiles = {
      context: null,
      plans: new Map(),
      research: null,
      summaries: new Map(),
      uat: null
    };

    for (const files of phaseFiles) {
      if (files.context) merged.context = files.context;
      if (files.research && !merged.research) merged.research = files.research;
      if (files.uat && !merged.uat) merged.uat = files.uat;

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

    const { InitiativeConceptTemplates } = await import('../scripts/initiative-templates');
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

    const allPhases = new Map<number, any>();

    if (files.roadmap) {
      const phases = this.parseRoadmapFile(files.roadmap);
      for (const phase of phases) {
        allPhases.set(phase.number, phase);
      }
    }

    for (const [name, content] of files.milestoneRoadmaps) {
      const phases = this.parseRoadmapFile(content);
      for (const phase of phases) {
        if (!allPhases.has(phase.number)) {
          allPhases.set(phase.number, phase);
        }
      }
    }

    for (const phase of allPhases.values()) {
      const concept = InitiativeConceptTemplates.createPhase(
        projectData.slug,
        phase.number,
        phase.slug,
        phase.name,
        phase.goal
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

    console.log('Initiative-level concepts migrated.\n');
  }

  private async migratePhases(files: PlanningFiles): Promise<void> {
    console.log('Migrating phase-level concepts...');

    const { InitiativeConceptTemplates } = await import('../scripts/initiative-templates');
    const { PhaseConceptTemplates } = await import('../scripts/phase-templates');
    const { makeId } = await import('megamemory/dist/tools.js');

    const projectData = this.parseProjectFile(files.project, files.config);

    const mergedPhases = this.mergeDuplicatePhases(files.phases);

    const createdPhaseNumbers = new Set<number>();

    for (const [phaseDir, phaseFiles] of mergedPhases) {
      if (!/^\d+-.+/.test(phaseDir)) {
        console.log(`Skipping non-phase directory: ${phaseDir}`);
        this.stats.skippedDirectories++;
        continue;
      }

      const phaseNum = parseInt(phaseDir.split('-')[0]);
      const phaseSuffix = phaseDir.substring(phaseDir.split('-')[0].length + 1);
      const phaseName = `phase-${phaseNum}`;
      const phaseParentId = makeId(phaseName, `${projectData.slug}/roadmap`);

      if (createdPhaseNumbers.has(phaseNum)) {
        console.warn(`Duplicate phase number detected: ${phaseNum} (directory: ${phaseDir})`);
        console.warn(`  Using unique name: phase-${phaseNum}-${phaseSuffix}`);
      }
      createdPhaseNumbers.add(phaseNum);

      if (phaseFiles.context) {
        const contextData = this.parseContextFile(phaseFiles.context);
        const concept = PhaseConceptTemplates.createContext(phaseName, contextData);
        concept.parent_id = phaseParentId;
        await this.createConcept(concept);
      }

      for (const [planNum, planContent] of phaseFiles.plans) {
        const planData = this.parsePlanFile(planContent);
        if (planData && Object.keys(planData).length > 0) {
          const concept = PhaseConceptTemplates.createPlan(phaseName, planNum, planData);
          concept.parent_id = phaseParentId;
          concept.edges = [{ to: phaseParentId, relation: 'implements' as const }];
          await this.createConcept(concept);
        }
      }

      if (phaseFiles.research) {
        const researchData = this.parseResearchFile(phaseFiles.research);
        if (researchData && Object.keys(researchData).length > 0) {
          const concept = PhaseConceptTemplates.createResearch(phaseName, researchData);
          concept.parent_id = phaseParentId;
          concept.edges = [{ to: phaseParentId, relation: 'connects_to' as const }];
          await this.createConcept(concept);
        }
      }

      for (const [summaryNum, summaryContent] of phaseFiles.summaries) {
        const summaryData = this.parseSummaryFile(summaryContent);
        if (summaryData && Object.keys(summaryData).length > 0) {
          const concept = PhaseConceptTemplates.createSummary(phaseName, summaryNum, summaryData);
          concept.parent_id = phaseParentId;
          concept.edges = [
            { to: makeId(`${phaseName}-plan-${summaryNum}`, phaseParentId), relation: 'connects_to' as const },
            { to: phaseParentId, relation: 'connects_to' as const }
          ];
          await this.createConcept(concept);
        }
      }

      if (phaseFiles.uat) {
        const uatData = this.parseUATFile(phaseFiles.uat);
        if (uatData) {
          const concept = PhaseConceptTemplates.createUAT(phaseName, uatData);
          concept.parent_id = phaseParentId;
          concept.edges = [
            { to: phaseParentId, relation: 'connects_to' as const },
            ...uatData.concepts_reviewed.map((c: string) => ({ to: c, relation: 'connects_to' as const }))
          ];
          await this.createConcept(concept);
        }
      }
    }

    console.log('Phase-level concepts migrated.\n');
  }

  private async migrateResearch(files: PlanningFiles): Promise<void> {
    console.log('Migrating research documents...');

    const { InitiativeConceptTemplates } = await import('../scripts/initiative-templates');
    const { makeId } = await import('megamemory/dist/tools.js');

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

    const { InitiativeConceptTemplates } = await import('../scripts/initiative-templates');

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

      const phaseRefMatch = todoContent.match(/Phase:\s+(.+)$/m);
      const phaseRef = phaseRefMatch ? phaseRefMatch[1] : undefined;

      const concept = InitiativeConceptTemplates.createTodo(projectData.slug, (i + 1).toString(), description, phaseRef);
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
          const { makeId } = await import('megamemory/dist/tools.js');
          const expectedId = makeId(concept.name, concept.parent_id);
          const changesWithoutEdges = { ...concept };
          delete changesWithoutEdges.edges;
          await this.megamemory.update_concept({ id: expectedId, changes: changesWithoutEdges });
          this.stats.updated++;
        } catch (updateError: any) {
          const { makeId } = await import('megamemory/dist/tools.js');
          console.error(`Error updating concept ${concept.name} (expected id: ${makeId(concept.name, concept.parent_id)}):`, updateError.message);
          this.stats.errors++;
        }
      } else if (error.message?.includes('does not exist') || error.message?.includes('not found')) {
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
    if (this.stats.phasesMerged > 0) {
      console.log(`\nPhases merged: ${this.stats.phasesMerged}`);
    }
    console.log('============================\n');
  }

  private parseProjectFile(content: string | null, config: any): any {
    if (!content) {
      return {
        slug: 'project',
        name: 'Project',
        what_this_is: 'Project documentation',
        core_value: '',
        requirements: [],
        phases: []
      };
    }

    const lines = content.split('\n');
    const data: any = {
      slug: 'project',
      name: 'Project',
      what_this_is: '',
      core_value: '',
      requirements: [],
      phases: []
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
      const { makeId } = require('megamemory/dist/tools.js');
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
    const phases: Array<{number: number; slug: string; name: string; goal: string}> = [];
    const lines = content.split('\n');

    for (const line of lines) {
      let match = line.match(/^### Phase (\d+):\s+(.+)$/);
      if (!match) {
        match = line.match(/^-\s+\[[x ]\]\s+Phase (\d+):\s+(.+)$/);
      }

      if (match) {
        const num = parseInt(match[1]);
        phases.push({
          number: num,
          slug: `phase-${num.toString().padStart(2, '0')}`,
          name: match[2],
          goal: ''
        });
      }
    }

    return phases;
  }

  private parseStateFile(content: string): any {
    const { extractJson } = require('../scripts/helpers');
    return extractJson(content);
  }

  private parseMilestonesFile(content: string): Array<{name: string; status: 'shipped' | 'in_progress' | 'planned'; phases: string[]; description: string}> {
    const milestones: Array<{name: string; status: 'shipped' | 'in_progress' | 'planned'; phases: string[]; description: string}> = [];
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
          phases: [],
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
      phase_boundary: parsed.data?.phase_boundary || '',
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

export function migrateCommand(program: Command) {
  program
    .command('planning <project-dir>')
    .description('Migrate .planning/ directory to MegaMemory knowledge graph')
    .option('--clean', 'Delete existing database before migration')
    .action(async (projectDir, options) => {
      try {
        if (!projectDir) {
          console.error('Error: project directory is required\n');
          program.outputHelp();
          process.exit(1);
        }

        const resolvedProjectDir = path.resolve(projectDir);

        if (!await fs.pathExists(resolvedProjectDir)) {
          console.error(`Error: project directory does not exist: ${resolvedProjectDir}\n`);
          program.outputHelp();
          process.exit(1);
        }

        console.log(`Migrating project at: ${resolvedProjectDir}`);
        if (options.clean) {
          console.log('Clean mode: will delete existing database before migration\n');
        } else {
          console.log('');
        }

        const migration = new PlanningToMegaMemoryMigration(resolvedProjectDir, options.clean);

        await migration.migrate();
        console.log('Migration completed successfully!');
        console.log('\nTo rollback, restore from .planning.backup and remove .megamemory/knowledge.db');
      } catch (error: any) {
        console.error(`\nMigration failed: ${error.message}`);
        throw error;
      }
    });
}
