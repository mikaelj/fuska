# Verification Report Template (MegaMemory-Backed)

Template for phase goal verification results - stored in MegaMemory, never on disk.

---

## Original Template Structure

```markdown
---
phase: XX-name
verified: YYYY-MM-DDTHH:MM:SSZ
status: passed | gaps_found | human_needed
score: N/M must-haves verified
---

# Phase {X}: {Name} Verification Report

**Phase Goal:** {goal from ROADMAP.md}
**Verified:** {timestamp}
**Status:** {passed | gaps_found | human_needed}

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | {truth from must_haves} | [OK] VERIFIED | {what confirmed it} |
| 2 | {truth from must_haves} | [FAIL] FAILED | {what's wrong} |
| 3 | {truth from must_haves} | ? UNCERTAIN | {why can't verify} |

**Score:** {N}/{M} truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/Chat.tsx` | Message list component | [OK] EXISTS + SUBSTANTIVE | Exports ChatList, renders Message[], no stubs |
| `src/app/api/chat/route.ts` | Message CRUD | [FAIL] STUB | File exists but POST returns placeholder |
| `prisma/schema.prisma` | Message model | [OK] EXISTS + SUBSTANTIVE | Model defined with all fields |

**Artifacts:** {N}/{M} verified

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| Chat.tsx | /api/chat | fetch in useEffect | [OK] WIRED | Line 23: `fetch('/api/chat')` with response handling |
| ChatInput | /api/chat POST | onSubmit handler | [FAIL] NOT WIRED | onSubmit only calls console.log |
| /api/chat POST | database | prisma.message.create | [FAIL] NOT WIRED | Returns hardcoded response, no DB call |

**Wiring:** {N}/{M} connections verified

## Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| {REQ-01}: {description} | [OK] SATISFIED | - |
| {REQ-02}: {description} | [FAIL] BLOCKED | API route is stub |
| {REQ-03}: {description} | ? NEEDS HUMAN | Can't verify WebSocket programmatically |

**Coverage:** {N}/{M} requirements satisfied

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/app/api/chat/route.ts | 12 | `// TODO: implement` | [WARN] Warning | Indicates incomplete |
| src/components/Chat.tsx | 45 | `return <div>Placeholder</div>` | [BLOCK] Blocker | Renders no content |
| src/hooks/useChat.ts | - | File missing | [BLOCK] Blocker | Expected hook doesn't exist |

**Anti-patterns:** {N} found ({blockers} blockers, {warnings} warnings)

## Human Verification Required

{If no human verification needed:}
None — all verifiable items checked programmatically.

{If human verification needed:}

