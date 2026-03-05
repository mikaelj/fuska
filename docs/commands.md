# Command Reference

> Every CLI command and slash command in Fuska.

**Audience:** Daily users
**Prerequisites:** [Getting Started](getting-started.md), [Key Concepts](concepts.md)

---

## CLI Commands

| Command | Description | Arguments |
|---------|-------------|-----------|
| <nobr>`fuska init [description...]`</nobr> | Initialize project with "main" initiative | `--no-map` to skip codebase mapping |
| <nobr>`fuska install`</nobr> | Install commands and agents via symlinks | `--opencode`, `--claude`, `--both`, `--force`, `--dry-run` |
| <nobr>`fuska migrate planning [dir]`</nobr> | Migrate `.planning/` to MegaMemory | `--clean` to delete existing DB first |
| <nobr>`fuska migrate multi-initiative`</nobr> | Migrate existing initiative to pointer model | -- |
| <nobr>`fuska migrate roadmap [dir]`</nobr> | Migrate roadmap to JSON format with parent_id fixes | `--dry-run`, `--verbose` |
| <nobr>`fuska migrate terminology [dir]`</nobr> | Rename phase→chapter and wave→batch in existing MegaMemory database | -- |
| <nobr>`fuska config [dir]`</nobr> | Manage Fuska settings (profiles, workflow modes, git strategy, overrides) | `-v, --view` for non-interactive view; `--check [--json]` for integrity validation |
| <nobr>`fuska export`</nobr> | Export knowledge graph to `.planning/` files | `--project-dir <path>`, `--output-dir <path>`, `--overwrite`, `--dry-run`, `--debug`, `--verbose` |
| <nobr>`fuska initiative list`</nobr> | List all initiatives sorted by recent activity | -- |
| <nobr>`fuska initiative switch [slug]`</nobr> | Switch to another initiative | `[slug]` -- initiative to switch to |
| <nobr>`fuska todo`</nobr> | List completed and pending tasks | -- |
| <nobr>`fuska lessons`</nobr> | Query and display lessons-learned concepts from MegaMemory | `--json` for JSON output |
| <nobr>`fuska info`</nobr> | Display codebase and domain mappings from MegaMemory | `--long` for all files, `--verbose` for small domains |
| <nobr>`fuska help [command]`</nobr> | Show help for Fuska commands | `[command]` -- specific command for detailed help |
| <nobr>`fuska progress`</nobr> | Check project progress and show next action | `--json` for machine-readable output |
| <nobr>`fuska refresh [args...]`</nobr> | Refresh import graph with file and symbol-level indexing | `--full`, `--dead-code`, `--json`, `--prune` |
| <nobr>`fuska ask [args...]`</nobr> | Ask questions about the codebase using import graph data | `[question]` |
| <nobr>`fuska git message [args...]`</nobr> | Test and preview commit messages using Fuska rules | -- |
| <nobr>`fuska git worktree add <name>`</nobr> | Create git worktree with shared context | `--no-context`, `-f, --force` |
| <nobr>`fuska git worktree merge <name>`</nobr> | Merge worktree (MM + git) | `--only-git`, `--only-megamemory`, `--dry-run`, `--keep <strategy>`, `--force` |

### `fuska help` Example

Shows detailed help for any Fuska command:

```
fuska help do

/fuska-do [mode] [description]

Execute unplanned tasks with mode-aware agent chain.

Modes:
  planned    Planner → Builder → Code Reviewer (auto-build)
  checked    + Plan Checker (ask first)
  researched + Researcher (ask first)
  verified   Full pipeline + Code Reviewer + Reviewer (auto-build)

Flags:
  --review          Force plan review before executing
  --no-review       Skip plan review (auto-execute)
  --auto-commit     Auto-commit without prompt
  --no-code-review  Skip code review loop
  --code-review     Force code review loop (already default)

Examples:
  /fuska-do planned fix typo in README
  /fuska-do checked add input validation
  /fuska-do verified implement auth --auto-commit
```

Run `fuska help` without arguments to see all available commands.

### `fuska progress` Example

Shows current initiative, completed chapters, next steps, ad-hoc tasks, and recommended actions:

```
Initiative main using standard planning depth (balanced) mode

Done:
* Chapter 1.1: Created training configuration for Swedish voices (sv_SE-lisa-medium, sv_SE-nst-medium)
* Chapter 1.2: Created PreRollBuffer class with thread-safe 500ms circular buffer

Future:
* Chapter 2: User can navigate hierarchical menu by voice with Swedish name-based commands
* Chapter 3: User can control audio playback with Swedish voice commands

Next:
* Chapter 1: User can activate the assistant with Swedish wake word "Snabeldrake"
  Planning complete. No context gathered. (Run "/fuska-design 1" to add context)

Run "/fuska-build 1" to continue
```

