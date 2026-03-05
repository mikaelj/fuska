---
name: fuska-remove-chapter
description: Remove a future chapter from roadmap using MegaMemory and renumber subsequent chapters
argument-hint: <chapter-number>
tools:
  - read
  - bash
  - question

  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
  - megamemory:remove_concept
  - megamemory:list_roots
---

<objective>
Remove an unstarted future chapter from the roadmap concept in MegaMemory and renumber all subsequent chapters to maintain a clean, linear sequence.

Purpose: Clean removal of work you've decided not to do, without polluting context with cancelled/deferred markers.
Output: Chapter removed from roadmap concept, all subsequent chapters renumbered, historical record preserved via update_concept.
</objective>

<execution_context>

@../../fuska/references/megamemory-quick-ref.md
@../../fuska/references/preflight-check-initiative-exists.md
@../../fuska/scripts/types.ts
@../../fuska/scripts/helpers.ts
</execution_context>

<process>

## 0. Preflight Check

Follow the MegaMemory Initiative Exists Preflight Check from @preflight-check-initiative-exists.md.

## 1. Parse Arguments

**Step 1.1: Extract chapter number**

Parse the command arguments:
- Argument is the chapter number to remove (integer or decimal)
- Example: `/fuska-remove-chapter 17` → chapter = 17
- Example: `/fuska-remove-chapter 16.1` → chapter = 16.1

If no argument provided:

```
ERROR: Chapter number required
Usage: /fuska-remove-chapter <chapter-number>
Example: /fuska-remove-chapter 17
```

Exit.

**Step 1.2: Normalize chapter to slug**

The variable `input` contains the raw argument string provided by the user.

```
const chapterNumber = parseFloat(input)
const chapterSlug = `chapter-${Math.floor(chapterNumber).toString().padStart(2, '0')}`
```

---

## 2. Validate Environment

**Step 2.1: Check MegaMemory availability**

```
megamemory_list_roots()
```

**Step 2.2: Check for empty results**

If response.roots.length === 0:
→ Display: "No initiatives found in MegaMemory"
→ Suggest: "Run fuska init to initialize initiative"
→ Stop

---

## 3. Load State and Roadmap (Initiative-Scoped)

**Step 3.1: Load ALL concepts and scope to current initiative**

```
megamemory_understand(query="config concepts roadmap state", top_k=10000)
```

**Step 3.2: Find config with current_initiative**

```
const configNode = response.matches?.find(node => {
  if (node.name !== 'config' || node.kind !== 'config') return false;
  try {
    const data = JSON.parse(node.summary);
    return 'current_initiative' in data;
  } catch {
    return false;
  }
});

if (!configNode) {
  ERROR: No config concept with current_initiative found
  → Suggest: "Run fuska init to initialize initiative"
  → Stop
}

const currentInitiative = JSON.parse(configNode.summary).current_initiative;
```

**Step 3.3: Find initiative root**

```
const initiativeRoot = response.matches?.find(node =>
  node.name === currentInitiative &&
  node.kind === 'feature' &&
  !node.parent_id
);

if (!initiativeRoot) {
  ERROR: Initiative '${currentInitiative}' not found
  → Suggest: "Run fuska init to initialize initiative"
  → Stop
}

const initiativeId = initiativeRoot.id;
```

**Step 3.4: Find state scoped to initiative**

```
const stateNode = response.matches?.find(node =>
  node.name === 'state' &&
  node.kind === 'config' &&
  node.parent_id === initiativeId
);

if (!stateNode) {
  ERROR: State concept not found for initiative '${currentInitiative}'
  → Suggest: "Run fuska init to initialize initiative"
  → Stop
}

const stateSummaryString = stateNode.summary;
const stateData = JSON.parse(stateSummaryString);
const currentChapter = stateData.current_chapter;
const currentChapterNumber = parseInt(currentChapter.replace('chapter-', ''));
```

**Step 3.5: Find roadmap scoped to initiative**

```
const roadmapNode = response.matches?.find(node =>
  node.name === 'roadmap' &&
  node.kind === 'module' &&
  node.parent_id === initiativeId
);

if (!roadmapNode) {
  ERROR: Roadmap concept not found for initiative '${currentInitiative}'
  → Suggest: "Run fuska init to initialize initiative"
  → Stop
}

const roadmapId = roadmapNode.id;
const roadmapSummaryString = roadmapNode.summary;
const roadmapData = JSON.parse(roadmapSummaryString);
```

---

## 4. Validate Chapter Exists

**Step 4.1: Find chapter in roadmap**

Search for chapter in roadmapData.chapters array:

```
const targetChapter = roadmapData.chapters.find(p => p.number === chapterNumber)
```

**Step 4.2: Check if chapter exists**

If targetChapter is undefined:

```
ERROR: Chapter {chapterNumber} not found in roadmap
Available chapters: [list chapter numbers]
```

Exit.

---

## 5. Validate Future Chapter

**Step 5.1: Compare to current chapter**

Compare target chapter to current chapter from stateData:

```
if (chapterNumber <= currentChapterNumber) {
```

Display:
```
ERROR: Cannot remove Chapter {chapterNumber}

Only future chapters can be removed:
- Current chapter: {currentChapterNumber}
- Chapter {chapterNumber} is current or completed

Run /fuska to see your current position.
```

Exit.

**Step 5.2: Check for completed work**

Filter plan concepts for this chapter from the allConcepts response:

