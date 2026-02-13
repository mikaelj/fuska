import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as cp from 'child_process';
import inquirer from 'inquirer';
import { randomUUID } from 'crypto';

interface MergeSession {
  session_id: string;
  started_at: string;
  status: 'in_progress' | 'complete' | 'failed';
  branch: string;
  conflicts_detected: number;
  conflicts_resolved: number;
  backup_path: string;
  pre_merge_sha: string;
  mm_merged: boolean;
  git_merged: boolean;
  error: string | null;
  completed_at?: string;
  failed_at?: string;
}

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

interface ConflictVersion {
  id: string;
  original_id: string;
  source_branch: string;
  name: string;
  kind: string;
  summary: string;
  why: string | null;
  file_refs: string[] | null;
  removed_at: string | null;
  removed_reason: string | null;
}

interface Conflict {
  merge_group: string;
  merge_timestamp: string;
  versions: ConflictVersion[];
}

interface WorktreeMergeOptions {
  projectDir: string;
  resume: boolean;
  dryRun: boolean;
  keep: 'left' | 'right' | 'both' | null;
  onlyGit: boolean;
  onlyMegamemory: boolean;
  force: boolean;
}

interface MMDryRunResult {
  clean: number;
  skipped: number;
  conflicts: { id: string; name: string; reason: string }[];
}

interface GitDryRunResult {
  clean: boolean;
  conflicts: string[];
}

interface MergeResult {
  clean: number;
  skipped: number;
  conceptConflicts: number;
  edgeConflicts: number;
  removedClean: number;
}

const MERGE_SUFFIX_LEFT = '::left';
const MERGE_SUFFIX_RIGHT = '::right';

function stripMergeSuffix(id: string): string {
  if (id.endsWith(MERGE_SUFFIX_LEFT)) return id.slice(0, -MERGE_SUFFIX_LEFT.length);
  if (id.endsWith(MERGE_SUFFIX_RIGHT)) return id.slice(0, -MERGE_SUFFIX_RIGHT.length);
  return id;
}

function hasMergeSuffix(id: string): boolean {
  return id.endsWith(MERGE_SUFFIX_LEFT) || id.endsWith(MERGE_SUFFIX_RIGHT);
}

function nodesAreIdentical(left: RawNode, right: RawNode): boolean {
  if (left.name !== right.name) return false;
  if (left.kind !== right.kind) return false;
  if (left.summary !== right.summary) return false;
  if ((left.why ?? '') !== (right.why ?? '')) return false;
  if ((left.parent_id ?? '') !== (right.parent_id ?? '')) return false;
  const leftRefs = left.file_refs ? JSON.parse(left.file_refs) : null;
  const rightRefs = right.file_refs ? JSON.parse(right.file_refs) : null;
  if (JSON.stringify(leftRefs) !== JSON.stringify(rightRefs)) return false;
  const leftRemoved = left.removed_at !== null;
  const rightRemoved = right.removed_at !== null;
  if (leftRemoved !== rightRemoved) return false;
  return true;
}

function toBuffer(data: Buffer | ArrayBuffer | null): Buffer | null {
  if (!data) return null;
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  return null;
}

function getTimestamp(): string {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
}

class WorktreeMergeRunner {
  private projectDir: string;
  private db: any;
  private session: MergeSession | null = null;
  private sessionPath: string;
  private dbPath: string;
  private megaDir: string;
  private worktreePaths: Map<string, string> = new Map();

  constructor(options: WorktreeMergeOptions) {
    this.projectDir = path.resolve(options.projectDir);
    this.megaDir = path.join(this.projectDir, '.megamemory');
    this.dbPath = path.join(this.megaDir, 'knowledge.db');
    this.sessionPath = path.join(this.megaDir, 'merge-session.json');
  }

  private getWorktreePaths(): Map<string, string> {
    if (this.worktreePaths.size > 0) return this.worktreePaths;
    
    try {
      const result = cp.spawnSync('git', ['worktree', 'list', '--porcelain'], {
        encoding: 'utf-8',
        cwd: this.projectDir
      });
      
      if (result.status !== 0) return this.worktreePaths;
      
      let currentPath: string | null = null;
      let currentBranch: string | null = null;
      
      for (const line of result.stdout.split('\n')) {
        if (line.startsWith('worktree ')) {
          currentPath = line.substring(9);
        } else if (line.startsWith('branch ')) {
          const branchRef = line.substring(7);
          currentBranch = branchRef.replace('refs/heads/', '');
          if (currentPath && currentBranch) {
            this.worktreePaths.set(currentBranch, currentPath);
          }
        } else if (line.startsWith('detached')) {
          currentPath = null;
          currentBranch = null;
        }
      }
    } catch {
      // Ignore errors
    }
    
    return this.worktreePaths;
  }
  
  private getWorktreePath(branch: string): string | null {
    const paths = this.getWorktreePaths();
    return paths.get(branch) || null;
  }

