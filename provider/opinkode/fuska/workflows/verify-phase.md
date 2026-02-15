<purpose>
Verify phase goal achievement through goal-backward analysis using MegaMemory. Check that the codebase actually delivers what the phase promised, not just that tasks were completed.

This workflow is executed by a verification subagent spawned from execute-phase.md.
</purpose>

<core_principle>
**Task completion ≠ Goal achievement**

A task "create chat component" can be marked complete when the component is a placeholder. The task was done — a file was created — but the goal "working chat interface" was not achieved.

Goal-backward verification starts from the outcome and works backwards:
1. What must be TRUE for the goal to be achieved?
2. What must EXIST for those truths to hold?
3. What must be WIRED for those artifacts to function?

Then verify each level against the actual codebase.
</core_principle>

<required_reading>
@../references/verification-patterns.md
@../templates/verification-report.md
</required_reading>

<tools>
megamemory:understand
megamemory:create_concept
megamemory:update_concept
</tools>

@../references/megamemory-integration.md

<process>

<step name="load_context" priority="first">
**Gather verification context from MegaMemory:**

```yaml
Query: megamemory:understand({
  query: "phase {PHASE_NUM} plans",
  top_k: 10
})
```

**Load phase goal:**
- Find the phase plan concept for this phase number
- Extract goal/description from concept summary
- This is the outcome to verify

**Load requirements (if applicable):**
- Query for requirements mapped to this phase
- These become additional verification targets

**Load existing artifacts:**
- Query for artifacts created/modified in this phase
- Check file_refs in plan concepts and summaries

**Load must_haves from phase plan:**
- Check if phase plan concept contains must_haves in summary
- Must-haves format: truths, artifacts, key_links
</step>

<step name="establish_must_haves">
**Determine what must be verified.**

**Option A: Must-haves in phase plan concept**

Check if phase plan concept has must_haves in summary:

```yaml
must_haves:
  truths:
    - "User can see existing messages"
    - "User can send a message"
  artifacts:
    - path: "src/components/Chat.tsx"
      provides: "Message list rendering"
  key_links:
    - from: "Chat.tsx"
      to: "api/chat"
      via: "fetch in useEffect"
```

**Option B: Derive from phase goal**

If no must_haves in plan concept, derive using goal-backward process:

1. **State the goal:** Take phase goal from plan concept summary

2. **Derive truths:** Ask "What must be TRUE for this goal to be achieved?"
   - List 3-7 observable behaviors from user perspective
   - Each truth should be testable by a human using the app

3. **Derive artifacts:** For each truth, ask "What must EXIST?"
   - Map truths to concrete files (components, routes, schemas)
   - Be specific: `src/components/Chat.tsx`, not "chat component"

4. **Derive key links:** For each artifact, ask "What must be CONNECTED?"
   - Identify critical wiring (component calls API, API queries DB)
   - These are where stubs hide

5. **Create must-haves concept:**
   ```yaml
   Call: megamemory:create_concept({
     name: "Phase {PHASE_NUM} Must-Haves",
     kind: "config",
     summary: "Must-have truths: [...], artifacts: [...], key_links: [...]",
     parent_id: "{PHASE_PLAN_CONCEPT_ID}",
     created_by_task: "verify-phase workflow"
   })
   ```

<!-- Goal-backward derivation expertise is baked into the fuska-verifier agent -->
</step>

<step name="verify_truths">
**For each observable truth, determine if codebase enables it.**

A truth is achievable if the supporting artifacts exist, are substantive, and are wired correctly.

**Verification status:**
- [OK] VERIFIED: All supporting artifacts pass all checks
- [FAIL] FAILED: One or more supporting artifacts missing, stub, or unwired
- ? UNCERTAIN: Can't verify programmatically (needs human)

**For each truth:**

1. Identify supporting artifacts (which files make this truth possible?)
2. Check artifact status (see verify_artifacts step)
3. Check wiring status (see verify_wiring step)
4. Determine truth status based on supporting infrastructure

**Example:**

Truth: "User can see existing messages"

Supporting artifacts:
- Chat.tsx (renders messages)
- /api/chat GET (provides messages)
- Message model (defines schema)

If Chat.tsx is a stub → Truth FAILED
If /api/chat GET returns hardcoded [] → Truth FAILED
If Chat.tsx exists, is substantive, calls API, renders response → Truth VERIFIED
</step>

<step name="verify_artifacts">
**For each required artifact, verify three levels:**

### Level 1: Existence

Use Read tool to check if path exists.

If MISSING → artifact fails, record and continue to next artifact.

### Level 2: Substantive

Check that the file has real implementation, not a stub.

**Line count check:**
Read file content, check line count.

Minimum lines by type:
- Component: 15+ lines
- API route: 10+ lines
- Hook/util: 10+ lines
- Schema model: 5+ lines

