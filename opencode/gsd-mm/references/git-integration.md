# Git Integration (MegaMemory-Backed)

Git integration for GSD framework. Store commit history context in MegaMemory, not in SUMMARY concepts.

<overview>
Git integration for GSD framework.
</overview>

<core_principle>

**Commit outcomes, not process.**

The git log should read like a changelog of what shipped, not a diary of planning activity.
</core_principle>

<megamemory_persistence>

**MegaMemory is persistent outside git.**

MegaMemory concepts for all planning data (project, roadmap, state, plan, summary, etc.) are stored in MegaMemory and persist outside of git version control. This means:

- **No planning file git operations:** Never run `git add` on planning artifacts or commit planning data
- **MM data survives git resets:** MegaMemory concepts are unaffected by `git reset`, `git revert`, etc.
- **Source code only:** Git commits should only include actual code changes (src/, tests/, config files)
- **MM tracks context:** MegaMemory maintains full development context across sessions

**When committing code:**
```bash
# Commit source code changes only
git add src/ tests/ config/
git commit -m "feat(XX-XX): implement feature"

# MegaMemory data is automatically persisted - no git operations needed
```

**Reference examples in this file:**
- MegaMemory operations show how to store planning context
- Git examples show code-only commits
- file_refs in MegaMemory concepts reference source code files for tracking purposes

</megamemory_persistence>

<megamemory_schema>

## MegaMemory Concept Schema for Git Integration

Commit history and development context are stored as `decision` and `feature` concepts:

### Concept: `commit-history`
```typescript
interface CommitHistoryConcept {
  name: string;                    // "commit-history:phase-plan" or "commit-history:task"
  kind: "decision";
  summary: string;                  // Commit hash, message, files changed, timestamp
  why: string;                     // Why this commit matters (e.g., "completes task X")
  
  file_refs: string[];              // Paths changed in this commit
  
  edges: {
    to: string;                    // Related concepts
    relation: "depends_on" | "implements" | "completes" | "configures";
    description: string;
  }[];
  
  created_by_task: string;          // Task that created this commit
  
  // Commit-specific metadata (stored in summary)
  commit_hash: string;
  commit_type: "initialization" | "task-completion" | "plan-completion" | "handoff";
  phase_plan: string;               // e.g., "04-01"
}
```

### Concept: `task-completion`
```typescript
interface TaskCompletionConcept {
  name: string;                    // "task:phase-plan:task-name"
  kind: "feature";
  summary: string;                  // What was implemented (files, changes, outcome)
  why: string;                     // Why this task exists (supports plan goal)
  
  file_refs: string[];              // All files touched by this task
  
  edges: {
    to: string;                    // Related concepts
    relation: "depends_on" | "implements" | "completes" | "configured_by";
    description: string;
  }[];
  
  created_by_task: string;          // Task ID
}
```

### Related Concepts

**Concepts to create during development:**
- `commit-history:{phase}-{plan}` - Captures all commits for a plan
- `task:{phase}-{plan}:{task-name}` - Individual task completion
- `plan-state:{phase}-{plan}` - Plan progress tracking

**Relationships:**
- `commit-history` → `completes` → `task` (commit completes a task)
- `task` → `implements` → `plan` (task implements plan goal)
- `task` → `depends_on` → `artifact` (task produces artifact)
- `plan-state` → `depends_on` → `task` (plan depends on tasks)

</megamemory_schema>

<megamemory_operations>

## MegaMemory Operations for Git Integration

### 1. Initialize Project in MegaMemory

When starting a new project, record initialization:

```typescript
const initCommitId = await megamemory.create_concept({
  name: "commit-history:initialization",
  kind: "decision",
  summary: "Commit a1b2c3d: 'docs: initialize ecommerce-app (5 phases)'. Established project scaffolding with 5 phases: Foundation, Auth, Products, Checkout, Deployment. Project context stored in MegaMemory.",
  why: "Project initialization commit marks start of development",
  file_refs: [
    "package.json"
  ],
  edges: [
    {
      to: "project:ecommerce-app",
      relation: "implements",
      description: "Initializes project structure"
    }
  ],
  created_by_task: "git:init-project"
});
```

