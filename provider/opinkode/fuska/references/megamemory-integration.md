# MegaMemory Integration Guide

## Overview

MegaMemory is a persistent knowledge graph for Fuska projects. Unlike file-based storage, MegaMemory stores all project data as interconnected concepts with semantic relationships, enabling intelligent querying, context-aware planning, and knowledge reuse across sessions.

### Why MegaMemory Instead of Files?

1. **Semantic Understanding**: Concepts are indexed with embeddings, enabling natural language queries like "What authentication patterns exist?" instead of searching file names.

2. **Relationship Tracing**: Edges connect concepts, so you can traverse dependencies (chapter → plan → summary → research) automatically.

3. **Persistence Across Sessions**: All project state survives restarts without needing to parse JSON/YAML files.

4. **Query Flexibility**: Find concepts by kind, relationships, or semantic similarity in a single call.

5. **Automatic Context Loading**: Understand returns related concepts, their children, edges, and parent context in one operation.

## Core Concepts

### Concepts

Concepts are the atomic units of storage. Each concept represents a project entity (chapter, plan, summary, requirement, etc.).

```typescript
interface FuskaConcept {
  id?: string;              // Auto-generated on create
  name: string;             // Unique identifier (e.g., 'chapter-01', 'auth-service')
  kind: ConceptKind;        // Type: feature, module, pattern, component, config, decision
  summary: string;          // Content: JSON + markdown
  why?: string;            // Rationale for this concept
  parent_id?: string | null; // Hierarchy parent
  file_refs?: string[] | null; // Related files
  edges?: Edge[];           // Relationships
  created_by_task?: string; // Source task
}
```

### Kinds

| Kind | Usage | Examples |
|------|-------|----------|
| `feature` | User-facing functionality | chapter-01, req-AUTH-01, todo-login |
| `module` | Organizational containers | requirements, roadmap, todos |
| `pattern` | Reusable knowledge | chapter-01-research, auth-pattern |
| `component` | Implementation details | chapter-01-plan-1-summary, auth-service |
| `config` | Configuration/state | state, config, chapter-01-context |
| `decision` | Architectural decisions | use-typescript, use-postgres |

### Relationships (Edges)

Edges define how concepts relate to each other. Use specific relations for accurate traversals.

| Relation | Direction | Usage |
|----------|-----------|-------|
| `connects_to` | A → B | General association between concepts |
| `depends_on` | A → B | Requires another concept |
| `implements` | A → B | Delivers/builds |
| `calls` | A → B | Runtime invocation |
| `configured_by` | A → B | Configured by another concept |
| `completes` | A → B | Documents completion |
| `verifies` | A → B | Validates/checks |
| `part_of` | A → B | Containment/membership |
| `produces` | A → B | Creates output/export |
| `consumes` | A → B | Uses output from another |
| `informs` | A → B | Provides knowledge for decisions |
| `includes` | A → B | Container includes children |

### Import Graph Relations (Fuska Refresh)

| Relation | Direction | Usage |
|----------|-----------|-------|
| `imports` | File → File | File A imports from File B |
| `uses` | File → Symbol | File A uses Symbol B |
| `defined_in` | Symbol → File | Symbol A is defined in File B |
| `exports` | File → Symbol | File A exports Symbol B |

These relations are created by `/fuska-refresh` and queried by `/fuska-ask`. Concepts use naming prefixes: `file:path/to/file.ext`, `symbol:SymbolName`, `dead-code:SymbolName`.

## Import Graph Usage by Commands/Agents

| Component | Uses Import Graph? | How |
|-----------|-------------------|-----|
| `fuska-plan-chapter` | Direct | Step 6.7.3: Check freshness, auto-refresh if stale, query and format for planner |
| `fuska-planner` | Direct | `load_import_graph_context` step: artifact existence, pattern discovery |
| `fuska-debug` | Direct | Step 3.3: Query related files/symbols, pass to debugger |
| `fuska-executor` | Direct | `load_import_graph` step: disambiguation, impact analysis |
| `fuska-ask` | Direct | Main command for querying import graph |
| `fuska-refresh` | Creates | Creates `file:`, `symbol:`, `dead-code:` concepts |
| `fuska-debugger` | Indirect | Receives context from `fuska-debug` orchestrator |
| `fuska-build-chapter` | Indirect | Via spawned `fuska-executor` |

### Planner Import Graph Patterns

**Artifact Existence Check:**
```typescript
// In goal-backward step 3 (derive required artifacts)
const artifactFile = fileByPath.get('src/services/auth.service.ts');
if (artifactFile) {
  artifact.action = "extend";
  artifact.existing_exports = artifactFile.data.exports;
} else {
  artifact.action = "create";
}
```

**Pattern Discovery:**
```typescript
// In goal-backward step 4 (derive required wiring)
const serviceFiles = Array.from(fileByPath.values())
  .filter(f => f.data.path.includes('services'));

if (serviceFiles.length > 0) {
  // Extract common import pattern
  const commonImports = serviceFiles[0].data.imports
    .filter(i => i.includes('repository'));
}
```

**Dead Code Filtering:**
```typescript
// Filter when building lookup maps
if (!match.name.startsWith('dead-code:')) {
  symbolByName.set(data.name, { match, data });
}
```

