# DOCCER — `/fuska-doc` Implementation Plan (FIXED)

A new Fuska command for producing **documents as deliverables** — architecture docs, implementation guides, design specs, story breakdowns, etc. The final output is a **markdown file**, with intermediate planning/research stored as MegaMemory concepts.

---

## Architecture

### Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /fuska-doc [standard|quick] "topic" --type X --audience Y     │
│  DEFAULT MODE: quick (if not specified)                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  ORCHESTRATOR (fuska-doc.md)                                    │
│  - Parse args, resolve mode                                     │
│  - Check project context (megamemory:list_roots)               │
│  - Create doc plan concept                                      │
│  - Chain agents                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ RESEARCHER    │───▶│ PLANNER       │───▶│ CHECKER       │
│ (std only)    │    │               │    │ (std only)    │
│               │    │               │    │ + panel       │
│ MegaMemory    │    │ MegaMemory    │    │ MegaMemory    │
└───────────────┘    └───────────────┘    └───────────────┘
                              │                     │
                              │     ┌───────────────┘
                              ▼     ▼
                      ┌───────────────┐
                      │ WRITER        │
                      │               │
                      │ Write FILE    │
                      │ MegaMemory    │
                      └───────────────┘
                              │
                              ▼
                      ┌───────────────┐
                      │ REVIEWER      │
                      │ (std only)    │
                      │               │
                      │ Quality check │
                      └───────────────┘
                              │
                              ▼
                      ┌───────────────┐
                      │ FINALIZE      │
                      │               │
                      │ File written  │
                      │ Concept done  │
                      │ Git commit?   │
                      └───────────────┘
```

### Mode Differences

| Phase | Standard Mode | Quick Mode (DEFAULT) |
|-------|---------------|----------------------|
| Research | ✓ | ✗ |
| Plan | ✓ | ✓ |
| Check | ✓ (with panel) | ✗ |
| Write | ✓ | ✓ |
| Review | ✓ | ✗ |

---

## Files to Create

| File | Purpose | Tools Needed |
|------|---------|--------------|
| `provider/opinkode/command/fuska/fuska-doc.md` | Orchestrator command | read, bash, question, megamemory:* |
| `provider/opinkode/agents/fuska/fuska-doc-researcher.md` | Researches domain, audience, existing docs | read, bash, grep, megamemory:* |
| `provider/opinkode/agents/fuska/fuska-doc-planner.md` | Creates document outline | read, megamemory:* |
| `provider/opinkode/agents/fuska/fuska-doc-checker.md` | Validates outline (with expert panel) | read, megamemory:* |
| `provider/opinkode/agents/fuska/fuska-doc-writer.md` | Writes the markdown file | read, write, bash, megamemory:* |
| `provider/opinkode/agents/fuska/fuska-doc-reviewer.md` | Reviews document quality | read, megamemory:* |

---

## Command Specification

### Interface

```bash
/fuska-doc [standard|quick] <topic> [--type TYPE] [--audience AUDIENCE] [--depth DEPTH] [--output PATH]

Arguments:
  topic               What to document (required, prompted if missing)

Mode (first word, optional):
  standard            Full chain: Research → Plan → Check → Write → Review
  quick               Minimal: Plan → Write
                      DEFAULT if mode word not specified

Options:
  --type TYPE         architecture | implementation | story-breakdown | design | migration | guide
                      (prompted if missing)
  --audience AUD      self | team | stakeholder | contractor
                      (prompted if missing)
  --depth DEPTH       brief | standard | comprehensive
                      (default: standard)
  --output PATH       Output file path (default: docs/{slug}.md)
```

### Examples

```bash
# Full workflow
/fuska-doc standard "Authentication architecture" --type architecture --audience team

# Quick doc (default mode)
/fuska-doc "How to deploy" --type guide

# With custom output
/fuska-doc "API design" --type design --output architecture/api-design.md

