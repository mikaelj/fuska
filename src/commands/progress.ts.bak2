import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import { markdownToAnsi } from './utils/markdown-to-ansi';

interface TodoNode {
  id: string;
  name: string;
  kind: string;
  summary: string;
  parent_id: string | null;
}

interface Edge {
  from_id: string;
  to_id: string;
  relation: string;
}

interface StateData {
  current_chapter: string;
  current_plan: string | null;
  status: string;
  progress: number;
  last_activity: string;
}

interface ConfigData {
  depth: string;
  autonomous_mode: boolean;
  model_profile?: string;
  current_initiative?: string | null;
}

interface ChapterData {
  number: number;
  slug: string;
  name: string;
  goal: string;
  status: string;
  milestone?: string;
}

interface RoadmapData {
  chapters: ChapterData[];
  current_milestone: string;
}

interface RequirementData {
  id: string;
  description: string;
  status: string;
}

interface PlanData {
  objective: string;
  purpose: string;
  batch?: number;
}

interface SummaryData {
  chapter: string;
  plan: string;
  accomplishments: string[];
  completed?: string;
}

interface VerificationData {
  status: string;
  issues?: string[];
}

interface ChapterContextData {
  status: string;
  decisions: Record<string, any>;
}

interface TaskData {
  task_number?: string;
  slug?: string;
  description?: string;
  status?: string;
  created_at?: string;
  completed_at?: string;
  commit?: string;
}

interface TodoItem {
  name: string;
  description: string;
}

interface DebugSession {
  name: string;
}

interface StructuredContext {
  projectName: string;
  state: StateData | null;
  roadmap: RoadmapData | null;
  config: ConfigData | null;
  requirements: RequirementData[];
  currentChapter: ChapterData | null;
  chapterContext: ChapterContextData | null;
  chapterPlans: Array<{ name: string; data: PlanData }>;
  chapterSummaries: Array<{ name: string; data: SummaryData }>;
  chapterVerification: VerificationData | null;
  recentSummaries: Array<{ name: string; data: SummaryData }>;
  pendingTodos: TodoItem[];
  activeDebugSessions: DebugSession[];
  pendingTaskConcepts: Array<{ name: string; data: TaskData }>;
  doneTaskConcepts: Array<{ name: string; data: TaskData }>;
  unknownTaskConcepts: Array<{ name: string; slug: string }>;
}

interface AdHocContext {
  projectName: string;
  projectDescription: string;
  config: ConfigData | null;
  taskConcepts: Array<{ name: string; data: TaskData }>;
  pendingTaskConcepts: Array<{ name: string; data: TaskData }>;
  unknownTaskConcepts: Array<{ name: string; slug: string }>;
  availableInitiatives: string[];
}

interface NextAction {
  route: 'execute' | 'plan' | 'discuss' | 'issues' | 'complete-milestone' | 'next-chapter';
  chapterNumber?: number;
  planName?: string;
  objective?: string;
}

interface JsonOutput {
  mode: 'structured' | 'ad-hoc' | 'none';
  projectName: string;
  progress?: {
    completed: number;
    total: number;
    percentage: number;
  };
  currentChapter?: ChapterData | null;
  status?: string;
  nextAction?: NextAction;
  recentWork?: Array<{ chapter: string; plan: string; accomplishment: string }>;
  pendingTodos?: number;
  activeDebugSessions?: number;
  availableInitiatives?: string[];
}

class ProgressRunner {
  private projectDir: string;
  private db: any;
  private nodes: TodoNode[] = [];
  private edges: Edge[] = [];
  private nodeMap: Map<string, TodoNode> = new Map();
  private currentInitiative: string | null = null;
  private currentInitiativeId: string | null = null;

  constructor(options: { projectDir: string }) {
    this.projectDir = options.projectDir;
  }

