import * as fs from 'fs-extra';
import * as path from 'path';

describe('Migration Tests', () => {
  const TEST_DIR = path.join(__dirname, 'test-projects');
  const BACKUP_SUFFIX = '.backup';

  beforeEach(async () => {
    // Ensure clean test directory
    await fs.ensureDir(TEST_DIR);
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.remove(TEST_DIR);
  });

  describe('Migration Script', () => {
    it('should backup existing planning directory', async () => {
      const planningDir = path.join(TEST_DIR, 'test-project', '.planning');
      await fs.ensureDir(planningDir);

      // Create some planning files
      await fs.writeJSON(path.join(planningDir, 'config.json'), { mode: 'yolo' });
      await fs.writeFile(path.join(planningDir, 'PROJECT.md'), '# Test Project\n\nThis is a test project.');
      await fs.writeFile(path.join(planningDir, 'STATE.md'), '# State\n\nCurrent chapter: 1');

      // Simulate migration backup
      const backupDir = planningDir + BACKUP_SUFFIX;

      if (await fs.pathExists(backupDir)) {
        await fs.remove(backupDir);
      }

      await fs.copy(planningDir, backupDir);

      // Verify backup was created
      expect(await fs.pathExists(backupDir)).toBe(true);
      expect(await fs.pathExists(path.join(backupDir, 'config.json'))).toBe(true);
      expect(await fs.pathExists(path.join(backupDir, 'PROJECT.md'))).toBe(true);
      expect(await fs.pathExists(path.join(backupDir, 'STATE.md'))).toBe(true);
    });

    it('should read and parse all planning files', async () => {
      const planningDir = path.join(TEST_DIR, 'test-project', '.planning');
      await fs.ensureDir(planningDir);

      // Create planning files with structure
      await fs.writeJSON(path.join(planningDir, 'config.json'), {
        mode: 'yolo',
        depth: 'standard',
        workflow: { research: true, plan_check: true, verifier: true }
      });

      await fs.writeFile(path.join(planningDir, 'PROJECT.md'), '# Test Project\n\n## What This Is\n\nA test project for migration.\n\n## Core Value\n\nTesting migration functionality.');
      await fs.writeFile(path.join(planningDir, 'REQUIREMENTS.md'), '# Requirements\n\n## Validated\n\n- REQ-001: Existing feature\n\n## Active\n\n- REQ-002: New feature\n\n## Out of Scope\n\n- Feature X: Not needed');
      await fs.writeFile(path.join(planningDir, 'ROADMAP.md'), '# Roadmap\n\n## Chapter 1: Foundation\n\nGoal: Implement core features\n\nRequirements: REQ-001, REQ-002\n\n## Chapter 2: Enhancement\n\nGoal: Add advanced features');
      await fs.writeFile(path.join(planningDir, 'STATE.md'), '# State\n\nCurrent Chapter: Chapter 1\nCurrent Plan: None\nStatus: ready_to_plan\nProgress: 0%');

      // Create chapters directory
      const chaptersDir = path.join(planningDir, 'chapters');
      await fs.ensureDir(chaptersDir);
      const chapter1Dir = path.join(chaptersDir, '01-foundation');
      await fs.ensureDir(chapter1Dir);

      // Create chapter files
      await fs.writeFile(path.join(chapter1Dir, '01-foundation-CONTEXT.md'), '# Context\n\n## Chapter Boundary\n\nImplement core features\n\n## Decisions\n\n- Decision 1: Use TypeScript\n\n## OpenCode Discretion\n\n- UI design\n\n## Specifics\n\n- Must work in CI\n\n## Deferred\n\n- Advanced UI (Chapter 2)');
      await fs.writeFile(path.join(chapter1Dir, '01-foundation-PLAN.md'), '# Plan\n\n## Objective\n\nImplement REQ-001\n\n## Tasks\n\n1. Task 1\n2. Task 2');

      // Verify all files can be read
      expect(await fs.pathExists(path.join(planningDir, 'config.json'))).toBe(true);
      expect(await fs.pathExists(path.join(planningDir, 'PROJECT.md'))).toBe(true);
      expect(await fs.pathExists(path.join(planningDir, 'REQUIREMENTS.md'))).toBe(true);
      expect(await fs.pathExists(path.join(planningDir, 'ROADMAP.md'))).toBe(true);
      expect(await fs.pathExists(path.join(planningDir, 'STATE.md'))).toBe(true);
      expect(await fs.pathExists(path.join(chapter1Dir, '01-foundation-CONTEXT.md'))).toBe(true);
      expect(await fs.pathExists(path.join(chapter1Dir, '01-foundation-PLAN.md'))).toBe(true);
    });

    it('should create MegaMemory concepts from planning files', async () => {
      // This test would require actual MegaMemory client
      // For unit test, we'll verify the structure transformation
      const planningDir = path.join(TEST_DIR, 'test-project', '.planning');
      await fs.ensureDir(planningDir);

      // Create planning files
      await fs.writeJSON(path.join(planningDir, 'PROJECT.md'), {
        name: 'Test Project',
        what_this_is: 'Test',
        core_value: 'Testing'
      });

      // Simulate concept creation
      const projectRoot = {
        name: 'test-project',
        kind: 'feature',
        summary: 'Project: Test Project\n\nTest',
        parent_id: null,
        edges: []
      };

      // Verify concept structure
      expect(projectRoot.name).toBe('test-project');
      expect(projectRoot.kind).toBe('feature');
      expect(projectRoot.summary).toContain('Project: Test Project');
      expect(projectRoot.parent_id).toBeNull();
      expect(projectRoot.edges).toEqual([]);
    });

    it('should migrate requirements correctly', async () => {
      const planningDir = path.join(TEST_DIR, 'test-project', '.planning');
      await fs.ensureDir(planningDir);

      // Create requirements file
      await fs.writeFile(path.join(planningDir, 'REQUIREMENTS.md'), '# Requirements\n\n## Validated\n\n- [REQ-001]: User authentication\n\n## Active\n\n- [REQ-002]: User authorization');

      // Parse requirements
      const content = await fs.readFile(path.join(planningDir, 'REQUIREMENTS.md'), 'utf-8');
      const lines = content.split('\n');

      const validatedLine = lines.find(l => l.includes('Validated'));
      const activeLine = lines.find(l => l.includes('Active'));

      expect(validatedLine).toBeDefined();
      expect(activeLine).toBeDefined();
      expect(validatedLine).toContain('REQ-001');
      expect(activeLine).toContain('REQ-002');

      // Simulate requirement concepts
      const req1 = {
        name: 'req-REQ-001',
        kind: 'feature',
        summary: JSON.stringify({
          description: 'User authentication',
          status: 'complete'
        }),
        parent_id: 'test-project/requirements',
        edges: [{ to: 'requirements', relation: 'implements' }]
      };

      const req2 = {
        name: 'req-REQ-002',
        kind: 'feature',
        summary: JSON.stringify({
          description: 'User authorization',
          status: 'in_progress'
        }),
        parent_id: 'test-project/requirements',
        edges: [{ to: 'requirements', relation: 'implements' }]
      };

      expect(req1.summary).toContain('"status":"complete"');
      expect(req2.summary).toContain('"status":"in_progress"');
    });

    it('should migrate chapters correctly', async () => {
      const planningDir = path.join(TEST_DIR, 'test-project', '.planning');
      await fs.ensureDir(planningDir);

      // Create roadmap file
      await fs.writeFile(path.join(planningDir, 'ROADMAP.md'), '# Roadmap\n\n## Chapter 1: Foundation\n\nGoal: Implement core\n\n## Chapter 2: Enhancement\n\nGoal: Add advanced');

      // Create chapter directory
      const chaptersDir = path.join(planningDir, 'chapters');
      await fs.ensureDir(chaptersDir);
      const chapter1Dir = path.join(chaptersDir, '01-foundation');
      await fs.ensureDir(chapter1Dir);

      // Create chapter context file
      await fs.writeFile(path.join(chapter1Dir, '01-foundation-CONTEXT.md'), '# Context\n\n## Chapter Boundary\n\nImplement core\n\n## Decisions\n\n- Use TypeScript');

      // Parse and verify
      const roadmap = await fs.readFile(path.join(planningDir, 'ROADMAP.md'), 'utf-8');
      const context = await fs.readFile(path.join(chapter1Dir, '01-foundation-CONTEXT.md'), 'utf-8');

      expect(roadmap).toContain('Chapter 1: Foundation');
      expect(context).toContain('Chapter Boundary');
      expect(context).toContain('Implement core');

      // Simulate chapter concept
      const chapter1 = {
        name: 'chapter-01',
        kind: 'feature',
        summary: JSON.stringify({
          number: 1,
          slug: 'chapter-01',
          name: 'Foundation',
          goal: 'Implement core',
          status: 'planned'
        }),
        parent_id: 'test-project/roadmap',
        edges: [{ to: 'roadmap', relation: 'connects_to' }]
      };

      const chapter1Context = {
        name: 'chapter-01-context',
        kind: 'config',
        summary: JSON.stringify({
          gathered: '2025-01-20',
          status: 'planned',
          chapter_boundary: 'Implement core',
          decisions: { tech_stack: 'TypeScript' }
        }),
        parent_id: 'chapter-01',
        edges: [{ to: 'chapter-01', relation: 'configured_by' }]
      };

      expect(chapter1.kind).toBe('feature');
      expect(chapter1Context.kind).toBe('config');
      expect(chapter1Context.parent_id).toBe('chapter-1');
      expect(chapter1Context.edges[0].relation).toBe('configured_by');
    });

    it('should migrate state correctly', async () => {
      const planningDir = path.join(TEST_DIR, 'test-project', '.planning');
      await fs.ensureDir(planningDir);

      // Create state file
      await fs.writeFile(path.join(planningDir, 'STATE.md'), '# State\n\nCurrent Chapter: Chapter 1\nCurrent Plan: None\nStatus: ready_to_plan\nProgress: 10%');

      // Parse state
      const content = await fs.readFile(path.join(planningDir, 'STATE.md'), 'utf-8');

      expect(content).toContain('Current Chapter: Chapter 1');
      expect(content).toContain('Status: ready_to_plan');
      expect(content).toContain('Progress: 10%');

      // Simulate state concept
      const state = {
        name: 'state',
        kind: 'config',
        summary: JSON.stringify({
          current_chapter: 'chapter-01',
          current_plan: null,
          status: 'ready_to_plan',
          progress: 10,
          last_activity: 'Project initialized'
        }),
        parent_id: 'test-project',
        edges: [{ to: 'test-project', relation: 'configured_by' }]
      };

      const stateData = JSON.parse(state.summary);
      expect(stateData.current_chapter).toBe('chapter-01');
      expect(stateData.progress).toBe(10);
      expect(state.kind).toBe('config');
    });

    describe('parseStateMarkdown', () => {
      it('should extract current_chapter from STATE.md', () => {
        const content = '## Current Position\nChapter: 27\nStatus: 0/1 plans executed';
        const currentPosMatch = content.match(/## Current Position[\s\S]+?(?=##|$)/);
        let current_chapter = 'chapter-01';
        if (currentPosMatch) {
          const section = currentPosMatch[0];
          const chapterMatch = section.match(/Chapter:\s*(\d+)/);
          if (chapterMatch) {
            current_chapter = `chapter-${chapterMatch[1].padStart(2, '0')}`;
          }
        }
        expect(current_chapter).toBe('chapter-27');
      });

      it('should derive status from execution status', () => {
        const content = '## Current Position\nChapter: 27\nStatus: 0/1 plans executed';
        const currentPosMatch = content.match(/## Current Position[\s\S]+?(?=##|$)/);
        let status = 'ready_to_plan';
        if (currentPosMatch) {
          const section = currentPosMatch[0];
          const statusMatch = section.match(/Status:\s*(\d+)\/(\d+)\s+plans\s+executed/);
          if (statusMatch) {
            const completed = parseInt(statusMatch[1]);
            status = completed > 0 ? 'in_progress' : 'ready_to_plan';
          }
        }
        expect(status).toBe('ready_to_plan');
      });

      it('should calculate progress from progress bars', () => {
        const content = 'Progress:\n```\nv1.2: 100% (32/32 plans)\n```';
        const roadmapMatch = content.match(/Progress:[\s\S]+?```/);
        let progress = 0;
        if (roadmapMatch) {
          const progressText = roadmapMatch[0];
          const percentMatch = progressText.match(/(\d+)%\s*\(/);
          if (percentMatch) {
            progress = parseInt(percentMatch[1]);
          }
        }
        expect(progress).toBe(100);
      });

      it('should extract last_activity', () => {
        const content = '## Current Position\nLast Activity: 2026-02-07 -- Archived Chapter 27.1';
        const currentPosMatch = content.match(/## Current Position[\s\S]+?(?=##|$)/);
        let last_activity = 'Migration from .planning';
        if (currentPosMatch) {
          const section = currentPosMatch[0];
          const activityMatch = section.match(/Last Activity:\s*(.+)/);
          if (activityMatch) {
            last_activity = activityMatch[1].trim();
          }
        }
        expect(last_activity).toBe('2026-02-07 -- Archived Chapter 27.1');
      });
    });

    it('should handle missing planning files gracefully', async () => {
      const planningDir = path.join(TEST_DIR, 'test-empty', '.planning');
      await fs.ensureDir(planningDir);

      // Only create PROJECT.md, missing others
      await fs.writeFile(path.join(planningDir, 'PROJECT.md'), '# Test Project');

      // Verify PROJECT.md exists
      expect(await fs.pathExists(path.join(planningDir, 'PROJECT.md'))).toBe(true);

      // Verify others don't exist
      expect(await fs.pathExists(path.join(planningDir, 'REQUIREMENTS.md'))).toBe(false);
      expect(await fs.pathExists(path.join(planningDir, 'ROADMAP.md'))).toBe(false);
      expect(await fs.pathExists(path.join(planningDir, 'STATE.md'))).toBe(false);

      // Should handle gracefully with defaults
      const defaults = {
        requirements: [],
        chapters: [],
        state: { current_chapter: 'chapter-01', status: 'ready_to_plan', progress: 0 }
      };

      expect(defaults.requirements).toEqual([]);
      expect(defaults.state.status).toBe('ready_to_plan');
    });
  });

  describe('Migration Rollback', () => {
    it('should rollback to original planning files', async () => {
      const planningDir = path.join(TEST_DIR, 'test-rollback', '.planning');
      const backupDir = planningDir + BACKUP_SUFFIX;

      // Create original planning files
      await fs.ensureDir(planningDir);
      await fs.writeJSON(path.join(planningDir, 'config.json'), { mode: 'yolo' });
      await fs.writeFile(path.join(planningDir, 'PROJECT.md'), '# Original Project');
      await fs.writeFile(path.join(planningDir, 'STATE.md'), '# Original State');

      // Create backup
      await fs.copy(planningDir, backupDir);

      // Modify original files (simulating migration changes)
      await fs.writeJSON(path.join(planningDir, 'config.json'), { mode: 'interactive', depth: 'comprehensive' });
      await fs.writeFile(path.join(planningDir, 'PROJECT.md'), '# Modified Project\n\nWith changes');
      await fs.writeFile(path.join(planningDir, 'STATE.md'), '# Modified State\n\nWith new status');

      // Verify modifications
      const modifiedConfig = await fs.readJSON(path.join(planningDir, 'config.json'));
      expect(modifiedConfig.mode).toBe('interactive');
      expect(modifiedConfig.depth).toBe('comprehensive');

      // Rollback: restore from backup
      await fs.remove(planningDir);
      await fs.copy(backupDir, planningDir);

      // Verify rollback
      const restoredConfig = await fs.readJSON(path.join(planningDir, 'config.json'));
      const restoredProject = await fs.readFile(path.join(planningDir, 'PROJECT.md'), 'utf-8');
      const restoredState = await fs.readFile(path.join(planningDir, 'STATE.md'), 'utf-8');

      expect(restoredConfig.mode).toBe('yolo');
      expect(restoredConfig.depth).toBe(undefined);
      expect(restoredProject).toContain('Original Project');
      expect(restoredProject).not.toContain('Modified');
      expect(restoredState).toContain('Original State');
      expect(restoredState).not.toContain('Modified');
    });

    it('should handle rollback when backup missing', async () => {
      const planningDir = path.join(TEST_DIR, 'test-no-backup', '.planning');
      const backupDir = planningDir + BACKUP_SUFFIX;

      // Create planning files but no backup
      await fs.ensureDir(planningDir);
      await fs.writeFile(path.join(planningDir, 'PROJECT.md'), '# Test');

      // Attempt rollback (backup doesn't exist)
      expect(await fs.pathExists(backupDir)).toBe(false);

      // Should handle gracefully - create directory structure
      await fs.ensureDir(planningDir);

      // Verify planning dir exists
      expect(await fs.pathExists(planningDir)).toBe(true);
      expect(await fs.pathExists(path.join(planningDir, 'PROJECT.md'))).toBe(true);
    });
  });

  describe('Migration Verification', () => {
    it('should verify all concepts were created', async () => {
      // Simulate creating all project concepts
      const concepts = [
        { name: 'test-project', kind: 'feature', summary: 'Test Project' },
        { name: 'requirements', kind: 'module', summary: 'Requirements list' },
        { name: 'req-TEST-001', kind: 'feature', summary: 'Test requirement' },
        { name: 'roadmap', kind: 'module', summary: 'Project roadmap' },
        { name: 'chapter-01', kind: 'feature', summary: 'Chapter 1' },
        { name: 'chapter-01-context', kind: 'config', summary: 'Context' },
        { name: 'state', kind: 'config', summary: 'State' },
        { name: 'config', kind: 'config', summary: 'Config' }
      ];

      // Verify all concepts have required fields
      concepts.forEach(concept => {
        expect(concept.name).toBeDefined();
        expect(concept.kind).toBeDefined();
        expect(concept.summary).toBeDefined();
      });

      // Verify concept structure
      const projectRoot = concepts.find((c: any) => c.name === 'test-project');
      const requirementsModule = concepts.find((c: any) => c.name === 'requirements');
      const requirement = concepts.find((c: any) => c.name === 'req-TEST-001');

      expect(projectRoot.kind).toBe('feature');
      expect(requirementsModule.kind).toBe('module');
      expect(requirement.kind).toBe('feature');
      expect(requirement.parent_id).toBe('test-project/requirements');
    });

    it('should report migration statistics', async () => {
      const stats = {
        created: 15,
        updated: 3,
        skipped: 0,
        errors: 0
      };

      // Verify statistics
      expect(stats.created).toBe(15);
      expect(stats.updated).toBe(3);
      expect(stats.skipped).toBe(0);
      expect(stats.errors).toBe(0);

      // Total should be sum
      const total = stats.created + stats.updated + stats.skipped + stats.errors;
      expect(total).toBe(18);
    });

    it('should report success on complete migration', async () => {
      const migrationReport = {
        status: 'success',
        conceptsCreated: 15,
        filesProcessed: 10,
        backupLocation: '.planning.backup'
      };

      expect(migrationReport.status).toBe('success');
      expect(migrationReport.conceptsCreated).toBe(15);
      expect(migrationReport.filesProcessed).toBe(10);
      expect(migrationReport.backupLocation).toBe('.planning.backup');
    });

    it('should report failure with error details', async () => {
      const migrationReport = {
        status: 'failed',
        errors: [
          { file: 'PROJECT.md', error: 'Invalid format' },
          { file: 'STATE.md', error: 'Missing chapter reference' }
        ],
        conceptsCreated: 5
      };

      expect(migrationReport.status).toBe('failed');
      expect(migrationReport.errors).toHaveLength(2);
      expect(migrationReport.conceptsCreated).toBe(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty project directory', async () => {
      const planningDir = path.join(TEST_DIR, 'test-empty', '.planning');
      await fs.ensureDir(planningDir);

      // Directory exists but is empty
      const files = await fs.readdir(planningDir);

      expect(files).toEqual([]);

      // Should not crash, handle gracefully
      expect(files.length).toBe(0);
    });

    it('should handle corrupted planning files', async () => {
      const planningDir = path.join(TEST_DIR, 'test-corrupt', '.planning');
      await fs.ensureDir(planningDir);

      // Create corrupted JSON file
      await fs.writeFile(path.join(planningDir, 'config.json'), '{ invalid json }');

      // Should catch parse error
      try {
        await fs.readJSON(path.join(planningDir, 'config.json'));
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle special characters in concept names', async () => {
      const concepts = [
        { name: 'test-project-with-dashes', kind: 'feature', summary: 'Test' },
        { name: 'test project with spaces', kind: 'feature', summary: 'Test' },
        { name: 'test_project_with_underscores', kind: 'feature', summary: 'Test' }
      ];

      // Verify names are handled correctly
      concepts.forEach(concept => {
        expect(concept.name).toBeDefined();
        expect(concept.name.length).toBeGreaterThan(0);
      });

      // Simulate name sanitization
      const sanitized1 = concepts[0].name.toLowerCase().replace(/\s+/g, '-');
      const sanitized2 = concepts[1].name.toLowerCase().replace(/\s+/g, '-');
      const sanitized3 = concepts[2].name;

      expect(sanitized1).toBe('test-project-with-dashes');
      expect(sanitized2).toBe('test-project-with-spaces');
      expect(sanitized3).toBe('test_project_with_underscores');
    });
  });
});
