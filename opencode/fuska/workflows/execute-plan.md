<purpose>
Execute a phase prompt (PLAN.md) and create the outcome summary (SUMMARY.md), storing all state in MegaMemory instead of .planning/ files.
</purpose>

<required_reading>
Query MegaMemory for state before any operation to load project context.

@~/.config/opencode/fuska/references/git-integration.md
</required_reading>

<megamemory_guide>
@./references/megamemory-integration.md
</megamemory_guide>

<process>

<step name="resolve_model_profile">
Query MegaMemory for planning config and resolve model profile:

```
megamemory:understand({query: "planning config"})
```

**Parse response:**
- If config concept exists: Parse `summary` JSON and extract `model_profile` and `model_aliases`
- If config concept missing: Use default `"balanced"` with default aliases

**Model aliases (with defaults):**
```
const aliases = configData.model_aliases || {
  quality_model: "opencode/claude-opus-4",
  balanced_model: "opencode/claude-sonnet-4",
  budget_model: "opencode/claude-haiku-4"
}
```

**Model lookup table (uses aliases):**

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| fuska-executor | quality_model | balanced_model | balanced_model |

```
const modelLookup = {
  quality: { executor: aliases.quality_model },
  balanced: { executor: aliases.balanced_model },
  budget: { executor: aliases.balanced_model }
}
const models = modelLookup[modelProfile]
```

Store resolved model for use in Task calls below.

**If config doesn't exist, create it:**

```javascript
megamemory:create_concept({
  name: "Planning Config",
  kind: "config",
  summary: JSON.stringify({
    model_profile: "balanced"
  }),
  why: "Global planning behavior settings"
})
```
</step>

<step name="load_project_state">
Before any operation, query MegaMemory for project state:

```
megamemory:understand({query: "project state"})
```

**If state concept exists:** Parse and internalize:

- Current position (phase, plan, status) - from `summary` JSON
- Accumulated decisions (constraints on this execution) - from `summary.decisions` array
- Blockers/concerns (things to watch for) - from `summary.blockers` array
- Brief alignment status - from `summary.alignment`

**If state concept missing but other planning concepts exist:**

```
State concept missing but planning artifacts exist in MegaMemory.
Options:
1. Reconstruct from existing phase concepts
2. Continue without project state (may lose accumulated context)
```

**If no planning concepts exist at all:** Error - project not initialized.

This ensures every execution has full project context.

</step>

<step name="identify_plan">
Find the next plan to execute from MegaMemory:

1. **Query roadmap:**

```
megamemory:understand({query: "roadmap"})
```

Parse roadmap concept summary for phase structure. Look for:
- Phase marked as "In progress" or first unstarted phase
- Phase number and directory name

2. **Query phase plans:**

```
megamemory:understand({query: "phase {X} plans"})
```

This returns all plan concepts for the phase (filter concepts by kind="feature" and name matching pattern "{phase}-*-Plan").

3. **Identify next plan:**

- Compare plan concepts vs summary concepts
- Find first plan without corresponding summary
- Pattern: Plan concept name = "{phase}-{plan}-Plan", Summary concept name = "{phase}-{plan}-Summary"

**Logic:**

- If "01-01-Plan" exists but "01-01-Summary" doesn't → execute 01-01
- If "01-01-Summary" exists but "01-02-Summary" doesn't → execute 01-02
- Pattern: Find first Plan concept without matching Summary concept

**Decimal phase handling:**

Phase directories can be integer or decimal format:

- Integer: "01-foundation" → "01-01-Plan"
- Decimal: "01.1-hotfix" → "01.1-01-Plan"

Parse phase number from concept name (handles both formats):

```
// Extract phase number (handles XX or XX.Y format)
const match = planConceptName.match(/^(\d+(\.\d+)?)-(\d+)-Plan$/);
const phase = match[1];  // "01" or "01.1"
const plan = match[3];   // "01"
```

Summary naming follows same pattern:

- Integer: "01-01-Summary"
- Decimal: "01.1-01-Summary"

**Parse plan details:**

```
megamemory:understand({query: "phase {phase} plan {plan}"})
```

This returns the plan concept with all task details in its `summary` field as JSON.

Confirm with user if ambiguous.

<if mode="yolo">
```
[AUTO] Auto-approved: Execute {phase}-{plan}-Plan
[Plan X of Y for Phase Z]

Starting execution...
```

Proceed directly to parse_segments step.
</if>

<if mode="interactive" OR="custom with gates.execute_next_plan true">
Present:

```
Found plan to execute: {phase}-{plan}-Plan
[Plan X of Y for Phase Z]

Proceed with execution?
```

Wait for confirmation before proceeding.
</if>
</step>

<step name="record_start_time">
Record execution start time for performance tracking:

```bash
PLAN_START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PLAN_START_EPOCH=$(date +%s)
```

Store in shell variables for duration calculation at completion.
</step>

<step name="parse_segments">
**Intelligent segmentation: Parse plan into execution segments.**

Plans are divided into segments by checkpoints. Each segment is routed to optimal execution context (subagent or main).

**1. Check for checkpoints:**

Parse plan concept's summary JSON (from identify_plan step):
- Look for tasks with `type="checkpoint"` in tasks array
- Extract checkpoint types: `human-verify`, `decision`, `human-action`

**2. Analyze execution strategy:**

**If NO checkpoints found:**

- **Fully autonomous plan** - spawn single subagent for entire plan
- Subagent gets fresh 200k context, executes all tasks, creates Summary concept, commits
- Main context: Just orchestration (~5% usage)

**If checkpoints found, parse into segments:**

Segment = tasks between checkpoints (or start→first checkpoint, or last checkpoint→end)

**For each segment, determine routing:**

```
Segment routing rules:

IF segment has no prior checkpoint:
  → SUBAGENT (first segment, nothing to depend on)

IF segment follows checkpoint:human-verify:
  → SUBAGENT (verification is just confirmation, doesn't affect next work)

IF segment follows checkpoint:decision OR checkpoint:human-action:
  → MAIN CONTEXT (next tasks need the decision/result)
```

**3. Execution pattern:**

**Pattern A: Fully autonomous (no checkpoints)**

```
Spawn subagent → execute all tasks → create Summary concept → commit → report back
```

**Pattern B: Segmented with verify-only checkpoints**

```
Segment 1 (tasks 1-3): Spawn subagent → execute → report back
Checkpoint 4 (human-verify): Main context → you verify → continue
Segment 2 (tasks 5-6): Spawn NEW subagent → execute → report back
Checkpoint 7 (human-verify): Main context → you verify → continue
Aggregate results → create Summary concept → commit
```

**Pattern C: Decision-dependent (must stay in main)**

```
Checkpoint 1 (decision): Main context → you decide → continue in main
Tasks 2-5: Main context (need decision from checkpoint 1)
No segmentation benefit - execute entirely in main
```

**4. Why this works:**

**Segmentation benefits:**

- Fresh context for each autonomous segment (0% start every time)
- Main context only for checkpoints (~10-20% total)
- Can handle 10+ task plans if properly segmented
- Quality impossible to degrade in autonomous segments

**When segmentation provides no benefit:**

- Checkpoint is decision/human-action and following tasks depend on outcome
- Better to execute sequentially in main than break flow

**5. Implementation:**

**For fully autonomous plans:**

