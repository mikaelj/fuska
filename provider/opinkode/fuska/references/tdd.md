<overview>
TDD is about design quality, not coverage metrics. The red-green-refactor cycle forces you to think about behavior before implementation, producing cleaner interfaces and more testable code.

**Principle:** If you can describe the behavior as `expect(fn(input)).toBe(output)` before writing `fn`, TDD improves the result.

**Key insight:** TDD work is fundamentally heavier than standard tasks—it requires 2-3 execution cycles (RED → GREEN → REFACTOR), each with file reads, test runs, and potential debugging. TDD features get dedicated plans to ensure full context is available.
</overview>

<when_to_use_tdd>
## When TDD Improves Quality

**TDD candidates (create a TDD plan):**
- Business logic with defined inputs/outputs
- API endpoints with request/response contracts
- Data transformations, parsing, formatting
- Validation rules and constraints
- Algorithms with testable behavior
- State machines and workflows
- Utility functions with clear specifications

**Skip TDD (use standard plan with `type="auto"` tasks):**
- UI layout, styling, visual components
- Configuration changes
- Glue code connecting existing components
- One-off scripts and migrations
- Simple CRUD with no business logic
- Exploratory prototyping

**Heuristic:** Can you write `expect(fn(input)).toBe(output)` before writing `fn`?
→ Yes: Create a TDD plan
→ No: Use standard plan, add tests after if needed
</when_to_use_tdd>

<tdd_plan_structure>
## TDD Plan Structure

Each TDD plan implements **one feature** through the full RED-GREEN-REFACTOR cycle.

```markdown
---
chapter: XX-name
plan: NN
type: tdd
---

<objective>
[What feature and why]
Purpose: [Design benefit of TDD for this feature]
Output: [Working, tested feature]
</objective>

<context>
# Query MegaMemory for initiative context
# Load relevant source files
</context>

<feature>
  <name>[Feature name]</name>
  <files>[source file, test file]</files>
  <behavior>
    [Expected behavior in testable terms]
    Cases: input → expected output
  </behavior>
  <implementation>[How to implement once tests pass]</implementation>
</feature>

<verification>
[Test command that proves feature works]
</verification>

<success_criteria>
- Failing test written and committed
- Implementation passes test
- Refactor complete (if needed)
- All 2-3 commits present
</success_criteria>
```

**One feature per TDD plan.** If features are trivial enough to batch, they're trivial enough to skip TDD—use a standard plan and add tests after.
</tdd_plan_structure>

<execution_flow>
## Red-Green-Refactor Cycle

**RED - write failing test:**
1. Create test file following project conventions
2. Write test describing expected behavior (from `<behavior>` element)
3. Run test - it MUST fail
4. If test passes: feature exists or test is wrong. Investigate.
5. Commit: `test({chapter}-{plan}): add failing test for [feature]`

**GREEN - implement to pass:**
1. Write minimal code to make test pass
2. No cleverness, no optimization - just make it work
3. Run test - it MUST pass
4. Commit: `feat({chapter}-{plan}): implement [feature]`

**REFACTOR (if needed):**
1. Clean up implementation if obvious improvements exist
2. Run tests - MUST still pass
3. Only commit if changes made: `refactor({chapter}-{plan}): clean up [feature]`

**Result:** Each TDD plan produces 2-3 atomic commits.
</execution_flow>

<test_quality>
## Good Tests vs Bad Tests

**Test behavior, not implementation:**
- Good: "returns formatted date string"
- Bad: "calls formatDate helper with correct params"
- Tests should survive refactors

**One concept per test:**
- Good: Separate tests for valid input, empty input, malformed input
- Bad: Single test checking all edge cases with multiple assertions

**Descriptive names:**
- Good: "should reject empty email", "returns null for invalid ID"
- Bad: "test1", "handles error", "works correctly"

**No implementation details:**
- Good: Test public API, observable behavior
- Bad: Mock internals, test private methods, assert on internal state
</test_quality>

<framework_setup>
## Test Framework Setup (If None Exists)

Set up as part of the first TDD plan's RED chapter.

**1. Detect project type:**
```bash
if [ -f package.json ]; then echo "node"; fi
if [ -f requirements.txt ] || [ -f pyproject.toml ]; then echo "python"; fi
if [ -f go.mod ]; then echo "go"; fi
if [ -f Cargo.toml ]; then echo "rust"; fi
```

**2. Install minimal framework:**

| Project | Framework | Install |
|---------|-----------|---------|
| Node.js | Jest | `npm install -D jest @types/jest ts-jest` |
| Node.js (Vite) | Vitest | `npm install -D vitest` |
| Python | pytest | `pip install pytest` |
| Go | testing | Built-in |
| Rust | cargo test | Built-in |

**3. Create config** (Jest: `jest.config.js` with ts-jest preset, Vitest: `vitest.config.ts`, pytest: `pyproject.toml`)

**4. Verify:** Run empty test suite — should pass with 0 tests.

**5. Test file location:** Follow project conventions (`*.test.ts` next to source, `__tests__/`, or `tests/`).
</framework_setup>

<error_handling>
## Error Handling

**Test doesn't fail in RED chapter:**
- Feature may already exist - investigate
- Test may be wrong (not testing what you think)
- Fix before proceeding

**Test doesn't pass in GREEN chapter:**
- Debug implementation, don't skip to refactor
- Keep iterating until green

**Tests fail in REFACTOR chapter:**
- Undo refactor, commit was premature
- Refactor in smaller steps

**Unrelated tests break:**
- Stop and investigate — may indicate coupling issue
</error_handling>

<commit_pattern>
## Commit Pattern for TDD Plans

2-3 atomic commits (one per chapter):

```
test(08-02): add failing test for email validation

- Tests valid/invalid email formats and empty input handling

feat(08-02): implement email validation

- Regex pattern matches RFC 5322, returns boolean

refactor(08-02): extract regex to constant (optional)

- Moved pattern to EMAIL_REGEX constant, no behavior changes
```

Same format as standard commits: `{type}({chapter}-{plan}): {description}`
</commit_pattern>

<context_budget>
## Context Budget

TDD plans target **~40% context usage** (lower than standard plans' ~50%).

Why lower: Each RED/GREEN/REFACTOR chapter involves reading files, running commands, analyzing output. The back-and-forth is inherently heavier than linear task execution.

Single feature focus ensures full quality throughout the cycle.
</context_budget>
