<trigger>
Use this workflow when:
- Starting a new session on an existing project
- User says "continue", "what's next", "where were we", "resume"
- Any planning operation when MM has project concepts
- User returns after time away from project
</trigger>

<purpose>
Instantly restore full project context from MegaMemory and present clear status.
Enables seamless session continuity for fully autonomous workflows.

"Where were we?" should have an immediate, complete answer from MM.
</purpose>

<required_reading>
@~/.config/opencode/get-shit-done/references/continuation-format.md
</required_reading>

<megamemory_guide>
**MegaMemory Strategy for Resume:**

**When to Query:**
- At start: `megamemory:list_roots` to get high-level project overview
- `megamemory:understand` with query about project state, current phase, session continuity
- Query for project concept, state concept, roadmap concept

**Concepts to Query:**
1. **Project concept:** Core value, current focus, requirements
2. **State concept:** Current position, progress, recent decisions, blockers, session continuity
3. **Roadmap concept:** Phases, current position, progress
4. **Phase concepts:** Current phase status
5. **Plan concepts:** Current plan status
6. **Todo concepts:** Pending ideas
7. **Decision concepts:** Recent decisions affecting current work

**Concept Structure for Parsing:**

**Project Concept:**
```json
{
  "what_this_is": "Current accurate description",
  "core_value": "Why this exists",
  "requirements": {
    "validated": ["req 1"],
    "active": ["req 2"],
    "out_of_scope": ["req 3"]
  },
  "key_decisions": [
    {"decision": "Decision 1", "outcome": "Result 1"},
    {"decision": "Decision 2", "outcome": "Result 2"}
  ],
  "constraints": ["constraint 1", "constraint 2"]
}
```

**State Concept:**
```json
{
  "project_reference": "Core value and current focus",
  "current_position": {
    "phase": "X",
    "total_phases": "Y",
    "plan": "A",
    "total_plans": "B",
    "status": "in_progress|ready|complete"
  },
  "progress": {
    "phase_progress": 66,
    "plan_progress": 33
  },
  "recent_decisions": ["decision 1", "decision 2"],
  "pending_todos": {
    "count": 5,
    "priority_items": ["todo 1", "todo 2"]
  },
  "blockers": ["blocker 1", "blocker 2"],
  "concerns": ["concern 1"],
  "session_continuity": {
    "last_session": "2024-01-01",
    "stopped_at": "Planning Phase 3",
    "resume_file": "none"
  }
}
```

**Roadmap Concept:**
```json
{
  "phases": [
    {"num": 1, "name": "Name 1", "status": "complete"},
    {"num": 2, "name": "Name 2", "status": "complete"},
    {"num": 3, "name": "Name 3", "status": "in_progress"},
    {"num": 4, "name": "Name 4", "status": "ready"}
  ]
}
```

**Phase Concept:**
```json
{
  "phase": "XX",
  "name": "Phase name",
  "goal": "Primary goal",
  "status": "planning|ready|in_progress|complete|blocked",
  "plans": [
    {"num": 1, "name": "Plan 1", "status": "complete"},
    {"num": 2, "name": "Plan 2", "status": "in_progress"}
  ],
  "context_available": true
}
```

**Parsing:**
Parse each `concept.summary` as JSON to extract structured data.
Combine data from multiple concepts for complete project state.

**When to Update:**
- At end of resume workflow: `megamemory:update_concept` on state concept to update session_continuity
- Track: last_session, stopped_at, action_taken
</megamemory_guide>

<process>

<step name="detect_existing_project">
Check if this is an existing project in MegaMemory:

```
megamemory:list_roots
```

**If project concepts exist:** Proceed to load_state
**If no project concepts exist:** This is a new project - route to /gsd-new-project
</step>

<step name="load_state">

Query MM for core project concepts:

```
megamemory:understand with query: "project state current position progress session"
```

Parse returned concepts. Look for:
- Project concept (kind: "feature" or similar top-level)
- State concept (kind: "feature" or "config")
- Roadmap concept (kind: "module")

**From Project concept summary (parse as JSON):**

- **What This Is**: Current accurate description
- **Requirements**: Validated, Active, Out of Scope
- **Key Decisions**: Full decision log with outcomes
- **Constraints**: Hard limits on implementation

**From State concept summary (parse as JSON):**

- **Project Reference**: Core value and current focus
- **Current Position**: Phase X of Y, Plan A of B, Status
- **Progress**: Visual progress bar
- **Recent Decisions**: Key decisions affecting current work
- **Pending Todos**: Ideas captured during sessions
- **Blockers/Concerns**: Issues carried forward
- **Session Continuity**: Where we left off, any resume files

**From Roadmap concept summary (parse as JSON):**

- Phases list with status
- Current phase position

</step>

<step name="check_incomplete_work">
Query MM for incomplete work that needs attention:

```
megamemory:understand with query: "incomplete work interrupted agent mid-plan checkpoint"
```

Look for:
- Phase concepts with status: "in_progress" or "blocked"
- Plan concepts without summary (incomplete execution)
- Agent concepts with status: "interrupted"
- Session continuity concepts with resume_file references

**If interrupted agent found:**
- Parse agent concept.summary for task details
- Flag: "Found interrupted agent"

**If phase in progress:**
- Parse phase concept.summary for current plan status
- Check if current plan has summary
- Flag: "Found incomplete plan execution"

</step>

<step name="present_status">
Present complete project status to user:

