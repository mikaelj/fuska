# Planner Subagent Prompt Template (MegaMemory-Backed)

Template for spawning fuska-planner agent. Planning context and plans stored in MegaMemory.

---

## Original Template Structure

```markdown
<planning_context>

**Phase:** {phase_number}
**Mode:** {standard | gap_closure}

**Project State:**
megamemory:understand({query: "project state"})

**Roadmap:**
megamemory:understand({query: "roadmap"})

**Requirements (if exists):**
megamemory:understand({query: "requirements"})

**Phase Context (if exists):**
megamemory:understand({query: "phase {phase} context"})

**Research (if exists):**
megamemory:understand({query: "phase {phase} research"})

**Gap Closure (if --gaps mode):**
megamemory:understand({query: "phase {phase} verification"})
megamemory:understand({query: "phase {phase} uat"})

</planning_context>

<downstream_consumer>
Output consumed by /fuska-execute-phase
Plans must be executable prompts with:
- Frontmatter (wave, depends_on, files_modified, autonomous)
- Tasks in XML format
- Verification criteria
- must_haves for goal-backward verification
</downstream_consumer>

<quality_gate>
Before returning PLANNING COMPLETE:
- [ ] PLAN.md files created in phase directory
- [ ] Each plan has valid frontmatter
- [ ] Tasks are specific and actionable
- [ ] Dependencies correctly identified
- [ ] Waves assigned for parallel execution
- [ ] must_haves derived from phase goal
</quality_gate>
```

## Placeholders

| Placeholder | Source | Example |
|-------------|--------|---------|
| `{phase_number}` | From roadmap/arguments | `5` or `2.1` |
| `{phase_dir}` | Phase directory name | `05-user-profiles` |
| `{phase}` | Phase prefix | `05` |
| `{standard \| gap_closure}` | Mode flag | `standard` |

## Continuation Template

For checkpoints, spawn fresh agent with:

```markdown
<objective>
Continue planning for Phase {phase_number}: {phase_name}
</objective>

<prior_state>
Existing phase: megamemory:understand({query: "phase {phase_number}"})
Existing plans: megamemory:understand({query: "phase {phase_number} plans"})
</prior_state>

<checkpoint_response>
**Type:** {checkpoint_type}
**Response:** {user_response}
</checkpoint_response>

<mode>
Continue: {standard | gap_closure}
</mode>
```

---

## MegaMemory Schema

```typescript
<megamemory_schema>
concept_kind: "plan"

summary: |
  Plan {plan_id}: {plan_name} for Phase {phase_number}: {phase_name}
  Wave: {wave_number} (of {total_waves})
  Tasks: {task_count} tasks
  {One-sentence overview of what this plan delivers}

why: |
  Stores executable plans for phase implementation.
  Plans contain tasks, dependencies, verification criteria, and must-haves.
  Consumed by /gsd-execute-phase for execution.

edges: [
  {
    to: "phase-{phase_number}",
    relation: "connects_to",
    description: "Plan belongs to this phase"
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
**Create Plan (during phase planning):**

1. Create concept with plan_id, plan_name, wave, tasks
2. Set mode (standard or gap_closure)
3. List all tasks with dependencies
4. Include verification criteria and must_haves
5. Link to parent phase and dependent plans
6. Return concept ID for execution

**Update Plan (rare - retrospective corrections):**

1. Only update if retrospective corrections needed
2. Update tasks, dependencies, or verification criteria
3. Document why update was made

**Query Plan (for execution):**

1. Query plan by plan_id
2. Read tasks, dependencies, verification criteria
3. Execute tasks in wave order
</megamemory_operations>
```

---

## MegaMemory Examples

```typescript
<megamemory_examples>
```typescript
// Create a plan
const createPlan = async (planId: string, phaseNumber: string, phaseName: string, data: {
  planName: string;
  wave: number;
  totalWaves: number;
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
    `Plan ${planId}: ${data.planName} for Phase ${phaseNumber}: ${phaseName}\n` +
    `Wave: ${data.wave} of ${data.totalWaves}\n` +
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
      to: `phase-${phaseNumber}`,
      relation: "connects_to" as const,
      description: "Plan belongs to this phase"
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
    why: "Stores executable plans for phase implementation. " +
          "Plans contain tasks, dependencies, verification criteria, and must-haves. " +
          "Consumed by /gsd-execute-phase for execution.",
    edges,
    created_by_task: `Planning for Phase ${phaseNumber}`
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
      phaseNumber: summary.match(/Phase ([\d.]+):/)?.[1] || '',
      phaseName: summary.match(/Phase [\d.]+: ([^\n]+)/)?.[1] || '',
      wave: parseInt(summary.match(/Wave: (\d+) of/)?.[1] || '0'),
      totalWaves: parseInt(summary.match(/Wave: \d+ of (\d+)/)?.[1] || '0'),
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

// Query all plans for a phase
const queryPhasePlans = async (phaseNumber: string) => {
  const results = await megamemory:understand({
    query: `All plans for Phase ${phaseNumber} with wave assignments, dependencies`
  });

  return results.concepts.map(plan => {
    const summary = JSON.parse(plan.summary);

    return {
      id: plan.id,
      planId: summary.match(/^Plan ([^:]+):/)?.[1] || '',
      planName: summary.match(/Plan [^:]+: ([^\n]+)/)?.[1] || '',
      wave: parseInt(summary.match(/Wave: (\d+) of/)?.[1] || '0'),
      tasksCount: parseInt(summary.match(/Tasks: (\d+) tasks/)?.[1] || '0'),
      dependsOn: plan.edges
        .filter(e => e.relation === 'depends_on')
        .map(e => e.to.replace('plan-', ''))
    };
  }).sort((a, b) => a.wave - b.wave);
};

// Resume planning (find existing plans)
const resumePlanning = async (phaseNumber: string) => {
  const results = await megamemory:understand({
    query: `Phase ${phaseNumber} existing plans with tasks, wave assignments`
  });

  return results.concepts.map(plan => {
    const summary = JSON.parse(plan.summary);

    return {
      id: plan.id,
      planId: summary.match(/^Plan ([^:]+):/)?.[1] || '',
      planName: summary.match(/Plan [^:]+: ([^\n]+)/)?.[1] || '',
      wave: parseInt(summary.match(/Wave: (\d+) of/)?.[1] || '0'),
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
  }).sort((a, b) => a.wave - b.wave);
};
```
</megamemory_examples>
```

---

## Usage Pattern for Agents

```markdown
**When /fuska-plan-phase is called:**

1. Check for existing plans via `megamemory:understand({query: "phase {phase_number} plans"})`
2. If exists → resume planning with existing state
3. If not exists → create new plans with tasks and dependencies

**Subagent receives prompt with phase number:**

1. Read existing plans via `megamemory:understand({query: "phase {phase_number} plans"})`
2. Read phase context, research, discoveries (if any)
3. Create/update plans with wave assignments
4. Link plans to dependencies

**During planning:**

1. Create each plan as a separate concept
2. Assign wave numbers for parallel execution
3. Define dependencies between plans
4. Set verification criteria and must-haves
5. Link to parent phase concept

**Quality gate before returning PLANNING COMPLETE:**

- [ ] All PLAN concepts created in MegaMemory
- [ ] Each plan has valid frontmatter in summary
- [ ] Tasks are specific and actionable
- [ ] Dependencies correctly identified via edges
- [ ] Waves assigned for parallel execution
- [ ] must_haves derived from phase goal
```

---

## Note

Planning methodology, task breakdown, dependency analysis, wave assignment, TDD detection, and goal-backward derivation are baked into the fuska-planner agent. This template only passes context.
