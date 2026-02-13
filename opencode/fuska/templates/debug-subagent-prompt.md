# Debug Subagent Prompt Template (MegaMemory-Backed)

Template for spawning fuska-debugger agent. Debug session data stored in MegaMemory.

---

## Original Template Structure

```markdown
<objective>
Investigate issue: {issue_id}

**Summary:** {issue_summary}
</objective>

<symptoms>
expected: {expected}
actual: {actual}
errors: {errors}
reproduction: {reproduction}
timeline: {timeline}
</symptoms>

<mode>
symptoms_prefilled: {true_or_false}
goal: {find_root_cause_only | find_and_fix}
</mode>

<debug_file>
Create: MegaMemory concept `Debug: {slug}`
</debug_file>
```

## Placeholders

| Placeholder | Source | Example |
|-------------|--------|---------|
| `{issue_id}` | Orchestrator-assigned | `auth-screen-dark` |
| `{issue_summary}` | User description | `Auth screen is too dark` |
| `{expected}` | From symptoms | `See logo clearly` |
| `{actual}` | From symptoms | `Screen is dark` |
| `{errors}` | From symptoms | `None in console` |
| `{reproduction}` | From symptoms | `Open /auth page` |
| `{timeline}` | From symptoms | `After recent deploy` |
| `{goal}` | Orchestrator sets | `find_and_fix` |
| `{slug}` | Generated | `auth-screen-dark` |

## Continuation Template

For checkpoints, spawn fresh agent with:

```markdown
<objective>
Continue debugging {slug}. Evidence is in the debug session.
</objective>

<prior_state>
Debug session: {concept_id} in MegaMemory
</prior_state>

<checkpoint_response>
**Type:** {checkpoint_type}
**Response:** {user_response}
</checkpoint_response>

<mode>
goal: {goal}
</mode>
```

---

## MegaMemory Schema

```typescript
<megamemory_schema>
concept_kind: "debug-session"

summary: |
  Debug session for issue {slug}: {issue_summary}.
  Status: {gathering | investigating | fixing | verifying | resolved}.
  Goal: {find_root_cause_only | find_and_fix}.
  Created: {created_date}.

why: |
  Tracks debugging progress across /new boundaries.
  Preserves eliminated hypotheses and evidence to prevent re-investigation.

file_refs: [
  "{affected_file_paths}"
]

edges: [
  {
    to: "project-debug",
    relation: "connects_to",
    description: "Part of project debugging history"
  }
]
</megamemory_schema>
```

---

## MegaMemory Operations

```markdown
<megamemory_operations>
**Create Session (when /fuska-debug called):**

1. Create concept with issue_id and symptoms
2. Set status to "gathering"
3. Return concept ID for updates

**Update Symptoms (during gathering):**

1. Update summary with gathered symptoms
2. Update status to "investigating" when complete
3. Keep symptoms immutable in summary structure

**Update Progress (during investigation):**

1. Update summary with current hypothesis, test, next_action
2. Append eliminated hypotheses to summary
3. Append evidence findings to summary
4. Update timestamp

**Update Resolution (when root cause found):**

1. Update summary with root_cause, fix, verification
2. Update status to "resolved"
3. Move to resolved (soft-delete with reason "resolved")

**Resume from Session (after /new):**

1. Query debug session by slug or issue_id
2. Read status, current_focus, eliminated, evidence
3. Continue from next_action without re-investigating dead ends
</megamemory_operations>
```

---

## MegaMemory Examples

```typescript
<megamemory_examples>
```typescript
// Create a new debug session
const createDebugSession = async (slug: string, issueSummary: string, goal: 'find_root_cause_only' | 'find_and_fix') => {
  const result = await megamemory.create_concept({
    name: `Debug: ${slug}`,
    kind: "debug-session",
    summary: `Debug session for issue ${slug}: ${issueSummary}. ` +
             `Status: gathering. Goal: ${goal}. ` +
             `Created: ${new Date().toISOString()}.`,
    why: "Tracks debugging progress across /new boundaries. " +
          "Preserves eliminated hypotheses and evidence to prevent re-investigation.",
    file_refs: [],
    edges: [{
      to: "project-debug",
      relation: "connects_to",
      description: "Part of project debugging history"
    }],
    created_by_task: "/fuska-debug command"
  });
  const concept = JSON.parse(result.concepts[0]);

  return concept.id;
};

// Update session with symptoms (gathering phase)
const updateSymptoms = async (sessionId: string, symptoms: {
  expected: string;
  actual: string;
  errors: string;
  reproduction: string;
  timeline: string;
}) => {
  await megamemory.update_concept({
    id: sessionId,
    changes: {
      summary: (currentSummary) => {
        // Append symptoms to summary in structured format
        return `${currentSummary}\n\nSYMPTOMS:\n` +
               `Expected: ${symptoms.expected}\n` +
               `Actual: ${symptoms.actual}\n` +
               `Errors: ${symptoms.errors}\n` +
               `Reproduction: ${symptoms.reproduction}\n` +
               `Timeline: ${symptoms.timeline}\n` +
               `Status: investigating`;
      }
    }
  });
};

