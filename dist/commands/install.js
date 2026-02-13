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
Object.defineProperty(exports, "__esModule", { value: true });
exports.installCommand = installCommand;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const glob_1 = require("glob");
const OPENCODE_CONFIG = path.join(process.env.HOME || '', '.config/opencode');
const OPENCODE_SOURCE = path.join(process.cwd(), 'opencode');
function installCommand(program) {
    program
        .command('install')
        .description('Install Fuska commands and agents from opencode/ to ~/.config/opencode')
        .option('--force', 'Overwrite existing directories')
        .action(async (options) => {
        try {
            console.log('Installing Fuska to ~/.config/opencode...\n');
            await fs.ensureDir(OPENCODE_CONFIG);
            const summaries = [];
            summaries.push(await installDirectory('fuska', 'fuska', options.force));
            summaries.push(await installDirectory('command/fuska', 'command/fuska', options.force));
            summaries.push(await installDirectory('agents/fuska', 'agents/fuska', options.force));
            showSummary(summaries);
        }
        catch (error) {
            console.error(`\nInstallation failed: ${error.message}`);
            throw error;
        }
    });
}
async function installDirectory(sourceRel, targetRel, force) {
    const sourceDir = path.join(OPENCODE_SOURCE, sourceRel);
    const targetDir = path.join(OPENCODE_CONFIG, targetRel);
    console.log(`Installing ${targetRel}...`);
    if (!await fs.pathExists(sourceDir)) {
        throw new Error(`Source directory not found: ${sourceDir}`);
    }
    if (await fs.pathExists(targetDir)) {
        if (force) {
            console.log(`  🗑  Removing existing directory (--force)`);
            await fs.remove(targetDir);
        }
        else {
            console.error(`  ❌ Target directory already exists: ${targetDir}`);
            console.error(`     Use --force to overwrite`);
            throw new Error(`Directory exists: ${targetDir}`);
        }
    }
    await fs.ensureDir(path.dirname(targetDir));
    await fs.copy(sourceDir, targetDir, { overwrite: true });
    const files = await (0, glob_1.glob)('**/*', {
        cwd: targetDir,
        absolute: false,
        ignore: ['node_modules', '.git', '**/*.test.ts', '**/__tests__/**']
    });
    console.log(`  [OK] Copied ${files.length} files`);
    return {
        source: sourceRel,
        target: targetRel,
        fileCount: files.length
    };
}
function showSummary(summaries) {
    console.log('\n✅ Installation complete!\n');
    console.log('Summary:');
    console.log('─────────────────────────────────────');
    const totalFiles = summaries.reduce((sum, s) => sum + s.fileCount, 0);
    summaries.forEach(summary => {
        const fullTarget = path.join('~/.config/opencode', summary.target);
        console.log(`  ${summary.source} → ${fullTarget}`);
        console.log(`    Files copied: ${summary.fileCount}`);
    });
    console.log('─────────────────────────────────────');
    console.log(`  Total files installed: ${totalFiles}`);
    console.log('\nInstalled directories:');
    console.log(`  ${OPENCODE_CONFIG}/fuska/`);
    console.log(`  ${OPENCODE_CONFIG}/command/fuska/`);
    console.log(`  ${OPENCODE_CONFIG}/agents/fuska/`);
}
//# sourceMappingURL=install.js.map