  async run(jsonOutput: boolean = false): Promise<void> {
    await this.preflightCheck();
    await this.loadAllData();

    const currentSlug = this.findCurrentInitiativeSlug();

    if (!currentSlug) {
      const adHocContext = this.buildAdHocContext();
      if (jsonOutput) {
        this.outputJson(this.buildAdHocJson(adHocContext));
      } else {
        this.renderAdHocReport(adHocContext);
      }
      return;
    }

    this.currentInitiative = currentSlug;
    
    const root = this.nodes.find(n => n.name === currentSlug && n.parent_id === null);
    this.currentInitiativeId = root?.id || null;
    
    const healedChapters = this.healOrphanedChapters();
    if (healedChapters.length > 0) {
      this.nodes = this.db.getAllActiveNodes();
      this.edges = this.db.getAllEdges ? this.db.getAllEdges() : [];
      this.out(`\n✓ Healed orphaned chapters: ${healedChapters.join(', ')}\n`);
    }
    
    const state = this.findState();
    const roadmap = this.findRoadmap();
    
    if (!state || !roadmap) {
      const adHocContext = this.buildAdHocContext();
      if (jsonOutput) {
        this.outputJson(this.buildAdHocJson(adHocContext));
      } else {
        this.renderAdHocReport(adHocContext);
      }
      return;
    }
    
    const context = this.buildStructuredContext(state, roadmap);
    const nextAction = this.determineNextAction(context);
    
    if (jsonOutput) {
      this.outputJson(this.buildStructuredJson(context, nextAction));
    } else {
      this.renderStructuredReport(context, nextAction);
    }
  }

  private async preflightCheck(): Promise<void> {
    const resolvedPath = path.resolve(this.projectDir);
    const dbPath = path.join(resolvedPath, '.megamemory', 'knowledge.db');

    if (!await fs.pathExists(dbPath)) {
      console.error(`No .megamemory/knowledge.db found at ${resolvedPath}`);
      console.error('Run /fuska-new-initiative first.');
      process.exit(1);
    }

    const { KnowledgeDB } = await import('megamemory/dist/db.js');
    this.db = new KnowledgeDB(dbPath);
  }

  private async loadAllData(): Promise<void> {
    this.nodes = this.db.getAllActiveNodes();
    this.edges = this.db.getAllEdges ? this.db.getAllEdges() : [];
    
    for (const node of this.nodes) {
      this.nodeMap.set(node.id, node);
    }
  }

  private parseSummary<T>(summary: string): T | null {
    try {
      const start = summary.indexOf('{');
      const end = summary.lastIndexOf('}');
      if (start === -1 || end === -1) return null;
      const jsonStr = summary.substring(start, end + 1);
      return JSON.parse(jsonStr) as T;
    } catch {
      return this.parseSummaryRegex<T>(summary);
    }
  }

  private parseSummaryRegex<T>(summary: string): T | null {
    const extractString = (field: string): string | undefined => {
      const jsonMatch = summary.match(new RegExp(`"${field}"\\s*:\\s*"([^"]*)"`, 'i'));
      if (jsonMatch) return jsonMatch[1];
      
      const mdMatch = summary.match(new RegExp(`\\*\\*${field}:\\*\\*\\s*(.+?)(?:\\n|$)`, 'i'));
      if (mdMatch) return mdMatch[1].trim();
      
      return undefined;
    };

    const extractNumber = (field: string): number | undefined => {
      const mdMatch = summary.match(new RegExp(`\\*\\*${field}:\\*\\*\\s*(\\d+)`, 'i'));
      if (mdMatch) return parseInt(mdMatch[1], 10);
      
      const jsonMatch = summary.match(new RegExp(`"${field.toLowerCase()}"\\s*:\\s*(\\d+)`, 'i'));
      if (jsonMatch) return parseInt(jsonMatch[1], 10);
      
      return undefined;
    };

    const result: any = {};
    
    const taskNumber = extractString('task_number');
    if (taskNumber) result.task_number = taskNumber;
    
    const slug = extractString('slug');
    if (slug) result.slug = slug;
    
    const status = extractString('status');
    if (status) result.status = status;
    
    const createdAt = extractString('created_at');
    if (createdAt) result.created_at = createdAt;
    
    const completedAt = extractString('completed_at');
    if (completedAt) result.completed_at = completedAt;
    
    const description = extractString('description');
    if (description) result.description = description;
    
    const commit = extractString('commit');
    if (commit) result.commit = commit;
    
    const number = extractNumber('Number');
    if (number !== undefined) result.number = number;
    
    const name = extractString('name');
    if (name) result.name = name;
    
    const goal = extractString('Goal');
    if (goal) result.goal = goal;
    
    return Object.keys(result).length > 0 ? result as T : null;
  }

  private formatDateTime(isoString?: string): string {
    if (!isoString) return '';
    const date = isoString.split('T')[0] || '';
    const time = isoString.split('T')[1]?.substring(0, 5) || '';
    return time ? `${date} ${time}` : date;
  }

  private getModeDescription(profile: string): string {
    const descriptions: Record<string, string> = {
      quality: 'maximum quality',
      balanced: 'standard planning depth',
      budget: 'fast and economical'
    };
    return descriptions[profile] || profile;
  }

