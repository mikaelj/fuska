import { extractJson, generateSummary, buildDependencyGraph, generateContextMarkdown, generatePlanMarkdown, generateSummaryMarkdown, calculateProgress } from '../helpers';
import { MegaMemoryClient } from '../types';

describe('Helper Functions', () => {
  describe('extractJson', () => {
    it('extracts JSON from summary with markdown', () => {
      const summary = `{\n  "key": "value",\n  "number": 42\n}\n\n## Markdown Content\n\nSome content here`;
      const result = extractJson(summary);

      expect(result).toEqual({ key: 'value', number: 42 });
    });

    it('handles nested JSON objects', () => {
      const summary = `{\n  "outer": {\n    "inner": "value"\n  }\n}\n\nContent`;
      const result = extractJson(summary);

      expect(result).toEqual({ outer: { inner: 'value' } });
    });

    it('returns empty object for summary without JSON', () => {
      const summary = '## Just Markdown\n\nNo JSON here';
      const result = extractJson(summary);

      expect(result).toEqual({});
    });

    it('handles arrays in JSON', () => {
      const summary = `{\n  "items": ["a", "b", "c"]\n}\n\nContent`;
      const result = extractJson(summary);

      expect(result).toEqual({ items: ['a', 'b', 'c'] });
    });

    it('finds last closing brace', () => {
      const summary = `{\n  "key": "value"\n}\n\n## Content with { braces }\n\nMore text`;
      const result = extractJson(summary);

      expect(result).toEqual({ key: 'value' });
    });
  });

  describe('generateSummary', () => {
    it('combines JSON and markdown sections', () => {
      const data = { key: 'value', number: 42 };
      const markdown = ['# Heading', 'Content'];

      const result = generateSummary(data, markdown);

      expect(result).toContain('{"key":"value","number":42}');
      expect(result).toContain('# Heading');
      expect(result).toContain('Content');
    });

    it('handles data without markdown sections', () => {
      const data = { key: 'value' };

      const result = generateSummary(data);

      expect(result).toContain('{"key":"value"}');
    });

    it('handles markdown without data', () => {
      const markdown = ['# Heading'];

      const result = generateSummary(null, markdown as any);

      expect(result).toContain('# Heading');
    });

    it('pretty-prints JSON', () => {
      const data = { key: 'value' };

      const result = generateSummary(data);

      expect(result).toContain('{\n  "key": "value"\n}');
    });
  });

  describe('generateContextMarkdown', () => {
    it('generates markdown with all sections', () => {
      const contextData = {
        gathered: '2025-01-20',
        status: 'ready_for_planning',
        chapter_boundary: 'Implement authentication',
        decisions: {
          auth_type: 'JWT',
          library: 'jose'
        },
        open_code_discretion: ['Design choices'],
        specifics: ['Specific requirement 1'],
        deferred: ['OAuth2']
      };
      const relevantKnowledge = [];

      const result = generateContextMarkdown(contextData, relevantKnowledge);

      expect(result).toContain('<domain>');
      expect(result).toContain('## Chapter Boundary');
      expect(result).toContain('Implement authentication');
      expect(result).toContain('<decisions>');
      expect(result).toContain('## Implementation Decisions');
      expect(result).toContain('### Authentication type');
      expect(result).toContain('JWT');
      expect(result).toContain("## OpenCode's Discretion");
      expect(result).toContain('## Specifics');
      expect(result).toContain('## Deferred');
    });

    it('includes relevant knowledge section when provided', () => {
      const contextData = {
        gathered: '2025-01-20',
        status: 'ready',
        chapter_boundary: 'Test',
        decisions: {},
        open_code_discretion: [],
        specifics: [],
        deferred: []
      };
      const relevantKnowledge = [
        { name: 'concept1', summary: 'First concept content' },
        { name: 'concept2', summary: 'Second concept content' }
      ];

      const result = generateContextMarkdown(contextData, relevantKnowledge);

      expect(result).toContain('## Relevant Knowledge');
      expect(result).toContain('concept1');
      expect(result).toContain('concept2');
    });
  });

  describe('generatePlanMarkdown', () => {
    it('generates plan markdown with all sections', () => {
      const planData = {
        objective: 'Implement auth',
        purpose: 'Secure the application',
        output: 'Working authentication',
        requirements: ['Login', 'Logout', 'Password reset'],
        megamemory_references: {
          knowledge_applied: ['concept1'],
          patterns_to_follow: ['pattern1']
        },
        tasks: [
          { description: 'Task 1', type: 'feature' },
          { description: 'Task 2', dependencies: ['Task 1'] }
        ]
      };
      const patterns = [
        { id: 'p1', name: 'pattern1', summary: 'Pattern description' }
      ];
      const relevantSummaries = [];

      const result = generatePlanMarkdown(planData, patterns, relevantSummaries);

      expect(result).toContain('## Objective');
      expect(result).toContain('Implement auth');
      expect(result).toContain('## Purpose');
      expect(result).toContain('Secure the application');
      expect(result).toContain('## Output');
      expect(result).toContain('## Must Haves');
      expect(result).toContain('Login');
      expect(result).toContain('Logout');
      expect(result).toContain('## Knowledge Applied');
      expect(result).toContain('## Patterns to Follow');
      expect(result).toContain('## Tasks');
      expect(result).toContain('1. Task 1 (feature)');
      expect(result).toContain('2. Task 2 [depends on: Task 1]');
    });
  });

  describe('generateSummaryMarkdown', () => {
    it('generates summary markdown with all sections', () => {
      const summaryData = {
        chapter: 'chapter-01',
        plan: 'chapter-01-plan-1',
        subsystem: 'Authentication',
        tags: ['auth', 'security'],
        requires: ['chapter-00'],
        provides: ['login capability'],
        affects: ['user management'],
        tech_stack: {
          added: ['jose'],
          patterns: []
        },
        key_files: {
          created: ['auth.ts'],
          modified: ['app.ts']
        },
        key_decisions: ['Use JWT'],
        duration_minutes: 45,
        completed: '2025-01-20T10:00:00Z',
        accomplishments: ['Implemented login', 'Implemented logout'],
        task_commits: [],
        files_modified: ['auth.ts', 'app.ts'],
        decisions_made: {},
        deviations: [],
        issues_encountered: [],
        next_chapter_readiness: 'Ready'
      };

      const result = generateSummaryMarkdown(summaryData);

      expect(result).toContain('## Chapter');
      expect(result).toContain('chapter-01');
      expect(result).toContain('## Plan');
      expect(result).toContain('## Duration');
      expect(result).toContain('45 minutes');
      expect(result).toContain('## Subsystem');
      expect(result).toContain('Authentication');
      expect(result).toContain('## Tags');
      expect(result).toContain('## Requires');
      expect(result).toContain('## Provides');
      expect(result).toContain('## Affects');
      expect(result).toContain('## Tech Stack');
      expect(result).toContain('## Key Files');
      expect(result).toContain('## Key Decisions');
      expect(result).toContain('## Accomplishments');
      expect(result).toContain('## Deviations from Plan');
      expect(result).toContain('## Issues Encountered');
      expect(result).toContain('## Next Chapter Readiness');
    });
  });

  describe('calculateProgress', () => {
    it('calculates progress for empty phases array', () => {
      const result = calculateProgress([]);
      expect(result).toBe(0);
    });

    it('calculates progress with no completed phases', () => {
      const phases = [
        { number: 1, status: 'planned' },
        { number: 2, status: 'in_progress' },
        { number: 3, status: 'planned' }
      ];

      const result = calculateProgress(phases);
      expect(result).toBe(0);
    });

    it('calculates progress with one completed chapter', () => {
      const phases = [
        { number: 1, status: 'complete' },
        { number: 2, status: 'in_progress' },
        { number: 3, status: 'planned' }
      ];

      const result = calculateProgress(phases);
      expect(result).toBe(33);
    });

    it('calculates progress with all completed phases', () => {
      const phases = [
        { number: 1, status: 'complete' },
        { number: 2, status: 'complete' },
        { number: 3, status: 'complete' }
      ];

      const result = calculateProgress(phases);
      expect(result).toBe(100);
    });

    it('handles missing status field', () => {
      const phases = [
        { number: 1, status: 'complete' },
        { number: 2 }, // no status
        { number: 3, status: 'complete' }
      ];

      const result = calculateProgress(phases);
      expect(result).toBe(67);
    });
  });
});

