import { Command } from 'commander';
import * as path from 'path';
import { execSync } from 'child_process';
import * as fs from 'fs-extra';

interface GitMessageOptions {
  projectDir: string;
  debug: boolean;
}

interface ParsedCommit {
  hash: string;
  body: string;
}

interface PlanContext {
  objective?: string;
  tasks?: string[];
  completed?: string[];
}

interface CommitStrategy {
  type: 'per-phase' | 'per-plan' | 'per-task';
}

export function gitMessageCommand(program: Command) {
  program
    .command('git-message [args...]')
    .description('Test and preview commit messages using Fuska commit message rules')
    .option('-p, --project-dir <path>', 'Path to project with .megamemory/', process.cwd())
    .option('--debug', 'Show debug information')
    .action(async (args: string[], options: GitMessageOptions) => {
      try {
        const runner = new GitMessageRunner(options);
        await runner.run(args);
      } catch (error: any) {
        console.error(`\nError: ${error.message}`);
        if (options.debug) {
          console.error(error.stack);
        }
        throw error;
      }
    });
}

class GitMessageRunner {
  private options: GitMessageOptions;
  private commitRange: string | null = null;
  private commitHash: string | null = null;
  private phasePlan: string | null = null;
  private isDefaultMode: boolean = false;
  private commitStrategy: CommitStrategy = { type: 'per-phase' };

  constructor(options: GitMessageOptions) {
    this.options = options;
  }

  async run(args: string[]): Promise<void> {
    this.parseArguments(args);
    await this.loadConfig();
    await this.validateAndSetup();
    const { diffContent, originalMessages, mode } = await this.getDiffAndOriginalMessages();
    const planContext = await this.loadPlanContext();
    const generatedMessage = this.generateCommitMessage(diffContent, planContext);
    this.printOutput(originalMessages, generatedMessage, mode);
  }

  private parseArguments(args: string[]): void {
    this.isDefaultMode = args.length === 0;

    for (const arg of args) {
      if (arg.includes('..')) {
        this.commitRange = arg;
      } else if (arg.match(/^phase-\d+-plan-\d+$/)) {
        this.phasePlan = arg;
      } else {
        try {
          execSync(`git rev-parse --verify ${arg}^{commit}`, { 
            cwd: this.options.projectDir,
            stdio: 'pipe'
          });
          this.commitHash = arg;
        } catch {
          // Not a valid commit, might be something else
        }
      }
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      const megamemoryPath = path.join(this.options.projectDir, '.megamemory');
      const { KnowledgeDB } = await import('megamemory/dist/db.js');
      const db = new KnowledgeDB(megamemoryPath);
      
      const configConcept = db.getAllActiveNodes().find((node: any) => 
        node.name === 'config' && node.kind === 'config'
      );

      if (configConcept && configConcept.summary) {
        const configData = this.parseJson(configConcept.summary);
        this.commitStrategy = { 
          type: (configData?.git?.commit_strategy as any) || 'per-phase' 
        };
      }
    } catch (error) {
      // Config loading is optional, use default
    }
  }

  private async validateAndSetup(): Promise<void> {
    if (this.commitRange) {
      await this.validateCommitRange();
    } else if (this.commitHash) {
      await this.validateCommitHash();
    }
    // Working tree mode: no validation needed
  }

  private async validateCommitRange(): Promise<void> {
    const [start, end] = this.commitRange!.split('..');
    const rangeStart = start.trim();
    const rangeEnd = end.trim();

    try {
      execSync(`git rev-parse --verify ${rangeStart}^{commit}`, { 
        cwd: this.options.projectDir,
        stdio: 'pipe'
      });
    } catch {
      throw new Error(`"${rangeStart}" is not a valid commit reference`);
    }

    try {
      execSync(`git rev-parse --verify ${rangeEnd}^{commit}`, { 
        cwd: this.options.projectDir,
        stdio: 'pipe'
      });
    } catch {
      throw new Error(`"${rangeEnd}" is not a valid commit reference`);
    }

    const commitCount = execSync(`git rev-list --count ${rangeStart}..${rangeEnd}`, {
      cwd: this.options.projectDir,
      encoding: 'utf-8'
    }).trim();

    if (commitCount === '0') {
      throw new Error(`No commits found in range ${this.commitRange}`);
    }

    if (parseInt(commitCount) > 50) {
      console.log(`Warning: Range contains ${commitCount} commits. Output will be large.`);
    }

    const mergeCount = execSync(`git rev-list --count --merges ${rangeStart}..${rangeEnd}`, {
      cwd: this.options.projectDir,
      encoding: 'utf-8'
    }).trim();

    if (parseInt(mergeCount) > 0) {
      console.log(`Note: Range contains ${mergeCount} merge commit(s). Use --no-merges flag to exclude.`);
    }
  }

