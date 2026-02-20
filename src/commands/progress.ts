import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import { markdownToAnsi } from './utils/markdown-to-ansi';
import { getCurrentInitiativeSlug } from './utils/initiative-utils';

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
  current_phase: string;
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

interface PhaseData {
  number: number;
  slug: string;
  name: string;
  goal: string;
  status: string;
  milestone?: string;
}

interface RoadmapData {
  phases: PhaseData[];
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
  wave?: number;
}

interface SummaryData {
  phase: string;
  plan: string;
  accomplishments: string[];
  completed?: string;
}

interface UATData {
  status: string;
  gaps?: string[];
}

interface PhaseContextData {
  status: string;
  decisions: Record<string, any>;
}

interface TaskData {
  description?: string;
  summary?: string;
  completed?: string;
  timestamp?: string;
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
  currentPhase: PhaseData | null;
  phaseContext: PhaseContextData | null;
  phasePlans: Array<{ name: string; data: PlanData }>;
  phaseSummaries: Array<{ name: string; data: SummaryData }>;
  phaseUat: UATData | null;
  recentSummaries: Array<{ name: string; data: SummaryData }>;
  pendingTodos: TodoItem[];
  activeDebugSessions: DebugSession[];
}

interface AdHocContext {
  projectName: string;
  projectDescription: string;
  config: ConfigData | null;
  taskConcepts: Array<{ name: string; data: TaskData }>;
}

interface NextAction {
  route: 'execute' | 'plan' | 'discuss' | 'gaps' | 'complete-milestone' | 'next-phase';
  phaseNumber?: number;
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
  currentPhase?: PhaseData | null;
  status?: string;
  nextAction?: NextAction;
  recentWork?: Array<{ phase: string; plan: string; accomplishment: string }>;
  pendingTodos?: number;
  activeDebugSessions?: number;
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

    const currentSlug = getCurrentInitiativeSlug(this.db);

    if (!currentSlug) {
      console.log('No active initiative. Use /fuska-initiative-switch');
      return;
    }

    this.currentInitiative = currentSlug;
    
