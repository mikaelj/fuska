---
name: fuska-debug
description: Systematic debugging with persistent state across context resets using MegaMemory
argument-hint: [issue description]
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
Debug issues using scientific method with subagent isolation and MegaMemory persistence.

**Orchestrator role:** Gather symptoms, spawn fuska-debugger agent, handle checkpoints, spawn continuations.

**Why subagent:** Investigation burns context fast (reading files, forming hypotheses, testing). Fresh 200k context per investigation. Main context stays lean for user interaction.

**MegaMemory:** Debug sessions tracked as concepts, surviving across context resets.
</objective>

<megamemory_guide>

## How to read MegaMemory responses

All project data lives in MegaMemory. If a MegaMemory query returns no results, tell the user the data wasn't found.

**`megamemory:understand` returns:**
```json
{ "matches": [ { "id": "debug/session-001", "name": "session-001", "kind": "config", "summary": "{\"trigger\":\"...\",\"expected\":\"...\",\"actual\":\"...\",\"hypothesis\":\"...\",\"status\":\"active\"}", "children": [...], "edges": [...] } ] }
```

The important field is **`summary`** — it's a JSON string containing the debug session's data. Parse it to extract the fields you need. If `matches` is empty, the session doesn't exist.

**`megamemory:create_concept` returns:** `{id, message}` on success.

**`megamemory:update_concept` accepts changes:** `{summary?, name?, kind?, why?, file_refs?}` only. Pass the full updated JSON string as `summary`. Returns `{message}`.

**`megamemory:list_roots` returns:** an array of root concepts.

</megamemory_guide>

<execution_context>
@../../fuska/references/preflight-check-project-exists.md
</execution_context>

<context>
User's issue: `$ARGUMENTS`

Check for active debug sessions:
```
megamemory_understand(query="debug active session", top_k=10)
```
</context>

<process>

## 0. Preflight Check

Follow the MegaMemory Project Exists Preflight Check from @preflight-check-project-exists.md.

## 0.5. Help Check

If `$ARGUMENTS` starts with "help" (case-insensitive):

```
const input = "$ARGUMENTS" || ""
if (input.trim().toLowerCase().startsWith("help")) {
  Display:
  Help for /fuska-debug:

  Debug issues using scientific method with persistent state.

  DEBUG FLOW:
    1. Gather symptoms → expected, actual, errors, reproduction, timeline
    2. Investigate → spawn fuska-debugger agent to find root cause
    3. Root cause → identify the underlying issue
    4. Select mode → choose fix complexity: planned|checked|researched|verified|manual
    5. Fix → spawn fuska-do with debug context to apply fix

  Modes (based on fix complexity):
    planned    - Planner → Builder, auto-build
    checked    - + Plan Checker, ask before building
    researched - + Researcher, ask before building
    verified   - Full pipeline with Reviewer, auto-build
    manual     - Display findings, I'll fix it myself

  -> Stop
}
```

## 0.6. Resolve Model Profile

Read model profile for agent spawning:

```bash
megamemory_understand(query="config", top_k=5)
if (response.matches.length > 0) {
  const configSummaryString = response.matches[0].summary
  const configData = JSON.parse(configSummaryString)
  const modelProfile = configData.model_profile || "balanced"
}
```

Default to "balanced" if not set.

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
| fuska-debugger | quality_model | balanced_model | balanced_model |

```
const modelLookup = {
  quality: { debugger: aliases.quality_model },
  balanced: { debugger: aliases.balanced_model },
  budget: { debugger: aliases.balanced_model }
}
const models = modelLookup[modelProfile]
```

Store resolved model for use in Task calls below.

## 1. Check Active Sessions

**Step 1.1: Query active debug sessions**

```
megamemory_understand(query="debug session", top_k=20)
```

**Step 1.2: Check for active sessions**

If response.matches.length > 0:
```
const activeSessions = response.matches.filter(match => {
  const summaryString = match.summary
  const sessionData = JSON.parse(summaryString)
  return sessionData.status === "active"
})
```