// Add evidence during investigation
const addEvidence = async (sessionId: string, evidence: {
  checked: string;
  found: string;
  implication: string;
}) => {
  await megamemory.update_concept({
    id: sessionId,
    changes: {
      summary: (currentSummary) => {
        const timestamp = new Date().toISOString();
        return `${currentSummary}\n\nEVIDENCE [${timestamp}]:\n` +
               `Checked: ${evidence.checked}\n` +
               `Found: ${evidence.found}\n` +
               `Implication: ${evidence.implication}`;
      }
    }
  });
};

// Eliminate a hypothesis
const eliminateHypothesis = async (sessionId: string, hypothesis: {
  theory: string;
  evidence: string;
}) => {
  await megamemory.update_concept({
    id: sessionId,
    changes: {
      summary: (currentSummary) => {
        const timestamp = new Date().toISOString();
        return `${currentSummary}\n\nELIMINATED [${timestamp}]:\n` +
               `Hypothesis: ${hypothesis.theory}\n` +
               `Evidence: ${hypothesis.evidence}`;
      }
    }
  });
};

// Update current focus (what we're testing now)
const updateCurrentFocus = async (sessionId: string, focus: {
  hypothesis: string;
  test: string;
  expecting: string;
  nextAction: string;
}) => {
  await megamemory.update_concept({
    id: sessionId,
    changes: {
      summary: (currentSummary) => {
        // Replace current focus section (last section in summary)
        const focusSection = `\n\nCURRENT FOCUS:\n` +
                             `Hypothesis: ${focus.hypothesis}\n` +
                             `Test: ${focus.test}\n` +
                             `Expecting: ${focus.expecting}\n` +
                             `Next action: ${focus.nextAction}`;

        // Remove old focus section if exists, then add new
        const withoutOldFocus = currentSummary.replace(/\n\nCURRENT FOCUS:.*/, '');
        return `${withoutOldFocus}${focusSection}`;
      }
    }
  });
};

// Resume from debug session
const resumeDebugSession = async (slug: string) => {
  const result = await megamemory.understand({
    query: `Debug session for ${slug}, current status, hypothesis, evidence`
  });

  if (result.concepts.length > 0) {
    const session = JSON.parse(result.concepts[0]);
    const summary = session.summary;

    // Parse summary for state
    const statusMatch = summary.match(/Status: (\w+)/);
    const status = statusMatch ? statusMatch[1] : 'unknown';

    // Extract eliminated hypotheses
    const eliminated: { theory: string; evidence: string }[] = [];
    const eliminatedMatches = summary.matchAll(/ELIMINATED \[[^\]]+\]:\nHypothesis: ([^\n]+)\nEvidence: ([^\n]+)/g);
    for (const match of eliminatedMatches) {
      eliminated.push({ theory: match[1], evidence: match[2] });
    }

    // Extract current focus
    const focusMatch = summary.match(/CURRENT FOCUS:\nHypothesis: ([^\n]+)\nTest: ([^\n]+)\nExpecting: ([^\n]+)\nNext action: ([^\n]+)/);
    const currentFocus = focusMatch ? {
      hypothesis: focusMatch[1],
      test: focusMatch[2],
      expecting: focusMatch[3],
      nextAction: focusMatch[4]
    } : null;

    return { id: session.id, status, eliminated, currentFocus };
  }

  return null;
};

// Mark session as resolved
const resolveDebugSession = async (sessionId: string, resolution: {
  rootCause: string;
  fix: string;
  verification: string;
}) => {
  await megamemory.update_concept({
    id: sessionId,
    changes: {
      summary: (currentSummary) => {
        return `${currentSummary}\n\nRESOLUTION:\n` +
               `Root cause: ${resolution.rootCause}\n` +
               `Fix: ${resolution.fix}\n` +
               `Verification: ${resolution.verification}\n` +
               `Status: resolved`;
      }
    }
  });

  // Soft-delete after recording resolution
  await megamemory.remove_concept({
    id: sessionId,
    reason: "Resolved - archived to debug history"
  });
};
```
</megamemory_examples>
```

---

## Usage Pattern for Agents

```markdown
**When /fuska-debug is called:**

1. Create debug session concept with issue details
2. Set status to "gathering"
3. Return concept ID for subagent

**Subagent receives prompt with session ID:**

1. Read session via `megamemory_understand`
2. If status = "gathering" → collect symptoms and update
3. If status = "investigating" → read eliminated, evidence, current_focus
4. Continue from next_action without retrying eliminated hypotheses

**During investigation:**

1. Update current_focus with each hypothesis test
2. Append evidence findings (never remove)
3. Append eliminated hypotheses (never remove)
4. This prevents re-investigating dead ends after /new

**After /new (new OpenCode instance):**

1. Query debug session by issue_id or slug
2. Read status, eliminated, evidence, current_focus
3. Skip all eliminated hypotheses (they're in the summary)
4. Continue from next_action

**When resolved:**

1. Update session with resolution details
2. Mark status as "resolved"
3. Soft-delete with reason "resolved"
```
