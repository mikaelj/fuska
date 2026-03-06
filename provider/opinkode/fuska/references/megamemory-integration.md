# MegaMemory Integration Guide

## Overview

MegaMemory is a persistent knowledge graph for Fuska projects. All project data is stored as interconnected concepts with semantic relationships, enabling natural language queries, relationship traversal, and context reuse across sessions.

**Why MegaMemory instead of files:** Semantic embeddings enable queries like "authentication patterns" → matches "login", "JWT", "token validation". Edges enable automatic traversal (chapter → plan → summary). All state persists across sessions without file parsing.

> **Status values:** See [status-values.md](status-values.md) for the canonical list of all status values used across chapters, todos, requirements, milestones, and debug sessions.

## Core Concepts

### Concepts

```typescript
interface FuskaConcept {
  id?: string;              // Auto-generated on create
  name: string;             // Unique identifier (e.g., 'chapter-01', 'auth-service')
  kind: ConceptKind;        // Type: feature, module, pattern, component, config, decision
  summary: string;          // Content: JSON + markdown
  why?: string;             // Rationale
  parent_id?: string | null; // Hierarchy parent
  file_refs?: string[] | null;
  edges?: Edge[];           // Relationships
  created_by_task?: string;
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

| Relation | Direction | Usage |
|----------|-----------|-------|
| `connects_to` | A → B | General association |
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

Created by `/fuska-refresh`, queried by `/fuska-ask`. Naming prefixes: `file:path/to/file.ext`, `symbol:SymbolName`, `dead-code:SymbolName`.

## Import Graph Usage by Commands/Agents

| Component | Uses Import Graph? | How |
|-----------|-------------------|-----|
| `fuska-plan` | Direct | Step 6.7.3: Check freshness, auto-refresh if stale, query and format for planner |
| `fuska-planner` | Direct | `load_import_graph_context` step: artifact existence, pattern discovery |
| `fuska-debug` | Direct | Step 3.3: Query related files/symbols, pass to debugger |
| `fuska-executor` | Direct | `load_import_graph` step: disambiguation, impact analysis |
| `fuska-ask` | Direct | Main command for querying import graph |
| `fuska-refresh` | Creates | Creates `file:`, `symbol:`, `dead-code:` concepts |
| `fuska-debugger` | Indirect | Receives context from `fuska-debug` coordinator |
| `fuska-build` | Indirect | Via spawned `fuska-executor` |

### Planner Import Graph Patterns

**Artifact Existence Check:**
```typescript
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
const serviceFiles = Array.from(fileByPath.values())
  .filter(f => f.data.path.includes('services'));
if (serviceFiles.length > 0) {
  const commonImports = serviceFiles[0].data.imports.filter(i => i.includes('repository'));
}
```

**Dead Code Filtering:**
```typescript
if (!match.name.startsWith('dead-code:')) {
  symbolByName.set(data.name, { match, data });
}
```

**Fallback:** If `fileByPath.size === 0`, proceed without artifact checks — all artifacts treated as "create".

## Tool Reference

### megamemory:understand

Query concepts by semantic similarity. Returns concepts with children, edges, and parent context.

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

**Usage:**
```typescript
const chapters = await megamemory.understand({ query: 'chapter', top_k: 100 });
const authConcepts = await megamemory.understand({ query: 'authentication login JWT' });
const plan = await megamemory.understand({ query: 'chapter-01-plan-1' });
const allConcepts = await megamemory.understand({ query: '', top_k: 10000 });
```

### megamemory:create_concept

```typescript
interface CreateConceptResult {
  id: string;          // Generated concept ID
  message: string;     // NOT {concept} — returns {id, message}
}
```

**Usage:**
```typescript
// Create initiative root
const initiative = await megamemory.create_concept({
  name: 'my-initiative', kind: 'feature',
  summary: 'My Awesome Initiative',
  why: 'Solves user authentication problem',
  parent_id: null, edges: []
});

