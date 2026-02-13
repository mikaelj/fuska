# Fix: Show Git Errors in worktree-merge Dry Run

## Problem

When `fuska worktree-merge` detects git merge errors that aren't file conflicts (e.g., uncommitted changes, branch issues), it shows:

```
Git merge (pricecalc):
  [FAIL] Conflicts in:

Errors detected in dry-run. Use --force to proceed anyway.
```

The actual error message is hidden because the code only captures conflicts, not other git failures.

## Solution

Capture and display the git stderr when merge fails but no conflicts are found.

## Implementation Plan

### 1. Add `error` field to `GitDryRunResult` interface

**File:** `src/commands/worktree-merge.ts`  
**Line:** ~91-94

```typescript
interface GitDryRunResult {
  clean: boolean;
  conflicts: string[];
  error?: string;  // Add this
}
```

### 2. Capture git stderr in `runGitDryRun`

**File:** `src/commands/worktree-merge.ts`  
**Line:** ~358-392

When merge fails but no conflicts are found, store the stderr as the error message:

```typescript
private async runGitDryRun(branch: string): Promise<GitDryRunResult> {
  const result = cp.spawnSync('git', ['merge', '--no-commit', '--no-ff', branch], {
    encoding: 'utf-8',
    cwd: this.projectDir
  });

  const exitCode = result.status;

  if (exitCode === 0) {
    cp.spawnSync('git', ['merge', '--abort'], {
      encoding: 'utf-8',
      cwd: this.projectDir
    });
    return { clean: true, conflicts: [] };
  }

  // Capture conflicts BEFORE aborting
  const conflicts: string[] = [];
  const diffResult = cp.spawnSync('git', ['diff', '--name-only', '--diff-filter=U'], {
    encoding: 'utf-8',
    cwd: this.projectDir
  });

  if (diffResult.stdout) {
    conflicts.push(...diffResult.stdout.trim().split('\n').filter(Boolean));
  }

  // Capture error message if no conflicts (e.g., uncommitted changes)
  const error = conflicts.length === 0 ? result.stderr.trim() : undefined;

  // Now abort the merge
  cp.spawnSync('git', ['merge', '--abort'], {
    encoding: 'utf-8',
    cwd: this.projectDir
  });

  return { clean: false, conflicts, error };
}
```

### 3. Display the error in `displayDryRunResults`

**File:** `src/commands/worktree-merge.ts`  
**Line:** ~394-415

Show the error message when git fails without conflicts:

```typescript
private displayDryRunResults(branch: string, mmResult: MMDryRunResult, gitResult: GitDryRunResult): void {
  console.log('\n=== DRY RUN RESULTS ===\n');

  console.log('MegaMemory merge:');
  console.log(`  [OK] Clean: ${mmResult.clean} concepts`);
  console.log(`  [OK] Skipped (shared-context): ${mmResult.skipped} concepts`);
  if (mmResult.conflicts.length > 0) {
    console.log(`  [FAIL] Conflicts: ${mmResult.conflicts.length} concepts`);
    for (const c of mmResult.conflicts) {
      console.log(`      - ${c.name} (${c.id}) - ${c.reason}`);
    }
  }

  console.log(`\nGit merge (${branch}):`);
  if (gitResult.clean) {
    console.log('  [OK] Clean merge (no conflicts)');
  } else if (gitResult.error) {
    console.log(`  [FAIL] ${gitResult.error}`);
  } else {
    console.log(`  [FAIL] Conflicts in: ${gitResult.conflicts.join(', ')}`);
  }

  console.log('\n────────────────');
}
```

## Expected Result

After fix, the output will show the actual error:

```
Git merge (pricecalc):
  [FAIL] error: Your local changes to the following files would be overwritten by merge:
        src/components/PriceCalculator.tsx
        Please commit your changes or stash them before you merge.

Errors detected in dry-run. Use --force to proceed anyway.
```
