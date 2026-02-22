---
name: fuska-add-chapter-todo
description: Create chapter-scoped todo for additional work discovered during execution using MegaMemory
argument-hint: <chapterSlug> [description]
tools:
  - read
  - bash

  - question
  - megamemory:understand
  - megamemory:create_concept
  - megamemory:list_roots

---

<objective>
Create a chapter-scoped todo for additional work that needs to be done within a specific chapter. Chapter-todos are picked up by the planner and checker to ensure all chapter work is complete before the chapter finishes.

Chapter-todos enable iterative refinement: executors create them when discovering additional work, and the planner→checker→executor loop consumes them.
</objective>

<execution_context>

@../../fuska/references/megamemory-quick-ref.md
@../../fuska/references/preflight-check-initiative-exists.md

</execution_context>

<context>
Arguments: `$ARGUMENTS`
</context>

<process>

## 0. Preflight Check

Follow the MegaMemory Initiative Exists Preflight Check from @preflight-check-initiative-exists.md.

---

## 1. Validate Environment

**Step 1.1: Check MegaMemory availability**

Call:
```
megamemory_list_roots()
```

**Step 1.2: Check for empty results**

If response.roots.length === 0:
→ Display: "No initiatives found in MegaMemory"
→ Suggest: "Run fuska init to initialize initiative"
→ Stop

---

## 2. Parse Arguments

**Step 2.1: Extract chapterSlug and description**

```
const words = input.trim().split(/\s+/)
const chapterSlug = words[0]

if (!chapterSlug) {
  // Query available chapters and prompt user to select
  const chaptersResult = await megamemory:understand({ query: "chapter-", top_k: 20 })
  const chapters = chaptersResult.matches.filter(m => m.kind === 'feature' && m.name.startsWith('chapter-'))
  
  if (chapters.length === 0) {
    Display: "No chapters found in MegaMemory"
    → Stop
  }
  
  // Use question tool to prompt selection
  const selectedChapter = await question({
    questions: [{
      header: "Select Chapter",
      question: "Which chapter should this todo belong to?",
      options: chapters.map(c => ({ label: c.name, description: JSON.parse(c.summary).goal || 'No goal' }))
    }]
  })
  chapterSlug = selectedChapter[0]
}

const description = words.slice(1).join(" ").trim() || null
```

**Step 2.2: Verify chapter exists**

Call:
```
megamemory_understand(query=chapterSlug, top_k=1)
```

If response.matches.length === 0:
→ Display: `Chapter "${chapterSlug}" not found in MegaMemory`
→ Stop

---

## 3. Extract Content

**Step 3.1: With description argument**

If description is provided:
```
const title = description
```

**Step 3.2: Without description - prompt user**

If description is null:
Use question tool:
- header: "Todo Description"
- question: "What additional work needs to be done for this chapter?"
- options: (allow custom input)

Wait for user input. Set `title` from response.

---

## 4. Determine Next Todo Number

**Step 4.1: Query existing chapter-todos**

Call:
```
megamemory_understand(query=`${chapterSlug}-todo`, top_k=20)
```

**Step 4.2: Calculate next number**

```
const existingTodos = response.matches.filter(m => m.name.startsWith(`${chapterSlug}-todo-`))
const numbers = existingTodos.map(m => {
  const match = m.name.match(/-todo-(\d+)$/)
  return match ? parseInt(match[1], 10) : 0
})
const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1
```

---

## 5. Check for Duplicates

**Step 5.1: Check for similar todos**

If existingTodos.length > 0:
```
const potentialDuplicates = existingTodos.filter(todo => {
  const todoData = JSON.parse(todo.summary)
  return todoData.title.toLowerCase().includes(title.toLowerCase()) ||
         title.toLowerCase().includes(todoData.title.toLowerCase())
})
```

If potentialDuplicates.length > 0:
```
const existingTitle = JSON.parse(potentialDuplicates[0].summary).title
```

Use question:
- header: "Duplicate?"
- question: `Similar todo exists: "${existingTitle}". What would you like to do?`
- options:
  - "Skip" — keep existing todo
  - "Replace" — update existing with new context
  - "Add anyway" — create as separate todo

Wait for user response.

If "Skip": Stop.
If "Replace": Update existing concept and continue.
If "Add anyway": Continue to create new todo.

---

## 6. Create Chapter-Todo Concept

**Step 6.1: Generate timestamp**

```
const timestamp = new Date().toISOString()
```

**Step 6.2: Create todo concept in MegaMemory**

Call:
```
megamemory_create_concept(
  name=`${chapterSlug}-todo-${nextNum}`,
  kind="feature",
  summary=JSON.stringify({
    title: title,
    description: title,
    source: "manual",
    priority: "medium",
    status: "pending",
    created: timestamp
  }),
  parent_id=chapterSlug,
  edges=[{ to: chapterSlug, relation: "part_of" }],
  why=`Chapter-scoped todo: ${title}`,
  created_by_task="fuska-add-chapter-todo"
)
```

Display: `Chapter-todo created: ${chapterSlug}-todo-${nextNum}`

---

## 7. Present Confirmation

Route to `<offer_next>`.

</process>

<offer_next>

Output this markdown directly (not as a code block):

```
Chapter-todo saved: [{chapterSlug}-todo-{nextNum}]

  [{title}]
  Chapter: [{chapterSlug}]
  Priority: medium
  Status: pending

──────────────────────────────────────────────────────────────

This todo will be picked up by the planner when planning this chapter.

Would you like to:

1. Add another chapter-todo
2. View all chapter-todos for this chapter
3. Continue with current work
```

</offer_next>

<anti_patterns>

- Don't create chapter-todos for work outside the chapter scope (use global todos instead)
- Don't create chapter-todos for work already in the plan (that's already tracked)
- Don't create elaborate solution sections — captures requirements, not implementations
</anti_patterns>

<success_criteria>

- [ ] Chapter exists and was verified
- [ ] Todo concept created with valid summary (title, source, priority, status, created)
- [ ] Todo concept has correct parent_id (chapterSlug)
- [ ] Todo concept has part_of edge to chapter
- [ ] No duplicates (checked and resolved)
- [ ] User knows next steps

</success_criteria>
