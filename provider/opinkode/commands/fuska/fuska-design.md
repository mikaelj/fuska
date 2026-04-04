---
name: fuska-design
description: Gather chapter context through adaptive questioning before planning using MegaMemory
argument-hint: "<chapter>"
tools:
  - read
  - bash
  - task
  - question
  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
---

<output_requirements>
OUTPUT FORMAT REQUIREMENTS:
- MUST output chapter overview banner before asking questions
- MUST output assumptions template before asking for feedback
- MUST output completion summary when done
- MUST NOT skip text output and jump directly to question tool
- MUST display all context (name, goal, status) visibly to user
- MUST substitute variables with actual values from MegaMemory
- MUST format output as markdown, not as code blocks
</output_requirements>

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

**Load all concepts upfront:**
```
const allConcepts = megamemory_understand(query="config state chapter roadmap", top_k=10000)
const nodeMap = new Map(allConcepts.matches?.map(n => [n.id, n]) || [])
```

**Layer 1 - Initiative Scoping:**
```
const configNode = allConcepts.matches?.find(n => {
  if (n.name !== 'config' || n.kind !== 'config') return false
  try {
    const data = JSON.parse(n.summary)
    return 'current_initiative' in data
  } catch {
    return false
  }
})

if (!configNode) {
  console.error('No config concept with current_initiative found')
  process.exit(1)
}

const currentInitiative = JSON.parse(configNode.summary).current_initiative
const initiativeRoot = allConcepts.matches?.find(n =>
  n.name === currentInitiative &&
  n.kind === 'feature' &&
  !n.parent_id
)

if (!initiativeRoot) {
  console.error(`Initiative ${currentInitiative} not found`)
  process.exit(1)
}

const initiativeId = initiativeRoot.id
```

**Load state scoped by initiative:**
```
const stateNode = allConcepts.matches?.find(n =>
  n.name === 'state' &&
  n.kind === 'config' &&
  n.parent_id === initiativeId
)

const stateData = stateNode ? JSON.parse(stateNode.summary) : null
```

**Load chapter information scoped by initiative:**
```
const chapterNode = allConcepts.matches?.find(n =>
  n.name === chapterSlug &&
  n.kind === 'feature' &&
  n.parent_id === initiativeId
)

const chapterData = chapterNode ? JSON.parse(chapterNode.summary) : null
```

**Load roadmap with dual-path parsing:**
```
const roadmapNode = allConcepts.matches?.find(n =>
  n.name === 'roadmap' &&
  n.kind === 'module' &&
  n.parent_id === initiativeId
)

let chapters = []

if (roadmapNode) {
  try {
    const roadmapData = JSON.parse(roadmapNode.summary)
    chapters = roadmapData.chapters || []
  } catch {
    const chapterConcepts = allConcepts.matches?.filter(n =>
      n.kind === 'feature' &&
      n.name.startsWith('chapter-') &&
      n.parent_id === initiativeId
    ) || []
    chapters = chapterConcepts.map(m => {
      const chapterData = JSON.parse(m.summary)
      return {
        number: chapterData.number,
        slug: chapterData.slug,
        name: chapterData.name,
        goal: chapterData.goal
      }
    }).sort((a, b) => a.number - b.number)
  }
}
```

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

**Step 1.2: Query roadmap with initiative scoping**

The roadmap was already loaded in the context section above with dual-path parsing. Use the `chapters` array directly.

**Step 1.3: Check roadmap exists**

If chapters.length === 0:
→ Display: "No chapters found in roadmap for current initiative"
→ Suggest: "Run fuska init to initialize initiative or add chapters"
→ Stop

**Step 1.4: Find matching chapter**

```
const matchingChapter = chapters.find(p => p.number === chapterNumber)
```

**Step 1.5: Validate chapter exists**

If !matchingChapter:
→ Display: `Chapter ${chapterNumber} not found in roadmap`
→ Display: "Available chapters:"
for (const chapter of chapters) {
  Display: `- Chapter ${chapter.number}: ${chapter.name}`
}
→ Stop

---

## 1.7. Present Chapter Design Overview

**Step 1.7.1: Use chapter data from context**

The chapter was already loaded in the context section above. Use the `chapterData` variable directly.

```
const chapterName = chapterData.name
const chapterGoal = chapterData.goal
const chapterStatus = chapterData.status
```

**Step 1.7.3: Display design session overview**

**CRITICAL: Output this text directly to the user as markdown. Do NOT use tool calls for this output:**

```
-----------------------------------------------------
  Fuska: Chapter {chapterNumber} Design Session
-----------------------------------------------------

**Chapter {chapterNumber}: {chapterName}**

Goal: {chapterGoal}
Status: {chapterStatus}

This session gathers context and decisions to guide planning.
You'll discuss implementation choices for this chapter.

────────────────────────────────────────────────────────
```

