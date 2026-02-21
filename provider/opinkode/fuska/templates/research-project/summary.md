# Research Summary Template (MegaMemory-Backed)

Template for research summary concepts — executive summary of project research with roadmap implications, stored in MegaMemory.

**Principle:** All summary data lives in MegaMemory concepts. This file teaches agents how to create, update, and query research summary concepts.

---

## MegaMemory Schema

```typescript
// Research Summary Concept Structure
interface ResearchSummaryConcept {
  name: string;                    // e.g., "Research Summary: CLI Tools Project"
  kind: "feature" | "module" | "pattern" | "config" | "decision" | "component";
  summary: string;                  // Concise description: executive summary, key findings, roadmap implications
  
  // Metadata stored in summary/why fields
  why: string;                     // Why this research matters for the project
  file_refs: string[];             // Links to related research concepts or sources
  edges: ConceptEdge[];
  parent_id?: string;              // Optional parent concept (usually the project concept)
  
  created_by_task: string;          // Description of task that created this
}

interface ConceptEdge {
  to: string;                      // Target concept ID
  relation: "connects_to" | "depends_on" | "implements" | "calls" | "configured_by";
  description: string;             // Why this relationship exists
}

// Store summary details in summary field using structured format:
const summaryContent = `
**Project:** [name from PROJECT.md]
**Domain:** [inferred domain type]
**Researched:** [date]
**Confidence:** [HIGH/MEDIUM/LOW]

**Executive Summary:**
[2-3 paragraph overview of research findings]

- What type of product this is and how experts build it
- The recommended approach based on research
- Key risks and how to mitigate them

**Key Findings:**

**Recommended Stack:**
[Summary from STACK.md — 1-2 paragraphs]
**Core technologies:**
- [Technology]: [purpose] — [why recommended]
- [Technology]: [purpose] — [why recommended]
- [Technology]: [purpose] — [why recommended]

**Expected Features:**
[Summary from FEATURES.md]
**Must have (table stakes):**
- [Feature] — users expect this
- [Feature] — users expect this

**Should have (competitive):**
- [Feature] — differentiator
- [Feature] — differentiator

**Defer (v2+):**
- [Feature] — not essential for launch

**Architecture Approach:**
[Summary from ARCHITECTURE.md — 1 paragraph]
**Major components:**
1. [Component] — [responsibility]
2. [Component] — [responsibility]
3. [Component] — [responsibility]

**Critical Pitfalls:**
[Top 3-5 from PITFALLS.md]
1. **[Pitfall]** — [how to avoid]
2. **[Pitfall]** — [how to avoid]
3. **[Pitfall]** — [how to avoid]

**Implications for Roadmap:**

Based on research, suggested chapter structure:

**Chapter 1: [Name]**
**Rationale:** [why this comes first based on research]
**Delivers:** [what this chapter produces]
**Addresses:** [features from FEATURES.md]
**Avoids:** [pitfall from PITFALLS.md]

**Chapter 2: [Name]**
**Rationale:** [why this order]
**Delivers:** [what this chapter produces]
**Uses:** [stack elements from STACK.md]
**Implements:** [architecture component]

**Chapter 3: [Name]**
**Rationale:** [why this order]
**Delivers:** [what this chapter produces]

[Continue for suggested chapters...]

**Chapter Ordering Rationale:**
- [Why this order based on dependencies discovered]
- [Why this grouping based on architecture patterns]
- [How this avoids pitfalls from research]

**Research Flags:**
Chapters likely needing deeper research during planning:
- **Chapter [X]:** [reason — e.g., "complex integration, needs API research"]
- **Chapter [Y]:** [reason — e.g., "niche domain, sparse documentation"]

Chapters with standard patterns (skip research-chapter):
- **Chapter [X]:** [reason — e.g., "well-documented, established patterns"]

**Confidence Assessment:**

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | [HIGH/MEDIUM/LOW] | [reason] |
| Features | [HIGH/MEDIUM/LOW] | [reason] |
| Architecture | [HIGH/MEDIUM/LOW] | [reason] |
| Pitfalls | [HIGH/MEDIUM/LOW] | [reason] |

**Overall confidence:** [HIGH/MEDIUM/LOW]

**Gaps to Address:**
[Any areas where research was inconclusive or needs validation during implementation]
- [Gap]: [how to handle during planning/execution]
- [Gap]: [how to handle during planning/execution]