# Standalone (no project context)
/fuska-doc standard "Migration plan" --type migration
```

---

## Document Types

| Type | Description | Standard Sections |
|------|-------------|-------------------|
| `architecture` | System design | Problem, Context, Options, Recommendation, Design, Risks, Migration |
| `implementation` | How-to build | Overview, Prerequisites, Steps, Code Examples, Troubleshooting |
| `story-breakdown` | Work breakdown | Epic, User Stories, Acceptance Criteria, Dependencies, Estimates |
| `design` | Product/UX design | Problem, Research, Concepts, Mockups, Interactions, Accessibility |
| `migration` | System migration | Current State, Target State, Steps, Rollback, Validation |
| `guide` | Reference/tutorial | Purpose, Prerequisites, Steps, Examples, Reference, Next Steps |

---

## MegaMemory Concepts

### Doc Plan Concept (Intermediate)

```typescript
{
  name: "doc-001-auth-architecture",
  kind: "feature",
  summary: JSON.stringify({
    number: "001",
    slug: "auth-architecture",
    topic: "Authentication system architecture",
    type: "architecture",
    audience: "team",
    depth: "standard",
    mode: "standard",
    status: "planning" | "planned" | "writing" | "reviewing" | "complete",
    outline: [
      { section: "Problem Statement", key_points: ["..."] },
      { section: "Options Considered", key_points: ["..."] },
    ],
    research_concept: "doc-001-auth-architecture-research",
    output_file: "docs/auth-architecture.md",
    has_project: true,  // true if project context exists
    project_slug: "my-project",  // null if standalone
    created_at: "2026-02-15T...",
    completed_at: null
  }),
  parent_id: "my-project",  // or null if standalone
  edges: [{ to: "my-project", relation: "part_of" }]  // only if has_project
}
```

### Research Concept (Intermediate)

```typescript
{
  name: "doc-001-auth-architecture-research",
  kind: "pattern",
  summary: JSON.stringify({
    domain_knowledge: ["JWT basics", "OAuth flows", "Session management"],
    audience_needs: ["Team needs decision rationale", "Security concerns"],
    existing_docs: ["README mentions auth", "No prior architecture doc"],
    constraints: ["Must work with existing user table", "No third-party auth initially"],
    sources: ["...", "..."]
  }),
  parent_id: "doc-001-auth-architecture",
  edges: [{ to: "doc-001-auth-architecture", relation: "informs" }]
}
```

### Content Concept (Metadata)

```typescript
{
  name: "doc-001-auth-architecture-content",
  kind: "component",
  summary: JSON.stringify({
    file_path: "docs/auth-architecture.md",
    word_count: 2500,
    sections: [
      { title: "Problem Statement", word_count: 300 },
      { title: "Options Considered", word_count: 600 },
    ],
    review_status: "passed" | "needs_revision",
    review_issues: []
  }),
  parent_id: "doc-001-auth-architecture",
  file_refs: ["docs/auth-architecture.md"],
  edges: [{ to: "doc-001-auth-architecture", relation: "completes" }]
}
```

---

## Agent Specifications

### 1. `fuska-doc-researcher.md`

```yaml
---
name: fuska-doc-researcher
description: Researches domain knowledge, audience needs, and context for document creation. Spawned by /fuska-doc orchestrator.
tools:
  read: true
  bash: true
  grep: true
  megamemory:understand: true
  megamemory:create_concept: true
  megamemory:list_roots: true
color: "#4A90D9"
---
```

**Role:** Research domain knowledge, audience needs, and context for document creation.

**Input:**
- Topic
- Document type
- Target audience
- Project context (if available)

**Research Dimensions:**

| Dimension | What to Find |
|-----------|--------------|
| Domain Knowledge | Key concepts, terminology, best practices |
| Audience Needs | What they know, what they need, what they'll do with the doc |
| Existing Docs | What's already documented, gaps to fill |
| Constraints | Technical, organizational, timeline constraints |
| Examples | Similar docs, reference implementations |

**Output Format:**

```markdown
## RESEARCH COMPLETE

**Document:** {doc-slug}
**Domain:** {domain}

### Findings

**Domain Knowledge:**
- {concept 1}
- {concept 2}
- {best practice 1}

**Audience Needs:**
- {need 1}
- {need 2}

**Existing Docs:**
- {existing doc 1}: {relevance}

**Constraints:**
- {constraint 1}

**Sources:**
- {source 1}
- {source 2}

### MegaMemory

