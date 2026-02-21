---
name: fuska-check-todos
description: List pending todos from MegaMemory and select one to work on
argument-hint: "[area filter]"
tools:
  - read
  - write
  - bash
  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
  - megamemory:remove_concept
  - megamemory:list_roots
  - question

---

<objective>

List all pending todos from MegaMemory, allow selection, load full context for the selected todo, and route to appropriate action.

Enables reviewing captured ideas and deciding what to work on next.

</objective>

 <execution_context>
 @../../fuska/references/preflight-check-initiative-exists.md
 @../../fuska/scripts/types.ts
 @../../fuska/scripts/helpers.ts

 </execution_context>

<megamemory_guide>

## How to read MegaMemory responses

All project data lives in MegaMemory. If a MegaMemory query returns no results, tell the user the data wasn't found.

**`megamemory:understand` returns:**
```json
{ "matches": [ { "id": "project/todos/123", "name": "todo-001", "kind": "feature", "summary": "{\"title\":\"Add auth\",\"area\":\"api\",\"status\":\"pending\",...}", "children": [...], "edges": [...] } ] }
```

The important field is **`summary`** — it's a JSON string containing the concept's data. Parse it to extract the fields you need. If `matches` is empty, the concept doesn't exist.

**`megamemory:create_concept` returns:** `{id, message}` on success.

**`megamemory:update_concept` accepts changes:** `{summary?, name?, kind?, why?, file_refs?}` only. Pass the full updated JSON string as `summary`. Returns `{message}`.

**`megamemory:remove_concept` accepts:** `{id, reason}`. Soft-deletes with history preserved.

**`megamemory:list_roots` returns:** an array of root concepts.

</megamemory_guide>

 <process>

**IMPORTANT: Use the question tool ONLY in Step 8.1 (Offer Actions) - NOT for displaying the todo list or waiting for user number input. The todo list should be displayed as plain text output, and user number input should be handled via text reply, not a question UI.**

## 0. Preflight Check

Follow the MegaMemory Initiative Exists Preflight Check from @preflight-check-initiative-exists.md.

## 1. Validate MegaMemory Environment

**Step 1.1: Call list_roots**

```
megamemory_list_roots()
```

**Step 1.2: Check for roots**

If response.roots.length === 0:
→ Display: "No initiatives found in MegaMemory"
→ Suggest: "Run fuska init to start a new initiative"
→ Stop

---

## 2. Check for Pending Todos

**Step 2.1: Query todos module**

```
megamemory_understand(query="todos", top_k=50)
```

**Step 2.2: Extract pending todos**

If response.matches.length === 0:
→ Display: "No todos module found in MegaMemory"
→ Suggest: "Add todos during work sessions with /fuska-add-todo"
→ Stop

```
const todoConcepts = response.matches.filter(match => {
  const summaryString = match.summary
  const todoData = JSON.parse(summaryString)
  return todoData.status === "pending"
})
```

**Step 2.3: Handle no pending todos**

If todoConcepts.length === 0:
```
No pending todos.

Todos are captured during work sessions with /fuska-add-todo.

────────────────────────────────────────────────────────────

Would you like to:

1. Continue with current chapter (fuska progress)
2. Add a todo now (/fuska-add-todo)
```

Stop.

---

## 3. Parse Area Filter

**Step 3.1: Check for area filter in arguments**

The variable `input` contains the raw argument string provided by the user.

```
const areaFilter = input.trim() // e.g., "api" or ""
```

- `/fuska-check-todos` → show all (areaFilter = "")
- `/fuska-check-todos api` → filter to area:api only

---

## 4. List Todos

**Step 4.1: Parse todo data and apply filter**

```
const pendingTodos = todoConcepts.map(match => {
  const summaryString = match.summary
  const todoData = JSON.parse(summaryString)
  return {
    id: match.id,
    name: match.name,
    title: todoData.title,
    area: todoData.area,
    created: todoData.created,
    files: todoData.files || []
  }
}).filter(todo => {
  if (areaFilter === "") return true
  return todo.area === areaFilter
}).sort((a, b) => new Date(a.created) - new Date(b.created))
```

**Step 4.2: Calculate relative time**

```
function getRelativeTime(dateString) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}
```

**Step 4.3: Display numbered list**

IMPORTANT: Display the list as plain text, NOT using the question tool. Wait for user to reply with a number.

```
Pending Todos${areaFilter !== "" ? ` (area: ${areaFilter})` : ""}:

${pendingTodos.map((todo, index) => {
  const age = getRelativeTime(todo.created)
  return `${index + 1}. ${todo.title} (${todo.area}, ${age})`
}).join('\n')}

────────────────────────────────────────────────────────────

Reply with a number to view details, or:
- /fuska-check-todos [area] to filter by area
- q to exit
```

Do NOT call the question tool here. Simply output the list and wait for user text input.

---

## 5. Handle Selection

**Step 5.1: Wait for user response**

Wait for user to reply with a number. Do NOT call question tool here - user will reply with plain text like "1", "2", "3", or "q".

**Step 5.2: Validate selection**

```
const selectedNumber = parseInt(userResponse)
if (isNaN(selectedNumber) || selectedNumber < 1 || selectedNumber > pendingTodos.length) {
  Display: "Invalid selection. Reply with a number (1-${pendingTodos.length}) or q to exit."
  Wait for new response
} else {
  const selectedTodo = pendingTodos[selectedNumber - 1]
  Proceed to step 6
}
```

---

## 6. Load Todo Context

**Step 6.1: Display todo details**