  private getStatusDescription(status: string, hasContext: boolean, chapterNum?: number): string {
    const ctxHint = chapterNum ? ` (Run **/fuska-design ${chapterNum}** to add context)` : '';
    switch (status) {
      case 'plan_complete':
        return hasContext ? 'Planning complete. Context gathered.' : `Planning complete. No context gathered.${ctxHint}`;
      case 'in_progress':
        return 'Execution in progress.';
      case 'planned':
        return 'Planning needed.';
      case 'pending':
        return 'Ready for context gathering.';
      default:
        return status;
    }
  }

  private findState(): StateData | null {
    const stateNode = this.nodes.find(n => 
      n.name === 'state' && n.parent_id === this.currentInitiativeId
    );
    return stateNode ? this.parseSummary<StateData>(stateNode.summary) : null;
  }

  private findRoadmap(): RoadmapData | null {
    const roadmapNode = this.nodes.find(n => 
      (n.name === 'roadmap' || n.name.toLowerCase().includes('roadmap')) && 
      n.parent_id === this.currentInitiativeId
    );
    
    if (roadmapNode) {
      const parsed = this.parseSummary<RoadmapData>(roadmapNode.summary);
      if (parsed?.chapters && parsed.chapters.length > 0) {
        return parsed;
      }
    }
    
    const chapters: ChapterData[] = [];
    const discoveredIds = new Set<string>();
    
    for (const node of this.nodes) {
      if (node.kind !== 'feature') continue;
      
      const belongsToInitiative = node.parent_id === this.currentInitiativeId ||
        node.parent_id?.startsWith(this.currentInitiativeId + '/') ||
        this.edges.some(e => e.from_id === node.id && e.to_id === this.currentInitiativeId && e.relation === 'part_of');
      
      if (!belongsToInitiative) continue;
      
      const isChapter = /^chapter-\d+(-|$|\/)/.test(node.name) && !node.name.includes('-plan-');
      if (!isChapter) continue;
      
      if (discoveredIds.has(node.id)) continue;
      discoveredIds.add(node.id);
      
      const chapterData = this.parseSummary<ChapterData>(node.summary);
      if (chapterData) {
        chapters.push(chapterData);
      } else {
        const numMatch = node.name.match(/chapter-(\d+)/);
        if (numMatch) {
          chapters.push({
            number: parseInt(numMatch[1], 10),
            slug: node.name,
            name: node.name,
            goal: '',
            status: 'planned'
          });
        }
      }
    }
    
    chapters.sort((a, b) => a.number - b.number);
    
    if (chapters.length > 0) {
      return { chapters, current_milestone: '' };
    }
    
    return null;
  }

  private healOrphanedChapters(): string[] {
    const healed: string[] = [];
    
    if (!this.currentInitiativeId) {
      return healed;
    }
    
    for (const node of this.nodes) {
      if (node.kind !== 'feature') continue;
      if (!/^chapter-\d+(-|$|\/)/.test(node.name)) continue;
      if (node.name.includes('-plan-')) continue;
      
      const hasEdgeToInitiative = this.edges.some(e => 
        e.from_id === node.id && e.to_id === this.currentInitiativeId && e.relation === 'part_of'
      );
      
      if (!node.parent_id && !hasEdgeToInitiative) {
        this.db.insertEdge({
          from_id: node.id,
          to_id: this.currentInitiativeId,
          relation: 'part_of'
        });
        
        healed.push(node.name);
      }
    }
    
    return healed;
  }

  private findConfig(): ConfigData | null {
    const configNode = this.nodes.find(n => 
      n.name === 'config' && n.kind === 'config' && !n.parent_id
    );
    return configNode ? this.parseSummary<ConfigData>(configNode.summary) : null;
  }

  private findCurrentInitiativeSlug(): string | null {
    const configNode = this.nodes.find(
      (n) => n.name === 'config' && n.kind === 'config' && !n.parent_id
    );
    if (!configNode) return null;
    try {
      const config = this.parseSummary<ConfigData>(configNode.summary);
      return config?.current_initiative || null;
    } catch {
      return null;
    }
  }

  private findRequirements(): RequirementData[] {
    return this.nodes
      .filter(n => n.name.startsWith('req-') || n.name.startsWith('requirement-'))
      .map(n => this.parseSummary<RequirementData>(n.summary))
      .filter((r): r is RequirementData => r !== null);
  }

