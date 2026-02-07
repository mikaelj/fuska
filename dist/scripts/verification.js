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
exports.verifyArtifacts = verifyArtifacts;
exports.verifyKeyLinks = verifyKeyLinks;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const STUB_PATTERNS = [
    /TODO/i,
    /FIXME/i,
    /placeholder/i,
    /not implemented/i,
    /coming soon/i,
    /return null/,
    /return undefined/,
    /return \{\}/,
    /return \[\]/,
];
/**
 * 3-level artifact verification:
 * Level 1: exists on disk
 * Level 2: substantive (>min_lines, not stub patterns)
 * Level 3: wired (imported/used by other files)
 */
function verifyArtifacts(cwd, artifacts) {
    const results = [];
    for (const artifact of artifacts) {
        const fullPath = path.resolve(cwd, artifact.path);
        const result = {
            path: artifact.path,
            level1_exists: false,
            level2_substantive: false,
            level3_wired: false,
            lines: 0,
            stub_count: 0,
            import_count: 0,
            status: 'missing',
        };
        // Level 1: Existence
        if (!fs.existsSync(fullPath)) {
            results.push(result);
            continue;
        }
        result.level1_exists = true;
        // Level 2: Substantive
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        result.lines = lines.length;
        const minLines = artifact.min_lines ?? 10;
        let stubCount = 0;
        for (const line of lines) {
            for (const pattern of STUB_PATTERNS) {
                if (pattern.test(line)) {
                    stubCount++;
                    break;
                }
            }
        }
        result.stub_count = stubCount;
        result.level2_substantive = result.lines >= minLines && stubCount === 0;
        if (!result.level2_substantive) {
            result.status = 'stub';
            results.push(result);
            continue;
        }
        // Level 3: Wired (imported/used by other files)
        const basename = path.basename(artifact.path, path.extname(artifact.path));
        try {
            const grepResult = (0, child_process_1.execSync)(`grep -r "${basename}" "${cwd}/src" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" -l 2>/dev/null || true`, { encoding: 'utf-8' });
            const importingFiles = grepResult.trim().split('\n').filter(f => f && f !== fullPath);
            result.import_count = importingFiles.length;
            result.level3_wired = importingFiles.length > 0;
        }
        catch {
            result.level3_wired = false;
        }
        result.status = result.level3_wired ? 'verified' : 'orphaned';
        results.push(result);
    }
    const passed = results.filter(r => r.status === 'verified').length;
    return {
        all_passed: passed === results.length,
        passed,
        total: results.length,
        results,
    };
}
/**
 * Key-link verification (wiring between components).
 * Tests pattern regex against source/target files.
 */
function verifyKeyLinks(cwd, links) {
    const results = [];
    for (const link of links) {
        const fromPath = path.resolve(cwd, link.from);
        const result = {
            from: link.from,
            to: link.to,
            via: link.via,
            verified: false,
            detail: '',
        };
        if (!fs.existsSync(fromPath)) {
            result.detail = `Source file not found: ${link.from}`;
            results.push(result);
            continue;
        }
        const content = fs.readFileSync(fromPath, 'utf-8');
        if (link.pattern) {
            const regex = new RegExp(link.pattern);
            if (regex.test(content)) {
                result.verified = true;
                result.detail = `Pattern "${link.pattern}" found in ${link.from}`;
            }
            else {
                result.detail = `Pattern "${link.pattern}" NOT found in ${link.from}`;
            }
        }
        else {
            // Default: check if target is referenced in source
            const targetName = path.basename(link.to, path.extname(link.to));
            if (content.includes(targetName) || content.includes(link.to)) {
                result.verified = true;
                result.detail = `Reference to "${link.to}" found in ${link.from}`;
            }
            else {
                result.detail = `No reference to "${link.to}" in ${link.from}`;
            }
        }
        results.push(result);
    }
    const verified = results.filter(r => r.verified).length;
    return {
        all_verified: verified === results.length,
        verified,
        total: results.length,
        results,
    };
}
//# sourceMappingURL=verification.js.map