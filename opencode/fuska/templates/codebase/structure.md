# Structure Template (MegaMemory-Backed)

Template for codebase STRUCTURE documentation - captures physical file organization.

**Purpose:** Document where things physically live in the codebase. Answers "where do I put X?"

---

## MegaMemory Schema

```typescript
// Concept: codebase-arch (structure section)
interface StructureConcept {
  name: string;
  kind: "component";
  summary: string;
  why: string;
  file_refs: string[];
  edges: {
    to: string;
    relation: "contains" | "connects_to" | "depends_on";
    description: string;
  }[];
}
```

### Schema Structure

A codebase structure concept in MegaMemory stores:
- **name**: "Codebase Structure" or specific directory structure name
- **kind**: "component"
- **summary**: Detailed description including:
  - Directory layout (ASCII tree with purposes)
  - Directory purposes (what lives in each)
  - Key file locations (entry points, configuration, core logic, testing, docs)
  - Naming conventions (files, directories, special patterns)
  - Where to add new code (by type)
  - Special directories (generated, build output, etc.)
- **why**: Rationale for structure choices
- **file_refs**: Key files that define structure
- **edges**: Relationships between directories and components

---

## MegaMemory Operations

### Create Structure Concept

```typescript
import { megamemory_create_concept } from './mcp-client';

const structureConcept = await megamemory_create_concept({
  name: "Codebase Structure",
  kind: "component",
  summary: `
Directory Layout:
get-shit-done/
├── bin/                # Executable entry points
├── commands/           # Slash command definitions
│   └── fuska/         # Fuska-specific commands
├── get-shit-done/     # Skill resources
│   ├── references/    # Principle documents
│   ├── templates/     # File templates (including codebase templates)
│   └── workflows/     # Multi-step procedures
├── src/               # Source code (if applicable)
├── tests/             # Test files
├── package.json       # Project manifest
└── README.md          # User documentation

Directory Purposes:
bin/: CLI entry points, install.js
commands/fuska/: Slash command definitions for OpenCode
get-shit-done/references/: Core philosophy and guidance
get-shit-done/templates/: Document templates for project knowledge
get-shit-done/workflows/: Reusable multi-step procedures

Key File Locations:
Entry Points: bin/install.js
Configuration: package.json, .gitignore
Core Logic: bin/install.js (all installation logic)
Testing: tests/
Documentation: README.md, CLAUDE.md

Naming Conventions:
Files: kebab-case.md, kebab-case.js, UPPERCASE.md
Directories: kebab-case, plural for collections
Special: {command-name}.md for commands, *-template.md for templates

Where to Add New Code:
Slash Command: commands/fuska/{command-name}.md
Template: get-shit-done/templates/{name}.md
Workflow: get-shit-done/workflows/{name}.md
Reference: get-shit-done/references/{name}.md

Special Directories:
get-shit-done/: Resources installed to ~/.config/opencode/
commands/: Slash commands installed to ~/.config/opencode/commands/
`,
  why: "Flat structure with clear separation of concerns, easy navigation",
  file_refs: [
    "package.json",
    "bin/install.js",
    "README.md"
  ]
});
```

### Create Directory Concept

```typescript
const commandsDirConcept = await megamemory_create_concept({
  name: "Commands Directory",
  kind: "component",
  parent_id: "structure-concept-id",
  summary: `
Purpose: Slash command definitions for OpenCode
Contains: *.md files (one per command)
Location: commands/fuska/
Key files: new-project.md, plan-phase.md, execute-plan.md
Structure: Flat (no subdirectories)
`,
  why: "Centralized command definitions for easy discovery",
  file_refs: [
    "commands/fuska/new-project.md",
    "commands/fuska/plan-phase.md"
  ],
  edges: [
    {
      to: "templates-directory-concept-id",
      relation: "connects_to",
      description: "Commands reference templates for file generation"
    }
  ]
});
```

### Update Structure

```typescript
import { megamemory_update_concept } from './mcp-client';

await megamemory_update_concept({
  id: "structure-concept-id",
  changes: {
    summary: `
Directory Layout:
get-shit-done/
├── bin/                # Executable entry points
├── commands/           # Slash command definitions
│   └── fuska/           # Fuska-specific commands
├── get-shit-done/     # Skill resources
│   ├── references/    # Principle documents
│   ├── templates/     # File templates
│   ├── workflows/     # Multi-step procedures
│   └── codebase/      # Codebase analysis templates (NEW)
├── src/               # Source code (if applicable)
├── tests/             # Test files
├── package.json       # Project manifest
└── README.md          # User documentation
...rest of summary
`
  }
});
```

