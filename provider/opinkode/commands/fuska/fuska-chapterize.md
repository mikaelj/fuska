---
name: fuska-chapterize
description: Transform large plans or planning context into chapter structures with subplans
argument-hint: "[plan-id] [--research]"
flags: --research
tools:
  - read
  - bash
  - question
  - task
  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
  - megamemory:link
---

<objective>

Transform large plans (>5 tasks) OR current planning context into chapter structures with subplans, supporting both explicit mode (plan-id) and context mode (no args), with interactive research prompt.

- Explicit mode: Load plan from MegaMemory by ID, break into chapter with subplans
- Context mode: Use current conversation context to create chapter from planning discussion
- Optional research phase: Query MegaMemory for domain patterns before creating subplans
- Interactive: Prompts user for chapter details and research preference

</objective>

<execution_context>

@../../fuska/references/preflight-check-initiative-exists.md
@../../fuska/references/megamemory-quick-ref.md
@../../fuska/references/model-resolution.md

</execution_context>

<context>
Arguments: `$ARGUMENTS`
</context>

<process>

## 1. Preflight Check

Follow the MegaMemory Initiative Exists Preflight Check from @preflight-check-initiative-exists.md.

Check MegaMemory connection:
```
const roots = await megamemory:list_roots()
if (!roots || roots.length === 0) {
  Display: "No MegaMemory connection. Run `fuska init` first."
  Stop
}
```

---

## 2. Mode Detection

Parse arguments to determine mode:

```
const input = "$ARGUMENTS" || ""
const words = input.trim().split(/\s+/)
const hasResearchFlag = input.includes("--research")

let MODE = null  // "explicit" or "context"
let PLAN_ID = null
let RESEARCH_ENABLED = false

// Check for plan-id argument (starts with "task-" or is alphanumeric)
if (words[0] && (words[0].startsWith("task-") || /^[a-z0-9-]+$/i.test(words[0]))) {
  MODE = "explicit"
  PLAN_ID = words[0].replace(/^task-/, '')
  if (hasResearchFlag) {
    RESEARCH_ENABLED = true
  }
} else {
  MODE = "context"
  if (hasResearchFlag) {
    RESEARCH_ENABLED = true
  }
}
```

---

## 3. Explicit Mode: Load Plan from MegaMemory

**Only execute if MODE === "explicit"**

**Step 3.1: Load plan concept**
```
const planResult = await megamemory:understand({
  query: PLAN_ID,
  top_k: 5
})

if (planResult.concepts.length === 0) {
  Display: `Plan concept not found: ${PLAN_ID}`
  Stop
}

const planConcept = planResult.concepts[0]
const planData = JSON.parse(planConcept.summary)

// Validate plan has enough tasks
const taskCount = planData.tasks ? planData.tasks.length : 0
if (taskCount < 3) {
  Display: `Plan has only ${taskCount} tasks. Chapterization works best with 3+ tasks.`
  Stop
}
```

**Step 3.2: Prompt for chapter details**
```
const chapterDetails = await question({
  questions: [{
    question: "Chapter name (e.g., 'User Authentication')",
    header: "Chapter Name",
    options: []
  }, {
    question: "Chapter goal (outcome, not task)",
    header: "Chapter Goal", 
    options: []
  }, {
    question: "Chapter number (e.g., '01')",
    header: "Chapter Number",
    options: []
  }]
})

const chapterName = chapterDetails[0]
const chapterGoal = chapterDetails[1]
const chapterNumber = chapterDetails[2]
```

**Step 3.3: Interactive research prompt (if no --research flag)**
```
if (!hasResearchFlag) {
  const researchChoice = await question({
    questions: [{
      question: "Do you want to research the domain for chapter subplans?",
      header: "Research?",
      options: [
        { label: "Yes", description: "Query MegaMemory for domain patterns before creating subplans" },
        { label: "No", description: "Skip research and create subplans directly from plan tasks" }
      ]
    }]
  })
  
  RESEARCH_ENABLED = (researchChoice[0] === "Yes")
}
```

**Step 3.4: Continue to Step 5**

---

## 4. Context Mode: Use Current Conversation Context

**Only execute if MODE === "context"**

**Step 4.1: Display mode detected**
```
Display: "Context mode detected. Will create chapter from current planning context."
```

**Step 4.2: Prompt for chapter details**
```
const chapterDetails = await question({
  questions: [{
    question: "Chapter name (e.g., 'User Authentication')",
    header: "Chapter Name",
    options: []
  }, {
    question: "Chapter goal (outcome, not task)",
    header: "Chapter Goal",
    options: []
  }]
})

const chapterName = chapterDetails[0]
const chapterGoal = chapterDetails[1]
```

**Step 4.3: Interactive research prompt (if no --research flag)**
```
if (!hasResearchFlag) {
  const researchChoice = await question({
    questions: [{
      question: "Do you want to research this domain before chapterizing?",
      header: "Research?",
      options: [
        { label: "Yes", description: "Query MegaMemory for domain patterns before creating subplans" },
        { label: "No", description: "Skip research and create subplans directly" }
      ]
    }]
  })
  
  RESEARCH_ENABLED = (researchChoice[0] === "Yes")
}
```

