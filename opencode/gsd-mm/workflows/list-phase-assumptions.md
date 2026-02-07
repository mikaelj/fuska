<purpose>
Surface OpenCode's assumptions about a phase before planning, enabling users to correct misconceptions early.

Key difference from discuss-phase: This is ANALYSIS of what OpenCode thinks, not INTAKE of what user knows. No file output - purely conversational to prompt discussion.
</purpose>

<megamemory_guide>
**MegaMemory Strategy for Listing Phase Assumptions:**

**When to Query:**
- At start: `megamemory:understand` with query about phase context, phase goals, phase scope
- Load existing phase concept to understand what's known
- Query for related features, components, decisions

**What to Look For:**
- Phase concept with goals, scope, requirements
- Related feature/component concepts with technical details
- Decision concepts affecting this phase
- Config concepts with constraints or patterns

**No Creation Needed:**
This workflow is ANALYSIS, not STORAGE.
- Parse MM concept.summary as JSON to extract known context
- Present assumptions based on MM knowledge
- Update concepts via discuss-phase workflow when user provides corrections

**Concept Structure for Parsing:**
```json
{
  "phase": "XX",
  "name": "Phase name",
  "goal": "Primary goal",
  "scope": {
    "included": ["item 1", "item 2"],
    "excluded": ["item 3", "item 4"]
  },
  "requirements": {
    "validated": ["req 1"],
    "active": ["req 2"],
    "out_of_scope": ["req 3"]
  },
  "decisions": ["decision 1", "decision 2"],
  "dependencies": ["dep 1", "dep 2"]
}
```

**Parsing:**
When retrieving phase context, parse `concept.summary` as JSON to extract:
- scope boundaries
- requirements
- decisions
- dependencies
</megamemory_guide>

<process>

<step name="validate_phase" priority="first">
Phase number: `$ARGUMENTS` (required)

**If argument missing:**

```
Error: Phase number required.

Usage: /gsd-list-phase-assumptions [phase-number]
Example: /gsd-list-phase-assumptions 3
```

Exit workflow.

**If argument provided:**
Query MM for phase context:

```
megamemory:understand with query: "Phase ${PHASE} context goals scope"
```

**If no phase concept found:**

```
Error: Phase ${PHASE} not found in MegaMemory.

Available phases:
[List phase concepts from MM results]
```

Exit workflow.

**If phase concept found:**
Parse concept.summary as JSON to extract:

- Phase number
- Phase name
- Phase description/goal
- Scope details
- Requirements
- Decisions
- Dependencies

Continue to analyze_phase.
</step>

<step name="analyze_phase">
Based on MM phase concept and project context, identify assumptions across five areas:

**1. Technical Approach:**
What libraries, frameworks, patterns, or tools would OpenCode use?
- Query MM for related feature/component concepts
- "I'd use X library because..."
- "I'd follow Y pattern because..."
- "I'd structure this as Z because..."

**2. Implementation Order:**
What would OpenCode build first, second, third?
- "I'd start with X because it's foundational"
- "Then Y because it depends on X"
- "Finally Z because..."

**3. Scope Boundaries:**
What's included vs excluded in OpenCode's interpretation?
- Parse from phase concept.summary JSON:
  ```json
  "scope": {
    "included": ["A", "B", "C"],
    "excluded": ["D", "E", "F"],
    "ambiguous": ["G"]
  }
  ```
- "This phase includes: A, B, C"
- "This phase does NOT include: D, E, F"
- "Boundary ambiguities: G could go either way"

**4. Risk Areas:**
Where does OpenCode expect complexity or challenges?
- Query MM for related decision concepts
- "The tricky part is X because..."
- "Potential issues: Y, Z"
- "I'd watch out for..."

**5. Dependencies:**
What does OpenCode assume exists or needs to be in place?
- Parse from phase concept.summary JSON:
  ```json
  "dependencies": ["dep1", "dep2", "dep3"]
  ```
- "This assumes X from previous phases"
- "External dependencies: Y, Z"
- "This will be consumed by..."

Be honest about uncertainty. Mark assumptions with confidence levels:
- "Fairly confident: ..." (clear from MM)
- "Assuming: ..." (reasonable inference)
- "Unclear: ..." (could go multiple ways)
</step>

<step name="present_assumptions">
Present assumptions in a clear, scannable format:

```
## My Assumptions for Phase ${PHASE}: ${PHASE_NAME}

### Technical Approach
[List assumptions about how to implement]

### Implementation Order
[List assumptions about sequencing]

### Scope Boundaries
**In scope:** [from MM concept.summary JSON]
**Out of scope:** [from MM concept.summary JSON]
**Ambiguous:** [from MM concept.summary JSON]

### Risk Areas
[List anticipated challenges]

### Dependencies
**From prior phases:** [from MM concept.summary JSON]
**External:** [third-party needs]
**Feeds into:** [what future phases need from this]

---

**What do you think?**

Are these assumptions accurate? Let me know:
- What I got right
- What I got wrong
- What I'm missing
```

Wait for user response.
</step>

<step name="gather_feedback">
**If user provides corrections:**

Acknowledge the corrections:

```
Got it. Key corrections:
- [correction 1]
- [correction 2]

This changes my understanding significantly. [Summarize new understanding]

Would you like me to update the MegaMemory phase concept with these corrections?
```

**If user confirms assumptions:**

```
Great, assumptions validated.
```

**If user wants corrections stored:**

Query the phase concept again and update:

```
megamemory:update_concept with:
- id: [phase-concept-id]
- changes: {
  summary: JSON with updated assumptions, scope, dependencies
}
```

Continue to offer_next.
</step>

<step name="offer_next">
Present next steps:

```
What's next?
1. Discuss context (/gsd-discuss-phase ${PHASE}) - Let me ask you questions to build comprehensive context
2. Plan this phase (/gsd-plan-phase ${PHASE}) - Create detailed execution plans
3. Re-examine assumptions - I'll analyze again with your corrections
4. Done for now
```

Wait for user selection.

If "Discuss context": Note that CONTEXT concept will incorporate any corrections discussed here
If "Plan this phase": Proceed knowing assumptions are understood
If "Re-examine": Return to analyze_phase with updated understanding
</step>

</process>

<success_criteria>
- Phase number validated via MM query
- Phase concept queried from MM
- Concept.summary parsed as JSON
- Assumptions surfaced across five areas: technical approach, implementation order, scope, risks, dependencies
- Confidence levels marked where appropriate
- "What do you think?" prompt presented
- User feedback acknowledged
- MM concept updated if user requests corrections
- Clear next steps offered
</success_criteria>
