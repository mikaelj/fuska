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

## Phase Planning with `--mode quick` vs Standalone `/fuska-do`

Both options use the same lightweight agent chain (Planner → Executor), but they differ in **scope** and **state management**.

### What is `--mode quick`?

Quick mode is one of the six [workflow modes](#workflow-modes) you can pass to `/fuska-plan-phase`. It skips research and plan checking, running only:

```
Planner → Executor
```

This is useful when you're already in a phase and want faster execution without giving up Fuska's guarantees (atomic commits, deviation handling, state tracking).

### Comparison

| Aspect | `--mode quick` (on `/fuska-plan-phase`) | `/fuska-do` |
|--------|----------------------------------------|-------------|
| **Scope** | Work within an existing phase | Standalone work outside phase structure |
| **Agent flow** | Planner → Executor | Planner → Executor |
| **Concept storage** | Phase-based: `phase-02-plan-003` | Standalone: `task-001-fix-typo` |
| **Roadmap ties** | ✅ Updates phase status and roadmap | ❌ Separate from roadmap |
| **Commit strategy** | Follows project's git strategy | Per-task commits |
| **Example** | `/fuska-plan-phase 2 --mode quick` | `/fuska-do quick fix footer alignment` |

### Decision Guide

**Use `--mode quick` when:**
- The work belongs to an existing phase (e.g., "phase 2: authentication")
- You want state tracking and atomic commits tied to your roadmap
- The solution is straightforward but still needs proper task breakdown

```bash
# You're in phase 2 (auth) and need to add a simple endpoint
/fuska-plan-phase 2 --mode quick
# → Creates phase-02-plan-003, tracks progress in roadmap
```

**Use `/fuska-do` when:**
- The task is unplanned and doesn't fit any phase
- It's a one-off: bug fix, typo, minor refactoring, quick polish
- You don't want to expand the roadmap for minor work

```bash
# Ad-hoc task that doesn't belong to any phase
/fuska-do quick fix the footer alignment on mobile
# → Creates task-001-fix-footer-alignment, tracked separately
```

### Concept Storage Example

```yaml
# With --mode quick (tied to phase 02):
phase-02-plan-003:
  summary: "Add password reset endpoint"
  status: completed
  tasks: [done, done, done]

# With /fuska-do (standalone):
task-001-fix-footer-alignment:
  summary: "Fix footer alignment on mobile breakpoints"
  status: completed
```

The key difference: `--mode quick` keeps your work organized within the phase structure, while `/fuska-do` creates isolated task concepts for unplanned work.

---

## Git Commit Strategy

Controls how often Fuska creates git commits during execution. Set during `/fuska-new-project`.

### Commit Message Format

All commits follow semantic commit format with a phase/plan trailer:

```
{type}({scope}): {concise description}

- {high-level change 1}
- {high-level change 2}

{phase-plan}
```

- **Type:** `feat`, `fix`, `test`, `refactor`, `perf`, `chore`, `docs`, `wip`
- **Scope:** Semantic area being changed (e.g., `auth`, `checkout`, `jose`, `api`) — NOT phase numbers
- **Body:** 2-4 bullets, high-level *what* and *why* only
- **Trailer:** Phase-plan identifier (e.g., `02-01` for plan 1 in phase 2)

### Example: Same Work, Different Strategies

Three tasks in plan 02-01 (JWT auth): set up jose library, add refresh token rotation, protect routes with middleware.

*per-phase* — 1 commit for the entire phase:
```
feat(auth): add JWT authentication with refresh tokens

- Integrate jose library for token signing and validation
- Implement refresh token rotation with secure storage
- Protect routes with auth middleware

phase-02
```

*per-plan* — 1 commit for the plan:
```
feat(auth): add JWT authentication with refresh tokens

- Integrate jose library for token signing and validation
- Implement refresh token rotation with secure storage
- Protect routes with auth middleware

02-01
```

*per-task* — 3 separate commits:
```
feat(jose): set up library and token generation

- Configure jose with RS256 signing
- Create access token generation helper

02-01

---

feat(auth): add refresh token rotation with secure storage

- Store refresh tokens with httpOnly cookie
- Implement rotation on token use

02-01

---

feat(middleware): protect routes with auth middleware

- Verify JWT on protected endpoints
- Return 401 for invalid/expired tokens

02-01
```

### Commit Message Rules

- **Subject line:** max 72 characters, imperative mood ("add" not "added")
- **Scope:** semantic area (`auth`, `checkout`, `api`, `ui`, etc.)
- **Body:** 2-4 bullets max — never list implementation details (imports, field names, types)
- **Trailer:** phase-plan identifier (`02-01`, `phase-02`) based on commit strategy
- **The git diff** is the source of truth for *how* — the message explains *what* and *why*

### Trailer Format by Strategy

| Strategy | Trailer Format | Example |
|----------|---------------|---------|
| **per-phase** (default) | `phase-{NN}` | `phase-02` |
| **per-plan** | `{phase}-{plan}` | `02-01` |
| **per-task** | `{phase}-{plan}` | `02-01` |

### Config Storage

```json
{
  "git": {
    "commit_strategy": "per-phase"
  }
}
```

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
│                    PLAN CHECKER PANEL                         │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   QUALITY     │  │  CONTEXTUAL    │  │   EXPERT      │    │
│  │  ADVOCATE     │  │  (derived)     │  │  (dynamic)    │    │
│  │               │  │                │  │               │    │
│  │  Always       │  │ Project-       │  │ Plan-         │    │
│  │  runs         │  │ derived        │  │ specific      │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
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

---

## Session Continuity

Fuska tracks your progress **continuously** — you don't need to explicitly save state before ending a session.

### What's Tracked Automatically

The executor updates the state concept after **every task commit**:

| Field | Example | Updated When |
|-------|---------|--------------|
| `current_phase` | `phase-02` | Phase transitions |
| `current_plan` | `phase-02-plan-03` | Plan starts/completes |
| `current_task` | `3` | After each task commit |
| `total_tasks` | `7` | When plan loads |
| `last_activity` | `Task 3/7: Add form validation` | After each task commit |
| `status` | `in_progress` | State changes |

This means `/fuska-resume-work` always knows exactly where you are — **even if you never ran pause-work**.

### When to Use `/fuska-pause-work`

Since progress is tracked automatically, pause-work is now **optional**. Use it only when you want to capture **mental context**:

```
/fuska-pause-work
```

**Captures:**
- Your mental context ("Was about to refactor to use a Map for O(1) lookups")
- Modified files (optional WIP commit)

**Does NOT need to capture:**
- Task position (already in state)
- Completed work (already in summaries)
- Decisions (already in decision concepts)

### When Resume Works Without Pause

```bash
# End session mid-execution (no pause-work)
# ... next day ...

/fuska-resume-work
# → "Phase 2 — Shopping List. Task 3 of 7."
# → "No mental context (no pause recorded)"
# → Continues from task 3
```

Resume always works because task position is tracked continuously.

### When Resume Shows Extra Context

```bash
# Pause with mental context
/fuska-pause-work
# → "What's the context?" → "Was about to refactor grouping logic to use Map"

# ... next day ...

/fuska-resume-work
# → "Phase 2 — Shopping List. Task 3 of 7."
# → "Context: Was about to refactor grouping logic to use Map"
# → Continues from task 3 with your notes
```

### Key Insight

**Checkpoint** ≠ **pause-work**:

- **Checkpoint** — A structured pause point during execution where user verification is required (e.g., visual review, decision input). Defined in plans with `type="checkpoint:human-verify"`.
- **pause-work** — Optional command to capture mental context before ending a session. Task progress is already saved.

You can run `/fuska-resume-work` at any time — it will show your exact position whether or not you paused.
