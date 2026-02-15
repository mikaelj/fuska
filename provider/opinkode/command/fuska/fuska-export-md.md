---
name: fuska-export-md
description: Export MegaMemory concepts to markdown files for review or archival
argument-hint: "[output directory - default: .planning.export/]"
tools:
  - read
  - write
  - bash
  - glob
  - task
  - megamemory:list_roots
  - megamemory:understand
---

<objective>

Export all MegaMemory concepts to markdown files for review, archival, or external tool consumption.

This is the reverse of the migration script — converts the knowledge graph back to the traditional `.planning/` markdown file structure.

**Creates:**
- `.planning.export/` directory with full markdown hierarchy
- PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md, MILESTONES.md
- `phases/NN-*/` directories with CONTEXT.md, PLAN.md, SUMMARY.md, RESEARCH.md, UAT.md
- `todos/pending/` and `todos/done/` with todo files
- `config.json` with settings

**Use cases:**
- Review project state in human-readable format
- Archive knowledge as markdown
- Share with team members who prefer markdown
- Backup knowledge graph to git-tracked files

</objective>

<execution_context>
@../../fuska/references/preflight-check-project-exists.md
@../../fuska/scripts/types.ts
@../../fuska/scripts/helpers.ts

</execution_context>

<megamemory_guide>

## How to read MegaMemory responses

All project data lives in MegaMemory. The summary field contains JSON data that should be parsed and converted to markdown.

**`megamemory:understand` returns:**
```json
{ "matches": [ { "id": "project/state", "name": "state", "kind": "config", "summary": "{\"current_phase\":\"phase-01\", ...}", "children": [...], "edges": [...] } ] }
```

Parse the `summary` field to extract data. Convert JSON to appropriate markdown format with frontmatter.

**`megamemory:list_roots` returns:** an array of root concepts with `id`, `name`, `kind`, `summary`.

</megamemory_guide>

<context>

Output directory: `$ARGUMENTS` (optional - defaults to `.planning.export/`)

</context>

<process>

## 0. Preflight Check

Follow the MegaMemory Project Exists Preflight Check from @preflight-check-project-exists.md.

## 1. Validate Environment

**Step 1.1: Check MegaMemory availability**

Call:
```
megamemory_list_roots()
```

If response.roots.length === 0:
→ Display: "No projects found in MegaMemory"
→ Suggest: "Run /fuska-new-project to initialize project"
→ Stop

**Step 1.2: Determine output directory**

Parse arguments for custom output directory. The variable `input` contains the raw argument string.

```
const outputDir = input.trim() || ".planning.export"
```

**Step 1.3: Create output directory**

```bash
mkdir -p "$outputDir"
```

Confirm: "Exporting to: $outputDir"

---

## 2. Export Project Root

**Step 2.1: Query project-root concept**

Call:
```
megamemory_understand(query="project-root", top_k=1)
```

If response.matches.length === 0:
→ Display: "Project root concept not found"
→ Stop

**Step 2.2: Extract project data**

```
const projectSummaryString = response.matches[0].summary
const projectData = JSON.parse(projectSummaryString)

const projectName = projectData.name
const whatThisIs = projectData.what_this_is
const coreValue = projectData.core_value
```

**Step 2.3: Write PROJECT.md**

Write to `$outputDir/PROJECT.md`:

```markdown
# ${projectName}

## What This Is

${whatThisIs}

## Core Value

${coreValue}

## Requirements

${requirementsData ? requirementsData.map(r => `- [${r.status}] ${r.description}`).join('\n') : 'No requirements'}

## Active Requirements

${activeRequirements.map(r => `- [REQ-${r.id}] ${r.description}`).join('\n') || 'None'}

## Validated Requirements

${validatedRequirements.map(r => `- [REQ-${r.id}] ${r.description}`).join('\n') || 'None'}

## Out of Scope

${outOfScope.map(r => `- [REQ-${r.id}] ${r.description}`).join('\n') || 'None'}

## Last Updated

${new Date().toISOString()}
```

