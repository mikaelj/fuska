---
name: fuska-insert-chapter
description: Insert urgent work (e.g., "72.1 quick fix" - immediately after 72.1 chapter) using MegaMemory
argument-hint: <after> <description>
agent: @../../agents/fuska/fuska-planner.md
tools:
  - read
  - write
  - bash
  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
  - megamemory:list_roots

---

<objective>
Insert a decimal chapter for urgent work discovered mid-milestone that must be completed between existing integer chapters using MegaMemory.

Uses decimal numbering (72.1, 72.2, etc.) to preserve the logical sequence of planned chapters while accommodating urgent insertions.

Purpose: Handle urgent work discovered during execution without renumbering entire roadmap.
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

<process>

## 0. Preflight Check

Follow the MegaMemory Initiative Exists Preflight Check from @preflight-check-initiative-exists.md.

<step name="validate_megamemory">
Check MegaMemory availability and load project state.

**Step 1: Call list_roots**
```
megamemory_list_roots()
```

**Step 2: Check for empty results**

If response.roots.length === 0:
→ Display: "No initiatives found in MegaMemory"
→ Suggest: "Run fuska init to initialize initiative"
→ Stop

**Step 3: Query state concept**
```
megamemory_understand(query="state", top_k=5)
```

**Step 4: Check state exists**

If response.matches.length === 0:
→ Display: "Initiative state not found in MegaMemory"
→ Suggest: "Run fuska init to initialize initiative"
→ Stop

**Step 5: Extract state data**

If response.matches.length > 0:
```
const stateSummaryString = response.matches[0].summary
const stateData = JSON.parse(stateSummaryString)
```
</step>

<step name="parse_arguments">
Parse the command arguments:
- First argument: integer chapter number to insert after
- Remaining arguments: chapter description

Example: `/fuska-insert-chapter 72 Fix critical auth bug`
→ after = 72
→ description = "Fix critical auth bug"

Validation:

```bash
if [ $# -lt 2 ]; then
  echo "ERROR: Both chapter number and description required"
  echo "Usage: /fuska-insert-chapter <after> <description>"
  echo "Example: /fuska-insert-chapter 72 Fix critical auth bug"
  exit 1
fi
```

Parse first argument as integer:

```bash
after_chapter=$1
shift
description="$*"

# Validate after_chapter is an integer
if ! [[ "$after_chapter" =~ ^[0-9]+$ ]]; then
  echo "ERROR: Chapter number must be an integer"
  exit 1
fi
```
</step>

<step name="verify_target_chapter">
Verify that the target chapter exists in the roadmap:

**Step 1: Query roadmap concept**
```
megamemory_understand(query="roadmap", top_k=5)
```

**Step 2: Check roadmap exists**

If response.matches.length === 0:
→ Display: "ERROR: Roadmap not found in MegaMemory"
→ Stop

**Step 3: Extract roadmap data**
```
const roadmapSummaryString = response.matches[0].summary
const roadmapData = JSON.parse(roadmapSummaryString)
```

**Step 4: Search for target chapter**
Find chapter with number equal to after_chapter in roadmapData.chapters array.

**Step 5: If not found:**
```
ERROR: Chapter {after_chapter} not found in roadmap
Available chapters: [list chapter numbers from roadmapData.chapters]
```

Stop.

**Step 6: Verify chapter is in current milestone (not completed/archived)**
Check chapter status is not "complete" or "archived".
</step>

<step name="find_existing_decimals">
Find existing decimal chapters after the target chapter:

**Step 1: Query chapter concepts**
```
megamemory_understand(query=`chapter-${after_chapter.toString().padStart(2, '0')}`, top_k=20)
```

**Step 2: Extract decimal chapters**
Filter matches where name matches pattern `{after_chapter}.{N}` and kind is "feature".

**Step 3: Find highest decimal suffix**
Parse decimal numbers from matching concept names.

Examples:
- Chapter 72 with no decimals → next is 72.1
- Chapter 72 with 72.1 → next is 72.2
- Chapter 72 with 72.1, 72.2 → next is 72.3

**Step 4: Calculate next decimal**
Store as: `decimal_chapter="${after_chapter.toString().padStart(2, '0')}.${next_decimal}"`
</step>

