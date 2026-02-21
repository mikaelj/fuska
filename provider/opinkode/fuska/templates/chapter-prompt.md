# Chapter Prompt Template (MegaMemory-Backed)

> **Note:** Planning methodology is in `agents/fuska-planner.md`.
> This template defines the PLAN.md output format that the agent produces.

Template for chapter plan storage in MegaMemory - executable chapter plans optimized for parallel execution.

**Naming:** Use `{chapter}-{plan}-PLAN.md` format (e.g., `01-02-PLAN.md` for Chapter 1, Plan 2)

---

<megamemory_schema>

## Concept: `chapter-plan`

**Kind:** `feature`

**Summary:** Executable chapter plan with batch grouping, tasks, verification criteria, and goal-backward requirements. Includes dependencies, file modifications, and autonomy flags for parallel execution.

**Fields:**
- `chapter_id` (string) - Chapter identifier (e.g., "03-features")
- `plan_id` (string) - Plan number within chapter (e.g., "01", "02")
- `type` (string) - "execute" or "tdd"
- `batch` (number) - Execution batch number for parallel grouping
- `depends_on` (array) - Plan IDs this plan requires
- `files_modified` (array) - Files this plan touches
- `autonomous` (boolean) - True if no checkpoints
- `objective` (string) - What this plan accomplishes
- `tasks` (array) - Execution tasks with type, name, files, action, verify, done
- `requirements` (object) - Goal-backward verification criteria
  - `truths` (array) - Observable behaviors
  - `artifacts` (array) - Files with implementation details
  - `key_links` (array) - Critical connections between artifacts
- `created_date` (string) - ISO timestamp

**Relationships:**
- `depends_on` → `chapter-context:chapter_id` - Decisions from context inform plan
- `depends_on` → `chapter-research:chapter_id` - Research findings inform plan
- `depends_on` → `chapter-plan:depends_on` - Prior plans this depends on
- `connects_to` → `chapter-summary:plan_id` - Creates summary on completion

</megamemory_schema>

<megamemory_operations>

## Create Chapter Plan

```typescript
// When creating an executable plan for a chapter
await megamemory.create_concept({
  name: `chapter-plan:${chapterId}-${planId}`,
  kind: "feature",
  summary: `Plan ${planId} for chapter ${chapterId}: ${objective}. Batch ${batch}, depends on ${depends_on.join(", ")}. Tasks: ${tasks.length}. Autonomous: ${autonomous}. Must-haves: ${requirements.truths.length} truths, ${requirements.artifacts.length} artifacts.`,
  why: "Executes specific portion of chapter, can run in parallel with other same-batch plans",
  parent_id: `initiative:${initiativeId}`,
  edges: [
    {
      to: `chapter-context:${chapterId}`,
      relation: "depends_on",
      description: "Uses implementation decisions from context"
    },
    {
      to: `chapter-research:${chapterId}`,
      relation: "depends_on",
      description: "Uses research findings for stack decisions"
    },
    ...depends_on.map(depPlanId => ({
      to: `chapter-plan:${depPlanId}`,
      relation: "depends_on",
      description: `Requires output from plan ${depPlanId}`
    })),
    {
      to: `chapter-summary:${chapterId}-${planId}`,
      relation: "connects_to",
      description: "Creates summary on completion"
    }
  ]
})
```

## Query Plans by Batch

```typescript
// Get all plans for a specific batch (parallel execution)
const batchPlans = await megamemory.understand({
  query: `chapter plans batch ${batchNumber} for ${chapterId}`,
  top_k: 10
})

// Filter concepts to find batch N plans
const plansToExecute = batchPlans.concepts
  .filter(c => c.summary.includes(`Batch ${batchNumber}`))
  .map(c => ({
    id: c.name,
    autonomous: c.summary.includes("Autonomous: true"),
    files: c.summary.match(/files_modified:?\s*\[([^\]]+)\]/)?.[1]
  }))
```

## Update Plan with Summary Link

```typescript
// After execution, link plan to its summary
await megamemory.link({
  from: `chapter-plan:${chapterId}-${planId}`,
  to: `chapter-summary:${chapterId}-${planId}`,
  relation: "connects_to",
  description: "Summary of plan execution results"
})
```

</megamemory_operations>

<megamemory_examples>