Confirm: "[OK] PROJECT.md exported"

---

## 3. Export Requirements

**Step 3.1: Query requirements module**

Call:
```
megamemory_understand(query="requirements", top_k=5)
```

**Step 3.2: Extract requirements**

If response.matches.length > 0:
```
const requirementsConcepts = response.matches.filter(m => m.kind === 'feature' || m.name.startsWith('req-'))

const allRequirements = requirementsConcepts.map(match => {
  const summaryString = match.summary
  const reqData = JSON.parse(summaryString)
  return {
    id: match.id,
    name: match.name,
    description: reqData.description,
    status: reqData.status,
    phaseRef: reqData.phase_ref
  }
})
```

**Step 3.3: Write REQUIREMENTS.md**

Write to `$outputDir/REQUIREMENTS.md`:

```markdown
# Requirements

${allRequirements.map(req => `## ${req.name}

**ID:** ${req.id}
**Status:** ${req.status}
${req.phaseRef ? `**Phase:** ${req.phaseRef}` : ''}

${req.description}
`).join('\n\n')}

---
*Generated from MegaMemory: ${new Date().toISOString()}*
```

Confirm: "[OK] REQUIREMENTS.md exported (${allRequirements.length} requirements)"

---

## 4. Export Roadmap

**Step 4.1: Query roadmap concept**

Call:
```
megamemory_understand(query="roadmap", top_k=1)
```

**Step 4.2: Extract roadmap data**

If response.matches.length > 0:
```
const roadmapSummaryString = response.matches[0].summary
const roadmapData = JSON.parse(roadmapSummaryString)

const currentMilestone = roadmapData.current_milestone
const phases = roadmapData.phases
```

**Step 4.3: Query phase concepts for details**

For each phase in roadmapData.phases:
```
megamemory_understand(query=`${phase.slug}`, top_k=1)
```

Extract phase name, goal, status from each phase concept.

**Step 4.4: Write ROADMAP.md**

Write to `$outputDir/ROADMAP.md`:

```markdown
# Roadmap

## Current Milestone: ${currentMilestone.name}

${currentMilestone.goal ? `**Goal:** ${currentMilestone.goal}` : ''}

${currentMilestone.definition_of_done ? `**Definition of Done:** ${currentMilestone.definition_of_done}` : ''}

---

## Phases

${phases.map(phase => `### Phase ${phase.number}: ${phase.name}

**Goal:** ${phase.goal || 'TBD'}
**Status:** ${phase.status || 'not_started'}
**Depends on:** ${phase.depends_on ? phase.depends_on.map(d => `Phase ${d}`).join(', ') : 'None'}

${phase.description ? `**Description:** ${phase.description}` : ''}

**Plans:**
${phase.plans && phase.plans.length > 0 ? phase.plans.map(p => `- ${p}`).join('\n') : 'No plans yet'}

---

`).join('\n')}

---
*Generated from MegaMemory: ${new Date().toISOString()}*
```

Confirm: "[OK] ROADMAP.md exported (${phases.length} phases)"

---

## 5. Export State

**Step 5.1: Query state concept**

Call:
```
megamemory_understand(query="state", top_k=1)
```

**Step 5.2: Extract state data**

If response.matches.length > 0:
```
const stateSummaryString = response.matches[0].summary
const stateData = JSON.parse(stateSummaryString)
```

**Step 5.3: Write STATE.md**

Write to `$outputDir/STATE.md`:

