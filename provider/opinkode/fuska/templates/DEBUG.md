# Debug Template (MegaMemory-Backed)

Template for active debug session tracking - stored in MegaMemory, never on disk.

---

## Original Template Structure

```markdown
---
status: gathering | investigating | fixing | verifying | resolved
trigger: "[verbatim user input]"
created: [ISO timestamp]
updated: [ISO timestamp]
---

## Current Focus
<!-- OVERWRITE on each update - always reflects NOW -->

hypothesis: [current theory being tested]
test: [how testing it]
expecting: [what result means if true/false]
next_action: [immediate next step]

## Symptoms
<!-- Written during gathering, then immutable -->

expected: [what should happen]
actual: [what actually happens]
errors: [error messages if any]
reproduction: [how to trigger]
started: [when it broke / always broken]

## Eliminated
<!-- APPEND only - prevents re-investigating after /new -->

- hypothesis: [theory that was wrong]
  evidence: [what disproved it]
  timestamp: [when eliminated]

## Evidence
<!-- APPEND only - facts discovered during investigation -->

- timestamp: [when found]
  checked: [what was examined]
  found: [what was observed]
  implication: [what this means]

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: [empty until found]
fix: [empty until applied]
verification: [empty until verified]
files_changed: []
```

---

## MegaMemory Schema

```typescript
<megamemory_schema>
concept_kind: "debug-session"

summary: |
  Debug session: {slug} - {trigger}
  Status: {status}
  Goal: {find_root_cause_only | find_and_fix}
  Current: hypothesis="{hypothesis}", test="{test}"

why: |
  Active debug session tracking across /new boundaries.
  Preserves eliminated hypotheses and evidence to prevent re-investigation.
  Allows seamless resume from any interruption point.

file_refs: [
  "{files_affected_by_issue}"
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
**Creation (when /fuska-debug called):**

1. Create concept with trigger from user input
2. Set status to "gathering"
3. Set next_action = "gather symptoms"
4. Symptoms section: empty, to be filled

**During symptom gathering:**

1. Update summary with symptoms (expected, actual, errors, reproduction, started)
2. Update next_action with each question
3. When complete: status → "investigating"

**During investigation:**

1. OVERWRITE current focus (hypothesis, test, expecting, next_action)
2. APPEND to evidence (timestamp, checked, found, implication)
3. APPEND to eliminated (hypothesis, evidence, timestamp) when disproved
4. Update timestamp in summary

**During fixing:**

1. status → "fixing"
2. Update resolution root_cause when confirmed
3. Update resolution fix when applied
4. Update files_changed list

**During verification:**

1. status → "verifying"
2. Update resolution verification with results
3. If verification fails: status → "investigating", try again

**On resolution:**

1. status → "resolved"
2. Update summary with final resolution
3. Soft-delete with reason "resolved"
</megamemory_operations>
```

---

## MegaMemory Examples

```typescript
<megamemory_examples>
```typescript
// Create a new debug session
const createDebugSession = async (slug: string, trigger: string, goal: 'find_root_cause_only' | 'find_and_fix') => {
  const now = new Date().toISOString();

  const concept = await megamemory_create_concept({
    name: `Debug: ${slug}`,
    kind: "debug-session",
    summary: `Debug session: ${slug} - ${trigger}\n` +
             `Status: gathering\n` +
             `Goal: ${goal}\n` +
             `Created: ${now}\n` +
             `Updated: ${now}\n\n` +
             `CURRENT FOCUS:\n` +
             `Next action: gather symptoms`,
    why: "Active debug session tracking across /new boundaries. " +
          "Preserves eliminated hypotheses and evidence to prevent re-investigation. " +
          "Allows seamless resume from any interruption point.",
    file_refs: [],
    edges: [{
      to: "project-debug",
      relation: "connects_to",
      description: "Part of project debugging history"
    }],
    created_by_task: "/fuska-debug command"
  });

  return concept.id;
};

// Update symptoms during gathering
const updateSymptoms = async (sessionId: string, symptoms: {
  expected: string;
  actual: string;
  errors: string;
  reproduction: string;
  started: string;
}) => {
  const now = new Date().toISOString();

  await megamemory_update_concept({
    id: sessionId,
    changes: {
      summary: (currentSummary) => {
        // Replace status from gathering to investigating
        const updated = currentSummary
          .replace(/Status: gathering/, 'Status: investigating')
          .replace(/Updated: [^\n]+/, `Updated: ${now}`);

        // Insert symptoms section before current focus
        const symptomsSection = `\n\nSYMPTOMS:\n` +
                               `Expected: ${symptoms.expected}\n` +
                               `Actual: ${symptoms.actual}\n` +
                               `Errors: ${symptoms.errors}\n` +
                               `Reproduction: ${symptoms.reproduction}\n` +
                               `Started: ${symptoms.started}`;

        return updated.replace(/CURRENT FOCUS:/, `${symptomsSection}\n\nCURRENT FOCUS:`);
      }
    }
  });
};

