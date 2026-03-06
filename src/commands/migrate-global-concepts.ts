import { Command } from 'commander';
import { KnowledgeDB } from 'megamemory/dist/db.js';
import * as fs from 'fs-extra';
import * as path from 'path';

export function migrateGlobalConceptsCommand(program: Command) {
  program
    .command('global-concepts')
    .description('Migrate codebase and research concepts to top-level (parent_id: null)')
    .option('--dry-run', 'Preview changes without applying them')
    .option('--backup', 'Create backup before migration (default: true)', true)
    .option('--no-backup', 'Skip backup creation')
    .option('--restore <backup>', 'Restore from a backup file')
    .action(async (options) => {
      const dbPath = process.env.MEGAMEMORY_DB_PATH || path.join(process.cwd(), '.megamemory', 'knowledge.db');
      
      if (!await fs.pathExists(dbPath)) {
        console.error('MegaMemory database not found at:', dbPath);
        console.error('Run this command from a project with an initialized MegaMemory database.');
        process.exit(1);
      }

      if (options.restore) {
        await restoreBackup(options.restore, dbPath);
        return;
      }

      const db = new KnowledgeDB(dbPath);
      
      try {
        await performMigration(db, options);
      } finally {
        db.close();
      }
    });
}

async function performMigration(db: KnowledgeDB, options: any) {
  console.log('Migrating global concepts to top-level...\n');

  const dryRun = options.dryRun;
  const createBackup = options.backup && !dryRun;

  if (dryRun) {
    console.log('DRY RUN MODE - No changes will be applied\n');
  }

  const globalConceptPatterns = [
    { pattern: /^codebase-/, type: 'codebase' },
    { pattern: /^domain-/, type: 'domain' },
    { pattern: /-research$/, type: 'research' },
    { pattern: /^file:/, type: 'import-graph' },
    { pattern: /^symbol:/, type: 'import-graph' },
    { pattern: /^dead-code:/, type: 'import-graph' }
  ];

  const allNodes = db.getAllNodesRaw();
  const nodesToMigrate: any[] = [];

  console.log(`Scanning ${allNodes.length} concepts...\n`);

  for (const node of allNodes) {
    if (node.parent_id === null) {
      continue;
    }

    const isGlobal = globalConceptPatterns.some(({ pattern }) => pattern.test(node.name));
    
    if (isGlobal) {
      nodesToMigrate.push({
        id: node.id,
        name: node.name,
        kind: node.kind,
        parent_id: node.parent_id
      });
    }
  }

  if (nodesToMigrate.length === 0) {
    console.log('✓ No concepts need migration - all global concepts already at top level.');
    return;
  }

  console.log(`Found ${nodesToMigrate.length} concepts to migrate:\n`);

  const byType: Record<string, any[]> = {};
  for (const node of nodesToMigrate) {
    const type = globalConceptPatterns.find(({ pattern }) => pattern.test(node.name))?.type || 'unknown';
    if (!byType[type]) byType[type] = [];
    byType[type].push(node);
  }

  for (const [type, nodes] of Object.entries(byType)) {
    console.log(`  ${type}: ${nodes.length} concepts`);
    nodes.slice(0, 5).forEach(n => console.log(`    - ${n.name}`));
    if (nodes.length > 5) {
      console.log(`    ... and ${nodes.length - 5} more`);
    }
  }
  console.log('');

  if (createBackup) {
    const backupPath = await createBackupFile(db);
    console.log(`✓ Backup created: ${backupPath}\n`);
  }

  if (dryRun) {
    console.log('DRY RUN - Would migrate the following operations:');
    nodesToMigrate.forEach(node => {
      console.log(`  UPDATE nodes SET parent_id = NULL WHERE id = ${node.id} (${node.name})`);
    });
    console.log(`\nTotal: ${nodesToMigrate.length} UPDATE statements`);
    return;
  }

  console.log('Applying migration...\n');

  let migrated = 0;
  for (const node of nodesToMigrate) {
    const fullNode = allNodes.find(n => n.id === node.id);
    if (!fullNode) {
      console.error(`  Warning: Could not find node ${node.id} (${node.name})`);
      continue;
    }
    
    db.hardDeleteNode(node.id);
    
    db.insertNodeRaw({
      id: fullNode.id,
      name: fullNode.name,
      kind: fullNode.kind,
      summary: fullNode.summary,
      why: fullNode.why,
      file_refs: fullNode.file_refs,
      parent_id: null,
      created_by_task: fullNode.created_by_task,
      created_at: fullNode.created_at,
      updated_at: fullNode.updated_at,
      removed_at: fullNode.removed_at,
      removed_reason: fullNode.removed_reason,
      embedding: fullNode.embedding as Buffer | null | undefined,
      merge_group: fullNode.merge_group,
      needs_merge: fullNode.needs_merge,
      source_branch: fullNode.source_branch,
      merge_timestamp: fullNode.merge_timestamp
    });
    
    migrated++;
    
    if (migrated % 10 === 0) {
      console.log(`  Migrated ${migrated}/${nodesToMigrate.length}...`);
    }
  }

  console.log(`\n✓ Migration complete: ${migrated} concepts moved to top level`);
  
  if (createBackup) {
    console.log('\nTo undo this migration, run:');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    console.log(`  fuska migrate-global-concepts --restore .megamemory/backups/knowledge-${timestamp}.db`);
  }
}

