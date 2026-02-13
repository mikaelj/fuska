import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';

interface TodoNode {
  id: string;
  name: string;
  kind: string;
  summary: string;
}

interface TodoData {
  title: string;
  area: string;
  status: string;
  created: string;
  files?: string[];
  problem?: string;
  solution?: string;
  completedAt?: string;
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
    
    const todos = this.findTodos(nodes);
    
    if (todos.length === 0) {
      console.log('No todos found in MegaMemory.');
      console.log('');
      console.log('Todos are created when you run /fuska-add-todo.');
      return;
    }

    const todoDataList: Array<{ node: TodoNode; data: TodoData }> = [];
    
    for (const todo of todos) {
      try {
        const jsonMatch = todo.summary.match(/^\{[\s\S]*?\n\}/);
        let data: TodoData;
        
        if (jsonMatch) {
          data = JSON.parse(jsonMatch[0]) as TodoData;
        } else {
          data = JSON.parse(todo.summary) as TodoData;
        }
        
        todoDataList.push({ node: todo, data });
      } catch (e) {
        // Skip unparseable todos
      }
    }

    todoDataList.sort((a, b) => {
      const dateA = new Date(a.data.created || 0).getTime();
      const dateB = new Date(b.data.created || 0).getTime();
      return dateB - dateA; // Newest first
    });

    const done = todoDataList.filter(t => 
      t.data.status === 'done' || 
      t.data.status === 'completed'
    );
    
    const pending = todoDataList.filter(t => 
      t.data.status === 'pending' ||
      t.data.status === 'planned' ||
      !t.data.status
    );

    if (pending.length > 0) {
      console.log('Pending Todos');
      console.log('');
      for (const todo of pending) {
        const bullet = '○';
        const title = todo.data.title || todo.node.name;
        const area = todo.data.area || 'general';
        const age = this.getRelativeTime(todo.data.created);
        
        console.log(`  ${bullet} ${title} (${area}, ${age})`);
      }
    }

    if (done.length > 0 && pending.length > 0) {
      console.log('');
    }

    if (done.length > 0) {
      console.log('Completed Todos');
      console.log('');
      for (const todo of done) {
        const checkbox = '✓';
        const title = todo.data.title || todo.node.name;
        const area = todo.data.area || 'general';
        const age = todo.data.completedAt 
          ? this.getRelativeTime(todo.data.completedAt)
          : this.getRelativeTime(todo.data.created);
        
        console.log(`  ${checkbox} ${title} (${area}, ${age})`);
      }
    }

    console.log('');
    console.log(`Total: ${todoDataList.length} todos (${pending.length} pending, ${done.length} done)`);
  }

  private findTodos(nodes: TodoNode[]): TodoNode[] {
    const todos: TodoNode[] = [];

    for (const node of nodes) {
      if (node.kind !== 'feature') continue;
      
      try {
        const jsonMatch = node.summary.match(/^\{[\s\S]*?\n\}/);
        const summaryText = jsonMatch ? jsonMatch[0] : node.summary;
        const data = JSON.parse(summaryText);
        
        if (data.title !== undefined && (data.status === 'pending' || data.status === 'done' || data.status === 'completed')) {
          todos.push(node);
        }
      } catch (e) {
        // Not a todo, skip
      }
    }

    return todos;
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
      return `${diffDays}d ago`;
    } catch (e) {
      return dateString;
    }
  }
}

export function todoCommand(program: Command) {
  program
    .command('todo [project-path]')
    .description('List all pending and completed todos')
    .action(async (projectPath?: string) => {
      const runner = new TodoRunner({
        projectDir: projectPath || process.cwd()
      });
      await runner.run();
    });
}
