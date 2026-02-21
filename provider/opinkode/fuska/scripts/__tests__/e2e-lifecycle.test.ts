import { MegaMemoryClient } from '../types';

describe('Full Fuska Lifecycle E2E Test', () => {
  let megaMemory: MegaMemoryClient;

  beforeAll(async () => {
    // Initialize fresh MegaMemory instance
    // In real test, this would connect to actual MegaMemory
    // For this test suite, we'll mock it
  });

  beforeEach(() => {
    // Reset MegaMemory state
    megaMemory = {
      understand: async ({ query, top_k }) => ({
        query,
        matches: [],
        total: 0
      }),
      create_concept: async () => ({ id: 'test-id', concept: {} as any }),
      update_concept: async () => ({ success: true }),
      remove_concept: async () => ({ success: true }),
      link: async () => ({ success: true }),
      list_roots: async () => ({ roots: [] })
    };
  });

  describe('Complete Project Lifecycle', () => {
    it('should complete new project workflow', async () => {
      // 1. Initialize project
      await megaMemory.create_concept({
        name: 'test-lifecycle-project',
        kind: 'feature',
        summary: 'Test Project for E2E',
        parent_id: null,
        edges: []
      });

      // 2. Create state
      await megaMemory.create_concept({
        name: 'state',
        kind: 'config',
        summary: JSON.stringify({
          current_chapter: 'chapter-01',
          current_plan: null,
          status: 'ready_to_plan',
          progress: 0
        }),
        parent_id: 'test-lifecycle-project',
        edges: [{ to: 'test-lifecycle-project', relation: 'configured_by' }]
      });

      // 3. Create roadmap
      await megaMemory.create_concept({
        name: 'roadmap',
        kind: 'module',
        summary: 'Project roadmap',
        parent_id: 'test-lifecycle-project',
        edges: [{ to: 'test-lifecycle-project', relation: 'connects_to' }]
      });

      const roots = await megaMemory.list_roots();
      expect(roots.roots.length).toBe(1);
      expect(roots.roots[0].name).toBe('test-lifecycle-project');
    });

    it('should complete discuss chapter workflow', async () => {
      // Setup: Create chapter concept
      await megaMemory.create_concept({
        name: 'chapter-1',
        kind: 'feature',
        summary: JSON.stringify({
          number: 1,
          slug: 'chapter-01',
          name: 'Authentication',
          goal: 'Implement authentication',
          status: 'planned'
        }),
        parent_id: 'roadmap',
        edges: [{ to: 'roadmap', relation: 'connects_to' }]
      });

      // Discuss chapter: Create context
      await megaMemory.create_concept({
        name: 'chapter-01-context',
        kind: 'config',
        summary: JSON.stringify({
          gathered: new Date().toISOString().split('T')[0],
          status: 'ready_for_planning',
          chapter_boundary: 'Implement JWT authentication',
          decisions: {
            auth_type: 'JWT',
            library: 'jose'
          },
          open_code_discretion: [],
          specifics: [],
          deferred: []
        }),
        parent_id: 'chapter-1',
        edges: [{ to: 'chapter-1', relation: 'configured_by' }]
      });

      // Verify context created
      const context = await megaMemory.understand({ query: 'chapter-01-context' });
      expect(context.matches.length).toBe(1);
      expect(context.matches[0].kind).toBe('config');
    });

    it('should complete plan chapter workflow', async () => {
      // Setup: Create research
      await megaMemory.create_concept({
        name: 'chapter-01-research',
        kind: 'pattern',
        summary: JSON.stringify({
          domain: 'authentication',
          confidence: 'high',
          sources: ['JWT.io'],
          standard_stack: ['jose', 'bcrypt'],
          architecture_patterns: ['Token rotation'],
          pitfalls: ['Token expiration timing']
        }),
        parent_id: 'chapter-1',
        edges: [{ to: 'chapter-1', relation: 'connects_to' }]
      });

      // Create plan
      await megaMemory.create_concept({
        name: 'chapter-01-plan-1',
        kind: 'feature',
        summary: JSON.stringify({
          objective: 'Implement JWT login',
          purpose: 'Secure authentication',
          output: 'Working login system',
          requirements: ['Login endpoint', 'Token generation', 'Token validation'],
          megamemory_references: {
            knowledge_applied: ['chapter-01-context', 'chapter-01-research'],
            patterns_to_follow: ['Token rotation']
          },
          tasks: [
            { description: 'Setup jose library', type: 'setup' },
            { description: 'Create login endpoint', dependencies: ['Setup jose library'] }
          ]
        }),
        parent_id: 'chapter-1',
        edges: [
          { to: 'chapter-1', relation: 'implements' },
          { to: 'chapter-01-context', relation: 'depends_on' },
          { to: 'chapter-01-research', relation: 'depends_on' }
        ]
      });

      // Verify plan created
      const plan = await megaMemory.understand({ query: 'chapter-01-plan' });
      expect(plan.matches.length).toBe(1);
      const data = JSON.parse(plan.matches[0].summary);
      expect(data.requirements.length).toBe(3);
    });

    it('should complete execute chapter workflow', async () => {
      // Setup: Create plan
      await megaMemory.create_concept({
        name: 'chapter-01-plan-1',
        kind: 'feature',
        summary: JSON.stringify({
          objective: 'Implement login',
          tasks: [
            { description: 'Create auth service' },
            { description: 'Create login endpoint', dependencies: ['Create auth service'] }
          ]
        }),
        parent_id: 'chapter-1',
        edges: []
      });

      // Create summary after execution
      const summaryData = {
        chapter: 'chapter-01',
        plan: 'chapter-01-plan-1',
        subsystem: 'Authentication',
        tags: ['auth'],
        tech_stack: {
          added: ['jose'],
          patterns: []
        },
        key_files: {
          created: ['auth.service.ts'],
          modified: ['app.module.ts']
        },
        key_decisions: ['Use jose library'],
        duration_minutes: 60,
        completed: new Date().toISOString(),
        accomplishments: [
          'Created auth service',
          'Implemented login endpoint',
          'Added JWT token generation'
        ],
        task_commits: [
          { task: 'Create auth service', commit: 'abc123' },
          { task: 'Create login endpoint', commit: 'def456' }
        ],
        files_modified: ['auth.service.ts', 'auth.controller.ts', 'app.module.ts'],
        decisions_made: {},
        deviations: [],
        issues_encountered: [],
        next_chapter_readiness: 'Ready'
      };

      await megaMemory.create_concept({
        name: 'chapter-01-plan-1-summary',
        kind: 'component',
        summary: JSON.stringify(summaryData),
        parent_id: 'chapter-1',
        edges: [
          { to: 'chapter-01-plan-1', relation: 'connects_to' },
          { to: 'chapter-1', relation: 'connects_to' }
        ],
        created_by_task: 'chapter-01-plan-1'
      });

      // Verify summary created
      const summary = await megaMemory.understand({ query: 'summary' });
      expect(summary.matches.length).toBe(1);
      const data = JSON.parse(summary.matches[0].summary);
      expect(data.accomplishments.length).toBe(3);
      expect(data.duration_minutes).toBe(60);
    });

    it('should complete verify work workflow - all pass', async () => {
      // Setup: Chapter has summary
      await megaMemory.create_concept({
        name: 'chapter-01-plan-1-summary',
        kind: 'component',
        summary: JSON.stringify({
          accomplishments: ['Login works', 'Logout works', 'Password reset works']
        }),
        parent_id: 'chapter-1',
        edges: []
      });

      // Create verification concept with all tests passing
      const verificationData = {
        verification_results: [
          'User can login with valid credentials',
          'User cannot login with invalid credentials',
          'User can logout',
          'Password reset works'
        ],
        issues_found: [],
        recommendations: [],
        concepts_reviewed: ['chapter-01-plan-1-summary']
      };

      await megaMemory.create_concept({
        name: 'chapter-01-verification',
        kind: 'component',
        summary: JSON.stringify(verificationData),
        parent_id: 'chapter-1',
        edges: [
          { to: 'chapter-1', relation: 'connects_to' },
          { to: 'chapter-01-plan-1-summary', relation: 'connects_to' }
        ]
      });

      // Verify verification created
      const verification = await megaMemory.understand({ query: 'verification' });
      expect(verification.matches.length).toBe(1);
      const data = JSON.parse(verification.matches[0].summary);
      expect(data.verification_results.length).toBe(4);
      expect(data.issues_found.length).toBe(0);
    });

    it('should complete verify work workflow - with issues', async () => {
      // Setup: Chapter has summary
      await megaMemory.create_concept({
        name: 'chapter-01-plan-1-summary',
        kind: 'component',
        summary: JSON.stringify({
          accomplishments: ['Login works']
        }),
        parent_id: 'chapter-1',
        edges: []
      });

      // Create verification concept with issues
      const verificationData = {
        verification_results: ['Login works', 'Logout fails'],
        issues_found: ['Logout endpoint crashes on token expiry'],
        recommendations: ['Fix logout crash'],
        concepts_reviewed: ['chapter-01-plan-1-summary']
      };

      await megaMemory.create_concept({
        name: 'chapter-01-verification',
        kind: 'component',
        summary: JSON.stringify(verificationData),
        parent_id: 'chapter-1',
        edges: [{ to: 'chapter-1', relation: 'connects_to' }]
      });

      // Verify verification with issues
      const verification = await megaMemory.understand({ query: 'verification' });
      expect(verification.matches.length).toBe(1);
      const data = JSON.parse(verification.matches[0].summary);
      expect(data.verification_results.length).toBe(2);
      expect(data.issues_found.length).toBe(1);
      expect(data.recommendations.length).toBe(1);
    });

    it('should complete multi-chapter lifecycle', async () => {
      // Chapter 1: Auth
      await megaMemory.create_concept({
        name: 'chapter-1',
        kind: 'feature',
        summary: JSON.stringify({ number: 1, name: 'Auth', goal: 'Implement auth', status: 'complete' }),
        parent_id: 'roadmap',
        edges: []
      });

      // Chapter 2: Data
      await megaMemory.create_concept({
        name: 'chapter-2',
        kind: 'feature',
        summary: JSON.stringify({ number: 2, name: 'Data', goal: 'Implement data layer', status: 'complete' }),
        parent_id: 'roadmap',
        edges: []
      });

      // Chapter 3: UI
      await megaMemory.create_concept({
        name: 'chapter-3',
        kind: 'feature',
        summary: JSON.stringify({ number: 3, name: 'UI', goal: 'Build user interface', status: 'in_progress' }),
        parent_id: 'roadmap',
        edges: []
      });

      // Query all chapters
      const chapters = await megaMemory.understand({ query: 'chapter' });
      expect(chapters.matches.length).toBe(3);

      // Count completed chapters
      const completed = chapters.matches.filter((p: any) => {
        const data = JSON.parse(p.summary);
        return data.status === 'complete';
      });
      expect(completed.length).toBe(2);
    });

    it('should update state throughout lifecycle', async () => {
      // Initial state
      await megaMemory.create_concept({
        name: 'state',
        kind: 'config',
        summary: JSON.stringify({
          current_chapter: 'chapter-01',
          current_plan: null,
          status: 'ready_to_plan',
          progress: 0
        }),
        parent_id: 'test-project',
        edges: []
      });

      // After planning
      const state1 = await megaMemory.understand({ query: 'state' });
      await megaMemory.update_concept({
        id: state1.matches[0].id,
        changes: {
          summary: JSON.stringify({
            current_chapter: 'chapter-01',
            current_plan: 'chapter-01-plan-1',
            status: 'ready_to_execute',
            progress: 10
          })
        }
      });

      // After execution
      const state2 = await megaMemory.understand({ query: 'state' });
      await megaMemory.update_concept({
        id: state2.matches[0].id,
        changes: {
          summary: JSON.stringify({
            current_chapter: 'chapter-02',
            current_plan: null,
            status: 'ready_to_plan',
            progress: 33
          })
        }
      });

      // Verify final state
      const finalState = await megaMemory.understand({ query: 'state' });
      const data = JSON.parse(finalState.matches[0].summary);
      expect(data.current_chapter).toBe('chapter-02');
      expect(data.progress).toBe(33);
      expect(data.status).toBe('ready_to_plan');
    });
  });

  describe('Resume Work Workflow', () => {
    it('should resume from mid-execution state', async () => {
      // Setup: Incomplete execution
      await megaMemory.create_concept({
        name: 'state',
        kind: 'config',
        summary: JSON.stringify({
          current_chapter: 'chapter-01',
          current_plan: 'chapter-01-plan-1',
          status: 'in_progress',
          progress: 15
        }),
        parent_id: 'test-project',
        edges: []
      });
      await megaMemory.create_concept({
        name: 'chapter-01-plan-1',
        kind: 'feature',
        summary: JSON.stringify({ objective: 'Implement login' }),
        parent_id: 'chapter-1',
        edges: []
      });

      // Resume: Detect incomplete work
      const state = await megaMemory.understand({ query: 'state' });
      const plans = await megaMemory.understand({ query: 'plan' });
      const summaries = await megaMemory.understand({ query: 'summary' });

      const stateData = JSON.parse(state.matches[0].summary);
      expect(stateData.status).toBe('in_progress');
      expect(plans.matches.length).toBeGreaterThan(0);
      expect(summaries.matches.length).toBe(0); // No summary yet = incomplete
    });

    it('should resume after chapter completion', async () => {
      // Setup: Completed chapter
      await megaMemory.create_concept({
        name: 'state',
        kind: 'config',
        summary: JSON.stringify({
          current_chapter: 'chapter-01',
          current_plan: null,
          status: 'chapter_complete',
          progress: 50
        }),
        parent_id: 'test-project',
        edges: []
      });
      await megaMemory.create_concept({
        name: 'chapter-01-plan-1-summary',
        kind: 'component',
        summary: JSON.stringify({ accomplishments: ['Done'] }),
        parent_id: 'chapter-1',
        edges: []
      });

      // Resume: Should suggest next chapter
      const state = await megaMemory.understand({ query: 'state' });
      const stateData = JSON.parse(state.matches[0].summary);
      expect(stateData.status).toBe('chapter_complete');
      expect(stateData.progress).toBe(50);
    });
  });

  describe('Knowledge Graph Integrity', () => {
    it('should maintain proper concept hierarchy', async () => {
      // Create proper hierarchy
      await megaMemory.create_concept({
        name: 'test-project',
        kind: 'feature',
        summary: 'Test Project',
        parent_id: null,
        edges: []
      });
      await megaMemory.create_concept({
        name: 'requirements',
        kind: 'module',
        summary: 'Requirements',
        parent_id: 'test-project',
        edges: [{ to: 'test-project', relation: 'connects_to' }]
      });
      await megaMemory.create_concept({
        name: 'req-AUTH-01',
        kind: 'feature',
        summary: JSON.stringify({ description: 'User can login', status: 'active' }),
        parent_id: 'test-project/requirements',
        edges: [{ to: 'requirements', relation: 'implements' }]
      });

      // Verify hierarchy
      const project = await megaMemory.understand({ query: 'test-project' });
      const reqs = await megaMemory.understand({ query: 'req-' });
      const module = await megaMemory.understand({ query: 'requirements' });

      expect(project.matches.length).toBe(1);
      expect(reqs.matches.length).toBe(1);
      expect(module.matches.length).toBe(1);

      const reqData = JSON.parse(reqs.matches[0].summary);
      expect(reqs.matches[0].parent_id).toBe('test-project/requirements');
    });

    it('should maintain proper edge relationships', async () => {
      // Create concepts with edges
      await megaMemory.create_concept({
        name: 'chapter-1',
        kind: 'feature',
        summary: JSON.stringify({ number: 1 }),
        parent_id: 'roadmap',
        edges: [{ to: 'roadmap', relation: 'connects_to' }]
      });
      await megaMemory.create_concept({
        name: 'chapter-01-context',
        kind: 'config',
        summary: JSON.stringify({ chapter_boundary: 'Auth' }),
        parent_id: 'chapter-1',
        edges: [{ to: 'chapter-1', relation: 'configured_by' }]
      });
      await megaMemory.create_concept({
        name: 'chapter-01-plan-1',
        kind: 'feature',
        summary: JSON.stringify({ objective: 'Implement login' }),
        parent_id: 'chapter-1',
        edges: [{ to: 'chapter-1', relation: 'implements' }]
      });
      await megaMemory.create_concept({
        name: 'chapter-01-plan-1-summary',
        kind: 'component',
        summary: JSON.stringify({ accomplishments: ['Done'] }),
        parent_id: 'chapter-1',
        edges: [
          { to: 'chapter-01-plan-1', relation: 'connects_to' },
          { to: 'chapter-1', relation: 'connects_to' }
        ]
      });

      // Verify edge relationships
      const chapter = await megaMemory.understand({ query: 'chapter-1' });
      const context = await megaMemory.understand({ query: 'chapter-01-context' });
      const plan = await megaMemory.understand({ query: 'chapter-01-plan-1' });
      const summary = await megaMemory.understand({ query: 'summary' });

      expect(chapter.matches[0].edges.length).toBe(1);
      expect(context.matches[0].edges[0].relation).toBe('configured_by');
      expect(plan.matches[0].edges[0].relation).toBe('implements');
      expect(summary.matches[0].edges.length).toBe(2);
      expect(summary.matches[0].edges.find((e: any) => e.relation === 'connects_to')).toBeDefined();
      expect(summary.matches[0].edges.find((e: any) => e.relation === 'connects_to')).toBeDefined();
    });
  });
});
