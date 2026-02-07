#!/usr/bin/env ts-node

import * as fs from 'fs-extra';
import * as path from 'path';
import { execSync } from 'child_process';
import { glob } from 'glob';
import matter from 'gray-matter';
import { ProjectData, GSDConcept } from '../scripts/types';
import type { RelationType as MMRelationType } from 'megamemory/dist/types';
import { ProjectConceptTemplates } from '../scripts/project-templates';
import { PhaseConceptTemplates as PhaseTemplates } from '../scripts/phase-templates';
import { extractJson } from '../scripts/helpers';
import { KnowledgeDB } from 'megamemory/dist/db.js';
import { understand, createConcept, updateConcept, link, removeConcept, listRoots, makeId } from 'megamemory/dist/tools.js';

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
  context: { content: string; path: string } | null;
  plans: Map<number, { content: string; path: string }>;
  research: { content: string; path: string } | null;
  summaries: Map<number, { content: string; path: string }>;
  uat: { content: string; path: string } | null;
}

interface ReferencePattern {
  name: string;
  category: string;
  content: string;
  filePath: string;
}

interface TemplateSchema {
  templateName: string;
  schema: any;
  content: string;
  filePath: string;
}

interface MigrationOptions {
  projectDir: string;
  megamemoryPath: string;
  clean: boolean;
  incremental: boolean;
  dryRun: boolean;
  rollback: boolean;
  debug: boolean;
}

interface MigrationStats {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  yamlErrors: number;
  keysConvertedToLists: number;
  filesWithDuplicates: number;
  commaSeparatedValuesFixed: number;
  escapeSequencesFixed: number;
  backticksQuoted: number;
  atSymbolsQuoted: number;
  embeddedQuotesFixed: number;
  skippedDirectories: number;
  phasesMerged: number;
  referencePatternsMigrated: number;
  templateSchemasMigrated: number;
  rollbackPerformed: boolean;
  filesScannedForDuplicates: number;
  filesWithDetectedDuplicates: number;
  filesSuccessfullyConverted: number;
  filesSkippedNoError: number;
  parseErrorsEncountered: number;
}

class EnhancedPlanningToMegaMemoryMigration {
  private projectDir: string;
  private planningDir: string;
  private getShitDoneDir: string;
  private getShitDoneMMDir: string;
  private megamemory!: MegaMemoryClient;
  private options: MigrationOptions;
  private stats: MigrationStats;
  private existingConceptNames: Set<string>;
  private referencePatterns: Map<string, ReferencePattern> = new Map();
  private templateSchemas: Map<string, TemplateSchema> = new Map();
  private listEligibleKeys = new Set(['contains', 'provides', 'removal']);
  private preserveSeparateKeys = new Set(['to', 'via', 'pattern']);

