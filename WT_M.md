# Plan: Worktree Management Commands (Revised)

## Overview

| Command | Purpose |
|---------|---------|
| `fuska worktree-add <name>` | Create git worktree + seed knowledge with shared context |
| `fuska worktree-merge <name>` | MegaMemory merge + git merge (in that order) |

---

## 1. `fuska worktree-add <name>`

**CLI:**
```
fuska worktree-add <name> [options]

Options:
  -p, --project-dir <path>   Main worktree path (default: cwd)
  --no-context               Skip copying shared context
  -f, --force                Overwrite existing branch/directory
```

**Implementation Steps:**

### 1. Preflight
- Verify current directory is git repo
- Verify `.megamemory/knowledge.db` exists
- Verify `<name>` directory doesn't exist (or use `--force`)
- Verify branch `<name>` doesn't exist (or use `--force`)

### 2. Create git worktree:
```bash
git worktree add <name> -b <name>
```

### 3. Initialize worktree MegaMemory:
- Create `<name>/.megamemory/` directory
- Create fresh `knowledge.db`

### 4. Copy shared context concepts

**Critical:** Copy nodes with **exact same IDs** to preserve parent_id references.

**Step 4a: Identify nodes to copy**

Query main database with actual SQL:
```typescript
// Get project root (feature with no parent)
const projectRoot = db.prepare(`
  SELECT * FROM nodes 
  WHERE kind = 'feature' AND parent_id IS NULL
  LIMIT 1
`).get();

// Get all descendant IDs recursively
function getDescendantIds(parentId: string): string[] {
  const children = db.prepare(`
    SELECT id FROM nodes WHERE parent_id = ?
  `).all(parentId).map(r => r.id);
  return [...children, ...children.flatMap(getDescendantIds)];
}

// Build copy list
const toCopy: string[] = [projectRoot.id];

for (const moduleName of ['codebase', 'requirements', 'roadmap']) {
  const module = db.prepare(`
    SELECT id FROM nodes 
    WHERE name = ? AND kind = 'module' AND parent_id = ?
  `).get(moduleName, projectRoot.id);
  if (module) {
    toCopy.push(module.id);
    toCopy.push(...getDescendantIds(module.id));
  }
}

const config = db.prepare(`
  SELECT id FROM nodes 
  WHERE name = 'config' AND kind = 'config' AND parent_id = ?
`).get(projectRoot.id);
if (config) toCopy.push(config.id);
```

**Step 4b: Copy nodes (preserving IDs)**
```typescript
for (const nodeId of toCopy) {
  const node = mainDb.getNodeRaw(nodeId);
  worktreeDb.insertNodeRaw({
    ...node,
    source_branch: 'shared-context',
    embedding: null  // Re-embed on first use
  });
}

// Copy edges where both endpoints are in toCopy
const edges = mainDb.prepare(`
  SELECT * FROM edges 
  WHERE from_id IN (${placeholders}) AND to_id IN (${placeholders})
`).all(...toCopy, ...toCopy);

for (const edge of edges) {
  worktreeDb.insertEdgeRaw({
    ...edge,
    source_branch: 'shared-context'
  });
}
```

### 5. Create fresh state for worktree:
```typescript
// projectRoot.id is now valid in worktree DB (we copied it)
worktreeDb.insertNodeRaw({
  id: randomUUID(),  // New ID, not shared
  name: 'state',
  kind: 'config',
  summary: JSON.stringify({
    phase: 1,
    plan: 0,
    status: 'Ready to plan',
    last_activity: `Worktree initialized: ${name}`,
    progress: 0
  }),
  parent_id: projectRoot.id,  // Valid because we copied project root with same ID
  source_branch: 'shared-context',  // Consistent sentinel
  embedding: null
});

// Create edge
worktreeDb.insertEdgeRaw({
  from_id: stateId,
  to_id: projectRoot.id,
  relation: 'configured_by',
  description: 'State configures project',
  source_branch: 'shared-context'
});
```

### 6. Output:
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
  -p, --project-dir <path>      Main worktree path (default: cwd)
  --only-git                    Only merge git branch, skip knowledge merge
  --only-megamemory             Only merge knowledge, skip git merge
  --dry-run                     Show what would merge, then exit (no merge)
  --keep <left|right|both>      Non-interactive conflict resolution
  --force                       Proceed despite dry-run errors
