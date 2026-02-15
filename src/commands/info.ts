import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';

interface InfoNode {
  id: string;
  name: string;
  kind: string;
  summary: string;
  file_refs?: string[] | null;
}

interface CodebaseTech {
  focus_area: string;
  analysis_date: string;
  technologies?: { primary?: string; secondary?: string };
  frameworks?: { core?: string; testing?: string; build?: string };
  dependencies?: { critical?: Array<{ package: string; purpose: string }> };
  configuration?: { build?: string };
}

interface CodebaseArch {
  focus_area: string;
  analysis_date: string;
  pattern?: string;
  layers?: Array<{ name: string; location: string }>;
  entry_points?: Record<string, string>;
}

interface CodebaseQuality {
  focus_area: string;
  analysis_date: string;
  naming?: { files?: string; functions?: string; classes?: string };
  formatting?: { tool?: string; indentation?: string };
  test_framework?: string;
}

interface CodebaseConcerns {
  focus_area: string;
  analysis_date: string;
  tech_debt?: Array<{ area: string; issue: string }>;
  large_files?: Array<{ file: string; lines: number }>;
  test_gaps?: Array<{ area: string; what_missing: string }>;
}

class InfoRunner {
  private projectDir: string;
  private long: boolean;
  private verbose: boolean;
  private db: any;

  constructor(options: { projectDir: string; long: boolean; verbose: boolean }) {
    this.projectDir = options.projectDir;
    this.long = options.long;
    this.verbose = options.verbose;
  }

  async run(): Promise<void> {
    await this.preflightCheck();
    await this.displayInfo();
  }

  private async preflightCheck(): Promise<void> {
    const resolvedPath = path.resolve(this.projectDir);
    const dbPath = path.join(resolvedPath, '.megamemory', 'knowledge.db');

    if (!await fs.pathExists(dbPath)) {
      console.error(`No .megamemory/knowledge.db found at ${resolvedPath}`);
      console.error('Run /fuska-new-project or /fuska-new-initiative first.');
      process.exit(1);
    }

    const { KnowledgeDB } = await import('megamemory/dist/db.js');
    this.db = new KnowledgeDB(dbPath);
  }

  private async displayInfo(): Promise<void> {
    const nodes = this.db.getAllActiveNodes();

    const codebaseConcepts = this.findCodebaseConcepts(nodes);
    const domainConcepts = this.findDomainConcepts(nodes);

    if (codebaseConcepts.length === 0 && domainConcepts.length === 0) {
      console.log('No codebase or domain concepts found in MegaMemory.');
      console.log('');
      console.log('Run /map-codebase to create codebase mappings.');
      return;
    }

    console.log('');
    console.log('Project Knowledge');
    console.log('');

    if (codebaseConcepts.length > 0) {
      this.renderCodebaseSection(codebaseConcepts);
    }

    if (domainConcepts.length > 0) {
      if (codebaseConcepts.length > 0) {
        console.log('');
      }
      this.renderDomainsSection(domainConcepts);
    }

    console.log('');
  }

  private findCodebaseConcepts(nodes: InfoNode[]): InfoNode[] {
    const codebaseNodes: InfoNode[] = [];
    const codebaseNames = ['codebase-tech', 'codebase-arch', 'codebase-quality', 'codebase-concerns'];

    for (const node of nodes) {
      if (codebaseNames.includes(node.name)) {
        codebaseNodes.push(node);
      }
    }

    return codebaseNodes.sort((a, b) => {
      const order = ['codebase-tech', 'codebase-arch', 'codebase-quality', 'codebase-concerns'];
      return order.indexOf(a.name) - order.indexOf(b.name);
    });
  }

