---
name: fuska-import
description: Import legacy .planning/ files into MegaMemory knowledge graph
argument-hint: "[source directory - default: .planning/]"
tools:
  - read
  - bash
  - glob

  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
  - megamemory:link
  - megamemory:list_roots

  - question
---

<objective>

Import legacy `.planning/` markdown files into MegaMemory as concepts, preserving project structure, requirements, chapters, research, and todos.

This is the reverse of `/fuska-export-md` — converts the traditional `.planning/` markdown file structure into the MegaMemory knowledge graph.

**Reads:**
- `PROJECT.md` — project root concept
- `REQUIREMENTS.md` — requirements module + individual requirements
- `ROADMAP.md` — roadmap concept + chapter concepts
- `STATE.md` — project state concept
- `config.json` — config concept
- `chapters/NN-*/` — chapter context, plans, summaries, research, verification
- `todos/pending/` and `todos/done/` — todo concepts + todos module
- `research/` — research concepts (if present at top level)
- `codebase/` — codebase concepts (if present at top level)

**Use cases:**
- Migrate existing Fuska projects from file-based to MegaMemory
- Restore from a previous `/fuska-export-md` backup
- One-time conversion utility

</objective>

<execution_context>

@../../fuska/references/megamemory-quick-ref.md
@../../fuska/references/preflight-check-initiative-exists.md
@../../fuska/scripts/types.ts
@../../fuska/scripts/helpers.ts

</execution_context>

<context>

Source directory: `$ARGUMENTS` (optional - defaults to `.planning/`)

</context>

<process>

## 0. Preflight Check

Follow the MegaMemory Initiative Exists Preflight Check from @preflight-check-initiative-exists.md.

## 1. Validate Environment

**Step 1.1: Determine source directory**

The variable `input` contains the raw argument string provided by the user.

```
const sourceDir = input.trim() || ".planning"
```

**Step 1.2: Check source directory exists**

```bash
ls "$sourceDir" 2>/dev/null
```

If directory doesn't exist:
-> Display: "Source directory '$sourceDir' not found"
-> Suggest: "Check the path or run /fuska-export-md first to create an export"
-> Stop

**Step 1.3: Check for existing project in MegaMemory**

Call:
```
megamemory_list_roots()
```

If response.roots.length > 0:
-> Display existing projects
-> Ask user:
```
questions: [{
  header: "Conflict",
  question: "MegaMemory already has project data. How should we handle this?",
  options: [
    { label: "Merge", description: "Skip existing concepts, only create missing ones" },
    { label: "Replace", description: "Remove existing concepts and import fresh" },
    { label: "Cancel", description: "Abort the import" }
  ]
}]
```

If "Cancel" -> Stop
If "Replace" -> Note: will skip existing concepts that match by name (safe merge)
Store choice as `conflictMode`

If response.roots.length === 0:
-> `conflictMode = "create"` (fresh import)

**Step 1.4: Inventory source files**

Scan source directory and report what was found:

```bash
ls -la "$sourceDir/"
ls -la "$sourceDir/chapters/" 2>/dev/null
ls -la "$sourceDir/todos/pending/" 2>/dev/null
ls -la "$sourceDir/todos/done/" 2>/dev/null
ls -la "$sourceDir/research/" 2>/dev/null
ls -la "$sourceDir/codebase/" 2>/dev/null
```

Display inventory:
```
---------------------------------------------------
 Fuska > IMPORT - Source Inventory
---------------------------------------------------

Source: $sourceDir
Mode: $conflictMode

Found:
- PROJECT.md: ${exists ? 'Yes' : 'No'}
- REQUIREMENTS.md: ${exists ? 'Yes' : 'No'}
- ROADMAP.md: ${exists ? 'Yes' : 'No'}
- STATE.md: ${exists ? 'Yes' : 'No'}
- config.json: ${exists ? 'Yes' : 'No'}
- MILESTONES.md: ${exists ? 'Yes' : 'No'}
- Chapter directories: ${count}
- Todos (pending): ${count}
- Todos (done): ${count}
- Research files: ${count}
- Codebase files: ${count}

---------------------------------------------------
```

