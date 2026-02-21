# Milestone Archive Template (MegaMemory-Backed)

Template for milestone completion archive - stored in MegaMemory, never on disk.

---

## Original Template Structure

```markdown
# Milestone v{{VERSION}}: {{MILESTONE_NAME}}

**Status:** ✅ SHIPPED {{DATE}}
**Chapters:** {{CHAPTER_START}}-{{CHAPTER_END}}
**Total Plans:** {{TOTAL_PLANS}}

## Overview

{{MILESTONE_DESCRIPTION}}

## Chapters

{{CHAPTERS_SECTION}}

[For each chapter in this milestone, include:]

### Chapter {{CHAPTER_NUM}}: {{CHAPTER_NAME}}

**Goal**: {{CHAPTER_GOAL}}
**Depends on**: {{DEPENDS_ON}}
**Plans**: {{PLAN_COUNT}} plans

Plans:

- [x] {{CHAPTER}}-01: {{PLAN_DESCRIPTION}}
- [x] {{CHAPTER}}-02: {{PLAN_DESCRIPTION}}
      [... all plans ...]

**Details:**
{{CHAPTER_DETAILS_FROM_ROADMAP}}

**For decimal chapters, include (INSERTED) marker:**

### Chapter 2.1: Critical Security Patch (INSERTED)

**Goal**: Fix authentication bypass vulnerability
**Depends on**: Chapter 2
**Plans**: 1 plan

Plans:

- [x] 02.1-01: Patch auth vulnerability

**Details:**
{{CHAPTER_DETAILS_FROM_ROADMAP}}

---

## Milestone Summary

**Decimal Chapters:**

- Chapter 2.1: Critical Security Patch (inserted after Chapter 2 for urgent fix)
- Chapter 5.1: Performance Hotfix (inserted after Chapter 5 for production issue)

**Key Decisions:**
{{DECISIONS_FROM_PROJECT_STATE}}

**Issues Resolved:**
{{ISSUES_RESOLVED_DURING_MILESTONE}}

**Issues Deferred:**
{{ISSUES_DEFERRED_TO_LATER}}

**Technical Debt Incurred:**
{{SHORTCUTS_NEEDING_FUTURE_WORK}}
```

---

## MegaMemory Schema

```typescript
<megamemory_schema>
concept_kind: "milestone"

summary: |
  Milestone v{version}: {name}
  Shipped: {date}
  Chapters: {chapter_start}-{chapter_end}
  Total plans: {total_plans}
  {One-sentence overview of what was delivered}

why: |
  Archives completed milestones with chapters, decisions, issues.
  Provides historical record of project progress across versions.
  Enables rollback understanding and decision traceability.

file_refs: []

edges: [
  {
    to: "project",
    relation: "connects_to",
    description: "Milestone in project history"
  }
]
</megamemory_schema>
```

---

## MegaMemory Operations

```markdown
<megamemory_operations>
**Create Milestone (when completing all chapters in milestone):**

1. Create concept with version, name, shipped date
2. Add overview, chapters section with all completed chapters
3. Document decimal chapters with (INSERTED) marker
4. List key decisions, issues resolved, issues deferred
5. Track technical debt incurred
6. Link to project concept

**Update Milestone (rare - retrospective corrections):**

1. Only update if retrospective corrections needed
2. Update summary if chapter details change
3. Document why update was made

**Query Milestone (for historical reference):**

1. Query by version number
2. Read chapters, decisions, issues, technical debt
3. Understand what was delivered in each milestone
4. Trace decision history across versions
</megamemory_operations>
```

---

## MegaMemory Examples