### Query Structure

```typescript
import { megamemory_understand } from './mcp-client';

const results = await megamemory_understand({
  query: "Where should I add a new slash command?",
  top_k: 10
});

// Returns structure information about command placement
```

---

## MegaMemory Examples

### Example 1: CLI Tool Structure

```typescript
const cliStructure = await megamemory_create_concept({
  name: "Codebase Structure",
  kind: "component",
  summary: `
Directory Layout:
\`\`\`
get-shit-done/
├── bin/                # Executable entry points
├── commands/           # Slash command definitions
│   └── fuska/         # Fuska-specific commands
├── get-shit-done/     # Skill resources
│   ├── references/    # Principle documents
│   ├── templates/     # File templates
│   └── workflows/     # Multi-step procedures
├── src/               # Source code (if applicable)
├── tests/             # Test files
├── package.json       # Project manifest
└── README.md          # User documentation
\`\`\`

Directory Purposes:
bin/:
  - Purpose: CLI entry points
  - Contains: install.js (installer script)
  - Key files: install.js - handles npx installation
  - Subdirectories: None

commands/fuska/:
  - Purpose: Slash command definitions for OpenCode
  - Contains: *.md files (one per command)
  - Key files: new-project.md, plan-phase.md, execute-plan.md
  - Subdirectories: None (flat structure)

get-shit-done/references/:
  - Purpose: Core philosophy and guidance documents
  - Contains: principles.md, questioning.md, plan-format.md
  - Key files: principles.md - system philosophy
  - Subdirectories: None

get-shit-done/templates/:
  - Purpose: Document templates for project knowledge
  - Contains: Template definitions with frontmatter
  - Key files: project.md, roadmap.md, plan.md, summary.md
  - Subdirectories: codebase/ (stack/architecture/structure/integrations/conventions/testing)

get-shit-done/workflows/:
  - Purpose: Reusable multi-step procedures
  - Contains: Workflow definitions called by commands
  - Key files: execute-plan.md, research-phase.md
  - Subdirectories: None

Key File Locations:
Entry Points:
  - bin/install.js - Installation script (npx entry)

Configuration:
  - package.json - Project metadata, dependencies, bin entry
  - .gitignore - Excluded files

Core Logic:
  - bin/install.js - All installation logic (file copying, path replacement)

Testing:
  - tests/ - Test files (if present)

Documentation:
  - README.md - User-facing installation and usage guide
  - CLAUDE.md - Instructions for OpenCode when working in this repo

Naming Conventions:
Files:
  - kebab-case.md: Markdown documents
  - kebab-case.js: JavaScript source files
  - UPPERCASE.md: Important project files (README, CLAUDE, CHANGELOG)

Directories:
  - kebab-case: All directories
  - Plural for collections: templates/, commands/, workflows/

Special Patterns:
  - {command-name}.md: Slash command definition
  - *-template.md: Could be used but templates/ directory preferred

Where to Add New Code:
New Slash Command:
  - Primary code: commands/fuska/{command-name}.md
  - Tests: tests/commands/{command-name}.test.js (if testing implemented)
  - Documentation: Update README.md with new command

New Template:
  - Implementation: get-shit-done/templates/{name}.md
  - Documentation: Template is self-documenting (includes guidelines)

New Workflow:
  - Implementation: get-shit-done/workflows/{name}.md
  - Usage: Reference from command with @~/.config/opencode/get-shit-done/workflows/{name}.md

New Reference Document:
  - Implementation: get-shit-done/references/{name}.md
  - Usage: Reference from commands/workflows as needed

Utilities:
  - No utilities yet (install.js is monolithic)
  - If extracted: src/utils/

Special Directories:
get-shit-done/:
  - Purpose: Resources installed to ~/.config/opencode/
  - Source: Copied by bin/install.js during installation
  - Committed: Yes (source of truth)

commands/:
  - Purpose: Slash commands installed to ~/.config/opencode/commands/
  - Source: Copied by bin/install.js during installation
  - Committed: Yes (source of truth)
`,
  why: "Flat structure with clear separation of concerns, easy navigation",
  file_refs: [
    "package.json:1-50",
    "bin/install.js",
    "README.md",
    "CLAUDE.md"
  ]
});
```

### Example 2: Next.js Application Structure

```typescript
const nextjsStructure = await megamemory_create_concept({
  name: "Codebase Structure",
  kind: "component",
  summary: `
Directory Layout:
\`\`\`
nextjs-app/
├── app/                    # Next.js 14 App Router
│   ├── (auth)/            # Auth group (login, signup)
│   ├── (dashboard)/       # Dashboard group (protected routes)
│   ├── api/               # API routes
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Landing page
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   ├── forms/            # Form components
│   └── features/         # Feature-specific components
├── lib/                   # Utility libraries
│   ├── db/               # Database utilities
│   ├── services/         # Business logic
│   └── utils/            # Helper functions
├── prisma/               # Database schema
│   ├── schema.prisma     # Prisma schema
│   └── migrations/       # Database migrations
├── public/               # Static assets
├── tests/                # Test files
├── package.json          # Dependencies
└── next.config.js        # Next.js configuration
\`\`\`

Directory Purposes:
app/:
  - Purpose: Next.js 14 App Router pages and layouts
  - Contains: *.tsx pages, *.ts API routes, layout.tsx files
  - Key files: layout.tsx (root), (dashboard)/layout.tsx (auth wrapper)
  - Structure: Route groups in () directories, API routes in api/

components/:
  - Purpose: Reusable React components
  - Contains: UI components, form components, feature components
  - Key files: components/ui/Button.tsx, components/forms/SignupForm.tsx
  - Structure: Organized by type (ui, forms, features)

lib/:
  - Purpose: Utility libraries and business logic
  - Contains: Database helpers, services, utilities
  - Key files: lib/db/prisma.ts, lib/services/courses.ts, lib/utils/cn.ts
  - Structure: Organized by function (db, services, utils)

prisma/:
  - Purpose: Database schema and migrations
  - Contains: schema.prisma, migration SQL files
  - Key files: prisma/schema.prisma (data model)
  - Structure: migrations/ for versioned database changes

Key File Locations:
Entry Points:
  - app/layout.tsx - Root layout with providers
  - app/page.tsx - Landing page
  - bin/install.js - Installation script (npx entry)

Configuration:
  - package.json - Project metadata, dependencies, scripts
  - next.config.js - Next.js configuration
  - tsconfig.json - TypeScript configuration
  - .env.local - Environment variables (gitignored)

Core Logic:
  - lib/services/*.ts - Business logic
  - lib/db/prisma.ts - Database client
  - app/api/**/*.ts - API route handlers

Testing:
  - tests/unit/ - Unit tests
  - tests/integration/ - Integration tests
  - tests/e2e/ - E2E tests with Playwright

Documentation:
  - README.md - User-facing documentation
  - docs/ - Additional documentation (if present)

Naming Conventions:
Files:
  - kebab-case.ts: TypeScript files
  - PascalCase.tsx: React components
  - *.test.ts: Test files (collocated with source)
  - *.e2e.ts: E2E test files (in tests/e2e/)

Directories:
  - kebab-case: All directories
  - () in route groups: (auth), (dashboard)
  - Plural for collections: components/, services/, utils/

Special Patterns:
  - layout.tsx: Layout file for route segment
  - page.tsx: Page component for route
  - loading.tsx: Loading state for route
  - error.tsx: Error boundary for route

Where to Add New Code:
New Page:
  - Implementation: app/{route}/page.tsx
  - Layout: app/{route}/layout.tsx (if needed)
  - Tests: tests/unit/app/{route}.test.ts

New API Route:
  - Implementation: app/api/{endpoint}/route.ts
  - Tests: tests/integration/api/{endpoint}.test.ts

New Component:
  - Implementation: components/{category}/{ComponentName}.tsx
  - Tests: tests/unit/components/{category}/{ComponentName}.test.ts

New Service:
  - Implementation: lib/services/{service-name}.ts
  - Tests: tests/unit/lib/services/{service-name}.test.ts

Utilities:
  - Shared helpers: lib/utils/{helper-name}.ts
  - Type definitions: lib/types/{entity-name}.ts

Special Directories:
public/:
  - Purpose: Static assets served from root
  - Contents: images/, fonts/, favicon.ico
  - Committed: Yes

.prisma/ (in node_modules):
  - Purpose: Generated Prisma client
  - Source: Generated by npx prisma generate
  - Committed: No (in .gitignore)

.next/ (in node_modules):
  - Purpose: Next.js build output
  - Source: Generated by next build
  - Committed: No (in .gitignore)
`,
  why: "Next.js 14 App Router convention with clear separation of concerns",
  file_refs: [
    "package.json",
    "next.config.js",
    "app/layout.tsx",
    "prisma/schema.prisma"
  ],
  edges: [
    {
      to: "database-concept-id",
      relation: "depends_on",
      description: "Application structure organized around Prisma schema"
    }
  ]
});
```

---

## File Template

```markdown
# Codebase Structure

