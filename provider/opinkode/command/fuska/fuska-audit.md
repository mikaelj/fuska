---
name: fuska-audit
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
Verify milestone achieved its definition of done using MegaMemory. Check requirements coverage, cross-chapter integration, and end-to-end flows.

This command reads existing verification concepts (chapters already verified during execute-chapter), aggregates tech debt and deferred gaps, then spawns integration checker for cross-chapter wiring.
</objective>

<execution_context>

@../../fuska/references/megamemory-quick-ref.md
@../../fuska/references/preflight-check-initiative-exists.md
@../../fuska/scripts/types.ts
@../../fuska/scripts/chapter-templates.ts
</execution_context>

<context>
Version: `$ARGUMENTS` (optional — defaults to current milestone)
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
→ Suggest: "Run fuska init to initialize initiative"
→ Stop

**Step 2.3: Extract roadmap data**

If response.matches.length > 0:
```
const roadmapSummaryString = response.matches[0].summary
const roadmapData = JSON.parse(roadmapSummaryString)

const currentMilestone = roadmapData.current_milestone
const chapters = roadmapData.chapters || []
```

**Step 2.4: Resolve milestone version**

The variable `input` contains the raw argument string provided by the user.

```
const milestoneVersion = input.trim() || currentMilestone
```

**Step 2.5: Identify chapters in milestone scope**

```
const milestoneChapters = chapters.filter(p => p.milestone === milestoneVersion)
```

If milestoneChapters.length === 0:
→ Display: "No chapters found for milestone ${milestoneVersion}"
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

## 4. Read All Chapter Verifications

**Step 4.1: For each chapter, query verification concept**

```
const chapterVerifications = []

for (const chapter of milestoneChapters) {
  const chapterSlug = `chapter-${chapter.number.toString().padStart(2, '0')}`

  megamemory_understand(query=`${chapterSlug}-verification`, top_k=5)

  if (response.matches.length > 0) {
    const verificationSummaryString = response.matches[0].summary
    const verificationData = JSON.parse(verificationSummaryString)

    chapterVerifications.push({
      chapter: chapterSlug,
      chapterName: chapter.name,
      status: verificationData.status || 'unverified',
      criticalGaps: verificationData.critical_gaps || [],
      nonCriticalGaps: verificationData.tech_debt || [],
      antiPatterns: verificationData.anti_patterns || [],
      requirementsCoverage: verificationData.requirements_coverage || {}
    })
  } else {
    chapterVerifications.push({
      chapter: chapterSlug,
      chapterName: chapter.name,
      status: 'unverified',
      criticalGaps: [{ description: 'Chapter not verified' }],
      nonCriticalGaps: [],
      antiPatterns: [],
      requirementsCoverage: {}
    })
  }
}
```

---

## 5. Check for Unverified Chapters

```
const unverifiedChapters = chapterVerifications.filter(v => v.status === 'unverified')
```

If unverifiedChapters.length > 0:
→ Display: "Warning: ${unverifiedChapters.length} chapter(s) not verified"
→ List unverified chapters

---

## 6. Spawn Integration Checker

**Step 6.1: Gather chapter summaries**

```
const chapterSummaries = chapterVerifications.map(v => {
  megamemory_understand(query=`${v.chapter}-summary`, top_k=5)

  if (response.matches.length > 0) {
    const summaryString = response.matches[0].summary
    return { chapter: v.chapter, summary: JSON.parse(summaryString) }
  }
  return { chapter: v.chapter, summary: null }
})
```

**Step 6.2: Display stage banner**

```
-----------------------------------------------------
 Fuska: CHECKING INTEGRATION
-----------------------------------------------------

[IN_PROGRESS] Spawning integration checker...
```

**Step 6.3: Spawn fuska-integration-checker agent**

