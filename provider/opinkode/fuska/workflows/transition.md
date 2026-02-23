<required_reading>

**Query these concepts from MegaMemory NOW:**

1. STATE concept (kind="config" or kind="decision")
2. PROJECT concept (kind="module" or kind="config")
3. ROADMAP concept (kind="config")
4. Current chapter's concept and its plan children
5. Current chapter's summary concepts

</required_reading>

<purpose>

Mark current chapter complete and advance to next. This is the natural point where progress tracking and PROJECT concept evolution happen.

"Planning next chapter" = "current chapter is done"

</purpose>

<megamemory_guide>
@./references/megamemory-integration.md
</megamemory_guide>

<process>

<step name="load_project_state" priority="first">

Before transition, query MegaMemory for project state:

```bash
# Query STATE concept
STATE_CONCEPT=$(megamemory:understand(query="project state"))

# Query PROJECT concept
PROJECT_CONCEPT=$(megamemory:understand(query="project requirements decisions"))

# Query ROADMAP concept
ROADMAP_CONCEPT=$(megamemory:understand(query="roadmap chapters progress"))

# Parse JSON summaries
STATE_DATA=$(echo "$STATE_CONCEPT" | jq '.summary')
PROJECT_DATA=$(echo "$PROJECT_CONCEPT" | jq '.summary')
ROADMAP_DATA=$(echo "$ROADMAP_CONCEPT" | jq '.summary')

# Get current position
CURRENT_CHAPTER=$(echo "$STATE_DATA" | jq '.current_position.chapter')
```

Parse current position to verify we're transitioning the right chapter.
Note accumulated context that may need updating after transition.

If concepts don't exist, query with different terms or check for legacy naming:

```bash
# Try alternative queries
megamemory:understand(query="project state config")
megamemory:understand(query="project configuration")
megamemory:understand(query="roadmap chapters")

# If still missing, create them with appropriate defaults
megamemory:create_concept(...)
```

</step>

<step name="verify_completion">

Check current chapter has all plan summaries:

```bash
# Query MegaMemory for chapter's plan children
CHAPTER_PLANS=$(megamemory:understand({query: "Chapter ${CURRENT_CHAPTER} plans", top_k: 100})

# Also query for summary concepts
CHAPTER_SUMMARIES=$(megamemory:understand({query: "Chapter ${CURRENT_CHAPTER} summaries", top_k: 100})
```

**Verification logic:**

- Count PLAN files/concepts
- Count SUMMARY files/concepts
- If counts match: all plans complete
- If counts don't match: incomplete

<config-check>

```bash
megamemory:understand({query: "planning config", top_k: 1})
```

Parse the result:
- If config concept exists: Parse `summary` JSON and extract settings
- If config concept missing: Use default settings

</config-check>

**If all plans complete:**

<if mode="yolo">

```
[AUTO] Auto-approved: Transition Chapter [X] → Chapter [X+1]
Chapter [X] complete — all [Y] plans finished.

Proceeding to mark done and advance...
```

Proceed directly to cleanup_handoff step.

</if>

<if mode="interactive" OR="custom with gates.confirm_transition true">

Ask: "Chapter [X] complete — all [Y] plans finished. Ready to mark done and move to Chapter [X+1]?"

Wait for confirmation before proceeding.

</if>

**If plans incomplete:**

**SAFETY RAIL: always_confirm_destructive applies here.**
Skipping incomplete plans is destructive — ALWAYS prompt regardless of mode.

Present:

```
Chapter [X] has incomplete plans:
- {chapter}-01-SUMMARY.md [OK] Complete
- {chapter}-02-SUMMARY.md [FAIL] Missing
- {chapter}-03-SUMMARY.md [FAIL] Missing

[WARN] Safety rail: Skipping plans requires confirmation (destructive action)

Options:
1. Continue current chapter (execute remaining plans)
2. Mark complete anyway (skip remaining plans)
3. Review what's left
```

Wait for user decision.

</step>

<step name="cleanup_handoff">

Check for lingering tracking state in MegaMemory:

```bash
megamemory:understand({query: "agent tracking", top_k: 1})
```

If `current_agent_id` is not null:
- A previous session was interrupted mid-execution
- Clear `current_agent_id` to null (set in init_agent_tracking during next execution)