### 2. Record Task Completion with Commit

After completing a task and committing, record both:

```typescript
const commitHash = "e7f8g9h0";
const phasePlan = "04-01";
const taskName = "payment-session-creation";

// Create task completion concept
const taskId = await megamemory.create_concept({
  name: `task:${phasePlan}:${taskName}`,
  kind: "feature",
  summary: "Implements Stripe payment session creation in src/app/api/checkout/session/route.ts:1-50. Uses stripe.checkout.sessions.create with product line items, success/cancel URLs, and metadata. Returns session.url to client. Error handling with try/catch, returns 400 on Stripe errors.",
  why: "Enables users to initiate Stripe checkout flow",
  file_refs: [
    "src/app/api/checkout/session/route.ts:1-50",
    "src/lib/stripe.ts:10-25",
    "src/types/checkout.ts:1-15"
  ],
  edges: [
    {
      to: "plan:04-01",
      relation: "implements",
      description: "Implements payment session creation task"
    },
    {
      to: "feature:stripe-payments",
      relation: "depends_on",
      description: "Part of Stripe payments feature"
    }
  ],
  created_by_task: `task:${phasePlan}:${taskName}`
});

// Record commit history
await megamemory.create_concept({
  name: `commit-history:${phasePlan}:session-creation`,
  kind: "decision",
  summary: `Commit ${commitHash}: 'feat(04-01): implement payment session creation'. Files: src/app/api/checkout/session/route.ts (+50), src/lib/stripe.ts (+15), src/types/checkout.ts (+15). Adds Stripe checkout session creation endpoint with line items, metadata, error handling.`,
  why: "Commits payment session implementation",
  file_refs: [
    "src/app/api/checkout/session/route.ts:1-50",
    "src/lib/stripe.ts:10-25",
    "src/types/checkout.ts:1-15"
  ],
  edges: [
    {
      to: taskId,
      relation: "completes",
      description: "Commit completes this task"
    }
  ],
  created_by_task: `git:commit:${phasePlan}:${taskName}`
});
```

### 3. Record Plan Completion Metadata

After all tasks in a plan are done, record plan completion:

```typescript
const phasePlan = "04-01";

// Update plan state
await megamemory.create_concept({
  name: `plan-state:${phasePlan}:completed`,
  kind: "decision",
  summary: "Plan 04-01 (Checkout Flow) completed. Tasks completed: 3/3. Tasks: webhook-verification, payment-session-creation, checkout-page-component. All artifacts committed and verified.",
  why: "Marks plan as complete for roadmap tracking",
  file_refs: [
    "src/app/api/checkout/session/route.ts",
    "src/app/api/webhooks/stripe/route.ts",
    "src/app/checkout/page.tsx"
  ],
  edges: [
    {
      to: "plan:04-01",
      relation: "completes",
      description: "Plan completion metadata"
    },
    {
      to: "phase:04-checkout",
      relation: "depends_on",
      description: "Plan belongs to phase 04"
    }
  ],
  created_by_task: "plan:complete:04-01"
});

// Record metadata commit (plan state tracked in MegaMemory)
await megamemory.create_concept({
  name: `commit-history:${phasePlan}:metadata`,
  kind: "decision",
  summary: `Commit i1j2k3l: 'docs(04-01): complete checkout flow plan'. Tasks completed: 3/3. Code files already committed per-task. Plan state tracked in MegaMemory.`,
  why: "Commits plan completion metadata",
  file_refs: [
    "src/app/api/checkout/session/route.ts",
    "src/app/api/webhooks/stripe/route.ts",
    "src/app/checkout/page.tsx"
  ],
  edges: [
    {
      to: `plan-state:${phasePlan}:completed`,
      relation: "completes",
      description: "Commit completes plan metadata"
    }
  ],
  created_by_task: "git:commit:plan-metadata:04-01"
});
```

