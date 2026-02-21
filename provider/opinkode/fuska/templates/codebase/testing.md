# Testing Patterns Template (MegaMemory-Backed)

Template for codebase TESTING documentation - captures test framework and patterns.

**Purpose:** Document how tests are written and run. Guide for adding tests that match existing patterns.

---

## MegaMemory Schema

```typescript
// Concept: codebase-quality (testing section)
interface TestingConcept {
  name: string;
  kind: "pattern";
  summary: string;
  why: string;
  file_refs: string[];
  edges: {
    to: string;
    relation: "configured_by" | "implements" | "depends_on";
    description: string;
  }[];
}
```

### Schema Structure

A testing patterns concept in MegaMemory stores:
- **name**: "Testing Patterns" or specific test framework configuration
- **kind**: "pattern"
- **summary**: Detailed description including:
  - Test framework (runner, assertion library, config)
  - Run commands (test, watch, single file, coverage)
  - Test file organization (location, naming, structure)
  - Test structure (suite organization, setup/teardown, arrange/act/assert)
  - Mocking (framework, patterns, what to mock/not mock)
  - Fixtures and factories (test data, location)
  - Coverage (requirements, configuration, view)
  - Test types (unit, integration, E2E)
  - Common patterns (async, error, snapshots)
- **why**: Rationale for testing approach
- **file_refs**: Test config files and example test files
- **edges**: Relationships to testing frameworks and tools

---

## MegaMemory Operations

### Create Testing Patterns Concept

```typescript
import { megamemory_create_concept } from './mcp-client';

const testingConcept = await megamemory_create_concept({
  name: "Testing Patterns",
  kind: "pattern",
  summary: `
Test Framework:
  Runner: Vitest 1.0.4
  Config: vitest.config.ts in project root
  Assertion Library: Vitest built-in expect
  Matchers: toBe, toEqual, toThrow, toMatchObject

  Run Commands:
    npm test                              # Run all tests
    npm test -- --watch                   # Watch mode
    npm test -- path/to/file.test.ts     # Single file
    npm run test:coverage                 # Coverage report

Test File Organization:
  Location: *.test.ts alongside source files
  Structure: No separate tests/ directory
  Naming: unit-name.test.ts for all tests, No distinction between unit/integration in filename
  Layout: src/lib/parser.ts, src/lib/parser.test.ts

Test Structure:
  Suite Organization:
    import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

    describe('ModuleName', () => {
      describe('functionName', () => {
        beforeEach(() => { /* reset state */ });

        it('should handle valid input', () => {
          // arrange
          const input = createTestInput();
          // act
          const result = functionName(input);
          // assert
          expect(result).toEqual(expectedOutput);
        });

        it('should throw on invalid input', () => {
          expect(() => functionName(null)).toThrow('Invalid input');
        });
      });
    });

  Patterns:
    - Use beforeEach for per-test setup, avoid beforeAll
    - Use afterEach to restore mocks: vi.restoreAllMocks()
    - Explicit arrange/act/assert comments in complex tests
    - One assertion focus per test (but multiple expects OK)

Mocking:
  Framework: Vitest built-in mocking (vi)
  Module mocking via vi.mock() at top of test file

  Patterns:
    import { vi } from 'vitest';
    import { externalFunction } from './external';

    // Mock module
    vi.mock('./external', () => ({
      externalFunction: vi.fn()
    }));

    describe('test suite', () => {
      it('mocks function', () => {
        const mockFn = vi.mocked(externalFunction);
        mockFn.mockReturnValue('mocked result');
        // test code using mocked function
        expect(mockFn).toHaveBeenCalledWith('expected arg');
      });
    });

  What to Mock:
    - File system operations (fs-extra)
    - Child process execution (child_process.exec)
    - External API calls
    - Environment variables (process.env)

  What NOT to Mock:
    - Internal pure functions
    - Simple utilities (string manipulation, array helpers)
    - TypeScript types

