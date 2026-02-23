import { Command } from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';

interface ExportOptions {
  projectDir: string;
  outputDir: string;
  overwrite: boolean;
  dryRun: boolean;
  debug: boolean;
  verbose: boolean;
}

interface OrganizedConcepts {
  projectRoot: ConceptMatch | null;
  requirements: ConceptMatch | null;
  roadmap: ConceptMatch | null;
  chapters: Map<string, ConceptMatch>;
  chapterChildren: Map<string, ChapterChildren>;
  research: ConceptMatch | null;
  researchDocs: Map<string, ConceptMatch>;
  milestones: ConceptMatch | null;
  milestoneDocs: Map<string, ConceptMatch>;
  todos: ConceptMatch | null;
  todoItems: Map<string, ConceptMatch>;
  config: ConceptMatch | null;
  state: ConceptMatch | null;
  reqItems: ConceptMatch[];
}

interface ChapterChildren {
  context: ConceptMatch | null;
  plans: Map<number, ConceptMatch>;
  research: ConceptMatch | null;
  summaries: Map<number, ConceptMatch>;
  verification: ConceptMatch | null;
}

interface ConceptMatch {
  id: string;
  name: string;
  kind: string;
  summary: string;
  why: string | null;
  file_refs: string[] | null;
  children: Array<{id: string; name: string; kind: string; summary: string}>;
  edges: Array<{to: string; to_name: string; relation: string; description: string | null}>;
  incoming_edges: Array<{from: string; from_name: string; relation: string; description: string | null}>;
  parent: {id: string; name: string} | null;
  similarity?: number;
}

class ExportToMarkdown {
  private db: any;
  private options: ExportOptions;

  constructor(db: any, options: ExportOptions) {
    this.db = db;
    this.options = options;
  }

  async run(): Promise<void> {
    console.log('Exporting MegaMemory to .planning/ markdown...');

    const allConcepts = await this.getAllConcepts();

    console.log(`Loaded ${allConcepts.length} concepts`);

    const organized = this.organizeConcepts(allConcepts);

    if (this.options.debug) {
      console.log('\n=== CONCEPT MAPPING ===');
      console.log(`Project Root: ${organized.projectRoot?.name || 'None'}`);
      console.log(`Requirements: ${organized.requirements?.name || 'None'}`);
      console.log(`Roadmap: ${organized.roadmap?.name || 'None'}`);
      console.log(`Chapters: ${organized.chapters.size}`);
      console.log(`Research: ${organized.research?.name || 'None'}`);
      console.log(`Research Docs: ${organized.researchDocs.size}`);
      console.log(`Milestones: ${organized.milestones?.name || 'None'}`);
      console.log(`Milestone Docs: ${organized.milestoneDocs.size}`);
      console.log(`Todos: ${organized.todos?.name || 'None'}`);
      console.log(`Todo Items: ${organized.todoItems.size}`);
      console.log(`Config: ${organized.config?.name || 'None'}`);
      console.log(`State: ${organized.state?.name || 'None'}`);
      console.log(`Req Items: ${organized.reqItems.length}`);
    }

    this.ensurePlanningDirectories();
    this.writeExportedFiles(organized);

    console.log('\nExport complete!');
  }

  async getAllConcepts(): Promise<ConceptMatch[]> {
    const nodes = this.db.getAllActiveNodes();
    const edges = this.db.getAllEdges();
    const edgeMap = new Map<string, any[]>();

    for (const edge of edges) {
      if (!edgeMap.has(edge.from_id)) {
        edgeMap.set(edge.from_id, []);
      }
      const toNode = nodes.find((n: any) => n.id === edge.to_id);
      edgeMap.get(edge.from_id)!.push({
        to: edge.to_id,
        to_name: toNode?.name || edge.to_id,
        relation: edge.relation,
        description: edge.description
      });
    }

    const incomingEdgeMap = new Map<string, any[]>();
    for (const edge of edges) {
      if (!incomingEdgeMap.has(edge.to_id)) {
        incomingEdgeMap.set(edge.to_id, []);
      }
      const fromNode = nodes.find((n: any) => n.id === edge.from_id);
      incomingEdgeMap.get(edge.to_id)!.push({
        from: edge.from_id,
        from_name: fromNode?.name || edge.from_id,
        relation: edge.relation,
        description: edge.description
      });
    }

    const childrenMap = new Map<string | null, ConceptMatch[]>();
    for (const node of nodes) {
      const parentId = node.parent_id || null;
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }
      childrenMap.get(parentId)!.push({
        id: node.id,
        name: node.name,
        kind: node.kind,
        summary: node.summary,
        why: node.why,
        file_refs: typeof node.file_refs === 'string' ? [node.file_refs] : node.file_refs,
        children: [],
        edges: edgeMap.get(node.id) || [],
        incoming_edges: incomingEdgeMap.get(node.id) || [],
        parent: null,
        similarity: undefined
      });
    }

