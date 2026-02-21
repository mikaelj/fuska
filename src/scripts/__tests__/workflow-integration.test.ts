import { MegaMemoryClient } from '../types';
import { buildDependencyGraph, extractJson } from '../helpers';

describe('MegaMemory Workflow Integration Tests', () => {
  let mockMegaMemory: MegaMemoryClient;
  let mockConcepts: any[];

  beforeEach(() => {
    mockConcepts = [];
    mockMegaMemory = {
      understand: async ({ query, top_k }) => {
        let results = mockConcepts;

        if (query) {
          const queryLower = query.toLowerCase();
          results = mockConcepts.filter((c: any) =>
            c.name.toLowerCase().includes(queryLower) ||
            c.summary.toLowerCase().includes(queryLower)
          );
        }

        if (top_k && results.length > top_k) {
          results = results.slice(0, top_k);
        }

        return {
          query,
          matches: results,
          total: results.length
        };
      },
      create_concept: async (concept) => {
        const newConcept = {
          id: 'concept-' + mockConcepts.length,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...concept
        };
        mockConcepts.push(newConcept);
        return { id: newConcept.id, concept };
      },
      update_concept: async ({ id, changes }) => {
        const index = mockConcepts.findIndex((c: any) => c.id === id);
        if (index >= 0) {
          mockConcepts[index] = {
            ...mockConcepts[index],
            ...changes,
            updated_at: new Date().toISOString()
          };
        }
        return { success: index >= 0 };
      },
      remove_concept: async () => ({ success: true }),
      link: async () => ({ success: true }),
      list_roots: async () => ({
        roots: mockConcepts.filter((c: any) => c.parent_id === null)
      })
    };
  });

  describe('Project Initialization Workflow', () => {
    it('should create project-root concept', async () => {
      const concept = {
        name: 'test-project',
        kind: 'feature' as const,
        summary: 'Project: Test App',
        parent_id: null,
        edges: []
      };

      const result = await mockMegaMemory.create_concept(concept);

      expect(result.id).toBeTruthy();
      expect(mockMegaMemory.list_roots().roots.length).toBe(1);
    });

    it('should create state concept', async () => {
      await mockMegaMemory.create_concept({
        name: 'state',
        kind: 'config',
        summary: JSON.stringify({
          current_chapter: 'chapter-01',
          status: 'ready_to_plan'
        }),
        parent_id: 'test-project',
        edges: [{ to: 'test-project', relation: 'configured_by' }]
      });

      const stateResult = await mockMegaMemory.understand({ query: 'state' });
      expect(stateResult.matches.length).toBeGreaterThan(0);
      const state = extractJson(stateResult.matches[0].summary);
      expect(state.current_chapter).toBe('chapter-01');
    });

    it('should create requirements module and requirement concepts', async () => {
      await mockMegaMemory.create_concept({
        name: 'requirements',
        kind: 'module',
        summary: 'Project requirements list',
        parent_id: 'test-project',
        edges: [{ to: 'test-project', relation: 'connects_to' }]
      });

      await mockMegaMemory.create_concept({
        name: 'req-AUTH-01',
        kind: 'feature',
        summary: JSON.stringify({
          description: 'User can login',
          status: 'active'
        }),
        parent_id: 'test-project/requirements',
        edges: [{ to: 'requirements', relation: 'implements' }]
      });

      const reqs = await mockMegaMemory.understand({ query: 'requirements' });
      expect(reqs.matches.length).toBeGreaterThanOrEqual(2);
    });

    it('should create roadmap and chapter concepts', async () => {
      await mockMegaMemory.create_concept({
        name: 'roadmap',
        kind: 'module',
        summary: 'Project roadmap with chapters',
        parent_id: 'test-project',
        edges: [{ to: 'test-project', relation: 'connects_to' }]
      });

      await mockMegaMemory.create_concept({
        name: 'chapter-1',
        kind: 'feature',
        summary: JSON.stringify({
          number: 1,
          slug: 'chapter-01',
          name: 'Authentication',
          goal: 'Implement auth',
          status: 'planned'
        }),
        parent_id: 'test-project/roadmap',
        edges: [{ to: 'roadmap', relation: 'connects_to' }]
      });

      const chapters = await mockMegaMemory.understand({ query: 'chapter' });
      expect(chapters.matches.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Discuss Chapter Workflow', () => {
    beforeEach(async () => {
      // Setup project with chapter
      await mockMegaMemory.create_concept({
        name: 'test-project',
        kind: 'feature',
        summary: 'Test Project',
        parent_id: null,
        edges: []
      });
      await mockMegaMemory.create_concept({
        name: 'chapter-1',
        kind: 'feature',
        summary: JSON.stringify({
          number: 1,
          slug: 'chapter-01',
          name: 'Auth',
          goal: 'Implement authentication',
          status: 'planned'
        }),
        parent_id: 'test-project/roadmap',
        edges: []
      });
    });

    it('should create chapter context concept', async () => {
      const contextData = {
        gathered: '2025-01-20',
        status: 'ready_for_planning',
        chapter_boundary: 'Implement JWT authentication',
        decisions: {
          auth_type: 'JWT',
          library: 'jose'
        },
        open_code_discretion: [],
        specifics: [],
        deferred: []
      };

      await mockMegaMemory.create_concept({
        name: 'chapter-01-context',
        kind: 'config',
        summary: JSON.stringify(contextData),
        parent_id: 'chapter-1',
        edges: [{ to: 'chapter-1', relation: 'configured_by' }]
      });

      const context = await mockMegaMemory.understand({ query: 'chapter-01-context' });
      expect(context.matches.length).toBe(1);
      const data = extractJson(context.matches[0].summary);
      expect(data.chapter_boundary).toBe('Implement JWT authentication');
    });

    it('should update existing chapter context concept', async () => {
      // Create initial context
      await mockMegaMemory.create_concept({
        name: 'chapter-01-context',
        kind: 'config',
        summary: JSON.stringify({
          gathered: '2025-01-20',
          decisions: { initial: 'decision' }
        }),
        parent_id: 'chapter-1',
        edges: []
      });

      // Get the created concept
      const created = await mockMegaMemory.understand({ query: 'chapter-01-context' });
      const conceptId = created.matches[0].id;

      // Update context
      await mockMegaMemory.update_concept({
        id: conceptId,
        changes: {
          summary: JSON.stringify({
            gathered: '2025-01-21',
            decisions: { updated: 'new decision' }
          })
        }
      });

      // Verify update
      const updated = await mockMegaMemory.understand({ query: 'chapter-01-context' });
      const data = extractJson(updated.matches[0].summary);
      expect(data.decisions.updated).toBe('new decision');
    });
  });

  describe('Plan Chapter Workflow', () => {
    beforeEach(async () => {
      // Setup project with chapter and context
      await mockMegaMemory.create_concept({
        name: 'test-project',
        kind: 'feature',
        summary: 'Test',
        parent_id: null,
        edges: []
      });
      await mockMegaMemory.create_concept({
        name: 'chapter-1',
        kind: 'feature',
        summary: JSON.stringify({ number: 1, slug: 'chapter-01', name: 'Auth', goal: 'Implement auth' }),
        parent_id: 'test-project/roadmap',
        edges: []
      });
      await mockMegaMemory.create_concept({
        name: 'chapter-01-context',
        kind: 'config',
        summary: JSON.stringify({
          gathered: '2025-01-20',
          decisions: { auth_type: 'JWT' }
        }),
        parent_id: 'chapter-1',
        edges: []
      });
    });

    it('should create chapter plan concept', async () => {
      const planData = {
        objective: 'Implement JWT login',
        purpose: 'Secure authentication',
        output: 'Working login system',
        requirements: ['Login endpoint', 'Token generation', 'Token validation'],
        megamemory_references: {
          knowledge_applied: ['context-concept'],
          patterns_to_follow: []
        },
        tasks: [
          { description: 'Setup auth library' },
          { description: 'Create login endpoint', dependencies: ['Setup auth library'] }
        ]
      };

      await mockMegaMemory.create_concept({
        name: 'chapter-01-plan-1',
        kind: 'feature',
        summary: JSON.stringify(planData),
        parent_id: 'chapter-1',
        edges: [
          { to: 'chapter-1', relation: 'implements' },
          { to: 'context-concept', relation: 'depends_on' }
        ]
      });

      const plan = await mockMegaMemory.understand({ query: 'chapter-01-plan' });
      expect(plan.matches.length).toBeGreaterThan(0);
      const data = extractJson(plan.matches[0].summary);
      expect(data.objective).toBe('Implement JWT login');
      expect(data.requirements.length).toBe(3);
    });

    it('should create research concept', async () => {
      const researchData = {
        domain: 'authentication',
        confidence: 'high',
        sources: ['JWT.io'],
        standard_stack: ['jose', 'bcrypt'],
        architecture_patterns: ['Token rotation'],
        pitfalls: ['Token expiration timing']
      };

      await mockMegaMemory.create_concept({
        name: 'chapter-01-research',
        kind: 'pattern',
        summary: JSON.stringify(researchData),
        parent_id: 'chapter-1',
        edges: [{ to: 'chapter-1', relation: 'connects_to' }]
      });

      const research = await mockMegaMemory.understand({ query: 'research' });
      expect(research.matches.length).toBeGreaterThan(0);
      const data = extractJson(research.matches[0].summary);
      expect(data.domain).toBe('authentication');
      expect(data.confidence).toBe('high');
    });
  });

  describe('Execute Chapter Workflow', () => {
    beforeEach(async () => {
      // Setup project with chapter and plans
      await mockMegaMemory.create_concept({
        name: 'test-project',
        kind: 'feature',
        summary: 'Test',
        parent_id: null,
        edges: []
      });
      await mockMegaMemory.create_concept({
        name: 'chapter-1',
        kind: 'feature',
        summary: JSON.stringify({ number: 1, slug: 'chapter-01', name: 'Auth', goal: 'Implement auth' }),
        parent_id: 'test-project/roadmap',
        edges: []
      });
      await mockMegaMemory.create_concept({
        name: 'chapter-01-plan-1',
        kind: 'feature',
        summary: JSON.stringify({ objective: 'Implement login', batch: 1 }),
        parent_id: 'chapter-1',
        edges: []
      });
    });

    it('should create summary concept after execution', async () => {
      const summaryData = {
        chapter: 'chapter-01',
        plan: 'chapter-01-plan-1',
        subsystem: 'Authentication',
        tags: ['auth', 'security'],
        tech_stack: {
          added: ['jose'],
          patterns: []
        },
        key_files: {
          created: ['auth.ts'],
          modified: ['app.ts']
        },
        key_decisions: ['Use jose library'],
        duration_minutes: 45,
        completed: new Date().toISOString(),
        accomplishments: ['Implemented login', 'Implemented logout'],
        task_commits: [],
        files_modified: ['auth.ts'],
        decisions_made: {},
        deviations: [],
        issues_encountered: [],
        next_phase_readiness: 'Ready'
      };

      await mockMegaMemory.create_concept({
        name: chapter-01-plan-1-summary,
        kind: 'component',
        summary: JSON.stringify(summaryData),
        parent_id: 'chapter-1',
        edges: [
          { to: 'chapter-01-plan-1', relation: 'connects_to' },
          { to: 'chapter-1', relation: 'connects_to' }
        ],
        created_by_task: 'chapter-01-plan-1'
      });

      const summary = await mockMegaMemory.understand({ query: 'summary' });
      expect(summary.matches.length).toBe(1);
      const data = extractJson(summary.matches[0].summary);
      expect(data.accomplishments.length).toBe(2);
      expect(data.duration_minutes).toBe(45);
    });

    it('should update state after chapter completion', async () => {
      // Create state
      await mockMegaMemory.create_concept({
        name: 'state',
        kind: 'config',
        summary: JSON.stringify({ current_chapter: 'chapter-01', status: 'in_progress' }),
        parent_id: 'test-project',
        edges: []
      });

      // Update state
      const stateResult = await mockMegaMemory.understand({ query: 'state' });
      const stateId = stateResult.matches[0].id;

      await mockMegaMemory.update_concept({
        id: stateId,
        changes: {
          summary: JSON.stringify({
            current_chapter: 'chapter-02',
            status: 'chapter_complete',
            progress: 33
          })
        }
      });

      const updated = await mockMegaMemory.understand({ query: 'state' });
      const data = extractJson(updated.matches[0].summary);
      expect(data.current_chapter).toBe('chapter-02');
      expect(data.progress).toBe(33);
    });
  });

  describe('Verify Work Workflow', () => {
    beforeEach(async () => {
      // Setup project with completed chapter
      await mockMegaMemory.create_concept({
        name: 'test-project',
        kind: 'feature',
        summary: 'Test',
        parent_id: null,
        edges: []
      });
      await mockMegaMemory.create_concept({
        name: 'chapter-1',
        kind: 'feature',
        summary: JSON.stringify({ number: 1, slug: 'chapter-01', name: 'Auth', goal: 'Implement auth' }),
        parent_id: 'test-project/roadmap',
        edges: []
      });
      await mockMegaMemory.create_concept({
        name: chapter-01-plan-1-summary,
        kind: 'component',
        summary: JSON.stringify({
          accomplishments: ['Login works', 'Logout works']
        }),
        parent_id: 'chapter-1',
        edges: []
      });
    });

    it('should create verification concept', async () => {
      const verificationData = {
        verification_results: ['Login works', 'Logout works', 'Password reset works'],
        issues_found: [],
        recommendations: [],
        concepts_reviewed: [chapter-01-plan-1-summary]
      };

      await mockMegaMemory.create_concept({
        name: 'chapter-01-verification',
        kind: 'component',
        summary: JSON.stringify(verificationData),
        parent_id: 'chapter-1',
        edges: [
          { to: 'chapter-1', relation: 'connects_to' },
          { to: chapter-01-plan-1-summary, relation: 'connects_to' }
        ]
      });

      const verification = await mockMegaMemory.understand({ query: 'verification' });
      expect(verification.matches.length).toBe(1);
      const data = extractJson(verification.matches[0].summary);
      expect(data.verification_results.length).toBe(3);
      expect(data.issues_found.length).toBe(0);
    });

    it('should create verification concept with issues', async () => {
      const verificationData = {
        verification_results: ['Login works', 'Logout fails'],
        issues_found: ['Logout endpoint crashes'],
        recommendations: ['Fix logout endpoint'],
        concepts_reviewed: [chapter-01-plan-1-summary]
      };

      await mockMegaMemory.create_concept({
        name: 'chapter-01-verification',
        kind: 'component',
        summary: JSON.stringify(verificationData),
        parent_id: 'chapter-1',
        edges: [{ to: 'chapter-1', relation: 'connects_to' }]
      });

      const verification = await mockMegaMemory.understand({ query: 'verification' });
      const data = extractJson(verification.matches[0].summary);
      expect(data.verification_results.length).toBe(2);
      expect(data.issues_found.length).toBe(1);
    });
  });

  describe('Resume Work Workflow', () => {
    beforeEach(async () => {
      // Setup project with state
      await mockMegaMemory.create_concept({
        name: 'test-project',
        kind: 'feature',
        summary: 'Test',
        parent_id: null,
        edges: []
      });
      await mockMegaMemory.create_concept({
        name: 'state',
        kind: 'config',
        summary: JSON.stringify({
          current_chapter: 'chapter-01',
          current_plan: 'chapter-01-plan-1',
          status: 'in_progress',
          progress: 25,
          last_activity: 'Chapter 1 execution started'
        }),
        parent_id: 'test-project',
        edges: []
      });
      await mockMegaMemory.create_concept({
        name: 'chapter-1',
        kind: 'feature',
        summary: JSON.stringify({ number: 1, slug: 'chapter-01' }),
        parent_id: 'test-project/roadmap',
        edges: []
      });
      await mockMegaMemory.create_concept({
        name: 'chapter-01-plan-1',
        kind: 'feature',
        summary: JSON.stringify({ objective: 'Implement login' }),
        parent_id: 'chapter-1',
        edges: []
      });
    });

    it('should list project roots', async () => {
      const roots = await mockMegaMemory.list_roots();
      expect(roots.roots.length).toBeGreaterThan(0);
      expect(roots.roots[0].name).toBe('test-project');
    });

    it('should load state concept', async () => {
      const state = await mockMegaMemory.understand({ query: 'state' });
      expect(state.matches.length).toBe(1);
      const data = extractJson(state.matches[0].summary);
      expect(data.current_chapter).toBe('chapter-01');
      expect(data.status).toBe('in_progress');
      expect(data.progress).toBe(25);
    });

    it('should detect incomplete work (plans without summaries)', async () => {
      const plans = await mockMegaMemory.understand({ query: 'plan' });
      const summaries = await mockMegaMemory.understand({ query: 'summary' });

      expect(plans.matches.length).toBe(1);
      expect(summaries.matches.length).toBe(0);
    });
  });

  describe('Dependency Graph', () => {
    beforeEach(async () => {
      // Setup project with chapters and relationships
      mockConcepts = [];
      await mockMegaMemory.create_concept({
        name: 'test-project',
        kind: 'feature',
        summary: 'Test',
        parent_id: null,
        edges: []
      });
      await mockMegaMemory.create_concept({
        name: 'chapter-1',
        kind: 'feature',
        summary: JSON.stringify({ number: 1 }),
        parent_id: 'roadmap',
        edges: [{ to: 'roadmap', relation: 'connects_to' }]
      });
      await mockMegaMemory.create_concept({
        name: 'roadmap',
        kind: 'module',
        summary: 'Roadmap',
        parent_id: 'test-project',
        edges: [{ to: 'test-project', relation: 'connects_to' }]
      });
      await mockMegaMemory.create_concept({
        name: chapter-01-plan-1-summary,
        kind: 'component',
        summary: JSON.stringify({ accomplishments: ['Task done'] }),
        parent_id: 'chapter-1',
        edges: [{ to: 'chapter-1', relation: 'connects_to' }]
      });
    });

    it('should build dependency graph from concepts', async () => {
      const graph = await buildDependencyGraph(mockMegaMemory);

      expect(graph).toBeDefined();
      expect(typeof graph.getRelevantSummaries).toBe('function');
      expect(typeof graph.getDependentChapters).toBe('function');
      expect(typeof graph.getTechStackHistory).toBe('function');
    });

    it('should get relevant summaries for chapter', async () => {
      const graph = await buildDependencyGraph(mockMegaMemory);
      const summaries = graph.getRelevantSummaries('chapter-1');

      expect(summaries).toHaveLength(1);
      expect(summaries[0].data.accomplishments).toEqual(['Task done']);
    });

    it('should get dependent phases', async () => {
      const graph = await buildDependencyGraph(mockMegaMemory);
      const phases = graph.getDependentChapters('chapter-1');

      expect(phases).toEqual([]); // No dependent phases
    });

    it('should get all concepts', async () => {
      const graph = await buildDependencyGraph(mockMegaMemory);
      const allConcepts = graph.getAllConcepts();

      expect(allConcepts.length).toBeGreaterThan(0);
      expect(allConcepts.find((c: any) => c.name === 'test-project')).toBeDefined();
    });
  });
});
