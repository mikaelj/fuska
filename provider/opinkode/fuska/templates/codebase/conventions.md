# Coding Conventions Template (MegaMemory-Backed)

Template for codebase CONVENTIONS documentation - captures coding style and patterns.

**Purpose:** Document how code is written in this codebase. Prescriptive guide for OpenCode to match existing style.

---

## MegaMemory Schema

```typescript
// Concept: codebase-quality (conventions section)
interface ConventionsConcept {
  name: string;
  kind: "pattern";
  summary: string;
  why: string;
  file_refs: string[];
  edges: {
    to: string;
    relation: "implements" | "configured_by" | "depends_on";
    description: string;
  }[];
}
```

### Schema Structure

A coding conventions concept in MegaMemory stores:
- **name**: "Coding Conventions" or specific convention set name
- **kind**: "pattern"
- **summary**: Detailed description including:
  - Naming patterns (files, functions, variables, types)
  - Code style (formatting, linting)
  - Import organization (order, grouping, aliases)
  - Error handling (patterns, types, logging)
  - Logging (framework, patterns)
  - Comments (when, JSDoc/TSDoc, TODOs)
  - Function design (size, parameters, returns)
  - Module design (exports, barrel files)
- **why**: Rationale for convention choices
- **file_refs**: Configuration files and example code
- **edges**: Relationships to tooling (Prettier, ESLint, etc.)

---

## MegaMemory Operations

### Create Conventions Concept

```typescript
import { megamemory_create_concept } from './mcp-client';

const conventionsConcept = await megamemory_create_concept({
  name: "Coding Conventions",
  kind: "pattern",
  summary: `
Naming Patterns:
  Files: kebab-case for all files, *.test.ts alongside source files, index.ts for barrel exports
  Functions: camelCase for all functions, no special prefix for async functions, handleEventName for event handlers
  Variables: camelCase for variables, UPPER_SNAKE_CASE for constants (MAX_RETRIES, API_BASE_URL), no underscore prefix
  Types: PascalCase for interfaces (no I prefix), PascalCase for type aliases (UserConfig, ResponseData), PascalCase for enum names (Status.PENDING)

Code Style:
  Formatting: Prettier with .prettierrc, 100 character line length, single quotes, semicolons required, 2 space indentation
  Linting: ESLint with eslint.config.js, extends @typescript-eslint/recommended, no console.log in production (use logger)
  Run: npm run lint

Import Organization:
  Order: 1) External packages (react, express, commander), 2) Internal modules (@/lib, @/services), 3) Relative imports (./utils, ../types), 4) Type imports (import type { User })
  Grouping: Blank line between groups, alphabetical within each group, type imports last within each group
  Aliases: @/ maps to src/, no other aliases defined

Error Handling:
  Patterns: Throw errors, catch at boundaries (route handlers, main functions), extend Error class for custom errors (ValidationError, NotFoundError), async functions use try/catch
  Types: Throw on invalid input, missing dependencies, invariant violations. Log error with context before throwing. Include cause in error message
  Logging: logger.error({ err, userId }, 'Failed to process')

Logging:
  Framework: pino logger instance exported from lib/logger.ts, Levels: debug, info, warn, error (no trace)
  Patterns: Structured logging with context: logger.info({ userId, action }, 'User action'), log at service boundaries, not in utility functions, log state transitions, external API calls, errors
  No console.log in committed code

Comments:
  When to Comment: Explain why, not what, document business rules, explain non-obvious algorithms or workarounds, avoid obvious comments
  JSDoc/TSDoc: Required for public API functions, optional for internal functions if signature is self-explanatory, use @param, @returns, @throws tags
  TODO Comments: Format: // TODO: description (no username, using git blame), link to issue if exists

Function Design:
  Size: Keep under 50 lines, extract helpers for complex logic, one level of abstraction per function
  Parameters: Max 3 parameters, use options object for 4+ parameters: function create(options: CreateOptions), destructure in parameter list: function process({ id, name }: ProcessParams)
  Return Values: Explicit return statements, return early for guard clauses, use Result<T, E> type for expected failures

