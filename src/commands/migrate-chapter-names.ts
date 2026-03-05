import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import { KnowledgeDB } from 'megamemory/dist/db.js';
import { understand, updateConcept, createConcept, removeConcept, link } from 'megamemory/dist/tools.js';
import type { RelationType } from 'megamemory/dist/types.js';

interface MigrationReport {
  backup_path: string;
  chapters_renamed: number;
  slugs_updated: number;
  parent_ids_updated: number;
  edges_updated: number;
  state_updated: boolean;
  roadmap_updated: boolean;
  verification_passed: boolean;
  renames: Array<{ old: string; new: string }>;
  errors: string[];
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function updateSlugInSummary(summary: string, renames: Map<string, string>): string | null {
  // Try JSON parse first
  try {
    const data = JSON.parse(summary);
    let changed = false;
    
    // Update slug field if it matches old chapter pattern
    if (data.slug && /^chapter-\d-/.test(data.slug)) {
      const oldSlug = data.slug;
      data.slug = data.slug.replace(
        /^chapter-(\d)-/,
        (_: string, num: string) => `chapter-${num.padStart(2, '0')}-`
      );
      if (oldSlug !== data.slug) {
        changed = true;
      }
    }
    
    // Also update any string fields that might contain chapter references
    for (const key of Object.keys(data)) {
      if (typeof data[key] === 'string' && /^chapter-\d/.test(data[key])) {
        const oldValue = data[key];
        data[key] = data[key].replace(
          /chapter-(\d)/g,
          (_: string, num: string) => `chapter-${num.padStart(2, '0')}`
        );
        if (oldValue !== data[key]) {
          changed = true;
        }
      }
    }
    
    if (changed) {
      return JSON.stringify(data);
    }
    return null; // No changes needed
  } catch (e) {
    // Not JSON - use regex text replacement
  }
  
  // Fallback: regex text replacement for non-JSON summaries
  const oldSummary = summary;
  const newSummary = summary.replace(
    /chapter-(\d)(?!-\d)/g,
    (_: string, num: string) => `chapter-${num.padStart(2, '0')}`
  );
  
  return oldSummary === newSummary ? null : newSummary;
}

class ChapterNamesMigration {
  private db: any;
  private projectDir: string;
  private dryRun: boolean;
  private report: MigrationReport = {
    backup_path: '',
    chapters_renamed: 0,
    slugs_updated: 0,
    parent_ids_updated: 0,
    edges_updated: 0,
    state_updated: false,
    roadmap_updated: false,
    verification_passed: false,
    renames: [],
    errors: []
  };

  constructor(db: any, projectDir: string, dryRun: boolean) {
    this.db = db;
    this.projectDir = projectDir;
    this.dryRun = dryRun;
  }

  async run(): Promise<MigrationReport> {
    console.log('Starting chapter names migration...\n');
    
    if (this.dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made\n');
    }

    await this.createBackup();

    console.log('Loading concepts...');
    const allConcepts = await understand(this.db, { query: 'chapter concept initiative roadmap state plan summary context research', top_k: 10000 });
    console.log(`Loaded ${allConcepts.matches?.length || 0} concepts\n`);

    const chaptersToRename = this.detectChaptersToRename(allConcepts.matches || []);
    console.log(`Found ${chaptersToRename.length} chapters to rename\n`);

    if (chaptersToRename.length === 0) {
      console.log('No chapters need renaming. Database already compliant.');
      this.report.verification_passed = true;
      return this.report;
    }

    const renames = new Map<string, string>();
    for (const chapter of chaptersToRename) {
      const match = chapter.name.match(/^chapter-(\d)$/);
      if (match) {
        const newName = `chapter-${match[1].padStart(2, '0')}`;
        renames.set(chapter.name, newName);
        this.report.renames.push({ old: chapter.name, new: newName });
        console.log(`  ${chapter.name} → ${newName}`);
      }
    }
    console.log('');

    await this.renameChapters(chaptersToRename, renames);
    await this.updateSlugs(chaptersToRename);
    await this.updateParentIds(allConcepts.matches || [], renames);
    await this.updateEdges(allConcepts.matches || [], renames);
    await this.updateState(renames);
    await this.updateRoadmap(renames);
    await this.verify();

    return this.report;
  }

  private async createBackup(): Promise<void> {
    if (this.dryRun) {
      console.log('[DRY RUN] Would create backup of knowledge.db\n');
      return;
    }

    const dbPath = path.join(this.projectDir, '.megamemory', 'knowledge.db');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupPath = `${dbPath}.backup-${timestamp}`;

    if (await fs.pathExists(dbPath)) {
      await fs.copy(dbPath, backupPath);
      this.report.backup_path = backupPath;
      console.log(`✓ Backup created: ${backupPath}\n`);
    } else {
      this.report.errors.push('Database file not found');
    }
  }

