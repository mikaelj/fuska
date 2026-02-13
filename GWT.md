# Plan: Extract `fuska-merge-worktrees` to CLI

## Overview
Re-implement the full merge logic in TypeScript, using `megamemory` CLI subprocess for merge operations and library imports for custom resolution. Delete the opencode command file after CLI is complete.

## CLI Interface
```
fuska merge-worktrees <branch1> [branch2...] [options]

Options:
  -p, --project-dir <path>   Main worktree path (default: cwd)
  --resume                   Resume from merge-session.json if exists
  --dry-run                  Show what would merge without modifying
  --keep <left|right|both>   Non-interactive resolution strategy
```

## Implementation Tasks

| Phase | Task | Details |
|-------|------|---------|
| **1** | Create `src/commands/merge-worktrees.ts` | New command file following existing patterns (see `config.ts`) |
| **2** | Register in `src/cli.ts` | Import and add to program |
| **3** | Implement core logic | |
| | Preflight validation | Check main DB exists, worktree DBs exist, git repo |
| | Session management | Create/resume `.megamemory/merge-session.json` |
| | Backup | Timestamped backup of knowledge.db |
| | Dry-run mode | List branches and estimated conflicts without modifying |
| | Merge loop | CLI subprocess: `megamemory merge file1 file2 --left-label X --right-label Y` |
| | Conflict listing | CLI subprocess: `megamemory conflicts --json --db <path>` |
| | Interactive resolution | Use inquirer for conflict choices |
| | AI resolution | Inline file analysis (read file_refs, check existence); spawn opencode only for complex cases |
| | Edge case handling | Check `removed_at` (deletions), renames, dangling file_refs during resolution |
| | Custom resolution | Library import: `megamemory/dist/tools.js` → `resolveConflict()` for AI-written resolutions |
| | Rollback handling | Restore from backup on error |
| **4** | Build & test | |
| | Build | `npm run build` |
| | Manual test | Run CLI with two test worktrees |
| | Verify conflicts | Check `megamemory conflicts` shows expected results |
| **5** | Delete opencode command | Remove `opencode/command/fuska/fuska-merge-worktrees.md` (only after CLI verified) |

## Key Design Decisions

1. **Conflict resolution modes:**
   - `--keep left|right|both` — non-interactive, delegates to `megamemory resolve` CLI
   - Default (interactive) — inquirer prompts with options: AI verify, Keep left, Keep right, Keep both, Skip

2. **AI verification** (for complex conflicts):
   - **Default:** Inline file analysis — read all `file_refs` from both versions, check existence, compare content
   - **Fallback:** Spawn `opencode run --format json` with custom prompt for ambiguous cases
   - Edge cases to detect:
     - Deletion conflicts: one version has `removed_at` set
     - Renames: same kind, similar file_refs, different names
     - Dangling refs: file paths that don't exist on disk
     - Content drift: both versions independently updated

3. **CLI vs Library usage:**
   - **CLI subprocess:** `megamemory merge`, `megamemory conflicts`, `megamemory resolve --keep`
   - **Library import:** `megamemory/dist/db.js` (KnowledgeDB), `megamemory/dist/tools.js` (resolveConflict for AI-written resolutions)
   - Pattern follows existing commands (`config.ts`, `export.ts`)

4. **Session persistence:**
   - JSON file in `.megamemory/merge-session.json` survives crashes
   - `--resume` flag to continue interrupted merges

## Files Changed

| File | Action |
|------|--------|
| `src/commands/merge-worktrees.ts` | **Create** (~550-650 lines) |
| `src/cli.ts` | **Edit** — add import and register command |
| `opencode/command/fuska/fuska-merge-worktrees.md` | **Delete** after CLI verified |

## Estimated Effort
~550-650 lines of TypeScript. Comparable to `config.ts` (682 lines) and `export.ts` (575 lines). Reuses megamemory CLI for DB operations.
