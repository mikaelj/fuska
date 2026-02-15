---
name: fuska-doc
description: Create documentation as deliverables with research, planning, and review
argument-hint: "[standard|quick] <topic> [--type TYPE] [--audience AUD] [--depth DEPTH] [--output PATH]"
tools:
  - read
  - bash
  - question
  - task
  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
  - megamemory:list_roots
---

<objective>

Create documents as deliverables — architecture docs, implementation guides, design specs, story breakdowns, etc. The final output is a markdown file, with intermediate planning/research stored as MegaMemory concepts.

**Default mode:** quick (Plan → Write only)

**Standard mode:** Research → Plan → Check → Write → Review

**Orchestrator role:** Parse arguments, detect project context, generate doc number, create doc plan concept, chain agents, finalize with git commit option.

</objective>

<execution_context>

Document types:
- `architecture` — System design (Problem, Context, Options, Recommendation, Design, Risks, Migration)
- `implementation` — How-to build (Overview, Prerequisites, Steps, Code Examples, Troubleshooting)
- `story-breakdown` — Work breakdown (Epic, User Stories, Acceptance Criteria, Dependencies, Estimates)
- `design` — Product/UX design (Problem, Research, Concepts, Mockups, Interactions, Accessibility)
- `migration` — System migration (Current State, Target State, Steps, Rollback, Validation)
- `guide` — Reference/tutorial (Purpose, Prerequisites, Steps, Examples, Reference, Next Steps)

Audiences:
- `self` — Personal reference
- `team` — Development team
- `stakeholder` — Business stakeholders
- `contractor` — External contractors

Depths:
- `brief` — 3-4 sections
- `standard` — 5-7 sections (default)
- `comprehensive` — 8-12 sections

</execution_context>

<megamemory_guide>

## How to read MegaMemory responses

All doc data lives in MegaMemory. If a query returns no results, proceed with defaults or prompt user.

**`megamemory:understand` returns:**
```json
{ "matches": [ { "id": "...", "name": "doc-001-auth-architecture", "kind": "feature", "summary": "{\"number\":\"001\", ...}", "children": [...], "edges": [...] } ] }
```

The important field is **`summary`** — it's a JSON string. Parse it with `JSON.parse()` to extract fields.

**`megamemory:create_concept` returns:** `{id, message}` on success.

**`megamemory:update_concept` accepts changes:** `{summary?, name?, kind?, why?, file_refs?}` only. Pass full updated JSON string as `summary`.

**`megamemory:list_roots` returns:** array of root concepts (projects).

</megamemory_guide>

<process>

## 0. Preflight Check

**Step 0.1: Check MegaMemory connectivity**

Call:
```
megamemory_list_roots()
```

If tool call fails:
→ Display: "MegaMemory MCP connection failed"
→ Display: "Check that MegaMemory server is running"
→ Stop

**Step 0.2: Detect project context**

```
let HAS_PROJECT = false
let projectSlug = null

if (roots.length > 0) {
  // Look for project concept matching current directory
  const cwd = process.cwd()
  const project = roots.find(r => 
    r.kind === 'feature' && 
    cwd.includes(r.name)
  )
  
  if (project) {
    HAS_PROJECT = true
    projectSlug = project.name
  }
}

if (!HAS_PROJECT) {
  STANDALONE_MODE = true
}
```

**Step 0.3: Resolve model profile (if project exists)**

If HAS_PROJECT:
```
megamemory_understand(query="config", top_k=5)

if (matches.length > 0) {
  configData = JSON.parse(matches[0].summary)
  modelProfile = configData.model_profile || "balanced"
  
  aliases = configData.model_aliases || {
    quality_model: "opencode/claude-opus-4",
    balanced_model: "opencode/claude-sonnet-4", 
    budget_model: "opencode/claude-haiku-4"
  }
}
```

**Model lookup table:**

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| fuska-doc-researcher | quality_model | balanced_model | budget_model |
| fuska-doc-planner | quality_model | quality_model | balanced_model |
| fuska-doc-checker | balanced_model | balanced_model | budget_model |
| fuska-doc-writer | quality_model | balanced_model | balanced_model |
| fuska-doc-reviewer | balanced_model | balanced_model | budget_model |

---

## 1. Parse Arguments

**Step 1.1: Extract mode from first word**

```
const input = "$ARGUMENTS".trim()
const words = input.split(/\s+/)
const firstWord = words[0]?.toLowerCase()

let MODE = "quick"  // DEFAULT
let topicWords = words

if (firstWord === "standard" || firstWord === "quick") {
  MODE = firstWord
  topicWords = words.slice(1)
}

const TOPIC = topicWords.filter(w => !w.startsWith("--")).join(" ")
```

