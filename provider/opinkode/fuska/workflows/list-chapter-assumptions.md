<purpose>
Surface OpenCode's assumptions about a chapter before planning, enabling users to correct misconceptions early.

Key difference from /fuska-design: This is ANALYSIS of what OpenCode thinks, not INTAKE of what user knows. No file output - purely conversational to prompt discussion.
</purpose>

@../references/megamemory-integration.md

<process>

<step name="validate_chapter" priority="first">
Chapter number: `$ARGUMENTS` (required)

**If argument missing:**

```
Error: Chapter number required.

Usage: /fuska-list-chapter-assumptions [chapter-number]
Example: /fuska-list-chapter-assumptions 3
```

Exit workflow.

**If argument provided:**
Query MegaMemory for chapter context:

```
megamemory:understand with query: "Chapter ${CHAPTER} context goals scope"
```

**If no chapter concept found:**

```
Error: Chapter ${CHAPTER} not found in MegaMemory.

Available chapters:
[List chapter concepts from MegaMemory results]
```

Exit workflow.

**If chapter concept found:**
Parse concept.summary as JSON to extract:

- Chapter number
- Chapter name
- Chapter description/goal
- Scope details
- Requirements
- Decisions
- Dependencies

Continue to analyze_chapter.
</step>

<step name="analyze_chapter">
Based on MegaMemory chapter concept and project context, identify assumptions across five areas:

**1. Technical Approach:**
What libraries, frameworks, patterns, or tools would OpenCode use?
- Query MegaMemory for related feature/component concepts
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
- Parse from chapter concept.summary JSON:
  ```json
  "scope": {
    "included": ["A", "B", "C"],
    "excluded": ["D", "E", "F"],
    "ambiguous": ["G"]
  }
  ```
- "This chapter includes: A, B, C"
- "This chapter does NOT include: D, E, F"
- "Boundary ambiguities: G could go either way"

**4. Risk Areas:**
Where does OpenCode expect complexity or challenges?
- Query MegaMemory for related decision concepts
- "The tricky part is X because..."
- "Potential issues: Y, Z"
- "I'd watch out for..."

**5. Dependencies:**
What does OpenCode assume exists or needs to be in place?
- Parse from chapter concept.summary JSON:
  ```json
  "dependencies": ["dep1", "dep2", "dep3"]
  ```
- "This assumes X from previous chapters"
- "External dependencies: Y, Z"
- "This will be consumed by..."

Be honest about uncertainty. Mark assumptions with confidence levels:
- "Fairly confident: ..." (clear from MegaMemory)
- "Assuming: ..." (reasonable inference)
- "Unclear: ..." (could go multiple ways)
</step>

<step name="present_assumptions">
Present assumptions in a clear, scannable format:

```
## My Assumptions for Chapter ${CHAPTER}: ${CHAPTER_NAME}

### Technical Approach
[List assumptions about how to implement]

### Implementation Order
[List assumptions about sequencing]

### Scope Boundaries
**In scope:** [from MegaMemory concept.summary JSON]
**Out of scope:** [from MegaMemory concept.summary JSON]
**Ambiguous:** [from MegaMemory concept.summary JSON]

### Risk Areas
[List anticipated challenges]

### Dependencies
**From prior chapters:** [from MegaMemory concept.summary JSON]
**External:** [third-party needs]
**Feeds into:** [what future chapters need from this]

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

Would you like me to update the MegaMemory chapter concept with these corrections?
```

**If user confirms assumptions:**

```
Great, assumptions validated.
```

**If user wants corrections stored:**

Query the chapter concept again and update:

```
megamemory:update_concept with:
- id: [chapter-concept-id]
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
1. Discuss context (/fuska-design ${CHAPTER}) - Let me ask you questions to build comprehensive context
2. Plan this chapter (/fuska-plan ${CHAPTER}) - Create detailed execution plans
3. Re-examine assumptions - I'll analyze again with your corrections
4. Done for now
```

Wait for user selection.

If "Discuss context": Note that CONTEXT concept will incorporate any corrections discussed here
If "Plan this chapter": Proceed knowing assumptions are understood
If "Re-examine": Return to analyze_chapter with updated understanding
</step>

</process>

<success_criteria>
- Chapter number validated via MegaMemory query
- Chapter concept queried from MegaMemory
- Concept.summary parsed as JSON
- Assumptions surfaced across five areas: technical approach, implementation order, scope, risks, dependencies
- Confidence levels marked where appropriate
- "What do you think?" prompt presented
- User feedback acknowledged
- MegaMemory concept updated if user requests corrections
- Clear next steps offered
</success_criteria>
