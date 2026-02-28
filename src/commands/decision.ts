import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import inquirer from 'inquirer';
import {
  DecisionData,
  DecisionStatus,
  DecisionAlternative,
  DecisionConsequences,
} from '../scripts/types';

interface DecisionNode {
  id: string;
  name: string;
  kind: string;
  summary: string;
  created_at?: string;
  updated_at?: string;
}

const STATUS_ICONS: Record<DecisionStatus, string> = {
  proposed: '○',
  accepted: '✓',
  rejected: '✗',
  deprecated: '⚠',
  superseded: '↻',
};

class DecisionRunner {
  private projectDir: string;
  private db: any;

  constructor(options: { projectDir: string }) {
    this.projectDir = options.projectDir;
  }

  async runNew(): Promise<void> {
    await this.preflightCheck();
    await this.createNewDecision();
  }

  async runList(statusFilter?: string): Promise<void> {
    await this.preflightCheck();
    await this.displayDecisions(statusFilter);
  }

  async runShow(id: string): Promise<void> {
    await this.preflightCheck();
    await this.showDecision(id);
  }

  async runAccept(id: string): Promise<void> {
    await this.preflightCheck();
    await this.updateDecisionStatus(id, 'accepted', 'proposed');
  }

  async runReject(id: string): Promise<void> {
    await this.preflightCheck();
    await this.updateDecisionStatus(id, 'rejected', 'proposed');
  }

  async runDeprecate(id: string): Promise<void> {
    await this.preflightCheck();
    await this.updateDecisionStatus(id, 'deprecated', 'accepted');
  }

  private async preflightCheck(): Promise<void> {
    const resolvedPath = path.resolve(this.projectDir);
    const dbPath = path.join(resolvedPath, '.megamemory', 'knowledge.db');

    if (!await fs.pathExists(dbPath)) {
      console.error(`No .megamemory/knowledge.db found at ${resolvedPath}`);
      console.error('Run `fuska init` first.');
      process.exit(1);
    }

    const { KnowledgeDB } = await import('megamemory/dist/db.js');
    this.db = new KnowledgeDB(dbPath);
  }

