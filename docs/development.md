# Development

> Contributing to Fuska — setup, build, architecture, and performance benchmarks.

**Audience:** Contributors, anyone evaluating MegaMemory vs file-based storage
**Prerequisites:** [Getting Started](getting-started.md) for end-user install

---

## Directory Structure

```
fuska/
├── provider/
│   ├── opinkode/             # Source format for OpenCode
│   │   ├── command/fuska/    # Slash commands (*.md)
│   │   ├── agents/fuska/     # Agent definitions (*.md)
│   │   └── fuska/            # Shared resources (scripts, references)
│   │
│   └── klod/                 # Generated format for Claude Code (build output)
│       ├── skills/fuska-*/   # Commands as skills (SKILL.md)
│       ├── agents/fuska/     # Agent subagents (*.md)
│       └── fuska/            # Shared resources (copy)
│
├── dist/                     # Compiled TypeScript CLI
│
└── scripts/
    └── build-claude.ts       # Transforms opinkode/ -> klod/
```

---

## Build Process

```bash
npm run build
# 1. tsc           -> Compile TypeScript to dist/
# 2. build:claude  -> Transform provider/opinkode/ to provider/klod/
```

The `build:claude` script:
1. Copies `provider/opinkode/fuska/` -> `provider/klod/fuska/`
2. Transforms commands to skills (adds `allowed-tools` field)
3. Transforms agents to subagents (reformats `tools` field)

---

## Development Workflow

```bash
# One-time setup
npm install
npm run build
npm link                    # Makes 'fuska' command available globally
fuska install opencode      # Creates symlinks to this directory

# Development cycle
npm run build               # Rebuild after changes
# Changes are immediately available (no reinstall needed)

# After pulling updates
npm run build               # Rebuild if TypeScript changed
```

---

## Installation Methods

### CLI Install (End Users)

```bash
npm install -g fuska
fuska install opencode      # or claude or both
```

Creates symlinks from target directories to the npm package location.

**How symlinks work:** When you run `fuska install`, the CLI creates symlinks pointing to the **package root**:
- **npm install -g fuska**: Symlinks point to `node_modules/fuska/`
- **npm link**: Symlinks point to your local development directory

With `npm link`, any changes you make to the source are immediately available to opencode/claude without reinstalling.

### Development Install

For working on Fuska itself:

```bash
# Dev mode: symlinks point to source dir (changes immediately available)
./install-dev.sh

# Install to target (symlinks to source dir)
fuska install opencode
```

**Scripts:**

| Script | Purpose | Result |
|--------|---------|--------|
| `install-dev.sh` | Build + `npm link` | `fuska` command available globally, points to local source |
| `install-pkg.sh` | Build + `npm pack` + install | Production-like install to global node_modules |
| `install-target.sh` | Manual symlink creation | Direct symlinks without CLI (use `opencode` or `claude`) |

### Production-Like Install

To test the package as if installed from npm (symlinks point to global node_modules, not source dir):

```bash
./install-pkg.sh
fuska install opencode
```

This uses `npm pack` to create a tarball, then installs it globally — exactly like `npm install -g fuska` from the registry.

**When to use:**
- Testing the actual installation experience
- Verifying symlinks resolve to the correct global path
- CI/CD testing of the package

### Manual Symlinks

```bash
# OpenCode
ln -s $(pwd)/provider/opinkode/fuska ~/.config/opencode/fuska
ln -s $(pwd)/provider/opinkode/command/fuska ~/.config/opencode/command/fuska
ln -s $(pwd)/provider/opinkode/agents/fuska ~/.config/opencode/agents/fuska

# Claude
ln -s $(pwd)/provider/klod/fuska ~/.claude/fuska
ln -s $(pwd)/provider/klod/agents/fuska ~/.claude/agents/fuska
for skill in provider/klod/skills/fuska-*; do
  ln -s "$(pwd)/$skill" ~/.claude/skills/$(basename $skill)
done
```

---

## Format Transformations

### Command to Skill

OpenCode commands have this frontmatter:
```yaml
---
name: fuska-plan-chapter
description: Create execution plan for chapter
tools:
  - read
  - bash
  - megamemory:understand
---
```

Claude skills need:
```yaml
---
name: fuska-plan-chapter
description: Create execution plan for chapter
allowed-tools: read, bash, megamemory:understand
---
```

The `build-claude.ts` script handles this transformation.

### Agent to Subagent

OpenCode agents:
```yaml
---
name: fuska-planner
description: Creates execution plans
tools:
  read: true
  bash: true
  megamemory:understand: true
---
```

Claude subagents:
```yaml
---
name: fuska-planner
description: Creates execution plans
tools: read, bash, megamemory:understand
---
```

### Deprecated Commands

Commands marked as `deprecated: true` in frontmatter are skipped during the Claude build:

```yaml
---
name: fuska-old-command
deprecated: true
deprecation_message: |
  Use `fuska new-command` instead.
tools:
  - read
  - bash
---
```

These commands:
- Remain in `provider/opinkode/command/fuska/` for backward compatibility
- Are NOT transformed to `provider/klod/skills/`
- Display deprecation notice when invoked

The build script (`scripts/build-claude.ts`) checks for `data.deprecated` and returns `null` to skip transformation.

---

## Performance Benchmarks

> Why MegaMemory replaces `.planning/` markdown files — with numbers.

Data from a real migration: 348 `.planning/` files -> 144 MegaMemory concepts.

### Executive Summary