  private async validateCommitHash(): Promise<void> {
    try {
      execSync(`git rev-parse --verify ${this.commitHash}^{commit}`, { 
        cwd: this.options.projectDir,
        stdio: 'pipe'
      });
    } catch {
      throw new Error(`"${this.commitHash}" is not a valid commit reference`);
    }
  }

  private async getDiffAndOriginalMessages(): Promise<{
    diffContent: string;
    originalMessages: ParsedCommit[] | null;
    mode: 'range' | 'hash' | 'working';
  }> {
    if (this.commitRange) {
      return await this.getCommitRangeDiff();
    } else if (this.commitHash) {
      return await this.getCommitHashDiff();
    } else {
      return await this.getWorkingTreeDiff();
    }
  }

  private async getCommitRangeDiff(): Promise<{
    diffContent: string;
    originalMessages: ParsedCommit[];
    mode: 'range';
  }> {
    const [start, end] = this.commitRange!.split('..');
    const rangeStart = start.trim();
    const rangeEnd = end.trim();

    const diffContent = execSync(`git diff ${rangeStart}..${rangeEnd}`, {
      cwd: this.options.projectDir,
      encoding: 'utf-8'
    });

    const logOutput = execSync(`git log ${rangeStart}..${rangeEnd} --format="HASH: %H%nBODY_START%n%B%nBODY_END%n"`, {
      cwd: this.options.projectDir,
      encoding: 'utf-8'
    });

    const originalMessages = this.parseGitLog(logOutput);

    // Auto-detect phasePlan from most recent commit if not provided
    if (!this.phasePlan && originalMessages.length > 0) {
      this.phasePlan = this.extractPhasePlanFromScope(originalMessages[0].body);
    }

    return { diffContent, originalMessages, mode: 'range' };
  }

  private async getCommitHashDiff(): Promise<{
    diffContent: string;
    originalMessages: ParsedCommit[];
    mode: 'hash';
  }> {
    const originalBranch = execSync('git symbolic-ref --short HEAD 2>/dev/null || git rev-parse HEAD', {
      cwd: this.options.projectDir,
      encoding: 'utf-8'
    }).trim();

    const originalMessage = execSync(`git log -1 --format="%B" ${this.commitHash}`, {
      cwd: this.options.projectDir,
      encoding: 'utf-8'
    });

    // Auto-detect phasePlan from commit message if not provided
    if (!this.phasePlan) {
      this.phasePlan = this.extractPhasePlanFromScope(originalMessage);
    }

    const parent = execSync(`git rev-parse ${this.commitHash}^`, {
      cwd: this.options.projectDir,
      encoding: 'utf-8'
    }).trim();

    const diffContent = execSync(`git diff ${this.commitHash}^ ${this.commitHash}`, {
      cwd: this.options.projectDir,
      encoding: 'utf-8'
    });

    return {
      diffContent,
      originalMessages: [{ hash: this.commitHash!, body: originalMessage }],
      mode: 'hash'
    };
  }

  private async getWorkingTreeDiff(): Promise<{
    diffContent: string;
    originalMessages: null;
    mode: 'working';
  }> {
    const unstaged = execSync('git diff', {
      cwd: this.options.projectDir,
      encoding: 'utf-8'
    });

    const staged = execSync('git diff --cached', {
      cwd: this.options.projectDir,
      encoding: 'utf-8'
    });

    const diffContent = unstaged + '\n' + staged;

    if (!diffContent.trim()) {
      throw new Error('No uncommitted changes found in working tree');
    }

    return { diffContent, originalMessages: null, mode: 'working' };
  }

  private parseGitLog(output: string): ParsedCommit[] {
    const messages: ParsedCommit[] = [];
    let currentHash: string | null = null;
    let currentBody: string[] = [];
    let inBody = false;

    for (const line of output.split('\n')) {
      if (line.startsWith('HASH: ')) {
        if (currentHash) {
          messages.push({ hash: currentHash, body: currentBody.join('\n') });
        }
        currentHash = line.substring(6);
        currentBody = [];
        inBody = false;
      } else if (line === 'BODY_START') {
        inBody = true;
      } else if (line === 'BODY_END') {
        inBody = false;
      } else if (inBody) {
        currentBody.push(line);
      }
    }

    if (currentHash) {
      messages.push({ hash: currentHash, body: currentBody.join('\n') });
    }

    return messages;
  }

  private extractPhasePlanFromScope(message: string): string | null {
    const scopeMatch = message.match(/^\w+\s*\(([^)]+)\):/);
    if (!scopeMatch) return null;

    const scope = scopeMatch[1].trim();

