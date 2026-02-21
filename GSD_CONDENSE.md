# GSD v1.12.0 Integration Plan for Fuska

**Source:** https://github.com/gsd-build/get-shit-done/releases/tag/v1.12.0
**Reference Diff:** ~/code/fuska/diff-1.11.3_to_1.12.0.patch

## Summary

GSD v1.12.0 introduces three main improvements:
1. **gsd-tools.js** - Centralized CLI utility (642 lines) replacing repetitive bash patterns
2. **Thin orchestrator pattern** - Commands delegate to workflows (~75% size reduction)
3. **Token reduction** - Condensed agent prompts (~22k chars removed)

## Fuska Adaptation Strategy

**DO:** Apply token reduction and thin orchestrator patterns
**DON'T:** Create fuska-tools.js unless it provides actual token/speed wins

Fuska uses MegaMemory instead of file-based state, so many GSD utilities aren't needed.

---

## Phase 1: Agent Prompt Condensation

### 1.1 fuska-executor.md (979 lines → ~700 lines)

**Target: Deviation Rules section (~140 lines → ~50 lines)**

Current pattern (verbose):
```markdown
**RULE 1: Auto-fix bugs**

**Trigger:** Code doesn't work as intended (broken behavior, incorrect output, errors)

**Action:** Fix immediately, track for Summary

**Examples:**

- Wrong SQL query returning incorrect data
- Logic errors (inverted condition, off-by-one, infinite loop)
[... more bullets ...]

**Process:**

1. Fix bug inline
2. Add/update tests to prevent regression
3. Verify fix works
4. Continue task
5. Track in deviations list: `[Rule 1 - Bug] [description]`
6. **Update MegaMemory** with the bug and fix

**No user permission needed.** Bugs must be fixed for correct operation.
```

Condensed pattern (from GSD):
```markdown
**RULE 1: Auto-fix bugs**

**Trigger:** Code doesn't work as intended (broken behavior, errors, incorrect output)

**Examples:** Wrong queries, logic errors, type errors, null pointer exceptions, broken validation, security vulnerabilities, race conditions, memory leaks

**Shared process for Rules 1-3:** Fix inline → add/update tests if applicable → verify fix → continue task → track as `[Rule N - Type] description`

No user permission needed for Rules 1-3.
```

**Changes:**
- Remove "Process:" sections (obvious from context)
- Compress example lists to single comma-separated lines
- Remove "No user permission needed" explanations (add once at end)
- Remove "Action:" lines (redundant with rule name)

**Savings:** ~90 lines in deviation rules section

---

**Target: Checkpoint Protocol section (~80 lines → ~25 lines)**

Current pattern (verbose):
```markdown
**checkpoint:human-verify (90% of checkpoints)**

For visual/functional verification after you automated something.

```markdown
### Checkpoint Details

**What was built:**
[Description of completed work]

**How to verify:**

1. [Step 1 - exact command/URL]
2. [Step 2 - what to check]
3. [Step 3 - expected behavior]

### Awaiting

Type "approved" or describe issues to fix.
```

**checkpoint:decision (9% of checkpoints)**

For implementation choices requiring user input.

```markdown
### Checkpoint Details
[... example block ...]
```
```

Condensed pattern (from GSD):
```markdown
**checkpoint:human-verify (90%)** — Visual/functional verification after automation.
Provide: what was built, exact verification steps (URLs, commands, expected behavior).

**checkpoint:decision (9%)** — Implementation choice needed.
Provide: decision context, options table (pros/cons), selection prompt.

**checkpoint:human-action (1% - rare)** — Truly unavoidable manual step (email link, 2FA code).
Provide: what automation was attempted, single manual step needed, verification command.
```

**Changes:**
- Remove example markdown blocks (agent knows format from checkpoint_return_format)
- Compress descriptions to single lines with `—` syntax
- Merge "what to provide" into description

**Savings:** ~55 lines in checkpoint protocol section

---

**Target: Authentication Gates section (~50 lines → ~15 lines)**

Current pattern (verbose):
```markdown
**When you encounter authentication errors during `type="auto"` task execution:**

This is NOT a failure. Authentication gates are expected and normal. Handle them by returning a checkpoint.

**Authentication error indicators:**

- CLI returns: "Error: Not authenticated", "Not logged in", "Unauthorized", "401", "403"
- API returns: "Authentication required", "Invalid API key", "Missing credentials"
- Command fails with: "Please run {tool} login" or "Set {ENV_VAR} environment variable"

**Authentication gate protocol:**

1. **Recognize it's an auth gate** - Not a bug, just needs credentials
2. **STOP current task execution** - Don't retry repeatedly
3. **Return checkpoint with type `human-action`**
4. **Provide exact authentication steps** - CLI commands, where to get keys
5. **Specify verification** - How you'll confirm auth worked

**Example return for auth gate:**
[... 30+ lines of example markdown ...]
```

Condensed pattern (from GSD):
```markdown
**Auth errors during `type="auto"` execution are gates, not failures.**

**Indicators:** "Not authenticated", "Not logged in", "Unauthorized", "401", "403", "Please run {tool} login", "Set {ENV_VAR}"

**Protocol:**
1. Recognize it's an auth gate (not a bug)
2. STOP current task
3. Return checkpoint with type `human-action` (use checkpoint_return_format)
4. Provide exact auth steps (CLI commands, where to get keys)
5. Specify verification command

**In Summary:** Document auth gates as normal flow, not deviations.
```