Research concept created: doc-XXX-{slug}-research
```

Or if blocked:

```markdown
## RESEARCH BLOCKED

**Reason:** {why blocked}

**Options:**
1. {option 1}
2. {option 2}
```

---

### 2. `fuska-doc-planner.md`

```yaml
---
name: fuska-doc-planner
description: Creates document outline with sections and key points. Spawned by /fuska-doc orchestrator.
tools:
  read: true
  megamemory:understand: true
  megamemory:create_concept: true
  megamemory:update_concept: true
  megamemory:list_roots: true
color: "#50C878"
---
```

**Role:** Create a document outline with sections and key points.

**Input:**
- Topic, type, audience, depth
- Research findings (if standard mode)
- Doc plan concept ID

**Planning Guidelines:**
- Match sections to document type template
- Adjust depth: brief (3-4 sections) / standard (5-7) / comprehensive (8-12)
- Order sections logically for audience
- Each section has 2-5 key points to address

**Output Format:**

```markdown
## PLANNING COMPLETE

**Document:** {doc-slug}
**Type:** {type}
**Audience:** {audience}
**Sections:** {N}

### Outline

1. {Section Name}
   - {key point 1}
   - {key point 2}
   - {key point 3}

2. {Section Name}
   - {key point 1}
   - {key point 2}

...

### MegaMemory

Doc plan concept updated: doc-XXX-{slug}
Outline stored in concept summary
```

---

### 3. `fuska-doc-checker.md`

```yaml
---
name: fuska-doc-checker
description: Validates document outline with expert panel. Spawned by /fuska-doc orchestrator.
tools:
  read: true
  megamemory:understand: true
  megamemory:create_concept: true
  megamemory:list_roots: true
color: "#FF6B6B"
---
```

**Role:** Validate document outline with expert panel.

**Input:**
- Document outline
- Type, audience, depth
- Research findings

**Check Dimensions:**

| Dimension | What It Validates |
|-----------|-------------------|
| Type Compliance | Required sections for document type present |
| Audience Alignment | Content matches audience technical level |
| Completeness | All key points from research addressed |
| Logical Flow | Sections ordered appropriately |
| Scope | Outline stays within stated topic |

**Expert Panel:**

| Role | Focus |
|------|-------|
| Base: `quality-advocate` | General quality, clarity |
| Contextual: `domain-expert` | Domain-specific accuracy (if applicable) |
| Expert: `audience-advocate` | Audience-specific concerns |

**Output Format:**

```markdown
## VERIFICATION PASSED

All checks passed:
- ✓ Type compliance: All required {type} sections present
- ✓ Audience alignment: Technical level appropriate for {audience}
- ✓ Completeness: Research points addressed
- ✓ Logical flow: {flow description}
- ✓ Scope: Stays within {topic}

Ready for writing.
```

Or:

```markdown
## ISSUES FOUND

### Blockers
- {blocker 1}
- {blocker 2}

### Warnings
- {warning 1}

### Recommendations
- {recommendation 1}

### Structured Issues

```yaml
issues:
  - dimension: "type_compliance"
    severity: "blocker"
    description: "Missing 'Risks & Mitigations' section (required for architecture docs)"
    fix_hint: "Add section after Recommendation"
```
```

---

### 4. `fuska-doc-writer.md`

```yaml
---
name: fuska-doc-writer
description: Writes the actual markdown document from the outline. Spawned by /fuska-doc orchestrator.
tools:
  read: true
  write: true
  bash: true
  megamemory:understand: true
  megamemory:create_concept: true
  megamemory:list_roots: true
