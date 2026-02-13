# Architecture Research Template (MegaMemory-Backed)

Template for architecture research concepts — system structure patterns for the project domain, stored in MegaMemory.

**Principle:** All architecture data lives in MegaMemory concepts. This file teaches agents how to create, update, and query architecture research concepts.

---

## MegaMemory Schema

```typescript
// Architecture Research Concept Structure
interface ArchitectureResearchConcept {
  name: string;                    // e.g., "Architecture Research: REST API"
  kind: "feature" | "module" | "pattern" | "config" | "decision" | "component";
  summary: string;                  // Concise description: system overview, components, patterns, data flow
  
  // Metadata stored in summary/why fields
  why: string;                     // Why this architecture is recommended for this domain
  file_refs: string[];             // Source documentation URLs or file paths
  edges: ConceptEdge[];
  parent_id?: string;              // Optional parent concept
  
  created_by_task: string;          // Description of task that created this
}

interface ConceptEdge {
  to: string;                      // Target concept ID
  relation: "connects_to" | "depends_on" | "implements" | "calls" | "configured_by";
  description: string;             // Why this relationship exists
}

// Store architecture details in summary field using structured format:
const archSummary = `
**Domain:** [domain type]
**Researched:** [date]
**Confidence:** [HIGH/MEDIUM/LOW]