    if (scope.match(/^phase-\d+-plan-\d+$/)) {
      return scope;
    } else if (scope.match(/^\d{2}-\d{2}$/)) {
      const [phaseNum, planNum] = scope.split('-');
      return `phase-${phaseNum}-plan-${planNum}`;
    } else if (scope.match(/^phase-\d+$/)) {
      return scope;
    }

    return null;
  }

  private async loadPlanContext(): Promise<PlanContext | null> {
    if (!this.phasePlan) {
      return null;
    }

    try {
      const megamemoryPath = path.join(this.options.projectDir, '.megamemory');
      const { KnowledgeDB } = await import('megamemory/dist/db.js');
      const db = new KnowledgeDB(megamemoryPath);

      const planNode = db.getAllActiveNodes().find((node: any) =>
        node.name === this.phasePlan
      );

      if (planNode && planNode.summary) {
        const data = this.parseJson(planNode.summary);
        return {
          objective: data.objective,
          tasks: data.tasks,
          completed: data.completed
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  private generateCommitMessage(diffContent: string, planContext: PlanContext | null): string {
    const type = this.determineCommitType(diffContent);
    const scope = this.determineScope();
    const subject = this.formatSubject(type, scope, diffContent);
    const body = this.formatBody(diffContent, planContext);

    return `${subject}\n\n${body}`.trim();
  }

  private determineCommitType(diff: string): string {
    const lowerDiff = diff.toLowerCase();

    if (lowerDiff.includes('test.') || lowerDiff.includes('.test.') || lowerDiff.includes('.spec.')) {
      return 'test';
    }

    if (lowerDiff.includes('fix') || lowerDiff.includes('bug') || lowerDiff.includes('error')) {
      return 'fix';
    }

    if (lowerDiff.includes('refactor') || lowerDiff.includes('reorg') || lowerDiff.includes('restructure')) {
      return 'refactor';
    }

    if (lowerDiff.includes('performance') || lowerDiff.includes('perf') || lowerDiff.includes('optimize')) {
      return 'perf';
    }

    if (lowerDiff.includes('package.json') || lowerDiff.includes('config') || lowerDiff.includes('dependency')) {
      return 'chore';
    }

    return 'feat';
  }

  private determineScope(): string {
    if (!this.phasePlan) {
      return '';
    }

    switch (this.commitStrategy.type) {
      case 'per-phase':
        const phaseMatch = this.phasePlan.match(/phase-(\d+)/);
        if (phaseMatch) {
          return `phase-${phaseMatch[1].padStart(2, '0')}`;
        }
        return '';
      case 'per-plan':
      case 'per-task':
        const planMatch = this.phasePlan.match(/phase-(\d+)-plan-(\d+)/);
        if (planMatch) {
          return `${planMatch[1].padStart(2, '0')}-${planMatch[2].padStart(2, '0')}`;
        }
        return '';
      default:
        return '';
    }
  }

  private formatSubject(type: string, scope: string, diff: string): string {
    const description = this.generateDescription(diff);
    const base = `${type}${scope ? `(${scope})` : ''}: ${description}`;
    
    // Max 72 characters for subject line
    if (base.length > 72) {
      return base.substring(0, 69) + '...';
    }
    return base;
  }

  private generateDescription(diff: string): string {
    const lowerDiff = diff.toLowerCase();
    const lines = diff.split('\n').filter(l => l.startsWith('+++') || l.startsWith('---'));

    if (lowerDiff.includes('test') || lowerDiff.includes('spec')) {
      return 'add tests';
    }

    if (lowerDiff.includes('fix') || lowerDiff.includes('bug')) {
      return 'fix bug';
    }

    if (lowerDiff.includes('feature') || lowerDiff.includes('new')) {
      return 'implement feature';
    }

    if (lowerDiff.includes('refactor')) {
      return 'refactor code';
    }

    if (lines.length > 0) {
      return 'update code';
    }

    return 'make changes';
  }

  private formatBody(diff: string, planContext: PlanContext | null): string {
    const bullets: string[] = [];

    switch (this.commitStrategy.type) {
      case 'per-phase':
        bullets.push(...this.generatePerPhaseBullets(diff, planContext));
        break;
      case 'per-plan':
        bullets.push(...this.generatePerPlanBullets(diff, planContext));
        break;
      case 'per-task':
        bullets.push(...this.generatePerTaskBullets(diff, planContext));
        break;
    }

    return bullets.slice(0, 4).map(b => `- ${b}`).join('\n');
  }

  private generatePerPhaseBullets(diff: string, planContext: PlanContext | null): string[] {
    const bullets: string[] = [];

    if (planContext?.completed && planContext.completed.length > 0) {
      bullets.push(`Plan ${this.extractPlanNumber(this.phasePlan)}: ${planContext.completed[0]}`);
    } else {
      bullets.push(`Plan ${this.extractPlanNumber(this.phasePlan)}: ${this.generateHighLevelSummary(diff)}`);
    }

    return bullets;
  }

  private extractPlanNumber(phasePlan: string | null): string {
    if (!phasePlan) return '01';
    const match = phasePlan.match(/plan-(\d+)/);
    return match ? match[1].padStart(2, '0') : '01';
  }

  private generatePerPlanBullets(diff: string, planContext: PlanContext | null): string[] {
    const bullets: string[] = [];

    if (planContext?.tasks && planContext.tasks.length > 0) {
      planContext.tasks.forEach(task => {
        bullets.push(`${task}`);
        if (bullets.length >= 4) return;
      });
    } else if (planContext?.objective) {
      bullets.push(this.generateHighLevelSummary(diff));
    } else {
      bullets.push(this.generateHighLevelSummary(diff));
    }

    return bullets;
  }

  private generatePerTaskBullets(diff: string, planContext: PlanContext | null): string[] {
    const bullets: string[] = [];

    bullets.push(this.generateHighLevelSummary(diff));

    const secondBullet = this.generateSecondLevelSummary(diff);
    if (secondBullet) {
      bullets.push(secondBullet);
    }

    return bullets;
  }

  private generateHighLevelSummary(diff: string): string {
    const lowerDiff = diff.toLowerCase();

    if (lowerDiff.includes('test')) {
      return 'Add test coverage for new functionality';
    }

    if (lowerDiff.includes('fix')) {
      return 'Fix issue causing incorrect behavior';
    }

    if (lowerDiff.includes('new') || lowerDiff.includes('implement')) {
      return 'Implement new feature with proper validation';
    }

    if (lowerDiff.includes('refactor')) {
      return 'Improve code structure and readability';
    }

    if (lowerDiff.includes('performance')) {
      return 'Optimize performance for faster execution';
    }

    return 'Update code to meet requirements';
  }

  private generateSecondLevelSummary(diff: string): string | null {
    const lowerDiff = diff.toLowerCase();

    if (lowerDiff.includes('error') || lowerDiff.includes('exception')) {
      return 'Add proper error handling';
    }

    if (lowerDiff.includes('type') || lowerDiff.includes('interface')) {
      return 'Update type definitions';
    }

    if (lowerDiff.includes('import') || lowerDiff.includes('export')) {
      return 'Update module imports';
    }

    return null;
  }

  private printOutput(
    originalMessages: ParsedCommit[] | null,
    generatedMessage: string,
    mode: 'range' | 'hash' | 'working'
  ): void {
    const [start, end] = this.commitRange ? this.commitRange.split('..') : [null, null];

    if (mode === 'range') {
      console.log(`## Commit range: ${start}..${end}`);
      console.log('\n### Original commit messages:\n');
      
      if (originalMessages && originalMessages.length > 0) {
        originalMessages.forEach((msg, i) => {
          const subject = msg.body.split('\n')[0];
          console.log(`--- Commit ${i + 1}: ${msg.hash.substring(0, 8)} -- ${subject} ---\n`);
          console.log(msg.body);
          console.log('');
        });
      }

      console.log('\n### Generated message (using current Fuska rules):\n');
      console.log(generatedMessage);
      console.log('\n## Note:');
      console.log('- Working tree NOT modified (diff only, no cherry-pick or checkout)');
      console.log('- Safe to run anytime');
    } else if (mode === 'hash') {
      const originalMessage = originalMessages?.[0]?.body || '';
      console.log('## Original commit message:\n');
      console.log(originalMessage);
      console.log('\n## Generated message (using current Fuska rules):\n');
      console.log(generatedMessage);
      console.log('\n## To commit with this message:');
      console.log('git commit --amend -m "' + generatedMessage.replace(/\n/g, '\\n') + '"');
    } else {
      // Working tree mode
      if (this.isDefaultMode) {
        console.log(`## /fuska git-message Usage:
- No args: Generate commit message for current changes (unstaged + staged)
- <commit-hash>: Replay existing commit and regenerate message
- <commit-range>: Generate unified message for multiple commits (e.g., HEAD~5..HEAD)
- [phase-X-plan-Y]: Override auto-detect phase-plan context

`);
      }
      
      console.log(`${this.isDefaultMode ? '## Generated commit message for current changes:' : '## Generated commit message:'}\n`);
      console.log(generatedMessage);
      console.log('\n## To commit with this message:');
      console.log('git add <files> && git commit -m "' + generatedMessage.replace(/\n/g, '\\n') + '"');
    }
  }

  private parseJson(summary: string): any {
    const start = summary.indexOf('{');
    const end = summary.lastIndexOf('}');

    if (start === -1 || end === -1) {
      return {};
    }

    const jsonStr = summary.substring(start, end + 1);
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      return {};
    }
  }
}
