<megamemory_schema>

## Concept Schema: TDD Patterns and Workflows

TDD (Test-Driven Development) is about design quality through the red-green-refactor cycle. These patterns describe when to use TDD, how to structure TDD plans, and how to execute the cycle using MegaMemory to track state.

### Concept Types

**1. `tdd:feature-plan`**
```typescript
interface TDDFeaturePlanConcept {
  kind: "feature";
  name: string;  // "Email Validation", "User Authentication API"
  summary: string;
  why: string;
  file_refs: string[];
  tdd_type: "plan";
  objective: string;
  files: string[];
  behavior: string;
  implementation: string;
  verification: string;
  success_criteria: string[];
}
```

**2. `tdd:pattern`**
```typescript
interface TDDPatternConcept {
  kind: "pattern";
  name: string;  // "red-green-refactor-cycle", "test-behavior-not-implementation"
  summary: string;
  why: string;
  file_refs: string[];
  edges: Array<{
    to: string;
    relation: "depends_on" | "implements" | "calls";
    description: string;
  }>;
}
```

**3. `tdd:phase-record`**
```typescript
interface TDDPhaseRecordConcept {
  kind: "component";
  name: string;  // "tdd:08-02-red-phase", "tdd:08-02-green-phase"
  summary: string;
  phase: "RED" | "GREEN" | "REFACTOR";
  plan_id: string;  // Reference to tdd:feature-plan
  test_written: string;  // Test description
  implementation: string;  // Code that made test pass
  refactor_notes: string;  // Cleanup done (if any)
  commit_hash: string;
  file_refs: string[];
}
```

**4. `tdd:framework-config`**
```typescript
interface TDDFrameworkConfigConcept {
  kind: "config";
  name: string;  // "jest-config", "vitest-config", "pytest-config"
  summary: string;
  project_type: string;  // "node", "python", "go", "rust"
  framework: string;
  install_command: string;
  verify_command: string;
  test_file_pattern: string;
  file_refs: string[];
}
```

### Schema Validation

All TDD concepts must:
- Define `why` rationale (design benefit of using TDD)
- Include concrete file references with line ranges
- Link phases to parent plan via `plan_id`
- Track commit hashes for each phase
- Provide executable verification commands
</megamemory_schema>

<megamemory_operations>

## Core Operations

### 1. Creating a TDD Plan

```typescript
// Create a TDD feature plan
const tddPlan = await megamemory_create_concept({
  name: "tdd:08-02-email-validation",
  kind: "feature",
  summary: "Email validation function using RFC 5322 regex. TDD approach ensures clean interface and edge case handling. Behavior: accepts valid email formats, rejects invalid formats, handles empty/null input. Implementation: regex pattern validation returning boolean.",
  why: "TDD improves design by forcing behavior-first thinking. Email validation has clear input/output contract suitable for TDD: expect(validateEmail(input)).toBe(expected). Red-green-refactor cycle ensures testable, maintainable implementation.",
  file_refs: [
    "get-shit-done-mm/references/tdd.md:1-264",
    "src/utils/emailValidator.ts",
    "src/utils/emailValidator.test.ts"
  ],
  tdd_type: "plan",
  objective: "Implement RFC 5322 email validation with full test coverage",
  files: ["src/utils/emailValidator.ts", "src/utils/emailValidator.test.ts"],
  behavior: "Function accepts string, returns boolean. Valid emails: user@domain.com, user.name+tag@domain.co.uk. Invalid: empty, null, no @, no domain, malformed.",
  implementation: "Regex pattern matching RFC 5322 standard. Edge cases: empty string returns false, null returns false, trailing spaces trimmed.",
  verification: "npm test -- emailValidator.test.ts",
  success_criteria: [
    "Failing test written and committed",
    "Implementation passes test",
    "Refactor complete (if needed)",
    "All 2-3 commits present"
  ],
  edges: [{
    to: "tdd:pattern:red-green-refactor-cycle",
    relation: "implements",
    description: "Email validation follows standard red-green-refactor TDD cycle"
  }]
});

// Query TDD pattern guidance before starting
const patternGuidance = await megamemory_understand({
  query: "TDD red-green-refactor cycle execution steps",
  top_k: 5
});
// Returns pattern with phases, commit patterns, error handling
```

