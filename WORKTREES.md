# Plan: Worktree Management Commands

## Overview

| Command | Purpose |
|---------|---------|
| `fuska worktree-add <name>` | Create git worktree + seed knowledge with shared context |
| `fuska worktree-merge <name>` | Git merge + merge new knowledge (skip shared context) |

---

## 1. `fuska worktree-add <name>`

**CLI:**
```
fuska worktree-add <name> [options]

Options:
  -p, --project-dir <path>   Main worktree path (default: cwd)
  --no-context               Skip copying shared context
```

**Implementation Steps:**

1. **Preflight:**
   - Verify current directory is git repo
   - Verify `.megamemory/knowledge.db` exists
   - Verify `<name>` directory doesn't exist
   - Verify branch `<name>` doesn't exist (or use `--force`)

2. **Create git worktree:**
   ```bash
   git worktree add <name> -b <name>
   ```

3. **Initialize worktree MegaMemory:**
   - Create `<name>/.megamemory/` directory
   - Create fresh `knowledge.db`

4. **Copy shared context concepts** (mark with `source_branch: "shared-context"`):
   
   | Copy | Filter |
   |------|--------|
   | `codebase-arch` | `id = 'codebase-arch'` |
   | `codebase-quality` | `id = 'codebase-quality'` |
   | `codebase-tech` | `id = 'codebase-tech'` |
   | `codebase-concerns` | `id = 'codebase-concerns'` |
   | `config` | `kind = 'config' AND name = 'config'` |
   | `requirements` + children | `kind = 'module' AND name = 'requirements'` + all children |
   | `roadmap` + children | `kind = 'module' AND name = 'roadmap'` + all children |
   | Project root concept | `kind = 'feature'` where parent is null |

5. **Create fresh state for worktree:**
   - Copy `state` concept but reset to clean state for the new branch

6. **Output:**
   ```
   Created worktree: <name>
   Git branch: <name>
   Shared context: 12 concepts copied
   Location: ./<name>/
   
   Next: cd <name> && work on your feature
   Then: fuska worktree-merge <name>
   ```

---

## 2. `fuska worktree-merge <name>`

**CLI:**
```
fuska worktree-merge <name> [options]

Options:
  -p, --project-dir <path>   Main worktree path (default: cwd)
  --skip-git-merge           Skip git merge, only merge knowledge
  --dry-run                  Show what would merge without modifying
  --keep <left|right|both>   Non-interactive conflict resolution
```

**Default behavior:** Git merge FIRST, then knowledge merge.

**Implementation Steps:**

1. **Preflight:**
   - Verify main `.megamemory/knowledge.db` exists
   - Verify `<name>/.megamemory/knowledge.db` exists
   - Verify `<name>` is a valid git worktree

2. **Git merge** (unless `--skip-git-merge`):
   ```bash
   git merge <name> --no-edit
   ```
   - If git merge fails, abort and report error
   - If conflicts, offer to abort or continue with knowledge merge anyway

3. **Backup main database:**
   - Create `knowledge.db.backup-<timestamp>`

4. **Merge knowledge databases:**
   - Open both databases
   - For each concept in worktree DB:
     - **SKIP** if `source_branch === "shared-context"`
     - **SKIP** if `id === "state"` (worktree keeps its own)
     - **MERGE** everything else (new work from branch)

5. **Handle conflicts:**
   - Same conflict resolution as current `merge-worktrees`
   - Interactive prompts or `--keep` for non-interactive

6. **Output:**
   ```
   Git merge: ✓ merged <name>
   Knowledge merge:
     Skipped (shared context): 12 concepts
     Clean merge: 8 concepts
     Conflicts: 0
   
   Backup: .megamemory/knowledge.db.backup-<timestamp>
   ```

---

## 3. Files Changed

| File | Action | Est. Lines |
|------|--------|------------|
| `src/commands/worktree-add.ts` | **Create** | ~250 |
| `src/commands/merge-worktrees.ts` | **Rename** to `worktree-merge.ts`, simplify to single arg, add skip logic | ~500 (refactor) |
| `src/cli.ts` | **Edit** — register both commands | +4 |
| `README.md` | **Edit** — update worktree section | ~50 lines changed |

