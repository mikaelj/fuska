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
| <nobr>`fuska config [dir]`</nobr> | Manage Fuska settings (profiles, workflow modes, git strategy, overrides) | `-v, --view` for non-interactive view |
| <nobr>`fuska export`</nobr> | Export knowledge graph to `.planning/` files | `--project-dir <path>`, `--output-dir <path>`, `--overwrite`, `--dry-run`, `--debug`, `--verbose` |
| <nobr>`fuska initiative list`</nobr> | List all initiatives sorted by recent activity | -- |
| <nobr>`fuska initiative switch [slug]`</nobr> | Switch to another initiative | `[slug]` -- initiative to switch to |
| <nobr>`fuska todo`</nobr> | List completed and pending tasks | -- |
| <nobr>`fuska info`</nobr> | Display codebase and domain mappings from MegaMemory | `--long` for all files, `--verbose` for small domains |
| <nobr>`fuska progress`</nobr> | Check project progress and show next action | `--json` for machine-readable output |
| <nobr>`fuska refresh [args...]`</nobr> | Refresh import graph with file and symbol-level indexing | `--full`, `--dead-code`, `--json`, `--prune` |
| <nobr>`fuska ask [args...]`</nobr> | Ask questions about the codebase using import graph data | `[question]` |
| <nobr>`fuska git message [args...]`</nobr> | Test and preview commit messages using Fuska rules | -- |
| <nobr>`fuska git worktree add <name>`</nobr> | Create git worktree with shared context | `--no-context`, `-f, --force` |
| <nobr>`fuska git worktree merge <name>`</nobr> | Merge worktree (MM + git) | `--only-git`, `--only-megamemory`, `--dry-run`, `--keep <strategy>`, `--force` |

---

## Slash Commands

### Universal Entry Point

| Command | Description | Arguments |
|---------|-------------|-----------|
| <nobr>`/fuska`</nobr> | Universal entry point -- navigate, plan, execute, and more | `[verb] [args]` -- see below; bare invocation shows current position and next step |

`/fuska` routes to all other commands. Run it bare to see where you are, or with a verb: `/fuska plan`, `/fuska build`, `/fuska do fix the bug`, etc. Phase numbers are auto-detected.

### Initiative Setup

| Command | Description | Arguments |
|---------|-------------|-----------|
| <nobr>`/fuska-configure-initiative`</nobr> | Configure existing initiative (run after `fuska init`) | -- |
| <nobr>`/fuska-map-codebase`</nobr> | Map codebase structure, business domains, and import graph | `[area]` -- optional area to focus on |
| <nobr>`/fuska-import`</nobr> | Import existing initiative | -- |

> **Note:** `fuska init` runs `/fuska-map-codebase` automatically (unless `--no-map`), so you only need to run it manually to re-map after significant structural changes.

### Phase Workflow

| Command | Description | Arguments |
|---------|-------------|-----------|
| <nobr>`/fuska-design-phase`</nobr> | Design phase details before planning | `<N>` -- phase number |
| <nobr>`/fuska-plan-phase`</nobr> | Create detailed phase plan | `<N>` `[--research \| --skip-research \| --skip-verify \| --mode <MODE>]` |
| <nobr>`/fuska-research-phase`</nobr> | Research phase requirements | `<N>` -- phase number |
| <nobr>`/fuska-build-phase`</nobr> | Build phase tasks | `<N>` `[--mode <MODE>]` -- phase number and optional mode override |
| <nobr>`/fuska-review-phase`</nobr> | Review phase completion | `<N>` -- phase number |

### Phase Management

| Command | Description | Arguments |
|---------|-------------|-----------|
| <nobr>`/fuska-add-phase`</nobr> | Add new phase to current milestone | `<desc>` -- phase description |
| <nobr>`/fuska-insert-phase`</nobr> | Insert phase between existing phases | `<N> <desc>` -- position and description |
| <nobr>`/fuska-remove-phase`</nobr> | Remove phase from project | `<N>` -- phase number |
| <nobr>`/fuska-list-phase-assumptions`</nobr> | List assumptions for a phase | `<N>` -- phase number |

### Milestones

| Command | Description | Arguments |
|---------|-------------|-----------|
| <nobr>`/fuska-new-milestone`</nobr> | Create new milestone | `"[name]"` -- milestone name |
| <nobr>`/fuska-audit-milestone`</nobr> | Audit milestone status | -- |
| <nobr>`/fuska-complete-milestone`</nobr> | Mark milestone complete | -- |
| <nobr>`/fuska-plan-milestone-gaps`</nobr> | Plan gaps between milestones | -- |

### Work Management

| Command | Description | Arguments |
|---------|-------------|-----------|
| <nobr>`/fuska-pause-work`</nobr> | Capture mental context for next session | -- |
| <nobr>`/fuska-resume-work`</nobr> | Restore context and show task position | -- |
| <nobr>`/fuska-add-todo`</nobr> | Add todo item | `[description]` -- auto-extracts from conversation if omitted |
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
| <nobr>`/fuska-do`</nobr> | Execute unplanned tasks with mode-aware agent chain | `[mode] [description]` -- mode: planned/checked/researched/verified, flags: --review/--no-review/--auto-commit |
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
/fuska-doc "API authentication flow" --type implementation --audience team
/fuska-doc verified "Migration plan" --type migration --audience stakeholder
/fuska-doc "System architecture" --type architecture --output docs/arch.md
```

### Git Integration

| Command | Description | Arguments |
|---------|-------------|-----------|
| <nobr>`/fuska-git-message`</nobr> | Generate Fuska commit messages or regenerate for existing commits/ranges | `<commit-hash \| commit-range \| phase-X-plan-Y>` |

**Modes:**

1. **Commit range mode:** Generate unified commit message for multiple commits (e.g., `HEAD~5..HEAD`, `abc123..def456`)
2. **Commit hash mode:** Replay existing commit's diff and regenerate message under current rules
3. **Working tree mode:** Generate commit message for uncommitted changes

**Examples:**
```bash
/fuska-git-message HEAD~5..HEAD                    # Range mode
/fuska-git-message abc123..def456 phase-02-plan-03  # Range with explicit phase-plan
/fuska-git-message abc123                          # Single commit replay
/fuska-git-message phase-02-plan-01                # Working tree mode
```

**Features:**
- Auto-detects phase-plan from most recent commit (full format: `phase-02-plan-01`, short: `02-01`, phase-only: `phase-02`)
- Shows all original commit messages in range mode
- Validates commit range endpoints and checks for merges
- Phase-plan argument overrides auto-detection

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
