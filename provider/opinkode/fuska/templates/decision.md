# Decision Template (MegaMemory-Backed)

Template for architecture decision records (ADRs) stored as MegaMemory concepts.

**Purpose:** Capture why significant technical choices were made - alternatives considered, trade-offs accepted, and consequences. Answer "why did we choose X?" for future developers.

---

<megamemory_schema>

## Concept: `decision-{slug}`

**Kind:** `decision`

**Summary:** Architecture Decision Record capturing a significant technical choice. Includes context, decision, alternatives considered, consequences, status lifecycle, and relationships to affected chapters.

**Fields:**
- `id` (string) - Decision identifier (e.g., "use-typescript", "auth-jose", "api-rest")
- `title` (string) - Human-readable title
- `context` (string) - What is the issue we're addressing? Why does this decision matter?
- `decision` (string) - What we decided to do
- `alternatives` (array of DecisionAlternative)
  - `option` (string) - Name of alternative considered
  - `considered` (boolean) - Whether this was seriously considered
  - `reason` (string) - Why accepted or rejected
- `consequences` (object of DecisionConsequences)
  - `positive` (array of strings) - Benefits of this decision
  - `negative` (array of strings) - Drawbacks accepted
  - `risks` (array of strings) - Potential issues to watch
- `status` (DecisionStatus) - Lifecycle: proposed | accepted | rejected | deprecated | superseded
- `created_at` (string) - ISO timestamp when proposed
- `decided_at` (string | null) - ISO timestamp when accepted/rejected, null if proposed
- `superseded_by` (string | null) - Decision ID if this is superseded
- `related_chapters` (array of strings) - Chapter slugs this decision affects

**Relationships:**
- `implements` → `chapter-{slug}` - Decision made for a specific chapter
- `connects_to` → `decision-{slug}` - Related decisions
- `supersedes` → `decision-{slug}` - This decision replaces an older one
- `addresses` → `chapter-{slug}` - Decision addresses concerns for this chapter

</megamemory_schema>

<megamemory_operations>

## Create Decision

```typescript
// After making a significant architectural choice
await megamemory.create_concept({
  name: `decision-${decisionId}`,
  kind: "decision",
  summary: `${title}. Decision: ${decision}. Status: ${status}. Alternatives: ${alternatives.filter(a => a.considered).map(a => a.option).join(", ")}. Related chapters: ${relatedChapters.join(", ")}.`,
  why: `Captures why ${decision} was chosen - alternatives considered, trade-offs accepted, consequences documented`,
  parent_id: `initiative:${initiativeId}`,
  edges: [
    {
      to: `chapter-${chapterSlug}`,
      relation: "implements",
      description: "Decision made during this chapter"
    },
    ...relatedChapters.map(ch => ({
      to: `chapter-${ch}`,
      relation: "addresses",
      description: "Decision affects this chapter"
    }))
  ]
})
```

## Query by Status

```typescript
// Get all decisions with a specific status
const result = await megamemory.understand({
  query: `decision concepts status ${status} with context alternatives consequences`,
  top_k: 50
})

// Returns all decision concepts matching status:
// - "proposed": Decisions pending review
// - "accepted": Active decisions to follow
// - "rejected": Decisions not to make
// - "deprecated": Decisions to phase out
// - "superseded": Decisions replaced by newer ones
```

## Query by Chapter

```typescript
// Get all decisions affecting a specific chapter
const result = await megamemory.understand({
  query: `decision concepts chapter ${chapterSlug} with context decision alternatives`,
  top_k: 20
})

// Returns all decisions with edges to this chapter
// Used when planning to understand constraints and choices
```

## Update Decision Status

```typescript
// Accept a proposed decision
await megamemory.update_concept({
  id: `decision-${decisionId}`,
  changes: {
    summary: updatedSummary // Include new status, decided_at
  }
})

// Link superseded decision
await megamemory.link({
  from: `decision-${newDecisionId}`,
  to: `decision-${oldDecisionId}`,
  relation: "supersedes",
  description: "New decision replaces older approach"
})
```

## Link to Related Concepts

```typescript
// Connect related decisions
await megamemory.link({
  from: `decision-auth-jose`,
  to: `decision-token-strategy`,
  relation: "connects_to",
  description: "JWT library choice affects token strategy"
})

// Link decision to chapter it addresses
await megamemory.link({
  from: `decision-api-rest`,
  to: `chapter-api-design`,
  relation: "addresses",
  description: "REST vs GraphQL decision applies to API design chapter"
})
```

