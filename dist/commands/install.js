"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.installCommand = installCommand;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const glob_1 = require("glob");
const gray_matter_1 = __importDefault(require("gray-matter"));
const HOME = process.env.HOME || '';
const OPENCODE_CONFIG = path.join(HOME, '.config/opencode');
const CLAUDE_CONFIG = path.join(HOME, '.claude');
const OPENCODE_SOURCE = path.join(__dirname, '../../opencode');
const TOOL_MAPPINGS = {
    question: 'AskUserQuestion'
};
function installCommand(program) {
    program
        .command('install')
        .description('Install Fuska commands and agents to target tool')
        .option('--opencode', 'Install to ~/.config/opencode/')
        .option('--claude', 'Install to ~/.claude/')
        .option('--both', 'Install to both locations')
        .option('--force', 'Overwrite existing directories')
        .action(async (options) => {
        if (!options.opencode && !options.claude && !options.both) {
            console.error('Error: Must specify --opencode, --claude, or --both');
            process.exit(1);
        }
        const targets = [];
        if (options.opencode || options.both) {
            targets.push({ name: 'opencode', configDir: OPENCODE_CONFIG });
        }
        if (options.claude || options.both) {
            targets.push({ name: 'claude', configDir: CLAUDE_CONFIG });
        }
        for (const target of targets) {
            console.log(`\nInstalling Fuska to ${target.configDir}...\n`);
            await installToTarget(target, options.force);
        }
    });
}
async function installToTarget(target, force) {
    await fs.ensureDir(target.configDir);
    const summaries = [];
    if (target.name === 'opencode') {
        summaries.push(await installDirectory('fuska', 'fuska', target, force));
        summaries.push(await installDirectory('command/fuska', 'command/fuska', target, force));
        summaries.push(await installDirectory('agents/fuska', 'agents/fuska', target, force));
    }
    else {
        summaries.push(await installDirectory('fuska', 'fuska', target, force));
        summaries.push(await installCommandsToSkills(target, force));
        summaries.push(await installAgentsToSubagents(target, force));
    }
    showSummary(summaries, target);
}
async function installDirectory(sourceRel, targetRel, target, force) {
    const sourceDir = path.join(OPENCODE_SOURCE, sourceRel);
    const targetDir = path.join(target.configDir, targetRel);
    console.log(`Installing ${targetRel}...`);
    if (!await fs.pathExists(sourceDir)) {
        throw new Error(`Source directory not found: ${sourceDir}`);
    }
    if (await fs.pathExists(targetDir)) {
        if (force) {
            console.log(`  Removing existing directory (--force)`);
            await fs.remove(targetDir);
        }
        else {
            console.error(`  Target directory already exists: ${targetDir}`);
            console.error(`  Use --force to overwrite`);
            throw new Error(`Directory exists: ${targetDir}`);
        }
    }
    await fs.ensureDir(path.dirname(targetDir));
    await fs.copy(sourceDir, targetDir, { overwrite: true });
    const files = await (0, glob_1.glob)('**/*', {
        cwd: targetDir,
        absolute: false,
        nodir: true,
        ignore: ['node_modules', '.git', '**/*.test.ts', '**/__tests__/**']
    });
    console.log(`  [OK] Copied ${files.length} files`);
    return {
        source: sourceRel,
        target: targetRel,
        fileCount: files.length
    };
}
async function installCommandsToSkills(target, force) {
    const sourceDir = path.join(OPENCODE_SOURCE, 'command/fuska');
    const files = await (0, glob_1.glob)('*.md', { cwd: sourceDir, absolute: false });
    let installedCount = 0;
    console.log('Installing commands as skills...');
    for (const file of files) {
        const sourcePath = path.join(sourceDir, file);
        const transformed = transformCommandToSkill(sourcePath);
        const skillDir = path.join(target.configDir, 'skills', transformed.name);
        if (await fs.pathExists(skillDir) && !force) {
            console.log(`  Skipping ${transformed.name} (exists, use --force)`);
            continue;
        }
        if (await fs.pathExists(skillDir)) {
            await fs.remove(skillDir);
        }
        await fs.ensureDir(skillDir);
        await fs.writeFile(path.join(skillDir, 'SKILL.md'), transformed.content);
        installedCount++;
    }
    console.log(`  [OK] Installed ${installedCount} skills`);
    return {
        source: 'command/fuska',
        target: 'skills/fuska-*',
        fileCount: installedCount
    };
}
async function installAgentsToSubagents(target, force) {
    const sourceDir = path.join(OPENCODE_SOURCE, 'agents/fuska');
    const files = await (0, glob_1.glob)('*.md', { cwd: sourceDir, absolute: false });
    let installedCount = 0;
    const agentsDir = path.join(target.configDir, 'agents/fuska');
    console.log('Installing agents as subagents...');
    if (await fs.pathExists(agentsDir) && force) {
        await fs.remove(agentsDir);
    }
    await fs.ensureDir(agentsDir);
    for (const file of files) {
        const sourcePath = path.join(sourceDir, file);
        const transformed = transformAgentToSubagent(sourcePath);
        const targetPath = path.join(agentsDir, `${transformed.name}.md`);
        if (await fs.pathExists(targetPath) && !force) {
            console.log(`  Skipping ${transformed.name} (exists, use --force)`);
            continue;
        }
        await fs.writeFile(targetPath, transformed.content);
        installedCount++;
    }
    console.log(`  [OK] Installed ${installedCount} subagents`);
    return {
        source: 'agents/fuska',
        target: 'agents/fuska',
        fileCount: installedCount
    };
}
function transformCommandToSkill(sourcePath) {
    const raw = fs.readFileSync(sourcePath, 'utf-8');
    const { data, content } = (0, gray_matter_1.default)(raw);
    const tools = (data.tools || []);
    const allowedTools = tools
        .map((t) => TOOL_MAPPINGS[t] || t)
        .join(', ');
    const newData = {
        name: data.name,
        description: data.description,
    };
    if (data['argument-hint']) {
        newData['argument-hint'] = data['argument-hint'];
    }
    newData['allowed-tools'] = allowedTools;
    return {
        name: data.name,
        content: gray_matter_1.default.stringify(content, newData)
    };
}
function transformAgentToSubagent(sourcePath) {
    const raw = fs.readFileSync(sourcePath, 'utf-8');
    const { data, content } = (0, gray_matter_1.default)(raw);
    const toolsObj = data.tools || {};
    const tools = Object.entries(toolsObj)
        .filter(([_, v]) => v === true)
        .map(([k]) => k)
        .join(', ');
    const newData = {
        name: data.name,
        description: data.description,
        tools
    };
    return {
        name: data.name,
        content: gray_matter_1.default.stringify(content, newData)
    };
}
function showSummary(summaries, target) {
    console.log('\nInstallation complete!\n');
    console.log('Summary:');
    console.log('─────────────────────────────────────');
    const totalFiles = summaries.reduce((sum, s) => sum + s.fileCount, 0);
    summaries.forEach(summary => {
        const fullTarget = path.join(target.configDir, summary.target);
        console.log(`  ${summary.source} -> ${fullTarget}`);
        console.log(`    Files: ${summary.fileCount}`);
    });
    console.log('─────────────────────────────────────');
    console.log(`  Total: ${totalFiles} files`);
    console.log('\nInstalled to:');
    if (target.name === 'opencode') {
        console.log(`  ${OPENCODE_CONFIG}/fuska/`);
        console.log(`  ${OPENCODE_CONFIG}/command/fuska/`);
        console.log(`  ${OPENCODE_CONFIG}/agents/fuska/`);
    }
    else {
        console.log(`  ${CLAUDE_CONFIG}/fuska/`);
        console.log(`  ${CLAUDE_CONFIG}/skills/fuska-*/`);
        console.log(`  ${CLAUDE_CONFIG}/agents/fuska/`);
    }
}
//# sourceMappingURL=install.js.map