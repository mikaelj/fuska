# Planner Subagent Prompt Template (MegaMemory-Backed)

Template for spawning fuska-planner agent. Planning context and plans stored in MegaMemory.

---

## Original Template Structure

```markdown
<planning_context>

**Chapter:** {chapter_number}
**Mode:** {standard | fix_planning}

**Project State:**
megamemory:understand({query: "project state"})

**Roadmap:**
megamemory:understand({query: "roadmap"})

**Requirements (if exists):**
megamemory:understand({query: "requirements"})

**Chapter Context (if exists):**
megamemory:understand({query: "chapter {chapter} context"})

**Research (if exists):**
megamemory:understand({query: "chapter {chapter} research"})

**Fix Planning (if --fixes mode):**
megamemory:understand({query: "chapter {chapter} verification"})

</planning_context>

<downstream_consumer>
Output consumed by /fuska-build
Plans must be executable prompts with:
- Frontmatter (batch, depends_on, files_modified, autonomous)
- Tasks in XML format
- Verification criteria
- requirements for goal-backward verification
</downstream_consumer>

<quality_gate>
Before returning PLANNING COMPLETE:
- [ ] PLAN.md files created in chapter directory
- [ ] Each plan has valid frontmatter
- [ ] Tasks are specific and actionable
- [ ] Dependencies correctly identified
- [ ] Batchs assigned for parallel execution
- [ ] requirements derived from chapter goal
</quality_gate>
```

## Placeholders

| Placeholder | Source | Example |
|-------------|--------|---------|
| `{chapter_number}` | From roadmap/arguments | `5` or `2.1` |
| `{chapter_dir}` | Chapter directory name | `05-user-profiles` |
| `{chapter}` | Chapter prefix | `05` |
| `{standard \| fix_closure}` | Mode flag | `standard` |

## Continuation Template

For checkpoints, spawn fresh agent with:

```markdown
<objective>
Continue planning for Chapter {chapter_number}: {chapter_name}
</objective>

<prior_state>
Existing chapter: megamemory:understand({query: "chapter {chapter_number}"})
Existing plans: megamemory:understand({query: "chapter {chapter_number} plans"})
</prior_state>

<checkpoint_response>
**Type:** {checkpoint_type}
**Response:** {user_response}
</checkpoint_response>

<mode>
Continue: {standard | fix_closure}
</mode>
```

---

## MegaMemory Schema

```typescript
<megamemory_schema>
concept_kind: "plan"

summary: |
  Plan {plan_id}: {plan_name} for Chapter {chapter_number}: {chapter_name}
  Batch: {batch_number} (of {total_batches})
  Tasks: {task_count} tasks
  {One-sentence overview of what this plan delivers}

why: |
  Stores executable plans for chapter implementation.
  Plans contain tasks, dependencies, verification criteria, and requirements.
  Consumed by /fuska-build for execution.

edges: [
  {
    to: "chapter-{chapter_number}",
    relation: "connects_to",
    description: "Plan belongs to this chapter"
  },
  {
    to: "plan-{depends_on_plan_id}",
    relation: "depends_on",
    description: "Depends on this plan"
  }
]
</megamemory_schema>
```

---

## MegaMemory Operations

```markdown
<megamemory_operations>
**Create Plan (during chapter planning):**

1. Create concept with plan_id, plan_name, batch, tasks
2. Set mode (standard or fix_closure)
3. List all tasks with dependencies
4. Include verification criteria and requirements
5. Link to parent chapter and dependent plans
6. Return concept ID for execution

**Update Plan (rare - retrospective corrections):**

1. Only update if retrospective corrections needed
2. Update tasks, dependencies, or verification criteria
3. Document why update was made

**Query Plan (for execution):**

1. Query plan by plan_id
2. Read tasks, dependencies, verification criteria
3. Execute tasks in batch order
</megamemory_operations>
```

---

## MegaMemory Examples

