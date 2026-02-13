# Fix: Researcher Agent Name Issues

## Problem

Running `/fuska-new-project` with research enabled fails with:
```
Error: Unknown agent type: fuska-researcher is not a valid agent type
```

## Root Causes

### Issue 1: Wrong name in frontmatter

**File:** `opencode/agents/fuska/fuska-project-researcher.md`

Current (line 1-3):
```yaml
---
name: fuska-phase-researcher
description: Researches how to implement a phase before planning. Produces research concept in MegaMemory consumed by fuska-planner. Spawned by /fuska-plan-phase orchestrator.
```

Should be:
```yaml
---
name: fuska-project-researcher
description: Researches domain ecosystem before project roadmap creation. Produces research concepts in MegaMemory consumed by fuska-roadmapper. Spawned by /fuska-new-project orchestrator.
```

### Issue 2: Missing Task calls in fuska-new-project.md

The documentation at line 553 says:
```
Spawn 4 parallel fuska-project-researcher agents with context about MegaMemory usage:
```

But there are **no Task tool invocations** for researchers. The file only has 1 Task call (for roadmapper at line 641-672).

In contrast, `fuska-new-milestone.md` has proper Task calls:
```typescript
Task(prompt="...", subagent_type="fuska-phase-researcher", model="${models.researcher}", description="Stack research")
Task(prompt="...", subagent_type="fuska-phase-researcher", model="${models.researcher}", description="Features research")
Task(prompt="...", subagent_type="fuska-phase-researcher", model="${models.researcher}", description="Architecture research")
Task(prompt="...", subagent_type="fuska-phase-researcher", model="${models.researcher}", description="Pitfalls research")
```

## Proposed Changes

### Change 1: Fix frontmatter in fuska-project-researcher.md

Replace lines 1-3 with correct name and description.

### Change 2: Add Task calls in fuska-new-project.md

After line 551 (the spawning indicator), add Task invocations similar to fuska-new-milestone.md but using `fuska-project-researcher`:

```typescript
Task(prompt="
<objective>
Research stack dimension for project: ${projectName}.
</objective>

<context>
GREENFIELD PROJECT — Building from scratch.

Project description: ${projectDescription}
</context>

<output>
Create research concept: ${projectSlug}-stack-research
Include standard stack options with recommendations
Include why each technology is chosen
</output>
", subagent_type="fuska-project-researcher", model="${models.researcher}", description="Stack research")

Task(prompt="
<objective>
Research features dimension for project: ${projectName}.
</objective>

<context>
GREENFIELD PROJECT — Building from scratch.

Project description: ${projectDescription}
</context>

<output>
Create research concept: ${projectSlug}-features-research
Categorize: table stakes, differentiators, anti-features
Note complexity and dependencies
</output>
", subagent_type="fuska-project-researcher", model="${models.researcher}", description="Features research")

Task(prompt="
<objective>
Research architecture dimension for project: ${projectName}.
</objective>

<context>
GREENFIELD PROJECT — Building from scratch.

Project description: ${projectDescription}
</context>

<output>
Create research concept: ${projectSlug}-architecture-research
Include recommended architecture patterns
Include component boundaries and data flow
</output>
", subagent_type="fuska-project-researcher", model="${models.researcher}", description="Architecture research")

Task(prompt="
<objective>
Research pitfalls dimension for project: ${projectName}.
</objective>

<context>
GREENFIELD PROJECT — Building from scratch.

Project description: ${projectDescription}
</context>

<output>
Create research concept: ${projectSlug}-pitfalls-research
For each pitfall: warning signs, prevention strategy, which phase should address
</output>
", subagent_type="fuska-project-researcher", model="${models.researcher}", description="Pitfalls research")
```

## Files to Modify

1. `opencode/agents/fuska/fuska-project-researcher.md` - Fix frontmatter
2. `opencode/command/fuska/fuska-new-project.md` - Add Task calls for researchers

## Verification

After changes:
1. Run `/fuska-new-project Test --research yes --mode yolo`
2. Should see researchers spawn successfully
3. Research concepts should be created in MegaMemory