**Sources:**
**Primary (HIGH confidence):**
- [Context7 library ID] — [topics]
- [Official docs URL] — [what was checked]

**Secondary (MEDIUM confidence):**
- [Source] — [finding]

**Tertiary (LOW confidence):**
- [Source] — [finding, needs validation]
`;
```

---

## MegaMemory Operations

### Creating Research Summary Concepts

```typescript
// Create research summary concept
await megamemory.create_concept({
  name: "Research Summary: CLI Tools Project",
  kind: "feature",
  summary: `
**Project:** CLI Tools Builder
**Domain:** CLI Tools
**Researched:** 2025-02-08
**Confidence:** HIGH

**Executive Summary:**
CLI tools are command-line applications built with Node.js. Experts use Commander.js for CLI framework, TypeScript for type safety, and layered architecture with separate command, handler, and service layers. The recommended approach is to start with core commands and error handling, add interactive features for complex workflows, and implement plugin system only after core features are validated. Key risks include silent failures, inconsistent error handling, and blocking operations, all preventable with proper error handling and async patterns.

This research draws from CLI guidelines.io, popular CLI packages (Commander.js, Inquirer.js), and analysis of npm CLI and Yarn. The domain is well-documented with established patterns, giving high confidence in recommendations.

**Key Findings:**

**Recommended Stack:**
Experts recommend Commander.js for CLI framework due to maturity and ecosystem size. TypeScript provides type safety that catches bugs early. Supporting libraries include Ora for loading spinners and Listr2 for task lists. The stack is stable with active maintenance and extensive documentation.

**Core technologies:**
- Commander.js 11.1.0: CLI framework — Most mature, battle-tested for CLIs
- TypeScript 5.3.0: Type safety — Catches bugs early, better DX
- Node.js 18+: Runtime — Minimum version for modern features

**Expected Features:**
Table stakes features include help commands, error handling, and exit codes — users expect these in any CLI. Differentiators include interactive mode for better UX on complex workflows and plugin system for extensibility. Features to defer include auto-completion and workspace support, which can be added after validation.

**Must have (table stakes):**
- Help command — users expect --help flag
- Error handling — users need actionable errors
- Exit codes — automation requires non-zero on failure
- Config file — users want persistent settings

**Should have (competitive):**
- Interactive mode — better UX for complex workflows
- Progress indicators — visual feedback on long operations
- Auto-completion — faster command entry

**Defer (v2+):**
- Plugin system — requires stable core first
- Workspace support — validate basic CLI first

**Architecture Approach:**
CLI tools benefit from layered architecture with three main layers: commands (CLI entry points), handlers (validation and errors), and services (business logic). This separation provides testability and maintainability. Core utilities handle file I/O, HTTP requests, and logging with proper abstraction.

**Major components:**
1. Commands Layer — CLI entry points, argument parsing
2. Handlers Layer — Input validation, error messages
3. Services Layer — Business logic, orchestration
4. Core Utilities — File I/O, HTTP, logging

**Critical Pitfalls:**
Top pitfalls identified include silent failures (commands exit with success on error), inconsistent flag names (confusing UX), blocking async operations (unresponsive CLI), no graceful exit (Ctrl+C corruption), and incompatible Node versions (breaks for some users).

1. **Silent failures** — Always set process.exitCode = 1 on errors
2. **Inconsistent flag names** — Document conventions early, audit before v1
3. **Blocking async operations** — Use async/await, add progress indicators
4. **No graceful exit** — Handle SIGINT, implement cleanup logic
5. **Incompatible Node versions** — Set "engines" in package.json, add version check

**Implications for Roadmap:**

Based on research, suggested chapter structure:

**Chapter 1: Core CLI Infrastructure**
**Rationale:** Foundation must be solid before adding features. Establishes CLI framework, error handling, and exit codes — all table stakes. Prevents silent failures and ensures graceful exit.
**Delivers:** CLI framework setup, error handling infrastructure, help command
**Addresses:** Help command, error handling, exit codes (table stakes)
**Avoids:** Silent failures, no graceful exit, incompatible Node versions
**Uses:** Commander.js, TypeScript
**Implements:** Commands layer, handlers layer

**Chapter 2: Core Commands with I/O**
**Rationale:** After infrastructure, implement core user-facing commands. File operations and async patterns are common CLI operations. Adds progress indicators for long operations.
**Delivers:** Core command implementations, file I/O utilities, progress indicators
**Addresses:** Config file, progress indicators (should have)
**Avoids:** Blocking async operations
**Uses:** fs-extra, ora, listr2
**Implements:** Services layer, core utilities

