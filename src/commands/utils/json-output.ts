import { spawn } from 'child_process';
import { markdownToAnsi } from './markdown-to-ansi';

interface JsonRunOptions {
  command: string;
  args?: string[];
  progressLabel?: string;
}

interface StreamState {
  hasOutputStarted: boolean;
  hadError: boolean;
  lastEndedWithNewline: boolean;
}

export function runOpenCodeJson(options: JsonRunOptions): Promise<number> {
  return new Promise((resolve, reject) => {
    const cmdArgs = ['run', '--format', 'json', options.command, ...(options.args || [])];
    const label = options.progressLabel || 'Working';
    const state: StreamState = { hasOutputStarted: false, hadError: false, lastEndedWithNewline: true };
    
    process.stdout.write(label);
    
    const child = spawn('opencode', cmdArgs, {
      env: process.env,
      stdio: ['inherit', 'pipe', 'inherit']
    });

    child.stdout.on('data', (data) => {
      streamTextEvents(data.toString(), state);
    });

    child.on('close', (code) => {
      process.stdout.write('\n');
      resolve(state.hadError ? 1 : (code ?? 0));
    });

    child.on('error', reject);
  });
}

function streamTextEvents(chunk: string, state: StreamState): void {
  const lines = chunk.split('\n').filter(l => l.trim());
  
  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      
      if (event.type === 'text' && event.part?.text) {
        if (!state.hasOutputStarted) {
          process.stdout.write('\n\n');
          state.hasOutputStarted = true;
        }
        // Add newline separator if previous output didn't end with one
        if (!state.lastEndedWithNewline) {
          process.stdout.write('\n');
        }
        const text = markdownToAnsi(event.part.text);
        process.stdout.write(text);
        // Track whether this output ends with a newline
        state.lastEndedWithNewline = text.endsWith('\n');
      } else if (event.type === 'error') {
        state.hadError = true;
        if (!state.hasOutputStarted) {
          process.stdout.write('\n\n');
          state.hasOutputStarted = true;
        }
        process.stderr.write(event.message || event.part?.text || 'Unknown error\n');
      } else if (!state.hasOutputStarted) {
        process.stdout.write('.');
      }
    } catch {
      // Not valid JSON, skip
    }
  }
}