### 2. Recording TDD Phases

```typescript
// RED Phase: Write failing test
const redPhase = await megamemory_create_concept({
  name: "tdd:08-02-red-phase",
  kind: "component",
  summary: "RED phase for email validation. Test written: should accept valid email formats (user@domain.com, user.name@domain.co.uk), should reject invalid formats (no @, no domain), should reject empty/null input. Test fails because validateEmail function not yet implemented.",
  phase: "RED",
  plan_id: "tdd:08-02-email-validation",
  test_written: "describe('emailValidator', () => {\n  it('should accept valid email formats', () => {\n    expect(validateEmail('user@domain.com')).toBe(true);\n    expect(validateEmail('user.name@domain.co.uk')).toBe(true);\n  });\n  \n  it('should reject invalid formats', () => {\n    expect(validateEmail('invalid')).toBe(false);\n    expect(validateEmail('no@symbol')).toBe(false);\n  });\n  \n  it('should reject empty and null input', () => {\n    expect(validateEmail('')).toBe(false);\n    expect(validateEmail(null)).toBe(false);\n  });\n});",
  implementation: "None - test fails as expected",
  refactor_notes: "",
  commit_hash: "abc123def456",
  file_refs: [
    "src/utils/emailValidator.test.ts:1-25",
    ".git/refs/heads/main"
  ],
  edges: [{
    to: "tdd:08-02-email-validation",
    relation: "implements",
    description: "RED phase of email validation TDD plan"
  }]
});

// GREEN Phase: Implement to pass
const greenPhase = await megamemory_create_concept({
  name: "tdd:08-02-green-phase",
  kind: "component",
  summary: "GREEN phase for email validation. Implementation: RFC 5322 regex pattern. Function handles string input, trims whitespace, returns boolean for validity. Tests pass: valid formats accepted, invalid rejected, empty/null handled correctly.",
  phase: "GREEN",
  plan_id: "tdd:08-02-email-validation",
  test_written: "Same as RED phase - tests verified passing",
  implementation: "export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/;\n\nexport const validateEmail = (email: string | null): boolean => {\n  if (!email || email.trim() === '') return false;\n  return EMAIL_REGEX.test(email.trim());\n};",
  refactor_notes: "",
  commit_hash: "def456ghi789",
  file_refs: [
    "src/utils/emailValidator.ts:1-8",
    "src/utils/emailValidator.test.ts:1-25",
    ".git/refs/heads/main"
  ],
  edges: [{
    to: "tdd:08-02-email-validation",
    relation: "implements",
    description: "GREEN phase of email validation TDD plan"
  }]
});

// REFACTOR Phase (optional)
const refactorPhase = await megamemory_create_concept({
  name: "tdd:08-02-refactor-phase",
  kind: "component",
  summary: "REFACTOR phase for email validation. Extracted EMAIL_REGEX to named export constant for reusability and testability. No behavior changes. Tests still pass.",
  phase: "REFACTOR",
  plan_id: "tdd:08-02-email-validation",
  test_written: "",
  implementation: "Refactored: moved regex pattern to EMAIL_REGEX constant at module level. Improved testability by making pattern exportable.",
  refactor_notes: "Regex pattern extracted to EMAIL_REGEX constant. Function body unchanged. Tests verified: npm test passes.",
  commit_hash: "ghi789jkl012",
  file_refs: [
    "src/utils/emailValidator.ts:1-8",
    ".git/refs/heads/main"
  ],
  edges: [{
    to: "tdd:08-02-green-phase",
    relation: "calls",
    description: "REFACTOR phase after GREEN phase"
  }]
});
```

### 3. Linking Phases and Patterns

```typescript
// Link all phases to parent plan
await megamemory_link({
  from: "tdd:08-02-red-phase",
  to: "tdd:08-02-email-validation",
  relation: "implements",
  description: "RED phase is first phase of email validation TDD plan"
});

await megamemory_link({
  from: "tdd:08-02-green-phase",
  to: "tdd:08-02-red-phase",
  relation: "calls",
  description: "GREEN phase follows RED phase"
});

// Link pattern to plan
await megamemory_link({
  from: "tdd:08-02-email-validation",
  to: "tdd:pattern:red-green-refactor-cycle",
  relation: "implements",
  description: "Email validation follows standard red-green-refactor TDD pattern"
});
```