  private findProjectName(): string {
    if (this.currentInitiative) {
      return this.currentInitiative;
    }
    const roots = this.nodes.filter(n => n.parent_id === null);
    if (roots.length > 0) {
      return roots[0].name;
    }
    return 'Unknown Project';
  }

  private findProjectDescription(): string {
    const roots = this.nodes.filter(n => n.parent_id === null);
    if (roots.length > 0) {
      const root = roots[0];
      const data = this.parseSummary<any>(root.summary);
      return data?.what_this_is || data?.core_value || data?.description || '';
    }
    return '';
  }

  private findAvailableInitiatives(): string[] {
    return this.nodes
      .filter(n => {
        if (n.parent_id !== null || n.kind !== 'feature') return false;
        const data = this.parseSummary<any>(n.summary);
        if (data?.archived_at) return false;
        const hasState = this.nodes.some(child => child.name === 'state' && child.kind === 'config' && child.parent_id === n.id);
        return hasState;
      })
      .map(n => n.name);
  }

  private findChapterData(chapterSlug: string): ChapterData | null {
    const roadmapNode = this.nodes.find(n =>
      n.name === 'roadmap' && n.parent_id === this.currentInitiativeId
    );
    if (!roadmapNode) return null;

    const chapterNode = this.nodes.find(n =>
      n.name === chapterSlug && n.parent_id === roadmapNode.id
    );
    return chapterNode ? this.parseSummary<ChapterData>(chapterNode.summary) : null;
  }

  private findChapterContext(chapterSlug: string): ChapterContextData | null {
    const contextNode = this.nodes.find(n => n.name === `${chapterSlug}-context`);
    return contextNode ? this.parseSummary<ChapterContextData>(contextNode.summary) : null;
  }

  private findChapterPlans(chapterSlug: string): Array<{ name: string; data: PlanData }> {
    return this.nodes
      .filter(n => n.name.startsWith(chapterSlug) && n.name.includes('-plan-'))
      .map(n => {
        const data = this.parseSummary<PlanData>(n.summary);
        return data ? { name: n.name, data } : null;
      })
      .filter((p): p is { name: string; data: PlanData } => p !== null)
      .sort((a, b) => (a.data.batch || 0) - (b.data.batch || 0));
  }

  private findChapterSummaries(chapterSlug: string): Array<{ name: string; data: SummaryData }> {
    return this.nodes
      .filter(n => n.name.startsWith(chapterSlug) && n.name.includes('-summary'))
      .map(n => {
        const data = this.parseSummary<SummaryData>(n.summary);
        return data ? { name: n.name, data } : null;
      })
      .filter((s): s is { name: string; data: SummaryData } => s !== null);
  }

  private findChapterVerification(chapterSlug: string): VerificationData | null {
    const verificationNode = this.nodes.find(n => n.name === `${chapterSlug}-verification`);
    return verificationNode ? this.parseSummary<VerificationData>(verificationNode.summary) : null;
  }

  private findRecentSummaries(limit: number = 3): Array<{ name: string; data: SummaryData }> {
    const belongsToInitiative = (nodeId: string): boolean => {
      let currentId: string | null = nodeId;
      let depth = 0;
      while (currentId && depth < 20) {
        const node = this.nodeMap.get(currentId);
        if (!node) break;
        if (node.parent_id === this.currentInitiativeId) return true;
        if (node.id === this.currentInitiativeId) return true;
        currentId = node.parent_id;
        depth++;
      }
      return false;
    };

    return this.nodes
      .filter(n => n.name.includes('-summary') && belongsToInitiative(n.id))
      .map(n => {
        const data = this.parseSummary<SummaryData>(n.summary);
        return data ? { name: n.name, data } : null;
      })
      .filter((s): s is { name: string; data: SummaryData } => s !== null)
      .sort((a, b) => {
        const dateA = new Date(a.data.completed || 0).getTime();
        const dateB = new Date(b.data.completed || 0).getTime();
        return dateB - dateA;
      })
      .slice(0, limit);
  }

