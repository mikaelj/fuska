import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as cp from 'child_process';
import { randomUUID } from 'crypto';

interface RawNode {
  id: string;
  name: string;
  kind: string;
  summary: string;
  why: string | null;
  file_refs: string | null;
  parent_id: string | null;
  created_by_task: string | null;
  created_at: string | null;
  updated_at: string | null;
  removed_at: string | null;
  removed_reason: string | null;
  embedding: Buffer | ArrayBuffer | null;
  merge_group: string | null;
  needs_merge: number | null;
  source_branch: string | null;
  merge_timestamp: string | null;
}

interface RawEdge {
  from_id: string;
  to_id: string;
  relation: string;
  description: string | null;
  created_at: string | null;
  merge_group: string | null;
  needs_merge: number | null;
  source_branch: string | null;
  merge_timestamp: string | null;
}

interface WorktreeAddOptions {
  projectDir: string;
  noContext: boolean;
  force: boolean;
}

function toBuffer(data: Buffer | ArrayBuffer | null): Buffer | null {
  if (!data) return null;
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  return null;
}

class WorktreeAddRunner {
  private projectDir: string;
  private db: any;
  private dbPath: string;
  private megaDir: string;

  constructor(options: WorktreeAddOptions) {
    this.projectDir = path.resolve(options.projectDir);
    this.megaDir = path.join(this.projectDir, '.megamemory');
    this.dbPath = path.join(this.megaDir, 'knowledge.db');
  }

  async run(name: string, options: WorktreeAddOptions): Promise<void> {
    if (!name || name.trim() === '') {
      console.error('Error: Worktree name is required');
      console.error('Usage: fuska worktree-add <name>');
      process.exit(1);
    }

    const safeName = name.trim();
    
    if (!/^[a-zA-Z0-9_-]+$/.test(safeName)) {
      console.error(`Error: Invalid worktree name "${safeName}". Use only letters, numbers, hyphens, and underscores.`);
      process.exit(1);
    }

    await this.preflightCheck(safeName, options);
    
    await this.createGitWorktree(safeName, options);
    
    await this.initializeWorktreeMegaMemory(safeName, options);

    if (!options.noContext) {
      await this.copySharedContext(safeName);
    }

    await this.createFreshState(safeName);

    this.outputSummary(safeName, options);
  }

