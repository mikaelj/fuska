## Plan Agent Prompt Templates

Reusable templates for spawning planner and checker agents.

---

### Planner Prompt Template

Replace `{placeholders}` with actual values.

```markdown
<critical_constraints>
Return: ## PLANNING COMPLETE or ## CHECKPOINT REACHED or ## PLANNING INCONCLUSIVE
Create plan concepts in MegaMemory using ChapterConceptTemplates.createPlan()
Plans MUST complete within 50% context usage
Each plan: 2-3 tasks maximum
</critical_constraints>

<planning_context>

**Chapter:** {chapter_number}
**Mode:** {standard | fix_planning}

**Project State:**
{stateData JSON}

**Roadmap:**
{roadmapData JSON}

**Requirements (if exists):**
{requirements array}

**Chapter Context (if exists):**
{contextData JSON}

**Research (if exists):**
{researchData JSON}

**Fix Planning (if --fixes mode):**
{verificationData JSON}

</planning_context>

{if importGraphAvailable}
<import_graph_context>

**Related files ({importGraphFiles.length}):**
{importGraphFiles formatted list}

**Related symbols ({importGraphSymbols.length}):**
{importGraphSymbols formatted list}

**Usage:**
- Check `fileByPath.get('path')` before creating files
- Use `symbolByName.get('Name')` for existing symbols
- If file exists: action = "extend"
- If file missing: action = "create"

</import_graph_context>
{endif}

<downstream_consumer>
Output consumed by /fuska-build

Plans must be executable prompts with:
- Frontmatter (batch, depends_on, files_modified, autonomous)
- Tasks in XML format
- Verification criteria
- requirements for goal-backward verification

Use MegaMemory:
- Create plan concepts: ChapterConceptTemplates.createPlan()
- Reference patterns: megamemory:understand()
</downstream_consumer>

<quality_gate>
Before returning PLANNING COMPLETE:

- [ ] Plan concepts created in MegaMemory
- [ ] Each plan has valid frontmatter
- [ ] Tasks are specific and actionable
- [ ] Dependencies correctly identified
- [ ] Batches assigned for parallel execution
- [ ] requirements derived from chapter goal
</quality_gate>
```

---

### Revision Prompt Template

```markdown
<critical_constraints>
Return what changed
Do NOT replan from scratch unless issues are fundamental
Update plan concepts in MegaMemory
</critical_constraints>

<revision_context>

**Chapter:** {chapter_number}
**Mode:** revision

**Existing plans:**
{current plan summaries}

**Checker issues:**
{structured issues from checker}

</revision_context>

<instructions>
Make targeted updates to address checker issues.

Use MegaMemory:
- Update plan concepts: megamemory:update_concept()
- Reference patterns from MegaMemory for solutions
</instructions>
```

---

### Checker Panel Prompt Template

```markdown
<critical_constraints>
Return one of:
- ## VERIFICATION PASSED — all checks pass
- ## ISSUES FOUND — structured issue list with cross-validation badges
</critical_constraints>

<verification_context>

**Chapter:** {chapterNumber}
**Chapter Goal:** {chapterGoal}

**Plans to verify:**
{planConcepts formatted with batch, dependencies, tasks, mustHaves}

**Requirements (if any):**
{requirementConcepts list}

</verification_context>

<checker_panel>
Base: quality-advocate (always)
Contextual: {checkerPanel.contextual or 'none'}
Expert: dynamic (derived from plan content)

Project Classification:
- Type: {projectClassification.type}
- Confidence: {projectClassification.confidence}
- Signals: {projectClassification.signals}
</checker_panel>
```
