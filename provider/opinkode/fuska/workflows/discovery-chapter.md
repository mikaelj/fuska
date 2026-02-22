<purpose>
Execute discovery at the appropriate depth level.
Produces MegaMemory concept that informs PLAN.md creation.

Called from plan-chapter.md's mandatory_discovery step with a depth parameter.

NOTE: For comprehensive ecosystem research ("how do experts build this"), use /fuska-research-chapter instead, which creates a RESEARCH concept.
</purpose>

<depth_levels>
**This workflow supports three depth levels:**

| Level | Name         | Time      | Output                                       | When                                      |
| ----- | ------------ | --------- | -------------------------------------------- | ----------------------------------------- |
| 1     | Quick Verify | 2-5 min   | MegaMemory concept with verified knowledge           | Single library, confirming current syntax |
| 2     | Standard     | 15-30 min | MegaMemory concept with comprehensive findings      | Choosing between options, new integration |
| 3     | Deep Dive    | 1+ hour   | MegaMemory concept with validation gates and full context | Architectural decisions, novel problems   |

**Depth is determined by plan-chapter.md before routing here.**
</depth_levels>

<source_hierarchy>
**MANDATORY: Context7 BEFORE webfetch**

OpenCode's training data is 6-18 months stale. Always verify.

1. **Context7 MCP FIRST** - Current docs, no hallucination
2. **Official docs** - When Context7 lacks coverage
3. **webfetch LAST** - For comparisons and trends only

See ~/.config/opencode/fuska/templates/discovery.md `<discovery_protocol>` for full protocol.
</source_hierarchy>

@../references/megamemory-integration.md

<process>

<step name="determine_depth">
Check the depth parameter passed from plan-chapter.md:
- `depth=verify` → Level 1 (Quick Verification)
- `depth=standard` → Level 2 (Standard Discovery)
- `depth=deep` → Level 3 (Deep Dive)

Route to appropriate level workflow below.
</step>

<step name="query_existing_discovery">
**Before starting discovery, query MegaMemory:**

```
megamemory:understand with query: "discovery [chapter] [topic] findings research"
```

If relevant concept exists:
- Review existing findings
- Check if findings are still current
- If valid and sufficient, skip new discovery
- If outdated or insufficient, note what to update
</step>

<step name="level_1_quick_verify">
**Level 1: Quick Verification (2-5 minutes)**

For: Single known library, confirming syntax/version still correct.

**Process:**

1. Resolve library in Context7:

   ```
   mcp__context7__resolve-library-id with libraryName: "[library]"
   ```

2. Fetch relevant docs:

   ```
   mcp__context7__get-library-docs with:
   - context7CompatibleLibraryID: [from step 1]
   - topic: [specific concern]
   ```

3. Verify:

   - Current version matches expectations
   - API syntax unchanged
   - No breaking changes in recent versions

4. **If verified:** Create/update MegaMemory concept with verification result:

   ```
   megamemory:create_concept or megamemory:update_concept with:
   - name: "[Chapter] [library] verified"
   - kind: "feature"
   - summary: JSON with verification result
   - why: "Quick verification completed - no issues found"
   ```

5. **If concerns found:** Escalate to Level 2.

**Output:** MegaMemory concept with verification status
</step>

<step name="level_2_standard">
**Level 2: Standard Discovery (15-30 minutes)**

For: Choosing between options, new external integration.

**Process:**

1. **Identify what to discover:**

   - What options exist?
   - What are the key comparison criteria?
   - What's our specific use case?

2. **Context7 for each option:**

   ```
   For each library/framework:
   - mcp__context7__resolve-library-id
   - mcp__context7__get-library-docs (mode: "code" for API, "info" for concepts)
   ```

3. **Official docs** for anything Context7 lacks.

4. **webfetch** for comparisons:

   - "[option A] vs [option B] {current_year}"
   - "[option] known issues"
   - "[option] with [our stack]"

5. **Cross-verify:** Any webfetch finding → confirm with Context7/official docs.

6. **Create MegaMemory concept** with JSON-structured findings:

   ```
   megamemory:create_concept with:
   - name: "[Chapter] [topic] discovery"
   - kind: "feature"
   - summary: JSON with findings (see megamemory_guide structure)
   - why: "Standard discovery completed - [topic] researched"
   - edges: [{relation: "depends_on", to: "[parent-chapter-id]"}]
   - file_refs: ["src/files/mentioned"]
   ```

   Include in JSON summary:
   - Summary with recommendation
   - Key findings per option
   - Code examples from Context7
   - Confidence level (should be MEDIUM-HIGH for Level 2)

7. Return to plan-chapter.md.

**Output:** MegaMemory concept with discovery findings
</step>

<step name="level_3_deep_dive">
**Level 3: Deep Dive (1+ hour)**

For: Architectural decisions, novel problems, high-risk choices.

**Process:**

1. **Scope the discovery** using ~/.config/opencode/fuska/templates/discovery.md:

   - Define clear scope
   - Define include/exclude boundaries
   - List specific questions to answer

