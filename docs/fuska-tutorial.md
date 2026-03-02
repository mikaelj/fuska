# Fuska Tutorial: Build a Todo App with AI-Driven Project Management

> **"Fuska"** means "to cheat" in Swedish — because the smartest way to build software is to let AI do the heavy lifting.

This tutorial walks you through building a one-page web Todo app using **Fuska**, an initiative-based project management system for solo agentic development. By the end you'll understand how Fuska structures work into initiatives, chapters, and plans — and why that beats winging it with a blank prompt.

**What you'll learn:**

- Installing and configuring Fuska
- Initializing a project with `fuska init`
- Configuring your initiative interactively with `/fuska-configure`
- Designing chapters with `/fuska-design` (optional)
- Working through chapters: plan → build → review
- How the expert panel plan-checker and code reviewer catch problems before they ship
- Creating a second initiative to add a feature

**Prerequisites:**

- Node.js >= 18
- Git
- [OpenCode](https://github.com/nichochar/opencode) installed (or Claude Code)
- An API key for your preferred LLM provider (Anthropic, OpenAI, etc.)

---

## Part 1 — Install Fuska

### 1.1 Install the npm package

```bash
npm install -g fuska-magistern@latest
```

This gives you the `fuska` CLI globally.

### 1.2 Run the Fuska installer

```bash
fuska install
```

You'll be prompted to select your AI provider:

```
? Select provider(s) to install for:
  ❯ opencode
    claude
    both
```

Pick **opencode** (or your provider of choice). Fuska creates symlinks so future `npm update -g fuska-magistern` updates take effect immediately — no reinstall needed.

**What just happened?** Fuska installed slash commands (`/fuska-configure`, `/fuska-plan`, `/fuska-build`, etc.) as OpenCode user commands. MegaMemory registration happens later during `fuska init`.

---

## Part 2 — Configure Fuska (Global Settings)

Before creating a project, you can tweak Fuska's global configuration:

```bash
fuska config
```

This opens an interactive TUI where you can set:

- **Model aliases** — map `quality_model`, `balanced_model`, `budget_model` to any OpenCode-supported model
- **Default workflow mode** — `standard`, `thorough`, `balanced`, `fast`, `quick`, or `direct`
- **Commit strategy** — `per-task`, `per-plan`, or `per-chapter`
- **Interactive review** — whether to prompt you before building

For this tutorial, the defaults work fine. Move on or explore the settings — the TUI is self-explanatory.

> **Why this matters:** Unlike raw AI coding where you configure nothing and get inconsistent results, Fuska lets you lock in your preferences once. Every future session respects them.

---

## Part 3 — Create the Todo App Project

### 3.1 Scaffold the project

```bash
mkdir fuska-todo-app
cd fuska-todo-app
git init
```

Create a minimal starting point — just an empty `index.html`:

```bash
cat > index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Todo App</title>
</head>
<body>
  <h1>Todo App</h1>
</body>
</html>
EOF

git add -A && git commit -m "chore: initial scaffold"
```

### 3.2 Initialize Fuska

```bash
fuska init "A single-page vanilla JS todo app with local storage persistence, add/complete/delete tasks, and a clean modern UI"
```

This does several things:

1. **Creates `.megamemory/`** — the SQLite knowledge graph database
2. **Creates the "main" initiative** — with state, roadmap, milestones, todos, and research modules
3. **Registers MegaMemory as an MCP server** so your AI agent can read/write project knowledge
4. **Maps the codebase** — scans your files, detects tech stack, architecture patterns, and import graph

You'll see output like:

```
✓ Git repository found
✓ MegaMemory database created
✓ Initiative "main" created
✓ MegaMemory MCP server registered
✓ Codebase mapped (1 file, HTML detected)
```

> **Why this matters (vs. manual AI coding):** Without Fuska, your AI agent starts every session with zero context. It doesn't know what you've built, what you've decided, or where you left off. With `fuska init`, all that context is persisted in MegaMemory's knowledge graph — forever searchable, session-independent.

### 3.3 Check your status

```bash
fuska progress
```

You should see something like:

```
Working in standard planning depth (balanced) mode

No initiative active. Run fuska initiative switch to activate. Available:
* main

Available commands:
fuska initiative switch — switch to an initiative
fuska do — execute a standalone task
fuska info — view codebase and domain mappings
```

The initiative exists but has no roadmap yet, so progress lists it as available. Next, we'll configure it with `/fuska-configure`.

---

## Part 4 — Configure the Initiative (Interactive Mode)

Launch OpenCode in your project directory:

```bash
opencode
```

Then run the configure command:

```
/fuska-configure
```

Since you provided a description during `init`, Fuska already knows what you're building. It will ask focused follow-up questions to fill in gaps:

### The interactive questioning flow

**Step 1 — Clarify requirements**

Fuska will ask targeted questions derived from your description. For a todo app, expect things like:

```
I see you're building a vanilla JS todo app with local storage.
A few questions to nail down the requirements:

1. Should tasks support editing after creation, or just add/complete/delete?
2. Do you want task categories or tags?
3. Should completed tasks be hidden or shown with strikethrough?
4. Any preference on CSS approach — custom CSS, or a micro-framework like Pico?
```

Answer naturally. For this tutorial, keep it simple:

> "Just add, complete (toggle), and delete. No categories. Show completed with strikethrough. Custom CSS, no framework. Keep it minimal."

**Step 2 — Workflow preferences**

Fuska asks how you want to work. It will interactively prompt you for:

- **Workflow mode** — `standard` (full pipeline with research, planning, checking, and verification), `thorough`, `balanced`, `fast`, `quick`, or `direct`
- **Commit strategy** — `per-chapter` (default, cleanest history), `per-plan`, or `per-task`

The mode determines which pipeline stages run. For a simple todo app, `standard` mode works well. Accept the defaults or adjust.

**Step 3 — Roadmap creation**

Fuska generates a chapter-based roadmap and stores it in MegaMemory:

```
Created roadmap with 3 chapters:

Chapter 1: Core HTML Structure and Styling
  Goal: Build the semantic HTML structure and CSS for the todo interface
  
Chapter 2: Todo Logic and Local Storage
  Goal: Implement add/complete/delete with localStorage persistence
  
Chapter 3: Polish and Edge Cases
  Goal: Empty states, keyboard support, animations, mobile responsiveness
```

**This is where Fuska diverges fundamentally from "just ask the AI to build it."** Instead of a single vague prompt, you now have:

- **Structured requirements** captured permanently
- **A roadmap** with explicit deliverable chapters
- **Success criteria** for each chapter
- **Everything stored in MegaMemory** — searchable, persistent, resumable

**Step 4 — Design discussion (optional)**

Before jumping into planning, you can discuss the design with Fuska:

```
/fuska-design 1
```

This opens an interactive discussion about Chapter 1's approach. Fuska loads the chapter context from MegaMemory and lets you explore alternatives, clarify intent, or refine scope. For a simple todo app, you might skip this — but for complex chapters, it's invaluable.

---

## Part 5 — Work Through the Chapters

### 5.1 Plan Chapter 1

```
/fuska-plan
```

Fuska auto-detects you're on Chapter 1 and invokes the **planner agent**, which creates a detailed task list:

```
Plan for Chapter 1: Core HTML Structure and Styling

Batch 1 (sequential):
  Task 1.1: Create semantic HTML structure
    - Add input field with placeholder
    - Add button for adding todos
    - Add <ul> container for todo items
    - Target: index.html

  Task 1.2: Add CSS styling
    - Modern card-based layout
    - Centered container, max-width 500px
    - Input and button styles
    - Todo item styles with checkbox
    - Strikethrough style for completed items
    - Target: index.html (<style> block)

Verification: Open in browser, visually confirm layout
```

### The Expert Panel validates your plan

Because you're in `checked` mode, the plan now goes through Fuska's **expert panel** — three specialized reviewers:

1. **Quality Advocate** (always present) — checks task completeness, testability, error handling
2. **Contextual role** (auto-detected from project type) — for a web app, this is the **Security Auditor**
3. **Expert role** (derived from this specific plan) — for UI work, perhaps a **UX Consistency Expert**

Each reviewer independently evaluates the plan. When two or more reviewers flag the same issue, it gets a **cross-validated severity boost**.

You might see feedback like:

```
Expert Panel Review:

Quality Advocate:
  ✓ Tasks are clear and verifiable
  ⚠ MINOR: No mention of accessibility (aria labels, focus states)

Security Auditor:
  ✓ No security concerns for static HTML/CSS chapter

UX Consistency Expert:
  ⚠ MINOR: No mention of accessibility (aria labels, focus states)
  ⚠ MINOR: Consider hover/active states for interactive elements

Cross-validated (severity boosted):
  ⚠ MODERATE: Accessibility — add aria-label to input, focus-visible styles
    (flagged by Quality Advocate + UX Consistency Expert)

Verdict: PASS with suggestions
```

The planner automatically incorporates the cross-validated feedback before presenting the final plan to you.

> **This is the key insight.** Without Fuska, your AI agent would just start writing code. No review, no second opinion, no accessibility check. Fuska's expert panel catches issues *before a single line of code is written*.

### You review and approve

```
Plan ready for Chapter 1. Proceed with build? [Y/n]
```

Type `Y` to approve.

### 5.2 Build Chapter 1

```
/fuska-build
```

The **builder agent** executes each task:

1. Modifies `index.html` with the semantic structure
2. Adds the `<style>` block with modern CSS
3. Includes accessibility attributes from the plan-checker feedback

After all tasks complete and pass code review, the builder creates a chapter commit (the default `per-chapter` strategy). You'll see:

```
✓ Task 1.1: Created HTML structure (index.html)
✓ Task 1.2: Added CSS styling (index.html)

Running code review...
```

### The code reviewer validates the implementation

The **code reviewer agent** examines the actual diff against the plan:

```
Code Review (iteration 1/3):

✓ HTML structure matches plan
✓ CSS styling matches plan  
✓ Accessibility attributes present
⚠ FIX: Missing `<meta name="description">` tag

Auto-fixing...

Code Review (iteration 2/3):
✓ All issues resolved

Commit: feat(ui): create core HTML structure and styling for todo app

  Chapter: 1 / Plan: 1
```

> **Without Fuska:** Your code ships with whatever the AI happened to produce. No second look, no validation against intent. With Fuska, every piece of code gets reviewed against the plan — and the reviewer can trigger up to 3 fix iterations automatically.

### 5.3 Check progress

```bash
fuska progress
```

```
Initiative main using standard planning depth (balanced) mode

Done:
* Chapter 1.1: Created HTML structure and CSS styling for todo interface

Future:
* Chapter 3: Polish and Edge Cases

Next:
* Chapter 2: Todo Logic and Local Storage
  Planning needed.

Run /fuska-plan 2 to continue
```

### 5.4 Plan and build Chapter 2

```
/fuska-plan
```

The planner creates tasks for the JavaScript logic:

```
Plan for Chapter 2: Todo Logic and Local Storage

Batch 1:
  Task 2.1: Implement todo data model and rendering
    - Array of {id, text, completed} objects
    - Render function that rebuilds the list from state
    - Target: index.html (<script> block)

  Task 2.2: Implement add todo
    - Read input value, create todo object
    - Push to array, re-render, clear input
    - Handle empty input edge case

Batch 2 (depends on Batch 1):
  Task 2.3: Implement toggle complete and delete
    - Toggle completed boolean on click
    - Delete button removes from array
    - Re-render after each action

  Task 2.4: Add localStorage persistence
    - Save to localStorage on every state change
    - Load from localStorage on page load
    - Handle corrupted/missing data gracefully
```

Expert panel reviews, you approve, then build:

```
/fuska-build
```

The builder implements all tasks, the code reviewer validates, and you get a clean chapter commit.

### 5.5 Plan and build Chapter 3

```
/fuska-plan
```

```
/fuska-build
```

Chapter 3 handles polish: empty states, keyboard support (Enter to add), transitions, and responsive design.

### 5.6 Done!

```bash
fuska progress
```

```
Initiative main using standard planning depth (balanced) mode

Done:
* Chapter 3.1: Polish, keyboard support, animations
* Chapter 2.1: JavaScript logic with localStorage
* Chapter 1.1: HTML structure and CSS styling

Future:
* (no more chapters)

Next:
* (all chapters complete)

Run /fuska-complete-milestone to continue
```

Open `index.html` in your browser — you have a fully functional todo app, built through a structured process with validation at every step.

---

## Part 6 — What Fuska Gave You (vs. Doing It Manually)

Let's be explicit about what was different:

| Aspect | Manual AI Coding | With Fuska |
|--------|-----------------|------------|
| **Context between sessions** | Gone. Start over every time. | Persistent in MegaMemory. Pick up exactly where you left off. |
| **Plan quality** | You hope the AI's first idea is good | Expert panel of 3 specialized reviewers catches issues before coding starts |
| **Cross-cutting concerns** | Forgotten unless you remember to ask | Automatically checked — accessibility, security, edge cases |
| **Code review** | None, or you do it yourself after | Automatic review against the plan, up to 3 fix iterations |
| **Commit history** | One giant commit (or none) | Domain-aware commits per chapter (configurable to per-plan or per-task) |
| **Resumability** | "Where was I?" | `fuska progress` tells you exactly what's next |
| **Structure** | Freeform chat | Initiatives → Chapters → Plans → Tasks with dependencies |
| **Dirty working directory** | AI might "fix" your unrelated changes | Fuska warns you and offers options (commit, stash, skip review) |

---

## Part 7 — Add a New Feature: Create a Second Initiative

Your todo app works. Now your user wants **due dates with overdue highlighting**. This is a separate effort — a new initiative.

### 7.1 Why create a separate initiative?

> **Initiatives are efforts, not codebases.** "main" was about building the todo app. "due-dates" is about adding due date support. They're conceptually separate even though they touch the same files. Each has its own requirements, roadmap, and milestones.

### 7.2 Create the new initiative via CLI

Use the CLI to create a new initiative:

```bash
fuska initiative new due-dates "Add due date support with overdue highlighting for todos"
```

This creates the initiative in MegaMemory and automatically switches to it:

```
✓ Created initiative: due-dates
✓ Switched active initiative to: due-dates
```

You can also list and switch between initiatives:

```bash
fuska initiative list
```

```
Initiative: due-dates (active)
  Goal: Add due date support with overdue highlighting for todos
  Progress: 0/0 chapters

Other initiatives:
  * main — A single-page vanilla JS todo app... (3/3 complete)
```

```bash
fuska initiative switch main
fuska initiative switch due-dates
```

### 7.3 Configure the new initiative

Now configure the new initiative with its specific requirements:

```
/fuska-configure
```

Fuska will ask about the due date feature:

```
I see you're adding due date support to the todo app.
A few questions to nail down the requirements:

1. Should the date picker be native HTML5 or a library like flatpickr?
2. How should overdue items be highlighted — just red text, or also background color?
3. Should users be able to edit due dates after creation?
```

Answer naturally:

> "Native HTML5 date picker. Red background for overdue items. Yes, allow editing due dates."

Fuska generates a roadmap:

```
Created roadmap with 2 chapters:

Chapter 1: Date Picker and Data Model
  Goal: Add date input, extend todo data model, update localStorage schema

Chapter 2: Overdue Logic and Sort Order
  Goal: Highlight overdue items, sort by due date, handle timezone edge cases
```

### 7.4 Work through the new initiative

Same flow as before:

```
/fuska-plan       # Plans chapter 1 of due-dates initiative
/fuska-build      # Builds it with code review
/fuska-plan       # Plans chapter 2
/fuska-build      # Builds and reviews
```

### 7.5 Switch between initiatives

At any time:

```bash
fuska initiative list
fuska initiative switch main
fuska initiative switch due-dates
```

Each initiative maintains its own independent state, progress, and roadmap — all in the same MegaMemory knowledge graph.

### 7.6 Check progress on the new initiative

```bash
fuska progress
```

```
Initiative due-dates using standard planning depth (balanced) mode

Done:
* Chapter 2.1: Overdue highlighting, sorting by due date
* Chapter 1.1: Added date picker, extended data model, migrated localStorage

Future:
* (no more chapters)

Next:
* (all chapters complete)

Run /fuska-complete-milestone to continue
```

---

## Part 8 — The Ad-Hoc Alternative: `fuska do`

Not everything needs the full chapter lifecycle. For quick tasks, use `fuska do` with one of four modes:

```bash
# Simple: just plan and build
fuska do planned "add a favicon to the todo app"

# Validated: plan gets checked before building  
fuska do checked "add dark mode toggle to the settings page"

# Researched: research first, then plan, check, and build
fuska do researched "implement OAuth login with Google"

# Full pipeline: research, plan, check, build, review
fuska do verified "add PWA offline support"
```

> **Note:** The CLI `fuska do` command runs non-interactively by default — it auto-commits without prompting. For interactive mode with review prompts, use the OpenCode slash command `/fuska-do` instead.

Each mode adds layers of validation:

| Mode | Pipeline | Best for |
|------|----------|----------|
| `planned` | Plan → Build → Code Review | You know exactly what you want |
| `checked` | Plan → **Plan Check** → Build → Code Review | Want a second opinion on the plan |
| `researched` | **Research** → Plan → Plan Check → Build → Code Review | Need to investigate before planning |
| `verified` | Research → Plan → Plan Check → Build → Code Review → **Verification** | High-stakes changes, need post-build verification |

---

## Part 9 — Session Continuity: Just Pick Up Where You Left Off

One of Fuska's strongest features is invisible: **you never need to "save" or "pause" your work.** State is written to MegaMemory after every operation.

Close your terminal. Come back tomorrow. Open your project:

```bash
cd fuska-todo-app
opencode
```

Type:

```
/fuska
```

Fuska reads MegaMemory and tells you exactly where you are:

```
Initiative due-dates using checked mode

Status: complete (2/2 chapters)

All chapters for "due-dates" are complete.

Other initiatives:
  * main — 3/3 chapters complete

No pending work. Create a new initiative or use:
  fuska do <mode> <description>
```

No context loss. No "let me re-read the codebase." No starting over. MegaMemory remembers everything.

---

## Summary: The Fuska Workflow

```
fuska install              # One-time: install CLI and slash commands
fuska config               # One-time: set model preferences

fuska init "description"   # Per-project: create initiative + map codebase
/fuska-configure           # Per-initiative: define requirements + create roadmap
/fuska-design 1            # Optional: discuss chapter design before planning

/fuska-plan                # Per-chapter: create validated task list
/fuska-build               # Per-chapter: implement with code review
/fuska                     # Anytime: see where you are and what's next

fuska do <mode> "task"     # Ad-hoc: quick tasks outside the chapter lifecycle
fuska initiative new       # Create a new initiative
fuska initiative switch    # Switch between efforts in the same codebase
```

**The mental model:**
- An **initiative** is an effort ("build the app", "add due dates")
- A **chapter** is a deliverable chunk with a goal and success criteria
- A **plan** is a dependency-aware task list, validated by an expert panel
- **MegaMemory** is the persistent brain that makes it all survive across sessions

---

## Next Steps

- Read the full [Fuska README](https://github.com/mikaelj/fuska) for the complete command reference
- Check [docs/workflow.md](https://github.com/mikaelj/fuska/blob/main/docs/workflow.md) for 9 end-to-end workflow scenarios
- See [docs/fuska-do-session-distilled.md](https://github.com/mikaelj/fuska/blob/main/docs/fuska-do-session-distilled.md) for an annotated real session where the code reviewer catches a bug
- Explore [docs/configuration.md](https://github.com/mikaelj/fuska/blob/main/docs/configuration.md) for all the configuration knobs

> **Coming up:** A companion walkthrough with a real OpenCode session transcript, showing the actual agent interactions — planner output, expert panel feedback, builder commits, and code review iterations — for this exact todo app project.