  constructor(options: MigrationOptions) {
    this.projectDir = options.projectDir;
    this.planningDir = path.join(options.projectDir, '.planning');
    this.getShitDoneDir = path.join(this.projectDir, 'get-shit-done');
    this.getShitDoneMMDir = path.join(this.projectDir, 'get-shit-done-mm');
    this.options = options;
    this.existingConceptNames = new Set();
    this.stats = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      yamlErrors: 0,
      keysConvertedToLists: 0,
      filesWithDuplicates: 0,
      commaSeparatedValuesFixed: 0,
      escapeSequencesFixed: 0,
      backticksQuoted: 0,
      atSymbolsQuoted: 0,
      embeddedQuotesFixed: 0,
      skippedDirectories: 0,
      phasesMerged: 0,
      referencePatternsMigrated: 0,
      templateSchemasMigrated: 0,
      rollbackPerformed: false,
      filesScannedForDuplicates: 0,
      filesWithDetectedDuplicates: 0,
      filesSuccessfullyConverted: 0,
      filesSkippedNoError: 0,
      parseErrorsEncountered: 0
    };
  }

  private async validateMegaMemoryVersion(): Promise<void> {
    console.log('Validating MegaMemory version...');

    try {
      const packageJsonPath = require.resolve('megamemory/package.json');
      const packageJson = await fs.readJson(packageJsonPath);
      const version = packageJson.version;
      
      const requiredVersion = '1.1.2';
      
      if (this.compareVersions(version, requiredVersion) < 0) {
        throw new Error(`MegaMemory version ${version} is below required version ${requiredVersion}. Please upgrade MegaMemory.`);
      }

      console.log(`MegaMemory version ${version} validated (>= ${requiredVersion}).\n`);
    } catch (error: any) {
      if (error.code === 'MODULE_NOT_FOUND') {
        throw new Error('MegaMemory not found. Please install it first.');
      }
      throw error;
    }
  }

  private compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);
    
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const partA = partsA[i] || 0;
      const partB = partsB[i] || 0;
      
      if (partA > partB) return 1;
      if (partA < partB) return -1;
    }
    
    return 0;
  }

  private async loadExistingConceptNames(): Promise<void> {
    if (this.options.incremental || this.options.clean) {
      console.log('Loading existing concept names for incremental mode...');
      
      try {
        const roots = await this.megamemory.list_roots();
        
        for (const root of roots.roots) {
          this.existingConceptNames.add(root.name);
          await this.loadChildConceptNames(root.id);
        }
        
        console.log(`Loaded ${this.existingConceptNames.size} existing concept names.\n`);
      } catch (error: any) {
        if (error.message?.includes('database does not exist') || this.options.clean) {
          console.log('No existing database found. Starting fresh.\n');
        } else {
          throw error;
        }
      }
    }
  }

  private async loadChildConceptNames(parentId: string): Promise<void> {
    try {
      const result = await this.megamemory.understand({ 
        query: `concepts with parent ${parentId}`,
        top_k: 10000 
      });
      
      for (const match of result.matches) {
        this.existingConceptNames.add(match.name);
        
        if (match.children && match.children.length > 0) {
          for (const child of match.children) {
            this.existingConceptNames.add(child.name);
            await this.loadChildConceptNames(child.id);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to load child concepts for ${parentId}:`, error);
    }
  }

  private convertDuplicateKeysToLists(content: string): { content: string; converted: number; commaSeparated: number } {
    if (this.options.debug) {
      console.log(`  [CONVERT] Analyzing content (length: ${content.length})`);
    }

    interface LineInfo {
      index: number;
      indent: number;
      isListItem: boolean;
      key: string | null;
      value: string;
    }

    const yamlStart = content.indexOf('---');
    const yamlEnd = content.indexOf('---', yamlStart + 3);
    if (yamlStart === -1 || yamlEnd === -1) {
      if (this.options.debug) {
        console.log(`  [CONVERT] No YAML frontmatter found, skipping`);
      }
      return { content, converted: 0, commaSeparated: 0 };
    }

    if (this.options.debug) {
      console.log(`  [CONVERT] Found YAML frontmatter, analyzing for duplicates`);
    }

    const yamlEndFull = yamlEnd + 3;
    let yamlContent = content.substring(yamlStart + 3, yamlEnd);
    const lines = yamlContent.split('\n');
    const beforeYaml = content.substring(0, yamlStart);
    const afterYaml = content.substring(yamlEndFull);

    let totalConverted = 0;
    let totalCommaSeparated = 0;

    const parseIndent = (line: string): number => {
      const match = line.match(/^(\s*)/);
      return match ? match[1].length : 0;
    };

    const isListItem = (line: string): boolean => {
      return /^\s*-\s+/.test(line);
    };

    const isYamlKey = (line: string): RegExpMatchArray | null => {
      return line.match(/^(\s+)(\w+):\s*(.*)$/);
    };

    const lineInfos: LineInfo[] = lines.map((line, index) => {
      const keyMatch = isYamlKey(line);
      return {
        index,
        content: line,
        indent: parseIndent(line),
        isListItem: isListItem(line),
        key: keyMatch ? keyMatch[2] : null,
        value: keyMatch ? keyMatch[3] : ''
      };
    });

    interface ListItemContext {
      startIndex: number;
      indent: number;
      seenKeys: Map<string, number[]>;
    }

    const contexts: ListItemContext[] = [];
    let currentContext: ListItemContext | null = null;

    for (const lineInfo of lineInfos) {
      if (lineInfo.isListItem) {
        contexts.push({
          startIndex: lineInfo.index,
          indent: lineInfo.indent,
          seenKeys: new Map()
        });
        currentContext = contexts[contexts.length - 1];
      } else if (lineInfo.key && currentContext && lineInfo.indent > currentContext.indent) {
        const key = lineInfo.key!;
        if (!currentContext.seenKeys.has(key)) {
          currentContext.seenKeys.set(key, []);
        }
        currentContext.seenKeys.get(key)!.push(lineInfo.index);

        if (lineInfo.value !== '' && this.listEligibleKeys.has(key)) {
          const commaMatch = lineInfo.value.match(/^"([^"]*)",\s*"([^"]*)"$/);
          if (commaMatch) {
            totalCommaSeparated++;
          }
        }
      } else {
        currentContext = null;
      }
    }

    const conversions: Array<{ context: ListItemContext; key: string }> = [];

    for (const context of contexts) {
      for (const [key, indices] of context.seenKeys) {
        if (this.listEligibleKeys.has(key) && indices.length > 1) {
          if (this.options.debug) {
            console.log(`  [CONVERT] Found duplicate key '${key}' with ${indices.length} occurrences at lines ${indices.join(', ')}`);
          }
          conversions.push({ context, key });
        }
      }
    }

    if (conversions.length === 0) {
      if (this.options.debug) {
        console.log(`  [CONVERT] No duplicate key conversions found. Total contexts: ${contexts.length}`);
      }
    }

    for (const { context, key } of conversions) {
      const indices = context.seenKeys.get(key)!;
      if (indices.length < 2) continue;

      const firstIndex = indices[0];
      const keyIndent = ' '.repeat(parseIndent(lines[firstIndex]));

      if (this.options.debug) {
        console.log(`  [CONVERT] Converting key '${key}' at indices ${indices.join(', ')}`);
      }

      const values: string[] = [];

      for (const idx of indices) {
        const value = lineInfos[idx].value.trim();
        if (value === '') {
          values.push(null as any);
        } else {
          const commaMatch = value.match(/^"([^"]*)",\s*"([^"]*)"$/);
          if (commaMatch) {
            values.push(`"${commaMatch[1]}"`, `"${commaMatch[2]}"`);
          } else if (!value.startsWith('"')) {
            values.push(`"${value}"`);
          } else {
            values.push(value);
          }
        }
      }

      const filteredValues = values.filter((v): v is string => v !== null);

      if (filteredValues.length === 0) continue;

      lines[firstIndex] = `${keyIndent}${key}:`;

      for (let i = 1; i < indices.length; i++) {
        lines[indices[i]] = '';
      }

      for (let i = filteredValues.length - 1; i >= 0; i--) {
        const listItemIndent = ' '.repeat(context.indent + 2);
        lines.splice(firstIndex + 1, 0, `${listItemIndent}- ${filteredValues[i]}`);
      }

      totalConverted++;

      if (this.options.debug) {
        console.log(`  [CONVERT] Converted ${filteredValues.length} values to list items for key '${key}'`);
      }
    }

    const cleanedYaml = lines.filter(l => l !== '').join('\n');
    const newContent = `${beforeYaml}---\n${cleanedYaml}\n---\n${afterYaml}`;

    return { content: newContent, converted: totalConverted, commaSeparated: totalCommaSeparated };
  }

  private scanFileForDuplicates(content: string, filename: string): {
    hasDuplicates: boolean;
    duplicateKeys: string[];
    conversionRequired: boolean;
  } {
    if (this.options.debug) {
      console.log(`  [SCAN] Scanning: ${filename}`);
    }
    this.stats.filesScannedForDuplicates++;

    const yamlStart = content.indexOf('---');
    const yamlEnd = content.indexOf('---', yamlStart + 3);

    if (yamlStart === -1 || yamlEnd === -1) {
      if (this.options.debug) {
        console.log(`  [SCAN] No YAML frontmatter found`);
      }
      return { hasDuplicates: false, duplicateKeys: [], conversionRequired: false };
    }

    const conversionResult = this.convertDuplicateKeysToLists(content);
    const hasDuplicates = conversionResult.converted > 0;

    if (hasDuplicates) {
      if (this.options.debug) {
        console.log(`  [SCAN] Duplicates found: ${conversionResult.converted} key groups`);
      }
      this.stats.filesWithDetectedDuplicates++;
    } else {
      if (this.options.debug) {
        console.log(`  [SCAN] No duplicates found`);
      }
      this.stats.filesSkippedNoError++;
    }

    return {
      hasDuplicates,
      duplicateKeys: hasDuplicates ? ['detected'] : [],
      conversionRequired: hasDuplicates
    };
  }

  private async scanAllPlanningFiles(planningFiles: PlanningFiles): Promise<void> {
    console.log('Scanning all planning files for duplicates...\n');

    if (this.options.debug) {
      console.log('=== DEBUG SCAN START ===\n');
    }

    if (planningFiles.project) {
      this.scanFileForDuplicates(planningFiles.project, 'PROJECT.md');
    }

    if (planningFiles.requirements) {
      this.scanFileForDuplicates(planningFiles.requirements, 'REQUIREMENTS.md');
    }

    if (planningFiles.roadmap) {
      this.scanFileForDuplicates(planningFiles.roadmap, 'ROADMAP.md');
    }

    if (planningFiles.state) {
      this.scanFileForDuplicates(planningFiles.state, 'STATE.md');
    }

    if (planningFiles.milestones) {
      this.scanFileForDuplicates(planningFiles.milestones, 'MILESTONES.md');
    }

    for (const [name, content] of planningFiles.milestoneRoadmaps) {
      this.scanFileForDuplicates(content, `milestones/${name}-ROADMAP.md`);
    }

    for (const [phaseDir, phaseFiles] of planningFiles.phases) {
      if (phaseFiles.context) {
        const basename = path.basename(phaseFiles.context.path);
        this.scanFileForDuplicates(phaseFiles.context.content, `phases/${basename}`);
      }

      for (const [planNum, fileData] of phaseFiles.plans) {
        const basename = path.basename(fileData.path);
        this.scanFileForDuplicates(fileData.content, `phases/${basename}`);
      }

      if (phaseFiles.research) {
        const basename = path.basename(phaseFiles.research.path);
        this.scanFileForDuplicates(phaseFiles.research.content, `phases/${basename}`);
      }

      for (const [summaryNum, fileData] of phaseFiles.summaries) {
        const basename = path.basename(fileData.path);
        this.scanFileForDuplicates(fileData.content, `phases/${basename}`);
      }

      if (phaseFiles.uat) {
        const basename = path.basename(phaseFiles.uat.path);
        this.scanFileForDuplicates(phaseFiles.uat.content, `phases/${basename}`);
      }
    }

    for (const [name, content] of planningFiles.research) {
      this.scanFileForDuplicates(content, `research/${name}.md`);
    }

    if (this.options.debug) {
      console.log('\n=== DEBUG SCAN END ===\n');
    }

    console.log('Scan complete.');
    console.log(`  Files scanned: ${this.stats.filesScannedForDuplicates}`);
    console.log(`  Files with duplicates: ${this.stats.filesWithDetectedDuplicates}`);
    console.log(`  Files skipped (no error): ${this.stats.filesSkippedNoError}\n`);
  }

  private fixEscapeSequences(content: string): string {
    let fixed = 0;
    const newContent = content.replace(/"([^"]*)"/g, (match: string, quotedContent: string) => {
      const processed = quotedContent.replace(/(?<!\\)\\([^"\\\n])/g, (m: string, char: string) => {
        fixed++;
        return `\\\\${char}`;
      });
      return `"${processed}"`;
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
    this.stats.embeddedQuotesFixed += quoted;
    return newContent;
  }

  private cleanYamlContent(content: string, filename: string): string {
    if (this.options.debug) {
      console.log(`  [CLEAN] Checking: ${filename}`);
    }

    try {
      matter(content);
      if (this.options.debug) {
        console.log(`  [CLEAN] YAML is valid, no conversion needed`);
      }
      return content;
    } catch (e: any) {
      if (this.options.debug) {
        console.log(`  [CLEAN] YAML parse error: ${e.message.substring(0, 100)}`);
      }
      this.stats.yamlErrors++;
      this.stats.parseErrorsEncountered++;

      const shortPath = filename.replace(/^.*\.planning\//, '').replace(/^phases\/[^/]+\//, '');
      const errorMsg = e.message.split('\n')[0].substring(0, 70);
      console.log(`  [FIX] ${shortPath}: ${errorMsg}`);

      let cleaned = content;
      let currentConverted = 0;

      const conversionResult = this.convertDuplicateKeysToLists(cleaned);
      cleaned = conversionResult.content;
      this.stats.keysConvertedToLists += conversionResult.converted;
      this.stats.commaSeparatedValuesFixed += conversionResult.commaSeparated;
      currentConverted += conversionResult.converted;

      cleaned = this.fixEscapeSequences(cleaned);
      cleaned = this.quoteListItemsWithBackticks(cleaned);
      cleaned = this.quoteAtSymbols(cleaned);

      if (currentConverted > 0) {
        this.stats.filesWithDuplicates++;
        this.stats.filesSuccessfullyConverted++;
        console.log(`  - Converted ${currentConverted} duplicate key groups to lists`);
      }

      try {
        matter(cleaned);
        console.log(`  [OK] ${shortPath}: Fixed`);
        return cleaned;
      } catch (e2: any) {
        const errorMsg2 = e2.message.split('\n')[0].substring(0, 70);
        console.log(`  [RETRY] ${shortPath}: ${errorMsg2}`);
        cleaned = this.quoteEmbeddedDoubleQuotes(cleaned);

        try {
          matter(cleaned);
          console.log(`  [OK] ${shortPath}: Fixed on retry`);
          return cleaned;
        } catch (e3: any) {
          const errorMsg3 = e3.message.split('\n')[0].substring(0, 70);
          console.log(`  [FAIL] ${shortPath}: ${errorMsg3}`);
          return cleaned;
        }
      }
    }
  }

  private async createMegaMemoryClient(): Promise<void> {
    const dbPath = path.isAbsolute(this.options.megamemoryPath)
      ? path.join(this.options.megamemoryPath, 'knowledge.db')
      : path.join(this.projectDir, this.options.megamemoryPath, 'knowledge.db');
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
        link(db, { from: params.from, to: params.to, relation: params.relation as MMRelationType });
        return { success: true };
      },
      async list_roots() {
        return await listRoots(db);
      }
    };
  }

  private async cleanDatabase(): Promise<void> {
    const dbPath = path.isAbsolute(this.options.megamemoryPath)
      ? path.join(this.options.megamemoryPath, 'knowledge.db')
      : path.join(this.projectDir, this.options.megamemoryPath, 'knowledge.db');

    if (await fs.pathExists(dbPath)) {
      if (this.options.dryRun) {
        console.log('[DRY-RUN] Would remove database:', dbPath);
      } else {
        console.log('Cleaning existing database...');
        await fs.remove(dbPath);
        console.log('Database removed.\n');
      }
    }
  }

  private async performRollback(): Promise<void> {
    console.log('Performing rollback...');

    const zipPath = path.join(this.projectDir, 'dot-planning.zip');
    const dbPath = path.isAbsolute(this.options.megamemoryPath)
      ? path.join(this.options.megamemoryPath, 'knowledge.db')
      : path.join(this.projectDir, this.options.megamemoryPath, 'knowledge.db');

    if (!(await fs.pathExists(zipPath))) {
      throw new Error('Backup archive dot-planning.zip not found. Cannot rollback.');
    }

    if (this.options.dryRun) {
      console.log('[DRY-RUN] Would restore .planning/ from dot-planning.zip');
      console.log('[DRY-RUN] Would remove database:', dbPath);
    } else {
      if (await fs.pathExists(this.planningDir)) {
        await fs.remove(this.planningDir);
      }
      execSync('unzip -o dot-planning.zip', { cwd: this.projectDir, stdio: 'pipe' });
      console.log('.planning/ restored from backup.');

      if (await fs.pathExists(dbPath)) {
        await fs.remove(dbPath);
        console.log('Database removed.\n');
      }
    }

    this.stats.rollbackPerformed = true;
  }

  private async discoverReferencePatterns(): Promise<void> {
    console.log('Discovering reference patterns from get-shit-done/references/...');

    const referencesDir = path.join(this.getShitDoneDir, 'references');
    
    if (!(await fs.pathExists(referencesDir))) {
      console.log('No references directory found.\n');
      return;
    }

    const referenceFiles = await glob.glob('*.md', { cwd: referencesDir, absolute: true });

    for (const file of referenceFiles) {
      const content = await fs.readFile(file, 'utf-8');
      const basename = path.basename(file, '.md');
      
      this.referencePatterns.set(basename, {
        name: basename,
        category: this.inferPatternCategory(basename, content),
        content,
        filePath: path.relative(this.projectDir, file)
      });
    }

    console.log(`Discovered ${this.referencePatterns.size} reference patterns.\n`);
  }

  private inferPatternCategory(name: string, content: string): string {
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('test') || lowerName.includes('tdd')) return 'testing';
    if (lowerName.includes('git')) return 'version-control';
    if (lowerName.includes('megamemory')) return 'knowledge-management';
    if (lowerName.includes('ui') || lowerName.includes('brand')) return 'user-interface';
    if (lowerName.includes('checkpoint') || lowerName.includes('verification')) return 'quality-assurance';
    if (lowerName.includes('planning') || lowerName.includes('config')) return 'planning';
    if (lowerName.includes('model') || lowerName.includes('questioning')) return 'ai-agents';
    
    return 'general';
  }

  private async migrateReferencePatterns(): Promise<void> {
    console.log('Migrating reference patterns to MegaMemory...');

    if (this.referencePatterns.size === 0) {
      console.log('No reference patterns to migrate.\n');
      return;
    }

    for (const [name, pattern] of this.referencePatterns) {
      if (this.options.incremental && this.existingConceptNames.has(`pattern:${name}`)) {
        console.log(`  Skipping existing pattern: ${name}`);
        this.stats.skipped++;
        continue;
      }

      const concept: GSDConcept = {
        name: `pattern:${name}`,
        kind: 'pattern',
        summary: pattern.content.substring(0, 500) + (pattern.content.length > 500 ? '...' : ''),
        why: `Reference pattern from ${pattern.filePath}. Provides guidance on ${pattern.category}.`,
        parent_id: null,
        file_refs: [pattern.filePath],
        edges: []
      };

      if (this.options.dryRun) {
        console.log(`[DRY-RUN] Would create pattern concept: ${name}`);
      } else {
        try {
          await this.createConcept(concept);
          this.stats.referencePatternsMigrated++;
          console.log(`  Migrated pattern: ${name}`);
        } catch (error: any) {
          console.log(`  Failed to migrate pattern ${name}:`, error.message);
          this.stats.errors++;
        }
      }
    }

    console.log(`Reference patterns migration complete.\n`);
  }

  private async discoverTemplateSchemas(): Promise<void> {
    console.log('Discovering template schemas from get-shit-done-mm/templates/...');

    const templatesDir = this.getShitDoneMMDir;
    
    if (!(await fs.pathExists(templatesDir))) {
      console.log('No templates directory found.\n');
      return;
    }

    const templateFiles = await glob.glob('**/*.md', { cwd: templatesDir, absolute: true });

    for (const file of templateFiles) {
      const content = await fs.readFile(file, 'utf-8');
      const relativePath = path.relative(templatesDir, file);
      const templateName = relativePath.replace('.md', '');

      const schemaStart = content.indexOf('<megamemory_schema>');
      const schemaEnd = content.indexOf('</megamemory_schema>');

      if (schemaStart !== -1 && schemaEnd !== -1) {
        const schemaContent = content.substring(schemaStart + 19, schemaEnd);
        
        try {
          const parsedSchema = this.parseSchemaContent(schemaContent);
          
          this.templateSchemas.set(templateName, {
            templateName,
            schema: parsedSchema,
            content,
            filePath: path.relative(this.projectDir, file)
          });
        } catch (error: any) {
          console.warn(`Failed to parse schema from ${templateName}:`, error.message);
        }
      }
    }

    console.log(`Discovered ${this.templateSchemas.size} template schemas.\n`);
  }

  private parseSchemaContent(content: string): any {
    const schema: any = {
      conceptName: '',
      kind: '',
      summary: '',
      fields: [],
      relationships: []
    };

    const lines = content.split('\n');
    let currentSection = '';

    for (const line of lines) {
      if (line.startsWith('## Concept:')) {
        schema.conceptName = line.replace('## Concept:', '').trim();
      } else if (line.startsWith('**Kind:**')) {
        schema.kind = line.replace('**Kind:**', '').trim();
      } else if (line.startsWith('**Summary:**')) {
        schema.summary = line.replace('**Summary:**', '').trim();
      } else if (line.startsWith('**Fields:**')) {
        currentSection = 'fields';
      } else if (line.startsWith('**Relationships:**')) {
        currentSection = 'relationships';
      } else if (line.startsWith('-')) {
        const item = line.substring(1).trim();
        if (currentSection === 'fields') {
          schema.fields.push(item);
        } else if (currentSection === 'relationships') {
          schema.relationships.push(item);
        }
      }
    }

    return schema;
  }

  private async migrateTemplateSchemas(): Promise<void> {
    console.log('Migrating template schemas to MegaMemory...');

    if (this.templateSchemas.size === 0) {
      console.log('No template schemas to migrate.\n');
      return;
    }

    const schemaModuleId = makeId('template-schemas', undefined);

    for (const [name, templateSchema] of this.templateSchemas) {
      const conceptName = `schema:${name}`;

      if (this.options.incremental && this.existingConceptNames.has(conceptName)) {
        console.log(`  Skipping existing schema: ${name}`);
        this.stats.skipped++;
        continue;
      }

      const concept: GSDConcept = {
        name: conceptName,
        kind: 'config',
        summary: JSON.stringify({
          templateName: name,
          conceptName: templateSchema.schema.conceptName,
          kind: templateSchema.schema.kind,
          summary: templateSchema.schema.summary,
          fields: templateSchema.schema.fields,
          relationships: templateSchema.schema.relationships
        }, null, 2),
        why: `Validation schema for template ${name}. Defines structure for ${templateSchema.schema.conceptName} concepts.`,
        parent_id: schemaModuleId,
        file_refs: [templateSchema.filePath],
        edges: []
      };

      if (this.options.dryRun) {
        console.log(`[DRY-RUN] Would create schema concept: ${name}`);
      } else {
        try {
          await this.createConcept(concept);
          this.stats.templateSchemasMigrated++;
          console.log(`  Migrated schema: ${name}`);
        } catch (error: any) {
          console.log(`  Failed to migrate schema ${name}:`, error.message);
          this.stats.errors++;
        }
      }
    }

    console.log(`Template schemas migration complete.\n`);
  }

  async migrate(): Promise<void> {
    console.log('Starting enhanced migration from .planning/ to MegaMemory...\n');
    console.log(`Options:`);
    console.log(`  Clean: ${this.options.clean}`);
    console.log(`  Incremental: ${this.options.incremental}`);
    console.log(`  Dry Run: ${this.options.dryRun}`);
    console.log(`  Debug: ${this.options.debug}`);
    console.log(`  Rollback: ${this.options.rollback}\n`);

    try {
      await this.validateMegaMemoryVersion();

      if (this.options.rollback) {
        await this.performRollback();
        console.log('Rollback complete.');
        return;
      }

      if (this.options.clean) {
        await this.cleanDatabase();
      }

      await this.createMegaMemoryClient();
      await this.loadExistingConceptNames();
      await this.discoverReferencePatterns();
      await this.discoverTemplateSchemas();

      if (!this.options.dryRun) {
        await this.backupPlanningDir();
      }

      const planningFiles = await this.readPlanningFiles();

      await this.scanAllPlanningFiles(planningFiles);

      if (!this.options.dryRun) {
        await this.cleanAndWritePlanningFiles(planningFiles);
      }

      await this.migrateReferencePatterns();
      await this.migrateTemplateSchemas();
      await this.migrateProject(planningFiles);
      await this.migratePhases(planningFiles);
      await this.migrateResearch(planningFiles);
      await this.migrateTodos(planningFiles);

      await this.validateMigration();

      if (!this.options.dryRun) {
        console.log('Removing .planning/ directory...');
        await fs.remove(this.planningDir);
        console.log('.planning/ removed. Backup available at dot-planning.zip\n');
      }

      this.reportStats();
    } catch (error) {
      console.error('\nMigration failed:', error);
      throw error;
    }
  }

  private async backupPlanningDir(): Promise<void> {
    const zipPath = path.join(this.projectDir, 'dot-planning.zip');

    if (await fs.pathExists(zipPath)) {
      console.log('Backup already exists at dot-planning.zip');
      return;
    }

    console.log('Creating backup at dot-planning.zip...');
    execSync('zip -r dot-planning.zip .planning', { cwd: this.projectDir, stdio: 'pipe' });
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

    console.log(`Read ${files.phases.size} phases, ${files.research.size} research docs, ${files.todos.length} todos\n`);
    return files;
  }

  private async cleanAndWritePlanningFiles(planningFiles: PlanningFiles): Promise<void> {
    console.log('Cleaning and writing back planning files...');

    const processFile = async (filePath: string, content: string | null) => {
      if (!content) return;
      const cleaned = this.cleanYamlContent(content, filePath);
      if (cleaned !== content) {
        await fs.writeFile(filePath, cleaned, 'utf-8');
      }
    };

    if (planningFiles.project) {
      await processFile(path.join(this.planningDir, 'PROJECT.md'), planningFiles.project);
    }

    if (planningFiles.requirements) {
      await processFile(path.join(this.planningDir, 'REQUIREMENTS.md'), planningFiles.requirements);
    }

    if (planningFiles.roadmap) {
      await processFile(path.join(this.planningDir, 'ROADMAP.md'), planningFiles.roadmap);
    }

    if (planningFiles.state) {
      await processFile(path.join(this.planningDir, 'STATE.md'), planningFiles.state);
    }

    if (planningFiles.milestones) {
      await processFile(path.join(this.planningDir, 'MILESTONES.md'), planningFiles.milestones);
    }

    for (const [name, content] of planningFiles.milestoneRoadmaps) {
      await processFile(path.join(this.planningDir, 'milestones', `${name}-ROADMAP.md`), content);
    }

    for (const [phaseDir, phaseFiles] of planningFiles.phases) {
      if (phaseFiles.context) {
        await processFile(phaseFiles.context.path, phaseFiles.context.content);
      }

      for (const [planNum, fileData] of phaseFiles.plans) {
        await processFile(fileData.path, fileData.content);
      }

      if (phaseFiles.research) {
        await processFile(phaseFiles.research.path, phaseFiles.research.content);
      }

      for (const [summaryNum, fileData] of phaseFiles.summaries) {
        await processFile(fileData.path, fileData.content);
      }

      if (phaseFiles.uat) {
        await processFile(phaseFiles.uat.path, phaseFiles.uat.content);
      }
    }

    for (const [name, content] of planningFiles.research) {
      await processFile(path.join(this.planningDir, 'research', `${name}.md`), content);
    }

    console.log('Cleaning complete.\n');
  }

  private async readPhaseFiles(phasePath: string): Promise<PhaseFiles> {
    const files: PhaseFiles = {
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
        files.context = { content: await fs.readFile(file, 'utf-8'), path: file };
      } else if (basename.endsWith('-RESEARCH.md')) {
        files.research = { content: await fs.readFile(file, 'utf-8'), path: file };
      } else if (basename.endsWith('-UAT.md')) {
        files.uat = { content: await fs.readFile(file, 'utf-8'), path: file };
      } else if (basename.endsWith('-SUMMARY.md')) {
        const match = basename.match(/-(\d+)-SUMMARY\.md/);
        if (match) {
          files.summaries.set(parseInt(match[1]), { content: await fs.readFile(file, 'utf-8'), path: file });
        }
      } else if (basename.endsWith('-PLAN.md')) {
        files.plans.set(1, { content: await fs.readFile(file, 'utf-8'), path: file });
      } else {
        const match = basename.match(/-(\d+)-PLAN\.md/);
        if (match) {
          files.plans.set(parseInt(match[1]), { content: await fs.readFile(file, 'utf-8'), path: file });
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
        const mergedFiles = this.mergePhaseFiles(
          dirs.map(d => phases.get(d)!)
        );
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

    const projectData = this.parseProjectFile(files.project, files.config);

    const projectRoot = ProjectConceptTemplates.createProjectRoot(projectData);
    await this.createConcept(projectRoot);

    const requirementsModule = ProjectConceptTemplates.createRequirementsModule(projectData.slug);
    await this.createConcept(requirementsModule);

    if (files.requirements) {
      const requirements = this.parseRequirementsFile(files.requirements);
      for (const req of requirements) {
        const concept = ProjectConceptTemplates.createRequirement(
          projectData.slug,
          req.id,
          req.description,
          req.status
        );
        await this.createConcept(concept);
      }
    }

    const roadmapModule = ProjectConceptTemplates.createRoadmapModule(projectData.slug);
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
      const concept = ProjectConceptTemplates.createPhase(
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
      const concept = ProjectConceptTemplates.createState(projectData.slug, state);
      await this.createConcept(concept);
    }

    const config = ProjectConceptTemplates.createConfig(projectData.slug, files.config);
    await this.createConcept(config);

    if (files.milestones) {
      const milestonesModule = ProjectConceptTemplates.createMilestonesModule(projectData.slug);
      await this.createConcept(milestonesModule);

      const milestones = this.parseMilestonesFile(files.milestones);
      for (const milestone of milestones) {
        const concept = ProjectConceptTemplates.createMilestone(projectData.slug, milestone.name, milestone);
        await this.createConcept(concept);
      }
    }

    const todosModule = ProjectConceptTemplates.createTodosModule(projectData.slug);
    await this.createConcept(todosModule);

    const researchModule = ProjectConceptTemplates.createResearchModule(projectData.slug);
    await this.createConcept(researchModule);

    console.log('Project-level concepts migrated.\n');
  }

  private async migratePhases(files: PlanningFiles): Promise<void> {
    console.log('Migrating phase-level concepts...');

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
        const relativePath = phaseFiles.context.path.replace(/^.*\.planning\//, '.planning/');
        const contextData = this.parseContextFile(phaseFiles.context.content, relativePath);
        const concept = PhaseTemplates.createContext(phaseName, contextData);
        concept.parent_id = phaseParentId;
        await this.createConcept(concept);
      }

      for (const [planNum, fileData] of phaseFiles.plans) {
        const relativePath = fileData.path.replace(/^.*\.planning\//, '.planning/');
        const planData = this.parsePlanFile(fileData.content, relativePath);
        if (planData && Object.keys(planData).length > 0) {
          const concept = PhaseTemplates.createPlan(phaseName, planNum, planData);
          concept.parent_id = phaseParentId;
          concept.edges = [{ to: phaseParentId, relation: 'implements' as const }];
          await this.createConcept(concept);
        }
      }

      if (phaseFiles.research) {
        const relativePath = phaseFiles.research.path.replace(/^.*\.planning\//, '.planning/');
        const researchData = this.parseResearchFile(phaseFiles.research.content, relativePath);
        if (researchData && Object.keys(researchData).length > 0) {
          const concept = PhaseTemplates.createResearch(phaseName, researchData);
          concept.parent_id = phaseParentId;
          concept.edges = [{ to: phaseParentId, relation: 'connects_to' as const }];
          await this.createConcept(concept);
        }
      }

      for (const [summaryNum, fileData] of phaseFiles.summaries) {
        const relativePath = fileData.path.replace(/^.*\.planning\//, '.planning/');
        const summaryData = this.parseSummaryFile(fileData.content, relativePath);
        if (summaryData && Object.keys(summaryData).length > 0) {
          const concept = PhaseTemplates.createSummary(phaseName, summaryNum, summaryData);
          concept.parent_id = phaseParentId;
          concept.edges = [
            { to: makeId(`${phaseName}-plan-${summaryNum}`, phaseParentId), relation: 'connects_to' as const },
            { to: phaseParentId, relation: 'connects_to' as const }
          ];
          await this.createConcept(concept);
        }
      }

      if (phaseFiles.uat) {
        const relativePath = phaseFiles.uat.path.replace(/^.*\.planning\//, '.planning/');
        const uatData = this.parseUATFile(phaseFiles.uat.content, relativePath);
        if (uatData) {
          const concept = PhaseTemplates.createUAT(phaseName, uatData);
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

    const projectData = this.parseProjectFile(files.project, files.config);
    const researchParentId = makeId('research', projectData.slug);

    for (const [name, content] of files.research) {
      const relativePath = `.planning/research/${name}.md`;
      const researchData = this.parseResearchFile(content, relativePath);
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

      const phaseRefMatch = todoContent.match(/Phase:\s+(.+)$/m);
      const phaseRef = phaseRefMatch ? phaseRefMatch[1] : undefined;

      const concept = ProjectConceptTemplates.createTodo(projectData.slug, (i + 1).toString(), description, phaseRef);
      await this.createConcept(concept);
    }

    console.log('Todos migrated.\n');
  }

  private async createConcept(concept: any): Promise<void> {
    if (this.options.dryRun) {
      console.log(`[DRY-RUN] Would create concept: ${concept.name}`);
      this.stats.created++;
      return;
    }

    if (this.options.incremental && this.existingConceptNames.has(concept.name)) {
      console.log(`Skipping existing concept: ${concept.name}`);
      this.stats.skipped++;
      return;
    }

    try {
      const result = await this.megamemory.create_concept(concept);
      this.stats.created++;
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        try {
          const expectedId = makeId(concept.name, concept.parent_id);
          const changesWithoutEdges = { ...concept };
          delete changesWithoutEdges.edges;
          await this.megamemory.update_concept({ id: expectedId, changes: changesWithoutEdges });
          this.stats.updated++;
        } catch (updateError: any) {
          console.error(`Error updating concept ${concept.name}:`, updateError.message);
          this.stats.errors++;
        }
      } else if (error.message?.includes('does not exist') || error.message?.includes('not found')) {
        console.log(`Skipping concept ${concept.name} (parent doesn't exist yet)`);
        this.stats.skipped++;
      } else {
        console.error(`Error creating concept ${concept.name}:`, error.message);
        this.stats.errors++;
      }
    }
  }

  private async validateMigration(): Promise<void> {
    console.log('Validating migration...');

    if (this.options.dryRun) {
      console.log('[DRY-RUN] Would validate migration queries.');
      return;
    }

    const roots = await this.megamemory.list_roots();
    console.log(`Found ${roots.roots.length} root concepts`);

    const testQueries = [
      'project requirements',
      'roadmap phases',
      'state',
      'milestones',
      'todos',
      'research'
    ];

    for (const query of testQueries) {
      try {
        const result = await this.megamemory.understand({ query });
        if (result.matches.length > 0) {
          console.log(`  Query "${query}": ${result.matches.length} matches ✓`);
        } else {
          console.log(`  Query "${query}": No matches ⚠`);
        }
      } catch (error: any) {
        console.log(`  Query "${query}": Error - ${error.message.substring(0, 50)}...`);
      }
    }

    if (this.stats.referencePatternsMigrated > 0) {
      try {
        const patternResult = await this.megamemory.understand({ query: 'pattern:', top_k: 10 });
        console.log(`  Reference patterns: ${patternResult.matches.length} concepts`);
      } catch (error: any) {
        console.log(`  Reference patterns: Query error`);
      }
    }

    if (this.stats.templateSchemasMigrated > 0) {
      try {
        const schemaResult = await this.megamemory.understand({ query: 'schema:', top_k: 10 });
        console.log(`  Template schemas: ${schemaResult.matches.length} concepts`);
      } catch (error: any) {
        console.log(`  Template schemas: Query error`);
      }
    }

    console.log('Validation complete.\n');
  }

  private reportStats(): void {
    console.log('=== Migration Statistics ===');
    console.log(`Created: ${this.stats.created}`);
    console.log(`Updated: ${this.stats.updated}`);
    console.log(`Skipped: ${this.stats.skipped}`);
    console.log(`Errors: ${this.stats.errors}`);
    
    if (this.stats.referencePatternsMigrated > 0) {
      console.log(`\n=== Reference Patterns ===`);
      console.log(`Migrated: ${this.stats.referencePatternsMigrated}`);
    }
    
    if (this.stats.templateSchemasMigrated > 0) {
      console.log(`\n=== Template Schemas ===`);
      console.log(`Migrated: ${this.stats.templateSchemasMigrated}`);
    }
    
    if (this.stats.yamlErrors > 0 || this.stats.keysConvertedToLists > 0 ||
        this.stats.escapeSequencesFixed > 0 || this.stats.backticksQuoted > 0 ||
        this.stats.atSymbolsQuoted > 0 || this.stats.embeddedQuotesFixed > 0) {
      console.log('\n=== YAML Error Fixes ===');
      console.log(`Files with errors: ${this.stats.yamlErrors}`);
      console.log(`Files with duplicate keys: ${this.stats.filesWithDuplicates}`);
      console.log(`Keys converted to lists: ${this.stats.keysConvertedToLists}`);
      console.log(`Comma-separated values fixed: ${this.stats.commaSeparatedValuesFixed}`);
      console.log(`Escape sequences fixed: ${this.stats.escapeSequencesFixed}`);
      console.log(`Backticks quoted: ${this.stats.backticksQuoted}`);
      console.log(`@ symbols quoted: ${this.stats.atSymbolsQuoted}`);
      console.log(`Embedded quotes fixed: ${this.stats.embeddedQuotesFixed}`);
    }

    if (this.stats.filesScannedForDuplicates > 0) {
      console.log('\n=== Duplicate Key Scanning ===');
      console.log(`Files scanned: ${this.stats.filesScannedForDuplicates}`);
      console.log(`Files with duplicates detected: ${this.stats.filesWithDetectedDuplicates}`);
      console.log(`Files successfully converted: ${this.stats.filesSuccessfullyConverted}`);
      console.log(`Files skipped (no YAML error): ${this.stats.filesSkippedNoError}`);
      console.log(`Parse errors encountered: ${this.stats.parseErrorsEncountered}`);
    }
    
    if (this.stats.skippedDirectories > 0) {
      console.log(`\nSkipped directories: ${this.stats.skippedDirectories}`);
    }
    
    if (this.stats.phasesMerged > 0) {
      console.log(`\nPhases merged: ${this.stats.phasesMerged}`);
    }
    
    if (this.stats.rollbackPerformed) {
      console.log(`\nRollback performed: Yes`);
    }
    
    console.log('============================\n');
  }

  private parseProjectFile(content: string | null, config: any): ProjectData {
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
    const data: ProjectData = {
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

  private parseStateMarkdown(content: string): any {
    const result: any = {};

    const currentPosMatch = content.match(/## Current Position[\s\S]+?(?=##|$)/);
    if (currentPosMatch) {
      const section = currentPosMatch[0];

      const phaseMatch = section.match(/\*\*Phase:\*\*\s*(\d+)/);
      if (phaseMatch) {
        result.current_phase = `phase-${phaseMatch[1].padStart(2, '0')}`;
      }

      const statusMatch = section.match(/\*\*Status:\*\*\s*(\d+)\/(\d+)\s+plans\s+executed/);
      if (statusMatch) {
        const completed = parseInt(statusMatch[1]);
        const total = parseInt(statusMatch[2]);
        const phaseNumMatch = section.match(/\*\*Phase:\*\*\s*(\d+)/);
        const phaseNum = phaseNumMatch ? parseInt(phaseNumMatch[1]) : 1;
        result.current_plan = completed < total ? `phase-${phaseNum.toString().padStart(2, '0')}-01` : null;
        result.status = completed > 0 ? 'executing' : 'ready_to_plan';
      }

      const activityMatch = section.match(/\*\*Last Activity:\*\*\s*(.+)/);
      if (activityMatch) {
        result.last_activity = activityMatch[1].trim();
      }
    }

    const roadmapMatch = content.match(/\*\*Progress:\*\*[\s\S]+?```[\s\S]*?```/);
    if (roadmapMatch) {
      const progressText = roadmapMatch[0];
      const lines = progressText.split('\n');
      
      const milestoneLines = lines.filter((line: string) => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('Phase ') && trimmed.includes('%');
      });
      
      if (milestoneLines.length > 0) {
        const lastMilestone = milestoneLines[milestoneLines.length - 1];
        const percentMatch = lastMilestone.match(/(\d+)%/);
        if (percentMatch) {
          result.progress = parseInt(percentMatch[1]);
        }
      }
    }

    return {
      current_phase: result.current_phase || 'phase-01',
      current_plan: result.current_plan ?? null,
      status: result.status || 'ready_to_plan',
      progress: result.progress ?? 0,
      last_activity: result.last_activity || 'Migration from .planning'
    };
  }

  private parseStateFile(content: string): any {
    const jsonData = extractJson(content);
    if (jsonData && Object.keys(jsonData).length > 0) {
      return jsonData;
    }

    return this.parseStateMarkdown(content);
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

  private parseContextFile(content: string, filename: string): any {
    const cleaned = this.cleanYamlContent(content, filename);
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

  private parsePlanFile(content: string, filename: string): any {
    try {
      const cleaned = this.cleanYamlContent(content, filename);
      const parsed = matter(cleaned);
      return parsed.data || {};
    } catch (e: any) {
      this.stats.yamlErrors++;
      console.warn(`Failed to parse YAML in ${filename}: ${e.message}`);
      return {};
    }
  }

  private parseResearchFile(content: string, filename: string): any {
    try {
      const cleaned = this.cleanYamlContent(content, filename);
      const parsed = matter(cleaned);
      return parsed.data || {};
    } catch (e: any) {
      this.stats.yamlErrors++;
      console.warn(`Failed to parse YAML in ${filename}: ${e.message}`);
      return {};
    }
  }

  private parseSummaryFile(content: string, filename: string): any {
    try {
      const cleaned = this.cleanYamlContent(content, filename);
      const parsed = matter(cleaned);
      return parsed.data || {};
    } catch (e: any) {
      this.stats.yamlErrors++;
      console.warn(`Failed to parse YAML in summary file: ${e.message}`);
      return {};
    }
  }

  private parseUATFile(content: string, filename: string): any {
    try {
      const cleaned = this.cleanYamlContent(content, filename);
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
      console.warn(`Failed to parse YAML in ${filename}: ${e.message}`);
      return {
        verification_results: [],
        issues_found: [],
        recommendations: [],
        concepts_reviewed: []
      };
    }
  }
}

export class MigrationValidator {
  static async validateMigration(
    megamemoryClient: MegaMemoryClient,
    expectedConcepts: Set<string>
  ): Promise<{ valid: boolean; missing: string[]; extra: string[] }> {
    const missing: string[] = [];
    const extra: string[] = [];

    const roots = await megamemoryClient.list_roots();
    const foundConcepts = new Set<string>();

    for (const root of roots.roots) {
      foundConcepts.add(root.name);
    }

    for (const expected of expectedConcepts) {
      if (!foundConcepts.has(expected)) {
        missing.push(expected);
      }
    }

    for (const found of foundConcepts) {
      if (!expectedConcepts.has(found)) {
        extra.push(found);
      }
    }

    return {
      valid: missing.length === 0,
      missing,
      extra
    };
  }
}

export async function runMigration(options: Partial<MigrationOptions> = {}): Promise<void> {
  const fullOptions: MigrationOptions = {
    projectDir: options.projectDir || process.cwd(),
    megamemoryPath: options.megamemoryPath || '.megamemory',
    clean: options.clean || false,
    incremental: options.incremental || false,
    dryRun: options.dryRun || false,
    rollback: options.rollback || false,
    debug: options.debug || false
  };

  const migration = new EnhancedPlanningToMegaMemoryMigration(fullOptions);
  await migration.migrate();
}

function printHelp(): void {
  console.log(`Usage: npx ts-node gsd-mm/migration/enhanced-migration.ts [options] <project-dir>

 Options:
   --clean                Delete existing MegaMemory database before migrating
   --incremental          Only migrate new concepts (skip existing)
   --dry-run              Show what would be created without making changes
   --debug                Enable detailed debug logging for duplicate key scanning
   --rollback             Restore .planning/ from backup and remove database
   --megamemory <path>    Custom MegaMemory database path (default: .megamemory)
   -h, --help             Show this help message

 Arguments:
   <project-dir>          Path to the project containing .planning/ directory

 Examples:
   npx ts-node gsd-mm/migration/enhanced-migration.ts /path/to/project
   npx ts-node gsd-mm/migration/enhanced-migration.ts --clean /path/to/project
   npx ts-node gsd-mm/migration/enhanced-migration.ts --dry-run /path/to/project
   npx ts-node gsd-mm/migration/enhanced-migration.ts --debug --dry-run /path/to/project`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const options: MigrationOptions = {
    projectDir: '',
    megamemoryPath: '.megamemory',
    clean: false,
    incremental: false,
    dryRun: false,
    rollback: false,
    debug: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (!arg.startsWith('--') && !arg.startsWith('-')) {
      options.projectDir = arg;
    } else if (arg === '--clean') {
      options.clean = true;
    } else if (arg === '--incremental') {
      options.incremental = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--debug') {
      options.debug = true;
    } else if (arg === '--rollback') {
      options.rollback = true;
    } else if (arg === '--megamemory' && args[i + 1]) {
      options.megamemoryPath = args[++i];
    }
  }

  if (!options.projectDir) {
    console.error('Error: <project-dir> argument is required.\n');
    printHelp();
    process.exit(1);
  }

  console.log(`Migrating project at: ${options.projectDir}`);
  console.log(`MegaMemory path: ${options.megamemoryPath}`);
  console.log('');

  const migration = new EnhancedPlanningToMegaMemoryMigration(options);

  try {
    await migration.migrate();
    if (!options.dryRun && !options.rollback) {
      console.log('Migration completed successfully!');
      console.log('\nTo rollback, run:');
      console.log(`  npx ts-node gsd-mm/migration/enhanced-migration.ts --rollback ${options.projectDir}`);
    } else if (options.dryRun) {
      console.log('Dry-run completed. No changes were made.');
    } else if (options.rollback) {
      console.log('Rollback completed successfully!');
    }
  } catch (error) {
    console.error('\nMigration failed. Backup is available at dot-planning.zip');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
