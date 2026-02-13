# Settings & Configuration

> **Back to:** [README.md](../README.md)

```bash
fuska config [project-dir]
```

From this menu you can configure:
- **Quick settings** — switch model profile (quality/balanced/budget) and workflow mode
- **Model aliases** — configure which models map to quality/balanced/budget
- **Git commit strategy** — switch between per-phase / per-plan / per-task
- **Stage overrides** — set a specific model for planning, execution, or verification
- **Reset presets** — reconfigure all profiles from scratch

Use `fuska config --view` to view current settings non-interactively.

---

## Model Profiles

A **model profile** controls which AI model is used for each stage. Three presets are available:

| Profile | Planning | Execution | Verification | Best For |
|---------|----------|-----------|--------------|----------|
| **quality** | Strongest | Strongest | Strongest | Critical architecture, quota available |
| **balanced** (default) | Strong | Mid-tier | Mid-tier | Normal development |
| **budget** | Mid-tier | Mid-tier | Lightweight | High-volume work, conserving quota |

Switch profiles:

```bash
fuska config
# Select "Quick settings" → choose profile
```

Or view current settings:

```bash
fuska config --view
```

---

## Stages

A **stage** is a category of work in the Fuska workflow. Each stage uses different agents, and the model profile determines which AI model powers them.

| Stage | Agents | Purpose |
|-------|--------|---------|
| **Planning** | planner, plan-checker, researcher, roadmapper, project-researcher, research-synthesizer, codebase-mapper | Phase decomposition, dependency analysis, goal-backward verification |
| **Execution** | executor, debugger | Implementing plan tasks with atomic commits, deviation handling |
| **Verification** | verifier, integration-checker | Goal-backward verification, quality assurance |

**Why planning gets the strongest models:** Planning involves architecture decisions, goal decomposition, and task design — where model quality has the highest impact. Execution follows the plan's explicit instructions, so mid-tier models suffice.

---

## Workflow Modes

**Workflow modes** provide preconfigured combinations of agents that balance speed vs. quality. Choose a mode based on your needs.

| Mode | Workflow | What You Lose | What You Keep | Time Saved | Use When |
|------|-----------|----------------|----------------|-------------|-----------|
| **Direct** (0%) | Planner → Executor | Tech research, plan validation, code verification | Task breakdown, atomic commits, MegaMemory state | ~80% | You already know exactly what to do and need quick execution. This is essentially "give me a todo list and I'll do it." |
| **Quick** (15%) | Planner → Executor | Tech research, plan validation, code verification | Task breakdown, atomic commits, deviation handling, state tracking | ~70% | Small tasks with known solutions. For unplanned ad-hoc tasks, use `/fuska-do` instead. |
| **Fast** (30%) | Planner → Plan Checker → Executor | Tech research, code verification | Requirement coverage, task completeness, dependency validation, wiring checks, atomic commits | ~50% | You know the tech stack but want validated plans. Good for features in familiar stacks, CRUD operations, UI components |
| **Balanced** (50%) | Researcher → Planner → Executor | Plan validation, code verification | Ecosystem research, standard patterns, pitfall avoidance, task breakdown, atomic commits | ~35% | Moderate tech uncertainty, want to avoid wrong library choices. Good for adding new library, exploring unfamiliar framework area, integration work |
| **Thorough** (70%) | Researcher → Planner → Plan Checker → Executor | Code verification | Full plan validation, tech research, ecosystem patterns, atomic commits | ~20% | New domains, unfamiliar tech, need verified plans but will manually verify. Good for new feature areas, greenfield projects, learning new tech |
| **Standard** (100%) | Researcher → Planner → Plan Checker → Executor → Verifier | Nothing | Full goal-backward chain, code-level verification, gap detection | ~0% | Critical architecture, production systems, high stakes. Good for payment systems, auth systems, data migrations, core infrastructure |

**Key concepts:**
- **Time saved** compared to Standard mode (100% advantages)
- **Advantages preserved** relative to full Standard workflow
- Use `fuska config` to change workflow mode
- Per-phase flags (`--research`, `--skip-verify`) augment your selected mode but never reduce it

---

## Quick Mode vs /fuska-do

| Aspect | Quick mode (`--mode quick`) | `/fuska-do` command |
|---------|-----------------------------|---------------------------|
| **Purpose** | Speed-focused planning within a phase | Unplanned ad-hoc tasks |
| **Agent flow** | Planner → Executor only | Planner → Executor only |
| **Concept storage** | Phase-based: `phase-01-plan-001` | Standalone: `task-001-fix-typo` |
| **Roadmap ties** | ✅ Tied to phase structure | ❌ Separate from roadmap |
| **State updates** | Updates roadmap and phase status | Updates `state.tasks_completed` |
| **User input** | Must specify phase: `/fuska-plan-phase 2 --mode quick` | Just run command, prompted: `/fuska-do` |

**Quick mode** (`--mode quick`) is for small tasks within a phase where you want Fuska guarantees (atomic commits, state tracking) but faster execution.

**`/fuska-do`** is for unplanned work—bug fixes, small refactorings, one-off tasks—that you don't want to tie to any phase.

---

