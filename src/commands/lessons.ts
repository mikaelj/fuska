import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import { markdownToAnsi } from './utils/markdown-to-ansi';

interface LessonNode {
  id: string;
  name: string;
  kind: string;
  summary: string;
}

interface LessonData {
  source: string;
  category: string;
  error: string;
  solution: string;
  files_involved?: string[];
  created: string;
  applies_to_pattern?: string;
}

class LessonsRunner {
  private projectDir: string;
  private db: any;
  private jsonOutput: boolean;

  constructor(options: { projectDir: string; jsonOutput: boolean }) {
    this.projectDir = options.projectDir;
    this.jsonOutput = options.jsonOutput;
  }

  async run(): Promise<void> {
    await this.preflightCheck();
    await this.displayLessons();
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

  private async displayLessons(): Promise<void> {
    const nodes = this.db.getAllActiveNodes();
    
    const lessons = this.findLessons(nodes);
    
    if (lessons.length === 0) {
      if (this.jsonOutput) {
        console.log(JSON.stringify({ plan_lessons: [], code_lessons: [], total: 0 }, null, 2));
      } else {
        console.log('No lessons found in MegaMemory.');
        console.log('');
        console.log('Lessons are created when plan-checker or code-reviewer finds issues.');
      }
      return;
    }

    const lessonDataList: Array<{ node: LessonNode; data: LessonData }> = [];
    
    for (const lesson of lessons) {
      try {
        const jsonMatch = lesson.summary.match(/^\{[\s\S]*?\n\}/);
        let data: LessonData;
        
        if (jsonMatch) {
          data = JSON.parse(jsonMatch[0]) as LessonData;
        } else {
          data = JSON.parse(lesson.summary) as LessonData;
        }
        
        lessonDataList.push({ node: lesson, data });
      } catch (e) {
        // Skip unparseable lessons
      }
    }

    lessonDataList.sort((a, b) => {
      const dateA = new Date(a.data.created || 0).getTime();
      const dateB = new Date(b.data.created || 0).getTime();
      return dateB - dateA;
    });

    const planLessons = lessonDataList.filter(l => l.data.source === 'plan-checker');
    const codeLessons = lessonDataList.filter(l => l.data.source === 'code-reviewer');

    if (this.jsonOutput) {
      const output = {
        plan_lessons: planLessons.map(l => ({
          name: l.node.name,
          category: l.data.category,
          error: l.data.error,
          solution: l.data.solution,
          files_involved: l.data.files_involved || [],
          created: l.data.created
        })),
        code_lessons: codeLessons.map(l => ({
          name: l.node.name,
          dimension: l.data.category,
          error: l.data.error,
          solution: l.data.solution,
          files_involved: l.data.files_involved || [],
          created: l.data.created
        })),
        total: lessonDataList.length
      };
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    if (planLessons.length > 0) {
      console.log('Plan Lessons');
      console.log('');
      for (const lesson of planLessons) {
        this.printLesson(lesson, 'plan');
      }
    }

    if (planLessons.length > 0 && codeLessons.length > 0) {
      console.log('');
    }

    if (codeLessons.length > 0) {
      console.log('Code Lessons');
      console.log('');
      for (const lesson of codeLessons) {
        this.printLesson(lesson, 'code');
      }
    }

    console.log('');
    console.log(`Total: ${lessonDataList.length} lessons (${planLessons.length} plan, ${codeLessons.length} code)`);
  }

  private printLesson(lesson: { node: LessonNode; data: LessonData }, type: 'plan' | 'code'): void {
    const label = type === 'plan' ? lesson.data.category : lesson.data.category;
    const time = this.formatTime(lesson.data.created);
    
    console.log(`  [${label}] (${time})`);
    console.log(`  Error: ${markdownToAnsi(lesson.data.error, process.stdout.isTTY ?? false)}`);
    
    if (lesson.data.solution) {
      console.log(`  Solution: ${markdownToAnsi(lesson.data.solution, process.stdout.isTTY ?? false)}`);
    }
    
    if (lesson.data.files_involved && lesson.data.files_involved.length > 0) {
      console.log(`  Files: ${lesson.data.files_involved.join(', ')}`);
    }
    
    console.log('');
  }

  private findLessons(nodes: LessonNode[]): LessonNode[] {
    const lessons: LessonNode[] = [];

    for (const node of nodes) {
      if (node.kind !== 'pattern') continue;
      
      if (!node.name.startsWith('lesson-plan-') && !node.name.startsWith('lesson-code-')) {
        continue;
      }
      
      try {
        const jsonMatch = node.summary.match(/^\{[\s\S]*?\n\}/);
        const summaryText = jsonMatch ? jsonMatch[0] : node.summary;
        const data = JSON.parse(summaryText);
        
        if (data.source && data.error) {
          lessons.push(node);
        }
      } catch (e) {
        // Not a valid lesson, skip
      }
    }

    return lessons;
  }

  private formatTime(dateString: string): string {
    if (!dateString) return 'unknown';
    
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffDays < 30) {
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        const weeks = Math.floor(diffDays / 7);
        return `${weeks}w ago`;
      }

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const mins = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${mins}`;
    } catch (e) {
      return dateString;
    }
  }
}

export function lessonsCommand(program: Command) {
  program
    .command('lessons [project-path]')
    .description('List all lessons learned from plan-checker and code-reviewer')
    .option('--json', 'Output as JSON')
    .action(async (projectPath?: string, options?: { json?: boolean }) => {
      const runner = new LessonsRunner({
        projectDir: projectPath || process.cwd(),
        jsonOutput: options?.json || false
      });
      await runner.run();
    });
}
