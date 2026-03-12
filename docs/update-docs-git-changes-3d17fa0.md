---
doc_id: doc-003
slug: update-docs-git-changes-3d17fa0
type: guide
audience: team
depth: standard
generated: 2026-03-12
mode: researched
target_files: [docs/configuration.md, docs/workflow.md, docs/getting-started.md, docs/commands.md]
---

# Documentation Update: Git Changes Since 3d17fa0

This guide documents the changes made to Fuska documentation to reflect git commits from 3d17fa0 through HEAD.

## Overview of Changes

**Commits analyzed:** 12
**Critical changes:** 2
**Files updated:** 4

### Critical Changes

| Change | Commit | Impact | Files Affected |
|--------|--------|--------|----------------|
| Default execution mode changed to sequential | `5e10dbc` | **Breaking** — prevents database corruption | configuration.md, workflow.md, getting-started.md |
| fuska-chapterize auto-updates roadmap | `ed0a006` | **Workflow improvement** — no separate `/fuska-add-chapter` needed | workflow.md, commands.md |

### File Mapping

| File | Priority | Updates Required |
|------|----------|------------------|
| `docs/configuration.md` | Critical | Add parallel mode warning, update defaults |
| `docs/workflow.md` | Critical | Add parallel execution warning, remove chapter number prompts |
| `docs/getting-started.md` | Critical | Update sequential default mention |
| `docs/commands.md` | Medium | Update chapterize description with auto-roadmap-update |

### Files Not Requiring Updates

- `README.md` — No references to parallel/sequential defaults
- `docs/concepts.md` — Already documents lessons-learned feature correctly
- `docs/tutorial.md` — Still valid and correctly referenced

---

## Prerequisites

Before applying these documentation updates:

- [ ] Access to the git repository at commit 3d17fa0 or later
- [ ] Review of commits 3d17fa0..HEAD to confirm all changes
- [ ] Confirmation that research analysis is complete

---

## Breaking Change: Execution Mode (docs/configuration.md)

**Commit:** `5e10dbc`
**Change:** Default execution changed from parallel to sequential

### Why the Change

Parallel execution under high load caused database corruption in MegaMemory. Sequential execution prevents concurrent writes that could lead to data loss.

### Updates Required

**Location:** Configuration section describing workflow preferences

**Add warning block:**

```markdown
### Execution Mode

> **Warning:** Parallel execution can cause database corruption under high load.
> Sequential execution is now the default for data integrity.

Controls how Fuska executes tasks within a batch:

| Mode | Behavior | Risk Level |
|------|----------|------------|
| **sequential** (default) | Tasks execute one at a time | Low — safe for all workloads |
| **parallel** | Tasks execute concurrently | High — may cause database corruption |

**When to use parallel:** Only in low-load scenarios with small batch sizes (≤3 tasks) where execution speed is critical and data loss risk is acceptable.

Configure mode:
```bash
fuska config
# Select "Quick settings" -> execution mode
```
```

---

## Workflow Improvements (docs/workflow.md)

**Commit:** `ed0a006`
**Change:** fuska-chapterize now auto-updates roadmap

### Updates Required

#### 1. Add Parallel Execution Warning (Line ~103)

**Location:** After the Plan section in Chapter Lifecycle

**Add:**

```markdown
### Build

```
/fuska-build
```

> **Warning:** Parallel execution mode can cause database corruption under high load.
> Use sequential mode (now default) for production work. Parallel is only safe for
> small batches (≤3 tasks) in low-load scenarios.
```

#### 2. Remove Chapter Number Prompts from Chapterize Examples

**Lines 349-357, 370-377, 401-408:** Remove `? Chapter number:` prompts

**Before:**
```bash
/fuska-chapterize task-029-large-auth
# Interactive prompts:
# ? Chapter name: User Authentication System
# ? Chapter goal: Secure user authentication with OAuth and JWT
# ? Chapter number: 03
# ? Research domain? [Yes/No]
```

**After:**
```bash
/fuska-chapterize task-029-large-auth
# Interactive prompts:
# ? Chapter name: User Authentication System
# ? Chapter goal: Secure user authentication with OAuth and JWT
# ? Research domain? [Yes/No]
# → Automatically updates roadmap (no separate /fuska-add-chapter needed)
```

#### 3. Update Chapterize Description

Update the section describing chapterize to note auto-roadmap-update:

