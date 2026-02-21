---
name: fuska-git-message
description: Generate a commit message using Fuska rules without committing, or regenerate for an existing commit or commit range
argument-hint: "<commit-hash | commit-range | chapter-X-plan-Y>"
agent: @../../agents/fuska/fuska-git-message.md
tools:
  - read
  - bash
  - megamemory:understand
---

<objective>

Test and preview commit messages using the Fuska commit message rules. Three modes:

1. **Commit range mode:** Generate a unified commit message for multiple commits (e.g., `HEAD~5..HEAD`)
2. **Commit hash mode:** Replay an existing commit's diff and generate what the message *should* look like under current rules
3. **Working tree mode:** Generate a commit message for uncommitted changes using plan context

All modes can be combined with explicit chapter-plan context (overrides auto-detection).

</objective>

<execution_context>

@../../fuska/references/git-integration.md

</execution_context>

<megamemory_guide>

## How to read MegaMemory responses

All project data lives in MegaMemory. If a MegaMemory query returns no results, tell the user the data wasn't found.

**`megamemory:understand` returns:**
```json
{ "matches": [ { "id": "project/state", "name": "state", "kind": "config", "summary": "{\"current_chapter\":\"chapter-01\", ...}", "children": [...], "edges": [...] } ] }
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
let chapterPlan = null

for (const arg of args) {
  // Check for range first (contains "..")
  if (arg.includes('..')) {
    commitRange = arg
  } else if (arg.match(/^chapter-\d+-plan-\d+$/)) {
    chapterPlan = arg
  } else {
    // Try to resolve as a single git commit
    // bash: git rev-parse --verify <arg>^{commit} 2>/dev/null
    // If exit code 0 → it's a valid commit hash
    commitHash = arg
  }
}

const isDefaultMode = !commitHash && !commitRange && !chapterPlan

## Load Config

```
megamemory_understand(query="config", top_k=5)

const configData = response.matches.length > 0
  ? JSON.parse(response.matches[0].summary) : {}
const commitStrategy = configData?.git?.commit_strategy || 'per-chapter'
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

**Step 2a.2: Read original commit message**

```bash
git log -1 --format="%B" $commitHash
```

Store as `originalMessage`.

**Step 2a.3: Extract chapter-plan from commit message (if no explicit chapterPlan arg)**

If `chapterPlan` is not set, try to parse scope from the subject line:

```
// Match patterns like: feat(chapter-02-plan-01): ... or feat(02-01): ...
const scopeMatch = originalMessage.match(/^\w+\(([^)]+)\):/)
if (scopeMatch) {
  const scope = scopeMatch[1]
  // Full format: chapter-02-plan-01
  if (scope.match(/^chapter-\d+-plan-\d+$/)) {
    chapterPlan = scope
  }
  // Short format: 02-01 → chapter-02-plan-01
  else if (scope.match(/^\d{2}-\d{2}$/)) {
    const [chapterNum, planNum] = scope.split('-')
    chapterPlan = `chapter-${chapterNum}-plan-${planNum}`
  }
  // Chapter-only format: chapter-02
  else if (scope.match(/^chapter-\d+$/)) {
    chapterPlan = scope  // No plan, just chapter context
  }
}
```

**Step 2a.4: Read the diff**

```bash
git diff ${commitHash}^ ${commitHash}
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

**Step 2c.4: Extract chapter-plan from most recent commit (if no explicit arg)**

If `chapterPlan` is not set:

```bash
git log -1 --format="%B" ${rangeEnd}
```

Parse scope from subject line with flexible regex:
```
// Match patterns with or without whitespace, handle missing scope
const scopeMatch = latestMessage.match(/^\w+\s*\(([^)]+)\):/)

if (scopeMatch) {
  const scope = scopeMatch[1].trim()
  // Full format: chapter-02-plan-01
  if (scope.match(/^chapter-\d+-plan-\d+$/)) {
    chapterPlan = scope
  }
  // Short format: 02-01 → chapter-02-plan-01
  else if (scope.match(/^\d{2}-\d{2}$/)) {
    const [chapterNum, planNum] = scope.split('-')
    chapterPlan = `chapter-${chapterNum}-plan-${planNum}`
  }
  // Chapter-only format: chapter-02
  else if (scope.match(/^chapter-\d+$/)) {
    chapterPlan = scope
  }
}

