# Stack Research Template (MegaMemory-Backed)

Template for stack research concepts — recommended technologies for the project domain, stored in MegaMemory.

**Principle:** All research data lives in MegaMemory concepts. This file teaches agents how to create, update, and query stack research concepts.

---

## MegaMemory Schema

```typescript
// Stack Research Concept Structure
interface StackResearchConcept {
  name: string;                    // e.g., "Stack Research: CLI Tools Domain"
  kind: "feature" | "module" | "pattern" | "config" | "decision" | "component";
  summary: string;                  // Concise description: core tech, supporting libs, tools, alternatives
  
  // Metadata stored in summary/why fields
  why: string;                     // Why this stack is recommended for this domain
  file_refs: string[];             // Source documentation URLs or file paths
  edges: ConceptEdge[];
  
  created_by_task: string;          // Description of task that created this
}

interface ConceptEdge {
  to: string;                      // Target concept ID
  relation: "connects_to" | "depends_on" | "implements" | "calls" | "configured_by";
  description: string;             // Why this relationship exists
}

// Store stack details in summary field using structured format:
const stackSummary = `
**Domain:** [domain type]
**Researched:** [date]
**Confidence:** [HIGH/MEDIUM/LOW]

**Core Technologies:**
| Technology | Version | Purpose | Why Recommended |
| [name] | [version] | [what it does] | [why experts use it] |
| [name] | [version] | [what it does] | [why experts use it] |

**Supporting Libraries:**
| Library | Version | Purpose | When to Use |
| [name] | [version] | [what it does] | [specific use case] |

**Development Tools:**
| Tool | Purpose | Notes |
| [name] | [what it does] | [configuration tips] |

**Installation:**
\`\`\`bash
npm install [packages]
\`\`\`

**Alternatives Considered:**
| Recommended | Alternative | When to Use Alternative |
| [choice] | [option] | [conditions] |

**What NOT to Use:**
| Avoid | Why | Use Instead |
| [tech] | [problem] | [alternative] |

**Stack Patterns by Variant:**
- If [condition]: Use [variation] — Because [reason]

**Version Compatibility:**
| Package A | Compatible With | Notes |
| [package@version] | [package@version] | [compatibility notes] |

**Sources:**
- [Context7 library ID] — [topics fetched]
- [Official docs URL] — [what was verified]
`;
```

---

## MegaMemory Operations

### Creating Stack Research Concepts

```typescript
// Create stack research concept
await megamemory.create_concept({
  name: "Stack Research: CLI Tools Domain",
  kind: "feature",
  summary: `
**Domain:** CLI Tools
**Researched:** 2025-02-08
**Confidence:** HIGH

**Core Technologies:**
| Technology | Version | Purpose | Why Recommended |
| Commander.js | 11.1.0 | CLI framework | Most mature, battle-tested for CLIs |
| Chalk | 5.3.0 | Terminal colors | De facto standard for colored output |
| Inquirer | 9.2.11 | Interactive prompts | Best UX for user input |

**Supporting Libraries:**
| Library | Version | Purpose | When to Use |
| Ora | 7.0.1 | Loading spinners | Async operations with visual feedback |
| Listr2 | 7.0.0 | Task lists | Multi-step operations with progress |

**Development Tools:**
| Tool | Purpose | Notes |
| TypeScript | Type safety | Use strict mode, noImplicitAny |

**Installation:**
\`\`\`bash
npm install commander chalk inquirer
npm install -D @types/node typescript
\`\`\`

**Alternatives Considered:**
| Recommended | Alternative | When to Use Alternative |
| Commander.js | Yargs | If building very complex CLIs with nested subcommands |

**What NOT to Use:**
| Avoid | Why | Use Instead |
| Meow | Minimal features, requires more custom code | Commander.js |

**Sources:**
- context7://cli-libs — fetched 2025-02-08
- https://commander.js.org/ — verified latest API
`,
  why: "CLI tools benefit from battle-tested libraries with good CLI UX patterns",
  file_refs: [
    "https://commander.js.org/",
    "https://github.com/SBoudrias/Inquirer.js"
  ],
  edges: [
    {
      to: "project-cli-tools",
      relation: "configures",
      description: "Stack choices configure project architecture"
    }
  ],
  created_by_task: "Research CLI tool best practices and standard libraries"
});
```

### Updating Stack Research Concepts

```typescript
// Update stack research when new information discovered
await megamemory.update_concept({
  id: "[stack-research-concept-id]",
  changes: {
    summary: `
**Domain:** CLI Tools
**Researched:** 2025-02-08
**Confidence:** HIGH

**Core Technologies:**
| Technology | Version | Purpose | Why Recommended |
| Commander.js | 11.1.0 | CLI framework | Most mature, battle-tested for CLIs |
| Chalk | 5.3.0 | Terminal colors | De facto standard for colored output |
| Inquirer | 9.2.11 | Interactive prompts | Best UX for user input |

**NEW:** Table library for structured output
| Technology | Version | Purpose | Why Recommended |
| Cli-table3 | 0.6.3 | Tables | Updated fork of cli-table2, maintained |

[... rest of original stack ...]
`,
    file_refs: [
      "https://commander.js.org/",
      "https://github.com/SBoudrias/Inquirer.js",
      "https://github.com/cli-table/cli-table3"
    ]
  }
});
```

### Querying Stack Research Concepts

```typescript
// Query stack research for a domain
const stackResults = await megamemory_understand({
  query: "stack research CLI tools domain technologies libraries",
  top_k: 5
});