2. **Exhaustive Context7 research:**

   - All relevant libraries
   - Related patterns and concepts
   - Multiple topics per library if needed

3. **Official documentation deep read:**

   - Architecture guides
   - Best practices sections
   - Migration/upgrade guides
   - Known limitations

4. **webfetch for ecosystem context:**

   - How others solved similar problems
   - Production experiences
   - Gotchas and anti-patterns
   - Recent changes/announcements

5. **Cross-verify ALL findings:**

   - Every webfetch claim → verify with authoritative source
   - Mark what's verified vs assumed
   - Flag contradictions

6. **Create comprehensive MegaMemory concept:**

   ```
   megamemory:create_concept with:
   - name: "[Chapter] [topic] deep dive"
   - kind: "feature"
   - summary: JSON with full structure (see megamemory_guide)
   - why: "Deep dive completed - [topic] thoroughly researched"
   - edges: [{relation: "depends_on", to: "[parent-chapter-id]"}]
   - file_refs: ["src/files/mentioned"]
   ```

   Include in JSON summary:
   - Full structure from ~/.config/opencode/fuska/templates/discovery.md
   - Quality report with source attribution
   - Confidence by finding
   - Validation checkpoints if LOW confidence on critical findings

7. **Confidence gate:** If overall confidence is LOW, present options before proceeding.

8. Return to plan-chapter.md.

**Output:** MegaMemory concept with comprehensive discovery findings
</step>

<step name="identify_unknowns">
**For Level 2-3:** Define what we need to learn.

Ask: What do we need to learn before we can plan this chapter?

- Technology choices?
- Best practices?
- API patterns?
- Architecture approach?
  </step>

<step name="create_discovery_scope">
Use ~/.config/opencode/fuska/templates/discovery.md.

Include:

- Clear discovery objective
- Scoped include/exclude lists
- Source preferences (official docs, Context7, current year)
- Output structure for MegaMemory concept summary
  </step>

<step name="execute_discovery">
Run the discovery:
- Use web search for current info
- Use Context7 MCP for library docs
- Prefer current year sources
- Structure findings per template
</step>

<step name="create_discovery_output">
Create MegaMemory concept:

```
megamemory:create_concept or megamemory:update_concept with:
- name: "[Chapter] [topic] discovery"
- kind: "feature"
- summary: JSON with:
  - summary_with_recommendation: string
  - key_findings: [{source, finding, verified}]
  - code_examples: [{file, code}]
  - metadata: {confidence, dependencies, open_questions, assumptions}
- why: "Discovery completed for [topic]"
- edges: [relationships to other concepts]
- file_refs: ["relevant/file/paths"]
```

All discovery state must be stored in MegaMemory concepts.
</step>

<step name="confidence_gate">
After creating MegaMemory concept, check confidence level.

If confidence is LOW:
Use question:

- header: "Low Confidence"
- question: "Discovery confidence is LOW: [reason]. How would you like to proceed?"
- options:
  - "Dig deeper" - Do more research before planning
  - "Proceed anyway" - Accept uncertainty, plan with caveats
  - "Pause" - I need to think about this

If confidence is MEDIUM:
Inline: "Discovery complete (medium confidence). [brief reason]. Proceed to planning?"

If confidence is HIGH:
Proceed directly, just note: "Discovery complete (high confidence)."
</step>

<step name="open_questions_gate">
Parse `concept.summary` as JSON to get open_questions field.

If open_questions exist:

Present them inline:
"Open questions from discovery:

- [Question 1]
- [Question 2]

These may affect implementation. Acknowledge and proceed? (yes / address first)"

If "address first": Gather user input on questions, update MegaMemory concept via `megamemory:update_concept`.
</step>

<step name="offer_next">
```
Discovery complete: MegaMemory concept "[Chapter] [topic] discovery"
Recommendation: [one-liner]
Confidence: [level]

What's next?

1. Discuss chapter context (/fuska-design [current-chapter])
2. Create chapter plan (/fuska-plan [current-chapter])
3. Refine discovery (dig deeper)
4. Review discovery (query MegaMemory concept)

```
</step>

</process>

<success_criteria>
**Level 1 (Quick Verify):**
- Context7 consulted for library/topic
- Current state verified or concerns escalated
- MegaMemory concept created/updated with verification result

**Level 2 (Standard):**
- Context7 consulted for all options
- webfetch findings cross-verified
- MegaMemory concept created with JSON-structured findings
- Confidence level MEDIUM or higher
- Ready to inform PLAN.md creation

**Level 3 (Deep Dive):**
- Discovery scope defined
- Context7 exhaustively consulted
- All webfetch findings verified against authoritative sources
- MegaMemory concept created with comprehensive analysis in JSON summary
- Quality report with source attribution
- If LOW confidence findings → validation checkpoints defined
- Confidence gate passed
- Ready to inform PLAN.md creation
</success_criteria>