### 4. Querying TDD Knowledge

```typescript
// Query when to use TDD
const tddGuidance = await megamemory_understand({
  query: "when should I use TDD vs standard development approach",
  top_k: 5
});
// Returns guidance:
// - TDD candidates: business logic, API endpoints, data transformations
// - Skip TDD: UI layout, configuration, glue code
// - Heuristic: Can you write expect(fn(input)).toBe(output) before writing fn?

// Query TDD plan structure
const planStructure = await megamemory_understand({
  query: "TDD plan structure with objective context feature verification success criteria",
  top_k: 3
});
// Returns schema for creating TDD plans with required sections

// Query for similar completed TDD features
const similarFeatures = await megamemory_understand({
  query: "completed TDD features with validation logic and regex patterns",
  top_k: 10
});
// Returns related tdd:feature-plan concepts to learn from
```

### 5. Recording Framework Setup

```typescript
// Record test framework configuration
await megamemory_create_concept({
  name: "tdd:framework:jest-node",
  kind: "config",
  summary: "Jest framework configuration for Node.js/TypeScript project. Install: npm install -D jest @types/jest ts-jest. Config: jest.config.js with ts-jest preset. Verify: npm test runs empty suite. Test files: *.test.ts next to source or in __tests__/ directory.",
  why: "Minimal test framework for Node.js projects with TypeScript support. ts-jest handles TypeScript compilation, standard Jest matcher API.",
  project_type: "node",
  framework: "jest",
  install_command: "npm install -D jest @types/jest ts-jest",
  verify_command: "npm test",
  test_file_pattern: "*.test.ts",
  file_refs: [
    "get-shit-done-mm/references/tdd.md:136-185",
    "jest.config.js",
    "package.json"
  ],
  config_content: "module.exports = {\n  preset: 'ts-jest',\n  testEnvironment: 'node',\n  roots: ['<rootDir>/src'],\n  testMatch: ['**/*.test.ts'],\n};"
});
```

### 6. Recording Anti-Patterns

```typescript
// Record TDD anti-patterns to avoid
await megamemory_create_concept({
  name: "anti-pattern:test-implementation-details",
  kind: "pattern",
  summary: "WRONG: Testing implementation details (calling specific helper functions, asserting internal state). Tests should test public API and observable behavior. CORRECT: Test behavior ('returns formatted date string') not implementation ('calls formatDate helper with correct params'). Tests should survive refactors.",
  why: "Implementation detail tests couple tests to internal code structure. Refactoring internals breaks tests even when behavior unchanged, defeating TDD's design benefit.",
  file_refs: ["get-shit-done-mm/references/tdd.md:116-134"],
  wrong_example: "it('calls formatDate helper with correct params', () => {\n  const spy = jest.spyOn(dateHelpers, 'formatDate');\n  formatUserDate(new Date());\n  expect(spy).toHaveBeenCalledWith('YYYY-MM-DD');\n});",
  correct_example: "it('returns date formatted as YYYY-MM-DD', () => {\n  const result = formatUserDate(new Date('2024-01-15'));\n  expect(result).toBe('2024-01-15');\n});",
  edges: [{
    to: "tdd:pattern:test-behavior-not-implementation",
    relation: "configured_by",
    description: "Anti-pattern violates the principle of testing behavior"
  }]
});
```

### 7. Querying Execution History

```typescript
// Query all TDD phases for a plan
const planHistory = await megamemory_understand({
  query: "all phases for tdd:08-02-email-validation with commits and test results"
});
// Returns:
// - tdd:08-02-red-phase (commit abc123, test written)
// - tdd:08-02-green-phase (commit def456, implementation)
// - tdd:08-02-refactor-phase (commit ghi789, refactor notes)

// Query all completed TDD features
const completedFeatures = await megamemory_understand({
  query: "all completed TDD features with green phase and passing tests"
});
// Returns list of tdd:feature-plan concepts where GREEN phase exists

// Query test patterns
const testPatterns = await megamemory_understand({
  query: "test quality guidelines for behavior testing and naming conventions",
  top_k: 5
});
// Returns patterns: descriptive names, one concept per test, no implementation details
```

