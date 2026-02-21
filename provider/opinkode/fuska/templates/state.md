# State Template (MegaMemory-Backed)

Template for MegaMemory-based project state tracking. **For @-reference only by agents — data stored in MegaMemory, never on disk.**

---

<megamemory_schema>

## Concept Structure

```typescript
interface StateConcept {
  name: string;
  kind: "config" | "component";
  summary: string;
  parent_id?: string;
  edges?: ConceptEdge[];
  file_refs?: string[];
}
```

## Root State Concept

```
name: "[Project Name] State"
kind: "config"
summary: "Project state tracking: Chapter [X] of [Y] ([Chapter name]), Plan [A] of [B], Status: [status]. Last activity: [YYYY-MM-DD] — [What happened]. Progress: [X]%"
```

## Child Concepts

### Current Position
```
name: "Current Position"
kind: "config"
summary: "Chapter: [X] of [Y] ([Chapter name])\nPlan: [A] of [B] in current chapter\nStatus: [Ready to plan / Planning / Ready to execute / In progress / Chapter complete]\nProgress: [░░░░░░░░░░] 0%"
parent_id: "[Project Name] State"
```

### Recent Decisions
```
name: "Recent Decisions"
kind: "config"
summary: "[Chapter X]: [Decision summary]\n[Chapter Y]: [Decision summary]"
parent_id: "[Project Name] State"
edges: [{to: "[Project Name]", relation: "configured_by", description: "Decisions affect project scope"}]
```

### Pending Todos
```
name: "Pending Todos"
kind: "config"
summary: "[Count] pending todos — see captured ideas during sessions"
parent_id: "[Project Name] State"
```

### Blockers
```
name: "Blockers/Concerns"
kind: "config"
summary: "[Chapter X]: [Issue that affects future work]\n[Chapter Y]: [Issue that affects future work]"
parent_id: "[Project Name] State"
```

### Session Continuity
```
name: "Session Continuity"
kind: "component"
summary: "Last session: [YYYY-MM-DD HH:MM]\nStopped at: [Description of last completed action]\nResume file: [Path to .continue-here*.md or None]"
parent_id: "[Project Name] State"
```

</megamemory_schema>

---

<megamemory_operations>

## Initialize State

```typescript
const state = await megamemory.create_concept({
  name: "CommunityApp State",
  kind: "config",
  summary: "Project state tracking: Chapter 1 of 4 (Authentication), Plan 0 of 3, Status: Ready to plan. Last activity: 2025-01-20 — State initialized. Progress: ░░░░░░░░░░ 0%"
});

await megamemory.create_concept({
  name: "Current Position",
  kind: "config",
  summary: "Chapter: 1 of 4 (Authentication)\nPlan: 0 of 3 in current chapter\nTask: 0 of 0 (none in progress)\nStatus: Ready to plan\nProgress: ░░░░░░░░░░ 0%",
  parent_id: state.id
});

await megamemory.create_concept({
  name: "Recent Decisions",
  kind: "config",
  summary: "None yet",
  parent_id: state.id
});

await megamemory.create_concept({
  name: "Pending Todos",
  kind: "config",
  summary: "0 pending todos",
  parent_id: state.id
});

await megamemory.create_concept({
  name: "Blockers/Concerns",
  kind: "config",
  summary: "None yet",
  parent_id: state.id
});

await megamemory.create_concept({
  name: "Session Continuity",
  kind: "component",
  summary: "Last session: None\nStopped at: Initial state created\nResume file: None",
  parent_id: state.id
});
```

## Update During Execution

After each task completes, update the state with task position:

```typescript
// Update with task position during execution
await megamemory.update_concept({
  id: "Current Position",
  changes: {
    summary: `Chapter: ${chapterNum} of 4
Plan: ${planNum} of ${totalPlansInChapter} in current chapter
Task: ${taskNum} of ${totalTasks} (in progress)
Status: In progress
Progress: [${progressBars}] ${progress}%`
  }
});
```

## Update After Plan Completion

```typescript
// Update current position
await megamemory.update_concept({
  id: "Current Position",
  changes: {
    summary: "Chapter: 1 of 4 (Authentication)\nPlan: 1 of 3 in current chapter\nTask: 7 of 7 (complete)\nStatus: Ready to plan\nProgress: ██░░░░░░░░ 20%"
  }
});

// Note decision
await megamemory.update_concept({
  id: "Recent Decisions",
  changes: {
    summary: "Chapter 1: Use React Hook Form for form validation — Simplifies validation logic\nChapter 1: Client-side password complexity check — Prevents weak passwords before submission"
  }
});
```

## Update After Chapter Completion

