import { ChapterConceptTemplates } from '../chapter-templates';

describe('ChapterConceptTemplates', () => {
  describe('createContext', () => {
    it('creates phase context concept', () => {
      const contextData = {
        gathered: '2025-01-20',
        status: 'ready_for_planning',
        chapter_boundary: 'Implement JWT authentication',
        decisions: {
          auth_type: 'JWT',
          library: 'jose',
          token_expiry: '15min access, 7day refresh'
        },
        open_code_discretion: ['UI design', 'Error handling'],
        specifics: ['Familiar patterns', 'CI pipeline support'],
        deferred: ['OAuth2', '2FA']
      };

      const concept = ChapterConceptTemplates.createContext('chapter-01', contextData, []);

      expect(concept.name).toBe('chapter-01-context');
      expect(concept.kind).toBe('config');
      expect(concept.summary).toContain('"gathered":"2025-01-20"');
      expect(concept.summary).toContain('"chapter_boundary":"Implement JWT authentication"');
      expect(concept.summary).toContain('"auth_type":"JWT"');
      expect(concept.summary).toContain('<domain>');
      expect(concept.summary).toContain('## Chapter Boundary');
      expect(concept.summary).toContain('Implement JWT authentication');
      expect(concept.summary).toContain('<decisions>');
      expect(concept.summary).toContain('## Implementation Decisions');
      expect(concept.parent_id).toBe('chapter-01');
      expect(concept.edges).toEqual([{ to: 'chapter-01', relation: 'configured_by' }]);
    });

    it('includes relevant knowledge when provided', () => {
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
        { name: 'pattern1', summary: 'First pattern content...' },
        { name: 'decision1', summary: 'Second decision content...' }
      ];

      const concept = ChapterConceptTemplates.createContext('chapter-01', contextData, relevantKnowledge);

      expect(concept.summary).toContain('## Relevant Knowledge');
      expect(concept.summary).toContain('pattern1');
      expect(concept.summary).toContain('decision1');
    });
  });

  describe('createPlan', () => {
    it('creates phase plan concept', () => {
      const planData = {
        objective: 'Implement JWT authentication',
        purpose: 'Secure the application with JWT tokens',
        output: 'Working authentication system',
        must_haves: ['Login endpoint', 'Token generation', 'Token validation', 'Refresh tokens'],
        megamemory_references: {
          knowledge_applied: ['concept1', 'concept2'],
          patterns_to_follow: ['pattern1', 'pattern2']
        },
        tasks: [
          { description: 'Install jose library', type: 'setup' },
          { description: 'Create login endpoint', type: 'feature', dependencies: ['Install jose library'] },
          { description: 'Implement token generation', type: 'feature', dependencies: ['Create login endpoint'] }
        ]
      };
      const patterns = [
        { id: 'p1', name: 'pattern1', summary: 'Pattern 1 description' },
        { id: 'p2', name: 'pattern2', summary: 'Pattern 2 description' }
      ];

      const concept = ChapterConceptTemplates.createPlan('chapter-01', 1, planData, patterns, []);

      expect(concept.name).toBe('chapter-01-plan-1');
      expect(concept.kind).toBe('feature');
      expect(concept.summary).toContain('"objective":"Implement JWT authentication"');
      expect(concept.summary).toContain('"purpose":"Secure the application with JWT tokens"');
      expect(concept.summary).toContain('"output":"Working authentication system"');
      expect(concept.summary).toContain('## Objective');
      expect(concept.summary).toContain('Implement JWT authentication');
      expect(concept.summary).toContain('## Purpose');
      expect(concept.summary).toContain('## Tasks');
      expect(concept.summary).toContain('1. Install jose library (setup)');
      expect(concept.summary).toContain('2. Create login endpoint (feature) [depends on: Install jose library]');
      expect(concept.parent_id).toBe('chapter-01');
      expect(concept.edges).toHaveLength(4);
      expect(concept.edges[0]).toEqual({ to: 'chapter-01', relation: 'implements' });
      expect(concept.edges[1]).toEqual({ to: 'p1', relation: 'depends_on' });
      expect(concept.edges[2]).toEqual({ to: 'p2', relation: 'depends_on' });
      expect(concept.edges[3]).toEqual({ to: 'concept1', relation: 'depends_on' });
    });

    it('handles plan without megamemory references', () => {
      const planData = {
        objective: 'Test plan',
        purpose: 'Testing',
        output: 'Test output',
        must_haves: [],
        tasks: []
      };

      const concept = ChapterConceptTemplates.createPlan('chapter-01', 1, planData, [], []);

      expect(concept.edges).toHaveLength(1);
      expect(concept.edges[0]).toEqual({ to: 'chapter-01', relation: 'implements' });
    });
  });

  describe('createResearch', () => {
    it('creates research concept', () => {
      const researchData = {
        domain: 'authentication',
        confidence: 'high',
        sources: ['OWASP guidelines', 'JWT.io documentation'],
        standard_stack: ['jose', 'bcrypt'],
        architecture_patterns: ['Token rotation', 'Refresh token storage'],
        pitfalls: ['Token expiration timing', 'Storage security']
      };

      const concept = ChapterConceptTemplates.createResearch('chapter-01', researchData);

      expect(concept.name).toBe('chapter-01-research');
      expect(concept.kind).toBe('pattern');
      expect(concept.summary).toContain('"domain":"authentication"');
      expect(concept.summary).toContain('"confidence":"high"');
      expect(concept.summary).toContain('## Domain');
      expect(concept.summary).toContain('authentication');
      expect(concept.summary).toContain('## Sources');
      expect(concept.summary).toContain('## Standard Stack');
      expect(concept.summary).toContain('jose');
      expect(concept.summary).toContain('## Architecture Patterns');
      expect(concept.summary).toContain('## Pitfalls');
      expect(concept.parent_id).toBe('chapter-01');
      expect(concept.edges).toEqual([{ to: 'chapter-01', relation: 'connects_to' }]);
    });

    it('handles research with minimal data', () => {
      const researchData = {
        domain: 'test',
        confidence: 'medium',
        sources: []
      };

      const concept = ChapterConceptTemplates.createResearch('chapter-01', researchData);

      expect(concept.summary).toContain('"domain":"test"');
      expect(concept.summary).toContain('"confidence":"medium"');
    });
  });

  describe('createSummary', () => {
    it('creates summary concept', () => {
      const summaryData = {
        phase: 'chapter-01',
        plan: 'chapter-01-plan-1',
        subsystem: 'Authentication',
        tags: ['auth', 'security'],
        requires: [],
        provides: ['login capability'],
        affects: ['user management'],
        tech_stack: {
          added: ['jose', 'bcrypt'],
          patterns: ['JWT pattern']
        },
        key_files: {
          created: ['auth.ts', 'auth.controller.ts'],
          modified: ['app.ts', 'routes.ts']
        },
        key_decisions: ['Use jose library', 'Store refresh tokens in database'],
        duration_minutes: 60,
        completed: '2025-01-20T14:30:00Z',
        accomplishments: [
          'Implemented JWT token generation',
          'Created login endpoint',
          'Added token validation middleware'
        ],
        task_commits: [
          { task: 'Install jose library', commit: 'abc123' },
          { task: 'Create login endpoint', commit: 'def456' }
        ],
        files_modified: ['auth.ts', 'app.ts'],
        decisions_made: {
          token_expiry: '15 minutes',
          refresh_token_expiry: '7 days'
        },
        deviations: [],
        issues_encountered: [],
        next_chapter_readiness: 'Ready - all must-haves delivered'
      };

      const concept = ChapterConceptTemplates.createSummary('chapter-01', 1, summaryData);

      expect(concept.name).toBe('chapter-01-plan-1-summary');
      expect(concept.kind).toBe('component');
      expect(concept.summary).toContain('"chapter":"chapter-01"');
      expect(concept.summary).toContain('"plan":"chapter-01-plan-1"');
      expect(concept.summary).toContain('"duration_minutes":60');
      expect(concept.summary).toContain('"accomplishments":[');
      expect(concept.summary).toContain('## Phase');
      expect(concept.summary).toContain('chapter-01');
      expect(concept.summary).toContain('## Duration');
      expect(concept.summary).toContain('60 minutes');
      expect(concept.summary).toContain('## Accomplishments');
      expect(concept.summary).toContain('Implemented JWT token generation');
      expect(concept.summary).toContain('## Task Commits');
      expect(concept.summary).toContain('Install jose library: abc123');
      expect(concept.parent_id).toBe('chapter-01');
      expect(concept.edges).toHaveLength(2);
      expect(concept.edges[0]).toEqual({ to: 'chapter-01-plan-1', relation: 'connects_to' });
      expect(concept.edges[1]).toEqual({ to: 'chapter-01', relation: 'connects_to' });
      expect(concept.created_by_task).toBe('chapter-01-plan-1');
    });
  });

  describe('createUAT', () => {
    it('creates UAT concept', () => {
      const uatData = {
        verification_results: [
          'User can login with valid credentials',
          'User cannot login with invalid credentials',
          'Token refresh works correctly'
        ],
        issues_found: [
          'Token expiration message unclear',
          'No rate limiting on login endpoint'
        ],
        recommendations: [
          'Improve error messages',
          'Add rate limiting',
          'Consider implementing account lockout'
        ],
        concepts_reviewed: ['chapter-01-context', 'chapter-01-plan-1', 'chapter-01-plan-1-summary']
      };

      const concept = ChapterConceptTemplates.createUAT('chapter-01', uatData);

      expect(concept.name).toBe('chapter-01-uat');
      expect(concept.kind).toBe('component');
      expect(concept.summary).toContain('"verification_results":[');
      expect(concept.summary).toContain('"issues_found":[');
      expect(concept.summary).toContain('"recommendations":[');
      expect(concept.summary).toContain('"concepts_reviewed":[');
      expect(concept.summary).toContain('## Verification Results');
      expect(concept.summary).toContain('User can login with valid credentials');
      expect(concept.summary).toContain('## Issues Found');
      expect(concept.summary).toContain('Token expiration message unclear');
      expect(concept.summary).toContain('## Recommendations');
      expect(concept.summary).toContain('Improve error messages');
      expect(concept.summary).toContain('## Concepts Reviewed');
      expect(concept.summary).toContain('chapter-01-context');
      expect(concept.parent_id).toBe('chapter-01');
      expect(concept.edges).toHaveLength(4);
      expect(concept.edges[0]).toEqual({ to: 'chapter-01', relation: 'connects_to' });
      expect(concept.edges[1]).toEqual({ to: 'chapter-01-context', relation: 'connects_to' });
      expect(concept.edges[2]).toEqual({ to: 'chapter-01-plan-1', relation: 'connects_to' });
      expect(concept.edges[3]).toEqual({ to: 'chapter-01-plan-1-summary', relation: 'connects_to' });
    });

    it('handles UAT with no issues', () => {
      const uatData = {
        verification_results: ['All tests passed'],
        issues_found: [],
        recommendations: [],
        concepts_reviewed: ['chapter-01-context']
      };

      const concept = ChapterConceptTemplates.createUAT('chapter-01', uatData);

      expect(concept.summary).toContain('"issues_found":[]');
      expect(concept.summary).toContain('"recommendations":[]');
      expect(concept.edges).toHaveLength(2);
    });
  });
});