describe('buildDependencyGraph', () => {
  it('creates a dependency graph from MegaMemory concepts', async () => {
    const mockConcepts = [
      {
        id: 'project-root',
        name: 'my-project',
        kind: 'feature',
        summary: '{}',
        parent_id: null,
        file_refs: null,
        edges: [],
        created_at: '2025-01-20',
        updated_at: '2025-01-20'
      },
      {
        id: 'chapter-01',
        name: 'chapter-01',
        kind: 'feature',
        summary: '{}',
        parent_id: 'roadmap',
        file_refs: null,
        edges: [{ to: 'roadmap', relation: 'connects_to' }],
        created_at: '2025-01-20',
        updated_at: '2025-01-20'
      },
      {
        id: 'chapter-01-plan-1-summary',
        name: 'chapter-01-plan-1-summary',
        kind: 'component',
        summary: '{\n  "accomplishments": ["Task 1"]\n}',
        parent_id: 'chapter-01',
        file_refs: null,
        edges: [{ to: 'chapter-01-plan-1', relation: 'connects_to' }],
        created_at: '2025-01-20',
        updated_at: '2025-01-20'
      }
    ];

    const mockMegaMemory: MegaMemoryClient = {
      understand: async ({ query, top_k }) => {
        return {
          query,
          matches: query ? mockConcepts.filter(c =>
            c.name.toLowerCase().includes(query.toLowerCase())
          ) : mockConcepts,
          total: mockConcepts.length
        };
      },
      create_concept: async () => ({ id: '1', concept: {} as any }),
      update_concept: async () => ({ success: true }),
      remove_concept: async () => ({ success: true }),
      link: async () => ({ success: true }),
      list_roots: async () => ({ roots: mockConcepts.filter(c => c.parent_id === null) })
    };

    const graph = await buildDependencyGraph(mockMegaMemory);

    const summaries = graph.getRelevantSummaries('chapter-01');
    expect(summaries).toHaveLength(1);
    expect(summaries[0].name).toBe('chapter-01-plan-1-summary');
    expect(summaries[0].data).toEqual({ accomplishments: ['Task 1'] });

    const chapters = graph.getDependentChapters('chapter-01');
    expect(chapters).toHaveLength(0); // No other chapters depend on chapter-01

    const allConcepts = graph.getAllConcepts();
    expect(allConcepts).toHaveLength(3);
  });
});