**System Overview:**
\`\`\`
┌─────────────────────────────────────────────────────────────┐
│                        [Layer Name]                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ [Comp]  │  │ [Comp]  │  │ [Comp]  │  │ [Comp]  │        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
│       │            │            │            │              │
├───────┴────────────┴────────────┴────────────┴──────────────┤
│                        [Layer Name]                          │
└─────────────────────────────────────────────────────────────┘
\`\`\`

**Component Responsibilities:**
| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| [name] | [what it owns] | [how it's usually built] |

**Project Structure:**
\`\`\`
src/
├── [folder]/           # [purpose]
└── [file].ts           # [purpose]
\`\`\`

**Architectural Patterns:**
**Pattern 1:** [Pattern Name] — [description]

**Data Flow:**
\`\`\`
[User Action] → [Component] → [Handler] → [Service] → [Data Store]
\`\`\`

**Scaling Considerations:**
| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | [approach] |
| 1k-100k users | [approach] |

**Anti-Patterns:**
**Anti-Pattern 1:** [Name] — [why it's wrong, what to do instead]

**Integration Points:**
| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| [service] | [how to connect] | [gotchas] |

**Sources:**
- [Architecture references]
- [Official documentation]
`;
```

---

## MegaMemory Operations

### Creating Architecture Research Concepts

```typescript
// Create architecture research concept
await megamemory.create_concept({
  name: "Architecture Research: REST API",
  kind: "pattern",
  summary: `
**Domain:** REST API
**Researched:** 2025-02-08
**Confidence:** HIGH

**System Overview:**
\`\`\`
┌─────────────────────────────────────────────────────────────┐
│                    HTTP Routes Layer                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ Routes  │  │ Routes  │  │ Routes  │  │ Routes  │        │
│  │ /users  │  │ /posts  │  │ /auth   │  │ /files  │        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
│       │            │            │            │              │
├───────┴────────────┴────────────┴────────────┴──────────────┤
│                    Controllers Layer                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Request/Response Validation              │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│                    Services Layer                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ UserService│  │ PostService│  │ AuthService│             │
│  └──────────┘  └──────────┘  └──────────┘                   │
├─────────────────────────────────────────────────────────────┤
│                    Data Access Layer                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ Prisma   │  │ Redis    │  │ S3       │                   │
│  │ Client   │  │ Cache    │  │ Storage  │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
└─────────────────────────────────────────────────────────────┘
\`\`\`

**Component Responsibilities:**
| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Routes | HTTP endpoint definitions, URL routing | Express router, path parameters |
| Controllers | Request validation, response formatting | Zod schemas, DTOs |
| Services | Business logic, orchestration | Pure functions, testable |
| Data Access | Database queries, caching | Prisma ORM, Redis client |

**Project Structure:**
\`\`\`
src/
├── routes/           # HTTP route definitions
│   ├── users.ts      # User-related endpoints
│   ├── posts.ts      # Post-related endpoints
│   └── index.ts      # Route aggregation
├── controllers/      # Request/response handling
│   ├── UserController.ts
│   └── PostController.ts
├── services/         # Business logic
│   ├── UserService.ts
│   └── PostService.ts
├── repositories/     # Data access abstraction
│   ├── UserRepository.ts
│   └── PostRepository.ts
├── middleware/       # Auth, logging, error handling
│   ├── auth.ts
│   └── errorHandler.ts
├── db/              # Database configuration
│   └── client.ts
└── index.ts         # Application entry point
\`\`\`

**Structure Rationale:**
- **routes/:** Separates HTTP concerns from business logic
- **controllers/:** Thin layer for validation and formatting
- **services/:** Contains all business logic, independent of HTTP
- **repositories/:** Abstracts database access for testability

**Architectural Patterns:**

**Pattern 1: Layered Architecture**
**What:** Separation of concerns across distinct layers (routes, controllers, services, data)
**When to use:** Most web applications, need for clear boundaries
**Trade-offs:** More boilerplate, but excellent for testing and maintenance

**Example:**
\`\`\`typescript
// Service layer - pure business logic
export class UserService {
  constructor(private userRepo: UserRepository) {}
  
  async getUser(id: string): Promise<UserDTO> {
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundError('User not found');
    return UserDTO.fromEntity(user);
  }
}

// Controller layer - HTTP concerns
export async function getUserHandler(req: Request, res: Response) {
  const { id } = req.params;
  const user = await userService.getUser(id);
  res.json(user);
}
\`\`\`

**Pattern 2: Repository Pattern**
**What:** Abstract data access behind an interface
**When to use:** When you might swap databases or need testability
**Trade-offs:** Extra abstraction layer, but enables clean testing

**Data Flow:**

**Request Flow:**
\`\`\`
[Client Request]
    ↓
[Route Handler] → [Controller] → [Service] → [Repository] → [Database]
    ↓              ↓           ↓            ↓            ↓
[Response] ← [DTO] ← [Entity] ← [Query Result] ← [Data]
\`\`\`

**State Management:**
\`\`\`
[Database]
    ↓ (read)
[Repository Cache] ←→ [Service Layer]
    ↓ (transform)
[DTO] → [Controller] → [HTTP Response]
\`\`\`

**Key Data Flows:**
1. **Create Resource:** Request → Validation → Service → Repository → Database → Created Entity → DTO → Response
2. **Get Resource:** Request → Validation → Service → Repository Cache → Database → Entity → DTO → Response
3. **Update Resource:** Request → Validation → Service → Repository → Database → Updated Entity → DTO → Response

**Scaling Considerations:**
| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Monolith is fine, no caching needed |
| 1k-100k users | Add Redis cache, optimize database queries |
| 100k+ users | Consider microservices, database sharding |

**Scaling Priorities:**
1. **First bottleneck:** Database N+1 queries — fix with eager loading and caching
2. **Second bottleneck:** API response size — implement pagination and partial responses

**Anti-Patterns:**

**Anti-Pattern 1: Fat Controllers**
**What people do:** Put business logic directly in controller functions
**Why it's wrong:** Hard to test, couples HTTP to business logic, can't reuse logic
**Do this instead:** Thin controllers that only call services and format responses

**Anti-Pattern 2: Anemic Domain Model**
**What people do:** Entities are just data containers, no behavior
**Why it's wrong:** Logic scattered across services, harder to reason about
**Do this instead:** Put domain behaviors on entities where appropriate

**Anti-Pattern 3: Direct Database Access in Routes**
**What people do:** Query database directly in route handlers
**Why it's wrong:** No separation of concerns, impossible to test, hard to change database
**Do this instead:** Always go through repository abstraction

**Integration Points:**

**External Services:**
| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Stripe | SDK with client wrapper | Store webhook events for idempotency |
| S3 | SDK with presigned URLs | Use presigned URLs for client uploads |

**Internal Boundaries:**
| Boundary | Communication | Notes |
|----------|---------------|-------|
| Service ↔ Repository | Direct method calls | Keep services synchronous for simplicity |

**Sources:**
- https://docs.microsoft.com/en-us/azure/architecture/patterns/
- https://martinfowler.com/eaaDev/
- https://github.com/goldbergyoni/nodebestpractices
`,
  why: "Layered architecture provides clear boundaries, testability, and maintainability for REST APIs",
  file_refs: [
    "https://docs.microsoft.com/en-us/azure/architecture/patterns/",
    "https://martinfowler.com/eaaDev/"
  ],
  created_by_task: "Research REST API architecture patterns and best practices"
});
```

### Updating Architecture Research Concepts

```typescript
// Update architecture research when patterns evolve
await megamemory.update_concept({
  id: "[architecture-research-concept-id]",
  changes: {
    summary: `
**Domain:** REST API
**Researched:** 2025-02-08
**Confidence:** HIGH

[... existing architecture ...]

**NEW Pattern: Event-Driven Architecture**
**What:** Components communicate via events, not direct calls
**When to use:** Long-running operations, async workflows
**Trade-offs:** More complexity, but enables scalability

**Example:**
\`\`\`typescript
// Event publisher
eventBus.publish('user.created', { userId, email });

// Event subscriber
eventBus.on('user.created', async ({ userId }) => {
  await sendWelcomeEmail(userId);
});
\`\`\`

[... rest of original ...]
`,
    file_refs: [
      "https://docs.microsoft.com/en-us/azure/architecture/patterns/",
      "https://martinfowler.com/eaaDev/",
      "https://www.enterpriseintegrationpatterns.com/"
    ]
  }
});
```

### Querying Architecture Research Concepts

```typescript
// Query architecture research for a domain
const archResults = await megamemory_understand({
  query: "architecture research REST API patterns layers components",
  top_k: 5
});