**Step 1.2: Extract flags**

```
const typeMatch = input.match(/--type\s+(\S+)/)
const TYPE = typeMatch ? typeMatch[1] : null

const audienceMatch = input.match(/--audience\s+(\S+)/)
const AUDIENCE = audienceMatch ? audienceMatch[1] : null

const depthMatch = input.match(/--depth\s+(\S+)/)
const DEPTH = depthMatch ? depthMatch[1] : "standard"

const outputMatch = input.match(/--output\s+(\S+)/)
const OUTPUT_FLAG = outputMatch ? outputMatch[1] : null
```

**Step 1.3: Prompt for missing required fields**

Loop until all required fields provided:

```
const VALID_TYPES = ["architecture", "implementation", "story-breakdown", "design", "migration", "guide"]
const VALID_AUDIENCES = ["self", "team", "stakeholder", "contractor"]

// Topic
while (!TOPIC || TOPIC.trim() === "") {
  response = question({
    questions: [{
      header: "Topic",
      question: "What would you like to document?",
      options: []
    }]
  })
  TOPIC = response[0]
}

// Type
while (!TYPE || !VALID_TYPES.includes(TYPE)) {
  if (TYPE && !VALID_TYPES.includes(TYPE)) {
    Display: `Invalid type "${TYPE}". Valid types: ${VALID_TYPES.join(", ")}`
  }
  response = question({
    questions: [{
      header: "Type",
      question: "What type of document?",
      options: VALID_TYPES.map(t => ({ label: t, description: "" }))
    }]
  })
  TYPE = response[0]
}

// Audience
while (!AUDIENCE || !VALID_AUDIENCES.includes(AUDIENCE)) {
  if (AUDIENCE && !VALID_AUDIENCES.includes(AUDIENCE)) {
    Display: `Invalid audience "${AUDIENCE}". Valid audiences: ${VALID_AUDIENCES.join(", ")}`
  }
  response = question({
    questions: [{
      header: "Audience",
      question: "Who is the audience?",
      options: VALID_AUDIENCES.map(a => ({ label: a, description: "" }))
    }]
  })
  AUDIENCE = response[0]
}
```

---

## 2. Generate Number & Slug

**Step 2.1: Query existing doc concepts**

```
megamemory_understand(query="doc-", top_k=100)

const numbers = matches
  .map(m => m.name.match(/^doc-(\d{3})-/)?.[1])
  .filter(n => n)
  .map(n => parseInt(n))

const nextNumber = numbers.length === 0 ? 1 : Math.max(...numbers) + 1
const NUMBER = nextNumber.toString().padStart(3, '0')
```

**Step 2.2: Generate slug from topic**

```
const slug = TOPIC
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 50)

const SLUG = slug || `doc-${NUMBER}`
const OUTPUT_FILE = OUTPUT_FLAG || `docs/${SLUG}.md`
```

---

## 3. Check File Conflict

```
if (file exists at OUTPUT_FILE) {
  response = question({
    questions: [{
      header: "File Exists",
      question: `${OUTPUT_FILE} already exists. What would you like to do?`,
      options: [
        { label: "Overwrite", description: "Replace the existing file" },
        { label: "New filename", description: "I'll specify a different filename" },
        { label: "Cancel", description: "Abort this operation" }
      ]
    }]
  })
  
  if (response[0] === "Overwrite") {
    // Continue
  } else if (response[0] === "New filename") {
    // Prompt for new path, re-check
    response2 = question({
      questions: [{
        header: "New Path",
        question: "Enter the new file path:",
        options: []
      }]
    })
    OUTPUT_FILE = response2[0]
    // Re-check file conflict
  } else {
    Display: "Operation cancelled"
    Stop
  }
}
```

---

## 4. Create Doc Plan Concept

```
const docPlanData = {
  number: NUMBER,
  slug: SLUG,
  topic: TOPIC,
  type: TYPE,
  audience: AUDIENCE,
  depth: DEPTH,
  mode: MODE,
  status: "planning",
  outline: [],
  research_concept: null,
  output_file: OUTPUT_FILE,
  has_project: HAS_PROJECT,
  project_slug: projectSlug,
  created_at: new Date().toISOString(),
  completed_at: null
}

megamemory_create_concept({
  name: `doc-${NUMBER}-${SLUG}`,
  kind: "feature",
  summary: JSON.stringify(docPlanData),
  parent_id: HAS_PROJECT ? projectSlug : null,
  edges: HAS_PROJECT ? [{ to: projectSlug, relation: "part_of" }] : []
})

const docPlanName = `doc-${NUMBER}-${SLUG}`
```

