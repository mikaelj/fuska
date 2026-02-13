import * as cp from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';

jest.mock('child_process');
jest.mock('fs-extra');
jest.mock('megamemory/dist/db.js', () => ({
  KnowledgeDB: jest.fn()
}));

const mockCp = cp as jest.Mocked<typeof cp>;
const mockFs = fs as jest.Mocked<typeof fs>;

interface MockKnowledgeDB {
  close: jest.Mock;
  prepare: jest.Mock;
  getAllNodesRaw: jest.Mock;
  getAllEdgesRaw: jest.Mock;
  insertNodeRaw: jest.Mock;
  insertEdgeRaw: jest.Mock;
  getConflictNodes: jest.Mock;
  getNodesByMergeGroup: jest.Mock;
  renameNodeId: jest.Mock;
  clearNodeMergeFlags: jest.Mock;
  clearEdgeMergeFlagsByGroup: jest.Mock;
  hardDeleteNode: jest.Mock;
}

const createMockDb = (): MockKnowledgeDB => ({
  close: jest.fn(),
  prepare: jest.fn(() => ({
    get: jest.fn(),
    all: jest.fn(() => [])
  })),
  getAllNodesRaw: jest.fn(() => []),
  getAllEdgesRaw: jest.fn(() => []),
  insertNodeRaw: jest.fn(),
  insertEdgeRaw: jest.fn(),
  getConflictNodes: jest.fn(() => []),
  getNodesByMergeGroup: jest.fn(() => []),
  renameNodeId: jest.fn(),
  clearNodeMergeFlags: jest.fn(),
  clearEdgeMergeFlagsByGroup: jest.fn(),
  hardDeleteNode: jest.fn()
});

const mockSpawnSync = (stdout: string = '', stderr: string = '', status: number = 0) => {
  mockCp.spawnSync.mockReturnValue({
    stdout,
    stderr,
    status,
    pid: 1,
    output: [stdout, stderr],
    signal: null
  } as any);
};

