# Features Research Template (MegaMemory-Backed)

Template for features research concepts — feature landscape for the project domain, stored in MegaMemory.

**Principle:** All feature data lives in MegaMemory concepts. This file teaches agents how to create, update, and query feature research concepts.

---

## MegaMemory Schema

```typescript
// Features Research Concept Structure
interface FeaturesResearchConcept {
  name: string;                    // e.g., "Features Research: Social Platform"
  kind: "feature" | "module" | "pattern" | "config" | "decision" | "component";
  summary: string;                  // Concise description: table stakes, differentiators, anti-features, dependencies, MVP
  
  // Metadata stored in summary/why fields
  why: string;                     // Why this feature set is appropriate for this domain
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

// Store feature details in summary field using structured format:
const featuresSummary = `
**Domain:** [domain type]
**Researched:** [date]
**Confidence:** [HIGH/MEDIUM/LOW]

**Table Stakes (Users Expect These):**
| Feature | Why Expected | Complexity | Notes |
| [feature] | [user expectation] | LOW/MEDIUM/HIGH | [implementation notes] |

**Differentiators (Competitive Advantage):**
| Feature | Value Proposition | Complexity | Notes |
| [feature] | [why it matters] | LOW/MEDIUM/HIGH | [implementation notes] |

**Anti-Features (Commonly Requested, Often Problematic):**
| Feature | Why Requested | Why Problematic | Alternative |
| [feature] | [surface appeal] | [actual problems] | [better approach] |

**Feature Dependencies:**
[Feature A] ──requires──> [Feature B] ──requires──> [Feature C]
[Feature D] ──enhances──> [Feature A]
[Feature E] ──conflicts──> [Feature F]

**MVP Definition (v1):**
- [ ] [Feature] — [why essential]

**Add After Validation (v1.x):**
- [ ] [Feature] — [trigger for adding]

**Future Consideration (v2+):**
- [ ] [Feature] — [why defer]

**Feature Prioritization Matrix:**
| Feature | User Value | Implementation Cost | Priority |
| [feature] | HIGH/MEDIUM/LOW | HIGH/MEDIUM/LOW | P1/P2/P3 |

**Competitor Feature Analysis:**
| Feature | Competitor A | Competitor B | Our Approach |
| [feature] | [how they do it] | [how they do it] | [our plan] |

**Sources:**
- [Competitor products analyzed]
- [User research or feedback sources]
- [Industry standards referenced]
`;
```

---

## MegaMemory Operations

### Creating Features Research Concepts

```typescript
// Create features research concept
await megamemory.create_concept({
  name: "Features Research: CLI Tools",
  kind: "feature",
  summary: `
**Domain:** CLI Tools
**Researched:** 2025-02-08
**Confidence:** HIGH

**Table Stakes (Users Expect These):**
| Feature | Why Expected | Complexity | Notes |
| Help command | Users expect --help | LOW | Document all flags and options |
| Error handling | Users need actionable errors | MEDIUM | Clear messages with suggested fixes |
| Exit codes | Automation requires non-zero on error | LOW | 0 for success, non-zero for failure |
| Config file | Users want persistent settings | MEDIUM | Support JSON/YAML config |

**Differentiators (Competitive Advantage):**
| Feature | Value Proposition | Complexity | Notes |
| Interactive mode | Better UX for complex workflows | HIGH | Use inquirer for prompts |
| Plugin system | Extensibility for third-party devs | HIGH | Define plugin API interface |
| Auto-completion | Faster command entry | MEDIUM | Generate shell completion scripts |
| Progress indicators | Visual feedback on long operations | LOW | Use ora or listr2 |

**Anti-Features (Commonly Requested, Often Problematic):**
| Feature | Why Requested | Why Problematic | Alternative |
| GUI wrapper | Visual appeal | Adds dependencies, breaks scriptability | Stick to CLI, use --json for tools |
| Real-time updates | Modern feel | Hard to debug, race conditions | Show summary at completion |
| Complex config languages | Flexibility | Confusing for users | Use JSON/YAML instead |

**Feature Dependencies:**
```
[Help Command]
    └──requires──> [Command Registration]

[Interactive Mode]
    └──requires──> [Prompt Library]
    └──enhances──> [Help Command]

[Progress Indicators]
    └──requires──> [Async Operations]
    └──enhances──> [Long-running Commands]
```

**Feature Dependencies Notes:**
- **Help Command requires Command Registration:** Cannot document commands until they're registered
- **Interactive Mode enhances Help Command:** Interactive help can guide users through options
- **Progress Indicators enhances Long-running Commands:** Visual feedback improves UX for slow operations