**Ad-hoc task sections:**
- **Pending ad-hoc tasks** — Tasks with `task_number` not yet completed, sorted by date (newest first)
- **Completed ad-hoc tasks** — Tasks with `task_number` that are complete
- **Unknown tasks** — Tasks missing `task_number` (shown with slug only for `fuska do` identification)

Auxiliary concepts (ending in `-research`, `-summary`, `-verification`) are filtered from these lists.

Use `--json` for machine-readable output.

---

## Slash Commands

### Universal Entry Point

| Command | Description | Arguments |
|---------|-------------|-----------|
| <nobr>`/fuska`</nobr> | Universal entry point -- navigate, plan, execute, and more | `[verb] [args]` -- see below; bare invocation shows current position and next step |

`/fuska` routes to all other commands. Run it bare to see where you are, or with a verb: `/fuska-plan`, `/fuska-build`, `/fuska-do fix the bug`, etc. Chapter numbers are auto-detected.

### Initiative Setup

| Command | Description | Arguments |
|---------|-------------|-----------|
| <nobr>`/fuska-configure`</nobr> | Configure existing initiative (run after `fuska init`) | -- |
| <nobr>`/fuska-map-codebase`</nobr> | Map codebase structure, business domains, and import graph | `[area]` -- optional area to focus on |
| <nobr>`/fuska-import`</nobr> | Import existing initiative | -- |

> **Note:** `fuska init` runs `/fuska-map-codebase` automatically (unless `--no-map`), so you only need to run it manually to re-map after significant structural changes.

### Chapter Workflow

| Command | Description | Arguments |
|---------|-------------|-----------|
| <nobr>`/fuska-design`</nobr> | Design chapter details before planning | `<N>` -- chapter number |
| <nobr>`/fuska-plan`</nobr> | Create detailed chapter plan | `<N>` `[--research \| --skip-research \| --skip-verify \| --mode <MODE>]` |
| <nobr>`/fuska-research-chapter`</nobr> | Research chapter requirements | `<N>` -- chapter number |
| <nobr>`/fuska-build`</nobr> | Build chapter tasks | `<N>` `[--mode <MODE>] [--no-code-review]` -- chapter number, optional mode override, optional code review skip |
| <nobr>`/fuska-review`</nobr> | Review chapter completion | `<N>` -- chapter number |

### Chapter Management

| Command | Description | Arguments |
|---------|-------------|-----------|
| <nobr>`/fuska-add-chapter`</nobr> | Add new chapter to current milestone | `<desc>` -- chapter description |
| <nobr>`/fuska-insert-chapter`</nobr> | Insert chapter between existing chapters | `<N> <desc>` -- position and description |
| <nobr>`/fuska-remove-chapter`</nobr> | Remove chapter from project | `<N>` -- chapter number |

### Plan Management

| Command | Description | Arguments |
|---------|-------------|-----------|
| <nobr>`/fuska-chapterize`</nobr> | Transform large plans or planning context into chapter structures with subplans | `[plan-id] [--research]` -- optional plan ID, optional research flag |

**`/fuska-chapterize` modes:**

**Two modes:**

1. **Explicit mode** (`/fuska-chapterize task-015-large-feature`)
   - Loads plan from MegaMemory by ID
   - Use when: You have a known large plan that needs restructuring
   - Requires: Plan concept ID

2. **Context mode** (`/fuska-chapterize`)
   - Extracts tasks from current conversation
   - Use when: Planning discussion evolved into actionable work
   - Requires: Current conversation with 5+ tasks discussed

**Research flag** (`--research`): Enable research phase (skip interactive prompt)

**Auto-detection:**
- `/fuska-do` automatically suggests chapterization for plans with >5 tasks
- Fuska-planner marks plans with `large_plan=true` flag when exceeding threshold
- Select "Chapterize this plan" in review loop to trigger manually

**Context mode example:**
```bash
# Planning conversation about API rate limiting...
# "We need rate limiting, caching, retries, backoff, monitoring..."
# (discussion continues with 7-8 tasks emerging)

/fuska-chapterize
# ? Chapter name: API Rate Limiting & Resilience
# ? Chapter goal: Robust API with rate limiting, caching, and monitoring
# ? Research domain? No

# Creates: chapter-03 with 3 subplans (3-3-2 task split)
# Result: chapter-03-plan-01, chapter-03-plan-02, chapter-03-plan-03
```

**Mode comparison:**
| Mode | Use When | Example |
|------|----------|---------|
| Explicit | Known large plan | `/fuska-chapterize task-015` |
| Context | Evolved discussion | `/fuska-chapterize` |