```markdown
# Project State

## Current Position

**Current Phase:** ${stateData.current_phase || 'Not started'}
**Current Plan:** ${stateData.current_plan || 'None'}
**Status:** ${stateData.status || 'unknown'}
**Progress:** ${stateData.progress || 0}%
**Last Activity:** ${stateData.last_activity || 'Never'}

## Session Continuity

${stateData.session_continuity ? `**Session ID:** ${stateData.session_continuity.session_id || 'N/A'}
**Last Command:** ${stateData.session_continuity.last_command || 'N/A'}
**Context Restored:** ${stateData.session_continuity.context_restored || 'Never'}` : ''}

## Key Decisions

${stateData.key_decisions && stateData.key_decisions.length > 0 ? stateData.key_decisions.map(d => `- ${d}`).join('\n') : 'No decisions logged'}

## Accumulated Context

${stateData.accumulated_context ? Object.entries(stateData.accumulated_context).map(([key, value]) => `### ${key}

${Array.isArray(value) ? value.map(v => `- ${v}`).join('\n') : value}`).join('\n\n') : 'No accumulated context'}

## Blockers & Concerns

${stateData.blockers && stateData.blockers.length > 0 ? stateData.blockers.map(b => `- ${b}`).join('\n') : 'No blockers'}

---
*Generated from MegaMemory: ${new Date().toISOString()}*
```

Confirm: "[OK] STATE.md exported"

---

## 6. Export Config

**Step 6.1: Query config concept**

Call:
```
megamemory_understand(query="config", top_k=1)
```

**Step 6.2: Extract config data**

If response.matches.length > 0:
```
const configSummaryString = response.matches[0].summary
const configData = JSON.parse(configSummaryString)
```

**Step 6.3: Write config.json**

Write to `$outputDir/config.json`:

```json
${JSON.stringify(configData, null, 2)}
```

Confirm: "[OK] config.json exported"

---

## 7. Export Milestones

**Step 7.1: Query milestones module**

Call:
```
megamemory_understand(query="milestones", top_k=5)
```

**Step 7.2: Extract milestone concepts**

```
const milestoneConcepts = response.matches.filter(m => m.name.startsWith('milestone-'))

const milestones = milestoneConcepts.map(match => {
  const summaryString = match.summary
  const milestoneData = JSON.parse(summaryString)
  return {
    name: match.name,
    ...milestoneData
  }
})
```

**Step 7.3: Write MILESTONES.md**

Write to `$outputDir/MILESTONES.md`:

```markdown
# Milestones

${milestones.map(m => `## ${m.version} ${m.name}

**Status:** ${m.status}
**Completed:** ${m.completed_at || 'In progress'}

**Phases:**
${m.phases && m.phases.length > 0 ? m.phases.map(p => `- Phase ${p}`).join('\n') : 'No phases'}

${m.notes ? `**Notes:** ${m.notes}` : ''}

---

`).join('\n')}

---
*Generated from MegaMemory: ${new Date().toISOString()}*
```

Confirm: "[OK] MILESTONES.md exported (${milestones.length} milestones)"

---

## 8. Export Phases

**Step 8.1: Query all phase concepts**

Call:
```
megamemory_understand(query="phase-", top_k=50)
```

**Step 8.2: Group by phase**

```
const phaseConcepts = response.matches.filter(m => m.name.startsWith('phase-'))

// Group by phase slug (e.g., phase-01)
const phaseGroups = {}
phaseConcepts.forEach(match => {
  const phaseSlug = match.name.split('-')[0] + '-' + match.name.split('-')[1]
  if (!phaseGroups[phaseSlug]) {
    phaseGroups[phaseSlug] = { phase: null, context: [], plans: [], summaries: [], research: [], uat: [] }
  }

  const summaryString = match.summary
  const data = JSON.parse(summaryString)

  if (match.name === phaseSlug) {
    phaseGroups[phaseSlug].phase = { name: match.name, data }
  } else if (match.name.includes('-context')) {
    phaseGroups[phaseSlug].context.push({ name: match.name, data })
  } else if (match.name.includes('-plan-')) {
    phaseGroups[phaseSlug].plans.push({ name: match.name, data })
  } else if (match.name.includes('-summary')) {
    phaseGroups[phaseSlug].summaries.push({ name: match.name, data })
  } else if (match.name.includes('-research')) {
    phaseGroups[phaseSlug].research.push({ name: match.name, data })
  } else if (match.name.includes('-uat')) {
    phaseGroups[phaseSlug].uat.push({ name: match.name, data })
  }
})
```