// Overwrite current focus with new hypothesis
const updateCurrentFocus = async (sessionId: string, focus: {
  hypothesis: string;
  test: string;
  expecting: string;
  nextAction: string;
}) => {
  const now = new Date().toISOString();

  await megamemory_update_concept({
    id: sessionId,
    changes: {
      summary: (currentSummary) => {
        const updated = currentSummary.replace(/Updated: [^\n]+/, `Updated: ${now}`);

        // Replace entire current focus section
        const focusSection = `CURRENT FOCUS:\n` +
                             `Hypothesis: ${focus.hypothesis}\n` +
                             `Test: ${focus.test}\n` +
                             `Expecting: ${focus.expecting}\n` +
                             `Next action: ${focus.nextAction}`;

        return updated.replace(/CURRENT FOCUS:[\s\S]*?(?=\n\n[A-Z]|$)/, focusSection);
      }
    }
  });
};

// Append evidence finding
const addEvidence = async (sessionId: string, evidence: {
  checked: string;
  found: string;
  implication: string;
}) => {
  const timestamp = new Date().toISOString();

  await megamemory_update_concept({
    id: sessionId,
    changes: {
      summary: (currentSummary) => {
        const entry = `\n\nEVIDENCE [${timestamp}]:\n` +
                     `Checked: ${evidence.checked}\n` +
                     `Found: ${evidence.found}\n` +
                     `Implication: ${evidence.implication}`;

        // Add after current focus, before resolution if exists
        const insertPoint = currentSummary.indexOf('\n\nRESOLUTION:');
        if (insertPoint !== -1) {
          return currentSummary.slice(0, insertPoint) + entry + currentSummary.slice(insertPoint);
        }
        return currentSummary + entry;
      }
    }
  });
};

// Append eliminated hypothesis
const eliminateHypothesis = async (sessionId: string, elimination: {
  hypothesis: string;
  evidence: string;
}) => {
  const timestamp = new Date().toISOString();

  await megamemory_update_concept({
    id: sessionId,
    changes: {
      summary: (currentSummary) => {
        const entry = `\n\nELIMINATED [${timestamp}]:\n` +
                     `Hypothesis: ${elimination.hypothesis}\n` +
                     `Evidence: ${elimination.evidence}`;

        // Add after evidence section
        const evidencePoint = currentSummary.lastIndexOf('\n\nEVIDENCE:');
        if (evidencePoint !== -1) {
          const nextSection = currentSummary.indexOf('\n\n', evidencePoint + 2);
          if (nextSection !== -1) {
            return currentSummary.slice(0, nextSection) + entry + currentSummary.slice(nextSection);
          }
        }
        return currentSummary + entry;
      }
    }
  });
};

// Update resolution during fixing
const updateResolution = async (sessionId: string, resolution: {
  rootCause: string;
  fix: string;
  filesChanged: string[];
}) => {
  const now = new Date().toISOString();

  await megamemory_update_concept({
    id: sessionId,
    changes: {
      summary: (currentSummary) => {
        const updated = currentSummary
          .replace(/Status: investigating/, 'Status: fixing')
          .replace(/Updated: [^\n]+/, `Updated: ${now}`);

        const resolutionSection = `\n\nRESOLUTION:\n` +
                                  `Root cause: ${resolution.rootCause}\n` +
                                  `Fix: ${resolution.fix}\n` +
                                  `Files changed: ${resolution.filesChanged.join(', ')}`;

        // Replace or add resolution section
        if (currentSummary.includes('RESOLUTION:')) {
          return updated.replace(/RESOLUTION:[\s\S]*$/, resolutionSection);
        }
        return updated + resolutionSection;
      }
    }
  });
};

// Update verification results
const updateVerification = async (sessionId: string, verification: string, success: boolean) => {
  const now = new Date().toISOString();

  await megamemory_update_concept({
    id: sessionId,
    changes: {
      summary: (currentSummary) => {
        const status = success ? 'verifying' : 'investigating';
        const updated = currentSummary
          .replace(/Status: (fixing|verifying)/, `Status: ${status}`)
          .replace(/Updated: [^\n]+/, `Updated: ${now}`);

        // Update verification line in resolution
        return updated.replace(/Verification: [^\n]*/, `Verification: ${verification}`);
      }
    }
  });
};