</megamemory_operations>

<megamemory_examples>

## Example 1: Creating and Executing a TDD Plan

```typescript
// Step 1: Check if TDD is appropriate
const heuristicCheck = await megamemory_understand({
  query: "TDD heuristic: can I write expect function with input and output"
});

// Heuristic: Can you write `expect(validateEmail(input)).toBe(output)` before writing `validateEmail`?
// Yes → Use TDD. No → Use standard development.

// Step 2: Create TDD plan
const emailValidationPlan = await megamemory_create_concept({
  name: "tdd:08-02-email-validation",
  kind: "feature",
  summary: "Email validation with RFC 5322 regex. TDD ensures clean interface. Behavior: accepts valid emails, rejects invalid, handles empty/null. Verification: npm test",
  why: "Clear input/output contract suitable for TDD. Red-green-refactor forces design-first thinking.",
  file_refs: ["src/utils/emailValidator.ts", "src/utils/emailValidator.test.ts"],
  tdd_type: "plan",
  objective: "Implement RFC 5322 email validation",
  files: ["src/utils/emailValidator.ts", "src/utils/emailValidator.test.ts"],
  behavior: "Input: string|null. Output: boolean. Valid: user@domain.com. Invalid: '', null, 'noatsymbol'.",
  implementation: "RFC 5322 regex pattern returning boolean. Trim whitespace, handle null.",
  verification: "npm test -- emailValidator.test.ts"
});

// Step 3: Execute RED phase
await bash({ command: "npm install -D jest @types/jest ts-jest", description: "Install Jest" });
await write({
  filePath: "src/utils/emailValidator.test.ts",
  content: "describe('emailValidator', () => {\n  it('should accept valid email formats', () => {\n    expect(validateEmail('user@domain.com')).toBe(true);\n  });\n  \n  it('should reject invalid formats', () => {\n    expect(validateEmail('invalid')).toBe(false);\n  });\n});\n\nconst validateEmail = (email: string): boolean => {\n  return true; // Failing implementation\n};"
});
await bash({ command: "npm test -- emailValidator.test.ts", description: "Run test - should fail" });

const redPhase = await megamemory_create_concept({
  name: "tdd:08-02-red-phase",
  kind: "component",
  summary: "RED: Test written for email validation. Test fails as expected - validateEmail returns true for all input.",
  phase: "RED",
  plan_id: "tdd:08-02-email-validation",
  test_written: "Tests for valid/invalid email formats",
  implementation: "None - deliberate failure",
  commit_hash: (await bash({ command: "git rev-parse HEAD", description: "Get commit hash" })).output.trim(),
  file_refs: ["src/utils/emailValidator.test.ts:1-12"]
});

await bash({
  command: "git add src/utils/emailValidator.test.ts && git commit -m 'test(08-02): add failing test for email validation'",
  description: "Commit RED phase"
});

// Step 4: Execute GREEN phase
await write({
  filePath: "src/utils/emailValidator.ts",
  content: "export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/;\n\nexport const validateEmail = (email: string | null): boolean => {\n  if (!email || email.trim() === '') return false;\n  return EMAIL_REGEX.test(email.trim());\n};"
});
await bash({ command: "npm test -- emailValidator.test.ts", description: "Run test - should pass" });

const greenPhase = await megamemory_create_concept({
  name: "tdd:08-02-green-phase",
  kind: "component",
  summary: "GREEN: Implementation passes all tests. RFC 5322 regex validates email format. Handles empty/null correctly.",
  phase: "GREEN",
  plan_id: "tdd:08-02-email-validation",
  implementation: "Regex pattern with trim and null check",
  commit_hash: (await bash({ command: "git rev-parse HEAD", description: "Get commit hash" })).output.trim(),
  file_refs: ["src/utils/emailValidator.ts:1-6"]
});

await bash({
  command: "git add src/utils/emailValidator.ts && git commit -m 'feat(08-02): implement email validation'",
  description: "Commit GREEN phase"
});

// Step 5: Optionally refactor
await megamemory_link({
  from: "tdd:08-02-green-phase",
  to: "tdd:08-02-red-phase",
  relation: "calls",
  description: "GREEN follows RED"
});
```

## Example 2: Determining When to Use TDD

