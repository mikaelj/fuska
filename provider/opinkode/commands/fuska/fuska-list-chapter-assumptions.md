---
name: fuska-list-chapter-assumptions
description: Surface OpenCode's assumptions about a chapter approach before planning using MegaMemory
argument-hint: "[chapter]"
tools:
  - read
  - bash
  - grep
  - glob

  - megamemory:understand
  - megamemory:list_roots
---

<objective>
Analyze a chapter and present OpenCode's assumptions about technical approach, implementation order, scope boundaries, risk areas, and dependencies.

Purpose: Help users see what OpenCode thinks BEFORE planning begins - enabling course correction early when assumptions are wrong.
Output: Conversational output only (no concept creation) - ends with "What do you think?" prompt

Uses MegaMemory to query project state and roadmap data.
</objective>

 <execution_context>

@../../fuska/references/megamemory-quick-ref.md
 @../../fuska/references/preflight-check-initiative-exists.md
 @../../fuska/workflows/list-chapter-assumptions.md
 </execution_context>

<context>
Chapter number: `$ARGUMENTS` (required)

**Load project state from MegaMemory:**
```
megamemory_understand(query="state", top_k=5)
```

**Load roadmap from MegaMemory:**
```
megamemory_understand(query="roadmap", top_k=5)
```
</context>

<process>

## 0. Preflight Check

Follow the MegaMemory Initiative Exists Preflight Check from @preflight-check-initiative-exists.md.

**Follow this process to list chapter assumptions:**

## 1. Validate Chapter Number

**Step 1.1: Check argument provided**

If `$ARGUMENTS` is empty or missing:
→ Display: "Please provide a chapter number"
→ Example: `/fuska-list-chapter-assumptions 3`
→ Stop

**Step 1.2: Extract chapter number**

Parse arguments to extract chapter number. The variable `input` contains the raw argument string.

```
const chapterMatch = input.match(/\d+/)
if (!chapterMatch) {
  Display: "Invalid chapter number format"
  Stop
}
const chapterNumber = parseInt(chapterMatch[0])
```

**Step 1.3: Normalize chapter to slug**

```
const chapterSlug = `chapter-${chapterNumber.toString().padStart(2, '0')}`
```

## 2. Validate Initiative Exists

**Step 2.1: Check MegaMemory has projects**

```
megamemory_list_roots()
```

If response.roots.length === 0:
→ Display: "No initiatives found in MegaMemory"
→ Suggest: "Run fuska init to initialize initiative"
→ Stop

## 3. Validate Chapter Exists in Roadmap

**Step 3.1: Query roadmap concept**

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
const roadmapSummaryString = response.matches[0].summary
const roadmapData = JSON.parse(roadmapSummaryString)

const chapters = roadmapData.chapters
const chapterExists = chapters.some(p => p.number === chapterNumber)
```

**Step 3.4: Check if chapter exists**

If chapterExists === false:
→ Display: `Chapter ${chapterNumber} not found in roadmap`
→ Suggest: "Available chapters: " + chapters.map(p => `Chapter ${p.number}: ${p.name}`).join(', ')
→ Stop

## 4. Load Chapter Context

**Step 4.1: Query chapter concept**

```
megamemory_understand(query=chapterSlug, top_k=5)
```

**Step 4.2: Extract chapter data**

If response.matches.length > 0:
```
const chapterSummaryString = response.matches[0].summary
const chapterData = JSON.parse(chapterSummaryString)

const chapterName = chapterData.name
const chapterGoal = chapterData.goal
```

## 5. Query Related Concepts

**Step 5.1: Query requirements**

```
megamemory_understand(query="requirements", top_k=50)
```

**Step 5.2: Extract requirements related to chapter**

If response.matches.length > 0:
```
const chapterRequirements = response.matches
  .filter(match => {
    const summaryString = match.summary
    const reqData = JSON.parse(summaryString)
    return reqData.chapter === chapterNumber
  })
  .map(match => {
    const summaryString = match.summary
    const reqData = JSON.parse(summaryString)
    return { id: match.id, description: reqData.description, priority: reqData.priority }
  })