**Step 8.3: Export each phase**

For each phase in Object.keys(phaseGroups):

```
const phaseSlug = key
const phaseGroup = phaseGroups[key]
const phaseDir = `${outputDir}/phases/${phaseSlug}`

mkdir -p "$phaseDir"
```

**Export phase metadata:**

Write to `$phaseDir/PHASE.md`:

```markdown
---
name: ${phaseSlug}
number: ${phaseGroup.phase?.data.number || 'N/A'}
status: ${phaseGroup.phase?.data.status || 'unknown'}
---

# Phase ${phaseGroup.phase?.data.number || 'N/A'}: ${phaseGroup.phase?.data.name || 'Unnamed'}

**Goal:** ${phaseGroup.phase?.data.goal || 'TBD'}

**Status:** ${phaseGroup.phase?.data.status || 'unknown'}

**Depends on:** ${phaseGroup.phase?.data.depends_on ? phaseGroup.phase.data.depends_on.map(d => `Phase ${d}`).join(', ') : 'None'}

---
*Generated from MegaMemory: ${new Date().toISOString()}*
```

**Export context:**

If phaseGroup.context.length > 0:
```
const context = phaseGroup.context[0]
write to `${phaseDir}/${phaseSlug}-CONTEXT.md`:

```markdown
# ${context.name.replace('-', ' ').toUpperCase()}

## Gathered

${context.data.gathered || 'Not specified'}

## Status

${context.data.status || 'unknown'}

## Phase Boundary

${context.data.phase_boundary || 'Not specified'}

## Decisions

${context.data.decisions ? Object.entries(context.data.decisions).map(([k, v]) => `**${k}:** ${v}`).join('\n') : 'No decisions'}

## Open Code Discretion

${context.data.open_code_discretion && context.data.open_code_discretion.length > 0 ? context.data.open_code_discretion.map(d => `- ${d}`).join('\n') : 'None'}

## Specifics

${context.data.specifics && context.data.specifics.length > 0 ? context.data.specifics.map(s => `- ${s}`).join('\n') : 'None'}

## Deferred

${context.data.deferred && context.data.deferred.length > 0 ? context.data.deferred.map(d => `- ${d}`).join('\n') : 'None'}

---
*Generated from MegaMemory: ${new Date().toISOString()}*
```

**Export plans:**

For each plan in phaseGroup.plans:
```
const plan = plan
write to `${phaseDir}/${plan.name.replace('-', ' ').toUpperCase()}.md`:

```markdown
---
wave: ${plan.data.wave}
depends_on: ${plan.data.depends_on ? plan.data.depends_on.join(', ') : ''}
files_modified: ${plan.data.files_modified ? plan.data.files_modified.join(', ') : ''}
autonomous: ${plan.data.autonomous || false}
---

# ${plan.name.replace('-', ' ').toUpperCase()}

## Objective

${plan.data.objective || 'Not specified'}

## Must Haves

${plan.data.must_haves && plan.data.must_haves.length > 0 ? plan.data.must_haves.map(m => `- ${m}`).join('\n') : 'None'}

## Tasks

${plan.data.tasks && plan.data.tasks.length > 0 ? plan.data.tasks.map(t => `<task>\n${t}\n</task>`).join('\n\n') : 'No tasks defined'}

---
*Generated from MegaMemory: ${new Date().toISOString()}*
```

**Export summaries:**

For each summary in phaseGroup.summaries:
```
const summary = summary
write to `${phaseDir}/${summary.name.replace('-', ' ').toUpperCase()}.md`:

```markdown
---
duration: ${summary.data.duration || 'unknown'}
status: ${summary.data.status || 'complete'}
---

# ${summary.name.replace('-', ' ').toUpperCase()}

## What Was Accomplished