// If still no chapterPlan found, note it
if (!chapterPlan) {
  → Note: "No chapter-plan context available — generating message from diff only"
}
```

**Step 2c.5: Note about mode**

Store flag `isRangeMode = true`. The working tree is NOT modified (we only read the diff), so no cherry-pick or checkout needed.

**Priority note:** If user explicitly provides `chapterPlan` argument, it overrides any auto-detected value from commits.

---

## Step 2b: Read current working tree (WORKING TREE MODE, no commit hash)

If `commitHash` is NOT provided:

```bash
git diff
git diff --cached
```

Combine both outputs as `diffContent`.

**If both diffs are empty:**

Check for HEAD fallback:
```bash
git rev-parse HEAD 2>/dev/null
```

- If HEAD exists:
  - Set `commitHash = "HEAD"`
  - Set `isDefaultMode = false` (don't show usage header)
  - Proceed to **Step 2a** to generate message from HEAD commit
- If no HEAD (empty repo):
  → Display: "No uncommitted changes and no commits found"
  → Stop

---

## Step 3: Load plan context from MegaMemory

If `chapterPlan` is known (from argument or parsed from commit):

```
megamemory_understand(query="${chapterPlan}", top_k=3)
```

From the results, extract:
- **Plan objective** — what the plan set out to accomplish
- **Task list** — what tasks were defined
- **Completed tasks** — what was already done

This gives the message generator richer context: *what the plan intended*, not just what the diff shows.

If `chapterPlan` is not known:
→ Note: "No chapter-plan context available — generating message from diff only"

---

## Step 3.1: Load domain context from MegaMemory

Query all domain concepts to match changed files to business areas:

```
megamemory_understand(query="domain", top_k=50)
```

**Domain naming convention:** Domain concepts must have IDs starting with `domain-` (e.g., `domain-pricing`, `domain-booking`, `domain-auth`).

Filter results to concepts where `id.startsWith("domain-")`.

**Extract changed files from diff:**

Parse `diffContent` for file paths:
- Lines matching `diff --git a/... b/...` → extract the path after `b/`
- Lines matching `+++ b/...` → extract the path after `b/`

**Match files to domains:**

For each changed file (in order they appear in diff):
1. Check if it matches any `file_refs` in domain concepts
2. File refs may include line ranges (e.g., `lib/data/common.dart:287-593`) — match the path portion only (strip `:XXX-YYY` suffix)
3. First match wins — store as `domainScope` (e.g., `pricing` from `domain-pricing`)

If no domains found or no file matches:
→ `domainScope = null`

---

## Step 3.2: Print usage header (if default mode)

If `isDefaultMode` is true:

```
## /fuska-git-message Usage:
- No args: Generate commit message for current changes (unstaged + staged)
- <commit-hash>: Replay existing commit and regenerate message
- <commit-range>: Generate unified message for multiple commits (e.g., HEAD~5..HEAD)
- [chapter-X-plan-Y]: Override auto-detect chapter-plan context
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

**Scope Rules (CRITICAL):**
- Scope MUST be a semantic area: `auth`, `api`, `checkout`, `ui`, `db`, `benchmark`, `pricing`, `data`, `config`, etc.
- NEVER use task numbers, chapter numbers, or plan identifiers as scope
- BAD: `refactor(task-002): ...` — task-002 is metadata, not an area
- GOOD: `refactor(benchmark): ...` — benchmark is the semantic area
- Chapter-plan identifiers go in the TRAILER (footer), not the scope

Priority order:
1. If `domainScope` is found from MegaMemory domain concepts → use domain name (e.g., `pricing`, `booking`)
2. Else extract area from changed file paths (e.g., `lib/data/` → scope: `data`, `lib/benchmark/` → scope: `benchmark`)
3. Else → omit scope entirely (format: `{type}: {description}`)

**NEVER** extract scope from diff content (variable names, renames, function names, etc.)

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
- `per-chapter`: one bullet per plan
- `per-plan`: one bullet per task
- `per-task`: 2-4 high-level bullets

