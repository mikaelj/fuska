import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';

interface ProjectNode {
  id: string;
  name: string;
  kind: string;
  summary: string;
  children?: string[];
}

class ProjectsRunner {
  private projectDir: string;
  private db: any;

  constructor(options: { projectDir: string }) {
    this.projectDir = options.projectDir;
  }

  async run(): Promise<void> {
    await this.preflightCheck();
    await this.displayProjects();
  }

  private async preflightCheck(): Promise<void> {
    const resolvedPath = path.resolve(this.projectDir);
    const dbPath = path.join(resolvedPath, '.megamemory', 'knowledge.db');

    if (!await fs.pathExists(dbPath)) {
      console.error(`No .megamemory/knowledge.db found at ${resolvedPath}`);
      console.error('Run /fuska-new-project first.');
      process.exit(1);
    }

    const { KnowledgeDB } = await import('megamemory/dist/db.js');
    this.db = new KnowledgeDB(dbPath);
  }

  private async displayProjects(): Promise<void> {
    const nodes = this.db.getAllActiveNodes();
    const edges = this.db.getAllEdges ? this.db.getAllEdges() : [];
    
    // Find all projects (top-level feature nodes or nodes with milestone/phase children)
    const projects = this.findProjects(nodes, edges);
    
    if (projects.length === 0) {
      console.log('No projects found in MegaMemory.');
      console.log('');
      console.log('To create a new project, run:');
      console.log('  /fuska-new-project <project-name>');
      return;
    }

    console.log('Fuska Projects');
    console.log('');

    for (let i = 0; i < projects.length; i++) {
      const project = projects[i];
      const isLast = i === projects.length - 1;
      
      this.displayProjectTree(project, nodes, edges, '', isLast);
    }
  }

  private findProjects(nodes: ProjectNode[], edges: any[]): ProjectNode[] {
    // Projects are feature nodes that are either:
    // 1. Top-level (no parent or referenced as root)
    // 2. Have milestone/phase children
    const nodeMap = new Map<string, ProjectNode>();
    const childSet = new Set<string>();

    // Build node map and track all children
    for (const node of nodes) {
      nodeMap.set(node.id, node);
      if (node.children && Array.isArray(node.children)) {
        for (const childId of node.children) {
          childSet.add(childId);
        }
      }
    }

    // Find root nodes (not children of any other node)
    const projects: ProjectNode[] = [];
    
    for (const node of nodes) {
      // Skip config, state, and component nodes
      if (node.kind === 'config' || node.kind === 'component') {
        continue;
      }
      
      // Skip task concepts
      if (node.name.startsWith('task-')) {
        continue;
      }
      
      // Skip command-like concepts (ending with "command" or containing common command terms)
      if (node.name.toLowerCase().includes('command') ||
          node.name.toLowerCase().endsWith('-cmd') ||
          node.name.toLowerCase().includes('cli')) {
        continue;
      }
      
      // Skip git-message integration (it's a feature but not a project)
      if (node.name === 'git-message-megamemory-integration') {
        continue;
      }

      // Skip if this node is a child of another node
      if (childSet.has(node.id)) {
        continue;
      }

      // This is a potential project - check if it's a feature with children
      if (node.kind === 'feature') {
        // Check if it has meaningful project-like children (milestones, phases, codebase analysis)
        if (node.children && node.children.length > 0) {
          const hasProjectChildren = node.children.some(childId => {
            const child = nodeMap.get(childId);
            if (!child) return false;
            // Check for milestone-like or phase-like children, or codebase analysis
            return (child.kind === 'feature' || child.kind === 'decision' || child.kind === 'module') &&
                   (child.name.includes('milestone') || 
                    child.name.includes('phase') ||
                    child.name.includes('codebase') ||
                    child.name.includes('state') ||
                    child.name.includes('config'));
          });
          
          if (hasProjectChildren) {
            projects.push(node);
          }
        } else {
          // Feature without children but is top-level - could be a project
          // Only include if the name looks like a project (not generic features)
          if (!this.isGenericFeature(node.name)) {
            projects.push(node);
          }
        }
      }
    }

    return projects;
  }

  private isGenericFeature(name: string): boolean {
    // Filter out generic feature names that aren't projects
    const genericPatterns = [
      /integration$/i,
      /support$/i,
      /handler$/i,
      /helper$/i,
      /utility$/i,
      /utils$/i
    ];
    
    return genericPatterns.some(pattern => pattern.test(name));
  }