${summary.data.accomplishments && summary.data.accomplishments.length > 0 ? summary.data.accomplishments.map(a => `- ${a}`).join('\n') : 'Nothing accomplished'}

## Files Modified

${summary.data.files_modified && summary.data.files_modified.length > 0 ? summary.data.files_modified.map(f => `- ${f}`).join('\n') : 'None'}

## Decisions Made

${summary.data.decisions_made ? summary.data.decisions_made : 'None'}

## Issues Logged

${summary.data.issues_logged && summary.data.issues_logged.length > 0 ? summary.data.issues_logged.map(i => `- ${i}`).join('\n') : 'None'}

## Next Steps

${summary.data.next_steps ? summary.data.next_steps : 'None specified'}

---
*Generated from MegaMemory: ${new Date().toISOString()}*
```

**Export research:**

For each research in phaseGroup.research:
```
const research = research
write to `${phaseDir}/${research.name.replace('-', ' ').toUpperCase()}.md`:

```markdown
# ${research.name.replace('-', ' ').toUpperCase()}

## Standard Stack

${research.data.standard_stack || 'Not specified'}

## Architecture Patterns

${research.data.architecture_patterns ? research.data.architecture_patterns.join('\n\n') : 'None documented'}

## Key Technologies

${research.data.key_technologies && research.data.key_technologies.length > 0 ? research.data.key_technologies.map(t => `- ${t}`).join('\n') : 'None'}

## Implementation Notes

${research.data.implementation_notes || 'None'}

## References

${research.data.references && research.data.references.length > 0 ? research.data.references.map(r => `- [${r.title}](${r.url})`).join('\n') : 'None'}

---
*Generated from MegaMemory: ${new Date().toISOString()}*
```

**Export UAT:**

For each uat in phaseGroup.uat:
```
const uat = uat
write to `${phaseDir}/${uat.name.replace('-', ' ').toUpperCase()}.md`:

```markdown
---
status: ${uat.data.status || 'not_tested'}
---

# ${uat.name.replace('-', ' ').toUpperCase()}

## Verification Results

${uat.data.verification_results || 'Not tested'}

## Issues Found

${uat.data.issues_found && uat.data.issues_found.length > 0 ? uat.data.issues_found.map(i => `- [${i.severity}] ${i.description}`).join('\n') : 'None'}

## Gaps

${uat.data.gaps && uat.data.gaps.length > 0 ? uat.data.gaps.map(g => `- ${g.description}`).join('\n') : 'None'}

## Pass/Fail Criteria

${uat.data.pass_fail_criteria ? uat.data.pass_fail_criteria : 'Not defined'}

---
*Generated from MegaMemory: ${new Date().toISOString()}*
```

Confirm: "[OK] Phase ${phaseSlug} exported (context: ${phaseGroup.context.length}, plans: ${phaseGroup.plans.length}, summaries: ${phaseGroup.summaries.length}, research: ${phaseGroup.research.length}, uat: ${phaseGroup.uat.length})"

---

## 9. Export Todos

**Step 9.1: Query todos module**

Call:
```
megamemory_understand(query="todos", top_k=50)
```

**Step 9.2: Create todo directories**

```bash
mkdir -p "$outputDir/todos/pending"
mkdir -p "$outputDir/todos/done"
```

**Step 9.3: Extract todo concepts**

```
const todoConcepts = response.matches.filter(m => m.name.startsWith('todo-'))

const todos = todoConcepts.map(match => {
  const summaryString = match.summary
  const todoData = JSON.parse(summaryString)
  return {
    name: match.name,
    id: match.id,
    ...todoData
  }
})
```

**Step 9.4: Export each todo**

For each todo in todos:
```
const todo = todo
const dateStr = todoData.created_at || todo.created_at || new Date().toISOString().split('T')[0]
const slug = todo.name.replace('todo-', '')
const status = todoData.status || todo.status || 'pending'

