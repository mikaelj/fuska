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

  private async displayInitiatives(): Promise<void> {
    const nodes = this.db.getAllActiveNodes();
    const edges = this.db.getAllEdges ? this.db.getAllEdges() : [];

    const initiatives = findAllInitiatives(this.db);

    if (initiatives.length === 0) {
      console.log('No initiatives found in MegaMemory.');
      console.log('');
      console.log('To create a new initiative, run:');
      console.log('  /fuska-new-initiative <initiative-name>');
      return;
    }

    console.log('Fuska Initiatives');
    console.log('');

    for (let i = 0; i < initiatives.length; i++) {
      const initiative = initiatives[i];
      const isLast = i === initiatives.length - 1;

      const initiativeNode = nodes.find((n: InitiativeNode) => n.id === initiative.node.id);
      if (initiativeNode) {
        this.displayInitiativeTree(initiativeNode, nodes, edges, '', isLast, initiative.isCurrent);
      }
    }
  }

  private displayInitiativeTree(
    initiative: InitiativeNode,
    nodes: InitiativeNode[],
    edges: any[],
    prefix: string,
    isLast: boolean,
    isCurrent: boolean = false
  ): void {
    const nodeMap = new Map<string, InitiativeNode>();

    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    const connector = isLast ? '└─' : '├─';
    const initiativeName = this.getInitiativeDisplayName(initiative, isCurrent);

    console.log(`${prefix}${connector} ${initiativeName}`);

    const childEdges = edges.filter((e: any) => e.to_id === initiative.id);
    const children = childEdges
      .map((e: any) => {
        const child = nodeMap.get(e.from_id);
        return child ? { ...child, relation: e.relation } : null;
      })
      .filter((n: any) => n !== undefined);

    const newPrefix = prefix + (isLast ? '  ' : '│ ');

    if (children.length > 0) {
      const milestones = children.filter((c: any) =>
        c.kind === 'decision' ||
        c.kind === 'feature' ||
        c.name.toLowerCase().includes('milestone') ||
        c.name.toLowerCase().includes('phase')
      );

      if (milestones.length > 0) {
        for (let i = 0; i < milestones.length; i++) {
          const milestone = milestones[i] as InitiativeNode;
          const isLastMilestone = i === milestones.length - 1;
          this.displayMilestoneTree(milestone, nodes, newPrefix, isLastMilestone);
        }
      } else {
        const configChildren = children.filter((c: any) => c.relation === 'configured_by');
        const analysisChildren = children.filter((c: any) => c.relation === 'connects_to');

        if (analysisChildren.length > 0) {
          console.log(`${newPrefix}├─ Codebase Analysis`);
          for (let i = 0; i < Math.min(analysisChildren.length, 3); i++) {
            const child = analysisChildren[i];
            if (!child) continue;
            const isLastChild = i === Math.min(analysisChildren.length, 3) - 1 && configChildren.length === 0;
            const childConnector = isLastChild ? '└─' : '├─';
            const childName = this.formatChildName(child.name);
            console.log(`${newPrefix}│  ${childConnector} ${childName}`);
          }
          if (analysisChildren.length > 3) {
            console.log(`${newPrefix}│  └─ ... and ${analysisChildren.length - 3} more`);
          }
        }

        if (configChildren.length > 0) {
          console.log(`${newPrefix}└─ Config & State`);
        }
      }
    }
  }

  private displayMilestoneTree(
    milestone: InitiativeNode,
    nodes: InitiativeNode[],
    prefix: string,
    isLast: boolean
  ): void {
    const nodeMap = new Map<string, InitiativeNode>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    const connector = isLast ? '└─' : '├─';
    const milestoneName = this.getMilestoneDisplayName(milestone);

    console.log(`${prefix}${connector} ${milestoneName}`);

    const newPrefix = prefix + (isLast ? '  ' : '│ ');

    if (milestone.children && milestone.children.length > 0) {
      const children = milestone.children
        .map(id => nodeMap.get(id))
        .filter(n => n !== undefined) as InitiativeNode[];

      const phases = children.filter(c =>
        c.name.toLowerCase().includes('phase') ||
        c.kind === 'module'
      );

      if (phases.length > 0) {
        for (let i = 0; i < phases.length; i++) {
          const phase = phases[i];
          const isLastPhase = i === phases.length - 1;
          this.displayPhaseTree(phase, newPrefix, isLastPhase);
        }
      }
    }
  }

  private displayPhaseTree(phase: InitiativeNode, prefix: string, isLast: boolean): void {
    const connector = isLast ? '└─' : '├─';
    const phaseName = this.getPhaseDisplayName(phase);

    console.log(`${prefix}${connector} ${phaseName}`);
  }

  private getInitiativeDisplayName(initiative: InitiativeNode, isCurrent: boolean = false): string {
    let name = initiative.name;
    let archivedAt: string | null = null;

    try {
      const summary = JSON.parse(initiative.summary);
      if (summary.initiative_name) {
        name = summary.initiative_name;
      } else if (summary.name) {
        name = summary.name;
      }
      if (summary.archived_at) {
        archivedAt = summary.archived_at;
      }
    } catch (e) {
    }

    let suffix = '';
    if (isCurrent) {
      suffix = ' (current)';
    }
    if (archivedAt) {
      const date = new Date(archivedAt);
      const formattedDate = date.toLocaleDateString();
      suffix += ` [archived: ${formattedDate}]`;
    }

    return name + suffix;
  }

  private getMilestoneDisplayName(milestone: InitiativeNode): string {
    let name = milestone.name;
    let status = '';

    try {
      const summary = JSON.parse(milestone.summary);
      if (summary.name) {
        name = summary.name;
      }
      if (summary.milestone_number) {
        name = `M${summary.milestone_number}: ${name}`;
      }
      if (summary.status) {
        status = this.getStatusIndicator(summary.status);
      }
    } catch (e) {
      if (name.includes('milestone')) {
        const match = name.match(/milestone-?(\d+)/i);
        if (match) {
          name = `M${match[1]}: ${name.replace(/milestone-?\d+[-_]?/i, '').replace(/[-_]/g, ' ')}`;
        }
      }
    }

    return status ? `${status} ${name}` : name;
  }

  private getPhaseDisplayName(phase: InitiativeNode): string {
    let name = phase.name;
    let status = '';

    try {
      const summary = JSON.parse(phase.summary);
      if (summary.name) {
        name = summary.name;
      }
      if (summary.phase_number !== undefined) {
        name = `Phase ${summary.phase_number}: ${name}`;
      }
      if (summary.status) {
        status = this.getStatusIndicator(summary.status);
      }
    } catch (e) {
      if (name.toLowerCase().includes('phase')) {
        const match = name.match(/phase-?(\d+)/i);
        if (match) {
          name = `Phase ${match[1]}`;
        }
      }
    }

    return status ? `${status} ${name}` : name;
  }

  private getStatusIndicator(status: string): string {
    const statusLower = status.toLowerCase();

    if (statusLower === 'completed' || statusLower === 'done' || statusLower === 'shipped') {
      return '✓';
    } else if (statusLower === 'in_progress' || statusLower === 'in-progress' || statusLower === 'active') {
      return '●';
    } else {
      return '○';
    }
  }

  private formatChildName(name: string): string {
    const parts = name.split('/');
    const lastPart = parts[parts.length - 1];

    return lastPart
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

export function initiativesCommand(program: Command) {
  program
    .command('initiatives [project-path]')
    .description('List all Fuska initiatives with milestones and phases')
    .action(async (projectPath?: string) => {
      const runner = new InitiativesRunner({
        projectDir: projectPath || process.cwd()
      });
      await runner.run();
    });
}