**Step 1.3: Handle based on sessions and arguments**

If activeSessions.length > 0 AND no `$ARGUMENTS`:
- List sessions with trigger, hypothesis, next action
- User picks number to resume OR describes new issue

If `$ARGUMENTS` provided OR user describes new issue:
- Continue to symptom gathering

## 2. Gather Symptoms (if new issue)

Use question for each:

1. **Expected behavior** - What should happen?
2. **Actual behavior** - What happens instead?
3. **Error messages** - Any errors? (paste or describe)
4. **Timeline** - When did this start? Ever worked?
5. **Reproduction** - How do you trigger it?

After all gathered, confirm ready to investigate.

## 3. Spawn fuska-debugger Agent

**Step 3.1: Generate session slug**

```bash
slug=$(echo "$trigger" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//' | cut -c1-40)
```

**Step 3.2: Create debug session concept**

```
const sessionConceptData = {
  trigger: trigger,
  expected: expected,
  actual: actual,
  errors: errors,
  reproduction: reproduction,
  timeline: timeline,
  status: "active",
  created_at: new Date().toISOString()
}

megamemory_create_concept(
  name=`session-${slug}`,
  kind="config",
  summary=JSON.stringify(sessionConceptData),
  why="Track debug session investigation with symptoms"
)
```

**Step 3.3: Query import graph for related context**

Before spawning debugger, query import graph:

```
const triggerKeywords = extractKeywords(trigger)
const fileMatches = await megamemory_understand(query=`file ${triggerKeywords}`, top_k=20)
const symbolMatches = await megamemory_understand(query=`symbol ${triggerKeywords}`, top_k=20)
const deadCodeMatches = await megamemory_understand(query=`dead-code ${triggerKeywords}`, top_k=10)
```

Build import graph context for debugger prompt (see `<import_graph>` section below).

Fill prompt and spawn:

```markdown
<objective>
Investigate issue: {slug}

**Summary:** {trigger}
</objective>

<symptoms>
expected: {expected}
actual: {actual}
errors: {errors}
reproduction: {reproduction}
timeline: {timeline}
</symptoms>

<import_graph>
**Related files from import graph:**
${fileMatches.matches.slice(0, 10).map(m => {
  const data = JSON.parse(m.summary);
  const importCount = m.incoming_edges?.filter(e => e.relation === 'imports').length || 0;
  return `- ${data.path}: imported by ${importCount} files`;
}).join('\n') || 'No matching files found'}

**Related symbols:**
${symbolMatches.matches.slice(0, 10).map(m => {
  const data = JSON.parse(m.summary);
  return `- ${data.name} (${data.type}) in ${data.file}`;
}).join('\n') || 'No matching symbols found'}

**Dead code markers:**
${deadCodeMatches.matches.length > 0
  ? deadCodeMatches.matches.map(m => {
      const data = JSON.parse(m.summary);
      return `- ${m.name.replace('dead-code:', '')} detected as dead on ${data.detected_at}`;
    }).join('\n')
  : 'None'
}
</import_graph>

<session_concept>
ID: {session_id}
Name: session-{slug}
</session_concept>

<mode>
symptoms_prefilled: true
goal: find_and_fix
</mode>
```

```
Task(
  prompt=filled_prompt,
  subagent_type="fuska-debugger",
  variant="validate",
  model="{debugger_model}",
  description="Debug {slug}"
)
```

## 4. Handle Agent Return

**If `## ROOT CAUSE FOUND`:**

Parse debugger output for:
- root_cause
- fix_complexity (simple | moderate | complex)
- evidence
- suggested_fix
- files_involved

**Map complexity to recommended mode:**
```
const modeRecommendation = {
  simple: "planned",
  moderate: "checked",
  complex: "researched"
}
const recommendedMode = modeRecommendation[fix_complexity] || "checked"
```