```
const planConcepts = response.matches?.filter(node =>
  node.name.startsWith(`${chapterSlug}-plan-`) &&
  !node.name.endsWith('-summary') &&
  node.kind === 'feature'
) || [];

if (planConcepts.length > 0) {

  const summaryConcepts = response.matches?.filter(node =>
    node.name.startsWith(`${chapterSlug}-plan-`) &&
    node.name.endsWith('-summary') &&
    node.kind === 'component'
  ) || [];

  if (summaryConcepts.length > 0) {

```
ERROR: Chapter {chapterNumber} has completed work

Found executed plans:
- {list of summaries}

Cannot remove chapters with completed work.
```

Exit.

---

## 6. Gather Chapter Info and Subsequent Chapters

**Step 6.1: Extract chapter info**

```
const chapterName = targetChapter.name
const chapterGoal = targetChapter.goal
const chapterStatus = targetChapter.status
```

**Step 6.2: Find subsequent chapters**

For integer chapter removal (e.g., 17):
- Find all chapters with number > 17 (integers: 18, 19, 20...)
- Find all decimal chapters >= 17.0 and < 18.0 (17.1, 17.2...) → these become 16.x
- Find all decimal chapters for subsequent integers (18.1, 19.1...) → renumber with their parent

For decimal chapter removal (e.g., 17.1):
- Find all decimal chapters > 17.1 and < 18 (17.2, 17.3...) → renumber down
- Integer chapters unchanged

```
const subsequentChapters = roadmapData.chapters.filter(p => p.number > chapterNumber)
// Apply decimal chapter logic based on integer vs decimal removal
```

List all chapters that will be renumbered.

---

## 7. Confirm Removal

Present removal summary and confirm:

```
Removing Chapter {chapterNumber}: {chapterName}

This will:
- Remove from roadmap concept
- Renumber {N} subsequent chapters:
  - Chapter 18 → Chapter 17
  - Chapter 18.1 → Chapter 17.1
  - Chapter 19 → Chapter 18
  [etc.]

Proceed? (y/n)
```

Wait for confirmation.

---

## 8. Update Roadmap Concept

**Step 8.1: Build updated chapters array**

```
const updatedChapters = roadmapData.chapters
  .filter(p => p.number !== chapterNumber)  // Remove target chapter
  .map(p => {
    if (p.number > chapterNumber) {
      // Renumber chapter and update slug
      const newNumber = p.number - 1
      const newSlug = `chapter-${Math.floor(newNumber).toString().padStart(2, '0')}`
      return { ...p, number: newNumber, slug: newSlug }
    }
    // Handle decimal chapter renumbering logic here
    return p
  })
```

**Step 8.2: Update roadmap concept**

```
const updatedRoadmapData = {
  ...roadmapData,
  chapters: updatedChapters,
  total_chapters: updatedChapters.length
}

megamemory_update_concept(
  id=roadmapId,
  changes={
    summary: JSON.stringify(updatedRoadmapData),
    why: `Removed Chapter ${chapterNumber} (${chapterName}) and renumbered subsequent chapters`
  }
)
```

---

## 9. Update State Concept

**Step 9.1: Build updated state data**

```
const updatedStateData = {
  ...stateData,
  total_chapters: updatedChapters.length
}

// Recalculate progress percentage if needed
```

**Step 9.2: Update state concept**

```
const stateId = stateNode.id  // From step 3.4

megamemory_update_concept(
  id=stateId,
  changes={
    summary: JSON.stringify(updatedStateData),
    why: `Updated chapter count after removing Chapter ${chapterNumber}`
  }
)
```

---

## 10. Present Completion Summary

```
Chapter {chapterNumber} ({chapterName}) removed.

Changes:
- Removed from roadmap concept
- Renumbered: Chapters {first-renumbered}-{last-old} → {first-renumbered-1}-{last-new}
- Updated: Roadmap and State concepts

Current roadmap: {total-remaining} chapters
Current position: Chapter {currentChapterNumber} of {new-total}

---

## What's Next

Would you like to:
- fuska progress — see updated roadmap status
- Continue with current chapter
- Review roadmap

---
```

</process>

<anti_patterns>

- Don't remove completed chapters (have summary concepts)
- Don't remove current or past chapters
- Don't leave gaps in numbering - always renumber
- Don't add "removed chapter" notes to state - update_concept why field is the record
- Don't ask about each decimal chapter - just renumber them
- Don't modify completed chapter concepts
</anti_patterns>

<edge_cases>

**Removing a decimal chapter (e.g., 17.1):**
- Only affects other decimals in same series (17.2 → 17.1, 17.3 → 17.2)
- Integer chapters unchanged
- Simpler operation

**No subsequent chapters to renumber:**
- Removing the last chapter (e.g., Chapter 20 when that's the end)
- Just remove from roadmap, no renumbering needed

**Decimal chapters under removed integer:**
- Removing Chapter 17 when 17.1, 17.2 exist
- 17.1 → 16.1, 17.2 → 16.2
- They maintain their position in execution order (after current last integer)

</edge_cases>

<success_criteria>
Chapter removal is complete when:

- [ ] MegaMemory validated (roots exist)
- [ ] State concept loaded
- [ ] Roadmap concept loaded
- [ ] Target chapter validated as future/unstarted
- [ ] No completed work found (no summary concepts)
- [ ] User confirmed removal
- [ ] Chapter removed from roadmap concept
- [ ] All subsequent chapters renumbered in roadmap
- [ ] State concept updated (chapter count, last activity)
- [ ] No gaps in chapter numbering
- [ ] User informed of changes
</success_criteria>