```
## ${selectedTodo.title}

**Area:** ${selectedTodo.area}
**Created:** ${selectedTodo.created} (${getRelativeTime(selectedTodo.created)} ago)
**Files:** ${selectedTodo.files.length > 0 ? selectedTodo.files.join(', ') : 'None'}

### Problem
${problemContent || 'No problem description'}

### Solution
${solutionContent || 'No solution description'}
```

**Step 6.2: Read and summarize files (if any)**

If selectedTodo.files.length > 0:
```
For each file in selectedTodo.files:
  Read the file and provide a brief summary (1-2 lines)
```

---

## 7. Check Roadmap for Chapter Match

**Step 7.1: Query roadmap concept**

```
megamemory_understand(query="roadmap", top_k=5)
```

**Step 7.2: Extract chapter data**

If response.matches.length > 0:
```
const roadmapSummaryString = response.matches[0].summary
const roadmapData = JSON.parse(roadmapSummaryString)
const chapters = roadmapData.chapters
```

**Step 7.3: Check for chapter match**

Check if todo's area matches an upcoming chapter:
```
const matchingChapter = chapters.find(chapter => {
  const chapterArea = chapter.area || ""
  return chapterArea === selectedTodo.area
})

const hasFileOverlap = chapters.some(chapter => {
  const chapterFiles = chapter.files || []
  return chapterFiles.some(file => selectedTodo.files.includes(file))
})
```

Store the match result for use in step 8.

---

## 8. Offer Actions

**Step 8.1: Prepare question options**

**If matchingChapter exists or hasFileOverlap === true:**

```
const actionResponse = question(questions=[{
  header: "Action",
  question: "This todo relates to Chapter ${matchingChapter.number}: ${matchingChapter.name}. What would you like to do?",
  options: [
    {label: "Work on it now", description: "Mark as done, start working"},
    {label: "Add to chapter plan", description: "Include when planning Chapter ${matchingChapter.number}"},
    {label: "Brainstorm approach", description: "Think through before deciding"},
    {label: "Put it back", description: "Return to list"}
  ]
}])
```

**If no roadmap match:**

```
const actionResponse = question(questions=[{
  header: "Action",
  question: "What would you like to do with this todo?",
  options: [
    {label: "Work on it now", description: "Mark as done, start working"},
    {label: "Create a chapter", description: "Create chapter with this scope"},
    {label: "Brainstorm approach", description: "Think through before deciding"},
    {label: "Put it back", description: "Return to list"}
  ]
}])
```

**Step 8.2: Handle user selection**

Wait for user response and proceed based on selection.

---

## 9. Execute Selected Action

**Step 9.1: Work on it now**

Update the todo concept status to "done":
```
const todoId = selectedTodo.id
const todoSummaryString = selectedTodo.summary
const todoData = JSON.parse(todoSummaryString)
const updatedTodoData = {
  ...todoData,
  status: "done",
  completedAt: new Date().toISOString()
}

megamemory_update_concept(
  id=todoId,
  changes={
    summary: JSON.stringify(updatedTodoData)
  }
)
```

Display problem/solution context. Begin work or ask how to proceed.

---

**Step 9.2: Add to chapter plan**

Note todo reference in chapter planning notes. Keep status as "pending". Return to list or exit.

```
Todo noted for Chapter ${matchingChapter.number}. Keep in pending for now.

Would you like to:
1. Return to list
2. Exit
```

---

**Step 9.3: Create a chapter**

Display: `/fuska-add-chapter ${selectedTodo.title}`

Keep in pending. User runs command in fresh context.

---

**Step 9.4: Brainstorm approach**

Keep in pending. Start discussion about problem and approaches.

---

**Step 9.5: Put it back**

Return to step 4 (list_todos).

---

## 10. Update State Concept

**Step 10.1: Query state concept**

```
megamemory_understand(query="state", top_k=5)
```

**Step 10.2: Update pending todo count**

If response.matches.length > 0 AND action was "Work on it now":
```
const stateId = response.matches[0].id
const stateSummaryString = response.matches[0].summary
const stateData = JSON.parse(stateSummaryString)

const updatedStateData = {
  ...stateData,
  pending_todos_count: pendingTodos.length - 1
}

megamemory_update_concept(
  id=stateId,
  changes={
    summary: JSON.stringify(updatedStateData)
  }
)
```

---

## 11. Confirm Todo Status Change

Todo state is stored in MegaMemory — no file operations needed.

Confirm: "Todo marked as done in MegaMemory: ${selectedTodo.title}"

---

## 12. Return to List or Exit

After any action completes (except "Put it back"), offer:
```
────────────────────────────────────────────────────────────

What would you like to do next?

1. Return to list
2. Exit
```

Wait for user response and route accordingly.

---

## 13. Handle Edge Cases

- No matching chapter found → offer to create new chapter
- Multiple chapters match → ask user which chapter
- Todo has no area → ask user to specify
- Files don't exist → notify user, offer to continue anyway

</process>

<output>

- Todo concept updated to status "done" (if "Work on it now")
- State concept updated with pending_todos_count (if applicable)
- Git commit created (if configured and applicable)

</output>

<anti_patterns>

- Don't delete todo concepts — use megamemory:remove_concept only when truly obsolete
- Don't start work without moving todo to "done" status first
- Don't create plans from this command — route to /fuska-plan or /fuska-add-chapter

</anti_patterns>

<success_criteria>

- [ ] MegaMemory validated (roots exist)
- [ ] All pending todos listed with title, area, age
- [ ] Area filter applied if specified
- [ ] Selected todo's full context loaded
- [ ] Roadmap context checked for chapter match
- [ ] Appropriate actions offered
- [ ] Selected action executed
- [ ] Todo concept status updated if needed
- [ ] State concept updated if todo count changed
- [ ] Changes committed to git (if applicable)

</success_criteria>