**Analysis Date:** [YYYY-MM-DD]

**MegaMemory Concept:** Codebase Structure (stored in knowledge graph, not this file)

## Directory Layout

[ASCII tree of top-level directories with purpose]

```
[project-root]/
├── [dir]/          # [Purpose]
├── [dir]/          # [Purpose]
├── [dir]/          # [Purpose]
└── [file]          # [Purpose]
```

## Directory Purposes

**[Directory Name]:**
- Purpose: [What lives here]
- Contains: [Types of files: e.g., "*.ts source files", "component directories"]
- Key files: [Important files in this directory]
- Subdirectories: [If nested, describe structure]

**[Directory Name]:**
- Purpose: [What lives here]
- Contains: [Types of files]
- Key files: [Important files]
- Subdirectories: [Structure]

## Key File Locations

**Entry Points:**
- [Path]: [Purpose: e.g., "CLI entry point"]
- [Path]: [Purpose: e.g., "Server startup"]

**Configuration:**
- [Path]: [Purpose: e.g., "TypeScript config"]
- [Path]: [Purpose: e.g., "Build configuration"]
- [Path]: [Purpose: e.g., "Environment variables"]

**Core Logic:**
- [Path]: [Purpose: e.g., "Business services"]
- [Path]: [Purpose: e.g., "Database models"]
- [Path]: [Purpose: e.g., "API routes"]