</megamemory_operations>

<megamemory_examples>

## Example 1: Tech Stack Choice (TypeScript vs JavaScript)

```typescript
await megamemory.create_concept({
  name: "decision-use-typescript",
  kind: "decision",
  summary: "Use TypeScript for all new code. Decision: TypeScript for type safety and developer experience. Status: accepted. Alternatives: JavaScript, JSDoc. Related chapters: foundation, api, ui.",
  why: "Captures why TypeScript was chosen - prevents future 'why not JavaScript?' questions and documents accepted trade-offs",
  parent_id: "project:myapp",
  edges: [
    {
      to: "chapter-foundation",
      relation: "implements",
      description: "Decision made during foundation chapter"
    }
  ]
})
```

Full JSON for summary field:
```json
{
  "id": "use-typescript",
  "title": "Use TypeScript for all new code",
  "context": "Starting a new project and need to decide on the primary language. Developer productivity, type safety, and long-term maintainability are priorities.",
  "decision": "Use TypeScript as the primary language for all new code. JavaScript only for configuration files where TypeScript adds friction.",
  "alternatives": [
    {
      "option": "JavaScript",
      "considered": true,
      "reason": "Rejected - lacks static types, leads to runtime errors that TypeScript catches at compile time"
    },
    {
      "option": "JavaScript with JSDoc",
      "considered": true,
      "reason": "Rejected - JSDoc is verbose, less tooling support, types not enforced at compile time"
    },
    {
      "option": "Flow",
      "considered": false,
      "reason": "Not considered - smaller ecosystem, less industry adoption"
    }
  ],
  "consequences": {
    "positive": [
      "Compile-time type checking catches errors early",
      "Better IDE support (autocomplete, refactoring)",
      "Self-documenting code with explicit types",
      "Easier onboarding for developers familiar with TypeScript"
    ],
    "negative": [
      "Build step required (no direct Node.js execution)",
      "Slightly more verbose code",
      "Learning curve for developers new to TypeScript"
    ],
    "risks": [
      "Type definitions may lag behind library updates",
      "Over-engineering types can slow development"
    ]
  },
  "status": "accepted",
  "created_at": "2025-01-15T10:00:00Z",
  "decided_at": "2025-01-15T10:00:00Z",
  "superseded_by": null,
  "related_chapters": ["foundation", "api", "ui"]
}
```

## Example 2: Library Choice (jose vs jsonwebtoken)

```typescript
await megamemory.create_concept({
  name: "decision-auth-jose",
  kind: "decision",
  summary: "Use jose library for JWT operations. Decision: jose for Edge runtime compatibility. Status: accepted. Alternatives: jsonwebtoken, passport-jwt. Related chapters: auth, api.",
  why: "Documents why jose was chosen over more popular jsonwebtoken - Edge runtime support was the deciding factor",
  parent_id: "project:myapp",
  edges: [
    {
      to: "chapter-auth",
      relation: "implements",
      description: "JWT library decision made during auth chapter"
    },
    {
      to: "chapter-api",
      relation: "addresses",
      description: "Affects middleware and API route implementations"
    }
  ]
})
```

Full JSON for summary field:
```json
{
  "id": "auth-jose",
  "title": "Use jose library for JWT operations",
  "context": "Need a JWT library for authentication. Application uses Next.js with Edge runtime for middleware, which has compatibility constraints.",
  "decision": "Use jose (JavaScript Object Signing and Encryption) for all JWT operations. It's ESM-native and Edge-compatible.",
  "alternatives": [
    {
      "option": "jsonwebtoken",
      "considered": true,
      "reason": "Rejected - CommonJS only, doesn't work in Edge runtime without workarounds"
    },
    {
      "option": "passport-jwt",
      "considered": true,
      "reason": "Rejected - Express-focused, overkill for our needs, also CommonJS"
    },
    {
      "option": "jose",
      "considered": true,
      "reason": "Accepted - ESM-native, Edge-compatible, well-maintained, comprehensive JWT/JWE/JWS support"
    }
  ],
  "consequences": {
    "positive": [
      "Works in Edge runtime (Next.js middleware)",
      "Modern ESM architecture",
      "Supports JWT, JWE, JWS, JWK",
      "Smaller bundle size than jsonwebtoken"
    ],
    "negative": [
      "Less Stack Overflow answers than jsonwebtoken",
      "Different API than jsonwebtoken (migration required if switching)"
    ],
    "risks": [
      "Less popular means potentially fewer community resources"
    ]
  },
  "status": "accepted",
  "created_at": "2025-01-16T14:00:00Z",
  "decided_at": "2025-01-16T14:30:00Z",
  "superseded_by": null,
  "related_chapters": ["auth", "api"]
}
```