**Present mode selection:**
```
question(questions=[{
  header: "Fix Mode",
  question: "Root cause found. Select mode to proceed with fix:",
  options: [
    { label: "{recommendedMode} (Recommended)", description: "Based on {fix_complexity} fix complexity." },
    { label: "Planned", description: "Planner → Builder. Auto-build." },
    { label: "Checked", description: "Planner → Plan Checker → Builder. Ask first." },
    { label: "Researched", description: "Researcher → Planner → Plan Checker → Builder. Ask first." },
    { label: "Verified", description: "Full pipeline with Reviewer. Auto-build." },
    { label: "Manual", description: "I'll fix it myself." }
  ]
}])
```

If "Manual" selected -> display findings, update session concept with status "resolved", stop.

Otherwise -> **Spawn fuska-do with debug context:**
```
Task(
  prompt=<objective>
Fix issue from debug session: session-${slug}
</objective>

<debug_findings>
**Root Cause:** ${root_cause}
**Evidence:** ${evidence}
**Fix Complexity:** ${fix_complexity}
**Suggested Fix:** ${suggested_fix}
**Files Involved:** ${files_involved}
**Debug Session ID:** ${session_id}
</debug_findings>

<mode>
**Mode:** ${selected_mode}
**Skip Researcher:** true (investigation already complete)
</mode>

<task_description>
${suggested_fix}
</task_description>,
  subagent_type="general",
  description="Fix: ${slug}"
)
```

**If `## CHECKPOINT REACHED`:**
- Present checkpoint details to user
- Get user response
- Spawn continuation agent (see step 5)

**If `## INVESTIGATION INCONCLUSIVE`:**
- Show what was checked and eliminated
- Update debug session concept with progress
- Offer options:
  - "Continue investigating" - spawn new agent with additional context
  - "Manual investigation" - done
  - "Add more context" - gather more symptoms, spawn again

## 5. Spawn Continuation Agent (After Checkpoint)

**Step 5.1: Query debug session concept**

```
megamemory_understand(query=`session-${slug}`, top_k=1)
if (response.matches.length > 0) {
  const sessionSummaryString = response.matches[0].summary
  const sessionData = JSON.parse(sessionSummaryString)
  const sessionId = response.matches[0].id
}
```

**Step 5.2: Update session with checkpoint response**

```
const updatedSessionData = {
  ...sessionData,
  checkpoint_type: checkpoint_type,
  checkpoint_response: user_response,
  last_updated: new Date().toISOString()
}

megamemory_update_concept(
  id=sessionId,
  changes={
    summary: JSON.stringify(updatedSessionData)
  }
)
```

**Step 5.3: Build continuation prompt**

When user responds to checkpoint, spawn fresh agent:

```markdown
<objective>
Continue debugging {slug}. Evidence is in the debug session concept.
</objective>

<session_concept>
ID: {session_id}
Summary: {session_summary_string}
</session_concept>

<checkpoint_response>
**Type:** {checkpoint_type}
**Response:** {user_response}
</checkpoint_response>

<mode>
goal: find_and_fix
</mode>
```

```
Task(
  prompt=continuation_prompt,
  subagent_type="fuska-debugger",
  variant="validate",
  model="{debugger_model}",
  description="Continue debug {slug}"
)
```

## 6. Archive Resolved Sessions

When root cause found and fix confirmed:

**Step 6.1: Update session concept**

```
const resolvedSessionData = {
  ...sessionData,
  status: "resolved",
  root_cause: root_cause,
  evidence: evidence,
  fixed_at: new Date().toISOString()
}

megamemory_update_concept(
  id=sessionId,
  changes={
    summary: JSON.stringify(resolvedSessionData),
    name: `resolved-${slug}`
  }
)
```

</process>

<success_criteria>
- [ ] Active sessions checked from MegaMemory
- [ ] Symptoms gathered (if new)
- [ ] Debug session concept created
- [ ] fuska-debugger spawned with context
- [ ] Checkpoints handled correctly
- [ ] Session concept updated with progress
- [ ] Root cause confirmed before fixing
- [ ] Sessions archived when resolved
</success_criteria>