// Results include concept with full architecture details
// Use archResults[0].summary to get system overview, patterns, data flow
```

### Linking Architecture to Other Concepts

```typescript
// Link architecture research to stack and project concepts
await megamemory.link({
  from: "[architecture-research-concept-id]",
  to: "[stack-research-concept-id]",
  relation: "depends_on",
  description: "Architecture pattern depends on chosen technology stack"
});

await megamemory.link({
  from: "[project-concept-id]",
  to: "[architecture-research-concept-id]",
  relation: "implements",
  description: "Project implements this researched architecture"
});
```

---

## MegaMemory Examples

### Example 1: Complete Architecture Research Flow

```typescript
// Step 1: Query existing architecture research
const existingArch = await megamemory_understand({
  query: "architecture research CLI tools domain",
  top_k: 3
});

if (existingArch.length === 0) {
  // Step 2: Create new architecture research
  const archConcept = await megamemory.create_concept({
    name: "Architecture Research: CLI Tools",
    kind: "pattern",
    summary: `
**Domain:** CLI Tools
**Researched:** 2025-02-08
**Confidence:** HIGH

**System Overview:**
\`\`\`
┌─────────────────────────────────────────────────────────────┐
│                    Command Line Interface                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                      │
│  │ Command │  │ Command │  │ Command │  CLI Entrypoints   │
│  │ init    │  │ build   │  │ deploy  │                      │
│  └────┬────┘  └────┬────┘  └────┬────┘                      │
│       │            │            │                          │
├───────┴────────────┴────────────┴──────────────────────────┤
│                    Command Handlers                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Argument Parsing & Validation            │  │
│  └─────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    Services Layer                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ Project  │  │ Build    │  │ Deploy   │                   │
│  │ Service  │  │ Service  │  │ Service  │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
├─────────────────────────────────────────────────────────────┤
│                    Core / Utils                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ File I/O │  │ HTTP     │  │ Logging  │                   │
│  │ Helpers  │  │ Helpers  │  │ Helpers  │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
└─────────────────────────────────────────────────────────────┘
\`\`\`

**Component Responsibilities:**
| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Commands | CLI entry points, argument definitions | Commander.js subcommands |
| Handlers | Input validation, error handling | Zod schemas, error messages |
| Services | Business logic, file operations | Pure functions, async/await |
| Core/Utils | Reusable utilities, I/O wrappers | fs-extra, axios, ora |

**Project Structure:**
\`\`\`
src/
├── commands/         # CLI command entry points
│   ├── init.ts       # init command
│   ├── build.ts      # build command
│   ├── deploy.ts     # deploy command
│   └── index.ts      # command registration
├── handlers/         # Input validation and handling
│   ├── initHandler.ts
│   └── buildHandler.ts
├── services/         # Business logic
│   ├── ProjectService.ts
│   ├── BuildService.ts
│   └── DeployService.ts
├── core/             # Core utilities
│   ├── file.ts       # File I/O helpers
│   ├── http.ts       # HTTP helpers
│   └── logger.ts     # Logging utilities
└── index.ts          # CLI entry point
\`\`\`

**Structure Rationale:**
- **commands/:** Thin layer for CLI concerns only
- **handlers/:** Input validation and user-facing errors
- **services/:** Contains all business logic, testable
- **core/:** Shared utilities, pure functions

**Architectural Patterns:**

**Pattern 1: Command Pattern**
**What:** Each CLI command is a separate module with handler
**When to use:** CLI tools with multiple commands
**Trade-offs:** More files, but excellent separation

**Example:**
\`\`\`typescript
// commands/build.ts
import { Command } from 'commander';
import { buildHandler } from '../handlers/buildHandler';

export const buildCommand = new Command('build')
  .description('Build the project')
  .option('-w, --watch', 'Watch mode')
  .action(buildHandler);

// handlers/buildHandler.ts
export async function buildHandler(options: { watch?: boolean }) {
  const buildService = new BuildService();
  await buildService.build({ watch: options.watch });
}
\`\`\`

**Pattern 2: Service Layer**
**What:** Business logic separated from CLI concerns
**When to use:** Complex operations that need to be tested
**Trade-offs:** Extra abstraction, but enables unit testing

**Data Flow:**

**Command Flow:**
\`\`\`
[User Command]
    ↓
[Command Parser] → [Handler] → [Service] → [Core Utils] → [File System]
    ↓              ↓           ↓            ↓              ↓
[Output/Exit] ← [Result] ← [Response] ← [Data] ← [Files]
\`\`\`

**Scaling Considerations:**
| Scale | Architecture Adjustments |
|-------|--------------------------|
| Simple CLI (1-3 commands) | Single-file architecture is fine |
| Medium CLI (4-10 commands) | Command pattern + service layer |
| Large CLI (10+ commands) | Add plugin system, command discovery |

**Anti-Patterns:**

**Anti-Pattern 1: Everything in main.ts**
**What people do:** Put all logic in a single main entry point
**Why it's wrong:** Unmaintainable, untestable, no separation
**Do this instead:** Split commands into separate modules

**Anti-Pattern 2: CLI Logic in Services**
**What people do:** Services call ora, chalk, or inquirer directly
**Why it's wrong:** Couples business logic to CLI, hard to test
**Do this instead:** Return results from services, handle output in handlers

**Integration Points:**
| Integration | Pattern | Notes |
|-------------|---------|-------|
| File system | fs-wrapper | Use fs-extra for convenience |
| HTTP APIs | Axios wrapper | Handle timeouts and retries |

**Sources:**
- https://github.com/tj/commander.js
- https://cli-guidelines.io/
- https://github.com/SBoudrias/Inquirer.js
`,
    why: "Command pattern with service layer provides separation, testability for CLI tools",
    file_refs: [
      "https://github.com/tj/commander.js",
      "https://cli-guidelines.io/"
    ],
    created_by_task: "Research CLI tool architecture patterns"
  });

  // Step 3: Link to stack
  await megamemory.link({
    from: archConcept.id,
    to: "[stack-research-concept-id]",
    relation: "depends_on",
    description: "CLI architecture depends on Commander.js and supporting libraries"
  });
}

