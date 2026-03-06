---
name: fuska-migrate-global-concepts
description: "Migrate codebase and research concepts to top-level (parent_id: null) for cross-initiative sharing"
argument-hint: "[--dry-run] [--no-backup] [--restore <backup>]"
flags: --dry-run, --no-backup, --restore
---

<objective>
Migrate codebase analysis concepts and research concepts from initiative-scoped (parent_id: initiativeId) to global (parent_id: null) for cross-initiative sharing.

**Problem:** Codebase analysis and research concepts were previously scoped to specific initiatives, preventing reuse across multiple initiatives in the same project.

**Solution:** Move these concepts to top-level (parent_id: null) while maintaining edge relationships to initiatives for discoverability.

**Affected concepts:**
- Codebase analysis: `codebase-tech`, `codebase-arch`, `codebase-quality`, `codebase-concerns`
- Domain knowledge: `domain-*` concepts
- Research: Chapter research concepts (`*-research`)
- Import graph: `file:*`, `symbol:*`, `dead-code:*`

**Safety:** Creates automatic backup before migration. Supports dry-run mode and restore functionality.
</objective>

<execution_context>
@../../fuska/references/megamemory-quick-ref.md
</execution_context>

<context>
**Flags:**
- `--dry-run` -- Show what would change without updating MegaMemory
- `--no-backup` -- Skip backup creation (not recommended)
- `--restore <path>` -- Restore from a backup file

Variable: `$ARGUMENTS` contains flags.
</context>

<process>

## 1. Run Command

```bash
fuska migrate global-concepts [options]
```

## 2. Review Output

The command will:
1. Scan all concepts in MegaMemory
2. Identify concepts matching global patterns (codebase-*, domain-*, *-research, file:*, symbol:*, dead-code:*)
3. Check if they have parent_id set (need migration)
4. Display found concepts grouped by type
5. Create backup (unless --no-backup)
6. Apply migration (unless --dry-run)
7. Show restore command for rollback

## 3. Verify Results

After migration:
- Global concepts should have `parent_id: null`
- Edge relationships to initiatives should be preserved
- Queries for codebase/research should work across all initiatives

## 4. Rollback if Needed

To restore from backup:
```bash
fuska migrate global-concepts --restore .megamemory/backups/megamemory-YYYY-MM-DDTHH-MM-SS.db
```

</process>

<when_to_use>
**Use this command when:**
- Setting up multi-initiative support in existing projects
- After upgrading Fuska to version with global concept support
- When codebase/research concepts are not visible across initiatives

**Skip this command when:**
- Fresh project initialization (concepts already created as global)
- All codebase/research concepts already have parent_id: null
</when_to_use>

<output>
Migration report showing:
- Number of concepts scanned
- Number of concepts requiring migration (grouped by type)
- Backup file location (if created)
- Number of concepts migrated
- Restore command for rollback

Example:
```
Migrating global concepts to top-level...

Scanning 245 concepts...

Found 12 concepts to migrate:

  codebase: 4 concepts
    - codebase-tech
    - codebase-arch
    - codebase-quality
    - codebase-concerns

  research: 8 concepts
    - chapter-01-research
    - chapter-02-research
    ... and 6 more

✓ Backup created: .megamemory/backups/megamemory-2026-03-06T12-30-45.db

Applying migration...

  Migrated 10/12...
  Migrated 12/12...

✓ Migration complete: 12 concepts moved to top level

To undo this migration, run:
  fuska migrate global-concepts --restore .megamemory/backups/megamemory-2026-03-06T12-30-45.db
```
</output>

<success_criteria>
- [ ] Command runs without errors
- [ ] Backup created (unless --no-backup)
- [ ] Global concepts moved to top level (parent_id: null)
- [ ] Edge relationships preserved
- [ ] Restore command provided for rollback
- [ ] Dry-run mode shows correct concepts without applying changes
</success_criteria>
