# Technology Stack Template (MegaMemory-Backed)

Template for codebase STACK documentation - captures the technology foundation.

**Purpose:** Document what technologies run this codebase. Focused on "what executes when you run the code."

---

## MegaMemory Schema

```typescript
// Concept: technology-stack
interface TechnologyStackConcept {
  name: string;
  kind: "component";
  summary: string;
  why: string;
  file_refs: string[];
  edges: {
    to: string;
    relation: "depends_on" | "configured_by" | "connects_to";
    description: string;
  }[];
}
```

### Schema Structure

A technology stack in MegaMemory stores:
- **name**: "Technology Stack"
- **kind**: "component"
- **summary**: Detailed description including:
  - Languages and versions (primary/secondary)
  - Runtime environment and package manager
  - Frameworks (core, testing, build/dev)
  - Key dependencies (critical and infrastructure)
  - Configuration approach
  - Platform requirements (dev/production)
- **why**: Rationale for technology choices
- **file_refs**: Relevant files (package.json, tsconfig.json, etc.)
- **edges**: Relationships to other stack components

---

## MegaMemory Operations

### Create Technology Stack

```typescript
import { megamemory_create_concept } from './mcp-client';

const stackConcept = await megamemory_create_concept({
  name: "Technology Stack",
  kind: "component",
  summary: `
Primary: TypeScript 5.3 for all application code
Runtime: Node.js 20.x (LTS)
Package Manager: npm 10.x, package-lock.json present
Frameworks: Vitest 1.0 for testing, TypeScript 5.3 for compilation
Dependencies: commander 11.x (CLI), chalk 5.x (styling), fs-extra 11.x (file ops)
Config: tsconfig.json, vitest.config.ts
Platform: Any platform with Node.js, distributed as npm package
`,
  why: "Vanilla Node.js CLI with minimal dependencies, focuses on core functionality",
  file_refs: [
    "package.json",
    "tsconfig.json",
    "vitest.config.ts"
  ]
});
```

### Update Technology Stack

```typescript
import { megamemory_update_concept } from './mcp-client';

await megamemory_update_concept({
  id: "technology-stack-concept-id",
  changes: {
    summary: `
Primary: TypeScript 5.4 for all application code (upgraded from 5.3)
Runtime: Node.js 22.x (LTS) (upgraded from 20.x)
Package Manager: npm 11.x, package-lock.json present
Frameworks: Vitest 2.0 for testing (upgraded)
Dependencies: commander 12.x, chalk 6.x, fs-extra 12.x
Config: tsconfig.json, vitest.config.ts
Platform: Any platform with Node.js 22+
`
  }
});
```

### Query Technology Stack

```typescript
import { megamemory_understand } from './mcp-client';

const results = await megamemory_understand({
  query: "What is the technology stack and which languages are used?",
  top_k: 10
});

// Results will include the Technology Stack concept with all details
```

---

## MegaMemory Examples

### Example 1: TypeScript CLI Tool Stack

```typescript
const cliToolStack = await megamemory_create_concept({
  name: "Technology Stack",
  kind: "component",
  summary: `
Primary: TypeScript 5.3 - All application code
Secondary: JavaScript - Build scripts, config files
Runtime: Node.js 20.x (LTS), No browser runtime (CLI tool only)
Package Manager: npm 10.x, Lockfile: package-lock.json present
Frameworks:
  - Core: None (vanilla Node.js CLI)
  - Testing: Vitest 1.0 for unit tests, tsx for TypeScript execution
  - Build/Dev: TypeScript 5.3 for compilation, esbuild for fast transforms
Key Dependencies:
  - Critical: commander 11.x (CLI argument parsing), chalk 5.x (terminal styling), fs-extra 11.x (file operations)
  - Infrastructure: Node.js built-ins (fs, path, child_process)
Configuration:
  - Environment: No environment variables required, CLI flags only
  - Build: tsconfig.json, vitest.config.ts
Platform Requirements:
  - Development: macOS/Linux/Windows (any platform with Node.js), No external dependencies
  - Production: Distributed as npm package, Installed globally via npm install -g, Runs on user's Node.js installation
`,
  why: "Minimal dependencies for fast installation, vanilla Node.js for maximum compatibility",
  file_refs: [
    "package.json:1-100",
    "tsconfig.json",
    "vitest.config.ts"
  ]
});
```

### Example 2: Full-Stack Web Application Stack

```typescript
const webAppStack = await megamemory_create_concept({
  name: "Technology Stack",
  kind: "component",
  summary: `
Primary: TypeScript 5.3 for application code
Secondary: CSS for styling, SQL for database queries
Runtime: Node.js 20.x on server, Browser on client
Package Manager: npm 10.x, Lockfile: package-lock.json present
Frameworks:
  - Core: Next.js 14 (App Router), React 18
  - Testing: Jest 29 for unit tests, Playwright for E2E
  - Build/Dev: TypeScript, Tailwind CSS, PostCSS
Key Dependencies:
  - Critical: Prisma 5.8 (ORM), @supabase/supabase-js 2.x (auth/client), openai 4.x (AI)
  - Infrastructure: stripe 14.8 (payments), @sendgrid/mail 8.1 (email)
Configuration:
  - Environment: .env.local files, DATABASE_URL, API keys
  - Build: next.config.js, tsconfig.json, tailwind.config.ts
Platform Requirements:
  - Development: Node.js 20+, PostgreSQL 15+, Supabase project
  - Production: Vercel hosting, Supabase database + auth + storage