```
1. Run init_agent_tracking step first (see step below)

2. Use Task tool with subagent_type="fuska-executor" and model="{executor_model}":

   Prompt: "Execute plan from MegaMemory concept {plan-concept-id}

   This is an autonomous plan (no checkpoints). Execute all tasks, create Summary concept (megamemory:create_concept) with results, commit with message following plan's commit guidance.

   Follow all deviation rules and authentication gate protocols from the plan.

   When complete, report: plan name, tasks completed, Summary concept ID, commit hash."

3. After Task tool returns with agent_id:

   Record spawn in MegaMemory agent-tracking concept:

   ```javascript
   // Query the agent-tracking concept
   megamemory:understand({query: "agent tracking", top_k: 1})

   // Parse existing data
   const trackingData = JSON.parse(concept.summary);

   // Build new history entry
   const newEntry = {
     agent_id: "[agent_id from Task response]",
     task_description: "Execute full plan {phase}-{plan} (autonomous)",
     phase: "{phase}",
     plan: "{plan}",
     segment: null,
     timestamp: "[current ISO timestamp]",
     status: "spawned",
     completion_timestamp: null
   };

   // Update: set current_agent_id and prepend to history
   megamemory:update_concept({
     id: concept.id,
     changes: {
       summary: JSON.stringify({
         ...trackingData,
         current_agent_id: newEntry.agent_id,
         agent_history: [newEntry, ...trackingData.agent_history]
       })
     }
   })
   ```

4. Wait for subagent to complete

5. After subagent completes successfully:

   Update agent-tracking concept:

   ```javascript
   // Query the agent-tracking concept
   megamemory:understand({query: "agent tracking", top_k: 1})

   // Parse, mark completed, clear current
   const trackingData = JSON.parse(concept.summary);
   megamemory:update_concept({
     id: concept.id,
     changes: {
       summary: JSON.stringify({
         ...trackingData,
         current_agent_id: null,
         agent_history: trackingData.agent_history.map(e =>
           e.agent_id === agentId
             ? {...e, status: "completed", completion_timestamp: "[current ISO timestamp]"}
             : e
         )
       })
     }
   })
   ```

6. Report completion to user
```

**For segmented plans (has verify-only checkpoints):**

```
Execute segment-by-segment:

For each autonomous segment:
  Spawn subagent with prompt: "Execute tasks [X-Y] from plan concept {plan-concept-id}. Query MegaMemory for full plan details and deviation rules. Do NOT create Summary concept or commit - just execute these tasks and report results."

  Wait for subagent completion

For each checkpoint:
  Execute in main context
  Wait for user interaction
  Continue to next segment

After all segments complete:
  Aggregate all results
  Create Summary concept via megamemory:create_concept
  Commit with all changes
```

**For decision-dependent plans:**

```
Execute in main context (standard flow below)
No subagent routing
Quality maintained through small scope (2-3 tasks per plan)
```

See step name="segment_execution" for detailed segment execution loop.
</step>

<step name="init_agent_tracking">
**Initialize agent tracking for subagent resume capability.**

Before spawning any subagents, set up tracking via MegaMemory.

**1. Query for existing agent-tracking concept:**

```javascript
megamemory:understand({query: "agent tracking", top_k: 1})
```

**2. If concept does NOT exist** (`.concepts` array is empty):

Create it:

```javascript
megamemory:create_concept({
  name: "agent-tracking",
  kind: "config",
  summary: JSON.stringify({
    version: "1.0",
    max_entries: 50,
    current_agent_id: null,
    agent_history: []
  }),
  why: "Tracks spawned subagents for resume detection"
})
```

Then skip to step 5 (no history to check).

**3. If concept EXISTS — check for interrupted agents (resume detection):**

Parse the summary:

```javascript
const trackingData = JSON.parse(concept.summary);
```

If `trackingData.current_agent_id` is not null:
- A previous session was interrupted mid-execution
- Present to user: "Previous session was interrupted. Resume agent [ID] or start fresh?"
- If resume: Use Task tool with `resume` parameter set to the interrupted ID
- If fresh: Continue to step 4 (clear below)

**4. Clear current_agent_id** (reset for new session):

```javascript
megamemory:update_concept({
  id: concept.id,
  changes: {
    summary: JSON.stringify({
      ...trackingData,
      current_agent_id: null
    })
  }
})
```

**5. Prune old entries (housekeeping):**

If `trackingData.agent_history.length > trackingData.max_entries`:
- Keep ALL entries with status `"spawned"` (may need resume)
- Keep newest completed entries up to `max_entries` total
- Update concept summary with pruned array

```javascript
const spawned = trackingData.agent_history.filter(e => e.status === "spawned");
const completed = trackingData.agent_history.filter(e => e.status === "completed");
const keepCompleted = completed.slice(0, trackingData.max_entries - spawned.length);
trackingData.agent_history = [...spawned, ...keepCompleted];

megamemory:update_concept({
  id: concept.id,
  changes: {
    summary: JSON.stringify(trackingData)
  }
})
```

**When to run this step:**
- Pattern A (fully autonomous): Before spawning the single subagent
- Pattern B (segmented): Before the segment execution loop
- Pattern C (main context): Skip — no subagents spawned
</step>

<step name="segment_execution">
**Detailed segment execution loop for segmented plans.**