This ensures clean state for the next chapter.
</step>

<step name="update_roadmap">

Update the ROADMAP concept in MegaMemory:

Parse current ROADMAP concept.summary JSON:

```json
{
  "chapters": [...],
  "milestones": [...],
  "progress": [...],
  "updated": "..."
}
```

Update the JSON:

- Mark current chapter: status: "complete", completed_date: "[today]"
- Update plans_complete to final (e.g., 3, plans_total: 3)
- Update progress array with completion date
- Keep next chapter as status: "pending"
- Update updated timestamp

**Example update:**

```json
{
  "chapters": [
    {
      "number": 1,
      "name": "Foundation",
      "status": "complete",
      "completed_date": "2025-01-15",
      "plans_complete": 3,
      "plans_total": 3,
      "description": "..."
    },
    {
      "number": 2,
      "name": "Authentication",
      "status": "pending",
      "plans_complete": 0,
      "plans_total": 2,
      "description": "..."
    }
  ],
  "progress": [
    {
      "chapter": 1,
      "plans_complete": 3,
      "plans_total": 3,
      "status": "complete",
      "completed": "2025-01-15"
    },
    {
      "chapter": 2,
      "plans_complete": 0,
      "plans_total": 2,
      "status": "pending",
      "completed": null
    }
  ],
  "updated": "2025-01-20T10:00:00Z"
}
```

**MegaMemory Update:**
```bash
megamemory:update_concept(
  id="{roadmap_concept_id}",
  changes={"summary": "{updated JSON string}"}
)
```

</step>

<step name="archive_prompts">

If prompts were generated for the chapter, they stay in place.
The `completed/` subfolder pattern from create-meta-prompts handles archival.
</step>

<step name="evolve_project">

Evolve PROJECT concept to reflect learnings from completed chapter.

**Read chapter summaries:**

```bash
# Query MegaMemory for summary concepts
megamemory:understand({query: "Chapter ${CURRENT_CHAPTER} summaries", top_k: 100})
```

**Assess requirement changes:**

Parse current PROJECT concept.summary JSON:

```json
{
  "what_this_is": "...",
  "core_value": "...",
  "requirements": {
    "active": [],
    "validated": [],
    "out_of_scope": []
  },
  "key_decisions": [],
  "updated": "..."
}
```

1. **Requirements validated?**
   - Any Active requirements shipped in this chapter?
   - Move to validated array: `- [OK] [Requirement] — Chapter X`

2. **Requirements invalidated?**
   - Any Active requirements discovered to be unnecessary or wrong?
   - Move to out_of_scope array: `- [Requirement] — [why invalidated]`

3. **Requirements emerged?**
   - Any new requirements discovered during building?
   - Add to active array: `- [ ] [New requirement]`

4. **Decisions to log?**
   - Extract decisions from SUMMARY.md files
   - Add to key_decisions array with outcome if known

5. **"What This Is" still accurate?**
   - If the product has meaningfully changed, update what_this_is
   - Keep it current and accurate

**Update PROJECT concept:**

Update JSON with changes and set updated timestamp.

**Example evolution:**

Before:
```json
{
  "requirements": {
    "active": [
      "- [ ] JWT authentication",
      "- [ ] Real-time sync < 500ms",
      "- [ ] Offline mode"
    ],
    "validated": [],
    "out_of_scope": [
      "- OAuth2 — complexity not needed for v1"
    ]
  }
}
```

After (Chapter 2 shipped JWT auth, discovered rate limiting needed):
```json
{
  "requirements": {
    "active": [
      "- [ ] Real-time sync < 500ms",
      "- [ ] Offline mode",
      "- [ ] Rate limiting on sync endpoint"
    ],
    "validated": [
      "- [OK] JWT authentication — Chapter 2"
    ],
    "out_of_scope": [
      "- OAuth2 — complexity not needed for v1"
    ]
  }
}
```

**MegaMemory Update:**
```bash
megamemory:update_concept(
  id="{project_concept_id}",
  changes={"summary": "{updated JSON string}"}
)
```

**Step complete when:**

