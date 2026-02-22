---
name: fuska-research-chapter
description: Research how to implement a chapter (standalone - usually use /fuska-plan instead) using MegaMemory
argument-hint: "[chapter]"
agent: @../../agents/fuska/fuska-chapter-researcher.md
tools:
  - read
  - bash
  - webfetch
  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
  - megamemory:list_roots

---

<objective>
Research how to implement a chapter using MegaMemory. Spawns fuska-chapter-researcher agent with chapter context.

**Note:** This is a standalone research command. For most workflows, use `/fuska-plan` which integrates research automatically.

**Use this command when:**
- You want to research without planning yet
- You want to re-research after planning is complete
- You need to investigate before deciding if a chapter is feasible

**Orchestrator role:** Parse chapter, validate against roadmap, check existing research, gather context, spawn researcher agent, present results.

**Why subagent:** Research burns context fast (webfetch, web searches, source verification). Fresh context for investigation. Main context stays lean for user interaction.
</objective>

<execution_context>

@../../fuska/references/megamemory-quick-ref.md
@../../fuska/references/preflight-check-initiative-exists.md
@../../fuska/scripts/types.ts
@../../fuska/scripts/chapter-templates.ts
</execution_context>

<context>
Chapter number: `$ARGUMENTS` (required)

Normalize chapter input in step 1 before any MegaMemory lookups.
</context>

<process>

## 0. Preflight Check

Follow the MegaMemory Initiative Exists Preflight Check from @preflight-check-initiative-exists.md.

## 0. Validate MegaMemory

**Step 0.1: Call list_roots**
```
megamemory_list_roots()
```

**Step 0.2: Check for empty results**

If response.roots.length === 0:
→ Display: "No initiatives found in MegaMemory"
→ Suggest: "Run fuska init to initialize initiative"
→ Stop

**Step 0.3: Query config concept**
```
megamemory_understand(query="config", top_k=5)
```

**Step 0.4: Extract config data**
```
const configSummaryString = response.matches[0].summary
const configData = JSON.parse(configSummaryString)

const modelProfile = configData.model_profile || "balanced"
```

**Model lookup table (uses aliases):**

First, extract model aliases from config (with defaults):
```
const aliases = configData.model_aliases || {
  quality_model: "opencode/claude-opus-4",
  balanced_model: "opencode/claude-sonnet-4",
  budget_model: "opencode/claude-haiku-4"
}
```

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| fuska-chapter-researcher | quality_model | balanced_model | budget_model |

```
const modelLookup = {
  quality: { researcher: aliases.quality_model },
  balanced: { researcher: aliases.balanced_model },
  budget: { researcher: aliases.budget_model }
}
const models = modelLookup[modelProfile]
```

Store resolved model for use in Task calls below.

## 1. Normalize and Validate Chapter

**Step 1.1: Normalize chapter input**
```bash
# input contains the raw argument string provided by the user
# Normalize chapter number (8 → 08, but preserve decimals like 2.1 → 02.1)
if [[ "$input" =~ ^[0-9]+$ ]]; then
  CHAPTER=$(printf "%02d" "$input")
elif [[ "$input" =~ ^([0-9]+)\.([0-9]+)$ ]]; then
  CHAPTER=$(printf "%02d.%s" "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}")
else
  CHAPTER="$input"
fi
```

**Step 1.2: Query chapter concept**
```
megamemory_understand(query=`${CHAPTER}`, top_k=5)
```

**Step 1.3: Check chapter exists**

If response.matches.length === 0:
→ Display: `Chapter ${CHAPTER} not found in MegaMemory`
→ Suggest: "Query available chapters using megamemory:understand(query='roadmap', top_k=10)"
→ Stop

**Step 1.4: Extract chapter data**
```
const chapterSummaryString = response.matches[0].summary
const chapterData = JSON.parse(chapterSummaryString)

const chapterNumber = chapterData.number
const chapterName = chapterData.name
const chapterGoal = chapterData.goal
const chapterId = response.matches[0].id
```

## 2. Check Existing Research

**Step 2.1: Query research concept**
```
megamemory_understand(query=`${CHAPTER}-research`, top_k=1)
```

**Step 2.2: Check for existing research**

If response.matches.length > 0:
→ Display: "Research already exists for this chapter"
→ Use question tool:
```
const researchResponse = question(questions=[{
  header: "Existing Research",
  question: "Research already exists for this chapter. What would you like to do?",
  options: [
    {label: "Update research", description: "Re-research and update existing concept"},
    {label: "View existing", description: "Show current research content"},
    {label: "Skip", description: "Keep existing research, exit"}
  ]
}])
```

If user chooses "View existing":
→ Display research content
→ Re-prompt question

If user chooses "Skip":
→ Stop

If user chooses "Update research":
→ Continue to step 3

If doesn't exist:
→ Continue to step 3

## 3. Gather Chapter Context

**Step 3.1: Query requirements**
```
megamemory_understand(query="requirements", top_k=50)
```

**Step 3.2: Extract requirement data**
```
const requirements = response.matches.map(match => {
  const summaryString = match.summary
  const reqData = JSON.parse(summaryString)
  return {
    id: match.id,
    description: reqData.description,
    status: reqData.status
  }
})
```

**Step 3.3: Query chapter context (if exists)**
```
megamemory_understand(query=`${CHAPTER}-context`, top_k=1)
```