Fixtures and Factories:
  Test Data:
    // Factory functions in test file
    function createTestConfig(overrides?: Partial<Config>): Config {
      return {
        targetDir: '/tmp/test',
        global: false,
        ...overrides
      };
    }

    // Shared fixtures in tests/fixtures/
    // tests/fixtures/sample-command.md
    export const sampleCommand = \`
---
description: Test command
---
Content here\`;

  Location:
    - Factory functions: define in test file near usage
    - Shared fixtures: tests/fixtures/ (for multi-file test data)
    - Mock data: inline in test when simple, factory when complex

Coverage:
  Requirements:
    - No enforced coverage target
    - Coverage tracked for awareness
    - Focus on critical paths (parsers, service logic)

  Configuration:
    - Vitest coverage via c8 (built-in)
    - Excludes: *.test.ts, bin/install.ts, config files

  View Coverage:
    npm run test:coverage
    open coverage/index.html

Test Types:
  Unit Tests:
    - Test single function in isolation
    - Mock all external dependencies (fs, child_process)
    - Fast: each test <100ms
    - Examples: parser.test.ts, validator.test.ts

  Integration Tests:
    - Test multiple modules together
    - Mock only external boundaries (file system, process)
    - Examples: install-service.test.ts (tests service + parser)

  E2E Tests:
    - Not currently used
    - CLI integration tested manually

Common Patterns:
  Async Testing:
    it('should handle async operation', async () => {
      const result = await asyncFunction();
      expect(result).toBe('expected');
    });

  Error Testing:
    it('should throw on invalid input', () => {
      expect(() => parse(null)).toThrow('Cannot parse null');
    });

    // Async error
    it('should reject on file not found', async () => {
      await expect(readConfig('invalid.txt')).rejects.toThrow('ENOENT');
    });

  File System Mocking:
    import { vi } from 'vitest';
    import * as fs from 'fs-extra';

    vi.mock('fs-extra');

    it('mocks file system', () => {
      vi.mocked(fs.readFile).mockResolvedValue('file content');
      // test code
    });

  Snapshot Testing:
    - Not used in this codebase
    - Prefer explicit assertions for clarity
`,
  why: "Vitest provides fast testing with native TypeScript support, mocking for external dependencies only",
  file_refs: [
    "vitest.config.ts",
    "src/lib/parser.test.ts",
    "src/services/install-service.test.ts"
  ],
  edges: [
    {
      to: "vitest-config-concept-id",
      relation: "configured_by",
      description: "Testing configured by Vitest"
    }
  ]
});
```

### Update Testing Patterns

```typescript
import { megamemory_update_concept } from './mcp-client';

await megamemory_update_concept({
  id: "testing-concept-id",
  changes: {
    summary: `
Test Types:
  E2E Tests:
    - Playwright for E2E testing (NEW)
    - Location: e2e/ directory
    - Scope: Test full user flows
    - Examples: login.e2e.test.ts, checkout.e2e.test.ts
...rest of summary
`
  }
});
```

### Query Testing Patterns

```typescript
import { megamemory_understand } from './mcp-client';

const results = await megamemory_understand({
  query: "How are tests organized and what patterns should I use?",
  top_k: 10
});

