"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportCommand = exportCommand;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
class ExportToMarkdown {
    constructor(db, options) {
        this.db = db;
        this.options = options;
    }
    async run() {
        console.log('Exporting MegaMemory to .planning/ markdown...');
        const allConcepts = await this.getAllConcepts();
        console.log(`Loaded ${allConcepts.length} concepts`);
        const organized = this.organizeConcepts(allConcepts);
        if (this.options.debug) {
            console.log('\n=== CONCEPT MAPPING ===');
            console.log(`Project Root: ${organized.projectRoot?.name || 'None'}`);
            console.log(`Requirements: ${organized.requirements?.name || 'None'}`);
            console.log(`Roadmap: ${organized.roadmap?.name || 'None'}`);
            console.log(`Phases: ${organized.phases.size}`);
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
    async getAllConcepts() {
        const nodes = this.db.getAllActiveNodes();
        const edges = this.db.getAllEdges();
        const edgeMap = new Map();
        for (const edge of edges) {
            if (!edgeMap.has(edge.from_id)) {
                edgeMap.set(edge.from_id, []);
            }
            const toNode = nodes.find((n) => n.id === edge.to_id);
            edgeMap.get(edge.from_id).push({
                to: edge.to_id,
                to_name: toNode?.name || edge.to_id,
                relation: edge.relation,
                description: edge.description
            });
        }
        const incomingEdgeMap = new Map();
        for (const edge of edges) {
            if (!incomingEdgeMap.has(edge.to_id)) {
                incomingEdgeMap.set(edge.to_id, []);
            }
            const fromNode = nodes.find((n) => n.id === edge.from_id);
            incomingEdgeMap.get(edge.to_id).push({
                from: edge.from_id,
                from_name: fromNode?.name || edge.from_id,
                relation: edge.relation,
                description: edge.description
            });
        }
        const childrenMap = new Map();
        for (const node of nodes) {
            const parentId = node.parent_id || null;
            if (!childrenMap.has(parentId)) {
                childrenMap.set(parentId, []);
            }
            childrenMap.get(parentId).push({
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
        const result = [];
        for (const node of nodes) {
            const children = childrenMap.get(node.id) || [];
            const parentNode = node.parent_id ? nodes.find((n) => n.id === node.parent_id) : null;
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
    organizeConcepts(allConcepts) {
        const organized = {
            projectRoot: null,
            requirements: null,
            roadmap: null,
            phases: new Map(),
            phaseChildren: new Map(),
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
            if (concept.kind === 'feature' && concept.name.match(/^phase-\d+$/)) {
                organized.phases.set(concept.name, concept);
                continue;
            }
            if (concept.kind === 'config' && concept.name.match(/^-context$/)) {
                const phaseName = concept.parent?.id || '';
                if (!organized.phaseChildren.has(phaseName)) {
                    organized.phaseChildren.set(phaseName, { context: null, plans: new Map(), research: null, summaries: new Map(), uat: null });
                }
                organized.phaseChildren.get(phaseName).context = concept;
                continue;
            }
            if (concept.kind === 'feature' && concept.name.match(/^-plan-\d+$/)) {
                const match = concept.name.match(/^-plan-(\d+)$/);
                if (match) {
                    const planNum = parseInt(match[1]);
                    const phaseName = concept.parent?.id || '';
                    if (!organized.phaseChildren.has(phaseName)) {
                        organized.phaseChildren.set(phaseName, { context: null, plans: new Map(), research: null, summaries: new Map(), uat: null });
                    }
                    organized.phaseChildren.get(phaseName).plans.set(planNum, concept);
                }
                continue;
            }
            if (concept.kind === 'pattern' && concept.name.match(/^-research$/)) {
                const phaseName = concept.parent?.id || '';
                if (!organized.phaseChildren.has(phaseName)) {
                    organized.phaseChildren.set(phaseName, { context: null, plans: new Map(), research: null, summaries: new Map(), uat: null });
                }
                organized.phaseChildren.get(phaseName).research = concept;
                continue;
            }
            if (concept.kind === 'component' && concept.name.match(/^-plan-\d+-summary$/)) {
                const match = concept.name.match(/^-plan-(\d+)-summary$/);
                if (match) {
                    const planNum = parseInt(match[1]);
                    const phaseName = concept.parent?.id || '';
                    if (!organized.phaseChildren.has(phaseName)) {
                        organized.phaseChildren.set(phaseName, { context: null, plans: new Map(), research: null, summaries: new Map(), uat: null });
                    }
                    organized.phaseChildren.get(phaseName).summaries.set(planNum, concept);
                }
                continue;
            }
            if (concept.kind === 'component' && concept.name.match(/^-uat$/)) {
                const phaseName = concept.parent?.id || '';
                if (!organized.phaseChildren.has(phaseName)) {
                    organized.phaseChildren.set(phaseName, { context: null, plans: new Map(), research: null, summaries: new Map(), uat: null });
                }
                organized.phaseChildren.get(phaseName).uat = concept;
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
    determinePhaseDirName(phaseConcept) {
        const data = this.extractJson(phaseConcept.summary);
        if (data.number && data.slug) {
            return `${data.number}-${data.slug}`;
        }
        const match = phaseConcept.summary.match(/phase\s+(\d+):\s+([a-z0-9-]+)/i);
        if (match) {
            return `${match[1]}-${match[2]}`;
        }
        const phaseNum = phaseConcept.name.replace('phase-', '');
        return `${phaseNum}-unknown`;
    }
    generateProjectMarkdown(concept, reqItems) {
        const data = this.extractJson(concept.summary);
        const sections = [];
        sections.push(`# ${data.name || concept.name}\n`);
        sections.push(`${concept.summary}\n`);
        const validated = reqItems.filter(r => this.extractJson(r.summary).status === 'validated');
        const active = reqItems.filter(r => this.extractJson(r.summary).status === 'active');
        const outOfScope = reqItems.filter(r => this.extractJson(r.summary).status === 'out_of_scope');
        if (validated.length > 0) {
            sections.push(`## Validated\n\n${validated.map(r => `- ${this.extractJson(r.summary).description}`).join('\n')}\n`);
        }
        if (active.length > 0) {
            sections.push(`## Active\n\n${active.map(r => `- ${this.extractJson(r.summary).description}`).join('\n')}\n`);
        }
        if (outOfScope.length > 0) {
            sections.push(`## Out of Scope\n\n${outOfScope.map(r => `- ${this.extractJson(r.summary).description}`).join('\n')}\n`);
        }
        return sections.join('\n\n');
    }
    generatePlanMarkdown(concept, allConcepts) {
        const { generatePlanMarkdown: genPlanMarkdown } = require('../scripts/helpers');
        const data = this.extractJson(concept.summary);
        const relevantKnowledge = allConcepts.filter(c => concept.edges.some(e => e.relation === 'depends_on' && e.to === c.id));
        return genPlanMarkdown(data, relevantKnowledge, []);
    }
    generateVerificationMarkdown(concept) {
        const { generateUATMarkdown } = require('../scripts/helpers');
        const data = this.extractJson(concept.summary);
        return `---\nverification_results: ${JSON.stringify(data.verification_results || [])}\nissues_found: ${JSON.stringify(data.issues_found || [])}\nrecommendations: ${JSON.stringify(data.recommendations || [])}\nconcepts_reviewed: ${JSON.stringify(data.concepts_reviewed || [])}\n---\n\n${generateUATMarkdown(data)}`;
    }
    generateConfigJson(concept) {
        const data = this.extractJson(concept.summary);
        return JSON.stringify(data, null, 2);
    }
    safeWrite(filePath, content) {
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
        }
        catch (error) {
            console.error(`[ERROR] Failed to write ${filePath}:`, error);
            return false;
        }
    }
    ensurePlanningDirectories() {
        const dirs = [
            path.join(this.options.outputDir, '.planning'),
            path.join(this.options.outputDir, '.planning', 'research'),
            path.join(this.options.outputDir, '.planning', 'phases'),
            path.join(this.options.outputDir, '.planning', 'todos', 'pending')
        ];
        for (const dir of dirs) {
            fs.ensureDirSync(dir);
        }
    }
    writeExportedFiles(organized) {
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
        for (const [phaseName, phaseConcept] of organized.phases) {
            const dirName = this.determinePhaseDirName(phaseConcept);
            const phaseDir = path.join(this.options.outputDir, '.planning', 'phases', dirName);
            const children = organized.phaseChildren.get(phaseName);
            if (children) {
                if (children.context) {
                    const data = this.extractJson(children.context.summary);
                    const content = genContextMarkdown(data, []);
                    if (content.trim()) {
                        this.safeWrite(path.join(phaseDir, 'CONTEXT.md'), content);
                    }
                }
                for (const [planNum, plan] of children.plans) {
                    const content = this.generatePlanMarkdown(plan, []);
                    if (content.trim()) {
                        this.safeWrite(path.join(phaseDir, `PLAN-${planNum}.md`), content);
                    }
                }
                if (children.research) {
                    const data = this.extractJson(children.research.summary);
                    const content = generateResearchMarkdown(data);
                    if (content.trim()) {
                        this.safeWrite(path.join(phaseDir, 'RESEARCH.md'), content);
                    }
                }
                for (const [planNum, summary] of children.summaries) {
                    const data = this.extractJson(summary.summary);
                    const content = generateSummaryMarkdown(data);
                    if (content.trim()) {
                        this.safeWrite(path.join(phaseDir, `PLAN-${planNum}-SUMMARY.md`), content);
                    }
                }
                if (children.uat) {
                    const content = this.generateVerificationMarkdown(children.uat);
                    if (content.trim()) {
                        this.safeWrite(path.join(phaseDir, 'VERIFICATION.md'), content);
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
    extractJson(summary) {
        const start = summary.indexOf('{');
        const end = summary.lastIndexOf('}');
        if (start === -1 || end === -1) {
            return {};
        }
        const jsonStr = summary.substring(start, end + 1);
        try {
            return JSON.parse(jsonStr);
        }
        catch (e) {
            console.warn('Failed to parse JSON from summary:', e);
            return {};
        }
    }
}
function exportCommand(program) {
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
            const { KnowledgeDB } = await Promise.resolve().then(() => __importStar(require('megamemory/dist/db.js')));
            const db = new KnowledgeDB(megamemoryPath);
            const exporter = new ExportToMarkdown(db, options);
            await exporter.run();
        }
        catch (error) {
            console.error(`\nExport failed: ${error.message}`);
            throw error;
        }
    });
}
//# sourceMappingURL=export.js.map