Ask user to confirm: "Proceed with import?"

---

## 2. Import Project Root

**Step 2.1: Read PROJECT.md**

Read `$sourceDir/PROJECT.md`

Parse content to extract:
- Project name (from `# heading`)
- "What This Is" section
- "Core Value" section

**Step 2.2: Generate initiative slug**

```
const initiativeSlug = initiativeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
```

**Step 2.3: Create initiative-root concept**

If conflictMode === "create" or concept doesn't exist:

```
megamemory_create_concept({
  name: initiativeSlug,
  kind: "feature",
  summary: JSON.stringify({
    name: initiativeName,
    what_this_is: whatThisIs,
    core_value: coreValue
  }),
  why: "Initiative root — imported from .planning/ files"
})
```

Store returned `id` as `initiativeId`.

Confirm: ">> Initiative root created: ${initiativeSlug}"

---

## 3. Import Config

**Step 3.1: Read config.json**

Read `$sourceDir/config.json` (if exists)

```
const configData = JSON.parse(fileContent)
```

**Step 3.2: Create config concept**

```
megamemory_create_concept({
  name: "config",
  kind: "config",
  summary: JSON.stringify(configData),
  parent_id: initiativeId,
  edges: [{ to: initiativeId, relation: "configured_by" }]
})
```

Confirm: ">> Config imported"

---

## 4. Import State

**Step 4.1: Read STATE.md**

Read `$sourceDir/STATE.md` (if exists)

Parse content to extract:
- Current Chapter (from "Current Chapter:" line)
- Current Plan
- Status
- Progress percentage
- Last Activity
- Key Decisions (bullet list)

**Step 4.2: Create state concept**

```
megamemory_create_concept({
  name: "state",
  kind: "config",
  summary: JSON.stringify({
    current_chapter: currentChapter,
    current_plan: currentPlan,
    status: status,
    progress: progress,
    last_activity: lastActivity
  }),
  parent_id: initiativeId,
  edges: [{ to: initiativeId, relation: "configured_by" }]
})
```

Confirm: ">> State imported"

---

## 5. Import Requirements

**Step 5.1: Read REQUIREMENTS.md**

Read `$sourceDir/REQUIREMENTS.md` (if exists)

