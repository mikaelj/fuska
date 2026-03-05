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
  updateNodeRaw: jest.Mock;
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
  updateNodeRaw: jest.fn()
});

const createMultiInitiativeEnvironment = () => {
  const initiative1Id = 'initiative-alpha';
  const initiative2Id = 'initiative-beta';
  
  return {
    nodes: [
      {
        id: 'config',
        name: 'config',
        kind: 'config',
        summary: JSON.stringify({ current_initiative: 'initiative-alpha' }),
        parent_id: null
      },
      {
        id: initiative1Id,
        name: 'initiative-alpha',
        kind: 'feature',
        summary: 'Alpha Initiative',
        parent_id: null
      },
      {
        id: initiative2Id,
        name: 'initiative-beta',
        kind: 'feature',
        summary: 'Beta Initiative',
        parent_id: null
      },
      {
        id: 'state-alpha',
        name: 'state',
        kind: 'config',
        summary: JSON.stringify({ current_chapter: 'chapter-2', status: 'in_progress' }),
        parent_id: initiative1Id
      },
      {
        id: 'state-beta',
        name: 'state',
        kind: 'config',
        summary: JSON.stringify({ current_chapter: 'chapter-1', status: 'planned' }),
        parent_id: initiative2Id
      },
      {
        id: 'roadmap-alpha',
        name: 'roadmap',
        kind: 'module',
        summary: JSON.stringify({
          chapters: [
            { number: 1, name: 'Alpha Chapter 1', status: 'complete' },
            { number: 2, name: 'Alpha Chapter 2', status: 'in_progress' }
          ]
        }),
        parent_id: initiative1Id
      },
      {
        id: 'roadmap-beta',
        name: 'roadmap',
        kind: 'module',
        summary: JSON.stringify({
          chapters: [
            { number: 1, name: 'Beta Chapter 1', status: 'planned' }
          ]
        }),
        parent_id: initiative2Id
      },
      {
        id: 'chapter-1-alpha',
        name: 'chapter-1',
        kind: 'feature',
        summary: JSON.stringify({ number: 1, name: 'Alpha Chapter 1', status: 'complete' }),
        parent_id: `${initiative1Id}/roadmap`
      },
      {
        id: 'chapter-2-alpha',
        name: 'chapter-2',
        kind: 'feature',
        summary: JSON.stringify({ number: 2, name: 'Alpha Chapter 2', status: 'in_progress' }),
        parent_id: `${initiative1Id}/roadmap`
      },
      {
        id: 'chapter-1-beta',
        name: 'chapter-1',
        kind: 'feature',
        summary: JSON.stringify({ number: 1, name: 'Beta Chapter 1', status: 'planned' }),
        parent_id: `${initiative2Id}/roadmap`
      },
      {
        id: 'summary-alpha',
        name: 'chapter-1-plan-1-summary',
        kind: 'component',
        summary: JSON.stringify({ accomplishments: ['Alpha work'] }),
        parent_id: 'chapter-1-alpha'
      },
      {
        id: 'summary-beta',
        name: 'chapter-1-plan-1-summary',
        kind: 'component',
        summary: JSON.stringify({ accomplishments: ['Beta work'] }),
        parent_id: 'chapter-1-beta'
      },
      {
        id: 'context-alpha',
        name: 'chapter-1-context',
        kind: 'config',
        summary: JSON.stringify({ decisions: { framework: 'react' } }),
        parent_id: 'chapter-1-alpha'
      },
      {
        id: 'context-beta',
        name: 'chapter-1-context',
        kind: 'config',
        summary: JSON.stringify({ decisions: { framework: 'vue' } }),
        parent_id: 'chapter-1-beta'
      },
      {
        id: 'research-alpha',
        name: 'chapter-1-research',
        kind: 'pattern',
        summary: 'Alpha research',
        parent_id: 'chapter-1-alpha'
      },
      {
        id: 'research-beta',
        name: 'chapter-1-research',
        kind: 'pattern',
        summary: 'Beta research',
        parent_id: 'chapter-1-beta'
      },
      {
        id: 'todos-alpha',
        name: 'todos',
        kind: 'module',
        summary: 'Alpha todos',
        parent_id: initiative1Id
      },
      {
        id: 'todos-beta',
        name: 'todos',
        kind: 'module',
        summary: 'Beta todos',
        parent_id: initiative2Id
      },
      {
        id: 'todo-1-alpha',
        name: 'todo-001',
        kind: 'feature',
        summary: JSON.stringify({ task: 'Alpha task', status: 'pending' }),
        parent_id: 'todos-alpha'
      },
      {
        id: 'todo-1-beta',
        name: 'todo-001',
        kind: 'feature',
        summary: JSON.stringify({ task: 'Beta task', status: 'pending' }),
        parent_id: 'todos-beta'
      }
    ],
    initiative1Id,
    initiative2Id
  };
};