**Stub pattern check:**
Grep for stub patterns:
- TODO/FIXME/placeholder/not implemented/coming soon
- Empty returns (return null, return undefined, return {}, return [])
- Placeholder content (will be here, lorem ipsum)

**Export check (for components/hooks):**
Grep for export statements.

**Combine level 2 results:**
- SUBSTANTIVE: Adequate length + no stubs + has exports
- STUB: Too short OR has stub patterns OR no exports
- PARTIAL: Mixed signals (length OK but has some stubs)

### Level 3: Wired

Check that the artifact is connected to the system.

**Import check (is it used?):**
Grep for imports of this artifact in the codebase.

**Usage check (is it called?):**
Grep for function calls, component renders, etc.

**Combine level 3 results:**
- WIRED: Imported AND used
- ORPHANED: Exists but not imported/used
- PARTIAL: Imported but not used (or vice versa)

### Final artifact status

| Exists | Substantive | Wired | Status |
|--------|-------------|-------|--------|
| [OK] | [OK] | [OK] | [OK] VERIFIED |
| [OK] | [OK] | [FAIL] | [WARN] ORPHANED |
| [OK] | [FAIL] | - | [FAIL] STUB |
| [FAIL] | - | - | [FAIL] MISSING |

Record status and evidence for each artifact.
</step>

<step name="verify_wiring">
**Verify key links between artifacts.**

Key links are critical connections. If broken, the goal fails even with all artifacts present.

### Pattern: Component → API

Check if component actually calls the API:

Read component file, grep for fetch/axios calls to the API path.
Check if response is used (await, .then, setData, setState).

Status: WIRED / PARTIAL / NOT_WIRED

### Pattern: API → Database

Check if API route queries database:

Grep for Prisma/DB calls to the model.
Check if result is returned.

Status: WIRED / PARTIAL / NOT_WIRED

### Pattern: Form → Handler

Check if form submission does something:

Find onSubmit handler.
Check if handler has real implementation (fetch, axios, mutate, dispatch).
Check for stub patterns (console.log, preventDefault only, empty).

Status: WIRED / STUB / PARTIAL / NOT_WIRED

### Pattern: State → Render

Check if state is actually rendered:

Check if state variable exists (useState).
Check if state is used in JSX.

Status: WIRED / NOT_WIRED / N/A

### Aggregate key link results

For each key link in must_haves:
- Run appropriate verification using Read and Grep
- Record status and evidence
- WIRED / PARTIAL / STUB / NOT_WIRED
</step>

<step name="verify_requirements">
**Check requirements coverage if requirements concepts exist.**

Query for requirements mapped to this phase:
```yaml
Query: megamemory:understand({
  query: "phase {PHASE_NUM} requirements",
  top_k: 10
})
```

For each requirement:
1. Parse requirement description from concept summary
2. Identify which truths/artifacts support it
3. Determine status based on supporting infrastructure

**Requirement status:**
- [OK] SATISFIED: All supporting truths verified
- [FAIL] BLOCKED: One or more supporting truths failed
- ? NEEDS HUMAN: Can't verify requirement programmatically
</step>

<step name="scan_antipatterns">
**Scan for anti-patterns across phase files.**

Identify files modified in this phase:
- Check file_refs in phase plan concept
- Extract from summary concept

Run anti-pattern detection using Grep:

**TODO/FIXME comments:**
Grep for TODO, FIXME, XXX, HACK

**Placeholder content:**
Grep for placeholder, coming soon, will be here

**Empty implementations:**
Grep for return null, return {}, return [], => {}

**Console.log only implementations:**
Grep for console.log and check surrounding context

Categorize findings:
- [BLOCK] Blocker: Prevents goal achievement (placeholder renders, empty handlers)
- [WARN] Warning: Indicates incomplete (TODO comments, console.log)
- [INFO] Info: Notable but not problematic
</step>

<step name="identify_human_verification">
**Flag items that need human verification.**

Some things can't be verified programmatically:

**Always needs human:**
- Visual appearance (does it look right?)
- User flow completion (can you do the full task?)
- Real-time behavior (WebSocket, SSE updates)
- External service integration (payments, email)
- Performance feel (does it feel fast?)
- Error message clarity

**Needs human if uncertain:**
- Complex wiring that grep can't trace
- Dynamic behavior depending on state
- Edge cases and error states

**Format for human verification:**
Store in verification concept summary
</step>

<step name="determine_status">
**Calculate overall verification status.**

**Status: passed**
- All truths VERIFIED
- All artifacts pass level 1-3
- All key links WIRED
- No blocker anti-patterns
- (Human verification items are OK — will be prompted)

**Status: gaps_found**
- One or more truths FAILED
- OR one or more artifacts MISSING/STUB
- OR one or more key links NOT_WIRED
- OR blocker anti-patterns found

**Status: human_needed**
- All automated checks pass
- BUT items flagged for human verification
- Can't determine goal achievement without human

