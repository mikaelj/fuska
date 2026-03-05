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

describe('Dual-Path Roadmap Parsing', () => {
  let mockDb: MockKnowledgeDB;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDb();
    
    const { KnowledgeDB } = require('megamemory/dist/db.js');
    (KnowledgeDB as jest.Mock).mockImplementation(() => mockDb);
    
    (mockFs.pathExists as jest.Mock).mockResolvedValue(true);
    (mockFs.ensureDir as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Valid JSON Roadmap Parsing', () => {
    it('parses JSON roadmap with correct chapter count', async () => {
      const initiativeId = 'init-1';
      const roadmapId = 'roadmap-1';
      
      const roadmap = {
        id: roadmapId,
        name: 'roadmap',
        kind: 'module',
        summary: JSON.stringify({
          chapters: [
            { number: 1, name: 'Authentication', status: 'complete' },
            { number: 2, name: 'Database', status: 'in_progress' },
            { number: 3, name: 'API', status: 'planned' }
          ]
        }),
        parent_id: initiativeId
      };
      
      const chapter1 = {
        id: 'chapter-1',
        name: 'chapter-1',
        kind: 'feature',
        summary: JSON.stringify({ number: 1, name: 'Authentication', status: 'complete' }),
        parent_id: `${initiativeId}/roadmap`
      };
      
      const chapter2 = {
        id: 'chapter-2',
        name: 'chapter-2',
        kind: 'feature',
        summary: JSON.stringify({ number: 2, name: 'Database', status: 'in_progress' }),
        parent_id: `${initiativeId}/roadmap`
      };
      
      const chapter3 = {
        id: 'chapter-3',
        name: 'chapter-3',
        kind: 'feature',
        summary: JSON.stringify({ number: 3, name: 'API', status: 'planned' }),
        parent_id: `${initiativeId}/roadmap`
      };
      
      mockDb.getAllNodesRaw.mockReturnValue([roadmap, chapter1, chapter2, chapter3]);
      
      const allNodes = mockDb.getAllNodesRaw();
      const roadmapNode = allNodes.find((n: any) => n.name === 'roadmap');
      
      let roadmapData;
      try {
        roadmapData = JSON.parse(roadmapNode.summary);
      } catch (e) {
        roadmapData = null;
      }
      
      expect(roadmapData).not.toBeNull();
      expect(roadmapData.chapters).toBeDefined();
      expect(roadmapData.chapters.length).toBe(3);
      
      const childChapters = allNodes.filter((n: any) => 
        n.name.startsWith('chapter-') && n.parent_id === `${initiativeId}/roadmap`
      );
      
      expect(childChapters.length).toBe(3);
      expect(roadmapData.chapters.length).toBe(childChapters.length);
      
      expect(roadmapData.chapters[0].number).toBe(1);
      expect(roadmapData.chapters[0].name).toBe('Authentication');
      expect(roadmapData.chapters[1].status).toBe('in_progress');
    });

    it('extracts chapter details from JSON roadmap', async () => {
      const roadmap = {
        id: 'roadmap-1',
        name: 'roadmap',
        kind: 'module',
        summary: JSON.stringify({
          chapters: [
            { number: 1, name: 'Setup', goal: 'Initialize project', status: 'complete' },
            { number: 2, name: 'Core', goal: 'Build core features', status: 'in_progress' }
          ]
        }),
        parent_id: 'init-1'
      };
      
      mockDb.getAllNodesRaw.mockReturnValue([roadmap]);
      
      const allNodes = mockDb.getAllNodesRaw();
      const roadmapNode = allNodes.find((n: any) => n.name === 'roadmap');
      const roadmapData = JSON.parse(roadmapNode.summary);
      
      expect(roadmapData.chapters[0].goal).toBe('Initialize project');
      expect(roadmapData.chapters[1].name).toBe('Core');
      expect(roadmapData.chapters[1].status).toBe('in_progress');
    });
  });

  describe('Markdown Roadmap Parsing (Fallback)', () => {
    it('parses markdown roadmap when JSON parse fails', async () => {
      const markdownSummary = `
# Roadmap

## Chapter 1: Authentication
**Goal:** Implement user authentication
**Status:** complete

## Chapter 2: Database
**Goal:** Set up database layer
**Status:** in_progress

## Chapter 3: API
**Goal:** Build REST API
**Status:** planned
`;
      
      const roadmap = {
        id: 'roadmap-1',
        name: 'roadmap',
        kind: 'module',
        summary: markdownSummary,
        parent_id: 'init-1'
      };
      
      mockDb.getAllNodesRaw.mockReturnValue([roadmap]);
      
      const allNodes = mockDb.getAllNodesRaw();
      const roadmapNode = allNodes.find((n: any) => n.name === 'roadmap');
      
      let roadmapData;
      let parseWarning = false;
      
      try {
        roadmapData = JSON.parse(roadmapNode.summary);
      } catch (e) {
        parseWarning = true;
        
        const chapterRegex = /##\s+Chapter\s+(\d+):\s+(.+)\n\*\*Goal:\*\*\s+(.+)\n\*\*Status:\*\*\s+(.+)/g;
        const chapters: any[] = [];
        let match;
        
        while ((match = chapterRegex.exec(roadmapNode.summary)) !== null) {
          chapters.push({
            number: parseInt(match[1]),
            name: match[2].trim(),
            goal: match[3].trim(),
            status: match[4].trim()
          });
        }
        
        roadmapData = { chapters };
      }
      
      expect(parseWarning).toBe(true);
      expect(roadmapData.chapters).toBeDefined();
      expect(roadmapData.chapters.length).toBe(3);
      
      expect(roadmapData.chapters[0].number).toBe(1);
      expect(roadmapData.chapters[0].name).toBe('Authentication');
      expect(roadmapData.chapters[0].status).toBe('complete');
      expect(roadmapData.chapters[1].goal).toBe('Set up database layer');
    });

    it('extracts basic chapter info from simple markdown format', async () => {
      const markdownSummary = `
Chapter 1: Setup
Chapter 2: Development
Chapter 3: Testing
`;
      
      const roadmap = {
        id: 'roadmap-1',
        name: 'roadmap',
        kind: 'module',
        summary: markdownSummary,
        parent_id: 'init-1'
      };
      
      mockDb.getAllNodesRaw.mockReturnValue([roadmap]);
      
      const allNodes = mockDb.getAllNodesRaw();
      const roadmapNode = allNodes.find((n: any) => n.name === 'roadmap');
      
      let roadmapData;
      try {
        roadmapData = JSON.parse(roadmapNode.summary);
      } catch (e) {
        const simpleRegex = /Chapter\s+(\d+):\s+(.+)/g;
        const chapters: any[] = [];
        let match;
        
        while ((match = simpleRegex.exec(roadmapNode.summary)) !== null) {
          chapters.push({
            number: parseInt(match[1]),
            name: match[2].trim()
          });
        }
        
        roadmapData = { chapters };
      }
      
      expect(roadmapData.chapters).toBeDefined();
      expect(roadmapData.chapters.length).toBe(3);
      expect(roadmapData.chapters[1].name).toBe('Development');
    });
  });

  describe('Stale JSON with Wrong Chapter Count', () => {
    it('detects mismatch between roadmap count and child nodes', async () => {
      const initiativeId = 'init-1';
      
      const roadmap = {
        id: 'roadmap-1',
        name: 'roadmap',
        kind: 'module',
        summary: JSON.stringify({
          chapters: [
            { number: 1, name: 'Auth', status: 'complete' },
            { number: 2, name: 'DB', status: 'in_progress' }
          ]
        }),
        parent_id: initiativeId
      };
      
      const chapter1 = {
        id: 'chapter-1',
        name: 'chapter-1',
        kind: 'feature',
        summary: JSON.stringify({ number: 1, name: 'Auth' }),
        parent_id: `${initiativeId}/roadmap`
      };
      
      const chapter2 = {
        id: 'chapter-2',
        name: 'chapter-2',
        kind: 'feature',
        summary: JSON.stringify({ number: 2, name: 'DB' }),
        parent_id: `${initiativeId}/roadmap`
      };
      
      const chapter3 = {
        id: 'chapter-3',
        name: 'chapter-3',
        kind: 'feature',
        summary: JSON.stringify({ number: 3, name: 'API' }),
        parent_id: `${initiativeId}/roadmap`
      };
      
      mockDb.getAllNodesRaw.mockReturnValue([roadmap, chapter1, chapter2, chapter3]);
      
      const allNodes = mockDb.getAllNodesRaw();
      const roadmapNode = allNodes.find((n: any) => n.name === 'roadmap');
      const roadmapData = JSON.parse(roadmapNode.summary);
      
      const childChapters = allNodes.filter((n: any) => 
        n.name.startsWith('chapter-') && n.parent_id === `${initiativeId}/roadmap`
      );
      
      const roadmapCount = roadmapData.chapters.length;
      const childCount = childChapters.length;
      
      const hasMismatch = roadmapCount !== childCount;
      
      expect(hasMismatch).toBe(true);
      expect(roadmapCount).toBe(2);
      expect(childCount).toBe(3);
      
      if (hasMismatch) {
        const warning = `⚠️  Roadmap chapter count mismatch: roadmap says ${roadmapCount}, but found ${childCount} child nodes. Run fuska migrate-roadmap to sync.`;
        expect(warning).toContain('mismatch');
        expect(warning).toContain('migrate-roadmap');
      }
    });

    it('shows verification warning for stale roadmap', async () => {
      const roadmap = {
        id: 'roadmap-1',
        name: 'roadmap',
        kind: 'module',
        summary: JSON.stringify({
          chapters: [
            { number: 1, name: 'Old Chapter 1', status: 'complete' }
          ]
        }),
        parent_id: 'init-1'
      };
      
      const chapter1 = {
        id: 'chapter-1',
        name: 'chapter-1',
        kind: 'feature',
        parent_id: 'init-1/roadmap'
      };
      
      const chapter2 = {
        id: 'chapter-2',
        name: 'chapter-2',
        kind: 'feature',
        parent_id: 'init-1/roadmap'
      };
      
      mockDb.getAllNodesRaw.mockReturnValue([roadmap, chapter1, chapter2]);
      
      const allNodes = mockDb.getAllNodesRaw();
      const roadmapNode = allNodes.find((n: any) => n.name === 'roadmap');
      const roadmapData = JSON.parse(roadmapNode.summary);
      
      const childChapters = allNodes.filter((n: any) => 
        n.name.startsWith('chapter-') && n.parent_id.includes('roadmap')
      );
      
      const isStale = roadmapData.chapters.length !== childChapters.length;
      
      expect(isStale).toBe(true);
      
      if (isStale) {
        const warnings: string[] = [];
        warnings.push('Roadmap summary is stale - shows 1 chapters but found 2 child nodes');
        warnings.push('Using node discovery instead of roadmap summary');
        
        expect(warnings.length).toBe(2);
        expect(warnings[0]).toContain('stale');
        expect(warnings[1]).toContain('node discovery');
      }
    });
  });

  describe('Missing Roadmap Concept (Node Discovery)', () => {
    it('discovers chapters from node tree when roadmap missing', async () => {
      const initiativeId = 'init-1';
      
      const chapter1 = {
        id: 'chapter-1',
        name: 'chapter-1',
        kind: 'feature',
        summary: JSON.stringify({ number: 1, name: 'Setup', status: 'complete' }),
        parent_id: `${initiativeId}/roadmap`
      };
      
      const chapter2 = {
        id: 'chapter-2',
        name: 'chapter-2',
        kind: 'feature',
        summary: JSON.stringify({ number: 2, name: 'Core', status: 'in_progress' }),
        parent_id: `${initiativeId}/roadmap`
      };
      
      const chapter3 = {
        id: 'chapter-3',
        name: 'chapter-3',
        kind: 'feature',
        summary: JSON.stringify({ number: 3, name: 'Testing', status: 'planned' }),
        parent_id: `${initiativeId}/roadmap`
      };
      
      mockDb.getAllNodesRaw.mockReturnValue([chapter1, chapter2, chapter3]);
      
      const allNodes = mockDb.getAllNodesRaw();
      const roadmapNode = allNodes.find((n: any) => n.name === 'roadmap');
      
      expect(roadmapNode).toBeUndefined();
      
      const discoveredChapters = allNodes
        .filter((n: any) => /^chapter-\d+(-|$|\/)/.test(n.name) && n.kind === 'feature')
        .map((n: any) => {
          try {
            const data = JSON.parse(n.summary);
            return { number: data.number, name: data.name, status: data.status };
          } catch (e) {
            return { number: 0, name: n.name, status: 'unknown' };
          }
        })
        .sort((a: any, b: any) => a.number - b.number);
      
      expect(discoveredChapters.length).toBe(3);
      expect(discoveredChapters[0].number).toBe(1);
      expect(discoveredChapters[0].name).toBe('Setup');
      expect(discoveredChapters[1].status).toBe('in_progress');
      expect(discoveredChapters[2].name).toBe('Testing');
    });

    it('filters plan nodes from chapter discovery', async () => {
      const nodes = [
        {
          id: 'chapter-1',
          name: 'chapter-1',
          kind: 'feature',
          summary: JSON.stringify({ number: 1, name: 'Auth' }),
          parent_id: 'init-1/roadmap'
        },
        {
          id: 'chapter-1-plan-1',
          name: 'chapter-1-plan-1',
          kind: 'feature',
          summary: JSON.stringify({ objective: 'Build login' }),
          parent_id: 'chapter-1'
        },
        {
          id: 'chapter-1-plan-2',
          name: 'chapter-1-plan-2',
          kind: 'feature',
          summary: JSON.stringify({ objective: 'Build logout' }),
          parent_id: 'chapter-1'
        },
        {
          id: 'chapter-2',
          name: 'chapter-2',
          kind: 'feature',
          summary: JSON.stringify({ number: 2, name: 'Database' }),
          parent_id: 'init-1/roadmap'
        }
      ];
      
      mockDb.getAllNodesRaw.mockReturnValue(nodes);
      
      const allNodes = mockDb.getAllNodesRaw();
      
      const discoveredChapters = allNodes.filter((n: any) => {
        if (!/^chapter-\d+(-|$|\/)/.test(n.name)) return false;
        if (n.kind !== 'feature') return false;
        if (n.name.includes('-plan-')) return false;
        return true;
      });
      
      expect(discoveredChapters.length).toBe(2);
      expect(discoveredChapters.map((c: any) => c.name)).toEqual(['chapter-1', 'chapter-2']);
    });

    it('handles chapter regex variations', async () => {
      const nodes = [
        {
          id: 'c1',
          name: 'chapter-1',
          kind: 'feature',
          parent_id: 'init/roadmap'
        },
        {
          id: 'c2',
          name: 'chapter-2-daily-price-breakdown',
          kind: 'feature',
          parent_id: 'init/roadmap'
        },
        {
          id: 'c3',
          name: 'chapter-10',
          kind: 'feature',
          parent_id: 'init/roadmap'
        },
        {
          id: 'not-chapter',
          name: 'milestone-1',
          kind: 'module',
          parent_id: 'init'
        },
        {
          id: 'plan',
          name: 'chapter-1-plan-1',
          kind: 'feature',
          parent_id: 'chapter-1'
        }
      ];
      
      mockDb.getAllNodesRaw.mockReturnValue(nodes);
      
      const allNodes = mockDb.getAllNodesRaw();
      const chapters = allNodes.filter((n: any) => {
        if (!/^chapter-\d+(-|$|\/)/.test(n.name)) return false;
        if (n.kind !== 'feature') return false;
        if (n.name.includes('-plan-')) return false;
        return true;
      });
      
      expect(chapters.length).toBe(3);
      expect(chapters.map((c: any) => c.name)).toContain('chapter-1');
      expect(chapters.map((c: any) => c.name)).toContain('chapter-2-daily-price-breakdown');
      expect(chapters.map((c: any) => c.name)).toContain('chapter-10');
      expect(chapters.map((c: any) => c.name)).not.toContain('milestone-1');
      expect(chapters.map((c: any) => c.name)).not.toContain('chapter-1-plan-1');
    });
  });

  describe('Chapter Count Mismatch Detection', () => {
    it('detects when roadmap has fewer chapters than nodes', async () => {
      const roadmap = {
        id: 'roadmap',
        name: 'roadmap',
        kind: 'module',
        summary: JSON.stringify({
          chapters: [
            { number: 1, name: 'Phase 1' }
          ]
        }),
        parent_id: 'init'
      };
      
      const chapters = [
        { id: 'c1', name: 'chapter-1', kind: 'feature', parent_id: 'init/roadmap' },
        { id: 'c2', name: 'chapter-2', kind: 'feature', parent_id: 'init/roadmap' },
        { id: 'c3', name: 'chapter-3', kind: 'feature', parent_id: 'init/roadmap' }
      ];
      
      mockDb.getAllNodesRaw.mockReturnValue([roadmap, ...chapters]);
      
      const allNodes = mockDb.getAllNodesRaw();
      const roadmapNode = allNodes.find((n: any) => n.name === 'roadmap');
      const roadmapData = JSON.parse(roadmapNode.summary);
      
      const childChapters = allNodes.filter((n: any) => 
        n.name.startsWith('chapter-') && n.parent_id === 'init/roadmap'
      );
      
      const mismatch = roadmapData.chapters.length < childChapters.length;
      
      expect(mismatch).toBe(true);
      expect(roadmapData.chapters.length).toBe(1);
      expect(childChapters.length).toBe(3);
    });

    it('detects when roadmap has more chapters than nodes', async () => {
      const roadmap = {
        id: 'roadmap',
        name: 'roadmap',
        kind: 'module',
        summary: JSON.stringify({
          chapters: [
            { number: 1, name: 'Phase 1' },
            { number: 2, name: 'Phase 2' },
            { number: 3, name: 'Phase 3' },
            { number: 4, name: 'Phase 4' }
          ]
        }),
        parent_id: 'init'
      };
      
      const chapters = [
        { id: 'c1', name: 'chapter-1', kind: 'feature', parent_id: 'init/roadmap' },
        { id: 'c2', name: 'chapter-2', kind: 'feature', parent_id: 'init/roadmap' }
      ];
      
      mockDb.getAllNodesRaw.mockReturnValue([roadmap, ...chapters]);
      
      const allNodes = mockDb.getAllNodesRaw();
      const roadmapNode = allNodes.find((n: any) => n.name === 'roadmap');
      const roadmapData = JSON.parse(roadmapNode.summary);
      
      const childChapters = allNodes.filter((n: any) => 
        n.name.startsWith('chapter-') && n.parent_id === 'init/roadmap'
      );
      
      const mismatch = roadmapData.chapters.length > childChapters.length;
      
      expect(mismatch).toBe(true);
      expect(roadmapData.chapters.length).toBe(4);
      expect(childChapters.length).toBe(2);
    });

    it('validates exact match between roadmap and nodes', async () => {
      const roadmap = {
        id: 'roadmap',
        name: 'roadmap',
        kind: 'module',
        summary: JSON.stringify({
          chapters: [
            { number: 1, name: 'Auth' },
            { number: 2, name: 'DB' },
            { number: 3, name: 'API' }
          ]
        }),
        parent_id: 'init'
      };
      
      const chapters = [
        { id: 'c1', name: 'chapter-1', kind: 'feature', parent_id: 'init/roadmap' },
        { id: 'c2', name: 'chapter-2', kind: 'feature', parent_id: 'init/roadmap' },
        { id: 'c3', name: 'chapter-3', kind: 'feature', parent_id: 'init/roadmap' }
      ];
      
      mockDb.getAllNodesRaw.mockReturnValue([roadmap, ...chapters]);
      
      const allNodes = mockDb.getAllNodesRaw();
      const roadmapNode = allNodes.find((n: any) => n.name === 'roadmap');
      const roadmapData = JSON.parse(roadmapNode.summary);
      
      const childChapters = allNodes.filter((n: any) => 
        n.name.startsWith('chapter-') && n.parent_id === 'init/roadmap'
      );
      
      const isValid = roadmapData.chapters.length === childChapters.length;
      
      expect(isValid).toBe(true);
      expect(roadmapData.chapters.length).toBe(3);
      expect(childChapters.length).toBe(3);
    });
  });
});
