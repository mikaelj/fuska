import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';

interface CommandConfig {
  name: string;
  frontmatterPath: string;
  helpKey: string;
}

const COMMANDS: CommandConfig[] = [
  { name: 'do', frontmatterPath: 'provider/opinkode/commands/fuska/fuska-do.md', helpKey: 'do' },
  { name: 'refresh', frontmatterPath: 'provider/opinkode/commands/fuska/fuska-refresh.md', helpKey: 'refresh' },
  { name: 'doc', frontmatterPath: 'provider/opinkode/commands/fuska/fuska-doc.md', helpKey: 'doc' },
  { name: 'debug', frontmatterPath: 'provider/opinkode/commands/fuska/fuska-debug.md', helpKey: 'debug' },
  { name: 'ask', frontmatterPath: 'provider/opinkode/commands/fuska/fuska-ask.md', helpKey: 'ask' },
];

function extractFlagsFromFrontmatter(filePath: string): string[] {
  const absolutePath = path.resolve(filePath);
  
  if (!fs.existsSync(absolutePath)) {
    return [];
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const { data } = matter(content);
  
  const flagsRaw = data.flags as string | undefined;
  
  if (!flagsRaw) {
    return [];
  }

  return flagsRaw
    .split(',')
    .map((f: string) => f.trim())
    .filter(Boolean);
}

function extractFlagsFromHelpTs(): Map<string, string[]> {
  const helpTsPath = path.resolve('src/commands/help.ts');
  const content = fs.readFileSync(helpTsPath, 'utf-8');
  
  const flagsByCommand = new Map<string, string[]>();

  const commandHelpMatch = content.match(/const commandHelp:\s*Record<string,\s*string>\s*=\s*\{([\s\S]*?)\n\};/);
  
  if (!commandHelpMatch) {
    return flagsByCommand;
  }

  const helpBlock = commandHelpMatch[1];
  
  const commandRegex = /(\w+):\s*`([\s\S]*?)`,?\n/g;
  let match;

  while ((match = commandRegex.exec(helpBlock)) !== null) {
    const commandName = match[1];
    const helpText = match[2];
    
    const flagsSectionMatch = helpText.match(/Flags:[\s\S]*?(?=Examples:|`|$)/);
    
    if (flagsSectionMatch) {
      const flags = [...flagsSectionMatch[0].matchAll(/--([\w-]+)/g)].map((m: RegExpMatchArray) => `--${m[1]}`);
      flagsByCommand.set(commandName, flags);
    } else {
      flagsByCommand.set(commandName, []);
    }
  }

  return flagsByCommand;
}

function normalizeFlags(flags: string[]): Set<string> {
  return new Set(flags.map(f => f.trim().toLowerCase()));
}

function main(): void {
  console.log('Validating command flags sync...\n');

  const helpTsFlags = extractFlagsFromHelpTs();
  let allPassed = true;
  let commandsChecked = 0;

  for (const cmd of COMMANDS) {
    commandsChecked++;
    const frontmatterFlags = extractFlagsFromFrontmatter(cmd.frontmatterPath);
    const helpFlags = helpTsFlags.get(cmd.helpKey) || [];

    const frontmatterSet = normalizeFlags(frontmatterFlags);
    const helpSet = normalizeFlags(helpFlags);

    if (frontmatterSet.size === 0 && helpSet.size === 0) {
      console.log(`✓ ${cmd.name}: no flags (match)`);
      continue;
    }

    if (frontmatterSet.size === 0) {
      console.log(`✗ ${cmd.name}: flags in help.ts but not in frontmatter`);
      console.log(`  help.ts:    ${Array.from(helpSet).join(', ') || '(none)'}`);
      allPassed = false;
      continue;
    }

    const missingInHelp = [...frontmatterSet].filter(f => !helpSet.has(f));
    const missingInFrontmatter = [...helpSet].filter(f => !frontmatterSet.has(f));

    if (missingInHelp.length === 0 && missingInFrontmatter.length === 0) {
      console.log(`✓ ${cmd.name}: ${Array.from(frontmatterSet).join(', ')}`);
    } else {
      console.log(`✗ ${cmd.name}: mismatch`);
      if (missingInHelp.length > 0) {
        console.log(`  Missing in help.ts:    ${missingInHelp.join(', ')}`);
      }
      if (missingInFrontmatter.length > 0) {
        console.log(`  Missing in frontmatter: ${missingInFrontmatter.join(', ')}`);
      }
      allPassed = false;
    }
  }

  console.log(`\n${commandsChecked} commands checked`);

  if (allPassed) {
    console.log('\n✓ All flags in sync');
    process.exit(0);
  } else {
    console.log('\n✗ Flag mismatches detected');
    process.exit(1);
  }
}

main();