// Returns testing patterns information
```

---

## MegaMemory Examples

### Example 1: Vitest Testing (TypeScript CLI)

```typescript
const vitestTesting = await megamemory_create_concept({
  name: "Testing Patterns",
  kind: "pattern",
  summary: `
Test Framework:
Runner:
  - Vitest 1.0.4
  - Config: vitest.config.ts in project root

Assertion Library:
  - Vitest built-in expect
  - Matchers: toBe, toEqual, toThrow, toMatchObject

Run Commands:
\`\`\`bash
npm test                              # Run all tests
npm test -- --watch                   # Watch mode
npm test -- path/to/file.test.ts     # Single file
npm run test:coverage                 # Coverage report
\`\`\`

Test File Organization:
Location:
  - *.test.ts alongside source files
  - No separate tests/ directory

Naming:
  - unit-name.test.ts for all tests
  - No distinction between unit/integration in filename

Structure:
\`\`\`
src/
  lib/
    parser.ts
    parser.test.ts
  services/
    install-service.ts
    install-service.test.ts
  bin/
    install.ts
    (no test - integration tested via CLI)
\`\`\`

Test Structure:
Suite Organization:
\`\`\`typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('ModuleName', () => {
  describe('functionName', () => {
    beforeEach(() => {
      // reset state
    });

    it('should handle valid input', () => {
      // arrange
      const input = createTestInput();

      // act
      const result = functionName(input);

      // assert
      expect(result).toEqual(expectedOutput);
    });

    it('should throw on invalid input', () => {
      expect(() => functionName(null)).toThrow('Invalid input');
    });
  });
});
\`\`\`

Patterns:
  - Use beforeEach for per-test setup, avoid beforeAll
  - Use afterEach to restore mocks: vi.restoreAllMocks()
  - Explicit arrange/act/assert comments in complex tests
  - One assertion focus per test (but multiple expects OK)

Mocking:
Framework:
  - Vitest built-in mocking (vi)
  - Module mocking via vi.mock() at top of test file

Patterns:
\`\`\`typescript
import { vi } from 'vitest';
import { externalFunction } from './external';

// Mock module
vi.mock('./external', () => ({
  externalFunction: vi.fn()
}));

describe('test suite', () => {
  it('mocks function', () => {
    const mockFn = vi.mocked(externalFunction);
    mockFn.mockReturnValue('mocked result');

    // test code using mocked function

    expect(mockFn).toHaveBeenCalledWith('expected arg');
  });
});
\`\`\`

What to Mock:
  - File system operations (fs-extra)
  - Child process execution (child_process.exec)
  - External API calls
  - Environment variables (process.env)

What NOT to Mock:
  - Internal pure functions
  - Simple utilities (string manipulation, array helpers)
  - TypeScript types

Fixtures and Factories:
Test Data:
\`\`\`typescript
// Factory functions in test file
function createTestConfig(overrides?: Partial<Config>): Config {
  return {
    targetDir: '/tmp/test',
    global: false,
    ...overrides
  };
}

// Shared fixtures in tests/fixtures/
// tests/fixtures/sample-command.md
export const sampleCommand = \`
---
description: Test command
---
Content here\`;
\`\`\`

Location:
  - Factory functions: define in test file near usage
  - Shared fixtures: tests/fixtures/ (for multi-file test data)
  - Mock data: inline in test when simple, factory when complex

Coverage:
Requirements:
  - No enforced coverage target
  - Coverage tracked for awareness
  - Focus on critical paths (parsers, service logic)

Configuration:
  - Vitest coverage via c8 (built-in)
  - Excludes: *.test.ts, bin/install.ts, config files

View Coverage:
\`\`\`bash
npm run test:coverage
open coverage/index.html
\`\`\`

Test Types:
Unit Tests:
  - Test single function in isolation
  - Mock all external dependencies (fs, child_process)
  - Fast: each test <100ms
  - Examples: parser.test.ts, validator.test.ts

Integration Tests:
  - Test multiple modules together
  - Mock only external boundaries (file system, process)
  - Examples: install-service.test.ts (tests service + parser)

E2E Tests:
  - Not currently used
  - CLI integration tested manually

Common Patterns:
Async Testing:
\`\`\`typescript
it('should handle async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBe('expected');
});
\`\`\`

Error Testing:
\`\`\`typescript
it('should throw on invalid input', () => {
  expect(() => parse(null)).toThrow('Cannot parse null');
});

// Async error
it('should reject on file not found', async () => {
  await expect(readConfig('invalid.txt')).rejects.toThrow('ENOENT');
});
\`\`\`

File System Mocking:
\`\`\`typescript
import { vi } from 'vitest';
import * as fs from 'fs-extra';

vi.mock('fs-extra');

it('mocks file system', () => {
  vi.mocked(fs.readFile).mockResolvedValue('file content');
  // test code
});
\`\`\`

Snapshot Testing:
  - Not used in this codebase
  - Prefer explicit assertions for clarity
`,
  why: "Vitest provides fast testing with native TypeScript support, mocking for external dependencies only",
  file_refs: [
    "vitest.config.ts",
    "src/lib/parser.test.ts",
    "src/services/install-service.test.ts"
  ]
});
```

### Example 2: Jest + Playwright Testing (React App)

```typescript
const reactTesting = await megamemory_create_concept({
  name: "Testing Patterns",
  kind: "pattern",
  summary: `
Test Framework:
Runner:
  - Jest 29.7 for unit/integration tests
  - Playwright 1.40 for E2E tests
  - Config: jest.config.js, playwright.config.ts

Assertion Library:
  - Jest built-in expect (unit/integration)
  - Playwright expect (E2E)
  - Matchers: toBe, toEqual, toHaveBeenCalled, toBeInTheDocument

Run Commands:
\`\`\`bash
npm test                              # Run Jest tests
npm test -- --watch                   # Watch mode
npm test -- path/to/file.test.ts     # Single file
npm run test:e2e                      # Run Playwright E2E tests
npm run test:coverage                 # Coverage report
\`\`\`

Test File Organization:
Location:
  - *.test.tsx alongside component files (unit/integration)
  - *.e2e.test.ts in e2e/ directory (E2E tests)

Naming:
  - ComponentName.test.tsx for component tests
  - FeatureName.e2e.test.ts for E2E tests
  - integration.test.ts for integration tests

Structure:
\`\`\`
src/
  components/
    Button.tsx
    Button.test.tsx
  app/
    (dashboard)/
      page.tsx
      (dashboard).integration.test.ts
e2e/
  auth.e2e.test.ts
  checkout.e2e.test.ts
\`\`\`

Test Structure:
Suite Organization:
\`\`\`typescript
import { describe, it, expect, beforeEach, jest } from '@testing-library/react';

describe('Button Component', () => {
  beforeEach(() => {
    // reset mocks
  });

  it('renders correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
\`\`\`

Patterns:
  - Use beforeEach for per-test setup
  - afterEach to cleanup after tests
  - Arrange/Act/Assert pattern recommended
  - Test user behavior, not implementation details

Mocking:
Framework:
  - Jest built-in mocking (jest.fn(), jest.mock())

Patterns:
\`\`\`typescript
import { jest } from '@testing-library/react';

// Mock external module
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      signIn: jest.fn(),
      signOut: jest.fn()
    }
  }))
}));

describe('Auth Component', () => {
  it('calls signIn on form submit', async () => {
    const signIn = jest.fn();
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(signIn).toHaveBeenCalledWith({ email: 'test@example.com', password: 'password' });
  });
});
\`\`\`

What to Mock:
  - External API calls (Supabase, OpenAI)
  - Database queries
  - Authentication services
  - Time/dates (use jest.useFakeTimers())

What NOT to Mock:
  - React components
  - Custom hooks (unless integration test)
  - Simple utilities

Fixtures and Factories:
Test Data:
\`\`\`typescript
// Factory functions
function createTestUser(overrides?: Partial<User>): User {
  return {
    id: 'test-id',
    name: 'Test User',
    email: 'test@example.com',
    ...overrides
  };
}

// Shared fixtures in tests/fixtures/
// tests/fixtures/mockData.ts
export const mockCourses = [/* ... */];
\`\`\`

Location:
  - Factory functions: define in test file near usage
  - Shared fixtures: tests/fixtures/
  - Mock data: inline for simple, factory for complex

Coverage:
Requirements:
  - Target: 80% line coverage
  - Enforced in CI (blocks merge < 80%)

Configuration:
  - Jest coverage via --coverage flag
  - Excludes: *.test.tsx, *.e2e.test.ts, config files

View Coverage:
\`\`\`bash
npm run test:coverage
open coverage/lcov-report/index.html
\`\`\`

Test Types:
Unit Tests:
  - Test single component/function in isolation
  - Mock all external dependencies
  - Fast: each test < 50ms
  - Examples: Button.test.tsx, formatDate.test.ts

Integration Tests:
  - Test multiple components together
  - Mock only external boundaries (API, DB)
  - Medium speed: < 500ms per test
  - Examples: dashboard.integration.test.ts

E2E Tests:
  - Test full user flows in browser
  - No mocking (use test environment)
  - Slow: 1-5s per test
  - Examples: auth.e2e.test.ts, checkout.e2e.test.ts

Common Patterns:
Async Testing:
\`\`\`typescript
it('handles async operation', async () => {
  const result = await fetchData();
  expect(result).toEqual(expectedData);
});
\`\`\`

Error Testing:
\`\`\`typescript
it('shows error message on failure', async () => {
  const mockFetch = jest.fn().mockRejectedValue(new Error('API error'));
  render(<Component />);

  await waitFor(() => {
    expect(screen.getByText('API error')).toBeInTheDocument();
  });
});
\`\`\`

Snapshot Testing:
\`\`\`typescript
it('matches snapshot', () => {
  const { container } = render(<Button>Click me</Button>);
  expect(container.firstChild).toMatchSnapshot();
});
\`\`\`
`,
  why: "Jest for fast unit/integration tests, Playwright for realistic E2E testing",
  file_refs: [
    "jest.config.js",
    "playwright.config.ts",
    "src/components/Button.test.tsx",
    "e2e/auth.e2e.test.ts"
  ]
});
```

---

## File Template

```markdown
# Testing Patterns