### 4. Record Handoff (WIP)

When pausing work, record handoff state:

```typescript
const phasePlan = "04-02";
const currentTask = "payment-webhook-handler";

await megamemory.create_concept({
  name: `handoff:${phasePlan}:paused`,
  kind: "decision",
  summary: `Handoff for plan ${phasePlan} at task 1/3. Current: ${currentTask}. Context: Started webhook handler, Stripe signature verification implemented, payment intent handling in progress. Next: Add order creation in database and fulfillment logic.`,
  why: "Preserves WIP state for next session",
  file_refs: [
    "src/app/api/webhooks/stripe/route.ts:1-30"
  ],
  edges: [
    {
      to: `task:${phasePlan}:${currentTask}`,
      relation: "depends_on",
      description: "Paused on this task"
    },
    {
      to: "plan:04-02",
      relation: "configured_by",
      description: "Plan is in WIP state"
    }
  ],
  created_by_task: "git:handoff:04-02"
});

await megamemory.create_concept({
  name: "commit-history:04-02:handoff",
  kind: "decision",
  summary: "Commit m4n5o6p: 'wip: checkout paused at task 1/3'. Current: payment-webhook-handler. Context: Webhook signature verification done, payment intent handling started. Files committed: src/app/api/webhooks/stripe/route.ts (partial). Plan state in MegaMemory.",
  why: "Commits handoff state for resumption",
  file_refs: [
    "src/app/api/webhooks/stripe/route.ts:1-30"
  ],
  edges: [
    {
      to: `handoff:${phasePlan}:paused`,
      relation: "completes",
      description: "Commit captures handoff state"
    }
  ],
  created_by_task: "git:handoff-commit:04-02"
});
```

### 5. Query Commit History for Plan

Retrieve all commits for a specific plan:

```typescript
const planCommits = await megamemory.understand({
  query: `commit-history 04-01 checkout flow commits`
});

// Returns:
// - commit-history:04-01:session-creation
// - commit-history:04-01:checkout-page
// - commit-history:04-01:metadata

// Each commit has edges to tasks it completes
const tasks = planCommits.flatMap(commit => 
  commit.edges.filter(e => e.relation === "completes").map(e => e.to)
);

console.log("Commits for plan 04-01:", planCommits);
console.log("Tasks completed:", tasks);
```

### 6. Query Task and Commit Context

Before resuming work, query task and commit context:

```typescript
const context = await megamemory.understand({
  query: "task 04-01 payment session creation commit implementation"
});

// Returns:
// - task:04-01:payment-session-creation (what was done)
// - commit-history:04-01:session-creation (git details)
// - All file refs (what changed)
// - Related artifacts (what was created)

console.log("Task implemented:", context.find(c => c.name.startsWith("task")));
console.log("Files changed:", context.flatMap(c => c.file_refs));
```

### 7. Query Failed or Incomplete Tasks

Find tasks that need work:

```typescript
const incomplete = await megamemory.understand({
  query: "handoff paused incomplete task blocked"
});

// Returns handoff concepts and paused tasks
const pausedTasks = incomplete.filter(c => c.name.startsWith("handoff"));
console.log("Paused work:", pausedTasks.map(h => h.summary));
```

### 8. Query Project Roadmap State

Get overall project state from commit history:

```typescript
const projectState = await megamemory.understand({
  query: "commit-history plan-state completed phase roadmap"
});

// Group by phase
const phases = {};
projectState.forEach(concept => {
  if (concept.name.includes("plan-state")) {
    const phase = concept.name.match(/plan-state:(\d{2}-\d{2})/)?.[1];
    if (phase) phases[phase] = concept.summary;
  }
});

console.log("Project state:", phases);
// Output: { "01-01": "completed", "02-01": "completed", "04-01": "completed", "04-02": "paused" }
```