## Example 1: Creating Parallel Plan (Batch 1)

```typescript
// Plan 01 - User feature (can run in parallel with Product, Order)
await megamemory.create_concept({
  name: "chapter-plan:03-features-01",
  kind: "feature",
  summary: "Plan 01 for chapter 03-features: Implement complete User feature as vertical slice. Batch 1, depends on []. Tasks: 2. Autonomous: true. Must-haves: 3 truths, 3 artifacts.",
  why: "Self-contained user management that can run parallel to other features",
  parent_id: "project:myapp",
  edges: [
    {
      to: "chapter-context:03-features",
      relation: "depends_on",
      description: "Uses context decisions for user feature"
    }
  ]
})
```

## Example 2: Querying Batch Plans for Parallel Execution

```typescript
// Execute-chapter agent asks: what can I run in parallel now?
const currentBatch = 1
const result = await megamemory.understand({
  query: `chapter plans batch ${currentBatch} that are autonomous`,
  top_k: 10
})

// Returns all Batch 1 autonomous plans that can execute simultaneously
// Plans: 03-01 (User), 03-02 (Product), 03-03 (Order)
// Execute-agent spawns 3 parallel subagents
```

## Example 3: Sequential Plan (Batch 2, depends on Batch 1)

```typescript
// Plan 04 - Dashboard (depends on User, Product being complete)
await megamemory.create_concept({
  name: "chapter-plan:03-features-04",
  kind: "feature",
  summary: "Plan 04 for chapter 03-features: Build dashboard integrating User and Product. Batch 2, depends on [03-01, 03-02, 03-03]. Tasks: 3. Autonomous: false. Must-haves: 2 truths, 2 artifacts.",
  why: "Requires User and Product features to be complete first",
  parent_id: "project:myapp",
  edges: [
    {
      to: "chapter-plan:03-01",
      relation: "depends_on",
      description: "Requires User feature outputs"
    },
    {
      to: "chapter-plan:03-02",
      relation: "depends_on",
      description: "Requires Product feature outputs"
    },
    {
      to: "chapter-plan:03-03",
      relation: "depends_on",
      description: "Requires Order feature outputs"
    }
  ]
})
```

## Example 4: Verification Query with Must-Haves

```typescript
// Verification agent asks: what must be TRUE for chapter completion?
const result = await megamemory.understand({
  query: `chapter ${chapterId} must-have verification criteria truths artifacts`,
  top_k: 5
})

// Aggregates requirements from all plans:
// truths: ["User can see existing messages", "User can send a message", ...]
// artifacts: [{path: "src/components/Chat.tsx", contains: ...}, ...]
// key_links: [{from: "Chat.tsx", to: "/api/chat", pattern: ...}, ...]
// Verification agent checks each criterion against actual codebase
```

</megamemory_examples>

---

## MegaMemory Query Patterns

When executing a plan, query MegaMemory for context instead of reading .planning/ files.

**Basic context queries:**

```javascript
// Project context
const projectResult = await megamemory.understand({query: "project"})
const projectData = JSON.parse(projectResult.concepts[0].summary)

// Roadmap context
const roadmapResult = await megamemory.understand({query: "roadmap"})
const roadmapData = JSON.parse(roadmapResult.concepts[0].summary)

// Current state
const stateResult = await megamemory.understand({query: "state"})
const stateData = JSON.parse(stateResult.concepts[0].summary)
```

**Chapter-specific queries:**

```javascript
// Chapter context (implementation decisions)
const contextResult = await megamemory.understand({query: `chapter ${chapterId} context`})
const contextData = JSON.parse(contextResult.concepts[0].summary)

// Chapter research (findings from investigation)
const researchResult = await megamemory.understand({query: `chapter ${chapterId} research`})
const researchData = JSON.parse(researchResult.concepts[0].summary)

// Prior plan summary (if genuinely needed)
const summaryResult = await megamemory.understand({query: `chapter ${chapterId} plan ${planId} summary`})
const summaryData = JSON.parse(summaryResult.concepts[0].summary)
```

**Error handling for missing concepts:**

```javascript
// Check if concept exists before parsing
const result = await megamemory.understand({query: "chapter 01 context"})

if (result.concepts.length === 0) {
  // Concept doesn't exist - use defaults or skip
  console.log("No context found for chapter 01, proceeding without it")
} else {
  // Parse and use the concept data
  const contextData = JSON.parse(result.concepts[0].summary)
}
```

