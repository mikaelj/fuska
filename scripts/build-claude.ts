import * as fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';

const ROOT_DIR = path.resolve(__dirname, '..');
const OPENCODE_DIR = path.join(ROOT_DIR, 'provider/opinkode');
const CLAUDE_DIR = path.join(ROOT_DIR, 'provider/klod');

const TOOL_MAPPINGS: Record<string, string> = {
  question: 'AskUserQuestion'
};

function sanitizeYamlFrontMatter(raw: string): string {
  return raw.replace(/^(\s*agent:\s*)(@[^\n]*)$/gm, '$1"$2"');
}

function transformCommandToSkill(sourcePath: string): { name: string; content: string } | null {
  let raw = fs.readFileSync(sourcePath, 'utf-8');
  raw = sanitizeYamlFrontMatter(raw);
  const { data, content } = matter(raw);
  
  if (data.deprecated) {
    return null;
  }
  
  const tools = (data.tools || []) as string[];
  const allowedTools = tools
    .map((t: string) => TOOL_MAPPINGS[t] || t)
    .join(', ');
  
  const newData: Record<string, any> = {
    name: data.name,
    description: data.description,
  };
  
  if (data['argument-hint']) {
    newData['argument-hint'] = data['argument-hint'];
  }
  
  newData['allowed-tools'] = allowedTools;
  
  return {
    name: data.name,
    content: matter.stringify(content, newData)
  };
}

function transformAgentToSubagent(sourcePath: string): { name: string; content: string } {
  const raw = fs.readFileSync(sourcePath, 'utf-8');
  const { data, content } = matter(raw);
  
  const toolsObj = data.tools || {};
  const tools = Object.entries(toolsObj)
    .filter(([_, v]) => v === true)
    .map(([k]) => k)
    .join(', ');
  
  const newData: Record<string, any> = {
    name: data.name,
    description: data.description,
    tools
  };
  
  return {
    name: data.name,
    content: matter.stringify(content, newData)
  };
}

async function buildClaude(): Promise<void> {
  console.log('Building provider/klod/ directory...\n');
  
  if (await fs.pathExists(CLAUDE_DIR)) {
    console.log('  Removing existing provider/klod/ directory');
    await fs.remove(CLAUDE_DIR);
  }
  
  console.log('  Copying fuska/ shared resources...');
  await fs.copy(
    path.join(OPENCODE_DIR, 'fuska'),
    path.join(CLAUDE_DIR, 'fuska')
  );
  
  console.log('  Transforming OpenCode paths to Claude paths...');
  const allMdFiles = await glob('**/*.md', { cwd: CLAUDE_DIR });
  for (const file of allMdFiles) {
    const filePath = path.join(CLAUDE_DIR, file);
    let content = await fs.readFile(filePath, 'utf-8');
    if (content.includes('~/.config/opencode')) {
      content = content.replace(/~\/\.config\/opencode/g, '~/.claude');
      await fs.writeFile(filePath, content);
    }
  }
  
  console.log('  Checking for remaining OpenCode path references...');
  const opencodePattern = /~\/\.config\/opencode/g;
  const violations: string[] = [];
  
  for (const file of allMdFiles) {
    const content = await fs.readFile(path.join(CLAUDE_DIR, file), 'utf-8');
    if (opencodePattern.test(content)) {
      violations.push(file);
    }
  }
  
  if (violations.length > 0) {
    console.error('\nERROR: OpenCode path references found in Claude output:');
    violations.forEach(f => console.error(`  ${f}`));
    process.exit(1);
  }
  
  console.log('  Transforming commands to skills...');
  const commandsDir = path.join(OPENCODE_DIR, 'commands/fuska');
  const commandFiles = await glob('*.md', { cwd: commandsDir, absolute: false });
  
  for (const file of commandFiles) {
    const sourcePath = path.join(commandsDir, file);
    const transformed = transformCommandToSkill(sourcePath);
    
    if (!transformed) {
      continue;
    }
    
    const skillDir = path.join(CLAUDE_DIR, 'skills', transformed.name);
    await fs.ensureDir(skillDir);
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), transformed.content);
    console.log(`    ${transformed.name}/SKILL.md`);
  }
  
  console.log('  Transforming agents to subagents...');
  const agentsDir = path.join(OPENCODE_DIR, 'agents/fuska');
  const agentFiles = await glob('*.md', { cwd: agentsDir, absolute: false });
  
  const targetAgentsDir = path.join(CLAUDE_DIR, 'agents/fuska');
  await fs.ensureDir(targetAgentsDir);
  
  for (const file of agentFiles) {
    const sourcePath = path.join(agentsDir, file);
    const transformed = transformAgentToSubagent(sourcePath);
    
    const targetPath = path.join(targetAgentsDir, `${transformed.name}.md`);
    await fs.writeFile(targetPath, transformed.content);
    console.log(`    agents/fuska/${transformed.name}.md`);
  }
  
  console.log('\nDone! provider/klod/ directory built successfully.');
}

buildClaude().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
