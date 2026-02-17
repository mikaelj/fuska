# Command Reference

> Every CLI command and slash command in Fuska.

**Audience:** Daily users
**Prerequisites:** [Installation](installation.md), [Key Concepts](concepts.md)

---

## CLI Commands

| Command | Description | Arguments |
|---------|-------------|-----------|
| `fuska init [description...]` | Initialize project with "main" initiative | `--no-map` to skip codebase mapping |
| `fuska install` | Install commands and agents via symlinks | `--opencode`, `--claude`, `--both`, `--force`, `--dry-run` |
| `fuska migrate [dir]` | Migrate `.planning/` to MegaMemory | `--clean` to delete existing DB first |
| `fuska migrate-multi-initiative` | Migrate existing initiative to pointer model | -- |
| `fuska config [dir]` | Manage Fuska settings (profiles, workflow modes, git strategy, overrides) | `-v, --view` for non-interactive view |
| `fuska export` | Export knowledge graph to `.planning/` files | `--project-dir <path>`, `--output-dir <path>`, `--overwrite`, `--dry-run`, `--debug`, `--verbose` |
| `fuska initiatives` | List all initiatives with milestones and phases | -- |
| `fuska initiative-archive` | Archive current initiative | -- |
| `fuska initiative-switch [slug]` | Switch to another initiative | `[slug]` -- initiative to switch to |
| `fuska todo` | List completed and pending tasks | -- |
| `fuska info` | Display codebase and domain mappings from MegaMemory | `--long` for all files, `--verbose` for small domains |
| `fuska progress` | Check project progress and show next action | `--json` for machine-readable output |
| `fuska refresh [args...]` | Refresh import graph with file and symbol-level indexing | `--full`, `--dead-code`, `--json`, `--prune` |
| `fuska ask [args...]` | Ask questions about the codebase using import graph data | `[question]` |
| `fuska worktree-add <name>` | Create git worktree with shared context | `--no-context`, `-f, --force` |
| `fuska worktree-merge <name>` | Merge worktree (MM + git) | `--only-git`, `--only-megamemory`, `--dry-run`, `--keep <strategy>`, `--force` |

---

## Slash Commands

### Universal Entry Point

| Command | Description | Arguments |
|---------|-------------|-----------|
| `/fuska` | Universal entry point -- navigate, plan, execute, and more | `[verb] [args]` -- see below; bare invocation shows current position and next step |

`/fuska` routes to all other commands. Run it bare to see where you are, or with a verb: `/fuska plan`, `/fuska execute`, `/fuska do fix the bug`, etc. Phase numbers are auto-detected.

### Initiative Setup

| Command | Description | Arguments |
|---------|-------------|-----------|
| `/fuska-configure-initiative` | Configure existing initiative (run after `fuska init`) | -- |
| `/fuska-map-codebase` | Map existing codebase structure | `[area]` -- optional area to focus on |
| `/fuska-map-domains` | Discover business domains in codebase for commit scopes and context | `[area]` -- optional area to focus on |
| `/fuska-import` | Import existing initiative | -- |

### Phase Workflow

| Command | Description | Arguments |
|---------|-------------|-----------|
| `/fuska-discuss-phase` | Discuss phase details before planning | `<N>` -- phase number |
| `/fuska-plan-phase` | Create detailed phase plan | `<N>` `[--research \| --skip-research \| --skip-verify \| --mode <MODE>]` |
| `/fuska-research-phase` | Research phase requirements | `<N>` -- phase number |
| `/fuska-execute-phase` | Execute phase tasks | `<N>` `[--mode <MODE>]` -- phase number and optional mode override |
| `/fuska-verify-work` | Verify phase completion | `<N>` -- phase number |

### Phase Management

| Command | Description | Arguments |
|---------|-------------|-----------|
| `/fuska-add-phase` | Add new phase to current milestone | `<desc>` -- phase description |
| `/fuska-insert-phase` | Insert phase between existing phases | `<N> <desc>` -- position and description |
| `/fuska-remove-phase` | Remove phase from project | `<N>` -- phase number |
| `/fuska-list-phase-assumptions` | List assumptions for a phase | `<N>` -- phase number |

### Milestones

| Command | Description | Arguments |
|---------|-------------|-----------|
| `/fuska-new-milestone` | Create new milestone | `"[name]"` -- milestone name |
| `/fuska-audit-milestone` | Audit milestone status | -- |
| `/fuska-complete-milestone` | Mark milestone complete | -- |
| `/fuska-plan-milestone-gaps` | Plan gaps between milestones | -- |

### Work Management

| Command | Description | Arguments |
|---------|-------------|-----------|
| `/fuska-pause-work` | Capture mental context for next session | -- |
| `/fuska-resume-work` | Restore context and show task position | -- |
| `/fuska-add-todo` | Add todo item | `[description]` -- auto-extracts from conversation if omitted |
| `/fuska-check-todos` | View all todos | -- |

### Codebase Analysis

| Command | Description | Arguments |
|---------|-------------|-----------|
| `/fuska-refresh` | Refresh import graph with file and symbol-level indexing | `[--full] [--dead-code] [--json] [--prune]` |
| `/fuska-ask` | Ask questions about the codebase using import graph data | `[question]` |

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
| `/fuska-do` | Execute unplanned tasks with mode-aware agent chain | `[mode] [description]` -- mode: planned/checked/researched/verified, flags: --ask/--auto |
| `/fuska-help` | Show all available commands | -- |

### Documentation

| Command | Description | Arguments |
|---------|-------------|-----------|
| `/fuska-doc` | Create documentation as deliverables | `[mode] <topic> [--type TYPE] [--audience AUD] [--depth DEPTH] [--output PATH]` |

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
| `/fuska-git-message` | Generate Fuska commit messages or regenerate for existing commits/ranges | `<commit-hash \| commit-range \| phase-X-plan-Y>` |

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
| `/fuska-debug` | Systematic debugging with smart handoff to `/fuska-do` | `[issue description]` -- auto-resumes active session if no description |
| `/fuska-export-md` | Export to Markdown | -- |

---

## See Also

- [workflow-examples.md](workflow-examples.md) — See commands in context
- [configuration.md](configuration.md) — Configure workflow modes and model profiles
- [concepts.md](concepts.md) — Understand the mental model behind commands