## Git Commit Strategy

Controls how often Fuska creates git commits during execution. Set during `/fuska-new-project`.

| Strategy | Commits When | Git Log Looks Like |
|----------|--------------|--------------------|
| **per-phase** (default) | Once when all plans in a phase complete | `feat(phase-02): user authentication system` |
| **per-plan** | Once per plan (groups all tasks) | `feat(02-01): JWT generation and validation` |
| **per-task** | After every individual task | `feat(02-01): add JWT signing helper` *(3 commits for 3 tasks in plan 02-01)* |

**Example: same work, different strategies**

Three tasks in plan 02-01 (JWT auth): set up jose library, add refresh token rotation, protect routes with middleware.

*per-phase* — 1 commit for the entire phase:
```
feat(phase-02): user authentication system
```

*per-plan* — 1 commit for the plan:
```
feat(02-01): JWT auth with refresh token rotation
```

*per-task* — 3 separate commits:
```
feat(02-01): set up jose library and token generation
feat(02-01): add refresh token rotation with secure storage
feat(02-01): protect routes with auth middleware
```

**Stored in config concept as:**
```json
{
  "git": {
    "commit_strategy": "per-phase"
  }
}
```

**Commit message format (all strategies):**

```
{type}({scope}): {concise description}

- {high-level change 1}
- {high-level change 2}
```

Commit messages are kept concise by design:
- Subject line: max 72 characters, imperative mood
- Body: **2-4 bullet points maximum** — each bullet is one high-level sentence
- Never lists implementation details like imports, field names, parameter types, or null checks
- The git diff is the source of truth for *how* — the commit message explains *what* and *why*

**Why per-phase is the default:** For solo dev + AI workflows, MegaMemory already tracks granular task completion. Per-phase gives the cleanest git history while MegaMemory handles the detailed context. Use per-task if you need fine-grained `git bisect` or work with other developers who rely on git log.

---

## Per-Stage Overrides

Override the model for a specific stage without changing the profile:

```bash
fuska config
# Select "Set stage override" → choose stage and model
```

Where `<stage>` is one of: `planning`, `execution`, or `verification`.

You can also override per-phase with flags on `/fuska-plan-phase`:
- `--mode <MODE>` — Override workflow mode for this phase only (one-off, doesn't persist)
- `--research` — Enable researcher (augments the selected mode)
- `--skip-research` — Skip researcher
- `--skip-verify` — Skip plan verification

You can override per-phase with flags on `/fuska-execute-phase`:
- `--mode <MODE>` — Override workflow mode for this phase only (one-off, doesn't persist)
- `--verify` — Force verifier to run (even in modes that normally skip it)

---

## Checker Panel

The **checker panel** is a role-based plan verification system that runs during `/fuska-plan-phase`. Instead of a single plan checker, it uses a panel of specialized checkers that provide different perspectives:

```
┌─────────────────────────────────────────────────────────┐
│                    PLAN CHECKER PANEL                    │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   QUALITY    │  │  CONTEXTUAL  │  │   EXPERT     │   │
│  │  ADVOCATE    │  │  (derived)   │  │  (dynamic)   │   │
│  │              │  │              │  │              │   │
│  │  Always      │  │ Project-     │  │ Plan-        │   │
│  │  runs        │  │ derived      │  │ specific     │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Panel composition:**

1. **Base (always):** `quality-advocate` — Checks task completeness, testability, error handling, maintainability, observability, performance, and documentation

2. **Contextual (project-derived):** Auto-detected from your project type:
   - `security-auditor` — Web/API projects (auth, input validation, data protection)
   - `resource-guardian` — Embedded systems (memory, timing, resource constraints)
   - `portability-watcher` — CLI tools (cross-platform paths, shell commands)

3. **Expert (plan-derived):** Dynamically selected based on plan content keywords:
   - `security-veteran` — Auth, login, password, token, session, jwt, oauth
   - `distributed-systems-engineer` — WebSocket, realtime, SSE, stream, queue, message
   - `payments-expert` — Payment, stripe, checkout, billing, subscription, invoice
   - `api-design-veteran` — API, endpoint, REST, GraphQL, route, controller
   - `data-architect` — Database, schema, migration, model, Prisma, SQL
   - `performance-engineer` — Performance, cache, optimize, latency, throughput

**Cross-validation:** When 2+ checkers flag the same issue, it gets a `cross_validated` badge and severity boost (low → medium → high → critical). Cross-validated issues appear first in the output.

**Viewing/overriding configuration:**

```bash
fuska config
# Select "Checker panel settings"
```

This shows:
- Current project classification (type, confidence, detection signals)
- Current contextual role (auto-detected or manually overridden)
- Options to override the contextual role or reset to auto-detect

**When detection happens:**
- `/fuska-map-codebase` detects project type and stores `checker_panel` settings in the config concept
- Detection looks for: embedded signals (ISR, STM32, etc.), web frameworks, CLI binaries, desktop frameworks (Electron, Tauri), Flutter

**Example detection output:**
```
Project Classification Detected:
  Type: web-api
  Contextual Checker: security-auditor
  Confidence: high
  Signals: express, JWT, session-based auth
```