// Results include concept with summary containing full stack details
// Use stackResults[0].summary to get formatted tables
```

### Linking Stack to Other Concepts

```typescript
// Link stack research to project and architecture concepts
await megamemory.link({
  from: "[stack-research-concept-id]",
  to: "[project-concept-id]",
  relation: "configured_by",
  description: "Project uses this researched technology stack"
});

await megamemory.link({
  from: "[project-concept-id]",
  to: "[architecture-concept-id]",
  relation: "implements",
  description: "Architecture pattern implemented from this stack choice"
});
```

---

## MegaMemory Examples

### Example 1: Complete Stack Research Flow

```typescript
// Step 1: Query existing stack research
const existingStack = await megamemory_understand({
  query: "stack research REST API domain",
  top_k: 3
});

if (existingStack.length === 0) {
  // Step 2: Create new stack research
  const stackConcept = await megamemory.create_concept({
    name: "Stack Research: REST API",
    kind: "feature",
    summary: `
**Domain:** REST API
**Researched:** 2025-02-08
**Confidence:** HIGH

**Core Technologies:**
| Technology | Version | Purpose | Why Recommended |
| Express.js | 4.18.2 | Web framework | Minimal, mature, huge ecosystem |
| TypeScript | 5.3.0 | Type safety | Catches bugs early, better DX |

**Supporting Libraries:**
| Library | Version | Purpose | When to Use |
| Zod | 3.22.4 | Validation | Runtime validation + TypeScript types |
| Prisma | 5.9.0 | ORM | Type-safe database access |

**Development Tools:**
| Tool | Purpose | Notes |
| ESLint | Linting | Use @typescript-eslint ruleset |
| Prettier | Formatting | Single quotes, semicolons |

**Installation:**
\`\`\`bash
npm install express
npm install -D typescript @types/express
npm install -D eslint @typescript-eslint/eslint-plugin prettier
\`\`\`

**Alternatives Considered:**
| Recommended | Alternative | When to Use Alternative |
| Express.js | Fastify | If performance is critical and you can handle ecosystem size |

**What NOT to Use:**
| Avoid | Why | Use Instead |
| Hapi | Opinionated, steeper learning curve | Express.js |

**Version Compatibility:**
| Package A | Compatible With | Notes |
| Express 4.18.x | Node 18+ | No breaking changes expected |

**Sources:**
- context7://rest-api-stack — fetched 2025-02-08
- https://expressjs.com/ — verified latest best practices
`,
    why: "REST APIs need minimal framework with good ecosystem for scalability",
    file_refs: [
      "https://expressjs.com/",
      "https://zod.dev/"
    ],
    created_by_task: "Research REST API best practices and standard libraries"
  });

  // Step 3: Link to project
  await megamemory.link({
    from: stackConcept.id,
    to: "[project-concept-id]",
    relation: "configures",
    description: "REST API stack configures project architecture"
  });
}