color: "#9B59B6"
---
```

**Role:** Write the actual markdown document from the outline.

**Input:**
- Approved outline
- Research findings (if standard mode)
- Output file path

**Pre-Write Checklist:**

1. **Ensure directory exists:**
   ```bash
   mkdir -p $(dirname "{OUTPUT_FILE}")
   ```

2. **Verify no file conflict** (orchestrator handles, but writer verifies):
   ```bash
   if [ -f "{OUTPUT_FILE}" ]; then
     # Return error, let orchestrator handle
     echo "## FILE EXISTS"
     exit 1
   fi
   ```

**Writing Guidelines (from Google Tech Writing):**

| Principle | Application |
|-----------|-------------|
| Active voice | "The system validates tokens" not "Tokens are validated" |
| Clear sentences | One idea per sentence |
| Short sentences | Target < 25 words average |
| Define scope | State what doc covers and doesn't cover |
| State audience | Who this is for, prerequisites |
| Key points first | Summary at start of each section |
| Progressive disclosure | Simple → complex ordering |
| Compare/contrast | Relate to known concepts |

**Document Frontmatter:**

Every document includes frontmatter:

```markdown
---
doc_id: doc-001
slug: auth-architecture
type: architecture
audience: team
depth: standard
generated: 2026-02-15
mode: standard
---
```

**Output Format:**

```markdown
## WRITING COMPLETE

**File:** {output_file}
**Words:** {word_count}
**Sections:** {N}

### Document Structure

| Section | Words |
|---------|-------|
| {section 1} | {count} |
| {section 2} | {count} |
| ... | ... |

### MegaMemory

Content concept created: doc-XXX-{slug}-content
```

---

### 5. `fuska-doc-reviewer.md`

```yaml
---
name: fuska-doc-reviewer
description: Reviews document quality before final delivery. Spawned by /fuska-doc orchestrator.
tools:
  read: true
  megamemory:understand: true
  megamemory:update_concept: true
  megamemory:list_roots: true
color: "#F39C12"
---
```

**Role:** Review document quality before final delivery.

**Review Dimensions:**

| Dimension | Checks |
|-----------|--------|
| Clarity | Active voice, clear sentences, explained jargon |
| Audience Fit | Technical level matches declared audience |
| Completeness | All outline sections present and substantive |
| Accuracy | Facts correct, no contradictions |
| Structure | Logical flow, good headings, progressive disclosure |
| Scope Adherence | Stays within stated scope/non-scope |
| Actionability | Reader knows what to do next (for guides) |
| Conciseness | No unnecessary padding |

**Output Format:**

```markdown
## REVIEW PASSED

Quality scores:
- Clarity: ✓ Good
- Audience Fit: ✓ Appropriate for {audience}
- Completeness: ✓ All {N} sections substantive
- Accuracy: ✓ No contradictions found
- Structure: ✓ Logical flow
- Scope: ✓ Stays within {topic}

Minor suggestions (non-blocking):
- {suggestion 1}
- {suggestion 2}

Document ready for delivery.
```

Or:

```markdown
## REVISION NEEDED

### Issues

1. **{Dimension}** (Section {N}): {description}
2. **{Dimension}** (Section {N}): {description}

### Revision Instructions

1. {instruction 1}
2. {instruction 2}
3. {instruction 3}

Re-run writer with these revisions.
```

---

## Orchestrator Flow

### Step 0: Preflight

```
1. Check MegaMemory connectivity:
   - Call megamemory:list_roots()
   - If tool call fails → Display MCP diagnostic, stop
   - If MEGAMEMORY_ERROR → Display error, stop

2. Detect project context:
   - If roots is empty → STANDALONE_MODE = true, HAS_PROJECT = false
   - If roots has content:
     - Look for project concept (kind="feature") matching current directory
     - If found → HAS_PROJECT = true, projectSlug = concept.name
     - If not found → STANDALONE_MODE = true, HAS_PROJECT = false
```

### Step 1: Parse Arguments

```
Input: "$ARGUMENTS"

Parse:
1. MODE = first word if "standard" or "quick", else "quick" (DEFAULT)
2. TOPIC = remaining text (or everything if no mode word)
3. FLAGS = extract --type, --audience, --depth, --output

Validation Loop:
  If TOPIC empty:
    Loop:
      response = question("What would you like to document?")
      If response provided → TOPIC = response, break
      If cancelled → Stop

  If --type missing:
    response = question("What type of document?", options: [types])
    TYPE = response

  If --audience missing:
    response = question("Who is the audience?", options: [audiences])
    AUDIENCE = response

  If --depth missing:
    DEPTH = "standard"  // default, no question
```

### Step 2: Generate Number & Slug

```
1. Query existing doc concepts:
   result = megamemory:understand({ query: "doc-", top_k: 100 })
   