**Chapter 3: Interactive Features**
**Rationale:** Core commands working, now enhance UX with interactive prompts. Complex workflows benefit from guided input. Adds after validation that basic CLI works.
**Delivers:** Interactive mode, prompt system, enhanced help
**Addresses:** Interactive mode (differentiator)
**Avoids:** (No new pitfalls)
**Uses:** Inquirer.js, prompts library
**Implements:** Enhanced handlers layer

**Chapter 4: Advanced Features (v1.x)**
**Rationale:** After validation, add features users request. Workspace support and auto-completion improve power user experience.
**Delivers:** Workspace support, shell auto-completion, config file
**Addresses:** Workspace support, auto-completion, config file
**Avoids:** (No new pitfalls)
**Uses:** Shell completion libraries, workspace management
**Implements:** Plugin hooks, workspace services

**Chapter 5: Extensibility (v2+)**
**Rationale:** Only after core is stable and validated. Plugin system is complex and requires well-defined interfaces.
**Delivers:** Plugin system, plugin API, plugin registry
**Addresses:** Plugin system (deferred)
**Avoids:** Plugin architecture pitfalls
**Uses:** Plugin framework, dynamic loading
**Implements:** Plugin infrastructure

**Chapter Ordering Rationale:**
- Infrastructure first: Cannot prevent pitfalls like silent failures without solid error handling foundation
- Core commands before features: Users need functional CLI before enhancements like interactive mode
- I/O early: Most CLIs need file operations, establish patterns early
- Interactive after basic CLI: Interactive mode enhances working commands, not a replacement
- Extensibility last: Plugin system requires stable core and clear APIs

**Research Flags:**
Chapters likely needing deeper research during planning:
- **Chapter 3 (Interactive Features):** Inquirer.js has complex plugin system, may need research on prompt composition
- **Chapter 5 (Extensibility):** Plugin architecture patterns vary, may need comparison of approaches

Chapters with standard patterns (skip research-chapter):
- **Chapter 1 (Infrastructure):** CLI framework setup is well-documented (Commander.js)
- **Chapter 2 (Core Commands):** File I/O and async patterns are standard Node.js
- **Chapter 4 (Advanced Features):** Shell completion has established patterns (oclif/completions)

**Confidence Assessment:**

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Commander.js is de facto standard, TypeScript widely adopted |
| Features | HIGH | Table stakes are clear, CLI guidelines.io is authoritative |
| Architecture | HIGH | Layered architecture is well-established pattern for CLIs |
| Pitfalls | HIGH | Post-mortems and community discussions are extensive |

**Overall confidence:** HIGH

**Gaps to Address:**
No major gaps. Research covers all core aspects of CLI tool development. Plugin system in Chapter 5 will need deeper planning but is deferred appropriately. Workspace support patterns vary by tool type, will need research based on specific CLI being built.

- Plugin system architecture: Defer to Chapter 5 planning, research patterns (oclif, Yarn plugins) when needed
- Workspace support patterns: Depends on CLI type (monorepo tool vs project generator), research during Chapter 4 planning

**Sources:**

**Primary (HIGH confidence):**
- context7://cli-guidelines — Command structure, error handling, CLI patterns
- https://cli-guidelines.io/ — Best practices for CLI tools
- https://github.com/tj/commander.js — Official Commander.js docs
- https://github.com/SBoudrias/Inquirer.js — Inquirer.js documentation

**Secondary (MEDIUM confidence):**
- Analyzed npm CLI — Table stakes verification
- Analyzed Yarn — Interactive mode and workspace patterns
- https://github.com/sindresorhus/awesome-node-cli — Community-curated CLI tools

