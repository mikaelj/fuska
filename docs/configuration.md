# Configuration

> All the knobs — model profiles, git strategy, checker panel, and import graph settings.

**Audience:** Daily users, anyone tuning their setup
**Prerequisites:** [Getting Started](getting-started.md), [Key Concepts](concepts.md)

---

## Using fuska config

```bash
fuska config [project-dir]
```

From this menu you can configure:
- **Quick settings** — switch model profile (quality/balanced/budget) and workflow mode
- **Model aliases** — configure which models map to quality/balanced/budget/explore
- **Git commit strategy** — switch between per-chapter / per-plan / per-task
- **Import graph settings** — auto-refresh mode and staleness threshold
- **Stage overrides** — set a specific model for planning, execution, or verification
- **Reset presets** — reconfigure all profiles from scratch

Use `fuska config --view` to view current settings non-interactively.

---

## Initiative Integrity

Fuska automatically validates that your `current_initiative` pointer matches an existing initiative in MegaMemory. Mismatches can occur if:

- Initiative was renamed after creation
- Slug was derived differently during `/fuska-configure`
- Manual edits to the knowledge graph

### Automatic Detection

When running any slash command, Fuska checks initiative integrity. If a mismatch is detected, you'll see:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ⚠️  INITIATIVE CONFIGURATION ISSUE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The current initiative pointer doesn't match any existing initiative.
Run `fuska config` to fix this issue.
```

### Quick Validation

```bash
fuska config --check            # Exit 0 (valid) or 1 (invalid)
fuska config --check --json     # JSON output for scripts
```

### Repair

Run `fuska config` and select "Fix initiative configuration" to choose which initiative should be current.

---

## Model Profiles

A **model profile** controls which AI model is used for each stage. Three presets are available:

| Profile | Planning | Build | Review | Best For |
|---------|----------|-----------|--------------|----------|
| **quality** | Strongest | Strongest | Strongest | Critical architecture, quota available |
| **balanced** (default) | Strong | Mid-tier | Mid-tier | Normal development |
| **budget** | Mid-tier | Mid-tier | Lightweight | High-volume work, conserving quota |

Switch profiles:

```bash
fuska config
# Select "Quick settings" -> choose profile
```

Or view current settings:

```bash
fuska config --view
```

### Model Aliases

Model aliases are named slots that map to actual model IDs. They provide an indirection layer so you can change an underlying model in one place.

| Alias | Purpose | Profile-dependent? |
|-------|---------|-------------------|
| `quality_model` | Strongest model — used in quality profile stages | Yes |
| `balanced_model` | Mid-tier model — used in balanced profile stages | Yes |
| `budget_model` | Lightweight model — used in budget profile stages | Yes |
| `explore_model` | Fast model for OpenCode's explore subagent | **No** |

`explore_model` is profile-independent: it controls OpenCode's built-in `@explore` subagent and does not change when switching between quality/balanced/budget profiles. Even in quality mode you want codebase searches to use a fast, cheap model.

Configure aliases:

```bash
fuska config
# Select "Model aliases"
```

**Model selection UX:** When selecting models, the full list is shown immediately. Type to filter — matching is fuzzy (e.g., "glm5" matches "zai-coding-plan/glm-5").

---

## Stages

A **stage** is a category of work in the Fuska workflow. Each stage uses different agents, and the model profile determines which AI model powers them.

| Stage | Agents | Purpose |
|-------|--------|---------|
| **Planning** | planner, plan-checker, researcher, roadmapper, project-researcher, research-synthesizer, codebase-mapper | Chapter decomposition, dependency analysis, goal-backward verification |
| **Build** | builder, debugger | Implementing plan tasks with atomic commits, deviation handling |
| **Review** | reviewer, integration-checker | Goal-backward verification, quality assurance |

**Why planning gets the strongest models:** Planning involves architecture decisions, goal decomposition, and task design — where model quality has the highest impact. Execution follows the plan's explicit instructions, so mid-tier models suffice.

---

## Git Commit Strategy

Controls how often Fuska creates git commits during execution. Set during `/fuska-configure`.

### Commit Message Format

All commits follow semantic commit format with a chapter/plan trailer:

```
{type}({scope}): {concise description}

- {high-level change 1}
- {high-level change 2}

{chapter-plan}
```

- **Type:** `feat`, `fix`, `test`, `refactor`, `perf`, `chore`, `docs`, `wip`
- **Scope:** Semantic area being changed (e.g., `auth`, `checkout`, `jose`, `api`) — NOT chapter numbers
- **Body:** 2-4 bullets, high-level *what* and *why* only
- **Trailer:** Chapter-plan identifier (e.g., `02-01` for plan 1 in chapter 2)

### Example: Same Work, Different Strategies

Three tasks in plan 02-01 (JWT auth): set up jose library, add refresh token rotation, protect routes with middleware.

*per-chapter* — 1 commit for the entire chapter:
```
feat(auth): add JWT authentication with refresh tokens

- Integrate jose library for token signing and validation
- Implement refresh token rotation with secure storage
- Protect routes with auth middleware

chapter-02
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
- **Trailer:** chapter-plan identifier (`02-01`, `chapter-02`) based on commit strategy
- **The git diff** is the source of truth for *how* — the message explains *what* and *why*

### Trailer Format by Strategy

| Strategy | Trailer Format | Example |
|----------|---------------|---------|
| **per-chapter** (default) | `chapter-{NN}` | `chapter-02` |
| **per-plan** | `{chapter}-{plan}` | `02-01` |
| **per-task** | `{chapter}-{plan}` | `02-01` |

**Why per-chapter is the default:** For solo dev + AI workflows, MegaMemory already tracks granular task completion. Per-chapter gives the cleanest git history while MegaMemory handles the detailed context. Use per-task if you need fine-grained `git bisect` or work with other developers who rely on git log.