```typescript
// Agent queries MM for TDD decision guidance
const tddGuidance = await megamemory_understand({
  query: "TDD vs standard development: when to use each approach"
});

// Returns decision framework:
// TDD Candidates:
// - Business logic with defined inputs/outputs [OK]
// - API endpoints with request/response contracts [OK]
// - Data transformations, parsing, formatting [OK]
// - Validation rules and constraints [OK]
// - Algorithms with testable behavior [OK]
// - State machines and workflows [OK]
// - Utility functions with clear specifications [OK]
//
// Skip TDD (use standard with type="auto"):
// - UI layout, styling, visual components [FAIL]
// - Configuration changes [FAIL]
// - Glue code connecting existing components [FAIL]
// - One-off scripts and migrations [FAIL]
// - Simple CRUD with no business logic [FAIL]
// - Exploratory prototyping [FAIL]
//
// Heuristic: Can you write expect(fn(input)).toBe(output) before writing fn?
// → Yes: Create TDD plan
// → No: Use standard plan, add tests after if needed

// Agent evaluates current task
const taskType = "API endpoint for user authentication";

// Apply heuristic
const canExpectBehavior = true; // expect(authUser(username, password)).toBe(user | null)

if (canExpectBehavior) {
  // Create TDD plan
  const authPlan = await megamemory_create_concept({
    name: "tdd:05-03-user-auth-api",
    kind: "feature",
    summary: "User authentication API endpoint. Behavior: valid credentials return user object, invalid credentials return null. TDD ensures correct error handling and response structure.",
    why: "API endpoint has clear input/output contract suitable for TDD. Authentication logic is business logic, not UI.",
    tdd_type: "plan",
    verification: "npm test -- auth.test.ts"
  });
} else {
  // Use standard plan
  console.log("Using standard plan - cannot express behavior as expect(...).toBe(...)");
}
```

## Example 3: Querying and Learning from Past TDD Work

```typescript
// Before starting new TDD feature, query for similar completed work
const similarTDD = await megamemory_understand({
  query: "completed TDD features with validation logic regex patterns",
  top_k: 5
});

// Returns similar features:
// - tdd:08-02-email-validation (RFC 5322 regex)
// - tdd:07-01-phone-validation (phone number format)
// - tdd:06-03-url-validation (URL format checking)

// Agent can learn patterns from these:
const emailValidation = await megamemory_understand({
  query: "tdd:08-02-email-validation full details with phases and commits"
});

// Learn from RED phase: how test was structured
// Learn from GREEN phase: minimal implementation approach
// Learn from REFACTOR phase: what cleanup was done

// Apply patterns to new validation feature
const newValidationPlan = await megamemory_create_concept({
  name: "tdd:08-03-phone-validation",
  kind: "feature",
  summary: "Phone validation inspired by email validation pattern. Similar structure: RED (write failing test), GREEN (minimal regex implementation), REFACTOR (extract pattern constant if reusable).",
  why: "Phone validation similar to email validation - clear input/output contract. Learning from email validation TDD success.",
  tdd_type: "plan",
  files: ["src/utils/phoneValidator.ts", "src/utils/phoneValidator.test.ts"],
  behavior: "Accepts valid phone formats (international, domestic), rejects invalid formats.",
  verification: "npm test -- phoneValidator.test.ts"
});
```

## Example 4: Recording and Querying Test Quality Patterns