```
Task(
  prompt="<objective>
Check cross-chapter integration and end-to-end flows for milestone ${milestoneVersion}.

Chapters: ${milestoneChapters.map(p => `chapter-${p.number}: ${p.name}`).join(', ')}

Chapter exports (from summaries):
${chapterSummaries.filter(s => s.summary).map(s => `${s.chapter}: ${JSON.stringify(s.summary)}`).join('\n')}

Verify cross-chapter wiring and E2E user flows.
</objective>

<output>
Create/update integration concept: ${milestoneVersion}-integration-audit
Return integration report with:
- Status: passed | issues_found
- Critical issues: list of blockers
- Non-critical issues: tech debt, warnings
- Broken flows: list of E2E flow issues
- Requirements coverage: which requirements satisfied/blocked
</output>",
  subagent_type="fuska-integration-checker",
  model="${models.integration_checker}",
  variant="validate",
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

  chapterVerifications.forEach(v => {
    const coverage = v.requirementsCoverage[req.name] || v.requirementsCoverage[req.id]
    if (coverage) {
      if (coverage.status === 'satisfied') {
        coveredBy.push(v.chapter)
      } else if (coverage.status === 'partial') {
        blockers.push(`${v.chapter}: ${coverage.reason}`)
      } else if (coverage.status === 'blocked') {
        blockers.push(`${v.chapter}: ${coverage.reason}`)
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
  ...unverifiedChapters.map(p => ({ chapter: p.chapter, description: 'Chapter not verified' })),
  ...chapterVerifications.filter(v => v.criticalGaps.length > 0).flatMap(v =>
    v.criticalGaps.map(g => ({ chapter: v.chapter, description: g.description || g }))
  )
]
```

**Step 9.2: Collect tech debt**

```
const techDebt = chapterVerifications.filter(v => v.nonCriticalGaps.length > 0).map(v => ({
  chapter: v.chapter,
  chapterName: v.chapterName,
  items: v.nonCriticalGaps
}))
```

**Step 9.3: Determine overall status**

```
let auditStatus = 'passed'

if (criticalGaps.length > 0) {
  auditStatus = 'issues_found'
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
    chapters: `${chapterVerifications.filter(v => v.status === 'passed').length}/${chapterVerifications.length}`,
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
  chapters: chapterVerifications
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

All requirements covered. Cross-chapter integration verified. E2E flows complete.

──────────────────────────────────────────────────────────────

## > Next Up

**Complete milestone** — archive and tag

/fuska-complete-milestone {version}

*/new first → fresh context window*

──────────────────────────────────────────────────────────────

---

**If issues_found:**

## [WARN] Milestone {version} — Issues Found

**Score:** {N}/{M} requirements satisfied

### Unsatisfied Requirements

{For each unsatisfied requirement:}
- **{REQ-ID}: {description}** (Chapter {X})
  - {reason}

### Cross-Chapter Issues

{For each integration gap:}
- **{from} → {to}:** {issue}

### Broken Flows

{For each flow gap:}
- **{flow name}:** breaks at {step}

──────────────────────────────────────────────────────────────

## > Next Up

**Plan fixes** — create chapters to complete milestone

/fuska-plan --fixes

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

### Tech Debt by Chapter

{For each chapter with debt:}
**Chapter {X}: {name}**
- {item 1}
- {item 2}

### Total: {N} items across {M} chapters

──────────────────────────────────────────────────────────────

## > Options

**A. Complete milestone** — accept debt, track in backlog

/fuska-complete-milestone {version}

**B. Plan cleanup chapter** — address debt before completing

/fuska-plan --fixes

*/new first → fresh context window*

──────────────────────────────────────────────────────────────

</offer_next>

<success_criteria>

- [ ] MegaMemory validated (roots exist)
- [ ] Milestone scope identified from roadmap
- [ ] All chapter verification concepts queried
- [ ] Tech debt and deferred gaps aggregated
- [ ] Integration checker spawned for cross-chapter wiring
- [ ] Milestone audit concept created
- [ ] Results presented with actionable next steps

</success_criteria>