```typescript
<megamemory_examples>
```typescript
// Create a milestone archive
const createMilestone = async (version: string, name: string, data: {
  shippedDate: string;
  chapterStart: string;
  chapterEnd: string;
  totalPlans: number;
  overview: string;
  chapters: Array<{
    number: string;
    name: string;
    goal: string;
    dependsOn: string;
    planCount: number;
    plans: Array<{ number: string; description: string }>;
    details: string;
    isInserted?: boolean;
  }>;
  decimalChapters?: Array<{ number: string; name: string; reason: string }>;
  keyDecisions: Array<{ decision: string; rationale: string }>;
  issuesResolved: string[];
  issuesDeferred: string[];
  technicalDebt: string[];
}) => {
  const chaptersSection = data.chapters.map(chapter => {
    const inserted = chapter.isInserted ? ' (INSERTED)' : '';
    const plansList = chapter.plans.map(p => `- [x] ${p.number}: ${p.description}`).join('\n    ');

    return `
### Chapter ${chapter.number}: ${chapter.name}${inserted}

**Goal**: ${chapter.goal}
**Depends on**: ${chapter.dependsOn}
**Plans**: ${chapter.planCount} plans

Plans:

    ${plansList}

**Details:**
${chapter.details}`;
  }).join('\n\n');

  const summarySection = data.decimalChapters && data.decimalChapters.length > 0
    ? `\n\n**Decimal Chapters:**\n\n` +
      data.decimalChapters.map(d => `- Chapter ${d.number}: ${d.name} (${d.reason})`).join('\n')
    : '';

  const keyDecisionsSection = data.keyDecisions.length > 0
    ? `\n\n**Key Decisions:**\n\n` +
      data.keyDecisions.map(d => `- Decision: ${d.decision} (Rationale: ${d.rationale})`).join('\n')
    : '';

  const issuesResolvedSection = data.issuesResolved.length > 0
    ? `\n\n**Issues Resolved:**\n\n` +
      data.issuesResolved.map(i => `- ${i}`).join('\n')
    : '';

  const issuesDeferredSection = data.issuesDeferred.length > 0
    ? `\n\n**Issues Deferred:**\n\n` +
      data.issuesDeferred.map(i => `- ${i}`).join('\n')
    : '';

  const technicalDebtSection = data.technicalDebt.length > 0
    ? `\n\n**Technical Debt Incurred:**\n\n` +
      data.technicalDebt.map(d => `- ${d}`).join('\n')
    : '';

  const concept = await megamemory_create_concept({
    name: `Milestone v${version}: ${name}`,
    kind: "milestone",
    summary: `Mstone v${version}: ${name}\n` +
             `Shipped: ${data.shippedDate}\n` +
             `Chapters: ${data.chapterStart}-${data.chapterEnd}\n` +
             `Total plans: ${data.totalPlans}\n` +
             `${data.overview}\n\n` +
             `${chaptersSection}${summarySection}${keyDecisionsSection}${issuesResolvedSection}${issuesDeferredSection}${technicalDebtSection}`,
    why: "Archives completed milestones with chapters, decisions, issues. " +
          "Provides historical record of project progress across versions. " +
          "Enables rollback understanding and decision traceability.",
    edges: [{
      to: "project",
      relation: "connects_to",
      description: "Milestone in project history"
    }],
    created_by_task: `Complete milestone v${version}`
  });

  return concept.id;
};