**MVP Definition (v1):**
- [x] Help command — Essential for discoverability
- [x] Error handling — Basic requirement for usable tool
- [x] Exit codes — Required for CI/CD integration
- [ ] Config file — Nice to have, can add after validation

**Add After Validation (v1.x):**
- [ ] Interactive mode — Add if users struggle with flags
- [ ] Progress indicators — Add if users report confusion on long operations

**Future Consideration (v2+):**
- [ ] Plugin system — Defer until core features validated
- [ ] Auto-completion — Defer until command set stabilizes

**Feature Prioritization Matrix:**
| Feature | User Value | Implementation Cost | Priority |
| Help command | HIGH | LOW | P1 |
| Error handling | HIGH | MEDIUM | P1 |
| Exit codes | HIGH | LOW | P1 |
| Config file | HIGH | MEDIUM | P2 |
| Interactive mode | MEDIUM | HIGH | P2 |
| Progress indicators | MEDIUM | LOW | P2 |
| Plugin system | MEDIUM | HIGH | P3 |
| Auto-completion | LOW | MEDIUM | P3 |

**Competitor Feature Analysis:**
| Feature | npm CLI | Yarn | Our Approach |
| Help command | Yes (npm help) | Yes (yarn help) | Standard --help flag |
| Interactive mode | No | Yes (yarn create) | Add interactive init command |
| Progress indicators | Yes | Yes | Use for install/build operations |
| Plugin system | Yes (npm scripts) | No | Defer to v2+ |

**Sources:**
- Analyzed: npm CLI, Yarn, pnpm
- CLI guidelines: https://cli-guidelines.io/
- Community patterns: https://github.com/topics/cli
`,
  why: "Core CLI features balance usability with simplicity, avoiding over-engineering",
  file_refs: [
    "https://cli-guidelines.io/",
    "https://github.com/topics/cli"
  ],
  created_by_task: "Research CLI tool feature landscape and user expectations"
});
```

### Updating Features Research Concepts

```typescript
// Update features research when new information discovered
await megamemory.update_concept({
  id: "[features-research-concept-id]",
  changes: {
    summary: `
**Domain:** CLI Tools
**Researched:** 2025-02-08
**Confidence:** HIGH

[... existing features ...]

**NEW Differentiator:**
| Feature | Value Proposition | Complexity | Notes |
| Workspace support | Multi-project workflows | HIGH | Support workspace-level commands |

**Updated MVP (v1):**
- [x] Help command
- [x] Error handling
- [x] Exit codes
- [ ] Config file
- [ ] Workspace support — Essential for monorepo users

[... rest of original ...]
`
  }
});
```

### Querying Features Research Concepts

```typescript
// Query features research for a domain
const featuresResults = await megamemory_understand({
  query: "features research CLI tools table stakes differentiators MVP",
  top_k: 5
});

// Results include concept with full feature details
// Use featuresResults[0].summary to get table stakes, MVP definition, priorities
```

### Linking Features to Other Concepts

```typescript
// Link features research to project and roadmap concepts
await megamemory.link({
  from: "[features-research-concept-id]",
  to: "[project-concept-id]",
  relation: "configured_by",
  description: "Project scope defined by these features"
});

await megamemory.link({
  from: "[chapter-concept-id]",
  to: "[feature-concept-id]",
  relation: "implements",
  description: "Chapter implements this feature"
});
```

### Creating Individual Feature Concepts

```typescript
// Create granular feature concepts for linking
const helpFeature = await megamemory.create_concept({
  name: "Feature: Help Command",
  kind: "feature",
  summary: "Help command (--help) that documents all CLI flags, options, and commands with usage examples",
  why: "Essential for CLI discoverability and user onboarding",
  file_refs: ["https://cli-guidelines.io/#help"],
  created_by_task: "Define help command feature"
});

// Link to features research
await megamemory.link({
  from: "[features-research-concept-id]",
  to: helpFeature.id,
  relation: "connects_to",
  description: "Help command is a table-stakes feature"
});
```

---

## MegaMemory Examples

### Example 1: Complete Features Research Flow

```typescript
// Step 1: Query existing features research
const existingFeatures = await megamemory_understand({
  query: "features research REST API domain",
  top_k: 3
});

if (existingFeatures.length === 0) {
  // Step 2: Create new features research
  const featuresConcept = await megamemory.create_concept({
    name: "Features Research: REST API",
    kind: "feature",
    summary: `
**Domain:** REST API
**Researched:** 2025-02-08
**Confidence:** HIGH

