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
  private originalCommitBody: string | null = null;

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
    
    // Store the original commit body for later use in body generation
    this.originalCommitBody = originalMessage;

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
    const scope = this.determineScopeFromDiff(diffContent);
    const subject = this.formatSubject(type, scope, diffContent);
    const body = this.formatBody(diffContent, planContext);
    const footer = this.formatFooter();

    let message = `${subject}\n\n${body}`;
    if (footer) {
      message += `\n\n${footer}`;
    }
    return message.trim();
  }

  private determineCommitType(diff: string): string {
    const files = this.extractChangedFiles(diff);
    const addedLines = this.extractAddedLines(diff);
    const removedLines = this.extractRemovedLines(diff);
    const lowerDiff = diff.toLowerCase();

    // Test files
    if (files.some(f => f.includes('.test.') || f.includes('.spec.') || f.includes('__tests__'))) {
      return 'test';
    }

    // Documentation files
    if (files.every(f => f.endsWith('.md') || f.endsWith('.txt') || f.endsWith('.rst'))) {
      return 'docs';
    }

    // Check for bug fixes: fixing errors, exceptions, correcting logic
    const hasErrorHandling = addedLines.some(l => 
      l.includes('catch') || l.includes('Error(') || l.includes('throw') || l.includes('.error')
    );
    const hasFixKeywords = lowerDiff.includes('fix') || lowerDiff.includes('bug') || lowerDiff.includes('issue');
    const hasCorrection = addedLines.some(l => l.includes('correct') || l.includes('properly'));
    
    // More lines removed than added = likely a fix/refactor, not new feature
    const isMostlyRemoval = removedLines.length > addedLines.length * 0.7;
    
    if ((hasFixKeywords || hasCorrection || hasErrorHandling) && isMostlyRemoval) {
      return 'fix';
    }

    // Style changes: formatting, whitespace, semicolons, etc.
    const hasFormattingOnly = addedLines.every(l => 
      l.trim() === '' || 
      l.trim() === ';' || 
      l.trim() === ',' ||
      l.match(/^[\s{}()\[\];,]+$/) !== null
    );
    if (hasFormattingOnly && addedLines.length < 20) {
      return 'style';
    }

    // Refactor: restructuring without changing behavior
    const hasRefactorKeywords = lowerDiff.includes('refactor') || 
      lowerDiff.includes('reorg') || 
      lowerDiff.includes('restructure') ||
      lowerDiff.includes('rename') ||
      lowerDiff.includes('extract') ||
      lowerDiff.includes('move');
    
    // Similar amounts added/removed = likely refactor
    const isBalanced = Math.abs(addedLines.length - removedLines.length) < Math.max(addedLines.length, removedLines.length) * 0.3;
    
    if (hasRefactorKeywords || (isBalanced && addedLines.length > 5)) {
      return 'refactor';
    }

    // Performance improvements
    if (lowerDiff.includes('performance') || lowerDiff.includes('perf') || lowerDiff.includes('optimize')) {
      return 'perf';
    }

    // Chore: build, config, dependencies, tooling
    if (files.some(f => 
      f.includes('package.json') || 
      f.includes('.config') || 
      f.includes('tsconfig') ||
      f.includes('.yaml') ||
      f.includes('.yml') ||
      f.includes('Makefile') ||
      f.includes('Dockerfile')
    )) {
      return 'chore';
    }

    // Default: new feature (net addition of code)
    return 'feat';
  }

  private determineScopeFromDiff(diff: string): string {
    const files = this.extractChangedFiles(diff);
    const addedLines = this.extractAddedLines(diff);
    const removedLines = this.extractRemovedLines(diff);
    const functionsAdded = this.extractFunctionNames(addedLines);
    const functionsRemoved = this.extractFunctionNames(removedLines);
    const allFunctions = [...functionsAdded, ...functionsRemoved];

    // Try to get scope from function names first (most specific)
    const functionScope = this.deriveScopeFromFunctions(allFunctions);
    if (functionScope) {
      return functionScope;
    }

    // Try to get scope from diff content keywords
    const keywordScope = this.deriveScopeFromKeywords(diff);
    if (keywordScope) {
      return keywordScope;
    }

    // If only one file changed, derive scope from that
    if (files.length === 1) {
      const fileScope = this.deriveScopeFromFile(files[0]);
      if (!this.isGenericScope(fileScope)) {
        return fileScope;
      }
      // File scope is generic, try combining with function hint
      if (allFunctions.length > 0) {
        const funcHint = this.extractFunctionHint(allFunctions[0]);
        return this.formatScopeName(`${fileScope}-${funcHint}`);
      }
      return fileScope; // Fall back to generic if no better option
    }

    // If multiple files, try to find a common pattern
    if (files.length > 1) {
      // Check if all files share a directory
      const dirs = files.map(f => {
        const parts = f.split('/');
        return parts.length > 1 ? parts[0] : '';
      }).filter(d => d);
      
      if (dirs.length > 0 && dirs.every(d => d === dirs[0])) {
        const dirScope = this.formatScopeName(dirs[0]);
        if (!this.isGenericScope(dirScope)) {
          return dirScope;
        }
        // Directory is generic, try to extract scope from file names
        const primaryFile = this.getPrimaryFile(files);
        const fileScope = this.deriveScopeFromFile(primaryFile);
        if (!this.isGenericScope(fileScope)) {
          return fileScope;
        }
      }

      // Otherwise use the primary file
      const primaryFile = this.getPrimaryFile(files);
      return this.deriveScopeFromFile(primaryFile);
    }

    // Fallback: no scope
    return '';
  }

  private isGenericScope(scope: string): boolean {
    const genericScopes = new Set([
      'lib', 'src', 'dist', 'utils', 'helpers', 'common', 'shared',
      'core', 'base', 'main', 'app', 'index', 'types', 'constants',
      'config', 'test', 'tests', 'spec', 'specs', 'public', 'private',
      'internal', 'external', 'vendor', 'node-modules', 'build',
      'scope', 'change', 'update', 'add', 'remove', 'fix', 'new',
      'code', 'file', 'function', 'method', 'class', 'module'
    ]);
    return genericScopes.has(scope.toLowerCase());
  }

  private deriveScopeFromFunctions(functions: string[]): string | null {
    if (functions.length === 0) return null;

    // Try to derive meaningful scope from function names
    for (const func of functions) {
      const scope = this.extractFunctionHint(func);
      if (scope && !this.isGenericScope(scope)) {
        return this.formatScopeName(scope);
      }
    }
    return null;
  }

  private extractFunctionHint(functionName: string): string {
    // Extract meaningful part from function name
    // e.g., calculatePriceForPreview -> pricing
    // e.g., getServiceItemCost -> service-item-cost or service-item
    // e.g., handleUserLogin -> user-login or auth
    
    const name = functionName
      .replace(/^(get|set|add|remove|update|delete|handle|process|calculate|compute|validate|parse|format|create|build|generate|fetch|load|save|init|is|has|can|should)/i, '')
      .replace(/^(async|sync)$/, '');
    
    if (name.length < 3) return functionName.toLowerCase();
    
    // Convert camelCase to words
    const words = name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(' ');
    
    // Map common patterns to domains
    const domainMappings: Record<string, string> = {
      'price': 'pricing',
      'cost': 'cost-calc',
      'discount': 'pricing',
      'payment': 'payment',
      'user': 'user',
      'auth': 'auth',
      'login': 'auth',
      'logout': 'auth',
      'token': 'auth',
      'session': 'session',
      'worktree': 'worktree',
      'commit': 'git-msg',
      'branch': 'git-branch',
      'merge': 'git-merge',
      'message': 'msg',
      'config': 'cfg',
      'database': 'db',
      'cache': 'cache',
      'file': 'file',
      'path': 'path',
      'url': 'url',
      'api': 'api',
      'request': 'api',
      'response': 'api',
      'error': 'error',
      'exception': 'error',
      'validation': 'validation',
      'validate': 'validation',
      'test': 'test',
      'spec': 'test'
    };
    
    // Check for domain keywords in function name
    for (const word of words) {
      if (domainMappings[word]) {
        return domainMappings[word];
      }
    }
    
    // Return first significant word (skip common prefixes)
    const skipWords = new Set(['for', 'with', 'from', 'to', 'by', 'and', 'or', 'the', 'a', 'an']);
    for (const word of words) {
      if (word.length > 2 && !skipWords.has(word)) {
        return word;
      }
    }
    
    // Fall back to formatted function name
    return this.formatScopeName(functionName);
  }

  private deriveScopeFromKeywords(diff: string): string | null {
    const lowerDiff = diff.toLowerCase();
    const allLines = diff.split('\n');
    
    // Domain keyword groups with their associated scope
    const domainGroups: Array<{ keywords: string[]; scope: string }> = [
      { keywords: ['price', 'cost', 'discount', 'subtotal', 'total', 'currency'], scope: 'pricing' },
      { keywords: ['payment', 'checkout', 'billing', 'invoice', 'charge'], scope: 'payment' },
      { keywords: ['user', 'account', 'profile', 'customer'], scope: 'user' },
      { keywords: ['auth', 'login', 'logout', 'password', 'credential', 'token'], scope: 'auth' },
      { keywords: ['session', 'cookie'], scope: 'session' },
      { keywords: ['worktree', 'git worktree'], scope: 'worktree' },
      { keywords: ['commit', 'git-message', 'commit message'], scope: 'git-msg' },
      { keywords: ['branch', 'checkout', 'merge'], scope: 'git-branch' },
      { keywords: ['megamemory', 'knowledge graph', 'concept'], scope: 'megamemory' },
      { keywords: ['fuska', 'phase', 'plan'], scope: 'fuska' },
      { keywords: ['worktree-merge', 'merge worktrees'], scope: 'worktree-merge' },
      { keywords: ['template', 'template file'], scope: 'template' },
      { keywords: ['workflow', 'command'], scope: 'workflow' },
      { keywords: ['api', 'endpoint', 'request', 'response'], scope: 'api' },
      { keywords: ['database', 'db', 'query', 'sql'], scope: 'db' },
      { keywords: ['cache', 'cached', 'caching'], scope: 'cache' },
      { keywords: ['test', 'spec', 'testing', 'mock'], scope: 'test' },
      { keywords: ['error', 'exception', 'catch', 'throw'], scope: 'error' },
      { keywords: ['validation', 'validate', 'validator'], scope: 'validation' },
      { keywords: ['config', 'configuration', 'settings'], scope: 'config' },
      { keywords: ['cli', 'command', 'argument'], scope: 'cli' }
    ];
    
    // Score each domain group based on keyword matches
    const scores: Map<string, number> = new Map();
    
    for (const group of domainGroups) {
      let score = 0;
      for (const keyword of group.keywords) {
        // Count occurrences of keyword
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = lowerDiff.match(regex);
        if (matches) {
          score += matches.length;
        }
      }
      if (score > 0) {
        scores.set(group.scope, score);
      }
    }
    
    // Return the highest scoring domain
    let bestScope: string | null = null;
    let bestScore = 0;
    for (const [scope, score] of scores) {
      if (score > bestScore) {
        bestScore = score;
        bestScope = scope;
      }
    }
    
    return bestScope;
  }

  private deriveScopeFromFile(filePath: string): string {
    // Extract the base file name
    const fileName = filePath.split('/').pop() || filePath;
    
    // Remove common suffixes
    const baseName = fileName
      .replace(/\.(ts|js|tsx|jsx|py|go|rs|java|c|cpp|h|hpp|md|txt|json|yaml|yml)$/, '')
      .replace(/\.test$/, '')
      .replace(/\.spec$/, '')
      .replace(/\.config$/, '')
      .replace(/\.types$/, '')
      .replace(/-test$/, '')
      .replace(/-spec$/, '');

    // Convert camelCase/PascalCase to kebab-case
    const kebabName = baseName
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
      .toLowerCase();

    // Shorten common patterns
    let scope = this.formatScopeName(kebabName);
    
    // If scope is generic, try to extract more specific parts
    if (this.isGenericScope(scope)) {
      // Try to extract meaningful parts from path
      const pathParts = filePath.split('/').filter(p => !this.isGenericScope(p));
      if (pathParts.length > 0) {
        const meaningfulPart = pathParts[pathParts.length - 1].replace(/\.[^.]+$/, '');
        scope = this.formatScopeName(meaningfulPart);
      }
    }
    
    return scope;
  }

  private formatScopeName(name: string): string {
    // Truncate to reasonable length (max 15 chars for scope)
    let scope = name.toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    // Common abbreviations
    const abbreviations: Record<string, string> = {
      'message': 'msg',
      'command': 'cmd',
      'config': 'cfg',
      'database': 'db',
      'management': 'mgmt',
      'implementation': 'impl',
      'initialize': 'init',
      'authentication': 'auth',
      'authorization': 'authz',
      'development': 'dev',
      'production': 'prod',
      'environment': 'env',
      'performance': 'perf',
      'documentation': 'docs',
      'calculation': 'calc',
      'calculator': 'calc',
      'worktree': 'worktree',
      'megamemory': 'mm',
    };

    // Apply abbreviations
    for (const [full, abbr] of Object.entries(abbreviations)) {
      scope = scope.replace(new RegExp(full, 'g'), abbr);
    }

    // If still too long, take first two significant parts
    if (scope.length > 15) {
      const parts = scope.split('-').filter(p => p.length > 2);
      if (parts.length > 2) {
        scope = parts.slice(0, 2).join('-');
      }
    }

    return scope.substring(0, 15);
  }

  private formatFooter(): string {
    if (!this.phasePlan) {
      return '';
    }

    // Extract phase and plan numbers
    const match = this.phasePlan.match(/phase-(\d+)(?:-plan-(\d+))?/);
    if (!match) {
      return '';
    }

    const phaseNum = match[1].padStart(2, '0');
    const planNum = match[2] ? match[2].padStart(2, '0') : null;

    if (planNum) {
      return `Work on phase${phaseNum}-plan${planNum}`;
    } else {
      return `Work on phase${phaseNum}`;
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
    // Parse diff to extract meaningful information
    const files = this.extractChangedFiles(diff);
    const addedLines = this.extractAddedLines(diff);
    const removedLines = this.extractRemovedLines(diff);
    const functionsAdded = this.extractFunctionNames(addedLines);
    const functionsRemoved = this.extractFunctionNames(removedLines);
    
    // Detect change type and construct specific description
    const isTest = files.some(f => f.includes('.test.') || f.includes('.spec.') || f.includes('__tests__'));
    const isConfig = files.some(f => f.includes('config') || f.includes('.json') || f.includes('.yaml') || f.includes('.yml'));
    const isDocs = files.some(f => f.endsWith('.md') || f.endsWith('.txt'));
    
    // For test files
    if (isTest && files.length === 1) {
      const testFile = files[0].split('/').pop() || files[0];
      return `add tests for ${this.cleanFileName(testFile)}`;
    }
    
    // For config changes
    if (isConfig && files.length === 1) {
      const configFile = files[0].split('/').pop() || files[0];
      return `update ${configFile}`;
    }
    
    // For documentation
    if (isDocs && files.length === 1) {
      const docFile = files[0].split('/').pop() || files[0];
      return `update ${docFile}`;
    }
    
    // Function replacement pattern
    if (functionsRemoved.length > 0 && functionsAdded.length > 0) {
      const primaryRemoved = functionsRemoved[0];
      const primaryAdded = functionsAdded[0];
      if (primaryRemoved !== primaryAdded) {
        return `replace ${primaryRemoved} with ${primaryAdded}`;
      }
    }
    
    // New function added
    if (functionsAdded.length > 0 && functionsRemoved.length === 0) {
      return `add ${functionsAdded[0]} function`;
    }
    
    // Function removed
    if (functionsRemoved.length > 0 && functionsAdded.length === 0) {
      return `remove ${functionsRemoved[0]} function`;
    }
    
    // Analyze added/removed patterns for specific changes
    const changePattern = this.detectChangePattern(addedLines, removedLines);
    if (changePattern) {
      return changePattern;
    }
    
    // Fall back to file-based description
    if (files.length === 1) {
      const fileName = files[0].split('/').pop() || files[0];
      const baseName = this.cleanFileName(fileName);
      return `update ${baseName}`;
    }
    
    if (files.length > 1) {
      const primaryFile = this.getPrimaryFile(files);
      const baseName = this.cleanFileName(primaryFile.split('/').pop() || primaryFile);
      return `update ${baseName} and ${files.length - 1} other file${files.length > 2 ? 's' : ''}`;
    }
    
    return 'update code';
  }
  
  private extractChangedFiles(diff: string): string[] {
    const files: string[] = [];
    const lines = diff.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('diff --git ')) {
        const match = line.match(/diff --git a\/(.+?) b\/(.+)$/);
        if (match) {
          files.push(match[2]); // Use the 'b/' path (new file)
        }
      }
    }
    
    return files;
  }
  
  private extractAddedLines(diff: string): string[] {
    return diff.split('\n')
      .filter(l => l.startsWith('+') && !l.startsWith('+++'))
      .map(l => l.substring(1).trim());
  }
  
  private extractRemovedLines(diff: string): string[] {
    return diff.split('\n')
      .filter(l => l.startsWith('-') && !l.startsWith('---'))
      .map(l => l.substring(1).trim());
  }
  
  private extractFunctionNames(lines: string[]): string[] {
    const functions: string[] = [];
    
    for (const line of lines) {
      // JavaScript/TypeScript: function name, const name =, async function name
      let match = line.match(/(?:async\s+)?function\s+(\w+)/);
      if (match) { functions.push(match[1]); continue; }
      
      match = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(?/);
      if (match) { functions.push(match[1]); continue; }
      
      // Class methods
      match = line.match(/^\s+(\w+)\s*\(/);
      if (match && !['if', 'for', 'while', 'switch', 'catch'].includes(match[1])) {
        functions.push(match[1]);
        continue;
      }
      
      // Python: def name
      match = line.match(/def\s+(\w+)/);
      if (match) { functions.push(match[1]); continue; }
      
      // Go: func name
      match = line.match(/func\s+(?:\([^)]+\)\s*)?(\w+)/);
      if (match) { functions.push(match[1]); continue; }
    }
    
    return [...new Set(functions)]; // Dedupe
  }
  
  private cleanFileName(fileName: string): string {
    return fileName
      .replace(/\.(ts|js|tsx|jsx|py|go|rs|java|c|cpp|h|hpp)$/, '')
      .replace(/\.test$/, '')
      .replace(/\.spec$/, '')
      .replace(/-/g, ' ');
  }
  
  private getPrimaryFile(files: string[]): string {
    // Prefer source files over tests, configs, dist, etc.
    const sourceFiles = files.filter(f => 
      !f.includes('.test.') && 
      !f.includes('.spec.') && 
      !f.includes('__tests__') &&
      !f.includes('node_modules') &&
      !f.includes('.json') &&
      !f.includes('/dist/') &&
      !f.includes('.d.ts') &&
      !f.endsWith('.map') &&
      !f.endsWith('.js.map')
    );
    
    return sourceFiles[0] || files[0];
  }
  
  private detectChangePattern(addedLines: string[], removedLines: string[]): string | null {
    const addedStr = addedLines.join(' ');
    const removedStr = removedLines.join(' ');
    
    // Import changes
    if (addedStr.includes('import ') || addedStr.includes('require(')) {
      return 'update imports';
    }
    
    // Type/interface changes
    if (addedStr.includes('interface ') || addedStr.includes('type ')) {
      return 'update type definitions';
    }
    
    // Error handling
    if (addedStr.includes('try {') || addedStr.includes('catch') || addedStr.includes('throw')) {
      return 'add error handling';
    }
    
    // Console/log statements
    if (addedStr.includes('console.log') || addedStr.includes('console.error')) {
      if (removedStr.includes('console.log') || removedStr.includes('console.error')) {
        return 'update logging statements';
      }
      return 'add logging';
    }
    
    // Export changes
    if (addedStr.includes('export ') && !removedStr.includes('export ')) {
      return 'add exports';
    }
    
    return null;
  }

  private formatBody(diff: string, planContext: PlanContext | null): string {
    const bullets: string[] = [];
    
    // When regenerating from commit hash, extract bullets from original message
    if (this.commitHash && this.originalCommitBody) {
      const originalBullets = this.extractBulletsFromMessage(this.originalCommitBody);
      if (originalBullets.length > 0) {
        // Use original bullets, potentially enhanced with diff analysis
        return originalBullets.slice(0, 4).map((b: string) => `- ${b}`).join('\n');
      }
    }

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

    return bullets.slice(0, 4).map((b: string) => `- ${b}`).join('\n');
  }

  private generatePerPhaseBullets(diff: string, planContext: PlanContext | null): string[] {
    const bullets: string[] = [];
    
    // Extract specific changes from the diff for bullet points
    const files = this.extractChangedFiles(diff);
    const addedLines = this.extractAddedLines(diff);
    const removedLines = this.extractRemovedLines(diff);
    const functionsAdded = this.extractFunctionNames(addedLines);
    const functionsRemoved = this.extractFunctionNames(removedLines);

    // If we have plan context with completed tasks, use them
    if (planContext?.completed && planContext.completed.length > 0) {
      bullets.push(`Plan ${this.extractPlanNumber(this.phasePlan)}: ${planContext.completed[0]}`);
    } else {
      // Generate specific bullet from diff analysis
      bullets.push(`Plan ${this.extractPlanNumber(this.phasePlan)}: ${this.generateHighLevelSummary(diff)}`);
    }
    
    // Add specific change details
    if (functionsAdded.length > 0) {
      bullets.push(`Add ${functionsAdded.slice(0, 3).join(', ')} function${functionsAdded.length > 1 ? 's' : ''}`);
    }
    
    if (functionsRemoved.length > 0) {
      bullets.push(`Remove ${functionsRemoved.slice(0, 3).join(', ')} function${functionsRemoved.length > 1 ? 's' : ''}`);
    }
    
    // Check for specific patterns in the diff
    const importChanges = addedLines.filter(l => l.includes('import ') || l.includes('require('));
    if (importChanges.length > 0) {
      const moduleNames = importChanges
        .map(l => {
          const match = l.match(/from\s+['"]([^'"]+)['"]/) || l.match(/require\s*\(\s*['"]([^'"]+)['"]/);
          return match ? match[1] : null;
        })
        .filter((m): m is string => m !== null)
        .slice(0, 3);
      
      if (moduleNames.length > 0) {
        bullets.push(`Import ${moduleNames.join(', ')}`);
      }
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
    
    // Extract specific changes from the diff
    const files = this.extractChangedFiles(diff);
    const addedLines = this.extractAddedLines(diff);
    const removedLines = this.extractRemovedLines(diff);
    const functionsAdded = this.extractFunctionNames(addedLines);
    const functionsRemoved = this.extractFunctionNames(removedLines);

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
    
    // Add specific implementation details
    if (functionsAdded.length > 0 && bullets.length < 4) {
      bullets.push(`Implement ${functionsAdded.slice(0, 2).join(' and ')}`);
    }
    
    if (files.length > 0 && bullets.length < 4) {
      const primaryFile = this.getPrimaryFile(files);
      const fileName = this.cleanFileName(primaryFile.split('/').pop() || '');
      bullets.push(`Update ${fileName}`);
    }

    return bullets;
  }

  private generatePerTaskBullets(diff: string, planContext: PlanContext | null): string[] {
    const bullets: string[] = [];
    
    // Extract specific changes from the diff
    const files = this.extractChangedFiles(diff);
    const addedLines = this.extractAddedLines(diff);
    const removedLines = this.extractRemovedLines(diff);
    const functionsAdded = this.extractFunctionNames(addedLines);

    bullets.push(this.generateHighLevelSummary(diff));

    // Add specific implementation details
    if (functionsAdded.length > 0) {
      bullets.push(`Add ${functionsAdded[0]} function`);
    } else if (files.length > 0) {
      const primaryFile = this.getPrimaryFile(files);
      const fileName = this.cleanFileName(primaryFile.split('/').pop() || '');
      bullets.push(`Modify ${fileName}`);
    }

    const secondBullet = this.generateSecondLevelSummary(diff);
    if (secondBullet && bullets.length < 4) {
      bullets.push(secondBullet);
    }

    return bullets;
  }

  private generateHighLevelSummary(diff: string): string {
    // Extract specific changes from the diff
    const files = this.extractChangedFiles(diff);
    const addedLines = this.extractAddedLines(diff);
    const removedLines = this.extractRemovedLines(diff);
    const functionsAdded = this.extractFunctionNames(addedLines);
    const functionsRemoved = this.extractFunctionNames(removedLines);
    
    // Check for specific patterns
    const isTest = files.some(f => f.includes('.test.') || f.includes('.spec.'));
    const lowerDiff = diff.toLowerCase();
    
    // Test changes
    if (isTest) {
      const testFile = files.find(f => f.includes('.test.') || f.includes('.spec.'));
      if (testFile) {
        const testName = this.cleanFileName(testFile.split('/').pop() || '');
        return `Add tests for ${testName}`;
      }
      return 'Add test coverage';
    }
    
    // Function replacements
    if (functionsRemoved.length > 0 && functionsAdded.length > 0) {
      return `Replace ${functionsRemoved[0]} with ${functionsAdded[0]}`;
    }
    
    // New functions
    if (functionsAdded.length > 0) {
      return `Add ${functionsAdded[0]} function`;
    }
    
    // Removed functions
    if (functionsRemoved.length > 0) {
      return `Remove ${functionsRemoved[0]} function`;
    }
    
    // Import changes
    const importChanges = addedLines.filter(l => l.includes('import ') || l.includes('require('));
    if (importChanges.length > 0) {
      return 'Update imports and dependencies';
    }
    
    // Type/interface changes
    const typeChanges = addedLines.filter(l => l.includes('interface ') || l.includes('type '));
    if (typeChanges.length > 0) {
      return 'Update type definitions';
    }
    
    // Error handling
    const errorHandling = addedLines.filter(l => 
      l.includes('try ') || l.includes('catch') || l.includes('throw ') || l.includes('Error(')
    );
    if (errorHandling.length > 0) {
      return 'Add error handling and validation';
    }
    
    // Logging changes
    const logChanges = addedLines.filter(l => l.includes('console.') || l.includes('logger.'));
    if (logChanges.length > 0) {
      return 'Update logging and diagnostics';
    }
    
    // Analyze the primary file being changed
    if (files.length > 0) {
      const primaryFile = this.getPrimaryFile(files);
      const fileName = this.cleanFileName(primaryFile.split('/').pop() || '');
      
      // Check the nature of changes based on added/removed lines ratio
      if (addedLines.length > removedLines.length * 2) {
        return `Extend ${fileName} with new functionality`;
      } else if (removedLines.length > addedLines.length * 2) {
        return `Simplify ${fileName} by removing unused code`;
      }
      
      return `Update ${fileName} implementation`;
    }
    
    return 'Update code implementation';
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
  
  private extractBulletsFromMessage(message: string): string[] {
    const bullets: string[] = [];
    const lines = message.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      // Match bullet points: "- text" or "* text"
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const bullet = trimmed.substring(2).trim();
        if (bullet && !bullet.startsWith('#')) {
          bullets.push(bullet);
        }
      }
    }
    
    return bullets;
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