**Tertiary (LOW confidence):**
- Community discussions on Reddit/r/nodejs — User expectations, common pain points
- GitHub issues from popular CLIs — Real-world pitfalls reported by users
`,
  why: "Research summary provides synthesized insights for roadmap creation, prevents common mistakes, and ensures project follows best practices",
  file_refs: [
    "https://cli-guidelines.io/",
    "https://github.com/tj/commander.js",
    "https://github.com/SBoudrias/Inquirer.js"
  ],
  edges: [
    {
      to: "[stack-research-concept-id]",
      relation: "depends_on",
      description: "Summary synthesizes stack research findings"
    },
    {
      to: "[features-research-concept-id]",
      relation: "depends_on",
      description: "Summary synthesizes features research findings"
    },
    {
      to: "[architecture-research-concept-id]",
      relation: "depends_on",
      description: "Summary synthesizes architecture research findings"
    },
    {
      to: "[pitfalls-research-concept-id]",
      relation: "depends_on",
      description: "Summary synthesizes pitfalls research findings"
    }
  ],
  created_by_task: "Synthesize all CLI tool research into executive summary with roadmap implications"
});
```

### Updating Research Summary Concepts

```typescript
// Update research summary when new research is completed
await megamemory.update_concept({
  id: "[research-summary-concept-id]",
  changes: {
    summary: `
**Project:** CLI Tools Builder
**Researched:** 2025-02-08
**Confidence:** HIGH

[... existing summary ...]

**Updated Key Findings:**

**NEW Feature Discovery:**
After additional competitor analysis, discovered that workspace support is becoming table stakes for developer tools. Updated priority from v2+ to v1.x.

**Must have (table stakes) — UPDATED:**
[... existing ...]
- [NEW] Workspace support — developer tools users expect this

**Updated Chapter Structure:**

**Chapter 4 (revised): Workspace and Completion**
**Rationale:** Updated to include workspace support after discovering it's table stakes. Auto-completion remains here as enhancement.
**Delivers:** Workspace support, shell auto-completion, enhanced config
**Addresses:** Workspace support, auto-completion, config file

**Chapter 5 (new): Extensibility (v2+)**
[... same as before ...]

[... rest of original ...]
`
  }
});
```

### Querying Research Summary Concepts

```typescript
// Query research summary for a project
const summaryResults = await megamemory_understand({
  query: "research summary CLI tools project roadmap implications",
  top_k: 5
});

// Results include concept with full summary details
// Use summaryResults[0].summary to get executive summary, chapter suggestions, confidence assessment
```

### Linking Research Summary to Other Concepts

```typescript
// Link research summary to project and roadmap concepts
await megamemory.link({
  from: "[research-summary-concept-id]",
  to: "[project-concept-id]",
  relation: "connects_to",
  description: "Research summary informs project roadmap"
});

await megamemory.link({
  from: "[roadmap-concept-id]",
  to: "[research-summary-concept-id]",
  relation: "configured_by",
  description: "Roadmap structure based on research summary recommendations"
});

// Link to individual research concepts
await megamemory.link({
  from: "[research-summary-concept-id]",
  to: "[stack-research-concept-id]",
  relation: "depends_on",
  description: "Summary synthesizes stack research"
});
```

---

## MegaMemory Examples

### Example 1: Complete Research Summary Flow

```typescript
// Step 1: Gather all research concepts
const research = await megamemory_understand({
  query: "research CLI tools domain stack features architecture pitfalls",
  top_k: 20
});

// Step 2: Check if summary exists
const existingSummary = await megamemory_understand({
  query: "research summary CLI tools project",
  top_k: 1
});

if (existingSummary.length === 0) {
  // Step 3: Synthesize research into summary
  const stack = research.find(c => c.name.includes('Stack Research'));
  const features = research.find(c => c.name.includes('Features Research'));
  const arch = research.find(c => c.name.includes('Architecture Research'));
  const pitfalls = research.find(c => c.name.includes('Pitfalls Research'));
  
  const summaryConcept = await megamemory.create_concept({
    name: "Research Summary: REST API Project",
    kind: "feature",
    summary: synthesizeSummary(stack, features, arch, pitfalls),
    why: "Research summary guides roadmap creation and prevents common mistakes",
    file_refs: [
      "https://restfulapi.net/",
      "https://owasp.org/www-project-api-security/"
    ],
    edges: [
      { to: stack.id, relation: "depends_on", description: "Synthesizes stack research" },
      { to: features.id, relation: "depends_on", description: "Synthesizes features research" },
      { to: arch.id, relation: "depends_on", description: "Synthesizes architecture research" },
      { to: pitfalls.id, relation: "depends_on", description: "Synthesizes pitfalls research" }
    ],
    created_by_task: "Synthesize all REST API research into executive summary"
  });
  
  // Step 4: Link to project
  await megamemory.link({
    from: summaryConcept.id,
    to: "[project-concept-id]",
    relation: "connects_to",
    description: "Research summary guides project roadmap"
  });
}

// Synthesis helper function
function synthesizeSummary(stack: Concept, features: Concept, arch: Concept, pitfalls: Concept): string {
  return `
