import stringWidth from 'string-width';

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
  
  let result = processHeadings(text);
  result = processTables(result);
  result = processCodeBlocks(result);
  result = processInlineFormatting(result);
  
  return result;
}

function processCodeBlocks(text: string): string {
  return text.replace(/```(\w*\n)?([\s\S]*?)```/g, (_, _lang, content) => {
    return `${ANSI.dim}${content.trim()}${ANSI.dimOff}`;
  });
}

function processHeadings(text: string): string {
  return text.replace(/^#{1,6}\s+(.+)$/gm, `${ANSI.bold}$1${ANSI.boldOff}`);
}

function processInlineFormatting(text: string): string {
  let result = text.replace(/\*\*([^*]+)\*\*/g, `${ANSI.bold}$1${ANSI.boldOff}`);
  result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, `${ANSI.italic}$1${ANSI.italicOff}`);
  
  return result;
}

function processTables(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let tableBuffer: string[] = [];
  let inTable = false;

  for (const line of lines) {
    const isTableRow = line.trim().startsWith('|') && line.trim().endsWith('|');
    
    if (isTableRow) {
      if (!inTable) {
        inTable = true;
        tableBuffer = [];
      }
      tableBuffer.push(line);
    } else {
      if (inTable) {
        result.push(formatTable(tableBuffer));
        tableBuffer = [];
        inTable = false;
      }
      result.push(line);
    }
  }

  if (inTable) {
    result.push(formatTable(tableBuffer));
  }

  return result.join('\n');
}

function formatTable(lines: string[]): string {
  if (lines.length === 0) return '';

  const parsedRows = lines.map(line => 
    line.split('|')
      .slice(1, -1)
      .map(cell => cell.trim())
  );

  const numCols = parsedRows[0]?.length || 0;
  const widths: number[] = new Array(numCols).fill(0);

  for (const row of parsedRows) {
    for (let i = 0; i < row.length; i++) {
      widths[i] = Math.max(widths[i], stringWidth(row[i]));
    }
  }

  const formattedRows = parsedRows.map((row, rowIndex) => {
    const cells = row.map((cell, i) => cell.padEnd(widths[i]));
    const formatted = `| ${cells.join(' | ')} |`;
    
    if (isSeparatorRow(row)) {
      return formatted.replace(/\|/g, '|').replace(/[^|]/g, '-');
    }
    return formatted;
  });

  return formattedRows.join('\n');
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.every(cell => /^[-:\s]+$/.test(cell));
}

function stripMarkdown(text: string): string {
  let result = text.replace(/^#{1,6}\s+/gm, '');
  result = result.replace(/```\w*\n?/g, '');
  result = result.replace(/\*\*([^*]+)\*\*/g, '$1');
  result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1');
  
  return result;
}
