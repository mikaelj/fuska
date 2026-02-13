import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';

interface TaskNode {
  id: string;
  name: string;
  kind: string;
  summary: string;
}

interface TaskData {
  task_number: string;
  slug: string;
  description: string;
  status: string;
  mode: string;
  created_at?: string;
  completed_at?: string;
  commit?: string;
}

class TodoRunner {
  private projectDir: string;
  private db: any;

  constructor(options: { projectDir: string }) {
    this.projectDir = options.projectDir;
  }

  async run(): Promise<void> {
    await this.preflightCheck();
    await this.displayTodos();
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

  private async displayTodos(): Promise<void> {
    const nodes = this.db.getAllActiveNodes();
    
    // Find all task concepts
    const tasks = this.findTasks(nodes);
    
    if (tasks.length === 0) {
      console.log('No tasks found in MegaMemory.');
      console.log('');
      console.log('Tasks are created when you run /fuska-new-task.');
      return;
    }

    // Build a map of summary nodes
    const summaryMap = new Map<string, TaskNode>();
    for (const node of nodes) {
      if (node.name.startsWith('task-') && node.name.endsWith('-summary')) {
        const taskName = node.name.replace('-summary', '');
        summaryMap.set(taskName, node);
      }
    }

    // Parse task data and separate into completed and pending
    const taskDataList: Array<{ node: TaskNode; data: TaskData; summary?: any }> = [];
    
    for (const task of tasks) {
      try {
        // Extract JSON from summary (may have markdown after the JSON)
        const jsonMatch = task.summary.match(/^\{[\s\S]*?\n\}/);
        let data: TaskData;
        
        if (jsonMatch) {
          data = JSON.parse(jsonMatch[0]) as TaskData;
        } else {
          // Try parsing the whole thing
          data = JSON.parse(task.summary) as TaskData;
        }

        // Check for summary node
        const summaryNode = summaryMap.get(task.name);
        let summaryData: any = undefined;
        
        if (summaryNode) {
          try {
            const summaryJsonMatch = summaryNode.summary.match(/^\{[\s\S]*?\n\}/);
            if (summaryJsonMatch) {
              summaryData = JSON.parse(summaryJsonMatch[0]);
            } else {
              summaryData = JSON.parse(summaryNode.summary);
            }
            // If summary exists, task is completed
            if (!data.status || data.status === 'planned' || data.status === 'planning') {
              data.status = 'completed';
            }
          } catch (e) {
            // Summary parsing failed, that's okay
          }
        }
        
        taskDataList.push({ node: task, data, summary: summaryData });
      } catch (e) {
        // If parsing fails, create a basic task data from the node
        const summaryNode = summaryMap.get(task.name);
        
        taskDataList.push({
          node: task,
          data: {
            task_number: this.extractTaskNumber(task.name),
            slug: task.name.replace(/^task-\d+-/, ''),
            description: task.name.replace(/[-_]/g, ' '),
            status: summaryNode ? 'completed' : 'unknown',
            mode: 'unknown'
          },
          summary: summaryNode ? { commit: 'unknown' } : undefined
        });
      }
    }

    // Sort by task number
    taskDataList.sort((a, b) => {
      const numA = parseInt(a.data.task_number || '0');
      const numB = parseInt(b.data.task_number || '0');
      return numA - numB;
    });

    // Separate completed and pending
    const completed = taskDataList.filter(t => 
      t.data.status === 'completed' || 
      t.data.status === 'done' ||
      t.data.status === 'complete'
    );
    
    const pending = taskDataList.filter(t => 
      t.data.status === 'planned' || 
      t.data.status === 'planning' ||
      t.data.status === 'in_progress' ||
      t.data.status === 'in-progress' ||
      t.data.status === 'unknown'
    );

    // Display sections
    if (completed.length > 0) {
      console.log('Completed Tasks');
      console.log('');
      for (const task of completed) {
        const checkbox = '✓';
        const taskNum = `Task ${task.data.task_number.padStart(3, '0')}`;
        const desc = task.data.description || task.data.slug.replace(/[-_]/g, ' ');
        const date = task.summary?.completed_at ? this.formatDate(task.summary.completed_at) : 
                     (task.data.completed_at ? this.formatDate(task.data.completed_at) : '');
        const commit = task.summary?.commit ? ` [${task.summary.commit}]` : 
                       (task.data.commit ? ` [${task.data.commit}]` : '');
        
        console.log(`  ${checkbox} ${taskNum}: ${desc}${date ? ` (${date})` : ''}${commit}`);
      }
    }

    if (completed.length > 0 && pending.length > 0) {
      console.log('');
    }

    if (pending.length > 0) {
      console.log('Pending Tasks');
      console.log('');
      for (const task of pending) {
        const bullet = '○';
        const taskNum = `Task ${task.data.task_number.padStart(3, '0')}`;
        const desc = task.data.description || task.data.slug.replace(/[-_]/g, ' ');
        const status = task.data.status !== 'planned' ? ` (${task.data.status})` : '';
        
        console.log(`  ${bullet} ${taskNum}: ${desc}${status}`);
      }
    }

    // Summary
    console.log('');
    console.log(`Total: ${taskDataList.length} tasks (${completed.length} completed, ${pending.length} pending)`);
  }

  private findTasks(nodes: TaskNode[]): TaskNode[] {
    const tasks: TaskNode[] = [];

    for (const node of nodes) {
      // Skip summary nodes
      if (node.name.endsWith('-summary')) {
        continue;
      }

      // Check if this is a task node
      if (node.name.startsWith('task-')) {
        // Verify it has a task number pattern
        if (/^task-\d+/.test(node.name)) {
          tasks.push(node);
        }
      }
    }

    return tasks;
  }

  private extractTaskNumber(name: string): string {
    const match = name.match(/^task-(\d+)/);
    return match ? match[1] : '000';
  }

  private formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch (e) {
      return dateString;
    }
  }
}

export function todoCommand(program: Command) {
  program
    .command('todo [project-path]')
    .description('List all completed and pending Fuska tasks')
    .action(async (projectPath?: string) => {
      const runner = new TodoRunner({
        projectDir: projectPath || process.cwd()
      });
      await runner.run();
    });
}
