---
name: fuska-capture
description: Capture current context as adhoc-plan or chapter
---

<objective>
Assess current work context and create appropriate structure (adhoc-plan or chapter) through specialized agent delegation.

The coordinator delegates context assessment to fuska-planner, which evaluates complexity, scope, and structure before creating the right artifact.
</objective>

<workflow>

**Step 1: Parse Arguments**

```typescript
const dryRun = args.includes('--dry-run');
const description = args.filter(a => !a.startsWith('--')).join(' ');
```

**Step 2: Detect Context**

Query MegaMemory for:
- Current conversation context (if available)
- Recent work from summary concepts
- Uncommitted changes via git status
- Current state and position

```typescript
const stateResult = await megamemory:understand({ query: 'state', top_k: 1 });
const stateData = JSON.parse(stateResult.concepts[0].summary);
const recentSummaries = await megamemory:understand({ query: 'summary', top_k: 5 });

const gitStatus = execSync('git status --short').toString();
const hasUncommitted = gitStatus.trim().length > 0;
```

**Step 3: Delegate to Planner**

Spawn fuska-planner agent with capture mode:

```typescript
const plannerResult = await Task({
  subagent_type: 'fuska-planner',
  model: configData.model_aliases?.budget_model || configData.model_aliases?.explore_model,
  description: 'Capture current context',
  prompt: `<capture_mode>
<dry_run>${dryRun}</dry_run>
<description>${description || 'capture current context'}</description>
<context>
<state>${JSON.stringify(stateData)}</state>
<recent_work>${JSON.stringify(recentSummaries.concepts.map(c => c.summary))}</recent_work>
<uncommitted_changes>${gitStatus}</uncommitted_changes>
</context>
</capture_mode>`
});
```

**Step 4: Return Result**

Planner returns one of:
- **adhoc-plan recommendation**: 2-5 tasks, single subsystem
- **chapter recommendation**: 6+ tasks, multi-subsystem
- **too simple**: 0-1 tasks, suggest direct action

Display planner's assessment with complexity score.

If not dry-run and user confirms, proceed to create the artifact.

</workflow>

<delegation>

**Planner's Responsibility:**

When receiving `<capture_mode>`, the planner:

1. **Analyzes complexity:**
   - Count distinct tasks implied by context
   - Count subsystems affected (files across different areas)
   - Assess scope (single feature vs system-wide change)

2. **Calculates complexity score:**
   ```typescript
   const taskCount = estimateTaskCount(context);
   const subsystemCount = countSubsystems(context);
   const score = taskCount + (subsystemCount * 2);
   
   if (taskCount >= 6) return 'chapter';
   if (score >= 5) return 'chapter';
   if (taskCount >= 2 || score >= 2) return 'adhoc-plan';
   return 'too-simple';
   ```

3. **Returns assessment:**
   ```markdown
   ## Context Capture Assessment
   
   **Detected:** [description of what you're working on]
   
   **Complexity:**
   - Estimated tasks: {N}
   - Subsystems: {list}
   - Score: {N}
   
   **Recommendation:** [adhoc-plan | chapter | direct-action]
   
   **Rationale:** [why this structure fits]
   
   [If adhoc-plan:]
   **Suggested name:** `adhoc-plan-{topic}-{NNN}`
   
   [If chapter:]
   **Suggested chapter:** `{number}-{name}`
   
   [If too-simple:]
   **Suggestion:** [direct command to run]
   ```

4. **If not dry-run and confirmed:**
   - Creates the artifact in MegaMemory
   - Returns creation confirmation

</delegation>

<flags>

**--dry-run**
Show assessment without creating anything.

Usage: `/fuska-capture --dry-run`
Output: Assessment with complexity score, recommendation, rationale

**<description>**
Optional description to guide capture.

Usage: `/fuska-capture refactor auth system`
Usage: `/fuska-capture` (uses current context)

</flags>

<examples>

**Example 1: Adhoc-plan from uncommitted changes**

```
User: /fuska-capture --dry-run

Output:
## Context Capture Assessment

**Detected:** Refactoring authentication service and adding tests

**Complexity:**
- Estimated tasks: 3
- Subsystems: auth, testing
- Score: 5

**Recommendation:** adhoc-plan

**Rationale:** 3 focused tasks across 2 subsystems, self-contained scope

**Suggested name:** `adhoc-plan-auth-refactor-042`
```

**Example 2: Chapter from large scope**

```
User: /fuska-capture

Output:
## Context Capture Assessment

**Detected:** Implementing user permissions with roles, policies, and UI

**Complexity:**
- Estimated tasks: 7
- Subsystems: auth, api, frontend, database
- Score: 13

**Recommendation:** chapter

**Rationale:** 7+ tasks, 4 subsystems, architectural scope

**Suggested chapter:** `08-permissions-system`
```

**Example 3: Too simple**

```
User: /fuska-capture fix typo in README

Output:
## Context Capture Assessment

**Detected:** Fix typo in README

**Complexity:**
- Estimated tasks: 1
- Subsystems: docs
- Score: 1

**Recommendation:** direct-action

**Rationale:** Single task, no planning needed

**Suggestion:** Run `/fuska-do planned fix typo in README --auto-commit`
```

</examples>

<triggers>

**Plain language triggers:**

These phrases should trigger fuska-capture:

- "capture current context"
- "capture this work"
- "create a plan for this"
- "structure this work"
- "assess current scope"
- "what should this be?"

Pattern matching in fuska-do or fuska root command routes to /fuska-capture.

</triggers>
