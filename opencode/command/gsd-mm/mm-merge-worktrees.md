---
name: gsd-mm-merge-worktrees
description: Merge knowledge databases from git-worktree feature branches into the main worktree
argument-hint: "<branch1> [branch2] [branch3...]"
tools:
  - read
  - bash

  - question
  - megamemory:understand
  - megamemory:list_conflicts
  - megamemory:resolve_conflict
---

<objective>

Merge MegaMemory knowledge databases from git-worktree feature branches into the main worktree's database.

**Problem:** When using git-worktree with gsd-mm, each worktree has its own `.megamemory/knowledge.db` that evolves independently. After merging code with git, knowledge graphs need manual merging.

**How it works:**
1. Back up the main database
2. Sequential two-way merges (MegaMemory limitation) directly into main DB
3. AI-assisted conflict resolution verified against actual codebase files
4. Session tracking via JSON file (survives context resets)

**Output:** Merged knowledge database with all conflicts resolved. Backup preserved until user confirms.

</objective>

<execution_context>
@./opencode/gsd-mm/references/preflight-check-project-exists.md
</execution_context>

<megamemory_guide>

## How to read MegaMemory responses

All project data lives in MegaMemory. If a MegaMemory query returns no results, tell the user the data wasn't found.

**`megamemory:understand` returns:**
```json
{ "matches": [ { "id": "project/state", "name": "state", "kind": "config", "summary": "{\"current_phase\":\"phase-01\", ...}", "children": [...], "edges": [...] } ] }
```

The important field is **`summary`** -- it's a JSON string containing the concept's data. Parse it to extract the fields you need. If `matches` is empty, the concept doesn't exist.

**`megamemory:list_conflicts` returns:**
```json
{
  "conflicts": [
    {
      "merge_group": "uuid-here",
      "merge_timestamp": "2025-02-11T09:30:00Z",
      "versions": [
        {
          "id": "concept-id::left",
          "original_id": "concept-id",
          "source_branch": "main",
          "name": "phase-01",
          "kind": "feature",
          "summary": "...",
          "why": "...",
          "file_refs": ["src/auth/jwt.ts"],
          "removed_at": null,
          "removed_reason": null
        }
      ]
    }
  ]
}
```

**`megamemory:resolve_conflict` accepts:**
```json
{
  "merge_group": "uuid-here",
  "resolved": {
    "summary": "Correct content verified against codebase",
    "why": "Codebase uses JWT authentication, not sessions",
    "file_refs": ["src/auth/jwt.ts", "src/auth/redis.ts"]
  },
  "reason": "Read src/auth/jwt.ts -- JWT version matches actual implementation"
}
```

This supports custom AI-written resolutions, not just keep-left/keep-right.

</megamemory_guide>

<context>
User's arguments: `$ARGUMENTS`

Arguments are space-separated subdirectory names of feature worktrees to merge.

Example:
```
/gsd-mm-merge-worktrees feature-A feature-B
```
</context>

<process>

## Phase 0: Preflight Checks

Follow the MegaMemory Project Exists Preflight Check from @preflight-check-project-exists.md.

**Step 0.1: Validate arguments**

```
const branches = $ARGUMENTS.trim().split(/\s+/)
if (branches.length === 0 || branches[0] === "") {
  Display: "Usage: /gsd-mm-merge-worktrees <branch1> [branch2] [branch3...]"
  Display: "Example: /gsd-mm-merge-worktrees feature-auth feature-api"
  Stop
}
```

**Step 0.2: Verify main worktree database exists**

```bash
test -f .megamemory/knowledge.db
```

If not found:
--> Display: "No .megamemory/knowledge.db in current directory. Run this command from your main worktree."
--> Stop

**Step 0.3: Verify each worktree database exists**

For each branch in branches:
```bash
test -f "${branch}/.megamemory/knowledge.db"
```

If any missing:
--> Display: "Database not found: ${branch}/.megamemory/knowledge.db"
--> Display: "Ensure the worktree exists and has been used with gsd-mm."
--> Stop

**Step 0.4: Check for existing merge session**

```bash
test -f .megamemory/merge-session.json
```

If exists:
--> Read `.megamemory/merge-session.json` and parse JSON
--> Use question:
```
const resumeResponse = question(questions=[{
  header: "Resume?",
  question: "Found an in-progress merge session. Resume where it left off?",
  options: [
    {label: "Resume", description: "Continue from branch ${session.current_index + 1}/${session.branches.length}"},
    {label: "Start fresh", description: "Discard previous session and start over"}
  ]
}])
```

If "Resume": Load session state and skip to the appropriate phase/branch.
If "Start fresh": Delete the session file and continue.

---

## Phase 1: Safety Preparations

**Step 1.1: Create timestamped backup**

```bash
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
cp .megamemory/knowledge.db ".megamemory/knowledge.db.backup-${TIMESTAMP}"
```

Display:
```
Backup created: .megamemory/knowledge.db.backup-${TIMESTAMP}
```

