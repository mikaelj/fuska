---
name: fuska-git-message
description: Generate a commit message using GSD rules without committing, or regenerate for an existing commit or commit range
argument-hint: "<commit-hash | commit-range | phase-X-plan-Y>"
agent: fuska-git-message
tools:
  - read
  - bash
  - megamemory:understand
---

<objective>

Test and preview commit messages using the GSD commit message rules. Three modes:

1. **Commit range mode:** Generate a unified commit message for multiple commits (e.g., `HEAD~5..HEAD`)
2. **Commit hash mode:** Replay an existing commit's diff and generate what the message *should* look like under current rules
3. **Working tree mode:** Generate a commit message for uncommitted changes using plan context

All modes can be combined with explicit phase-plan context (overrides auto-detection).

</objective>

<execution_context>

@./opencode/fuska/references/git-integration.md

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

The variable `input` contains the raw argument string provided by the user.

```
const args = input.trim().split(/\s+/)
let commitRange = null
let commitHash = null
let phasePlan = null

for (const arg of args) {
  // Check for range first (contains "..")
  if (arg.includes('..')) {
    commitRange = arg
  } else if (arg.match(/^phase-\d+-plan-\d+$/)) {
    phasePlan = arg
  } else {
    // Try to resolve as a single git commit
    // bash: git rev-parse --verify <arg>^{commit} 2>/dev/null
    // If exit code 0 → it's a valid commit hash
    commitHash = arg
  }
}

const isDefaultMode = !commitHash && !commitRange && !phasePlan

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

## Step 1: Validate commit range (if provided)

If `commitRange` is set:

**Step 1.1: Parse range**

```javascript
// Split on ".." to get start and end
const [start, end] = commitRange.split('..')
const rangeStart = start.trim()
const rangeEnd = end.trim()
```

**Step 1.2: Validate both endpoints**

```bash
git rev-parse --verify ${rangeStart}^{commit} 2>/dev/null
git rev-parse --verify ${rangeEnd}^{commit} 2>/dev/null
```

If either fails:
→ Display: `"${rangeStart}" or "${rangeEnd}" is not a valid commit reference`
→ Stop

**Step 1.3: Check range is valid (has commits)**

```bash
COMMIT_COUNT=$(git rev-list --count ${rangeStart}..${rangeEnd})
```

If `COMMIT_COUNT` is "0":
→ Display: "No commits found in range ${rangeStart}..${rangeEnd}"
→ Stop

If `COMMIT_COUNT` > 50:
→ Display: "Warning: Range contains $COMMIT_COUNT commits. Output will be large."

Store as `commitCount`.

**Step 1.4: Check for merge commits (optional)**

```bash
MERGE_COUNT=$(git rev-list --count --merges ${rangeStart}..${rangeEnd})
```

If `MERGE_COUNT` > 0:
→ Display: "Note: Range contains $MERGE_COUNT merge commit(s). Use --no-merges flag to exclude."

---

## Step 1a: Validate commit hash (if provided)

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

## Step 2c: Set up from commit range (COMMIT RANGE MODE)

If `commitRange` is provided:

**Step 2c.1: Record current state** (for display only, not restore)

```bash
ORIGINAL_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || git rev-parse HEAD)
```

**Step 2c.2: Get combined diff**

```bash
git diff ${rangeStart}..${rangeEnd}
```

Store as `diffContent`.

**Step 2c.3: Get all original commit messages**

```bash
git log ${rangeStart}..${rangeEnd} --format="HASH: %H%nBODY_START%n%B%nBODY_END%n"
```

Parse this into an array of objects:
```javascript
const originalMessages = []
let currentHash = null
let currentBody = []
let inBody = false

for (const line of output.split('\n')) {
  if (line.startsWith('HASH: ')) {
    // Save previous message if exists
    if (currentHash) {
      originalMessages.push({ hash: currentHash, body: currentBody.join('\n') })
    }
    // Start new commit
    currentHash = line.substring(6)
    currentBody = []
    inBody = false
  } else if (line === 'BODY_START') {
    inBody = true
  } else if (line === 'BODY_END') {
    inBody = false
  } else if (inBody) {
    currentBody.push(line)
  }
}

