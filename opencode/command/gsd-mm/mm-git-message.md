---
name: gsd-mm-git-message
description: Generate a commit message using GSD rules without committing, or regenerate for an existing commit
argument-hint: "<commit-hash | phase-X-plan-Y>"
tools:
  - read
  - bash
  - megamemory:understand
---

<objective>

Test and preview commit messages using the GSD commit message rules. Two modes:

1. **Commit hash mode:** Replay an existing commit's diff and generate what the message *should* look like under current rules
2. **Working tree mode:** Generate a commit message for uncommitted changes using plan context

Both modes can be combined: use a commit's diff with a different phase-plan context.

</objective>

<execution_context>

@~/.config/opencode/gsd-mm/references/git-integration.md

</execution_context>

<megamemory_guide>

## How to read MegaMemory responses

All project data lives in MegaMemory. If a MegaMemory query returns no results, tell the user the data wasn't found.

**`megamemory:understand` returns:**
```json
{ "matches": [ { "id": "project/state", "name": "state", "kind": "config", "summary": "{\"current_phase\":\"phase-01\", ...}", "children": [...], "edges": [...] } ] }
```

The important field is **`summary`** — it's a JSON string containing the concept's data. Parse it to extract the fields you need. If `matches` is empty, the concept doesn't exist.

</megamemory_guide>

<context>

Arguments: `$ARGUMENTS`

## Parse Arguments and Detect Mode

```
const args = $ARGUMENTS.trim().split(/\s+/)
let commitHash = null
let phasePlan = null

for (const arg of args) {
  if (arg.match(/^phase-\d+-plan-\d+$/)) {
    phasePlan = arg
  } else {
    // Try to resolve as a git commit
    // bash: git rev-parse --verify <arg>^{commit} 2>/dev/null
    // If exit code 0 → it's a valid commit hash
    commitHash = arg
  }
}

if (!commitHash && !phasePlan) {
  → Error: "Usage: /gsd-mm-git-message <commit-hash> [phase-X-plan-Y]"
  → "       /gsd-mm-git-message phase-X-plan-Y"
  → Stop
}
```

## Load Config

```
megamemory_understand(query="config", top_k=5)

const configData = response.matches.length > 0
  ? JSON.parse(response.matches[0].summary) : {}
const commitStrategy = configData?.git?.commit_strategy || 'per-phase'
```

The commit message rules and formats from git-integration.md are already loaded via `@execution_context`.

</context>

<process>

## Step 1: Validate commit hash (if provided)

If `commitHash` is set:

```bash
git rev-parse --verify ${commitHash}^{commit} 2>/dev/null
```

If this fails:
→ Display: `"${commitHash}" is not a valid commit reference`
→ Stop

---

## Step 2a: Set up working tree from commit (COMMIT HASH MODE)

If `commitHash` is provided:

**Step 2a.1: Record current state**

```bash
ORIGINAL_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || git rev-parse HEAD)
```

**Step 2a.2: Stash any current changes**

```bash
git stash push -m "gsd-git-message-stash" --include-untracked 2>/dev/null
```

Record whether the stash was actually created (check exit code or compare `git stash list` before/after).

**Step 2a.3: Detach at parent, apply commit as working tree changes**

```bash
PARENT=$(git rev-parse ${commitHash}^)
git checkout --detach $PARENT
git cherry-pick --no-commit $commitHash
git reset HEAD
```

This leaves the commit's changes as unstaged working tree modifications.

**Step 2a.4: Read original commit message**

```bash
git log -1 --format="%B" $commitHash
```

Store as `originalMessage`.

**Step 2a.5: Extract phase-plan from commit message (if no explicit phasePlan arg)**

If `phasePlan` is not set, try to parse scope from the subject line:

```
// Match patterns like: feat(phase-02-plan-01): ... or feat(02-01): ...
const scopeMatch = originalMessage.match(/^\w+\(([^)]+)\):/)
if (scopeMatch) {
  const scope = scopeMatch[1]
  // Full format: phase-02-plan-01
  if (scope.match(/^phase-\d+-plan-\d+$/)) {
    phasePlan = scope
  }
  // Short format: 02-01 → phase-02-plan-01
  else if (scope.match(/^\d{2}-\d{2}$/)) {
    const [phaseNum, planNum] = scope.split('-')
    phasePlan = `phase-${phaseNum}-plan-${planNum}`
  }
  // Phase-only format: phase-02
  else if (scope.match(/^phase-\d+$/)) {
    phasePlan = scope  // No plan, just phase context
  }
}
```

**Step 2a.6: Read the diff**

```bash
git diff
```

Store as `diffContent`.

---

## Step 2b: Read current working tree (WORKING TREE MODE, no commit hash)

If `commitHash` is NOT provided:

```bash
git diff
git diff --cached
```

Combine both outputs as `diffContent`.

If both diffs are empty:
→ Display: "No uncommitted changes found in working tree"
→ Stop

---

## Step 3: Load plan context from MegaMemory

If `phasePlan` is known (from argument or parsed from commit):

```
megamemory_understand(query="${phasePlan}", top_k=3)
```

From the results, extract:
- **Plan objective** — what the plan set out to accomplish
- **Task list** — what tasks were defined
- **Completed tasks** — what was already done

This gives the message generator richer context: *what the plan intended*, not just what the diff shows.

If `phasePlan` is not known:
→ Note: "No phase-plan context available — generating message from diff only"

---

## Step 4: Generate commit message

Apply the `<commit_message_rules>` and `<commit_formats>` from git-integration.md:

**Step 4.1: Determine commit type from diff content**

- New files/features → `feat`
- Bug fixes → `fix`
- Test files only → `test`
- Restructuring without behavior change → `refactor`
- Performance changes → `perf`
- Dependencies/config/tooling → `chore`

**Step 4.2: Determine scope**

- If `phasePlan` is known, use it as scope (format depends on commit strategy):
  - `per-phase`: `phase-{NN}` (e.g., `phase-02`)
  - `per-plan`: `{phase}-{plan}` (e.g., `02-01`)
  - `per-task`: `{phase}-{plan}` (e.g., `02-01`)
- If unknown, omit scope or use a descriptive word

**Step 4.3: Format subject line**

- Max 72 characters
- Imperative mood ("add X", "fix Y", not "added X")
- Format: `{type}({scope}): {description}`

**Step 4.4: Format body**

- **Maximum 2-4 bullet points. Never more.**
- Each bullet is ONE high-level sentence describing *what* changed and *why*
- Use plan context (objective, tasks) to write *why* bullets, not *how* bullets
- **NEVER** list: imports, field names, parameter details, null checks, variable renamings, or any implementation mechanics
- **NEVER** restate what the diff already shows

**Step 4.5: Apply commit strategy format**

Use the format matching `commitStrategy` from git-integration.md:
- `per-phase`: one bullet per plan
- `per-plan`: one bullet per task
- `per-task`: 2-4 high-level bullets

---

## Step 5: Print output

**If commit hash was provided (comparison mode):**

```
## Original commit message:

{originalMessage}

## Generated message (using current GSD rules):

{generatedMessage}

## Restore working tree:

git checkout -- .    # discard cherry-picked changes
git clean -fd        # remove any new files from the cherry-pick
git checkout {ORIGINAL_BRANCH}
git stash pop  # only if stash was created
```

**If working tree mode only:**

```
## Generated commit message:

{generatedMessage}

## To commit with this message:

git add <files> && git commit -m "{generatedMessage}"
```

**IMPORTANT:** In commit hash mode, do NOT automatically restore the working tree. Print the restore instructions and let the user decide. The user may want to inspect the state further.

</process>

<success_criteria>

- [ ] Mode correctly detected from arguments (commit hash, phase-plan pattern, or both)
- [ ] In commit mode: working tree shows the commit's changes, original state is restorable
- [ ] Generated message follows all rules from git-integration.md
- [ ] Subject line: max 72 chars, imperative mood, `{type}({scope}): {description}`
- [ ] Body: max 2-4 bullets, high-level only, no implementation details
- [ ] Message is printed, nothing is committed
- [ ] Restore instructions printed in commit mode

</success_criteria>