  private findDomainConcepts(nodes: InfoNode[]): InfoNode[] {
    return nodes
      .filter(node => node.kind === 'domain')
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private extractJson(summary: string): Record<string, unknown> {
    try {
      const jsonEnd = summary.indexOf('\n\n#');
      if (jsonEnd > 0) {
        return JSON.parse(summary.substring(0, jsonEnd));
      }
      const newlineBrace = summary.indexOf('\n}');
      if (newlineBrace > 0) {
        return JSON.parse(summary.substring(0, newlineBrace + 2));
      }
      return JSON.parse(summary);
    } catch {
      return {};
    }
  }

  private renderCodebaseSection(concepts: InfoNode[]): void {
    console.log('Codebase Mapping');
    console.log('');

    for (let i = 0; i < concepts.length; i++) {
      const concept = concepts[i];
      const isLast = i === concepts.length - 1;
      const connector = isLast ? '└─' : '├─';
      const childPrefix = isLast ? '   ' : '│  ';

      const data = this.extractJson(concept.summary);

      switch (concept.name) {
        case 'codebase-tech':
          this.renderTechStack(data as unknown as CodebaseTech, connector, childPrefix);
          break;
        case 'codebase-arch':
          this.renderArchitecture(data as unknown as CodebaseArch, connector, childPrefix);
          break;
        case 'codebase-quality':
          this.renderQuality(data as unknown as CodebaseQuality, connector, childPrefix);
          break;
        case 'codebase-concerns':
          this.renderConcerns(data as unknown as CodebaseConcerns, connector, childPrefix, concept.file_refs);
          break;
        default:
          console.log(`${connector} ${concept.name}`);
      }
    }
  }

  private renderTechStack(data: CodebaseTech, connector: string, prefix: string): void {
    console.log(`${connector} Tech Stack`);

    const items: string[] = [];

    if (data.technologies?.primary) {
      items.push(data.technologies.primary);
    }
    if (data.frameworks?.core) {
      items.push(data.frameworks.core);
    }
    if (data.frameworks?.testing) {
      items.push(data.frameworks.testing);
    }

    if (this.long && data.dependencies?.critical) {
      for (const dep of data.dependencies.critical.slice(0, 3)) {
        items.push(`${dep.package} - ${dep.purpose}`);
      }
    }

    this.renderItems(items, prefix);
  }

  private renderArchitecture(data: CodebaseArch, connector: string, prefix: string): void {
    console.log(`${connector} Architecture`);

    const items: string[] = [];

    if (data.pattern) {
      items.push(data.pattern);
    }

    if (data.layers) {
      for (const layer of data.layers.slice(0, this.long ? 10 : 3)) {
        items.push(`${layer.name} (${layer.location})`);
      }
    }

    this.renderItems(items, prefix);
  }

  private renderQuality(data: CodebaseQuality, connector: string, prefix: string): void {
    console.log(`${connector} Quality`);

    const items: string[] = [];

    if (data.naming?.files) {
      items.push(`Files: ${data.naming.files}`);
    }
    if (data.naming?.functions) {
      items.push(`Functions: ${data.naming.functions}`);
    }
    if (data.naming?.classes) {
      items.push(`Classes: ${data.naming.classes}`);
    }
    if (data.formatting?.tool) {
      items.push(`Formatter: ${data.formatting.tool}`);
    }
    if (data.test_framework) {
      items.push(`Tests: ${data.test_framework}`);
    }

    this.renderItems(items, prefix);
  }

  private renderConcerns(data: CodebaseConcerns, connector: string, prefix: string, fileRefs?: string[] | null): void {
    console.log(`${connector} Concerns`);

    const items: string[] = [];

    if (data.tech_debt) {
      for (const debt of data.tech_debt.slice(0, this.long ? 10 : 2)) {
        items.push(`${debt.area}: ${this.truncate(debt.issue, 40)}`);
      }
    }

    if (this.long && data.large_files) {
      for (const file of data.large_files.slice(0, 3)) {
        items.push(`Large: ${file.file} (${file.lines} lines)`);
      }
    }

    this.renderItems(items, prefix);

    if (this.long && fileRefs && Array.isArray(fileRefs) && fileRefs.length > 0) {
      console.log(`${prefix}├─ Files:`);
      for (let i = 0; i < fileRefs.length; i++) {
        const file = fileRefs[i];
        if (typeof file !== 'string') continue;
        const isLastFile = i === fileRefs.length - 1;
        const filePrefix = isLastFile ? '└─' : '├─';
        console.log(`${prefix}   ${filePrefix} ${file}`);
      }
    }
  }

  private parseFileRefs(fileRefs: string[] | string | null | undefined): string[] {
    if (!fileRefs) return [];
    if (Array.isArray(fileRefs)) return fileRefs;
    try {
      const parsed = JSON.parse(fileRefs);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private renderDomainsSection(domains: InfoNode[]): void {
    console.log('Domains');
    console.log('');

    for (let i = 0; i < domains.length; i++) {
      const domain = domains[i];
      const isLast = i === domains.length - 1;
      const connector = isLast ? '└─' : '├─';
      const childPrefix = isLast ? '   ' : '│  ';

      const displayName = this.formatDomainName(domain.name);
      const files = this.parseFileRefs(domain.file_refs);
      console.log(`${connector} ${displayName} (${files.length} files)`);

      const data = this.extractJson(domain.summary);
      const items: string[] = [];

      let description = data.description as string | undefined;
      if (!description && domain.summary) {
        description = domain.summary.split('\n')[0];
      }
      if (description) {
        items.push(this.truncate(description, 70));
      }
      if (data.responsibilities && Array.isArray(data.responsibilities)) {
        for (const resp of (data.responsibilities as string[]).slice(0, this.long ? 10 : 3)) {
          items.push(resp);
        }
      }

      const showFiles = this.long || (this.verbose && files.length <= 5);
      if (showFiles && files.length > 0) {
        items.push('');
        items.push('Files:');
        for (const file of files) {
          items.push(`  ${file}`);
        }
      }

      this.renderItems(items, childPrefix);
    }
  }

  private renderItems(items: string[], prefix: string): void {
    if (items.length === 0) {
      console.log(`${prefix}└─ (no data)`);
      return;
    }

    const maxItems = this.long ? 100 : (this.verbose ? 10 : 4);
    const displayItems = items.slice(0, maxItems);

    for (let i = 0; i < displayItems.length; i++) {
      const item = displayItems[i];
      const isLast = i === displayItems.length - 1 && items.length <= maxItems;
      const itemPrefix = isLast ? '└─' : '├─';

      const truncated = this.truncate(item, this.long ? 100 : 60);
      console.log(`${prefix}${itemPrefix} ${truncated}`);
    }

    if (items.length > maxItems) {
      console.log(`${prefix}└─ ... and ${items.length - maxItems} more`);
    }
  }

  private truncate(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) {
      return text || '';
    }
    return text.substring(0, maxLength - 3) + '...';
  }

  private formatDomainName(name: string): string {
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

export function infoCommand(program: Command) {
  program
    .command('info [project-path]')
    .description('Display codebase and domain mappings from MegaMemory')
    .option('-l, --long', 'Show full details including all file references')
    .option('-v, --verbose', 'Show file listings for domains with 5 or fewer files')
    .action(async (projectPath?: string, options?: { long?: boolean; verbose?: boolean }) => {
      const runner = new InfoRunner({
        projectDir: projectPath || process.cwd(),
        long: options?.long || false,
        verbose: options?.verbose || false
      });
      await runner.run();
    });
}