// Create chapter with JSON summary
const chapter = await megamemory.create_concept({
  name: 'chapter-01', kind: 'feature',
  summary: JSON.stringify({ number: 1, slug: 'chapter-01-authentication', name: 'Authentication', goal: 'Implement JWT auth', status: 'planned' }),
  parent_id: 'my-initiative/roadmap',
  edges: [{ to: 'roadmap', relation: 'part_of' }]
});

// Create with JSON+markdown summary
const plan = await megamemory.create_concept({
  name: 'chapter-01-plan-1', kind: 'feature',
  summary: `{"objective": "Implement JWT login", "purpose": "Secure authentication"}

## Objective
Implement JWT login`,
  parent_id: 'chapter-01',  // Now matches parent
  edges: [
    { to: 'chapter-01', relation: 'implements' },
    { to: 'chapter-01-research', relation: 'uses_pattern' }
  ]
});
```

**Best practices:** Use descriptive unique names. Include structured JSON for programmatic access + markdown for readability. Set parent_id for hierarchy. Create edges for all meaningful relationships.

### megamemory:update_concept

Only include fields that changed.

```typescript
interface UpdateConceptParams {
  id: string;
  changes: {            // Only these fields can be updated:
    name?: string; kind?: ConceptKind; summary?: string; why?: string; file_refs?: string[];
    // NOTE: parent_id, edges CANNOT be updated here. Use megamemory:link for edges.
  };
}
// Returns { message: string }
```

**Usage:**
```typescript
// Update chapter status — always query first, preserve existing fields
const chapter = await megamemory.understand({ query: 'chapter-01' });
await megamemory.update_concept({
  id: chapter.concepts[0].id,
  changes: { summary: JSON.stringify({ ...JSON.parse(chapter.concepts[0].summary), status: 'complete' }) }
});