// Query milestone by version
const queryMilestone = async (version: string) => {
  const results = await megamemory_understand({
    query: `Milestone v${version} with chapters, decisions, issues resolved, technical debt`
  });

  if (results.length > 0) {
    const milestone = results[0];
    const summary = milestone.summary;

    // Parse basic info
    const basicInfo = {
      version,
      name: summary.match(/Milestone v\d+\.\d+: ([^\n]+)/)?.[1] || '',
      shippedDate: summary.match(/Shipped: ([^\n]+)/)?.[1] || '',
      chapters: summary.match(/Chapters: ([^\n]+)/)?.[1] || '',
      totalPlans: summary.match(/Total plans: (\d+)/)?.[1] || '0',
      overview: summary.match(/(Total plans: \d+\n)([^\n]+)/)?.[2] || ''
    };

    // Parse chapters
    const chapters: Array<{
      number: string;
      name: string;
      goal: string;
      dependsOn: string;
      planCount: number;
      details: string;
      isInserted: boolean;
    }> = [];
    const chapterMatches = summary.matchAll(/### Chapter ([\d.]+): ([^\(]+)(?: \(INSERTED\))?\n\*\*Goal\*\*: ([^\n]+)\n\*\*Depends on\*\*: ([^\n]+)\n\*\*Plans\*\*: (\d+) plans\n\n    Plans:\n\n([\s\S]*?)\n\n    \*\*Details\*\:\n([\s\S]*?)(?=\n\n### |\n\n\*\*[A-Z]|$)/g);
    for (const match of chapterMatches) {
      chapters.push({
        number: match[1],
        name: match[2].trim(),
        goal: match[3],
        dependsOn: match[4],
        planCount: parseInt(match[5]),
        plans: match[6].split('\n').map((line, i) => ({
          number: match[1] + '-' + (i + 1).toString().padStart(2, '0'),
          description: line.replace(/^\s*-\s*\[x\]\s*/, '')
        })),
        details: match[7].trim(),
        isInserted: match[0].includes('(INSERTED)')
      });
    }

    // Parse key decisions
    const keyDecisions: Array<{ decision: string; rationale: string }> = [];
    const decisionMatches = summary.matchAll(/- Decision: ([^\n]+) \(Rationale: ([^\n]+)\)/g);
    for (const match of decisionMatches) {
      keyDecisions.push({ decision: match[1], rationale: match[2] });
    }

    // Parse issues
    const issuesResolved = summary.includes('Issues Resolved:')
      ? summary.match(/Issues Resolved:\n\n([\s\S]*?)(?=\n\n\*\*[A-Z]|$)/)?.[1]
          .split('\n')
          .filter(line => line.startsWith('- '))
          .map(line => line.slice(2)) || []
      : [];

    const issuesDeferred = summary.includes('Issues Deferred:')
      ? summary.match(/Issues Deferred:\n\n([\s\S]*?)(?=\n\n\*\*[A-Z]|$)/)?.[1]
          .split('\n')
          .filter(line => line.startsWith('- '))
          .map(line => line.slice(2)) || []
      : [];

    // Parse technical debt
    const technicalDebt = summary.includes('Technical Debt Incurred:')
      ? summary.match(/Technical Debt Incurred:\n\n([\s\S]*?)(?=\n\n\*\*[A-Z]|$)/)?.[1]
          .split('\n')
          .filter(line => line.startsWith('- '))
          .map(line => line.slice(2)) || []
      : [];

    // Parse decimal chapters
    const decimalChapters = summary.includes('Decimal Chapters:')
      ? summary.match(/Decimal Chapters:\n\n([\s\S]*?)(?=\n\n\*\*[A-Z]|$)/)?.[1]
          .split('\n')
          .filter(line => line.startsWith('- '))
          .map(line => {
            const match = line.match(/- Chapter ([^:]+): (.+) \((.+)\)/);
            return match ? { number: match[1], name: match[2], reason: match[3] } : null;
          })
          .filter(Boolean) || []
      : [];

    return {
      id: milestone.id,
      ...basicInfo,
      chapters,
      decimalChapters,
      keyDecisions,
      issuesResolved,
      issuesDeferred,
      technicalDebt
    };
  }

  return null;
};

// Query all milestones
const queryAllMilestones = async () => {
  const results = await megamemory_understand({
    query: "All milestones with versions, shipped dates, chapters"
  });

  return results.map(milestone => {
    const summary = milestone.summary;
    return {
      id: milestone.id,
      version: summary.match(/Milestone v(\d+\.\d+):/)?.[1] || '',
      name: summary.match(/Milestone v\d+\.\d+: ([^\n]+)/)?.[1] || '',
      shippedDate: summary.match(/Shipped: ([^\n]+)/)?.[1] || '',
      chapters: summary.match(/Chapters: ([^\n]+)/)?.[1] || '',
      totalPlans: summary.match(/Total plans: (\d+)/)?.[1] || '0'
    };
  });
};
```
</megamemory_examples>
```

---

## When to Create Milestone Archives

```markdown
**Create milestone archives when:**

- After completing all chapters in a milestone (v1.0, v1.1, v2.0, etc.)
- Triggered by complete-milestone workflow
- Before planning next milestone work
```

---

## How to Fill Template

```markdown
**Steps:**

1. Replace {{PLACEHOLDERS}} with actual values
2. Extract chapter details from ROADMAP.md
3. Document decimal chapters with (INSERTED) marker
4. Include key decisions from PROJECT-STATE.md or SUMMARY files
5. List issues resolved vs deferred
6. Capture technical debt for future reference

**Archive location:**

- Store as MegaMemory concept (no file needed)
- Queryable by version number
- Links to project concept for navigation
```

---

## After Archiving

```markdown
**Next steps:**

1. Update ROADMAP.md to collapse completed milestone in <details> tag
2. Update PROJECT.md to brownfield format with Current State section
3. Continue chapter numbering in next milestone (never restart at 01)
```
