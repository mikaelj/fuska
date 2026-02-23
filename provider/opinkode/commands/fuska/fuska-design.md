---
name: fuska-design
description: Gather chapter context through adaptive questioning before planning using MegaMemory
argument-hint: "<chapter>"
tools:
  - read
  - bash

  - question
  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
---

<objective>

Extract implementation decisions that downstream agents need — researcher and planner will use chapter context concepts to know what to investigate and what choices are locked.

**How it works:**
1. Analyze chapter from MegaMemory to identify gray areas (UI, UX, behavior, etc.)
2. Present gray areas — user selects which to discuss
3. Deep-dive each selected area until satisfied
4. Create/update chapter context concept with decisions that guide research and planning

**Output:** `{chapter}-context` concept — decisions clear enough that downstream agents can act without asking the user again.

</objective>

<execution_context>

@../../fuska/references/megamemory-quick-ref.md
@../../fuska/references/preflight-check-initiative-exists.md
@../../fuska/scripts/types.ts
@../../fuska/scripts/chapter-templates.ts
@../../fuska/scripts/helpers.ts

</execution_context>

<context>

Chapter number: `$ARGUMENTS` (required)

**Load project state from MegaMemory:**

Search MegaMemory for the project state using `megamemory:understand` — query for "state".
The state concept summary is JSON with fields: `current_chapter`, `current_plan`, `status`, `progress`, `last_activity`.
Extract the current chapter and status to understand where the project stands.

**Load chapter information from MegaMemory:**

Search MegaMemory for this chapter using `megamemory:understand` — query for "chapter {CHAPTER}" with top_k=10.
Chapter concepts are JSON with fields: `number`, `slug`, `name`, `goal`, `status`.
Extract the chapter goal and status — these define the scope boundary for discussion.

**Load relevant knowledge from MegaMemory:**

Search MegaMemory for prior decisions using `megamemory:understand` — query for "decisions architecture" with top_k=20.
Look for any previously captured decisions, architectural choices, or constraints that should inform this chapter's discussion.

</context>

<process>

## 0. Preflight Check

Follow the MegaMemory Initiative Exists Preflight Check from @preflight-check-initiative-exists.md.

## 1. Validate Chapter Number

**Step 1.1: Extract chapter number from arguments**

The variable `input` contains the raw argument string provided by the user.

```
const chapterNumber = input.match(/\d+/)?.[0]
if (!chapterNumber) {
  Display: "Chapter number is required"
  Display: "Usage: /fuska-design <chapter>"
  Stop
}
```

**Step 1.2: Query roadmap**

Call:
```
megamemory_understand(query="roadmap", top_k=5)
```

**Step 1.3: Check roadmap exists**

If response.matches.length === 0:
→ Display: "Roadmap concept not found in MegaMemory"
→ Suggest: "Run fuska init to initialize initiative"
→ Stop

**Step 1.4: Extract roadmap data**

If response.matches.length > 0:
```
const roadmapSummaryString = response.matches[0].summary
let chapters = []

try {
  const roadmapData = JSON.parse(roadmapSummaryString)
  chapters = roadmapData.chapters || []
} catch (e) {
  const roadmapId = response.matches[0].id
  const chapterConcepts = await megamemory:understand({ query: `parent:${roadmapId} chapter`, top_k: 20 })
  chapters = chapterConcepts.matches
    .filter(m => m.kind === 'feature' && m.name.startsWith('chapter-'))
    .map(m => {
      const chapterData = JSON.parse(m.summary)
      return {
        number: chapterData.number,
        slug: chapterData.slug,
        name: chapterData.name,
        goal: chapterData.goal
      }
    })
    .sort((a, b) => a.number - b.number)
}
```

**Step 1.5: Find matching chapter**

```
const matchingChapter = chapters.find(p => p.number === chapterNumber)
```

**Step 1.6: Validate chapter exists**

If !matchingChapter:
→ Display: `Chapter ${chapterNumber} not found in roadmap`
→ Display: "Available chapters:"
for (const chapter of chapters) {
  Display: `- Chapter ${chapter.number}: ${chapter.name}`
}
→ Stop

---

## 1.7. Present Chapter Design Overview

**Step 1.7.1: Query chapter concept**

Call:
```
megamemory_understand(query=`chapter ${chapterNumber}`, top_k=5)
```