**Step 4.6: Add trailer (chapter-plan identifier)**

If `chapterPlan` is known, add as trailer in the footer:
- `per-chapter` → `chapter-{NN}` (e.g., `chapter-02`)
- `per-plan` / `per-task` → `{chapter}-{plan}` (e.g., `02-01`, `task-002`)

**Final format:**
```
{type}({scope}): {description}

- {bullet 1}
- {bullet 2}

{trailer}
```

Example:
```
refactor(benchmark): merge UserDataBenchmark into Benchmarker

- Move accumulator pattern methods from UserDataBenchmark to Benchmarker
- Update all call sites to use centralized benchmark class

task-002
```

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

### Generated message (using current Fuska rules):

${generatedMessage}

## Note:
- Working tree NOT modified (diff only, no cherry-pick or checkout)
- Safe to run anytime
```

**If commit hash was provided (comparison mode):**

```
## Original commit message:

{originalMessage}

## Generated message (using current Fuska rules):

{generatedMessage}

## Note:
- Working tree NOT modified (read-only diff comparison)
- Safe to run anytime
```

**If working tree mode:**

```
${isDefaultMode ? `
## /fuska-git-message Usage:
- No args: Generate commit message for current changes (unstaged + staged)
- <commit-hash>: Replay existing commit and regenerate message
- <commit-range>: Generate unified message for multiple commits (e.g., HEAD~5..HEAD)
- [chapter-X-plan-Y]: Override auto-detect chapter-plan context

` : ''}
${isDefaultMode ? '## Generated commit message for current changes:' : '## Generated commit message:'}

${generatedMessage}

## To commit with this message:

git add <files> && git commit -m "${generatedMessage}"
```

**IMPORTANT:**
- In range mode, working tree is never modified (read-only diff comparison)
- In single commit mode, working tree is never modified (read-only diff comparison)
- In working tree mode, print commit instructions

</process>

<success_criteria>

- [ ] Range mode correctly detected when argument contains `..`
- [ ] Range validation checks both endpoints exist
- [ ] Range validation confirms commits exist between endpoints
- [ ] Combined diff correctly extracted for entire range
- [ ] All original commit messages captured and displayed with parseable format
- [ ] Chapter-plan auto-detected from most recent commit in range with flexible regex
- [ ] Chapter-plan can be overridden with explicit argument (takes precedence)
- [ ] Generated message follows all Fuska commit message rules
- [ ] Original messages displayed in full for all commits
- [ ] No working tree modifications in range mode (no stash, no checkout, no cherry-pick)
- [ ] No working tree modifications in single commit mode (read-only diff comparison)
- [ ] Read-only note displayed for single commit and range modes
- [ ] Error messages are clear and actionable
- [ ] All existing modes (single commit, working tree) remain functional
- [ ] Large range warning displayed when commit count > 50
- [ ] Merge commit note displayed when merges detected in range
- [ ] Git log parsing handles empty commit bodies correctly
- [ ] Subject line: max 72 chars, imperative mood, `{type}({scope}): {description}`
- [ ] Body: max 2-4 bullets, high-level only, no implementation details
- [ ] Scope is ALWAYS a semantic area (`benchmark`, `pricing`, `api`), NEVER task/chapter numbers
- [ ] Trailer contains chapter-plan identifier (e.g., `task-002`, `02-01`, `chapter-02`)
- [ ] Message is printed, nothing is committed
- [ ] No arguments defaults to working tree mode (unstaged + staged)
- [ ] No arguments falls back to HEAD commit when no uncommitted changes exist
- [ ] Usage header printed when no arguments provided
- [ ] Usage header NOT printed when explicit arguments given
- [ ] Header contains valid usage information
- [ ] Suggested commit message always generated
- [ ] Domain concepts queried from MegaMemory (query="domain")
- [ ] Changed files extracted from diff content
- [ ] Files matched against domain file_refs
- [ ] Domain scope used when chapterPlan is unknown and domain match found
- [ ] Scope omitted (not random word) when neither chapterPlan nor domainScope found
- [ ] Never extracts scope from diff content (variable names, renames, function names)

</success_criteria>