`,
  why: "Full-stack Next.js with Supabase for rapid development, modern DX",
  file_refs: [
    "package.json",
    "next.config.js",
    "tsconfig.json",
    "prisma/schema.prisma"
  ],
  edges: [
    {
      to: "database-concept-id",
      relation: "depends_on",
      description: "Application depends on PostgreSQL database via Prisma"
    },
    {
      to: "authentication-concept-id",
      relation: "connects_to",
      description: "Application uses Supabase Auth for user authentication"
    }
  ]
});
```

---

## File Template

```markdown
# Technology Stack

**Analysis Date:** [YYYY-MM-DD]

**MegaMemory Concept:** Technology Stack (stored in knowledge graph, not this file)

## Languages

**Primary:**
- [Language] [Version] - [Where used: e.g., "all application code"]

**Secondary:**
- [Language] [Version] - [Where used: e.g., "build scripts, tooling"]

## Runtime

**Environment:**
- [Runtime] [Version] - [e.g., "Node.js 20.x"]
- [Additional requirements if any]

**Package Manager:**
- [Manager] [Version] - [e.g., "npm 10.x"]
- Lockfile: [e.g., "package-lock.json present"]

## Frameworks

**Core:**
- [Framework] [Version] - [Purpose: e.g., "web server", "UI framework"]

**Testing:**
- [Framework] [Version] - [e.g., "Jest for unit tests"]
- [Framework] [Version] - [e.g., "Playwright for E2E"]

**Build/Dev:**
- [Tool] [Version] - [e.g., "Vite for bundling"]
- [Tool] [Version] - [e.g., "TypeScript compiler"]

## Key Dependencies

[Only include dependencies critical to understanding the stack - limit to 5-10 most important]

**Critical:**
- [Package] [Version] - [Why it matters: e.g., "authentication", "database access"]
- [Package] [Version] - [Why it matters]

**Infrastructure:**
- [Package] [Version] - [e.g., "Express for HTTP routing"]
- [Package] [Version] - [e.g., "PostgreSQL client"]

## Configuration

**Environment:**
- [How configured: e.g., ".env files", "environment variables"]
- [Key configs: e.g., "DATABASE_URL, API_KEY required"]

**Build:**
- [Build config files: e.g., "vite.config.ts, tsconfig.json"]

## Platform Requirements

**Development:**
- [OS requirements or "any platform"]
- [Additional tooling: e.g., "Docker for local DB"]

**Production:**
- [Deployment target: e.g., "Vercel", "AWS Lambda", "Docker container"]
- [Version requirements]

---

*Stack analysis: [date]*
*Update after major dependency changes*
```

<good_examples>
```markdown
# Technology Stack

**Analysis Date:** 2025-01-20

**MegaMemory Concept:** Technology Stack (stored in knowledge graph, not this file)

## Languages

**Primary:**
- TypeScript 5.3 - All application code

**Secondary:**
- JavaScript - Build scripts, config files

## Runtime

**Environment:**
- Node.js 20.x (LTS)
- No browser runtime (CLI tool only)

**Package Manager:**
- npm 10.x
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- None (vanilla Node.js CLI)

**Testing:**
- Vitest 1.0 - Unit tests
- tsx - TypeScript execution without build step

**Build/Dev:**
- TypeScript 5.3 - Compilation to JavaScript
- esbuild - Used by Vitest for fast transforms

## Key Dependencies

**Critical:**
- commander 11.x - CLI argument parsing and command structure
- chalk 5.x - Terminal output styling
- fs-extra 11.x - Extended file system operations

**Infrastructure:**
- Node.js built-ins - fs, path, child_process for file operations

## Configuration

**Environment:**
- No environment variables required
- Configuration via CLI flags only

**Build:**
- `tsconfig.json` - TypeScript compiler options
- `vitest.config.ts` - Test runner configuration

## Platform Requirements

**Development:**
- macOS/Linux/Windows (any platform with Node.js)
- No external dependencies

**Production:**
- Distributed as npm package
- Installed globally via npm install -g
- Runs on user's Node.js installation

---

*Stack analysis: 2025-01-20*
*Update after major dependency changes*
```
</good_examples>

<guidelines>
**What belongs in STACK.md:**
- Languages and versions
- Runtime requirements (Node, Bun, Deno, browser)
- Package manager and lockfile
- Framework choices
- Critical dependencies (limit to 5-10 most important)
- Build tooling
- Platform/deployment requirements

**What does NOT belong here:**
- File structure (that's STRUCTURE.md)
- Architectural patterns (that's ARCHITECTURE.md)
- Every dependency in package.json (only critical ones)
- Implementation details (defer to code)

**When filling this template:**
- Check package.json for dependencies
- Note runtime version from .nvmrc or package.json engines
- Include only dependencies that affect understanding (not every utility)
- Specify versions only when version matters (breaking changes, compatibility)

**MegaMemory Usage:**
This template is for @-reference only. When agents need to understand or update the technology stack, they should:
1. Query MegaMemory: `megamemory_understand({ query: "technology stack" })`
2. Create/update stack: `megamemory_create_concept()` or `megamemory_update_concept()`
3. Store in MegaMemory, not in this file

**Useful for phase planning when:**
- Adding new dependencies (check compatibility)
- Upgrading frameworks (know what's in use)
- Choosing implementation approach (must work with existing stack)
- Understanding build requirements
</guidelines>