**Calculate score:**
```
score = (verified_truths / total_truths)
```
</step>

<step name="generate_fix_plans">
**If gaps_found, recommend fix plans.**

Group related gaps into fix plans:

1. **Identify gap clusters:**
   - API stub + component not wired → "Wire frontend to backend"
   - Multiple artifacts missing → "Complete core implementation"
   - Wiring issues only → "Connect existing components"

2. **Generate plan recommendations:**

Store in verification concept summary:
```markdown
### {phase}-{next}-PLAN.md: {Fix Name}

**Objective:** {What this fixes}

**Tasks:**
1. {Task to fix gap 1}
   - Files: {files to modify}
   - Action: {specific fix}
   - Verify: {how to confirm fix}

2. {Task to fix gap 2}
   - Files: {files to modify}
   - Action: {specific fix}
   - Verify: {how to confirm fix}

3. Re-verify phase goal
   - Run verification again
   - Confirm all must-haves pass

**Estimated scope:** {Small / Medium}
```

3. **Keep plans focused:**
   - 2-3 tasks per plan
   - Single concern per plan
   - Include verification task

4. **Order by dependency:**
   - Fix missing artifacts before wiring
   - Fix stubs before integration
   - Verify after all fixes
</step>

<step name="create_verification_concept">
**Create verification results concept in MegaMemory.**

```yaml
Call: megamemory:create_concept({
  name: "Phase {PHASE_NUM} Verification",
  kind: "config",
  summary: """
  Verification status: {status}
  Score: {N}/{M}
  Timestamp: {ISO timestamp}

  ## Goal Achievement
  - Truths verified: {N}/{M}
  - Truths failed: {X}

  ## Required Artifacts
  - Artifacts verified: {N}/{M}
  - Artifacts missing: {X}
  - Artifacts stub: {X}
  - Artifacts orphaned: {X}

  ## Key Links
  - Links wired: {N}/{M}
  - Links partial: {X}
  - Links not wired: {X}

  ## Anti-Patterns
  - Blockers: {X}
  - Warnings: {X}

  ## Gaps
  Critical gaps: [...]
  Non-critical gaps: [...]

  ## Recommended Fix Plans
  - {plan 1}
  - {plan 2}
  """,
  parent_id: "{PHASE_PLAN_CONCEPT_ID}",
  file_refs: ["file_paths:line_ranges"],
  edges: [
    {
      to: "{PHASE_PLAN_CONCEPT_ID}",
      relation: "connects_to",
      description: "Verification of phase plan"
    }
  ],
  created_by_task: "verify-phase workflow"
})
```

Do NOT create VERIFICATION.md file.
All verification data lives in this concept.
</step>

<step name="update_phase_status">
**Update phase plan status based on verification.**

```yaml
Call: megamemory:update_concept({
  id: "{PHASE_PLAN_CONCEPT_ID}",
  changes: {
    summary: "Update summary with verification status and timestamp",
  }
})
```

If status = passed:
- Phase marked as verified
- Phase goal achieved

If status = gaps_found:
- Phase marked as incomplete
- Gaps and fix plans recorded

If status = human_needed:
- Phase marked as pending human review
- Human verification items recorded
</step>

<step name="return_to_orchestrator">
**Return results to execute-phase orchestrator.**

**Return format:**

```markdown
## Verification Complete

**Status:** {passed | gaps_found | human_needed}
**Score:** {N}/{M} must-haves verified
**Verification Concept:** Phase {PHASE_NUM} Verification

{If passed:}
All must-haves verified. Phase goal achieved. Ready to proceed.

{If gaps_found:}
### Gaps Found

{N} critical gaps blocking goal achievement:
1. {Gap 1 summary}
2. {Gap 2 summary}

### Recommended Fixes

{N} fix plans recommended:
1. {phase}-{next}-PLAN.md: {name}
2. {phase}-{next+1}-PLAN.md: {name}

{If human_needed:}
### Human Verification Required

{N} items need human testing:
1. {Item 1}
2. {Item 2}

Automated checks passed. Awaiting human verification.
```

The orchestrator will:
- If `passed`: Continue to update_roadmap
- If `gaps_found`: Create and execute fix plans, then re-verify
- If `human_needed`: Present items to user, collect responses
</step>

</process>

<success_criteria>
- [ ] Must-haves established (from MegaMemory concept or derived)
- [ ] All truths verified with status and evidence
- [ ] All artifacts checked at all three levels
- [ ] All key links verified
- [ ] Requirements coverage assessed (if applicable)
- [ ] Anti-patterns scanned and categorized
- [ ] Human verification items identified
- [ ] Overall status determined
- [ ] Fix plans generated (if gaps_found)
- [ ] Verification concept created in MegaMemory
- [ ] Phase plan status updated
- [ ] NO VERIFICATION.md file created
- [ ] Results returned to orchestrator
</success_criteria>