Module Design:
  Exports: Named exports preferred, default exports only for React components, export public API from index.ts barrel files
  Barrel Files: index.ts re-exports public API, keep internal helpers private (don't export from index), avoid circular dependencies
`,
  why: "Consistent style improves readability and maintainability, follows TypeScript/JavaScript best practices",
  file_refs: [
    ".prettierrc",
    "eslint.config.js",
    "tsconfig.json",
    "package.json:scripts"
  ]
});
```

### Update Conventions

```typescript
import { megamemory_update_concept } from './mcp-client';

await megamemory_update_concept({
  id: "conventions-concept-id",
  changes: {
    summary: `
Naming Patterns:
  Files: kebab-case for all files, *.test.ts alongside source files, index.ts for barrel exports
  Functions: camelCase for all functions, async functions prefixed with 'async' (NEW), handleEventName for event handlers
...rest of summary
`
  }
});
```

### Query Conventions

```typescript
import { megamemory_understand } from './mcp-client';

const results = await megamemory_understand({
  query: "What are the naming conventions for functions and variables?",
  top_k: 10
});

// Returns convention information about naming
```

---

## MegaMemory Examples

### Example 1: TypeScript Conventions

```typescript
const tsConventions = await megamemory_create_concept({
  name: "Coding Conventions",
  kind: "pattern",
  summary: `
Naming Patterns:
Files:
  - kebab-case for all files (command-handler.ts, user-service.ts)
  - *.test.ts alongside source files
  - index.ts for barrel exports

Functions:
  - camelCase for all functions
  - No special prefix for async functions
  - handleEventName for event handlers (handleClick, handleSubmit)

Variables:
  - camelCase for variables
  - UPPER_SNAKE_CASE for constants (MAX_RETRIES, API_BASE_URL)
  - No underscore prefix (no private marker in TS)

Types:
  - PascalCase for interfaces, no I prefix (User, not IUser)
  - PascalCase for type aliases (UserConfig, ResponseData)
  - PascalCase for enum names, UPPER_CASE for values (Status.PENDING)

Code Style:
Formatting:
  - Prettier with .prettierrc
  - 100 character line length
  - Single quotes for strings
  - Semicolons required
  - 2 space indentation

Linting:
  - ESLint with eslint.config.js
  - Extends @typescript-eslint/recommended
  - No console.log in production code (use logger)
  - Run: npm run lint

Import Organization:
Order:
  1. External packages (react, express, commander)
  2. Internal modules (@/lib, @/services)
  3. Relative imports (./utils, ../types)
  4. Type imports (import type { User })

Grouping:
  - Blank line between groups
  - Alphabetical within each group
  - Type imports last within each group

Path Aliases:
  - @/ maps to src/
  - No other aliases defined

Error Handling:
Patterns:
  - Throw errors, catch at boundaries (route handlers, main functions)
  - Extend Error class for custom errors (ValidationError, NotFoundError)
  - Async functions use try/catch, no .catch() chains

Error Types:
  - Throw on invalid input, missing dependencies, invariant violations
  - Log error with context before throwing: logger.error({ err, userId }, 'Failed to process')
  - Include cause in error message: new Error('Failed to X', { cause: originalError })

Logging:
Framework:
  - pino logger instance exported from lib/logger.ts
  - Levels: debug, info, warn, error (no trace)

Patterns:
  - Structured logging with context: logger.info({ userId, action }, 'User action')
  - Log at service boundaries, not in utility functions
  - Log state transitions, external API calls, errors
  - No console.log in committed code

Comments:
When to Comment:
  - Explain why, not what: // Retry 3 times because API has transient failures
  - Document business rules: // Users must verify email within 24 hours
  - Explain non-obvious algorithms or workarounds
  - Avoid obvious comments: // set count to 0

JSDoc/TSDoc:
  - Required for public API functions
  - Optional for internal functions if signature is self-explanatory
  - Use @param, @returns, @throws tags

TODO Comments:
  - Format: // TODO: description (no username, using git blame)
  - Link to issue if exists: // TODO: Fix race condition (issue #123)

Function Design:
Size:
  - Keep under 50 lines
  - Extract helpers for complex logic
  - One level of abstraction per function

Parameters:
  - Max 3 parameters
  - Use options object for 4+ parameters: function create(options: CreateOptions)
  - Destructure in parameter list: function process({ id, name }: ProcessParams)

Return Values:
  - Explicit return statements
  - Return early for guard clauses
  - Use Result<T, E> type for expected failures

Module Design:
Exports:
  - Named exports preferred
  - Default exports only for React components
  - Export public API from index.ts barrel files

Barrel Files:
  - index.ts re-exports public API
  - Keep internal helpers private (don't export from index)
  - Avoid circular dependencies (import from specific files if needed)
`,
  why: "Consistent TypeScript style improves type safety and developer experience",
  file_refs: [
    ".prettierrc",
    "eslint.config.js",
    "tsconfig.json",
    "package.json:10-50"
  ],
  edges: [
    {
      to: "prettier-config-concept-id",
      relation: "configured_by",
      description: "Conventions enforce Prettier formatting rules"
    },
    {
      to: "eslint-config-concept-id",
      relation: "configured_by",
      description: "Conventions enforce ESLint linting rules"
    }
  ]
});
```

### Example 2: JavaScript Conventions

```typescript
const jsConventions = await megamemory_create_concept({
  name: "Coding Conventions",
  kind: "pattern",
  summary: `
Naming Patterns:
Files:
  - kebab-case.js for JavaScript files
  - *.test.js alongside source files
  - .eslintrc.js for ESLint config

Functions:
  - camelCase for all functions
  - _prefix for private functions (optional, not required)
  - isX for boolean return functions (isValid, isActive)

Variables:
  - camelCase for variables
  - UPPER_SNAKE_CASE for constants (MAX_RETRIES, API_BASE_URL)
  - _prefix for private module variables (optional)

Code Style:
Formatting:
  - Prettier with .prettierrc
  - 80 character line length
  - Single quotes for strings
  - No semicolons (standard style)
  - 2 space indentation

Linting:
  - ESLint with .eslintrc.js
  - Extends eslint:recommended
  - No console.log in production code (use logger)
  - Run: npm run lint

Import Organization:
Order:
  1. Node.js built-ins (fs, path)
  2. External packages (express, lodash)
  3. Internal modules (./utils, ../config)
  4. Same-directory imports (./helper.js)

Grouping:
  - Blank line between groups
  - Alphabetical within each group

Error Handling:
Patterns:
  - Throw Error objects, catch at boundaries
  - Custom errors extend Error class
  - Async functions use try/catch or .catch()

Error Types:
  - Throw on invalid input, missing dependencies
  - Log error before throwing
  - Use Error.captureStackTrace for debugging

Logging:
Framework:
  - Winston logger instance from lib/logger.js
  - Levels: error, warn, info, debug, trace

Patterns:
  - Structured logging: logger.info({ userId, action }, 'User action')
  - Log at service boundaries
  - Log state transitions, external API calls, errors
  - No console.log in committed code

Comments:
When to Comment:
  - Explain why, not what
  - Document business rules
  - Explain complex algorithms
  - Use JSDoc for public APIs

JSDoc:
  - Required for public API functions
  - Use @param, @returns, @throws tags
  - Example: /** @param {string} name - User name */

TODO Comments:
  - Format: // TODO: description
  - Link to issue if exists

Function Design:
Size:
  - Keep under 40 lines
  - Extract helpers for complex logic
  - One level of abstraction per function

Parameters:
  - Max 3 parameters
  - Use object for 4+ parameters: function create(options)

Return Values:
  - Explicit return statements
  - Return early for guard clauses
  - Return undefined for void functions (implicit OK)

Module Design:
Exports:
  - Named exports preferred
  - Default exports for main entry points
  - Export public API from index.js

Barrel Files:
  - index.js re-exports public API
  - Keep internal helpers private
  - Avoid circular dependencies
`,
  why: "Clean JavaScript style with modern practices",
  file_refs: [
    ".prettierrc",
    ".eslintrc.js",
    "package.json"
  ]
});
```

---

## File Template

```markdown
# Coding Conventions

**Analysis Date:** [YYYY-MM-DD]

**MegaMemory Concept:** Coding Conventions (stored in knowledge graph, not this file)

## Naming Patterns

**Files:**
- [Pattern: e.g., "kebab-case for all files"]
- [Test files: e.g., "*.test.ts alongside source"]
- [Components: e.g., "PascalCase.tsx for React components"]

**Functions:**
- [Pattern: e.g., "camelCase for all functions"]
- [Async: e.g., "no special prefix for async functions"]
- [Handlers: e.g., "handleEventName for event handlers"]

**Variables:**
- [Pattern: e.g., "camelCase for variables"]
- [Constants: e.g., "UPPER_SNAKE_CASE for constants"]
- [Private: e.g., "_prefix for private members" or "no prefix"]

**Types:**
- [Interfaces: e.g., "PascalCase, no I prefix"]
- [Types: e.g., "PascalCase for type aliases"]
- [Enums: e.g., "PascalCase for enum name, UPPER_CASE for values"]

## Code Style

**Formatting:**
- [Tool: e.g., "Prettier with config in .prettierrc"]
- [Line length: e.g., "100 characters max"]
- [Quotes: e.g., "single quotes for strings"]
- [Semicolons: e.g., "required" or "omitted"]

**Linting:**
- [Tool: e.g., "ESLint with eslint.config.js"]
- [Rules: e.g., "extends airbnb-base, no console in production"]
- [Run: e.g., "npm run lint"]

## Import Organization

**Order:**
1. [e.g., "External packages (react, express, etc.)"]
2. [e.g., "Internal modules (@/lib, @/components)"]
3. [e.g., "Relative imports (., ..)"]
4. [e.g., "Type imports (import type {})"]

**Grouping:**
- [Blank lines: e.g., "blank line between groups"]
- [Sorting: e.g., "alphabetical within each group"]

**Path Aliases:**
- [Aliases used: e.g., "@/ for src/, @components/ for src/components/"]

## Error Handling

**Patterns:**
- [Strategy: e.g., "throw errors, catch at boundaries"]
- [Custom errors: e.g., "extend Error class, named *Error"]
- [Async: e.g., "use try/catch, no .catch() chains"]

**Error Types:**
- [When to throw: e.g., "invalid input, missing dependencies"]
- [When to return: e.g., "expected failures return Result<T, E>"]
- [Logging: e.g., "log error with context before throwing"]

## Logging

**Framework:**
- [Tool: e.g., "console.log, pino, winston"]
- [Levels: e.g., "debug, info, warn, error"]

**Patterns:**
- [Format: e.g., "structured logging with context object"]
- [When: e.g., "log state transitions, external calls"]
- [Where: e.g., "log at service boundaries, not in utils"]

## Comments

**When to Comment:**
- [e.g., "explain why, not what"]
- [e.g., "document business logic, algorithms, edge cases"]
- [e.g., "avoid obvious comments like // increment counter"]

**JSDoc/TSDoc:**
- [Usage: e.g., "required for public APIs, optional for internal"]
- [Format: e.g., "use @param, @returns, @throws tags"]

**TODO Comments:**
- [Pattern: e.g., "// TODO(username): description"]
- [Tracking: e.g., "link to issue number if available"]

## Function Design

**Size:**
- [e.g., "keep under 50 lines, extract helpers"]

**Parameters:**
- [e.g., "max 3 parameters, use object for more"]
- [e.g., "destructure objects in parameter list"]

**Return Values:**
- [e.g., "explicit returns, no implicit undefined"]
- [e.g., "return early for guard clauses"]

## Module Design

**Exports:**
- [e.g., "named exports preferred, default exports for React components"]
- [e.g., "export from index.ts for public API"]

**Barrel Files:**
- [e.g., "use index.ts to re-export public API"]
- [e.g., "avoid circular dependencies"]

---

*Convention analysis: [date]*
*Update when patterns change*
```

<good_examples>
```markdown
# Coding Conventions

**Analysis Date:** 2025-01-20

**MegaMemory Concept:** Coding Conventions (stored in knowledge graph, not this file)

## Naming Patterns

**Files:**
- kebab-case for all files (command-handler.ts, user-service.ts)
- *.test.ts alongside source files
- index.ts for barrel exports

**Functions:**
- camelCase for all functions
- No special prefix for async functions
- handleEventName for event handlers (handleClick, handleSubmit)

**Variables:**
- camelCase for variables
- UPPER_SNAKE_CASE for constants (MAX_RETRIES, API_BASE_URL)
- No underscore prefix (no private marker in TS)

**Types:**
- PascalCase for interfaces, no I prefix (User, not IUser)
- PascalCase for type aliases (UserConfig, ResponseData)
- PascalCase for enum names, UPPER_CASE for values (Status.PENDING)

## Code Style

**Formatting:**
- Prettier with .prettierrc
- 100 character line length
- Single quotes for strings
- Semicolons required
- 2 space indentation

**Linting:**
- ESLint with eslint.config.js
- Extends @typescript-eslint/recommended
- No console.log in production code (use logger)
- Run: npm run lint

## Import Organization

**Order:**
1. External packages (react, express, commander)
2. Internal modules (@/lib, @/services)
3. Relative imports (./utils, ../types)
4. Type imports (import type { User })

**Grouping:**
- Blank line between groups
- Alphabetical within each group
- Type imports last within each group

**Path Aliases:**
- @/ maps to src/
- No other aliases defined

## Error Handling

**Patterns:**
- Throw errors, catch at boundaries (route handlers, main functions)
- Extend Error class for custom errors (ValidationError, NotFoundError)
- Async functions use try/catch, no .catch() chains

**Error Types:**
- Throw on invalid input, missing dependencies, invariant violations
- Log error with context before throwing: logger.error({ err, userId }, 'Failed to process')
- Include cause in error message: new Error('Failed to X', { cause: originalError })

## Logging

**Framework:**
- pino logger instance exported from lib/logger.ts
- Levels: debug, info, warn, error (no trace)

**Patterns:**
- Structured logging with context: logger.info({ userId, action }, 'User action')
- Log at service boundaries, not in utility functions
- Log state transitions, external API calls, errors
- No console.log in committed code

## Comments

**When to Comment:**
- Explain why, not what: // Retry 3 times because API has transient failures
- Document business rules: // Users must verify email within 24 hours
- Explain non-obvious algorithms or workarounds
- Avoid obvious comments: // set count to 0

**JSDoc/TSDoc:**
- Required for public API functions
- Optional for internal functions if signature is self-explanatory
- Use @param, @returns, @throws tags

**TODO Comments:**
- Format: // TODO: description (no username, using git blame)
- Link to issue if exists: // TODO: Fix race condition (issue #123)

## Function Design

**Size:**
- Keep under 50 lines
- Extract helpers for complex logic
- One level of abstraction per function

**Parameters:**
- Max 3 parameters
- Use options object for 4+ parameters: function create(options: CreateOptions)
- Destructure in parameter list: function process({ id, name }: ProcessParams)

**Return Values:**
- Explicit return statements
- Return early for guard clauses
- Use Result<T, E> type for expected failures

## Module Design

**Exports:**
- Named exports preferred
- Default exports only for React components
- Export public API from index.ts barrel files

**Barrel Files:**
- index.ts re-exports public API
- Keep internal helpers private (don't export from index)
- Avoid circular dependencies (import from specific files if needed)

---

*Convention analysis: 2025-01-20*
*Update when patterns change*
```
</good_examples>

<guidelines>
**What belongs in CONVENTIONS.md:**
- Naming patterns observed in the codebase
- Formatting rules (Prettier config, linting rules)
- Import organization patterns
- Error handling strategy
- Logging approach
- Comment conventions
- Function and module design patterns

**What does NOT belong here:**
- Architecture decisions (that's ARCHITECTURE.md)
- Technology choices (that's STACK.md)
- Test patterns (that's TESTING.md)
- File organization (that's STRUCTURE.md)

**MegaMemory Usage:**
This template is for @-reference only. When agents need to understand or update conventions, they should:
1. Query MegaMemory: `megamemory_understand({ query: "coding conventions naming patterns" })`
2. Create/update conventions: `megamemory_create_concept()` or `megamemory_update_concept()`
3. Store in MegaMemory, not in this file

**When filling this template:**
- Check .prettierrc, .eslintrc, or similar config files
- Examine 5-10 representative source files for patterns
- Look for consistency: if 80%+ follows a pattern, document it
- Be prescriptive: "Use X" not "Sometimes Y is used"
- Note deviations: "Legacy code uses Y, new code should use X"
- Keep under ~150 lines total

**Useful for chapter planning when:**
- Writing new code (match existing style)
- Adding features (follow naming patterns)
- Refactoring (apply consistent conventions)
- Code review (check against documented patterns)
- Onboarding (understand style expectations)

**Analysis approach:**
- Scan src/ directory for file naming patterns
- Check package.json scripts for lint/format commands
- read 5-10 files to identify function naming, error handling
- Look for config files (.prettierrc, eslint.config.js)
- Note patterns in imports, comments, function signatures
</guidelines>