  private detectChaptersToRename(matches: any[]): any[] {
    return matches.filter(c => 
      /^chapter-\d$/.test(c.name) &&
      c.kind === 'feature'
    );
  }

  private async renameChapters(chapters: any[], renames: Map<string, string>): Promise<void> {
    console.log('Renaming chapter concepts...');
    
    for (const chapter of chapters) {
      const newName = renames.get(chapter.name);
      if (!newName) continue;

      if (this.dryRun) {
        console.log(`[DRY RUN] Would rename: ${chapter.name} → ${newName}`);
      } else {
        await updateConcept(this.db, {
          id: chapter.id,
          changes: { name: newName }
        });
        console.log(`✓ Renamed: ${chapter.name} → ${newName}`);
      }
      this.report.chapters_renamed++;
    }
    console.log('');
  }

  private async updateSlugs(chapters: any[]): Promise<void> {
    console.log('Updating slug fields in summaries...');
    
    for (const chapter of chapters) {
      const updatedSummary = updateSlugInSummary(chapter.summary, new Map());
      
      if (updatedSummary) {
        if (this.dryRun) {
          console.log(`[DRY RUN] Would update summary for ${chapter.name}`);
        } else {
          await updateConcept(this.db, {
            id: chapter.id,
            changes: { summary: updatedSummary }
          });
          console.log(`✓ Updated summary for ${chapter.name}`);
        }
        this.report.slugs_updated++;
      }
    }
    console.log('');
  }

  private async updateParentIds(matches: any[], renames: Map<string, string>): Promise<void> {
    console.log('Updating parent_id references...');
    
    const childrenToUpdate = matches.filter(c => c.parent_id && renames.has(c.parent_id));
    
    if (childrenToUpdate.length === 0) {
      console.log('No parent_id references to update\n');
      return;
    }
    
    for (const child of childrenToUpdate) {
      const newParentId = renames.get(child.parent_id!);
      
      if (this.dryRun) {
        console.log(`[DRY RUN] Would recreate ${child.name} with parent_id: ${child.parent_id} → ${newParentId}`);
        this.report.parent_ids_updated++;
        continue;
      }
      
      try {
        // Create new concept with updated parent_id
        const newConcept = {
          name: child.name,
          kind: child.kind,
          summary: child.summary,
          parent_id: newParentId,
          edges: child.edges || []
        };
        
        await createConcept(this.db, newConcept);
        
        // Remove old concept
        await removeConcept(this.db, { 
          id: child.id, 
          reason: `Recreated with updated parent_id: ${child.parent_id} → ${newParentId}` 
        });
        
        console.log(`✓ Recreated ${child.name} with parent_id: ${child.parent_id} → ${newParentId}`);
        this.report.parent_ids_updated++;
      } catch (e: any) {
        console.error(`✗ Failed to update parent_id for ${child.name}: ${e.message}`);
        this.report.errors.push(`Failed to update parent_id for ${child.name}: ${e.message}`);
      }
    }
    console.log('');
  }

  private async updateEdges(matches: any[], renames: Map<string, string>): Promise<void> {
    console.log('Updating edge references...');
    
    // Build a map of all edges that need to be recreated
    const edgesToRecreate: Array<{from: string; to: string; newTo: string; relation: string; description?: string}> = [];
    
    // Find all edges pointing to old chapter names
    for (const concept of matches) {
      if (!concept.edges || concept.edges.length === 0) continue;
      
      for (const edge of concept.edges) {
        if (renames.has(edge.to)) {
          edgesToRecreate.push({
            from: concept.name,
            to: edge.to,
            newTo: renames.get(edge.to)!,
            relation: edge.relation,
            description: edge.description
          });
        }
      }
    }
    
    if (edgesToRecreate.length === 0) {
      console.log('No edge references to update\n');
      return;
    }
    
    if (this.dryRun) {
      console.log(`[DRY RUN] Would update ${edgesToRecreate.length} edge references:`);
      edgesToRecreate.forEach(e => {
        console.log(`  ${e.from} -> ${e.to} → ${e.newTo}`);
      });
      this.report.edges_updated = edgesToRecreate.length;
      console.log('');
      return;
    }
    
    // Group edges by source concept to avoid recreating concepts multiple times
    const edgesByConcept = new Map<string, Array<{to: string; newTo: string; relation: string; description?: string}>>();
    
    for (const edgeRef of edgesToRecreate) {
      if (!edgesByConcept.has(edgeRef.from)) {
        edgesByConcept.set(edgeRef.from, []);
      }
      edgesByConcept.get(edgeRef.from)!.push({
        to: edgeRef.to,
        newTo: edgeRef.newTo,
        relation: edgeRef.relation,
        description: edgeRef.description
      });
    }
    
    // Recreate each concept once with ALL edges updated
    for (const [conceptName, edgesToUpdate] of edgesByConcept) {
      const concept = matches.find(c => c.name === conceptName);
      if (!concept) {
        console.error(`✗ Concept ${conceptName} not found`);
        continue;
      }
      
      try {
        // Update ALL edges at once
        const updatedEdges = concept.edges.map((e: any) => {
          const update = edgesToUpdate.find(u => u.to === e.to);
          if (update) {
            return { ...e, to: update.newTo };
          }
          return e;
        });
        
        // Single recreation per concept
        const newConcept = {
          name: concept.name,
          kind: concept.kind,
          summary: concept.summary,
          parent_id: concept.parent_id,
          edges: updatedEdges
        };
        
        await createConcept(this.db, newConcept);
        await removeConcept(this.db, {
          id: concept.id,
          reason: `Recreated with ${edgesToUpdate.length} updated edges`
        });
        
        console.log(`✓ Updated ${edgesToUpdate.length} edges in ${conceptName}`);
        this.report.edges_updated += edgesToUpdate.length;
      } catch (e: any) {
        console.error(`✗ Failed to update edges in ${conceptName}: ${e.message}`);
        this.report.errors.push(`Failed to update edges in ${conceptName}: ${e.message}`);
      }
    }
    console.log('');
  }