2. Extract numbers from matching concepts:
   numbers = []
   for concept in result.matches:
     match = concept.name.match(/^doc-(\d{3})-/)
     if match:
       numbers.push(parseInt(match[1]))
   
3. Next number:
   if numbers.length === 0:
     nextNumber = 1
   else:
     nextNumber = Math.max(...numbers) + 1
   
4. Pad to 3 digits: "001", "002", etc.

5. Generate slug from topic:
   slug = topic
     .toLowerCase()
     .replace(/[^a-z0-9]+/g, '-')
     .replace(/^-|-$/g, '')
     .slice(0, 50)  // increased from 40

6. Output file = --output || `docs/${slug}.md`
```

### Step 3: Check File Conflict

```
If file exists at OUTPUT_FILE:
  response = question({
    header: "File Exists",
    question: "${OUTPUT_FILE} already exists. What would you like to do?",
    options: [
      { label: "Overwrite", description: "Replace the existing file" },
      { label: "New filename", description: "I'll specify a different filename" },
      { label: "Cancel", description: "Abort this operation" }
    ]
  })
  
  If "Overwrite" → Continue
  If "New filename" → Prompt for new path, re-check
  If "Cancel" → Stop
```

### Step 4: Create Doc Plan Concept

```
docConcept = megamemory:create_concept({
  name: `doc-${number}-${slug}`,
  kind: "feature",
  summary: JSON.stringify({
    number: number.toString().padStart(3, '0'),
    slug: slug,
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
    project_slug: projectSlug || null,
    created_at: new Date().toISOString(),
    completed_at: null
  }),
  parent_id: HAS_PROJECT ? projectSlug : null,
  edges: HAS_PROJECT ? [{ to: projectSlug, relation: "part_of" }] : []
})
```

### Step 5: Research (standard mode only)

```
If MODE !== "standard":
  Skip to Step 6

Display: "Researching..."

Spawn fuska-doc-researcher with:
  prompt: `
    <objective>
    Research domain knowledge for document: ${TOPIC}
    </objective>
    
    <context>
    Document type: ${TYPE}
    Target audience: ${AUDIENCE}
    Project context: ${HAS_PROJECT ? projectSlug : "standalone mode"}
    
    Doc plan concept: doc-${number}-${slug}
    </context>
    
    <output>
    Create research concept: doc-${number}-${slug}-research
    
    Use MegaMemory:
      - megamemory:create_concept({ name, kind: "pattern", summary, parent_id, edges })
      - edges: [{ to: "doc-${number}-${slug}", relation: "informs" }]
    
    Return: "## RESEARCH COMPLETE" or "## RESEARCH BLOCKED"
    </output>
  `
  subagent_type: "fuska-doc-researcher"
  description: "Research ${slug}"

On completion:
  If "## RESEARCH COMPLETE":
    - Query research concept
    - Store for planner
    - Continue to Step 6
  
  If "## RESEARCH BLOCKED":
    - Display blocker information
    - question: "How to proceed?" [Skip research, Provide context, Abort]
    - Handle response
```

### Step 6: Plan

```
Display: "Planning..."

Spawn fuska-doc-planner with:
  prompt: `
    <objective>
    Create document outline for: ${TOPIC}
    </objective>
    
    <context>
    Document type: ${TYPE}
    Target audience: ${AUDIENCE}
    Depth: ${DEPTH}
    
    Doc plan concept: doc-${number}-${slug}
    Concept ID: ${docConcept.id}
    
    ${research concept data if standard mode}
    </context>
    
    <output>
    Update doc plan concept with outline
    Use megamemory:update_concept()
    
    Return: "## PLANNING COMPLETE" with outline summary
    </output>
  `
  subagent_type: "fuska-doc-planner"
  description: "Plan ${slug}"

On completion:
  - Query updated plan concept
  - Display outline summary
  - If MODE === "standard": Continue to Step 7
  - If MODE === "quick": Skip to Step 8
```

### Step 7: Check (standard mode only)

```
Display: "Checking plan..."

