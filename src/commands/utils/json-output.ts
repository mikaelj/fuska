import { spawn } from 'child_process';
import { markdownToAnsi } from './markdown-to-ansi';
import { getOrPromptProvider } from './provider-config';

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

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  if (sec === 0) return `${min}m`;
  return `${min}m ${sec}s`;
}

export function runOpenCodeJson(options: JsonRunOptions): Promise<number> {
  return new Promise(async (resolve, reject) => {
    const provider = await getOrPromptProvider();
    const cmdArgs = ['run', '--format', 'json', options.command, ...(options.args || [])];
    const label = options.progressLabel || 'Working';
    const state: StreamState = { hasOutputStarted: false, hadError: false, lastEndedWithNewline: true };
    
    const startTime = Date.now();
    let lastProgressLen = 0;
    
    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const text = `${label}... ${formatElapsed(elapsed)}`;
      const padding = lastProgressLen > text.length ? ' '.repeat(lastProgressLen - text.length) : '';
      process.stdout.write(`\r${text}${padding}`);
      lastProgressLen = text.length;
    };
    
    updateProgress();
    const timer = setInterval(updateProgress, 1000);
    
    const stopTimer = () => {
      if (timer) {
        clearInterval(timer);
        process.stdout.write(`\r${' '.repeat(lastProgressLen)}\r`);
      }
    };
    
    const child = spawn(provider, cmdArgs, {
      env: process.env,
      stdio: ['inherit', 'pipe', 'inherit']
    });

    child.stdout.on('data', (data) => {
      streamTextEvents(data.toString(), state, stopTimer);
    });

    child.on('close', (code) => {
      stopTimer();
      resolve(state.hadError ? 1 : (code ?? 0));
    });

    child.on('error', (err) => {
      stopTimer();
      reject(err);
    });
  });
}

function streamTextEvents(chunk: string, state: StreamState, stopTimer: () => void): void {
  const lines = chunk.split('\n').filter(l => l.trim());
  
  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      
      if (event.type === 'text' && event.part?.text) {
        if (!state.hasOutputStarted) {
          stopTimer();
          process.stdout.write('\n');
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
          stopTimer();
          process.stdout.write('\n');
          state.hasOutputStarted = true;
        }
        process.stderr.write(event.message || event.part?.text || 'Unknown error\n');
      }
    } catch {
      // Not valid JSON, skip
    }
  }
}