- [ ] Chapter summaries reviewed for learnings
- [ ] Validated requirements moved from active to validated
- [ ] Invalidated requirements moved to out_of_scope with reason
- [ ] Emerged requirements added to active
- [ ] New decisions logged in key_decisions array
- [ ] what_this_is updated if product changed
- [ ] Updated timestamp reflects this transition

</step>

<step name="update_current_position_after_transition">

Update current_position in STATE concept.summary to reflect chapter completion and transition.

**Parse current STATE JSON:**
```json
{
  "current_position": {
    "chapter": 2,
    "total_chapters": 4,
    "chapter_name": "Authentication",
    "plan": "2 of 2",
    "status": "chapter_complete",
    "progress_percent": 60
  },
  "updated": "..."
}
```

**Instructions:**

- Increment chapter number to next chapter
- Reset plan to null
- Set status to "ready_to_plan"
- Recalculate progress_percent based on completed plans

**Example — transitioning from Chapter 2 to Chapter 3:**

Before:
```json
{
  "current_position": {
    "chapter": 2,
    "total_chapters": 4,
    "chapter_name": "Authentication",
    "plan": "2 of 2",
    "status": "chapter_complete",
    "progress_percent": 60
  }
}
```

After:
```json
{
  "current_position": {
    "chapter": 3,
    "total_chapters": 4,
    "chapter_name": "Core Features",
    "plan": null,
    "status": "ready_to_plan",
    "progress_percent": 60
  }
}
```

**MegaMemory Update:**
```bash
megamemory:update_concept(
  id="{state_concept_id}",
  changes={"summary": "{updated JSON string}"}
)
```

**Step complete when:**

- [ ] Chapter number incremented to next chapter
- [ ] Plan status reset to null
- [ ] Status shows "ready_to_plan"
- [ ] Progress percent reflects total completed plans

</step>

<step name="update_project_reference">

Update project_reference in STATE concept.summary.

**Parse current JSON:**
```json
{
  "project_reference": {
    "last_updated": "2025-01-15",
    "core_value": "...",
    "current_focus": "Authentication"
  }
}
```

**Update:**
```json
{
  "project_reference": {
    "last_updated": "2025-01-20",
    "core_value": "Current core value from PROJECT concept",
    "current_focus": "Core Features"
  }
}
```

**MegaMemory Update:**
```bash
megamemory:update_concept(
  id="{state_concept_id}",
  changes={"summary": "{updated JSON string}"}
)
```

</step>

<step name="review_accumulated_context">

Update accumulated_context in STATE concept.summary.

**Decisions:**

- Note recent decisions from this chapter (3-5 max) in recent_decisions array
- Full log lives in PROJECT concept's key_decisions

**Blockers/Concerns:**

- Review blockers from completed chapter
- If addressed in this chapter: Remove from list
- If still relevant for future: Keep with "Chapter X" prefix
- Add any new concerns from completed chapter's summaries

**Example:**

Before:
```json
{
  "accumulated_context": {
    "blockers": [
      "[WARN] [Chapter 1] Database schema not indexed for common queries",
      "[WARN] [Chapter 2] WebSocket reconnection behavior on flaky networks unknown"
    ]
  }
}
```

After (if database indexing was addressed in Chapter 2):
```json
{
  "accumulated_context": {
    "blockers": [
      "[WARN] [Chapter 2] WebSocket reconnection behavior on flaky networks unknown"
    ]
  }
}
```

**MegaMemory Update:**
```bash
megamemory:update_concept(
  id="{state_concept_id}",
  changes={"summary": "{updated JSON string}"}
)
```

**Step complete when:**

- [ ] Recent decisions noted in array
- [ ] Resolved blockers removed from list
- [ ] Unresolved blockers kept with chapter prefix
- [ ] New concerns from completed chapter added

</step>

<step name="update_session_continuity_after_transition">

Update session_continuity in STATE concept.summary to reflect transition completion.

**Parse and update:**
```json
{
  "session_continuity": {
    "last_session": "2025-01-20",
    "stopped_at": "Chapter 2 complete, ready to plan Chapter 3",
    "resume_file": null
  }
}
```

**MegaMemory Update:**
```bash
megamemory:update_concept(
  id="{state_concept_id}",
  changes={"summary": "{updated JSON string}"}
)
```

