---
name: gsd-mm-add-todo
description: Capture idea or task as todo from current conversation context using MegaMemory
argument-hint: [optional description]
tools:
  - read
  - bash

  - question
  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
  - megamemory:list_roots

---

<objective>
Capture an idea, task, or issue that surfaces during a GSD session as a structured todo for later work using MegaMemory.

Enables "thought → capture → continue" flow without losing context or derailing current work.
</objective>

<execution_context>
@./opencode/gsd-mm/references/preflight-check-project-exists.md
@./opencode/gsd-mm/scripts/types.ts
</execution_context>

<megamemory_guide>

## How to read MegaMemory responses

All project data lives in MegaMemory. If a MegaMemory query returns no results, tell the user the data wasn't found.

**`megamemory:understand` returns:**
```json
{ "matches": [ { "id": "project/state", "name": "state", "kind": "config", "summary": "{\"current_phase\":\"phase-01\", ...}", "children": [...], "edges": [...] } ] }
```

The important field is **`summary`** — it's a JSON string containing the concept's data. Parse it to extract the fields you need. If `matches` is empty, the concept doesn't exist.

**`megamemory:create_concept` returns:** `{id, message}` on success.

**`megamemory:update_concept` accepts changes:** `{summary?, name?, kind?, why?, file_refs?}` only. Pass the full updated JSON string as `summary`. Returns `{message}`.

**`megamemory:list_roots` returns:** an array of root concepts.

</megamemory_guide>

<context>
Todo description: `$ARGUMENTS` (optional - extracts from conversation if not provided)
</context>

<process>

## 0. Preflight Check

Follow the MegaMemory Project Exists Preflight Check from @preflight-check-project-exists.md.

## 1. Validate Environment

**Step 1.1: Check MegaMemory availability**

Call:
```
megamemory_list_roots()
```

**Step 1.2: Check for empty results**

If response.roots.length === 0:
→ Display: "No projects found in MegaMemory"
→ Suggest: "Run /gsd-mm-new-project to initialize project"
→ Stop

---

## 2. Check Existing Areas

**Step 2.1: Query todos concept**

Call:
```
megamemory_understand(query="todos", top_k=10)
```

**Step 2.2: Extract existing areas**

If response.matches.length > 0:
```
const todosSummaryString = response.matches[0].summary
const todosData = JSON.parse(todosSummaryString)

const existingAreas = [...new Set(
  (todosData.todos || [])
    .filter(t => t.area)
    .map(t => t.area)
)]
```

Display existing areas for consistency: `Existing areas: ${existingAreas.join(', ') || 'none'}`

---

## 3. Extract Content

**Step 3.1: With arguments**

If `$ARGUMENTS` is provided:
```
const title = $ARGUMENTS.trim()
```

**Step 3.2: Without arguments - extract from conversation**

If `$ARGUMENTS` is empty:
Analyze recent conversation to extract:
- The specific problem, idea, or task discussed
- Relevant file paths mentioned
- Technical details (error messages, line numbers, constraints)

Formulate:
- `title`: 3-10 word descriptive title (action verb preferred)
- `problem`: What's wrong or why this is needed
- `solution`: Approach hints or "TBD" if just an idea
- `files`: Relevant paths with line numbers from conversation

---

## 4. Infer Area

**Step 4.1: Infer area from file paths**

| Path pattern | Area |
|--------------|------|
| `src/api/*`, `api/*` | `api` |
| `src/components/*`, `src/ui/*` | `ui` |
| `src/auth/*`, `auth/*` | `auth` |
| `src/db/*`, `database/*` | `database` |
| `tests/*`, `__tests__/*` | `testing` |
| `docs/*` | `docs` |
| `scripts/*`, `bin/*` | `tooling` |
| No files or unclear | `general` |

**Step 4.2: Match with existing areas**

If similar area exists in existingAreas, use that for consistency.

---

## 5. Check for Duplicates

**Step 5.1: Query for similar todos**

Call:
```
megamemory_understand(query=`todo ${title.split(' ')[0]}`, top_k=20)
```

**Step 5.2: Check for duplicates**

If response.matches.length > 0:
```
const potentialDuplicates = response.matches.filter(match => {
  const summaryString = match.summary
  const todoData = JSON.parse(summaryString)
  return todoData.title.toLowerCase().includes(title.toLowerCase()) ||
         title.toLowerCase().includes(todoData.title.toLowerCase())
})
```

If potentialDuplicates.length > 0:
```
const existingTitle = potentialDuplicates[0].name
```

Use question:
- header: "Duplicate?"
- question: "Similar todo exists: ${existingTitle}. What would you like to do?"
- options:
  - "Skip" — keep existing todo
  - "Replace" — update existing with new context
  - "Add anyway" — create as separate todo

Wait for user response.

If "Skip": Stop.
If "Replace": Update existing concept and continue.
If "Add anyway": Continue to create new todo.

---

## 6. Create Todo Concept

**Step 6.1: Generate slug from title**

```
const slug = title.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
```

**Step 6.2: Generate timestamp**

```
const timestamp = new Date().toISOString()
```

**Step 6.3: Create todo concept in MegaMemory**

Call:
```
megamemory_create_concept(
  name=`${timestamp.split('T')[0]}-${slug}`,
  kind="feature",
  summary=JSON.stringify({
    title: title,
    area: area || 'general',
    files: files || [],
    problem: problem,
    solution: solution,
    status: 'pending',
    created: timestamp
  }),
  parent_id='project/todos',
  edges=[],
  why=`Captured from conversation: ${title}`,
  created_by_task="gsd-mm-add-todo"
)
```

Display: "Todo created: ${timestamp.split('T')[0]}-${slug}"

---

## 7. Update Todos Concept

**Step 7.1: Query todos concept**

Re-use todosData from step 2.2 or re-query:
```
megamemory_understand(query="todos", top_k=10)
```

If response.matches.length > 0:
```
const todosId = response.matches[0].id
const todosSummaryString = response.matches[0].summary
const todosData = JSON.parse(todosSummaryString)

const todos = todosData.todos || []
const pendingTodos = todos.filter(t => t.status === 'pending')
```

**Step 7.2: Update todos concept**

```
const updatedTodosData = {
  ...todosData,
  todos: [...todos, {
    id: `${timestamp.split('T')[0]}-${slug}`,
    title: title,
    area: area || 'general',
    status: 'pending',
    created: timestamp
  }],
  pending_count: pendingTodos.length + 1
}
```

Call:
```
megamemory_update_concept(
  id=todosId,
  changes={
    summary: JSON.stringify(updatedTodosData)
  }
)
```

---

## 8. Present Confirmation

Route to `<offer_next>`.

</process>

<offer_next>

Output this markdown directly (not as a code block):

```
Todo saved: [{date}-{slug}]

  [{title}]
  Area: [{area}]
  Files: [{file_count}] referenced

──────────────────────────────────────────────────────────────

Would you like to:

1. Continue with current work
2. Add another todo
3. View all todos (/gsd-mm-check-todos)
```

</offer_next>

<anti_patterns>

- Don't create todos for work in current plan (that's deviation rule territory)
- Don't create elaborate solution sections — captures ideas, not plans
- Don't block on missing information — "TBD" is fine
</anti_patterns>

<success_criteria>

- [ ] Todo concept created with valid summary
- [ ] Problem section has enough context for future OpenCode
- [ ] No duplicates (checked and resolved)
- [ ] Area consistent with existing todos
- [ ] Todos concept updated with pending count
- [ ] User knows next steps

</success_criteria>
