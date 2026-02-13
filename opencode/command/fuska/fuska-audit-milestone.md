---
name: fuska-audit-milestone
description: Audit milestone completion against original intent using MegaMemory
argument-hint: "[version]"
tools:
  - read
  - bash

  - question
  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
  - megamemory:list_roots

---

<objective>
Verify milestone achieved its definition of done using MegaMemory. Check requirements coverage, cross-phase integration, and end-to-end flows.

This command reads existing verification concepts (phases already verified during execute-phase), aggregates tech debt and deferred gaps, then spawns integration checker for cross-phase wiring.
</objective>

<execution_context>
@./opencode/fuska/references/preflight-check-project-exists.md
@./opencode/fuska/scripts/types.ts
@./opencode/fuska/scripts/phase-templates.ts
</execution_context>

<megamemory_guide>

## How to read MegaMemory responses

All project data lives in MegaMemory. If a MegaMemory query returns no results, tell the user the data wasn't found.

**`megamemory:understand` returns:**
```json
{ "matches": [ { "id": "project/state", "name": "state", "kind": "config", "summary": "{\"current_phase\":\"phase-01\", ...}", "children": [...], "edges": [...] } ] }
```

The important field is **`summary`** — it's a JSON string containing the concept's data. Parse it to extract the fields you need. If `matches` is empty, the concept doesn't exist.

**`megamemory:create_concept` returns:** `{id, message}` on success.

**`megamemory:update_concept` accepts changes:** `{summary?, name?, kind?, why?, file_refs?}` only. Pass the full updated JSON string as `summary`. Returns `{message}`.

**`megamemory:list_roots` returns:** an array of root concepts.

</megamemory_guide>

<context>
Version: `$ARGUMENTS` (optional — defaults to current milestone)
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

**Step 1.2: Check for empty results**

If response.roots.length === 0:
→ Display: "No projects found in MegaMemory"
→ Suggest: "Run /fuska-new-project to initialize project"
→ Stop

**Step 1.3: Load config and resolve models**

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
  quality: { integration_checker: aliases.balanced_model },
  balanced: { integration_checker: aliases.balanced_model },
  budget: { integration_checker: aliases.budget_model }
}

const models = modelLookup[modelProfile]
```

---

## 2. Determine Milestone Scope

**Step 2.1: Query roadmap concept**

Call:
```
megamemory_understand(query="roadmap", top_k=5)
```

**Step 2.2: Check roadmap exists**

If response.matches.length === 0:
→ Display: "Roadmap concept not found in MegaMemory"
→ Suggest: "Run /fuska-new-project to initialize project"
→ Stop

**Step 2.3: Extract roadmap data**

If response.matches.length > 0:
```
const roadmapSummaryString = response.matches[0].summary
const roadmapData = JSON.parse(roadmapSummaryString)

const currentMilestone = roadmapData.current_milestone
const phases = roadmapData.phases || []
```

**Step 2.4: Resolve milestone version**

The variable `input` contains the raw argument string provided by the user.

```
const milestoneVersion = input.trim() || currentMilestone
```

**Step 2.5: Identify phases in milestone scope**

```
const milestonePhases = phases.filter(p => p.milestone === milestoneVersion)
```

If milestonePhases.length === 0:
→ Display: "No phases found for milestone ${milestoneVersion}"
→ Stop

---

## 3. Extract Milestone Definition

**Step 3.1: Query requirements concept**

Call:
```
megamemory_understand(query="requirements", top_k=50)
```

**Step 3.2: Extract requirements for this milestone**

If response.matches.length > 0:
```
const requirements = response.matches.map(match => {
  const summaryString = match.summary
  const reqData = JSON.parse(summaryString)
  return {
    id: match.id,
    name: match.name,
    description: reqData.description,
    status: reqData.status,
    milestone: reqData.milestone
  }
}).filter(r => r.milestone === milestoneVersion)
```

---

## 4. Read All Phase Verifications

**Step 4.1: For each phase, query verification concept**

```
const phaseVerifications = []

