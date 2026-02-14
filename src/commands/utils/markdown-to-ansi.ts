/**
 * Converts Markdown formatting to ANSI escape codes for terminal output.
 * - **text** → bold
 * - *text* → italic
 * - ```code blocks``` → dim
 */

const ANSI = {
  bold: '\x1b[1m',
  boldOff: '\x1b[22m',
  italic: '\x1b[3m',
  italicOff: '\x1b[23m',
  dim: '\x1b[2m',
  dimOff: '\x1b[22m',
  reset: '\x1b[0m'
};

export function markdownToAnsi(text: string, isTTY: boolean = process.stdout.isTTY ?? false): string {
  if (!isTTY) {
    return stripMarkdown(text);
  }
  
  let result = processCodeBlocks(text);
  result = processInlineFormatting(result);
  
  return result;
}

function processCodeBlocks(text: string): string {
  return text.replace(/```(\w*\n)?([\s\S]*?)```/g, (_, _lang, content) => {
    return `${ANSI.dim}${content.trim()}${ANSI.dimOff}`;
  });
}

function processInlineFormatting(text: string): string {
  let result = text.replace(/\*\*([^*]+)\*\*/g, `${ANSI.bold}$1${ANSI.boldOff}`);
  result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, `${ANSI.italic}$1${ANSI.italicOff}`);
  
  return result;
}

function stripMarkdown(text: string): string {
  let result = text.replace(/```\w*\n?/g, '');
  result = result.replace(/\*\*([^*]+)\*\*/g, '$1');
  result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1');
  
  return result;
}