**Fallback Handling:**
```typescript
// If import graph is empty or unavailable
if (fileByPath.size === 0) {
  console.log('Import graph not available - proceeding without artifact checks');
  // Continue planning, all artifacts treated as "create"
}
```

### Embeddings

Every concept summary is indexed with embeddings. This enables semantic search: "authentication" matches "login", "JWT", "token validation" even without exact text matching.

## Tool Reference

### megamemory:understand

Query concepts by semantic similarity or text match. Returns concepts with children, edges, and parent context.

```typescript
interface UnderstandQuery {
  query: string;        // Natural language or text to match
  top_k?: number;       // Max results (default: 10)
}

interface UnderstandResult {
  query: string;
  concepts: NodeWithContext[];  // NOT .matches — use .concepts
  total: number;
}
```

**Usage:**

```typescript
// Find all chapters
const chapters = await megamemory.understand({ query: 'chapter', top_k: 100 });

// Find authentication-related concepts
const authConcepts = await megamemory.understand({ query: 'authentication login JWT' });

// Find specific plan
const plan = await megamemory.understand({ query: 'chapter-01-plan-1' });

// Get everything for context
const allConcepts = await megamemory.understand({ query: '', top_k: 10000 });
```

**Return Format:**

```typescript
interface NodeWithContext {
  id: string;
  name: string;
  kind: string;
  summary: string;       // Always a string — JSON.parse() before use
  why?: string;
  parent_id: string | null;
  parent: NodeWithContext | null;
  file_refs: string[] | null;
  children: NodeWithContext[];
  edges: Edge[];          // Outgoing edges (includes to_name)
  incoming_edges: Edge[];
  similarity?: number;
  // NOTE: No created_at/updated_at fields
}
```

**Examples:**

```typescript
// Load initiative state on resume
async function loadInitiativeState(megamemory: MegaMemoryClient, initiativeSlug: string) {
  // Get initiative root
  const initiative = await megamemory.understand({ query: initiativeSlug });

  // Get state config
  const state = await megamemory.understand({ query: 'state' });
  const stateData = JSON.parse(state.concepts[0].summary);

  // Get current chapter
  const currentChapter = await megamemory.understand({ query: stateData.current_chapter });
  const chapterData = JSON.parse(currentChapter.concepts[0].summary);

  // Get roadmap for progress
  const chapters = await megamemory.understand({ query: 'chapter-', top_k: 100 });

  return {
    initiative: initiative.concepts[0],
    state: stateData,
    currentChapter: chapterData,
    allChapters: chapters.concepts.map(p => JSON.parse(p.summary))
  };
}

// Find relevant patterns for planning
async function findRelevantPatterns(megamemory: MegaMemoryClient, domain: string) {
  const patterns = await megamemory.understand({
    query: `${domain} patterns best practices`,
    top_k: 20
  });

  return patterns.concepts.filter(m => m.kind === 'pattern');
}

// Query chapter's full context
async function loadChapterContext(megamemory: MegaMemoryClient, chapterSlug: string) {
  // Get chapter
  const chapter = await megamemory.understand({ query: chapterSlug });

  // Get context
  const context = await megamemory.understand({ query: `${chapterSlug}-context` });

  // Get research
  const research = await megamemory.understand({ query: `${chapterSlug}-research` });

  // Get all summaries for this chapter
  const summaries = await megamemory.understand({
    query: `${chapterSlug}-summary`,
    top_k: 100
  });

  return {
    chapter: JSON.parse(chapter.concepts[0].summary),
    context: context.concepts.length > 0 ? JSON.parse(context.concepts[0].summary) : null,
    research: research.concepts.length > 0 ? JSON.parse(research.concepts[0].summary) : null,
    summaries: summaries.concepts.map(s => JSON.parse(s.summary))
  };
}
```

### megamemory:create_concept

Create a new concept in the knowledge graph.

```typescript
interface CreateConceptParams {
  concept: FuskaConcept;
}

interface CreateConceptResult {
  id: string;          // Generated concept ID
  message: string;     // NOT {concept} — returns {id, message}
}
```

**Usage:**

```typescript
// Create initiative root
const initiative = await megamemory.create_concept({
  name: 'my-initiative',
  kind: 'feature',
  summary: 'My Awesome Initiative',
  why: 'Solves user authentication problem',
  parent_id: null,
  edges: []
});

// Create chapter
const chapter = await megamemory.create_concept({
  name: 'chapter-1',
  kind: 'feature',
  summary: JSON.stringify({
    number: 1,
    slug: 'chapter-01',
    name: 'Authentication',
    goal: 'Implement JWT authentication',
    status: 'planned'
  }),
  parent_id: 'my-initiative/roadmap',
  edges: [{ to: 'roadmap', relation: 'part_of' }]
});

// Create with markdown
const plan = await megamemory.create_concept({
  name: 'chapter-01-plan-1',
  kind: 'feature',
  summary: `{
    "objective": "Implement JWT login",
    "purpose": "Secure authentication"
  }

## Objective
Implement JWT login

## Purpose
Secure authentication`,
  parent_id: 'chapter-1',
  edges: [
    { to: 'chapter-1', relation: 'implements' },
    { to: 'chapter-01-research', relation: 'uses_pattern' }
  ]
});
```

**Best Practices:**