**Always access via `.concepts[0]` (NOT `.matches[0]`)**

**Always JSON.parse() the `.summary` field before accessing data**

---

## File Template

```markdown
---
chapter: XX-name
plan: NN
type: execute
batch: N                     # Execution batch (1, 2, 3...). Pre-computed at plan time.
depends_on: []              # Plan IDs this plan requires (e.g., ["01-01"]).
files_modified: []          # Files this plan modifies.
autonomous: true            # false if plan has checkpoints requiring user interaction
user_setup: []              # Human-required setup OpenCode cannot automate (see below)

# Goal-backward verification (derived during planning, verified after execution)
requirements:
  truths: []                # Observable behaviors that must be true for goal achievement
  artifacts: []             # Files that must exist with real implementation
  key_links: []             # Critical connections between artifacts
---

<objective>
[What this plan accomplishes]

Purpose: [Why this matters for the project]
Output: [What artifacts will be created]
</objective>

<execution_context>
@../workflows/execute-plan.md
@./summary.md
[If plan contains checkpoint tasks (type="checkpoint:*"), add:]
@../references/checkpoints.md
</execution_context>

# Query MegaMemory for initiative context
```
megamemory:understand({query: "project"})
megamemory:understand({query: "roadmap"})
megamemory:understand({query: "state"})
```
# Parse via .concepts[0] and JSON.parse(.summary) to extract context

# Only reference prior plan SUMMARYs if genuinely needed:
# - This plan uses types/exports from prior plan
# - Prior plan made decision that affects this plan
# Do NOT reflexively chain: Plan 02 refs 01, Plan 03 refs 02...

[If prior summary is genuinely needed, query MegaMemory:]
```
megamemory:understand({query: "chapter {chapter} plan {plan} summary"})
```

[Relevant source files:]
@src/path/to/relevant.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: [Action-oriented name]</name>
  <files>path/to/file.ext, another/file.ext</files>
  <action>[Specific implementation - what to do, how to do it, what to avoid and WHY]</action>
  <verify>[Command or check to prove it worked]</verify>
  <done>[Measurable acceptance criteria]</done>
</task>

<task type="auto">
  <name>Task 2: [Action-oriented name]</name>
  <files>path/to/file.ext</files>
  <action>[Specific implementation]</action>
  <verify>[Command or check]</verify>
  <done>[Acceptance criteria]</done>
</task>

<!-- For checkpoint task examples and patterns, see @../references/checkpoints.md -->
<!-- Key rule: OpenCode starts dev server BEFORE human-verify checkpoints. User only visits URLs. -->

<task type="checkpoint:decision" gate="blocking">
  <decision>[What needs deciding]</decision>
  <context>[Why this decision matters]</context>
  <options>
    <option id="option-a"><name>[Name]</name><pros>[Benefits]</pros><cons>[Tradeoffs]</cons></option>
    <option id="option-b"><name>[Name]</name><pros>[Benefits]</pros><cons>[Tradeoffs]</cons></option>
  </options>
  <resume-signal>Select: option-a or option-b</resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>[What OpenCode built] - server running at [URL]</what-built>
  <how-to-verify>Visit [URL] and verify: [visual checks only, NO CLI commands]</how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] [Specific test command]
- [ ] [Build/type check passes]
- [ ] [Behavior verification]
</verification>

<success_criteria>

- All tasks completed
- All verification checks pass
- No errors or warnings introduced
- [Plan-specific criteria]
  </success_criteria>

<output>
After completion, create or update the MegaMemory chapter-summary concept for this plan.
</output>
```

---

## Frontmatter Fields

| Field | Required | Purpose |
|-------|----------|---------|
| `chapter` | Yes | Chapter identifier (e.g., `01-foundation`) |
| `plan` | Yes | Plan number within chapter (e.g., `01`, `02`) |
| `type` | Yes | Always `execute` for standard plans, `tdd` for TDD plans |
| `batch` | Yes | Execution batch number (1, 2, 3...). Pre-computed at plan time. |
| `depends_on` | Yes | Array of plan IDs this plan requires. |
| `files_modified` | Yes | Files this plan touches. |
| `autonomous` | Yes | `true` if no checkpoints, `false` if has checkpoints |
| `user_setup` | No | Array of human-required setup items (external services) |
| `requirements` | Yes | Goal-backward verification criteria (see below) |

