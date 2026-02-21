<purpose>
Orchestrate parallel debug agents to investigate verification issues and find root causes.

After verification finds issues, spawn one debug agent per issue. Each agent investigates autonomously with symptoms pre-filled from verification. Collect root causes, create diagnosis concept in MegaMemory, then hand off to plan-chapter --fixes with actual diagnoses.

Coordinator stays lean: parse issues, spawn agents, collect results, create MegaMemory concepts.
</purpose>

@../references/megamemory-integration.md

<process>

<step name="query_existing_diagnoses">
**Before spawning debug agents, query MegaMemory for existing diagnoses:**

```
megamemory:understand with query: "diagnosis [chapter] gap [gap-name] root cause"
```

If relevant diagnosis concept exists:
- Review existing root cause
- Check if diagnosis is still applicable
- If valid, skip new diagnosis
- If outdated or incorrect, note what needs re-investigation
</step>

<step name="parse_gaps">
**Extract gaps from MegaMemory verification concept:**

Query the verification concept for current chapter:

```
megamemory:understand with query: "[chapter] verification test results gaps"
```

Parse the concept.summary as JSON to extract gaps:

```yaml
{
  "gaps": [
    {
      "truth": "Comment appears immediately after submission",
      "status": "failed",
      "reason": "User reported: works but doesn't show until I refresh the page",
      "severity": "major",
      "test": 2,
      "artifacts": [],
      "missing": []
    }
  ],
  "tests": [
    {"num": 2, "truth": "...", "expected": "...", "instructions": "..."}
  ]
}
```

Build gap list:
```
gaps = [
  {truth: "Comment appears immediately...", severity: "major", test_num: 2, reason: "..."},
  {truth: "Reply button positioned correctly...", severity: "minor", test_num: 5, reason: "..."},
  ...
]
```
</step>

<step name="report_plan">
**Report diagnosis plan to user:**

```
## Diagnosing {N} Gaps

Spawning parallel debug agents to investigate root causes:

| Gap (Truth) | Severity |
|-------------|----------|
| Comment appears immediately after submission | major |
| Reply button positioned correctly | minor |
| Delete removes comment | blocker |

Each agent will:
1. Create debug session concept via megamemory:create_concept() with symptoms pre-filled
2. Investigate autonomously (read code, form hypotheses, test)
3. Return root cause

This runs in parallel - all gaps investigated simultaneously.
```
</step>

<step name="spawn_agents">
**Spawn debug agents in parallel:**

For each gap, fill the debug-subagent-prompt template and spawn:

```
Task(
  prompt=filled_debug_subagent_prompt,
  subagent_type="general",
  description="Debug: {truth_short}"
)
```

**All agents spawn in single message** (parallel execution).

Template placeholders:
- `{truth}`: The expected behavior that failed
- `{expected}`: From verification test
- `{actual}`: Verbatim user description from reason field
- `{errors}`: Any error messages from verification (or "None reported")
- `{reproduction}`: "Test {test_num} in verification"
- `{timeline}`: "Discovered during verification"
- `{goal}`: `find_root_cause_only` (verification flow - plan-chapter --fixes handles fixes)
- `{slug}`: Generated from truth

**Debug agent MegaMemory operations:**

Each debug agent should:
1. Create a debug session concept at the start:
   ```
   megamemory:create_concept with:
   - name: "debug-{slug}"
   - kind: "component"
   - summary: JSON.stringify({
     slug: "{slug}",
     timestamp: "{ISO-8601}",
     issue: "{truth}",
     symptoms: {
       expected: "{expected}",
       actual: "{actual}",
       errors: "{errors}",
       reproduction: "{reproduction}"
     },
     investigation: "Initial hypothesis: ...",
     resolution: null,
     status: "investigating"
   })
   - why: "Tracks debug session for {slug}"
   - file_refs: []
   ```

2. Update the debug concept as investigation progresses:
   ```
   megamemory:update_concept with:
   - id: "debug-{slug}"
   - changes: {
     summary: JSON.stringify({
       ...existing data,
       investigation: "Updated hypothesis with findings...",
       status: "investigating" or "root_cause_found"
     })
   }
   ```

3. Set resolution when root cause found:
   ```
   megamemory:update_concept with:
   - id: "debug-{slug}"
   - changes: {
     summary: JSON.stringify({
       ...existing data,
       resolution: "Root cause: {specific cause}",
       status: "completed"
     }),
     file_refs: ["file1:lines", "file2:lines"]
   }
   ```
</step>

<step name="collect_results">
**Collect root causes from agents:**

Each agent returns with:
```
## ROOT CAUSE FOUND

**Debug Session Concept:** debug-{slug}

**Root Cause:** {specific cause with evidence}

**Evidence Summary:**
- {key finding 1}
- {key finding 2}
- {key finding 3}

**Files Involved:**
- {file1}: {what's wrong}
- {file2}: {related issue}

**Suggested Fix Direction:** {brief hint for plan-chapter --fixes}
```

Parse each return to extract:
- root_cause: The diagnosed cause
- files: Files involved
- debug_concept: Debug session concept name
- suggested_fix: Hint for gap closure plan