- Use descriptive, unique names (e.g., `chapter-01-plan-1`, not `plan`)
- Include structured JSON in summary for programmatic access
- Add markdown for human readability
- Set appropriate parent_id for hierarchy
- Create edges for all meaningful relationships
- Include `why` field for architectural decisions

### megamemory:update_concept

Update an existing concept. Only include fields that changed.

```typescript
interface UpdateConceptParams {
  id: string;
  changes: {            // Only these fields can be updated:
    name?: string;
    kind?: ConceptKind;
    summary?: string;
    why?: string;
    file_refs?: string[];
    // NOTE: parent_id, edges, and custom fields CANNOT be updated here.
    // Use megamemory:link to add edges instead.
  };
}

interface UpdateConceptResult {
  message: string;      // NOT {success} — returns {message}
}
```

**Usage:**

```typescript
// Update chapter status
const chapter = await megamemory.understand({ query: 'chapter-01' });
await megamemory.update_concept({
  id: chapter.concepts[0].id,
  changes: {
    summary: JSON.stringify({
      ...JSON.parse(chapter.concepts[0].summary),
      status: 'complete'
    })
  }
});

// Update state config
const state = await megamemory.understand({ query: 'state' });
await megamemory.update_concept({
  id: state.concepts[0].id,
  changes: {
    summary: JSON.stringify({
      current_chapter: 'chapter-02',
      current_plan: null,
      status: 'ready_to_plan',
      progress: 33
    })
  }
});

// Add edge — use link, NOT update_concept (edges can't be updated via changes)
await megamemory.link({
  from: summaryId,
  to: 'chapter-01-context',
  relation: 'uses_knowledge'
});
```

**Best Practices:**