// Step 4: Use architecture research in planning
const archInfo = existingArch[0] || archConcept;
console.log("Recommended project structure:", archInfo.summary);
```

### Example 2: Extracting Architecture Patterns

```typescript
// When agent needs architecture guidance

async function getArchitectureForDomain(domain: string) {
  const results = await megamemory_understand({
    query: `architecture research ${domain}`,
    top_k: 1
  });
  
  if (results.length === 0) {
    console.log(`No architecture research found for domain: ${domain}`);
    return null;
  }
  
  const arch = results[0];
  
  // Parse summary to extract architecture components
  const summaryLines = arch.summary.split('\n');
  
  return {
    domain,
    systemOverview: extractSection(summaryLines, 'System Overview'),
    components: extractComponentTable(summaryLines),
    projectStructure: extractCodeBlock(summaryLines, 'Project Structure'),
    patterns: extractPatterns(summaryLines),
    dataFlow: extractDataFlow(summaryLines),
    antiPatterns: extractAntiPatterns(summaryLines)
  };
}

// Agent uses to inform implementation
const apiArch = await getArchitectureForDomain('REST API');
if (apiArch) {
  console.log('Creating folders:', apiArch.projectStructure);
}
```

---

## Original Template Reference

<template>

```markdown
# Architecture Research