```typescript
<megamemory_examples>
```typescript
// Create a plan
const createPlan = async (planId: string, chapterNumber: string, chapterName: string, data: {
  planName: string;
  batch: number;
  totalBatchs: number;
  tasks: Array<{
    id: string;
    description: string;
    dependencies?: string[];
    estimatedTime?: string;
  }>;
  verificationCriteria: string[];
  mustHaves: string[];
  filesModified: string[];
  dependsOn?: string[];
  autonomous?: boolean;
}) => {
  const tasksSection = data.tasks.map((task, index) => {
    const deps = task.dependencies && task.dependencies.length > 0
      ? `\n    Depends on: ${task.dependencies.join(', ')}`
      : '';
    const time = task.estimatedTime ? `\n    Estimated: ${task.estimatedTime}` : '';
    return `Task ${index + 1}: ${task.description}${deps}${time}`;
  }).join('\n\n  ');

  const summary =
    `Plan ${planId}: ${data.planName} for Chapter ${chapterNumber}: ${chapterName}\n` +
    `Batch: ${data.batch} of ${data.totalBatchs}\n` +
    `Tasks: ${data.tasks.length} tasks\n` +
    `Files modified: ${data.filesModified.join(', ')}\n` +
    `Autonomous: ${data.autonomous || false}\n\n` +
    `Tasks:\n  ${tasksSection}\n\n` +
    `Verification criteria:\n` +
    data.verificationCriteria.map(v => `- ${v}`).join('\n') +
    `\n\n` +
    `Must-haves:\n` +
    data.mustHaves.map(m => `- ${m}`).join('\n');

  const edges = [
    {
      to: `chapter-${chapterNumber}`,
      relation: "connects_to" as const,
      description: "Plan belongs to this chapter"
    },
    ...(data.dependsOn || []).map(depId => ({
      to: `plan-${depId}`,
      relation: "depends_on" as const,
      description: `Depends on plan ${depId}`
    }))
  ];

  const concept = await megamemory_create_concept({
    name: `Plan ${planId}: ${data.planName}`,
    kind: "plan",
    summary,
    why: "Stores executable plans for chapter implementation. " +
          "Plans contain tasks, dependencies, verification criteria, and requirements. " +
          "Consumed by /fuska-build for execution.",
    edges,
    created_by_task: `Planning for Chapter ${chapterNumber}`
  });

  return concept.id;
};

// Query plan for execution
const queryPlan = async (planId: string) => {
  const results = await megamemory:understand({
    query: `Plan ${planId} with tasks, dependencies, verification criteria`
  });

  if (results.concepts.length > 0) {
    const plan = results.concepts[0];
    const summary = JSON.parse(plan.summary);

    // Parse basic info
    const planData = {
      id: planId,
      planName: summary.match(/Plan [^:]+: ([^\n]+)/)?.[1] || '',
      chapterNumber: summary.match(/Chapter ([\d.]+):/)?.[1] || '',
      chapterName: summary.match(/Chapter [\d.]+: ([^\n]+)/)?.[1] || '',
      batch: parseInt(summary.match(/Batch: (\d+) of/)?.[1] || '0'),
      totalBatchs: parseInt(summary.match(/Batch: \d+ of (\d+)/)?.[1] || '0'),
      tasksCount: parseInt(summary.match(/Tasks: (\d+) tasks/)?.[1] || '0'),
      filesModified: summary.match(/Files modified: ([^\n]+)/)?.[1]?.split(', ') || [],
      autonomous: summary.includes('Autonomous: true'),
      verificationCriteria: summary.includes('Verification criteria:')
        ? summary.match(/Verification criteria:\n([\s\S]*?)(?=\n\nMust-haves:)/)?.[1]
            .split('\n')
            .filter(line => line.startsWith('- '))
            .map(line => line.slice(2)) || []
        : [],
      mustHaves: summary.includes('Must-haves:')
        ? summary.match(/Must-haves:\n([\s\S]*?)$/)?.[1]
            .split('\n')
            .filter(line => line.startsWith('- '))
            .map(line => line.slice(2)) || []
        : []
    };

    // Parse tasks
    const tasks: Array<{
      id: string;
      description: string;
      dependencies: string[];
      estimatedTime?: string;
    }> = [];
    const taskMatches = summary.matchAll(/Task (\d+): ([^\n]+)(?:(?:\n    Depends on: ([^\n]+))?(?:\n    Estimated: ([^\n]+))?)?/g);
    for (const match of taskMatches) {
      tasks.push({
        id: match[1],
        description: match[2],
        dependencies: match[3] ? match[3].split(', ') : [],
        estimatedTime: match[4] || undefined
      });
    }

    return { id: plan.id, ...planData, tasks };
  }

  return null;
};