- Always query concept first to get current state
- Preserve existing fields when updating
- Use JSON.parse/stringify for summary updates
- Use `megamemory:link` to add edges (NOT update_concept — edges can't be changed via changes)
- Batch related updates in single call

### megamemory:link

Create a relationship between two existing concepts.

```typescript
interface LinkParams {
  from: string;      // Source concept ID or name
  to: string;        // Target concept ID or name
  relation: string;   // Edge relation type
}

interface LinkResult {
  message: string;      // NOT {success} — returns {message}
}
```

**Usage:**

```typescript
// Link plan to research pattern
await megamemory.link({
  from: 'chapter-01-plan-1',
  to: 'chapter-01-research',
  relation: 'uses_pattern'
});

// Link summary to plan
await megamemory.link({
  from: 'chapter-01-plan-1-summary',
  to: 'chapter-01-plan-1',
  relation: 'completes'
});

// Link milestone to chapters
await megamemory.link({
  from: 'milestone-v1',
  to: 'chapter-01',
  relation: 'includes'
});

// Link decision to component
await megamemory.link({
  from: 'auth-service',
  to: 'decision-use-jwt',
  relation: 'configured_by'
});
```

**When to Use Link vs Create with Edges:**

- **Use `link`**: When both concepts already exist (e.g., connecting summary to plan after creation)
- **Use `create_concept` with edges**: When creating new concept with known relationships

### megamemory:remove_concept

Soft-delete a concept from the knowledge graph. History is preserved.

```typescript
interface RemoveConceptParams {
  id: string;
  reason?: string;   // Optional removal reason
}

interface RemoveConceptResult {
  message: string;      // NOT {success} — returns {message}
}
```

**Usage:**

```typescript
// Remove outdated plan
const plan = await megamemory.understand({ query: 'chapter-01-plan-1' });
if (plan.concepts.length > 0) {
  await megamemory.remove_concept({
    id: plan.concepts[0].id,
    reason: 'Replaced by chapter-01-plan-2'
  });
}

// Remove deprecated pattern
const pattern = await megamemory.understand({ query: 'auth-pattern-legacy' });
if (pattern.concepts.length > 0) {
  await megamemory.remove_concept({
    id: pattern.concepts[0].id,
    reason: 'Deprecated: Use chapter-01-research instead'
  });
}
```

**When to Use:**

- Refactoring chapter plans (remove old versions)
- Removing outdated research
- Deleting completed todos
- Cleaning up test concepts

**Caution:**

- Concept and removal reason are preserved in history
- Child concepts become orphans (they keep parent_id reference)
- Edges to/from removed concept are not automatically cleaned up

### megamemory:list_roots

List all top-level concepts (concepts without parent_id). Useful for discovering initiatives or loading initial state.

```typescript
interface ListRootsResult {
  roots: NodeWithContext[];
}
```

**Usage:**

```typescript
// Get all initiatives
const roots = await megamemory.list_roots();
const initiatives = roots.roots.filter(r => r.kind === 'feature');

// Load specific initiative
const initiativeRoot = roots.roots.find(r => r.name === 'my-initiative');

// Check if initiative exists
const initiativeExists = roots.roots.some(r => r.name === initiativeSlug);

// Initialize initiative if not exists
if (!initiativeExists) {
  await createNewInitiative(initiativeSlug);
}
```

## Best Practices

### Query Patterns

**Load Everything at Start:**

```typescript
async function loadFullInitiativeState(megamemory: MegaMemoryClient) {
  // Get all concepts in one call
  const allConcepts = await megamemory.understand({ query: '', top_k: 10000 });

  // Build indexes for quick lookup
  const conceptMap = new Map(allConcepts.concepts.map(c => [c.id, c]));
  const nameMap = new Map(allConcepts.concepts.map(c => [c.name, c]));

  // Find initiative root
  const roots = await megamemory.list_roots();
  const initiative = roots.roots[0];

  return {
    initiative,
    concepts: allConcepts.concepts,
    byId: conceptMap,
    byName: nameMap
  };
}
```

**Query with Context:**

```typescript
async function loadContextForChapter(megamemory: MegaMemoryClient, chapterSlug: string) {
  // Get chapter
  const chapter = await megamemory.understand({ query: chapterSlug });

  if (chapter.concepts.length === 0) {
    throw new Error(`Chapter ${chapterSlug} not found`);
  }

  const chapterData = JSON.parse(chapter.concepts[0].summary);

  // Get context if exists
  const contextQuery = await megamemory.understand({ query: `${chapterSlug}-context` });
  const context = contextQuery.concepts.length > 0
    ? JSON.parse(contextQuery.concepts[0].summary)
    : null;

  // Get research if exists
  const researchQuery = await megamemory.understand({ query: `${chapterSlug}-research` });
  const research = researchQuery.concepts.length > 0
    ? JSON.parse(researchQuery.concepts[0].summary)
    : null;

  return { chapterData, context, research };
}
```

### Naming Conventions

| Pattern | Example | Purpose |
|---------|---------|---------|
| `chapter-{number}` | `chapter-1`, `chapter-2` | Sequential chapters |
| `{chapterSlug}-{concept}-{n}` | `chapter-01-plan-1`, `chapter-01-plan-2` | Versioned plans |
| `{chapterSlug}-plan-{n}-summary` | `chapter-01-plan-1-summary` | Plan completions |
| `{chapterSlug}-research` | `chapter-01-research` | Chapter research |
| `{chapterSlug}-context` | `chapter-01-context` | Chapter context |
| `{chapterSlug}-uat` | `chapter-01-uat` | Chapter verification |
| `req-{ID}` | `req-AUTH-01`, `req-DATA-02` | Requirements |
| `decision-{topic}` | `decision-use-typescript` | Architectural decisions |
| `milestone-{slug}` | `milestone-v1`, `milestone-mvp` | Milestones |
| `todo-{id}` | `todo-001`, `todo-login` | Todos |

### Summary Structure

**Standard Format: JSON + Markdown**

```typescript
const summary = `{
  "key": "value",
  "nested": {
    "data": "here"
  }
}

## Human Readable Section

### Subsection
Details here...
`;
```

**JSON for Programmatic Access:**

```json
{
  "chapter": "chapter-01",
  "plan": "chapter-01-plan-1",
  "status": "complete",
  "duration_minutes": 60
}
```

**Markdown for Human Readability:**

```markdown
## Chapter
chapter-01 - Authentication

## Status
Complete

## Duration
60 minutes
```

**Why Both?**

- JSON: Easy to parse with `JSON.parse()` in code
- Markdown: Easy to read when viewing concepts directly
- MegaMemory indexes the full summary for semantic search

### Edge Guidelines

**Always Create Edges:**

- Chapter → Roadmap (`part_of`)
- Plan → Chapter (`implements`)
- Summary → Plan (`completes`)
- Summary → Chapter (`updates`)
- Context → Chapter (`configures`)
- Research → Chapter (`informs`)
- Plan → Research (`uses_pattern`)
- Plan → Context (`uses_knowledge`)
- UAT → Chapter (`verifies`)
- UAT → Summary (`reviewed`)

**Edge Relationship Rules:**

1. **Direction matters**: `A → B` means "A relates to B"
   - Summary → Plan (summary completes plan)
   - Plan → Chapter (plan implements chapter)

2. **Use specific relations**: `implements` not `connects_to`
   - Enables accurate traversals
   - Makes queries more precise

3. **Create bidirectional when needed**:
   - Config → Feature (`configures`)
   - Feature → Config (`configured_by`)

## Common Patterns

### Load Initiative State

```typescript
interface InitiativeState {
  initiative: NodeWithContext;
  state: StateData;
  currentChapter: ChapterData | null;
  allChapters: ChapterData[];
  progress: number;
}

async function loadInitiativeState(
  megamemory: MegaMemoryClient,
  initiativeSlug: string
): Promise<InitiativeState> {
  // Get initiative root
  const roots = await megamemory.list_roots();
  const initiative = roots.roots.find(r => r.name === initiativeSlug);

  if (!initiative) {
    throw new Error(`Initiative ${initiativeSlug} not found`);
  }

  // Get state config
  const stateQuery = await megamemory.understand({ query: 'state' });
  if (stateQuery.concepts.length === 0) {
    throw new Error('State concept not found');
  }

  const stateData: StateData = JSON.parse(stateQuery.concepts[0].summary);

  // Get all chapters
  const chaptersQuery = await megamemory.understand({ query: 'chapter-', top_k: 100 });
  const allChapters: ChapterData[] = chaptersQuery.concepts
    .filter(m => m.kind === 'feature')
    .map(m => JSON.parse(m.summary));

  // Get current chapter
  let currentChapter: ChapterData | null = null;
  if (stateData.current_chapter) {
    const currentChapterQuery = await megamemory.understand({ query: stateData.current_chapter });
    if (currentChapterQuery.concepts.length > 0) {
      currentChapter = JSON.parse(currentChapterQuery.concepts[0].summary);
    }
  }

  // Calculate progress
  const completedChapters = allChapters.filter(p => p.status === 'complete').length;
  const progress = Math.round((completedChapters / allChapters.length) * 100);

  return {
    initiative,
    state: stateData,
    currentChapter,
    allChapters,
    progress
  };
}
```

### Create Initiative Root

```typescript
interface InitiativeConfig {
  slug: string;
  name: string;
  what_this_is: string;
  core_value: string;
}

async function createInitiative(
  megamemory: MegaMemoryClient,
  config: InitiativeConfig
): Promise<string> {
  // Create initiative root
  const initiative = await megamemory.create_concept({
    name: config.slug,
    kind: 'feature',
    summary: `Initiative: ${config.name}\n\n${config.what_this_is}`,
    why: config.core_value,
    parent_id: null,
    edges: []
  });

  // Create state config
  await megamemory.create_concept({
    name: 'state',
    kind: 'config',
    summary: JSON.stringify({
      current_chapter: null,
      current_plan: null,
      status: 'initialized',
      progress: 0,
      last_activity: new Date().toISOString()
    }),
    parent_id: config.slug,
    edges: [{ to: config.slug, relation: 'configures' }]
  });

  // Create config
  await megamemory.create_concept({
    name: 'config',
    kind: 'config',
    summary: JSON.stringify({
      depth: 'medium',
      autonomous_mode: false
    }),
    parent_id: config.slug,
    edges: [{ to: config.slug, relation: 'configures' }]
  });

  // Create roadmap module
  await megamemory.create_concept({
    name: 'roadmap',
    kind: 'module',
    summary: 'Initiative roadmap with chapters',
    parent_id: config.slug,
    edges: [{ to: config.slug, relation: 'part_of' }]
  });

  return initiative.id;
}
```

### Create Chapter Concept

```typescript
interface ChapterConfig {
  number: number;
  slug: string;
  name: string;
  goal: string;
}

async function createChapter(
  megamemory: MegaMemoryClient,
  initiativeSlug: string,
  config: ChapterConfig
): Promise<string> {
  const chapterConcept = await megamemory.create_concept({
    name: `chapter-${config.number}`,
    kind: 'feature',
    summary: JSON.stringify({
      number: config.number,
      slug: config.slug,
      name: config.name,
      goal: config.goal,
      status: 'planned'
    }),
    parent_id: `${initiativeSlug}/roadmap`,
    edges: [{ to: 'roadmap', relation: 'part_of' }]
  });

  return chapterConcept.id;
}
```

### Update Plan Concepts

```typescript
interface PlanUpdate {
  planId: string;
  updates: {
    objective?: string;
    purpose?: string;
    output?: string;
    must_haves?: string[];
    tasks?: Task[];
  };
}

async function updatePlan(
  megamemory: MegaMemoryClient,
  update: PlanUpdate
): Promise<void> {
  // Get existing plan
  const plan = await megamemory.understand({ query: update.planId });

  if (plan.concepts.length === 0) {
    throw new Error(`Plan ${update.planId} not found`);
  }

  // Parse current data
  const currentData = JSON.parse(plan.concepts[0].summary);

  // Merge updates
  const updatedData = { ...currentData, ...update.updates };

  // Update concept
  await megamemory.update_concept({
    id: plan.concepts[0].id,
    changes: {
      summary: JSON.stringify(updatedData)
    }
  });
}
```

### Query for Related Concepts

```typescript
async function findRelatedConcepts(
  megamemory: MegaMemoryClient,
  chapterSlug: string
): Promise<{
  chapters: NodeWithContext[];
  plans: NodeWithContext[];
  summaries: NodeWithContext[];
  research: NodeWithContext[];
}> {
  // Get all related to chapter
  const related = await megamemory.understand({
    query: chapterSlug,
    top_k: 100
  });

  // Categorize by kind
  return {
    chapters: related.concepts.filter(m => m.kind === 'feature' && m.name.startsWith('chapter-')),
    plans: related.concepts.filter(m => m.kind === 'feature' && m.name.includes('-plan-')),
    summaries: related.concepts.filter(m => m.kind === 'component' && m.name.includes('-summary')),
    research: related.concepts.filter(m => m.kind === 'pattern' && m.name.includes('-research'))
  };
}

async function traverseEdges(
  megamemory: MegaMemoryClient,
  startId: string,
  relation?: string
): Promise<NodeWithContext[]> {
  // Get starting concept
  const start = await megamemory.understand({ query: startId });

  if (start.concepts.length === 0) {
    return [];
  }

  const visited = new Set<string>();
  const results: NodeWithContext[] = [];

  async function dfs(conceptId: string) {
    if (visited.has(conceptId)) return;
    visited.add(conceptId);

    const concept = await megamemory.understand({ query: conceptId });
    if (concept.concepts.length === 0) return;

    const match = concept.concepts[0];
    results.push(match);

    // Follow edges
    const edgesToFollow = relation
      ? match.edges.filter(e => e.relation === relation)
      : match.edges;

    for (const edge of edgesToFollow) {
      await dfs(edge.to);
    }
  }

  await dfs(startId);
  return results;
}
```

### Create Summary After Execution

```typescript
interface SummaryInput {
  chapterSlug: string;
  planName: string;
  accomplishments: string[];
  durationMinutes: number;
  techStack: { added: string[]; patterns: string[] };
  keyFiles: { created: string[]; modified: string[] };
  keyDecisions: string[];
  taskCommits: { task: string; commit: string }[];
}

async function createSummary(
  megamemory: MegaMemoryClient,
  input: SummaryInput
): Promise<string> {
  const summaryData = {
    chapter: input.chapterSlug,
    plan: input.planName,
    subsystem: extractSubsystem(input.chapterSlug),
    tags: [],
    requires: [],
    provides: [],
    affects: [],
    tech_stack: input.techStack,
    key_files: input.keyFiles,
    key_decisions: input.keyDecisions,
    duration_minutes: input.durationMinutes,
    completed: new Date().toISOString(),
    accomplishments: input.accomplishments,
    task_commits: input.taskCommits,
    files_modified: [...input.keyFiles.created, ...input.keyFiles.modified],
    decisions_made: {},
    deviations: [],
    issues_encountered: [],
    next_chapter_readiness: 'Ready'
  };

  const summaryConcept = await megamemory.create_concept({
    name: `${input.chapterSlug}-plan-${extractPlanNumber(input.planName)}-summary`,
    kind: 'component',
    summary: JSON.stringify(summaryData),
    parent_id: input.chapterSlug,
    edges: [
      { to: input.planName, relation: 'completes' },
      { to: input.chapterSlug, relation: 'updates' }
    ],
    created_by_task: input.planName
  });

  return summaryConcept.id;
}

function extractSubsystem(chapterSlug: string): string {
  return chapterSlug.replace('chapter-', '').split('-')[0];
}

function extractPlanNumber(planName: string): string {
  const match = planName.match(/plan-(\d+)/);
  return match ? match[1] : '1';
}
```

### Build Dependency Graph

```typescript
interface DependencyGraph {
  getRelevantSummaries(chapterSlug: string): NodeWithContext[];
  getDependentChapters(chapterSlug: string): NodeWithContext[];
  getTechStackHistory(): NodeWithContext[];
  getAllConcepts(): NodeWithContext[];
}

async function buildDependencyGraph(
  megamemory: MegaMemoryClient
): Promise<DependencyGraph> {
  // Get all concepts
  const allConcepts = await megamemory.understand({ query: '', top_k: 10000 });

  const graph = new Map<string, Set<string>>();
  const conceptMap = new Map<string, NodeWithContext>();

  // Build adjacency list
  for (const concept of allConcepts.concepts) {
    conceptMap.set(concept.id, concept);
    graph.set(concept.id, new Set());

    for (const edge of concept.edges) {
      graph.get(concept.id)?.add(edge.to);
    }
  }

  // DFS traversal
  function* traverse(from: string): Generator<NodeWithContext> {
    const visited = new Set<string>();

    function* dfs(nodeId: string) {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const node = conceptMap.get(nodeId);
      if (node) yield node;

      const neighbors = graph.get(nodeId);
      if (neighbors) {
        for (const neighbor of neighbors) {
          yield* dfs(neighbor);
        }
      }
    }

    yield* dfs(from);
  }

  return {
    getRelevantSummaries: (chapterSlug: string) => {
      const chapter = conceptMap.get(chapterSlug);
      if (!chapter) return [];

      return Array.from(traverse(chapterSlug))
        .filter(c => c.kind === 'component' && c.name.includes('-summary-'));
    },

    getDependentChapters: (chapterSlug: string) => {
      const chapter = conceptMap.get(chapterSlug);
      if (!chapter) return [];

      return Array.from(traverse(chapterSlug))
        .filter(c => c.kind === 'feature' && c.name.startsWith('chapter-'))
        .filter(c => c.id !== chapterSlug);
    },

    getTechStackHistory: () => {
      return Array.from(traverse('initiative-root'))
        .filter(c => c.kind === 'decision' || c.kind === 'config');
    },

    getAllConcepts: () => {
      return allConcepts.concepts;
    }
  };
}
```

### Resume Work Detection

```typescript
interface WorkState {
  status: 'ready_to_start' | 'ready_to_plan' | 'ready_to_execute' | 'in_progress' | 'chapter_complete';
  currentChapter: string | null;
  currentPlan: string | null;
  incompleteTask?: string;
}

async function detectWorkState(
  megamemory: MegaMemoryClient
): Promise<WorkState> {
  // Get state
  const stateQuery = await megamemory.understand({ query: 'state' });

  if (stateQuery.concepts.length === 0) {
    return {
      status: 'ready_to_start',
      currentChapter: null,
      currentPlan: null
    };
  }

  const stateData = JSON.parse(stateQuery.concepts[0].summary);

  // Check if plan exists
  if (stateData.current_plan) {
    const planQuery = await megamemory.understand({ query: stateData.current_plan });

    // Check if summary exists (plan completed)
    const summaryQuery = await megamemory.understand({
      query: `${stateData.current_plan}-summary`
    });

    if (summaryQuery.concepts.length > 0) {
      // Plan completed, ready for next chapter
      return {
        status: 'chapter_complete',
        currentChapter: stateData.current_chapter,
        currentPlan: null
      };
    } else {
      // Plan in progress
      return {
        status: stateData.status === 'in_progress' ? 'in_progress' : 'ready_to_execute',
        currentChapter: stateData.current_chapter,
        currentPlan: stateData.current_plan
      };
    }
  }

  // Chapter exists, no plan
  if (stateData.current_chapter) {
    const chapterQuery = await megamemory.understand({ query: stateData.current_chapter });

    if (chapterQuery.concepts.length > 0) {
      const chapterData = JSON.parse(chapterQuery.concepts[0].summary);

      if (chapterData.status === 'complete') {
        return {
          status: 'chapter_complete',
          currentChapter: stateData.current_chapter,
          currentPlan: null
        };
      }

      return {
        status: 'ready_to_plan',
        currentChapter: stateData.current_chapter,
        currentPlan: null
      };
    }
  }

  return {
    status: 'ready_to_start',
    currentChapter: null,
    currentPlan: null
  };
}
```

### Find Patterns for Planning

```typescript
interface PatternMatch {
  concept: NodeWithContext;
  relevance: number;
  data: any;
}

async function findRelevantPatterns(
  megamemory: MegaMemoryClient,
  chapterSlug: string,
  domain: string
): Promise<PatternMatch[]> {
  // Get chapter context
  const contextQuery = await megamemory.understand({ query: `${chapterSlug}-context` });

  let contextKeywords = '';
  if (contextQuery.concepts.length > 0) {
    const contextData = JSON.parse(contextQuery.concepts[0].summary);
    contextKeywords = Object.values(contextData.decisions || {}).join(' ');
  }

  // Search for patterns
  const patternsQuery = await megamemory.understand({
    query: `${domain} ${contextKeywords} patterns best practices`,
    top_k: 20
  });

  // Filter patterns
  const patterns: PatternMatch[] = patternsQuery.concepts
    .filter(m => m.kind === 'pattern')
    .map(m => ({
      concept: m,
      relevance: calculateRelevance(m, domain, contextKeywords),
      data: JSON.parse(m.summary)
    }))
    .sort((a, b) => b.relevance - a.relevance);

  return patterns;
}

function calculateRelevance(
  concept: NodeWithContext,
  domain: string,
  context: string
): number {
  const summary = concept.summary.toLowerCase();
  const domainLower = domain.toLowerCase();
  const contextLower = context.toLowerCase();

  let relevance = 0;

  // Domain match
  if (summary.includes(domainLower)) {
    relevance += 10;
  }

  // Context keyword matches
  const contextKeywords = contextLower.split(' ');
  for (const keyword of contextKeywords) {
    if (keyword.length > 3 && summary.includes(keyword)) {
      relevance += 2;
    }
  }

  // NOTE: NodeWithContext has no created_at/updated_at fields.
  // If recency matters, store a timestamp in the summary JSON.

  return relevance;
}
```

### Update Chapter Status

```typescript
type ChapterStatus = 'planned' | 'in_progress' | 'complete' | 'blocked';

async function updateChapterStatus(
  megamemory: MegaMemoryClient,
  chapterSlug: string,
  status: ChapterStatus
): Promise<void> {
  // Get chapter
  const chapter = await megamemory.understand({ query: chapterSlug });

  if (chapter.concepts.length === 0) {
    throw new Error(`Chapter ${chapterSlug} not found`);
  }

  // Parse and update
  const chapterData = JSON.parse(chapter.concepts[0].summary);
  chapterData.status = status;

  // Update concept
  await megamemory.update_concept({
    id: chapter.concepts[0].id,
    changes: {
      summary: JSON.stringify(chapterData)
    }
  });

  // Update state if chapter changed
  if (status === 'complete' || status === 'in_progress') {
    const stateQuery = await megamemory.understand({ query: 'state' });

    if (stateQuery.concepts.length > 0) {
      const stateData = JSON.parse(stateQuery.concepts[0].summary);
      stateData.status = status === 'complete' ? 'chapter_complete' : 'in_progress';

      // Calculate progress
      const allChapters = await megamemory.understand({ query: 'chapter-', top_k: 100 });
      const completed = allChapters.concepts.filter(p => {
        const data = JSON.parse(p.summary);
        return data.status === 'complete';
      }).length;

      stateData.progress = Math.round((completed / allChapters.concepts.length) * 100);

      await megamemory.update_concept({
        id: stateQuery.concepts[0].id,
        changes: {
          summary: JSON.stringify(stateData)
        }
      });
    }
  }
}
```

### Create UAT Concept

```typescript
interface UATInput {
  chapterSlug: string;
  verificationResults: string[];
  issuesFound: string[];
  recommendations: string[];
  conceptsReviewed: string[];
}

async function createUAT(
  megamemory: MegaMemoryClient,
  input: UATInput
): Promise<string> {
  const uatData = {
    verification_results: input.verificationResults,
    issues_found: input.issuesFound,
    recommendations: input.recommendations,
    concepts_reviewed: input.conceptsReviewed
  };

  const uatConcept = await megamemory.create_concept({
    name: `${input.chapterSlug}-uat`,
    kind: 'component',
    summary: JSON.stringify(uatData),
    parent_id: input.chapterSlug,
    edges: [
      { to: input.chapterSlug, relation: 'verifies' },
      ...input.conceptsReviewed.map(c => ({
        to: c,
        relation: 'reviewed' as const
      }))
    ]
  });

  return uatConcept.id;
}
```

### Create Research Concept

```typescript
interface ResearchInput {
  chapterSlug: string;
  domain: string;
  confidence: string;
  sources: string[];
  standardStack?: string[];
  architecturePatterns?: string[];
  pitfalls?: string[];
}

async function createResearch(
  megamemory: MegaMemoryClient,
  input: ResearchInput
): Promise<string> {
  const researchData = {
    domain: input.domain,
    confidence: input.confidence,
    sources: input.sources,
    standard_stack: input.standardStack || [],
    architecture_patterns: input.architecturePatterns || [],
    pitfalls: input.pitfalls || []
  };

  const researchConcept = await megamemory.create_concept({
    name: `${input.chapterSlug}-research`,
    kind: 'pattern',
    summary: JSON.stringify(researchData),
    parent_id: input.chapterSlug,
    edges: [{ to: input.chapterSlug, relation: 'informs' }]
  });

  return researchConcept.id;
}
```

## Error Handling

### Missing Concepts

```typescript
async function getConcept(
  megamemory: MegaMemoryClient,
  name: string
): Promise<NodeWithContext> {
  const query = await megamemory.understand({ query: name });

  if (query.concepts.length === 0) {
    throw new Error(`Concept "${name}" not found`);
  }

  return query.concepts[0];
}

// Usage with try/catch
try {
  const chapter = await getConcept(megamemory, 'chapter-01');
  // Use chapter
} catch (error) {
  console.error('Chapter not found:', error);
  // Handle missing chapter
}
```

### Parse Errors

```typescript
function safeParseSummary<T>(summary: string, fallback: T): T {
  try {
    return JSON.parse(summary) as T;
  } catch (error) {
    console.warn('Failed to parse summary:', error);
    return fallback;
  }
}

// Usage
const chapter = await getConcept(megamemory, 'chapter-01');
const chapterData = safeParseSummary(chapter.summary, {
  number: 1,
  status: 'unknown',
  goal: 'Unknown'
});
```

### ID Conflicts

```typescript
async function createConceptIfNotExists(
  megamemory: MegaMemoryClient,
  concept: FuskaConcept
): Promise<NodeWithContext> {
  // Check if exists
  const existing = await megamemory.understand({ query: concept.name });

  if (existing.concepts.length > 0) {
    console.warn(`Concept "${concept.name}" already exists, skipping creation`);
    return existing.concepts[0];
  }

  // Create new
  const result = await megamemory.create_concept(concept);
  const created = await megamemory.understand({ query: concept.name });

  return created.concepts[0];
}
```

### Retry Pattern

```typescript
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.warn(`Operation failed (attempt ${i + 1}/${maxRetries}):`, error);

      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }

  throw lastError;
}

// Usage
const chapter = await retryOperation(() => getConcept(megamemory, 'chapter-01'));
```

### Validation

```typescript
function validateConcept(concept: FuskaConcept): string[] {
  const errors: string[] = [];

  // Required fields
  if (!concept.name) errors.push('name is required');
  if (!concept.kind) errors.push('kind is required');
  if (!concept.summary) errors.push('summary is required');

  // Valid kinds
  const validKinds = ['feature', 'module', 'pattern', 'component', 'config', 'decision'];
  if (!validKinds.includes(concept.kind)) {
    errors.push(`kind must be one of: ${validKinds.join(', ')}`);
  }

  // Valid relations in edges
  if (concept.edges) {
    const validRelations = [
      'implements', 'part_of', 'depends_on', 'configures', 'completes',
      'uses_pattern', 'updates', 'verifies', 'version_of', 'calls',
      'connects_to', 'configured_by', 'informs', 'uses_knowledge',
      'reviewed', 'includes', 'for_chapter'
    ];

    for (const edge of concept.edges) {
      if (!validRelations.includes(edge.relation)) {
        errors.push(`invalid relation: ${edge.relation}`);
      }
    }
  }

  return errors;
}

async function createValidatedConcept(
  megamemory: MegaMemoryClient,
  concept: FuskaConcept
): Promise<{ id: string; message: string }> {
  const errors = validateConcept(concept);

  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }

  return await megamemory.create_concept(concept);
}
```

## Summary

MegaMemory provides a persistent, semantic knowledge graph for Fuska projects. By storing all project data as interconnected concepts, you enable intelligent querying, automatic context loading, and knowledge reuse across sessions.

**Key Principles:**

1. **All data in MegaMemory**, never on disk
2. **Query before work, create after work**
3. **Use specific relations for accurate traversals**
4. **Include JSON in summaries for programmatic access**
5. **Create edges for all meaningful relationships**
6. **Handle missing concepts gracefully**
7. **Validate before creating concepts**

**Workflow:**

1. `list_roots` - Discover initiatives
2. `understand` - Load relevant context
3. `create_concept` - Add new knowledge
4. `update_concept` - Modify existing
5. `link` - Connect concepts
6. `remove_concept` - Clean up (soft delete)

This integration guide provides working TypeScript code for all common patterns. Adapt these examples to your specific use case.