**See also:** [workflow.md](workflow.md#transforming-large-plans) for detailed examples

### Milestones

| Command | Description | Arguments |
|---------|-------------|-----------|
| <nobr>`/fuska-new-milestone`</nobr> | Create new milestone | `[name]` -- milestone name |
| <nobr>`/fuska-audit`</nobr> | Audit milestone status | -- |
| <nobr>`/fuska-complete`</nobr> | Mark milestone complete | -- |
| <nobr>`/fuska-plan-milestone-gaps`</nobr> | Plan gaps between milestones | -- |

### Work Management

| Command | Description | Arguments |
|---------|-------------|-----------|
| <nobr>`/fuska-add-todo`</nobr> | Add global todo item | `[description]` -- auto-extracts from conversation if omitted |
| <nobr>`/fuska-add-chapter-todo`</nobr> | Add chapter-scoped todo item | `<N> <description>` -- chapter number and todo description |
| <nobr>`/fuska-check-todos`</nobr> | View all todos | -- |

### Codebase Analysis

| Command | Description | Arguments |
|---------|-------------|-----------|
| <nobr>`/fuska-refresh`</nobr> | Refresh import graph with file and symbol-level indexing | `[--full] [--dead-code] [--json] [--prune]` |
| <nobr>`/fuska-ask`</nobr> | Ask questions about the codebase using import graph data | `[question]` |

`/fuska-map-codebase` automatically runs a full import graph refresh, so after `fuska init` both the high-level codebase understanding and the granular file/symbol import graph are available.

**`/fuska-refresh` flags:**
- `--full` -- Force full re-scan (ignore incremental)
- `--dead-code` -- Only show dead code report, skip refresh
- `--json` -- Output as JSON for scripts
- `--prune` -- Remove dead code concepts that are no longer dead

**`/fuska-ask` question types:**
- `"What imports X?"` -- Find files that import a file
- `"Who uses Symbol?"` -- Find files that use a symbol
- `"Is X dead code?"` -- Check if symbol has no usage
- `"What if I delete X?"` -- Impact analysis
- `"Where is Symbol defined?"` -- Locate symbol definition
- `"What does X export?"` -- List exported symbols

Falls back to grep when import graph data is unavailable.

### Ad-hoc Tasks

| Command | Description | Arguments |
|---------|-------------|-----------|
| <nobr>`/fuska-do`</nobr> | Execute unplanned tasks with mode-aware agent chain | `[mode] [description]` -- mode: planned/checked/researched/verified, flags: --review/--no-review/--auto-commit/--code-review/--no-code-review |
| <nobr>`/fuska-help`</nobr> | Show all available commands | -- |

### Documentation

| Command | Description | Arguments |
|---------|-------------|-----------|
| <nobr>`/fuska-doc`</nobr> | Create documentation as deliverables | `[mode] <topic> [--type TYPE] [--audience AUD] [--depth DEPTH] [--output PATH]` |

**Document types:** `architecture`, `implementation`, `story-breakdown`, `design`, `migration`, `guide`

**Audiences:** `self`, `team`, `stakeholder`, `contractor`

**Depths:** `brief` (3-4 sections), `standard` (5-7 sections), `comprehensive` (8-12 sections)

**Modes:**
- **Planned** (default): Plan -> Write
- **Checked**: Plan -> Check -> Write
- **Researched**: Research -> Plan -> Check -> Write
- **Verified**: Research -> Plan -> Check -> Write -> Review (full quality assurance)

**Examples:**
```bash
/fuska-doc API authentication flow --type implementation --audience team
/fuska-doc verified Migration plan --type migration --audience stakeholder
/fuska-doc System architecture --type architecture --output docs/arch.md
```

### Git Integration

| Command | Description | Arguments |
|---------|-------------|-----------|
| <nobr>`/fuska-git-message`</nobr> | Generate Fuska commit messages or regenerate for existing commits/ranges | `<commit-hash \| commit-range \| chapter-X-plan-Y>` |

**Modes:**

1. **Commit range mode:** Generate unified commit message for multiple commits (e.g., `HEAD~5..HEAD`, `abc123..def456`)
2. **Commit hash mode:** Replay existing commit's diff and regenerate message under current rules
3. **Working tree mode:** Generate commit message for uncommitted changes

**Examples:**
```bash
/fuska-git-message HEAD~5..HEAD                    # Range mode
/fuska-git-message abc123..def456 chapter-02-plan-03  # Range with explicit chapter-plan
/fuska-git-message abc123                          # Single commit replay
/fuska-git-message chapter-02-plan-01                # Working tree mode
```

**Features:**
- Auto-detects chapter-plan from most recent commit (full format: `chapter-02-plan-01`, short: `02-01`, chapter-only: `chapter-02`)
- Shows all original commit messages in range mode
- Validates commit range endpoints and checks for merges
- Chapter-plan argument overrides auto-detection

### Debug

| Command | Description | Arguments |
|---------|-------------|-----------|
| <nobr>`/fuska-debug`</nobr> | Systematic debugging with smart handoff to `/fuska-do` | `[issue description]` -- auto-resumes active session if no description |
| <nobr>`/fuska-export-md`</nobr> | Export to Markdown | -- |

---

## See Also

- [workflow.md](workflow.md) — See commands in context with scenarios
- [configuration.md](configuration.md) — Configure workflow modes and model profiles
- [concepts.md](concepts.md) — Understand the mental model behind commands