// Add edges — use link, NOT update_concept
await megamemory.link({ from: summaryId, to: 'chapter-01-context', relation: 'uses_knowledge' });
```

### megamemory:link

Create a relationship between two existing concepts.

```typescript
// Returns { message: string }
await megamemory.link({ from: 'chapter-01-plan-1', to: 'chapter-01-research', relation: 'uses_pattern' });
await megamemory.link({ from: 'chapter-01-plan-1-summary', to: 'chapter-01-plan-1', relation: 'completes' });
await megamemory.link({ from: 'milestone-v1', to: 'chapter-01', relation: 'includes' });
```

**When to use:** Use `link` when both concepts already exist. Use `create_concept` with edges when creating a new concept with known relationships.

### megamemory:remove_concept

Soft-delete a concept. History is preserved. Child concepts become orphans. Edges to/from removed concept are NOT automatically cleaned up.

```typescript
const plan = await megamemory.understand({ query: 'chapter-01-plan-1' });
if (plan.concepts.length > 0) {
  await megamemory.remove_concept({ id: plan.concepts[0].id, reason: 'Replaced by chapter-01-plan-2' });
}
```

### megamemory:list_roots

List all top-level concepts (no parent_id). Use for discovering initiatives or loading initial state.

```typescript
const roots = await megamemory.list_roots();
const initiatives = roots.roots.filter(r => r.kind === 'feature');
const initiativeExists = roots.roots.some(r => r.name === initiativeSlug);
```

## Best Practices

### Naming Conventions

| Pattern | Example | Purpose |
|---------|---------|---------|
| `chapter-{number}` | `chapter-1`, `chapter-2` | Sequential chapters |
| `{chapterSlug}-{concept}-{n}` | `chapter-01-plan-1` | Versioned plans |
| `{chapterSlug}-plan-{n}-summary` | `chapter-01-plan-1-summary` | Plan completions |
| `{chapterSlug}-research` | `chapter-01-research` | Chapter research |
| `{chapterSlug}-context` | `chapter-01-context` | Chapter context |
| `{chapterSlug}-verification` | `chapter-01-verification` | Chapter verification |
| `req-{ID}` | `req-AUTH-01` | Requirements |
| `decision-{topic}` | `decision-use-typescript` | Architectural decisions |
| `milestone-{slug}` | `milestone-v1` | Milestones |
| `todo-{id}` | `todo-001` | Todos |

### Summary Structure

**Standard Format: JSON + Markdown.** JSON for programmatic access (`JSON.parse()`), markdown for human readability. MegaMemory indexes the full summary for semantic search.

```typescript
const summary = `{"key": "value", "nested": {"data": "here"}}

## Human Readable Section
Details here...`;
```

### Edge Guidelines

**Always create edges:**

| From | To | Relation |
|------|----|----------|
| Chapter | Roadmap | `part_of` |
| Plan | Chapter | `implements` |
| Summary | Plan | `completes` |
| Summary | Chapter | `updates` |
| Context | Chapter | `configures` |
| Research | Chapter | `informs` |
| Plan | Research | `uses_pattern` |
| Plan | Context | `uses_knowledge` |
| Verification | Chapter | `verifies` |
| Verification | Summary | `reviewed` |

**Rules:** Direction matters (Summary → Plan = "summary completes plan"). Use specific relations (`implements` not `connects_to`). Create bidirectional when needed (Config → Feature `configures`, Feature → Config `configured_by`).

## Common Patterns

### Load Initiative State

```typescript
async function loadInitiativeState(megamemory: MegaMemoryClient, initiativeSlug: string) {
  const initiative = await megamemory.understand({ query: initiativeSlug });
  const state = await megamemory.understand({ query: 'state' });
  const stateData = JSON.parse(state.concepts[0].summary);
  const currentChapter = stateData.current_chapter
    ? await megamemory.understand({ query: stateData.current_chapter })
    : null;
  const chapters = await megamemory.understand({ query: 'chapter-', top_k: 100 });

  const allChapters = chapters.concepts.filter(m => m.kind === 'feature').map(m => JSON.parse(m.summary));
  const completedChapters = allChapters.filter(p => p.status === 'complete').length;

  return {
    initiative: initiative.concepts[0],
    state: stateData,
    currentChapter: currentChapter ? JSON.parse(currentChapter.concepts[0].summary) : null,
    allChapters,
    progress: Math.round((completedChapters / allChapters.length) * 100)
  };
}
```

### Load Full Initiative (Batch Query)

```typescript
async function loadFullInitiativeState(megamemory: MegaMemoryClient) {
  const allConcepts = await megamemory.understand({ query: '', top_k: 10000 });
  const conceptMap = new Map(allConcepts.concepts.map(c => [c.id, c]));
  const nameMap = new Map(allConcepts.concepts.map(c => [c.name, c]));
  const roots = await megamemory.list_roots();
  return { initiative: roots.roots[0], concepts: allConcepts.concepts, byId: conceptMap, byName: nameMap };
}
```

### Load Chapter Context

```typescript
async function loadChapterContext(megamemory: MegaMemoryClient, chapterSlug: string) {
  const chapter = await megamemory.understand({ query: chapterSlug });
  const context = await megamemory.understand({ query: `${chapterSlug}-context` });
  const research = await megamemory.understand({ query: `${chapterSlug}-research` });
  const summaries = await megamemory.understand({ query: `${chapterSlug}-summary`, top_k: 100 });

  return {
    chapter: JSON.parse(chapter.concepts[0].summary),
    context: context.concepts.length > 0 ? JSON.parse(context.concepts[0].summary) : null,
    research: research.concepts.length > 0 ? JSON.parse(research.concepts[0].summary) : null,
    summaries: summaries.concepts.map(s => JSON.parse(s.summary))
  };
}
```

### Create Initiative Root

```typescript
async function createInitiative(megamemory: MegaMemoryClient, config: { slug: string; name: string; what_this_is: string; core_value: string }) {
  const initiative = await megamemory.create_concept({
    name: config.slug, kind: 'feature',
    summary: `Initiative: ${config.name}\n\n${config.what_this_is}`,
    why: config.core_value, parent_id: null, edges: []
  });

  // Create state, config, and roadmap concepts under initiative
  await megamemory.create_concept({
    name: 'state', kind: 'config',
    summary: JSON.stringify({ current_chapter: null, current_plan: null, status: 'initialized', progress: 0, last_activity: new Date().toISOString() }),
    parent_id: config.slug, edges: [{ to: config.slug, relation: 'configures' }]
  });
  await megamemory.create_concept({
    name: 'config', kind: 'config',
    summary: JSON.stringify({ depth: 'medium', autonomous_mode: false }),
    parent_id: config.slug, edges: [{ to: config.slug, relation: 'configures' }]
  });
  await megamemory.create_concept({
    name: 'roadmap', kind: 'module',
    summary: 'Initiative roadmap with chapters',
    parent_id: config.slug, edges: [{ to: config.slug, relation: 'part_of' }]
  });

  return initiative.id;
}
```

### Create Chapter

```typescript
async function createChapter(megamemory: MegaMemoryClient, initiativeSlug: string, config: { number: number; slug: string; name: string; goal: string }) {
  return (await megamemory.create_concept({
    name: `chapter-${config.number}`, kind: 'feature',
    summary: JSON.stringify({ number: config.number, slug: config.slug, name: config.name, goal: config.goal, status: 'planned' }),
    parent_id: `${initiativeSlug}/roadmap`,
    edges: [{ to: 'roadmap', relation: 'part_of' }]
  })).id;
}
```

### Update Plan

```typescript
async function updatePlan(megamemory: MegaMemoryClient, planId: string, updates: Record<string, any>) {
  const plan = await megamemory.understand({ query: planId });
  if (plan.concepts.length === 0) throw new Error(`Plan ${planId} not found`);
  const currentData = JSON.parse(plan.concepts[0].summary);
  await megamemory.update_concept({
    id: plan.concepts[0].id,
    changes: { summary: JSON.stringify({ ...currentData, ...updates }) }
  });
}
```

### Query Related Concepts

```typescript
async function findRelatedConcepts(megamemory: MegaMemoryClient, chapterSlug: string) {
  const related = await megamemory.understand({ query: chapterSlug, top_k: 100 });
  return {
    chapters: related.concepts.filter(m => m.kind === 'feature' && m.name.startsWith('chapter-')),
    plans: related.concepts.filter(m => m.kind === 'feature' && m.name.includes('-plan-')),
    summaries: related.concepts.filter(m => m.kind === 'component' && m.name.includes('-summary')),
    research: related.concepts.filter(m => m.kind === 'pattern' && m.name.includes('-research'))
  };
}
```

### Create Summary After Execution

```typescript
async function createSummary(megamemory: MegaMemoryClient, input: {
  chapterSlug: string; planName: string; accomplishments: string[];
  durationMinutes: number; techStack: { added: string[]; patterns: string[] };
  keyFiles: { created: string[]; modified: string[] };
  keyDecisions: string[]; taskCommits: { task: string; commit: string }[];
}) {
  return (await megamemory.create_concept({
    name: `${input.chapterSlug}-plan-${input.planName.match(/plan-(\d+)/)?.[1] || '1'}-summary`,
    kind: 'component',
    summary: JSON.stringify({
      chapter: input.chapterSlug, plan: input.planName,
      subsystem: input.chapterSlug.replace('chapter-', '').split('-')[0],
      tech_stack: input.techStack, key_files: input.keyFiles,
      key_decisions: input.keyDecisions, duration_minutes: input.durationMinutes,
      completed: new Date().toISOString(), accomplishments: input.accomplishments,
      task_commits: input.taskCommits,
      files_modified: [...input.keyFiles.created, ...input.keyFiles.modified],
      deviations: [], issues_encountered: [], next_chapter_readiness: 'Ready'
    }),
    parent_id: input.chapterSlug,
    edges: [{ to: input.planName, relation: 'completes' }, { to: input.chapterSlug, relation: 'updates' }],
    created_by_task: input.planName
  })).id;
}
```

### Build Dependency Graph

```typescript
async function buildDependencyGraph(megamemory: MegaMemoryClient) {
  const allConcepts = await megamemory.understand({ query: '', top_k: 10000 });
  const graph = new Map<string, Set<string>>();
  const conceptMap = new Map<string, NodeWithContext>();

  for (const concept of allConcepts.concepts) {
    conceptMap.set(concept.id, concept);
    graph.set(concept.id, new Set(concept.edges.map(e => e.to)));
  }

  function* traverse(from: string, visited = new Set<string>()): Generator<NodeWithContext> {
    if (visited.has(from)) return;
    visited.add(from);
    const node = conceptMap.get(from);
    if (node) yield node;
    for (const neighbor of graph.get(from) || []) yield* traverse(neighbor, visited);
  }

  return {
    getRelevantSummaries: (slug: string) => Array.from(traverse(slug)).filter(c => c.kind === 'component' && c.name.includes('-summary-')),
    getDependentChapters: (slug: string) => Array.from(traverse(slug)).filter(c => c.kind === 'feature' && c.name.startsWith('chapter-') && c.id !== slug),
    getTechStackHistory: () => Array.from(traverse('initiative-root')).filter(c => c.kind === 'decision' || c.kind === 'config'),
    getAllConcepts: () => allConcepts.concepts
  };
}
```

### Resume Work Detection

Determine work state from MegaMemory state concept:

```typescript
type WorkStatus = 'ready_to_start' | 'ready_to_plan' | 'ready_to_execute' | 'in_progress' | 'chapter_complete';