---

## Thinking Variants

Fuska uses **thinking variants** to control how much reasoning budget the model gets per step type. Each Task call specifies a `variant` parameter that maps to a named thinking configuration in your model definition.

| Variant | Thinking Budget | Output Budget | Used By |
|---------|----------------|---------------|---------|
| `plan` | 32k | ~33k | Researchers, planners, codebase mappers, roadmappers |
| `validate` | 24k | ~41k | Plan checkers, verifiers, debuggers, integration checker |
| `execute` | 8k | ~57k | Executors, doc writers |
| `amend` | 16k | balanced | Git message generators, research synthesizers |

**Why it matters:** Planning and research benefit from deep reasoning (32k thinking), while code execution benefits from maximum output space (57k for writing files). Validation needs thorough analysis but less output. Amend tasks are short conversational interactions.

### OpenCode Configuration

Define variants in your `opencode.jsonc` model configuration. The variant names must match exactly (`plan`, `validate`, `execute`, `amend`):

```jsonc
"glm-5": {
  "reasoning": true,
  "interleaved": true,
  "limit": {
    "context": 135000,
    "output": 65000
  },
  "options": {
    "temperature": 1,
    "top_p": 0.95,
    "maxOutputTokens": 65000,
    "thinking": {
      "type": "enabled",
      "budgetTokens": 32000
    }
  },
  "variants": {
    // Deep architectural logic; leaves ~33k tokens for plan documents.
    "plan": { "thinking": { "type": "enabled", "budgetTokens": 32000 } },

    // Critical review; leaves ~41k tokens for validation notes.
    "validate": { "thinking": { "type": "enabled", "budgetTokens": 24000 } },

    // Minimal thinking; reserves ~57k tokens purely for writing code.
    "execute": { "thinking": { "type": "enabled", "budgetTokens": 8000 } },

    // Balanced logic for conversational tweaks and follow-up.
    "amend": { "thinking": { "type": "enabled", "budgetTokens": 16000 } }
  }
}
```

Without variants defined, all agents use the model's default thinking budget. With variants, each agent type gets a budget tuned to its role.

---

## Per-Stage Overrides

Override the model for a specific stage without changing the profile:

```bash
fuska config
# Select "Set stage override" -> choose stage and model
```

Where `<stage>` is one of: `planning`, `execution`, or `verification`.

You can also override per-chapter with flags on `/fuska plan`:
- `--mode <MODE>` — Override workflow mode for this chapter only (one-off, doesn't persist)
- `--research` — Enable researcher (augments the selected mode)
- `--skip-research` — Skip researcher
- `--skip-verify` — Skip plan verification

You can override per-chapter with flags on `/fuska build`:
- `--mode <MODE>` — Override workflow mode for this chapter only (one-off, doesn't persist)
- `--verify` — Force verifier to run (even in modes that normally skip it)

---

## Checker Panel

The **checker panel** is a role-based plan verification system that runs during `/fuska plan`. Instead of a single plan checker, it uses a panel of specialized checkers that provide different perspectives:

```
+----------------------------------------------------------+
|                    PLAN CHECKER PANEL                     |
+----------------------------------------------------------+
|  +---------------+  +---------------+  +---------------+ |
|  |   QUALITY     |  |  CONTEXTUAL   |  |   EXPERT      | |
|  |  ADVOCATE     |  |  (derived)    |  |  (dynamic)    | |
|  |               |  |               |  |               | |
|  |  Always       |  | Project-      |  | Plan-         | |
|  |  runs         |  | derived       |  | specific      | |
|  +---------------+  +---------------+  +---------------+ |
+----------------------------------------------------------+
```

### Panel Composition

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

### Cross-Validation

When 2+ checkers flag the same issue, it gets a `cross_validated` badge and severity boost (low -> medium -> high -> critical). Cross-validated issues appear first in the output.

### Viewing and Overriding

```bash
fuska config
# Select "Checker panel settings"
```

This shows:
- Current project classification (type, confidence, detection signals)
- Current contextual role (auto-detected or manually overridden)
- Options to override the contextual role or reset to auto-detect

**When detection happens:**
- `/fuska map` detects project type and stores `checker_panel` settings in the config concept
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

## Import Graph Settings

The import graph stores file and symbol-level dependency data in MegaMemory. It is built automatically during `fuska init` (via `/fuska-map-codebase`) and can be updated incrementally with `/fuska-refresh`.

```bash
fuska config
# Select "Import graph settings"
```

### Refresh Mode

| Mode | Behavior |
|------|----------|
| **hybrid** (default) | Auto-refresh when stale (>age_hours) or Git SHA changed. Triggers before plan, execute, and debug. |
| **manual** | Only refresh when you run `/fuska-refresh` explicitly |
| **disabled** | Never auto-refresh; commands fall back to grep |

### Staleness Threshold

`age_hours` (default: 24) — how many hours before the graph is considered stale. In hybrid mode, stale graphs are refreshed automatically before planning, execution, and debugging.

### Config Storage

```json
{
  "refresh": {
    "mode": "hybrid",
    "age_hours": 24,
    "auto_before": ["plan", "build", "debug"],
    "last_sha": "abc123",
    "last_refresh": "2026-02-17T10:00:00Z",
    "files_scanned": 147,
    "symbols_indexed": 892,
    "dead_code_count": 3
  }
}
```

### View Status

Select "View status" from the import graph settings menu to see current refresh metadata (last SHA, files scanned, symbols indexed, dead code count).

---

## See Also

- [workflow.md](workflow.md) — See modes and settings in action
- [commands.md](commands.md) — Full command reference
- [concepts.md](concepts.md) — Mental model and glossary