**Step complete when:**

- [ ] Last session timestamp updated to current date and time
- [ ] Stopped at describes chapter completion and next chapter
- [ ] Resume file confirmed as null (transitions don't use resume files)

</step>

<step name="offer_next_chapter">

**MANDATORY: Verify milestone status before presenting next steps.**

**Step 1: Query ROADMAP concept and identify chapters in current milestone**

Parse ROADMAP concept.summary JSON to extract:
1. Current chapter number (the chapter just transitioned from)
2. All chapter numbers in the current milestone section

From milestones array:
```json
{
  "milestones": [
    {
      "version": "v1.0",
      "chapters": [1, 2, 3],
      "status": "in_progress"
    }
  ]
}
```

Count total chapters and identify the highest chapter number in the milestone.

State: "Current chapter is {X}. Milestone has {N} chapters (highest: {Y})."

**Step 2: Route based on milestone status**

| Condition | Meaning | Action |
|-----------|---------|--------|
| current chapter < highest chapter | More chapters remain | Go to **Route A** |
| current chapter = highest chapter | Milestone complete | Go to **Route B** |

---

**Route A: More chapters remain in milestone**

Query ROADMAP concept for next chapter's name and description from chapters array.

**If next chapter exists:**

<if mode="yolo">

```
Chapter [X] marked complete.

Next: Chapter [X+1] — [Name]

[AUTO] Auto-continuing: Plan Chapter [X+1] in detail
```

Exit skill and invoke Command("/fuska-plan [X+1]")

</if>

<if mode="interactive" OR="custom with gates.confirm_transition true">

```
## [OK] Chapter [X] Complete

---

## > Next Up

**Chapter [X+1]: [Name]** — [Goal from ROADMAP]

`/fuska-plan [X+1]`

*`/new` first → fresh context window*

---

**Also available:**
- `/fuska-design [X+1]` — gather context first
- `/fuska-research-chapter [X+1]` — investigate unknowns
- Review roadmap

---

```

</if>

---

**Route B: Milestone complete (all chapters done)**

<if mode="yolo">

```
Chapter {X} marked complete.

[DONE] Milestone {version} is 100% complete — all {N} chapters finished!

[AUTO] Auto-continuing: Complete milestone and archive
```

Exit skill and invoke Command("/fuska-complete-milestone {version}")

</if>

<if mode="interactive" OR="custom with gates.confirm_transition true">

```
## [OK] Chapter {X}: {Chapter Name} Complete

[DONE] Milestone {version} is 100% complete — all {N} chapters finished!

---

## > Next Up

**Complete Milestone {version}** — archive and prepare for next

`/fuska-complete-milestone {version}`

*`/new` first → fresh context window*

---

**Also available:**
- Review accomplishments before archiving

---

```

</if>

</step>

</process>

<implicit_tracking>

Progress tracking is IMPLICIT:

- "Plan chapter 2" → Chapter 1 must be done (or ask)
- "Plan chapter 3" → Chapters 1-2 must be done (or ask)
- Transition workflow makes it explicit in ROADMAP concept

No separate "update progress" step. Forward motion IS progress.

</implicit_tracking>

<partial_completion>

If user wants to move on but chapter isn't fully complete:

```
Chapter [X] has incomplete plans:
- {chapter}-02-PLAN.md (not executed)
- {chapter}-03-PLAN.md (not executed)

Options:
1. Mark complete anyway (plans weren't needed)
2. Defer work to later chapter
3. Stay and finish current chapter
```

Respect user judgment — they know if work matters.

**If marking complete with incomplete plans:**

- Update ROADMAP concept: plans_complete reflects actual count (e.g., 2, plans_total: 3)
- Note in transition message which plans were skipped

</partial_completion>

<success_criteria>

Transition is complete when:

- [ ] Current chapter plan summaries verified (all exist or user chose to skip)
- [ ] Any stale handoffs deleted from file system
- [ ] ROADMAP concept updated with completion status and plan count
- [ ] PROJECT concept evolved (requirements, decisions, description if needed)
- [ ] STATE concept updated (position, project reference, context, session)
- [ ] Progress table updated in ROADMAP JSON
- [ ] User knows next steps

</success_criteria>