  private async updateState(renames: Map<string, string>): Promise<void> {
    console.log('Updating state concept...');
    
    const stateResult = await understand(this.db, { query: 'state', top_k: 1 });
    
    if (stateResult.matches && stateResult.matches.length > 0) {
      const state = stateResult.matches[0];
      
      // Try JSON parse with fallback to text replacement
      const updatedSummary = updateSlugInSummary(state.summary, renames);
      
      if (updatedSummary) {
        if (this.dryRun) {
          console.log(`[DRY RUN] Would update state summary`);
        } else {
          await updateConcept(this.db, {
            id: state.id,
            changes: { summary: updatedSummary }
          });
          console.log(`✓ Updated state summary`);
        }
        this.report.state_updated = true;
      } else {
        console.log('No state updates needed');
      }
    } else {
      console.log('No state concept found');
    }
    console.log('');
  }

  private async updateRoadmap(renames: Map<string, string>): Promise<void> {
    console.log('Updating roadmap concept...');
    
    const roadmapResult = await understand(this.db, { query: 'roadmap', top_k: 1 });
    
    if (roadmapResult.matches && roadmapResult.matches.length > 0) {
      const roadmap = roadmapResult.matches[0];
      
      // Try JSON parse with fallback to text replacement
      const updatedSummary = updateSlugInSummary(roadmap.summary, renames);
      
      if (updatedSummary) {
        if (this.dryRun) {
          console.log(`[DRY RUN] Would update roadmap summary`);
        } else {
          await updateConcept(this.db, {
            id: roadmap.id,
            changes: { summary: updatedSummary }
          });
          console.log(`✓ Updated roadmap summary`);
        }
        this.report.roadmap_updated = true;
      } else {
        console.log('No roadmap updates needed');
      }
    } else {
      console.log('No roadmap concept found');
    }
    console.log('');
  }

