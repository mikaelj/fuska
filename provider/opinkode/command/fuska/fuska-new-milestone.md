---
name: fuska-new-milestone
description: Start a new milestone cycle using MegaMemory
argument-hint: "[milestone name, e.g., 'v1.1 Notifications']"
tools:
  - read
  - bash

  - question
  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
  - megamemory:list_roots
  - webfetch

---

<objective>
Start a new milestone through unified flow using MegaMemory: questioning → research (optional) → requirements → roadmap.

This is the brownfield equivalent of new-project. The project exists, project concept has history. This command gathers "what's next", updates project concept, then continues through the full requirements → roadmap cycle.

**Creates/Updates:**
- Project concept — updated with new milestone goals
- Research concepts — domain research (optional, focuses on NEW features)
- Requirements concepts — scoped requirements for this milestone
- Roadmap concept — chapter structure (continues numbering)
- State concept — reset for new milestone

**After this command:** Run `/fuska-plan [N]` to start execution.
</objective>

<execution_context>

@../../fuska/references/megamemory-quick-ref.md
@../../fuska/references/preflight-check-initiative-exists.md
@../../fuska/scripts/types.ts
@../../fuska/scripts/chapter-templates.ts
</execution_context>

<context>
Milestone name: `$ARGUMENTS` (optional - will prompt if not provided)
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

## 2. Load Initiative Context

**Step 2.1: Query project concept**

Call:
```
megamemory_understand(query="project", top_k=5)
```

**Step 2.2: Extract project data**

If response.matches.length > 0:
```
const projectSummaryString = response.matches[0].summary
const projectData = JSON.parse(projectSummaryString)

const currentMilestone = projectData.current_milestone
const milestones = projectData.milestones || []
const validatedRequirements = projectData.validated_requirements || []
```

**Step 2.3: Query state concept**

Call:
```
megamemory_understand(query="state", top_k=5)
```

**Step 2.4: Extract state data**

If response.matches.length > 0:
```
const stateSummaryString = response.matches[0].summary
const stateData = JSON.parse(stateSummaryString)

const pendingTodos = stateData.pending_todos || []
const blockers = stateData.blockers || []
```

**Step 2.5: Load config and resolve models**

Call:
```
megamemory_understand(query="config", top_k=5)
```

If response.matches.length > 0:
```
const configSummaryString = response.matches[0].summary
const configData = JSON.parse(configSummaryString)

const modelProfile = configData.model_profile || "balanced"
const aliases = configData.model_aliases || {
  quality_model: "opencode/claude-opus-4",
  balanced_model: "opencode/claude-sonnet-4",
  budget_model: "opencode/claude-haiku-4"
}

const modelLookup = {
  quality: { researcher: aliases.quality_model, planner: aliases.quality_model },
  balanced: { researcher: aliases.balanced_model, planner: aliases.quality_model },
  budget: { researcher: aliases.budget_model, planner: aliases.balanced_model }
}

const models = modelLookup[modelProfile]
```

---

## 3. Gather Milestone Goals

**Step 3.1: Check for milestone context concept**

Call:
```
megamemory_understand(query="milestone-context", top_k=5)
```

**Step 3.2: If milestone context exists**

If response.matches.length > 0:
```
const contextSummaryString = response.matches[0].summary
const contextData = JSON.parse(contextSummaryString)

const features = contextData.features || []
const scope = contextData.scope || {}
```

Present summary for confirmation:
```
Milestone context found:
Features: ${features.join(', ')}
Scope: ${JSON.stringify(scope)}

Use this context? (yes/no)
```

If "no": Proceed to step 3.3.

**Step 3.3: If no context file**

Present what shipped in last milestone:
```
Previous milestone: ${currentMilestone}

Validated requirements:
${validatedRequirements.slice(0, 5).map(r => `- ${r}`).join('\n')}
${validatedRequirements.length > 5 ? `... and ${validatedRequirements.length - 5} more` : ''}
```

Ask: "What do you want to build next?"

Use question to explore features:
- header: "Features"
- question: "What features are you planning for this milestone?"
- multiSelect: true
- options:
  - "Feature 1" — [description]
  - "Feature 2" — [description]
  - "Type your own..."

Probe for priorities, constraints, scope.

---

## 4. Determine Milestone Version

**Step 4.1: Parse last version from milestones**

```
const lastVersion = milestones.length > 0 ? milestones[milestones.length - 1].version : null
```