---

## 5. Research (standard mode only)

**If MODE === "quick": Skip to Step 6**

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Fuska > RESEARCHING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Document: doc-${NUMBER}-${SLUG}
 Mode: standard

 [IN_PROGRESS] Spawning researcher...
```

Spawn fuska-doc-researcher:

```
const researchPrompt = `<objective>
Research domain knowledge for document: ${TOPIC}
</objective>

<context>
Document type: ${TYPE}
Target audience: ${AUDIENCE}
Depth: ${DEPTH}
Project context: ${HAS_PROJECT ? projectSlug : "standalone mode"}

Doc plan concept: doc-${NUMBER}-${SLUG}
</context>

<research_dimensions>
- Domain Knowledge: Key concepts, terminology, best practices
- Audience Needs: What they know, what they need, what they'll do with the doc
- Existing Docs: What's already documented, gaps to fill
- Constraints: Technical, organizational, timeline constraints
- Examples: Similar docs, reference implementations
</research_dimensions>

<output>
Create research concept: doc-${NUMBER}-${SLUG}-research
Use MegaMemory:
  - megamemory:create_concept({ name, kind: "pattern", summary, parent_id, edges })
  - edges: [{ to: "doc-${NUMBER}-${SLUG}", relation: "informs" }]

Return: "## RESEARCH COMPLETE" or "## RESEARCH BLOCKED"
</output>`

Task(
  description=`Research ${SLUG}`,
  subagent_type="fuska-doc-researcher",
  model=researcherModel,
  prompt=researchPrompt
)
```

**Handle Researcher Return:**

If "## RESEARCH COMPLETE":
→ Query research concept for planner
→ Continue to Step 6

If "## RESEARCH BLOCKED":
→ Display blocker information
→ response = question({
    questions: [{
      header: "Research Blocked",
      question: "How would you like to proceed?",
      options: [
        { label: "Skip research", description: "Proceed to planning without research" },
        { label: "Provide context", description: "I'll provide more information" },
        { label: "Abort", description: "Cancel this operation" }
      ]
    }]
  })
→ If "Skip research": Continue to Step 6
→ If "Abort": Stop
→ If "Provide context": Gather info, re-run researcher

---

## 6. Plan

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Fuska > PLANNING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Document: doc-${NUMBER}-${SLUG}
 Type: ${TYPE} | Audience: ${AUDIENCE}

 [IN_PROGRESS] Spawning planner...
```

Spawn fuska-doc-planner:

```
const plannerPrompt = `<objective>
Create document outline for: ${TOPIC}
</objective>

<context>
Document type: ${TYPE}
Target audience: ${AUDIENCE}
Depth: ${DEPTH}

Doc plan concept: doc-${NUMBER}-${SLUG}

${research concept data if standard mode}
</context>

<planning_guidelines>
- Match sections to document type template
- Adjust depth: brief (3-4 sections) / standard (5-7) / comprehensive (8-12)
- Order sections logically for audience
- Each section has 2-5 key points to address
</planning_guidelines>

<output>
Update doc plan concept with outline using megamemory:update_concept()

Return: "## PLANNING COMPLETE" with outline summary
</output>`

Task(
  description=`Plan ${SLUG}`,
  subagent_type="fuska-doc-planner",
  model=plannerModel,
  prompt=plannerPrompt
)
```

**Handle Planner Return:**

→ Query updated plan concept
→ Display outline summary
→ If MODE === "standard": Continue to Step 7
→ If MODE === "quick": Skip to Step 8

---

## 7. Check (standard mode only)

**If MODE === "quick": Skip to Step 8**

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Fuska > CHECKING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Document: doc-${NUMBER}-${SLUG}

 [IN_PROGRESS] Spawning checker...
```

Spawn fuska-doc-checker:

```
const checkerPrompt = `<verification_context>
Document: ${SLUG}
Type: ${TYPE}
Audience: ${AUDIENCE}
Depth: ${DEPTH}

Outline: ${outline from plan concept}
Research: ${research findings if available}
</verification_context>

<check_dimensions>
- Type Compliance: Required sections for document type present
- Audience Alignment: Content matches audience technical level
- Completeness: All key points from research addressed
- Logical Flow: Sections ordered appropriately
- Scope: Outline stays within stated topic
</check_dimensions>

<checker_panel>
Base: quality-advocate (always)
Contextual: domain-expert (if applicable)
Expert: audience-advocate
</checker_panel>

<expected_output>
Return: "## VERIFICATION PASSED" or "## ISSUES FOUND"
</expected_output>`