```typescript
// Update current position for next chapter
await megamemory.update_concept({
  id: "Current Position",
  changes: {
    summary: "Chapter: 2 of 4 (Profiles)\nPlan: 0 of 2 in current chapter\nStatus: Ready to plan\nProgress: ███░░░░░░░ 30%"
  }
});

// Clear blockers from completed chapter
await megamemory.update_concept({
  id: "Blockers/Concerns",
  changes: {
    summary: "None yet"
  }
});
```

## Add Blocker

```typescript
await megamemory.update_concept({
  id: "Blockers/Concerns",
  changes: {
    summary: "Chapter 2: Image upload size limit undefined — Need to clarify max file size for avatars\nChapter 3: Database schema for posts not designed — May need migration strategy"
  }
});
```

## Update Session Continuity

```typescript
await megamemory.update_concept({
  id: "Session Continuity",
  changes: {
    summary: "Last session: 2025-01-20 14:30\nStopped at: Completed plan 01-01, ready to start execution\nResume concept: chapter-plan:01-01"
  }
});
```

## Query Current State

```typescript
// Get full state
const state = await megamemory.understand({
  query: "CommunityApp State current position progress"
});

// Get blockers only
const blockers = await megamemory.understand({
  query: "Blockers concerns issues"
});

// Get session continuity
const session = await megamemory.understand({
  query: "Session continuity resume"
});

// Get performance metrics
const metrics = await megamemory.understand({
  query: "Performance metrics velocity"
});
```

</megamemory_operations>

---

<megamemory_examples>

## Initial State Creation

```typescript
async function initializeInitiativeState(initiativeName: string, totalChapters: number) {
  const state = await megamemory.create_concept({
    name: `${initiativeName} State`,
    kind: "config",
    summary: `Initiative state tracking: Chapter 1 of ${totalChapters}, Plan 0 of TBD, Status: Ready to plan. Progress: ░░░░░░░░░░ 0%`
  });

  await megamemory.create_concept({
    name: "Current Position",
    kind: "config",
    summary: `Chapter: 1 of ${totalChapters}\nPlan: 0 of TBD in current chapter\nStatus: Ready to plan\nProgress: ░░░░░░░░░░ 0%`,
    parent_id: state.id
  });

  await megamemory.create_concept({
    name: "Recent Decisions",
    kind: "config",
    summary: "None yet",
    parent_id: state.id
  });

  await megamemory.create_concept({
    name: "Pending Todos",
    kind: "config",
    summary: "0 pending todos",
    parent_id: state.id
  });

  await megamemory.create_concept({
    name: "Blockers/Concerns",
    kind: "config",
    summary: "None yet",
    parent_id: state.id
  });

  await megamemory.create_concept({
    name: "Session Continuity",
    kind: "component",
    summary: "Last session: None\nStopped at: Initial state created\nResume file: None",
    parent_id: state.id
  });

  return state.id;
}

// Usage
const stateId = await initializeInitiativeState("CommunityApp", 4);
```

## State Query Helper

```typescript
interface InitiativeState {
  currentPosition: {
    chapter: number;
    totalChapters: number;
    plan: number;
    totalPlans: number;
    status: string;
    progress: number;
  };
  decisions: string[];
  todos: {
    count: number;
  };
  blockers: string[];
  session: {
    lastSession?: string;
    stoppedAt: string;
    resumeFile?: string;
  };
}

async function getInitiativeState(initiativeName: string): Promise<InitiativeState> {
  const stateConcepts = await megamemory.understand({
    query: `${initiativeName} State`
  });

  const state: ProjectState = {
    currentPosition: {
      chapter: 1,
      totalChapters: 1,
      plan: 0,
      totalPlans: 0,
      status: "Ready to plan",
      progress: 0
    },
    decisions: [],
    todos: { count: 0 },
    blockers: [],
    session: { stoppedAt: "" }
  };

  for (const concept of stateConcepts) {
    switch (concept.name) {
      case "Current Position":
        const lines = concept.summary.split('\n');
        const progressLine = lines.find(l => l.includes('Progress'));
        if (progressLine) {
          const match = progressLine.match(/Progress: \[█]+([░]+)?\] (\d+)%/);
          if (match) state.currentPosition.progress = parseInt(match[2]);
        }
        break;

      case "Recent Decisions":
        state.decisions = concept.summary.split('\n').filter(l => l && l !== "None yet");
        break;

      case "Pending Todos":
        const todoMatch = concept.summary.match(/(\d+) pending todos/);
        state.todos.count = todoMatch ? parseInt(todoMatch[1]) : 0;
        break;

      case "Blockers/Concerns":
        state.blockers = concept.summary.split('\n').filter(l => l && l !== "None yet");
        break;

      case "Session Continuity":
        const sessionLines = concept.summary.split('\n');
        state.session.lastSession = sessionLines.find(l => l.startsWith('Last session'))?.split(': ').slice(1).join(': ');
        state.session.stoppedAt = sessionLines.find(l => l.startsWith('Stopped at'))?.split(': ').slice(1).join(': ') || "";
        state.session.resumeFile = sessionLines.find(l => l.startsWith('Resume file'))?.split(': ').slice(1).join(': ');
        break;
    }
  }

  return state;
}

// Usage
const state = await getProjectState("CommunityApp");
console.log(`Progress: ${state.currentPosition.progress}%`);
console.log(`Blockers: ${state.blockers.join(', ')}`);
```