**Step 4.2: Suggest next version**

```
const nextVersion = lastVersion
  ? lastVersion.includes('.0') ? lastVersion.replace('.0', '.1') : lastVersion
  : 'v1.0'
```

Use question:
- header: "Version"
- question: "What version for this milestone?"
- options:
  - `Suggested: ${nextVersion}`
  - "Type your own..."

---

## 5. Update Project Concept

**Step 5.1: Build updated project data**

```
const updatedProjectData = {
  ...projectData,
  current_milestone: nextVersion,
  current_milestone_goals: features || [],
  active_requirements: []  // Will be filled in step 8
}
```

**Step 5.2: Update project concept**

Call:
```
megamemory_update_concept(
  id=initiativeId,
  changes={
    summary: JSON.stringify(updatedProjectData)
  }
)
```

---

## 6. Update State Concept

**Step 6.1: Build updated state data**

```
const updatedStateData = {
  ...stateData,
  current_chapter: null,
  current_plan: null,
  status: 'defining_requirements',
  milestone_version: nextVersion
}
```

**Step 6.2: Update state concept**

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

## 7. Research Decision

Use question:
- header: "Research"
- question: "Research the domain ecosystem for new features before defining requirements?"
- options:
  - "Research first (Recommended)" — Discover patterns, expected features, architecture for NEW capabilities
  - "Skip research" — I know what I need, go straight to requirements

**If "Research first":**

Display stage banner:
```
----------------------------------------------------
 Fuska: RESEARCHING
----------------------------------------------------

Researching [new features] ecosystem...
```

Display spawning indicator:
```
[IN_PROGRESS] Spawning 4 researchers in parallel...
  → Stack research (for new features)
  → Features research
  → Architecture research (integration)
  → Pitfalls research
```

Spawn 4 parallel fuska-chapter-researcher agents with milestone-aware context:

```
Task(prompt="
<objective>
Research stack dimension for milestone ${nextVersion}: ${features.join(', ')}.
</objective>

<context>
SUBSEQUENT MILESTONE — Adding ${features.join(', ')} to existing app.

Existing validated capabilities (DO NOT re-research):
${validatedRequirements.map(r => `- ${r}`).join('\n')}

Focus ONLY on what's needed for the NEW features.

Project context: ${JSON.stringify(updatedProjectData, null, 2)}
</context>

<output>
Create/update research concept: ${nextVersion}-stack-research
Include specific libraries with versions for NEW capabilities
Include integration points with existing stack
Include what NOT to add and why
</output>
", subagent_type="fuska-chapter-researcher", model="${models.researcher}", variant="plan", description="Stack research")

Task(prompt="
<objective>
Research features dimension for milestone ${nextVersion}: ${features.join(', ')}.
</objective>

<context>
SUBSEQUENT MILESTONE — Adding ${features.join(', ')} to existing app.

Existing features (already built):
${validatedRequirements.map(r => `- ${r}`).join('\n')}

Focus on how ${features.join(', ')} typically work, expected behavior.
</context>

<output>
Create/update research concept: ${nextVersion}-features-research
Categorize clearly: table stakes, differentiators, anti-features
Note complexity and dependencies
</output>
", subagent_type="fuska-chapter-researcher", model="${models.researcher}", variant="plan", description="Features research")

Task(prompt="
<objective>
Research architecture dimension for milestone ${nextVersion}: ${features.join(', ')}.
</objective>

<context>
SUBSEQUENT MILESTONE — Adding ${features.join(', ')} to existing app.

Existing architecture: ${JSON.stringify(projectData, null, 2)}

Focus on how ${features.join(', ')} integrates with existing architecture.
</context>

<output>
Create/update research concept: ${nextVersion}-architecture-research
Include integration points with existing components
Include new components needed
Include data flow changes and suggested build order
</output>
", subagent_type="fuska-chapter-researcher", model="${models.researcher}", variant="plan", description="Architecture research")

Task(prompt="
<objective>
Research pitfalls dimension for milestone ${nextVersion}: ${features.join(', ')}.
</objective>

<context>
SUBSEQUENT MILESTONE — Adding ${features.join(', ')} to existing app.

Focus on common mistakes when ADDING these features to an existing system.
</context>

<output>
Create/update research concept: ${nextVersion}-pitfalls-research
For each pitfall: warning signs, prevention strategy, which chapter should address
</output>
", subagent_type="fuska-chapter-researcher", model="${models.researcher}", variant="plan", description="Pitfalls research")
```