  private async preflightCheck(name: string, options: WorktreeAddOptions): Promise<void> {
    const gitCheck = cp.spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
      encoding: 'utf-8',
      cwd: this.projectDir
    });
    
    if (gitCheck.status !== 0 || gitCheck.stdout.trim() !== 'true') {
      console.error(`Error: ${this.projectDir} is not a git repository`);
      process.exit(1);
    }

    if (!await fs.pathExists(this.dbPath)) {
      console.error(`Error: No .megamemory/knowledge.db found at ${this.projectDir}`);
      console.error('Run this command from your main worktree with an initialized MegaMemory database.');
      process.exit(1);
    }

    const worktreeDir = path.join(this.projectDir, name);
    if (await fs.pathExists(worktreeDir)) {
      if (!options.force) {
        console.error(`Error: Directory "${name}" already exists`);
        console.error('Use --force to overwrite');
        process.exit(1);
      }
    }

    const branchCheck = cp.spawnSync('git', ['branch', '--list', name], {
      encoding: 'utf-8',
      cwd: this.projectDir
    });
    
    if (branchCheck.status === 0 && branchCheck.stdout.trim() !== '') {
      if (!options.force) {
        console.error(`Error: Branch "${name}" already exists`);
        console.error('Use --force to overwrite');
        process.exit(1);
      }
    }

    const { KnowledgeDB } = await import('megamemory/dist/db.js');
    this.db = new KnowledgeDB(this.dbPath);
  }

  private async createGitWorktree(name: string, options: WorktreeAddOptions): Promise<void> {
    const worktreeDir = path.join(this.projectDir, name);

    if (options.force && await fs.pathExists(worktreeDir)) {
      console.log(`Removing existing directory: ${name}`);
      const removeResult = cp.spawnSync('git', ['worktree', 'remove', '--force', name], {
        encoding: 'utf-8',
        cwd: this.projectDir
      });
      
      if (removeResult.status !== 0) {
        await fs.remove(worktreeDir);
      }
    }

    if (options.force) {
      const branchCheck = cp.spawnSync('git', ['branch', '--list', name], {
        encoding: 'utf-8',
        cwd: this.projectDir
      });
      
      if (branchCheck.status === 0 && branchCheck.stdout.trim() !== '') {
        console.log(`Deleting existing branch: ${name}`);
        cp.spawnSync('git', ['branch', '-D', name], {
          encoding: 'utf-8',
          cwd: this.projectDir
        });
      }
    }

    console.log(`Creating git worktree: ${name}`);
    
    const result = cp.spawnSync('git', ['worktree', 'add', name, '-b', name], {
      encoding: 'utf-8',
      cwd: this.projectDir
    });

    if (result.status !== 0) {
      console.error(`Error creating git worktree: ${result.stderr}`);
      process.exit(1);
    }

    console.log(`Created branch: ${name}`);
  }

  private async initializeWorktreeMegaMemory(name: string, options: WorktreeAddOptions): Promise<void> {
    const worktreeDir = path.join(this.projectDir, name);
    const worktreeMegaDir = path.join(worktreeDir, '.megamemory');
    const worktreeDbPath = path.join(worktreeMegaDir, 'knowledge.db');

    console.log(`Initializing worktree MegaMemory: ${worktreeMegaDir}`);

    await fs.ensureDir(worktreeMegaDir);

    const { KnowledgeDB } = await import('megamemory/dist/db.js');
    const worktreeDb = new KnowledgeDB(worktreeDbPath);
    worktreeDb.close();

    console.log(`Created fresh database: ${worktreeDbPath}`);
  }

  private async copySharedContext(name: string): Promise<void> {
    const worktreeDir = path.join(this.projectDir, name);
    const worktreeDbPath = path.join(worktreeDir, '.megamemory', 'knowledge.db');

    const projectRoot = this.db.prepare(`
      SELECT * FROM nodes 
      WHERE kind = 'feature' AND parent_id IS NULL
      LIMIT 1
    `).get() as RawNode | undefined;

    if (!projectRoot) {
      console.log('No project root found, skipping shared context copy');
      return;
    }

    const toCopy: string[] = [projectRoot.id];

    const getDescendantIds = (parentId: string): string[] => {
      const children = this.db.prepare(`
        SELECT id FROM nodes WHERE parent_id = ?
      `).all(parentId).map((r: any) => r.id);
      return [...children, ...children.flatMap((id: string) => getDescendantIds(id))];
    };

    for (const moduleName of ['codebase', 'requirements', 'roadmap']) {
      const module = this.db.prepare(`
        SELECT id FROM nodes 
        WHERE name = ? AND kind = 'module' AND parent_id = ?
      `).get(moduleName, projectRoot.id) as { id: string } | undefined;
      
      if (module) {
        toCopy.push(module.id);
        toCopy.push(...getDescendantIds(module.id));
      }
    }

    const config = this.db.prepare(`
      SELECT id FROM nodes 
      WHERE name = 'config' AND kind = 'config' AND parent_id = ?
    `).get(projectRoot.id) as { id: string } | undefined;
    
    if (config) {
      toCopy.push(config.id);
    }

    const uniqueIds = [...new Set(toCopy)];

    if (uniqueIds.length === 0) {
      console.log('No shared context concepts found to copy');
      return;
    }

    const { KnowledgeDB } = await import('megamemory/dist/db.js');
    const worktreeDb = new KnowledgeDB(worktreeDbPath);

    let copiedCount = 0;
    for (const nodeId of uniqueIds) {
      const node = this.db.prepare('SELECT * FROM nodes WHERE id = ?').get(nodeId) as RawNode;
      if (node) {
        worktreeDb.insertNodeRaw({
          id: node.id,
          name: node.name,
          kind: node.kind,
          summary: node.summary,
          why: node.why ?? null,
          file_refs: node.file_refs ?? null,
          parent_id: node.parent_id ?? null,
          created_by_task: node.created_by_task ?? null,
          created_at: node.created_at ?? null,
          updated_at: node.updated_at ?? null,
          removed_at: node.removed_at ?? null,
          removed_reason: node.removed_reason ?? null,
          embedding: null,
          merge_group: node.merge_group ?? null,
          needs_merge: node.needs_merge ?? 0,
          source_branch: 'shared-context',
          merge_timestamp: node.merge_timestamp ?? null
        });
        copiedCount++;
      }
    }

    const placeholders = uniqueIds.map(() => '?').join(',');
    const edges = this.db.prepare(`
      SELECT * FROM edges 
      WHERE from_id IN (${placeholders}) AND to_id IN (${placeholders})
    `).all(...uniqueIds, ...uniqueIds) as RawEdge[];

    for (const edge of edges) {
      worktreeDb.insertEdgeRaw({
        from_id: edge.from_id,
        to_id: edge.to_id,
        relation: edge.relation,
        description: edge.description ?? null,
        created_at: edge.created_at ?? null,
        merge_group: edge.merge_group ?? null,
        needs_merge: edge.needs_merge ?? 0,
        source_branch: 'shared-context',
        merge_timestamp: edge.merge_timestamp ?? null
      });
    }

    worktreeDb.close();

    console.log(`Shared context: ${copiedCount} concepts copied (${edges.length} edges)`);
  }

  private async createFreshState(name: string): Promise<void> {
    const worktreeDir = path.join(this.projectDir, name);
    const worktreeDbPath = path.join(worktreeDir, '.megamemory', 'knowledge.db');

    const projectRoot = this.db.prepare(`
      SELECT id FROM nodes 
      WHERE kind = 'feature' AND parent_id IS NULL
      LIMIT 1
    `).get() as { id: string } | undefined;

    if (!projectRoot) {
      console.log('No project root found, skipping state creation');
      return;
    }

    const { KnowledgeDB } = await import('megamemory/dist/db.js');
    const worktreeDb = new KnowledgeDB(worktreeDbPath);

    const stateId = randomUUID();
    const stateSummary = JSON.stringify({
      phase: 1,
      plan: 0,
      status: 'Ready to plan',
      last_activity: `Worktree initialized: ${name}`,
      progress: 0
    });

    worktreeDb.insertNodeRaw({
      id: stateId,
      name: 'state',
      kind: 'config',
      summary: stateSummary,
      why: null,
      file_refs: null,
      parent_id: projectRoot.id,
      created_by_task: null,
      created_at: new Date().toISOString().replace('T', ' ').replace('Z', ''),
      updated_at: new Date().toISOString().replace('T', ' ').replace('Z', ''),
      removed_at: null,
      removed_reason: null,
      embedding: null,
      merge_group: null,
      needs_merge: 0,
      source_branch: 'shared-context',
      merge_timestamp: null
    });

    worktreeDb.insertEdgeRaw({
      from_id: stateId,
      to_id: projectRoot.id,
      relation: 'configured_by',
      description: 'State configures project',
      created_at: new Date().toISOString().replace('T', ' ').replace('Z', ''),
      merge_group: null,
      needs_merge: 0,
      source_branch: 'shared-context',
      merge_timestamp: null
    });

    worktreeDb.close();

    console.log('Created fresh state concept');
  }

  private outputSummary(name: string, options: WorktreeAddOptions): void {
    const worktreeDir = path.join(this.projectDir, name);
    
    console.log();
    console.log('='.repeat(60));
    console.log('WORKTREE CREATED');
    console.log('='.repeat(60));
    console.log();
    console.log(`Worktree: ${name}`);
    console.log(`Git branch: ${name}`);
    console.log(`Location: ${worktreeDir}`);
    console.log();
    console.log('Next steps:');
    console.log(`  cd ${name}`);
    console.log('  # Work on your feature');
    console.log('  # When done:');
    console.log(`  cd ${path.relative(worktreeDir, this.projectDir) || '..'}`);
    console.log(`  fuska worktree-merge ${name}`);
    console.log();
  }
}

export function worktreeAddCommand(program: Command) {
  program
    .command('worktree-add <name>')
    .description('Create git worktree with shared MegaMemory context')
    .option('-p, --project-dir <path>', 'Main worktree path (default: cwd)')
    .option('--no-context', 'Skip copying shared context')
    .option('-f, --force', 'Overwrite existing branch/directory')
    .action(async (name: string, options: any) => {
      const worktreeOptions: WorktreeAddOptions = {
        projectDir: options.projectDir || process.cwd(),
        noContext: options.noContext || false,
        force: options.force || false
      };
      
      const runner = new WorktreeAddRunner(worktreeOptions);
      await runner.run(name, worktreeOptions);
    });
}