**Testing:**
- [Path]: [Purpose: e.g., "Unit tests"]
- [Path]: [Purpose: e.g., "Test fixtures"]

**Documentation:**
- [Path]: [Purpose: e.g., "User-facing docs"]
- [Path]: [Purpose: e.g., "Developer guide"]

## Naming Conventions

**Files:**
- [Pattern]: [Example: e.g., "kebab-case.ts for modules"]
- [Pattern]: [Example: e.g., "PascalCase.tsx for React components"]
- [Pattern]: [Example: e.g., "*.test.ts for test files"]

**Directories:**
- [Pattern]: [Example: e.g., "kebab-case for feature directories"]
- [Pattern]: [Example: e.g., "plural names for collections"]

**Special Patterns:**
- [Pattern]: [Example: e.g., "index.ts for directory exports"]
- [Pattern]: [Example: e.g., "__tests__ for test directories"]

## Where to Add New Code

**New Feature:**
- Primary code: [Directory path]
- Tests: [Directory path]
- Config if needed: [Directory path]

**New Component/Module:**
- Implementation: [Directory path]
- Types: [Directory path]
- Tests: [Directory path]

**New Route/Command:**
- Definition: [Directory path]
- Handler: [Directory path]
- Tests: [Directory path]

**Utilities:**
- Shared helpers: [Directory path]
- Type definitions: [Directory path]

## Special Directories

[Any directories with special meaning or generation]

**[Directory]:**
- Purpose: [e.g., "Generated code", "Build output"]
- Source: [e.g., "Auto-generated by X", "Build artifacts"]
- Committed: [Yes/No - in .gitignore?]

---

*Structure analysis: [date]*
*Update when directory structure changes*
```

<good_examples>
```markdown
# Codebase Structure

**Analysis Date:** 2025-01-20

**MegaMemory Concept:** Codebase Structure (stored in knowledge graph, not this file)

## Directory Layout

```
get-shit-done/
├── bin/                # Executable entry points
├── commands/           # Slash command definitions
│   └── fuska/           # Fuska-specific commands
├── get-shit-done/     # Skill resources
│   ├── references/    # Principle documents
│   ├── templates/     # File templates
│   └── workflows/     # Multi-step procedures
├── src/               # Source code (if applicable)
├── tests/             # Test files
├── package.json       # Project manifest
└── README.md          # User documentation
```

## Directory Purposes