```markdown
Creates chapter structure from plan or conversation and **automatically adds it to the roadmap**.
No separate `/fuska-add-chapter` call is required.
```

---

## Getting Started Update (docs/getting-started.md)

**Commit:** `5e10dbc`
**Location:** Line 116

### Current Text

```markdown
Walks through initiative configuration:
- Deep questioning (or uses stored description if provided)
- Workflow preferences (mode, depth, parallelization, commits)
- Research domain ecosystem (optional)
```

### Updated Text

```markdown
Walks through initiative configuration:
- Deep questioning (or uses stored description if provided)
- Workflow preferences (mode, depth, execution, commits) — **sequential execution is default**
- Research domain ecosystem (optional)
```

**Rationale:** Explicitly state the default to set expectations for new users.

---

## Command Reference Update (docs/commands.md)

**Commit:** `ed0a006`
**Location:** `/fuska-chapterize` command description

### Current Text

```markdown
| <nobr>`/fuska-chapterize`</nobr> | Transform large plans or planning context into chapter structures with subplans | `[plan-id] [--research]` -- optional plan ID, optional research flag |
```

### Updated Text

```markdown
| <nobr>`/fuska-chapterize`</nobr> | Transform large plans or planning context into chapter structures with subplans, **automatically adds to roadmap** | `[plan-id] [--research]` -- optional plan ID, optional research flag |
```

### Add Note

After the command table entry:

```markdown
**Note:** `/fuska-chapterize` automatically updates the roadmap with the new chapter.
A separate `/fuska-add-chapter` call is not required.
```

---

## Examples

### Before/After: Execution Mode Warning

**Before (configuration.md):**
```
Configure execution mode via fuska config.
```

**After (configuration.md):**
```
> **Warning:** Parallel execution can cause database corruption under high load.
> Sequential execution is now the default for data integrity.

Configure execution mode via fuska config. Use sequential (default) for production.
```

### Before/After: Chapterize Workflow

**Before (workflow.md):**
```bash
/fuska-chapterize task-029-large-auth
# ? Chapter number: 03

# After chapterization:
/fuska-add-chapter "User Authentication System"
```

**After (workflow.md):**
```bash
/fuska-chapterize task-029-large-auth
# (no chapter number prompt)
# → Chapter automatically added to roadmap
```

---

## Verification Checklist

After applying all updates:

- [ ] **configuration.md:** Sequential default appears with warning
- [ ] **configuration.md:** Parallel mode risk documented
- [ ] **workflow.md:** Parallel execution warning present (~line 103)
- [ ] **workflow.md:** Chapter number prompts removed from all chapterize examples
- [ ] **workflow.md:** Auto-roadmap-update mentioned in chapterize description
- [ ] **getting-started.md:** Sequential default noted in `/fuska-configure` section
- [ ] **commands.md:** `/fuska-chapterize` description mentions auto-roadmap-update
- [ ] **Cross-references:** All doc links still valid
- [ ] **No stale references:** Removed mentions of `/fuska-add-chapter` requirement after chapterize

### Local Preview

Run a local documentation preview to verify formatting:

```bash
# If using a markdown previewer
grip docs/configuration.md
grip docs/workflow.md
grip docs/getting-started.md
grip docs/commands.md
```

---

## Next Steps

### Commit Message Guidelines

When committing these documentation updates:

```
docs: update for git changes since 3d17fa0

- Add parallel execution warning (breaking change from 5e10dbc)
- Document sequential as default execution mode
- Update chapterize to mention auto-roadmap-update (ed0a006)
- Remove chapter number prompts from chapterize examples
```

### PR Review Requirements

- [ ] Verify all critical changes documented
- [ ] Confirm warning language is appropriate
- [ ] Check that removed content (chapter number prompts) is no longer referenced elsewhere
- [ ] Validate that new users will understand sequential is the safe default

---

## Files Not Requiring Updates

The following files were reviewed but require no changes:

| File | Reason |
|------|--------|
| `README.md` | No references to parallel/sequential execution defaults |
| `docs/concepts.md` | Lessons-learned feature already documented correctly (commit 131352b) |
| `docs/tutorial.md` | Tutorial content still valid; no execution mode references |

---

## See Also

- [configuration.md](configuration.md) — Updated execution mode documentation
- [workflow.md](workflow.md) — Updated chapterize workflow examples
- [commands.md](commands.md) — Updated `/fuska-chapterize` reference