**Delete after:**
- `opencode/command/fuska/fuska-merge-worktrees.md` (already deleted)

---

## 4. README.md Updates

**Update "Merging Worktrees" section (lines 435-457):**

```markdown
### Worktree Management

When using `git worktree` with Fuska, each worktree gets its own independent `.megamemory/knowledge.db`. Fuska provides commands to create worktrees with shared context and merge them back.

#### Creating a Worktree

```bash
fuska worktree-add <name>
```

Creates a new git worktree with:
- New branch `<name>`
- Fresh `.megamemory/knowledge.db`
- Shared context copied from main (codebase architecture, requirements, roadmap)
- Copied concepts marked as read-only (won't merge back)

**Options:**
- `--no-context` — Skip copying shared context

**What gets copied:**
- Codebase concepts (`codebase-arch`, `codebase-tech`, etc.)
- Project config (model settings)
- Requirements and roadmap (read-only reference)

**Example:**
```bash
fuska worktree-add feature-sharing
# Creates: ./feature-sharing/ with branch "feature-sharing"
# Next: cd feature-sharing && work on the feature
```

#### Merging a Worktree

```bash
fuska worktree-merge <name>
```

Merges the worktree back into main:
1. Runs `git merge <name>` (default, use `--skip-git-merge` to skip)
2. Merges knowledge database (skips shared context, only merges new work)
3. Creates backup before merge

**Options:**
- `--skip-git-merge` — Only merge knowledge, skip git merge
- `--dry-run` — Show what would merge without modifying
- `--keep <left|right|both>` — Non-interactive conflict resolution

**What gets merged:**
- NEW concepts created in worktree (plans, research, summaries, tasks)
- SKIPPED: shared context (codebase-*, requirements, roadmap, config)
- SKIPPED: worktree's state (main keeps its own)

**Example:**
```bash
# After completing work in feature-sharing/
cd ~/project-main
fuska worktree-merge feature-sharing
# Git merge + knowledge merge complete
```

#### Workflow Summary

```
# 1. Create worktree
fuska worktree-add feature-auth

# 2. Work in worktree
cd feature-auth
/fuska-plan-phase 1
/fuska-execute-phase 1

# 3. Merge back
cd ..
fuska worktree-merge feature-auth

# 4. Cleanup (optional)
git worktree remove feature-auth
git branch -d feature-auth
```
```

**Update Command Reference tables:**

Add to CLI Commands table:
```markdown
| `fuska worktree-add <name>` | Create git worktree with shared context | `--no-context` to skip context copy |
| `fuska worktree-merge <name>` | Merge worktree (git + knowledge) | `--skip-git-merge`, `--dry-run`, `--keep <strategy>` |
```

Remove from OpenCode Commands table:
```markdown
| `/fuska-merge-worktrees` | ... | ... |
```

---

## 5. Implementation Order

1. Create `worktree-add.ts` (can test independently)
2. Rename and refactor `merge-worktrees.ts` → `worktree-merge.ts`
3. Update `cli.ts` registrations
4. Update `README.md`
5. Build and test with real worktree

---

## Design Decisions

### Shared Context Scope

**Copied (marked `source_branch: "shared-context"`):**
- `codebase-*` concepts — static architecture context
- `config` — model settings consistency
- `requirements` + children — read-only reference
- `roadmap` + children — read-only reference

**NOT copied (worktree creates fresh):**
- `state` — each worktree has independent state
- Phase plans, research, summaries — created as new work happens

### Merge Skip Logic

```
SKIP if source_branch === "shared-context"
SKIP if id === "state"
MERGE everything else
```

### Git Merge Behavior

- **Default:** Run `git merge <name>` before knowledge merge
- **Flag:** `--skip-git-merge` to only merge knowledge
- **Conflict handling:** If git merge has conflicts, offer to abort or continue

### Branch Naming

- `worktree-add <name>` creates branch `<name>`
- Uses `git worktree add <name> -b <name>`