**Project:** REST API Builder
**Domain:** REST API
**Researched:** 2025-02-08
**Confidence:** HIGH

**Executive Summary:**
${extractExecutiveSummary(stack, features, arch, pitfalls)}

**Key Findings:**

**Recommended Stack:**
${extractSection(stack.summary, 'Core technologies')}

**Expected Features:**
${extractSection(features.summary, 'Must have')}
${extractSection(features.summary, 'Should have')}

**Architecture Approach:**
${extractSection(arch.summary, 'Major components')}

**Critical Pitfalls:**
${extractTopPitfalls(pitfalls.summary, 5)}

**Implications for Roadmap:**

Based on research, suggested chapter structure:

${generateChapterSuggestions(stack, features, arch, pitfalls)}

**Confidence Assessment:**

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | ${stack.why} |
| Features | HIGH | ${features.why} |
| Architecture | HIGH | ${arch.why} |
| Pitfalls | HIGH | ${pitfalls.why} |

**Overall confidence:** HIGH

**Gaps to Address:**
${extractGaps(stack, features, arch, pitfalls)}
`;
}
```

### Example 2: Generating Roadmap from Research Summary

```typescript
// When agent needs to create roadmap from research summary

async function createRoadmapFromSummary(summaryConceptId: string) {
  const summaryResults = await megamemory_understand({
    query: "research summary",
    top_k: 1
  });
  
  if (summaryResults.length === 0) return;
  
  const summary = summaryResults[0];
  const summaryText = summary.summary;
  
  // Extract chapter suggestions
  const chapters = extractChapters(summaryText);
  
  // Create roadmap concept
  const roadmapConcept = await megamemory.create_concept({
    name: "Roadmap: REST API",
    kind: "config",
    summary: `Roadmap generated from research summary with ${chapters.length} chapters`,
    why: "Roadmap structure based on research findings",
    edges: [
      { to: summaryConceptId, relation: "configured_by", description: "Roadmap follows research summary" }
    ],
    created_by_task: "Create roadmap from research summary"
  });
  
  // Create chapter concepts for each suggested chapter
  const chapterConcepts = [];
  for (const chapter of chapters) {
    const chapterConcept = await megamemory.create_concept({
      name: `Chapter ${chapter.number}: ${chapter.name}`,
      kind: "feature",
      summary: chapter.rationale,
      why: chapter.delivers,
      parent_id: roadmapConcept.id,
      created_by_task: "Create chapter from research summary"
    });
    
    chapterConcepts.push(chapterConcept);
    
    // Link features to chapter
    for (const featureName of chapter.features) {
      const featureConcept = await findOrCreateFeatureConcept(featureName);
      await megamemory.link({
        from: chapterConcept.id,
        to: featureConcept.id,
        relation: "implements",
        description: `Chapter implements ${featureName}`
      });
    }
  }
  
  return { roadmap: roadmapConcept, chapters: chapterConcepts };
}
```

### Example 3: Extracting Research Flags for Planning

```typescript
// When agent needs to identify which chapters need research

async function getResearchFlags(summaryConceptId: string) {
  const summaryResults = await megamemory_understand({
    query: "research summary",
    top_k: 1
  });
  
  if (summaryResults.length === 0) return [];
  
  const summary = summaryResults[0];
  const summaryText = summary.summary;
  
  // Extract research flags section
  const researchFlagsSection = extractSection(summaryText, 'Research Flags:');
  
  const flags = [];
  const lines = researchFlagsSection.split('\n');
  
  for (const line of lines) {
    if (line.includes('**Chapter')) {
      const match = line.match(/\*\*Chapter (\d+): ([^*]+)\*\*: (.+)/);
      if (match) {
        flags.push({
          chapter: match[1],
          name: match[2],
          reason: match[3],
          needsResearch: true
        });
      }
    }
  }
  
  return flags;
}

// Usage
const flags = await getResearchFlags(summaryConceptId);
for (const flag of flags) {
  console.log(`Chapter ${flag.chapter} (${flag.name}): ${flag.reason}`);
  if (flag.needsResearch) {
    console.log(`  → Schedule research-chapter for Chapter ${flag.chapter}`);
  }
}
```