**Analysis Date:** [YYYY-MM-DD]

**MegaMemory Concept:** Testing Patterns (stored in knowledge graph, not this file)

## Test Framework

**Runner:**
- [Framework: e.g., "Jest 29.x", "Vitest 1.x"]
- [Config: e.g., "jest.config.js in project root"]

**Assertion Library:**
- [Library: e.g., "built-in expect", "chai"]
- [Matchers: e.g., "toBe, toEqual, toThrow"]

**Run Commands:**
```bash
[e.g., "npm test" or "npm run test"]              # Run all tests
[e.g., "npm test -- --watch"]                     # Watch mode
[e.g., "npm test -- path/to/file.test.ts"]       # Single file
[e.g., "npm run test:coverage"]                   # Coverage report
```

## Test File Organization

**Location:**
- [Pattern: e.g., "*.test.ts alongside source files"]
- [Alternative: e.g., "__tests__/ directory" or "separate tests/ tree"]

**Naming:**
- [Unit tests: e.g., "module-name.test.ts"]
- [Integration: e.g., "feature-name.integration.test.ts"]
- [E2E: e.g., "user-flow.e2e.test.ts"]

**Structure:**
```
[Show actual directory pattern, e.g.:
src/
  lib/
    utils.ts
    utils.test.ts
  services/
    user-service.ts
    user-service.test.ts
]
```

