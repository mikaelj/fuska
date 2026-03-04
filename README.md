# Fuska

*"Cheating is good" — (kinda) Gordon Gekko (and every smart developer)*

**"Fuska"** means "to cheat" in Swedish — because sometimes the smartest way to build software is to let AI do the heavy lifting.

Fuska is a project management system for solo agentic development, using [MegaMemory](https://github.com/0xK3vin/MegaMemory)'s persistent knowledge graph for semantic search and typed relationships.

Works with **OpenCode** and (*probably, maybe, very little testing*) **Claude Code**.

Based on [gsd-opencode](https://github.com/rokicool/gsd-opencode) and [Get Shit Done](https://github.com/gsd-build/get-shit-done).

> *"Fuska is like having three navigators who raise the alarm if they independently spot the same hazard — and a co-driver who inspects every metre you actually drove."* — [Read the full pitch](docs/PITCH.md)
>
> **It works.** In a real session, the code reviewer caught a typo (`this.config.workflow.workflow.mode`) that would have silently broken the display — the builder fixed it, the second review passed, and the commit landed clean. See it in action ↓

New here? Check the [FAQ](docs/faq.md).

**See it in action** — Fuska has two workflows:
- **Ad-hoc tasks** (`/fuska-do`): one command, full agent chain — [real session](docs/fuska-do-session-distilled.md) · [Quick Start](#see-it-in-action)
- **Full projects** (chapter lifecycle): init through milestone — [tutorial](docs/tutorial.md) · [Getting Started](#work-through-chapters)

**THE AUTHOR TAKES NO RESPONSIBILITY FOR DATA LOSS IN EXISTING PROJECTS. USE AT YOUR OWN PERIL.**

---

## What is Fuska

Fuska manages your project through **initiatives** (efforts), **chapters** (work buckets), and **plans** (task lists with dependencies). All state is stored in [MegaMemory](https://github.com/0xK3vin/MegaMemory)'s knowledge graph — persistent across sessions, searchable, and compact.

The difference from regular AI coding: Fuska maintains persistent state across sessions. Your project context, decisions, and progress survive forever in MegaMemory's knowledge graph. Resume a task next week and the AI remembers exactly where you left off.

But memory is just the start. Fuska doesn't hand a vague prompt to a model and hope for the best — it **plans** every piece of work as structured task lists with explicit dependencies, then **validates those plans before a single line of code gets written**.

That validation isn't a generic checklist. A panel of three specialized reviewers interrogates each plan from different angles: one always present for baseline quality, one derived from your project type (a security auditor for web apps, a resource guardian for embedded systems), and one dynamically selected for the specific domain of the work (auth, payments, data architecture, real-time systems). When two reviewers independently flag the same problem, severity escalates automatically. By the time an executor agent touches your codebase, the plan has already survived a gauntlet designed around *your* project.

And validation doesn't stop at the plan. After the builder finishes, a **code reviewer agent** examines the actual diff — checking for bugs, security issues, and deviations from the plan. If it finds problems, the builder fixes them automatically, up to three review-fix iterations. Code gets reviewed before it's committed, not after. If the working directory was already dirty before the task started, Fuska warns you and offers options (commit, stash, skip review, or proceed) — preventing the reviewer from accidentally "fixing" unrelated changes.

**Lessons learned** are captured automatically — when plan-checker or code-reviewer find issues, they create lesson concepts in MegaMemory. The planner and executor query these lessons before each run, applying solutions to prevent recurring mistakes. The system gets smarter over time.

---

## Quick Start

> **Prerequisites:** Fuska must be [installed](#installation) and your project [initialized](#initialize-your-project) before running these commands.

### See It In Action

Just tell Fuska what you want. It researches, plans, verifies the plan, and executes with atomic commits.

**Checked Mode — Validated Plans:**

```
/fuska-do checked add dark mode toggle to settings page
```

1. **Planner** creates a focused plan (2-3 tasks, target files, verification steps)
2. **Plan Checker** validates the plan is complete and achievable
3. You review and approve
4. **Builder** runs all tasks with atomic commits
5. **Code Reviewer** validates the implementation against the plan (up to 3 iterations)

**Verified Mode — Full Assurance:**

```
/fuska-do verified implement OAuth login with Google and GitHub
```

1. **Researcher** investigates OAuth flows, your existing auth patterns, security considerations
2. **Planner** creates a detailed plan with security checkpoints
3. **Plan Checker** validates completeness, security, error handling
4. **Builder** implements with atomic commits, handles any deviations
5. **Code Reviewer** validates the implementation against the plan (up to 3 iterations)
6. **Reviewer** confirms the implementation actually works end-to-end

### Four Workflow Modes

| Mode | Pipeline | Plan Review | Best For |
|------|----------|-------------|----------|
| `planned` | Planner -> Builder -> Code Reviewer | Skipped | You have a plan, just build it |
| `checked` | Planner -> Plan Checker -> Builder -> Code Reviewer | Prompted | Plan gets validated, you review before building |
| `researched` | Researcher -> Planner -> Plan Checker -> Builder -> Code Reviewer | Prompted | Research adds context, review before committing |
| `verified` | Researcher -> Planner -> Plan Checker -> Builder -> Code Reviewer -> Reviewer | Skipped | Full pipeline with post-build review |

Override plan review with `--review` or `--no-review`, or set it permanently via `fuska config` (`interactive_review`). Commit always prompts by default — override per-invocation with `--auto-commit` to skip the prompt. Skip code review with `--no-code-review`. For details, see [workflow.md](docs/workflow.md#workflow-modes).

**Prefer hands-on control?** The chapter lifecycle gives you the full step-by-step sequence — design, plan, build, review — each as a separate command you run when you're ready. More deliberate, more visibility at each stage. See [workflow.md](docs/workflow.md#chapter-lifecycle) or follow the [tutorial](docs/tutorial.md).

---

## Key Concepts

**Initiative** — An effort, not a codebase. "I want to build push notifications" is an initiative. You can have multiple in one codebase, each with its own requirements and roadmap.

**Chapter** — A deliverable work bucket with a goal, requirements, and success criteria. Chapters are worked through sequentially: plan -> build -> review.

**Plan** — A detailed task list with dependencies, grouped into batches (parallel execution groups). Generated by the planner agent for each chapter.

**MegaMemory** — The persistent knowledge graph backing everything. Replaces `.planning/` markdown files with O(1) semantic search, typed relationships, and 4.4x more compact storage.

For the full mental model, glossary, and edge relations, see [concepts.md](docs/concepts.md).

---

## Installation

```bash
npm install -g fuska-magistern@latest
fuska install
```

Select your provider (opencode, claude, or both) when prompted. Fuska creates symlinks to the npm package — updates are immediate, no reinstall needed.

For platform notes, troubleshooting, and migration from old installs, see [getting-started.md](docs/getting-started.md).

---

## Getting Started

### Initialize Your Project

> **Prefer a guided walkthrough?** The [tutorial](docs/tutorial.md) walks through building a complete todo app — from `fuska init` through all 5 chapters to milestone completion — with real session output at every step. For a quicker look at the ad-hoc workflow, see the [`/fuska-do` session](docs/fuska-do-session-distilled.md).

```bash
fuska init [description]
```

Creates the project foundation:
- Initializes git repo (if needed)
- Creates `.megamemory/` database
- Creates a **"main" initiative** automatically (with state, roadmap, milestones, todos, and research modules)
- Registers MegaMemory as an MCP server (`megamemory install --target <target>`)
- For Claude Code: writes `.claude/settings.local.json` with `mcp__megamemory` permission so tool calls proceed without prompts
- Maps codebase structure, business domains, and import graph (unless `--no-map`)

> Requires a provider configured via `fuska install`. See [MegaMemory MCP Setup](docs/getting-started.md#megamemory-mcp-setup) for details and manual fallback.

**Arguments:**
- `description` — Optional description stored with the initiative

**Options:**
- `--no-map` — Skip codebase mapping (run `fuska map` later)

**Examples:**
```bash
# Full init with description and mapping
fuska init "A blog platform with user authentication"

# Quick init without mapping
fuska init --no-map "My new project"
```

### Configure the Initiative

Launch OpenCode (or Claude Code), then run:

```
/fuska-configure [--mode yolo|interactive] [--depth quick|standard|comprehensive] 
                 [--parallel true|false] [--commits per-chapter|per-plan|per-task]
                 [--research yes|no] [--plan-check yes|no] [--verifier yes|no]
```

Walks through initiative configuration:
- Deep questioning (or uses stored description if provided)
- Workflow preferences (mode, depth, parallelization, commits)
- Research domain ecosystem (optional)
- Define requirements
- Create roadmap with chapters

**If you provided a description during init:** Questioning is streamlined — Fuska derives context from your description.

**If no description:** Full interactive questioning.

**With all arguments:** Skip all questions entirely:
```
/fuska-configure --mode yolo --depth quick --parallel true --commits per-chapter --research yes --plan-check yes --verifier yes
```

### CLI Quick Reference

Outside the AI tool, `fuska` gives you project-level control. Run `fuska --help` for grouped output.

**AI-Powered Commands** (spawn an AI agent):
```bash
fuska do <mode> [description]         # Execute unplanned tasks with agent chain
fuska map [area]                      # Map codebase structure and domains to MegaMemory
fuska ask [question]                  # Ask questions about the codebase using import graph
fuska refresh                         # Refresh import graph with file/symbol indexing
```

**Local Commands** (pure Node.js, no AI):
```bash
fuska init [description]              # Initialize project with "main" initiative
fuska config                          # Configure Fuska settings (TUI)
fuska progress                        # Current status and next action
fuska todo                            # Pending and completed tasks
fuska lessons                         # Lessons learned from plan-checker/code-reviewer
fuska info                            # Display codebase and domain mappings
fuska export                          # Export MegaMemory to markdown files
fuska install [target]                # Install commands/agents via symlinks
fuska provider                        # View/change AI provider
```

**Command Groups:**
```bash
fuska initiative list                 # List all initiatives
fuska initiative switch [slug]        # Switch active initiative
fuska git message                     # Generate commit message for current changes
fuska git worktree add <name>         # Create worktree with shared context
fuska git worktree merge <name>       # Merge worktree back (MegaMemory + git)
fuska migrate planning <dir>          # Import .planning/ into MegaMemory
fuska migrate terminology [dir]       # Rename phase->chapter, wave->batch
fuska migrate multi-initiative [path] # Migrate to multi-initiative support
fuska migrate statuses [dir]          # Migrate old status values
```

**Slash commands for chapter TODOs:**
```
/fuska-add-chapter-todo <chapter> description  # Add chapter-scoped TODO
```

**Standalone code review:**
```
/fuska-code-review                              # Review uncommitted changes against project context
```

#### `fuska progress` Example

```
Progress on submodule-diff-display, 2/4 chapters complete.

Done:
* Chapter 01: Created ResolveSubmoduleRepository function that parses submodule URLs and matches to local Forgejo instance
* Chapter 02: Created PopulateAllNestedFiles function that iterates over diff files and populates NestedFiles for same-instance submodules

Next:
* Chapter 3: Render submodule diffs with links and icons in commit and PR/compare views
  - Status: ready_to_plan
  - Context: -

Future:
* Chapter 4: Add unit and integration tests, handle edge cases like missing submodules

Pending ad-hoc tasks:
* 022: ignore-gitignore-patterns-in-codebase-mapper (2026-02-22 14:30)

Completed ad-hoc tasks:
* 020: add-json-output-to-progress (2026-02-20 16:45)

Configuration:
* Profile: balanced

---------

Gather context for chapter 3 and clarify approach by running:
* /fuska-design 3

or skip design of chapter 3 and plan directly by running:
* /fuska-plan 3
```

See [commands.md](docs/commands.md) for the full reference.

### Work Through Chapters

```
fuska init -> /fuska-configure -> /fuska-plan -> /fuska-build -> repeat
```

| Step | Command | When to Use |
|------|---------|-------------|
| **Design** (optional) | `/fuska-design` | Requirements have gray areas (UI, UX, behavior) — asks targeted questions to clarify |
| **Plan** | `/fuska-plan` | Always — creates detailed task list with dependencies |
| **Build** | `/fuska-build` | Always — implements tasks with atomic commits |
| **Review** (optional) | `/fuska-review` | Need confidence the code delivers what the chapter promised |
| **Next chapter** | `/fuska-plan` | Start the next chapter (auto-detects chapter number) |

Chapter numbers are auto-detected from your project state. You can also pass them explicitly: `/fuska plan 3`.

**Typical flow:** Most chapters skip design and go straight to `/fuska-plan`. Use design when you're uncertain about implementation details.

That's it — repeat for each chapter until the milestone is complete.

**At any point**, run `/fuska` (bare, no verb) to see exactly where you are and what to do next.

**Ad-hoc plan checking:** If Fuska is initialized, you can ask the AI to run any suggested plan through the plan checker at any time — no Fuska command needed. Just describe the plan or paste it into the conversation and say "run this through the plan checker." The same expert panel that validates plans during `/fuska-plan` will review it on the spot.

**Formalize as you go:** You don't need to decide upfront whether a conversation becomes real work. At any point, tell the AI "create a chapter of this" or "send this to the researcher" — Fuska creates the full chapter structure from your conversation. Start informal, formalize when ready. See [workflow.md](docs/workflow.md#formalize-as-you-go).

### Chapter TODOs

During execution, if the builder discovers additional work not in the plan, it creates **chapter-scoped TODOs**. These are automatically picked up in a loop:

1. Builder creates chapter-todo for discovered work
2. Planner re-plans with the new TODO as a requirement
3. Checker validates the updated plan covers the TODO
4. Builder executes the new tasks

This loop runs up to 3 iterations per chapter. You can also add TODOs manually:

```
/fuska-add-chapter-todo <chapter-slug> Add error handling for API rate limits
```

Chapter TODOs are separate from global TODOs (created via `fuska todo add`) — they're scoped to a specific chapter and consumed during the execution loop.

---

## Where to Go Next

| I want to... | Read... |
|--------------|---------|
| Understand the mental model | [concepts.md](docs/concepts.md) — Initiatives, chapters, plans, MegaMemory, glossary |
| Follow the tutorial (full project lifecycle) | [tutorial.md](docs/tutorial.md) — Build a todo app end-to-end: init, configure, design, plan, build, review |
| See full workflows in action | [workflow.md](docs/workflow.md#scenarios) — 9 end-to-end scenarios |
| See the ad-hoc workflow in action | [fuska-do-session-distilled.md](docs/fuska-do-session-distilled.md) — Annotated `/fuska-do checked` session: plan-checker validates, code-reviewer catches a bug |
| Look up a command | [commands.md](docs/commands.md) — Every CLI and slash command |
| Configure modes, models, git strategy | [configuration.md](docs/configuration.md) — All the knobs |
| See why MegaMemory over .planning/ | [development.md](docs/development.md#performance-benchmarks) — Performance benchmarks |
| Contribute to Fuska | [development.md](docs/development.md) — Build process and architecture |
| Get answers to common questions | [faq.md](docs/faq.md) — 10 Q&As on data, models, cost, teams, and more |
| Set up from scratch | [getting-started.md](docs/getting-started.md) — Full install guide with troubleshooting |

---

## What's Different from GSD

| Feature | GSD (Get Shit Done) | Fuska |
|---------|---------------------|-------|
| **Plan Verification** | Single plan-checker agent | **Expert Panel** — 3 specialized checkers (base quality advocate + contextual role + plan-derived expert) with cross-validation severity boosting |
| **Ad-hoc Tasks** | `/gsd-quick` — single mode (planner -> executor) | **`/fuska-do`** — 4 modes (planned/checked/researched/verified) with configurable agent chain including code review loop |
| **Commit Messages** | Path-based scope extraction, manual formatting | **Domain-aware scopes** from MegaMemory mapping + commit checker agent validates format, content, and quality |
| **Model Selection** | Claude models only (via profiles) | **Any OpenCode-supported model** — configure aliases for quality/balanced/budget tiers |
| **Commit Strategy** | Per-task (fixed) | **Configurable** — per-chapter / per-plan / per-task, with smarter commits via checker panel + domain knowledge |
| **Worktree Support** | None | **Full integration** — `fuska git worktree add` copies MegaMemory context, `fuska git worktree merge` syncs knowledge back |
| **CLI Tool** | None (all via opencode commands) | **`fuska` CLI** — install, config, migrate, export, projects, todo, worktree management |
| **Storage Backend** | `.planning/` markdown files | **MegaMemory** knowledge graph — 700x faster semantic queries, survives git resets |
| **Migration** | N/A | **Import existing** `.planning/` directories with `fuska migrate planning` |
| **Session continuity** | Manual — requires `/gsd-pause-work` before ending a session, `/gsd-resume` to restore context | **Automatic** — state saved after every commit; just run `/fuska` to pick up where you left off. No pause, no resume, no manual saving. |
| **Codebase mapping** | Manual exploration | **`/fuska-map-codebase`** — auto-detects tech, architecture, quality, concerns, domains, and import graph |
| **Import graph** | N/A | **`fuska refresh`** / **`fuska ask`** — file and symbol-level indexing with dead code detection and impact analysis |

### Expert Panel Checker

Instead of a single plan-checker, Fuska uses a **panel of specialized checkers** that provide different perspectives. See [configuration.md](docs/configuration.md#checker-panel) for full details.

- **Base (always):** Quality Advocate — task completeness, testability, error handling, maintainability, observability, performance, documentation
- **Contextual (project-derived):** Auto-detected from your project type (Security Auditor, Resource Guardian, or Portability Watcher)
- **Expert (plan-derived):** Dynamically selected based on plan content (Security Veteran, Distributed Systems Engineer, Payments Expert, etc.)

**Cross-validation:** When 2+ checkers flag the same issue, it gets a `cross_validated` badge and severity boost.

For a detailed cost/token comparison, see the [FAQ](docs/faq.md#how-much-does-fuska-cost-in-tokensmoney).

### Smarter Commit Messages

Fuska generates better commits through three mechanisms:

**1. Commit Checker Agent** validates every message:
- Subject line format: `{type}({scope}): {description}`
- Max 72 characters, imperative mood
- Semantic scope (never task/chapter numbers as scope)
- Max 4 bullets, no implementation details
- Automatic chapter-plan trailer

**2. Domain-Aware Scopes** from `/fuska-map-codebase`:
- Scopes derived from business domain concepts stored in MegaMemory
- Example: `feat(pricing):` instead of `feat(lib/data/:)`
- Falls back to path-based extraction if no domains mapped

**3. Plan Context Integration**:
- `/fuska-git-message` loads plan objective from MegaMemory
- Writes *why* bullets (outcome-focused), not *how* bullets (implementation)
- Three modes: working tree, single commit replay, commit range unification

**Result:** Commits that read like a changelog of outcomes, not a diary of implementation details.

### Any Model You Want

GSD only supports Claude models. Fuska works with **any model supported by OpenCode**:

```bash
fuska config
# Select "Model aliases" -> configure quality_model, balanced_model, budget_model, explore_model
```

When selecting models, the full list is shown immediately. Type to filter — matching is fuzzy (e.g., "glm5" matches "zai-coding-plan/glm-5").

**Example configurations:**
- Quality: `opencode/claude-opus-4`, Balanced: `opencode/claude-sonnet-4`, Budget: `opencode/claude-haiku-4`
- Quality: `openai/gpt-4o`, Balanced: `openai/gpt-4o-mini`, Budget: `openai/gpt-3.5-turbo`
- Quality: `anthropic/claude-3-opus`, Balanced: `google/gemini-pro`, Budget: `meta/llama-3`

Stage overrides let you use different models for planning, execution, or verification without changing the whole profile. See [configuration.md](docs/configuration.md#per-stage-overrides).

---

## Migration from .planning/

If you have an existing project using the `.planning/` directory format, run the migration script to move everything into MegaMemory:

**Prerequisites:** MegaMemory >= 1.3.1 installed in the target project's `node_modules`.

```bash
fuska migrate planning [project-dir]
```

The script:
1. Copies `.planning/` to `.planning.backup`
2. Creates MegaMemory concepts from all planning markdown files
3. Validates migration with semantic queries
4. Removes the `.planning/` directory on success

Use `--clean` to delete existing database before migration:

```bash
fuska migrate planning [project-dir] --clean
```

To rollback, restore from `.planning.backup` and remove `.megamemory/knowledge.db`.

### Terminology migration (phase → chapter, wave → batch)

If your MegaMemory database uses old `phase`/`wave` terminology (from before Fuska renamed these concepts), run:

```bash
fuska migrate terminology [project-dir]
```

This updates all concept IDs, names, summaries, and edges in-place — renaming `phase` → `chapter` and `wave` → `batch` throughout the database. It prints a summary of what was renamed when done.

---

## Why MegaMemory

For detailed performance benchmarks comparing MegaMemory to file-based approaches, see [development.md](docs/development.md#performance-benchmarks).

Key highlights:
- **700x faster** queries for compound operations
- **51-101x fewer** tool calls for agents
- **O(1) semantic search** enabling new capabilities

---

## Acknowledgments & License

This project builds upon the work of:

- [gsd-opencode](https://github.com/rokicool/gsd-opencode) — OpenCode integration for Get Shit Done
- [Get Shit Done](https://github.com/gsd-build/get-shit-done) — Original GSD framework and methodology
- [MegaMemory](https://github.com/0xK3vin/MegaMemory) — Persistent knowledge graph backend

Thank you to the creators and contributors of these projects.

**License:** MIT
