import { ProjectConceptTemplates } from '../project-templates';

describe('ProjectConceptTemplates', () => {
  describe('createProjectRoot', () => {
    it('creates project-root concept correctly', () => {
      const project = {
        slug: 'my-project',
        name: 'My Project',
        what_this_is: 'A sample project for testing',
        core_value: 'Build great things',
        requirements: [],
        chapters: []
      };

      const concept = ProjectConceptTemplates.createProjectRoot(project);

      expect(concept.name).toBe('my-project');
      expect(concept.kind).toBe('feature');
      expect(concept.summary).toContain('Project: My Project');
      expect(concept.summary).toContain('A sample project for testing');
      expect(concept.why).toBe('Build great things');
      expect(concept.parent_id).toBeNull();
      expect(concept.edges).toEqual([]);
    });
  });

  describe('createRequirementsModule', () => {
    it('creates requirements module concept', () => {
      const concept = ProjectConceptTemplates.createRequirementsModule('my-project');

      expect(concept.name).toBe('requirements');
      expect(concept.kind).toBe('module');
      expect(concept.summary).toBe('Project requirements list');
      expect(concept.parent_id).toBe('my-project');
      expect(concept.edges).toEqual([{ to: 'my-project', relation: 'connects_to' }]);
    });
  });

  describe('createRequirement', () => {
    it('creates requirement concept with in_progress status', () => {
      const concept = ProjectConceptTemplates.createRequirement(
        'my-project',
        'AUTH-01',
        'User can login with email/password',
        'in_progress'
      );

      expect(concept.name).toBe('req-AUTH-01');
      expect(concept.kind).toBe('feature');
      expect(concept.summary).toContain('"description":"User can login with email/password"');
      expect(concept.summary).toContain('"status":"in_progress"');
      expect(concept.parent_id).toBe('my-project/requirements');
      expect(concept.edges).toEqual([{ to: 'requirements', relation: 'implements' }]);
    });

    it('creates requirement concept with complete status', () => {
      const concept = ProjectConceptTemplates.createRequirement(
        'my-project',
        'AUTH-01',
        'User can login',
        'complete'
      );

      expect(concept.summary).toContain('"status":"complete"');
    });

    it('creates requirement concept with out_of_scope status', () => {
      const concept = ProjectConceptTemplates.createRequirement(
        'my-project',
        'AUTH-02',
        'OAuth support',
        'out_of_scope'
      );

      expect(concept.summary).toContain('"status":"out_of_scope"');
    });
  });

  describe('createRoadmapModule', () => {
    it('creates roadmap module concept', () => {
      const concept = ProjectConceptTemplates.createRoadmapModule('my-project');

      expect(concept.name).toBe('roadmap');
      expect(concept.kind).toBe('module');
      expect(concept.summary).toBe('Project roadmap with chapters');
      expect(concept.parent_id).toBe('my-project');
      expect(concept.edges).toEqual([{ to: 'my-project', relation: 'connects_to' }]);
    });
  });

  describe('createChapter', () => {
    it('creates chapter concept correctly', () => {
      const concept = ProjectConceptTemplates.createChapter(
        'my-project',
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
      expect(concept.parent_id).toBe('my-project/roadmap');
      expect(concept.edges).toEqual([{ to: 'roadmap', relation: 'connects_to' }]);
    });
  });

  describe('createState', () => {
    it('creates state config concept', () => {
      const state = {
        current_chapter: 'chapter-01',
        current_plan: 'chapter-01-plan-1',
        status: 'in_progress',
        progress: 25
      };

      const concept = ProjectConceptTemplates.createState('my-project', state);

      expect(concept.name).toBe('state');
      expect(concept.kind).toBe('config');
      expect(concept.summary).toContain('"current_chapter":"chapter-01"');
      expect(concept.summary).toContain('"current_plan":"chapter-01-plan-1"');
      expect(concept.summary).toContain('"status":"in_progress"');
      expect(concept.summary).toContain('"progress":25');
      expect(concept.parent_id).toBe('my-project');
      expect(concept.edges).toEqual([{ to: 'my-project', relation: 'configured_by' }]);
    });
  });

  describe('createConfig', () => {
    it('creates config concept', () => {
      const config = {
        mode: 'yolo',
        depth: 'standard',
        parallelization: true,
        workflow: {
          research: true,
          plan_check: true,
          verifier: false
        }
      };

      const concept = ProjectConceptTemplates.createConfig('my-project', config);

      expect(concept.name).toBe('config');
      expect(concept.kind).toBe('config');
      expect(concept.summary).toContain('"mode":"yolo"');
      expect(concept.summary).toContain('"depth":"standard"');
      expect(concept.summary).toContain('"parallelization":true');
      expect(concept.parent_id).toBe('my-project');
      expect(concept.edges).toEqual([{ to: 'my-project', relation: 'configured_by' }]);
    });
  });

  describe('createMilestonesModule', () => {
    it('creates milestones module concept', () => {
      const concept = ProjectConceptTemplates.createMilestonesModule('my-project');

      expect(concept.name).toBe('milestones');
      expect(concept.kind).toBe('module');
      expect(concept.summary).toBe('Project milestones tracking');
      expect(concept.parent_id).toBe('my-project');
      expect(concept.edges).toEqual([{ to: 'my-project', relation: 'connects_to' }]);
    });
  });

  describe('createMilestone', () => {
    it('creates milestone concept', () => {
      const milestone = {
        name: 'MVP',
        status: 'complete',
        chapters: ['chapter-01', 'chapter-02'],
        description: 'Minimum viable product'
      };

      const concept = ProjectConceptTemplates.createMilestone('my-project', 'MVP', milestone);

      expect(concept.name).toBe('milestone-mvp');
      expect(concept.kind).toBe('feature');
      expect(concept.summary).toContain('"name":"MVP"');
      expect(concept.summary).toContain('"status":"complete"');
      expect(concept.summary).toContain('"description":"Minimum viable product"');
      expect(concept.summary).toContain('"chapters":["chapter-01","chapter-02"]');
      expect(concept.parent_id).toBe('my-project/milestones');
      expect(concept.edges).toHaveLength(3);
      expect(concept.edges[0]).toEqual({ to: 'milestones', relation: 'connects_to' });
      expect(concept.edges[1]).toEqual({ to: 'chapter-01', relation: 'depends_on' });
      expect(concept.edges[2]).toEqual({ to: 'chapter-02', relation: 'depends_on' });
    });

    it('handles milestone name with spaces and special characters', () => {
      const milestone = {
        name: 'Version 1.0 Beta',
        status: 'in_progress',
        chapters: [],
        description: 'Beta release'
      };

      const concept = ProjectConceptTemplates.createMilestone('my-project', 'Version 1.0 Beta', milestone);

      expect(concept.name).toBe('milestone-version-10-beta');
    });
  });

  describe('createTodosModule', () => {
    it('creates todos module concept', () => {
      const concept = ProjectConceptTemplates.createTodosModule('my-project');

      expect(concept.name).toBe('todos');
      expect(concept.kind).toBe('module');
      expect(concept.summary).toBe('Project todos tracking');
      expect(concept.parent_id).toBe('my-project');
      expect(concept.edges).toEqual([{ to: 'my-project', relation: 'connects_to' }]);
    });
  });

  describe('createTodo', () => {
    it('creates todo concept without chapter reference', () => {
      const concept = ProjectConceptTemplates.createTodo(
        'my-project',
        '001',
        'Implement user registration'
      );

      expect(concept.name).toBe('todo-001');
      expect(concept.kind).toBe('feature');
      expect(concept.summary).toContain('"description":"Implement user registration"');
      expect(concept.summary).toContain('"status":"pending"');
      expect(concept.parent_id).toBe('my-project/todos');
      expect(concept.edges).toEqual([{ to: 'todos', relation: 'connects_to' }]);
    });

    it('creates todo concept with chapter reference', () => {
      const concept = ProjectConceptTemplates.createTodo(
        'my-project',
        '001',
        'Implement user registration',
        'chapter-01'
      );

      expect(concept.summary).toContain('"chapter_ref":"chapter-01"');
      expect(concept.edges).toHaveLength(2);
      expect(concept.edges[0]).toEqual({ to: 'todos', relation: 'connects_to' });
      expect(concept.edges[1]).toEqual({ to: 'chapter-01', relation: 'connects_to' });
    });
  });
});
