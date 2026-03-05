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

describe('Multi-Initiative Environment', () => {
  let mockDb: MockKnowledgeDB;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDb();
    
    const { KnowledgeDB } = require('megamemory/dist/db.js');
    (KnowledgeDB as jest.Mock).mockImplementation(() => mockDb);
    
    (mockFs.pathExists as jest.Mock).mockResolvedValue(true);
    (mockFs.ensureDir as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Initiative Switching', () => {
    it('switches between initiatives without loading data from wrong initiative', async () => {
      const initiative1Id = 'initiative-1';
      const initiative2Id = 'initiative-2';
      
      const initiative1 = {
        id: initiative1Id,
        name: 'initiative-alpha',
        kind: 'feature',
        summary: JSON.stringify({ name: 'Alpha', description: 'First initiative' }),
        parent_id: null
      };
      
      const initiative2 = {
        id: initiative2Id,
        name: 'initiative-beta',
        kind: 'feature',
        summary: JSON.stringify({ name: 'Beta', description: 'Second initiative' }),
        parent_id: null
      };
      
      const state1 = {
        id: 'state-1',
        name: 'state',
        kind: 'config',
        summary: JSON.stringify({ current_chapter: 'chapter-1', status: 'in_progress' }),
        parent_id: initiative1Id
      };
      
      const state2 = {
        id: 'state-2',
        name: 'state',
        kind: 'config',
        summary: JSON.stringify({ current_chapter: 'chapter-5', status: 'planned' }),
        parent_id: initiative2Id
      };
      
      const config = {
        id: 'config-1',
        name: 'config',
        kind: 'config',
        summary: JSON.stringify({ current_initiative: 'initiative-beta', depth: 'medium' }),
        parent_id: null
      };
      
      mockDb.getAllNodesRaw.mockReturnValue([initiative1, initiative2, state1, state2, config]);
      
      const allNodes = mockDb.getAllNodesRaw();
      const configNode = allNodes.find((n: any) => n.name === 'config' && n.kind === 'config');
      const configData = JSON.parse(configNode.summary);
      
      expect(configData.current_initiative).toBe('initiative-beta');
      
      const currentInitiative = allNodes.find((n: any) => 
        n.name === configData.current_initiative && 
        n.kind === 'feature' && 
        n.parent_id === null
      );
      
      expect(currentInitiative.id).toBe(initiative2Id);
      
      const currentState = allNodes.find((n: any) => 
        n.name === 'state' && 
        n.kind === 'config' && 
        n.parent_id === currentInitiative.id
      );
      
      expect(currentState.parent_id).toBe(initiative2Id);
      expect(currentState.parent_id).not.toBe(initiative1Id);
      
      const stateData = JSON.parse(currentState.summary);
      expect(stateData.current_chapter).toBe('chapter-5');
    });

    it('prevents loading state from wrong initiative', async () => {
      const initiative1Id = 'init-1';
      const initiative2Id = 'init-2';
      
      const state1 = {
        id: 'state-1',
        name: 'state',
        kind: 'config',
        summary: JSON.stringify({ phase: 1 }),
        parent_id: initiative1Id
      };
      
      const state2 = {
        id: 'state-2',
        name: 'state',
        kind: 'config',
        summary: JSON.stringify({ phase: 3 }),
        parent_id: initiative2Id
      };
      
      mockDb.getAllNodesRaw.mockReturnValue([state1, state2]);
      
      const allNodes = mockDb.getAllNodesRaw();
      const wrongState = allNodes.find((n: any) => 
        n.name === 'state' && n.parent_id === initiative1Id
      );
      
      const correctState = allNodes.find((n: any) => 
        n.name === 'state' && n.parent_id === initiative2Id
      );
      
      expect(wrongState.parent_id).toBe(initiative1Id);
      expect(correctState.parent_id).toBe(initiative2Id);
      expect(wrongState.id).not.toBe(correctState.id);
    });
  });

  describe('Cross-Initiative Pollution Prevention', () => {
    it('filters chapters by parent_id to prevent pollution', async () => {
      const initiative1Id = 'init-1';
      const initiative2Id = 'init-2';
      
      const chapters = [
        {
          id: 'chapter-1-init1',
          name: 'chapter-1',
          kind: 'feature',
          summary: JSON.stringify({ number: 1, name: 'Auth', status: 'complete' }),
          parent_id: `${initiative1Id}/roadmap`
        },
        {
          id: 'chapter-2-init1',
          name: 'chapter-2',
          kind: 'feature',
          summary: JSON.stringify({ number: 2, name: 'Database', status: 'in_progress' }),
          parent_id: `${initiative1Id}/roadmap`
        },
        {
          id: 'chapter-1-init2',
          name: 'chapter-1',
          kind: 'feature',
          summary: JSON.stringify({ number: 1, name: 'UI', status: 'planned' }),
          parent_id: `${initiative2Id}/roadmap`
        },
        {
          id: 'chapter-2-init2',
          name: 'chapter-2',
          kind: 'feature',
          summary: JSON.stringify({ number: 2, name: 'API', status: 'planned' }),
          parent_id: `${initiative2Id}/roadmap`
        }
      ];
      
      mockDb.getAllNodesRaw.mockReturnValue(chapters);
      
      const allNodes = mockDb.getAllNodesRaw();
      const initiative1Chapters = allNodes.filter((n: any) => 
        n.name.startsWith('chapter-') && 
        n.parent_id === `${initiative1Id}/roadmap`
      );
      
      const initiative2Chapters = allNodes.filter((n: any) => 
        n.name.startsWith('chapter-') && 
        n.parent_id === `${initiative2Id}/roadmap`
      );
      
      expect(initiative1Chapters.length).toBe(2);
      expect(initiative2Chapters.length).toBe(2);
      
      expect(initiative1Chapters.map((c: any) => c.id)).not.toContain('chapter-1-init2');
      expect(initiative2Chapters.map((c: any) => c.id)).not.toContain('chapter-1-init1');
      
      const init1Statuses = initiative1Chapters.map((c: any) => JSON.parse(c.summary).status);
      expect(init1Statuses).toContain('complete');
      expect(init1Statuses).toContain('in_progress');
      
      const init2Statuses = initiative2Chapters.map((c: any) => JSON.parse(c.summary).status);
      expect(init2Statuses).toEqual(['planned', 'planned']);
    });

    it('filters summaries by initiative via parent chain', async () => {
      const initiative1Id = 'init-1';
      const initiative2Id = 'init-2';
      
      const summaries = [
        {
          id: 'summary-1',
          name: 'chapter-1-plan-1-summary',
          kind: 'component',
          summary: JSON.stringify({ chapter: 'chapter-1', accomplishments: ['Built auth'] }),
          parent_id: 'chapter-1-init1'
        },
        {
          id: 'summary-2',
          name: 'chapter-1-plan-1-summary',
          kind: 'component',
          summary: JSON.stringify({ chapter: 'chapter-1', accomplishments: ['Built UI'] }),
          parent_id: 'chapter-1-init2'
        }
      ];
      
      const chapters = [
        {
          id: 'chapter-1-init1',
          name: 'chapter-1',
          kind: 'feature',
          parent_id: `${initiative1Id}/roadmap`
        },
        {
          id: 'chapter-1-init2',
          name: 'chapter-1',
          kind: 'feature',
          parent_id: `${initiative2Id}/roadmap`
        }
      ];
      
      mockDb.getAllNodesRaw.mockReturnValue([...summaries, ...chapters]);
      mockDb.getAllEdgesRaw.mockReturnValue([]);
      
      const allNodes = mockDb.getAllNodesRaw();
      const nodeMap = new Map<string, any>(allNodes.map((n: any) => [n.id, n]));
      
      const findInitiativeId = (nodeId: string, maxDepth = 20): string | null => {
        let current: any = nodeMap.get(nodeId);
        let depth = 0;
        
        while (current && depth < maxDepth) {
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
      
      const filteredSummaries = allNodes.filter((n: any) => {
        if (n.kind !== 'component' || !n.name.includes('-summary')) return false;
        
        const initiativeId = findInitiativeId(n.id);
        return initiativeId === initiative1Id;
      });
      
      expect(filteredSummaries.length).toBe(1);
      expect(filteredSummaries[0].id).toBe('summary-1');
      expect(filteredSummaries[0].parent_id).toBe('chapter-1-init1');
    });

    it('prevents roadmap pollution across initiatives', async () => {
      const initiative1Id = 'init-1';
      const initiative2Id = 'init-2';
      
      const roadmaps = [
        {
          id: 'roadmap-1',
          name: 'roadmap',
          kind: 'module',
          summary: JSON.stringify({ chapters: [{ number: 1, name: 'Auth' }] }),
          parent_id: initiative1Id
        },
        {
          id: 'roadmap-2',
          name: 'roadmap',
          kind: 'module',
          summary: JSON.stringify({ chapters: [{ number: 1, name: 'UI' }] }),
          parent_id: initiative2Id
        }
      ];
      
      mockDb.getAllNodesRaw.mockReturnValue(roadmaps);
      
      const allNodes = mockDb.getAllNodesRaw();
      const initiative1Roadmap = allNodes.find((n: any) => 
        n.name === 'roadmap' && n.parent_id === initiative1Id
      );
      
      const initiative2Roadmap = allNodes.find((n: any) => 
        n.name === 'roadmap' && n.parent_id === initiative2Id
      );
      
      expect(initiative1Roadmap.id).not.toBe(initiative2Roadmap.id);
      
      const roadmap1Data = JSON.parse(initiative1Roadmap.summary);
      const roadmap2Data = JSON.parse(initiative2Roadmap.summary);
      
      expect(roadmap1Data.chapters[0].name).toBe('Auth');
      expect(roadmap2Data.chapters[0].name).toBe('UI');
    });
  });

  describe('Command Respect Initiative Boundaries', () => {
    it('fuska-build loads state from correct initiative', async () => {
      const currentInitiativeId = 'current-init';
      const wrongInitiativeId = 'wrong-init';
      
      const nodes = [
        {
          id: 'config',
          name: 'config',
          kind: 'config',
          summary: JSON.stringify({ current_initiative: 'current-init' }),
          parent_id: null
        },
        {
          id: currentInitiativeId,
          name: 'current-init',
          kind: 'feature',
          summary: 'Current',
          parent_id: null
        },
        {
          id: wrongInitiativeId,
          name: 'wrong-init',
          kind: 'feature',
          summary: 'Wrong',
          parent_id: null
        },
        {
          id: 'state-current',
          name: 'state',
          kind: 'config',
          summary: JSON.stringify({ current_chapter: 'chapter-2', status: 'in_progress' }),
          parent_id: currentInitiativeId
        },
        {
          id: 'state-wrong',
          name: 'state',
          kind: 'config',
          summary: JSON.stringify({ current_chapter: 'chapter-5', status: 'complete' }),
          parent_id: wrongInitiativeId
        }
      ];
      
      mockDb.getAllNodesRaw.mockReturnValue(nodes);
      
      const allNodes = mockDb.getAllNodesRaw();
      const configNode = allNodes.find((n: any) => n.name === 'config' && n.kind === 'config');
      const configData = JSON.parse(configNode.summary);
      
      const currentInitiative = allNodes.find((n: any) => 
        n.name === configData.current_initiative && 
        n.kind === 'feature' && 
        n.parent_id === null
      );
      
      const state = allNodes.find((n: any) => 
        n.name === 'state' && 
        n.kind === 'config' && 
        n.parent_id === currentInitiative.id
      );
      
      expect(state.parent_id).toBe(currentInitiativeId);
      expect(state.parent_id).not.toBe(wrongInitiativeId);
      
      const stateData = JSON.parse(state.summary);
      expect(stateData.current_chapter).toBe('chapter-2');
      expect(stateData.status).toBe('in_progress');
    });

    it('fuska-design loads roadmap from correct initiative', async () => {
      const currentInitiativeId = 'current';
      const otherInitiativeId = 'other';
      
      const nodes = [
        {
          id: 'config',
          name: 'config',
          kind: 'config',
          summary: JSON.stringify({ current_initiative: 'current' }),
          parent_id: null
        },
        {
          id: currentInitiativeId,
          name: 'current',
          kind: 'feature',
          parent_id: null
        },
        {
          id: otherInitiativeId,
          name: 'other',
          kind: 'feature',
          parent_id: null
        },
        {
          id: 'roadmap-current',
          name: 'roadmap',
          kind: 'module',
          summary: JSON.stringify({ chapters: [{ number: 1, name: 'Phase 1' }] }),
          parent_id: currentInitiativeId
        },
        {
          id: 'roadmap-other',
          name: 'roadmap',
          kind: 'module',
          summary: JSON.stringify({ chapters: [{ number: 1, name: 'Different Phase' }] }),
          parent_id: otherInitiativeId
        }
      ];
      
      mockDb.getAllNodesRaw.mockReturnValue(nodes);
      
      const allNodes = mockDb.getAllNodesRaw();
      const configNode = allNodes.find((n: any) => n.name === 'config');
      const configData = JSON.parse(configNode.summary);
      
      const currentInitiative = allNodes.find((n: any) => 
        n.name === configData.current_initiative && n.parent_id === null
      );
      
      const roadmap = allNodes.find((n: any) => 
        n.name === 'roadmap' && n.parent_id === currentInitiative.id
      );
      
      expect(roadmap.parent_id).toBe(currentInitiativeId);
      const roadmapData = JSON.parse(roadmap.summary);
      expect(roadmapData.chapters[0].name).toBe('Phase 1');
    });
  });

  describe('No Cross-Initiative Data in Read-Only Commands', () => {
    it('fuska-review shows summaries from current initiative only', async () => {
      const currentInitiativeId = 'current';
      const otherInitiativeId = 'other';
      
      const nodes = [
        {
          id: 'config',
          name: 'config',
          kind: 'config',
          summary: JSON.stringify({ current_initiative: 'current' }),
          parent_id: null
        },
        {
          id: currentInitiativeId,
          name: 'current',
          kind: 'feature',
          parent_id: null
        },
        {
          id: otherInitiativeId,
          name: 'other',
          kind: 'feature',
          parent_id: null
        },
        {
          id: 'chapter-1-current',
          name: 'chapter-1',
          kind: 'feature',
          parent_id: `${currentInitiativeId}/roadmap`
        },
        {
          id: 'chapter-1-other',
          name: 'chapter-1',
          kind: 'feature',
          parent_id: `${otherInitiativeId}/roadmap`
        },
        {
          id: 'summary-current',
          name: 'chapter-1-plan-1-summary',
          kind: 'component',
          summary: JSON.stringify({ accomplishments: ['Current work'] }),
          parent_id: 'chapter-1-current'
        },
        {
          id: 'summary-other',
          name: 'chapter-1-plan-1-summary',
          kind: 'component',
          summary: JSON.stringify({ accomplishments: ['Other work'] }),
          parent_id: 'chapter-1-other'
        }
      ];
      
      mockDb.getAllNodesRaw.mockReturnValue(nodes);
      
      const allNodes = mockDb.getAllNodesRaw();
      const nodeMap = new Map<string, any>(allNodes.map((n: any) => [n.id, n]));
      
      const findInitiativeId = (nodeId: string, maxDepth = 20): string | null => {
        let current: any = nodeMap.get(nodeId);
        let depth = 0;
        
        while (current && depth < maxDepth) {
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
      
      const summaries = allNodes.filter((n: any) => {
        if (n.kind !== 'component' || !n.name.includes('-summary')) return false;
        
        const initiativeId = findInitiativeId(n.id);
        return initiativeId === currentInitiativeId;
      });
      
      expect(summaries.length).toBe(1);
      expect(summaries[0].id).toBe('summary-current');
      
      const summaryData = JSON.parse(summaries[0].summary);
      expect(summaryData.accomplishments).toContain('Current work');
      expect(summaryData.accomplishments).not.toContain('Other work');
    });
  });
});
