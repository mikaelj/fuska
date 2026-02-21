import { InitiativeConceptTemplates } from '../initiative-templates';

describe('InitiativeConceptTemplates', () => {
  describe('createInitiativeRoot', () => {
    it('creates initiative-root concept correctly', () => {
      const initiative = {
        slug: 'my-initiative',
        name: 'My Initiative',
        what_this_is: 'A sample initiative for testing',
        core_value: 'Build great things',
        requirements: [],
        chapters: []
      };

      const concept = InitiativeConceptTemplates.createInitiativeRoot(initiative);

      expect(concept.name).toBe('my-initiative');
      expect(concept.kind).toBe('feature');
      expect(concept.summary).toContain('Initiative: My Initiative');
      expect(concept.summary).toContain('A sample initiative for testing');
      expect(concept.why).toBe('Build great things');
      expect(concept.parent_id).toBeNull();
      expect(concept.edges).toEqual([]);
    });
  });

  describe('createRequirementsModule', () => {
    it('creates requirements module concept', () => {
      const concept = InitiativeConceptTemplates.createRequirementsModule('my-initiative');

      expect(concept.name).toBe('requirements');
      expect(concept.kind).toBe('module');
      expect(concept.summary).toBe('Initiative requirements list');
      expect(concept.parent_id).toBe('my-initiative');
      expect(concept.edges).toEqual([{ to: 'my-initiative', relation: 'part_of' }]);
    });
  });

  describe('createRequirement', () => {
    it('creates requirement concept with active status', () => {
      const concept = InitiativeConceptTemplates.createRequirement(
        'my-initiative',
        'AUTH-01',
        'User can login with email/password',
        'active'
      );

      expect(concept.name).toBe('req-AUTH-01');
      expect(concept.kind).toBe('feature');
      expect(concept.summary).toContain('"description":"User can login with email/password"');
      expect(concept.summary).toContain('"status":"active"');
      expect(concept.parent_id).toBe('my-initiative/requirements');
      expect(concept.edges).toEqual([{ to: 'requirements', relation: 'part_of' }]);
    });

    it('creates requirement concept with validated status', () => {
      const concept = InitiativeConceptTemplates.createRequirement(
        'my-initiative',
        'AUTH-01',
        'User can login',
        'validated'
      );

      expect(concept.summary).toContain('"status":"validated"');
    });

    it('creates requirement concept with out_of_scope status', () => {
      const concept = InitiativeConceptTemplates.createRequirement(
        'my-initiative',
        'AUTH-02',
        'OAuth support',
        'out_of_scope'
      );

      expect(concept.summary).toContain('"status":"out_of_scope"');
    });
  });

  describe('createRoadmapModule', () => {
    it('creates roadmap module concept', () => {
      const concept = InitiativeConceptTemplates.createRoadmapModule('my-initiative');

      expect(concept.name).toBe('roadmap');
      expect(concept.kind).toBe('module');
      expect(concept.summary).toBe('Initiative roadmap with chapters');
      expect(concept.parent_id).toBe('my-initiative');
      expect(concept.edges).toEqual([{ to: 'my-initiative', relation: 'part_of' }]);
    });
  });

  describe('createChapter', () => {
    it('creates chapter concept correctly', () => {
      const concept = InitiativeConceptTemplates.createChapter(
        'my-initiative',
        1,
        'chapter-01',
        'Authentication',
        'Implement JWT-based authentication'
      );

      expect(concept.name).toBe('chapter-1');
      expect(concept.kind).toBe('feature');
      expect(concept.summary).toContain('"number":1');
      expect(concept.summary).toContain('"slug":"chapter-01"');
      expect(concept.summary).toContain('"name":"Authentication"');
      expect(concept.summary).toContain('"goal":"Implement JWT-based authentication"');
      expect(concept.summary).toContain('"status":"planned"');
      expect(concept.parent_id).toBe('my-initiative/roadmap');
      expect(concept.edges).toEqual([{ to: 'roadmap', relation: 'part_of' }]);
    });
  });

  describe('createState', () => {
    it('creates state config concept', () => {
      const state = {
        current_chapter: 'chapter-01',
        current_plan: 'chapter-01-plan-1',
        status: 'in_progress',
        progress: 25,
        last_activity: 'Chapter 1 execution'
      };

      const concept = InitiativeConceptTemplates.createState('my-initiative', state);

      expect(concept.name).toBe('state');
      expect(concept.kind).toBe('config');
      expect(concept.summary).toContain('"current_chapter":"chapter-01"');
      expect(concept.summary).toContain('"current_plan":"chapter-01-plan-1"');
      expect(concept.summary).toContain('"status":"in_progress"');
      expect(concept.summary).toContain('"progress":25');
      expect(concept.summary).toContain('"last_activity":"Chapter 1 execution"');
      expect(concept.parent_id).toBe('my-initiative');
      expect(concept.edges).toEqual([{ to: 'my-initiative', relation: 'configured_by' }]);
    });
  });

  describe('createConfig', () => {
    it('creates config concept at root level', () => {
      const config = {
        depth: 'standard',
        autonomous_mode: false
      };

      const concept = InitiativeConceptTemplates.createConfig(config);

      expect(concept.name).toBe('config');
      expect(concept.kind).toBe('config');
      expect(concept.summary).toContain('"depth":"standard"');
      expect(concept.summary).toContain('"autonomous_mode":false');
      expect(concept.parent_id).toBeNull();
      expect(concept.edges).toEqual([]);
    });
  });

  describe('createMilestonesModule', () => {
    it('creates milestones module concept', () => {
      const concept = InitiativeConceptTemplates.createMilestonesModule('my-initiative');

      expect(concept.name).toBe('milestones');
      expect(concept.kind).toBe('module');
      expect(concept.summary).toBe('Initiative milestones tracking');
      expect(concept.parent_id).toBe('my-initiative');
      expect(concept.edges).toEqual([{ to: 'my-initiative', relation: 'part_of' }]);
    });
  });

  describe('createMilestone', () => {
    it('creates milestone concept', () => {
      const milestone = {
        name: 'MVP',
        status: 'shipped' as const,
        chapters: ['chapter-01', 'chapter-02'],
        description: 'Minimum viable product'
      };

      const concept = InitiativeConceptTemplates.createMilestone('my-initiative', 'MVP', milestone);

      expect(concept.name).toBe('milestone-mvp');
      expect(concept.kind).toBe('feature');
      expect(concept.summary).toContain('"name":"MVP"');
      expect(concept.summary).toContain('"status":"shipped"');
      expect(concept.summary).toContain('"description":"Minimum viable product"');
      expect(concept.summary).toContain('"chapters":["chapter-01","chapter-02"]');
      expect(concept.parent_id).toBe('my-initiative/milestones');
      expect(concept.edges!).toHaveLength(3);
      expect(concept.edges![0]).toEqual({ to: 'milestones', relation: 'part_of' });
      expect(concept.edges![1]).toEqual({ to: 'chapter-01', relation: 'includes' });
      expect(concept.edges![2]).toEqual({ to: 'chapter-02', relation: 'includes' });
    });

    it('handles milestone name with spaces and special characters', () => {
      const milestone = {
        name: 'Version 1.0 Beta',
        status: 'in_progress' as const,
        chapters: [],
        description: 'Beta release'
      };

      const concept = InitiativeConceptTemplates.createMilestone('my-initiative', 'Version 1.0 Beta', milestone);

      expect(concept.name).toBe('milestone-version-10-beta');
    });
  });

  describe('createTodosModule', () => {
    it('creates todos module concept', () => {
      const concept = InitiativeConceptTemplates.createTodosModule('my-initiative');

      expect(concept.name).toBe('todos');
      expect(concept.kind).toBe('module');
      expect(concept.summary).toBe('Initiative todos tracking');
      expect(concept.parent_id).toBe('my-initiative');
      expect(concept.edges).toEqual([{ to: 'my-initiative', relation: 'part_of' }]);
    });
  });

  describe('createTodo', () => {
    it('creates todo concept without chapter reference', () => {
      const concept = InitiativeConceptTemplates.createTodo(
        'my-initiative',
        '001',
        'Implement user registration'
      );

      expect(concept.name).toBe('todo-001');
      expect(concept.kind).toBe('feature');
      expect(concept.summary).toContain('"description":"Implement user registration"');
      expect(concept.summary).toContain('"status":"pending"');
      expect(concept.parent_id).toBe('my-initiative/todos');
      expect(concept.edges).toEqual([{ to: 'todos', relation: 'part_of' }]);
    });

    it('creates todo concept with chapter reference', () => {
      const concept = InitiativeConceptTemplates.createTodo(
        'my-initiative',
        '001',
        'Implement user registration',
        'chapter-01'
      );

      expect(concept.summary).toContain('"chapter_ref":"chapter-01"');
      expect(concept.edges!).toHaveLength(2);
      expect(concept.edges![0]).toEqual({ to: 'todos', relation: 'part_of' });
      expect(concept.edges![1]).toEqual({ to: 'chapter-01', relation: 'connects_to' });
    });
  });
});