**Table Stakes (Users Expect These):**
| Feature | Why Expected | Complexity | Notes |
| CRUD operations | Users expect create/read/update/delete | MEDIUM | Implement for all main resources |
| Pagination | Large datasets must be paginated | LOW | Use cursor or offset-based |
| Filtering | Users need to filter results | MEDIUM | Support common filters |
| Error responses | Users need actionable errors | LOW | Include error codes and messages |
| Versioning | API must evolve without breaking clients | MEDIUM | Use URL path versioning (/v1/)

**Differentiators (Competitive Advantage):**
| Feature | Value Proposition | Complexity | Notes |
| GraphQL endpoint | Query flexibility | HIGH | Hybrid approach (REST + GraphQL) |
| Real-time updates | Live data without polling | HIGH | WebSocket support for specific resources |
| Rate limiting | Fair usage, protection | MEDIUM | Tiered limits per user tier |

**Anti-Features (Commonly Requested, Often Problematic):**
| Feature | Why Requested | Why Problematic | Alternative |
| REST for everything | Simplicity | Not all operations fit resource model | Use GraphQL for complex queries |
| Nested resources everywhere | Clean URLs | Deep nesting is confusing | Flatten resources, use filtering |
| DELETE returning body | Consistency | DELETE should be idempotent | Return 204 No Content

**Feature Dependencies:**
\`\`\`
[CRUD Operations]
    └──requires──> [Resource Models]
    └──requires──> [Database Schema]

[Authentication]
    └──requires──> [User Management]
    └──enhances──> [CRUD Operations]

[Rate Limiting]
    └──requires──> [Authentication]
    └──enhances──> [API Stability]
\`\`\`

**MVP Definition (v1):**
- [ ] CRUD operations — Core functionality
- [ ] Pagination — Required for list endpoints
- [ ] Error responses — Basic requirement
- [ ] Authentication — Required for protected resources

**Add After Validation (v1.x):**
- [ ] Filtering — Add if users request specific filters
- [ ] Versioning — Add when API changes are needed

**Future Consideration (v2+):**
- [ ] GraphQL endpoint — Defer until query complexity justified
- [ ] Real-time updates — Defer until specific use case
- [ ] Rate limiting — Defer until user base grows

**Feature Prioritization Matrix:**
| Feature | User Value | Implementation Cost | Priority |
| CRUD operations | HIGH | MEDIUM | P1 |
| Error responses | HIGH | LOW | P1 |
| Authentication | HIGH | MEDIUM | P1 |
| Pagination | HIGH | LOW | P1 |
| Filtering | MEDIUM | MEDIUM | P2 |
| Versioning | MEDIUM | MEDIUM | P2 |
| GraphQL endpoint | MEDIUM | HIGH | P3 |
| Real-time updates | LOW | HIGH | P3 |
| Rate limiting | LOW | MEDIUM | P3 |

**Competitor Feature Analysis:**
| Feature | GitHub API | Stripe API | Our Approach |
| CRUD operations | Yes | Yes | Yes (v1) |
| Pagination | Yes (cursor) | Yes (cursor) | Cursor-based (v1) |
| Filtering | Yes | Yes | Basic filters (v1.x) |
| Versioning | Yes (/v3/) | Yes (header) | URL path versioning (v1.x) |
| GraphQL | Yes | No | Defer to v2+ |

**Sources:**
- Analyzed: GitHub API v3, Stripe API
- REST guidelines: https://restfulapi.net/
- API design: https://github.com/microsoft/api-guidelines
`,
    why: "Standard REST API features ensure compatibility with client expectations",
    file_refs: [
      "https://restfulapi.net/",
      "https://github.com/microsoft/api-guidelines"
    ],
    created_by_task: "Research REST API feature landscape"
  });

  // Step 3: Link to project
  await megamemory.link({
    from: featuresConcept.id,
    to: "[project-concept-id]",
    relation: "configured_by",
    description: "REST API features define project scope"
  });
}

// Step 4: Use features research in roadmap planning
const featuresInfo = existingFeatures[0] || featuresConcept;
console.log("MVP features:", extractMVP(featuresInfo.summary));
```

### Example 2: Extracting Feature Priorities

```typescript
// When agent needs feature prioritization for roadmap

async function getFeaturePriorities(domain: string) {
  const results = await megamemory_understand({
    query: `features research ${domain}`,
    top_k: 1
  });
  
  if (results.length === 0) {
    console.log(`No features research found for domain: ${domain}`);
    return null;
  }
  
  const features = results[0];
  
  // Parse summary to extract feature priorities
  const summaryLines = features.summary.split('\n');
  
  return {
    domain,
    tableStakes: extractFeatureTable(summaryLines, 'Table Stakes'),
    differentiators: extractFeatureTable(summaryLines, 'Differentiators'),
    mvp: extractMVP(summaryLines),
    priorities: extractPriorityMatrix(summaryLines),
    dependencies: extractDependencies(summaryLines)
  };
}