**Step 1.7.2: Extract chapter data**

If response.matches.length > 0:
```
const chapterSummaryString = response.matches[0].summary
const chapterData = JSON.parse(chapterSummaryString)
const chapterName = chapterData.name
const chapterGoal = chapterData.goal
const chapterStatus = chapterData.status
```

**Step 1.7.3: Display design session overview**

Output this markdown directly (not as a code block):

```
-----------------------------------------------------
  Fuska: Chapter {chapterNumber} Design Session
-----------------------------------------------------

**Chapter {chapterNumber}: {chapterName}**

Goal: {chapterGoal}
Status: {chapterStatus}

This session gathers context and decisions to guide planning.
You'll discuss implementation choices for this chapter.

────────────────────────────────────────────────────
```

---

## 1.8. Surface Assumptions

After presenting the chapter overview, surface OpenCode's assumptions before discussion begins. This enables course correction early when assumptions are wrong.

**Step 1.8.1: Query related concepts**

```
megamemory_understand(query=`${chapterSlug}-research`, top_k=1)
megamemory_understand(query="requirements", top_k=50)
megamemory_understand(query="state", top_k=5)
```

**Step 1.8.2: Extract related data**

From requirements, filter those related to this chapter. From research, extract domain insights. From state, get completed chapters for dependency context.

**Step 1.8.3: Surface assumptions across five areas**

Based on chapter goal and gathered data, surface assumptions:

**Technical Approach:**
- What tech stack is assumed?
- What architecture patterns are expected?
- What frameworks/libraries will be used?

**Implementation Order:**
- What should be built first?
- What depends on what?
- What's the critical path?

**Scope Boundaries:**
- What's definitely IN scope?
- What's definitely OUT of scope?
- What's unclear and needs clarification?

**Risk Areas:**
- What are the technical risks?
- What are the integration risks?
- What could go wrong?

**Dependencies:**
- What external services are needed?
- What depends on other chapters?
- What needs to be in place first?

Display assumptions:
```
────────────────────────────────────────────────────────────

**My Assumptions:**

**Technical Approach:**
- [Assumption 1 from research/context]
- [Assumption 2]
- [Assumption 3]

**Implementation Order:**
1. [First thing to build]
2. [Second thing - depends on 1]
3. [Third thing - depends on 2]

**Scope Boundaries:**
- In scope: [from chapter goal]
- Out of scope: [from deferred items]
- Unclear: [items needing discussion]

**Risk Areas:**
- [Risk 1]: [Mitigation]
- [Risk 2]: [Mitigation]

**Dependencies:**
- From prior chapters: [completed work]
- External: [third-party needs]

────────────────────────────────────────────────────────────
```

**Step 1.8.4: Prompt for feedback**

Use question tool:
```
const assumptionResponse = question(questions=[{
  header: "Assumptions",
  question: "How do these assumptions look for Chapter ${chapterNumber}?",
  options: [
    {label: "Looks good", description: "Proceed to discuss gray areas"},
    {label: "Clarify", description: "Discuss a specific assumption"},
    {label: "Correct", description: "Fix wrong assumptions"},
    {label: "Add detail", description: "Expand on an area"}
  ]
}])
```

**Step 1.8.5: Handle user response**

If "Looks good":
→ Continue to Step 2 (Check for Existing Chapter Context)

If "Clarify" or "Correct" or "Add detail":
→ Discuss the specific area
→ Capture corrections in `allCorrections` array
→ Re-prompt until satisfied
→ Then continue to Step 2

**Step 1.8.6: Track assumption corrections**

```
const assumptionCorrections = [] // Track what was corrected
```

These corrections inform the gray areas discussion in Step 3.

---

## 2. Check for Existing Chapter Context

**Step 2.1: Query chapter context**

Call:
```
megamemory_understand(query=`chapter-${chapterNumber.toString().padStart(2, '0')}-context`, top_k=1)
```

**Step 2.2: Check if context exists**

If response.matches.length === 0:
```
const contextExists = false
```

Else:
```
const contextSummaryString = response.matches[0].summary
const contextData = JSON.parse(contextSummaryString)
const contextExists = true
```

**Step 2.3: Handle existing context**

