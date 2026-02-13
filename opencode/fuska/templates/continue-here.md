# Continue-Here Template (MegaMemory-Backed)

Template for phase session resumption - stored in MegaMemory, never on disk.

---

## Original Template Structure

```yaml
---
phase: XX-name
task: 3
total_tasks: 7
status: in_progress
last_updated: 2025-01-15T14:30:00Z
---
```

```markdown
<current_state>
[Where exactly are we? What's the immediate context?]
</current_state>

<completed_work>
[What got done this session - be specific]

- Task 1: [name] - Done
- Task 2: [name] - Done
- Task 3: [name] - In progress, [what's done on it]
</completed_work>

<remaining_work>
[What's left in this phase]

- Task 3: [name] - [what's left to do]
- Task 4: [name] - Not started
- Task 5: [name] - Not started
</remaining_work>

<decisions_made>
[Key decisions and why - so next session doesn't re-debate]

- Decided to use [X] because [reason]
- Chose [approach] over [alternative] because [reason]
</decisions_made>

<blockers>
[Anything stuck or waiting on external factors]

- [Blocker 1]: [status/workaround]
</blockers>

<context>
[Mental state, "vibe", anything that helps resume smoothly]

[What were you thinking about? What was the plan?
This is the "pick up exactly where you left off" context.]
</context>

<next_action>
[The very first thing to do when resuming]

Start with: [specific action]
</next_action>
```

<yaml_fields>
Required YAML frontmatter:

- `phase`: Directory name (e.g., `02-authentication`)
- `task`: Current task number
- `total_tasks`: How many tasks in phase
- `status`: `in_progress`, `blocked`, `almost_done`
- `last_updated`: ISO timestamp
</yaml_fields>

<guidelines>
- Be specific enough that a fresh OpenCode instance understands immediately
- Include WHY decisions were made, not just what
- The `<next_action>` should be actionable without reading anything else
- This session gets DELETED from MegaMemory after resume - not permanent storage
</guidelines>

---

## MegaMemory Schema

```typescript
<megamemory_schema>
concept_kind: "phase-session"

summary: |
  Current work session state for phase {phase_number}: {phase_name}.
  Task {current_task}/{total_tasks}, status {status}.
  Last updated: {last_updated}.

why: |
  Stores ephemeral session state for resuming work mid-phase.
  Allows seamless context handoff across /new boundaries.

file_refs: []

edges: [
  {
    to: "phase-{phase_number}",
    relation: "connects_to",
    description: "Session belongs to this phase"
  }
]
</megamemory_schema>
```

---

## MegaMemory Operations

```markdown
<megamemory_operations>
**Create Session (when starting work):**

1. Create concept with current state
2. Link to parent phase concept
3. Return concept ID for updates

**Update Session (progress updates):**

1. Update summary with new task progress
2. Append to decisions_made (if new decisions)
3. Update next_action based on current context
4. Update last_updated timestamp

**Delete Session (after resume):**

1. Remove concept (soft-delete with reason "session resumed")
2. No permanent record - this is ephemeral
</megamemory_operations>
```

---

## MegaMemory Examples

```typescript
<megamemory_examples>
```typescript
// Create a new phase session
const createSession = async (phaseNumber: string, phaseName: string) => {
  const result = await megamemory.create_concept({
    name: `Phase ${phaseNumber} Session`,
    kind: "phase-session",
    summary: `Current work session for Phase ${phaseNumber}: ${phaseName}. ` +
             `Task 1/7, status in_progress. Last updated: ${new Date().toISOString()}.`,
    why: "Stores ephemeral session state for resuming work mid-phase. " +
          "Allows seamless context handoff across /new boundaries.",
    file_refs: [],
    edges: [{
      to: `phase-${phaseNumber}`,
      relation: "connects_to",
      description: "Session belongs to this phase"
    }],
    created_by_task: "Starting work on Phase ${phaseNumber}"
  });
  const concept = JSON.parse(result.concepts[0]);

  return concept.id;
};

// Update session progress
const updateSessionProgress = async (sessionId: string, updates: {
  currentTask: number;
  totalTasks: number;
  completedWork: string[];
  remainingWork: string[];
  decisions?: string[];
  blockers?: string[];
  context: string;
  nextAction: string;
}) => {
  await megamemory.update_concept({
    id: sessionId,
    changes: {
      summary: `Current work session for Phase. ` +
               `Task ${updates.currentTask}/${updates.totalTasks}, status in_progress. ` +
               `Last updated: ${new Date().toISOString()}.`
    }
  });
};

// Resume from session (query and read)
const resumeSession = async (phaseNumber: string) => {
  const result = await megamemory.understand({
    query: `Phase ${phaseNumber} current session state, progress, decisions, next action`
  });

  if (result.concepts.length > 0) {
    const session = JSON.parse(result.concepts[0]);
    // Parse summary for task progress
    // Read decisions, blockers, context, next_action from summary
    // Start from next_action
    return session;
  }

  return null; // No active session
};

// Delete session after resume
const deleteSession = async (sessionId: string) => {
  await megamemory.remove_concept({
    id: sessionId,
    reason: "Session resumed - ephemeral state no longer needed"
  });
};
```
</megamemory_examples>
```

---

## Usage Pattern for Agents

```markdown
**When starting work on a phase:**

1. Check for existing session via `megamemory_understand`
2. If exists → resume from `next_action`
3. If not exists → create new session with current state

**During work session:**

1. Update session after each task completes
2. Capture new decisions as they're made
3. Update `next_action` before checkpoints
4. Update `last_updated` on every change

**After /new (new OpenCode instance):**

1. Query for phase session: `megamemory_understand("Phase {X} current session")`
2. Read `next_action`, `decisions_made`, `context`
3. Resume from `next_action` without re-reading files

**After completing session (work done or checkpoint passed):**

1. Delete session: `megamemory_remove_concept(reason="session resumed")`
2. No permanent record - this is ephemeral state only
```