// Step 4: Use stack research in planning
const stackInfo = existingStack[0] || stackConcept;
console.log("Recommended core technologies:", stackInfo.summary);
```

### Example 2: Agent @-Reference Pattern

```typescript
// When an agent needs stack guidance, it queries MegaMemory:

// Agent reads this file to understand the pattern
// Then executes:

async function getStackForDomain(domain: string) {
  const results = await megamemory_understand({
    query: `stack research ${domain}`,
    top_k: 1
  });
  
  if (results.length === 0) {
    console.log(`No stack research found for domain: ${domain}`);
    return null;
  }
  
  const stack = results[0];
  
  // Parse summary to extract technologies
  const summaryLines = stack.summary.split('\n');
  const coreTechStart = summaryLines.findIndex(l => l.includes('**Core Technologies:**'));
  
  // Extract and return structured stack info
  return {
    domain,
    technologies: extractTable(summaryLines, coreTechStart),
    alternatives: extractAlternatives(summaryLines),
    notToUse: extractNotToUse(summaryLines)
  };
}

// Agent uses this to inform implementation decisions
const apiStack = await getStackForDomain('REST API');
if (apiStack) {
  console.log('Using:', apiStack.technologies.map(t => t.name));
}
```

---

## Original Template Reference

<template>

```markdown
# Stack Research

**Domain:** [domain type]
**Researched:** [date]
**Confidence:** [HIGH/MEDIUM/LOW]

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| [name] | [version] | [what it does] | [why experts use it for this domain] |
| [name] | [version] | [what it does] | [why experts use it for this domain] |
| [name] | [version] | [what it does] | [why experts use it for this domain] |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| [name] | [version] | [what it does] | [specific use case] |
| [name] | [version] | [what it does] | [specific use case] |
| [name] | [version] | [what it does] | [specific use case] |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| [name] | [what it does] | [configuration tips] |
| [name] | [what it does] | [configuration tips] |

## Installation

```bash
# Core
npm install [packages]

# Supporting
npm install [packages]

# Dev dependencies
npm install -D [packages]
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| [our choice] | [other option] | [conditions where alternative is better] |
| [our choice] | [other option] | [conditions where alternative is better] |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| [technology] | [specific problem] | [recommended alternative] |
| [technology] | [specific problem] | [recommended alternative] |

## Stack Patterns by Variant

**If [condition]:**
- Use [variation]
- Because [reason]

**If [condition]:**
- Use [variation]
- Because [reason]

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| [package@version] | [package@version] | [compatibility notes] |

## Sources

- [Context7 library ID] — [topics fetched]
- [Official docs URL] — [what was verified]
- [Other source] — [confidence level]

---
*Stack research for: [domain]*
*Researched: [date]*
```

</template>

---

## Guidelines

<guidelines>

**Core Technologies:**
- Include specific version numbers
- Explain why this is the standard choice, not just what it does
- Focus on technologies that affect architecture decisions

**Supporting Libraries:**
- Include libraries commonly needed for this domain
- Note when each is needed (not all projects need all libraries)

**Alternatives:**
- Don't just dismiss alternatives
- Explain when alternatives make sense
- Helps user make informed decisions if they disagree

**What NOT to Use:**
- Actively warn against outdated or problematic choices
- Explain the specific problem, not just "it's old"
- Provide the recommended alternative

**Version Compatibility:**
- Note any known compatibility issues
- Critical for avoiding debugging time later

</guidelines>