// Save last commit
if (currentHash) {
  originalMessages.push({ hash: currentHash, body: currentBody.join('\n') })
}
```

**Step 2c.4: Extract phase-plan from most recent commit (if no explicit arg)**

If `phasePlan` is not set:

```bash
git log -1 --format="%B" ${rangeEnd}
```

Parse scope from subject line with flexible regex:
```
// Match patterns with or without whitespace, handle missing scope
const scopeMatch = latestMessage.match(/^\w+\s*\(([^)]+)\):/)

if (scopeMatch) {
  const scope = scopeMatch[1].trim()
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
    phasePlan = scope
  }
}

// If still no phasePlan found, note it
if (!phasePlan) {
  → Note: "No phase-plan context available — generating message from diff only"
}
```

**Step 2c.5: Note about mode**

Store flag `isRangeMode = true`. The working tree is NOT modified (we only read the diff), so no cherry-pick or checkout needed.

**Priority note:** If user explicitly provides `phasePlan` argument, it overrides any auto-detected value from commits.

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

## Step 3.5: Print usage header (if default mode)

If `isDefaultMode` is true:

```
## /fuska-git-message Usage:
- No args: Generate commit message for current changes (unstaged + staged)
- <commit-hash>: Replay existing commit and regenerate message
- <commit-range>: Generate unified message for multiple commits (e.g., HEAD~5..HEAD)
- [phase-X-plan-Y]: Override auto-detect phase-plan context
```

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

**If commit range was provided:**

```
## Commit range: ${rangeStart}..${rangeEnd} (${commitCount} commits)

### Original commit messages:

${originalMessages.map((msg, i) => `
--- Commit ${i+1}: ${msg.hash.substring(0, 8)} -- ${msg.body.split('\n')[0]} ---

${msg.body}

`).join('')}

### Generated message (using current GSD rules):

${generatedMessage}

## Note:
- Working tree NOT modified (diff only, no cherry-pick or checkout)
- Safe to run anytime
```

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

**If working tree mode:**

```
${isDefaultMode ? `
## /fuska-git-message Usage:
- No args: Generate commit message for current changes (unstaged + staged)
- <commit-hash>: Replay existing commit and regenerate message
- <commit-range>: Generate unified message for multiple commits (e.g., HEAD~5..HEAD)
- [phase-X-plan-Y]: Override auto-detect phase-plan context

` : ''}
${isDefaultMode ? '## Generated commit message for current changes:' : '## Generated commit message:'}

${generatedMessage}

## To commit with this message:

git add <files> && git commit -m "${generatedMessage}"
```

**IMPORTANT:**
- In range mode, do NOT automatically restore working tree (no changes were made)
- In single commit mode, do NOT automatically restore working tree - print instructions instead
- In working tree mode, print commit instructions

</process>

<success_criteria>

- [ ] Range mode correctly detected when argument contains `..`
- [ ] Range validation checks both endpoints exist
- [ ] Range validation confirms commits exist between endpoints
- [ ] Combined diff correctly extracted for entire range
- [ ] All original commit messages captured and displayed with parseable format
- [ ] Phase-plan auto-detected from most recent commit in range with flexible regex
- [ ] Phase-plan can be overridden with explicit argument (takes precedence)
- [ ] Generated message follows all GSD commit message rules
- [ ] Original messages displayed in full for all commits
- [ ] No working tree modifications in range mode (no stash, no checkout, no cherry-pick)
- [ ] Restore instructions printed correctly for single commit mode
- [ ] Error messages are clear and actionable
- [ ] All existing modes (single commit, working tree) remain functional
- [ ] Large range warning displayed when commit count > 50
- [ ] Merge commit note displayed when merges detected in range
- [ ] Git log parsing handles empty commit bodies correctly
- [ ] Subject line: max 72 chars, imperative mood, `{type}({scope}): {description}`
- [ ] Body: max 2-4 bullets, high-level only, no implementation details
- [ ] Message is printed, nothing is committed
- [ ] No arguments defaults to working tree mode (unstaged + staged)
- [ ] Usage header printed when no arguments provided
- [ ] Usage header NOT printed when explicit arguments given
- [ ] Header contains valid usage information
- [ ] Suggested commit message always generated

</success_criteria>