```typescript
// Record test quality pattern
await megamemory_create_concept({
  name: "tdd:pattern:descriptive-test-names",
  kind: "pattern",
  summary: "Test names should describe what's being tested, not 'test1' or 'works correctly'. Good: 'should reject empty email', 'returns null for invalid ID'. Bad: 'test1', 'handles error', 'works correctly'. Descriptive names document behavior and improve failure readability.",
  why: "Descriptive names serve as documentation. When test fails, name immediately tells you what behavior is broken. Improves maintainability and onboarding.",
  file_refs: ["get-shit-done-mm/references/tdd.md:116-134"],
  examples: [
    "Good: 'should reject empty email', 'returns null for invalid ID'",
    "Bad: 'test1', 'handles error', 'works correctly'"
  ],
  edges: [{
    to: "tdd:pattern:test-behavior-not-implementation",
    relation: "configured_by",
    description: "Descriptive names support behavior-focused testing"
  }]
});

// Query for test quality guidelines before writing tests
const qualityGuidance = await megamemory_understand({
  query: "test quality guidelines for TDD including naming and structure",
  top_k: 5
});

// Returns patterns:
// - tdd:pattern:test-behavior-not-implementation
// - tdd:pattern:one-concept-per-test
// - tdd:pattern:descriptive-test-names
// - tdd:pattern:no-implementation-details

// Agent applies guidance when writing RED phase test
const testContent = `
describe('userAuth', () => {
  it('should return user object for valid credentials', () => {  // Descriptive name
    const result = await authUser('user@example.com', 'password123');
    expect(result).toEqual({ id: 1, email: 'user@example.com' });
  });

  it('should return null for invalid credentials', () => {  // Descriptive name
    const result = await authUser('user@example.com', 'wrong');
    expect(result).toBeNull();
  });
});
`;
```

## Example 5: Framework Setup Recording

```typescript
// Agent needs to set up test framework for new project
await bash({ command: "if [ -f package.json ]; then echo 'node'; fi", description: "Detect project type" });

// Project is Node.js. Query framework guidance
const frameworkGuidance = await megamemory_understand({
  query: "Jest framework setup for Node.js TypeScript project",
  top_k: 3
});

// Returns: Install commands, config structure, verification steps

// Execute setup
await bash({
  command: "npm install -D jest @types/jest ts-jest",
  description: "Install Jest with TypeScript support"
});

await write({
  filePath: "jest.config.js",
  content: "module.exports = {\n  preset: 'ts-jest',\n  testEnvironment: 'node',\n  roots: ['<rootDir>/src'],\n  testMatch: ['**/*.test.ts'],\n};"
});

await bash({ command: "npm test", description: "Verify setup - should pass with 0 tests" });

// Record framework config for future reference
await megamemory_create_concept({
  name: "tdd:framework:jest-project-xyz",
  kind: "config",
  summary: "Jest configuration for project XYZ. Installed via npm. Config in jest.config.js with ts-jest preset. Test files: src/**/*.test.ts. Verification: npm test.",
  why: "Framework setup is one-time cost. Recording it speeds up future TDD plans in same project.",
  project_type: "node",
  framework: "jest",
  install_command: "npm install -D jest @types/jest ts-jest",
  verify_command: "npm test",
  test_file_pattern: "src/**/*.test.ts",
  file_refs: ["jest.config.js", "package.json", "tsconfig.json"]
});

// Future TDD plans can query this config
const existingFramework = await megamemory_understand({
  query: "test framework configuration for current project"
});
// Returns tdd:framework:jest-project-xyz, skipping setup phase
```

## Example 6: Error Handling and Recovery

```typescript
// RED phase test doesn't fail - what happened?
try {
  await bash({ command: "npm test -- emailValidator.test.ts", description: "Run test" });
} catch (error) {
  if (error.message.includes("All tests passed")) {
    // Test should have failed but passed
    const errorPattern = await megamemory_understand({
      query: "TDD error handling: test doesn't fail in RED phase"
    });

    // Returns guidance:
    // - Feature may already exist - investigate
    // - Test may be wrong (not testing what you think)
    // - Fix before proceeding

    // Record error analysis
    await megamemory_create_concept({
      name: "tdd:error:08-02-red-phase-passed",
      kind: "component",
      summary: "ERROR: RED phase test passed unexpectedly. Likely cause: validateEmail function already exists in codebase. Action: Investigate existing implementation, update test to cover missing behavior or delete TDD plan if feature exists.",
      why: "RED phase must fail - if test passes, TDD cycle breaks. Record errors to learn from and avoid repetition.",
      file_refs: ["get-shit-done-mm/references/tdd.md:188-210"],
      error_type: "red_phase_passed",
      resolution: "Check if validateEmail exists, update test or cancel TDD plan"
    });

    // Investigate
    const existingCode = await bash({
      command: "grep -r 'validateEmail' src/",
      description: "Search for existing validateEmail function"
    });

    if (existingCode) {
      console.log("Feature already exists, aborting TDD plan");
      // Record decision to abort
      await megamemory_create_concept({
        name: "tdd:aborted:08-02-already-exists",
        kind: "component",
        summary: "TDD plan aborted: email validation feature already exists in codebase. No TDD needed.",
        why: "TDD is for new features. If feature exists, standard development or refactoring approach may be appropriate.",
        file_refs: ["src/utils/emailValidator.ts"]
      });
    }
  }
}
```