    const result: ConceptMatch[] = [];
    for (const node of nodes) {
      const children = childrenMap.get(node.id) || [];
      const parentNode = node.parent_id ? nodes.find((n: any) => n.id === node.parent_id) : null;
      result.push({
        id: node.id,
        name: node.name,
        kind: node.kind,
        summary: node.summary,
        why: node.why,
        file_refs: typeof node.file_refs === 'string' ? [node.file_refs] : node.file_refs,
        children: children.map(c => ({ id: c.id, name: c.name, kind: c.kind, summary: c.summary })),
        edges: edgeMap.get(node.id) || [],
        incoming_edges: incomingEdgeMap.get(node.id) || [],
        parent: parentNode ? { id: parentNode.id, name: parentNode.name } : null
      });
    }

    return result;
  }

  organizeConcepts(allConcepts: ConceptMatch[]): OrganizedConcepts {
    const organized: OrganizedConcepts = {
      projectRoot: null,
      requirements: null,
      roadmap: null,
      chapters: new Map(),
      chapterChildren: new Map(),
      research: null,
      researchDocs: new Map(),
      milestones: null,
      milestoneDocs: new Map(),
      todos: null,
      todoItems: new Map(),
      config: null,
      state: null,
      reqItems: []
    };

    for (const concept of allConcepts) {
      if (concept.kind === 'feature' && !concept.parent && concept.name !== 'Project') {
        organized.projectRoot = concept;
        continue;
      }

      if (concept.kind === 'feature' && concept.name === 'Project') {
        continue;
      }

      if (concept.kind === 'module' && concept.name === 'requirements') {
        organized.requirements = concept;
        continue;
      }

      if (concept.kind === 'feature' && concept.name.startsWith('req-')) {
        organized.reqItems.push(concept);
        continue;
      }

      if (concept.kind === 'module' && concept.name === 'roadmap') {
        organized.roadmap = concept;
        continue;
      }

      if (concept.kind === 'feature' && concept.name.match(/^chapter-\d+$/)) {
        organized.chapters.set(concept.name, concept);
        continue;
      }

      if (concept.kind === 'config' && concept.name.match(/^-context$/)) {
        const chapterName = concept.parent?.id || '';
        if (!organized.chapterChildren.has(chapterName)) {
          organized.chapterChildren.set(chapterName, { context: null, plans: new Map(), research: null, summaries: new Map(), verification: null });
        }
        organized.chapterChildren.get(chapterName)!.context = concept;
        continue;
      }

      if (concept.kind === 'feature' && concept.name.match(/^-plan-\d+$/)) {
        const match = concept.name.match(/^-plan-(\d+)$/);
        if (match) {
          const planNum = parseInt(match[1]);
          const chapterName = concept.parent?.id || '';
          if (!organized.chapterChildren.has(chapterName)) {
            organized.chapterChildren.set(chapterName, { context: null, plans: new Map(), research: null, summaries: new Map(), verification: null });
          }
          organized.chapterChildren.get(chapterName)!.plans.set(planNum, concept);
        }
        continue;
      }

      if (concept.kind === 'pattern' && concept.name.match(/^-research$/)) {
        const chapterName = concept.parent?.id || '';
        if (!organized.chapterChildren.has(chapterName)) {
          organized.chapterChildren.set(chapterName, { context: null, plans: new Map(), research: null, summaries: new Map(), verification: null });
        }
        organized.chapterChildren.get(chapterName)!.research = concept;
        continue;
      }

      if (concept.kind === 'component' && concept.name.match(/^-plan-\d+-summary$/)) {
        const match = concept.name.match(/^-plan-(\d+)-summary$/);
        if (match) {
          const planNum = parseInt(match[1]);
          const chapterName = concept.parent?.id || '';
          if (!organized.chapterChildren.has(chapterName)) {
            organized.chapterChildren.set(chapterName, { context: null, plans: new Map(), research: null, summaries: new Map(), verification: null });
          }
          organized.chapterChildren.get(chapterName)!.summaries.set(planNum, concept);
        }
        continue;
      }

      if (concept.kind === 'component' && concept.name.match(/^-verification$/)) {
        const chapterName = concept.parent?.id || '';
        if (!organized.chapterChildren.has(chapterName)) {
          organized.chapterChildren.set(chapterName, { context: null, plans: new Map(), research: null, summaries: new Map(), verification: null });
        }
        organized.chapterChildren.get(chapterName)!.verification = concept;
        continue;
      }

      if (concept.kind === 'module' && concept.name === 'research') {
        organized.research = concept;
        continue;
      }

      if (concept.kind === 'pattern' && concept.name.startsWith('research-')) {
        organized.researchDocs.set(concept.name, concept);
        continue;
      }

      if (concept.kind === 'module' && concept.name === 'milestones') {
        organized.milestones = concept;
        continue;
      }

      if (concept.kind === 'feature' && concept.name.startsWith('milestone-')) {
        organized.milestoneDocs.set(concept.name, concept);
        continue;
      }

      if (concept.kind === 'module' && concept.name === 'todos') {
        organized.todos = concept;
        continue;
      }

      if (concept.kind === 'feature' && concept.name.startsWith('todo-')) {
        organized.todoItems.set(concept.name, concept);
        continue;
      }

      if (concept.kind === 'config' && concept.name === 'config') {
        organized.config = concept;
        continue;
      }

      if (concept.kind === 'config' && concept.name === 'state') {
        organized.state = concept;
        continue;
      }
    }

    return organized;
  }

  determineChapterDirName(chapterConcept: ConceptMatch): string {
    const data = this.extractJson(chapterConcept.summary);
    if (data.number && data.slug) {
      return `${data.number}-${data.slug}`;
    }

    const match = chapterConcept.summary.match(/(?:chapter|phase)\s+(\d+):\s+([a-z0-9-]+)/i);
    if (match) {
      return `${match[1]}-${match[2]}`;
    }

    const chapterNum = chapterConcept.name.replace('chapter-', '');
    return `${chapterNum}-unknown`;
  }

  generateProjectMarkdown(concept: ConceptMatch, reqItems: ConceptMatch[]): string {
    const data = this.extractJson(concept.summary);
    const sections: string[] = [];

    sections.push(`# ${data.name || concept.name}\n`);
    sections.push(`${concept.summary}\n`);

    const complete = reqItems.filter(r => this.extractJson(r.summary).status === 'complete');
    const inProgress = reqItems.filter(r => this.extractJson(r.summary).status === 'in_progress');
    const outOfScope = reqItems.filter(r => this.extractJson(r.summary).status === 'out_of_scope');

    if (complete.length > 0) {
      sections.push(`## Complete\n\n${complete.map(r => `- ${this.extractJson(r.summary).description}`).join('\n')}\n`);
    }

    if (inProgress.length > 0) {
      sections.push(`## In Progress\n\n${inProgress.map(r => `- ${this.extractJson(r.summary).description}`).join('\n')}\n`);
    }

    if (outOfScope.length > 0) {
      sections.push(`## Out of Scope\n\n${outOfScope.map(r => `- ${this.extractJson(r.summary).description}`).join('\n')}\n`);
    }

    return sections.join('\n\n');
  }

  generatePlanMarkdown(concept: ConceptMatch, allConcepts: ConceptMatch[]): string {
    const { generatePlanMarkdown: genPlanMarkdown } = require('../scripts/helpers');
    const data = this.extractJson(concept.summary);
    const relevantKnowledge = allConcepts.filter(c => concept.edges.some(e => e.relation === 'depends_on' && e.to === c.id));
    return genPlanMarkdown(data, relevantKnowledge, []);
  }

  generateVerificationMarkdown(concept: ConceptMatch): string {
    const { generateVerificationMarkdown: genVerificationMarkdown } = require('../scripts/helpers');
    const data = this.extractJson(concept.summary);
    return `---\nverification_results: ${JSON.stringify(data.verification_results || [])}\nissues_found: ${JSON.stringify(data.issues_found || [])}\nrecommendations: ${JSON.stringify(data.recommendations || [])}\nconcepts_reviewed: ${JSON.stringify(data.concepts_reviewed || [])}\n---\n\n${genVerificationMarkdown(data)}`;
  }

  generateConfigJson(concept: ConceptMatch): string {
    const data = this.extractJson(concept.summary);
    return JSON.stringify(data, null, 2);
  }

  safeWrite(filePath: string, content: string): boolean {
    if (!this.options.overwrite && fs.existsSync(filePath)) {
      if (this.options.verbose) {
        console.log(`[SKIP] File exists: ${filePath}`);
      }
      return false;
    }

    if (this.options.dryRun) {
      console.log(`[DRY-RUN] Would write ${content.length} bytes to: ${filePath}`);
      return true;
    }

    try {
      fs.ensureDirSync(path.dirname(filePath));
      fs.writeFileSync(filePath, content, 'utf8');
      if (this.options.verbose) {
        console.log(`[WROTE] ${filePath}`);
      }
      return true;
    } catch (error) {
      console.error(`[ERROR] Failed to write ${filePath}:`, error);
      return false;
    }
  }

  ensurePlanningDirectories(): void {
    const dirs = [
      path.join(this.options.outputDir, '.planning'),
      path.join(this.options.outputDir, '.planning', 'research'),
      path.join(this.options.outputDir, '.planning', 'chapters'),
      path.join(this.options.outputDir, '.planning', 'todos', 'pending')
    ];

    for (const dir of dirs) {
      fs.ensureDirSync(dir);
    }
  }

  writeExportedFiles(organized: OrganizedConcepts): void {
    if (organized.projectRoot) {
      const content = this.generateProjectMarkdown(organized.projectRoot, organized.reqItems);
      if (content.trim()) {
        this.safeWrite(path.join(this.options.outputDir, '.planning', 'PROJECT.md'), content);
      }
    }

    if (organized.requirements) {
      const content = `# Requirements\n\n${organized.requirements.summary}`;
      if (content.trim()) {
        this.safeWrite(path.join(this.options.outputDir, '.planning', 'REQUIREMENTS.md'), content);
      }
    }

    if (organized.roadmap) {
      const content = `# Roadmap\n\n${organized.roadmap.summary}`;
      if (content.trim()) {
        this.safeWrite(path.join(this.options.outputDir, '.planning', 'ROADMAP.md'), content);
      }
    }

    if (organized.state) {
      const content = `# State\n\n${organized.state.summary}`;
      if (content.trim()) {
        this.safeWrite(path.join(this.options.outputDir, '.planning', 'STATE.md'), content);
      }
    }

    if (organized.milestones) {
      const content = `# Milestones\n\n${organized.milestones.summary}`;
      if (content.trim()) {
        this.safeWrite(path.join(this.options.outputDir, '.planning', 'MILESTONES.md'), content);
      }
    }

    if (organized.config) {
      const content = this.generateConfigJson(organized.config);
      if (content.trim()) {
        this.safeWrite(path.join(this.options.outputDir, '.planning', 'config.json'), content);
      }
    }

    const { generateResearchMarkdown } = require('../scripts/helpers');
    for (const [name, concept] of organized.researchDocs) {
      const data = this.extractJson(concept.summary);
      const content = generateResearchMarkdown(data);
      const fileName = name.replace('research-', '') + '.md';
      if (content.trim()) {
        this.safeWrite(path.join(this.options.outputDir, '.planning', 'research', fileName), content);
      }
    }

    const { generateContextMarkdown: genContextMarkdown, generateSummaryMarkdown } = require('../scripts/helpers');
    for (const [chapterName, chapterConcept] of organized.chapters) {
      const dirName = this.determineChapterDirName(chapterConcept);
      const chapterDir = path.join(this.options.outputDir, '.planning', 'chapters', dirName);
      const children = organized.chapterChildren.get(chapterName);

      if (children) {
        if (children.context) {
          const data = this.extractJson(children.context.summary);
          const content = genContextMarkdown(data, []);
          if (content.trim()) {
            this.safeWrite(path.join(chapterDir, 'CONTEXT.md'), content);
          }
        }

        for (const [planNum, plan] of children.plans) {
          const content = this.generatePlanMarkdown(plan, []);
          if (content.trim()) {
            this.safeWrite(path.join(chapterDir, `PLAN-${planNum}.md`), content);
          }
        }

        if (children.research) {
          const data = this.extractJson(children.research.summary);
          const content = generateResearchMarkdown(data);
          if (content.trim()) {
            this.safeWrite(path.join(chapterDir, 'RESEARCH.md'), content);
          }
        }

        for (const [planNum, summary] of children.summaries) {
          const data = this.extractJson(summary.summary);
          const content = generateSummaryMarkdown(data);
          if (content.trim()) {
            this.safeWrite(path.join(chapterDir, `PLAN-${planNum}-SUMMARY.md`), content);
          }
        }

        if (children.verification) {
          const content = this.generateVerificationMarkdown(children.verification);
          if (content.trim()) {
            this.safeWrite(path.join(chapterDir, 'VERIFICATION.md'), content);
          }
        }
      }
    }

    for (const [name, concept] of organized.todoItems) {
      const data = this.extractJson(concept.summary);
      const content = `# Todo\n\nDescription: ${data.description}\nStatus: ${data.status}\n`;
      const fileName = name.replace('todo-', '') + '.md';
      if (content.trim()) {
        this.safeWrite(path.join(this.options.outputDir, '.planning', 'todos', 'pending', fileName), content);
      }
    }
  }

  extractJson(summary: string): any {
    const start = summary.indexOf('{');
    const end = summary.lastIndexOf('}');

    if (start === -1 || end === -1) {
      return {};
    }

    const jsonStr = summary.substring(start, end + 1);
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      console.warn('Failed to parse JSON from summary:', e);
      return {};
    }
  }
}