Task(
  description=`Check ${SLUG} outline`,
  subagent_type="fuska-doc-checker",
  model=checkerModel,
  prompt=checkerPrompt
)
```

**Revision Loop (max 3 iterations):**

```
iteration_count = 1
max_iterations = 3

while (iteration_count <= max_iterations) {
  result = spawnChecker()
  
  if (result === "## VERIFICATION PASSED") {
    break
  }
  
  if (result === "## ISSUES FOUND") {
    iteration_count++
    
    if (iteration_count > max_iterations) {
      Display: "Max iterations reached. Issues remain:"
      // List issues
      
      response = question({
        questions: [{
          header: "Max Iterations",
          question: "How would you like to proceed?",
          options: [
            { label: "Proceed anyway", description: "Accept with known issues" },
            { label: "Revise manually", description: "I'll edit the plan myself" }
          ]
        }]
      })
      
      if (response[0] === "Revise manually") {
        Stop
      }
      break
    }
    
    Display: "Sending back to planner... (iteration ${iteration_count}/${max_iterations})"
    
    // Re-spawn planner with revision context
    spawnPlannerForRevision()
  }
}
```

---

## 8. Write

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Fuska > WRITING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Document: doc-${NUMBER}-${SLUG}
 Output: ${OUTPUT_FILE}

 [IN_PROGRESS] Spawning writer...
```

Spawn fuska-doc-writer:

```
const writerPrompt = `<objective>
Write document: ${TOPIC}
</objective>

<context>
Output file: ${OUTPUT_FILE}
Document type: ${TYPE}
Audience: ${AUDIENCE}

Outline: ${outline from plan concept}
Research: ${research findings if available}

Doc plan concept: doc-${NUMBER}-${SLUG}
</context>

<pre_write>
1. Ensure directory exists: mkdir -p $(dirname "${OUTPUT_FILE}")
2. Create document with frontmatter
3. Follow Google Tech Writing guidelines:
   - Active voice
   - Clear sentences (one idea per sentence)
   - Short sentences (target < 25 words average)
   - Key points first
   - Progressive disclosure (simple → complex)
</pre_write>

<document_frontmatter>
Every document includes:
---
doc_id: doc-${NUMBER}
slug: ${SLUG}
type: ${TYPE}
audience: ${AUDIENCE}
depth: ${DEPTH}
generated: ${new Date().toISOString().split('T')[0]}
mode: ${MODE}
---
</document_frontmatter>

<output>
1. Write file using Write tool
2. Create content concept: doc-${NUMBER}-${SLUG}-content
   - kind: "component"
   - summary: { file_path, word_count, sections, review_status: "pending" }
   - parent_id: doc-${NUMBER}-${SLUG}
   - edges: [{ to: doc-${NUMBER}-${SLUG}, relation: "completes" }]
   - file_refs: [OUTPUT_FILE]

Return: "## WRITING COMPLETE" with file stats
</output>`

Task(
  description=`Write ${SLUG}`,
  subagent_type="fuska-doc-writer",
  model=writerModel,
  prompt=writerPrompt
)
```

**Handle Writer Return:**

→ Display: file path, word count
→ If MODE === "standard": Continue to Step 9
→ If MODE === "quick": Skip to Step 10

---

## 9. Review (standard mode only)

**If MODE === "quick": Skip to Step 10**

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Fuska > REVIEWING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Document: doc-${NUMBER}-${SLUG}

 [IN_PROGRESS] Spawning reviewer...
```

Spawn fuska-doc-reviewer:

```
const reviewerPrompt = `<objective>
Review document quality: ${OUTPUT_FILE}
</objective>

<context>
Document type: ${TYPE}
Audience: ${AUDIENCE}
Outline: ${outline}

Content concept: doc-${NUMBER}-${SLUG}-content
</context>

<review_dimensions>
- Clarity: Active voice, clear sentences, explained jargon
- Audience Fit: Technical level matches declared audience
- Completeness: All outline sections present and substantive
- Accuracy: Facts correct, no contradictions
- Structure: Logical flow, good headings, progressive disclosure
- Scope Adherence: Stays within stated scope/non-scope
- Actionability: Reader knows what to do next (for guides)
- Conciseness: No unnecessary padding
</review_dimensions>

<output>
Return: "## REVIEW PASSED" or "## REVISION NEEDED"

If passed, update content concept: review_status = "passed"
</output>`