  private getPendingTodos(): Array<{ name: string; description: string }> {
    const belongsToInitiative = (nodeId: string): boolean => {
      let currentId: string | null = nodeId;
      let depth = 0;
      while (currentId && depth < 20) {
        const node = this.nodeMap.get(currentId);
        if (!node) break;
        if (node.parent_id === this.currentInitiativeId) return true;
        if (node.id === this.currentInitiativeId) return true;
        currentId = node.parent_id;
        depth++;
      }
      return false;
    };

    return this.nodes
      .filter(n => n.name.startsWith('todo-') && belongsToInitiative(n.id))
      .map(n => {
        const data = this.parseSummary<{ status: string; description?: string }>(n.summary);
        return {
          name: n.name,
          description: data?.description || n.name.replace('todo-', '').replace(/-/g, ' ')
        };
      })
      .filter(todo => {
        const data = this.parseSummary<{ status: string }>(
          this.nodes.find(n => n.name === todo.name)?.summary || ''
        );
        return data?.status === 'pending' || !data?.status;
      });
  }

  private getActiveDebugSessions(): Array<{ name: string }> {
    const belongsToInitiative = (nodeId: string): boolean => {
      let currentId: string | null = nodeId;
      let depth = 0;
      while (currentId && depth < 20) {
        const node = this.nodeMap.get(currentId);
        if (!node) break;
        if (node.parent_id === this.currentInitiativeId) return true;
        if (node.id === this.currentInitiativeId) return true;
        currentId = node.parent_id;
        depth++;
      }
      return false;
    };

    return this.nodes
      .filter(n => n.name.includes('debug-session') && belongsToInitiative(n.id))
      .filter(n => {
        const data = this.parseSummary<{ status: string }>(n.summary);
        return data?.status !== 'resolved' && data?.status !== 'closed';
      })
      .map(n => ({ name: n.name }));
  }

  private getAllTaskConcepts(): { pending: Array<{ name: string; data: TaskData }>; done: Array<{ name: string; data: TaskData }>; unknown: Array<{ name: string; slug: string }> } {
    const tasks: Array<{ name: string; data: TaskData }> = [];
    const unknown: Array<{ name: string; slug: string }> = [];
    
    this.nodes
      .filter(n => {
        if (!n.name.match(/^task-\d+-/) || n.parent_id !== null) return false;
        if (n.name.endsWith('-research') || n.name.endsWith('-summary') || n.name.endsWith('-verification')) return false;
        return true;
      })
      .forEach(n => {
        const data = this.parseSummary<TaskData>(n.summary);
        if (!data) {
          const slug = n.name.replace(/^task-\d+-/, '');
          unknown.push({ name: n.name, slug });
          return;
        }
        if (!data.task_number) {
          const slug = data.slug || n.name.replace(/^task-\d+-/, '');
          unknown.push({ name: n.name, slug });
          return;
        }
        tasks.push({ name: n.name, data });
      });

    tasks.sort((a, b) => {
      const dateA = new Date(a.data.created_at || 0).getTime();
      const dateB = new Date(b.data.created_at || 0).getTime();
      return dateB - dateA;
    });

    return {
      done: tasks.filter(t =>
        t.data.status === 'complete'
      ),
      pending: tasks.filter(t =>
        t.data.status !== 'complete'
      ),
      unknown
    };
  }

  private buildStructuredContext(state: StateData, roadmap: RoadmapData): StructuredContext {
    const currentChapterSlug = state.current_chapter;
    const currentChapter = currentChapterSlug ? this.findChapterData(currentChapterSlug) : null;
    const taskConcepts = this.getAllTaskConcepts();

    return {
      projectName: this.findProjectName(),
      state,
      roadmap,
      config: this.findConfig(),
      requirements: this.findRequirements(),
      currentChapter,
      chapterContext: currentChapterSlug ? this.findChapterContext(currentChapterSlug) : null,
      chapterPlans: currentChapterSlug ? this.findChapterPlans(currentChapterSlug) : [],
      chapterSummaries: currentChapterSlug ? this.findChapterSummaries(currentChapterSlug) : [],
      chapterVerification: currentChapterSlug ? this.findChapterVerification(currentChapterSlug) : null,
      recentSummaries: this.findRecentSummaries(3),
      pendingTodos: this.getPendingTodos(),
      activeDebugSessions: this.getActiveDebugSessions(),
      pendingTaskConcepts: taskConcepts.pending,
      doneTaskConcepts: taskConcepts.done,
      unknownTaskConcepts: taskConcepts.unknown
    };
  }

