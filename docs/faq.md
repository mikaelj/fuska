# FAQ

> Common questions from developers evaluating or getting started with Fuska.

**Audience:** New users, anyone comparing Fuska to other approaches
**Prerequisites:** Skimming the [README](../README.md) helps, but isn't required

---

## I already store context in markdown files that my AI CLI reads at startup. What does Fuska do differently?

Markdown context files (like `CLAUDE.md`, `GEMINI.md`, `.cursorrules`) are a great start — but they're flat, manual, and read in full every session. Fuska builds on that idea with four key differences:

- **Agent orchestration, not manual prompting.** One command (`/fuska-do checked add dark mode`) triggers a chain of specialized agents — researcher, planner, plan checker panel, builder, code reviewer — each with a focused role. You don't paste instructions step by step.
- **Persistent knowledge graph, not flat files.** MegaMemory stores your project state as typed, searchable concepts with relationships. Agents retrieve only what's relevant (O(1) semantic search), and the graph updates itself as work progresses. No manual file editing.
- **Plan validation before code.** An [expert panel](configuration.md#checker-panel) of three specialized reviewers interrogates every plan before a single line gets written. When two reviewers flag the same issue, severity escalates automatically.
- **Code review after code.** A dedicated code reviewer agent examines the actual diff against the plan — catching bugs, security issues, and deviations. Up to three review-fix iterations before commit.

For benchmarks comparing MegaMemory to file-based approaches, see [development.md](development.md#performance-benchmarks). For the full pitch, see [PITCH.md](PITCH.md).

---

## Does Fuska replace my code agent (Claude Code, OpenCode, Cursor)?

No. Fuska runs *inside* your code agent as slash commands and agents. It orchestrates the agent's work — planning, validating, reviewing — it doesn't replace the agent itself.

Currently supports **OpenCode** and **Claude Code**.

---

## What happens if I close my terminal mid-task?

State is saved to MegaMemory after every commit. Next time, run `/fuska` (bare, no arguments) — it shows exactly where you left off and what to do next. No pause/resume commands needed.

See [Session Continuity](workflow.md#session-continuity) for details on what's tracked automatically.

---

## Is my project data sent to a server?

No. MegaMemory is a local SQLite database in your project directory (`.megamemory/`). Nothing leaves your machine unless your code agent's LLM provider sees it during normal API calls — which is the same as using any AI coding tool.

See [concepts.md](concepts.md) for more on how MegaMemory works.

---

## Can I use Fuska with an existing project that already has code?

Yes. `fuska init` works on existing repos. It creates the knowledge graph and optionally maps your existing codebase structure, domains, and import graph.

If you're migrating from a `.planning/` directory, `fuska migrate planning` imports that too.

See [getting-started.md](getting-started.md) for the full setup guide.

---

## What if the expert panel rejects my plan?

The panel doesn't reject — it provides findings with severity levels. You see the feedback, decide what to address, and can re-plan or proceed. When two reviewers independently flag the same issue, severity escalates automatically via cross-validation.

See [Checker Panel](configuration.md#checker-panel) for how the panel is composed and configured.

---

## How much does Fuska cost in tokens/money?

Fuska itself is free and open source. Token cost depends on the workflow mode you choose — you pick the pipeline length per task:

| Mode | Pipeline | LLM invocations |
|------|----------|-----------------|
| `planned` | Planner → Builder → Code Reviewer | ~3–5 |
| `checked` | + Plan Checker panel | ~4–7 |
| `researched` | + Researcher before planning | ~5–8 |
| `verified` | + post-build Reviewer | ~6–9 |

**Compared to GSD:** GSD has a fixed pipeline (research → plan → plan-check → execute → verify) that runs ~8–14 LLM invocations per phase with no way to skip steps. Its lighter option (`/gsd:quick`) drops to ~2–3 invocations but also drops plan checking, verification, and code review. Fuska's graduated modes let you scale from `planned` (3 invocations, still includes code review) up to `verified` (9 invocations, full assurance) — matching effort to task complexity.

**Savings in practice:** For a typical task, `planned` mode uses ~60–75% fewer LLM calls than GSD's standard pipeline — which also means fewer tool-call round-trips (the slowest part of any agentic workflow). On top of that, each invocation is cheaper: GSD loads full markdown files as context every call, while Fuska's MegaMemory retrieves only relevant concepts via semantic search. Fewer calls *and* less context per call.

CLI commands like `fuska progress`, `fuska todo`, and `fuska config` cost zero tokens — they're pure Node.js. You can also configure cheaper models for less critical stages via [per-stage overrides](configuration.md#per-stage-overrides).

---

## Does Fuska work for teams or only solo developers?

Currently designed for solo agentic development. Multiple developers can work on the same repo using git worktrees (`fuska git worktree add/merge`), each with their own MegaMemory context that syncs back on merge. But there's no real-time collaboration or shared task assignment.

---

## Which AI models does Fuska support?

Any model supported by your code agent. Configure quality/balanced/budget tiers via `fuska config` — use expensive models for planning and cheap ones for execution. Not locked to any specific provider.

See [configuration.md](configuration.md#per-stage-overrides) for model aliases and per-stage overrides.

---

## Can I see what Fuska has stored about my project?

Yes, several ways:

- **`fuska export`** — dumps the entire knowledge graph to readable markdown files
- **`fuska ask`** — query the knowledge graph in natural language
- **MegaMemory MCP tools** — available directly in your code agent's conversation
- **`fuska info`** — shows codebase and domain mappings (tech stack, architecture, business domains, file groups)
- **`fuska progress`** — shows initiative status: completed chapters, next steps, ad-hoc tasks, and a recommended next command
- **Direct inspection** — the SQLite database in `.megamemory/` is a standard SQLite file