**Batch is pre-computed:** Batch numbers are assigned during `/fuska-plan`. Execute-chapter reads `batch` directly from frontmatter and groups plans by batch number. No runtime dependency analysis needed.

**Must-haves enable verification:** The `requirements` field carries goal-backward requirements from planning to execution. After all plans complete, execute-chapter spawns a verification subagent that checks these criteria against the actual codebase.

---

## Parallel vs Sequential

<parallel_examples>

**Batch 1 candidates (parallel):**

```yaml
# Plan 01 - User feature
batch: 1
depends_on: []
files_modified: [src/models/user.ts, src/api/users.ts]
autonomous: true

# Plan 02 - Product feature (no overlap with Plan 01)
batch: 1
depends_on: []
files_modified: [src/models/product.ts, src/api/products.ts]
autonomous: true

# Plan 03 - Order feature (no overlap)
batch: 1
depends_on: []
files_modified: [src/models/order.ts, src/api/orders.ts]
autonomous: true
```

All three run in parallel (Batch 1) - no dependencies, no file conflicts.

**Sequential (genuine dependency):**

```yaml
# Plan 01 - Auth foundation
batch: 1
depends_on: []
files_modified: [src/lib/auth.ts, src/middleware/auth.ts]
autonomous: true

# Plan 02 - Protected features (needs auth)
batch: 2
depends_on: ["01"]
files_modified: [src/features/dashboard.ts]
autonomous: true
```

Plan 02 in Batch 2 waits for Plan 01 in Batch 1 - genuine dependency on auth types/middleware.

**Checkpoint plan:**

```yaml
# Plan 03 - UI with verification
batch: 3
depends_on: ["01", "02"]
files_modified: [src/components/Dashboard.tsx]
autonomous: false  # Has checkpoint:human-verify
```

Batch 3 runs after Batchs 1 and 2. Pauses at checkpoint, coordinator presents to user, resumes on approval.

</parallel_examples>

---

## Context Section

**Parallel-aware context:**

```markdown
# Query MegaMemory for initiative context
```
megamemory:understand({query: "project"})
megamemory:understand({query: "roadmap"})
megamemory:understand({query: "state"})
```
# Parse via .concepts[0] and JSON.parse(.summary) to extract context
</context>

**Bad pattern (creates false dependencies):**
```markdown
<context>
# Reflexive chaining - just because earlier plans exist
megamemory:understand({query: "chapter 03-features plan 01 summary"})  # Just because it's earlier
megamemory:understand({query: "chapter 03-features plan 02 summary"})  # Reflexive chaining
</context>
```

---

## Scope Guidance

**Plan sizing:**

- 2-3 tasks per plan
- ~50% context usage maximum
- Complex chapters: Multiple focused plans, not one large plan

**When to split:**

- Different subsystems (auth vs API vs UI)
- >3 tasks
- Risk of context overflow
- TDD candidates - separate plans

**Vertical slices preferred:**

```
PREFER: Plan 01 = User (model + API + UI)
        Plan 02 = Product (model + API + UI)

AVOID:  Plan 01 = All models
        Plan 02 = All APIs
        Plan 03 = All UIs
```

---

## TDD Plans

TDD features get dedicated plans with `type: tdd`.

**Heuristic:** Can you write `expect(fn(input)).toBe(output)` before writing `fn`?
→ Yes: Create a TDD plan
→ No: Standard task in standard plan

See `~/.config/opencode/get-shit-done/references/tdd.md` for TDD plan structure.

---

## Task Types

| Type | Use For | Autonomy |
|------|---------|----------|
| `auto` | Everything OpenCode can do independently | Fully autonomous |
| `checkpoint:human-verify` | Visual/functional verification | Pauses, returns to coordinator |
| `checkpoint:decision` | Implementation choices | Pauses, returns to coordinator |
| `checkpoint:human-action` | Truly unavoidable manual steps (rare) | Pauses, returns to coordinator |

**Checkpoint behavior in parallel execution:**
- Plan runs until checkpoint
- Agent returns with checkpoint details + agent_id
- Orchestrator presents to user
- User responds
- Orchestrator resumes agent with `resume: agent_id`

---

## Examples

**Autonomous parallel plan:**

```markdown
---
chapter: 03-features
plan: 01
type: execute
batch: 1
depends_on: []
files_modified: [src/features/user/model.ts, src/features/user/api.ts, src/features/user/UserList.tsx]
autonomous: true
---