**Step 1.2: Initialize merge session**

Create `.megamemory/merge-session.json`:

```json
{
  "session_id": "merge-${TIMESTAMP}",
  "started_at": "${ISO_TIMESTAMP}",
  "status": "in_progress",
  "branches": ["feature-A", "feature-B"],
  "current_index": 0,
  "conflicts_detected": 0,
  "conflicts_resolved": 0,
  "backup_path": ".megamemory/knowledge.db.backup-${TIMESTAMP}",
  "error": null
}
```

Write this JSON to `.megamemory/merge-session.json`.

---

## Phase 2: Sequential Merge Loop

For each branch at index `i`:

**Step 2.1: Display progress**

```
============================================================
Merging branch ${i+1}/${branches.length}: ${branch}
============================================================
```

**Step 2.2: Determine labels**

```
if (i === 0) {
  leftLabel = "main"
} else {
  leftLabel = "merged-" + i
}
rightLabel = branch
```

**Step 2.3: Run merge directly into main database**

```bash
megamemory merge .megamemory/knowledge.db ${branch}/.megamemory/knowledge.db \
  --left-label ${leftLabel} \
  --right-label ${rightLabel}
```

This merges directly into `.megamemory/knowledge.db` using atomic operations (temp + rename) internally. Combined with the Phase 1 backup, this is safe.

**Step 2.4: Parse merge output**

Check the CLI output for conflict count. If conflicts > 0, proceed to Phase 3. If no conflicts, display success and continue to next branch.

**Step 2.5: Update merge session**

```json
{
  "current_index": i,
  "conflicts_detected": session.conflicts_detected + newConflicts
}
```

Write updated session to `.megamemory/merge-session.json`.

---

## Phase 3: Conflict Detection and Resolution

After each merge that reports conflicts:

**Step 3.1: List conflicts**

Call `megamemory:list_conflicts()`.

Since we merged directly into the main database, the MCP tool operates on the correct data.

**Step 3.2: For each conflict group, present to user**

For each conflict in the conflicts array:

Display:
```
--------------------------------------------------------------
Conflict: ${conflict.versions[0].name}
Merge group: ${conflict.merge_group}

${leftLabel}:
  Type: ${versions[0].kind}
  Name: ${versions[0].name}
  Summary: ${versions[0].summary} (first 200 chars)
  Files: ${versions[0].file_refs?.join(", ") || "none"}

${rightLabel}:
  Type: ${versions[1].kind}
  Name: ${versions[1].name}
  Summary: ${versions[1].summary} (first 200 chars)
  Files: ${versions[1].file_refs?.join(", ") || "none"}
--------------------------------------------------------------
```

Use question:
```
const resolveResponse = question(questions=[{
  header: "Resolve",
  question: "How should this conflict be resolved?",
  options: [
    {label: "AI verify", description: "Read referenced files and determine correct resolution (Recommended)"},
    {label: "Keep left", description: "Keep version from ${leftLabel}"},
    {label: "Keep right", description: "Keep version from ${rightLabel}"},
    {label: "Keep both", description: "Keep both as separate concepts"},
    {label: "Skip", description: "Leave unresolved for now"}
  ]
}])
```

**Step 3.3: Execute resolution based on choice**

If **"Keep left"**, **"Keep right"**, or **"Keep both"**:
```bash
megamemory resolve ${conflict.merge_group} --keep left|right|both
```

If **"Skip"**: Continue to next conflict.

If **"AI verify"**: Proceed to Phase 4 for this conflict.

---

## Phase 4: AI Resolution Logic

When user selects "AI verify" for a conflict:

**Step 4.1: Extract and read file references**

Collect all file paths from both conflict versions:
```
const allFiles = [
  ...(versions[0].file_refs || []),
  ...(versions[1].file_refs || [])
]
const uniqueFiles = [...new Set(allFiles)]
```

For each file, use the `read` tool to check if it exists and get its contents. Track which files exist vs missing.

**Step 4.2: Check for edge cases during analysis**

While reading both versions and their files, also check for:

- **Deletion conflicts**: One version has `removed_at` set while the other was updated. Flag this: "Concept deleted in ${branch} but updated in ${otherBranch}."
- **Renames**: Both versions have the same `kind` and similar file refs but different names. Flag this: "Possible rename detected."
- **Dangling file refs**: File paths referenced in the concept that don't exist on disk. Flag each missing file.
- **Content drift**: Both versions were independently updated with complementary (non-conflicting) changes. Flag if changes affect different sections.

**Step 4.3: Determine resolution strategy**

Based on the analysis:

**Strategy A: Files deleted -- keep version with existing files**
If one version references files that don't exist but the other version's files all exist, keep the version with existing files.

**Strategy B: Diverged features -- keep both**
If the two versions describe clearly different features (different file refs, different summary topics), recommend keeping both as separate concepts.

