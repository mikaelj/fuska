# Milestone Entry Template (MegaMemory-Backed)

Template for milestone entry - stored in MegaMemory as part of milestone concept.

---

## Original Template Structure

```markdown
## v[X.Y] [Name] (Shipped: YYYY-MM-DD)

**Delivered:** [One sentence describing what shipped]

**Phases completed:** [X-Y] ([Z] plans total)

**Key accomplishments:**
- [Major achievement 1]
- [Major achievement 2]
- [Major achievement 3]
- [Major achievement 4]

**Stats:**
- [X] files created/modified
- [Y] lines of code (primary language)
- [Z] phases, [N] plans, [M] tasks
- [D] days from start to ship (or milestone to milestone)

**Git range:** `feat(XX-XX)` → `feat(YY-YY)`

**What's next:** [Brief description of next milestone goals, or "Project complete"]

---
```

---

## MegaMemory Schema

This entry is **part of the milestone concept** created by `milestone-archive.md`. The milestone concept's summary contains this entry structure.

```typescript
<megamemory_schema>
// The milestone entry is stored within the milestone concept summary

summary: |
  Milestone v{version}: {name}
  Shipped: {date}
  Phases: {phase_start}-{phase_end}
  Total plans: {total_plans}
  Delivered: {one_sentence_overview}

  Key accomplishments:
  - {accomplishment_1}
  - {accomplishment_2}
  - {accomplishment_3}
  - {accomplishment_4}

  Stats:
  - {files_count} files created/modified
  - {lines_of_code} lines of code
  - {phases_count} phases, {plans_count} plans, {tasks_count} tasks
  - {days_count} days from {start_date} to {ship_date}

  Git range: {first_commit} → {last_commit}

  What's next: {next_milestone_goals}
```

---

## MegaMemory Operations

```markdown
<megamemory_operations>
**Create Milestone Entry (when milestone ships):**

1. Create milestone concept with entry structure in summary
2. Include version, name, shipped date, delivered overview
3. List key accomplishments (4-6 major achievements)
4. Add stats: files, LOC, phases, plans, tasks, timeline
5. Include git commit range
6. Note next milestone goals

**Update Entry (rare - retrospective corrections):**

1. Only update if retrospective corrections needed
2. Update stats if calculations were wrong
3. Document why update was made

**Query Entry (for historical reference):**

1. Query milestone by version
2. Read accomplishments, stats, git range
3. Understand what was delivered
</megamemory_operations>
```

---

## MegaMemory Examples