## Update State After Execution

```typescript
async function updateStateAfterPlan(
  projectName: string,
  chapterNum: number,
  planNum: number,
  totalPlansInChapter: number,
  totalPlansOverall: number,
  completedPlans: number,
  decisions: string[]
) {
  const progress = Math.round((completedPlans / totalPlansOverall) * 100);
  const progressBars = '█'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10));

  await megamemory.update_concept({
    id: "Current Position",
    changes: {
      summary: `Chapter: ${chapterNum} of 4\nPlan: ${planNum} of ${totalPlansInChapter} in current chapter\nTask: ${totalTasks} of ${totalTasks} (complete)\nStatus: Ready to plan\nProgress: [${progressBars}] ${progress}%`
    }
  });

  // Update decisions
  if (decisions.length > 0) {
    await megamemory.update_concept({
      id: "Recent Decisions",
      changes: {
        summary: decisions.map(d => `Chapter ${chapterNum}: ${d}`).join('\n')
      }
    });
  }
}

// Usage
await updateStateAfterPlan(
  "CommunityApp",
  1, 1, 3, 10,
  1,
  ["Use React Hook Form", "Client-side validation"]
);
```

</megamemory_examples>

---

<purpose>

STATE.md is the project's short-term memory spanning all chapters and sessions.

**Problem it solves:** Information is captured in summaries, issues, and decisions but not systematically consumed. Sessions start without context.

**Solution:** A single, small set of concepts that's:
- Read first in every workflow
- Updated after every significant action
- Contains digest of accumulated context
- Enables instant session restoration

</purpose>

<lifecycle>

**Creation:** After ROADMAP.md is created (during init)
- Query PROJECT.md for core value and current focus
- Initialize empty accumulated context sections
- Set position to "Chapter 1 ready to plan"

**Reading:** First step of every workflow
- progress: Present status to user
- plan: Inform planning decisions
- execute: Know current position
- transition: Know what's complete

**Writing:** After every significant action
- execute: After plan completion
  - Update position (chapter, plan, status)
  - Note new decisions
  - Add blockers/concerns
- transition: After chapter marked complete
  - Update progress bar
  - Clear resolved blockers
  - Refresh context

</lifecycle>

<sections>

### Current Position
Where we are right now:
- Chapter X of Y — which chapter
- Plan A of B — which plan within chapter
- Status — current state
- Progress bar — visual indicator of overall completion

Progress calculation: (completed plans) / (total plans across all chapters) × 100%

### Accumulated Context

**Recent Decisions:** Summary of recent decisions affecting current work. Full decision log lives in PROJECT.md.

**Pending Todos:** Ideas captured during sessions
- Count of pending todos
- Brief list if few, count if many (e.g., "5 pending todos")

**Blockers/Concerns:** From "Next Chapter Readiness" sections
- Issues that affect future work
- Prefix with originating chapter
- Cleared when addressed

### Session Continuity
Enables instant resumption:
- When was last session
- What was last completed
- Is there a resume file

</sections>

<size_constraint>

Keep STATE.md content concise in MegaMemory.

It's a DIGEST, not an archive. If accumulated context grows too large:
- Keep only 3-5 recent decisions (full log in PROJECT.md)
- Keep only active blockers, remove resolved ones

The goal is "read once, know where we are" — if it's too long, that fails.

</size_constraint>

<Guidelines>

**When created:**
- During project initialization (after ROADMAP.md)
- Query PROJECT.md (extract core value and current focus)
- Initialize empty sections

**When read:**
- Every workflow starts by reading STATE.md
- Then read PROJECT.md for full context
- Provides instant context restoration

**When updated:**
- After each plan execution (update position, note decisions, update issues/blockers)
- After chapter transitions (update progress bar, clear resolved blockers, refresh context)

**Size management:**
- Keep concise in MegaMemory
- Recent decisions only in STATE (full log in PROJECT.md)
- Keep only active blockers

**Concepts:**
- Current Position: Where we are now (chapter, plan, status)
- Recent Decisions: Decision summaries
- Pending Todos: Todo count
- Blockers/Concerns: Active issues
- Session Continuity: Resume information

</Guidelines>
