import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';

class StatusMigration {
  private db: any;
  private stats = { updated: 0, skipped: 0 };

  // Map of old status value → new status value
  private static STATUS_MAP: Record<string, string> = {
    'not_planned': 'pending',
    'ready_for_planning': 'planned',
    'completed': 'complete',
    'done': 'complete',
    'shipped': 'complete',
    'validated': 'complete',
    'active': 'in_progress',
    'executing': 'in_progress',
    'not_started': 'pending',
    'archived': 'skipped',
    'planning': 'in_progress',
    'open': 'gathering',
    'spawned': 'in_progress',
    'Ready to plan': 'ready_to_plan',
    'Not started': 'pending',
    'In progress': 'in_progress',
    'Complete': 'complete',
    'Chapter complete': 'chapter_complete',
  };

  constructor(db: any) {
    this.db = db;
  }

  private migrateValue(obj: any): boolean {
    let changed = false;

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        if (typeof obj[i] === 'object' && obj[i] !== null) {
          if (this.migrateValue(obj[i])) changed = true;
        }
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (key === 'status' && typeof val === 'string' && val in StatusMigration.STATUS_MAP) {
          obj[key] = StatusMigration.STATUS_MAP[val];
          changed = true;
        } else if (typeof val === 'object' && val !== null) {
          if (this.migrateValue(val)) changed = true;
        }
      }
    }

    return changed;
  }

  private migrateStatusValues(summary: string): string {
    // Try to extract leading JSON (same pattern as extractJson in helpers.ts)
    const start = summary.indexOf('{');
    const end = summary.lastIndexOf('}');

    if (start !== -1 && end !== -1 && end > start) {
      const jsonStr = summary.substring(start, end + 1);
      const tail = summary.substring(end + 1);
      const head = summary.substring(0, start);

      try {
        const parsed = JSON.parse(jsonStr);
        if (this.migrateValue(parsed)) {
          return head + JSON.stringify(parsed, null, 2) + tail;
        }
        return summary;
      } catch {
        // JSON parse failed — fall through to regex
      }
    }

    // Fallback: regex replacement for "status":"old_value" patterns
    let result = summary;
    for (const [oldVal, newVal] of Object.entries(StatusMigration.STATUS_MAP)) {
      const escaped = oldVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(
        new RegExp(`("status"\\s*:\\s*")${escaped}(")`,'g'),
        `$1${newVal}$2`
      );
    }
    return result;
  }

  async migrate(): Promise<void> {
    const allNodes: any[] = this.db.getAllActiveNodes();

    for (const node of allNodes) {
      if (!node.summary) {
        this.stats.skipped++;
        continue;
      }

      const newSummary = this.migrateStatusValues(node.summary);
      if (newSummary !== node.summary) {
        try {
          this.db.updateNode(node.id, { summary: newSummary });
          this.stats.updated++;
        } catch (err) {
          console.warn(`  Warning: could not update node ${node.id}: ${err}`);
        }
      } else {
        this.stats.skipped++;
      }
    }
  }

  getStats() {
    return this.stats;
  }
}

export function migrateStatusesCommand(program: Command) {
  program
    .command('statuses [project-dir]')
    .description('Migrate old status values (validated→complete, active→in_progress, etc.) in MegaMemory database')
    .action(async (projectDir: string = '.') => {
      const resolvedPath = path.resolve(projectDir);
      const dbPath = path.join(resolvedPath, '.megamemory', 'knowledge.db');

      if (!await fs.pathExists(dbPath)) {
        console.error(`No .megamemory/knowledge.db found at ${resolvedPath}`);
        console.error('Run fuska init first, or specify the correct project directory.');
        process.exit(1);
      }

      console.log(`Migrating status values in: ${dbPath}`);
      console.log('Replacing old status values with consolidated values\n');

      const { KnowledgeDB } = await import('megamemory/dist/db.js');
      const db = new KnowledgeDB(dbPath);

      const migration = new StatusMigration(db);
      await migration.migrate();

      const stats = migration.getStats();
      console.log('\nMigration complete:');
      console.log(`  Nodes updated: ${stats.updated}`);
      console.log(`  Nodes that didn't have to be changed: ${stats.skipped}`);
    });
}