**❌ WRONG - DO NOT DO THIS:**
- Load chapter data from MegaMemory silently
- Jump directly to question tool without context
- Skip displaying the chapter overview banner
- Output banner as code block instead of markdown

**✅ CORRECT - ALWAYS DO THIS:**
- Output the banner and chapter overview text FIRST
- THEN use question tool to gather user feedback
- Show all context (name, goal, status) before asking questions
- Format output as markdown text, not code blocks
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

## 1.7.5. Vision Pre-Processing (if images detected)

Extract model aliases from config:
```
const designConfigData = JSON.parse(configNode.summary)
const aliases = designConfigData.model_aliases || {}
const visionModel = aliases.vision_model || aliases.quality_model
const visionMode = aliases.vision_model ? "native" : "mcp"
```

Look up research node for image scanning:
```
const researchNode = allConcepts.concepts?.find(n =>
  n.name === `${chapterSlug}-research` && n.parent_id === initiativeId
)
```

Scan chapter goal and research data for image file paths:
```
const imagePattern = /(?:^|\s)(\S+\.(?:png|jpe?g|gif|bmp|webp|svg))(?:\s|$)/gi
const goalText = chapterData?.goal || ""
const researchText = researchNode ? JSON.stringify(JSON.parse(researchNode.summary)) : ""
const allText = `${goalText} ${researchText}`
const imageMatches = [...allText.matchAll(imagePattern)]
const uniqueImages = [...new Map(imageMatches.map(m => [m[1].trim(), m[1].trim()])).values()]
```

If no images found: skip to Step 1.8.

Display: `Vision: Analyzing ${uniqueImages.length} image(s)...`

For each image, spawn fuska-vision-reader:
```
Task(
  subagent_type="fuska-vision-reader",
  model=visionModel,
  description=`Analyze image: ${imagePath}`,
  prompt=`<vision_mode>${visionMode}</vision_mode>
${visionMode === "native" ? "<critical>Do NOT call any MCP vision tools (vision_analyze_image, etc.). You MUST analyze the image using your native model vision only. MCP tools are for fallback mode only.</critical>" : ""}

<objective>Analyze the image at ${imagePath} for chapter design context.</objective>

<image_context>
Path: ${imagePath}
Task: Design chapter ${chapterNumber} — ${chapterData?.goal || ""}
</image_context>

<output>
Return: ## VISION COMPLETE with Visual Facts and Suggested Fix Plan
</output>`
)
```

Error handling: If vision-reader returns `## VISION FAILED`, log warning and continue. If ALL images fail, proceed without vision context.

Collect results:
```
const visionContext = visionResults.filter(r => !r.text.includes('VISION FAILED')).map(r => r.text).join('\n---\n')
```

Include visionContext in Step 1.8 (Surface Assumptions) — visual observations inform assumption validation.

---

## 1.8. Surface Assumptions

After presenting the chapter overview, surface OpenCode's assumptions before discussion begins. This enables course correction early when assumptions are wrong.

**Step 1.8.1: Query related concepts scoped by initiative**

```
const researchNode = allConcepts.matches?.find(n =>
  n.name === `${chapterSlug}-research` &&
  n.parent_id === chapterNode?.id
)

const requirementNodes = allConcepts.matches?.filter(n =>
  n.kind === 'feature' &&
  n.name.startsWith('req-') &&
  n.parent_id === initiativeId
) || []
```

**Step 1.8.2: Extract related data**

From requirementNodes, filter those related to this chapter. From researchNode, extract domain insights. From stateData (already loaded), get completed chapters for dependency context.

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
**CRITICAL: Output this text directly to the user as markdown. Do NOT use tool calls for this output:**

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

**❌ WRONG - DO NOT DO THIS:**
- Skip displaying assumptions before asking questions
- Ask "How do these assumptions look?" without showing them
- Output assumptions as code block instead of formatted markdown
- Skip any of the 5 assumption areas

**✅ CORRECT - ALWAYS DO THIS:**
- Display all 5 assumption areas FIRST
- THEN ask for user feedback on assumptions
- Format as markdown headers and lists
- Include all areas: Technical Approach, Implementation Order, Scope Boundaries, Risk Areas, Dependencies

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

**CRITICAL: Output this text directly to the user as markdown. Do NOT use tool calls for this output:**

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

**❌ WRONG - DO NOT DO THIS:**
- Skip completion summary output
- Jump directly to next step suggestion
- Output summary as code block

**✅ CORRECT - ALWAYS DO THIS:**
- Display completion summary after design session
- Format as markdown with proper headers
- Show all sections: Decisions Made, Constraints, etc.

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