```

**Transaction Order:** MegaMemory merge FIRST (reversible via backup), then git merge.

**Implementation Steps:**

### 1. Preflight
- Verify main `.megamemory/knowledge.db` exists
- Verify `<name>/.megamemory/knowledge.db` exists
- Verify `<name>` is a valid git worktree
- Record current git HEAD SHA: `PRE_MERGE_SHA=$(git rev-parse HEAD)`

### 2. Dry-Run Validation (ALWAYS run both, regardless of --only-* flags)

**2a. MegaMemory dry-run:**
- Open both databases
- Run merge conflict detection
- Count: clean merges, conflicts, skipped (shared-context)

**2b. Git dry-run:**
```bash
git merge --no-commit --no-ff <name>
EXIT_CODE=$?
git merge --abort
```
- Capture exit code and conflict output

**2c. Display results:**
```
=== DRY RUN RESULTS ===

MegaMemory merge:
  ✓ Clean: 12 concepts
  ✓ Skipped (shared-context): 8 concepts  
  ✗ Conflicts: 2 concepts
    - phase-1-plan (summary differs)
    - config (model settings differ)

Git merge (<name>):
  ✓ Clean merge (no conflicts)
  OR
  ✗ Conflicts in: src/foo.ts, src/bar.ts

────────────────
```

**2d. Fail-fast decision:**

If ANY dry-run has errors AND NOT `--force`:
```
⚠ Cannot proceed: dry-run detected issues

MegaMemory conflicts: will be resolved interactively during merge
Git conflicts: resolve manually first
  git checkout --ours/--theirs <file>

Use --force to proceed anyway (not recommended).
```
→ **EXIT 1** (do not merge anything)

### 3. Execute Merges

**3a. MegaMemory merge** (unless `--only-git`):
- Backup main database: `knowledge.db.backup-<timestamp>`
- Open both databases
- For each concept in worktree DB:
  - **SKIP** if `source_branch === "shared-context"`
  - **SKIP** if `name === "state"` (worktree keeps its own)
  - **MERGE** everything else
- Handle conflicts with interactive prompts or `--keep`

If MegaMemory merge fails:
```
MegaMemory merge failed: <error>
Database restored from backup.
Aborting before git merge.
```
→ **EXIT 1** (git not touched, clean state)

**3b. Git merge** (unless `--only-megamemory`):

Record pre-merge state for reliable rollback:
```bash
PRE_MERGE_SHA=$(git rev-parse HEAD)
```

Execute:
```bash
git merge <name> --no-edit
```

If unexpected conflicts occur here:
```
Git merge has conflicts in: file1.ts, file2.ts

Options:
  [A]bort - Rollback MegaMemory, abort git merge (clean state)
  [C]ontinue - I've resolved conflicts manually, continue

Choose:
```

If abort:
```bash
git merge --abort
cp .megamemory/knowledge.db.backup-<timestamp> .megamemory/knowledge.db
echo "Both MegaMemory and git restored to pre-merge state"
```

### 4. Output
```
MegaMemory merge:
  Skipped (shared context): 8 concepts
  Clean merge: 10 concepts
  Conflicts resolved: 2
  Backup: .megamemory/knowledge.db.backup-<timestamp>

Git merge: ✓ merged <name>
Pre-merge SHA: abc1234 (saved for manual rollback if needed)
```

### 5. Manual Git Rollback (if needed later)

If user needs to rollback git after successful merge:
```bash
git reset --hard <PRE_MERGE_SHA>
cp .megamemory/knowledge.db.backup-<timestamp> .megamemory/knowledge.db
```

---

## 3. Files Changed

| File | Action | Est. Lines |
|------|--------|------------|
| `src/commands/worktree-add.ts` | **Create** | ~250 |
| `src/commands/merge-worktrees.ts` → `worktree-merge.ts` | **Rename & extend** | +300 (from 1038 to ~1300) |
| `src/cli.ts` | **Edit** — register both commands | +2 |
| `README.md` | **Edit** — update worktree section | ~80 lines changed |
| `tests/worktree.test.ts` | **Create** | ~400 |

**Delete after:**
- `opencode/command/fuska/fuska-merge-worktrees.md` (already deleted)

---

## 4. Test Coverage

### Unit Tests (`tests/worktree.test.ts`)

```typescript
describe('worktree-add', () => {
  it('creates git worktree with branch');
  it('copies shared context with preserved IDs');
  it('creates fresh state concept');
  it('fails if directory exists (without --force)');
  it('fails if branch exists (without --force)');
  it('--force overwrites existing');
  it('--no-context skips copying');
  it('parent_id references are valid in worktree DB');
});