  private buildAdHocContext(): AdHocContext {
    const tasks: Array<{ name: string; data: TaskData }> = [];
    const unknown: Array<{ name: string; slug: string }> = [];
    
    this.nodes
      .filter(n => {
        if (!n.name.match(/^task-\d+-/) || n.parent_id !== null) return false;
        if (n.name.endsWith('-research') || n.name.endsWith('-summary') || n.name.endsWith('-verification')) return false;
        return true;
      })
      .forEach(n => {
        const data = this.parseSummary<TaskData>(n.summary);
        if (!data) {
          const slug = n.name.replace(/^task-\d+-/, '');
          unknown.push({ name: n.name, slug });
          return;
        }
        if (!data.task_number) {
          const slug = data.slug || n.name.replace(/^task-\d+-/, '');
          unknown.push({ name: n.name, slug });
          return;
        }
        tasks.push({ name: n.name, data });
      });

    tasks.sort((a, b) => {
      const dateA = new Date(a.data.created_at || 0).getTime();
      const dateB = new Date(b.data.created_at || 0).getTime();
      return dateB - dateA;
    });

    const taskConcepts = tasks.filter(t =>
      t.data.status === 'complete'
    );
    const pendingTaskConcepts = tasks.filter(t =>
      t.data.status !== 'complete'
    );

    return {
      projectName: this.findProjectName(),
      projectDescription: this.findProjectDescription(),
      config: this.findConfig(),
      taskConcepts,
      pendingTaskConcepts,
      unknownTaskConcepts: unknown,
      availableInitiatives: this.findAvailableInitiatives()
    };
  }

  private determineNextAction(ctx: StructuredContext): NextAction {
    const chapterSlug = ctx.state?.current_chapter;
    const chapterNum = chapterSlug ? parseInt(chapterSlug.replace('chapter-', '')) : 0;

    if (ctx.chapterVerification?.status === 'diagnosed' && ctx.chapterVerification.issues && ctx.chapterVerification.issues.length > 0) {
      return { route: 'issues', chapterNumber: chapterNum };
    }

    const totalPlans = ctx.chapterPlans.length;
    const completedSummaries = ctx.chapterSummaries.length;

    if (totalPlans > 0 && completedSummaries < totalPlans) {
      const executedPlanNames = new Set(ctx.chapterSummaries.map(s => {
        const match = s.name.match(/(.+)-summary/);
        return match ? match[1] : s.name;
      }));

      const nextPlan = ctx.chapterPlans.find(p => {
        const planBase = p.name;
        return !executedPlanNames.has(planBase) && !ctx.chapterSummaries.some(s => s.name.includes(p.name));
      });

      if (nextPlan) {
        return {
          route: 'execute',
          chapterNumber: chapterNum,
          planName: nextPlan.name,
          objective: nextPlan.data.objective
        };
      }
    }

    if (totalPlans > 0 && completedSummaries >= totalPlans) {
      const currentMilestone = ctx.roadmap?.current_milestone;
      const milestoneChapters = ctx.roadmap?.chapters.filter(c => c.milestone === currentMilestone) || [];
      const maxChapterNum = milestoneChapters.length > 0
        ? Math.max(...milestoneChapters.map(c => c.number))
        : (ctx.roadmap?.chapters.length || 0);

      if (chapterNum < maxChapterNum) {
        const nextChapter = ctx.roadmap?.chapters.find(c => c.number === chapterNum + 1);
        return {
          route: 'next-chapter',
          chapterNumber: chapterNum + 1,
          objective: nextChapter?.goal
        };
      }

      return { route: 'complete-milestone' };
    }

    if (totalPlans === 0) {
      if (ctx.chapterContext) {
        return { route: 'plan', chapterNumber: chapterNum };
      }
      return { route: 'discuss', chapterNumber: chapterNum };
    }

    return { route: 'plan', chapterNumber: chapterNum };
  }

  private out(text: string): void {
    console.log(markdownToAnsi(text));
  }