**bin/**
- Purpose: CLI entry points
- Contains: install.js (installer script)
- Key files: install.js - handles npx installation
- Subdirectories: None

**commands/fuska/**
- Purpose: Slash command definitions for OpenCode
- Contains: *.md files (one per command)
- Key files: new-project.md, plan-phase.md, execute-plan.md
- Subdirectories: None (flat structure)

**get-shit-done/references/**
- Purpose: Core philosophy and guidance documents
- Contains: principles.md, questioning.md, plan-format.md
- Key files: principles.md - system philosophy
- Subdirectories: None

**get-shit-done/templates/**
- Purpose: Document templates for project knowledge
- Contains: Template definitions with frontmatter
- Key files: project.md, roadmap.md, plan.md, summary.md
- Subdirectories: codebase/ (stack/architecture/structure/integrations/conventions/testing)

**get-shit-done/workflows/**
- Purpose: Reusable multi-step procedures
- Contains: Workflow definitions called by commands
- Key files: execute-plan.md, research-phase.md
- Subdirectories: None

## Key File Locations

**Entry Points:**
- `bin/install.js` - Installation script (npx entry)

**Configuration:**
- `package.json` - Project metadata, dependencies, bin entry
- `.gitignore` - Excluded files

**Core Logic:**
- `bin/install.js` - All installation logic (file copying, path replacement)

**Testing:**
- `tests/` - Test files (if present)

**Documentation:**
- `README.md` - User-facing installation and usage guide
- `CLAUDE.md` - Instructions for OpenCode when working in this repo

## Naming Conventions

**Files:**
- kebab-case.md: Markdown documents
- kebab-case.js: JavaScript source files
- UPPERCASE.md: Important project files (README, CLAUDE, CHANGELOG)

**Directories:**
- kebab-case: All directories
- Plural for collections: templates/, commands/, workflows/

**Special Patterns:**
- {command-name}.md: Slash command definition
- *-template.md: Could be used but templates/ directory preferred

## Where to Add New Code

**New Slash Command:**
- Primary code: `commands/fuska/{command-name}.md`
- Tests: `tests/commands/{command-name}.test.js` (if testing implemented)
- Documentation: Update `README.md` with new command

**New Template:**
- Implementation: `get-shit-done/templates/{name}.md`
- Documentation: Template is self-documenting (includes guidelines)

**New Workflow:**
- Implementation: `get-shit-done/workflows/{name}.md`
- Usage: Reference from command with `@~/.config/opencode/get-shit-done/workflows/{name}.md`

**New Reference Document:**
- Implementation: `get-shit-done/references/{name}.md`
- Usage: Reference from commands/workflows as needed

**Utilities:**
- No utilities yet (`install.js` is monolithic)
- If extracted: `src/utils/`

## Special Directories

**get-shit-done/**
- Purpose: Resources installed to ~/.config/opencode/
- Source: Copied by bin/install.js during installation
- Committed: Yes (source of truth)

**commands/**
- Purpose: Slash commands installed to ~/.config/opencode/commands/
- Source: Copied by bin/install.js during installation
- Committed: Yes (source of truth)

---

*Structure analysis: 2025-01-20*
*Update when directory structure changes*
```
</good_examples>

<guidelines>
**What belongs in STRUCTURE.md:**
- Directory layout (ASCII tree)
- Purpose of each directory
- Key file locations (entry points, configs, core logic)
- Naming conventions
- Where to add new code (by type)
- Special/generated directories

**What does NOT belong here:**
- Conceptual architecture (that's ARCHITECTURE.md)
- Technology stack (that's STACK.md)
- Code implementation details (defer to code reading)
- Every single file (focus on directories and key files)

**MegaMemory Usage:**
This template is for @-reference only. When agents need to understand or update structure, they should:
1. Query MegaMemory: `megamemory_understand({ query: "directory structure file locations" })`
2. Create/update structure: `megamemory_create_concept()` or `megamemory_update_concept()`
3. Create directory concepts as children of the structure concept
4. Store in MegaMemory, not in this file

**When filling this template:**
- Use `tree -L 2` or similar to visualize structure
- Identify top-level directories and their purposes
- Note naming patterns by observing existing files
- Locate entry points, configs, and main logic areas
- Keep directory tree concise (max 2-3 levels)

**ASCII tree format:**
```
root/
├── dir1/           # Purpose
│   ├── subdir/    # Purpose
│   └── file.ts    # Purpose
├── dir2/          # Purpose
└── file.ts        # Purpose
```

**Useful for phase planning when:**
- Adding new features (where should files go?)
- Understanding project organization
- Finding where specific logic lives
- Following existing conventions
</guidelines>