If contextExists === true:
→ Use question tool:
```
const contextResponse = question(questions=[{
  header: "Existing Context",
  question: "Chapter context already exists. What would you like to do?",
  options: [
    {label: "Update existing", description: "Modify current context with new decisions"},
    {label: "View existing", description: "Show current context decisions"},
    {label: "Replace", description: "Start fresh, overwrite existing"},
    {label: "Skip discussion", description: "Context is good, proceed to planning"}
  ]
}])
```

**Step 2.4: Handle user response**

If user chooses "View existing":
→ Display: contextData
→ Re-offer question options

If user chooses "Replace":
→ Ask confirmation
→ If confirmed, delete existing context and create new

If user chooses "Skip discussion":
→ Continue to step 7

---

## 3. Analyze Chapter to Identify Gray Areas

**Step 3.1: Query chapter concept**

Call:
```
megamemory_understand(query=`chapter ${chapterNumber}`, top_k=5)
```

**Step 3.2: Check chapter exists**

If response.matches.length === 0:
→ Display: `Chapter ${chapterNumber} not found in MegaMemory`
→ Stop

**Step 3.3: Extract chapter data**

If response.matches.length > 0:
```
const chapterSummaryString = response.matches[0].summary
const chapterData = JSON.parse(chapterSummaryString)
const chapterGoal = chapterData.goal
const chapterRequirements = chapterData.requirements || []
```

**Step 3.4: Query requirements (if any)**

If chapterRequirements.length > 0:
```
const requirementIds = chapterRequirements
const requirementConcepts = []

for (const reqId of requirementIds) {
  megamemory_understand(query=reqId, top_k=1)
  if (response.matches.length > 0) {
    const reqSummaryString = response.matches[0].summary
    const reqData = JSON.parse(reqSummaryString)
    requirementConcepts.push({ id: reqId, description: reqData.description, status: reqData.status })
  }
}
```

**Step 3.5: Query existing research (if any)**

Call:
```
megamemory_understand(query=`chapter-${chapterNumber.toString().padStart(2, '0')}-research`, top_k=1)
```

If response.matches.length > 0:
```
const researchSummaryString = response.matches[0].summary
const researchData = JSON.parse(researchSummaryString)
```

Else:
```
const researchData = null
```

**Step 3.6: Generate gray areas**

Generate 3-4 chapter-specific gray areas based on chapter goal:

**Domain-aware gray areas:**

Analyze the chapter goal:
- Something users SEE → layout, density, interactions, states
- Something users CALL → responses, errors, auth, versioning
- Something users RUN → output format, flags, modes, error handling
- Something users READ → structure, tone, depth, flow
- Something being ORGANIZED → criteria, grouping, naming, exceptions

Generate 3-4 chapter-specific areas (not generic categories).

---

## 4. Present Gray Areas

**Step 4.1: Present gray areas to user**

Use question tool with multiSelect:
```
const areasResponse = question(questions=[{
  header: "Discussion Areas",
  question: "Which areas would you like to discuss for Chapter ${chapterNumber}?",
  options: [
    {label: "Gray area 1", description: "[brief description]"},
    {label: "Gray area 2", description: "[brief description]"},
    {label: "Gray area 3", description: "[brief description]"},
    {label: "Gray area 4", description: "[brief description]"}
  ],
  multiple: true
}])
```

**Step 4.2: Track selected areas**

```
const selectedAreas = user_response.options
```

User must select at least one area.

---

## 5. Deep-Dive Each Selected Area

**Step 5.1: Loop through selected areas**

For each selected area:

**Step 5.2: Ask up to 4 questions per area**

Questioning technique:
- Probe for specifics
- Challenge assumptions
- Make abstract concrete
- Surface constraints

Use question tool:
```
const areaResponse = question(questions=[{
  header: "[Area Name]",
  question: "More questions about [area name], or move to next area?",
  options: [
    {label: "More questions", description: "Continue deep-dive"},
    {label: "Move to next", description: "Done with this area"}
  ]
}])
```

**Step 5.3: Handle question response**

If "More questions" → ask 4 more questions and repeat.

If "Move to next" → done with this area, continue to next selected area.

**Scope guardrail:**

- Chapter boundary from roadmap is FIXED
- Discussion clarifies HOW to implement, not WHETHER to add more
- If user suggests new capabilities: "That's its own chapter. I'll note it as deferred."
- Capture deferred ideas — don't lose them, don't act on them

