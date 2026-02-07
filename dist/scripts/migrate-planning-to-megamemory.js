#!/usr/bin/env ts-node
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const glob_1 = require("glob");
const gray_matter_1 = __importDefault(require("gray-matter"));
const project_templates_1 = require("../project-templates");
const phase_templates_1 = require("../phase-templates");
const helpers_1 = require("../helpers");
const db_js_1 = require("megamemory/dist/db.js");
const tools_js_1 = require("megamemory/dist/tools.js");
class PlanningToMegaMemoryMigration {
    deduplicateYamlKeys(content) {
        const yamlStart = content.indexOf('---');
        const yamlEnd = content.indexOf('---', yamlStart + 3);
        if (yamlStart === -1 || yamlEnd === -1)
            return { content, duplicates: 0 };
        const yamlEndFull = yamlEnd + 3; // Include the closing '---'
        let yamlContent = content.substring(yamlStart + 3, yamlEnd);
        const lines = yamlContent.split('\n');
        const seenKeys = new Map();
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
                }
                else {
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
    fixEscapeSequences(content) {
        let fixed = 0;
        const newContent = content.replace(/"([^"]*)\\([.sSrnt0efxvuclLDd])/g, (match, prefix, escaped) => {
            fixed++;
            return `"${prefix}\\\\${escaped}`;
        });
        this.stats.escapeSequencesFixed += fixed;
        return newContent;
    }
    quoteListItemsWithBackticks(content) {
        let quoted = 0;
        // Quote entire list items if they contain backticks and aren't already quoted
        const newContent = content.replace(/^(\s+-\s+)(.+)$/gm, (match, prefix, item) => {
            if (item.includes('`') && !item.startsWith('"') && !item.startsWith("'")) {
                quoted++;
                return `${prefix}"${item}"`;
            }
            return match;
        });
        this.stats.backticksQuoted += quoted;
        return newContent;
    }
    quoteAtSymbols(content) {
        let quoted = 0;
        // Quote list items that start with @ symbol and aren't already quoted
        const newContent = content.replace(/^(\s+-\s+)@(.+)$/gm, (match, prefix, value) => {
            quoted++;
            return `${prefix}"@${value}"`;
        });
        this.stats.atSymbolsQuoted += quoted;
        return newContent;
    }
    cleanYamlContent(content, filename) {
        try {
            // First try to parse as-is
            (0, gray_matter_1.default)(content);
            return content;
        }
        catch (e) {
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
            return cleaned;
        }
    }
    constructor(projectDir, megamemoryPath = '.megamemory', clean = false) {
        this.megamemoryPath = megamemoryPath;
        this.stats = {
            created: 0,
            updated: 0,
            skipped: 0,
            errors: 0,
            yamlErrors: 0,
            duplicateKeysRemoved: 0,
            escapeSequencesFixed: 0,
            backticksQuoted: 0,
            atSymbolsQuoted: 0,
            skippedDirectories: 0,
            phasesMerged: 0
        };
        this.projectDir = projectDir;
        this.planningDir = path.join(projectDir, '.planning');
        this.clean = clean;
    }
    async createMegaMemoryClient() {
        const dbPath = path.isAbsolute(this.megamemoryPath)
            ? path.join(this.megamemoryPath, 'knowledge.db')
            : path.join(this.projectDir, this.megamemoryPath, 'knowledge.db');
        const db = new db_js_1.KnowledgeDB(dbPath);
        this.megamemory = {
            async understand(query) {
                return await (0, tools_js_1.understand)(db, query);
            },
            async create_concept(concept) {
                const result = await (0, tools_js_1.createConcept)(db, concept);
                return { id: result.id, concept: { ...concept, id: result.id } };
            },
            async update_concept(params) {
                await (0, tools_js_1.updateConcept)(db, params);
                return { success: true };
            },
            async remove_concept(params) {
                (0, tools_js_1.removeConcept)(db, { id: params.id, reason: params.reason || '' });
                return { success: true };
            },
            async link(params) {
                (0, tools_js_1.link)(db, { from: params.from, to: params.to, relation: params.relation });
                return { success: true };
            },
            async list_roots() {
                return await (0, tools_js_1.listRoots)(db);
            }
        };
    }
    async cleanDatabase() {
        const dbPath = path.isAbsolute(this.megamemoryPath)
            ? path.join(this.megamemoryPath, 'knowledge.db')
            : path.join(this.projectDir, this.megamemoryPath, 'knowledge.db');
        if (await fs.pathExists(dbPath)) {
            console.log('Cleaning existing database...');
            await fs.remove(dbPath);
            console.log('Database removed.\n');
        }
    }
    async migrate() {
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
        }
        catch (error) {
            console.error('\nMigration failed:', error);
            throw error;
        }
    }
    async backupPlanningDir() {
        const backupDir = path.join(path.dirname(this.planningDir), '.planning.backup');
        if (await fs.pathExists(backupDir)) {
            console.log('Backup already exists at .planning.backup');
            return;
        }
        console.log('Creating backup at .planning.backup...');
        await fs.copy(this.planningDir, backupDir);
        console.log('Backup created.\n');
    }
    async readPlanningFiles() {
        console.log('Reading .planning/ files...');
        const files = {
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
            const mfiles = await glob_1.glob.glob('*ROADMAP.md', { cwd: milestoneDir, absolute: true });
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
            const researchFiles = await glob_1.glob.glob('*.md', { cwd: researchDir, absolute: true });
            for (const file of researchFiles) {
                const name = path.basename(file, '.md');
                files.research.set(name, await fs.readFile(file, 'utf-8'));
            }
        }
        const todosDir = path.join(this.planningDir, 'todos/pending');
        if (await fs.pathExists(todosDir)) {
            const todoFiles = await glob_1.glob.glob('*.md', { cwd: todosDir, absolute: true });
            for (const file of todoFiles) {
                files.todos.push(await fs.readFile(file, 'utf-8'));
            }
        }
        console.log(`Read ${files.phases.size} phases, ${files.research.size} research docs, ${files.todos.length} todos\n`);
        return files;
    }
    async readPhaseFiles(phasePath) {
        const files = {
            context: null,
            plans: new Map(),
            research: null,
            summaries: new Map(),
            uat: null
        };
        const allFiles = await glob_1.glob.glob('*.md', { cwd: phasePath, absolute: true });
        for (const file of allFiles) {
            const basename = path.basename(file);
            if (basename.endsWith('-CONTEXT.md')) {
                files.context = await fs.readFile(file, 'utf-8');
            }
            else if (basename.endsWith('-RESEARCH.md')) {
                files.research = await fs.readFile(file, 'utf-8');
            }
            else if (basename.endsWith('-UAT.md')) {
                files.uat = await fs.readFile(file, 'utf-8');
            }
            else if (basename.endsWith('-SUMMARY.md')) {
                const match = basename.match(/-(\d+)-SUMMARY\.md/);
                if (match) {
                    files.summaries.set(parseInt(match[1]), await fs.readFile(file, 'utf-8'));
                }
            }
            else if (basename.endsWith('-PLAN.md')) {
                files.plans.set(1, await fs.readFile(file, 'utf-8'));
            }
            else {
                const match = basename.match(/-(\d+)-PLAN\.md/);
                if (match) {
                    files.plans.set(parseInt(match[1]), await fs.readFile(file, 'utf-8'));
                }
            }
        }
        return files;
    }
    mergeDuplicatePhases(phases) {
        const phaseNumberMap = new Map();
        const merged = new Map();
        // Group phases by number
        for (const [dir, files] of phases) {
            const match = dir.match(/^(\d+)-/);
            if (match) {
                const num = parseInt(match[1]);
                if (!phaseNumberMap.has(num)) {
                    phaseNumberMap.set(num, []);
                }
                phaseNumberMap.get(num).push(dir);
            }
            else {
                merged.set(dir, files); // Non-standard naming, keep as-is
            }
        }
        // Merge duplicates
        for (const [num, dirs] of phaseNumberMap) {
            if (dirs.length === 1) {
                merged.set(dirs[0], phases.get(dirs[0]));
            }
            else {
                // Merge phases with same number
                console.log(`Merging ${dirs.length} phases with number ${num}: ${dirs.join(', ')}`);
                this.stats.phasesMerged++;
                const mergedFiles = this.mergePhaseFiles(dirs.map(d => phases.get(d)));
                // Use first directory name for merged result
                merged.set(dirs[0], mergedFiles);
            }
        }
        return merged;
    }
    mergePhaseFiles(phaseFiles) {
        const merged = {
            context: null,
            plans: new Map(),
            research: null,
            summaries: new Map(),
            uat: null
        };
        for (const files of phaseFiles) {
            if (files.context)
                merged.context = files.context;
            if (files.research && !merged.research)
                merged.research = files.research;
            if (files.uat && !merged.uat)
                merged.uat = files.uat;
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
    async migrateProject(files) {
        console.log('Migrating project-level concepts...');
        const projectData = this.parseProjectFile(files.project, files.config);
        const projectRoot = project_templates_1.ProjectConceptTemplates.createProjectRoot(projectData);
        await this.createConcept(projectRoot);
        const requirementsModule = project_templates_1.ProjectConceptTemplates.createRequirementsModule(projectData.slug);
        await this.createConcept(requirementsModule);
        if (files.requirements) {
            const requirements = this.parseRequirementsFile(files.requirements);
            for (const req of requirements) {
                const concept = project_templates_1.ProjectConceptTemplates.createRequirement(projectData.slug, req.id, req.description, req.status);
                await this.createConcept(concept);
            }
        }
        const roadmapModule = project_templates_1.ProjectConceptTemplates.createRoadmapModule(projectData.slug);
        await this.createConcept(roadmapModule);
        const allPhases = new Map();
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
            const concept = project_templates_1.ProjectConceptTemplates.createPhase(projectData.slug, phase.number, phase.slug, phase.name, phase.goal);
            await this.createConcept(concept);
        }
        if (files.state) {
            const state = this.parseStateFile(files.state);
            const concept = project_templates_1.ProjectConceptTemplates.createState(projectData.slug, state);
            await this.createConcept(concept);
        }
        const config = project_templates_1.ProjectConceptTemplates.createConfig(projectData.slug, files.config);
        await this.createConcept(config);
        if (files.milestones) {
            const milestonesModule = project_templates_1.ProjectConceptTemplates.createMilestonesModule(projectData.slug);
            await this.createConcept(milestonesModule);
            const milestones = this.parseMilestonesFile(files.milestones);
            for (const milestone of milestones) {
                const concept = project_templates_1.ProjectConceptTemplates.createMilestone(projectData.slug, milestone.name, milestone);
                await this.createConcept(concept);
            }
        }
        const todosModule = project_templates_1.ProjectConceptTemplates.createTodosModule(projectData.slug);
        await this.createConcept(todosModule);
        const researchModule = project_templates_1.ProjectConceptTemplates.createResearchModule(projectData.slug);
        await this.createConcept(researchModule);
        console.log('Project-level concepts migrated.\n');
    }
    async migratePhases(files) {
        console.log('Migrating phase-level concepts...');
        const projectData = this.parseProjectFile(files.project, files.config);
        // Merge duplicate phases before migrating
        const mergedPhases = this.mergeDuplicatePhases(files.phases);
        // Track phase numbers to detect duplicates
        const createdPhaseNumbers = new Set();
        // Phase concepts are already created from roadmap in migrateProject()
        // Now create phase-level child concepts (context, plans, research, summaries, UAT)
        for (const [phaseDir, phaseFiles] of mergedPhases) {
            // Skip directories that don't match the expected phase format (NN-name)
            if (!/^\d+-.+/.test(phaseDir)) {
                console.log(`Skipping non-phase directory: ${phaseDir}`);
                this.stats.skippedDirectories++;
                continue;
            }
            const phaseNum = parseInt(phaseDir.split('-')[0]);
            const phaseSuffix = phaseDir.substring(phaseDir.split('-')[0].length + 1);
            const phaseName = `phase-${phaseNum}`;
            const phaseParentId = (0, tools_js_1.makeId)(phaseName, `${projectData.slug}/roadmap`);
            // Check for duplicate phase numbers
            if (createdPhaseNumbers.has(phaseNum)) {
                console.warn(`Duplicate phase number detected: ${phaseNum} (directory: ${phaseDir})`);
                console.warn(`  Using unique name: phase-${phaseNum}-${phaseSuffix}`);
            }
            createdPhaseNumbers.add(phaseNum);
            if (phaseFiles.context) {
                const contextData = this.parseContextFile(phaseFiles.context);
                const concept = phase_templates_1.PhaseConceptTemplates.createContext(phaseName, contextData);
                concept.parent_id = phaseParentId;
                await this.createConcept(concept);
            }
            for (const [planNum, planContent] of phaseFiles.plans) {
                const planData = this.parsePlanFile(planContent);
                if (planData && Object.keys(planData).length > 0) {
                    const concept = phase_templates_1.PhaseConceptTemplates.createPlan(phaseName, planNum, planData);
                    concept.parent_id = phaseParentId;
                    concept.edges = [{ to: phaseParentId, relation: 'implements' }];
                    await this.createConcept(concept);
                }
            }
            if (phaseFiles.research) {
                const researchData = this.parseResearchFile(phaseFiles.research);
                if (researchData && Object.keys(researchData).length > 0) {
                    const concept = phase_templates_1.PhaseConceptTemplates.createResearch(phaseName, researchData);
                    concept.parent_id = phaseParentId;
                    concept.edges = [{ to: phaseParentId, relation: 'informs' }];
                    await this.createConcept(concept);
                }
            }
            for (const [summaryNum, summaryContent] of phaseFiles.summaries) {
                const summaryData = this.parseSummaryFile(summaryContent);
                if (summaryData && Object.keys(summaryData).length > 0) {
                    const concept = phase_templates_1.PhaseConceptTemplates.createSummary(phaseName, summaryNum, summaryData);
                    concept.parent_id = phaseParentId;
                    concept.edges = [
                        { to: (0, tools_js_1.makeId)(`${phaseName}-plan-${summaryNum}`, phaseParentId), relation: 'completes' },
                        { to: phaseParentId, relation: 'updates' }
                    ];
                    await this.createConcept(concept);
                }
            }
            if (phaseFiles.uat) {
                const uatData = this.parseUATFile(phaseFiles.uat);
                if (uatData) {
                    const concept = phase_templates_1.PhaseConceptTemplates.createUAT(phaseName, uatData);
                    concept.parent_id = phaseParentId;
                    concept.edges = [
                        { to: phaseParentId, relation: 'verifies' },
                        ...uatData.concepts_reviewed.map((c) => ({ to: c, relation: 'reviewed' }))
                    ];
                    await this.createConcept(concept);
                }
            }
        }
        console.log('Phase-level concepts migrated.\n');
    }
    async migrateResearch(files) {
        console.log('Migrating research documents...');
        const projectData = this.parseProjectFile(files.project, files.config);
        const researchParentId = (0, tools_js_1.makeId)('research', projectData.slug);
        for (const [name, content] of files.research) {
            const researchData = this.parseResearchFile(content);
            const concept = {
                name: `research-${name}`,
                kind: 'pattern',
                summary: content,
                parent_id: researchParentId,
                edges: [{ to: researchParentId, relation: 'part_of' }]
            };
            await this.createConcept(concept);
        }
        console.log('Research documents migrated.\n');
    }
    async migrateTodos(files) {
        console.log('Migrating todos...');
        for (let i = 0; i < files.todos.length; i++) {
            const todoContent = files.todos[i];
            const match = todoContent.match(/^#\s+(.+)$/m);
            const description = match ? match[1] : 'Todo';
            const phaseRefMatch = todoContent.match(/Phase:\s+(.+)$/m);
            const phaseRef = phaseRefMatch ? phaseRefMatch[1] : undefined;
            const concept = project_templates_1.ProjectConceptTemplates.createTodo('project', (i + 1).toString(), description, phaseRef);
            await this.createConcept(concept);
        }
        console.log('Todos migrated.\n');
    }
    async createConcept(concept) {
        try {
            const result = await this.megamemory.create_concept(concept);
            this.stats.created++;
        }
        catch (error) {
            if (error.message?.includes('already exists')) {
                try {
                    // Calculate the expected full ID using makeId
                    const expectedId = (0, tools_js_1.makeId)(concept.name, concept.parent_id);
                    // Remove edges from changes to avoid parent reference issues
                    const changesWithoutEdges = { ...concept };
                    delete changesWithoutEdges.edges;
                    await this.megamemory.update_concept({ id: expectedId, changes: changesWithoutEdges });
                    this.stats.updated++;
                }
                catch (updateError) {
                    console.error(`Error updating concept ${concept.name} (expected id: ${(0, tools_js_1.makeId)(concept.name, concept.parent_id)}):`, updateError.message);
                    this.stats.errors++;
                }
            }
            else if (error.message?.includes('does not exist') || error.message?.includes('not found')) {
                // Parent concept doesn't exist yet - will be created later, so skip for now
                // This can happen when phase-level concepts reference parents before they're created
                console.log(`Skipping concept ${concept.name} (parent: ${concept.parent_id} doesn't exist yet)`);
                this.stats.skipped++;
            }
            else {
                console.error(`Error creating concept ${concept.name}:`, error.message);
                this.stats.errors++;
            }
        }
    }
    async verifyMigration() {
        console.log('Verifying migration...');
        const roots = await this.megamemory.list_roots();
        console.log(`Found ${roots.roots.length} root concepts`);
        try {
            const stateResult = await this.megamemory.understand({ query: 'state' });
            if (stateResult.matches.length > 0) {
                console.log('State concept found');
            }
        }
        catch (error) {
            console.log('Note: Semantic search requires embeddings (generated by MegaMemory server)');
        }
        console.log('Verification complete.\n');
    }
    reportStats() {
        console.log('=== Migration Statistics ===');
        console.log(`Created: ${this.stats.created}`);
        console.log(`Updated: ${this.stats.updated}`);
        console.log(`Skipped: ${this.stats.skipped}`);
        console.log(`Errors: ${this.stats.errors}`);
        if (this.stats.yamlErrors > 0 || this.stats.duplicateKeysRemoved > 0 ||
            this.stats.escapeSequencesFixed > 0 || this.stats.backticksQuoted > 0 ||
            this.stats.atSymbolsQuoted > 0) {
            console.log('\n=== YAML Error Fixes ===');
            console.log(`Files with errors: ${this.stats.yamlErrors}`);
            console.log(`Duplicate keys removed: ${this.stats.duplicateKeysRemoved}`);
            console.log(`Escape sequences fixed: ${this.stats.escapeSequencesFixed}`);
            console.log(`Backticks quoted: ${this.stats.backticksQuoted}`);
            console.log(`@ symbols quoted: ${this.stats.atSymbolsQuoted}`);
        }
        if (this.stats.skippedDirectories > 0) {
            console.log(`\nSkipped directories: ${this.stats.skippedDirectories}`);
        }
        if (this.stats.phasesMerged > 0) {
            console.log(`\nPhases merged: ${this.stats.phasesMerged}`);
        }
        console.log('============================\n');
    }
    phaseDirToSlug(phaseDir) {
        return phaseDir.toLowerCase().replace(/\s+/g, '-');
    }
    parseProjectFile(content, config) {
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
        const data = {
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
            }
            else if (line.startsWith('## What This Is')) {
                data.what_this_is = lines[i + 1].trim();
            }
            else if (line.startsWith('## Core Value')) {
                data.core_value = lines[i + 1].trim();
            }
        }
        return data;
    }
    parseRequirementsFile(content) {
        const requirements = [];
        const lines = content.split('\n');
        let currentStatus = 'active';
        for (const line of lines) {
            if (line.startsWith('## ')) {
                const status = line.replace('## ', '').toLowerCase().trim();
                if (status === 'validated' || status === 'active' || status === 'out_of_scope') {
                    currentStatus = status;
                }
            }
            else if (line.match(/^\d+\./)) {
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
    parseRoadmapFile(content) {
        const phases = [];
        const lines = content.split('\n');
        for (const line of lines) {
            // Try "### Phase N: Name" format first
            let match = line.match(/^### Phase (\d+):\s+(.+)$/);
            if (!match) {
                // Try "- [x] Phase N: Name" format (with or without checkmark)
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
    parseStateFile(content) {
        return (0, helpers_1.extractJson)(content);
    }
    parseMilestonesFile(content) {
        const milestones = [];
        const lines = content.split('\n');
        for (const line of lines) {
            const match = line.match(/^## (.+?)\s+\[(.+?)\]$/);
            if (match) {
                const status = match[2].toLowerCase().trim();
                let validStatus = 'planned';
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
    parseContextFile(content) {
        const cleaned = this.cleanYamlContent(content, 'context file');
        const parsed = (0, gray_matter_1.default)(cleaned);
        return {
            phase_boundary: parsed.data?.phase_boundary || '',
            decisions: parsed.data?.decisions || {},
            open_code_discretion: parsed.data?.open_code_discretion || [],
            specifics: parsed.data?.specifics || [],
            deferred: parsed.data?.deferred || [],
            gathered: new Date().toISOString().split('T')[0]
        };
    }
    parsePlanFile(content) {
        try {
            const cleaned = this.cleanYamlContent(content, 'plan file');
            const parsed = (0, gray_matter_1.default)(cleaned);
            return parsed.data || {};
        }
        catch (e) {
            this.stats.yamlErrors++;
            console.warn(`Failed to parse YAML in plan file: ${e.message}`);
            return {};
        }
    }
    parseResearchFile(content) {
        try {
            const cleaned = this.cleanYamlContent(content, 'research file');
            const parsed = (0, gray_matter_1.default)(cleaned);
            return parsed.data || {};
        }
        catch (e) {
            this.stats.yamlErrors++;
            console.warn(`Failed to parse YAML in research file: ${e.message}`);
            return {};
        }
    }
    parseSummaryFile(content) {
        try {
            const cleaned = this.cleanYamlContent(content, 'summary file');
            const parsed = (0, gray_matter_1.default)(cleaned);
            return parsed.data || {};
        }
        catch (e) {
            this.stats.yamlErrors++;
            console.warn(`Failed to parse YAML in summary file: ${e.message}`);
            return {};
        }
    }
    parseUATFile(content) {
        try {
            const cleaned = this.cleanYamlContent(content, 'UAT file');
            const parsed = (0, gray_matter_1.default)(cleaned);
            const data = parsed.data || {};
            // Provide default values for missing required properties
            return {
                ...data,
                verification_results: Array.isArray(data.verification_results) ? data.verification_results : [],
                issues_found: Array.isArray(data.issues_found) ? data.issues_found : [],
                recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
                concepts_reviewed: Array.isArray(data.concepts_reviewed) ? data.concepts_reviewed : []
            };
        }
        catch (e) {
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
    }
    else {
        console.log('');
    }
    const migration = new PlanningToMegaMemoryMigration(projectDir, '.megamemory', clean);
    try {
        await migration.migrate();
        console.log('Migration completed successfully!');
        console.log('\nTo rollback, restore from .planning.backup and remove .megamemory/knowledge.db');
    }
    catch (error) {
        console.error('\nMigration failed. Backup is available at .planning.backup');
        process.exit(1);
    }
}
if (require.main === module) {
    main();
}
//# sourceMappingURL=migrate-planning-to-megamemory.js.map