### 9. Query File Change History

Find all commits that touched a specific file:

```typescript
const filePath = "src/app/api/checkout/session/route.ts";
const fileHistory = await megamemory.understand({
  query: `commit-history ${filePath} checkout session`
});

// Returns all commits that include this file
const versions = fileHistory.map(c => ({
  commit: c.name,
  summary: c.summary,
  hash: c.summary.match(/Commit ([a-f0-9]+)/)?.[1]
}));

console.log("File history:", versions);
```

</megamemory_operations>

<megamemory_examples>

## Complete Git Integration Workflow Example

### Example 1: Project Initialization

```typescript
// After running git init and initial commit
const commitHash = await bash("git rev-parse HEAD");

await megamemory.create_concept({
  name: "commit-history:initialization",
  kind: "decision",
  summary: `Commit ${commitHash}: 'docs: initialize ecommerce-app (5 phases)'. Created project scaffold with Next.js 15, Prisma, Tailwind. Phases: 01-Foundation, 02-Auth, 03-Products, 04-Checkout, 05-Deployment.`,
  why: "Project start",
  file_refs: [
    "package.json",
    "tsconfig.json",
    "next.config.mjs",
    "tailwind.config.ts"
  ],
  edges: [
    { to: "project:ecommerce-app", relation: "implements", description: "Initializes project" }
  ],
  created_by_task: "git:init"
});

// Create project concept
await megamemory.create_concept({
  name: "project:ecommerce-app",
  kind: "feature",
  summary: "E-commerce web application with product catalog, shopping cart, user authentication, and Stripe payments. Tech stack: Next.js 15, Prisma, PostgreSQL, Tailwind CSS, Stripe.",
  why: "Main project deliverable",
  edges: [
    { to: "commit-history:initialization", relation: "configured_by", description: "Initialized by this commit" }
  ]
});
```

### Example 2: Task Completion Chain (TDD Workflow)

```typescript
// RED Phase: Write failing test
const testCommit = await bash("git rev-parse HEAD");

await megamemory.create_concept({
  name: "task:02-02:jwt-failing-test",
  kind: "feature",
  summary: "Adds failing test for JWT token generation in src/__tests__/jwt.test.ts:1-30. Tests: token contains user ID claim, expires in 1 hour, signature verification works. Currently fails: jwt.ts not implemented.",
  why: "TDD RED phase - defines expected behavior",
  file_refs: ["src/__tests__/jwt.test.ts:1-30"],
  edges: [{ to: "plan:02-02", relation: "implements", description: "Test task" }],
  created_by_task: "tdd:red:jwt"
});

await megamemory.create_concept({
  name: "commit-history:02-02:test-red",
  kind: "decision",
  summary: `Commit ${testCommit}: 'test(02-02): add failing test for JWT generation'. Files: src/__tests__/jwt.test.ts (+30). Tests token claims, expiry, verification. Expected to fail.`,
  why: "TDD RED commit",
  file_refs: ["src/__tests__/jwt.test.ts:1-30"],
  edges: [{ to: "task:02-02:jwt-failing-test", relation: "completes", description: "Commits test" }],
  created_by_task: "git:commit:tdd:red"
});

// GREEN Phase: Implement to pass test
const implCommit = await bash("git rev-parse HEAD");

await megamemory.create_concept({
  name: "task:02-02:jwt-implementation",
  kind: "feature",
  summary: "Implements JWT generation in src/utils/jwt.ts:1-40. Uses jose library with HS256 algorithm. Claims: userId, iat (issued at), exp (expires in 1h). Functions: createToken(userId), verifyToken(token). Passes all tests.",
  why: "TDD GREEN phase - implements to pass test",
  file_refs: ["src/utils/jwt.ts:1-40", "src/__tests__/jwt.test.ts:1-30"],
  edges: [
    { to: "plan:02-02", relation: "implements", description: "Implementation task" },
    { to: "task:02-02:jwt-failing-test", relation: "depends_on", description: "Satisfies test requirements" }
  ],
  created_by_task: "tdd:green:jwt"
});

await megamemory.create_concept({
  name: "commit-history:02-02:impl-green",
  kind: "decision",
  summary: `Commit ${implCommit}: 'feat(02-02): implement JWT generation'. Files: src/utils/jwt.ts (+40). Uses jose library, HS256, userId/exp claims. Tests now pass.`,
  why: "TDD GREEN commit",
  file_refs: ["src/utils/jwt.ts:1-40"],
  edges: [{ to: "task:02-02:jwt-implementation", relation: "completes", description: "Commits implementation" }],
  created_by_task: "git:commit:tdd:green"
});

// Later: Query both commits for context
const jwtContext = await megamemory.understand({
  query: "commit-history 02-02 JWT generation test implementation"
});
```