for (const phase of milestonePhases) {
  const phaseSlug = `phase-${phase.number.toString().padStart(2, '0')}`

  megamemory_understand(query=`${phaseSlug}-verification`, top_k=5)

  if (response.matches.length > 0) {
    const verificationSummaryString = response.matches[0].summary
    const verificationData = JSON.parse(verificationSummaryString)

    phaseVerifications.push({
      phase: phaseSlug,
      phaseName: phase.name,
      status: verificationData.status || 'unverified',
      criticalGaps: verificationData.critical_gaps || [],
      nonCriticalGaps: verificationData.tech_debt || [],
      antiPatterns: verificationData.anti_patterns || [],
      requirementsCoverage: verificationData.requirements_coverage || {}
    })
  } else {
    phaseVerifications.push({
      phase: phaseSlug,
      phaseName: phase.name,
      status: 'unverified',
      criticalGaps: [{ description: 'Phase not verified' }],
      nonCriticalGaps: [],
      antiPatterns: [],
      requirementsCoverage: {}
    })
  }
}
```

---

## 5. Check for Unverified Phases

```
const unverifiedPhases = phaseVerifications.filter(v => v.status === 'unverified')
```

If unverifiedPhases.length > 0:
→ Display: "Warning: ${unverifiedPhases.length} phase(s) not verified"
→ List unverified phases

---

## 6. Spawn Integration Checker

**Step 6.1: Gather phase summaries**

```
const phaseSummaries = phaseVerifications.map(v => {
  megamemory_understand(query=`${v.phase}-summary`, top_k=5)

  if (response.matches.length > 0) {
    const summaryString = response.matches[0].summary
    return { phase: v.phase, summary: JSON.parse(summaryString) }
  }
  return { phase: v.phase, summary: null }
})
```

**Step 6.2: Display stage banner**

```
-----------------------------------------------------
 Fuska ► CHECKING INTEGRATION
-----------------------------------------------------

[IN_PROGRESS] Spawning integration checker...
```

**Step 6.3: Spawn fuska-integration-checker agent**

```
Task(
  prompt="<objective>
Check cross-phase integration and end-to-end flows for milestone ${milestoneVersion}.

Phases: ${milestonePhases.map(p => `phase-${p.number}: ${p.name}`).join(', ')}

Phase exports (from summaries):
${phaseSummaries.filter(s => s.summary).map(s => `${s.phase}: ${JSON.stringify(s.summary)}`).join('\n')}

Verify cross-phase wiring and E2E user flows.
</objective>

<output>
Create/update integration concept: ${milestoneVersion}-integration-audit
Return integration report with:
- Status: passed | gaps_found
- Critical gaps: list of blockers
- Non-critical gaps: tech debt, warnings
- Broken flows: list of E2E flow issues
- Requirements coverage: which requirements satisfied/blocked
</output>",
  subagent_type="fuska-integration-checker",
  model="${models.integration_checker}",
  description="Check milestone integration"
)
```

---

## 7. Handle Integration Checker Return

**Step 7.1: Parse integration checker output**

**`## VERIFICATION PASSED`:**
→ Display: "Integration verification passed"
→ Continue to step 8

**`## GAPS FOUND`:**
→ Display: "Integration checker found issues"
→ Extract gaps from output
→ Continue to step 8

---

## 8. Check Requirements Coverage

**Step 8.1: Aggregate requirements coverage**

```
const requirementsCoverage = {}

requirements.forEach(req => {
  const coveredBy = []
  const blockers = []

  phaseVerifications.forEach(v => {
    const coverage = v.requirementsCoverage[req.name] || v.requirementsCoverage[req.id]
    if (coverage) {
      if (coverage.status === 'satisfied') {
        coveredBy.push(v.phase)
      } else if (coverage.status === 'partial') {
        blockers.push(`${v.phase}: ${coverage.reason}`)
      } else if (coverage.status === 'blocked') {
        blockers.push(`${v.phase}: ${coverage.reason}`)
      }
    }
  })

  requirementsCoverage[req.name] = {
    status: coveredBy.length > 0 && blockers.length === 0 ? 'satisfied' :
           coveredBy.length > 0 ? 'partial' : 'unsatisfied',
    covered_by: coveredBy,
    blockers: blockers
  }
})
```

---

## 9. Aggregate Results

**Step 9.1: Collect critical gaps**

```
const criticalGaps = [
  ...unverifiedPhases.map(p => ({ phase: p.phase, description: 'Phase not verified' })),
  ...phaseVerifications.filter(v => v.criticalGaps.length > 0).flatMap(v =>
    v.criticalGaps.map(g => ({ phase: v.phase, description: g.description || g }))
  )
]
```

**Step 9.2: Collect tech debt**

```
const techDebt = phaseVerifications.filter(v => v.nonCriticalGaps.length > 0).map(v => ({
  phase: v.phase,
  phaseName: v.phaseName,
  items: v.nonCriticalGaps
}))
```