**Domain:** [domain type]
**Researched:** [date]
**Confidence:** [HIGH/MEDIUM/LOW]

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        [Layer Name]                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ [Comp]  │  │ [Comp]  │  │ [Comp]  │  │ [Comp]  │        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
│       │            │            │            │              │
├───────┴────────────┴────────────┴────────────┴──────────────┤
│                        [Layer Name]                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    [Component]                       │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│                        [Layer Name]                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ [Store]  │  │ [Store]  │  │ [Store]  │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| [name] | [what it owns] | [how it's usually built] |
| [name] | [what it owns] | [how it's usually built] |
| [name] | [what it owns] | [how it's usually built] |

## Recommended Project Structure

```
src/
├── [folder]/           # [purpose]
│   ├── [subfolder]/    # [purpose]
│   └── [file].ts       # [purpose]
├── [folder]/           # [purpose]
│   ├── [subfolder]/    # [purpose]
│   └── [file].ts       # [purpose]
├── [folder]/           # [purpose]
└── [folder]/           # [purpose]
```

### Structure Rationale

- **[folder]/:** [why organized this way]
- **[folder]/:** [why organized this way]

## Architectural Patterns

### Pattern 1: [Pattern Name]

**What:** [description]
**When to use:** [conditions]
**Trade-offs:** [pros and cons]

**Example:**
```typescript
// [Brief code example showing the pattern]
```

### Pattern 2: [Pattern Name]

**What:** [description]
**When to use:** [conditions]
**Trade-offs:** [pros and cons]

**Example:**
```typescript
// [Brief code example showing the pattern]
```

### Pattern 3: [Pattern Name]

**What:** [description]
**When to use:** [conditions]
**Trade-offs:** [pros and cons]

## Data Flow

### Request Flow

```
[User Action]
    ↓
[Component] → [Handler] → [Service] → [Data Store]
    ↓              ↓           ↓            ↓
[Response] ← [Transform] ← [Query] ← [Database]
```

### State Management

```
[State Store]
    ↓ (subscribe)
[Components] ←→ [Actions] → [Reducers/Mutations] → [State Store]
```

### Key Data Flows

1. **[Flow name]:** [description of how data moves]
2. **[Flow name]:** [description of how data moves]

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | [approach — usually monolith is fine] |
| 1k-100k users | [approach — what to optimize first] |
| 100k+ users | [approach — when to consider splitting] |

### Scaling Priorities

1. **First bottleneck:** [what breaks first, how to fix]
2. **Second bottleneck:** [what breaks next, how to fix]

## Anti-Patterns

### Anti-Pattern 1: [Name]

**What people do:** [the mistake]
**Why it's wrong:** [the problem it causes]
**Do this instead:** [the correct approach]

### Anti-Pattern 2: [Name]

**What people do:** [the mistake]
**Why it's wrong:** [the problem it causes]
**Do this instead:** [the correct approach]

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| [service] | [how to connect] | [gotchas] |
| [service] | [how to connect] | [gotchas] |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| [module A ↔ module B] | [API/events/direct] | [considerations] |

## Sources

- [Architecture references]
- [Official documentation]
- [Case studies]

---
*Architecture research for: [domain]*
*Researched: [date]*
```

</template>

---

## Guidelines

<guidelines>

**System Overview:**
- Use ASCII diagrams for clarity
- Show major components and their relationships
- Don't over-detail — this is conceptual, not implementation

**Project Structure:**
- Be specific about folder organization
- Explain the rationale for grouping
- Match conventions of the chosen stack

**Patterns:**
- Include code examples where helpful
- Explain trade-offs honestly
- Note when patterns are overkill for small projects

**Scaling Considerations:**
- Be realistic — most projects don't need to scale to millions
- Focus on "what breaks first" not theoretical limits
- Avoid premature optimization recommendations

**Anti-Patterns:**
- Specific to this domain
- Include what to do instead
- Helps prevent common mistakes during implementation

</guidelines>