```

**Step 5.3: Query chapter research (if exists)**

```
megamemory_understand(query=`${chapterSlug}-research`, top_k=1)
```

If response.matches.length > 0:
```
const researchSummaryString = response.matches[0].summary
const researchData = JSON.parse(researchSummaryString)
```

**Step 5.4: Query chapter context (if exists)**

```
megamemory_understand(query=`${chapterSlug}-context`, top_k=1)
```

If response.matches.length > 0:
```
const contextSummaryString = response.matches[0].summary
const contextData = JSON.parse(contextSummaryString)
```

**Step 5.5: Query project state**

```
megamemory_understand(query="state", top_k=5)
```

If response.matches.length > 0:
```
const stateSummaryString = response.matches[0].summary
const stateData = JSON.parse(stateSummaryString)

const completedChapters = stateData.completed_chapters || []
```

## 6. Surface Assumptions

Based on the gathered data, surface assumptions across five areas:

### 6.1 Technical Approach

From chapter goal and research:
- What tech stack is assumed?
- What architecture patterns are expected?
- What frameworks/libraries will be used?

Display:
```
**Technical Approach:**
- [Assumption 1]
- [Assumption 2]
- [Assumption 3]
```

### 6.2 Implementation Order

From roadmap sequence and dependencies:
- What should be built first?
- What depends on what?
- What's the critical path?

Display:
```
**Implementation Order:**
1. [First thing to build]
2. [Second thing - depends on 1]
3. [Third thing - depends on 2]
```

### 6.3 Scope Boundaries

From requirements and chapter context:
- What's definitely IN scope?
- What's definitely OUT of scope?
- What's unclear and needs clarification?

Display:
```
**Scope Boundaries:**
**In scope:**
- [Requirement 1]
- [Requirement 2]

**Out of scope:**
- [Deferred item 1]
- [Deferred item 2]

**Needs clarification:**
- [Unclear item]
```

### 6.4 Risk Areas

From chapter context, research findings, and prior decisions:
- What are the technical risks?
- What are the integration risks?
- What could go wrong?

Display:
```
**Risk Areas:**
- [Risk 1]: [Mitigation]
- [Risk 2]: [Mitigation]
- [Risk 3]: [Mitigation]
```

### 6.5 Dependencies

From chapter data and completed chapters:
- What external services are needed?
- What depends on other chapters?
- What needs to be in place first?

Display:
```
**Dependencies:**
- External: [Service/API]
- Chapter dependencies: [Chapter X must complete first]
- Data dependencies: [Data must be available]
```

## 7. Present and Prompt

**Step 7.1: Display formatted assumptions**

```
-----------------------------------------------------
 Fuska: CHAPTER {X} ASSUMPTIONS
-----------------------------------------------------

**Chapter {X}: {Chapter Name}**

Goal: {chapter_goal}

────────────────────────────────────────────────────────────

[Technical Approach section]
[Implementation Order section]
[Scope Boundaries section]
[Risk Areas section]
[Dependencies section]

────────────────────────────────────────────────────────────
```

**Step 7.2: Prompt for feedback**

```
What do you think?

**Options:**
1. "Looks good, proceed to planning" — These assumptions are correct
2. "Clarify something" — I need to discuss a specific assumption
3. "Correct assumptions" — One or more assumptions are wrong
4. "Add more detail" — Expand on a specific area
```

**Step 7.3: Wait for user response**

Use question tool:
```
const feedbackResponse = question(questions=[{
  header: "Assumption Feedback",
  question: "How do these assumptions look?",
  options: [
    {label: "Looks good", description: "Proceed to planning"},
    {label: "Clarify", description: "Discuss a specific assumption"},
    {label: "Correct", description: "Fix wrong assumptions"},
    {label: "Add detail", description: "Expand on an area"}
  ]
}])
```

## 8. Handle User Response

**Step 8.1: "Looks good"**

→ Display: "Great! Ready to plan Chapter {X}"
→ Suggest: `/fuska-plan {X}`

**Step 8.2: "Clarify something"**

→ Ask which area or assumption
→ Provide more detail based on available context
→ Re-prompt for feedback

**Step 8.3: "Correct assumptions"**

→ Ask which assumptions are wrong
→ Provide corrected context
→ Ask if they want to design chapter first: `/fuska-design {X}`
→ Re-prompt for feedback

**Step 8.4: "Add more detail"**

→ Ask which area needs expansion
→ Provide more detailed analysis
→ Re-prompt for feedback

</process>

<success_criteria>

- [ ] Chapter number validated against roadmap concept
- [ ] Project exists in MegaMemory
- [ ] Chapter concept loaded
- [ ] Requirements, research, context, state queried
- [ ] Assumptions surfaced across five areas
- [ ] User prompted for feedback
- [ ] User knows next steps (discuss context, plan chapter, or correct assumptions)

</success_criteria>