  private renderStructuredReport(ctx: StructuredContext, nextAction: NextAction): void {
    const projectName = ctx.projectName;
    const profile = ctx.config?.model_profile || ctx.config?.depth || 'balanced';
    const modeDesc = this.getModeDescription(profile);

    this.out(`Initiative **${projectName}** using ${modeDesc} (${profile}) mode`);
    this.out('');

    this.out('Done:');
    if (ctx.recentSummaries.length > 0) {
      for (const s of ctx.recentSummaries) {
        const acc = s.data.accomplishments?.[0] || 'No summary';
        const chapterNum = parseInt(s.data.chapter?.replace('chapter-', '') || '0') || '?';
        const planMatch = s.data.plan?.match(/-plan-(\d+)/);
        const planNum = planMatch ? planMatch[1] : '?';
        this.out(`* Chapter ${chapterNum}.${parseInt(planNum)}: ${acc}`);
      }
    } else {
      this.out('* (none)');
    }
    this.out('');

    this.out('Future:');
    if (ctx.roadmap?.chapters) {
      const futureChapters = ctx.roadmap.chapters
        .filter(c => {
          const status = (c.status || '').toLowerCase();
          return status !== 'complete' && status !== 'completed';
        })
        .sort((a, b) => a.number - b.number);

      for (const chapter of futureChapters) {
        const display = chapter.goal || chapter.name || '(no description)';
        this.out(`* Chapter ${chapter.number}: ${display}`);
      }
      if (futureChapters.length === 0) {
        this.out('* (no more chapters)');
      }
    }
    this.out('');

    this.out('Next:');
    let nextChapter = ctx.currentChapter;
    let nextChapterSummaries = ctx.chapterSummaries;
    let nextChapterPlans = ctx.chapterPlans;
    let nextChapterContext = ctx.chapterContext;
    let isFallback = false;
    
    if (!nextChapter && ctx.roadmap?.chapters) {
      const incompleteChapters = ctx.roadmap.chapters
        .filter(c => {
          const status = (c.status || '').toLowerCase();
          return status !== 'complete' && status !== 'completed';
        })
        .sort((a, b) => a.number - b.number);
      
      nextChapter = incompleteChapters[0];
      isFallback = true;
      
      if (nextChapter) {
        const fallbackSlug = nextChapter.slug || `chapter-${nextChapter.number}`;
        nextChapterSummaries = this.findChapterSummaries(fallbackSlug);
        nextChapterPlans = this.findChapterPlans(fallbackSlug);
        nextChapterContext = this.findChapterContext(fallbackSlug);
      }
    }
    
    if (nextChapter) {
      const planLabel = !isFallback && nextChapterPlans.length > 0 
        ? `.${nextChapterSummaries.length + 1}` 
        : '';
      const display = nextChapter.goal || nextChapter.name || '(no description)';
      this.out(`* Chapter ${nextChapter.number}${planLabel}: ${display}`);
      
      let effectiveStatus: string;
      const hasContext = !!nextChapterContext;
      
      if (nextChapterSummaries.length > 0) {
        effectiveStatus = 'in_progress';
      } else if (nextChapterPlans.length > 0) {
        effectiveStatus = 'planned';
      } else if (hasContext) {
        effectiveStatus = 'plan_complete';
      } else {
        effectiveStatus = 'pending';
      }
      
      const statusDesc = this.getStatusDescription(effectiveStatus, hasContext, nextChapter.number);
      this.out(`  ${statusDesc}`);
    } else {
      this.out('* (all chapters complete)');
    }
    this.out('');

    if (ctx.pendingTodos.length > 0) {
      this.out('Pending TODOs:');
      for (const todo of ctx.pendingTodos) {
        this.out(`* ${todo.description}`);
      }
      this.out('');
    }

    if (ctx.activeDebugSessions.length > 0) {
      this.out('Active Debug Sessions:');
      for (const session of ctx.activeDebugSessions) {
        this.out(`* ${session.name} — /fuska-debug to continue`);
      }
      this.out('');
    }

    if (ctx.pendingTaskConcepts.length > 0) {
      this.out('Pending ad-hoc tasks:');
      for (const t of ctx.pendingTaskConcepts) {
        const num = t.data.task_number || '?';
        const slug = t.data.slug || t.name.replace(/^task-\d+-/, '');
        const dateTime = this.formatDateTime(t.data.created_at);
        this.out(`* ${num}: ${slug} (${dateTime})`);
      }
      this.out('');
    }

    if (ctx.doneTaskConcepts.length > 0) {
      this.out('Completed ad-hoc tasks:');
      for (const t of ctx.doneTaskConcepts) {
        const num = t.data.task_number || '?';
        const slug = t.data.slug || t.name.replace(/^task-\d+-/, '');
        const dateTime = this.formatDateTime(t.data.completed_at || t.data.created_at);
        this.out(`* ${num}: ${slug} (${dateTime})`);
      }
      this.out('');
    }

    if (ctx.unknownTaskConcepts.length > 0) {
      this.out('Unknown tasks (missing task_number):');
      for (const t of ctx.unknownTaskConcepts) {
        this.out(`* ${t.slug}`);
      }
      this.out('');
    }

    this.renderActions(nextAction, ctx);
  }