### 1. {Test Name}
**Test:** {What to do}
**Expected:** {What should happen}
**Why human:** {Why can't verify programmatically}

## Gaps Summary

{If no gaps:}
**No gaps found.** Phase goal achieved. Ready to proceed.

{If gaps found:}

### Critical Gaps (Block Progress)

1. **{Gap name}**
   - Missing: {what's missing}
   - Impact: {why this blocks the goal}
   - Fix: {what needs to happen}

2. **{Gap name}**
   - Missing: {what's missing}
   - Impact: {why this blocks the goal}
   - Fix: {what needs to happen}

### Non-Critical Gaps (Can Defer)

1. **{Gap name}**
   - Issue: {what's wrong}
   - Impact: {limited impact because...}
   - Recommendation: {fix now or defer}

## Recommended Fix Plans

{If gaps found, generate fix plan recommendations:}

### {phase}-{next}-PLAN.md: {Fix Name}

**Objective:** {What this fixes}

**Tasks:**
1. {Task to fix gap 1}
2. {Task to fix gap 2}
3. {Verification task}

**Estimated scope:** {Small / Medium}

---

### {phase}-{next+1}-PLAN.md: {Fix Name}

**Objective:** {What this fixes}

**Tasks:**
1. {Task}
2. {Task}

**Estimated scope:** {Small / Medium}

---

## Verification Metadata

**Verification approach:** Goal-backward (derived from phase goal)
**Must-haves source:** {PLAN.md frontmatter | derived from ROADMAP.md goal}
**Automated checks:** {N} passed, {M} failed
**Human checks required:** {N}
**Total verification time:** {duration}

---
*Verified: {timestamp}*
*Verifier: OpenCode (subagent)*
```

---

## MegaMemory Schema

```typescript
<megamemory_schema>
concept_kind: "verification"

summary: |
  Verification Report for Phase {phase_number}: {phase_name}
  Status: {passed | gaps_found | human_needed}
  Score: {N}/{M} must-haves verified
  {One-sentence overview of verification result}

why: |
  Phase goal verification results with must-haves, artifacts, gaps.
  Enables goal-backward verification to ensure phase delivers what was promised.

file_refs: [
  "{file_paths_of_verified_artifacts}"
]

edges: [
  {
    to: "phase-{phase_number}",
    relation: "connects_to",
    description: "Verification for this phase"
  }
]
</megamemory_schema>
```

---

## MegaMemory Operations

```markdown
<megamemory_operations>
**Create Verification Report (after phase execution):**

1. Create concept with phase, verification timestamp, status, score
2. Document observable truths from must-haves
3. Verify required artifacts exist and are substantive
4. Check key wiring between components
5. Cover requirements from REQUIREMENTS.md (if exists)
6. List anti-patterns found with severity
7. Document human verification needs (if any)
8. Summarize gaps (critical vs non-critical)
9. Recommend fix plans if gaps found
10. Link to parent phase

**Update Verification (rare - retrospective corrections):**

1. Only update if retrospective corrections needed
2. Update gaps, fix recommendations, or status
3. Document why update was made

**Query Verification (for gap closure or review):**

1. Query verification by phase number
2. Read gaps, fix recommendations, status
3. Understand what needs to be fixed or what's blocking
</megamemory_operations>
```

---

## MegaMemory Examples

```typescript
<megamemory_examples>
```typescript
// Create a verification report
const createVerificationReport = async (phaseNumber: string, phaseName: string, report: {
  phaseGoal: string;
  verifiedDate: string;
  status: 'passed' | 'gaps_found' | 'human_needed';
  observableTruths: Array<{
    truth: string;
    status: 'VERIFIED' | 'FAILED' | 'UNCERTAIN';
    evidence: string;
  }>;
  requiredArtifacts: Array<{
    path: string;
    expected: string;
    status: 'EXISTS + SUBSTANTIVE' | 'STUB' | 'MISSING';
    details: string;
  }>;
  keyLinks: Array<{
    from: string;
    to: string;
    via: string;
    status: 'WIRED' | 'NOT WIRED';
    details: string;
  }>;
  requirementsCoverage?: Array<{
    id: string;
    description: string;
    status: 'SATISFIED' | 'BLOCKED' | 'NEEDS HUMAN';
    blockingIssue?: string;
  }>;
  antiPatterns: Array<{
    file: string;
    line?: string;
    pattern: string;
    severity: 'Blocker' | 'Warning' | 'Info';
    impact: string;
  }>;
  humanVerification?: Array<{
    testName: string;
    test: string;
    expected: string;
    whyHuman: string;
  }>;
  gaps?: {
    critical: Array<{
      name: string;
      missing: string;
      impact: string;
      fix: string;
    }>;
    nonCritical: Array<{
      name: string;
      issue: string;
      impact: string;
      recommendation: string;
    }>;
  };
  recommendedFixPlans?: Array<{
    planId: string;
    name: string;
    objective: string;
    tasks: string[];
    estimatedScope: 'Small' | 'Medium';
  }>;
  metadata: {
    mustHavesSource: string;
    automatedChecksPassed: number;
    automatedChecksFailed: number;
    humanChecksRequired: number;
    totalTime: string;
  };
}) => {
  const verifiedCount = report.observableTruths.filter(t => t.status === 'VERIFIED').length;
  const totalTruths = report.observableTruths.length;

  const artifactsCount = report.requiredArtifacts.filter(a => a.status === 'EXISTS + SUBSTANTIVE').length;
  const totalArtifacts = report.requiredArtifacts.length;

  const wiringCount = report.keyLinks.filter(l => l.status === 'WIRED').length;
  const totalLinks = report.keyLinks.length;

  const blockers = report.antiPatterns.filter(p => p.severity === 'Blocker').length;
  const warnings = report.antiPatterns.filter(p => p.severity === 'Warning').length;

  let summary =
    `Verification Report for Phase ${phaseNumber}: ${phaseName}\n` +
    `Status: ${report.status}\n` +
    `Score: ${verifiedCount}/${totalTruths} must-haves verified\n` +
    `Artifacts: ${artifactsCount}/${totalArtifacts} verified\n` +
    `Wiring: ${wiringCount}/${totalLinks} verified\n` +
    `Anti-patterns: ${report.antiPatterns.length} found (${blockers} blockers, ${warnings} warnings)\n`;

  if (report.requirementsCoverage) {
    const satisfied = report.requirementsCoverage.filter(r => r.status === 'SATISFIED').length;
    summary += `Coverage: ${satisfied}/${report.requirementsCoverage.length} requirements satisfied\n`;
  }

  if (report.status === 'passed') {
    summary += `\nNo gaps found. Phase goal achieved. Ready to proceed.`;
  } else if (report.status === 'gaps_found' && report.gaps) {
    summary += `\nCritical gaps: ${report.gaps.critical.length}\n`;
    if (report.gaps.nonCritical.length > 0) {
      summary += `Non-critical gaps: ${report.gaps.nonCritical.length}\n`;
    }
  }

  const result = await megamemory.create_concept({
    name: `Verification: Phase ${phaseNumber}`,
    kind: "verification",
    summary,
    why: "Phase goal verification results with must-haves, artifacts, gaps. " +
          "Enables goal-backward verification to ensure phase delivers what was promised.",
    file_refs: [
      ...report.requiredArtifacts.map(a => a.path)
    ],
    edges: [{
      to: `phase-${phaseNumber}`,
      relation: "connects_to",
      description: "Verification for this phase"
    }],
    created_by_task: `Verify Phase ${phaseNumber}`
  });
  const concept = JSON.parse(result.concepts[0]);

  return concept.id;
};

// Query verification report
const queryVerificationReport = async (phaseNumber: string) => {
  const result = await megamemory.understand({
    query: `Verification report for Phase ${phaseNumber} with status, gaps, fix recommendations`
  });

  if (result.concepts.length > 0) {
    const verification = JSON.parse(result.concepts[0]);
    const summary = verification.summary;

    // Parse basic info
    const report = {
      id: verification.id,
      phaseNumber,
      phaseName: summary.match(/Verification Report for Phase ([\d.]+): ([^\n]+)/)?.[2] || '',
      status: summary.match(/Status: (passed|gaps_found|human_needed)/)?.[1] || 'unknown',
      score: summary.match(/Score: (\d+)\/(\d+)/)?.[0] || '',
      artifactsScore: summary.match(/Artifacts: (\d+)\/(\d+) verified/)?.[0] || '',
      wiringScore: summary.match(/Wiring: (\d+)\/(\d+) verified/)?.[0] || '',
      antiPatterns: summary.match(/Anti-patterns: (\d+) found \((\d+) blockers, (\d+) warnings\)/)?.[0] || '',
      coverageScore: summary.match(/Coverage: (\d+)\/(\d+) requirements satisfied/)?.[0] || null,
      criticalGaps: summary.includes('Critical gaps:')
        ? parseInt(summary.match(/Critical gaps: (\d+)/)?.[1] || '0')
        : 0,
      nonCriticalGaps: summary.includes('Non-critical gaps:')
        ? parseInt(summary.match(/Non-critical gaps: (\d+)/)?.[1] || '0')
        : 0,
      noGaps: summary.includes('No gaps found')
    };

    return report;
  }

  return null;
};

// Query all verification reports (for project status)
const queryAllVerificationReports = async () => {
  const result = await megamemory.understand({
    query: "All verification reports with phase, status, score"
  });

  return result.concepts.map(c => {
    const verification = JSON.parse(c);
    const summary = verification.summary;

    return {
      id: verification.id,
      phaseNumber: summary.match(/Verification Report for Phase ([\d.]+):/)?.[1] || '',
      phaseName: summary.match(/Verification Report for Phase [\d.]+: ([^\n]+)/)?.[1] || '',
      status: summary.match(/Status: (passed|gaps_found|human_needed)/)?.[1] || 'unknown',
      score: summary.match(/Score: (\d+)\/(\d+)/)?.[0] || '',
      criticalGaps: summary.includes('Critical gaps:')
        ? parseInt(summary.match(/Critical gaps: (\d+)/)?.[1] || '0')
        : 0
    };
  });
};

// Query gaps for a phase (for gap closure planning)
const queryPhaseGaps = async (phaseNumber: string) => {
  const result = await megamemory.understand({
    query: `Phase ${phaseNumber} verification gaps, critical and non-critical`
  });

  if (result.concepts.length > 0) {
    const verification = JSON.parse(result.concepts[0]);
    const summary = verification.summary;

    // This is a simplified gap extraction - in practice you'd parse full verification details
    return {
      id: verification.id,
      phaseNumber,
      status: summary.match(/Status: (passed|gaps_found|human_needed)/)?.[1] || 'unknown',
      criticalGaps: summary.includes('Critical gaps:')
        ? parseInt(summary.match(/Critical gaps: (\d+)/)?.[1] || '0')
        : 0,
      hasGaps: !summary.includes('No gaps found')
    };
  }

  return null;
};
```
</megamemory_examples>
```

---

## Status Values

```markdown
**Status values:**

- `passed` — All must-haves verified, no blockers
- `gaps_found` — One or more critical gaps found
- `human_needed` — Automated checks pass but human verification required
```

---

## Evidence Types

```markdown
**Evidence types:**

- For EXISTS: "File at path, exports X"
- For SUBSTANTIVE: "N lines, has patterns X, Y, Z"
- For WIRED: "Line N: code that connects A to B"
- For FAILED: "Missing because X" or "Stub because Y"
```

---

## Severity Levels

```markdown
**Severity levels:**

- [BLOCK] Blocker: Prevents goal achievement, must fix
- [WARN] Warning: Indicates incomplete but doesn't block
- [INFO] Info: Notable but not problematic
```

---

## Fix Plan Generation

```markdown
**Fix plan generation:**

- Only generate if gaps_found
- Group related fixes into single plans
- Keep to 2-3 tasks per plan
- Include verification task in each plan
```

---

## Example

```markdown
---
phase: 03-chat
verified: 2025-01-15T14:30:00Z
status: gaps_found
score: 2/5 must-haves verified
---

# Phase 3: Chat Interface Verification Report

**Phase Goal:** Working chat interface where users can send and receive messages
**Verified:** 2025-01-15T14:30:00Z
**Status:** gaps_found

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can see existing messages | [FAIL] FAILED | Component renders placeholder, not message data |
| 2 | User can type a message | [OK] VERIFIED | Input field exists with onChange handler |
| 3 | User can send a message | [FAIL] FAILED | onSubmit handler is console.log only |
| 4 | Sent message appears in list | [FAIL] FAILED | No state update after send |
| 5 | Messages persist across refresh | ? UNCERTAIN | Can't verify - send doesn't work |

**Score:** 1/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/Chat.tsx` | Message list component | [FAIL] STUB | Returns `<div>Chat will be here</div>` |
| `src/components/ChatInput.tsx` | Message input | [OK] EXISTS + SUBSTANTIVE | Form with input, submit button, handlers |
| `src/app/api/chat/route.ts` | Message CRUD | [FAIL] STUB | GET returns [], POST returns { ok: true } |
| `prisma/schema.prisma` | Message model | [OK] EXISTS + SUBSTANTIVE | Message model with id, content, userId, createdAt |

**Artifacts:** 2/4 verified

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| Chat.tsx | /api/chat GET | fetch | [FAIL] NOT WIRED | No fetch call in component |
| ChatInput | /api/chat POST | onSubmit | [FAIL] NOT WIRED | Handler only logs, doesn't fetch |
| /api/chat GET | database | prisma.message.findMany | [FAIL] NOT WIRED | Returns hardcoded [] |
| /api/chat POST | database | prisma.message.create | [FAIL] NOT WIRED | Returns { ok: true }, no DB call |

**Wiring:** 0/4 connections verified

## Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| CHAT-01: User can send message | [FAIL] BLOCKED | API POST is stub |
| CHAT-02: User can view messages | [FAIL] BLOCKED | Component is placeholder |
| CHAT-03: Messages persist | [FAIL] BLOCKED | No database integration |

**Coverage:** 0/3 requirements satisfied

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/components/Chat.tsx | 8 | `<div>Chat will be here</div>` | [BLOCK] Blocker | No actual content |
| src/app/api/chat/route.ts | 5 | `return Response.json([])` | [BLOCK] Blocker | Hardcoded empty |
| src/app/api/chat/route.ts | 12 | `// TODO: save to database` | [WARN] Warning | Incomplete |

**Anti-patterns:** 3 found (2 blockers, 1 warning)

## Human Verification Required

None needed until automated gaps are fixed.

## Gaps Summary

### Critical Gaps (Block Progress)

1. **Chat component is placeholder**
   - Missing: Actual message list rendering
   - Impact: Users see "Chat will be here" instead of messages
   - Fix: Implement Chat.tsx to fetch and render messages

2. **API routes are stubs**
   - Missing: Database integration in GET and POST
   - Impact: No data persistence, no real functionality
   - Fix: Wire prisma calls in route handlers

3. **No wiring between frontend and backend**
   - Missing: fetch calls in components
   - Impact: Even if API worked, UI wouldn't call it
   - Fix: Add useEffect fetch in Chat, onSubmit fetch in ChatInput

## Recommended Fix Plans

### 03-04-PLAN.md: Implement Chat API

**Objective:** Wire API routes to database

**Tasks:**
1. Implement GET /api/chat with prisma.message.findMany
2. Implement POST /api/chat with prisma.message.create
3. Verify: API returns real data, POST creates records

**Estimated scope:** Small

---

### 03-05-PLAN.md: Implement Chat UI

**Objective:** Wire Chat component to API

**Tasks:**
1. Implement Chat.tsx with useEffect fetch and message rendering
2. Wire ChatInput onSubmit to POST /api/chat
3. Verify: Messages display, new messages appear after send

**Estimated scope:** Small

---

## Verification Metadata

**Verification approach:** Goal-backward (derived from phase goal)
**Must-haves source:** 03-01-PLAN.md frontmatter
**Automated checks:** 2 passed, 8 failed
**Human checks required:** 0 (blocked by automated failures)
**Total verification time:** 2 min

---
*Verified: 2025-01-15T14:30:00Z*
*Verifier: OpenCode (subagent)*
```