**Step 4.4: Extract context from conversation**

The fuska-plan-chapterizer agent will receive the current conversation context. Extract what's being discussed:

```
// These will be extracted from the conversation by the agent
const contextData = {
  chapterName: chapterName,
  chapterGoal: chapterGoal,
  objective: "From current conversation context",
  purpose: "From current conversation context",
  tasks: "Will be extracted from conversation by agent",
  researchEnabled: RESEARCH_ENABLED
}
```

**Step 4.5: Continue to Step 5**

---

## 5. Spawn fuska-plan-chapterizer Agent

**Step 5.1: Build agent prompt**

For **explicit mode**:
```
const agentPrompt = `<critical_constraints>
Return: ## CHAPTERIZE COMPLETE with chapter slug, subplan count, task distribution
Create chapter concept and subplan concepts in MegaMemory
MUST update roadmap concept via update_roadmap_array step

EXECUTION GUARANTEES:
- ALWAYS complete all steps - NEVER stop early to ask user questions
- NEVER ask user "what should I do next?" or "Create and execute plan?"
- If research exists: LOG warning and continue with chapter creation
- MUST create chapter concept
- MUST create subplan concepts
- MUST return ## CHAPTERIZE COMPLETE
</critical_constraints>

<chapterize_context>
**Mode:** explicit
**Plan Concept ID:** ${PLAN_ID}
**Research Enabled:** ${RESEARCH_ENABLED}
**Chapter Name:** ${chapterName}
**Chapter Goal:** ${chapterGoal}
**Chapter Number:** ${chapterNumber}

**Plan Data:**
${JSON.stringify(planData, null, 2)}
</chapterize_context>

Execute chapterization:
1. Load plan tasks from concept: ${PLAN_ID}
2. ${RESEARCH_ENABLED ? "Query MegaMemory for domain patterns" : "Skip research phase"}
3. Analyze tasks and group into subplans (2-3 tasks each, vertical slices preferred)
4. Compute dependency graph and batch numbers
5. Create chapter concept
6. Create subplan concepts following fuska-planner structure
7. ${RESEARCH_ENABLED ? "Create chapter-research concept with findings" : "Skip research concept creation"}
8. Create edges for relationships
</chapterize_context>`
```

For **context mode**:
```
const agentPrompt = `<critical_constraints>
Return: ## CHAPTERIZE COMPLETE with chapter slug, subplan count, task distribution
Create chapter concept and subplan concepts in MegaMemory
MUST update roadmap concept via update_roadmap_array step
Extract tasks from current conversation context

EXECUTION GUARANTEES:
- ALWAYS complete all steps - NEVER stop early to ask user questions
- NEVER ask user "what should I do next?" or "Create and execute plan?"
- If research exists: LOG warning and continue with chapter creation
- MUST create chapter concept
- MUST create subplan concepts
- MUST return ## CHAPTERIZE COMPLETE
</critical_constraints>

<chapterize_context>
**Mode:** context
**Research Enabled:** ${RESEARCH_ENABLED}
**Chapter Name:** ${chapterName}
**Chapter Goal:** ${chapterGoal}

<context>
Extract from current conversation:
- Objective being discussed
- Purpose of the work
- Tasks being planned (each with name, action, files)
</context>

Execute chapterization:
1. Extract objective, purpose, tasks from conversation context
2. ${RESEARCH_ENABLED ? "Query MegaMemory for domain patterns" : "Skip research phase"}
3. Analyze tasks and group into subplans (2-3 tasks each, vertical slices preferred)
4. Compute dependency graph and batch numbers
5. Create chapter concept
6. Create subplan concepts following fuska-planner structure
7. ${RESEARCH_ENABLED ? "Create chapter-research concept with findings" : "Skip research concept creation"}
8. Create edges for relationships
</chapterize_context>`
```

**Step 5.2: Spawn agent**

```
Task(
  subagent_type="fuska-plan-chapterizer",
  model=models.planner,  // Use planner model from config
  description="Chapterize plan into chapter structure",
  prompt=agentPrompt
)
```

**Step 5.3: Handle agent return**

If `## CHAPTERIZE COMPLETE`:
- Display chapterization results
- Display: "Chapter added to roadmap"
- Stop

If error:
- Display error
- Stop

---

## 6. Display Usage Examples

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Fuska > /fuska-chapterize
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Usage:
  /fuska-chapterize task-015-large-feature
  → Explicit mode: Load plan from MegaMemory

  /fuska-chapterize
  → Context mode: Use current planning context

  /fuska-chapterize task-015-large-feature --research
  → Explicit mode with research enabled (skip prompt)

Flags:
  --research    Enable research phase (skip interactive prompt)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

</process>

<success_criteria>

- [ ] Preflight passes, MegaMemory connection verified
- [ ] Mode correctly detected (explicit vs context)
- [ ] Explicit mode: Plan concept loaded and validated (>3 tasks)
- [ ] Interactive prompts for chapter details (name, goal, number)
- [ ] Interactive research prompt (if no --research flag)
- [ ] fuska-plan-chapterizer agent spawned with correct context
- [ ] Chapterization results displayed
- [ ] User knows chapter is ready for implementation

</success_criteria>