  private displayProjectTree(
    project: ProjectNode, 
    nodes: ProjectNode[],
    edges: any[],
    prefix: string, 
    isLast: boolean
  ): void {
    const nodeMap = new Map<string, ProjectNode>();
    
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    // Display project name
    const connector = isLast ? '└─' : '├─';
    const projectName = this.getProjectDisplayName(project);
    
    console.log(`${prefix}${connector} ${projectName}`);

    // Find children via edges (since children property may not be populated)
    // Note: edges go from child to parent (to_id = parent)
    const childEdges = edges.filter((e: any) => e.to_id === project.id);
    const children = childEdges
      .map((e: any) => {
        const child = nodeMap.get(e.from_id);
        return child ? { ...child, relation: e.relation } : null;
      })
      .filter((n: any) => n !== undefined);
    
    const newPrefix = prefix + (isLast ? '  ' : '│ ');
    
    if (children.length > 0) {
      // Separate milestones/phases from other children
      const milestones = children.filter((c: any) => 
        c.kind === 'decision' || 
        c.kind === 'feature' ||
        c.name.toLowerCase().includes('milestone') ||
        c.name.toLowerCase().includes('phase')
      );

      // If we have milestones/phases, show them
      if (milestones.length > 0) {
        for (let i = 0; i < milestones.length; i++) {
          const milestone = milestones[i] as ProjectNode;
          const isLastMilestone = i === milestones.length - 1;
          this.displayMilestoneTree(milestone, nodes, newPrefix, isLastMilestone);
        }
      } else {
        // Show a summary of what the project contains
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
    milestone: ProjectNode,
    nodes: ProjectNode[],
    prefix: string,
    isLast: boolean
  ): void {
    const nodeMap = new Map<string, ProjectNode>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    const connector = isLast ? '└─' : '├─';
    const milestoneName = this.getMilestoneDisplayName(milestone);
    
    console.log(`${prefix}${connector} ${milestoneName}`);

    // Find phases under milestone
    const newPrefix = prefix + (isLast ? '  ' : '│ ');
    
    if (milestone.children && milestone.children.length > 0) {
      const children = milestone.children
        .map(id => nodeMap.get(id))
        .filter(n => n !== undefined) as ProjectNode[];

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

  private displayPhaseTree(phase: ProjectNode, prefix: string, isLast: boolean): void {
    const connector = isLast ? '└─' : '├─';
    const phaseName = this.getPhaseDisplayName(phase);
    
    console.log(`${prefix}${connector} ${phaseName}`);
  }

  private getProjectDisplayName(project: ProjectNode): string {
    let name = project.name;
    
    // Try to extract project name from summary JSON
    try {
      const summary = JSON.parse(project.summary);
      if (summary.project_name) {
        name = summary.project_name;
      } else if (summary.name) {
        name = summary.name;
      }
    } catch (e) {
      // Not JSON, use the name as-is
    }

    return name;
  }

  private getMilestoneDisplayName(milestone: ProjectNode): string {
    let name = milestone.name;
    let status = '';

    // Try to extract milestone info from summary
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
      // Not JSON, check name for milestone pattern
      if (name.includes('milestone')) {
        const match = name.match(/milestone-?(\d+)/i);
        if (match) {
          name = `M${match[1]}: ${name.replace(/milestone-?\d+[-_]?/i, '').replace(/[-_]/g, ' ')}`;
        }
      }
    }

    return status ? `${status} ${name}` : name;
  }

  private getPhaseDisplayName(phase: ProjectNode): string {
    let name = phase.name;
    let status = '';

    // Try to extract phase info from summary
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
      // Not JSON, check name for phase pattern
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
    // Extract meaningful part from names like "codebase-tech" or "gsd-mm/config"
    const parts = name.split('/');
    const lastPart = parts[parts.length - 1];
    
    // Convert kebab-case to Title Case
    return lastPart
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

export function projectsCommand(program: Command) {
  program
    .command('projects [project-path]')
    .description('List all Fuska projects with milestones and phases')
    .action(async (projectPath?: string) => {
      const runner = new ProjectsRunner({
        projectDir: projectPath || process.cwd()
      });
      await runner.run();
    });
}