### Example 3: Full Plan Completion Workflow

```typescript
// After completing all tasks in plan 04-01
const tasksCompleted = [
  "task:04-01:webhook-verification",
  "task:04-01:payment-session",
  "task:04-01:checkout-page"
];

// Create plan completion state
await megamemory.create_concept({
  name: "plan-state:04-01:completed",
  kind: "decision",
  summary: "Plan 04-01 (Checkout Flow) completed. Tasks: 3/3. All features implemented: webhook signature verification, payment session creation, checkout page component. Verified: components wired, API returns data, errors handled.",
  why: "Marks plan as complete",
  file_refs: [
    "src/app/api/checkout/session/route.ts",
    "src/app/api/webhooks/stripe/route.ts",
    "src/app/checkout/page.tsx"
  ],
  edges: [
    { to: "plan:04-01", relation: "completes", description: "Plan completion" },
    { to: "phase:04-checkout", relation: "depends_on", description: "Plan in phase 04" },
    ...tasksCompleted.map(task => ({ to: task, relation: "depends_on", description: "Depends on task" }))
  ],
  created_by_task: "plan:complete:04-01"
});

// Record metadata commit (only planning files)
const metaCommit = await bash("git rev-parse HEAD");

await megamemory.create_concept({
  name: "commit-history:04-01:metadata",
  kind: "decision",
  summary: `Commit ${metaCommit}: 'docs(04-01): complete checkout flow plan'. Tasks completed: 3/3. Code files already committed per-task. Plan state tracked in MegaMemory.`,
  why: "Commits plan completion metadata only",
  file_refs: [
    "src/app/api/checkout/session/route.ts",
    "src/app/api/webhooks/stripe/route.ts",
    "src/app/checkout/page.tsx"
  ],
  edges: [
    { to: "plan-state:04-01:completed", relation: "completes", description: "Commits completion state" }
  ],
  created_by_task: "git:commit:plan-metadata"
});

// Query all commits for this plan
const allCommits = await megamemory.understand({
  query: "commit-history 04-01 checkout"
});

console.log("Plan 04-01 commits:", allCommits);
// Returns: commit-history:04-01:webhook, commit-history:04-01:session, commit-history:04-01:page, commit-history:04-01:metadata
```

### Example 4: Handoff and Resumption