const todoDir = status === 'done' ? "$outputDir/todos/done" : "$outputDir/todos/pending"
const todoFile = "${todoDir}/${dateStr}-${slug}.md"

write to todoFile:

```markdown
---
created: ${todo.created_at || new Date().toISOString()}
title: ${todo.title || 'Untitled'}
area: ${todo.area || 'general'}
status: ${status}
---

# ${todo.title || 'Untitled'}

**Area:** ${todo.area || 'general'}
**Created:** ${todo.created_at || new Date().toISOString()}

## Problem

${todo.problem || 'No problem specified'}

## Solution

${todo.solution || 'TBD'}

${todo.files && todo.files.length > 0 ? `## Files\n\n${todo.files.map(f => `- ${f}`).join('\n')}` : ''}

---
*Generated from MegaMemory: ${new Date().toISOString()}*
```

Confirm: "[OK] Todos exported (${todos.length} total)"

---

## 10. Generate Export Summary

**Step 10.1: Count exported files**

```bash
find "$outputDir" -type f | wc -l
```

**Step 10.2: Create export summary**

Display:

```
---------------------------------------------------
 Fuska: EXPORT COMPLETE
---------------------------------------------------

Output Directory: $outputDir

Files Exported:
- PROJECT.md [OK]
- REQUIREMENTS.md [OK] (${allRequirements.length} requirements)
- ROADMAP.md [OK] (${phases.length} phases)
- STATE.md [OK]
- config.json [OK]
- MILESTONES.md [OK] (${milestones.length} milestones)
- Phase directories: ${Object.keys(phaseGroups).length} total
- Phase documents:
  - Context: ${totalContext} files
  - Plans: ${totalPlans} files
  - Summaries: ${totalSummaries} files
  - Research: ${totalResearch} files
  - UAT: ${totalUAT} files
- Todos: ${todos.length} total

Total files: ${totalFileCount}

---------------------------------------------------
```

**Step 10.3: Offer next actions**

```
## > Next Actions

**Review exported files:**
  cd $outputDir
  ls -la

**Archive to git using fuska-git-message:**
  # Generate commit message
  Task(
    description="Generate export commit message",
    subagent_type="fuska-git-message",
    prompt=`<commit_context>
**Mode:** export-commit
**Commit Strategy:** per-phase

**Export Summary:**
- PROJECT.md
- REQUIREMENTS.md (${allRequirements.length} requirements)
- ROADMAP.md (${phases.length} phases)
- STATE.md
- config.json
- MILESTONES.md (${milestones.length} milestones)
- Phase directories: ${Object.keys(phaseGroups).length} total
- Todos: ${todos.length} total

**Staged files:**
$outputDir/
</commit_context>`
  )

  # Then commit with returned message
  git add $outputDir
  git commit -m "${generatedMessage}"

**Clean up when ready:**
  rm -rf $outputDir

**Re-export with fresh data:**
  /fuska-export-md [other-directory]

---------------------------------------------------
```

---

## 11. Handle Errors

**If MegaMemory query fails:**
→ Display error message
→ Continue with other exports
→ Log which concepts failed

**If export fails:**
→ Display: "Export failed: {reason}"
→ Suggest: "Check MegaMemory is running: pkill -f megamemory && megamemory"

</process>

<output>

- `.planning.export/` directory with full markdown structure
- All project concepts converted to markdown files

</output>

<success_criteria>

- [ ] MegaMemory validated (roots exist)
- [ ] Output directory created
- [ ] PROJECT.md exported
- [ ] REQUIREMENTS.md exported with all requirements
- [ ] ROADMAP.md exported with all phases
- [ ] STATE.md exported
- [ ] config.json exported
- [ ] MILESTONES.md exported with all milestones
- [ ] All phase directories created
- [ ] Phase documents exported (context, plans, summaries, research, UAT)
- [ ] Todos exported (pending and done)
- [ ] Export summary displayed with file counts
- [ ] User knows next actions

</success_criteria>