## Test Structure

**Suite Organization:**
```typescript
[Show actual pattern used, e.g.:

describe('ModuleName', () => {
  describe('functionName', () => {
    it('should handle success case', () => {
      // arrange
      // act
      // assert
    });

    it('should handle error case', () => {
      // test code
    });
  });
});
]
```

**Patterns:**
- [Setup: e.g., "beforeEach for shared setup, avoid beforeAll"]
- [Teardown: e.g., "afterEach to clean up, restore mocks"]
- [Structure: e.g., "arrange/act/assert pattern required"]

## Mocking

**Framework:**
- [Tool: e.g., "Jest built-in mocking", "Vitest vi", "Sinon"]
- [Import mocking: e.g., "vi.mock() at top of file"]

**Patterns:**
```typescript
[Show actual mocking pattern, e.g.:

// Mock external dependency
vi.mock('./external-service', () => ({
  fetchData: vi.fn()
}));

// Mock in test
const mockFetch = vi.mocked(fetchData);
mockFetch.mockResolvedValue({ data: 'test' });
]
```

**What to Mock:**
- [e.g., "External APIs, file system, database"]
- [e.g., "Time/dates (use vi.useFakeTimers)"]
- [e.g., "Network calls (use mock fetch)"]

**What NOT to Mock:**
- [e.g., "Pure functions, utilities"]
- [e.g., "Internal business logic"]

## Fixtures and Factories

**Test Data:**
```typescript
[Show pattern for creating test data, e.g.:

// Factory pattern
function createTestUser(overrides?: Partial<User>): User {
  return {
    id: 'test-id',
    name: 'Test User',
    email: 'test@example.com',
    ...overrides
  };
}

// Fixture file
// tests/fixtures/users.ts
export const mockUsers = [/* ... */];
]
```