<objective>
Implement complete User feature as vertical slice.

Purpose: Self-contained user management that can run parallel to other features.
Output: User model, API endpoints, and UI components.
</objective>

<context>
# Query MegaMemory for project context
```
megamemory:understand({query: "project"})
megamemory:understand({query: "roadmap"})
megamemory:understand({query: "state"})
```
# Parse via .concepts[0] and JSON.parse(.summary) to extract context
</context>

<tasks>
<task type="auto">
  <name>Task 1: Create User model</name>
  <files>src/features/user/model.ts</files>
  <action>Define User type with id, email, name, createdAt. Export TypeScript interface.</action>
  <verify>tsc --noEmit passes</verify>
  <done>User type exported and usable</done>
</task>

<task type="auto">
  <name>Task 2: Create User API endpoints</name>
  <files>src/features/user/api.ts</files>
  <action>GET /users (list), GET /users/:id (single), POST /users (create). Use User type from model.</action>
  <verify>curl tests pass for all endpoints</verify>
  <done>All CRUD operations work</done>
</task>
</tasks>

<verification>
- [ ] npm run build succeeds
- [ ] API endpoints respond correctly
</verification>

<success_criteria>
- All tasks completed
- User feature works end-to-end
</success_criteria>

<output>
After completion, create or update the MegaMemory chapter-summary concept (e.g., chapter-03-summary-01).
</output>
```

**Plan with checkpoint (non-autonomous):**

```markdown
---
chapter: 03-features
plan: 03
type: execute
batch: 2
depends_on: ["03-01", "03-02"]
files_modified: [src/components/Dashboard.tsx]
autonomous: false
---

<objective>
Build dashboard with visual verification.

Purpose: Integrate user and product features into unified view.
Output: Working dashboard component.
</objective>

<execution_context>
@../workflows/execute-plan.md
@./summary.md
@../references/checkpoints.md
</execution_context>

<context>
# Query MegaMemory for project context
```
megamemory:understand({query: "project"})
megamemory:understand({query: "roadmap"})
megamemory:understand({query: "state"})
```

# Query prior plan summaries if genuinely needed
```
megamemory:understand({query: "chapter 03-features plan 01 summary"})
megamemory:understand({query: "chapter 03-features plan 02 summary"})
```
# Parse via .concepts[0] and JSON.parse(.summary) to extract context
</context>

<tasks>
<task type="auto">
  <name>Task 1: Build Dashboard layout</name>
  <files>src/components/Dashboard.tsx</files>
  <action>Create responsive grid with UserList and ProductList components. Use Tailwind for styling.</action>
  <verify>npm run build succeeds</verify>
  <done>Dashboard renders without errors</done>
</task>

<!-- Checkpoint pattern: OpenCode starts server, user visits URL. See checkpoints.md for full patterns. -->
<task type="auto">
  <name>Start dev server</name>
  <action>Run `npm run dev` in background, wait for ready</action>
  <verify>curl localhost:3000 returns 200</verify>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Dashboard - server at http://localhost:3000</what-built>
  <how-to-verify>Visit localhost:3000/dashboard. Check: desktop grid, mobile stack, no scroll issues.</how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>
</tasks>

<verification>
- [ ] npm run build succeeds
- [ ] Visual verification passed
</verification>

<success_criteria>
- All tasks completed
- User approved visual layout
</success_criteria>

<output>
After completion, create or update the MegaMemory chapter-summary concept (e.g., chapter-03-summary-03).
</output>
```

---

## Anti-Patterns

**Bad: Reflexive dependency chaining**
```yaml
depends_on: ["03-01"]  # Just because 01 comes before 02
```

**Bad: Horizontal layer grouping**
```
Plan 01: All models
Plan 02: All APIs (depends on 01)
Plan 03: All UIs (depends on 02)
```

**Bad: Missing autonomy flag**
```yaml
# Has checkpoint but no autonomous: false
depends_on: []
files_modified: [...]
# autonomous: ???  <- Missing!
```

**Bad: Vague tasks**
```xml
<task type="auto">
  <name>Set up authentication</name>
  <action>Add auth to the app</action>