Spawn fuska-doc-checker with:
  prompt: `
    <verification_context>
    Document: ${slug}
    Type: ${TYPE}
    Audience: ${AUDIENCE}
    Depth: ${DEPTH}
    
    Outline: ${outline from plan concept}
    Research: ${research findings if available}
    </verification_context>
    
    <checker_panel>
    Base: quality-advocate
    Contextual: domain-expert (if applicable)
    Expert: audience-advocate
    </checker_panel>
    
    <expected_output>
    Return: "## VERIFICATION PASSED" or "## ISSUES FOUND"
    </expected_output>
  `
  subagent_type: "fuska-doc-checker"
  description: "Check ${slug} outline"

iteration_count = 1
max_iterations = 3

Loop:
  If "## VERIFICATION PASSED":
    - Break loop, continue to Step 8
  
  If "## ISSUES FOUND":
    - iteration_count++
    - If iteration_count > max_iterations:
        - Display remaining issues
        - response = question("Issues remain. Proceed anyway or revise manually?")
        - If "Proceed" → Continue to Step 8
        - If "Revise manually" → Stop, let user edit concept
        - Break loop
    
    - Display: "Sending back to planner... (iteration ${iteration_count}/${max_iterations})"
    - Spawn fuska-doc-planner with revision context
    - Re-run checker
```

### Step 8: Write

```
Display: "Writing document..."

Spawn fuska-doc-writer with:
  prompt: `
    <objective>
    Write document: ${TOPIC}
    </objective>
    
    <context>
    Output file: ${OUTPUT_FILE}
    Document type: ${TYPE}
    Audience: ${AUDIENCE}
    
    Outline: ${outline from plan concept}
    Research: ${research findings if available}
    
    Doc plan concept: doc-${number}-${slug}
    </context>
    
    <pre_write>
    1. Ensure directory exists: mkdir -p $(dirname "${OUTPUT_FILE}")
    2. Create document with frontmatter
    3. Follow Google Tech Writing guidelines
    </pre_write>
    
    <output>
    1. Write file using Write tool
    2. Create content concept: doc-${number}-${slug}-content
       - kind: "component"
       - summary: { file_path, word_count, sections, review_status: "pending" }
       - parent_id: doc-${number}-${slug}
       - edges: [{ to: doc-${number}-${slug}, relation: "completes" }]
       - file_refs: [OUTPUT_FILE]
    
    Return: "## WRITING COMPLETE" with file stats
    </output>
  `
  subagent_type: "fuska-doc-writer"
  description: "Write ${slug}"

On completion:
  - Display: file path, word count
  - If MODE === "standard": Continue to Step 9
  - If MODE === "quick": Skip to Step 10
```

### Step 9: Review (standard mode only)

```
Display: "Reviewing document..."

Spawn fuska-doc-reviewer with:
  prompt: `
    <objective>
    Review document quality: ${OUTPUT_FILE}
    </objective>
    
    <context>
    Document type: ${TYPE}
    Audience: ${AUDIENCE}
    Outline: ${outline}
    
    Content concept: doc-${number}-${slug}-content
    </context>
    
    <review_dimensions>
    - Clarity
    - Audience Fit
    - Completeness
    - Accuracy
    - Structure
    - Scope Adherence
    - Actionability
    - Conciseness
    </review_dimensions>
    
    <output>
    Return: "## REVIEW PASSED" or "## REVISION NEEDED"
    </output>
  `
  subagent_type: "fuska-doc-reviewer"
  description: "Review ${slug}"

iteration_count = 1
max_iterations = 3  // consistent with checker

Loop:
  If "## REVIEW PASSED":
    - Update content concept: review_status = "passed"
    - Break loop, continue to Step 10
  
  If "## REVISION NEEDED":
    - iteration_count++
    - If iteration_count > max_iterations:
        - Display remaining issues
        - response = question("Issues remain. Accept document or revise manually?")
        - If "Accept" → Continue to Step 10
        - If "Revise manually" → Stop
        - Break loop
    
    - Display: "Sending back to writer... (iteration ${iteration_count}/${max_iterations})"
    - Spawn fuska-doc-writer with revision instructions
    - Re-run reviewer
```

### Step 10: Finalize

```
1. Update doc plan concept:
   megamemory:update_concept({
     id: docConcept.id,
     changes: {
       summary: JSON.stringify({
         ...currentData,
         status: "complete",
         completed_at: new Date().toISOString()
       })
     }
   })