// Query all plans for a chapter
const queryChapterPlans = async (chapterNumber: string) => {
  const results = await megamemory:understand({
    query: `All plans for Chapter ${chapterNumber} with batch assignments, dependencies`
  });

  return results.concepts.map(plan => {
    const summary = JSON.parse(plan.summary);

    return {
      id: plan.id,
      planId: summary.match(/^Plan ([^:]+):/)?.[1] || '',
      planName: summary.match(/Plan [^:]+: ([^\n]+)/)?.[1] || '',
      batch: parseInt(summary.match(/Batch: (\d+) of/)?.[1] || '0'),
      tasksCount: parseInt(summary.match(/Tasks: (\d+) tasks/)?.[1] || '0'),
      dependsOn: plan.edges
        .filter(e => e.relation === 'depends_on')
        .map(e => e.to.replace('plan-', ''))
    };
  }).sort((a, b) => a.batch - b.batch);
};

// Resume planning (find existing plans)
const resumePlanning = async (chapterNumber: string) => {
  const results = await megamemory:understand({
    query: `Chapter ${chapterNumber} existing plans with tasks, batch assignments`
  });

  return results.concepts.map(plan => {
    const summary = JSON.parse(plan.summary);

    return {
      id: plan.id,
      planId: summary.match(/^Plan ([^:]+):/)?.[1] || '',
      planName: summary.match(/Plan [^:]+: ([^\n]+)/)?.[1] || '',
      batch: parseInt(summary.match(/Batch: (\d+) of/)?.[1] || '0'),
      tasksCount: parseInt(summary.match(/Tasks: (\d+) tasks/)?.[1] || '0'),
      tasks: summary.includes('Tasks:')
        ? summary.match(/Tasks:\n([\s\S]*?)(?=\n\nVerification)/)?.[1]
            .split('\n\n  ')
            .filter(line => line.startsWith('Task '))
            .map(line => {
              const id = line.match(/Task (\d+):/)?.[1] || '';
              const desc = line.match(/Task \d+: ([^\n]+)/)?.[1] || '';
              const deps = line.match(/Depends on: ([^\n]+)/)?.[1]?.split(', ') || [];
              return { id, description: desc, dependencies: deps };
            }) || []
        : []
    };
  }).sort((a, b) => a.batch - b.batch);
};
```
</megamemory_examples>
```

---

## Usage Pattern for Agents

```markdown
**When /fuska-plan is called:**

1. Check for existing plans via `megamemory:understand({query: "chapter {chapter_number} plans"})`
2. If exists → resume planning with existing state
3. If not exists → create new plans with tasks and dependencies

**Subagent receives prompt with chapter number:**

1. Read existing plans via `megamemory:understand({query: "chapter {chapter_number} plans"})`
2. Read chapter context, research, discoveries (if any)
3. Create/update plans with batch assignments
4. Link plans to dependencies

**During planning:**

1. Create each plan as a separate concept
2. Assign batch numbers for parallel execution
3. Define dependencies between plans
4. Set verification criteria and requirements
5. Link to parent chapter concept

**Quality gate before returning PLANNING COMPLETE:**

- [ ] All PLAN concepts created in MegaMemory
- [ ] Each plan has valid frontmatter in summary
- [ ] Tasks are specific and actionable
- [ ] Dependencies correctly identified via edges
- [ ] Batchs assigned for parallel execution
- [ ] requirements derived from chapter goal
```

---

## Note

Planning methodology, task breakdown, dependency analysis, batch assignment, TDD detection, and goal-backward derivation are baked into the fuska-planner agent. This template only passes context.