  private async createNewDecision(): Promise<void> {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'title',
        message: 'Decision title:',
        validate: (input) => input.trim().length > 0 ? true : 'Title is required'
      },
      {
        type: 'editor',
        name: 'context',
        message: 'Context (why is this decision needed):',
      },
      {
        type: 'editor',
        name: 'decision',
        message: 'Decision (what was decided):',
      },
      {
        type: 'input',
        name: 'alternativesRaw',
        message: 'Alternatives considered (comma-separated):',
        filter: (input) => input.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
      },
      {
        type: 'input',
        name: 'positiveConsequences',
        message: 'Positive consequences (comma-separated):',
        filter: (input) => input.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
      },
      {
        type: 'input',
        name: 'negativeConsequences',
        message: 'Negative consequences (comma-separated, optional):',
        filter: (input) => input.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
      },
      {
        type: 'input',
        name: 'risks',
        message: 'Risks (comma-separated, optional):',
        filter: (input) => input.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
      },
      {
        type: 'input',
        name: 'relatedChapters',
        message: 'Related chapters (comma-separated, e.g. chapter-01, chapter-02):',
        filter: (input) => input.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
      }
    ]);

    const decisionId = this.slugify(answers.title);
    const alternatives: DecisionAlternative[] = answers.alternativesRaw.map((opt: string) => ({
      option: opt,
      considered: true,
      reason: ''
    }));

    const consequences: DecisionConsequences = {
      positive: answers.positiveConsequences,
      negative: answers.negativeConsequences,
      risks: answers.risks
    };

    const decisionData: DecisionData = {
      id: decisionId,
      title: answers.title,
      context: answers.context || '',
      decision: answers.decision || '',
      alternatives,
      consequences,
      status: 'proposed',
      created_at: new Date().toISOString(),
      decided_at: null,
      superseded_by: null,
      related_chapters: answers.relatedChapters
    };

    try {
      await this.createDecisionConcept(decisionId, decisionData);
      console.log(`\nCreated decision: ${decisionId}`);
      console.log(`Status: proposed`);
      console.log(`\nView with: fuska decision show ${decisionId}`);
    } catch (err: any) {
      this.handleMegaMemoryError(err);
      process.exit(1);
    }
  }

  private async createDecisionConcept(id: string, data: DecisionData): Promise<void> {
    const { createConcept } = await import('megamemory/dist/tools.js');

    const concept = {
      name: id,
      kind: 'decision' as const,
      summary: JSON.stringify(data, null, 2),
      why: data.context,
      parent_id: undefined,
      edges: []
    };

    await createConcept(this.db, concept);
  }

  private async displayDecisions(statusFilter?: string): Promise<void> {
    const nodes: DecisionNode[] = this.db.getAllActiveNodes();

    const decisions = this.findDecisions(nodes);

    if (decisions.length === 0) {
      console.log('No decisions found in MegaMemory.');
      console.log('');
      console.log('To create a new decision, run:');
      console.log('  fuska decision new');
      return;
    }

    const decisionDataList: Array<{ node: DecisionNode; data: DecisionData }> = [];

    for (const decision of decisions) {
      try {
        const data = this.parseDecisionSummary(decision.summary);
        if (data) {
          if (!statusFilter || data.status === statusFilter) {
            decisionDataList.push({ node: decision, data });
          }
        }
      } catch {
        // Skip unparseable decisions
      }
    }

    decisionDataList.sort((a, b) => {
      const dateA = new Date(a.data.created_at || 0).getTime();
      const dateB = new Date(b.data.created_at || 0).getTime();
      return dateB - dateA;
    });

    console.log('Architecture Decisions');
    console.log('');

    for (const { node, data } of decisionDataList) {
      const icon = STATUS_ICONS[data.status] || '○';
      const age = this.getRelativeTime(data.created_at);
      const title = data.title || node.name;

      console.log(`  ${icon} ${title} (${data.status}, ${age})`);
      console.log(`     ID: ${data.id || node.name}`);
    }

    console.log('');
    console.log(`Total: ${decisionDataList.length} decisions`);

    if (statusFilter) {
      console.log(`Filtered by status: ${statusFilter}`);
    }
  }

  private findDecisions(nodes: DecisionNode[]): DecisionNode[] {
    const decisions: DecisionNode[] = [];

    for (const node of nodes) {
      if (node.kind === 'decision') {
        decisions.push(node);
      }
    }

    return decisions;
  }

  private parseDecisionSummary(summary: string): DecisionData | null {
    try {
      const start = summary.indexOf('{');
      const end = summary.lastIndexOf('}');
      if (start === -1 || end === -1) return null;
      return JSON.parse(summary.substring(start, end + 1)) as DecisionData;
    } catch {
      return null;
    }
  }

  private slugify(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private getRelativeTime(dateString: string): string {
    if (!dateString) return 'unknown';

    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
      return `${Math.floor(diffDays / 30)}mo ago`;
    } catch {
      return dateString;
    }
  }

  private handleMegaMemoryError(err: any): void {
    const message = err?.message || String(err);
    console.error(`\nMegaMemory error: ${message}`);
  }

  private async showDecision(id: string): Promise<void> {
    const nodes: DecisionNode[] = this.db.getAllActiveNodes();
    const decisions = this.findDecisions(nodes);

    let decision = decisions.find(d => d.name === id || d.id === id);
    let decisionData: DecisionData | null = null;

    if (decision) {
      decisionData = this.parseDecisionSummary(decision.summary);
    }

    if (!decision || !decisionData) {
      const similarDecisions = this.findSimilarDecisions(id, decisions);
      if (similarDecisions.length > 0) {
        console.error(`Decision '${id}' not found.`);
        console.error('\nSimilar decisions:');
        for (const sim of similarDecisions.slice(0, 5)) {
          const icon = STATUS_ICONS[sim.data.status] || '○';
          console.error(`  ${icon} ${sim.data.title || sim.node.name} (${sim.data.id || sim.node.name})`);
        }
        console.error(`\nUse 'fuska decision show <id>' with one of the IDs above.`);
      } else {
        console.error(`Decision '${id}' not found.`);
      console.error(`Use 'fuska decision list' to see all decisions.`);
      }
      process.exit(1);
    }

    this.displayDecisionDetails(decision, decisionData);
  }

  private findSimilarDecisions(query: string, decisions: DecisionNode[]): Array<{ node: DecisionNode; data: DecisionData }> {
    const queryLower = query.toLowerCase();
    const results: Array<{ node: DecisionNode; data: DecisionData; score: number }> = [];

    for (const decision of decisions) {
      const data = this.parseDecisionSummary(decision.summary);
      if (!data) continue;

      let score = 0;
      const name = (data.id || decision.name).toLowerCase();
      const title = (data.title || '').toLowerCase();

      if (name.includes(queryLower)) score += 3;
      if (title.includes(queryLower)) score += 2;

      const queryWords = queryLower.split(/[-_\s]+/);
      for (const word of queryWords) {
        if (name.includes(word)) score += 1;
        if (title.includes(word)) score += 0.5;
      }

      if (score > 0) {
        results.push({ node: decision, data, score });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .map(r => ({ node: r.node, data: r.data }));
  }

  private displayDecisionDetails(node: DecisionNode, data: DecisionData): void {
    const icon = STATUS_ICONS[data.status] || '○';

    console.log('');
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(` ${icon} ${data.title || node.name}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log('');
    console.log(`ID: ${data.id || node.name}`);
    console.log(`Status: ${data.status}`);
    console.log('');

    if (data.context) {
      console.log('Context');
      console.log('-------');
      console.log(data.context);
      console.log('');
    }

    if (data.decision) {
      console.log('Decision');
      console.log('--------');
      console.log(data.decision);
      console.log('');
    }

    if (data.alternatives && data.alternatives.length > 0) {
      console.log('Alternatives Considered');
      console.log('-----------------------');
      for (const alt of data.alternatives) {
        const considered = alt.considered ? '✓' : '✗';
        console.log(`  ${considered} ${alt.option}`);
        if (alt.reason) {
          console.log(`    Reason: ${alt.reason}`);
        }
      }
      console.log('');
    }

    if (data.consequences) {
      if (data.consequences.positive && data.consequences.positive.length > 0) {
        console.log('Positive Consequences');
        console.log('---------------------');
        for (const c of data.consequences.positive) {
          console.log(`  + ${c}`);
        }
        console.log('');
      }

      if (data.consequences.negative && data.consequences.negative.length > 0) {
        console.log('Negative Consequences');
        console.log('---------------------');
        for (const c of data.consequences.negative) {
          console.log(`  - ${c}`);
        }
        console.log('');
      }

      if (data.consequences.risks && data.consequences.risks.length > 0) {
        console.log('Risks');
        console.log('-----');
        for (const r of data.consequences.risks) {
          console.log(`  ! ${r}`);
        }
        console.log('');
      }
    }

    console.log('Timestamps');
    console.log('----------');
    console.log(`  Created: ${this.formatTimestamp(data.created_at)}`);
    if (data.decided_at) {
      console.log(`  Decided: ${this.formatTimestamp(data.decided_at)}`);
    }
    console.log('');

    if (data.related_chapters && data.related_chapters.length > 0) {
      console.log('Related Chapters');
      console.log('----------------');
      console.log(`  ${data.related_chapters.join(', ')}`);
      console.log('');
    }

    if (data.superseded_by) {
      console.log('Superseded By');
      console.log('-------------');
      console.log(`  ${data.superseded_by}`);
      console.log('');
    }
  }

  private formatTimestamp(dateString: string | null): string {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0] + ' ' + date.toTimeString().split(' ')[0];
    } catch {
      return dateString;
    }
  }

  private async updateDecisionStatus(
    id: string,
    newStatus: DecisionStatus,
    requiredCurrentStatus: DecisionStatus
  ): Promise<void> {
    const nodes: DecisionNode[] = this.db.getAllActiveNodes();
    const decisions = this.findDecisions(nodes);

    const decision = decisions.find(d => d.name === id || d.id === id);

    if (!decision) {
      console.error(`Decision '${id}' not found.`);
      console.error("Use 'fuska decision list' to see all decisions.");
      process.exit(1);
    }

    const decisionData = this.parseDecisionSummary(decision.summary);
    if (!decisionData) {
      console.error(`Failed to parse decision data for '${id}'.`);
      process.exit(1);
    }

    if (decisionData.status !== requiredCurrentStatus) {
      console.error(`Cannot ${newStatus === 'accepted' || newStatus === 'rejected' ? newStatus : 'deprecate'} decision '${id}'.`);
      console.error(`Current status is '${decisionData.status}', but must be '${requiredCurrentStatus}'.`);
      if (newStatus === 'deprecated') {
        console.error('Only accepted decisions can be deprecated.');
      } else {
        console.error('Only proposed decisions can be accepted or rejected.');
      }
      process.exit(1);
    }

    const updatedData: DecisionData = {
      ...decisionData,
      status: newStatus,
      decided_at: newStatus === 'deprecated' ? decisionData.decided_at : new Date().toISOString()
    };

    try {
      const { updateConcept } = await import('megamemory/dist/tools.js');
      await updateConcept(this.db, {
        id: decision.id,
        changes: {
          summary: JSON.stringify(updatedData, null, 2)
        }
      });

      const icon = STATUS_ICONS[newStatus];
      console.log(`\n${icon} Decision '${id}' ${newStatus}.`);
      if (newStatus !== 'deprecated') {
        console.log(`Decided at: ${this.formatTimestamp(updatedData.decided_at)}`);
      }
    } catch (err: any) {
      this.handleMegaMemoryError(err);
      process.exit(1);
    }
  }
}

export function decisionCommand(program: Command) {
  const decisionCmd = program
    .command('decision')
    .description('Manage architecture decisions');

  decisionCmd
    .command('new')
    .description('Create a new decision')
    .action(async () => {
      const runner = new DecisionRunner({ projectDir: process.cwd() });
      await runner.runNew();
    });

  decisionCmd
    .command('list')
    .description('List all decisions')
    .option('--status <status>', 'Filter by status (proposed, accepted, rejected, deprecated, superseded)')
    .action(async (options) => {
      const runner = new DecisionRunner({ projectDir: process.cwd() });
      await runner.runList(options.status);
    });

  decisionCmd
    .command('show <id>')
    .description('Show decision details')
    .action(async (id: string) => {
      const runner = new DecisionRunner({ projectDir: process.cwd() });
      await runner.runShow(id);
    });

  decisionCmd
    .command('accept <id>')
    .description('Accept a proposed decision')
    .action(async (id: string) => {
      const runner = new DecisionRunner({ projectDir: process.cwd() });
      await runner.runAccept(id);
    });

  decisionCmd
    .command('reject <id>')
    .description('Reject a proposed decision')
    .action(async (id: string) => {
      const runner = new DecisionRunner({ projectDir: process.cwd() });
      await runner.runReject(id);
    });

  decisionCmd
    .command('deprecate <id>')
    .description('Deprecate an accepted decision')
    .action(async (id: string) => {
      const runner = new DecisionRunner({ projectDir: process.cwd() });
      await runner.runDeprecate(id);
    });
}
