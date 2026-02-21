# MegaMemory Query Patterns

Quick reference for common MegaMemory queries used across Fuska commands and agents.

## API Reference

```typescript
// Primary query tool — semantic search across all concepts
megamemory:understand({ query: string, top_k?: number })
// Returns: { matches: ConceptMatch[] }

// List root-level concepts (no parent)
megamemory:list_roots()
// Returns: { roots: [...] }
```

## Response Structure

Every `understand` match has this shape:

```typescript
interface ConceptMatch {
  id: string;            // e.g. "my-project/chapter-01"
  name: string;          // e.g. "chapter-01"
  kind: string;          // feature | module | pattern | component | config | decision
  summary: string;       // JSON string — always parse with JSON.parse()
  why: string | null;
  file_refs: string[] | null;
  children: Array<{id, name, kind, summary}>;
  edges: Array<{to, to_name, relation, description}>;
  incoming_edges: Array<{from, from_name, relation, description}>;
  parent: {id, name} | null;
  similarity?: number;   // 0-1, higher = better match
}
```

## Common Queries

### Initiative Root

```typescript
// Get initiative root concept
megamemory_understand({ query: "initiative-root", top_k: 1 })

// Or use list_roots to find all initiatives
megamemory_list_roots()
```

**Parse:** `JSON.parse(match.summary)` → `{ name, what_this_is, core_value }`

### Config

```typescript
// Get initiative configuration
megamemory_understand({ query: "config", top_k: 1 })
```

**Parse:** `JSON.parse(match.summary)` → `{ name, what_this_is, core_value }`

**Note:** Created as `config` by fuska init. Some agents reference it as `fuska-config` — use semantic query to find either.

### State

```typescript
// Get initiative state (current chapter, progress)
megamemory_understand({ query: "state", top_k: 1 })
```

**Parse:** `JSON.parse(match.summary)` → `{ current_chapter, current_plan, status, progress, last_activity }`

### Requirements

```typescript
// Get requirements module + children
megamemory_understand({ query: "requirements", top_k: 5 })

// Individual requirements have kind "feature" and names like "req-AUTH-01"
const reqs = matches.filter(m => m.kind === 'feature' || m.name.startsWith('req-'))
```

**Parse each:** `JSON.parse(match.summary)` → `{ description, status, chapter_ref }`

### Roadmap

```typescript
// Get roadmap with chapter list
megamemory_understand({ query: "roadmap", top_k: 1 })
```

**Parse:** `JSON.parse(match.summary)` → `{ current_milestone: { name, goal }, chapters: [...] }`

### Chapters

```typescript
// Get a specific chapter
megamemory_understand({ query: "chapter-01", top_k: 1 })

// Get all chapters
megamemory_understand({ query: "chapter-", top_k: 50 })

// Filter by type
const chapters = matches.filter(m => m.name.match(/^chapter-\d+$/))        // chapter roots only
const plans = matches.filter(m => m.name.includes('-plan-'))             // plans only
const summaries = matches.filter(m => m.name.includes('-summary'))       // summaries only
const contexts = matches.filter(m => m.name.includes('-context'))        // contexts only
```

**Chapter root parse:** `JSON.parse(match.summary)` → `{ number, name, goal, status, depends_on }`
**Plan parse:** `JSON.parse(match.summary)` → `{ batch, depends_on, objective, requirements, tasks }`
**Summary parse:** `JSON.parse(match.summary)` → `{ chapter, plan, accomplishments, files_modified, ... }`

### Research

```typescript
// Get all research concepts
megamemory_understand({ query: "research stack features architecture pitfalls", top_k: 20 })

// Individual research concepts:
// - research-stack
// - research-features
// - research-architecture
// - research-pitfalls
const research = matches.filter(m => m.name.startsWith('research-'))
```

**Parse:** `JSON.parse(match.summary)` → varies by research type

### Codebase

```typescript
// Get all codebase analysis concepts
megamemory_understand({ query: "codebase", top_k: 10 })

// Individual concepts:
// - codebase-tech
// - codebase-arch
// - codebase-quality
// - codebase-concerns
```

### Todos

```typescript
// Get todos module (counts)
megamemory_understand({ query: "todos", top_k: 50 })

// Filter to find individual todos vs module
const todosModule = matches.find(m => m.name === 'todos')
const individualTodos = matches.filter(m => m.name.startsWith('todo-'))

// Filter by status
const pending = individualTodos.filter(m => {
  const data = JSON.parse(m.summary)
  return data.status === 'pending'
})
```

### Debug Sessions

```typescript
// Get all debug sessions
megamemory_understand({ query: "debug-session", top_k: 20 })

// Debug session concepts have names like "debug-session-auth-failure"
```

### Milestones

```typescript
// Get all milestones
megamemory_understand({ query: "milestone", top_k: 5 })

const milestones = matches.filter(m => m.name.startsWith('milestone-'))
```

## Query Tips

### Use Specific Queries

Prefer specific concept names over generic terms:

```typescript
// Good — specific
megamemory_understand({ query: "chapter-03", top_k: 5 })

// Less good — too broad, may return unrelated matches
megamemory_understand({ query: "chapter", top_k: 50 })
```

### Adjust top_k for Scope

| Scenario | Recommended top_k |
|----------|-------------------|
| Single concept lookup | 1-3 |
| All items in a category | 20-50 |
| Full initiative scan | 100+ |
| Dependency graph building | 10000 (helpers.ts uses this) |

### Parse Summary Safely

Always handle JSON parse failures since summary may contain mixed content:

```typescript
// Using helpers.ts extractJson (finds first { to last })
import { extractJson } from './helpers'
const data = extractJson(match.summary)

// Or manual safe parse
let data = {}
try {
  data = JSON.parse(match.summary)
} catch {
  // summary might be plain text or mixed format
}
```

### Use Children for Hierarchy

`understand` results include `children` arrays — use them to navigate the tree without extra queries:

```typescript
const initiative = matches[0]
// initiative.children = [{id: "requirements", ...}, {id: "roadmap", ...}, {id: "todos", ...}]
```

### Traverse Edges for Relationships

```typescript
const chapter = matches[0]
// chapter.edges = [{to: "initiative-slug", relation: "connects_to"}, ...]
// chapter.incoming_edges = [{from: "chapter-01-plan-1", relation: "connects_to"}, ...]
```

## Concept Kind Reference

| Kind | Used For | Examples |
|------|----------|---------|
| `feature` | Initiative root, chapters, requirements, todos | `my-initiative`, `chapter-01`, `req-AUTH-01` |
| `module` | Grouping containers | `requirements`, `roadmap`, `todos` |
| `pattern` | Research findings | `research-stack`, `research-pitfalls` |
| `component` | Chapter artifacts | `chapter-01-plan-1`, `chapter-01-summary-1`, `chapter-01-context` |
| `config` | State and settings | `config`, `state` |
| `decision` | Architectural choices, milestones | `milestone-v1`, `use-typescript` |

## Edge Relation Reference

| Relation | Meaning | Common Usage |
|----------|---------|-------------|
| `connects_to` | General association | Chapter → initiative, plan → chapter |
| `depends_on` | Prerequisite | Chapter → chapter, plan → plan |
| `implements` | Delivers/builds | Requirement → chapter |
| `calls` | Runtime invocation | Service → service |
| `configured_by` | Configuration link | Config → project, state → project |