2. Git commit decision:
   response = question({
     header: "Git Commit",
     question: "Commit the document?",
     options: [
       { label: "Yes", description: "Create commit with doc file" },
       { label: "No", description: "I'll commit manually later" }
     ]
   })
   
   If "Yes":
     bash: `git add "${OUTPUT_FILE}" && git commit -m "docs: add ${slug} (${TYPE})"`

3. Display completion banner:
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Fuska > DOCUMENT COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Document: doc-${number}-${slug}
 Topic: ${TOPIC}
 Type: ${TYPE} | Audience: ${AUDIENCE}

 Output: ${OUTPUT_FILE}
 Words: ${word_count} | Sections: ${N}

 Mode: ${MODE}
 Research: ${✓|✗} | Check: ${✓|✗} | Review: ${✓|✗}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Standalone Mode (No Project)

When no project context exists:

1. Skip project-specific queries (roadmap, requirements, etc.)
2. Create concepts at root level (`parent_id: null`)
3. Research focuses on public domain knowledge
4. Output file still defaults to `docs/{slug}.md` (creates directory if needed)
5. All concepts have `has_project: false` and `project_slug: null`

---

## Error Handling

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

---

## Model Profile

Uses the same model profile lookup as existing Fuska agents:

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| fuska-doc-researcher | quality_model | balanced_model | budget_model |
| fuska-doc-planner | quality_model | quality_model | balanced_model |
| fuska-doc-checker | balanced_model | balanced_model | budget_model |
| fuska-doc-writer | quality_model | balanced_model | balanced_model |
| fuska-doc-reviewer | balanced_model | balanced_model | budget_model |

---

## Success Criteria

- [ ] Command parses mode from first word (standard|quick)
- [ ] Default mode is "quick" if not specified
- [ ] Command prompts for missing required fields (topic, type, audience)
- [ ] MegaMemory connectivity checked in preflight
- [ ] Project context detected (standalone vs project mode)
- [ ] Doc plan concept created in MegaMemory with correct parent_id
- [ ] Number generation queries existing doc-* concepts correctly
- [ ] File conflict handled before concept creation
- [ ] Research phase runs in standard mode (skipped in quick)
- [ ] Research concept created with correct edges
- [ ] Planner creates document outline, updates concept
- [ ] Checker validates with expert panel (standard mode)
- [ ] Revision loop works for planner ← checker (max 3 iterations)
- [ ] Writer creates markdown file with frontmatter
- [ ] Writer creates content concept with file_refs
- [ ] Writer ensures directory exists before write
- [ ] Reviewer checks document quality (standard mode)
- [ ] Revision loop works for writer ← reviewer (max 3 iterations)
- [ ] Final doc concept status = "complete"
- [ ] Git commit offered after completion
- [ ] Completion banner displays file path and stats
- [ ] Works without project context (standalone mode)
- [ ] All agents have proper tools sections

---

## Implementation Order

### Phase 1: Core (Quick Mode)
- `fuska-doc.md` (orchestrator - basic flow)
- `fuska-doc-planner.md`
- `fuska-doc-writer.md`

### Phase 2: Quality Assurance (Standard Mode)
- `fuska-doc-researcher.md`
- `fuska-doc-checker.md`
- `fuska-doc-reviewer.md`

### Phase 3: Polish
- Standalone mode refinement
- Error handling edge cases
- Expert panel for checker
- Git commit integration

---

## Files Summary

| File | Type | Tools |
|------|------|-------|
| `command/fuska/fuska-doc.md` | Command | read, bash, question, megamemory:* |
| `agents/fuska/fuska-doc-researcher.md` | Agent | read, bash, grep, megamemory:* |
| `agents/fuska/fuska-doc-planner.md` | Agent | read, megamemory:* |
| `agents/fuska/fuska-doc-checker.md` | Agent | read, megamemory:* |
| `agents/fuska/fuska-doc-writer.md` | Agent | read, write, bash, megamemory:* |
| `agents/fuska/fuska-doc-reviewer.md` | Agent | read, megamemory:* |