**Step 9.3: Determine overall status**

```
let auditStatus = 'passed'

if (criticalGaps.length > 0) {
  auditStatus = 'gaps_found'
} else if (techDebt.some(t => t.items.length > 0)) {
  auditStatus = 'tech_debt'
}
```

---

## 10. Create Milestone Audit Concept

**Step 10.1: Generate audit data**

```
const auditData = {
  milestone: milestoneVersion,
  audited: new Date().toISOString(),
  status: auditStatus,
  scores: {
    requirements: `${requirements.filter(r => requirementsCoverage[r.name].status === 'satisfied').length}/${requirements.length}`,
    phases: `${phaseVerifications.filter(v => v.status === 'passed').length}/${phaseVerifications.length}`,
    integration: auditStatus === 'passed' ? '1/1' : '0/1',
    flows: criticalGaps.filter(g => g.description.includes('flow')).length === 0 ? '1/1' : '0/1'
  },
  gaps: {
    requirements: criticalGaps.filter(g => g.description.includes('REQ') || requirementsCoverage.some(r => r.name.includes(g.description))).map(g => g.description),
    integration: criticalGaps.filter(g => g.description.includes('integration') || g.description.includes('wiring')).map(g => g.description),
    flows: criticalGaps.filter(g => g.description.includes('flow') || g.description.includes('E2E')).map(g => g.description)
  },
  tech_debt: techDebt,
  requirements_coverage: requirementsCoverage,
  phases: phaseVerifications
}
```

**Step 10.2: Create audit concept**

Call:
```
megamemory_create_concept(
  name=`${milestoneVersion}-milestone-audit`,
  kind="config",
  summary=JSON.stringify(auditData),
  parent_id='project',
  edges=[],
  why=`Milestone ${milestoneVersion} audit completed`,
  created_by_task="fuska-audit-milestone"
)
```

---

## 11. Present Results

Route to `<offer_next>`.

</process>

<offer_next>

Output this markdown directly (not as a code block). Route based on status:

---

**If passed:**

## [OK] Milestone {version} — Audit Passed

**Score:** {N}/{M} requirements satisfied

All requirements covered. Cross-phase integration verified. E2E flows complete.

──────────────────────────────────────────────────────────────

## ▶ Next Up

**Complete milestone** — archive and tag

/fuska-complete-milestone {version}

*/new first → fresh context window*

──────────────────────────────────────────────────────────────

---

**If gaps_found:**

## [WARN] Milestone {version} — Gaps Found

**Score:** {N}/{M} requirements satisfied

### Unsatisfied Requirements

{For each unsatisfied requirement:}
- **{REQ-ID}: {description}** (Phase {X})
  - {reason}

### Cross-Phase Issues

{For each integration gap:}
- **{from} → {to}:** {issue}

### Broken Flows

{For each flow gap:}
- **{flow name}:** breaks at {step}

──────────────────────────────────────────────────────────────

## ▶ Next Up

**Plan gap closure** — create phases to complete milestone

/fuska-plan-phase --gaps

*/new first → fresh context window*

──────────────────────────────────────────────────────────────

**Also available:**
- /fuska-complete-milestone {version} — proceed anyway (accept tech debt)

──────────────────────────────────────────────────────────────

---

**If tech_debt (no blockers but accumulated debt):**

## [AUTO] Milestone {version} — Tech Debt Review

**Score:** {N}/{M} requirements satisfied

All requirements met. No critical blockers. Accumulated tech debt needs review.

### Tech Debt by Phase

{For each phase with debt:}
**Phase {X}: {name}**
- {item 1}
- {item 2}

### Total: {N} items across {M} phases

──────────────────────────────────────────────────────────────

## ▶ Options

**A. Complete milestone** — accept debt, track in backlog

/fuska-complete-milestone {version}

**B. Plan cleanup phase** — address debt before completing

/fuska-plan-phase --gaps

*/new first → fresh context window*

──────────────────────────────────────────────────────────────

</offer_next>

<success_criteria>

- [ ] MegaMemory validated (roots exist)
- [ ] Milestone scope identified from roadmap
- [ ] All phase verification concepts queried
- [ ] Tech debt and deferred gaps aggregated
- [ ] Integration checker spawned for cross-phase wiring
- [ ] Milestone audit concept created
- [ ] Results presented with actionable next steps

</success_criteria>