<step name="generate_slug">
Convert the chapter description to a kebab-case slug:

```bash
slug=$(echo "$description" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')
```

Chapter slug: `chapter-${decimal_chapter}-${slug}`
Example: `chapter-06.1-fix-critical-auth-bug` (chapter 6 insertion)
</step>

<step name="create_chapter_concept">
Create the chapter concept in MegaMemory:

**Step 1: Build chapter data**
```
const chapterData = {
  number: decimal_chapter,
  name: description,
  goal: "[Urgent work - to be planned]",
  depends_on: `chapter-${after_chapter.toString().padStart(2, '0')}`,
  status: "not_planned",
  plans: [],
  marker: "INSERTED"
}
```

**Step 2: Create chapter concept**
```
megamemory_create_concept(
  name=`${chapterSlug}`,
  kind="feature",
  summary=JSON.stringify(chapterData),
  why=`Urgent chapter inserted after chapter ${after_chapter}: ${description}`,
  parent_id=roadmapId
)
```

Confirm: "Created chapter concept: ${chapterSlug}"
</step>

<step name="update_roadmap">
Insert the new chapter entry into the roadmap:

**Step 1: Extract roadmap ID**
```
const roadmapId = response.matches[0].id
```

**Step 2: Build updated chapters array**
Insert new chapter entry immediately after the target chapter in roadmapData.chapters array.

New chapter entry:
```json
{
  "number": "{decimal_chapter}",
  "name": "{Description} (INSERTED)",
  "goal": "[Urgent work - to be planned]",
  "depends_on": "{after_chapter}",
  "plans": [],
  "status": "not_planned",
  "marker": "INSERTED"
}
```

**Step 3: Update roadmap concept**
```
const updatedRoadmapData = {
  ...roadmapData,
  chapters: updatedChaptersArray
}

megamemory_update_concept(
  id=roadmapId,
  changes={
    summary: JSON.stringify(updatedRoadmapData)
  }
)
```

The "(INSERTED)" marker helps identify decimal chapters as urgent insertions.

Preserve all other content exactly (formatting, other chapters).
</step>

<step name="update_project_state">
Update state concept to reflect the inserted chapter:

**Step 1: Extract state ID**
```
const stateId = stateResponse.matches[0].id
```

**Step 2: Build updated state data**
```
const updatedStateData = {
  ...stateData,
  roadmap_evolution: [
    ...(stateData.roadmap_evolution || []),
    `Chapter ${decimal_chapter} inserted after Chapter ${after_chapter}: ${description} (URGENT)`
  ]
}
```

**Step 3: Update state concept**
```
megamemory_update_concept(
  id=stateId,
  changes={
    summary: JSON.stringify(updatedStateData)
  }
)
```

Add note about insertion reason if appropriate.
</step>

<step name="completion">
Present completion summary:

```
Chapter {decimal_chapter} inserted after Chapter {after_chapter}:
- Description: {description}
- Slug: {chapterSlug}
- Status: Not planned yet
- Marker: (INSERTED) - indicates urgent work

Roadmap updated in MegaMemory
Project state updated in MegaMemory

---

## > Next Up

**Chapter {decimal_chapter}: {description}** — urgent insertion

`/fuska-plan-chapter {decimal_chapter}`

*`/new` first → fresh context window*

---

**Also available:**
- Review insertion impact: Check if Chapter {next_integer} dependencies still make sense
- Review roadmap: Query roadmap concept

---
```
</step>

</process>

<anti_patterns>

- Don't use this for planned work at end of milestone (use /fuska-add-chapter)
- Don't insert before Chapter 1 (decimal 0.1 makes no sense)
- Don't renumber existing chapters
- Don't modify the target chapter content
- Don't create plans yet (that's /fuska-plan-chapter)
- Don't commit changes (user decides when to commit)
</anti_patterns>

<success_criteria>
Chapter insertion is complete when:

- [ ] Chapter concept created in MegaMemory
- [ ] Roadmap concept updated with new chapter entry (includes "(INSERTED)" marker)
- [ ] Chapter inserted in correct position (after target chapter, before next integer chapter)
- [ ] State concept updated with roadmap evolution note
- [ ] Decimal number calculated correctly (based on existing decimals)
- [ ] User informed of next steps and dependency implications
</success_criteria>