  private getPreMergeSha(): string {
    const result = cp.spawnSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf-8',
      cwd: this.projectDir
    });
    return result.stdout.trim();
  }

  async run(branch: string, options: WorktreeMergeOptions): Promise<void> {
    if (!branch) {
      console.error('Usage: fuska worktree-merge <name>');
      console.error('Example: fuska worktree-merge feature-auth');
      process.exit(1);
    }

    const preMergeSha = this.getPreMergeSha();

    await this.preflightCheck(branch, preMergeSha);

    const mmDryRunResult = await this.runMMDryRun(branch);
    const gitDryRunResult = await this.runGitDryRun(branch);

    const hasErrors = mmDryRunResult.conflicts.length > 0 || !gitDryRunResult.clean;
    if (hasErrors && !options.force && !options.dryRun) {
      console.error('\nErrors detected in dry-run. Use --force to proceed anyway.');
      process.exit(1);
    }

    if (options.dryRun) {
      this.displayDryRunResults(branch, mmDryRunResult, gitDryRunResult);
      console.log('\n=== END DRY RUN ===');
      return;
    }

    if (options.resume && await fs.pathExists(this.sessionPath)) {
      await this.resumeSession();
    } else {
      if (await fs.pathExists(this.sessionPath)) {
        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: 'Found an in-progress merge session. Resume where it left off?',
            choices: [
              { name: 'Resume', value: 'resume' },
              { name: 'Start fresh', value: 'fresh' }
            ]
          }
        ]);
        if (action === 'resume') {
          await this.resumeSession();
        } else {
          await fs.remove(this.sessionPath);
          await this.initializeSession(branch, preMergeSha);
        }
      } else {
        await this.initializeSession(branch, preMergeSha);
      }
    }

    try {
      if (!options.onlyGit) {
        await this.runMMMerge(branch, options);
      }

      if (!options.onlyMegamemory) {
        await this.runGitMerge(branch, options);
      }

      await this.finalize();
    } catch (error: any) {
      await this.handleError(error);
    }
  }

  private async preflightCheck(branch: string, preMergeSha: string): Promise<void> {
    if (!await fs.pathExists(this.dbPath)) {
      console.error(`No .megamemory/knowledge.db found at ${this.projectDir}`);
      console.error('Run this command from your main worktree.');
      process.exit(1);
    }

    const worktreePath = this.getWorktreePath(branch);
    if (!worktreePath) {
      console.error(`Worktree not found for branch: ${branch}`);
      console.error('Run "git worktree list" to see available worktrees.');
      process.exit(1);
    }

    const worktreeDb = path.join(worktreePath, '.megamemory', 'knowledge.db');
    if (!await fs.pathExists(worktreeDb)) {
      console.error(`Database not found: ${worktreeDb}`);
      console.error('Ensure the worktree has been used with fuska.');
      process.exit(1);
    }

    const { KnowledgeDB } = await import('megamemory/dist/db.js');
    this.db = new KnowledgeDB(this.dbPath);
  }

  private async runMMDryRun(branch: string): Promise<MMDryRunResult> {
    const { KnowledgeDB } = await import('megamemory/dist/db.js');
    const worktreePath = this.getWorktreePath(branch)!;
    const worktreeDb = path.join(worktreePath, '.megamemory', 'knowledge.db');
    const rightDb = new KnowledgeDB(worktreeDb);

    const result: MMDryRunResult = { clean: 0, skipped: 0, conflicts: [] };

    try {
      const leftNodes = this.db.getAllNodesRaw() as RawNode[];
      const rightNodes = rightDb.getAllNodesRaw() as RawNode[];

      const leftMap = new Map<string, RawNode>();
      const rightMap = new Map<string, RawNode>();

      for (const n of leftNodes) leftMap.set(stripMergeSuffix(n.id), n);
      for (const n of rightNodes) rightMap.set(stripMergeSuffix(n.id), n);

      for (const [id, rightNode] of rightMap) {
        if (rightNode.source_branch === 'shared-context') {
          result.skipped++;
          continue;
        }
        if (id === 'state') {
          result.skipped++;
          continue;
        }

        const leftNode = leftMap.get(id);
        if (!leftNode) {
          result.clean++;
        } else if (nodesAreIdentical(leftNode, rightNode)) {
          result.clean++;
        } else {
          let reason = 'content differs';
          if (leftNode.summary !== rightNode.summary) {
            reason = 'summary differs';
          } else if ((leftNode.why ?? '') !== (rightNode.why ?? '')) {
            reason = 'why differs';
          } else if (leftNode.name !== rightNode.name) {
            reason = 'name differs';
          }
          result.conflicts.push({ id, name: rightNode.name, reason });
        }
      }

      for (const [id, leftNode] of leftMap) {
        if (!rightMap.has(id) && leftNode.source_branch !== 'shared-context' && id !== 'state') {
          result.clean++;
        }
      }

      return result;
    } finally {
      rightDb.close();
    }
  }

  private async runGitDryRun(branch: string): Promise<GitDryRunResult> {
    const result = cp.spawnSync('git', ['merge', '--no-commit', '--no-ff', branch], {
      encoding: 'utf-8',
      cwd: this.projectDir
    });

    const exitCode = result.status;

    if (exitCode === 0) {
      cp.spawnSync('git', ['merge', '--abort'], {
        encoding: 'utf-8',
        cwd: this.projectDir
      });
      return { clean: true, conflicts: [] };
    }

    // Capture conflicts BEFORE aborting
    const conflicts: string[] = [];
    const diffResult = cp.spawnSync('git', ['diff', '--name-only', '--diff-filter=U'], {
      encoding: 'utf-8',
      cwd: this.projectDir
    });

    if (diffResult.stdout) {
      conflicts.push(...diffResult.stdout.trim().split('\n').filter(Boolean));
    }

    // Now abort the merge
    cp.spawnSync('git', ['merge', '--abort'], {
      encoding: 'utf-8',
      cwd: this.projectDir
    });

    return { clean: false, conflicts };
  }

  private displayDryRunResults(branch: string, mmResult: MMDryRunResult, gitResult: GitDryRunResult): void {
    console.log('\n=== DRY RUN RESULTS ===\n');

    console.log('MegaMemory merge:');
    console.log(`  ✓ Clean: ${mmResult.clean} concepts`);
    console.log(`  ✓ Skipped (shared-context): ${mmResult.skipped} concepts`);
    if (mmResult.conflicts.length > 0) {
      console.log(`  ✗ Conflicts: ${mmResult.conflicts.length} concepts`);
      for (const c of mmResult.conflicts) {
        console.log(`      - ${c.name} (${c.id}) - ${c.reason}`);
      }
    }

    console.log(`\nGit merge (${branch}):`);
    if (gitResult.clean) {
      console.log('  ✓ Clean merge (no conflicts)');
    } else {
      console.log(`  ✗ Conflicts in: ${gitResult.conflicts.join(', ')}`);
    }

    console.log('\n────────────────');
  }

  private async initializeSession(branch: string, preMergeSha: string): Promise<void> {
    const timestamp = getTimestamp();
    const isoTimestamp = new Date().toISOString();
    const backupPath = `${this.dbPath}.backup-${timestamp}`;

    await fs.copy(this.dbPath, backupPath);
    console.log(`Backup created: ${backupPath}`);

    this.session = {
      session_id: `merge-${timestamp}`,
      started_at: isoTimestamp,
      status: 'in_progress',
      branch,
      conflicts_detected: 0,
      conflicts_resolved: 0,
      backup_path: backupPath,
      pre_merge_sha: preMergeSha,
      mm_merged: false,
      git_merged: false,
      error: null
    };

    await this.saveSession();
  }

  private async resumeSession(): Promise<void> {
    const content = await fs.readJson(this.sessionPath);
    this.session = content as MergeSession;
    console.log(`Resuming session: ${this.session!.session_id}`);
  }

  private async saveSession(): Promise<void> {
    await fs.writeJson(this.sessionPath, this.session, { spaces: 2 });
  }

  private async runMMMerge(branch: string, options: WorktreeMergeOptions): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log(`MegaMemory merge: ${branch}`);
    console.log('='.repeat(60));

    const worktreePath = this.getWorktreePath(branch)!;
    const worktreeDb = path.join(worktreePath, '.megamemory', 'knowledge.db');

    const result = await this.performMerge(worktreeDb, 'main', branch);

    console.log(`  Skipped (shared context): ${result.skipped}`);
    console.log(`  Clean merge: ${result.clean} concepts`);
    console.log(`  Conflicts: ${result.conceptConflicts}`);

    this.session!.mm_merged = true;
    await this.saveSession();

    if (result.conceptConflicts > 0) {
      this.session!.conflicts_detected += result.conceptConflicts;
      await this.saveSession();

      const conflicts = await this.listConflicts();
      await this.resolveConflicts(conflicts, 'main', branch, options);
    }
  }

  private async performMerge(rightDbPath: string, leftLabel: string, rightLabel: string): Promise<MergeResult> {
    const { KnowledgeDB } = await import('megamemory/dist/db.js');
    const rightDb = new KnowledgeDB(rightDbPath);

    const tempOutputPath = `${this.dbPath}.merge-tmp-${Date.now()}`;
    const outputDb = new KnowledgeDB(tempOutputPath);

    try {
      const leftNodes = this.db.getAllNodesRaw() as RawNode[];
      const rightNodes = rightDb.getAllNodesRaw() as RawNode[];
      const leftEdges = this.db.getAllEdgesRaw() as RawEdge[];
      const rightEdges = rightDb.getAllEdgesRaw() as RawEdge[];

      const leftNodeMap = new Map<string, RawNode>();
      const rightNodeMap = new Map<string, RawNode>();
      const leftVariantsByCanonical = new Map<string, RawNode[]>();
      const rightVariantsByCanonical = new Map<string, RawNode[]>();

      for (const n of leftNodes) {
        leftNodeMap.set(n.id, n);
        const canonical = stripMergeSuffix(n.id);
        if (!leftVariantsByCanonical.has(canonical)) leftVariantsByCanonical.set(canonical, []);
        leftVariantsByCanonical.get(canonical)!.push(n);
      }

      for (const n of rightNodes) {
        rightNodeMap.set(n.id, n);
        const canonical = stripMergeSuffix(n.id);
        if (!rightVariantsByCanonical.has(canonical)) rightVariantsByCanonical.set(canonical, []);
        rightVariantsByCanonical.get(canonical)!.push(n);
      }

      const leftEdgeMap = new Map<string, RawEdge[]>();
      const rightEdgeMap = new Map<string, RawEdge[]>();

      for (const e of leftEdges) {
        if (!leftEdgeMap.has(e.from_id)) leftEdgeMap.set(e.from_id, []);
        leftEdgeMap.get(e.from_id)!.push(e);
      }

      for (const e of rightEdges) {
        if (!rightEdgeMap.has(e.from_id)) rightEdgeMap.set(e.from_id, []);
        rightEdgeMap.get(e.from_id)!.push(e);
      }

      const allIds = new Set<string>();
      for (const id of leftNodeMap.keys()) allIds.add(stripMergeSuffix(id));
      for (const id of rightNodeMap.keys()) allIds.add(stripMergeSuffix(id));

      const result: MergeResult = { clean: 0, skipped: 0, conceptConflicts: 0, edgeConflicts: 0, removedClean: 0 };
      const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
      const insertedIds = new Set<string>();
      const conflictIds = new Set<string>();

      const insertNode = (node: RawNode) => {
        if (insertedIds.has(node.id)) return;
        outputDb.insertNodeRaw({
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
          embedding: toBuffer(node.embedding),
          merge_group: node.merge_group ?? null,
          needs_merge: node.needs_merge ?? 0,
          source_branch: node.source_branch ?? null,
          merge_timestamp: node.merge_timestamp ?? null
        });
        insertedIds.add(node.id);
      };

      for (const id of allIds) {
        const leftVariants = leftVariantsByCanonical.get(id) ?? [];
        const rightVariants = rightVariantsByCanonical.get(id) ?? [];
        const leftNode = leftNodeMap.get(id);
        const rightNode = rightNodeMap.get(id);

        if (rightNode && rightNode.source_branch === 'shared-context') {
          if (leftNode) insertNode(leftNode);
          result.skipped++;
          continue;
        }

        if (id === 'state') {
          if (leftNode) insertNode(leftNode);
          else if (rightNode) insertNode(rightNode);
          result.skipped++;
          continue;
        }

        const preexistingLeft = leftVariants.filter(n => n.needs_merge === 1 && n.merge_group && hasMergeSuffix(n.id));
        const preexistingRight = rightVariants.filter(n => n.needs_merge === 1 && n.merge_group && hasMergeSuffix(n.id));

        if (preexistingLeft.length > 0 || preexistingRight.length > 0) {
          for (const node of [...preexistingLeft, ...preexistingRight]) {
            insertNode(node);
          }
          conflictIds.add(id);
          continue;
        }

        if (!leftNode && rightNode) {
          insertNode(rightNode);
          if (rightNode.removed_at) result.removedClean++;
          else result.clean++;
        } else if (leftNode && !rightNode) {
          insertNode(leftNode);
          if (leftNode.removed_at) result.removedClean++;
          else result.clean++;
        } else if (leftNode && rightNode) {
          if (nodesAreIdentical(leftNode, rightNode)) {
            insertNode(leftNode);
            if (leftNode.removed_at) result.removedClean++;
            else result.clean++;
          } else {
            conflictIds.add(id);
            result.conceptConflicts++;
            const mergeGroup = randomUUID();
            const leftSuffixed = `${id}${MERGE_SUFFIX_LEFT}`;
            const rightSuffixed = `${id}${MERGE_SUFFIX_RIGHT}`;

            outputDb.insertNodeRaw({
              id: leftSuffixed,
              name: leftNode.name,
              kind: leftNode.kind,
              summary: leftNode.summary,
              why: leftNode.why ?? null,
              file_refs: leftNode.file_refs ?? null,
              parent_id: leftNode.parent_id ?? null,
              created_by_task: leftNode.created_by_task ?? null,
              created_at: leftNode.created_at ?? null,
              updated_at: leftNode.updated_at ?? null,
              removed_at: leftNode.removed_at ?? null,
              removed_reason: leftNode.removed_reason ?? null,
              embedding: toBuffer(leftNode.embedding),
              merge_group: mergeGroup,
              needs_merge: 1,
              source_branch: leftLabel,
              merge_timestamp: now
            });

            outputDb.insertNodeRaw({
              id: rightSuffixed,
              name: rightNode.name,
              kind: rightNode.kind,
              summary: rightNode.summary,
              why: rightNode.why ?? null,
              file_refs: rightNode.file_refs ?? null,
              parent_id: rightNode.parent_id ?? null,
              created_by_task: rightNode.created_by_task ?? null,
              created_at: rightNode.created_at ?? null,
              updated_at: rightNode.updated_at ?? null,
              removed_at: rightNode.removed_at ?? null,
              removed_reason: rightNode.removed_reason ?? null,
              embedding: toBuffer(rightNode.embedding),
              merge_group: mergeGroup,
              needs_merge: 1,
              source_branch: rightLabel,
              merge_timestamp: now
            });

            insertedIds.add(leftSuffixed);
            insertedIds.add(rightSuffixed);
          }
        }
      }

      for (const e of leftEdges) {
        const canonicalFrom = stripMergeSuffix(e.from_id);
        const canonicalTo = stripMergeSuffix(e.to_id);

        let fromId = e.from_id;
        let toId = e.to_id;

        if (conflictIds.has(canonicalFrom)) {
          fromId = `${canonicalFrom}${MERGE_SUFFIX_LEFT}`;
        }
        if (conflictIds.has(canonicalTo)) {
          toId = `${canonicalTo}${MERGE_SUFFIX_LEFT}`;
        }

        outputDb.insertEdgeRaw({
          from_id: fromId,
          to_id: toId,
          relation: e.relation,
          description: e.description ?? null,
          created_at: e.created_at ?? null,
          merge_group: e.merge_group ?? null,
          needs_merge: e.needs_merge ?? 0,
          source_branch: e.source_branch ?? null,
          merge_timestamp: e.merge_timestamp ?? null
        });
      }

      for (const e of rightEdges) {
        const canonicalFrom = stripMergeSuffix(e.from_id);
        const canonicalTo = stripMergeSuffix(e.to_id);

        if (e.source_branch === 'shared-context') {
          continue;
        }

        let fromId = e.from_id;
        let toId = e.to_id;

        if (conflictIds.has(canonicalFrom)) {
          fromId = `${canonicalFrom}${MERGE_SUFFIX_RIGHT}`;
        }
        if (conflictIds.has(canonicalTo)) {
          toId = `${canonicalTo}${MERGE_SUFFIX_RIGHT}`;
        }

        outputDb.insertEdgeRaw({
          from_id: fromId,
          to_id: toId,
          relation: e.relation,
          description: e.description ?? null,
          created_at: e.created_at ?? null,
          merge_group: e.merge_group ?? null,
          needs_merge: e.needs_merge ?? 0,
          source_branch: e.source_branch ?? null,
          merge_timestamp: e.merge_timestamp ?? null
        });
      }

      outputDb.close();
      rightDb.close();
      this.db.close();

      await fs.copy(tempOutputPath, this.dbPath, { overwrite: true });
      await fs.remove(tempOutputPath);
      await fs.remove(`${tempOutputPath}-shm`);
      await fs.remove(`${tempOutputPath}-wal`);

      const reopenedDb = new (await import('megamemory/dist/db.js')).KnowledgeDB(this.dbPath);
      this.db = reopenedDb;

      return result;
    } catch (err) {
      if (await fs.pathExists(tempOutputPath)) {
        await fs.remove(tempOutputPath);
        await fs.remove(`${tempOutputPath}-shm`);
        await fs.remove(`${tempOutputPath}-wal`);
      }
      throw err;
    }
  }

  private async listConflicts(): Promise<Conflict[]> {
    const conflictNodes = this.db.getConflictNodes() as RawNode[];

    if (conflictNodes.length === 0) return [];

    const groups = new Map<string, RawNode[]>();
    for (const node of conflictNodes) {
      const mg = node.merge_group!;
      if (!groups.has(mg)) groups.set(mg, []);
      groups.get(mg)!.push(node);
    }

    const conflicts: Conflict[] = [];
    for (const [mergeGroup, nodes] of groups) {
      conflicts.push({
        merge_group: mergeGroup,
        merge_timestamp: nodes[0].merge_timestamp!,
        versions: nodes.map(n => ({
          id: n.id,
          original_id: stripMergeSuffix(n.id),
          source_branch: n.source_branch!,
          name: n.name,
          kind: n.kind,
          summary: n.summary,
          why: n.why,
          file_refs: n.file_refs ? JSON.parse(n.file_refs) : null,
          removed_at: n.removed_at,
          removed_reason: n.removed_reason
        }))
      });
    }

    return conflicts;
  }

  private async resolveConflicts(conflicts: Conflict[], leftLabel: string, rightLabel: string, options: WorktreeMergeOptions): Promise<void> {
    for (const conflict of conflicts) {
      await this.resolveSingleConflict(conflict, leftLabel, rightLabel, options);
    }
  }

  private async resolveSingleConflict(conflict: Conflict, leftLabel: string, rightLabel: string, options: WorktreeMergeOptions): Promise<void> {
    const leftVersion = conflict.versions[0];
    const rightVersion = conflict.versions[1];

    console.log('\n' + '-'.repeat(60));
    console.log(`Conflict: ${leftVersion.name}`);
    console.log(`Merge group: ${conflict.merge_group}`);
    console.log();
    console.log(`${leftLabel}:`);
    console.log(`  Type: ${leftVersion.kind}`);
    console.log(`  Name: ${leftVersion.name}`);
    console.log(`  Summary: ${leftVersion.summary.substring(0, 200)}...`);
    console.log(`  Files: ${leftVersion.file_refs?.join(', ') || 'none'}`);
    console.log();
    console.log(`${rightLabel}:`);
    console.log(`  Type: ${rightVersion.kind}`);
    console.log(`  Name: ${rightVersion.name}`);
    console.log(`  Summary: ${rightVersion.summary.substring(0, 200)}...`);
    console.log(`  Files: ${rightVersion.file_refs?.join(', ') || 'none'}`);
    console.log('-'.repeat(60));

    if (options.keep) {
      this.applyKeepResolution(conflict.merge_group, options.keep);
      this.session!.conflicts_resolved++;
      await this.saveSession();
      return;
    }

    const { choice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'choice',
        message: 'How should this conflict be resolved?',
        choices: [
          { name: 'AI verify', value: 'ai' },
          { name: `Keep left (${leftLabel})`, value: 'left' },
          { name: `Keep right (${rightLabel})`, value: 'right' },
          { name: 'Keep both', value: 'both' },
          { name: 'Skip', value: 'skip' }
        ]
      }
    ]);

    if (choice === 'skip') {
      return;
    }

    if (choice === 'ai') {
      await this.aiResolveConflict(conflict, leftLabel, rightLabel);
    } else {
      this.applyKeepResolution(conflict.merge_group, choice);
    }

    this.session!.conflicts_resolved++;
    await this.saveSession();
  }

  private applyKeepResolution(mergeGroup: string, keep: 'left' | 'right' | 'both'): void {
    const nodes = this.db.getNodesByMergeGroup(mergeGroup) as RawNode[];

    if (nodes.length === 0) return;

    const leftNode = nodes.find(n => n.id.endsWith(MERGE_SUFFIX_LEFT));
    const rightNode = nodes.find(n => n.id.endsWith(MERGE_SUFFIX_RIGHT));
    const originalId = stripMergeSuffix(nodes[0].id);

    if (keep === 'both') {
      if (leftNode) {
        const newId = `${originalId}-${leftNode.source_branch ?? 'left'}`;
        this.db.renameNodeId(leftNode.id, newId);
        this.db.clearNodeMergeFlags(newId);
      }
      if (rightNode) {
        const newId = `${originalId}-${rightNode.source_branch ?? 'right'}`;
        this.db.renameNodeId(rightNode.id, newId);
        this.db.clearNodeMergeFlags(newId);
      }
      this.db.clearEdgeMergeFlagsByGroup(mergeGroup);
    } else {
      const winner = keep === 'left' ? leftNode : rightNode;
      const loser = keep === 'left' ? rightNode : leftNode;

      if (loser) {
        this.db.hardDeleteNode(loser.id);
      }
      if (winner) {
        this.db.renameNodeId(winner.id, originalId);
        this.db.clearNodeMergeFlags(originalId);
      }
      this.db.clearEdgeMergeFlagsByGroup(mergeGroup);
    }
  }

  private async aiResolveConflict(conflict: Conflict, leftLabel: string, rightLabel: string): Promise<void> {
    const leftVersion = conflict.versions[0];
    const rightVersion = conflict.versions[1];

    const allFiles = [
      ...(leftVersion.file_refs || []),
      ...(rightVersion.file_refs || [])
    ];
    const uniqueFiles = [...new Set(allFiles)];

    const fileResults: Array<{ path: string; exists: boolean; content?: string }> = [];
    const edgeCaseFlags: string[] = [];

    for (const file of uniqueFiles) {
      const fullPath = path.join(this.projectDir, file);
      const exists = await fs.pathExists(fullPath);
      let content: string | undefined;

      if (exists) {
        try {
          content = await fs.readFile(fullPath, 'utf-8');
        } catch {
          content = undefined;
        }
      }

      fileResults.push({ path: file, exists, content });
    }

    if (leftVersion.removed_at && !rightVersion.removed_at) {
      edgeCaseFlags.push(`Concept deleted in ${leftLabel} but updated in ${rightLabel}`);
    }
    if (!leftVersion.removed_at && rightVersion.removed_at) {
      edgeCaseFlags.push(`Concept deleted in ${rightLabel} but updated in ${leftLabel}`);
    }

    if (leftVersion.kind === rightVersion.kind && leftVersion.name !== rightVersion.name) {
      const leftFiles = leftVersion.file_refs || [];
      const rightFiles = rightVersion.file_refs || [];
      const commonFiles = leftFiles.filter(f => rightFiles.includes(f));
      if (commonFiles.length > 0) {
        edgeCaseFlags.push('Possible rename detected: same kind, similar files, different names');
      }
    }

    const missingFiles = fileResults.filter(f => !f.exists);
    if (missingFiles.length > 0) {
      edgeCaseFlags.push(`Dangling refs: ${missingFiles.map(f => f.path).join(', ')}`);
    }

    const resolution = this.determineResolution(leftVersion, rightVersion, fileResults, edgeCaseFlags, leftLabel, rightLabel);

    console.log('\n' + '='.repeat(60));
    console.log(`AI Resolution for: ${leftVersion.name}`);
    console.log('-'.repeat(60));
    console.log('File verification:');
    for (const f of fileResults) {
      console.log(`  ${f.exists ? 'OK' : 'MISSING'} ${f.path}`);
    }
    if (edgeCaseFlags.length > 0) {
      console.log('\nEdge cases detected:');
      for (const flag of edgeCaseFlags) {
        console.log(`  ${flag}`);
      }
    }
    console.log(`\nResolution: ${resolution.strategy}`);
    console.log(`Reason: ${resolution.reason}`);
    console.log('='.repeat(60));

    const { apply } = await inquirer.prompt([
      {
        type: 'list',
        name: 'apply',
        message: 'Apply this resolution?',
        choices: [
          { name: 'Apply', value: 'apply' },
          { name: `Keep left (${leftLabel})`, value: 'left' },
          { name: `Keep right (${rightLabel})`, value: 'right' },
          { name: 'Keep both', value: 'both' }
        ]
      }
    ]);

    if (apply === 'apply') {
      const { resolveConflict } = await import('megamemory/dist/tools.js');
      await resolveConflict(this.db, {
        merge_group: conflict.merge_group,
        resolved: resolution.resolved,
        reason: resolution.reason
      });
    } else {
      this.applyKeepResolution(conflict.merge_group, apply);
    }
  }

  private determineResolution(
    left: ConflictVersion,
    right: ConflictVersion,
    fileResults: Array<{ path: string; exists: boolean }>,
    edgeCases: string[],
    leftLabel: string,
    rightLabel: string
  ): { strategy: string; reason: string; resolved: { summary: string; why?: string; file_refs?: string[] } } {
    const leftFiles = (left.file_refs || []).map(f => fileResults.find(fr => fr.path === f)).filter(Boolean);
    const rightFiles = (right.file_refs || []).map(f => fileResults.find(fr => fr.path === f)).filter(Boolean);

    const leftAllExist = leftFiles.every(f => f?.exists);
    const rightAllExist = rightFiles.every(f => f?.exists);

    if (!leftAllExist && rightAllExist) {
      return {
        strategy: `Keep ${rightLabel}`,
        reason: `${leftLabel} version references files that no longer exist, ${rightLabel} files are valid`,
        resolved: {
          summary: right.summary,
          why: right.why || undefined,
          file_refs: right.file_refs || undefined
        }
      };
    }

    if (leftAllExist && !rightAllExist) {
      return {
        strategy: `Keep ${leftLabel}`,
        reason: `${rightLabel} version references files that no longer exist, ${leftLabel} files are valid`,
        resolved: {
          summary: left.summary,
          why: left.why || undefined,
          file_refs: left.file_refs || undefined
        }
      };
    }

    if (left.removed_at && !right.removed_at) {
      return {
        strategy: `Keep ${rightLabel}`,
        reason: `${leftLabel} marked as deleted, ${rightLabel} has active updates`,
        resolved: {
          summary: right.summary,
          why: right.why || undefined,
          file_refs: right.file_refs || undefined
        }
      };
    }

    if (!left.removed_at && right.removed_at) {
      return {
        strategy: `Keep ${leftLabel}`,
        reason: `${rightLabel} marked as deleted, ${leftLabel} has active updates`,
        resolved: {
          summary: left.summary,
          why: left.why || undefined,
          file_refs: left.file_refs || undefined
        }
      };
    }

    const leftLen = left.summary.length + (left.why?.length || 0) + (left.file_refs?.length || 0) * 20;
    const rightLen = right.summary.length + (right.why?.length || 0) + (right.file_refs?.length || 0) * 20;

    if (leftLen > rightLen * 1.5) {
      return {
        strategy: `Keep ${leftLabel} (more complete)`,
        reason: `${leftLabel} version has significantly more detail`,
        resolved: {
          summary: left.summary,
          why: left.why || undefined,
          file_refs: left.file_refs || undefined
        }
      };
    }

    if (rightLen > leftLen * 1.5) {
      return {
        strategy: `Keep ${rightLabel} (more complete)`,
        reason: `${rightLabel} version has significantly more detail`,
        resolved: {
          summary: right.summary,
          why: right.why || undefined,
          file_refs: right.file_refs || undefined
        }
      };
    }

    return {
      strategy: 'Keep both',
      reason: 'Both versions appear valid and independently useful',
      resolved: {
        summary: left.summary,
        why: left.why || undefined,
        file_refs: left.file_refs || undefined
      }
    };
  }

  private async runGitMerge(branch: string, options: WorktreeMergeOptions): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log(`Git merge: ${branch}`);
    console.log('='.repeat(60));

    const result = cp.spawnSync('git', ['merge', branch, '--no-edit'], {
      encoding: 'utf-8',
      cwd: this.projectDir
    });

    if (result.status === 0) {
      console.log(`  ✓ Merged ${branch}`);
      this.session!.git_merged = true;
      await this.saveSession();
      return;
    }

    console.log(`  ✗ Git merge has conflicts`);

    const diffResult = cp.spawnSync('git', ['diff', '--name-only', '--diff-filter=U'], {
      encoding: 'utf-8',
      cwd: this.projectDir
    });

    const conflicts = diffResult.stdout.trim().split('\n').filter(Boolean);
    console.log(`  Conflicts in: ${conflicts.join(', ')}`);

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Git merge has conflicts. What would you like to do?',
        choices: [
          { name: 'Abort (rollback MM and git)', value: 'abort' },
          { name: 'Continue (resolve conflicts manually)', value: 'continue' }
        ]
      }
    ]);

    if (action === 'abort') {
      cp.spawnSync('git', ['merge', '--abort'], {
        encoding: 'utf-8',
        cwd: this.projectDir
      });
      console.log('  Git merge aborted');

      if (this.session?.backup_path && await fs.pathExists(this.session.backup_path)) {
        await fs.copy(this.session.backup_path, this.dbPath);
        console.log(`  Database restored from backup: ${this.session.backup_path}`);
      }

      this.session!.status = 'failed';
      this.session!.error = 'User aborted after git conflicts';
      this.session!.failed_at = new Date().toISOString();
      await this.saveSession();

      process.exit(1);
    }

    console.log('\n  Please resolve git conflicts manually, then:');
    console.log('    git add .');
    console.log('    git commit');
    console.log('\n  The MegaMemory merge has been completed.');
    console.log(`  Backup: ${this.session!.backup_path}`);
    console.log(`  Pre-merge SHA: ${this.session!.pre_merge_sha}`);

    this.session!.git_merged = true;
    await this.saveSession();
  }

  private async finalize(): Promise<void> {
    const remainingConflicts = await this.listConflicts();

    if (remainingConflicts.length > 0) {
      console.log(`\n${remainingConflicts.length} unresolved conflicts remain.`);

      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'There are still unresolved conflicts. What would you like to do?',
          choices: [
            { name: 'Leave as-is', value: 'leave' },
            { name: 'Rollback', value: 'rollback' }
          ]
        }
      ]);

      if (action === 'rollback') {
        await this.rollback(new Error('User requested rollback'));
        return;
      }
    }

    this.session!.status = 'complete';
    this.session!.completed_at = new Date().toISOString();
    await this.saveSession();

    console.log('\n' + '='.repeat(60));
    console.log('MERGE COMPLETE');
    console.log('='.repeat(60));
    console.log();
    console.log('MegaMemory merge:');
    console.log(`  Skipped (shared context): concepts`);
    console.log(`  Clean merge: concepts`);
    console.log(`  Conflicts resolved: ${this.session!.conflicts_resolved}`);
    console.log(`  Backup: ${this.session!.backup_path}`);
    console.log();
    console.log(`Git merge: ${this.session!.git_merged ? '✓ merged ' + this.session!.branch : 'skipped'}`);
    console.log(`Pre-merge SHA: ${this.session!.pre_merge_sha} (saved for manual rollback if needed)`);
    console.log();
    console.log('Merge session archived:');
    console.log(`  ${this.sessionPath}`);
  }

  private async handleError(error: Error): Promise<void> {
    console.error('\nMERGE FAILED');
    console.error(`Error: ${error.message}`);
    await this.rollback(error);
  }

  private async rollback(error: Error): Promise<void> {
    if (this.session?.backup_path && await fs.pathExists(this.session.backup_path)) {
      await fs.copy(this.session.backup_path, this.dbPath);
      console.log(`Database restored from backup: ${this.session.backup_path}`);
    }

    this.session!.status = 'failed';
    this.session!.error = error.message;
    this.session!.failed_at = new Date().toISOString();
    await this.saveSession();

    console.log(`Session: ${this.sessionPath}`);
    console.log();
    console.log('The merge session file is preserved for debugging.');
    console.log(`To retry: fuska worktree-merge ${this.session!.branch}`);

    process.exit(1);
  }
}