async function createBackupFile(db: KnowledgeDB): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = path.join(process.cwd(), '.megamemory', 'backups');
  await fs.ensureDir(backupDir);
  
  const backupPath = path.join(backupDir, `knowledge-${timestamp}.db`);
  
  const allNodes = db.getAllNodesRaw();
  const allEdges = db.getAllEdgesRaw();
  
  const backupDb = new KnowledgeDB(backupPath);
  
  for (const node of allNodes) {
    backupDb.insertNodeRaw({
      id: node.id,
      name: node.name,
      kind: node.kind,
      summary: node.summary,
      why: node.why,
      file_refs: node.file_refs,
      parent_id: node.parent_id,
      created_by_task: node.created_by_task,
      created_at: node.created_at,
      updated_at: node.updated_at,
      removed_at: node.removed_at,
      removed_reason: node.removed_reason,
      embedding: node.embedding as Buffer | null | undefined,
      merge_group: node.merge_group,
      needs_merge: node.needs_merge,
      source_branch: node.source_branch,
      merge_timestamp: node.merge_timestamp
    });
  }
  
  for (const edge of allEdges) {
    backupDb.insertEdgeRaw({
      from_id: edge.from_id,
      to_id: edge.to_id,
      relation: edge.relation,
      description: edge.description,
      created_at: edge.created_at,
      merge_group: edge.merge_group,
      needs_merge: edge.needs_merge,
      source_branch: edge.source_branch,
      merge_timestamp: edge.merge_timestamp
    });
  }
  
  backupDb.close();
  
  return backupPath;
}

async function restoreBackup(backupPath: string, dbPath: string) {
  if (!await fs.pathExists(backupPath)) {
    console.error(`Backup file not found: ${backupPath}`);
    process.exit(1);
  }

  console.log(`Restoring from backup: ${backupPath}\n`);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const preRestoreBackup = path.join(
    path.dirname(dbPath),
    'backups',
    `pre-restore-${timestamp}.db`
  );
  
  await fs.ensureDir(path.dirname(preRestoreBackup));
  await fs.copy(dbPath, preRestoreBackup);
  console.log(`✓ Current database backed up to: ${preRestoreBackup}\n`);

  await fs.copy(backupPath, dbPath);
  
  console.log('✓ Database restored successfully');
  console.log('\nNote: You may need to restart any MCP servers or reload MegaMemory connections.');
}