  private async verify(): Promise<void> {
    console.log('Running verification...\n');

    if (this.dryRun) {
      console.log('[DRY RUN] Skipping verification (no changes made)');
      return;
    }

    const verifyConcepts = await understand(this.db, { query: 'chapter concept initiative roadmap state plan summary context research', top_k: 10000 });
    const allNames = new Set(verifyConcepts.matches?.map((c: any) => c.name) || []);

    const badChapters = verifyConcepts.matches?.filter((c: any) =>
      /^chapter-\d$/.test(c.name) && c.kind === 'feature'
    ) || [];

    if (badChapters.length > 0) {
      this.report.errors.push(`Verification failed: ${badChapters.length} chapters still have non-padded names`);
      console.log(`❌ Found ${badChapters.length} non-padded chapters`);
    } else {
      console.log('✓ No non-padded chapter names found');
    }

    const danglingParents = verifyConcepts.matches?.filter((c: any) =>
      c.parent_id && !allNames.has(c.parent_id)
    ) || [];

    if (danglingParents.length > 0) {
      console.log(`❌ Found ${danglingParents.length} dangling parent_id references:`);
      danglingParents.forEach((c: any) => {
        console.log(`    ${c.name} -> parent_id: ${c.parent_id} (missing)`);
      });
      this.report.errors.push(`Verification failed: ${danglingParents.length} dangling parent_id references`);
    } else {
      console.log('✓ No dangling parent_id references');
    }

    const danglingEdges: Array<{ from: string; to: string }> = [];
    for (const concept of verifyConcepts.matches || []) {
      for (const edge of concept.edges || []) {
        if (!allNames.has(edge.to)) {
          danglingEdges.push({ from: concept.name, to: edge.to });
        }
      }
    }

    if (danglingEdges.length > 0) {
      console.log(`❌ Found ${danglingEdges.length} dangling edge references:`);
      danglingEdges.forEach(e => {
        console.log(`    ${e.from} -> ${e.to} (missing)`);
      });
      this.report.errors.push(`Verification failed: ${danglingEdges.length} dangling edge references`);
    } else {
      console.log('✓ No dangling edge references');
    }

    this.report.verification_passed = 
      badChapters.length === 0 && 
      danglingParents.length === 0 && 
      danglingEdges.length === 0;

    if (this.report.verification_passed) {
      console.log('\n✅ Verification PASSED');
    } else {
      console.log('\n❌ Verification FAILED');
    }
  }
}

export function migrateChapterNamesCommand(program: Command) {
  program
    .command('chapter-names')
    .description('Migrate chapter concept names to zero-padded format (chapter-01, chapter-02, etc.)')
    .option('--dry-run', 'Show what would change without updating MegaMemory')
    .option('--json', 'Output migration report as JSON')
    .option('--verify-only', 'Check for naming issues without fixing')
    .action(async (options) => {
      const hasDryRunFlag = options.dryRun || false;
      const hasJsonFlag = options.json || false;
      const hasVerifyOnlyFlag = options.verifyOnly || false;

      const projectDir = process.cwd();
      const megamemoryPath = path.join(projectDir, '.megamemory', 'knowledge.db');

      if (!await fs.pathExists(megamemoryPath)) {
        console.error('Error: No MegaMemory database found');
        console.error('Suggestion: Run "fuska init" first');
        process.exit(1);
      }

      const db = new KnowledgeDB(megamemoryPath);

      try {
        if (hasVerifyOnlyFlag) {
          console.log('Verify-only mode: Checking for naming issues...\n');
          const allConcepts = await understand(db, { query: 'chapter concept initiative roadmap state plan summary context research', top_k: 10000 });
          const badChapters = allConcepts.matches?.filter((c: any) =>
            /^chapter-\d$/.test(c.name) && c.kind === 'feature'
          ) || [];

          if (badChapters.length === 0) {
            console.log('✓ All chapter names are properly zero-padded');
          } else {
            console.log(`Found ${badChapters.length} chapters with non-padded names:`);
            badChapters.forEach((c: any) => {
              const match = c.name.match(/^chapter-(\d)$/);
              if (match) {
                console.log(`  ${c.name} (should be chapter-${match[1].padStart(2, '0')})`);
              }
            });
          }

          const allNames = new Set(allConcepts.matches?.map((c: any) => c.name) || []);
          const danglingParents = allConcepts.matches?.filter((c: any) =>
            c.parent_id && !allNames.has(c.parent_id)
          ) || [];

          if (danglingParents.length > 0) {
            console.log(`\n⚠ Found ${danglingParents.length} dangling parent_id references`);
          }

          process.exit(0);
        }

        const migration = new ChapterNamesMigration(db, projectDir, hasDryRunFlag);
        const report = await migration.run();

        if (hasJsonFlag) {
          console.log(JSON.stringify(report, null, 2));
        } else {
          console.log('\n=== Migration Summary ===');
          console.log(`Chapters renamed: ${report.chapters_renamed}`);
          console.log(`Slugs updated: ${report.slugs_updated}`);
          console.log(`Parent IDs updated: ${report.parent_ids_updated}`);
          console.log(`Edges updated: ${report.edges_updated}`);
          console.log(`State updated: ${report.state_updated}`);
          console.log(`Roadmap updated: ${report.roadmap_updated}`);
          console.log(`Verification passed: ${report.verification_passed}`);
          
          if (report.renames.length > 0) {
            console.log('\nRenames:');
            report.renames.forEach(r => console.log(`  ${r.old} → ${r.new}`));
          }

          if (report.errors.length > 0) {
            console.log('\nErrors:');
            report.errors.forEach(e => console.log(`  - ${e}`));
          }

          if (report.backup_path) {
            console.log(`\nBackup: ${report.backup_path}`);
          }
        }

        if (!report.verification_passed && !hasDryRunFlag) {
          process.exit(1);
        }

      } catch (error: any) {
        console.error('Migration failed:', error.message);
        if (hasJsonFlag) {
          console.log(JSON.stringify({ error: error.message }, null, 2));
        }
        process.exit(1);
      }
    });
}