If agent returns `## INVESTIGATION INCONCLUSIVE`:
- root_cause: "Investigation inconclusive - manual review needed"
- Note which issue needs manual attention
- Include remaining possibilities from agent return
</step>

<step name="create_diagnosis_concepts">
**Create MegaMemory diagnosis concepts for each gap:**

For each diagnosed gap, create a concept:

```
megamemory:create_concept with:
- name: "[Chapter] [gap-slug] diagnosis"
- kind: "feature"
- summary: JSON with:
  {
    "chapter": "XX",
    "gap_name": "short gap name",
    "root_cause": "specific root cause with evidence",
    "symptoms": {
      "truth": "expected behavior",
      "actual": "actual behavior from user",
      "reproduction": "Test {test_num} in UAT"
    },
    "evidence": [
      {"file": "path/to/file", "issue": "what's wrong"},
      {"file": "path/to/file2", "issue": "related issue"}
    ],
    "suggested_fix": "brief hint for plan-chapter",
    "missing": ["action 1", "action 2"],
    "confidence": "HIGH|MEDIUM|LOW",
    "debug_session_concept": "debug-{slug}"
  }
- why: "Root cause diagnosed for [gap name]"
- edges: [
  {relation: "depends_on", to: "[chapter-concept-id]"},
  {relation: "connects_to", to: "[feature-component-id]"}
]
- file_refs: ["src/file1.ts", "src/file2.ts"]
```

**DO NOT write to verification files.** Store diagnosis in MegaMemory concepts.

**For future retrieval:** Query with `megamemory:understand` for diagnosis concepts.
</step>

<step name="update_verification_concept">
**Update MegaMemory verification concept with diagnosis references:**

Query the existing verification concept:

```
megamemory:understand with query: "[chapter] verification test results"
```

Parse the concept.summary as JSON, then update it:

```
megamemory:update_concept with:
- id: [verification-concept-id]
- changes: {
  summary: JSON with updated gaps:
  {
    "gaps": [
      {
        "truth": "Comment appears immediately after submission",
        "status": "diagnosed",
        "reason": "User reported: works but doesn't show until I refresh the page",
        "severity": "major",
        "test": 2,
        "root_cause": "useEffect in CommentList.tsx missing commentCount dependency",
        "artifacts": [
          {"path": "src/components/CommentList.tsx", "issue": "useEffect missing dependency"}
        ],
        "missing": [
          "Add commentCount to useEffect dependency array",
          "Trigger re-render when new comment added"
        ],
        "diagnosis_concept": "[Chapter] comment-not-refreshing diagnosis"
      }
    ],
    "tests": [...]
  }
}
```

**DO NOT commit verification files.** All updates are in MegaMemory.
</step>

<step name="report_results">
**Report diagnosis results and hand off:**

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Fuska: Diagnosis complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Gap (Truth) | Root Cause | Files |
|-------------|------------|-------|
| Comment appears immediately | useEffect missing dependency | CommentList.tsx |
| Reply button positioned correctly | CSS flex order incorrect | ReplyButton.tsx |
| Delete removes comment | API missing auth header | api/comments.ts |

Diagnosis concepts created in MegaMemory
Debug session concepts created in MegaMemory

Proceeding to plan fixes...
```

Return to verify-work coordinator for automatic planning.
Do NOT offer manual next steps - verify-work handles the rest.
</step>

</process>

<context_efficiency>
**Coordinator context:** ~15%
- Query MegaMemory for verification concept
- Parse JSON from concept.summary
- Fill template strings
- Spawn parallel Task calls
- Collect results
- Create MegaMemory diagnosis concepts

**Each debug agent:** Fresh 200k context
- Loads full debug workflow
- Loads debugging references
- Investigates with full capacity
- Returns root cause

**No symptom gathering.** Agents start with symptoms pre-filled from verification.
**No fix application.** Agents only diagnose - plan-chapter --fixes handles fixes.
</context_efficiency>

<failure_handling>
**Agent fails to find root cause:**
- Create diagnosis concept with root_cause: "Investigation inconclusive"
- Mark as "needs manual review"
- Continue with other gaps
- Report incomplete diagnosis

**Agent times out:**
- Query MegaMemory for debug concept: `megamemory:understand({query: "debug {slug}"})`
- Parse the debug concept's summary for partial progress
- Can resume with /fuska-debug

**All agents fail:**
- Something systemic (permissions, git, etc.)
- Report for manual investigation
- Fall back to plan-chapter --fixes without root causes (less precise)
</failure_handling>

<success_criteria>
- [ ] Gaps parsed from MegaMemory verification concept
- [ ] Existing diagnoses queried from MegaMemory
- [ ] Debug agents spawned in parallel
- [ ] Root causes collected from all agents
- [ ] MegaMemory diagnosis concepts created for each gap
- [ ] MegaMemory verification concept updated with diagnosis references
- [ ] Debug session concepts created in MegaMemory
- [ ] Hand off to verify-work for automatic planning
</success_criteria>