    const root = this.nodes.find(n => n.name === currentSlug && n.parent_id === null);
    this.currentInitiativeId = root?.id || null;
    
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
      return JSON.parse(summary.substring(start, end + 1)) as T;
    } catch {
      return null;
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
      n.name === 'roadmap' && n.parent_id === this.currentInitiativeId
    );
    return roadmapNode ? this.parseSummary<RoadmapData>(roadmapNode.summary) : null;
  }

  private findConfig(): ConfigData | null {
    const configNode = this.nodes.find(n => 
      n.name === 'config' && n.parent_id === this.currentInitiativeId
    );
    return configNode ? this.parseSummary<ConfigData>(configNode.summary) : null;
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

  private findPhaseData(phaseSlug: string): PhaseData | null {
    const roadmapNode = this.nodes.find(n => 
      n.name === 'roadmap' && n.parent_id === this.currentInitiativeId
    );
    if (!roadmapNode) return null;
    
    const phaseNode = this.nodes.find(n => 
      n.name === phaseSlug && n.parent_id === roadmapNode.id
    );
    return phaseNode ? this.parseSummary<PhaseData>(phaseNode.summary) : null;
  }

  private findPhaseContext(phaseSlug: string): PhaseContextData | null {
    const contextNode = this.nodes.find(n => n.name === `${phaseSlug}-context`);
    return contextNode ? this.parseSummary<PhaseContextData>(contextNode.summary) : null;
  }

  private findPhasePlans(phaseSlug: string): Array<{ name: string; data: PlanData }> {
    return this.nodes
      .filter(n => n.name.startsWith(phaseSlug) && n.name.includes('-plan-'))
      .map(n => {
        const data = this.parseSummary<PlanData>(n.summary);
        return data ? { name: n.name, data } : null;
      })
      .filter((p): p is { name: string; data: PlanData } => p !== null)
      .sort((a, b) => (a.data.wave || 0) - (b.data.wave || 0));
  }

  private findPhaseSummaries(phaseSlug: string): Array<{ name: string; data: SummaryData }> {
    return this.nodes
      .filter(n => n.name.startsWith(phaseSlug) && n.name.includes('-summary'))
      .map(n => {
        const data = this.parseSummary<SummaryData>(n.summary);
        return data ? { name: n.name, data } : null;
      })
      .filter((s): s is { name: string; data: SummaryData } => s !== null);
  }

  private findPhaseUat(phaseSlug: string): UATData | null {
    const uatNode = this.nodes.find(n => n.name === `${phaseSlug}-uat`);
    return uatNode ? this.parseSummary<UATData>(uatNode.summary) : null;
  }

  private findRecentSummaries(limit: number = 3): Array<{ name: string; data: SummaryData }> {
    return this.nodes
      .filter(n => n.name.includes('-summary'))
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
    return this.nodes
      .filter(n => n.name.startsWith('todo-'))
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
    return this.nodes
      .filter(n => n.name.includes('debug-session'))
      .filter(n => {
        const data = this.parseSummary<{ status: string }>(n.summary);
        return data?.status !== 'resolved' && data?.status !== 'closed';
      })
      .map(n => ({ name: n.name }));
  }

  private buildStructuredContext(state: StateData, roadmap: RoadmapData): StructuredContext {
    const currentPhaseSlug = state.current_phase;
    const currentPhase = currentPhaseSlug ? this.findPhaseData(currentPhaseSlug) : null;
    
    return {
      projectName: this.findProjectName(),
      state,
      roadmap,
      config: this.findConfig(),
      requirements: this.findRequirements(),
      currentPhase,
      phaseContext: currentPhaseSlug ? this.findPhaseContext(currentPhaseSlug) : null,
      phasePlans: currentPhaseSlug ? this.findPhasePlans(currentPhaseSlug) : [],
      phaseSummaries: currentPhaseSlug ? this.findPhaseSummaries(currentPhaseSlug) : [],
      phaseUat: currentPhaseSlug ? this.findPhaseUat(currentPhaseSlug) : null,
      recentSummaries: this.findRecentSummaries(3),
      pendingTodos: this.getPendingTodos(),
      activeDebugSessions: this.getActiveDebugSessions()
    };
  }

  private buildAdHocContext(): AdHocContext {
    const taskMap = new Map<string, { name: string; data: TaskData }>();
    
    this.nodes
      .filter(n => n.name.match(/^task-\d+-/))
      .forEach(n => {
        const numMatch = n.name.match(/^task-(\d+)-/);
        if (!numMatch) return;
        
        const num = numMatch[1];
        const data = this.parseSummary<TaskData>(n.summary);
        if (!data) return;
        
        const existing = taskMap.get(num);
        if (!existing || (data.description && !existing.data.description)) {
          taskMap.set(num, { name: n.name, data });
        } else if (existing && data.commit && !existing.data.commit) {
          existing.data.commit = data.commit;
        }
      });

    const taskConcepts = Array.from(taskMap.entries())
      .map(([_, task]) => task)
      .sort((a, b) => {
        const numA = parseInt(a.name.match(/^task-(\d+)/)?.[1] || '0');
        const numB = parseInt(b.name.match(/^task-(\d+)/)?.[1] || '0');
        return numA - numB;
      });

    return {
      projectName: this.findProjectName(),
      projectDescription: this.findProjectDescription(),
      config: this.findConfig(),
      taskConcepts
    };
  }

  private determineNextAction(ctx: StructuredContext): NextAction {
    const phaseSlug = ctx.state?.current_phase;
    const phaseNum = phaseSlug ? parseInt(phaseSlug.replace('phase-', '')) : 0;
    
    if (ctx.phaseUat?.status === 'diagnosed' && ctx.phaseUat.gaps && ctx.phaseUat.gaps.length > 0) {
      return { route: 'gaps', phaseNumber: phaseNum };
    }
    
    const totalPlans = ctx.phasePlans.length;
    const completedSummaries = ctx.phaseSummaries.length;
    
    if (totalPlans > 0 && completedSummaries < totalPlans) {
      const executedPlanNames = new Set(ctx.phaseSummaries.map(s => {
        const match = s.name.match(/(.+)-summary/);
        return match ? match[1] : s.name;
      }));
      
      const nextPlan = ctx.phasePlans.find(p => {
        const planBase = p.name;
        return !executedPlanNames.has(planBase) && !ctx.phaseSummaries.some(s => s.name.includes(p.name));
      });
      
      if (nextPlan) {
        return {
          route: 'execute',
          phaseNumber: phaseNum,
          planName: nextPlan.name,
          objective: nextPlan.data.objective
        };
      }
    }
    
    if (totalPlans > 0 && completedSummaries >= totalPlans) {
      const currentMilestone = ctx.roadmap?.current_milestone;
      const milestonePhases = ctx.roadmap?.phases.filter(p => p.milestone === currentMilestone) || [];
      const maxPhaseNum = milestonePhases.length > 0 
        ? Math.max(...milestonePhases.map(p => p.number))
        : (ctx.roadmap?.phases.length || 0);
      
      if (phaseNum < maxPhaseNum) {
        const nextPhase = ctx.roadmap?.phases.find(p => p.number === phaseNum + 1);
        return {
          route: 'next-phase',
          phaseNumber: phaseNum + 1,
          objective: nextPhase?.goal
        };
      }
      
      return { route: 'complete-milestone' };
    }
    
    if (totalPlans === 0) {
      if (ctx.phaseContext) {
        return { route: 'plan', phaseNumber: phaseNum };
      }
      return { route: 'discuss', phaseNumber: phaseNum };
    }
    
    return { route: 'plan', phaseNumber: phaseNum };
  }

  private out(text: string): void {
    console.log(markdownToAnsi(text));
  }

  private renderStructuredReport(ctx: StructuredContext, nextAction: NextAction): void {
    const completedPhases = ctx.roadmap?.phases.filter(p => p.status === 'complete').length || 0;
    const totalPhases = ctx.roadmap?.phases.length || 0;
    const projectName = ctx.projectName;

    this.out(`Progress on ${projectName}, ${completedPhases}/${totalPhases} phases complete.`);
    this.out('');

    this.out('Done:');
    if (ctx.recentSummaries.length > 0) {
      for (const s of ctx.recentSummaries) {
        const acc = s.data.accomplishments?.[0] || 'No summary';
        const phaseNum = s.data.phase?.replace('phase-', '') || '?';
        this.out(`* Phase ${phaseNum}: ${acc}`);
      }
    } else {
      this.out('* (none)');
    }
    this.out('');

    this.out('Next:');
    if (ctx.currentPhase) {
      this.out(`* Phase ${ctx.currentPhase.number}: ${ctx.currentPhase.goal}`);
      this.out(`  - Status: ${ctx.state?.status || 'unknown'}`);
      this.out(`  - Context: ${ctx.phaseContext ? 'OK' : '-'}`);
    }
    this.out('');

    this.out('Future:');
    if (ctx.roadmap?.phases) {
      const currentNum = ctx.currentPhase?.number || 0;
      const futurePhases = ctx.roadmap.phases
        .filter(p => p.number > currentNum)
        .sort((a, b) => a.number - b.number);

      for (const phase of futurePhases) {
        this.out(`* Phase ${phase.number}: ${phase.goal}`);
      }
      if (futurePhases.length === 0) {
        this.out('* (no more phases)');
      }
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

    this.out('Configuration:');
    this.out(`* Profile: ${ctx.config?.model_profile || ctx.config?.depth || 'balanced'}`);
    this.out('');

    this.out('---------');
    this.out('');

    this.renderActions(nextAction, ctx);
  }

  private renderActions(action: NextAction, ctx: StructuredContext): void {
    const phaseNum = action.phaseNumber || ctx.currentPhase?.number || 1;

    switch (action.route) {
      case 'execute':
        this.out(`Execute plan ${action.planName} by running:`);
        this.out(`* /fuska-build-phase ${phaseNum}`);
        break;

      case 'plan':
        this.out(`Plan phase ${phaseNum} by running:`);
        this.out(`* /fuska-plan-phase ${phaseNum}`);
        break;

      case 'discuss':
        this.out(`Gather context for phase ${phaseNum} and clarify approach by running:`);
        this.out(`* /fuska-design-phase ${phaseNum}`);
        this.out('');
        this.out(`or skip design of phase ${phaseNum} and plan directly by running:`);
        this.out(`* /fuska-plan-phase ${phaseNum}`);
        break;

      case 'gaps':
        this.out(`Fix UAT gaps in phase ${phaseNum} by running:`);
        this.out(`* /fuska-plan-phase ${phaseNum} --gaps`);
        break;

      case 'next-phase':
        this.out(`Start phase ${action.phaseNumber} by running:`);
        this.out(`* /fuska-design-phase ${action.phaseNumber}`);
        this.out('');
        this.out(`or skip design and plan directly by running:`);
        this.out(`* /fuska-plan-phase ${action.phaseNumber}`);
        break;

      case 'complete-milestone':
        this.out(`Archive and prepare for next milestone by running:`);
        this.out(`* /fuska-complete-milestone`);
        break;
    }
  }

  private renderAdHocReport(ctx: AdHocContext): void {
    const desc = ctx.projectDescription ? ` (${ctx.projectDescription})` : '';
    this.out(`Progress on ${ctx.projectName}${desc}, ad-hoc mode (no phases).`);
    this.out('');

    if (ctx.taskConcepts.length > 0) {
      this.out('Done:');
      for (const t of ctx.taskConcepts) {
        const numMatch = t.name.match(/task-(\d+)/);
        const num = numMatch ? numMatch[1] : '?';
        const taskDesc = (t.data.description || t.data.summary || 'No description').slice(0, 60);
        this.out(`* Task ${num}: ${taskDesc}`);
      }
      this.out('');
    }

    this.out('Configuration:');
    this.out(`* Profile: ${ctx.config?.depth || 'balanced'}`);
    this.out('');

    this.out('---------');
    this.out('');

    this.out('Available commands:');
    this.out('* /fuska-do — execute a standalone task');
    this.out('* fuska info — view codebase and domain mappings');
  }

  private buildStructuredJson(ctx: StructuredContext, nextAction: NextAction): JsonOutput {
    const completedPhases = ctx.roadmap?.phases.filter(p => p.status === 'complete').length || 0;
    const totalPhases = ctx.roadmap?.phases.length || 0;
    
    return {
      mode: 'structured',
      projectName: ctx.projectName,
      progress: {
        completed: completedPhases,
        total: totalPhases,
        percentage: totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0
      },
      currentPhase: ctx.currentPhase,
      status: ctx.state?.status || 'unknown',
      nextAction,
      recentWork: ctx.recentSummaries.map(s => ({
        phase: s.data.phase,
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
      status: 'ad-hoc',
      recentWork: ctx.taskConcepts.map(t => ({
        phase: '',
        plan: t.name,
        accomplishment: t.data.description || t.data.summary || ''
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