```typescript
// Before pausing, record handoff
const currentPhasePlan = "04-02";
const currentTask = "payment-webhook";
const progress = "Stripe signature verification done, payment intent parsing started, order creation not started";

await megamemory.create_concept({
  name: `handoff:${currentPhasePlan}:paused`,
  kind: "decision",
  summary: `Handoff for plan ${currentPhasePlan} at task 1/3. Current: ${currentTask}. Progress: ${progress}. Next: Parse payment_intent.succeeded, create order in Prisma, trigger fulfillment.`,
  why: "Preserves WIP for next session",
  file_refs: [
    "src/app/api/webhooks/stripe/route.ts:1-35"
  ],
  edges: [
    { to: `task:${currentPhasePlan}:${currentTask}`, relation: "depends_on", description: "Paused on task" },
    { to: "plan:04-02", relation: "configured_by", description: "Plan is WIP" }
  ],
  created_by_task: "git:handoff"
});

await megamemory.create_concept({
  name: `commit-history:${currentPhasePlan}:handoff`,
  kind: "decision",
  summary: `Commit ${await bash("git rev-parse HEAD")}: 'wip: checkout paused at task 1/3'. Current: ${currentTask}. Files: src/app/api/webhooks/stripe/route.ts (partial). Plan state in MegaMemory. Ready to resume.`,
  why: "Commits handoff state",
  file_refs: ["src/app/api/webhooks/stripe/route.ts"],
  edges: [
    { to: `handoff:${currentPhasePlan}:paused`, relation: "completes", description: "Commits handoff" }
  ],
  created_by_task: "git:commit:handoff"
});

// In next session, query handoff context
const handoffContext = await megamemory.understand({
  query: `handoff ${currentPhasePlan} paused task progress`
});

const handoff = handoffContext.find(c => c.name.startsWith("handoff"));
console.log("Resuming work:", handoff.summary);
// Output: "Handoff for plan 04-02 at task 1/3. Current: payment-webhook. Progress: Stripe signature verification done..."

// Query task to continue
const taskContext = await megamemory.understand({
  query: `task ${currentPhasePlan} ${currentTask} implementation`
});

console.log("Task context:", taskContext[0].summary);
console.log("Files involved:", taskContext[0].file_refs);
```

### Example 5: Bisect Debugging with MegaMemory

```typescript
// Bug found, need to find which task introduced it
const bugCommit = "e7f8g9h0"; // Commit where bug appears

// Query all commits in relevant plan
const commits = await megamemory.understand({
  query: "commit-history 04-01 checkout commits"
});

// Get commit hashes
const commitHashes = commits.map(c => c.summary.match(/Commit ([a-f0-9]+)/)?.[1]).filter(Boolean);

// Run git bisect programmatically
const badCommit = await bash(`git bisect start ${bugCommit} HEAD~10 && git bisect run npm test 2>&1 | grep "is the first bad commit"`);

// Find corresponding MegaMemory concept
const badConcept = commits.find(c => c.summary.includes(badCommit.trim()));

console.log("Bug introduced in:", badConcept.name);
console.log("Task details:", badConcept.summary);
// Output: "commit-history:04-01:payment-session" - Bug in session creation

// Query task for more context
const buggyTask = await megamemory.understand({
  query: badConcept.edges.find(e => e.relation === "completes")?.to || ""
});

console.log("Task implementation:", buggyTask[0].summary);
```

### Example 6: Querying Project Status

```typescript
// Get overall project state
const allPlans = await megamemory.understand({
  query: "plan-state completed paused phase"
});

const status = {
  completed: [],
  in_progress: [],
  not_started: []
};

allPlans.forEach(concept => {
  if (concept.summary.includes("completed")) {
    status.completed.push(concept.name);
  } else if (concept.summary.includes("paused") || concept.summary.includes("WIP")) {
    status.in_progress.push(concept.name);
  }
});

console.log("Project Status:", status);
// Output: {
//   completed: ["plan-state:01-01:completed", "plan-state:02-01:completed", "plan-state:04-01:completed"],
//   in_progress: ["plan-state:04-02:paused"]
// }

// Get commit count per plan
const allCommits = await megamemory.understand({
  query: "commit-history"
});

const commitCounts = {};
allCommits.forEach(commit => {
  const plan = commit.name.match(/commit-history:(\d{2}-\d{2})/)?.[1];
  if (plan) {
    commitCounts[plan] = (commitCounts[plan] || 0) + 1;
  }
});

console.log("Commits per plan:", commitCounts);
// Output: { "01-01": 3, "02-01": 4, "02-02": 2, "04-01": 4, "04-02": 1 }
```