Parse each requirement section (## headings) to extract:
- Requirement name
- ID
- Status (validated/active/out_of_scope)
- Description
- Chapter reference (if any)

**Step 5.2: Create requirements module**

```
megamemory_create_concept({
  name: "requirements",
  kind: "module",
  summary: "Initiative requirements list",
  parent_id: initiativeId,
  edges: [{ to: initiativeId, relation: "connects_to" }]
})

Store returned `id` as `requirementsModuleId`.

**Step 5.3: Create individual requirement concepts**

For each requirement parsed:

```
megamemory_create_concept({
  name: `req-${reqId}`,
  kind: "feature",
  summary: JSON.stringify({
    description: reqDescription,
    status: reqStatus,
    chapter_ref: chapterRef || null
  }),
  parent_id: requirementsModuleId,
  edges: [{ to: requirementsModuleId, relation: "connects_to" }]
})
```

Confirm: ">> Requirements imported (${count} requirements)"

---

## 6. Import Roadmap and Chapters

**Step 6.1: Read ROADMAP.md**

Read `$sourceDir/ROADMAP.md` (if exists)

Parse content to extract:
- Current milestone name and goal
- Chapter list with numbers, names, goals, statuses, dependencies

**Step 6.2: Create roadmap concept**

```
megamemory_create_concept({
  name: "roadmap",
  kind: "module",
  summary: JSON.stringify({
    current_milestone: {
      name: milestoneName,
      goal: milestoneGoal
    },
    chapters: chapters.map(p => ({
      number: p.number,
      slug: `chapter-${String(p.number).padStart(2, '0')}`,
      name: p.name,
      goal: p.goal,
      status: p.status,
      depends_on: p.depends_on
    }))
  }),
  parent_id: initiativeId,
  edges: [{ to: initiativeId, relation: "connects_to" }]
})
```

**Step 6.3: Create chapter concepts**

For each chapter from roadmap:

```
const chapterSlug = `chapter-${String(chapter.number).padStart(2, '0')}`

megamemory_create_concept({
  name: chapterSlug,
  kind: "feature",
  summary: JSON.stringify({
    number: chapter.number,
    name: chapter.name,
    goal: chapter.goal,
    status: chapter.status || "pending",
    depends_on: chapter.depends_on || []
  }),
  parent_id: initiativeId,
  edges: [
    { to: initiativeId, relation: "connects_to" },
    { to: "roadmap", relation: "connects_to" }
  ]
})
```

Confirm: ">> Roadmap imported (${chapters.length} chapters)"

---

## 7. Import Chapter Details

**Step 7.1: Scan chapter directories**

```bash
ls -d "$sourceDir/chapters/"*/ 2>/dev/null
```

For each chapter directory found:

**Step 7.2: Determine chapter slug**

Extract chapter slug from directory name (e.g., `chapter-01` from `chapters/chapter-01/` or `01-setup/`).

**Step 7.3: Import chapter context**

If `${chapterDir}/*-CONTEXT.md` exists:

Read file. Parse gathered context, chapter boundary, decisions, specifics, deferred items.

```
megamemory_create_concept({
  name: `${chapterSlug}-context`,
  kind: "component",
  summary: JSON.stringify({
    gathered: gathered,
    status: "complete",
    chapter_boundary: chapterBoundary,
    decisions: decisions,
    open_code_discretion: discretionItems,
    specifics: specifics,
    deferred: deferred
  }),
  parent_id: chapterSlug,
  edges: [{ to: chapterSlug, relation: "connects_to" }]
})
```

**Step 7.4: Import chapter plans**

For each `*-PLAN*.md` or plan file in the chapter directory:

Read file. Parse frontmatter (batch, depends_on, files_modified, autonomous) and body (objective, requirements, tasks).

```
const planName = `${chapterSlug}-plan-${planNumber}`

megamemory_create_concept({
  name: planName,
  kind: "component",
  summary: JSON.stringify({
    batch: batch,
    depends_on: dependsOn,
    files_modified: filesModified,
    autonomous: autonomous,
    objective: objective,
    requirements: mustHaves,
    tasks: tasks
  }),
  parent_id: chapterSlug,
  edges: [{ to: chapterSlug, relation: "connects_to" }]
})
```

**Step 7.5: Import chapter summaries**

For each `*-SUMMARY*.md` in the chapter directory:

Read file. Parse accomplishments, files modified, decisions, issues, next steps.

```
const summaryName = `${chapterSlug}-summary-${planNumber}`

megamemory_create_concept({
  name: summaryName,
  kind: "component",
  summary: JSON.stringify({
    chapter: chapterSlug,
    plan: planNumber,
    accomplishments: accomplishments,
    files_modified: filesModified,
    decisions_made: decisions,
    issues_encountered: issues,
    next_chapter_readiness: nextSteps
  }),
  parent_id: chapterSlug,
  edges: [{ to: chapterSlug, relation: "connects_to" }]
})
```

**Step 7.6: Import chapter research**

For each `*-RESEARCH*.md` in the chapter directory:

Read file. Parse research domain, findings, standard stack, architecture patterns.

```
megamemory_create_concept({
  name: `${chapterSlug}-research`,
  kind: "component",
  summary: JSON.stringify({
    domain: domain,
    confidence: confidence,
    sources: sources,
    standard_stack: standardStack,
    architecture_patterns: architecturePatterns,
    pitfalls: pitfalls
  }),
  parent_id: chapterSlug,
  edges: [{ to: chapterSlug, relation: "connects_to" }]
})
```

**Step 7.7: Import chapter verification**

For each `*-verification*.md` in the chapter directory:

Read file. Parse verification results, issues found, recommendations.

```
megamemory_create_concept({
  name: `${chapterSlug}-verification`,
  kind: "component",
  summary: JSON.stringify({
    verification_results: verificationResults,
    issues_found: issuesFound,
    recommendations: recommendations
  }),
  parent_id: chapterSlug,
  edges: [{ to: chapterSlug, relation: "connects_to" }]
})
```

Confirm: ">> Chapter ${chapterSlug} imported (context: ${hasContext}, plans: ${planCount}, summaries: ${summaryCount}, research: ${hasResearch}, verification: ${hasVerification})"

---

## 8. Import Top-Level Research

**Step 8.1: Scan research directory**

If `$sourceDir/research/` exists:

```bash
ls "$sourceDir/research/" 2>/dev/null
```

**Step 8.2: Import each research file**

For each research file (e.g., `SUMMARY.md`, `stack.md`, `features.md`, `architecture.md`, `pitfalls.md`):

Read file. Parse content into structured data.

Map to research concept names:
- `stack.md` or content about tech stack -> `research-stack`
- `features.md` or content about features -> `research-features`
- `architecture.md` or content about architecture -> `research-architecture`
- `pitfalls.md` or content about pitfalls -> `research-pitfalls`

```
megamemory_create_concept({
  name: researchName,
  kind: "component",
  summary: JSON.stringify(researchData),
  parent_id: initiativeId,
  edges: [{ to: initiativeId, relation: "connects_to" }]
})
```

Confirm: ">> Research imported (${count} concepts)"

---

## 9. Import Codebase Concepts

**Step 9.1: Scan codebase directory**

If `$sourceDir/codebase/` exists:

```bash
ls "$sourceDir/codebase/" 2>/dev/null
```

**Step 9.2: Import each codebase file**

Map files to concept names:
- `tech.md` or `TECH.md` -> `codebase-tech`
- `arch.md` or `ARCH.md` -> `codebase-arch`
- `quality.md` or `QUALITY.md` -> `codebase-quality`
- `concerns.md` or `CONCERNS.md` -> `codebase-concerns`

For each codebase file:

Read file. Parse content sections into structured data.

```
megamemory_create_concept({
  name: codebaseName,
  kind: "component",
  summary: JSON.stringify(codebaseData),
  edges: [{ to: initiativeId, relation: "connects_to" }]
})
```

Confirm: ">> Codebase concepts imported (${count} concepts)"

---

## 10. Import Todos

**Step 10.1: Create todos module**

```
megamemory_create_concept({
  name: "todos",
  kind: "module",
  summary: "Initiative todos tracking",
  parent_id: initiativeId,
  edges: [{ to: initiativeId, relation: "connects_to" }]
})

Store returned `id` as `todosModuleId`.

**Step 10.2: Scan todo files**

```bash
ls "$sourceDir/todos/pending/" 2>/dev/null
ls "$sourceDir/todos/done/" 2>/dev/null
```

**Step 10.3: Import each todo**

For each todo file in pending/ and done/:

Read file. Parse frontmatter (created, title, area, status) and body (problem, solution, files).

```
const todoSlug = filename.replace('.md', '')

megamemory_create_concept({
  name: `todo-${todoSlug}`,
  kind: "component",
  summary: JSON.stringify({
    title: title,
    area: area || "general",
    status: todoDir === "done" ? "complete" : "pending",
    created_at: created,
    problem: problem,
    solution: solution,
    files: files
  }),
  parent_id: todosModuleId,
  edges: [{ to: todosModuleId, relation: "connects_to" }]
})
```

**Step 10.4: Update todos module with counts**

```
const pendingCount = pendingTodos.length
const doneCount = doneTodos.length

megamemory_update_concept({
  id: todosModuleId,
  changes: {
    summary: JSON.stringify({
      pending_count: pendingCount,
      completed_count: doneCount,
      total: pendingCount + doneCount
    })
  }
})
```

Confirm: ">> Todos imported (${pendingCount} pending, ${doneCount} done)"

---

## 11. Import Milestones

**Step 11.1: Read MILESTONES.md**

Read `$sourceDir/MILESTONES.md` (if exists)

Parse each milestone section (## headings) to extract:
- Version/name
- Status
- Completed date
- Chapters included
- Notes

**Step 11.2: Create milestone concepts**

For each milestone:

```
megamemory_create_concept({
  name: `milestone-${milestoneName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  kind: "decision",
  summary: JSON.stringify({
    version: version,
    name: milestoneName,
    status: status,
    completed_at: completedAt,
    chapters: chapters,
    notes: notes
  }),
  parent_id: initiativeId,
  edges: [{ to: initiativeId, relation: "connects_to" }]
})
```

Confirm: ">> Milestones imported (${count} milestones)"

---

## 12. Generate Import Summary

**Step 12.1: Count imported concepts**

Tally all concepts created during import.

**Step 12.2: Display import summary**

```
---------------------------------------------------
 Fuska > IMPORT COMPLETE
---------------------------------------------------

Source: $sourceDir
Conflict Mode: $conflictMode

Concepts Created:
- Project root: 1
- Config: ${hasConfig ? 1 : 0}
- State: ${hasState ? 1 : 0}
- Requirements module: 1
  - Individual requirements: ${reqCount}
- Roadmap: 1
  - Chapters: ${chapterCount}
  - Chapter contexts: ${contextCount}
  - Chapter plans: ${planCount}
  - Chapter summaries: ${summaryCount}
  - Chapter research: ${researchCount}
  - Chapter verification: ${verificationCount}
- Research concepts: ${topLevelResearchCount}
- Codebase concepts: ${codebaseCount}
- Todos module: 1
  - Individual todos: ${todoCount}
- Milestones: ${milestoneCount}

Total concepts: ${totalCount}

---------------------------------------------------
```

**Step 12.3: Offer next actions**

```
## >> Next Actions

**Check project status:**
  fuska progress

**Verify imported data:**
  /fuska-export-md .planning.verify/
  diff -r "$sourceDir" .planning.verify/

**Clean up source files (when satisfied):**
  rm -rf "$sourceDir"

---------------------------------------------------
```

---

## 13. Handle Errors

**If a concept already exists (during merge mode):**
-> Log: "Skipped existing concept: ${conceptName}"
-> Continue with next concept

**If file parsing fails:**
-> Log: "Warning: Could not parse ${filename}: ${error}"
-> Continue with next file
-> Include in summary as "skipped"

**If MegaMemory create fails:**
-> Display error message
-> Continue with other imports
-> Log which concepts failed
-> Include in summary as "failed"

**If source directory is empty:**
-> Display: "No files found in $sourceDir"
-> Suggest: "Check the directory path"
-> Stop

</process>

<output>

- All `.planning/` file content converted to MegaMemory concepts
- Parent-child relationships preserved
- Edges established between related concepts
- Import summary with counts and any errors

</output>

<success_criteria>

- [ ] Source directory validated (exists and has files)
- [ ] Conflict handling confirmed with user (if MegaMemory has existing data)
- [ ] Project root concept created
- [ ] Config concept created (if config.json exists)
- [ ] State concept created (if STATE.md exists)
- [ ] Requirements module and individual requirements created
- [ ] Roadmap and chapter concepts created
- [ ] Chapter detail concepts created (context, plans, summaries, research, verification)
- [ ] Top-level research concepts created (if research/ directory exists)
- [ ] Codebase concepts created (if codebase/ directory exists)
- [ ] Todos module and individual todos created
- [ ] Milestones created (if MILESTONES.md exists)
- [ ] Import summary displayed with concept counts
- [ ] User knows next actions
- [ ] No `.planning/` file references left as dangling pointers

</success_criteria>
