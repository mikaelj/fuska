import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import {
  findAllInitiatives,
  InitiativeInfo,
  NodeData,
} from './utils/initiative-utils';

interface InitiativeNode {
  id: string;
  name: string;
  kind: string;
  summary: string;
  children?: string[];
  parent_id?: string | null;
  updated_at?: string;
}

interface PhaseData {
  number: number;
  slug: string;
  name: string;
  goal: string;
  status: string;
}

interface RoadmapData {
  phases: PhaseData[];
}

class InitiativesRunner {
  private projectDir: string;
  private db: any;

  constructor(options: { projectDir: string }) {
    this.projectDir = options.projectDir;
  }

  async run(): Promise<void> {
    await this.preflightCheck();
    await this.displayInitiatives();
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

  private async displayInitiatives(): Promise<void> {
    const nodes: InitiativeNode[] = this.db.getAllActiveNodes();

    const initiatives = findAllInitiatives(this.db);

    if (initiatives.length === 0) {
      console.log('No initiatives found in MegaMemory.');
      console.log('');
      console.log('To create a new initiative, run:');
      console.log('  /fuska-new-initiative <initiative-name>');
      return;
    }

    const withActivity = initiatives.map(initiative => {
      const stateNode = nodes.find(n =>
        n.name === 'state' && n.kind === 'config' &&
        n.parent_id === initiative.node.id
      );
      const updatedAt = stateNode?.updated_at || (initiative.node as any).updated_at || null;
      return { initiative, updatedAt };
    });

    withActivity.sort((a, b) => {
      if (!a.updatedAt && !b.updatedAt) return 0;
      if (!a.updatedAt) return 1;
      if (!b.updatedAt) return -1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    console.log('Fuska Initiatives');
    console.log('');

    for (let i = 0; i < withActivity.length; i++) {
      const { initiative, updatedAt } = withActivity[i];
      const isLast = i === withActivity.length - 1;

      const initiativeNode = nodes.find(n => n.id === initiative.node.id);
      if (initiativeNode) {
        this.displayInitiativeTree(initiativeNode, nodes, '', isLast, initiative.isCurrent, updatedAt);
      }
    }
  }

  private displayInitiativeTree(
    initiative: InitiativeNode,
    nodes: InitiativeNode[],
    prefix: string,
    isLast: boolean,
    isCurrent: boolean = false,
    updatedAt: string | null = null
  ): void {
    const connector = isLast ? '└─' : '├─';
    const initiativeName = this.getInitiativeDisplayName(initiative, isCurrent);
    const timeAgo = updatedAt ? this.formatRelativeTime(updatedAt) : '';
    const padding = timeAgo ? '  ' : '';

    console.log(`${prefix}${connector} ${initiativeName}${padding}${timeAgo}`);

    const newPrefix = prefix + (isLast ? '  ' : '│ ');

    const phases = this.findPhasesForInitiative(initiative.id, nodes);
    if (phases.length > 0) {
      for (let i = 0; i < phases.length; i++) {
        const phase = phases[i];
        const isLastPhase = i === phases.length - 1;
        this.displayPhaseTree(phase, nodes, newPrefix, isLastPhase);
      }
    }
  }

  private findPhasesForInitiative(initiativeId: string, nodes: InitiativeNode[]): Array<PhaseData & { updated_at?: string }> {
    const roadmapNode = nodes.find(n =>
      (n.name === 'roadmap' || n.name.endsWith('-roadmap')) && n.parent_id === initiativeId
    );

    if (roadmapNode) {
      const roadmapData = this.parseSummary<RoadmapData>(roadmapNode.summary);
      if (roadmapData?.phases) {
        return roadmapData.phases.map(phase => {
          const phaseNode = nodes.find(n =>
            (n.name === phase.slug || n.name.endsWith('/' + phase.slug)) && n.parent_id === roadmapNode.id
          );
          return {
            ...phase,
            updated_at: phaseNode?.updated_at
          };
        });
      }
    }

    const phases: Array<PhaseData & { updated_at?: string }> = [];

    for (const node of nodes) {
      if (node.kind !== 'feature') continue;
      if (!node.parent_id) continue;

      const isPhase = /^phase-\d+$/.test(node.name) || /\/phase-\d+$/.test(node.name);
      if (!isPhase) continue;

      const belongsToInitiative = node.parent_id === initiativeId ||
        node.parent_id.startsWith(initiativeId + '/');
      if (!belongsToInitiative) continue;

      const phaseData = this.parseSummary<PhaseData>(node.summary);
      if (phaseData) {
        phases.push({
          ...phaseData,
          updated_at: node.updated_at
        });
      } else {
        const numMatch = node.name.match(/phase-(\d+)/);
        if (numMatch) {
          phases.push({
            number: parseInt(numMatch[1], 10),
            slug: node.name,
            name: node.name,
            goal: '',
            status: 'planned',
            updated_at: node.updated_at
          });
        }
      }
    }

    phases.sort((a, b) => a.number - b.number);
    return phases;
  }

  private displayPhaseTree(
    phase: PhaseData & { updated_at?: string },
    nodes: InitiativeNode[],
    prefix: string,
    isLast: boolean
  ): void {
    const connector = isLast ? '└─' : '├─';
    const statusIcon = this.getStatusIndicator(phase.status);
    const timeAgo = phase.updated_at ? ` ${this.formatRelativeTime(phase.updated_at)}` : '';
    const name = phase.name || phase.slug;

    console.log(`${prefix}${connector} ${statusIcon} Phase ${phase.number}: ${name}${timeAgo}`);
  }

  private getInitiativeDisplayName(initiative: InitiativeNode, isCurrent: boolean = false): string {
    let name = initiative.name;

    try {
      const summary = JSON.parse(initiative.summary);
      if (summary.initiative_name) {
        name = summary.initiative_name;
      } else if (summary.name) {
        name = summary.name;
      }
    } catch (e) {
    }

    if (isCurrent) {
      name += ' (current)';
    }

    return name;
  }

  private formatRelativeTime(isoDate: string): string {
    const now = Date.now();
    const then = new Date(isoDate).getTime();
    const diffMs = now - then;

    if (diffMs < 0) return '';

    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
    if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
    return `${months} month${months === 1 ? '' : 's'} ago`;
  }

  private getStatusIndicator(status: string): string {
    const statusLower = (status || '').toLowerCase();

    if (statusLower === 'completed' || statusLower === 'done' || statusLower === 'shipped' || statusLower === 'complete') {
      return '✓';
    } else if (statusLower === 'in_progress' || statusLower === 'in-progress' || statusLower === 'active') {
      return '●';
    } else {
      return '○';
    }
  }
}

export function initiativeListCommand(program: Command) {
  program
    .command('list [project-path]')
    .description('List all Fuska initiatives with milestones and phases')
    .action(async (projectPath?: string) => {
      const runner = new InitiativesRunner({
        projectDir: projectPath || process.cwd()
      });
      await runner.run();
    });
}