</megamemory_examples>

<commit_points>

| Event                   | Commit? | Why                                              |
| ----------------------- | ------- | ------------------------------------------------ |
| BRIEF + ROADMAP created | YES     | Project initialization                           |
| PLAN concept created    | NO      | Intermediate - commit with plan completion       |
| RESEARCH concept created | NO      | Intermediate                                     |
| DISCOVERY concept created | NO      | Intermediate                                     |
| **Task completed**      | YES     | Atomic unit of work (1 commit per task)         |
| **Plan completed**      | YES     | Metadata commit (SUMMARY + STATE + ROADMAP)     |
| Handoff created         | YES     | WIP state preserved                              |

</commit_points>

<git_check>

```bash
[ -d .git ] && echo "GIT_EXISTS" || echo "NO_GIT"
```

If NO_GIT: Run `git init` silently. GSD projects always get their own repo.
</git_check>

<commit_formats>

<format name="initialization">
## Project Initialization (brief + roadmap together)

```
docs: initialize [project-name] ([N] phases)

[One-liner from PROJECT.md]

Phases:
1. [phase-name]: [goal]
2. [phase-name]: [goal]
3. [phase-name]: [goal]
```

What to commit:

```bash
# Note: MegaMemory concepts are not committed to git
# MM data persists outside git - no planning artifact git operations needed
git commit
```

</format>

<format name="task-completion">
## Task Completion (During Plan Execution)

Each task gets its own commit immediately after completion.

```
{type}({phase}-{plan}): {task-name}

- [Key change 1]
- [Key change 2]
- [Key change 3]
```

**Commit types:**
- `feat` - New feature/functionality
- `fix` - Bug fix
- `test` - Test-only (TDD RED phase)
- `refactor` - Code cleanup (TDD REFACTOR phase)
- `perf` - Performance improvement
- `chore` - Dependencies, config, tooling

**Examples:**

```bash
# Standard task
git add src/api/auth.ts src/types/user.ts
git commit -m "feat(08-02): create user registration endpoint

- POST /auth/register validates email and password
- Checks for duplicate users
- Returns JWT token on success
"

# TDD task - RED phase
git add src/__tests__/jwt.test.ts
git commit -m "test(07-02): add failing test for JWT generation

- Tests token contains user ID claim
- Tests token expires in 1 hour
- Tests signature verification
"

# TDD task - GREEN phase
git add src/utils/jwt.ts
git commit -m "feat(07-02): implement JWT generation

- Uses jose library for signing
- Includes user ID and expiry claims
- Signs with HS256 algorithm
"
```

</format>

<format name="plan-completion">
## Plan Completion (After All Tasks Done)

After all tasks committed, one final metadata commit captures plan completion.

```
docs({phase}-{plan}): complete [plan-name] plan

Tasks completed: [N]/[N]
- [Task 1 name]
- [Task 2 name]
- [Task 3 name]
```

What to commit:

```bash
# Note: MegaMemory concepts are not committed to git
# MM data persists outside git - only commit source code changes
git commit
```

**Note:** Code files NOT included - already committed per-task.

</format>

<format name="handoff">
## Handoff (WIP)

```
wip: [phase-name] paused at task [X]/[Y]

Current: [task name]
[If blocked:] Blocked: [reason]
```

What to commit:

```bash
# Note: MegaMemory concepts are not committed to git
# MM data persists outside git - only commit source code changes
git commit
```

</format>
</commit_formats>

<git_megamemory_separation>

**Git vs MegaMemory: What Goes Where**