After all 4 agents complete, spawn synthesizer to create summary concept:

```
Task(prompt="
<objective>
Synthesize research outputs into summary concept.
</objective>

<research_concepts>
Query these concepts:
- ${nextVersion}-stack-research
- ${nextVersion}-features-research
- ${nextVersion}-architecture-research
- ${nextVersion}-pitfalls-research
</research_concepts>

<output>
Create/update research concept: ${nextVersion}-research-summary
Include key findings, stack additions, feature table stakes, watch-outs
</output>
", subagent_type="fuska-chapter-researcher", model="${models.researcher}", variant="amend", description="Synthesize research")
```

Display research complete banner and key findings:
```
---------------------------------------------------
  Fuska: Research complete
---------------------------------------------------

## Key Findings

**Stack additions:** [from research summary]
**New feature table stakes:** [from research summary]
**Watch Out For:** [from research summary]

Research concepts created in MegaMemory.
```

**If "Skip research":** Continue to step 8.

---

## 8. Define Requirements

Display stage banner:
```
----------------------------------------------------
 Fuska: DEFINING REQUIREMENTS
----------------------------------------------------
```

**Load context:**

Re-use projectData from step 2:
- Core value (the ONE thing that must work)
- Current milestone goals
- Validated requirements (what already exists)

**If research exists:** Query research summary concept and extract feature categories.

**Present features by category:**

```
Here are the features for [new capabilities]:

## [Category 1]
**Table stakes:**
- Feature A
- Feature B

**Differentiators:**
- Feature C
- Feature D

**Research notes:** [any relevant notes]

---

## [Next Category]
...
```

**If no research:** Gather requirements through conversation instead.

Ask: "What are the main things users need to be able to do with [new features]?"

For each capability mentioned:
- Ask clarifying questions to make it specific
- Probe for related capabilities
- Group into categories

**Scope each category:**

For each category, use question:

- header: "[Category name]"
- question: "Which [category] features are in this milestone?"
- multiSelect: true
- options:
  - "[Feature 1]" — [brief description]
  - "[Feature 2]" — [brief description]
  - "[Feature 3]" — [brief description]
  - "None for this milestone" — Defer entire category

Track responses:
- Selected features → this milestone's requirements
- Unselected table stakes → future milestone
- Unselected differentiators → out of scope

**Identify gaps:**

Use question:
- header: "Additions"
- question: "Any requirements research missed? (Features specific to your vision)"
- options:
  - "No, research covered it" — Proceed
  - "Yes, let me add some" — Capture additions

**Create requirement concepts:**

For each selected requirement:

```
const reqId = `${category.toUpperCase().substring(0, 4)}-${String(index).padStart(2, '0')}`

megamemory_create_concept(
  name=reqId,
  kind="feature",
  summary=JSON.stringify({
    id: reqId,
    description: requirement,
    category: category,
    status: 'pending',
    milestone: nextVersion
  }),
  parent_id='project/requirements',
  edges=[],
  why=`Requirement for milestone ${nextVersion}`,
  created_by_task="fuska-new-milestone"
)
```

**Present full requirements list:**

Show every requirement (not counts) for user confirmation:

```
## Milestone ${nextVersion} Requirements

### [Category 1]
- [ ] **CAT1-01**: User can do X
- [ ] **CAT1-02**: User can do Y

### [Category 2]
- [ ] **CAT2-01**: User can do Z

[... full list ...]

---

Does this capture what you're building? (yes / adjust)
```

If "adjust": Return to scoping.

---

## 9. Create Roadmap

Display stage banner:
```
----------------------------------------------------
 Fuska: CREATING ROADMAP
----------------------------------------------------

[IN_PROGRESS] Spawning roadmapper...
```

**Determine starting chapter number:**

Re-use roadmapData from step 2 or query:
```
megamemory_understand(query="roadmap", top_k=5)
```

Find the last chapter number from previous milestone:
```
const lastChapterNumber = chapters.length > 0 ? Math.max(...chapters.map(p => p.number)) : 0
const startChapterNumber = lastChapterNumber + 1
```

Spawn fuska-planner agent with context:

```
Task(prompt="
<objective>
Create roadmap for milestone ${nextVersion}.
</objective>

<context>
**Project:**
${JSON.stringify(updatedProjectData, null, 2)}

**Requirements (query all for this milestone):**
Query requirements concepts with milestone=${nextVersion}

**Research (if exists):**
Query ${nextVersion}-research-summary

**Previous milestone (for chapter numbering):**
Last chapter number: ${lastChapterNumber}
Start new chapters from: ${startChapterNumber}
</context>

<instructions>
1. Start chapter numbering from ${startChapterNumber}
2. Derive chapters from THIS MILESTONE's requirements (don't include validated/existing)
3. Map every requirement to exactly one chapter
4. Derive 2-5 success criteria per chapter (observable user behaviors)
5. Validate 100% coverage of new requirements
6. Create chapter concepts in MegaMemory
7. Update roadmap concept with new chapters
8. Return ROADMAP CREATED with summary
</instructions>
", subagent_type="fuska-planner", model="${models.planner}", variant="plan", description="Create roadmap")
```

**Handle planner return:**

**If `## ROADMAP BLOCKED`:**
- Present blocker information
- Work with user to resolve
- Re-spawn when resolved

**If `## ROADMAP CREATED`:**

Query the updated roadmap concept and present it nicely inline:

```
---

## Proposed Roadmap

**[N] chapters** | **[X] requirements mapped** | All milestone requirements covered [OK]

| # | Chapter | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| [N] | [Name] | [Goal] | [REQ-IDs] | [count] |
| [N+1] | [Name] | [Goal] | [REQ-IDs] | [count] |
...

### Chapter Details

**Chapter [N]: [Name]**
Goal: [goal]
Requirements: [REQ-IDs]
Success criteria:
1. [criterion]
2. [criterion]

[... continue for all chapters ...]

---
```

**CRITICAL: Ask for approval before committing:**

Use question:
- header: "Roadmap"
- question: "Does this roadmap structure work for you?"
- options:
  - "Approve" — Continue
  - "Adjust chapters" — Tell me what to change
  - "Review full concept" — Show raw roadmap concept

If "Approve": Continue to step 10.

If "Adjust chapters":
- Get user's adjustment notes
- Re-spawn planner with revision context:
  ```
  Task(prompt="
  <revision>
  User feedback on roadmap:
  [user's notes]

  Query roadmap concept and update based on feedback.
  Return ROADMAP REVISED with changes made.
  </revision>
  ", subagent_type="fuska-planner", model="${models.planner}", variant="plan", description="Revise roadmap")
  ```
- Present revised roadmap
- Loop until user approves

If "Review full concept": Display raw roadmap concept data, then re-ask.

---

## 10. Done

Present completion with next steps:

```
---------------------------------------------------
  Fuska: Milestone initialized
---------------------------------------------------

**Milestone ${nextVersion}: [Name]**

| Artifact       | MegaMemory Concept |
|----------------|--------------------|
| Project        | project            |
| Research       | ${nextVersion}-research-summary |
| Requirements   | project/requirements |
| Roadmap        | roadmap            |

**[N] chapters** | **[X] requirements** | Ready to build [OK]

──────────────────────────────────────────────────────────────

## > Next Up

**Chapter [N]: [Chapter Name]** — [Goal from roadmap]

/fuska-design-chapter [N]

*/new first → fresh context window*

---

**Also available:**
- /fuska-plan [N] — skip design, plan directly

──────────────────────────────────────────────────────────────
```

---

## 11. Cleanup Milestone Context

**Step 11.1: Delete milestone context concept if exists**

Re-use milestoneContextId from step 3 if found:
```
megamemory_remove_concept(
  id=milestoneContextId,
  reason="Consumed by fuska-new-milestone"
)
```

</process>

<offer_next>

Present completion summary from step 10.

</offer_next>

<success_criteria>

- [ ] MegaMemory validated (roots exist)
- [ ] Project concept updated with Current Milestone section
- [ ] State concept reset for new milestone
- [ ] Milestone context concept consumed and deleted (if existed)
- [ ] Research completed (if selected) — 4 parallel agents spawned, milestone-aware
- [ ] Requirements gathered (from research or conversation)
- [ ] User scoped each category
- [ ] Requirement concepts created in MegaMemory
- [ ] fuska-planner spawned with chapter numbering context
- [ ] Chapter concepts created in MegaMemory
- [ ] Roadmap concept updated with chapters continuing from previous milestone
- [ ] User feedback incorporated (if any)
- [ ] User knows next step is `/fuska-design-chapter [N]`

**Atomic persistence:** All concepts are created/updated immediately. If context is lost, artifacts persist in MegaMemory.

</success_criteria>