**Do NOT ask about:**
- Technical implementation (OpenCode handles these)
- Architecture choices (OpenCode handles these)
- Performance concerns (OpenCode handles these)
- Scope expansion (OpenCode handles these)

**Step 5.4: Track all decisions and specifics**

Accumulate across all selected areas:
- `allDecisions` — object with area names as keys and decisions per area
- `allSpecifics` — array of specific decisions captured
- `allDeferred` — array of deferred ideas captured

---

## 6. Update Chapter Context Concept

**Step 6.1: Compile context data**

After all areas explored, compile decisions into context data structure:

```
const contextData = {
  gathered: new Date().toISOString().split('T')[0],
  status: 'planned',
  chapter_boundary: chapterGoal,
  decisions: allDecisions,
  open_code_discretion: [],
  specifics: allSpecifics,
  deferred: allDeferred
}
```

**Step 6.2: Create or update context concept**

Check if context already exists (from step 2):
```
const chapterContextSlug = `chapter-${chapterNumber.toString().padStart(2, '0')}-context`
```

If contextExists === true:
→ Update existing concept:
```
megamemory_update_concept(
  id=chapterContextSlug,
  changes={
    summary: JSON.stringify(contextData)
  }
)
```

If contextExists === false:
→ Create new concept:
```
megamemory_create_concept(
  name=chapterContextSlug,
  kind="config",
  summary=JSON.stringify(contextData),
  parent_id=`chapter-${chapterNumber.toString().padStart(2, '0')}`,
  why=`Context gathered for Chapter ${chapterNumber}`
)
```

**Step 6.3: Verify concept created**

The tool returns `{id, message}` — confirm that concept was created/updated successfully before proceeding.

---

## 7. Offer Next Steps

## 7. Offer Next Steps

Use question tool:

- header: "Context Complete"
- question: "Chapter context is ready. What's next?"
- options:
  - "Research chapter" — Investigate domain ecosystem (if research enabled)
  - "Plan chapter" — Skip to planning
  - "Review context" — Show what was captured

**If user chooses "Research chapter":**

→ Query config to check research setting:
```
megamemory_understand(query="config", top_k=5)
```

Extract and check:
```
const configData = JSON.parse(response.matches[0].summary)
const researchEnabled = configData.workflow?.research !== false
```

If researchEnabled === true:
→ Suggest: `/fuska-plan ${chapterNumber} --research`

If researchEnabled === false:
→ Display: "Research is disabled in config. Research chapter is not available."
→ Re-offer completion options

**If user chooses "Plan chapter":**

→ Suggest: `/fuska-plan ${chapterNumber}`

**If user chooses "Review context":**

→ Display: contextData
→ Re-offer completion options

</process>

<offer_next>

Output this markdown directly (not as a code block):

```
---------------------------------------------------------
 Fuska: Context gathered
--------------------------------------------------------

**Chapter ${chapterNumber}: ${chapterName || 'Unnamed'}**

Decisions captured:
${Object.keys(allDecisions || {}).map(area => `- ${area}: ${allDecisions[area] || 'No decisions'}`).join('\n') || 'No decisions captured'}

Deferred ideas:
${allDeferred.map(deferred => `- ${deferred}`).join('\n') || 'No deferred ideas'}

──────────────────────────────────────────────────────────────

## > Next Up

**Research Chapter ${chapterNumber}** — investigate domain ecosystem
/fuska-plan ${chapterNumber} --research

**Or skip to planning:**

**Plan Chapter ${chapterNumber}** — create execution plans directly
/fuska-plan ${chapterNumber}

*/new first → fresh context window*

──────────────────────────────────────────────────────────────
```

</offer_next>

<success_criteria>

- [ ] Chapter number validated against roadmap
- [ ] Step 1.8 surfaced relevant assumptions
- [ ] User confirmed or corrected assumptions before discussion
- [ ] Existing chapter context checked (offered update/view/skip if found)
- [ ] Gray areas identified through intelligent analysis
- [ ] User chose which areas to discuss
- [ ] Each selected area explored until satisfied (4+ questions per area)
- [ ] Scope creep redirected to deferred ideas
- [ ] Chapter context concept created or updated
- [ ] Decisions are specific enough for downstream agents
- [ ] User knows next steps (research or planning)

</success_criteria>