export function worktreeMergeCommand(program: Command) {
  program
    .command('worktree-merge <name>')
    .description('Merge a single worktree branch into main (both MegaMemory knowledge and git)')
    .option('-p, --project-dir <path>', 'Main worktree path (default: cwd)')
    .option('--resume', 'Resume from merge-session.json if exists')
    .option('--dry-run', 'Show what would merge, then exit (no merge)')
    .option('--keep <strategy>', 'Non-interactive conflict resolution (left|right|both)')
    .option('--only-git', 'Only merge git branch, skip knowledge merge')
    .option('--only-megamemory', 'Only merge knowledge, skip git merge')
    .option('--force', 'Proceed despite dry-run errors')
    .action(async (name: string, options: any) => {
      const mergeOptions: WorktreeMergeOptions = {
        projectDir: options.projectDir || process.cwd(),
        resume: options.resume || false,
        dryRun: options.dryRun || false,
        keep: options.keep || null,
        onlyGit: options.onlyGit || false,
        onlyMegamemory: options.onlyMegamemory || false,
        force: options.force || false
      };

      if (mergeOptions.keep && !['left', 'right', 'both'].includes(mergeOptions.keep)) {
        console.error('Invalid --keep value. Must be: left, right, or both');
        process.exit(1);
      }

      if (mergeOptions.onlyGit && mergeOptions.onlyMegamemory) {
        console.error('Cannot use --only-git and --only-megamemory together');
        process.exit(1);
      }

      const runner = new WorktreeMergeRunner(mergeOptions);
      await runner.run(name, mergeOptions);
    });
}
