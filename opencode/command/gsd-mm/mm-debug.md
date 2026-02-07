---
name: gsd-mm-debug
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

**Orchestrator role:** Gather symptoms, spawn gsd-mm-debugger agent, handle checkpoints, spawn continuations.

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
@~/.config/opencode/gsd-mm/references/preflight-check-project-exists.md
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

## 0. Resolve Model Profile

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

**Model lookup table:**

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| gsd-mm-debugger | opus | sonnet | sonnet |

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

## 3. Spawn gsd-mm-debugger Agent

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
  subagent_type="gsd-mm-debugger",
  model="{debugger_model}",
  description="Debug {slug}"
)
```

## 4. Handle Agent Return

**If `## ROOT CAUSE FOUND`:**
- Display root cause and evidence summary
- Update debug session concept with findings
- Offer options:
  - "Fix now" - spawn fix subagent
  - "Plan fix" - suggest /gsd-mm-plan-phase --gaps
  - "Manual fix" - done

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
  subagent_type="gsd-mm-debugger",
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
- [ ] gsd-mm-debugger spawned with context
- [ ] Checkpoints handled correctly
- [ ] Session concept updated with progress
- [ ] Root cause confirmed before fixing
- [ ] Sessions archived when resolved
</success_criteria>
