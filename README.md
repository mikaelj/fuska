# MegaMemory GSD

Based on [gsd-opencode](https://github.com/rokicool/gsd-opencode). The goal of this project is to replace gsd-opencode's Markdown-file backend with [MegaMemory](https://github.com/0xK3vin/MegaMemory)'s persistent knowledge graph, enabling semantic search and typed relationships instead of flat `.planning/` file storage.

The backend replacement was implemented by Claude Opus 4.6 and GLM-4.7.

THE AUTHOR TAKES NO RESPONSIBILITY OF DATA LOSS IN EXISTING GSD PROJECTS. USE AT YOUR OWN PERIL.

## Theoretical Benchmarks

> **Disclaimer:** The numbers below are theoretical estimates, not measured benchmarks. The starting hypothesis was that handling Markdown files is less efficient than querying a SQLite database — the analysis below explores where that holds and where it doesn't. Real-world performance will vary depending on hardware, embedding provider latency, project size, and caching.

### Raw I/O Speed

| Operation | Markdown | MegaMemory | Factor | Winner |
|-----------|----------|------------|--------|--------|
| Get single document | 7 ms (read + parse) | 0.5 ms (SELECT) | 14x | MegaMemory |
| Filter N documents | 7 ms x N (scan + filter) | 0.5 ms (WHERE) | 14N-700x | MegaMemory |
| JOIN relationships | 7 ms x (1+M+N) | 1-2 ms (JOIN) | 56-112x | MegaMemory |
| Aggregate stats | ~300 ms (full scan) | ~1 ms (COUNT/SUM) | 300x | MegaMemory |
| Write N docs | 8 ms x N | 0.3 ms x N | 27x | MegaMemory |
| Semantic search | N/A (must grep) | 5-10 ms (vector) | - | MegaMemory |
| Create 15 plans | 120 ms | 807 ms | 0.15x | Markdown |
| New project (small) | 60 ms | 750 ms | 0.08x | Markdown |

Embedding generation (~50 ms per concept) is the main bottleneck for write-heavy operations — without it, SQL alone would be 10-300x faster across the board.

### Tool-Call Reduction (LLM Agent Perspective)

For an LLM agent, each tool call carries context-switching overhead (~50-100 ms). Markdown requires an "enumerate then fetch" pattern — `O(N)` calls — while MegaMemory returns results in a single query — `O(1)` calls.

| Operation | Markdown Calls | MegaMemory Calls | Reduction |
|-----------|---------------|-----------------|-----------|
| Get 50 requirements | 51 | 1 | 51x |
| Filter 50 requirements | 51 | 1 | 51x |
| Get 5 plans + deps | 16 | 1 | 16x |
| Search 100 concepts | 101 | 1 | 101x |
| Aggregate stats (10 phases) | 60+ | 1 | 60x |
| Create 15 plans | 15 | 15 | Tie |

### Key Takeaways

**MegaMemory's strengths:** filtering, joins, aggregations, semantic search, and any operation across many concepts — fewer tool calls and faster I/O.

**Markdown's strengths:** write-heavy workflows that create many concepts at once (embedding overhead dominates), and small projects where the difference is negligible.

## Installation

```bash
npm install -g gsd-mm
gsd-mm install
```

Or manually copy the three directories into your OpenCode config:

```bash
# Commands
cp -r opencode/command/gsd-mm/ ~/.config/opencode/command/gsd-mm/

# Agents
cp -r opencode/agents/gsd-mm/ ~/.config/opencode/agents/gsd-mm/

# Scripts, templates, references, and workflows
cp -r opencode/gsd-mm/ ~/.config/opencode/gsd-mm/
```

Use `--force` to overwrite existing directories:
```bash
gsd-mm install --force
```

## Migration from `.planning/`

If you have an existing project using GSD's `.planning/` directory, run the migration script to move everything into MegaMemory.

**Prerequisites:** MegaMemory >= 1.3.1 installed in the target project's `node_modules`.

```bash
gsd-mm migrate [project-dir]
```

The script:
1. Copies `.planning/` to `.planning.backup`
2. Creates MegaMemory concepts from all planning markdown files
3. Validates migration with semantic queries
4. Removes the `.planning/` directory on success

Use `--clean` to delete existing database before migration:

```bash
gsd-mm migrate [project-dir] --clean
```

To rollback, restore from `.planning.backup` and remove `.megamemory/knowledge.db`.

## CLI Commands

### Install
Install GSD-MM commands and agents to OpenCode config:

```bash
gsd-mm install [--force]
```

- `--force`: Overwrite existing directories

### Migrate
Migrate existing `.planning/` directory to MegaMemory:

```bash
gsd-mm migrate [project-dir] [--clean]
```

- `project-dir`: Path to project (defaults to current directory)
- `--clean`: Delete existing database before migration

### Export
Export MegaMemory knowledge graph back to `.planning/` files:

```bash
gsd-mm export --project-dir <path> --output-dir <path> [options]
```

Options:
- `--overwrite`: Overwrite existing files
- `--dry-run`: Show what would be written without writing
- `--debug`: Show concept mapping details
- `--verbose`: Detailed progress output

## OpenCode Commands

Once installed, GSD-MM provides 26 slash commands and 14 agents for project management.

### Core Commands
- `/gsd-mm-help` - Show all available commands
- `/gsd-mm-new-project` - Initialize new GSD project
- `/gsd-mm-quick` - Quick project status overview
- `/gsd-mm-progress` - Show detailed progress
- `/gsd-mm-settings` - Manage GSD settings

### Phase Management
- `/gsd-mm-plan-phase` - Create detailed phase plan
- `/gsd-mm-research-phase` - Research phase requirements
- `/gsd-mm-execute-phase` - Execute phase tasks
- `/gsd-mm-verify-work` - Verify phase completion
- `/gsd-mm-discuss-phase` - Discuss phase details
- `/gsd-mm-add-phase` - Add new phase to project
- `/gsd-mm-insert-phase` - Insert phase between existing phases
- `/gsd-mm-remove-phase` - Remove phase from project
- `/gsd-mm-list-phase-assumptions` - List phase assumptions

### Milestone Management
- `/gsd-mm-new-milestone` - Create new milestone
- `/gsd-mm-audit-milestone` - Audit milestone status
- `/gsd-mm-complete-milestone` - Complete milestone
- `/gsd-mm-plan-milestone-gaps` - Plan gaps between milestones

### Work Management
- `/gsd-mm-pause-work` - Pause current work session
- `/gsd-mm-resume-work` - Resume paused work session
- `/gsd-mm-add-todo` - Add todo item
- `/gsd-mm-check-todos` - Check todo status

### Codebase & Debug
- `/gsd-mm-map-codebase` - Map codebase structure
- `/gsd-mm-debug` - Debug GSD issues
- `/gsd-mm-import` - Import existing project
- `/gsd-mm-export-md` - Export to Markdown

### Configuration
- `/gsd-mm-set-model` - Configure AI model for stages
- `/gsd-mm-set-profile` - Switch model profile

## Quick Start

1. Install GSD-MM: `npm install -g gsd-mm && gsd-mm install`
2. Initialize project: `/gsd-mm-new-project`
3. Plan first phase: `/gsd-mm-plan-phase 1`
4. Execute phase: `/gsd-mm-execute-phase 1`

For full command reference, run `/gsd-mm-help` inside OpenCode.

## Acknowledgments

This project builds upon the work of:

- [gsd-opencode](https://github.com/rokicool/gsd-opencode) - OpenCode integration for Get Shit Done
- [Get Shit Done](https://github.com/gsd-build/get-shit-done) - Original GSD framework and methodology
- [MegaMemory](https://github.com/0xK3vin/MegaMemory) - Persistent knowledge graph backend

Thank you to the creators and contributors of these projects.

## License

MIT
