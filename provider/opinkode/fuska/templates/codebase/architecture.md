# Architecture Template (MegaMemory-Backed)

Template for codebase ARCHITECTURE documentation - captures conceptual code organization.

**Purpose:** Document how the code is organized at a conceptual level. Complements STRUCTURE.md (which shows physical file locations).

---

## MegaMemory Schema

```typescript
// Concept: codebase-arch (architecture section)
interface ArchitectureConcept {
  name: string;
  kind: "pattern";
  summary: string;
  why: string;
  file_refs: string[];
  edges: {
    to: string;
    relation: "depends_on" | "implements" | "calls" | "connects_to";
    description: string;
  }[];
}
```

### Schema Structure

An architecture concept in MegaMemory stores:
- **name**: "Architecture" or specific pattern name (e.g., "Layered Architecture", "Event-Driven")
- **kind**: "pattern"
- **summary**: Detailed description including:
  - Pattern overview (overall pattern, key characteristics)
  - Layers (purpose, contains, depends on, used by)
  - Data flow (typical request/execution lifecycle)
  - Key abstractions (purpose, examples, patterns)
  - Entry points (location, triggers, responsibilities)
  - Error handling (strategy, patterns)
  - Cross-cutting concerns (logging, validation, authentication)
- **why**: Rationale for architectural choices
- **file_refs**: Relevant files demonstrating the architecture
- **edges**: Relationships between architectural components

---

## MegaMemory Operations

### Create Architecture Concept

```typescript
import { megamemory_create_concept } from './mcp-client';

const architectureConcept = await megamemory_create_concept({
  name: "Architecture",
  kind: "pattern",
  summary: `
Overall: CLI Application with Plugin System
Key Characteristics:
  - Single executable with subcommands
  - Plugin-based extensibility
  - File-based state (no database)
  - Synchronous execution model