**Step 3.4: Extract context data (if exists)**
```
let contextData = null
if (response.matches.length > 0) {
  const contextSummaryString = response.matches[0].summary
  contextData = JSON.parse(contextSummaryString)
}
```

**Step 3.5: Query state**
```
megamemory_understand(query="state", top_k=1)
```

**Step 3.6: Extract state data**
```
const stateSummaryString = response.matches[0].summary
const stateData = JSON.parse(stateSummaryString)
```

Present summary with chapter description, requirements, prior decisions.

## 4. Spawn fuska-chapter-researcher Agent

**Step 4.1: Build research prompt**
```
<research_type>
Chapter Research — investigating HOW to implement a specific chapter well.
</research_type>

<key_insight>
The question is NOT "which library should I use?"

The question is: "What do I not know that I don't know?"

For this chapter, discover:
- What's the established architecture pattern?
- What libraries form the standard stack?
- What problems do people commonly hit?
- What's SOTA vs what OpenCode's training thinks is SOTA?
- What should NOT be hand-rolled?
</key_insight>

<objective>
Research implementation approach for Chapter ${chapterNumber}: ${chapterName}
Mode: ecosystem
</objective>

<context>
**Chapter description:**
Number: ${chapterNumber}
Name: ${chapterName}
Goal: ${chapterGoal}

**Requirements:**
${requirements.map(r => `- ${r.description} (${r.status})`).join('\n') || 'No requirements found'}

**Prior decisions:**
Current Chapter: ${stateData.current_chapter || 'None'}
Status: ${stateData.status || 'Unknown'}
Progress: ${stateData.progress || 0}%

**Chapter context (if any):**
${contextData ? JSON.stringify(contextData, null, 2) : 'No context found'}
</context>

<downstream_consumer>
Your research concept will be loaded by `/fuska-plan` which uses specific sections:
- `## Standard Stack` → Plans use these libraries
- `## Architecture Patterns` → Task structure follows these
- `## Don't Hand-Roll` → Tasks NEVER build custom solutions for listed problems
- `## Common Pitfalls` → Verification steps check for these
- `## Code Examples` → Task actions reference these patterns

Be prescriptive, not exploratory. "Use X" not "Consider X or Y."
</downstream_consumer>

<quality_gate>
Before declaring complete, verify:
- [ ] All domains investigated (not just some)
- [ ] Negative claims verified with official docs
- [ ] Multiple sources for critical claims
- [ ] Confidence levels assigned honestly
- [ ] Section names match what plan-chapter expects
</quality_gate>

<output>
Create/update research concept: ${CHAPTER}-research
Use: megamemory:create_concept() or megamemory:update_concept()
</output>
```

**Step 4.2: Spawn researcher**
```
Task(
  description=`Research Chapter ${chapterNumber}`,
  subagent_type="fuska-chapter-researcher",
  variant="plan",
  model=researcherModel,
  prompt=researchPrompt
)
```

## 5. Handle Agent Return

**`## RESEARCH COMPLETE`:**
→ Display summary from researcher
→ Update state concept with research completion
→ Offer: Plan chapter, Dig deeper, Review full, Done

**Step 5.1: Update state concept**
```
const updatedStateData = {
  ...stateData,
  research_completed: true
}

megamemory_update_concept(
  id=stateId,
  changes={
    summary: JSON.stringify(updatedStateData)
  }
)
```

**Step 5.2: Present options**
```
const nextResponse = question(questions=[{
  header: "Research Complete",
  question: "What would you like to do next?",
  options: [
    {label: "Plan chapter", description: "Create execution plans for this chapter"},
    {label: "Dig deeper", description: "Research specific aspects in more detail"},
    {label: "Review full", description: "View complete research content"},
    {label: "Done", description: "Exit, research saved to MegaMemory"}
  ]
}])
```

**`## CHECKPOINT REACHED`:**
→ Present checkpoint to user
→ Use question tool:
```
const checkpointResponse = question(questions=[{
  header: "Research Checkpoint",
  question: "Research has reached a checkpoint. How would you like to proceed?",
  options: [
    {label: "Provide context", description: "I'll provide additional context"},
    {label: "Continue", description: "Resume research from checkpoint"},
    {label: "Manual", description: "Take manual control"}
  ]
}])
```

If user chooses "Provide context":
→ Gather additional context from user
→ Spawn continuation agent (step 6)

If user chooses "Continue":
→ Spawn continuation agent (step 6)

If user chooses "Manual":
→ Stop

**`## RESEARCH INCONCLUSIVE`:**
→ Show what was attempted
→ Offer: Add context, Try different mode, Manual

## 6. Spawn Continuation Agent

**Step 6.1: Build continuation prompt**
```
<objective>
Continue research for Chapter ${chapterNumber}: ${chapterName}
</objective>

<prior_state>
Research concept: @${CHAPTER}-research
</prior_state>

<checkpoint_response>
**Type:** ${checkpoint_type}
**Response:** ${user_response}
</checkpoint_response>
```

**Step 6.2: Spawn continuation**
```
Task(
  description="Continue research Chapter ${chapterNumber}",
  subagent_type="fuska-chapter-researcher",
  variant="plan",
  model=researcherModel,
  prompt=continuationPrompt
)
```

</process>

<success_criteria>
- [ ] MegaMemory validated (roots exist)
- [ ] Chapter validated against roadmap (chapter concept exists)
- [ ] Existing research checked
- [ ] fuska-chapter-researcher spawned with context
- [ ] Checkpoints handled correctly
- [ ] User knows next steps
</success_criteria>