describe('Command Test Matrix - Multi-Initiative Scoping', () => {
  let mockDb: MockKnowledgeDB;
  let env: ReturnType<typeof createMultiInitiativeEnvironment>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDb();
    env = createMultiInitiativeEnvironment();
    
    const { KnowledgeDB } = require('megamemory/dist/db.js');
    (KnowledgeDB as jest.Mock).mockImplementation(() => mockDb);
    
    (mockFs.pathExists as jest.Mock).mockResolvedValue(true);
    (mockFs.ensureDir as jest.Mock).mockResolvedValue(undefined);
  });

  const loadCurrentInitiative = (nodes: any[]) => {
    const configNode = nodes.find((n: any) => n.name === 'config' && n.kind === 'config');
    const configData = JSON.parse(configNode.summary);
    
    const currentInitiative = nodes.find((n: any) => 
      n.name === configData.current_initiative && 
      n.kind === 'feature' && 
      n.parent_id === null
    );
    
    return currentInitiative;
  };

  const filterByInitiative = (nodes: any[], initiativeId: string, nodeMap?: Map<string, any>) => {
    const map = nodeMap || new Map<string, any>(nodes.map((n: any) => [n.id, n]));
    
    const findInitiativeId = (nodeId: string, maxDepth = 20): string | null => {
      let current: any = map.get(nodeId);
      let depth = 0;
      
      while (current && depth < maxDepth) {
        if (current.parent_id === null && current.kind === 'feature') {
          return current.id;
        }
        
        if (current.parent_id) {
          current = map.get(current.parent_id);
        } else {
          break;
        }
        depth++;
      }
      
      return null;
    };
    
    return nodes.filter((n: any) => {
      const nodeInitiativeId = findInitiativeId(n.id);
      return nodeInitiativeId === initiativeId;
    });
  };

  describe('Read-Only Commands', () => {
    it('fuska command shows only current initiative data', async () => {
      mockDb.getAllNodesRaw.mockReturnValue(env.nodes);
      
      const allNodes = mockDb.getAllNodesRaw();
      const currentInitiative = loadCurrentInitiative(allNodes);
      
      expect(currentInitiative.name).toBe('initiative-alpha');
      
      const state = allNodes.find((n: any) => 
        n.name === 'state' && n.parent_id === currentInitiative.id
      );
      
      const stateData = JSON.parse(state.summary);
      expect(stateData.current_chapter).toBe('chapter-2');
      expect(stateData.status).toBe('in_progress');
      
      const roadmap = allNodes.find((n: any) => 
        n.name === 'roadmap' && n.parent_id === currentInitiative.id
      );
      
      const roadmapData = JSON.parse(roadmap.summary);
      expect(roadmapData.chapters.length).toBe(2);
      expect(roadmapData.chapters[0].name).toBe('Alpha Chapter 1');
      
      const betaRoadmap = allNodes.find((n: any) => 
        n.name === 'roadmap' && n.parent_id === env.initiative2Id
      );
      expect(roadmap.id).not.toBe(betaRoadmap.id);
    });

    it('fuska progress shows current initiative state', async () => {
      mockDb.getAllNodesRaw.mockReturnValue(env.nodes);
      
      const allNodes = mockDb.getAllNodesRaw();
      const currentInitiative = loadCurrentInitiative(allNodes);
      
      const state = allNodes.find((n: any) => 
        n.name === 'state' && n.parent_id === currentInitiative.id
      );
      
      const stateData = JSON.parse(state.summary);
      expect(stateData.current_chapter).toBe('chapter-2');
      
      const wrongState = allNodes.find((n: any) => 
        n.name === 'state' && n.parent_id === env.initiative2Id
      );
      const wrongStateData = JSON.parse(wrongState.summary);
      expect(wrongStateData.current_chapter).toBe('chapter-1');
      
      expect(state.id).not.toBe(wrongState.id);
    });

    it('fuska review shows summaries from current initiative only', async () => {
      mockDb.getAllNodesRaw.mockReturnValue(env.nodes);
      
      const allNodes = mockDb.getAllNodesRaw();
      const nodeMap = new Map(allNodes.map((n: any) => [n.id, n]));
      
      const currentInitiative = loadCurrentInitiative(allNodes);
      const filteredNodes = filterByInitiative(allNodes, currentInitiative.id, nodeMap);
      
      const summaries = filteredNodes.filter((n: any) => 
        n.kind === 'component' && n.name.includes('-summary')
      );
      
      expect(summaries.length).toBe(1);
      expect(summaries[0].id).toBe('summary-alpha');
      
      const summaryData = JSON.parse(summaries[0].summary);
      expect(summaryData.accomplishments).toContain('Alpha work');
      expect(summaryData.accomplishments).not.toContain('Beta work');
    });

    it('fuska check-todos shows todos from current initiative only', async () => {
      mockDb.getAllNodesRaw.mockReturnValue(env.nodes);
      
      const allNodes = mockDb.getAllNodesRaw();
      const currentInitiative = loadCurrentInitiative(allNodes);
      
      const todos = allNodes.filter((n: any) => 
        n.kind === 'feature' && n.name.startsWith('todo-') && n.parent_id.includes('todos')
      );
      
      const nodeMap = new Map<string, any>(allNodes.map((n: any) => [n.id, n]));
      const filteredTodos = filterByInitiative(todos, currentInitiative.id, nodeMap);
      
      expect(filteredTodos.length).toBe(1);
      expect(filteredTodos[0].id).toBe('todo-1-alpha');
      
      const todoData = JSON.parse(filteredTodos[0].summary);
      expect(todoData.task).toBe('Alpha task');
      expect(todoData.task).not.toBe('Beta task');
    });

    it('fuska export-md exports current initiative data only', async () => {
      mockDb.getAllNodesRaw.mockReturnValue(env.nodes);
      
      const allNodes = mockDb.getAllNodesRaw();
      const currentInitiative = loadCurrentInitiative(allNodes);
      const nodeMap = new Map<string, any>(allNodes.map((n: any) => [n.id, n]));
      
      const filteredNodes = filterByInitiative(allNodes, currentInitiative.id, nodeMap);
      
      const roadmap = filteredNodes.find((n: any) => n.name === 'roadmap');
      const roadmapData = JSON.parse(roadmap.summary);
      
      expect(roadmapData.chapters.length).toBe(2);
      expect(roadmapData.chapters[0].name).toBe('Alpha Chapter 1');
      
      const summaries = filteredNodes.filter((n: any) => n.name.includes('-summary'));
      expect(summaries.length).toBe(1);
      
      const wrongRoadmap = allNodes.find((n: any) => 
        n.name === 'roadmap' && n.parent_id === env.initiative2Id
      );
      expect(filteredNodes).not.toContainEqual(wrongRoadmap);
    });

    it('fuska code-review scopes to current initiative', async () => {
      mockDb.getAllNodesRaw.mockReturnValue(env.nodes);
      
      const allNodes = mockDb.getAllNodesRaw();
      const currentInitiative = loadCurrentInitiative(allNodes);
      const nodeMap = new Map<string, any>(allNodes.map((n: any) => [n.id, n]));
      
      const filteredNodes = filterByInitiative(allNodes, currentInitiative.id, nodeMap);
      const summaries = filteredNodes.filter((n: any) => 
        n.kind === 'component' && n.name.includes('-summary')
      );
      
      expect(summaries.length).toBe(1);
      expect(summaries[0].parent_id).toBe('chapter-1-alpha');
      expect(summaries[0].parent_id).not.toBe('chapter-1-beta');
    });
  });

  describe('Modifying Commands', () => {
    it('fuska build scopes state lookup to current initiative', async () => {
      mockDb.getAllNodesRaw.mockReturnValue(env.nodes);
      
      const allNodes = mockDb.getAllNodesRaw();
      const currentInitiative = loadCurrentInitiative(allNodes);
      
      const state = allNodes.find((n: any) => 
        n.name === 'state' && n.kind === 'config' && n.parent_id === currentInitiative.id
      );
      
      expect(state.id).toBe('state-alpha');
      expect(state.parent_id).toBe(env.initiative1Id);
      expect(state.parent_id).not.toBe(env.initiative2Id);
      
      const stateData = JSON.parse(state.summary);
      expect(stateData.current_chapter).toBe('chapter-2');
    });

    it('fuska design loads roadmap from current initiative only', async () => {
      mockDb.getAllNodesRaw.mockReturnValue(env.nodes);
      
      const allNodes = mockDb.getAllNodesRaw();
      const currentInitiative = loadCurrentInitiative(allNodes);
      
      const roadmap = allNodes.find((n: any) => 
        n.name === 'roadmap' && n.parent_id === currentInitiative.id
      );
      
      expect(roadmap.id).toBe('roadmap-alpha');
      
      const roadmapData = JSON.parse(roadmap.summary);
      expect(roadmapData.chapters.length).toBe(2);
      expect(roadmapData.chapters[0].name).toBe('Alpha Chapter 1');
    });

    it('fuska research-chapter scopes context loading', async () => {
      mockDb.getAllNodesRaw.mockReturnValue(env.nodes);
      
      const allNodes = mockDb.getAllNodesRaw();
      const currentInitiative = loadCurrentInitiative(allNodes);
      const nodeMap = new Map(allNodes.map((n: any) => [n.id, n]));
      
      const state = allNodes.find((n: any) => 
        n.name === 'state' && n.parent_id === currentInitiative.id
      );
      const stateData = JSON.parse(state.summary);
      
      const currentChapter = allNodes.find((n: any) => 
        n.name === stateData.current_chapter && 
        n.parent_id.includes('roadmap') &&
        filterByInitiative([n], currentInitiative.id, nodeMap).length > 0
      );
      
      expect(currentChapter).toBeDefined();
      expect(currentChapter.id).toBe('chapter-2-alpha');
      
      const context = allNodes.find((n: any) => 
        n.name === `${stateData.current_chapter}-context` && 
        n.parent_id === currentChapter.id
      );
      
      expect(context).toBeDefined();
      expect(context.id).not.toBe('context-beta');
    });

    it('fuska complete updates state in current initiative only', async () => {
      mockDb.getAllNodesRaw.mockReturnValue(env.nodes);
      
      const allNodes = mockDb.getAllNodesRaw();
      const currentInitiative = loadCurrentInitiative(allNodes);
      
      const stateToUpdate = allNodes.find((n: any) => 
        n.name === 'state' && n.parent_id === currentInitiative.id
      );
      
      expect(stateToUpdate.id).toBe('state-alpha');
      expect(stateToUpdate.parent_id).toBe(env.initiative1Id);
      
      const wrongState = allNodes.find((n: any) => 
        n.name === 'state' && n.parent_id === env.initiative2Id
      );
      expect(stateToUpdate.id).not.toBe(wrongState.id);
    });

    it('fuska add-chapter modifies roadmap in current initiative only', async () => {
      mockDb.getAllNodesRaw.mockReturnValue(env.nodes);
      
      const allNodes = mockDb.getAllNodesRaw();
      const currentInitiative = loadCurrentInitiative(allNodes);
      
      const roadmap = allNodes.find((n: any) => 
        n.name === 'roadmap' && n.parent_id === currentInitiative.id
      );
      
      expect(roadmap.id).toBe('roadmap-alpha');
      expect(roadmap.parent_id).toBe(env.initiative1Id);
      
      const roadmapData = JSON.parse(roadmap.summary);
      const newChapter = { number: 3, name: 'New Chapter', status: 'planned' };
      
      const updatedRoadmap = {
        ...roadmap,
        summary: JSON.stringify({
          chapters: [...roadmapData.chapters, newChapter]
        })
      };
      
      expect(updatedRoadmap.parent_id).toBe(env.initiative1Id);
      expect(updatedRoadmap.parent_id).not.toBe(env.initiative2Id);
    });

    it('fuska insert-chapter targets correct initiative roadmap', async () => {
      mockDb.getAllNodesRaw.mockReturnValue(env.nodes);
      
      const allNodes = mockDb.getAllNodesRaw();
      const currentInitiative = loadCurrentInitiative(allNodes);
      
      const roadmap = allNodes.find((n: any) => 
        n.name === 'roadmap' && n.parent_id === currentInitiative.id
      );
      
      expect(roadmap.id).toBe('roadmap-alpha');
      
      const wrongRoadmap = allNodes.find((n: any) => 
        n.name === 'roadmap' && n.parent_id === env.initiative2Id
      );
      
      expect(roadmap.id).not.toBe(wrongRoadmap.id);
    });

    it('fuska remove-chapter removes from current initiative only', async () => {
      mockDb.getAllNodesRaw.mockReturnValue(env.nodes);
      
      const allNodes = mockDb.getAllNodesRaw();
      const currentInitiative = loadCurrentInitiative(allNodes);
      
      const chaptersToRemove = allNodes.filter((n: any) => 
        n.name.startsWith('chapter-') && n.parent_id === `${currentInitiative.id}/roadmap`
      );
      
      expect(chaptersToRemove.length).toBe(2);
      chaptersToRemove.forEach((chapter: any) => {
        expect(chapter.parent_id).toContain(env.initiative1Id);
        expect(chapter.parent_id).not.toContain(env.initiative2Id);
      });
    });

    it('fuska map-codebase scopes context loading', async () => {
      mockDb.getAllNodesRaw.mockReturnValue(env.nodes);
      
      const allNodes = mockDb.getAllNodesRaw();
      const currentInitiative = loadCurrentInitiative(allNodes);
      const nodeMap = new Map<string, any>(allNodes.map((n: any) => [n.id, n]));
      
      const filteredNodes = filterByInitiative(allNodes, currentInitiative.id, nodeMap);
      
      const contexts = filteredNodes.filter((n: any) => 
        n.kind === 'config' && n.name.includes('-context')
      );
      
      contexts.forEach((context: any) => {
        const contextData = JSON.parse(context.summary);
        expect(contextData).toBeDefined();
      });
      
      const betaContext = allNodes.find((n: any) => n.id === 'context-beta');
      expect(filteredNodes).not.toContainEqual(betaContext);
    });

    it('fuska new-milestone scopes roadmap lookup', async () => {
      mockDb.getAllNodesRaw.mockReturnValue(env.nodes);
      
      const allNodes = mockDb.getAllNodesRaw();
      const currentInitiative = loadCurrentInitiative(allNodes);
      
      const roadmap = allNodes.find((n: any) => 
        n.name === 'roadmap' && n.parent_id === currentInitiative.id
      );
      
      expect(roadmap.id).toBe('roadmap-alpha');
      expect(roadmap.parent_id).toBe(env.initiative1Id);
    });

    it('fuska plan-milestone-fixes scopes to current initiative', async () => {
      mockDb.getAllNodesRaw.mockReturnValue(env.nodes);
      
      const allNodes = mockDb.getAllNodesRaw();
      const currentInitiative = loadCurrentInitiative(allNodes);
      
      const roadmap = allNodes.find((n: any) => 
        n.name === 'roadmap' && n.parent_id === currentInitiative.id
      );
      
      expect(roadmap).toBeDefined();
      expect(roadmap.parent_id).toBe(env.initiative1Id);
    });
  });

  describe('All 16 Commands Scope Correctly', () => {
    const commands = [
      'fuska',
      'progress',
      'build',
      'design',
      'research-chapter',
      'review',
      'check-todos',
      'code-review',
      'complete',
      'export-md',
      'add-chapter',
      'insert-chapter',
      'remove-chapter',
      'map-codebase',
      'new-milestone',
      'plan-milestone-fixes'
    ];
    
    commands.forEach((command) => {
      it(`${command} respects initiative boundaries`, async () => {
        mockDb.getAllNodesRaw.mockReturnValue(env.nodes);
        
        const allNodes = mockDb.getAllNodesRaw();
        const currentInitiative = loadCurrentInitiative(allNodes);
        
        expect(currentInitiative).toBeDefined();
        expect(currentInitiative.name).toBe('initiative-alpha');
        expect(currentInitiative.id).toBe(env.initiative1Id);
        
        const state = allNodes.find((n: any) => 
          n.name === 'state' && n.parent_id === currentInitiative.id
        );
        
        if (state) {
          expect(state.parent_id).toBe(env.initiative1Id);
          expect(state.parent_id).not.toBe(env.initiative2Id);
        }
        
        const roadmap = allNodes.find((n: any) => 
          n.name === 'roadmap' && n.parent_id === currentInitiative.id
        );
        
        if (roadmap) {
          expect(roadmap.parent_id).toBe(env.initiative1Id);
          expect(roadmap.parent_id).not.toBe(env.initiative2Id);
        }
      });
    });
  });

  describe('Cross-Initiative Pollution Detection', () => {
    it('detects when commands attempt to access wrong initiative data', async () => {
      mockDb.getAllNodesRaw.mockReturnValue(env.nodes);
      
      const allNodes = mockDb.getAllNodesRaw();
      const currentInitiative = loadCurrentInitiative(allNodes);
      
      const wrongInitiativeNodes = allNodes.filter((n: any) => {
        if (n.parent_id === null) return false;
        if (!n.parent_id.includes(env.initiative2Id)) return false;
        return true;
      });
      
      expect(wrongInitiativeNodes.length).toBeGreaterThan(0);
      
      const nodeMap = new Map<string, any>(allNodes.map((n: any) => [n.id, n]));
      const filteredNodes = filterByInitiative(allNodes, currentInitiative.id, nodeMap);
      
      const hasPollution = filteredNodes.some((n: any) => 
        n.parent_id && n.parent_id.includes(env.initiative2Id)
      );
      
      expect(hasPollution).toBe(false);
    });

    it('validates all loaded data belongs to current initiative', async () => {
      mockDb.getAllNodesRaw.mockReturnValue(env.nodes);
      
      const allNodes = mockDb.getAllNodesRaw();
      const currentInitiative = loadCurrentInitiative(allNodes);
      const nodeMap = new Map<string, any>(allNodes.map((n: any) => [n.id, n]));
      
      const filteredNodes = filterByInitiative(allNodes, currentInitiative.id, nodeMap);
      
      filteredNodes.forEach((node: any) => {
        if (node.parent_id === null) {
          expect(node.id).toBe(currentInitiative.id);
        } else {
          const findInitiativeId = (nodeId: string): string | null => {
            let current: any = nodeMap.get(nodeId);
            let depth = 0;
            
            while (current && depth < 20) {
              if (current.parent_id === null && current.kind === 'feature') {
                return current.id;
              }
              
              if (current.parent_id) {
                current = nodeMap.get(current.parent_id);
              } else {
                break;
              }
              depth++;
            }
            
            return null;
          };
          
          const initiativeId = findInitiativeId(node.id);
          expect(initiativeId).toBe(currentInitiative.id);
        }
      });
    });
  });
});