## Example 7: Context Budget Tracking

```typescript
// TDD plans target ~40% context usage (lower than standard plans)
// Record context budget awareness
const tddContextPattern = await megamemory_create_concept({
  name: "tdd:pattern:context-budget-40-percent",
  kind: "pattern",
  summary: "TDD plans target ~40% context usage (lower than standard ~50%). Reason: RED phase (write test, run, debug if doesn't fail), GREEN phase (implement, run, iterate on failures), REFACTOR phase (modify, run, verify no regressions). Each phase involves reading files, running commands, analyzing output. Back-and-forth is inherently heavier than linear task execution.",
  why: "Context awareness prevents over-batching TDD features. Single feature per plan ensures full quality throughout cycle, even with heavier execution.",
  file_refs: ["get-shit-done-mm/references/tdd.md:250-264"],
  examples: [
    "Standard plan: 4 tasks, ~50% context, linear execution",
    "TDD plan: 1 feature, ~40% context, RED-GREEN-REFACTOR cycles"
  ],
  context_target: 0.4,
  context_reason: "Multiple execution cycles with file reads, test runs, debugging"
});

// Query context budget before starting TDD plan
const contextGuidance = await megamemory_understand({
  query: "TDD context budget and single feature recommendation"
});
// Returns: 40% target, reason, single feature per plan

// Apply: create only one TDD feature per plan
const singleFeaturePlan = await megamemory_create_concept({
  name: "tdd:08-02-email-validation",
  kind: "feature",
  summary: "Email validation TDD plan - single feature only. If features are trivial enough to batch, skip TDD and use standard plan with tests added after.",
  why: "Single feature focus ensures full TDD discipline and stays within 40% context budget.",
  tdd_type: "plan",
  edges: [{
    to: "tdd:pattern:context-budget-40-percent",
    relation: "configured_by",
    description: "Single feature per plan respects context budget"
  }]
});
```

## Example 8: Querying All TDD Work in Project

```typescript
// Get overview of all TDD work
const tddOverview = await megamemory_understand({
  query: "all TDD plans and phases in current project",
  top_k: 50
});

// Returns tree structure:
// tdd:08-02-email-validation
//   ├─ tdd:08-02-red-phase (commit abc123)
//   ├─ tdd:08-02-green-phase (commit def456)
//   └─ tdd:08-02-refactor-phase (commit ghi789)
// tdd:08-03-phone-validation
//   ├─ tdd:08-03-red-phase (commit jkl012)
//   └─ tdd:08-03-green-phase (commit mno345)

// Query specific plan with all phases
const fullPlan = await megamemory_understand({
  query: "tdd:08-02-email-validation with all phases RED GREEN REFACTOR"
});
// Returns plan + all linked phase concepts with full details

// Query patterns used across all TDD work
const patternsUsed = await megamemory_understand({
  query: "all TDD patterns implemented in current project including test quality and commit patterns"
});
// Returns: red-green-refactor-cycle, descriptive-test-names, test-behavior-not-implementation
```

</megamemory_examples>

<overview>
TDD is about design quality, not coverage metrics. The red-green-refactor cycle forces you to think about behavior before implementation, producing cleaner interfaces and more testable code.

**Principle:** If you can describe the behavior as `expect(fn(input)).toBe(output)` before writing `fn`, TDD improves the result.

**Key insight:** TDD work is fundamentally heavier than standard tasks—it requires 2-3 execution cycles (RED → GREEN → REFACTOR), each with file reads, test runs, and potential debugging. TDD features get dedicated plans to ensure full context is available throughout the cycle.
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
phase: XX-name
plan: NN
type: tdd
---

<objective>
[What feature and why]
Purpose: [Design benefit of TDD for this feature]
Output: [Working, tested feature]
</objective>

<context>
# Query MegaMemory for project context before creating TDD plan
await megamemory_understand({
  query: "project architecture and related components for email validation feature"
});

