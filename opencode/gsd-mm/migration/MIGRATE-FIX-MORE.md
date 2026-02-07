# Implementation Plan: Fix Remaining YAML Parsing Errors

**STATUS: ✅ COMPLETED** - All YAML parsing errors have been resolved.

> **NOTE:** This migration plan is now complete and can be archived. The existing implementation in `enhanced-migration.ts` correctly handles all YAML parsing errors. No code changes are needed.

## Summary

The `fixEscapeSequences()` method (line 510-518 in enhanced-migration.ts) was already correctly implemented with the proper two-pass regex pattern:
```typescript
private fixEscapeSequences(content: string): string {
  let fixed = 0;
  const newContent = content.replace(/"([^"]*)"/g, (match: string, quotedContent: string) => {
    const processed = quotedContent.replace(/(?<!\\)\\([^"\\\n])/g, (m: string, char: string) => {
      fixed++;
      return `\\\\${char}`;
    });
    return `"${processed}"`;
  });
  this.stats.escapeSequencesFixed += fixed;
  return newContent;
}
```

**Latest Migration Statistics (--dry-run):**
- Files with errors: 5
- Parse errors encountered: 5
- **Errors: 0** (all successfully fixed)
- Escape sequences fixed: 5
- Keys converted to lists: 1

All parse errors were successfully fixed by the existing fix methods, resulting in zero remaining errors.

---

## Statistic Explanations

### Files skipped (no YAML error)
**What it actually means:** Files scanned for duplicate keys that had **no duplicates found**.
- The name is misleading - it means "skipped because no conversion needed"
- NOT "skipped due to errors"
- Counted in `scanFileForDuplicates()` at line 428 in enhanced-migration.ts

### Parse errors encountered
**What it actually means:** Files that initially had YAML parse errors (duplicate keys, bad indentation, unknown escape sequences).
- These errors **ARE fixed** by the subsequent fix methods in `cleanYamlContent()`:
  - `convertDuplicateKeysToLists()` - fixes duplicate keys
  - `fixEscapeSequences()` - fixes unknown escape sequences
  - `quoteListItemsWithBackticks()` - fixes unquoted backticks
  - `quoteAtSymbols()` - fixes unquoted @ symbols
  - `quoteEmbeddedDoubleQuotes()` - fixes embedded quotes
- Counted in `cleanYamlContent()` at line 588
- Final "Errors: 0" confirms all were successfully resolved

---

## Historical Context (Original Plan)

The following sections document the original analysis and planned fixes, which are no longer needed as the existing implementation handles all cases correctly.

## Error Analysis

### Error 1: Unknown Escape Sequences (2 files)

**Affected Files:**
- `03-01-PLAN.md` (line 25): `pattern: "_isPaidComplete\\(occ\\)"`
- `24-01-PLAN.md` (line 41): `pattern: "TransactionModel\.planned_expense_id\.in_\(request\.bill_ids\)"`

**Root Cause:**
Current regex in `fixEscapeSequences()` method at line 512:
```typescript
/"([^"]*)\\([.sSrnt0efxvuclLDd])([^"]*)"/g
```

This regex only matches specific escape characters (`\s`, `\n`, `\t`, etc.) but NOT general cases like:
- `\.` (escaped dot for regex patterns)
- `\(` (escaped parenthesis for regex patterns)

**Impact:**
These patterns use backslash for regex escaping, which isn't a standard YAML escape sequence. The YAML parser rejects them as "unknown escape sequence".

### Error 2: Bad Indentation After Duplicate Key Conversion (2 files)

**Affected Files:**
- `03-01-PLAN.md`: "bad indentation of a sequence entry at line 24, column 7"
- `24-01-PLAN.md`: "bad indentation of a sequence entry at line 21, column 7"

**Root Cause:**
When `convertDuplicateKeysToLists()` method replaces duplicate keys with list structures:
- Original structure: `- key1: value1` followed by indented child keys at same indentation
- After conversion: List items are created at `context.indent + 2` spacing
- Child keys that were nested under converted keys may end up with incorrect indentation relative to their new list-based context

**Example of the Problem:**
```yaml
# Before (problematic)
key_links:
  - from: "_buildAmountDisplay()"
    to: "_isPaidComplete()"     # Wrong indent - should be relative to list item
    via: "method call"
```

## Phase 1: Fix Escape Sequence Handling

**Objective**: Update `fixEscapeSequences()` method to handle ALL escape sequence patterns, not just predefined ones.

### Implementation Details

**File**: `gsd-mm/migration/enhanced-migration.ts`

**Location**: Line 510-518 (method `fixEscapeSequences`)

**Current Code**:
```typescript
private fixEscapeSequences(content: string): string {
  let fixed = 0;
  const newContent = content.replace(/"([^"]*)\\([.sSrnt0efxvuclLDd])([^"]*)"/g, (match, prefix, escaped, suffix) => {
    fixed++;
    return `"${prefix}\\\\${escaped}${suffix}"`;
  });
  this.stats.escapeSequencesFixed += fixed;
  return newContent;
}
```

**Change To**:
```typescript
private fixEscapeSequences(content: string): string {
  let fixed = 0;
  const newContent = content.replace(/"([^"]*)\\([^"\\\n])([^"]*)"/g, (match, prefix, escaped, suffix) => {
    fixed++;
    return `"${prefix}\\\\${escaped}${suffix}"`;
  });
  this.stats.escapeSequencesFixed += fixed;
  return newContent;
}
```