MegaMemory replaces O(N) file traversal with O(1) semantic search. For a real project with 144 concepts (migrated from 348 markdown files):

- **700x faster** filtering queries (350ms -> 0.5ms)
- **4.4x smaller** storage (2.9 MB -> 0.6 MB)
- **51-101x fewer** tool calls for large queries
- **75-85% less** LLM context usage
- **150x faster** aggregations across many documents

The trade-off: bulk writes with embeddings are slower (50ms per concept for embedding generation). For everything else, MegaMemory wins decisively.

### The O(1) Advantage

MegaMemory's semantic search with embeddings turns N file reads into a single database query:

```typescript
// One call returns everything
const result = await megamemory.understand({ query: 'chapter-01 plans', top_k: 20 });
// Each match includes: .children, .edges, .incoming_edges, .parent
```

`.planning/` requires:
```typescript
// Must read each file separately
await read('.planning/chapter-01/chapter.md');
await read('.planning/chapter-01/context.md');
await read('.planning/chapter-01/plans/01.md');
await read('.planning/chapter-01/plans/02.md');
// ... more files as project grows
```

### Tool Call Overhead

Each tool call carries ~105-210ms overhead (network + context switch). For 100 items, MegaMemory needs **1 call**. Markdown needs **101 calls**:

| Operation | Markdown Calls | MegaMemory Calls | Time Saved |
|-----------|----------------|-------------------|------------|
| Get 50 requirements | 51 | 1 | ~10.2s |
| Filter 50 requirements | 51 | 1 | ~10.2s |
| Search 100 concepts | 101 | 1 | ~20.8s |
| Aggregate stats (10 chapters) | 60+ | 1 | ~12.3s |

### Semantic Search

MegaMemory indexes concepts with embeddings, enabling natural language queries:

```typescript
// Find all authentication-related concepts
const auth = await megamemory.understand({ query: 'authentication security', top_k: 10 });
```

`.planning/` requires external tools:
```bash
grep -r "authentication" .planning/
# Then read each matching file
```

### Query Performance Comparisons

**Single Document Retrieval** ("Get the project state"):

| Approach | Time | Mechanism |
|----------|------|-----------|
| MegaMemory | ~0.5ms | B-tree index lookup |
| .planning/ | ~7ms | SSD read + parse |

**Multiple Documents / Filtering** ("Get all validated requirements" — 50 requirements):

| Approach | Operations | Time |
|----------|-----------|------|
| MegaMemory | 1 SELECT with index | ~0.5ms |
| .planning/ | 50 file reads + parses + filter | ~350ms |

Result: **700x faster**

**Joins / Relationship Traversals** ("Get all plans for chapter-01 with dependencies" — 5 plans, 2 deps each):

| Approach | Operations | Time |
|----------|-----------|------|
| MegaMemory | 1 SELECT with JOIN | ~1-2ms |
| .planning/ | 16 file reads + parses | ~112ms |

Result: **56-112x faster**

**Aggregate Queries** ("Get progress statistics" — 10 chapters, 50 plans):

| Approach | Operations | Time |
|----------|-----------|------|
| MegaMemory | 1 query + in-memory aggregation | ~2ms |
| .planning/ | 60 file reads + manual aggregation | ~300ms |

Result: **150x faster**

**Write Operations** ("Create 15 plan concepts"):

| Approach | Time | Note |
|----------|------|------|
| MegaMemory (no embeddings) | ~4.5ms | 15 INSERTs |
| MegaMemory (with embeddings) | ~754.5ms | +50ms per concept for embedding |
| .planning/ | ~45ms | 15 file writes |

Without embeddings, MegaMemory is 10x faster. With embeddings, markdown is ~17x faster (due to embedding overhead).

**Storage Comparison:**

| Metric | .planning/ Markdown | MegaMemory SQLite | Ratio |
|--------|---------------------|-------------------|-------|
| **Total Size** | 2,868 KB (2.9 MB) | 656 KB (0.6 MB) | **4.4x smaller** |
| **Files/Concepts** | 348 files | 144 concepts | 2.4x fewer objects |

### Trade-off Summary

| Factor | Markdown | MegaMemory |
|--------|-----------|-------------|
| Single doc retrieval | 7ms (read+parse) | **0.5ms** (indexed) |
| Filtering/queries | O(N) scans | **O(log N)** indexed |
| Joins/relationships | Nested file reads | **Single JOIN** |
| Aggregations | Manual in-memory | **Database computed** |
| Bulk writes | 3ms per file | **0.3ms per INSERT** |
| Semantic search | No (grep/scan) | Yes (**Vector search**) |
| Storage efficiency | 2,868 KB | **656 KB (4.4x)** |
| Cross-reference | Manual links | Yes (**Graph traversals**) |
| Tool calls (N items) | O(N) calls | **O(1) calls** |
| Human readability | **Yes** (plain text) | Requires export/viewer |
| Simple setup | **Yes** (files only) | Requires DB setup |
| Git-friendly | **Yes** (file-based VCS) | Database binary |

**Choose MegaMemory for:**
- Projects with 100+ concepts
- Complex queries (filter, join, aggregate)
- Semantic search requirements
- Relationship traversals
- Large-scale operations

**Choose Markdown for:**
- Small projects (< 50 concepts)
- Concept-heavy workflows (10+ creates per operation)
- Human-only editing workflows
- No search/filter requirements

---

## See Also

- [getting-started.md](getting-started.md) — End-user installation guide
- [commands.md](commands.md) — Full command reference
- [concepts.md](concepts.md) — MegaMemory concepts and edge relations