  private renderActions(action: NextAction, ctx: StructuredContext): void {
    const chapterNum = action.chapterNumber || ctx.currentChapter?.number || 1;
    const status = ctx.state?.status || '';

    switch (action.route) {
      case 'execute':
        this.out(`Run **/fuska-build ${chapterNum}** to continue`);
        break;

      case 'plan':
      case 'discuss':
        if (status === 'plan_complete') {
          this.out(`Run **/fuska-build ${chapterNum}** to continue`);
        } else {
          this.out(`Run **/fuska-plan ${chapterNum}** to continue`);
        }
        break;

      case 'issues':
        this.out(`Run **/fuska-plan ${chapterNum} --fixes** to fix verification issues`);
        break;

      case 'next-chapter':
        if (status === 'plan_complete') {
          this.out(`Run **/fuska-build ${action.chapterNumber}** to continue`);
        } else {
          this.out(`Run **/fuska-plan ${action.chapterNumber}** to continue`);
        }
        break;

      case 'complete-milestone':
        this.out(`Run **/fuska-complete-milestone** to continue`);
        break;
    }
  }

  private renderAdHocReport(ctx: AdHocContext): void {
    const profile = ctx.config?.model_profile || ctx.config?.depth || 'balanced';
    const modeDesc = this.getModeDescription(profile);

    this.out(`Working in ${modeDesc} (${profile}) mode`);
    this.out('');

    this.out('No initiative active. Run **fuska initiative switch** to activate. Available:');
    for (const slug of ctx.availableInitiatives) {
      this.out(`* ${slug}`);
    }
    this.out('');

    if (ctx.pendingTaskConcepts.length > 0) {
      this.out('Pending ad-hoc tasks:');
      for (const t of ctx.pendingTaskConcepts) {
        const num = t.data.task_number || '?';
        const slug = t.data.slug || t.name.replace(/^task-\d+-/, '');
        const dateTime = this.formatDateTime(t.data.created_at);
        this.out(`* ${num}: ${slug} (${dateTime})`);
      }
      this.out('');
    }

    if (ctx.taskConcepts.length > 0) {
      this.out('Completed ad-hoc tasks:');
      for (const t of ctx.taskConcepts) {
        const num = t.data.task_number || '?';
        const slug = t.data.slug || t.name.replace(/^task-\d+-/, '');
        const dateTime = this.formatDateTime(t.data.completed_at || t.data.created_at);
        this.out(`* ${num}: ${slug} (${dateTime})`);
      }
      this.out('');
    }

    if (ctx.unknownTaskConcepts.length > 0) {
      this.out('Unknown tasks (missing task_number):');
      for (const t of ctx.unknownTaskConcepts) {
        this.out(`* ${t.slug}`);
      }
      this.out('');
    }

    this.out('Available commands:');
    this.out('**fuska initiative switch** — switch to an initiative');
    this.out('**fuska do** — execute a standalone task');
    this.out('**fuska info** — view codebase and domain mappings');
  }

  private buildStructuredJson(ctx: StructuredContext, nextAction: NextAction): JsonOutput {
    const completedChapters = ctx.roadmap?.chapters.filter(c => c.status === 'complete').length || 0;
    const totalChapters = ctx.roadmap?.chapters.length || 0;

    return {
      mode: 'structured',
      projectName: ctx.projectName,
      progress: {
        completed: completedChapters,
        total: totalChapters,
        percentage: totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0
      },
      currentChapter: ctx.currentChapter,
      status: ctx.state?.status || 'unknown',
      nextAction,
      recentWork: ctx.recentSummaries.map(s => ({
        chapter: s.data.chapter,
        plan: s.data.plan,
        accomplishment: s.data.accomplishments?.[0] || ''
      })),
      pendingTodos: ctx.pendingTodos.length,
      activeDebugSessions: ctx.activeDebugSessions.length
    };
  }

  private buildAdHocJson(ctx: AdHocContext): JsonOutput {
    return {
      mode: 'ad-hoc',
      projectName: ctx.projectName,
      status: 'no-initiative',
      availableInitiatives: ctx.availableInitiatives,
      recentWork: ctx.taskConcepts.map(t => ({
        chapter: '',
        plan: t.name,
        accomplishment: t.data.description || ''
      }))
    };
  }

  private outputJson(data: JsonOutput): void {
    console.log(JSON.stringify(data, null, 2));
  }
}

export function progressCommand(program: Command) {
  program
    .command('progress')
    .description('Check project progress and show next action')
    .option('--json', 'Output machine-readable JSON')
    .action(async (options: { json?: boolean }) => {
      const runner = new ProgressRunner({
        projectDir: process.cwd()
      });
      await runner.run(options.json || false);
    });
}