Task(
  description=`Review ${SLUG}`,
  subagent_type="fuska-doc-reviewer",
  model=reviewerModel,
  prompt=reviewerPrompt
)
```

**Revision Loop (max 3 iterations):**

```
iteration_count = 1
max_iterations = 3

while (iteration_count <= max_iterations) {
  result = spawnReviewer()
  
  if (result === "## REVIEW PASSED") {
    // Update content concept review_status = "passed"
    break
  }
  
  if (result === "## REVISION NEEDED") {
    iteration_count++
    
    if (iteration_count > max_iterations) {
      Display: "Max iterations reached. Issues remain:"
      // List issues
      
      response = question({
        questions: [{
          header: "Max Iterations",
          question: "How would you like to proceed?",
          options: [
            { label: "Accept document", description: "Use document as-is" },
            { label: "Revise manually", description: "I'll edit it myself" }
          ]
        }]
      })
      
      if (response[0] === "Revise manually") {
        Stop
      }
      break
    }
    
    Display: "Sending back to writer... (iteration ${iteration_count}/${max_iterations})"
    
    // Re-spawn writer with revision instructions
    spawnWriterForRevision()
  }
}
```

---

## 10. Finalize

**Step 10.1: Update doc plan concept**

```
megamemory_understand(query=`doc-${NUMBER}-${SLUG}`, top_k=1)

const currentData = JSON.parse(matches[0].summary)
const updatedData = {
  ...currentData,
  status: "complete",
  completed_at: new Date().toISOString()
}

megamemory_update_concept({
  id: matches[0].id,
  changes: {
    summary: JSON.stringify(updatedData)
  }
})
```

**Step 10.2: Git commit decision**

```
response = question({
  questions: [{
    header: "Git Commit",
    question: "Commit the document?",
    options: [
      { label: "Yes", description: "Create commit with doc file" },
      { label: "No", description: "I'll commit manually later" }
    ]
  }]
})

if (response[0] === "Yes") {
  bash(`git add "${OUTPUT_FILE}" && git commit -m "docs: add ${SLUG} (${TYPE})"`)
}
```

**Step 10.3: Display completion banner**

Go to `<offer_next>`.

</process>

<offer_next>

Output this markdown directly:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Fuska > DOCUMENT COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Document: doc-${NUMBER}-${SLUG}
 Topic: ${TOPIC}
 Type: ${TYPE} | Audience: ${AUDIENCE}

 Output: ${OUTPUT_FILE}
 Words: ${word_count} | Sections: ${N}

 Mode: ${MODE}
 Research: ${MODE === "standard" ? "✓" : "✗"} | Check: ${MODE === "standard" ? "✓" : "✗"} | Review: ${MODE === "standard" ? "✓" : "✗"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

</offer_next>

<standalone_mode>

When no project context exists (STANDALONE_MODE = true):

1. Skip project-specific queries (roadmap, requirements, etc.)
2. Create concepts at root level (`parent_id: null`)
3. Research focuses on public domain knowledge
4. Output file still defaults to `docs/{slug}.md` (creates directory if needed)
5. All concepts have `has_project: false` and `project_slug: null`

</standalone_mode>

<error_handling>

| Scenario | Handling |
|----------|----------|
| No topic provided | Prompt with question tool, loop until provided |
| Invalid type | Show valid types, re-prompt |
| Research blocked | Offer skip or abort |
| Plan check fails 3x | Offer proceed anyway or manual revision |
| Write fails (file error) | Display error, suggest fix |
| Review fails 3x | Offer accept or manual revision |
| No project context | Continue in standalone mode |
| File exists | Prompt: overwrite / new filename / cancel |
| MegaMemory unavailable | Display MCP diagnostic, stop |

</error_handling>

<success_criteria>

- [ ] Mode parsed from first word (standard|quick), default=quick
- [ ] Topic, type, audience prompted if missing
- [ ] MegaMemory connectivity checked in preflight
- [ ] Project context detected (standalone vs project mode)
- [ ] Doc plan concept created with correct parent_id
- [ ] Number generation queries existing doc-* concepts
- [ ] File conflict handled before concept creation
- [ ] Research phase runs in standard mode (skipped in quick)
- [ ] Planner creates outline, updates concept
- [ ] Checker validates (standard mode)
- [ ] Revision loops work (max 3 iterations)
- [ ] Writer creates markdown with frontmatter
- [ ] Writer creates content concept
- [ ] Reviewer checks quality (standard mode)
- [ ] Final concept status = "complete"
- [ ] Git commit offered
- [ ] Completion banner displayed

</success_criteria>