**Location:**
- [e.g., "tests/fixtures/ for shared fixtures"]
- [e.g., "factory functions in test file or tests/factories/"]

## Coverage

**Requirements:**
- [Target: e.g., "80% line coverage", "no specific target"]
- [Enforcement: e.g., "CI blocks <80%", "coverage for awareness only"]

**Configuration:**
- [Tool: e.g., "built-in coverage via --coverage flag"]
- [Exclusions: e.g., "exclude *.test.ts, config files"]

**View Coverage:**
```bash
[e.g., "npm run test:coverage"]
[e.g., "open coverage/index.html"]
```

## Test Types

**Unit Tests:**
- [Scope: e.g., "test single function/class in isolation"]
- [Mocking: e.g., "mock all external dependencies"]
- [Speed: e.g., "must run in <1s per test"]

**Integration Tests:**
- [Scope: e.g., "test multiple modules together"]
- [Mocking: e.g., "mock external services, use real internal modules"]
- [Setup: e.g., "use test database, seed data"]

**E2E Tests:**
- [Framework: e.g., "Playwright for E2E"]
- [Scope: e.g., "test full user flows"]
- [Location: e.g., "e2e/ directory separate from unit tests"]

## Common Patterns

**Async Testing:**
```typescript
[Show pattern, e.g.:

it('should handle async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBe('expected');
});
]
```

**Error Testing:**
```typescript
[Show pattern, e.g.:

it('should throw on invalid input', () => {
  expect(() => functionCall()).toThrow('error message');
});

// Async error
it('should reject on failure', async () => {
  await expect(asyncCall()).rejects.toThrow('error message');
});
]
```

**Snapshot Testing:**
- [Usage: e.g., "for React components only" or "not used"]
- [Location: e.g., "__snapshots__/ directory"]

---

*Testing analysis: [date]*
*Update when test patterns change*
```

<good_examples>
```markdown
# Testing Patterns

**Analysis Date:** 2025-01-20

**MegaMemory Concept:** Testing Patterns (stored in knowledge graph, not this file)

## Test Framework

**Runner:**
- Vitest 1.0.4
- Config: vitest.config.ts in project root

**Assertion Library:**
- Vitest built-in expect
- Matchers: toBe, toEqual, toThrow, toMatchObject

**Run Commands:**
```bash
npm test                              # Run all tests
npm test -- --watch                   # Watch mode
npm test -- path/to/file.test.ts     # Single file
npm run test:coverage                 # Coverage report
```

## Test File Organization

**Location:**
- *.test.ts alongside source files
- No separate tests/ directory

**Naming:**
- unit-name.test.ts for all tests
- No distinction between unit/integration in filename

**Structure:**
```
src/
  lib/
    parser.ts
    parser.test.ts
  services/
    install-service.ts
    install-service.test.ts
  bin/
    install.ts
    (no test - integration tested via CLI)
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('ModuleName', () => {
  describe('functionName', () => {
    beforeEach(() => {
      // reset state
    });

    it('should handle valid input', () => {
      // arrange
      const input = createTestInput();

      // act
      const result = functionName(input);

      // assert
      expect(result).toEqual(expectedOutput);
    });

    it('should throw on invalid input', () => {
      expect(() => functionName(null)).toThrow('Invalid input');
    });
  });
});
```

**Patterns:**
- Use beforeEach for per-test setup, avoid beforeAll
- Use afterEach to restore mocks: vi.restoreAllMocks()
- Explicit arrange/act/assert comments in complex tests
- One assertion focus per test (but multiple expects OK)

## Mocking

**Framework:**
- Vitest built-in mocking (vi)
- Module mocking via vi.mock() at top of test file

**Patterns:**
```typescript
import { vi } from 'vitest';
import { externalFunction } from './external';

// Mock module
vi.mock('./external', () => ({
  externalFunction: vi.fn()
}));

describe('test suite', () => {
  it('mocks function', () => {
    const mockFn = vi.mocked(externalFunction);
    mockFn.mockReturnValue('mocked result');

    // test code using mocked function

    expect(mockFn).toHaveBeenCalledWith('expected arg');
  });
});
```