# Load relevant source files
await read({ filePath: "src/utils/emailValidator.ts" });
await read({ filePath: "src/utils/emailValidator.test.ts" });
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

<output>
After completion, create SUMMARY.md with:
- RED: What test was written, why it failed
- GREEN: What implementation made it pass
- REFACTOR: What cleanup was done (if any)
- Commits: List of commits produced
</output>
```

**One feature per TDD plan.** If features are trivial enough to batch, they're trivial enough to skip TDD—use a standard plan and add tests after.
</tdd_plan_structure>

<execution_flow>
## Red-Green-Refactor Cycle

**RED - write failing test:**
1. Create test file following project conventions
2. write test describing expected behavior (from `<behavior>` element)
3. Run test - it MUST fail
4. If test passes: feature exists or test is wrong. Investigate.
5. Commit: `test({phase}-{plan}): add failing test for [feature]`

**GREEN - Implement to pass:**
1. write minimal code to make test pass
2. No cleverness, no optimization - just make it work
3. Run test - it MUST pass
4. Commit: `feat({phase}-{plan}): implement [feature]`

**REFACTOR (if needed):**
1. Clean up implementation if obvious improvements exist
2. Run tests - MUST still pass
3. Only commit if changes made: `refactor({phase}-{plan}): clean up [feature]`

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

When executing a TDD plan but no test framework is configured, set it up as part of the RED phase:

**1. Detect project type:**
```bash
# JavaScript/TypeScript
if [ -f package.json ]; then echo "node"; fi

# Python
if [ -f requirements.txt ] || [ -f pyproject.toml ]; then echo "python"; fi

# Go
if [ -f go.mod ]; then echo "go"; fi

# Rust
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

**3. Create config if needed:**
- Jest: `jest.config.js` with ts-jest preset
- Vitest: `vitest.config.ts` with test globals
- pytest: `pytest.ini` or `pyproject.toml` section

**4. Verify setup:**
```bash
# Run empty test suite - should pass with 0 tests
npm test  # Node
pytest    # Python
go test ./...  # Go
cargo test    # Rust
```

**5. Create first test file:**
Follow project conventions for test location:
- `*.test.ts` / `*.spec.ts` next to source
- `__tests__/` directory
- `tests/` directory at root

Framework setup is a one-time cost included in the first TDD plan's RED phase.
</framework_setup>

<error_handling>
## Error Handling

**Test doesn't fail in RED phase:**
- Feature may already exist - investigate
- Test may be wrong (not testing what you think)
- Fix before proceeding

**Test doesn't pass in GREEN phase:**
- Debug implementation
- Don't skip to refactor
- Keep iterating until green

**Tests fail in REFACTOR phase:**
- Undo refactor
- Commit was premature
- Refactor in smaller steps

**Unrelated tests break:**
- Stop and investigate
- May indicate coupling issue
- Fix before proceeding
</error_handling>

<commit_pattern>
## Commit Pattern for TDD Plans

TDD plans produce 2-3 atomic commits (one per phase):

```
test(08-02): add failing test for email validation

- Tests valid email formats accepted
- Tests invalid formats rejected
- Tests empty input handling

feat(08-02): implement email validation

- Regex pattern matches RFC 5322
- Returns boolean for validity
- Handles edge cases (empty, null)

refactor(08-02): extract regex to constant (optional)

- Moved pattern to EMAIL_REGEX constant
- No behavior changes
- Tests still pass
```

**Comparison with standard plans:**
- Standard plans: 1 commit per task, 2-4 commits per plan
- TDD plans: 2-3 commits for single feature

Both follow same format: `{type}({phase}-{plan}): {description}`

**Benefits:**
- Each commit independently revertable
- Git bisect works at commit level
- Clear history showing TDD discipline
- Consistent with overall commit strategy
</commit_pattern>

<context_budget>
## Context Budget

TDD plans target **~40% context usage** (lower than standard plans' ~50%).

Why lower:
- RED phase: write test, run test, potentially debug why it didn't fail
- GREEN phase: implement, run test, potentially iterate on failures
- REFACTOR phase: modify code, run tests, verify no regressions

Each phase involves reading files, running commands, analyzing output. The back-and-forth is inherently heavier than linear task execution.

Single feature focus ensures full quality throughout the cycle.
</context_budget>
