import { spawn } from 'child_process';
import { markdownToAnsi } from './markdown-to-ansi';
import { getOrPromptProvider, ProviderType } from './provider-config';

interface JsonRunOptions {
  command: string;
  args?: string[];
  progressLabel?: string;
}

interface StreamState {
  hasOutputStarted: boolean;
  hadError: boolean;
  lastEndedWithNewline: boolean;
  eventCount: number;
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  if (sec === 0) return `${min}m`;
  return `${min}m ${sec}s`;
}

/**
 * Build command-line arguments for the specified provider.
 *
 * OpenCode: `opencode run --format json --command <cmd> [args...]` (for slash commands)
 *           `opencode run --format json <message>` (for non-slash commands)
 * Claude: `claude --print --output-format stream-json --verbose <prompt>`
 */
function buildProviderArgs(provider: ProviderType, command: string, args?: string[]): string[] {
  if (provider === 'opencode') {
    const isSlashCommand = command.startsWith('/');
    const cmdName = isSlashCommand ? command.substring(1) : command;
    const baseArgs = ['run', '--format', 'json'];
    
    if (isSlashCommand) {
      return [...baseArgs, '--command', cmdName, '--', ...(args || [])];
    } else {
      const message = args && args.length > 0 ? `${cmdName} ${args.join(' ')}` : cmdName;
      return [...baseArgs, message];
    }
  } else {
    const prompt = args && args.length > 0 ? `${command} ${args.join(' ')}` : command;
    return ['--print', '--output-format', 'stream-json', '--verbose', prompt];
  }
}

/**
 * Run an AI provider command with JSON output format.
 * Automatically detects the provider and uses the appropriate command-line syntax.
 *
 * @deprecated Use runAIProviderJson for clarity. This alias is kept for backward compatibility.
 */
export function runOpenCodeJson(options: JsonRunOptions): Promise<number> {
  return runAIProviderJson(options);
}

/**
 * Run an AI provider command with JSON streaming output.
 * Supports both OpenCode and Claude CLI with provider-specific argument handling.
 */
export function runAIProviderJson(options: JsonRunOptions): Promise<number> {
  return new Promise(async (resolve, reject) => {
    const provider = await getOrPromptProvider();
    const cmdArgs = buildProviderArgs(provider, options.command, options.args);
    const label = options.progressLabel || 'Working';
    const state: StreamState = { hasOutputStarted: false, hadError: false, lastEndedWithNewline: true, eventCount: 0 };

    const startTime = Date.now();
    let lastProgressLen = 0;

    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const text = `${label}... #${state.eventCount} ${formatElapsed(elapsed)}`;
      const padding = lastProgressLen > text.length ? ' '.repeat(lastProgressLen - text.length) : '';
      process.stdout.write(`\r${text}${padding}`);
      lastProgressLen = text.length;
    };

    updateProgress();
    let timer: ReturnType<typeof setInterval> | null = setInterval(updateProgress, 1000);

    const stopTimer = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
        process.stdout.write(`\r${' '.repeat(lastProgressLen)}\r`);
      }
    };

    const child = spawn(provider, cmdArgs, {
      env: process.env,
      stdio: ['inherit', 'pipe', 'inherit']
    });

    child.stdout.on('data', (data) => {
      streamTextEvents(data.toString(), state, stopTimer, provider);
    });

    child.on('close', (code) => {
      stopTimer();
      // Ensure final newline so shell prompt doesn't overwrite last output line
      if (!state.lastEndedWithNewline && state.hasOutputStarted) {
        process.stdout.write('\n');
      }
      resolve(state.hadError ? 1 : (code ?? 0));
    });

    child.on('error', (err) => {
      stopTimer();
      reject(err);
    });
  });
}

function streamTextEvents(chunk: string, state: StreamState, stopTimer: () => void, provider: ProviderType): void {
  const lines = chunk.split('\n').filter(l => l.trim());

  for (const line of lines) {
    try {
      const event = JSON.parse(line);

      const isTextEvent = (e: any): boolean => {
        if (provider === 'opencode') {
          return e.type === 'text';
        }
        return e.type === 'content_block_delta' && e.delta?.type === 'text_delta';
      };

      if (!isTextEvent(event) && event.type) {
        state.eventCount++;
      }

      if (provider === 'opencode') {
        if (event.type === 'text' && event.part?.text) {
          if (!state.hasOutputStarted) {
            stopTimer();
            process.stdout.write('\n');
            state.hasOutputStarted = true;
          }
          if (!state.lastEndedWithNewline) {
            process.stdout.write('\n');
          }
          const text = markdownToAnsi(event.part.text);
          process.stdout.write(text);
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
      } else {
        // Claude format: { type: 'content_block_delta', delta: { type: 'text_delta', text: '...' } }
        // Or: { type: 'result', result: '...' } for final result
        // Or: { type: 'assistant', message: { content: [...] } }
        let text: string | null = null;

        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta?.text) {
          text = event.delta.text;
        } else if (event.type === 'result' && typeof event.result === 'string') {
          text = event.result;
        } else if (event.type === 'text' && event.text) {
          text = event.text;
        } else if (event.type === 'message' && event.content) {
          // Handle message with content array
          if (Array.isArray(event.content)) {
            const textBlock = event.content.find((b: { type?: string; text?: string }) => b.type === 'text');
            if (textBlock?.text) text = textBlock.text;
          } else if (typeof event.content === 'string') {
            text = event.content;
          }
        }

        if (text) {
          if (!state.hasOutputStarted) {
            stopTimer();
            process.stdout.write('\n');
            state.hasOutputStarted = true;
          }
          if (!state.lastEndedWithNewline) {
            process.stdout.write('\n');
          }
          const formatted = markdownToAnsi(text);
          process.stdout.write(formatted);
          state.lastEndedWithNewline = formatted.endsWith('\n');
        } else if (event.type === 'error' || event.error) {
          state.hadError = true;
          if (!state.hasOutputStarted) {
            stopTimer();
            process.stdout.write('\n');
            state.hasOutputStarted = true;
          }
          const errorMsg = event.error?.message || event.message || 'Unknown error';
          process.stderr.write(`${errorMsg}\n`);
        }
      }
    } catch {
      // Not valid JSON, skip
    }
  }
}