```
╔══════════════════════════════════════════════════════════════╗
║  PROJECT STATUS                                               ║
╠══════════════════════════════════════════════════════════════╣
║  Building: [one-liner from PROJECT concept.summary JSON]      ║
║                                                               ║
║  Phase: [X] of [Y] - [Phase name]                            ║
║  Plan:  [A] of [B] - [Status]                                ║
║  Progress: [██████░░░░] XX%                                  ║
║                                                               ║
║  Last activity: [date] - [what happened]                     ║
╚══════════════════════════════════════════════════════════════╝

[If incomplete work found:]
⚠️  Incomplete work detected:
    - [incomplete plan or blocked phase]

[If interrupted agent found:]
⚠️  Interrupted agent detected:
    Agent ID: [id]
    Task: [task description from agent concept.summary JSON]
    Interrupted: [timestamp]

    Resume with: Task tool (resume parameter with agent ID)

[If pending todos exist:]
📋 [N] pending todos — /gsd-check-todos to review

[If blockers exist:]
⚠️  Carried concerns:
    - [blocker 1]
    - [blocker 2]

[If alignment issues exist:]
⚠️  Brief alignment: [status] - [assessment]
```

</step>

<step name="determine_next_action">
Based on project state from MM concepts, determine the most logical next action:

**If interrupted agent exists:**
→ Primary: Resume interrupted agent (Task tool with resume parameter)
→ Option: Start fresh (abandon agent work)

**If phase blocked:**
→ Primary: Resolve blockers
→ Option: Continue with unblocked work

**If phase in progress, all plans complete:**
→ Primary: Transition to next phase
→ Option: Review completed work

**If phase ready to plan:**
→ Check phase concept.summary for context availability:

```json
"context_available": true|false
```

- If context_available is false:
  → Primary: Discuss phase vision (how user imagines it working)
  → Secondary: Plan directly (skip context gathering)
- If context_available is true:
  → Primary: Plan the phase
  → Option: Review roadmap

**If phase ready to execute:**
→ Primary: Execute next plan
→ Option: Review the plan first
</step>

<step name="offer_options">
Present contextual options based on project state from MM:

```
What would you like to do?

[Primary action based on state - e.g.:]
1. Resume interrupted agent [if interrupted agent found]
   OR
1. Execute phase (/gsd-execute-phase {phase})
   OR
1. Discuss Phase 3 context (/gsd-discuss-phase 3) [if context_available is false]
   OR
1. Plan Phase 3 (/gsd-plan-phase 3) [if context_available is true or discuss option declined]

[Secondary options:]
2. Review current phase status
3. Check pending todos ([N] pending)
4. Review brief alignment
5. Something else
```

Wait for user selection.
</step>

<step name="route_to_workflow">
Based on user selection, route to appropriate workflow:

- **Execute plan** → Show command for user to run after clearing:
  ```
  ---

  ## ▶ Next Up

  **{phase}-{plan}: [Plan Name]** — [objective from plan concept.summary JSON]

  `/gsd-execute-phase {phase}`

  *`/new` first → fresh context window*

  ---
  ```
- **Plan phase** → Show command for user to run after clearing:
  ```
  ---

  ## ▶ Next Up

  **Phase [N]: [Name]** — [Goal from roadmap concept.summary JSON]

  `/gsd-plan-phase [phase-number]`

  *`/new` first → fresh context window*

  ---

  **Also available:**
  - `/gsd-discuss-phase [N]` — gather context first
  - `/gsd-research-phase [N]` — investigate unknowns

  ---
  ```
- **Transition** → ./transition.md
- **Check todos** → Query MM todo concepts, present summary
- **Review alignment** → Query project concept, compare to current state
- **Something else** → Ask what they need
</step>

<step name="update_session">
Before proceeding to routed workflow, update session continuity in MM:

Query state concept and update:

```
megamemory:update_concept with:
- id: [state-concept-id]
- changes: {
  summary: JSON with updated session_continuity:
  {
    "last_session": "now",
    "stopped_at": "Session resumed, proceeding to [action]",
    "resume_file": "none"
  }
}
```

This ensures if session ends unexpectedly, next resume knows the state.
</step>

</process>

<reconstruction>
If project concepts are sparse or missing state concept:

"Project state concept missing. Reconstructing from other concepts..."

1. Query project concept → Extract "What This Is" and Core Value
2. Query roadmap concept → Determine phases, find current position
3. Query phase concepts → Extract decisions, concerns
4. Query todo concepts → Count pending todos
5. Query all concepts → Check for incomplete work markers

Create or update state concept:

```
megamemory:create_concept or megamemory:update_concept with:
- name: "Project state"
- kind: "config"
- summary: JSON with reconstructed state structure
- why: "State reconstructed from existing concepts"
- edges: [relationships to project, roadmap, etc.]
```

Then proceed normally.

This handles cases where:
- Project predates state concept introduction
- State concept was accidentally deleted
- Cloning repo without full MM state
</reconstruction>

<quick_resume>
For users who want minimal friction:

If user says just "continue" or "go":

- Query MM state silently
- Determine primary action
- Execute immediately without presenting options

"Continuing from [state]... [action]"

This enables fully autonomous "just keep going" workflow.
</quick_resume>

<success_criteria>
Resume is complete when:

- [ ] Project concepts queried from MM
- [ ] State concept loaded (or reconstructed)
- [ ] Concept.summary parsed as JSON for each concept
- [ ] Incomplete work detected and flagged
- [ ] Clear status presented to user
- [ ] Contextual next actions offered
- [ ] User knows exactly where project stands
- [ ] Session continuity updated in MM
      </success_criteria>