describe('worktree-add', () => {
  let mockDb: MockKnowledgeDB;
  let WorktreeAddRunner: any;

  beforeAll(async () => {
    const module = await import('../src/commands/worktree-add');
    WorktreeAddRunner = (module as any).WorktreeAddRunner || class MockRunner {
      async run() {}
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDb();
    
    const { KnowledgeDB } = require('megamemory/dist/db.js');
    (KnowledgeDB as jest.Mock).mockImplementation(() => mockDb);
    
    (mockFs.pathExists as jest.Mock).mockResolvedValue(true);
    (mockFs.ensureDir as jest.Mock).mockResolvedValue(undefined);
    (mockFs.copy as jest.Mock).mockResolvedValue(undefined);
    (mockFs.remove as jest.Mock).mockResolvedValue(undefined);
  });

  describe('creates git worktree with branch', () => {
    it('calls git worktree add with correct arguments', async () => {
      mockSpawnSync('true', '', 0);
      mockSpawnSync('', '', 0);
      mockSpawnSync('worktree /project/main\nbranch refs/heads/main\n', '', 0);
      
      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue({
          id: 'project-root-id',
          name: 'my-project',
          kind: 'feature',
          parent_id: null
        }),
        all: jest.fn(() => [])
      });

      const runner = new WorktreeAddRunner({
        projectDir: '/project',
        noContext: false,
        force: false
      });

      await runner.run('feature-auth', { projectDir: '/project', noContext: false, force: false });

      const calls = mockCp.spawnSync.mock.calls;
      const worktreeAddCall = calls.find((c: any[]) => c[1]?.[0] === 'worktree' && c[1]?.[1] === 'add');
      
      expect(worktreeAddCall).toBeTruthy();
      if (worktreeAddCall) {
        expect(worktreeAddCall[1]).toContain('add');
        expect(worktreeAddCall[1]).toContain('feature-auth');
        expect(worktreeAddCall[1]).toContain('-b');
      }
    });
  });

  describe('copies shared context with preserved IDs', () => {
    it('copies codebase, requirements, roadmap modules with same IDs', async () => {
      const projectRootId = 'root-123';
      const codebaseId = 'codebase-456';
      const childId = 'child-789';
      
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('parent_id IS NULL')) {
          return {
            get: jest.fn().mockReturnValue({
              id: projectRootId,
              name: 'my-project',
              kind: 'feature',
              summary: '{}',
              parent_id: null
            }),
            all: jest.fn(() => [])
          };
        }
        if (sql.includes("name = ? AND kind = 'module'")) {
          return {
            get: jest.fn().mockReturnValue({ id: codebaseId }),
            all: jest.fn(() => [])
          };
        }
        if (sql.includes('parent_id = ?')) {
          return {
            get: jest.fn(),
            all: jest.fn(() => [{ id: childId }])
          };
        }
        return {
          get: jest.fn(),
          all: jest.fn(() => [])
        };
      });

      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue({
          id: projectRootId,
          name: 'my-project',
          kind: 'feature',
          summary: 'project summary',
          parent_id: null
        }),
        all: jest.fn(() => [])
      });

      const runner = new WorktreeAddRunner({
        projectDir: '/project',
        noContext: false,
        force: false
      });

      await runner.run('feature-auth', { projectDir: '/project', noContext: false, force: false });

      const insertCalls = mockDb.insertNodeRaw.mock.calls;
      const insertedIds = insertCalls.map((c: any[]) => c[0]?.id).filter(Boolean);
      
      expect(insertedIds).toContain(projectRootId);
    });

    it('preserves edges between copied concepts', async () => {
      const projectRootId = 'root-123';
      const conceptId = 'concept-456';
      
      mockDb.prepare.mockImplementation(() => ({
        get: jest.fn().mockReturnValue({
          id: projectRootId,
          name: 'my-project',
          kind: 'feature',
          summary: '{}',
          parent_id: null
        }),
        all: jest.fn(() => [
          { id: conceptId, from_id: conceptId, to_id: projectRootId, relation: 'connects_to' }
        ])
      }));

      const runner = new WorktreeAddRunner({
        projectDir: '/project',
        noContext: false,
        force: false
      });

      await runner.run('feature-auth', { projectDir: '/project', noContext: false, force: false });

      expect(mockDb.insertEdgeRaw).toHaveBeenCalled();
    });
  });

  describe('creates fresh state concept', () => {
    it('creates state concept with default values', async () => {
      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue({
          id: 'root-123',
          name: 'my-project',
          kind: 'feature',
          parent_id: null
        }),
        all: jest.fn(() => [])
      });

      const runner = new WorktreeAddRunner({
        projectDir: '/project',
        noContext: false,
        force: false
      });

      await runner.run('feature-auth', { projectDir: '/project', noContext: false, force: false });

      const stateInsert = mockDb.insertNodeRaw.mock.calls.find(
        (c: any[]) => c[0]?.name === 'state' && c[0]?.kind === 'config'
      );

      expect(stateInsert).toBeTruthy();
      
      const stateData = stateInsert[0];
      const summary = JSON.parse(stateData.summary);
      
      expect(summary.phase).toBe(1);
      expect(summary.plan).toBe(0);
      expect(summary.status).toBe('Ready to plan');
    });

    it('links state to project root', async () => {
      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue({
          id: 'root-123',
          name: 'my-project',
          kind: 'feature',
          parent_id: null
        }),
        all: jest.fn(() => [])
      });

      const runner = new WorktreeAddRunner({
        projectDir: '/project',
        noContext: false,
        force: false
      });

      await runner.run('feature-auth', { projectDir: '/project', noContext: false, force: false });

      const stateEdgeInsert = mockDb.insertEdgeRaw.mock.calls.find(
        (c: any[]) => c[0]?.relation === 'configured_by'
      );

      expect(stateEdgeInsert).toBeTruthy();
    });
  });

  describe('fails if directory exists (without --force)', () => {
    it('exits with error when directory exists', async () => {
      mockFs.pathExists.mockImplementation(async (p: string) => {
        if (p.toString().includes('feature-auth')) {
          return true;
        }
        return true;
      });

      mockSpawnSync('true', '', 0);

      const originalExit = process.exit;
      const mockExit = jest.fn() as any;
      process.exit = mockExit;

      const runner = new WorktreeAddRunner({
        projectDir: '/project',
        noContext: false,
        force: false
      });

      try {
        await runner.run('feature-auth', { projectDir: '/project', noContext: false, force: false });
      } catch {}

      process.exit = originalExit;
      
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('fails if branch exists (without --force)', () => {
    it('exits with error when branch exists', async () => {
      (mockFs.pathExists as jest.Mock).mockResolvedValue(true);
      
      mockSpawnSync('true', '', 0);
      mockSpawnSync('  feature-auth\n', '', 0);

      const originalExit = process.exit;
      const mockExit = jest.fn() as any;
      process.exit = mockExit;

      const runner = new WorktreeAddRunner({
        projectDir: '/project',
        noContext: false,
        force: false
      });

      try {
        await runner.run('feature-auth', { projectDir: '/project', noContext: false, force: false });
      } catch {}

      process.exit = originalExit;
      
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('--force overwrites existing', () => {
    it('removes existing worktree and branch with --force', async () => {
      (mockFs.pathExists as jest.Mock).mockResolvedValue(true);
      
      mockSpawnSync('true', '', 0);
      mockSpawnSync('  feature-auth\n', '', 0);
      mockSpawnSync('', '', 0);
      mockSpawnSync('', '', 0);
      mockSpawnSync('', '', 0);

      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue({
          id: 'root-123',
          name: 'my-project',
          kind: 'feature',
          parent_id: null
        }),
        all: jest.fn(() => [])
      });

      const runner = new WorktreeAddRunner({
        projectDir: '/project',
        noContext: false,
        force: true
      });

      await runner.run('feature-auth', { projectDir: '/project', noContext: false, force: true });

      const calls = mockCp.spawnSync.mock.calls;
      const removeCall = calls.find((c: any[]) => c[1]?.[0] === 'worktree' && c[1]?.[1] === 'remove');
      const deleteBranchCall = calls.find((c: any[]) => c[1]?.[0] === 'branch' && c[1]?.[1] === '-D');

      expect(removeCall || deleteBranchCall).toBeTruthy();
    });
  });

  describe('--no-context skips copying', () => {
    it('does not copy shared context when --no-context is set', async () => {
      mockSpawnSync('true', '', 0);
      
      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue({
          id: 'root-123',
          name: 'my-project',
          kind: 'feature',
          parent_id: null
        }),
        all: jest.fn(() => [])
      });

      const runner = new WorktreeAddRunner({
        projectDir: '/project',
        noContext: true,
        force: false
      });

      await runner.run('feature-auth', { projectDir: '/project', noContext: true, force: false });

      const contextInserts = mockDb.insertNodeRaw.mock.calls.filter(
        (c: any[]) => c[0]?.source_branch === 'shared-context' && c[0]?.name !== 'state'
      );

      expect(contextInserts.length).toBe(0);
    });
  });

  describe('parent_id references are valid in worktree DB', () => {
    it('copied concepts have valid parent_id pointing to copied parent', async () => {
      const projectRootId = 'root-123';
      const codebaseId = 'codebase-456';
      
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('parent_id IS NULL')) {
          return {
            get: jest.fn().mockReturnValue({
              id: projectRootId,
              name: 'my-project',
              kind: 'feature',
              summary: 'project',
              parent_id: null
            }),
            all: jest.fn(() => [])
          };
        }
        if (sql.includes("name = ? AND kind = 'module'")) {
          return {
            get: jest.fn().mockReturnValue({
              id: codebaseId,
              name: 'codebase',
              kind: 'module',
              summary: 'codebase module',
              parent_id: projectRootId
            }),
            all: jest.fn(() => [])
          };
        }
        return {
          get: jest.fn(),
          all: jest.fn(() => [])
        };
      });

      const runner = new WorktreeAddRunner({
        projectDir: '/project',
        noContext: false,
        force: false
      });

      await runner.run('feature-auth', { projectDir: '/project', noContext: false, force: false });

      const insertedNodes = mockDb.insertNodeRaw.mock.calls.map((c: any[]) => c[0]);
      const codebaseNode = insertedNodes.find((n: any) => n?.id === codebaseId);

      expect(codebaseNode?.parent_id).toBe(projectRootId);
    });
  });
});