</task>
```

---

## Guidelines

- Always use XML structure for OpenCode parsing
- Include `batch`, `depends_on`, `files_modified`, `autonomous` in every plan
- Prefer vertical slices over horizontal layers
- Only reference prior SUMMARYs when genuinely needed
- Group checkpoints with related auto tasks in same plan
- 2-3 tasks per plan, ~50% context max

---

## User Setup (External Services)

When a plan introduces external services requiring human configuration, declare in frontmatter:

```yaml
user_setup:
  - service: stripe
    why: "Payment processing requires API keys"
    env_vars:
      - name: STRIPE_SECRET_KEY
        source: "Stripe Dashboard → Developers → API keys → Secret key"
      - name: STRIPE_WEBHOOK_SECRET
        source: "Stripe Dashboard → Developers → Webhooks → Signing secret"
    dashboard_config:
      - task: "Create webhook endpoint"
        location: "Stripe Dashboard → Developers → Webhooks → Add endpoint"
        details: "URL: https://[your-domain]/api/webhooks/stripe"
    local_dev:
      - "stripe listen --forward-to localhost:3000/api/webhooks/stripe"
```

**The automation-first rule:** `user_setup` contains ONLY what OpenCode literally cannot do:
- Account creation (requires human signup)
- Secret retrieval (requires dashboard access)
- Dashboard configuration (requires human in browser)

**NOT included:** Package installs, code changes, file creation, CLI commands OpenCode can run.

**Result:** Execute-plan generates `{chapter}-USER-SETUP.md` with checklist for the user.

See `~/.config/opencode/get-shit-done/templates/user-setup.md` for full schema and examples

---

## Must-Haves (Goal-Backward Verification)

The `requirements` field defines what must be TRUE for the chapter goal to be achieved. Derived during planning, verified after execution.

**Structure:**

```yaml
requirements:
  truths:
    - "User can see existing messages"
    - "User can send a message"
    - "Messages persist across refresh"
  artifacts:
    - path: "src/components/Chat.tsx"
      provides: "Message list rendering"
      min_lines: 30
    - path: "src/app/api/chat/route.ts"
      provides: "Message CRUD operations"
      exports: ["GET", "POST"]
    - path: "prisma/schema.prisma"
      provides: "Message model"
      contains: "model Message"
  key_links:
    - from: "src/components/Chat.tsx"
      to: "/api/chat"
      via: "fetch in useEffect"
      pattern: "fetch.*api/chat"
    - from: "src/app/api/chat/route.ts"
      to: "prisma.message"
      via: "database query"
      pattern: "prisma\\.message\\.(find|create)"
```

**Field descriptions:**

| Field | Purpose |
|-------|---------|
| `truths` | Observable behaviors from user perspective. Each must be testable. |
| `artifacts` | Files that must exist with real implementation. |
| `artifacts[].path` | File path relative to project root. |
| `artifacts[].provides` | What this artifact delivers. |
| `artifacts[].min_lines` | Optional. Minimum lines to be considered substantive. |
| `artifacts[].exports` | Optional. Expected exports to verify. |
| `artifacts[].contains` | Optional. Pattern that must exist in file. |
| `key_links` | Critical connections between artifacts. |
| `key_links[].from` | Source artifact. |
| `key_links[].to` | Target artifact or endpoint. |
| `key_links[].via` | How they connect (description). |
| `key_links[].pattern` | Optional. Regex to verify connection exists. |

**Why this matters:**

Task completion ≠ Goal achievement. A task "create chat component" can complete by creating a placeholder. The `requirements` field captures what must actually work, enabling verification to catch gaps before they compound.

**Verification flow:**

1. Plan-chapter derives requirements from chapter goal (goal-backward)
2. Must_haves written to PLAN.md frontmatter
3. Execute-chapter runs all plans
4. Verification subagent checks requirements against codebase
5. Gaps found → fix plans created → execute → re-verify
6. All requirements pass → chapter complete

See `~/.config/opencode/get-shit-done/workflows/verify-chapter.md` for verification logic.