async function detectWorkState(megamemory: MegaMemoryClient): Promise<{ status: WorkStatus; currentChapter: string | null; currentPlan: string | null }> {
  const stateQuery = await megamemory.understand({ query: 'state' });
  if (stateQuery.concepts.length === 0) return { status: 'ready_to_start', currentChapter: null, currentPlan: null };

  const state = JSON.parse(stateQuery.concepts[0].summary);

  if (state.current_plan) {
    const summary = await megamemory.understand({ query: `${state.current_plan}-summary` });
    if (summary.concepts.length > 0) return { status: 'chapter_complete', currentChapter: state.current_chapter, currentPlan: null };
    return { status: state.status === 'in_progress' ? 'in_progress' : 'ready_to_execute', currentChapter: state.current_chapter, currentPlan: state.current_plan };
  }

  if (state.current_chapter) {
    const chapter = await megamemory.understand({ query: state.current_chapter });
    if (chapter.concepts.length > 0 && JSON.parse(chapter.concepts[0].summary).status === 'complete')
      return { status: 'chapter_complete', currentChapter: state.current_chapter, currentPlan: null };
    return { status: 'ready_to_plan', currentChapter: state.current_chapter, currentPlan: null };
  }

  return { status: 'ready_to_start', currentChapter: null, currentPlan: null };
}
```

### Find Patterns for Planning

```typescript
async function findRelevantPatterns(megamemory: MegaMemoryClient, chapterSlug: string, domain: string) {
  const contextQuery = await megamemory.understand({ query: `${chapterSlug}-context` });
  const contextKeywords = contextQuery.concepts.length > 0
    ? Object.values(JSON.parse(contextQuery.concepts[0].summary).decisions || {}).join(' ')
    : '';

  const patterns = await megamemory.understand({ query: `${domain} ${contextKeywords} patterns best practices`, top_k: 20 });
  return patterns.concepts
    .filter(m => m.kind === 'pattern')
    .map(m => ({ concept: m, data: JSON.parse(m.summary) }))
    .sort((a, b) => {
      // Score by domain + context keyword matches in summary
      const score = (c: NodeWithContext) => {
        const s = c.summary.toLowerCase();
        return (s.includes(domain.toLowerCase()) ? 10 : 0)
          + contextKeywords.toLowerCase().split(' ').filter(k => k.length > 3 && s.includes(k)).length * 2;
      };
      return score(b.concept) - score(a.concept);
    });
}
```

### Update Chapter Status

> **Canonical chapter statuses:** `pending | planned | in_progress | complete | blocked` — see [status-values.md](status-values.md)

```typescript
async function updateChapterStatus(megamemory: MegaMemoryClient, chapterSlug: string, status: 'pending' | 'planned' | 'in_progress' | 'complete' | 'blocked') {
  const chapter = await megamemory.understand({ query: chapterSlug });
  if (chapter.concepts.length === 0) throw new Error(`Chapter ${chapterSlug} not found`);

  const data = JSON.parse(chapter.concepts[0].summary);
  data.status = status;
  await megamemory.update_concept({ id: chapter.concepts[0].id, changes: { summary: JSON.stringify(data) } });

  // Update state if chapter completed or started
  if (status === 'complete' || status === 'in_progress') {
    const stateQuery = await megamemory.understand({ query: 'state' });
    if (stateQuery.concepts.length > 0) {
      const stateData = JSON.parse(stateQuery.concepts[0].summary);
      stateData.status = status === 'complete' ? 'chapter_complete' : 'in_progress';
      const allChapters = await megamemory.understand({ query: 'chapter-', top_k: 100 });
      const completed = allChapters.concepts.filter(p => JSON.parse(p.summary).status === 'complete').length;
      stateData.progress = Math.round((completed / allChapters.concepts.length) * 100);
      await megamemory.update_concept({ id: stateQuery.concepts[0].id, changes: { summary: JSON.stringify(stateData) } });
    }
  }
}
```

### Create Verification Concept

```typescript
async function createVerification(megamemory: MegaMemoryClient, input: {
  chapterSlug: string; verificationResults: string[]; issuesFound: string[];
  recommendations: string[]; conceptsReviewed: string[];
}) {
  return (await megamemory.create_concept({
    name: `${input.chapterSlug}-verification`, kind: 'component',
    summary: JSON.stringify({ verification_results: input.verificationResults, issues_found: input.issuesFound, recommendations: input.recommendations, concepts_reviewed: input.conceptsReviewed }),
    parent_id: input.chapterSlug,
    edges: [{ to: input.chapterSlug, relation: 'verifies' }, ...input.conceptsReviewed.map(c => ({ to: c, relation: 'reviewed' as const }))]
  })).id;
}
```

### Create Research Concept

```typescript
async function createResearch(megamemory: MegaMemoryClient, input: {
  chapterSlug: string; domain: string; confidence: string; sources: string[];
  standardStack?: string[]; architecturePatterns?: string[]; pitfalls?: string[];
}) {
  return (await megamemory.create_concept({
    name: `${input.chapterSlug}-research`, kind: 'pattern',
    summary: JSON.stringify({ domain: input.domain, confidence: input.confidence, sources: input.sources, standard_stack: input.standardStack || [], architecture_patterns: input.architecturePatterns || [], pitfalls: input.pitfalls || [] }),
    parent_id: input.chapterSlug,
    edges: [{ to: input.chapterSlug, relation: 'informs' }]
  })).id;
}
```

## Error Handling

### Missing Concepts

```typescript
async function getConcept(megamemory: MegaMemoryClient, name: string): Promise<NodeWithContext> {
  const query = await megamemory.understand({ query: name });
  if (query.concepts.length === 0) throw new Error(`Concept "${name}" not found`);
  return query.concepts[0];
}
```

### Safe Parse

```typescript
function safeParseSummary<T>(summary: string, fallback: T): T {
  try { return JSON.parse(summary) as T; }
  catch { return fallback; }
}
```

### Create If Not Exists

```typescript
async function createConceptIfNotExists(megamemory: MegaMemoryClient, concept: FuskaConcept) {
  const existing = await megamemory.understand({ query: concept.name });
  if (existing.concepts.length > 0) return existing.concepts[0];
  await megamemory.create_concept(concept);
  return (await megamemory.understand({ query: concept.name })).concepts[0];
}
```

### Validation

| Field | Rule |
|-------|------|
| `name` | Required |
| `kind` | Required. One of: feature, module, pattern, component, config, decision |
| `summary` | Required |
| `edges[].relation` | One of: implements, part_of, depends_on, configures, completes, uses_pattern, updates, verifies, version_of, calls, connects_to, configured_by, informs, uses_knowledge, reviewed, includes, for_chapter |

## Summary

**Key Principles:**
1. All data in MegaMemory, never on disk
2. Query before work, create after work
3. Use specific relations for accurate traversals
4. Include JSON in summaries for programmatic access
5. Create edges for all meaningful relationships
6. Handle missing concepts gracefully

**Workflow:** `list_roots` → `understand` → `create_concept` → `update_concept` → `link` → `remove_concept`