describe('worktree-merge', () => {
  it('dry-run reports conflicts without modifying');
  it('dry-run always runs both git and MM checks');
  it('skips shared-context concepts');
  it('skips state concept');
  it('merges new concepts from worktree');
  it('--only-git skips MM merge');
  it('--only-megamemory skips git merge');
  it('MM failure prevents git merge');
  it('abort rolls back both MM and git');
  it('records pre-merge SHA for manual rollback');
  it('handles corrupted worktree DB gracefully');
  it('handles missing worktree DB gracefully');
  it('fails if run from inside worktree');
  it('concurrent merge detection (session file exists)');
});
```

### Edge Cases to Handle

| Scenario | Behavior |
|----------|----------|
| Worktree DB corrupted | Error message, exit 1 |
| Worktree DB missing | Error message, exit 1 |
| Run from inside worktree | Error: "Run from main worktree" |
| Merge session in progress | Prompt: resume or start fresh |
| Git worktree removed manually | Error: "Not a valid worktree" |
| Fast-forward git merge | Rollback still works with SHA |
| No shared context in source | Proceed with empty copy |

---

## 5. README.md Updates

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
- `-f, --force` — Overwrite existing branch/directory

**What gets copied (with preserved IDs):**
- Project root concept
- Codebase concepts (`codebase`, `codebase-tech`, `codebase-arch`, etc.)
- Requirements and roadmap (read-only reference)
- Config (model settings)

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
1. **Dry-run validation** — checks both git and MegaMemory for issues
2. **MegaMemory merge** — merges knowledge, skips shared context (unless `--only-git`)
3. **Git merge** — runs `git merge <name>` (unless `--only-megamemory`)

**Transaction order:** MegaMemory first (reversible), then git. If MM fails, git is never touched.

**Options:**
- `--only-git` — Only merge git branch, skip knowledge merge
- `--only-megamemory` — Only merge knowledge, skip git merge
- `--dry-run` — Show what would merge without modifying
- `--keep <left|right|both>` — Non-interactive conflict resolution
- `--force` — Proceed despite dry-run errors

**Dry-run validation:**
- Always runs BOTH git and MegaMemory dry-runs
- If ANY errors: aborts entire operation (unless `--force`)
- Prevents partial merges and messy recovery

**What gets merged:**
- NEW concepts created in worktree (plans, research, summaries, tasks)
- SKIPPED: shared context (codebase-*, requirements, roadmap, config)
- SKIPPED: worktree's state (main keeps its own)

**Manual rollback (if needed):**
```bash
git reset --hard <pre-merge-sha>
cp .megamemory/knowledge.db.backup-<timestamp> .megamemory/knowledge.db
```

**Example:**
```bash
# After completing work in feature-sharing/
cd ~/project-main
fuska worktree-merge feature-sharing
# Dry-run validates both → MM merge → Git merge complete
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
| `fuska worktree-add <name>` | Create git worktree with shared context | `--no-context`, `-f, --force` |
| `fuska worktree-merge <name>` | Merge worktree (MM + git) | `--only-git`, `--only-megamemory`, `--dry-run`, `--keep <strategy>`, `--force` |
```

Remove from OpenCode Commands table:
```markdown
| `/fuska-merge-worktrees` | ... | ... |
```

---

## 6. Implementation Order

1. Create `worktree-add.ts` with proper ID preservation
2. Add tests for `worktree-add`
3. Rename and extend `merge-worktrees.ts` → `worktree-merge.ts`
   - Add git dry-run validation
   - Add `--only-git`, `--only-megamemory` flags
   - Add git merge with SHA recording
   - Fix skip logic for shared-context
   - Swap order: MM merge first, then git
   - Add abort handler for git conflicts
4. Add tests for `worktree-merge`
5. Update `cli.ts` registrations
6. Update `README.md`
7. Full integration test with real worktree

---

## Design Decisions

### ID Preservation on Copy

**Rationale:** Copying nodes with same IDs ensures `parent_id` references remain valid in the worktree database. No ID mapping needed.

### Transaction Order: MM First, Then Git

**Rationale:** 
- MM merge is reversible via backup file
- Git merge is harder to reverse cleanly
- If MM fails, git is never touched → clean state
- If git fails after MM succeeds, user can abort with automatic MM rollback

### Pre-Merge SHA Recording

**Rationale:** `HEAD~1` is unreliable (fast-forward, multiple commits). Recording exact SHA enables reliable manual rollback.

### source_branch Consistency

All copied concepts use `source_branch: 'shared-context'`, including state. Skip logic:
```
SKIP if source_branch === "shared-context"
SKIP if name === "state"
```
Both conditions catch state (belt and suspenders).

### Dry-Run Always Runs Both

Even with `--only-git` or `--only-megamemory`, both dry-runs execute. This prevents surprises where one side is clean but the other has issues the user wasn't aware of.