## Example 3: Architecture Choice (Modular vs Monolithic)

```typescript
await megamemory.create_concept({
  name: "decision-modular-architecture",
  kind: "decision",
  summary: "Use modular monolith architecture. Decision: Single deployable with clear module boundaries. Status: accepted. Alternatives: microservices, serverless. Related chapters: foundation, infra.",
  why: "Documents why modular monolith was chosen - balances simplicity with future scalability",
  parent_id: "project:myapp",
  edges: [
    {
      to: "chapter-foundation",
      relation: "implements",
      description: "Architecture decision made during foundation"
    },
    {
      to: "chapter-infra",
      relation: "addresses",
      description: "Affects deployment and infrastructure choices"
    }
  ]
})
```

Full JSON for summary field:
```json
{
  "id": "modular-architecture",
  "title": "Use modular monolith architecture",
  "context": "Building a new SaaS application. Team of 3-5 developers. Need architecture that supports rapid development but can scale if needed.",
  "decision": "Use modular monolith architecture. Single deployable unit with clear module boundaries (auth, billing, core). Can extract modules to services later if needed.",
  "alternatives": [
    {
      "option": "Microservices",
      "considered": true,
      "reason": "Rejected - operational complexity too high for team size, premature optimization"
    },
    {
      "option": "Serverless",
      "considered": true,
      "reason": "Rejected - vendor lock-in concerns, cold starts impact UX, debugging complexity"
    },
    {
      "option": "Modular Monolith",
      "considered": true,
      "reason": "Accepted - simple deployment, clear boundaries, can extract later if needed"
    }
  ],
  "consequences": {
    "positive": [
      "Single deployment pipeline",
      "Easier local development",
      "Simpler debugging and tracing",
      "Can extract modules to services when actually needed"
    ],
    "negative": [
      "Single point of deployment failure",
      "All modules share same runtime/scale",
      "Need discipline to maintain module boundaries"
    ],
    "risks": [
      "Module boundaries may degrade over time without enforcement",
      "May need to revisit if one module has vastly different scaling needs"
    ]
  },
  "status": "accepted",
  "created_at": "2025-01-14T09:00:00Z",
  "decided_at": "2025-01-14T10:00:00Z",
  "superseded_by": null,
  "related_chapters": ["foundation", "infra"]
}
```

</megamemory_examples>

---

## File Template

```markdown
# ADR-[NNN]: [Title]

**Status:** [proposed | accepted | rejected | deprecated | superseded]
**Created:** [date]
**Decided:** [date or "pending"]
**Related Chapters:** [chapter slugs this affects]

## Context

[What is the issue we're addressing? Why does this decision matter? What constraints exist?]

## Decision

[What we decided to do. Be specific and actionable.]

## Alternatives Considered

| Option | Considered | Reason |
|--------|------------|--------|
| [option 1] | yes/no | [why accepted or rejected] |
| [option 2] | yes/no | [why accepted or rejected] |
| [option 3] | yes/no | [why accepted or rejected] |

## Consequences

### Positive
- [Benefit 1]
- [Benefit 2]

### Negative
- [Drawback 1]
- [Drawback 2]

### Risks
- [Risk 1]
- [Risk 2]

## Related Decisions

- [ADR-XXX: Related decision](./decision-xxx.md) - [how they relate]

---

*Superseded by:* [ADR-NNN if superseded, or "none"]
```

<good_examples>

**Example 1: Good Decision Logging**

```markdown
# ADR-001: Use TypeScript

**Status:** accepted
**Created:** 2025-01-15
**Decided:** 2025-01-15
**Related Chapters:** foundation, api, ui

## Context

Starting a new project. Need to decide on the primary language. Developer productivity, type safety, and long-term maintainability are priorities. Team has mixed TypeScript experience.

## Decision

Use TypeScript as the primary language for all new code. JavaScript only for configuration files where TypeScript adds friction (e.g., jest.config.js, .eslintrc.js).

## Alternatives Considered

| Option | Considered | Reason |
|--------|------------|--------|
| JavaScript | yes | Rejected - lacks static types, runtime errors that TS catches at compile time |
| JSDoc | yes | Rejected - verbose, less tooling support, types not enforced |
| Flow | no | Not considered - smaller ecosystem, less adoption |

## Consequences

### Positive
- Compile-time type checking catches errors early
- Better IDE support (autocomplete, refactoring)
- Self-documenting code with explicit types

### Negative
- Build step required
- Slightly more verbose code
- Learning curve for new developers

### Risks
- Type definitions may lag behind library updates
- Over-engineering types can slow development

## Related Decisions

None - this is a foundational decision.

---

*Superseded by:* none
```

