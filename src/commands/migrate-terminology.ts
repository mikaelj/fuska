import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';

class TerminologyMigration {
  private db: any;
  private stats = { renamed: 0, updated: 0, edgesFixed: 0 };

  constructor(db: any) {
    this.db = db;
  }

  private replaceText(text: string): string {
    return text
      // Specific compound tokens first (avoid partial replacements)
      .replace(/fuska-phase-researcher/g, 'fuska-chapter-researcher')
      .replace(/fuska-plan-phase/g, 'fuska-plan-chapter')
      .replace(/fuska-build-phase/g, 'fuska-build-chapter')
      .replace(/fuska-design-phase/g, 'fuska-design-chapter')
      .replace(/fuska-add-phase/g, 'fuska-add-chapter')
      .replace(/fuska-remove-phase/g, 'fuska-remove-chapter')
      .replace(/fuska-insert-phase/g, 'fuska-insert-chapter')
      .replace(/fuska-research-phase/g, 'fuska-research-chapter')
      .replace(/fuska-review-phase/g, 'fuska-review-chapter')
      .replace(/fuska-list-phase-assumptions/g, 'fuska-list-chapter-assumptions')
      .replace(/phase_boundary/g, 'chapter_boundary')
      .replace(/next_phase_readiness/g, 'next_chapter_readiness')
      .replace(/current_phase/g, 'current_chapter')
      .replace(/phase_complete/g, 'chapter_complete')
      .replace(/PhaseConceptTemplates/g, 'ChapterConceptTemplates')
      .replace(/PhaseContextData/g, 'ChapterContextData')
      .replace(/Phase/g, 'Chapter')
      .replace(/PHASE/g, 'CHAPTER')
      .replace(/phase/g, 'chapter')
      .replace(/Wave/g, 'Batch')
      .replace(/WAVE/g, 'BATCH')
      .replace(/wave/g, 'batch');
  }

  async migrate(): Promise<void> {
    const allNodes: any[] = this.db.getAllActiveNodes();

    // Pass 1: Rename concept IDs that contain "phase" or "wave" in the ID
    const idRenames = new Map<string, string>();
    for (const node of allNodes) {
      const newId = this.replaceText(node.id);
      if (newId !== node.id) {
        try {
          this.db.renameNodeId(node.id, newId);
          idRenames.set(node.id, newId);
          this.stats.renamed++;
        } catch (err) {
          console.warn(`  Warning: could not rename node ID ${node.id} → ${newId}: ${err}`);
        }
      }
    }

    // Pass 2: Update node content (name, summary, why) for ALL nodes
    const updatedNodes: any[] = this.db.getAllActiveNodes();
    for (const node of updatedNodes) {
      const newName = this.replaceText(node.name);
      const newSummary = node.summary ? this.replaceText(node.summary) : node.summary;
      const newWhy = node.why ? this.replaceText(node.why) : node.why;

      if (newName !== node.name || newSummary !== node.summary || newWhy !== node.why) {
        const changes: Record<string, string> = {};
        if (newName !== node.name) changes.name = newName;
        if (newSummary !== node.summary) changes.summary = newSummary;
        if (newWhy !== node.why) changes.why = newWhy;

        try {
          this.db.updateNode(node.id, changes);
          this.stats.updated++;
        } catch (err) {
          console.warn(`  Warning: could not update node ${node.id}: ${err}`);
        }
      }
    }

    // Pass 3: Fix edges whose to_id/from_id contain old IDs
    try {
      const allEdges: any[] = this.db.getAllEdges ? this.db.getAllEdges() : [];
      for (const edge of allEdges) {
        const newFrom = idRenames.get(edge.from_id);
        const newTo = idRenames.get(edge.to_id);
        if (newFrom || newTo) {
          try {
            this.db.deleteEdge(edge.from_id, edge.to_id, edge.relation);
            this.db.insertEdge({
              from_id: newFrom ?? edge.from_id,
              to_id: newTo ?? edge.to_id,
              relation: edge.relation,
              description: edge.description ?? undefined,
            });
            this.stats.edgesFixed++;
          } catch (err) {
            console.warn(`  Warning: could not fix edge ${edge.from_id} → ${edge.to_id}: ${err}`);
          }
        }
      }
    } catch (err) {
      console.warn(`  Warning: edge migration skipped (getAllEdges not available): ${err}`);
    }
  }

  getStats() {
    return this.stats;
  }
}

export function migrateTerminologyCommand(program: Command) {
  program
    .command('terminology [project-dir]')
    .description('Rename phase→chapter and wave→batch in MegaMemory database')
    .action(async (projectDir: string = '.') => {
      const resolvedPath = path.resolve(projectDir);
      const dbPath = path.join(resolvedPath, '.megamemory', 'knowledge.db');

      if (!await fs.pathExists(dbPath)) {
        console.error(`No .megamemory/knowledge.db found at ${resolvedPath}`);
        console.error('Run fuska init first, or specify the correct project directory.');
        process.exit(1);
      }

      console.log(`Migrating terminology in: ${dbPath}`);
      console.log('Renaming: phase → chapter, wave → batch\n');

      const { KnowledgeDB } = await import('megamemory/dist/db.js');
      const db = new KnowledgeDB(dbPath);

      const migration = new TerminologyMigration(db);
      await migration.migrate();

      const stats = migration.getStats();
      console.log('\nMigration complete:');
      console.log(`  IDs renamed:   ${stats.renamed}`);
      console.log(`  Nodes updated: ${stats.updated}`);
      console.log(`  Edges fixed:   ${stats.edgesFixed}`);
    });
}