// Agent uses to inform roadmap chapter creation
const apiFeatures = await getFeaturePriorities('REST API');
if (apiFeatures) {
  const p1Features = apiFeatures.priorities.filter(p => p.priority === 'P1');
  console.log('Chapter 1 should deliver:', p1Features);
}
```

### Example 3: Feature-to-Chapter Mapping

```typescript
// Map features to roadmap chapters

async function mapFeaturesToChapters(featuresConceptId: string) {
  const features = await megamemory_understand({
    query: `features research`,
    top_k: 10
  });
  
  if (features.length === 0) return [];
  
  const featureSet = features[0];
  const mvp = extractMVP(featureSet.summary);
  
  // Create feature concepts for MVP items
  const featureConcepts = [];
  for (const feature of mvp) {
    const featureConcept = await megamemory.create_concept({
      name: `Feature: ${feature.name}`,
      kind: "feature",
      summary: feature.description,
      why: feature.reason,
      created_by_task: "Extract MVP feature from features research"
    });
    
    featureConcepts.push(featureConcept);
    
    // Link to features research
    await megamemory.link({
      from: featureConcept.id,
      to: featuresConceptId,
      relation: "connects_to",
      description: "Part of MVP feature set"
    });
  }
  
  return featureConcepts;
}
```

---

## Original Template Reference

<template>

```markdown
# Feature Research

**Domain:** [domain type]
**Researched:** [date]
**Confidence:** [HIGH/MEDIUM/LOW]

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| [feature] | [user expectation] | LOW/MEDIUM/HIGH | [implementation notes] |
| [feature] | [user expectation] | LOW/MEDIUM/HIGH | [implementation notes] |
| [feature] | [user expectation] | LOW/MEDIUM/HIGH | [implementation notes] |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| [feature] | [why it matters] | LOW/MEDIUM/HIGH | [implementation notes] |
| [feature] | [why it matters] | LOW/MEDIUM/HIGH | [implementation notes] |
| [feature] | [why it matters] | LOW/MEDIUM/HIGH | [implementation notes] |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| [feature] | [surface appeal] | [actual problems] | [better approach] |
| [feature] | [surface appeal] | [actual problems] | [better approach] |

## Feature Dependencies

```
[Feature A]
    └──requires──> [Feature B]
                       └──requires──> [Feature C]

[Feature D] ──enhances──> [Feature A]

[Feature E] ──conflicts──> [Feature F]
```

### Dependency Notes

- **[Feature A] requires [Feature B]:** [why the dependency exists]
- **[Feature D] enhances [Feature A]:** [how they work together]
- **[Feature E] conflicts with [Feature F]:** [why they're incompatible]

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] [Feature] — [why essential]
- [ ] [Feature] — [why essential]
- [ ] [Feature] — [why essential]

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] [Feature] — [trigger for adding]
- [ ] [Feature] — [trigger for adding]

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] [Feature] — [why defer]
- [ ] [Feature] — [why defer]

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| [feature] | HIGH/MEDIUM/LOW | HIGH/MEDIUM/LOW | P1/P2/P3 |
| [feature] | HIGH/MEDIUM/LOW | HIGH/MEDIUM/LOW | P1/P2/P3 |
| [feature] | HIGH/MEDIUM/LOW | HIGH/MEDIUM/LOW | P1/P2/P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Competitor A | Competitor B | Our Approach |
|---------|--------------|--------------|--------------|
| [feature] | [how they do it] | [how they do it] | [our plan] |
| [feature] | [how they do it] | [how they do it] | [our plan] |

## Sources

- [Competitor products analyzed]
- [User research or feedback sources]
- [Industry standards referenced]

---
*Feature research for: [domain]*
*Researched: [date]*
```

</template>

---

## Guidelines

<guidelines>

**Table Stakes:**
- These are non-negotiable for launch
- Users don't give credit for having them, but penalize for missing them
- Example: A community platform without user profiles is broken

**Differentiators:**
- These are where you compete
- Should align with the Core Value from PROJECT.md
- Don't try to differentiate on everything

**Anti-Features:**
- Prevent scope creep by documenting what seems good but isn't
- Include the alternative approach
- Example: "Real-time everything" often creates complexity without value

**Feature Dependencies:**
- Critical for roadmap chapter ordering
- If A requires B, B must be in an earlier chapter
- Conflicts inform what NOT to combine in same chapter

**MVP Definition:**
- Be ruthless about what's truly minimum
- "Nice to have" is not MVP
- Launch with less, validate, then expand

</guidelines>