**Example 2: Decision with Supersession**

```markdown
# ADR-003: Use Prisma ORM

**Status:** superseded
**Created:** 2025-01-16
**Decided:** 2025-01-16
**Related Chapters:** database, api

## Context

Need an ORM for database access. PostgreSQL is the database. Developer experience and type safety are important.

## Decision

Use Prisma ORM for all database access. Prisma Client provides type-safe queries and migrations.

## Alternatives Considered

| Option | Considered | Reason |
|--------|------------|--------|
| TypeORM | yes | Rejected - decorator syntax, less intuitive migrations |
| Drizzle | yes | Rejected at the time - less mature, fewer examples |
| Raw SQL | yes | Rejected - no type safety, more boilerplate |

## Consequences

### Positive
- Type-safe database queries
- Excellent migration tooling
- Good IDE support

### Negative
- Schema changes require regeneration
- Some complex queries are awkward

### Risks
- Vendor lock-in to Prisma ecosystem

## Related Decisions

- [ADR-007: Switch to Drizzle](./adr-007-switch-drizzle.md) - Prisma superseded by Drizzle for bundle size and performance

---

*Superseded by:* ADR-007 (2025-06-15) - Drizzle provides better bundle size and query performance
```

</good_examples>

<guidelines>

## When to Create a Decision Concept

**Create a decision when:**
- Multiple valid options existed (you made a conscious choice)
- Future developers might ask "why this?" (needs context preserved)
- Trade-offs were considered (consequences to document)
- The choice affects multiple chapters (cross-cutting concern)
- Reversing the decision would be costly (architectural significance)

**Examples of good decision logging:**
- "Use jose instead of jsonwebtoken" - multiple libraries considered
- "Modular monolith over microservices" - architecture choice with trade-offs
- "PostgreSQL over MongoDB" - database choice affects entire project
- "15-min access tokens with 7-day refresh" - security decision with reasoning

## When NOT to Log a Decision

**Don't create a decision when:**
- Only one reasonable option (no choice made)
- Trivial implementation detail (no architectural impact)
- Temporary workaround (will be replaced)
- The choice is obvious and uncontroversial

**Examples of what NOT to log:**
- "Use ESLint for linting" - standard choice, no alternatives seriously considered
- "Named exports over default exports" - minor style preference
- "Use async/await instead of .then()" - standard practice
- "Fix bug by adding null check" - implementation detail, not architectural

## Decision Lifecycle

```
proposed → accepted → (in use)
         → rejected → (not to make)
         
accepted → deprecated → (phase out)
         → superseded → (replaced by new decision)
```

- **proposed**: Under consideration, not yet finalized
- **accepted**: Active decision, follow this approach
- **rejected**: Considered but not adopted (document why)
- **deprecated**: Was accepted but now being phased out
- **superseded**: Replaced by a newer decision (link to it)

## Good vs Bad Decision Logging

| Good | Bad |
|------|-----|
| "Use jose because Edge runtime compatibility" | "Use jose" |
| "Rejected jsonwebtoken - CommonJS incompatible with Edge" | "jsonwebtoken didn't work" |
| Documents positive AND negative consequences | Only lists benefits |
| Explains why alternatives were rejected | Doesn't mention alternatives |
| Links to related decisions |孤立 exists in isolation |
| Updates status when superseded | Stale "accepted" forever |

## Integration with Workflows

**During /fuska-plan:**
- Planner creates decision concepts for significant stack choices
- Decisions linked to chapters they affect

**During /fuska-do:**
- Executor may create decisions for choices made during implementation
- Executor checks existing decisions for constraints

**During /fuska-summary:**
- Summary references decisions made during execution
- New decisions created if significant choices emerged

**Querying decisions:**
```typescript
// What auth decisions affect the API chapter?
const decisions = await megamemory.understand({
  query: "decision concepts auth api with context alternatives",
  top_k: 10
})
```

</guidelines>