export function exportCommand(program: Command) {
  program
    .command('export')
    .description('Export MegaMemory knowledge graph back to .planning/ markdown files')
    .requiredOption('-p, --project-dir <path>', 'Path to project with .megamemory/')
    .requiredOption('-o, --output-dir <path>', 'Output directory for .planning/ files')
    .option('--overwrite', 'Overwrite existing files')
    .option('--dry-run', 'Show what would be written without writing')
    .option('--debug', 'Show concept mapping details')
    .option('--verbose', 'Detailed progress output')
    .action(async (options) => {
      try {
        if (!fs.existsSync(options.projectDir)) {
          throw new Error(`Project directory does not exist: ${options.projectDir}`);
        }

        if (!fs.existsSync(options.outputDir)) {
          throw new Error(`Output directory does not exist: ${options.outputDir}`);
        }

        const megamemoryPath = path.join(options.projectDir, '.megamemory');
        if (!fs.existsSync(megamemoryPath)) {
          throw new Error(`MegaMemory directory does not exist: ${megamemoryPath}`);
        }

        const { KnowledgeDB } = await import('megamemory/dist/db.js');
        const db = new KnowledgeDB(path.join(megamemoryPath, 'knowledge.db'));

        const exporter = new ExportToMarkdown(db, options);
        await exporter.run();
      } catch (error: any) {
        console.error(`\nExport failed: ${error.message}`);
        throw error;
      }
    });
}