**Changes:**
- Remove example return block (checkpoint_return_format already shows structure)
- Compress indicators to single line
- Simplify protocol steps

**Savings:** ~35 lines in authentication gates section

---

**Total estimated savings for fuska-executor.md:** ~180 lines (18% reduction)

### 1.2 fuska-planner.md (1594 lines → ~1200 lines)

**Target: Goal-Backward Verification section**
- Remove verbose step-by-step explanations
- Compress "what to check" into inline notes

**Target: Plan Creation section**
- Remove redundant "how to create" explanations
- Condense validation steps

**Estimated savings:** ~300-400 lines

### 1.3 fuska-verifier.md (805 lines → ~600 lines)

**Target: Verification Checklists**
- Consolidate overlapping checklist items
- Remove redundant "what to verify" explanations

**Estimated savings:** ~150-200 lines

### 1.4 fuska-debugger.md (1297 lines → ~1000 lines)

**Target: Debug Protocol section**
- Condense step descriptions
- Remove verbose example scenarios

**Estimated savings:** ~200-300 lines

---

## Phase 2: Thin Orchestrator Pattern

### 2.1 Large Command Refactoring

Apply to commands with most duplication potential:

| Command | Current Lines | Target | Strategy |
|---------|---------------|--------|----------|
| fuska-plan.md | 1446 | ~900 | Extract planning steps to workflow |
| fuska-do.md | 1163 | ~700 | Extract execution coordination |
| fuska-build.md | 1023 | ~600 | Extract build orchestration |

**Pattern (from GSD):**
- Command: ~100 lines of argument parsing, preflight checks, workflow delegation
- Workflow: Full implementation logic

**Example transformation for fuska-plan.md:**

Before (in command):
```markdown
<step name="load_state">
Query MegaMemory for project state:

const stateResult = await megamemory:understand({ query: "state", top_k: 5 });
[... 50+ lines of detailed instructions ...]
</step>

<step name="load_research">
[... 40+ lines ...]
</step>

[... many more verbose steps ...]
```

After (command delegates to workflow):
```markdown
<step name="delegate_to_workflow">
Invoke the plan-chapter workflow with chapter context:

@../fuska/workflows/plan-chapter.md

Pass: chapterSlug, revision mode flag, config from MegaMemory
</step>
```

Workflow contains the detailed implementation.

---

## Phase 3: fuska-tools.js (Conditional)

Only create if token savings are verified. Current assessment:

### 3.1 Commands That Would Benefit

| Command | Potential Savings | Reason |
|---------|-------------------|--------|
| Model resolution | ~25 lines × 10 files | Repeated in every command that spawns agents |
| Git commit with config check | ~8 lines × 5 files | Repeated pattern: check config, check gitignore, commit |

### 3.2 Commands That Would NOT Benefit

| Operation | Current | CLI Would Be | Verdict |
|-----------|---------|--------------|---------|
| State load | `megamemory:understand({query: "state"})` | `fuska-tools state load` | No win |
| Chapter lookup | `megamemory:understand({query: "chapter-01"})` | `fuska-tools find-chapter 01` | No win |
| Config read | Already in MegaMemory | CLI adds layer | No win |

### 3.3 Proposed Minimal Implementation

```javascript
// bin/fuska-tools.js
// Only implement if token savings are verified

Commands:
  resolve-model <agent-type> [--raw]    // ~25 line savings per use
  commit <message> [--files f1 f2]      // ~8 line savings per use
```

**Decision:** Defer until Phase 1 & 2 complete, then measure actual duplication.

---

## Execution Order

1. **fuska-executor.md** - Highest impact, clearest patterns from GSD diff
2. **fuska-planner.md** - Largest file, most redundancy
3. **fuska-verifier.md** - Medium impact
4. **fuska-debugger.md** - Medium impact
5. **Thin orchestrator** - Apply to fuska-plan.md, fuska-do.md, fuska-build.md
6. **fuska-tools.js** - Only if measurements justify

---

## Verification

After each agent condensation:
1. Run test suite to verify behavior unchanged
2. Compare token counts (before/after)
3. Verify agent still follows all rules correctly

---

## Files to Modify

### Phase 1 (Agent Condensation)
- `provider/opinkode/agents/fuska/fuska-executor.md`
- `provider/opinkode/agents/fuska/fuska-planner.md`
- `provider/opinkode/agents/fuska/fuska-verifier.md`
- `provider/opinkode/agents/fuska/fuska-debugger.md`

### Phase 2 (Thin Orchestrator)
- `provider/opinkode/command/fuska/fuska-plan.md`
- `provider/opinkode/command/fuska/fuska-do.md`
- `provider/opinkode/command/fuska/fuska-build.md`
- `provider/opinkode/fuska/workflows/plan-chapter.md` (expand)
- `provider/opinkode/fuska/workflows/execute-plan.md` (expand)

### Phase 3 (Optional CLI)
- `provider/opinkode/fuska/scripts/fuska-tools.js` (new, if justified)

---

## Estimated Total Impact

| Phase | Token Savings | Files Changed |
|-------|---------------|---------------|
| Agent condensation | ~800-1000 lines | 4 agents |
| Thin orchestrator | ~1500-2000 lines | 6 files |
| CLI (if justified) | ~200-300 lines | 10+ files |
| **Total** | ~2500-3300 lines | ~20 files |