**Strategy C: One version more complete**
If both versions are about the same thing but one has significantly more detail (more file refs, longer summary, more structure), keep the more complete version.

**Strategy D: Complementary changes -- merge content**
If both versions updated different aspects of the same concept, write a merged resolution combining both.

**Strategy E: Cannot determine -- ask user**
If none of the above apply clearly, present findings and ask the user to decide.

**Step 4.4: Present findings and get approval**

Display:
```
AI Resolution for: ${name}
--------------------------------------------------------------
File verification:
  ${fileResults.map(f => `${f.exists ? "OK" : "MISSING"} ${f.path}`).join("\n  ")}

${edgeCaseFlags.length > 0 ? "Edge cases detected:\n  " + edgeCaseFlags.join("\n  ") : ""}

Resolution: ${strategyDescription}
Reason: ${reasonText}
--------------------------------------------------------------
```

Use question:
```
const applyResponse = question(questions=[{
  header: "Apply?",
  question: "Apply this resolution?",
  options: [
    {label: "Apply", description: "Accept AI resolution"},
    {label: "Keep left", description: "Override: keep ${leftLabel} version"},
    {label: "Keep right", description: "Override: keep ${rightLabel} version"},
    {label: "Keep both", description: "Override: keep both versions"}
  ]
}])
```

**Step 4.5: Apply resolution**

If user approves the AI resolution, call `megamemory:resolve_conflict`:
```
megamemory:resolve_conflict({
  merge_group: conflict.merge_group,
  resolved: {
    summary: resolvedSummary,
    why: resolvedWhy,
    file_refs: resolvedFileRefs
  },
  reason: reasonText
})
```

If user overrides with keep left/right/both:
```bash
megamemory resolve ${conflict.merge_group} --keep left|right|both
```

**Step 4.6: Update session**

Increment `conflicts_resolved` in the merge session JSON. Write updated session.

---

## Phase 5: Post-Merge Validation

After all branches are merged and conflicts resolved:

**Step 5.1: Check for remaining conflicts**

Call `megamemory:list_conflicts()` one final time.

If conflicts remain:
--> Display: "${count} unresolved conflicts remain."
--> Use question:
```
const unresolvedResponse = question(questions=[{
  header: "Unresolved",
  question: "There are still unresolved conflicts. What would you like to do?",
  options: [
    {label: "Resolve now", description: "Go through remaining conflicts"},
    {label: "Leave as-is", description: "Accept current state with unresolved conflicts"},
    {label: "Rollback", description: "Restore backup and abort merge"}
  ]
}])
```

If "Resolve now": Loop back to Phase 3 for remaining conflicts.
If "Rollback": Proceed to error handling (Phase 7).

**Step 5.2: Spot-check merged data**

Call `megamemory:understand` with `query=""` and `top_k=5` to verify the database is readable and contains concepts. If the tool errors, warn the user and offer rollback.

---

## Phase 6: Finalize

**Step 6.1: Update merge session**

```json
{
  "status": "complete",
  "completed_at": "${ISO_TIMESTAMP}"
}
```

Write updated session.

**Step 6.2: Display summary**

```
============================================================
MERGE COMPLETE
============================================================

Merge Summary
  Branches merged: ${branches.length}
  Conflicts detected: ${session.conflicts_detected}
  Conflicts resolved: ${session.conflicts_resolved}
  Session: ${session.session_id}
  Backup: ${session.backup_path}

You can delete the backup when confident:
  ${session.backup_path}

Merge session archived:
  .megamemory/merge-session.json
```

---

## Phase 7: Error Handling and Rollback

On any unrecoverable error or user-requested rollback:

**Step 7.1: Restore from backup**

```bash
cp "${session.backup_path}" .megamemory/knowledge.db
```

**Step 7.2: Update merge session**

```json
{
  "status": "failed",
  "error": "${errorMessage}",
  "failed_at": "${ISO_TIMESTAMP}"
}
```

**Step 7.3: Inform user**

Display:
```
MERGE FAILED

Database restored from backup: ${session.backup_path}
Error: ${errorMessage}
Session: .megamemory/merge-session.json

The merge session file is preserved for debugging.
To retry: /gsd-mm-merge-worktrees ${branches.join(" ")}
```

</process>

<success_criteria>

- [ ] Preflight checks passed (connectivity, DB exists, worktree DBs exist)
- [ ] Backup created before any merge operations
- [ ] Merge session JSON created and updated throughout
- [ ] Each branch merged sequentially into main DB
- [ ] Conflicts detected via megamemory:list_conflicts
- [ ] AI resolution reads actual codebase files to verify
- [ ] Edge cases (renames, deletions, dangling refs) checked during resolution
- [ ] Custom resolutions applied via megamemory:resolve_conflict
- [ ] Post-merge validation confirms DB is readable
- [ ] Summary displayed with conflict statistics
- [ ] Backup path communicated for user cleanup
- [ ] On error: backup restored, session preserved for debugging

</success_criteria>