// Resume from debug session (parse structured data)
const resumeDebugSession = async (slug: string) => {
  const results = await megamemory_understand({
    query: `Debug session ${slug} with status, symptoms, eliminated, evidence, current focus`
  });

  if (results.length > 0) {
    const session = results[0];
    const summary = session.summary;

    // Parse sections
    const parseSection = (sectionName: string) => {
      const match = summary.match(new RegExp(`${sectionName}:([\\s\\S]*?)(?=\\n\\n[A-Z]|$)`));
      if (!match) return {};

      const content = match[1];
      const result: Record<string, string> = {};

      if (sectionName === 'SYMPTOMS') {
        result.expected = content.match(/Expected: ([^\n]+)/)?.[1] || '';
        result.actual = content.match(/Actual: ([^\n]+)/)?.[1] || '';
        result.errors = content.match(/Errors: ([^\n]+)/)?.[1] || '';
        result.reproduction = content.match(/Reproduction: ([^\n]+)/)?.[1] || '';
        result.started = content.match(/Started: ([^\n]+)/)?.[1] || '';
      } else if (sectionName === 'CURRENT FOCUS') {
        result.hypothesis = content.match(/Hypothesis: ([^\n]+)/)?.[1] || '';
        result.test = content.match(/Test: ([^\n]+)/)?.[1] || '';
        result.expecting = content.match(/Expecting: ([^\n]+)/)?.[1] || '';
        result.nextAction = content.match(/Next action: ([^\n]+)/)?.[1] || '';
      } else if (sectionName === 'RESOLUTION') {
        result.rootCause = content.match(/Root cause: ([^\n]+)/)?.[1] || '';
        result.fix = content.match(/Fix: ([^\n]+)/)?.[1] || '';
        result.verification = content.match(/Verification: ([^\n]+)/)?.[1] || '';
      }

      return result;
    };

    // Parse eliminated hypotheses
    const eliminated: Array<{ hypothesis: string; evidence: string; timestamp: string }> = [];
    const elimMatches = summary.matchAll(/ELIMINATED \[([^\]]+)\]:\nHypothesis: ([^\n]+)\nEvidence: ([^\n]+)/g);
    for (const match of elimMatches) {
      eliminated.push({
        timestamp: match[1],
        hypothesis: match[2],
        evidence: match[3]
      });
    }

    // Parse evidence entries
    const evidence: Array<{ timestamp: string; checked: string; found: string; implication: string }> = [];
    const evMatches = summary.matchAll(/EVIDENCE \[([^\]]+)\]:\nChecked: ([^\n]+)\nFound: ([^\n]+)\nImplication: ([^\n]+)/g);
    for (const match of evMatches) {
      evidence.push({
        timestamp: match[1],
        checked: match[2],
        found: match[3],
        implication: match[4]
      });
    }

    return {
      id: session.id,
      slug,
      status: summary.match(/Status: (\w+)/)?.[1] || 'unknown',
      symptoms: parseSection('SYMPTOMS'),
      currentFocus: parseSection('CURRENT FOCUS'),
      resolution: parseSection('RESOLUTION'),
      eliminated,
      evidence
    };
  }

  return null;
};

// Mark session as resolved
const resolveDebugSession = async (sessionId: string, finalVerification: string) => {
  const now = new Date().toISOString();

  await megamemory_update_concept({
    id: sessionId,
    changes: {
      summary: (currentSummary) => {
        return currentSummary
          .replace(/Status: (fixing|verifying)/, 'Status: resolved')
          .replace(/Updated: [^\n]+/, `Updated: ${now}`)
          .replace(/Verification: [^\n]*/, `Verification: ${finalVerification}`);
      }
    }
  });

  // Soft-delete after recording resolution
  await megamemory_remove_concept({
    id: sessionId,
    reason: "Resolved - archived to debug history"
  });
};
```
</megamemory_examples>
```

---

## Resume Behavior

```markdown
When OpenCode reads this session after /new:

1. Parse status → know current phase (gathering/investigating/fixing/verifying)
2. Read current_focus → know exactly what was happening
3. Read eliminated → know what NOT to retry (prevents re-investigating dead ends)
4. Read evidence → know what's been learned
5. Continue from next_action

The session IS the debugging brain. OpenCode should be able to resume perfectly from any interruption point.
```

---

## Size Constraints

```markdown
Keep debug sessions focused:

- Evidence entries: 1-2 lines each, just the facts
- Eliminated: brief - hypothesis + why it failed
- No narrative prose - structured data only

If evidence grows very large (10+ entries), consider whether you're going in circles. Check Eliminated to ensure you're not re-treading.
```