**What to Mock:**
- File system operations (fs-extra)
- Child process execution (child_process.exec)
- External API calls
- Environment variables (process.env)

**What NOT to Mock:**
- Internal pure functions
- Simple utilities (string manipulation, array helpers)
- TypeScript types

## Fixtures and Factories

**Test Data:**
```typescript
// Factory functions in test file
function createTestConfig(overrides?: Partial<Config>): Config {
  return {
    targetDir: '/tmp/test',
    global: false,
    ...overrides
  };
}

// Shared fixtures in tests/fixtures/
// tests/fixtures/sample-command.md
export const sampleCommand = `---
description: Test command
---
Content here`;
```

**Location:**
- Factory functions: define in test file near usage
- Shared fixtures: tests/fixtures/ (for multi-file test data)
- Mock data: inline in test when simple, factory when complex

## Coverage

**Requirements:**
- No enforced coverage target
- Coverage tracked for awareness
- Focus on critical paths (parsers, service logic)

**Configuration:**
- Vitest coverage via c8 (built-in)
- Excludes: *.test.ts, bin/install.ts, config files

**View Coverage:**
```bash
npm run test:coverage
open coverage/index.html
```

## Test Types

**Unit Tests:**
- Test single function in isolation
- Mock all external dependencies (fs, child_process)
- Fast: each test <100ms
- Examples: parser.test.ts, validator.test.ts

**Integration Tests:**
- Test multiple modules together
- Mock only external boundaries (file system, process)
- Examples: install-service.test.ts (tests service + parser)

**E2E Tests:**
- Not currently used
- CLI integration tested manually

## Common Patterns

**Async Testing:**
```typescript
it('should handle async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBe('expected');
});
```

**Error Testing:**
```typescript
it('should throw on invalid input', () => {
  expect(() => parse(null)).toThrow('Cannot parse null');
});

// Async error
it('should reject on file not found', async () => {
  await expect(readConfig('invalid.txt')).rejects.toThrow('ENOENT');
});
```

**File System Mocking:**
```typescript
import { vi } from 'vitest';
import * as fs from 'fs-extra';

vi.mock('fs-extra');

it('mocks file system', () => {
  vi.mocked(fs.readFile).mockResolvedValue('file content');
  // test code
});
```

**Snapshot Testing:**
- Not used in this codebase
- Prefer explicit assertions for clarity

---

*Testing analysis: 2025-01-20*
*Update when test patterns change*
```
</good_examples>

<guidelines>
**What belongs in TESTING.md:**
- Test framework and runner configuration
- Test file location and naming patterns
- Test structure (describe/it, beforeEach patterns)
- Mocking approach and examples
- Fixture/factory patterns
- Coverage requirements
- How to run tests (commands)
- Common testing patterns in actual code

**What does NOT belong here:**
- Specific test cases (defer to actual test files)
- Technology choices (that's STACK.md)
- CI/CD setup (that's deployment docs)

**MegaMemory Usage:**
This template is for @-reference only. When agents need to understand or update testing patterns, they should:
1. Query MegaMemory: `megamemory_understand({ query: "testing patterns mocking fixtures" })`
2. Create/update testing patterns: `megamemory_create_concept()` or `megamemory_update_concept()`
3. Store in MegaMemory, not in this file

**When filling this template:**
- Check package.json scripts for test commands
- Find test config file (jest.config.js, vitest.config.ts)
- read 3-5 existing test files to identify patterns
- Look for test utilities in tests/ or test-utils/
- Check for coverage configuration
- Document actual patterns used, not ideal patterns

**Useful for chapter planning when:**
- Adding new features (write matching tests)
- Refactoring (maintain test patterns)
- Fixing bugs (add regression tests)
- Understanding verification approach
- Setting up test infrastructure

**Analysis approach:**
- Check package.json for test framework and scripts
- read test config file for coverage, setup
- Examine test file organization (collocated vs separate)
- Review 5 test files for patterns (mocking, structure, assertions)
- Look for test utilities, fixtures, factories
- Note any test types (unit, integration, e2e)
- Document commands for running tests
</guidelines>