| Type | Git | MegaMemory |
|------|-----|------------|
| Source code | ✅ Commit | ✅ Track in file_refs |
| Tests | ✅ Commit | ✅ Track in file_refs |
| Config files | ✅ Commit | ✅ Track in file_refs |
| Planning artifacts | ❌ Never commit | ✅ Stored as concepts |
| Commit history | ✅ Git log | ✅ Stored as concepts |
| Task progress | ❌ Never commit | ✅ Stored as concepts |
| Handoff state | ❌ Never commit | ✅ Stored as concepts |

**Key principle:** MegaMemory persists all planning and context data. Git only tracks shipping code.

</git_megamemory_separation>

<example_log>

**Old approach (per-plan commits):**
```
a7f2d1 feat(checkout): Stripe payments with webhook verification
3e9c4b feat(products): catalog with search, filters, and pagination
8a1b2c feat(auth): JWT with refresh rotation using jose
5c3d7e feat(foundation): Next.js 15 + Prisma + Tailwind scaffold
2f4a8d docs: initialize ecommerce-app (5 phases)
```

**New approach (per-task commits):**
```
# Phase 04 - Checkout
1a2b3c docs(04-01): complete checkout flow plan
4d5e6f feat(04-01): add webhook signature verification
7g8h9i feat(04-01): implement payment session creation
0j1k2l feat(04-01): create checkout page component

# Phase 03 - Products
3m4n5o docs(03-02): complete product listing plan
6p7q8r feat(03-02): add pagination controls
9s0t1u feat(03-02): implement search and filters
2v3w4x feat(03-01): create product catalog schema

# Phase 02 - Auth
5y6z7a docs(02-02): complete token refresh plan
8b9c0d feat(02-02): implement refresh token rotation
1e2f3g test(02-02): add failing test for token refresh
4h5i6j docs(02-01): complete JWT setup plan
7k8l9m feat(02-01): add JWT generation and validation
0n1o2p chore(02-01): install jose library

# Phase 01 - Foundation
3q4r5s docs(01-01): complete scaffold plan
6t7u8v feat(01-01): configure Tailwind and globals
9w0x1y feat(01-01): set up Prisma with database
2z3a4b feat(01-01): create Next.js 15 project

# Initialization
5c6d7e docs: initialize ecommerce-app (5 phases)
```

Each plan produces 2-4 commits (tasks + metadata). Clear, granular, bisectable.

</example_log>

<anti_patterns>

**Still don't commit (intermediate artifacts):**
- Planning artifacts (MegaMemory persists them)
- PLAN concept creation (MegaMemory stores it)
- RESEARCH concept (intermediate, stored in MegaMemory)
- DISCOVERY concept (intermediate, stored in MegaMemory)
- Minor planning tweaks (MegaMemory tracking)
- "Fixed typo in roadmap" (MegaMemory handles this)

**Do commit (outcomes):**
- Each task completion (feat/fix/test/refactor) - source code and tests
- Project initialization (docs) - initial setup
- Code changes only - never planning artifacts or MegaMemory data

**Key principle:** Commit working code and shipped outcomes. MegaMemory handles all planning and context persistence.

</anti_patterns>

<commit_strategy_rationale>

## Why Per-Task Commits?

**Context engineering for AI:**
- Git history becomes primary context source for future OpenCode sessions
- `git log --grep="{phase}-{plan}"` shows all work for a plan
- `git diff <hash>^..<hash>` shows exact changes per task
- Less reliance on parsing SUMMARY concepts = more context for actual work

**Failure recovery:**
- Task 1 committed ✅, Task 2 failed ❌
- OpenCode in next session: sees task 1 complete, can retry task 2
- Can `git reset --hard` to last successful task

**Debugging:**
- `git bisect` finds exact failing task, not just failing plan
- `git blame` traces line to specific task context
- Each commit is independently revertable

**Observability:**
- Solo developer + OpenCode workflow benefits from granular attribution
- Atomic commits are git best practice
- "Commit noise" irrelevant when consumer is OpenCode, not humans

</commit_strategy_rationale>
