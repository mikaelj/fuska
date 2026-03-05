---
name: fuska-migrate-chapter-names
description: Migrate chapter concept names to zero-padded format for consistent naming and correct parent_id linkage
argument-hint: "[--dry-run] [--json] [--verify-only]"
flags: --dry-run, --json, --verify-only
tools:
  - read
  - bash
  - megamemory:understand
  - megamemory:update_concept
  - megamemory:list_roots
---

<objective>
Migrate chapter concept names from non-padded format (chapter-1, chapter-4) to zero-padded format (chapter-01, chapter-04).

**Problem:** Chapter concepts are created with non-padded names, but coordinators normalize to zero-padded format. This causes parent_id mismatches where child concepts point to non-existent parents.

**Solution:** Rename all chapter concepts to zero-padded format, update slug fields, parent_id references, edge references, state, and roadmap concepts.

**Safety:** Creates automatic backup before migration. Runs verification after migration to ensure no dangling references.
</objective>

<execution_context>
@../../fuska/references/megamemory-quick-ref.md
</execution_context>

<context>
**Flags:**
- `--dry-run` -- Show what would change without updating MegaMemory
- `--json` -- Output migration report as JSON
- `--verify-only` -- Check for naming issues without fixing

Variable: `$ARGUMENTS` contains flags.
</context>

<process>

## 1. Parse Arguments

```
const input = "$ARGUMENTS" || ""
const hasDryRunFlag = input.includes("--dry-run")
const hasJsonFlag = input.includes("--json")
const hasVerifyOnlyFlag = input.includes("--verify-only")
```

## 2. Create Backup

If not dry-run and not verify-only:
- Create timestamped backup: `.megamemory/knowledge.db.backup-YYYY-MM-DDTHH-mm-ss`

## 3. Detect Chapters to Rename

Query all concepts. Find chapters matching `/^chapter-\d$/` (single digit, no padding).

## 4. Execute Migration

For each chapter to rename:
1. Update concept name to zero-padded format
2. Update slug field in summary
3. Find and update all parent_id references
4. Find and update all edge references
5. Update state.current_chapter if affected
6. Update roadmap.chapters[].slug if affected

## 5. Verification

After migration:
- Check no non-padded chapter names remain
- Check no dangling parent_id references
- Check no dangling edge references

Report results.

</process>

<output>
Migration report with:
- Chapters renamed
- Slugs updated
- References updated
- Verification status
- Backup path (if created)
</output>