```typescript
<megamemory_examples>
```typescript
// Create a milestone entry (within milestone concept)
const createMilestoneEntry = async (version: string, name: string, data: {
  shippedDate: string;
  delivered: string;
  phaseStart: string;
  phaseEnd: string;
  plansCount: number;
  keyAccomplishments: string[];
  stats: {
    filesCreated: number;
    linesOfCode: number;
    phasesCount: number;
    tasksCount: number;
    startDate: string;
    endDate: string;
  };
  gitRange: { first: string; last: string };
  whatsNext: string;
}) => {
  const daysCount = Math.round(
    (new Date(data.stats.endDate).getTime() - new Date(data.stats.startDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  const summary =
    `Milestone v${version}: ${name}\n` +
    `Shipped: ${data.shippedDate}\n` +
    `Phases: ${data.phaseStart}-${data.phaseEnd}\n` +
    `Total plans: ${data.plansCount}\n` +
    `Delivered: ${data.delivered}\n\n` +
    `Key accomplishments:\n` +
    data.keyAccomplishments.map(a => `- ${a}`).join('\n') +
    `\n\n` +
    `Stats:\n` +
    `- ${data.stats.filesCreated} files created/modified\n` +
    `- ${data.stats.linesOfCode} lines of code\n` +
    `- ${data.stats.phasesCount} phases, ${data.plansCount} plans, ${data.stats.tasksCount} tasks\n` +
    `- ${daysCount} days from ${data.stats.startDate} to ${data.stats.endDate}\n\n` +
    `Git range: ${data.gitRange.first} → ${data.gitRange.last}\n\n` +
    `What's next: ${data.whatsNext}`;

  const concept = await megamemory_create_concept({
    name: `Milestone v${version}: ${name}`,
    kind: "milestone",
    summary,
    why: "Archives completed milestones with phases, decisions, issues. " +
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

// Query milestone entry
const queryMilestoneEntry = async (version: string) => {
  const results = await megamemory_understand({
    query: `Milestone v${version} with accomplishments, stats, git range`
  });

  if (results.length > 0) {
    const milestone = results[0];
    const summary = milestone.summary;

    // Parse basic info
    const entry = {
      version,
      name: summary.match(/Milestone v\d+\.\d+: ([^\n]+)/)?.[1] || '',
      shippedDate: summary.match(/Shipped: ([^\n]+)/)?.[1] || '',
      delivered: summary.match(/Delivered: ([^\n]+)/)?.[1] || '',
      phases: summary.match(/Phases: ([^\n]+)/)?.[1] || '',
      plansCount: summary.match(/Total plans: (\d+)/)?.[1] || '0',
      keyAccomplishments: summary.includes('Key accomplishments:')
        ? summary.match(/Key accomplishments:\n([\s\S]*?)(?=\n\nStats:)/)?.[1]
            .split('\n')
            .filter(line => line.startsWith('- '))
            .map(line => line.slice(2)) || []
        : [],
      stats: {
        filesCreated: summary.match(/- (\d+) files created/)?.[1] || '0',
        linesOfCode: summary.match(/- (\d+) lines of code/)?.[1] || '0',
        phasesCount: summary.match(/- (\d+) phases/)?.[1] || '0',
        plansCount: summary.match(/- \d+ phases, (\d+) plans/)?.[1] || '0',
        tasksCount: summary.match(/- \d+ phases, \d+ plans, (\d+) tasks/)?.[1] || '0',
        daysCount: summary.match(/- (\d+) days from/)?.[1] || '0',
        startDate: summary.match(/days from ([^-]+) to/)?.[1] || '',
        endDate: summary.match(/to ([^\n]+)/)?.[1] || ''
      },
      gitRange: {
        first: summary.match(/Git range: ([^-]+) →/)?.[1] || '',
        last: summary.match(/→ ([^\n]+)/)?.[1] || ''
      },
      whatsNext: summary.match(/What's next: ([^\n]+)/)?.[1] || ''
    };

    return { id: milestone.id, ...entry };
  }

  return null;
};

// Query all milestone entries
const queryAllMilestoneEntries = async () => {
  const results = await megamemory_understand({
    query: "All milestones with versions, shipped dates, accomplishments, stats"
  });

  return results.map(milestone => {
    const summary = milestone.summary;

    return {
      id: milestone.id,
      version: summary.match(/Milestone v(\d+\.\d+):/)?.[1] || '',
      name: summary.match(/Milestone v\d+\.\d+: ([^\n]+)/)?.[1] || '',
      shippedDate: summary.match(/Shipped: ([^\n]+)/)?.[1] || '',
      delivered: summary.match(/Delivered: ([^\n]+)/)?.[1] || '',
      phases: summary.match(/Phases: ([^\n]+)/)?.[1] || '',
      plansCount: summary.match(/Total plans: (\d+)/)?.[1] || '0',
      whatsNext: summary.match(/What's next: ([^\n]+)/)?.[1] || ''
    };
  });
};
```
</megamemory_examples>
```

---

## When to Create Milestones

```markdown
**Create milestones when:**

- Initial v1.0 MVP shipped
- Major version releases (v2.0, v3.0)
- Significant feature milestones (v1.1, v1.2)
- Before archiving planning (capture what was shipped)

**Don't create milestones for:**

- Individual phase completions (normal workflow)
- Work in progress (wait until shipped)
- Minor bug fixes that don't constitute a release
```

---

## Stats to Include

```markdown
**Counting stats:**

```bash
# Count modified files
git diff --stat feat(XX-XX)..feat(YY-YY) | tail -1

# Count LOC (replace with relevant extension)
find . -name "*.ts" -o -name "*.tsx" | xargs wc -l

# Phase/plan/task counts from ROADMAP
grep -c "^## Phase" ROADMAP.md
grep -c "PLAN.md" ROADMAP.md (or actual count)
grep -c "- \[" ROADMAP.md (or actual count)

# Timeline from first to last commit
git log --format="%ai" feat(XX-XX)..feat(YY-YY) | head -1
git log --format="%ai" feat(XX-XX)..feat(YY-YY) | tail -1
```

**Git range format:**

- First commit of milestone → last commit of milestone
- Example: `feat(01-01)` → `feat(04-01)` for phases 1-4
```

---

## Example

```markdown
## v1.1 Security & Polish (Shipped: 2025-12-10)

**Delivered:** Security hardening with Keychain integration and comprehensive error handling

**Phases completed:** 5-6 (3 plans total)

**Key accomplishments:**
- Migrated API key storage from plaintext to macOS Keychain
- Implemented comprehensive error handling for network failures
- Added Sentry crash reporting integration
- Fixed memory leak in auto-refresh timer

**Stats:**
- 23 files modified
- 650 lines of Swift added
- 2 phases, 3 plans, 12 tasks
- 8 days from v1.0 to v1.1

**Git range:** `feat(05-01)` → `feat(06-02)`

**What's next:** v2.0 SwiftUI redesign with widget support

---

## v1.0 MVP (Shipped: 2025-11-25)

**Delivered:** Menu bar weather app with current conditions and 3-day forecast

**Phases completed:** 1-4 (7 plans total)

**Key accomplishments:**
- Menu bar app with popover UI (AppKit)
- OpenWeather API integration with auto-refresh
- Current weather display with conditions icon
- 3-day forecast list with high/low temperatures
- Code signed and notarized for distribution

**Stats:**
- 47 files created
- 2,450 lines of Swift
- 4 phases, 7 plans, 28 tasks
- 12 days from start to ship

**Git range:** `feat(01-01)` → `feat(04-01)`

**What's next:** Security audit and hardening for v1.1
```
