# Enhanced Migration Guide

## Overview

Migrate existing `.planning/` directory projects to MegaMemory-backed storage using the enhanced migration script.

## When to Migrate

### New Projects
Start with `/gsd-mm-new-project` — no migration needed.

### Existing Projects
Migrate when:
- Converting from file-based GSD to MM-based GSD
- Want semantic search across project data
- Starting new project after using file-based GSD

## Migration Script

**Location:** `get-shit-done-mm/migration/enhanced-migration.ts`

**Usage:**

```bash
# Basic migration
npx ts-node get-shit-done-mm/migration/enhanced-migration.ts /path/to/project

# Clean migration (delete existing MM database)
npx ts-node get-shit-done-mm/migration/enhanced-migration.ts /path/to/project --clean

# Dry-run (show what would be created)
npx ts-node get-shit-done-mm/migration/enhanced-migration.ts /path/to/project --dry-run

# Incremental migration (migrate only new concepts)
npx ts-node get-shit-done-mm/migration/enhanced-migration.ts /path/to/project --incremental

# Rollback
npx ts-node get-shit-done-mm/migration/enhanced-migration.ts /path/to/project --rollback
```

## What Gets Migrated

### Core Concepts

- `project` - Project metadata, requirements, decisions
- `requirements` - Feature requirements (validated/active/out_of_scope)
- `roadmap` - Phase planning with status tracking
- `state` - Project state (current position, metrics, decisions)
- `milestone` - Milestone tracking
- `config` - Planning behavior settings

### Phase-Level Concepts

For each phase in `.planning/phases/`:

- `phase` - Phase metadata (number, name, goal, status)
- `context` - Implementation decisions (what was decided)
- `plan` - Executable plans (tasks, dependencies, waves)
- `summary` - Execution results (what was built, commits, issues)
- `research` - Investigation findings (what was researched)
- `uat` - User acceptance test results

### Research Documents

- All files in `.planning/research/` as `pattern:*` concepts

### Todos

- All files in `.planning/todos/pending/` as `todo:*` concepts

### GSD Patterns (NEW)

All patterns from `get-shit-done/references/`:
- Checkpoint patterns (verify, decision, action)
- TDD patterns
- Verification patterns
- Git integration patterns
- Planning config
- Model profiles
- Questioning patterns
- UI brand guidelines
- Continuation formats

## Migration Process

### 1. Pre-Migration

**Backup:**
Script automatically creates `.planning.backup` directory.

```bash
# Verify backup exists after migration
ls -la /path/to/project/.planning.backup
```

**Requirements:**
- MegaMemory >= 1.2.1
- Valid `.planning/` directory structure
- `.planning/PROJECT.md` exists

### 2. Migration Execution

**Phase 1: Read Planning Files**
- Parse PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md
- Read all phase directories and their files
- Read research docs, todos, configs

**Phase 2: Create Project Concepts**
- Create `project` root concept
- Create `requirements`, `roadmap`, `state`, `milestone` children
- Create `config` concept

**Phase 3: Create Phase Concepts**
- Create `phase` concepts for each phase
- Create `context`, `plan`, `summary`, `research`, `uat` children
- Link concepts via relationships

**Phase 4: Create Research & Todos**
- Create `pattern:*` concepts for research docs
- Create `todo:*` concepts for pending items

**Phase 5: Migrate GSD Patterns (NEW)**
- Extract patterns from `get-shit-done/references/`
- Create `pattern:*` concepts for MM operations
- Link patterns to relevant workflow concepts

**Phase 6: Verification**
- Verify all concepts created
- Check relationships are correct
- Test semantic search queries

### 3. Post-Migration

**Automatic:**
- `.planning.backup` created
- Migration statistics displayed
- Database verified

**Manual:**
- Run `/gsd-mm-progress` to verify project state
- Run `/gsd-mm-export-md` to see MM data as markdown (if needed)

## Verification

### Quick Check

```bash
# Query project state from MM
npx megamemory query "project state"

# Should return project/state concept with JSON summary
```

### Full Test

See `get-shit-done-mm/test/` for manual verification scripts.

## Rollback

If migration fails or results are incorrect:

```bash
npx ts-node get-shit-done-mm/migration/enhanced-migration.ts /path/to/project --rollback
```

**What rollback does:**
- Removes `.megamemory/knowledge.db`
- Restores from `.planning.backup`
- Projects resumes file-based operation

## Troubleshooting

### Migration Fails

**Error: "MegaMemory not found"**
```bash
# MegaMemory not installed globally
npm install -g megamemory

# Or use local version
npx megamemory query "test"
```

**Error: "PLANNING.md not found"**
```bash
# Initialize project first
cd /path/to/project
/gsd-mm-new-project
```

### Concepts Not Found

**Error: Query returns empty results**

```bash
# Check embeddings generated
npx megamemory list-embeddings

# Should show all concepts have embeddings
```

### Data Loss

**Issue: Important data missing after migration**

```bash
# Check backup
cat .planning.backup/PROJECT.md

# Verify backup has the data
# If yes: Rerun migration with --clean
```

## Incremental Migration

For ongoing projects, use `--incremental` to migrate only new data:

```bash
# After new phase added
npx ts-node get-shit-done-mm/migration/enhanced-migration.ts /path/to/project --incremental
```

**What incremental does:**
- Scans `.planning/` for new files
- Creates concepts only for new data
- Updates existing concepts with new relationships
- Faster than full migration

## Dry-Run Mode

Preview migration without executing:

```bash
npx ts-node get-shit-done-mm/migration/enhanced-migration.ts /path/to/project --dry-run
```

**Shows:**
- What concepts would be created
- What relationships would be linked
- Estimated size of MM database
- Any warnings or issues

## Migration Statistics

After migration completes, script displays:

```
=== Migration Statistics ===
Created: 127 concepts
Updated: 23 concepts (incremental)
Skipped: 0
Errors: 0

=== Concept Breakdown ===
Project: 7 concepts
Phase: 85 concepts
Research: 23 concepts
Todos: 12 concepts
GSD Patterns: 10 concepts

=== Relationships Created ===
depends_on: 42 links
implements: 85 links
connects_to: 156 links

========================
```

## Next Steps

After successful migration:

1. **Verify project state:**
   ```bash
   /gsd-mm-progress
   ```

2. **Test a workflow:**
   ```bash
   /gsd-mm-discuss-phase 01
   /gsd-mm-plan-phase 01
   ```

3. **Optional: Remove .planning/:**
   ```bash
   # Only if confident migration succeeded
   rm -rf .planning
   ```

## FAQ

### Q: Can I use both file-based and MM-based GSD?
**A:** No. Pick one. MM-based is recommended for new projects.

### Q: Will migration break my existing gsd commands?
**A:** Existing commands reference `.planning/` files and won't work. Use `gsd-mm-*` commands instead.

### Q: How do I verify migration worked?
**A:** Run `/gsd-mm-progress` to query MM for project state. Compare with original `.planning.backup/`.

### Q: Can I edit concepts directly?
**A:** Yes, via MM tools. But prefer using `gsd-mm-*` commands which update concepts correctly.

## Support

Issues: Report at https://github.com/anomalyco/get-shit-done/issues