**This step applies ONLY to segmented plans (Pattern B: has checkpoints, but they're verify-only).**

For Pattern A (fully autonomous) and Pattern C (decision-dependent), skip this step.

**Execution flow:**

```
1. Parse plan concept to identify segments:
   - Query plan concept: megamemory:understand({query: "phase {phase} plan {plan}"})
   - Parse summary JSON for tasks array
   - Find checkpoint locations: tasks with type="checkpoint"
   - Identify checkpoint types: extract checkpoint type field
   - Build segment map:
     * Segment 1: Start → first checkpoint (tasks 1-X)
     * Checkpoint 1: Type and location
     * Segment 2: After checkpoint 1 → next checkpoint (tasks X+1 to Y)
     * Checkpoint 2: Type and location
     * ... continue for all segments

2. For each segment in order:

   A. Determine routing (apply rules from parse_segments):
      - No prior checkpoint? → Subagent
      - Prior checkpoint was human-verify? → Subagent
      - Prior checkpoint was decision/human-action? → Main context

   B. If routing = Subagent:
      ```
      Spawn Task tool with subagent_type="fuska-executor" and model="{executor_model}":

      Prompt: "Execute tasks [task numbers/names] from plan concept {plan-concept-id}.

      **Context:**
      - Query MegaMemory for full plan details: megamemory:understand({query: "phase {phase} plan {plan}"})
      - You are executing a SEGMENT of this plan (not the full plan)
      - Other segments will be executed separately

      **Your responsibilities:**
      - Execute only the tasks assigned to you
      - Follow all deviation rules and authentication gate protocols
      - Track deviations for later Summary
      - DO NOT create Summary concept (will be created after all segments complete)
      - DO NOT commit (will be done after all segments complete)

      **Report back:**
      - Tasks completed
      - Files created/modified
      - Deviations encountered
      - Any issues or blockers"

      **After Task tool returns with agent_id:**

      Record spawn in MegaMemory agent-tracking concept:

      ```javascript
      // Query the agent-tracking concept
      megamemory:understand({query: "agent tracking", top_k: 1})

      // Parse existing data
      const trackingData = JSON.parse(concept.summary);

      // Build new history entry
      const newEntry = {
        agent_id: "[agent_id from Task response]",
        task_description: "Execute tasks [X-Y] from plan {phase}-{plan}",
        phase: "{phase}",
        plan: "{plan}",
        segment: [segment_number],
        timestamp: "[current ISO timestamp]",
        status: "spawned",
        completion_timestamp: null
      };

      // Update: set current_agent_id and prepend to history
      megamemory:update_concept({
        id: concept.id,
        changes: {
          summary: JSON.stringify({
            ...trackingData,
            current_agent_id: newEntry.agent_id,
            agent_history: [newEntry, ...trackingData.agent_history]
          })
        }
      })
      ```

      Wait for subagent to complete
      Capture results (files changed, deviations, etc.)

      **After subagent completes successfully:**

      Update agent-tracking concept:

      ```javascript
      megamemory:understand({query: "agent tracking", top_k: 1})

      const trackingData = JSON.parse(concept.summary);
      megamemory:update_concept({
        id: concept.id,
        changes: {
          summary: JSON.stringify({
            ...trackingData,
            current_agent_id: null,
            agent_history: trackingData.agent_history.map(e =>
              e.agent_id === agentId
                ? {...e, status: "completed", completion_timestamp: "[current ISO timestamp]"}
                : e
            )
          })
        }
      })
      ```

      ```

   C. If routing = Main context:
      Execute tasks in main using standard execution flow (step name="execute")
      Track results locally

   D. After segment completes (whether subagent or main):
      Continue to next checkpoint/segment

3. After ALL segments complete:

   A. Aggregate results from all segments:
      - Collect files created/modified from all segments
      - Collect deviations from all segments
      - Collect decisions from all checkpoints
      - Merge into complete picture

   B. Create Summary concept:
      - Use megamemory:create_concept with aggregated results
      - Document all work from all segments
      - Include deviations from all segments
      - Note which segments were subagented

   C. Commit:
      - Stage all files from all segments
      - Commit with message following plan guidance
      - Include note about segmented execution if relevant

   D. Report completion

**Example execution trace:**

Plan concept: "01-02-Plan" (8 tasks, 2 verify checkpoints)

Parsing segments...

- Segment 1: Tasks 1-3 (autonomous)
- Checkpoint 4: human-verify
- Segment 2: Tasks 5-6 (autonomous)
- Checkpoint 7: human-verify
- Segment 3: Task 8 (autonomous)

Routing analysis:

- Segment 1: No prior checkpoint → SUBAGENT [OK]
- Checkpoint 4: Verify only → MAIN (required)
- Segment 2: After verify → SUBAGENT [OK]
- Checkpoint 7: Verify only → MAIN (required)
- Segment 3: After verify → SUBAGENT [OK]

Execution:
[1] Spawning subagent for tasks 1-3...
→ Subagent completes: 3 files modified, 0 deviations
[2] Executing checkpoint 4 (human-verify)...
╔═══════════════════════════════════════════════════════╗
║  CHECKPOINT: Verification Required                    ║
╚═══════════════════════════════════════════════════════╝

Progress: 3/8 tasks complete
Task: Verify database schema

Built: User and Session tables with relations

How to verify:
  1. Check src/db/schema.ts for correct types

────────────────────────────────────────────────────────
→ YOUR ACTION: Type "approved" or describe issues
────────────────────────────────────────────────────────
User: "approved"
[3] Spawning subagent for tasks 5-6...
→ Subagent completes: 2 files modified, 1 deviation (added error handling)
[4] Executing checkpoint 7 (human-verify)...
User: "approved"
[5] Spawning subagent for task 8...
→ Subagent completes: 1 file modified, 0 deviations

Aggregating results...

- Total files: 6 modified
- Total deviations: 1
- Segmented execution: 3 subagents, 2 checkpoints

Creating Summary concept...
Committing...
[OK] Complete

**Benefits of this pattern:**
- Main context usage: ~20% (just orchestration + checkpoints)
- Subagent 1: Fresh 0-30% (tasks 1-3)
- Subagent 2: Fresh 0-30% (tasks 5-6)
- Subagent 3: Fresh 0-20% (task 8)
- All autonomous work: Peak quality
- Can handle large plans with many tasks if properly segmented

**When NOT to use segmentation:**
- Plan has decision/human-action checkpoints that affect following tasks
- Following tasks depend on checkpoint outcome
- Better to execute in main sequentially in those cases
</step>

<step name="load_prompt">
Query MegaMemory for the plan prompt details:

```
megamemory:understand({query: "phase {phase} plan {plan}"})
```

Parse the plan concept's summary JSON - this IS the execution instructions. Follow it exactly.

**If plan references CONTEXT concept:**
Query for context concept:

```
megamemory:understand({query: "phase {phase} context"})
```

The context concept provides the user's vision for this phase — how they imagine it working, what's essential, and what's out of scope. Honor this context throughout execution.
</step>

<step name="previous_phase_check">
Before executing, check if previous phase had issues:

```
megamemory:understand({query: "previous phase summary"})
```

If previous phase summary concept has "Issues Encountered" != "None" or "Next Phase Readiness" mentions blockers:

Use question:

- header: "Previous Issues"
- question: "Previous phase had unresolved items: [summary]. How to proceed?"
- options:
  - "Proceed anyway" - Issues won't block this phase
  - "Address first" - Let's resolve before continuing
  - "Review previous" - Show me the full summary
</step>

<step name="execute">
Execute each task in the prompt. **Deviations are normal** - handle them automatically using embedded rules below.

1. Read the @context files listed in the prompt (these are actual files, not MegaMemory concepts)

2. For each task:

   **If `type="auto"`:**

   **Before executing:** Check if task has `tdd="true"` attribute:
   - If yes: Follow TDD execution flow (see `<tdd_execution>`) - RED → GREEN → REFACTOR cycle with atomic commits per stage
   - If no: Standard implementation

   - Work toward task completion
   - **If CLI/API returns authentication error:** Handle as authentication gate (see below)
   - **When you discover additional work not in plan:** Apply deviation rules (see below) automatically
   - Continue implementing, applying rules as needed
   - Run the verification
   - Confirm done criteria met
   - **Commit the task** (see `<task_commit>` below)
   - Track task completion and commit hash for Summary documentation
   - Continue to next task

   **If `type="checkpoint:*"`:**

   - STOP immediately (do not continue to next task)
   - Execute checkpoint_protocol (see below)
   - Wait for user response
   - Verify if possible (check files, env vars, etc.)
   - Only after user confirmation: continue to next task

3. Run overall verification checks from `<verification>` section
4. Confirm all success criteria from `<success_criteria>` section met
5. Document all deviations in Summary (automatic - see deviation_documentation below)
   </step>

<authentication_gates>

## Handling Authentication Errors During Execution

**When you encounter authentication errors during `type="auto"` task execution:**

This is NOT a failure. Authentication gates are expected and normal. Handle them dynamically:

**Authentication error indicators:**

- CLI returns: "Error: Not authenticated", "Not logged in", "Unauthorized", "401", "403"
- API returns: "Authentication required", "Invalid API key", "Missing credentials"
- Command fails with: "Please run {tool} login" or "Set {ENV_VAR} environment variable"

**Authentication gate protocol:**

1. **Recognize it's an auth gate** - Not a bug, just needs credentials
2. **STOP current task execution** - Don't retry repeatedly
3. **Create dynamic checkpoint:human-action** - Present it to user immediately
4. **Provide exact authentication steps** - CLI commands, where to get keys
5. **Wait for user to authenticate** - Let them complete auth flow
6. **Verify authentication works** - Test that credentials are valid
7. **Retry the original task** - Resume automation where you left off
8. **Continue normally** - Don't treat this as an error in Summary

**Example: Vercel deployment hits auth error**

```
Task 3: Deploy to Vercel
Running: vercel --yes

Error: Not authenticated. Please run 'vercel login'

[Create checkpoint dynamically]

╔═══════════════════════════════════════════════════════╗
║  CHECKPOINT: Action Required                          ║
╚═══════════════════════════════════════════════════════╝

Progress: 2/8 tasks complete
Task: Authenticate Vercel CLI

Attempted: vercel --yes
Error: Not authenticated

What you need to do:
  1. Run: vercel login
  2. Complete browser authentication

I'll verify: vercel whoami returns your account

────────────────────────────────────────────────────────
→ YOUR ACTION: Type "done" when authenticated
────────────────────────────────────────────────────────

[Wait for user response]

[User types "done"]

Verifying authentication...
Running: vercel whoami
[OK] Authenticated as: user@example.com

Retrying deployment...
Running: vercel --yes
[OK] Deployed to: https://myapp-abc123.vercel.app

Task 3 complete. Continuing to task 4...
```

**In Summary documentation:**

Document authentication gates as normal flow, not deviations:

```markdown
## Authentication Gates

During execution, I encountered authentication requirements:

1. Task 3: Vercel CLI required authentication
   - Paused for `vercel login`
   - Resumed after authentication
   - Deployed successfully

These are normal gates, not errors.
```

**Key principles:**

- Authentication gates are NOT failures or bugs
- They're expected interaction points during first-time setup
- Handle them gracefully and continue automation after unblocked
- Don't mark tasks as "failed" or "incomplete" due to auth gates
- Document them as normal flow, separate from deviations
  </authentication_gates>

<deviation_rules>

## Automatic Deviation Handling

**While executing tasks, you WILL discover work not in the plan.** This is normal.

Apply these rules automatically. Track all deviations for Summary documentation.

---

**RULE 1: Auto-fix bugs**

**Trigger:** Code doesn't work as intended (broken behavior, incorrect output, errors)

**Action:** Fix immediately, track for Summary

**Examples:**

- Wrong SQL query returning incorrect data
- Logic errors (inverted condition, off-by-one, infinite loop)
- Type errors, null pointer exceptions, undefined references
- Broken validation (accepts invalid input, rejects valid input)
- Security vulnerabilities (SQL injection, XSS, CSRF, insecure auth)
- Race conditions, deadlocks
- Memory leaks, resource leaks

**Process:**

1. Fix the bug inline
2. Add/update tests to prevent regression
3. Verify fix works
4. Continue task
5. Track in deviations list: `[Rule 1 - Bug] [description]`

**No user permission needed.** Bugs must be fixed for correct operation.

---

**RULE 2: Auto-add missing critical functionality**

**Trigger:** Code is missing essential features for correctness, security, or basic operation

**Action:** Add immediately, track for Summary

**Examples:**

- Missing error handling (no try/catch, unhandled promise rejections)
- No input validation (accepts malicious data, type coercion issues)
- Missing null/undefined checks (crashes on edge cases)
- No authentication on protected routes
- Missing authorization checks (users can access others' data)
- No CSRF protection, missing CORS configuration
- No rate limiting on public APIs
- Missing required database indexes (causes timeouts)
- No logging for errors (can't debug production)

**Process:**

1. Add the missing functionality inline
2. Add tests for the new functionality
3. Verify it works
4. Continue task
5. Track in deviations list: `[Rule 2 - Missing Critical] [description]`

**Critical = required for correct/secure/performant operation**
**No user permission needed.** These are not "features" - they're requirements for basic correctness.

---

**RULE 3: Auto-fix blocking issues**

**Trigger:** Something prevents you from completing current task

**Action:** Fix immediately to unblock, track for Summary

**Examples:**

- Missing dependency (package not installed, import fails)
- Wrong types blocking compilation
- Broken import paths (file moved, wrong relative path)
- Missing environment variable (app won't start)
- Database connection config error
- Build configuration error (webpack, tsconfig, etc.)
- Missing file referenced in code
- Circular dependency blocking module resolution

**Process:**

1. Fix the blocking issue
2. Verify task can now proceed
3. Continue task
4. Track in deviations list: `[Rule 3 - Blocking] [description]`

**No user permission needed.** Can't complete task without fixing blocker.

---

**RULE 4: Ask about architectural changes**

**Trigger:** Fix/addition requires significant structural modification

**Action:** STOP, present to user, wait for decision

**Examples:**

- Adding new database table (not just column)
- Major schema changes (changing primary key, splitting tables)
- Introducing new service layer or architectural pattern
- Switching libraries/frameworks (React → Vue, REST → GraphQL)
- Changing authentication approach (sessions → JWT)
- Adding new infrastructure (message queue, cache layer, CDN)
- Changing API contracts (breaking changes to endpoints)
- Adding new deployment environment

**Process:**

1. STOP current task
2. Present clearly:

```
[WARN] Architectural Decision Needed

Current task: [task name]
Discovery: [what you found that prompted this]
Proposed change: [architectural modification]
Why needed: [rationale]
Impact: [what this affects - APIs, deployment, dependencies, etc.]
Alternatives: [other approaches, or "none apparent"]

Proceed with proposed change? (yes / different approach / defer)
```

3. WAIT for user response
4. If approved: implement, track as `[Rule 4 - Architectural] [description]`
5. If different approach: discuss and implement
6. If deferred: note in Summary and continue without change

**User decision required.** These changes affect system design.

---

**RULE PRIORITY (when multiple could apply):**

1. **If Rule 4 applies** → STOP and ask (architectural decision)
2. **If Rules 1-3 apply** → Fix automatically, track for Summary
3. **If genuinely unsure which rule** → Apply Rule 4 (ask user)

**Edge case guidance:**

- "This validation is missing" → Rule 2 (critical for security)
- "This crashes on null" → Rule 1 (bug)
- "Need to add table" → Rule 4 (architectural)
- "Need to add column" → Rule 1 or 2 (depends: fixing bug or adding critical field)

**When in doubt:** Ask yourself "Does this affect correctness, security, or ability to complete task?"

- YES → Rules 1-3 (fix automatically)
- MAYBE → Rule 4 (ask user)

</deviation_rules>

<deviation_documentation>

## Documenting Deviations in Summary

After all tasks complete, Summary concept MUST include deviations section.

**If no deviations:**

```markdown
## Deviations from Plan

None - plan executed exactly as written.
```

**If deviations occurred:**

```markdown
## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed case-sensitive email uniqueness constraint**

- **Found during:** Task 4 (Follow/unfollow API implementation)
- **Issue:** User.email unique constraint was case-sensitive - Test@example.com and test@example.com were both allowed, causing duplicate accounts
- **Fix:** Changed to `CREATE UNIQUE INDEX users_email_unique ON users (LOWER(email))`
- **Files modified:** src/models/User.ts, migrations/003_fix_email_unique.sql
- **Verification:** Unique constraint test passes - duplicate emails properly rejected
- **Commit:** abc123f

**2. [Rule 2 - Missing Critical] Added JWT expiry validation to auth middleware**

- **Found during:** Task 3 (Protected route implementation)
- **Issue:** Auth middleware wasn't checking token expiry - expired tokens were being accepted
- **Fix:** Added exp claim validation in middleware, reject with 401 if expired
- **Files modified:** src/middleware/auth.ts, src/middleware/auth.test.ts
- **Verification:** Expired token test passes - properly rejects with 401
- **Commit:** def456g

---

**Total deviations:** 4 auto-fixed (1 bug, 1 missing critical, 1 blocking, 1 architectural with approval)
**Impact on plan:** All auto-fixes necessary for correctness/security/performance. No scope creep.
```

**This provides complete transparency:**

- Every deviation documented
- Why it was needed
- What rule applied
- What was done
- User can see exactly what happened beyond the plan

</deviation_documentation>

<tdd_plan_execution>
## TDD Plan Execution

When executing a plan with `type: tdd` in frontmatter, follow the RED-GREEN-REFACTOR cycle for the single feature defined in the plan.

**1. Check test infrastructure (if first TDD plan):**
If no test framework configured:
- Detect project type from package.json/requirements.txt/etc.
- Install minimal test framework (Jest, pytest, Go testing, etc.)
- Create test config file
- Verify: run empty test suite
- This is part of the RED phase, not a separate task

**2. RED - write failing test:**
- read `<behavior>` element for test specification
- Create test file if doesn't exist (follow project conventions)
- write test(s) that describe expected behavior
- Run tests - MUST fail (if passes, test is wrong or feature exists)
- Commit: `test({phase}-{plan}): add failing test for [feature]`

**3. GREEN - Implement to pass:**
- read `<implementation>` element for guidance
- write minimal code to make test pass
- Run tests - MUST pass
- Commit: `feat({phase}-{plan}): implement [feature]`

**4. REFACTOR (if needed):**
- Clean up code if obvious improvements
- Run tests - MUST still pass
- Commit only if changes made: `refactor({phase}-{plan}): clean up [feature]`

**Commit pattern for TDD plans:**
Each TDD plan produces 2-3 atomic commits:
1. `test({phase}-{plan}): add failing test for X`
2. `feat({phase}-{plan}): implement X`
3. `refactor({phase}-{plan}): clean up X` (optional)

**Error handling:**
- If test doesn't fail in RED phase: Test is wrong or feature already exists. Investigate before proceeding.
- If test doesn't pass in GREEN phase: Debug implementation, keep iterating until green.
- If tests fail in REFACTOR phase: Undo refactor, commit was premature.

**Verification:**
After TDD plan completion, ensure:
- All tests pass
- Test coverage for the new behavior exists
- No unrelated tests broken

**Why TDD uses dedicated plans:** TDD requires 2-3 execution cycles (RED → GREEN → REFACTOR), each with file reads, test runs, and potential debugging. This consumes 40-50% of context for a single feature. Dedicated plans ensure full quality throughout the cycle.

**Comparison:**
- Standard plans: Multiple tasks, 1 commit per task, 2-4 commits total
- TDD plans: Single feature, 2-3 commits for RED/GREEN/REFACTOR cycle

See `~/.config/opencode/get-shit-done/references/tdd.md` for TDD plan structure.
</tdd_plan_execution>

<task_commit>
## Task Commit Protocol

**Commit behavior depends on `git.commit_strategy` from the config concept.** Default: `per-phase`.

### After each task completes (verification passed, done criteria met):

**Step 1. Stage task-related files (ALL strategies):**

```bash
git status --short
```

Stage each file individually (NEVER use `git add .` or `git add -A`):

```bash
git add src/api/auth.ts
git add src/types/user.ts
```

**Step 2. Commit or defer (strategy-dependent):**

**If `per-task`:** Commit immediately.

```bash
git commit -m "{type}({phase}-{plan}): {concise task description}

- {high-level change 1}
- {high-level change 2}
"
```

**If `per-plan`:** Do NOT commit. Files stay staged. Commit once after ALL tasks in this plan complete:

```bash
git commit -m "{type}({phase}-{plan}): {plan objective summary}

- {task 1}: {one-line summary}
- {task 2}: {one-line summary}
"
```

**If `per-phase`:** Do NOT commit. Files stay staged. The execute-phase orchestrator commits when the entire phase completes.

**Step 3. Record commit hash (per-task and per-plan only):**

```bash
TASK_COMMIT=$(git rev-parse --short HEAD)
```

### Commit message rules (CRITICAL)

**LLMs default to extremely verbose commit messages. You MUST resist this.**

- Subject line: max 72 chars, imperative mood
- Body: **maximum 2-4 bullet points.** Never more.
- Each bullet is ONE high-level sentence
- **NEVER** list: imports, field names, parameter details, null checks, constructor changes
- **NEVER** restate what the diff shows — explain *what* and *why*, not *how*

**BAD** (10 bullets restating the diff — do NOT do this):
```
feat(02-02): parse discounts from API response

- Added import api_price_calc.dart to data_parser.dart
- Created _parseDiscounts() helper method
- Extracts common fields: id, name, description, type
- Uses pattern matching on type field
- Maps snake_case to camelCase fields
...
```

**GOOD** (2 bullets, high-level):
```
feat(02-02): parse discounts from API response

- Map discount JSON to typed Discount subclasses via pattern matching
- Assign parsed discounts to User after construction
```

**Note:** TDD plans have their own commit pattern (test/feat/refactor for RED/GREEN/REFACTOR phases). See `<tdd_plan_execution>` section above.

</task_commit>

<step name="checkpoint_protocol">
When encountering `type="checkpoint:*"`:

**Critical: OpenCode automates everything with CLI/API before checkpoints.** Checkpoints are for verification and decisions, not manual work.

**Display checkpoint clearly:**

```
╔═══════════════════════════════════════════════════════╗
║  CHECKPOINT: [Type]                                   ║
╚═══════════════════════════════════════════════════════╝

Progress: {X}/{Y} tasks complete
Task: [task name]

[Display task-specific content based on type]

────────────────────────────────────────────────────────
→ YOUR ACTION: [Resume signal instruction]
────────────────────────────────────────────────────────
```

**For checkpoint:human-verify (90% of checkpoints):**

```
Built: [what was automated - deployed, built, configured]

How to verify:
  1. [Step 1 - exact command/URL]
  2. [Step 2 - what to check]
  3. [Step 3 - expected behavior]

────────────────────────────────────────────────────────
→ YOUR ACTION: Type "approved" or describe issues
────────────────────────────────────────────────────────
```

**For checkpoint:decision (9% of checkpoints):**

```
Decision needed: [decision]

Context: [why this matters]

Options:
1. [option-id]: [name]
   Pros: [pros]
   Cons: [cons]

2. [option-id]: [name]
   Pros: [pros]
   Cons: [cons]

[Resume signal - e.g., "Select: option-id"]
```

**For checkpoint:human-action (1% - rare, only for truly unavoidable manual steps):**

```
I automated: [what OpenCode already did via CLI/API]

Need your help with: [the ONE thing with no CLI/API - email link, 2FA code]

Instructions:
[Single unavoidable step]

I'll verify after: [verification]

[Resume signal - e.g., "Type 'done' when complete"]
```

**After displaying:** WAIT for user response. Do NOT hallucinate completion. Do NOT continue to next task.

**After user responds:**

- Run verification if specified (file exists, env var set, tests pass, etc.)
- If verification passes or N/A: continue to next task
- If verification fails: inform user, wait for resolution

See ~/.config/opencode/get-shit-done/references/checkpoints.md for complete checkpoint guidance.
</step>

<step name="checkpoint_return_for_orchestrator">
**When spawned by an orchestrator (execute-phase or execute-plan command):**

If you were spawned via Task tool and hit a checkpoint, you cannot directly interact with the user. Instead, RETURN to the orchestrator with structured checkpoint state so it can present to the user and spawn a fresh continuation agent.

**Return format for checkpoints:**

**Required in your return:**

1. **Completed Tasks table** - Tasks done so far with commit hashes and files created
2. **Current Task** - Which task you're on and what's blocking it
3. **Checkpoint Details** - User-facing content (verification steps, decision options, or action instructions)
4. **Awaiting** - What you need from the user

**Example return:**

```
## CHECKPOINT REACHED

**Type:** human-action
**Plan:** 01-01
**Progress:** 1/3 tasks complete

### Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Initialize Next.js 15 project | d6fe73f | package.json, tsconfig.json, app/ |

### Current Task

**Task 2:** Initialize Convex backend
**Status:** blocked
**Blocked by:** Convex CLI authentication required

### Checkpoint Details

**Automation attempted:**
Ran `npx convex dev` to initialize Convex backend

**Error encountered:**
"Error: Not authenticated. Run `npx convex login` first."

**What you need to do:**
1. Run: `npx convex login`
2. Complete browser authentication
3. Run: `npx convex dev`
4. Create project when prompted

**I'll verify after:**
`cat .env.local | grep CONVEX` returns the Convex URL

### Awaiting

Type "done" when Convex is authenticated and project created.
```

**After you return:**

The orchestrator will:
1. Parse your structured return
2. Present checkpoint details to the user
3. Collect user's response
4. Spawn a FRESH continuation agent with your completed tasks state

You will NOT be resumed. A new agent continues from where you stopped, using your Completed Tasks table to know what's done.

**How to know if you were spawned:**

If you're reading this workflow because an orchestrator spawned you (vs running directly), the orchestrator's prompt will include checkpoint return instructions. Follow those instructions when you hit a checkpoint.

**If running in main context (not spawned):**

Use the standard checkpoint_protocol - display checkpoint and wait for direct user response.
</step>

<step name="verification_failure_gate">
If any task verification fails:

STOP. Do not continue to next task.

Present inline:
"Verification failed for Task [X]: [task name]

Expected: [verification criteria]
Actual: [what happened]

How to proceed?

1. Retry - Try the task again
2. Skip - Mark as incomplete, continue
3. Stop - Pause execution, investigate"

Wait for user decision.

If user chose "Skip", note it in Summary concept under "Issues Encountered".
</step>

<step name="record_completion_time">
Record execution end time and calculate duration:

```bash
PLAN_END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PLAN_END_EPOCH=$(date +%s)

DURATION_SEC=$(( PLAN_END_EPOCH - PLAN_START_EPOCH ))
DURATION_MIN=$(( DURATION_SEC / 60 ))

if [[ $DURATION_MIN -ge 60 ]]; then
  HRS=$(( DURATION_MIN / 60 ))
  MIN=$(( DURATION_MIN % 60 ))
  DURATION="${HRS}h ${MIN}m"
else
  DURATION="${DURATION_MIN} min"
fi
```

Pass timing data to Summary concept creation.
</step>

<step name="generate_user_setup">
**Generate USER-SETUP concept if plan has user_setup in frontmatter.**

Parse plan concept's summary JSON for `user_setup` field:

```javascript
const planData = JSON.parse(planConcept.summary);
const userSetup = planData.user_setup; // Array or undefined
```

**If user_setup exists and is not empty:**

Create a USER-SETUP concept using template from `~/.config/opencode/get-shit-done/templates/user-setup.md`:

```javascript
megamemory:create_concept({
  name: "{phase}-USER-SETUP",
  kind: "config",
  summary: JSON.stringify({
    phase: "{phase}",
    status: "Incomplete",
    services: [
      {
        name: "Stripe",
        env_vars: [
          {var: "STRIPE_SECRET_KEY", source: "Stripe Dashboard → Developers → API keys → Secret key", target: ".env.local"},
          {var: "STRIPE_WEBHOOK_SECRET", source: "Stripe Dashboard → Developers → Webhooks → Signing secret", target: ".env.local"}
        ],
        account_setup: [...], // From user_setup.account_setup if present
        dashboard_config: [
          {task: "Create webhook endpoint", details: "URL: https://[your-domain]/api/webhooks/stripe, Events: checkout.session.completed"}
        ],
        local_dev: "stripe listen --forward-to localhost:3000/api/webhooks/stripe"
      }
    ],
    verification: ["stripe login", "stripe listen --forward-to localhost:3000/api/webhooks/stripe"]
  }),
  why: "Captures manual setup requirements for external services",
  parent_id: "phase-{phase}-concept-id"
})
```

**Content generation:**

1. Parse each service in `user_setup` array
2. For each service, generate sections:
   - Environment Variables table (from `env_vars`)
   - Account Setup checklist (from `account_setup`, if present)
   - Dashboard Configuration steps (from `dashboard_config`, if present)
   - Local Development notes (from `local_dev`, if present)
3. Add verification section with commands to confirm setup works
4. Set status to "Incomplete"

**Example summary JSON:**

```json
{
  "phase": "10",
  "status": "Incomplete",
  "services": [
    {
      "name": "Stripe",
      "env_vars": [
        {"var": "STRIPE_SECRET_KEY", "source": "Stripe Dashboard → Developers → API keys → Secret key", "target": ".env.local"},
        {"var": "STRIPE_WEBHOOK_SECRET", "source": "Stripe Dashboard → Developers → Webhooks → Signing secret", "target": ".env.local"}
      ],
      "dashboard_config": [
        {
          "task": "Create webhook endpoint",
          "details": "URL: https://[your-domain]/api/webhooks/stripe, Events: checkout.session.completed"
        }
      ],
      "local_dev": "stripe listen --forward-to localhost:3000/api/webhooks/stripe"
    }
  ],
  "verification": ["stripe login", "stripe listen --forward-to localhost:3000/api/webhooks/stripe"]
}
```

**If user_setup is empty or missing:**

Skip this step - no USER-SETUP concept needed.

**Track for offer_next:**

Set `USER_SETUP_CREATED=true` if concept was created, for use in completion messaging.
</step>

<step name="create_summary">
Create Summary concept as specified in the prompt's `<output>` section.
Use ~/.config/opencode/get-shit-done/templates/summary.md for structure reference.

**Concept creation:**

```javascript
megamemory:create_concept({
  name: "{phase}-{plan}-Summary",
  kind: "feature",
  summary: JSON.stringify({
    phase: "{phase}",
    plan: "{plan}",
    subsystem: "auth", // Categorize based on phase focus
    tags: ["jwt", "refresh-token", "jose"], // Extract tech keywords
    requires: ["00-01-Summary"], // Prior phases this built upon
    provides: ["authentication", "token-management"], // What was delivered
    affects: ["02-api"], // Future phases that might need this
    tech_stack: {
      added: ["jose"], // New libraries
      patterns: ["refresh-token-rotation"] // Architectural patterns
    },
    key_files: {
      created: ["src/auth/jwt.ts", "src/middleware/auth.ts"],
      modified: ["package.json"]
    },
    decisions: [
      {decision: "Use jose library for JWT", rationale: "Well-maintained, supports ES modules"}
    ],
    accomplishments: [
      "JWT access token generation",
      "Refresh token with rotation",
      "Protected route middleware"
    ],
    files_modified_count: 5,
    deviations: [
      {rule: "Rule 1", description: "Added token expiry validation", files: ["src/auth/jwt.ts"], commit: "abc123f"}
    ],
    duration: "$DURATION",
    started: "$PLAN_START_TIME",
    completed: "$PLAN_END_TIME",
    tasks_completed: 3,
    issues_encountered: "None",
    next_phase_readiness: "Complete - all authentication primitives ready",
    next_step: "Ready for {phase}-{next-plan}-Plan"
  }),
  why: "Captures execution results and deliverables for plan {phase}-{plan}",
  parent_id: "phase-{phase}-concept-id",
  edges: [
    {to: "project-state-id", relation: "configured_by", description: "Updates project progress and position"},
    {to: "phase-00-summary-id", relation: "depends_on", description: "Built on previous phase foundation"}
  ],
  file_refs: ["src/auth/jwt.ts:1-50", "tests/auth.test.ts:10-30"]
})
```

**Frontmatter population:**

Populate summary JSON fields from execution context:

1. **Basic identification:**
   - phase: From plan concept summary
   - plan: From plan concept summary
   - subsystem: Categorize based on phase focus (auth, payments, ui, api, database, infra, testing, etc.)
   - tags: Extract tech keywords (libraries, frameworks, tools used)

2. **Dependency graph:**
   - requires: List prior phases this built upon (check plan concept edges or query for prior phase summaries)
   - provides: Extract from accomplishments - what was delivered
   - affects: Infer from phase description/goal what future phases might need this

3. **Tech tracking:**
   - tech-stack.added: New libraries from package.json changes or requirements
   - tech-stack.patterns: Architectural patterns established (from decisions/accomplishments)

4. **File tracking:**
   - key-files.created: From "Files Created/Modified" section
   - key-files.modified: From "Files Created/Modified" section

5. **Decisions:**
   - key-decisions: Extract from "Decisions Made" section

6. **Metrics:**
   - duration: From $DURATION variable
   - completed: From $PLAN_END_TIME (date only, format YYYY-MM-DD)

Note: If subsystem/affects are unclear, use best judgment based on phase name and accomplishments. Can be refined later.

**Title format:** `# Phase [X] Plan [Y]: [Name] Summary`

The one-liner must be SUBSTANTIVE:

- Good: "JWT auth with refresh rotation using jose library"
- Bad: "Authentication implemented"

**Include performance data:**

- Duration: `$DURATION`
- Started: `$PLAN_START_TIME`
- Completed: `$PLAN_END_TIME`
- Tasks completed: (count from execution)
- Files modified: (count from execution)

**Next Step section:**

- If more plans exist in this phase: "Ready for {phase}-{next-plan}-Plan"
- If this is the last plan: "Phase complete, ready for transition"
  </step>

<step name="update_current_position">
Update project state concept's current position to reflect plan completion.

Query current state:

```
megamemory:understand({query: "project state"})
```

Parse state concept summary JSON, then update:

```javascript
megamemory:update_concept({
  id: "project-state-id",
  changes: {
    summary: JSON.stringify({
      // Keep existing fields (decisions, blockers, alignment)
      // Update only position fields:
      current_phase: "{current}", // X of total
      current_phase_name: "{phase name}",
      current_plan: "{just completed}",
      current_plan_of_total: "{N} of {total in current phase}",
      status: "In progress", // or "Phase complete"
      last_activity: "{today} - Completed {phase}-{plan}-Plan",
      progress_percent: {calculate percentage}
      // Keep decisions, blockers, alignment arrays from existing state
    })
  }
})
```

**Calculate progress bar:**

- Query all phase concepts and count total plans
- Query all summary concepts and count completed plans
- Progress = (completed / total) × 100%
- Render: ░ for incomplete, █ for complete

**Example - completing 02-01-Plan (plan 5 of 10 total):**

Before state:

```json
{
  "current_phase": "2",
  "current_phase_name": "Authentication",
  "current_plan": "0",
  "current_plan_of_total": "0 of 2",
  "status": "Ready to execute",
  "last_activity": "2025-01-18 - Phase 1 complete",
  "progress_percent": 40,
  "progress_bar": "██████░░░░",
  "decisions": [...],
  "blockers": [],
  "alignment": "..."
}
```

After state:

```json
{
  "current_phase": "2",
  "current_phase_name": "Authentication",
  "current_plan": "1",
  "current_plan_of_total": "1 of 2",
  "status": "In progress",
  "last_activity": "2025-01-19 - Completed 02-01-Plan",
  "progress_percent": 50,
  "progress_bar": "███████░░░",
  "decisions": [...],
  "blockers": [],
  "alignment": "..."
}
```

**Step complete when:**

- [ ] Phase number shows current phase (X of total)
- [ ] Plan number shows plans complete in current phase (N of total-in-phase)
- [ ] Status reflects current state (In progress / Phase complete)
- [ ] Last activity shows today's date and the plan just completed
- [ ] Progress bar calculated correctly from total completed plans
      </step>

<step name="extract_decisions_and_issues">
Extract decisions, issues, and concerns from Summary concept into project state concept's accumulated context.

**Query summary concept:**

```
megamemory:understand({query: "phase {phase} plan {plan} summary"})
```

Parse summary concept summary JSON.

**Decisions Made:**

- Extract from summary JSON: `decisions` array
- If content exists (not empty):
  - Query current state concept
  - Add each decision to state's `decisions` array
  - Update state via megamemory:update_concept

**Blockers/Concerns:**

- Extract from summary JSON: `next_phase_readiness` field
- If contains blockers or concerns:
  - Add to state's `blockers` array
  - Update state via megamemory:update_concept
    </step>

<step name="update_session_continuity">
Update project state concept's session continuity to enable resumption in future sessions.

```javascript
// Query current state
const stateResponse = await megamemory:understand({query: "project state"});
const stateConcept = stateResponse.concepts.find(c => c.name === "Project State");
const stateData = JSON.parse(stateConcept.summary);

// Update session continuity fields
megamemory:update_concept({
  id: stateConcept.id,
  changes: {
    summary: JSON.stringify({
      ...stateData,
      last_session: new Date().toISOString(),
      stopped_at: "Completed {phase}-{plan}-Plan",
      resume_file: "None" // MegaMemory always tracks state, no resume file needed
    })
  }
})
```

**Size constraint note:** Keep state concept summary JSON under 150 lines when rendered.
</step>

<step name="issues_review_gate">
Before proceeding, query Summary concept content.

```
megamemory:understand({query: "phase {phase} plan {plan} summary"})
```

Parse summary JSON for `issues_encountered` field.

If "issues_encountered" is NOT "None":

<if mode="yolo">
```
[AUTO] Auto-approved: Issues acknowledgment
[WARN] Note: Issues were encountered during execution:
- [Issue 1]
- [Issue 2]
(Logged - continuing in yolo mode)
```

Continue without waiting.
</if>

<if mode="interactive" OR="custom with gates.issues_review true">
Present issues and wait for acknowledgment before proceeding.
</if>
</step>

<step name="update_roadmap">
Update the roadmap concept:

```
megamemory:understand({query: "roadmap"})
```

Parse roadmap concept summary JSON, then update:

```javascript
megamemory:update_concept({
  id: "roadmap-concept-id",
  changes: {
    summary: JSON.stringify({
      // ... keep existing roadmap structure
      phases: [
        // ... update phase completion status
        {
          number: "{phase}",
          name: "{phase name}",
          status: "In progress", // or "Complete"
          plans_complete: "{N} of {total}"
        }
        // ...
      ]
    })
  }
})
```

**If more plans remain in this phase:**

- Update plan count: "2/3 plans complete"
- Keep phase status as "In progress"

**If this was the last plan in the phase:**

- Mark phase complete: status → "Complete"
- Add completion date
</step>

<step name="git_commit_plan">
**Commit staged files if `git.commit_strategy` is `per-plan`.**

All planning state is in MegaMemory — no metadata commits needed.

**If `per-plan`:** All tasks staged their files without committing. Now commit everything:

```bash
git commit -m "{type}({phase}-{plan}): {plan objective summary}

- {task 1}: {one-line summary}
- {task 2}: {one-line summary}
"
```

**If `per-task`:** All tasks already committed individually. Nothing to do here.

**If `per-phase`:** Do NOT commit. Files stay staged for the execute-phase orchestrator.

**Commit message rules:** Max 2-4 bullets. Never list implementation details. See `git-integration.md` commit_message_rules.
</step>

<step name="update_codebase_map">
**If codebase mapping concepts exist in MegaMemory:**

```
megamemory:understand({query: "codebase map"})
```

Check what changed across all task commits in this plan:

```bash
# Find first task commit (right after previous plan's docs commit)
FIRST_TASK=$(git log --oneline --grep="feat({phase}-{plan}):" --grep="fix({phase}-{plan}):" --grep="test({phase}-{plan}):" --reverse | head -1 | cut -d' ' -f1)

# Get all changes from first task through now
git diff --name-only ${FIRST_TASK}^..HEAD 2>/dev/null
```

**Update only if structural changes occurred:**

| Change Detected | Update Action |
|-----------------|---------------|
| New directory in src/ | STRUCTURE concept: Add to directory layout |
| package.json deps changed | STACK concept: Add/remove from dependencies list |
| New file pattern (e.g., first .test.ts) | CONVENTIONS concept: Note new pattern |
| New external API client | INTEGRATIONS concept: Add service entry with file path |
| Config file added/changed | STACK concept: Update configuration section |
| File renamed/moved | Update paths in relevant concepts |

**Skip update if only:**
- Code changes within existing files
- Bug fixes
- Content changes (no structural impact)

**Update format:**

Query the specific mapping concept (STRUCTURE, STACK, etc.) and update via megamemory:update_concept.

Make single targeted edits - add a bullet point, update a path, or remove a stale entry. Don't rewrite sections.

**If no codebase mapping concepts exist:**
Skip this step.
</step>

<step name="offer_next">
**MANDATORY: Verify remaining work before presenting next steps.**

Do NOT skip this verification. Do NOT assume phase or milestone completion without checking.

**Step 0: Check for USER-SETUP concept**

If `USER_SETUP_CREATED=true` (from generate_user_setup step), always include this warning block at the TOP of completion output:

```
[WARN] USER SETUP REQUIRED

This phase introduced external services requiring manual configuration:

[TODO] USER-SETUP concept: {phase}-USER-SETUP

Query: megamemory:understand({query: "phase {phase} user setup"})

Quick view:
- [ ] {ENV_VAR_1}
- [ ] {ENV_VAR_2}
- [ ] {Dashboard config task}

Complete this setup for the integration to function.
```

This warning appears BEFORE "Plan complete" messaging. User sees setup requirements prominently.

**Step 1: Count plans and summaries in current phase**

Query MegaMemory for phase concepts:

```
megamemory:understand({query: "phase {phase} plans"})
```

Count plan concepts vs summary concepts:
- Filter concepts by kind="feature" and name pattern "{phase}-*-Plan" → plan count
- Filter concepts by kind="feature" and name pattern "{phase}-*-Summary" → summary count

State the counts: "This phase has [X] plan concepts and [Y] summary concepts."

**Step 2: Route based on plan completion**

Compare the counts from Step 1:

| Condition | Meaning | Action |
|-----------|---------|--------|
| summaries < plans | More plans remain | Go to **Route A** |
| summaries = plans | Phase complete | Go to Step 3 |

---

**Route A: More plans remain in this phase**

Identify the next unexecuted plan:
- Find the first Plan concept that has no matching Summary concept
- Query plan concept: megamemory:understand({query: "phase {phase} plan {next_plan}"})

<if mode="yolo">
```
Plan {phase}-{plan} complete.
Summary concept: {phase}-{plan}-Summary

{Y} of {X} plan concepts complete for Phase {Z}.

[AUTO] Auto-continuing: Execute next plan ({phase}-{next_plan})
```

Loop back to identify_plan step automatically.
</if>

<if mode="interactive" OR="custom with gates.execute_next_plan true">
```
Plan {phase}-{plan} complete.
Summary concept: {phase}-{plan}-Summary

{Y} of {X} plan concepts complete for Phase {Z}.

---

## > Next Up

**{phase}-{next_plan}: [Plan Name]** — [objective from plan concept]

`/fuska-execute-phase {phase}`

*`/new` first → fresh context window*

---

**Also available:**
- `/fuska-verify-work {phase}-{plan}` — manual acceptance testing before continuing
- Review what was built before continuing

---
```

Wait for user to clear and run next command.
</if>

**STOP here if Route A applies. Do not continue to Step 3.**

---

**Step 3: Check milestone status (only when all plans in phase are complete)**

Query roadmap concept:

```
megamemory:understand({query: "roadmap"})
```

Parse roadmap summary JSON and extract:
1. Current phase number (from the plan just completed)
2. All phase numbers listed in the current milestone section

Count total phases in the current milestone and identify the highest phase number.

State: "Current phase is {X}. Milestone has {N} phases (highest: {Y})."

**Step 4: Route based on milestone status**

| Condition | Meaning | Action |
|-----------|---------|--------|
| current phase < highest phase | More phases remain | Go to **Route B** |
| current phase = highest phase | Milestone complete | Go to **Route C** |

---

**Route B: Phase complete, more phases remain in milestone**

Query roadmap concept to get the next phase's name and goal.

```
Plan {phase}-{plan} complete.
Summary concept: {phase}-{plan}-Summary

## [OK] Phase {Z}: {Phase Name} Complete

All {Y} plans finished.

---

## > Next Up

**Phase {Z+1}: {Next Phase Name}** — {Goal from roadmap}

`/fuska-plan-phase {Z+1}`

*`/new` first → fresh context window*

---

**Also available:**
- `/fuska-verify-work {Z}` — manual acceptance testing before continuing
- `/fuska-discuss-phase {Z+1}` — gather context first
- Review phase accomplishments before continuing

---
```

---

**Route C: Milestone complete (all phases done)**

```
[DONE] MILESTONE COMPLETE!

Plan {phase}-{plan} complete.
Summary concept: {phase}-{plan}-Summary

## [OK] Phase {Z}: {Phase Name} Complete

All {Y} plans finished.

╔═══════════════════════════════════════════════════════╗
║  All {N} phases complete! Milestone is 100% done.     ║
╚═══════════════════════════════════════════════════════╝

---

## > Next Up

**Complete Milestone** — archive and prepare for next

`/fuska-complete-milestone`

*`/new` first → fresh context window*

---

**Also available:**
- `/fuska-verify-work` — manual acceptance testing before completing milestone
- `/fuska-add-phase <description>` — add another phase before completing
- Review accomplishments before archiving

---
```

</step>

</process>

<success_criteria>

- All tasks from plan concept completed
- All verifications pass
- USER-SETUP concept generated if user_setup in plan frontmatter
- Summary concept created with substantive content in MegaMemory
- Project state concept updated (position, decisions, issues, session)
- Roadmap concept updated
- If codebase map concepts exist: map updated with execution changes (or skipped if no significant changes)
- If USER-SETUP concept created: prominently surfaced in completion output
  </success_criteria>