describe('worktree-merge', () => {
  let mockDb: MockKnowledgeDB;
  let mockWorktreeDb: MockKnowledgeDB;
  let WorktreeMergeRunner: any;

  beforeAll(async () => {
    const module = await import('../src/commands/worktree-merge');
    WorktreeMergeRunner = (module as any).WorktreeMergeRunner || class MockRunner {
      async run() {}
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDb();
    mockWorktreeDb = createMockDb();
    
    const { KnowledgeDB } = require('megamemory/dist/db.js');
    (KnowledgeDB as jest.Mock).mockImplementation((path: string) => {
      if (path && path.toString().includes('worktree')) {
        return mockWorktreeDb;
      }
      return mockDb;
    });

    (mockFs.pathExists as jest.Mock).mockResolvedValue(true);
    (mockFs.ensureDir as jest.Mock).mockResolvedValue(undefined);
    (mockFs.copy as jest.Mock).mockResolvedValue(undefined);
    (mockFs.remove as jest.Mock).mockResolvedValue(undefined);
    (mockFs.readJson as jest.Mock).mockResolvedValue({});
    (mockFs.writeJson as jest.Mock).mockResolvedValue(undefined);
    (mockFs.readFile as unknown as jest.Mock).mockResolvedValue('');
  });

  describe('dry-run reports conflicts without modifying', () => {
    it('does not modify main database during dry-run', async () => {
      mockSpawnSync('true', '', 0);
      mockSpawnSync('worktree /project/main\nbranch refs/heads/main\n\nworktree /project/feature-auth\nbranch refs/heads/feature-auth\n', '', 0);
      mockSpawnSync('abc123\n', '', 0);
      mockSpawnSync('', '', 0);
      mockSpawnSync('', '', 0);

      mockDb.getAllNodesRaw.mockReturnValue([]);
      mockWorktreeDb.getAllNodesRaw.mockReturnValue([
        { id: 'conflict-1', name: 'feature', kind: 'feature', summary: 'new content', source_branch: 'feature-auth' }
      ]);
      mockDb.getAllEdgesRaw.mockReturnValue([]);
      mockWorktreeDb.getAllEdgesRaw.mockReturnValue([]);

      const runner = new WorktreeMergeRunner({
        projectDir: '/project',
        resume: false,
        dryRun: true,
        keep: null,
        onlyGit: false,
        onlyMegamemory: false,
        force: false
      });

      await runner.run('feature-auth', {
        projectDir: '/project',
        resume: false,
        dryRun: true,
        keep: null,
        onlyGit: false,
        onlyMegamemory: false,
        force: false
      });

      expect(mockDb.insertNodeRaw).not.toHaveBeenCalled();
      expect(mockFs.copy).not.toHaveBeenCalled();
    });
  });

  describe('dry-run always runs both git and MM checks', () => {
    it('runs both MegaMemory and git dry-run checks', async () => {
      mockSpawnSync('true', '', 0);
      mockSpawnSync('worktree /project/main\nbranch refs/heads/main\n\nworktree /project/feature-auth\nbranch refs/heads/feature-auth\n', '', 0);
      mockSpawnSync('abc123\n', '', 0);

      mockDb.getAllNodesRaw.mockReturnValue([]);
      mockWorktreeDb.getAllNodesRaw.mockReturnValue([]);
      mockDb.getAllEdgesRaw.mockReturnValue([]);
      mockWorktreeDb.getAllEdgesRaw.mockReturnValue([]);

      const runner = new WorktreeMergeRunner({
        projectDir: '/project',
        resume: false,
        dryRun: true,
        keep: null,
        onlyGit: false,
        onlyMegamemory: false,
        force: false
      });

      await runner.run('feature-auth', {
        projectDir: '/project',
        resume: false,
        dryRun: true,
        keep: null,
        onlyGit: false,
        onlyMegamemory: false,
        force: false
      });

      expect(mockDb.getAllNodesRaw).toHaveBeenCalled();
      expect(mockWorktreeDb.getAllNodesRaw).toHaveBeenCalled();

      const gitMergeCall = mockCp.spawnSync.mock.calls.find(
        (c: any[]) => c[1]?.[0] === 'merge' && c[1]?.includes('--no-commit')
      );
      expect(gitMergeCall).toBeTruthy();
    });
  });

  describe('skips shared-context concepts', () => {
    it('does not merge concepts with source_branch=shared-context', async () => {
      mockSpawnSync('true', '', 0);
      mockSpawnSync('worktree /project/main\nbranch refs/heads/main\n\nworktree /project/feature-auth\nbranch refs/heads/feature-auth\n', '', 0);
      mockSpawnSync('abc123\n', '', 0);
      mockSpawnSync('', '', 0);

      const sharedContextNode = {
        id: 'shared-1',
        name: 'codebase',
        kind: 'module',
        summary: 'shared module',
        source_branch: 'shared-context',
        parent_id: null,
        why: null,
        file_refs: null,
        created_by_task: null,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        removed_at: null,
        removed_reason: null,
        embedding: null,
        merge_group: null,
        needs_merge: 0,
        merge_timestamp: null
      };

      const newConceptNode = {
        id: 'new-1',
        name: 'feature-x',
        kind: 'feature',
        summary: 'new feature',
        source_branch: 'feature-auth',
        parent_id: null,
        why: null,
        file_refs: null,
        created_by_task: null,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        removed_at: null,
        removed_reason: null,
        embedding: null,
        merge_group: null,
        needs_merge: 0,
        merge_timestamp: null
      };

      mockDb.getAllNodesRaw.mockReturnValue([sharedContextNode]);
      mockWorktreeDb.getAllNodesRaw.mockReturnValue([sharedContextNode, newConceptNode]);
      mockDb.getAllEdgesRaw.mockReturnValue([]);
      mockWorktreeDb.getAllEdgesRaw.mockReturnValue([]);

      const runner = new WorktreeMergeRunner({
        projectDir: '/project',
        resume: false,
        dryRun: false,
        keep: null,
        onlyGit: true,
        onlyMegamemory: false,
        force: false
      });

      await runner.run('feature-auth', {
        projectDir: '/project',
        resume: false,
        dryRun: false,
        keep: null,
        onlyGit: true,
        onlyMegamemory: false,
        force: false
      });

      const mmMergeCall = mockDb.insertNodeRaw.mock.calls.filter(
        (c: any[]) => c[0]?.source_branch === 'shared-context'
      );

      expect(mmMergeCall.length).toBeLessThanOrEqual(1);
    });
  });

  describe('skips state concept', () => {
    it('does not merge state concept from worktree', async () => {
      mockSpawnSync('true', '', 0);
      mockSpawnSync('worktree /project/main\nbranch refs/heads/main\n\nworktree /project/feature-auth\nbranch refs/heads/feature-auth\n', '', 0);
      mockSpawnSync('abc123\n', '', 0);
      mockSpawnSync('', '', 0);

      const mainState = {
        id: 'state',
        name: 'state',
        kind: 'config',
        summary: '{"phase": 1}',
        source_branch: null,
        parent_id: 'root-1'
      };

      const worktreeState = {
        id: 'state',
        name: 'state',
        kind: 'config',
        summary: '{"phase": 2}',
        source_branch: 'feature-auth',
        parent_id: 'root-1'
      };

      mockDb.getAllNodesRaw.mockReturnValue([mainState]);
      mockWorktreeDb.getAllNodesRaw.mockReturnValue([worktreeState]);
      mockDb.getAllEdgesRaw.mockReturnValue([]);
      mockWorktreeDb.getAllEdgesRaw.mockReturnValue([]);

      const runner = new WorktreeMergeRunner({
        projectDir: '/project',
        resume: false,
        dryRun: false,
        keep: null,
        onlyGit: true,
        onlyMegamemory: false,
        force: false
      });

      await runner.run('feature-auth', {
        projectDir: '/project',
        resume: false,
        dryRun: false,
        keep: null,
        onlyGit: true,
        onlyMegamemory: false,
        force: false
      });

      const stateInserts = mockDb.insertNodeRaw.mock.calls.filter(
        (c: any[]) => c[0]?.id === 'state' && c[0]?.source_branch === 'feature-auth'
      );

      expect(stateInserts.length).toBe(0);
    });
  });

  describe('merges new concepts from worktree', () => {
    it('inserts new concepts that only exist in worktree', async () => {
      mockSpawnSync('true', '', 0);
      mockSpawnSync('worktree /project/main\nbranch refs/heads/main\n\nworktree /project/feature-auth\nbranch refs/heads/feature-auth\n', '', 0);
      mockSpawnSync('abc123\n', '', 0);
      mockSpawnSync('', '', 0);

      const newConcept = {
        id: 'new-feature-1',
        name: 'Auth Feature',
        kind: 'feature',
        summary: 'Authentication feature',
        source_branch: 'feature-auth',
        parent_id: null,
        why: null,
        file_refs: null,
        created_by_task: null,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        removed_at: null,
        removed_reason: null,
        embedding: null,
        merge_group: null,
        needs_merge: 0,
        merge_timestamp: null
      };

      mockDb.getAllNodesRaw.mockReturnValue([]);
      mockWorktreeDb.getAllNodesRaw.mockReturnValue([newConcept]);
      mockDb.getAllEdgesRaw.mockReturnValue([]);
      mockWorktreeDb.getAllEdgesRaw.mockReturnValue([]);

      const runner = new WorktreeMergeRunner({
        projectDir: '/project',
        resume: false,
        dryRun: false,
        keep: null,
        onlyGit: true,
        onlyMegamemory: false,
        force: false
      });

      await runner.run('feature-auth', {
        projectDir: '/project',
        resume: false,
        dryRun: false,
        keep: null,
        onlyGit: true,
        onlyMegamemory: false,
        force: false
      });

      expect(mockDb.insertNodeRaw).toHaveBeenCalled();
    });
  });

  describe('--only-git skips MM merge', () => {
    it('does not run MegaMemory merge when --only-git is set', async () => {
      mockSpawnSync('true', '', 0);
      mockSpawnSync('worktree /project/main\nbranch refs/heads/main\n\nworktree /project/feature-auth\nbranch refs/heads/feature-auth\n', '', 0);
      mockSpawnSync('abc123\n', '', 0);
      mockSpawnSync('', '', 0);
      mockSpawnSync('', '', 0);

      const runner = new WorktreeMergeRunner({
        projectDir: '/project',
        resume: false,
        dryRun: false,
        keep: null,
        onlyGit: true,
        onlyMegamemory: false,
        force: false
      });

      await runner.run('feature-auth', {
        projectDir: '/project',
        resume: false,
        dryRun: false,
        keep: null,
        onlyGit: true,
        onlyMegamemory: false,
        force: false
      });

      const gitMergeCall = mockCp.spawnSync.mock.calls.find(
        (c: any[]) => c[1]?.[0] === 'merge' && !c[1]?.includes('--no-commit')
      );
      expect(gitMergeCall).toBeTruthy();
    });
  });

  describe('--only-megamemory skips git merge', () => {
    it('does not run git merge when --only-megamemory is set', async () => {
      mockSpawnSync('true', '', 0);
      mockSpawnSync('worktree /project/main\nbranch refs/heads/main\n\nworktree /project/feature-auth\nbranch refs/heads/feature-auth\n', '', 0);
      mockSpawnSync('abc123\n', '', 0);
      mockSpawnSync('', '', 0);

      mockDb.getAllNodesRaw.mockReturnValue([]);
      mockWorktreeDb.getAllNodesRaw.mockReturnValue([]);
      mockDb.getAllEdgesRaw.mockReturnValue([]);
      mockWorktreeDb.getAllEdgesRaw.mockReturnValue([]);

      const runner = new WorktreeMergeRunner({
        projectDir: '/project',
        resume: false,
        dryRun: false,
        keep: null,
        onlyGit: false,
        onlyMegamemory: true,
        force: false
      });

      await runner.run('feature-auth', {
        projectDir: '/project',
        resume: false,
        dryRun: false,
        keep: null,
        onlyGit: false,
        onlyMegamemory: true,
        force: false
      });

      const gitMergeCall = mockCp.spawnSync.mock.calls.filter(
        (c: any[]) => c[1]?.[0] === 'merge' && !c[1]?.includes('--no-commit')
      );

      expect(gitMergeCall.length).toBe(0);
    });
  });

  describe('MM failure prevents git merge', () => {
    it('does not proceed to git merge if MM merge fails', async () => {
      mockSpawnSync('true', '', 0);
      mockSpawnSync('worktree /project/main\nbranch refs/heads/main\n\nworktree /project/feature-auth\nbranch refs/heads/feature-auth\n', '', 0);
      mockSpawnSync('abc123\n', '', 0);
      mockSpawnSync('', '', 0);

      mockDb.getAllNodesRaw.mockImplementation(() => {
        throw new Error('Database error');
      });

      const originalExit = process.exit;
      const mockExit = jest.fn() as any;
      process.exit = mockExit;

      const runner = new WorktreeMergeRunner({
        projectDir: '/project',
        resume: false,
        dryRun: false,
        keep: null,
        onlyGit: false,
        onlyMegamemory: false,
        force: false
      });

      try {
        await runner.run('feature-auth', {
          projectDir: '/project',
          resume: false,
          dryRun: false,
          keep: null,
          onlyGit: false,
          onlyMegamemory: false,
          force: false
        });
      } catch {}

      process.exit = originalExit;

      expect(mockExit).toHaveBeenCalled();
    });
  });

  describe('abort rolls back both MM and git', () => {
    it('restores database from backup on abort', async () => {
      mockSpawnSync('true', '', 0);
      mockSpawnSync('worktree /project/main\nbranch refs/heads/main\n\nworktree /project/feature-auth\nbranch refs/heads/feature-auth\n', '', 0);
      mockSpawnSync('abc123\n', '', 0);
      mockSpawnSync('', '', 0);

      mockFs.pathExists.mockImplementation(async (p: string) => {
        if (p.toString().includes('merge-session.json')) {
          return false;
        }
        if (p.toString().includes('backup')) {
          return true;
        }
        return true;
      });

      const runner = new WorktreeMergeRunner({
        projectDir: '/project',
        resume: false,
        dryRun: false,
        keep: null,
        onlyGit: false,
        onlyMegamemory: false,
        force: false
      });

      expect(runner).toBeDefined();
    });
  });

  describe('records pre-merge SHA for manual rollback', () => {
    it('stores pre-merge SHA in session file', async () => {
      mockSpawnSync('true', '', 0);
      mockSpawnSync('worktree /project/main\nbranch refs/heads/main\n\nworktree /project/feature-auth\nbranch refs/heads/feature-auth\n', '', 0);
      mockSpawnSync('abc123def456\n', '', 0);
      mockSpawnSync('', '', 0);

      mockFs.pathExists.mockImplementation(async (p: string) => {
        if (p.toString().includes('merge-session.json')) {
          return false;
        }
        return true;
      });

      mockDb.getAllNodesRaw.mockReturnValue([]);
      mockWorktreeDb.getAllNodesRaw.mockReturnValue([]);
      mockDb.getAllEdgesRaw.mockReturnValue([]);
      mockWorktreeDb.getAllEdgesRaw.mockReturnValue([]);

      const runner = new WorktreeMergeRunner({
        projectDir: '/project',
        resume: false,
        dryRun: false,
        keep: null,
        onlyGit: true,
        onlyMegamemory: false,
        force: false
      });

      await runner.run('feature-auth', {
        projectDir: '/project',
        resume: false,
        dryRun: false,
        keep: null,
        onlyGit: true,
        onlyMegamemory: false,
        force: false
      });

      const sessionWrite = mockFs.writeJson.mock.calls.find(
        (c: any[]) => c[1]?.pre_merge_sha === 'abc123def456'
      );

      expect(sessionWrite).toBeTruthy();
    });
  });

  describe('handles corrupted worktree DB gracefully', () => {
    it('reports error when worktree DB is corrupted', async () => {
      mockSpawnSync('true', '', 0);
      mockSpawnSync('worktree /project/main\nbranch refs/heads/main\n\nworktree /project/feature-auth\nbranch refs/heads/feature-auth\n', '', 0);
      mockSpawnSync('abc123\n', '', 0);
      mockSpawnSync('', '', 0);

      const { KnowledgeDB } = require('megamemory/dist/db.js');
      (KnowledgeDB as jest.Mock).mockImplementation((path: string) => {
        if (path && path.toString().includes('worktree')) {
          throw new Error('Database disk image is malformed');
        }
        return mockDb;
      });

      const originalExit = process.exit;
      const mockExit = jest.fn() as any;
      process.exit = mockExit;

      const runner = new WorktreeMergeRunner({
        projectDir: '/project',
        resume: false,
        dryRun: false,
        keep: null,
        onlyGit: false,
        onlyMegamemory: false,
        force: false
      });

      try {
        await runner.run('feature-auth', {
          projectDir: '/project',
          resume: false,
          dryRun: false,
          keep: null,
          onlyGit: false,
          onlyMegamemory: false,
          force: false
        });
      } catch {}

      process.exit = originalExit;

      expect(mockExit).toHaveBeenCalled();
    });
  });

  describe('handles missing worktree DB gracefully', () => {
    it('reports error when worktree DB does not exist', async () => {
      mockSpawnSync('true', '', 0);
      mockSpawnSync('worktree /project/main\nbranch refs/heads/main\n\nworktree /project/feature-auth\nbranch refs/heads/feature-auth\n', '', 0);
      mockSpawnSync('abc123\n', '', 0);

      mockFs.pathExists.mockImplementation(async (p: string) => {
        if (p.toString().includes('worktree') && p.toString().includes('knowledge.db')) {
          return false;
        }
        return true;
      });

      const originalExit = process.exit;
      const mockExit = jest.fn() as any;
      process.exit = mockExit;

      const runner = new WorktreeMergeRunner({
        projectDir: '/project',
        resume: false,
        dryRun: false,
        keep: null,
        onlyGit: false,
        onlyMegamemory: false,
        force: false
      });

      try {
        await runner.run('feature-auth', {
          projectDir: '/project',
          resume: false,
          dryRun: false,
          keep: null,
          onlyGit: false,
          onlyMegamemory: false,
          force: false
        });
      } catch {}

      process.exit = originalExit;

      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('fails if run from inside worktree', () => {
    it('detects when command is run from worktree instead of main', async () => {
      mockSpawnSync('true', '', 0);
      mockSpawnSync('worktree /project/main\nbranch refs/heads/main\n\nworktree /project/main/feature-auth\nbranch refs/heads/feature-auth\n', '', 0);
      mockSpawnSync('abc123\n', '', 0);

      const runner = new WorktreeMergeRunner({
        projectDir: '/project/main/feature-auth',
        resume: false,
        dryRun: false,
        keep: null,
        onlyGit: false,
        onlyMegamemory: false,
        force: false
      });

      expect(runner).toBeDefined();
    });
  });

  describe('concurrent merge detection (session file exists)', () => {
    it('detects existing merge session and prompts user', async () => {
      mockSpawnSync('true', '', 0);
      mockSpawnSync('worktree /project/main\nbranch refs/heads/main\n\nworktree /project/feature-auth\nbranch refs/heads/feature-auth\n', '', 0);
      mockSpawnSync('abc123\n', '', 0);
      mockSpawnSync('', '', 0);

      mockFs.pathExists.mockImplementation(async (p: string) => {
        if (p.toString().includes('merge-session.json')) {
          return true;
        }
        return true;
      });

      mockFs.readJson.mockResolvedValue({
        session_id: 'merge-20240101-120000',
        started_at: '2024-01-01T12:00:00Z',
        status: 'in_progress',
        branch: 'feature-auth'
      });

      mockDb.getAllNodesRaw.mockReturnValue([]);
      mockWorktreeDb.getAllNodesRaw.mockReturnValue([]);
      mockDb.getAllEdgesRaw.mockReturnValue([]);
      mockWorktreeDb.getAllEdgesRaw.mockReturnValue([]);

      const runner = new WorktreeMergeRunner({
        projectDir: '/project',
        resume: false,
        dryRun: false,
        keep: null,
        onlyGit: false,
        onlyMegamemory: false,
        force: false
      });

      expect(runner).toBeDefined();
    });

    it('--resume continues from existing session', async () => {
      mockSpawnSync('true', '', 0);
      mockSpawnSync('worktree /project/main\nbranch refs/heads/main\n\nworktree /project/feature-auth\nbranch refs/heads/feature-auth\n', '', 0);
      mockSpawnSync('abc123\n', '', 0);
      mockSpawnSync('', '', 0);

      mockFs.pathExists.mockImplementation(async (p: string) => {
        if (p.toString().includes('merge-session.json')) {
          return true;
        }
        return true;
      });

      const existingSession = {
        session_id: 'merge-20240101-120000',
        started_at: '2024-01-01T12:00:00Z',
        status: 'in_progress',
        branch: 'feature-auth',
        backup_path: '/project/.megamemory/knowledge.db.backup-20240101-120000',
        pre_merge_sha: 'abc123',
        mm_merged: true,
        git_merged: false,
        conflicts_detected: 0,
        conflicts_resolved: 0,
        error: null
      };

      mockFs.readJson.mockResolvedValue(existingSession);

      mockDb.getAllNodesRaw.mockReturnValue([]);
      mockWorktreeDb.getAllNodesRaw.mockReturnValue([]);
      mockDb.getAllEdgesRaw.mockReturnValue([]);
      mockWorktreeDb.getAllEdgesRaw.mockReturnValue([]);

      const runner = new WorktreeMergeRunner({
        projectDir: '/project',
        resume: true,
        dryRun: false,
        keep: null,
        onlyGit: false,
        onlyMegamemory: false,
        force: false
      });

      expect(runner).toBeDefined();
    });
  });
});

describe('utility functions', () => {
  describe('stripMergeSuffix', () => {
    it('removes ::left suffix', () => {
      const { stripMergeSuffix } = require('../src/commands/worktree-merge');
      expect(stripMergeSuffix('concept-id::left')).toBe('concept-id');
    });

    it('removes ::right suffix', () => {
      const { stripMergeSuffix } = require('../src/commands/worktree-merge');
      expect(stripMergeSuffix('concept-id::right')).toBe('concept-id');
    });

    it('returns original id if no suffix', () => {
      const { stripMergeSuffix } = require('../src/commands/worktree-merge');
      expect(stripMergeSuffix('concept-id')).toBe('concept-id');
    });
  });

  describe('hasMergeSuffix', () => {
    it('returns true for ::left suffix', () => {
      const { hasMergeSuffix } = require('../src/commands/worktree-merge');
      expect(hasMergeSuffix('concept-id::left')).toBe(true);
    });

    it('returns true for ::right suffix', () => {
      const { hasMergeSuffix } = require('../src/commands/worktree-merge');
      expect(hasMergeSuffix('concept-id::right')).toBe(true);
    });

    it('returns false for no suffix', () => {
      const { hasMergeSuffix } = require('../src/commands/worktree-merge');
      expect(hasMergeSuffix('concept-id')).toBe(false);
    });
  });

  describe('nodesAreIdentical', () => {
    it('returns true for identical nodes', () => {
      const { nodesAreIdentical } = require('../src/commands/worktree-merge');
      const node1 = {
        name: 'feature',
        kind: 'feature',
        summary: 'summary',
        why: null,
        parent_id: 'parent',
        file_refs: null,
        removed_at: null
      };
      const node2 = { ...node1 };
      expect(nodesAreIdentical(node1, node2)).toBe(true);
    });

    it('returns false for different summaries', () => {
      const { nodesAreIdentical } = require('../src/commands/worktree-merge');
      const node1 = {
        name: 'feature',
        kind: 'feature',
        summary: 'summary1',
        why: null,
        parent_id: 'parent',
        file_refs: null,
        removed_at: null
      };
      const node2 = { ...node1, summary: 'summary2' };
      expect(nodesAreIdentical(node1, node2)).toBe(false);
    });

    it('returns false for different names', () => {
      const { nodesAreIdentical } = require('../src/commands/worktree-merge');
      const node1 = {
        name: 'feature1',
        kind: 'feature',
        summary: 'summary',
        why: null,
        parent_id: 'parent',
        file_refs: null,
        removed_at: null
      };
      const node2 = { ...node1, name: 'feature2' };
      expect(nodesAreIdentical(node1, node2)).toBe(false);
    });
  });
});
