---
name: fuska-add-chapter
description: Add chapter to end of current milestone in roadmap using MegaMemory
argument-hint: <description>
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
Add a new integer chapter to the end of the current milestone in the roadmap using MegaMemory.

This command appends sequential chapters to the current milestone's chapter list, automatically calculating the next chapter number based on existing chapters.

Purpose: Add planned work discovered during execution that belongs at the end of current milestone.
</objective>

<execution_context>
@../../fuska/references/preflight-check-initiative-exists.md
@../../fuska/scripts/types.ts
@../../fuska/scripts/chapter-templates.ts
</execution_context>

<megamemory_guide>

## How to read MegaMemory responses

All project data lives in MegaMemory. If a MegaMemory query returns no results, tell the user the data wasn't found.

**`megamemory:understand` returns:**
```json
{ "matches": [ { "id": "project/state", "name": "state", "kind": "config", "summary": "{\"current_chapter\":\"chapter-01\", ...}", "children": [...], "edges": [...] } ] }
```

The important field is **`summary`** — it's a JSON string containing the concept's data. Parse it to extract the fields you need. If `matches` is empty, the concept doesn't exist.

**`megamemory:create_concept` returns:** `{id, message}` on success.

**`megamemory:update_concept` accepts changes:** `{summary?, name?, kind?, why?, file_refs?}` only. Pass the full updated JSON string as `summary`. Returns `{message}`.

**`megamemory:list_roots` returns:** an array of root concepts.

</megamemory_guide>

<context>
Chapter description: `$ARGUMENTS` (required)
</context>

<process>

## 0. Preflight Check

Follow the MegaMemory Initiative Exists Preflight Check from @preflight-check-initiative-exists.md.

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

**Step 2.1: Extract chapter description**

The variable `input` contains the raw argument string provided by the user.

```
const description = input.trim()
```

If description is empty:
```
ERROR: Chapter description required
Usage: /fuska-add-chapter <description>
Example: /fuska-add-chapter Add authentication system
```

Stop.

---

## 3. Load Roadmap from MegaMemory

**Step 3.1: Query roadmap concept**

Call:
```
megamemory_understand(query="roadmap", top_k=5)
```

**Step 3.2: Check roadmap exists**

If response.matches.length === 0:
→ Display: "Roadmap concept not found in MegaMemory"
→ Suggest: "Run fuska init to initialize initiative"
→ Stop

**Step 3.3: Extract roadmap data**

If response.matches.length > 0:
```
const roadmapId = response.matches[0].id
const roadmapSummaryString = response.matches[0].summary
const roadmapData = JSON.parse(roadmapSummaryString)

const chapters = roadmapData.chapters || []
const currentMilestone = roadmapData.current_milestone
```

---

## 4. Find Current Milestone

**Step 4.1: Identify current milestone**

```
const milestoneChapters = chapters.filter(p => p.milestone === currentMilestone)
```

If milestoneChapters.length === 0:
→ Display: "No chapters found in current milestone"
→ Stop

---

## 5. Calculate Next Chapter Number

**Step 5.1: Extract all chapter numbers**

```
const chapterNumbers = milestoneChapters.map(p => p.number).filter(n => Number.isInteger(n))
```

**Step 5.2: Find maximum and increment**

```
const maxChapterNumber = chapterNumbers.length > 0 ? Math.max(...chapterNumbers) : 0
const nextChapterNumber = maxChapterNumber + 1
```

Format as two-digit:
```
const chapterNum = nextChapterNumber.toString().padStart(2, '0')
```

---

## 6. Generate Chapter Slug

**Step 6.1: Convert description to kebab-case slug**

```
const slug = description.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
```

Chapter ID: `chapter-${chapterNum}`

---

## 7. Create Chapter Concept

**Step 7.1: Create chapter concept in MegaMemory**

Call:
```
megamemory_create_concept(
  name=`chapter-${chapterNum}`,
  kind="feature",
  summary=JSON.stringify({
    number: nextChapterNumber,
    name: description,
    slug: slug,
    milestone: currentMilestone,
    goal: "To be planned",
    depends_on: [maxChapterNumber > 0 ? `chapter-${maxChapterNumber.toString().padStart(2, '0')}` : null],
    plans: 0,
    status: "not_planned"
  }),
  parent_id=roadmapId,
  edges=[],
  why=`Chapter ${nextChapterNumber} added to ${currentMilestone}: ${description}`,
  created_by_task="fuska-add-chapter"
)
```

Display: "Created chapter concept: chapter-${chapterNum}"

---

## 8. Update Roadmap Concept

**Step 8.1: Build updated roadmap data**

```
const newChapter = {
  number: nextChapterNumber,
  name: description,
  slug: slug,
  milestone: currentMilestone,
  goal: "To be planned",
  depends_on: maxChapterNumber > 0 ? `chapter-${maxChapterNumber.toString().padStart(2, '0')}` : null,
  plans: 0,
  status: "not_planned"
}

const updatedRoadmapData = {
  ...roadmapData,
  chapters: [...chapters, newChapter]
}
```

**Step 8.2: Update roadmap concept**

Call:
```
megamemory_update_concept(
  id=roadmapId,
  changes={
    summary: JSON.stringify(updatedRoadmapData)
  }
)
```

Display: "Roadmap updated"

---

## 9. Update State Concept

**Step 9.1: Query state concept**

Call:
```
megamemory_understand(query="state", top_k=5)
```

**Step 9.2: Check state exists**

If response.matches.length > 0:
```
const stateId = response.matches[0].id
const stateSummaryString = response.matches[0].summary
const stateData = JSON.parse(stateSummaryString)
```

**Step 9.3: Add roadmap evolution entry**

```
const roadmapEvolution = stateData.roadmap_evolution || []
roadmapEvolution.push({
  timestamp: new Date().toISOString(),
  action: `Chapter ${nextChapterNumber} added`,
  description: description
})

const updatedStateData = {
  ...stateData,
  next_chapter: `chapter-${chapterNum}`,
  roadmap_evolution: roadmapEvolution
}
```

**Step 9.4: Update state concept**

Call:
```
megamemory_update_concept(
  id=stateId,
  changes={
    summary: JSON.stringify(updatedStateData)
  }
)
```

---

## 10. Present Completion Summary

Route to `<offer_next>`.

</process>

<offer_next>

Output this markdown directly (not as a code block):

```
-----------------------------------------------------
  Fuska: Chapter {N} added
-----------------------------------------------------

**Chapter {N}: {description}**

- Status: Not planned yet
- Depends on: Chapter {N-1}

──────────────────────────────────────────────────────────────

## > Next Up

**Plan Chapter {N}**

/fuska-plan-chapter {N}

*/new first → fresh context window*

──────────────────────────────────────────────────────────────

**Also available:**
- /fuska-add-chapter <description> — add another chapter
- /fuska-design-chapter {N} — gather context first

──────────────────────────────────────────────────────────────
```

</offer_next>

<anti_patterns>

- Don't modify chapters outside current milestone
- Don't renumber existing chapters
- Don't use decimal numbering (that's for insert-chapter)
- Don't create plans yet (that's /fuska-plan-chapter)
- Don't commit changes (MegaMemory auto-persists)
</anti_patterns>

<success_criteria>

- [ ] Chapter concept created in MegaMemory
- [ ] Roadmap concept updated with new chapter
- [ ] State concept updated with roadmap evolution
- [ ] Next chapter number calculated correctly (ignoring decimals)
- [ ] User informed of next steps

</success_criteria>
