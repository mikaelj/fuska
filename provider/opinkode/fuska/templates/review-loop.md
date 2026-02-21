## Interactive Review Loop Pattern

Reusable pattern for reviewing plans or execution results.

---

### Review Options

```
reviewOptions = [
  { label: "Looks good, proceed", description: "Save and continue" },
  { label: "Ask a question", description: "Discuss the content" },
  { label: "Modify a task", description: "Change a specific task" },
  { label: "Add a task", description: "Add new task" },
  { label: "Remove a task", description: "Remove a task" }
]
```

---

### Plan Display Format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 CHAPTER {X}: {Name} - Plans
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Plan 1: {objective}

**Batch:** {batch}
**Depends on:** {depends_on}
**Autonomous:** {yes/no}
**Purpose:** {purpose}
**Output:** {output}

### Must Haves
{requirements list}

### Files to Modify
{files_modified list}

### Tasks ({count})
#### Task 1: {name}
- **Files:** {files}
- **Action:** {action}
- **Verify:** {verify}
- **Done:** {done}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### Query Plans for Display

```
megamemory_understand(query=`${chapterSlug}-plan`, top_k=20)

const planConcepts = response.matches.map(match => {
  const planData = JSON.parse(match.summary)
  return {
    id: match.id,
    name: match.name,
    data: planData
  }
}).sort((a, b) => {
  const numA = parseInt(a.name.match(/plan-(\d+)/)?.[1] || '0')
  const numB = parseInt(b.name.match(/plan-(\d+)/)?.[1] || '0')
  return numA - numB
})
```

---

### Review Loop Logic

```
while (true) {
  actionResponse = question(questions=[{
    header: "Plan Review",
    question: "What would you like to do?",
    options: reviewOptions
  }])

  if (actionResponse[0] === "Looks good, proceed") break

  if (actionResponse[0] === "Ask a question") {
    // Get question, answer based on context, re-display
    continue
  }

  if (actionResponse[0] === "Modify a task") {
    // Select plan → Select task → Get modification → Spawn revision
    // Re-query and re-display
    continue
  }

  if (actionResponse[0] === "Add a task") {
    // Select plan → Get task details → Spawn revision
    // Re-query and re-display
    continue
  }

  if (actionResponse[0] === "Remove a task") {
    // Select plan → Select task → Confirm → Spawn revision
    // Re-query and re-display
    continue
  }
}
```

---

### Plan Selection UI

```
const planOptions = planConcepts.map(p => ({
  label: p.name,
  description: p.data.objective || 'No objective'
}))

const planChoice = question(questions=[{
  header: "Select Plan",
  question: "Which plan?",
  options: planOptions
}])
```

---

### Task Selection UI

```
const selectedPlan = planConcepts.find(p => p.name === planChoice[0])
const taskOptions = selectedPlan.data.tasks?.map((t, i) => ({
  label: `Task ${i+1}: ${t.name || 'Task ' + (i+1)}`,
  description: t.action?.substring(0, 50) + '...' || 'No description'
})) || []
```

---

### Revision Prompt Snippets

**Modify task:**
```markdown
<revision_context>
**Mode:** revision
**Chapter:** {chapterNumber}
**Plan Concept ID:** {planId}
**Current plan:** {planData JSON}
**User feedback:** {feedback}
</revision_context>

<instructions>
Update the plan to address user feedback.
Use: megamemory_update_concept(id="{planId}", changes={summary: JSON.stringify(updatedPlan)})
Return: ## REVISION COMPLETE
</instructions>
```

**Add task:**
```markdown
<revision_context>
**Mode:** add_task
**Chapter:** {chapterNumber}
**Plan Concept ID:** {planId}
**New task:** {taskDescription}
</revision_context>

<instructions>
Add the new task to the plan.
Use: megamemory_update_concept(id="{planId}", changes={summary: JSON.stringify(updatedPlan)})
Return: ## REVISION COMPLETE
</instructions>
```

**Remove task:**
```markdown
<revision_context>
**Mode:** remove_task
**Chapter:** {chapterNumber}
**Plan Concept ID:** {planId}
**Task to remove:** Task {index}
</revision_context>

<instructions>
Remove the specified task from the plan.
Use: megamemory_update_concept(id="{planId}", changes={summary: JSON.stringify(updatedPlan)})
Return: ## REVISION COMPLETE
</instructions>
```

---

### Re-display After Changes

After any modification, re-query and re-display:
```
megamemory_understand(query=`${chapterSlug}-plan`, top_k=20)
// Update planConcepts and re-display from plan display format
```