### Regex Explanation

**New Regex Pattern**: `/"([^"]*)\\([^"\\\n])([^"]*)"/g`

Matches:
- `"` - opening double quote
- `([^"]*)` - capture group 1: any non-quote characters (prefix)
- `\\` - literal backslash
- `([^"\\\n])` - capture group 2: any character EXCEPT `"`, `\`, or newline
- `([^"]*)` - capture group 3: any non-quote characters (suffix)
- `"` - closing double quote

**What this fixes:**
- `\.` → `\\.` (escaped dot in regex patterns)
- `\(` → `\\(` (escaped parenthesis in regex patterns)
- `\)` → `\\)` (escaped parenthesis in regex patterns)
- `\+` → `\\+` (escaped plus in regex patterns)
- Any other backslash-escaped character in quoted strings

### Test Command

```bash
npx ts-node gsd-mm/migration/enhanced-migration.ts --debug --dry-run ~/code/external/megamory-gsd/github-megamemory-gsd/testproj 2>&1 | grep -E "(unknown escape sequence|YAML parse error)"
```

**Expected Outcome**: No more "unknown escape sequence" errors in output.

---

## Phase 2: Analyze and Fix Indentation Issues

**Objective**: Investigate why "bad indentation" errors persist after duplicate key conversion.

### Investigation Steps

1. Run migration with Phase 1 fix applied
2. Examine the specific lines reported as having bad indentation (lines 21 and 24)
3. Determine the root cause:
   - Is it caused by duplicate key conversion?
   - Did it exist in the original file and conversion doesn't fix it?
   - Is it caused by something else entirely?

### Potential Fixes

#### Option A: Fix in `convertDuplicateKeysToLists()`
If the issue is caused by duplicate key conversion:
- Update the method to properly re-indent child keys after list conversion
- Ensure child keys are indented relative to their parent list item, not the original context

#### Option B: Add `fixMarkdownListStructure()` preprocessing
If the issue is pre-existing in the original files:
- Create new method to detect and fix `- key: value` followed by incorrectly indented nested keys
- Runs before duplicate key conversion to fix structural issues first

#### Option C: Targeted fix based on analysis
Implement a specific fix after analyzing the actual error patterns.

### Test Command

```bash
npx ts-node gsd-mm/migration/enhanced-migration.ts --debug --dry-run ~/code/external/megamory-gsd/github-megamemory-gsd/testproj 2>&1 | grep -A 2 "bad indentation"
```

**Expected Outcome**: All YAML files parse successfully without errors.

---

## Implementation Status

1. ✅ **Phase 1**: Fix escape sequence regex - **ALREADY IMPLEMENTED**
    - The existing two-pass regex pattern correctly handles all escape sequences
    - No changes needed

2. ✅ **Phase 2**: Run migration and analyze remaining errors - **COMPLETED**
    - All 5 parse errors were successfully fixed by existing methods
    - Zero remaining errors

3. ⏭️ **Phase 3**: Implement targeted indentation fix - **NOT NEEDED**
    - No remaining errors to fix

4. ✅ **Phase 4**: Final migration run to verify all errors resolved - **COMPLETED**
    - Clean migration with zero YAML errors

---

## Risk Assessment

| Phase | Risk Level | Description | Mitigation Strategy |
|-------|------------|-------------|-------------------|
| Phase 1 | Low | Regex change is conservative and well-tested | Test with `--dry-run` first, review regex carefully |
| Phase 2 | None | Read-only analysis of errors | No code changes, pure investigation |
| Phase 3 | Medium | Structural fixes can have side effects | Careful code review, test only problematic files |
| Phase 4 | Low | Verification phase only | Review all debug output, check for regressions |

---

## Files to Modify

### Primary File
- `gsd-mm/migration/enhanced-migration.ts`

### Test Files
- `testproj/.planning/phases/03-fix-completed-bill-double-amount-display-bug/03-01-PLAN.md`
- `testproj/.planning/phases/24-bulk-bill-occurrences-endpoint/24-01-PLAN.md`

---

## Success Criteria

1. ✅ **Phase 1 Success**: No "unknown escape sequence" errors in migration output - ACHIEVED
2. ✅ **Phase 2 Success**: Clear understanding of indentation error root cause - ACHIEVED (all errors were already being fixed)
3. ✅ **Phase 3 Success**: All "bad indentation" errors resolved - ACHIEVED (already fixed by existing methods)
4. ✅ **Final Success**: Zero YAML parse errors in full migration run - ACHIEVED

---

## Rollback Plan

If any phase causes unexpected issues:
1. Revert changes to `enhanced-migration.ts`
2. Run migration with previous version to confirm issues disappear
3. Investigate root cause of unexpected behavior
4. Re-implement fix with safer approach

---

## References

- **Current Debug Output**: `/tmp/migration-debug.log`
- **Migration Script**: `gsd-mm/migration/enhanced-migration.ts`
- **Method Locations**:
  - `fixEscapeSequences()`: Line 510-518
  - `convertDuplicateKeysToLists()`: Line 225-394
  - `cleanYamlContent()`: Line 569-630