Layers:
  Command Layer: Parse user input, route to handlers
    - Location: src/commands/*.ts
    - Depends on: Service layer
    - Used by: CLI entry point
  Service Layer: Core business logic
    - Location: src/services/*.ts
    - Depends on: File system utilities
    - Used by: Command handlers
  Utility Layer: Shared helpers
    - Location: src/utils/*.ts
    - Depends on: Node.js built-ins
    - Used by: Service layer

Data Flow: CLI Command Execution
  1. User runs command
  2. Commander parses args
  3. Command handler invoked
  4. Handler calls service methods
  5. Service reads templates, processes files
  6. Results logged to console

Entry Points: CLI Entry (src/index.ts)
Error Handling: Throw exceptions, catch at command level, log and exit
Cross-Cutting: Console logging, Zod validation, FileService abstraction
`,
  why: "Simple, testable CLI with clear separation of concerns",
  file_refs: [
    "src/index.ts",
    "src/commands/*.ts",
    "src/services/*.ts"
  ],
  edges: [
    {
      to: "technology-stack-concept-id",
      relation: "implements",
      description: "Architecture implements CLI tool pattern"
    }
  ]
});
```

### Create Layer Concept

```typescript
const serviceLayerConcept = await megamemory_create_concept({
  name: "Service Layer",
  kind: "module",
  parent_id: "architecture-concept-id",
  summary: `
Purpose: Core business logic
Contains: FileService, TemplateService, InstallService
Location: src/services/*.ts
Depends on: File system utilities, external tools
Used by: Command handlers
Pattern: Singleton-like (imported as modules)
`,
  why: "Encapsulates business logic, testable, reusable",
  file_refs: [
    "src/services/file.ts",
    "src/services/template.ts",
    "src/services/project.ts"
  ],
  edges: [
    {
      to: "utility-layer-concept-id",
      relation: "depends_on",
      description: "Service layer depends on utility layer for file operations"
    },
    {
      to: "command-layer-concept-id",
      relation: "configured_by",
      description: "Command layer calls service methods"
    }
  ]
});
```

### Update Architecture

```typescript
import { megamemory_update_concept } from './mcp-client';

await megamemory_update_concept({
  id: "architecture-concept-id",
  changes: {
    summary: `
Overall: CLI Application with Plugin System (updated)
Key Characteristics:
  - Single executable with subcommands
  - Plugin-based extensibility
  - File-based state (no database)
  - Synchronous execution model
  - Added: Caching layer for template rendering
...rest of summary
`
  }
});
```

### Query Architecture

```typescript
import { megamemory_understand } from './mcp-client';

const results = await megamemory_understand({
  query: "What is the overall architecture and what are the main layers?",
  top_k: 10
});

// Returns Architecture concept with layers, data flow, etc.
```

---

## MegaMemory Examples

### Example 1: CLI Tool Architecture

```typescript
const cliArchitecture = await megamemory_create_concept({
  name: "Architecture",
  kind: "pattern",
  summary: `
Overall: CLI Application with Plugin System

Key Characteristics:
  - Single executable with subcommands
  - Plugin-based extensibility
  - File-based state (no database)
  - Synchronous execution model

Layers:
  Command Layer:
    - Purpose: Parse user input and route to appropriate handler
    - Contains: Command definitions, argument parsing, help text
    - Location: src/commands/*.ts
    - Depends on: Service layer for business logic
    - Used by: CLI entry point (src/index.ts)

  Service Layer:
    - Purpose: Core business logic
    - Contains: FileService, TemplateService, InstallService
    - Location: src/services/*.ts
    - Depends on: File system utilities, external tools
    - Used by: Command handlers

  Utility Layer:
    - Purpose: Shared helpers and abstractions
    - Contains: File I/O wrappers, path resolution, string formatting
    - Location: src/utils/*.ts
    - Depends on: Node.js built-ins only
    - Used by: Service layer

Data Flow: CLI Command Execution
  1. User runs: fuska new-project
  2. Commander parses args and flags
  3. Command handler invoked (src/commands/new-project.ts)
  4. Handler calls service methods (src/services/project.ts → create())
  5. Service reads templates, processes files, writes output
  6. Results logged to console
  7. Process exits with status code

State Management:
   - MegaMemory-backed: All project knowledge stored in knowledge graph
   - No persistent in-memory state
   - Each command execution is independent
   - Query state via megamemory:understand() for architecture patterns

Key Abstractions:
  Service:
    - Purpose: Encapsulate business logic for a domain
    - Examples: src/services/file.ts, src/services/template.ts, src/services/project.ts
    - Pattern: Singleton-like (imported as modules, not instantiated)

  Command:
    - Purpose: CLI command definition
    - Examples: src/commands/new-project.ts, src/commands/plan-chapter.ts
    - Pattern: Commander.js command registration

  Template:
    - Purpose: Reusable document structures
    - Examples: PROJECT.md, PLAN.md templates
    - Pattern: Markdown files with substitution variables

Entry Points:
  CLI Entry:
    - Location: src/index.ts
    - Triggers: User runs fuska <command>
    - Responsibilities: Register commands, parse args, display help

  Commands:
    - Location: src/commands/*.ts
    - Triggers: Matched command from CLI
    - Responsibilities: Validate input, call services, format output

Error Handling:
  Strategy: Throw exceptions, catch at command level, log and exit
  Patterns:
    - Services throw Error with descriptive messages
    - Command handlers catch, log error to stderr, exit(1)
    - Validation errors shown before execution (fail fast)

Cross-Cutting Concerns:
  Logging:
    - Console.log for normal output
    - Console.error for errors
    - Chalk for colored output

  Validation:
    - Zod schemas for config file parsing
    - Manual validation in command handlers
    - Fail fast on invalid input

  File Operations:
    - FileService abstraction over fs-extra
    - All paths validated before operations
    - Atomic writes (temp file + rename)
`,
  why: "Simple, testable CLI with clear separation of concerns",
  file_refs: [
    "src/index.ts:1-50",
    "src/commands/new-project.ts",
    "src/services/file.ts",
    "src/utils/path.ts"
  ]
});
```

### Example 2: Web Application Layered Architecture

```typescript
const webArchitecture = await megamemory_create_concept({
  name: "Architecture",
  kind: "pattern",
  summary: `
Overall: Full-Stack Web Application with Layered Architecture

Key Characteristics:
  - Next.js 14 with App Router
  - Server-side rendering with client-side interactivity
  - RESTful API routes
  - PostgreSQL database via Prisma ORM

Layers:
  Presentation Layer:
    - Purpose: UI components and page rendering
    - Contains: React components, Server Components, Client Components
    - Location: app/, components/
    - Depends on: API layer for data
    - Used by: Browser users

  API Layer:
    - Purpose: HTTP endpoints for data access
    - Contains: Route handlers, validation, response formatting
    - Location: app/api/
    - Depends on: Service layer for business logic
    - Used by: Client components, external clients

  Service Layer:
    - Purpose: Business logic and data operations
    - Contains: Domain services, data access methods
    - Location: lib/services/, lib/db/
    - Depends on: Database layer, external APIs
    - Used by: API layer, Server Components

  Data Layer:
    - Purpose: Data persistence and retrieval
    - Contains: Prisma models, database queries
    - Location: prisma/schema.prisma, lib/db/
    - Depends on: PostgreSQL database
    - Used by: Service layer

Data Flow: HTTP Request
  1. User navigates to /courses
  2. Next.js Router matches app/courses/page.tsx
  3. Server Component fetches data via lib/services/courses.ts
  4. Service queries database via Prisma
  5. Database returns courses with nested lessons
  6. Service transforms data, returns to component
  7. Component renders HTML with data

State Management:
  - Server state: Server Components fetch on each request
  - Client state: React hooks (useState, useContext) for UI state
  - Database state: PostgreSQL with Prisma ORM
  - Session state: Supabase Auth JWT in httpOnly cookies

Key Abstractions:
  Server Component:
    - Purpose: Render on server, fetch data, no client JS
    - Examples: app/dashboard/page.tsx, app/courses/[id]/page.tsx
    - Pattern: Async components, can fetch data directly

  API Route:
    - Purpose: Server-side HTTP endpoints
    - Examples: app/api/courses/route.ts, app/api/auth/signin/route.ts
    - Pattern: Next.js route handlers with validation

  Service:
    - Purpose: Encapsulate business logic
    - Examples: lib/services/courses.ts, lib/services/users.ts
    - Pattern: Functions that use Prisma and return typed results

Entry Points:
  Next.js Entry:
    - Location: app/layout.tsx (root layout)
    - Triggers: User visits any URL
    - Responsibilities: Wrap pages with providers, authentication

  API Entry:
    - Location: app/api/**/*.ts
    - Triggers: HTTP requests to /api/*
    - Responsibilities: Handle requests, return responses

Error Handling:
  Strategy: Try/catch in API routes, error boundaries in UI
  Patterns:
    - API routes catch errors, return 400/500 with error message
    - Server Components use error.tsx for error boundaries
    - Client components use try/catch for async operations

Cross-Cutting Concerns:
  Authentication:
    - Supabase Auth with JWT tokens
    - Protected routes check session server-side
    - Server Components can access user session

  Validation:
    - Zod schemas for API input validation
    - TypeScript for compile-time type checking
    - Server Actions validate before execution

  Logging:
    - Console.log for development
    - Sentry for production error tracking
    - Structured logging with context
`,
  why: "Next.js provides full-stack capabilities with excellent DX, Supabase handles auth and database",
  file_refs: [
    "app/layout.tsx",
    "app/api/courses/route.ts",
    "lib/services/courses.ts",
    "prisma/schema.prisma"
  ],
  edges: [
    {
      to: "database-concept-id",
      relation: "depends_on",
      description: "Application depends on PostgreSQL database"
    },
    {
      to: "authentication-concept-id",
      relation: "connects_to",
      description: "Application integrates with Supabase Auth"
    }
  ]
});
```

---

## File Template

```markdown
# Architecture

**Analysis Date:** [YYYY-MM-DD]

**MegaMemory Concept:** Architecture (stored in knowledge graph, not this file)

## Pattern Overview

**Overall:** [Pattern name: e.g., "Monolithic CLI", "Serverless API", "Full-stack MVC"]

**Key Characteristics:**
- [Characteristic 1: e.g., "Single executable"]
- [Characteristic 2: e.g., "Stateless request handling"]
- [Characteristic 3: e.g., "Event-driven"]

## Layers

[Describe the conceptual layers and their responsibilities]

**[Layer Name]:**
- Purpose: [What this layer does]
- Contains: [Types of code: e.g., "route handlers", "business logic"]
- Depends on: [What it uses: e.g., "data layer only"]
- Used by: [What uses it: e.g., "API routes"]

**[Layer Name]:**
- Purpose: [What this layer does]
- Contains: [Types of code]
- Depends on: [What it uses]
- Used by: [What uses it]

## Data Flow

[Describe the typical request/execution lifecycle]

**[Flow Name] (e.g., "HTTP Request", "CLI Command", "Event Processing"):**

1. [Entry point: e.g., "User runs command"]
2. [Processing step: e.g., "Router matches path"]
3. [Processing step: e.g., "Controller validates input"]
4. [Processing step: e.g., "Service executes logic"]
5. [Output: e.g., "Response returned"]

**State Management:**
- [How state is handled: e.g., "Stateless - no persistent state", "Database per request", "In-memory cache"]

## Key Abstractions

[Core concepts/patterns used throughout the codebase]

**[Abstraction Name]:**
- Purpose: [What it represents]
- Examples: [e.g., "UserService, ProjectService"]
- Pattern: [e.g., "Singleton", "Factory", "Repository"]

**[Abstraction Name]:**
- Purpose: [What it represents]
- Examples: [Concrete examples]
- Pattern: [Pattern used]

## Entry Points

[Where execution begins]

**[Entry Point]:**
- Location: [Brief: e.g., "src/index.ts", "API Gateway triggers"]
- Triggers: [What invokes it: e.g., "CLI invocation", "HTTP request"]
- Responsibilities: [What it does: e.g., "Parse args, route to command"]

## Error Handling

**Strategy:** [How errors are handled: e.g., "Exception bubbling to top-level handler", "Per-route error middleware"]

**Patterns:**
- [Pattern: e.g., "try/catch at controller level"]
- [Pattern: e.g., "Error codes returned to user"]

## Cross-Cutting Concerns

[Aspects that affect multiple layers]

**Logging:**
- [Approach: e.g., "Winston logger, injected per-request"]

**Validation:**
- [Approach: e.g., "Zod schemas at API boundary"]

**Authentication:**
- [Approach: e.g., "JWT middleware on protected routes"]

---

*Architecture analysis: [date]*
*Update when major patterns change*
```

<good_examples>
```markdown
# Architecture

**Analysis Date:** 2025-01-20

**MegaMemory Concept:** Architecture (stored in knowledge graph, not this file)

## Pattern Overview

**Overall:** CLI Application with Plugin System

**Key Characteristics:**
- Single executable with subcommands
- Plugin-based extensibility
- File-based state (no database)
- Synchronous execution model

## Layers

**Command Layer:**
- Purpose: Parse user input and route to appropriate handler
- Contains: Command definitions, argument parsing, help text
- Location: `src/commands/*.ts`
- Depends on: Service layer for business logic
- Used by: CLI entry point (`src/index.ts`)

**Service Layer:**
- Purpose: Core business logic
- Contains: FileService, TemplateService, InstallService
- Location: `src/services/*.ts`
- Depends on: File system utilities, external tools
- Used by: Command handlers

**Utility Layer:**
- Purpose: Shared helpers and abstractions
- Contains: File I/O wrappers, path resolution, string formatting
- Location: `src/utils/*.ts`
- Depends on: Node.js built-ins only
- Used by: Service layer

## Data Flow

**CLI Command Execution:**

1. User runs: `fuska new-project`
2. Commander parses args and flags
3. Command handler invoked (`src/commands/new-project.ts`)
4. Handler calls service methods (`src/services/project.ts` → `create()`)
5. Service reads templates, processes files, writes output
6. Results logged to console
7. Process exits with status code

**State Management:**
- MegaMemory-backed: All project knowledge stored in knowledge graph
- No persistent in-memory state
- Each command execution is independent
- Query state via `megamemory:understand()` for architecture patterns

## Key Abstractions

**Service:**
- Purpose: Encapsulate business logic for a domain
- Examples: `src/services/file.ts`, `src/services/template.ts`, `src/services/project.ts`
- Pattern: Singleton-like (imported as modules, not instantiated)

**Command:**
- Purpose: CLI command definition
- Examples: `src/commands/new-project.ts`, `src/commands/plan-chapter.ts`
- Pattern: Commander.js command registration

**Template:**
- Purpose: Reusable document structures
- Examples: PROJECT.md, PLAN.md templates
- Pattern: Markdown files with substitution variables

## Entry Points

**CLI Entry:**
- Location: `src/index.ts`
- Triggers: User runs `fuska <command>`
- Responsibilities: Register commands, parse args, display help

**Commands:**
- Location: `src/commands/*.ts`
- Triggers: Matched command from CLI
- Responsibilities: Validate input, call services, format output

## Error Handling

**Strategy:** Throw exceptions, catch at command level, log and exit

**Patterns:**
- Services throw Error with descriptive messages
- Command handlers catch, log error to stderr, exit(1)
- Validation errors shown before execution (fail fast)

## Cross-Cutting Concerns

**Logging:**
- Console.log for normal output
- Console.error for errors
- Chalk for colored output

**Validation:**
- Zod schemas for config file parsing
- Manual validation in command handlers
- Fail fast on invalid input

**File Operations:**
- FileService abstraction over fs-extra
- All paths validated before operations
- Atomic writes (temp file + rename)

---

*Architecture analysis: 2025-01-20*
*Update when major patterns change*
```
</good_examples>

<guidelines>
**What belongs in ARCHITECTURE.md:**
- Overall architectural pattern (monolith, microservices, layered, etc.)
- Conceptual layers and their relationships
- Data flow / request lifecycle
- Key abstractions and patterns
- Entry points
- Error handling strategy
- Cross-cutting concerns (logging, auth, validation)

**What does NOT belong here:**
- Exhaustive file listings (that's STRUCTURE.md)
- Technology choices (that's STACK.md)
- Line-by-line code walkthrough (defer to code reading)
- Implementation details of specific features

**File paths ARE welcome:**
Include file paths as concrete examples of abstractions. Use backtick formatting: `src/services/user.ts`. This makes the architecture document actionable for OpenCode when planning.

**MegaMemory Usage:**
This template is for @-reference only. When agents need to understand or update architecture, they should:
1. Query MegaMemory: `megamemory_understand({ query: "architecture layers data flow" })`
2. Create/update architecture: `megamemory_create_concept()` or `megamemory_update_concept()`
3. Create layer concepts as children of the architecture concept
4. Store in MegaMemory, not in this file

**When filling this template:**
- read main entry points (index, server, main)
- Identify layers by reading imports/dependencies
- Trace a typical request/command execution
- Note recurring patterns (services, controllers, repositories)
- Keep descriptions conceptual, not mechanical

**Useful for chapter planning when:**
- Adding new features (where does it fit in the layers?)
- Refactoring (understanding current patterns)
- Identifying where to add code (which layer handles X?)
- Understanding dependencies between components
</guidelines>