---

## Original Template Reference

<template>

```markdown
# Project Research Summary

**Project:** [name from PROJECT.md]
**Domain:** [inferred domain type]
**Researched:** [date]
**Confidence:** [HIGH/MEDIUM/LOW]

## Executive Summary

[2-3 paragraph overview of research findings]

- What type of product this is and how experts build it
- The recommended approach based on research
- Key risks and how to mitigate them

## Key Findings

### Recommended Stack

[Summary from STACK.md — 1-2 paragraphs]

**Core technologies:**
- [Technology]: [purpose] — [why recommended]
- [Technology]: [purpose] — [why recommended]
- [Technology]: [purpose] — [why recommended]

### Expected Features

[Summary from FEATURES.md]

**Must have (table stakes):**
- [Feature] — users expect this
- [Feature] — users expect this

**Should have (competitive):**
- [Feature] — differentiator
- [Feature] — differentiator

**Defer (v2+):**
- [Feature] — not essential for launch

### Architecture Approach

[Summary from ARCHITECTURE.md — 1 paragraph]

**Major components:**
1. [Component] — [responsibility]
2. [Component] — [responsibility]
3. [Component] — [responsibility]

### Critical Pitfalls

[Top 3-5 from PITFALLS.md]

1. **[Pitfall]** — [how to avoid]
2. **[Pitfall]** — [how to avoid]
3. **[Pitfall]** — [how to avoid]

## Implications for Roadmap

Based on research, suggested chapter structure:

### Chapter 1: [Name]
**Rationale:** [why this comes first based on research]
**Delivers:** [what this chapter produces]
**Addresses:** [features from FEATURES.md]
**Avoids:** [pitfall from PITFALLS.md]

### Chapter 2: [Name]
**Rationale:** [why this order]
**Delivers:** [what this chapter produces]
**Uses:** [stack elements from STACK.md]
**Implements:** [architecture component]

### Chapter 3: [Name]
**Rationale:** [why this order]
**Delivers:** [what this chapter produces]

[Continue for suggested chapters...]

### Chapter Ordering Rationale

- [Why this order based on dependencies discovered]
- [Why this grouping based on architecture patterns]
- [How this avoids pitfalls from research]

### Research Flags

Chapters likely needing deeper research during planning:
- **Chapter [X]:** [reason — e.g., "complex integration, needs API research"]
- **Chapter [Y]:** [reason — e.g., "niche domain, sparse documentation"]

Chapters with standard patterns (skip research-chapter):
- **Chapter [X]:** [reason — e.g., "well-documented, established patterns"]

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | [HIGH/MEDIUM/LOW] | [reason] |
| Features | [HIGH/MEDIUM/LOW] | [reason] |
| Architecture | [HIGH/MEDIUM/LOW] | [reason] |
| Pitfalls | [HIGH/MEDIUM/LOW] | [reason] |

**Overall confidence:** [HIGH/MEDIUM/LOW]

### Gaps to Address

[Any areas where research was inconclusive or needs validation during implementation]

- [Gap]: [how to handle during planning/execution]
- [Gap]: [how to handle during planning/execution]

## Sources

### Primary (HIGH confidence)
- [Context7 library ID] — [topics]
- [Official docs URL] — [what was checked]

### Secondary (MEDIUM confidence)
- [Source] — [finding]

### Tertiary (LOW confidence)
- [Source] — [finding, needs validation]

---
*Research completed: [date]*
*Ready for roadmap: yes*
```

</template>

---

## Guidelines

<guidelines>

**Executive Summary:**
- Write for someone who will only read this section
- Include the key recommendation and main risk
- 2-3 paragraphs maximum

**Key Findings:**
- Summarize, don't duplicate full documents
- Link to detailed docs (STACK.md, FEATURES.md, etc.)
- Focus on what matters for roadmap decisions

**Implications for Roadmap:**
- This is the most important section
- Directly informs roadmap creation
- Be explicit about chapter suggestions and rationale
- Include research flags for each suggested chapter

**Confidence Assessment:**
- Be honest about uncertainty
- Note gaps that need resolution during planning
- HIGH = verified with official sources
- MEDIUM = community consensus, multiple sources agree
- LOW = single source or inference

**Integration with roadmap creation:**
- This file is loaded as context during roadmap creation
- Chapter suggestions here become starting point for roadmap
- Research flags inform chapter planning

</guidelines>
