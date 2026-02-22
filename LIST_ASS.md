# Plan: Merge `fuska-list-chapter-assumptions` into `fuska-design`

## Goal

Integrate the assumption-surfacing step into `/fuska-design` as Step 1.8 (always shown, no skip flag), then remove the standalone command. This creates a smoother flow where users see what the AI assumes before diving into design discussion.

---

## Current State

**Files to delete:**
- `provider/opinkode/command/fuska/fuska-list-chapter-assumptions.md` — exists ✅
- `provider/opinkode/fuska/workflows/list-chapter-assumptions.md` — exists ✅

**Files with references to remove:**
| File | Lines | Content |
|------|-------|---------|
| `provider/opinkode/command/fuska/fuska.md` | 309, 376 | dispatch row, verb in list |
| `provider/opinkode/command/fuska/fuska-help.md` | 51, 53, 229-236 | design description, command listing, help block |
| `provider/opinkode/fuska/references/continuation-format.md` | 264 | reference |
| `docs/commands.md` | 135 | table row |
| `src/commands/migrate-terminology.ts` | 25 | obsolete migration rule |

**File to modify:**
- `provider/opinkode/command/fuska/fuska-design.md` — add Step 1.8, update success_criteria

---

## Execution Steps

### 1. Modify `provider/opinkode/command/fuska/fuska-design.md`

#### 1a. No frontmatter changes needed

The existing tools are sufficient:
- `megamemory:understand` — used by Step 1.8.1
- `question` — used by Step 1.8.4
- `megamemory:list_roots` — provided via `@preflight-check-initiative-exists.md` reference

No need to add `grep` or `glob` — Step 1.8 queries MegaMemory, not the filesystem.

#### 1b. Insert Step 1.8 after line 183 (after `---`, before `## 2.`)

New section:

```markdown
---

## 1.8. Surface Assumptions

Before asking questions, show what you already assume about this chapter. This helps the user spot misconceptions early.

**Step 1.8.1: Query related concepts**

Gather context from MegaMemory to inform assumptions:

```
const chapterSlug = `chapter-${chapterNumber.toString().padStart(2, '0')}`
megamemory_understand(query="requirements", top_k=50)
megamemory_understand(query=`${chapterSlug}-research`, top_k=1)
megamemory_understand(query=`${chapterSlug}-context`, top_k=1)
megamemory_understand(query="state", top_k=5)
```

**Step 1.8.2: Analyze and surface assumptions**

Based on gathered data, surface assumptions across five areas:

**1. Technical Approach:**
What libraries, frameworks, patterns would be used?
- From research and prior decisions in MegaMemory
- "I'd use X library because..."

**2. Implementation Order:**
What would be built first, second, third?
- From chapter dependencies and roadmap sequence
- "I'd start with X because it's foundational"

**3. Scope Boundaries:**
What's included vs excluded?
- From chapter context and requirements
- "This chapter includes: A, B, C"

**4. Risk Areas:**
Where might complexity or challenges arise?
- From research pitfalls and prior summaries
- "The tricky part is X because..."

**5. Dependencies:**
What needs to be in place first?
- From prior chapters and external services
- "This assumes X from previous chapters"

**Step 1.8.3: Present assumptions**

Display in this format (output markdown directly):

```
────────────────────────────────────────────────────

## My Assumptions for Chapter {N}: {Name}

### Technical Approach
[List assumptions about implementation]

### Implementation Order
[List sequencing assumptions]

### Scope Boundaries
**In scope:** [...]
**Out of scope:** [...]

### Risk Areas
[List anticipated challenges]

### Dependencies
**From prior chapters:** [...]
**External:** [...]

---

**How do these look?**
```

**Step 1.8.4: Prompt for feedback**

Use question tool:

```
const assumptionResponse = question(questions=[{
  header: "Assumptions",
  question: "How do these assumptions look?",
  options: [
    {label: "Looks good", description: "Proceed to design discussion"},
    {label: "Correct assumptions", description: "Something is wrong, let me clarify"},
    {label: "Add detail", description: "Expand on a specific area first"}
  ]
}])
```

**Step 1.8.5: Handle response**

- **"Looks good"**: Continue to Step 2
- **"Correct assumptions"**: Discuss corrections, acknowledge them, incorporate into session context, then continue
- **"Add detail"**: Expand the requested area, then re-prompt

Corrections provided here inform the gray area analysis in Step 3.

---
```

#### 1c. Update success_criteria (lines 534-546)

Add two new items after "Chapter number validated":

```markdown
<success_criteria>

- [ ] Chapter number validated against roadmap
- [ ] Assumptions surfaced and presented for user feedback
- [ ] User feedback on assumptions acknowledged
- [ ] Existing chapter context checked (offered update/view/skip if found)
- [ ] Gray areas identified through intelligent analysis
- [ ] User chose which areas to discuss
- [ ] Each selected area explored until satisfied (4+ questions per area)
- [ ] Scope creep redirected to deferred ideas
- [ ] Chapter context concept created or updated
- [ ] Decisions are specific enough for downstream agents
- [ ] User knows next steps (research or planning)

</success_criteria>
```

---

### 2. Delete `provider/opinkode/command/fuska/fuska-list-chapter-assumptions.md`

Remove entire file.

---

### 3. Delete `provider/opinkode/fuska/workflows/list-chapter-assumptions.md`

Remove entire file.

---

### 4. Update `provider/opinkode/command/fuska/fuska.md`

| Line | Action |
|------|--------|
| 309 | Remove: `\| assumptions \| fuska-list-chapter-assumptions.md \| yes \|` |
| 376 | Remove `assumptions` from the Known verbs list |

---

### 5. Update `provider/opinkode/command/fuska/fuska-help.md`

| Line | Action |
|------|--------|
| 51 | Change: `Articulate your vision for a chapter before planning.` → `Review assumptions and articulate your vision for a chapter before planning.` |
| 53 | Remove: `\* /fuska-list-chapter-assumptions <number> — See what's planned before execution.` |
| 229-236 | Remove entire `/fuska-list-chapter-assumptions` help block |

---

### 6. Update `provider/opinkode/fuska/references/continuation-format.md`

| Line | Action |
|------|--------|
| 264 | Change `/fuska-list-chapter-assumptions 2` → `/fuska-design 2` |

---

### 7. Update `docs/commands.md`

| Line | Action |
|------|--------|
| 135 | Remove: `\| <nobr>/fuska-list-chapter-assumptions</nobr> \| List assumptions for a chapter \| <N> -- chapter number \|` |

---

### 8. Update `src/commands/migrate-terminology.ts`

| Line | Action |
|------|--------|
| 25 | Remove: `.replace(/fuska-list-phase-assumptions/g, 'fuska-list-chapter-assumptions')` |

---

### 9. Rebuild and Verify

```bash
npm run build:claude
npx tsc --noEmit
npm run validate:help

# Verify no references remain
grep -r "fuska-list-chapter-assumptions" provider/opinkode src docs --include="*.md" --include="*.ts"
grep -r "list-chapter-assumptions" provider/opinkode src docs --include="*.md" --include="*.ts"
```

---

## Files Changed Summary

| File | Action |
|------|--------|
| `provider/opinkode/command/fuska/fuska-design.md` | Edit: add Step 1.8, update success_criteria |
| `provider/opinkode/command/fuska/fuska-list-chapter-assumptions.md` | **Delete** |
| `provider/opinkode/fuska/workflows/list-chapter-assumptions.md` | **Delete** |
| `provider/opinkode/command/fuska/fuska.md` | Edit: remove dispatch row and verb |
| `provider/opinkode/command/fuska/fuska-help.md` | Edit: update design description, remove references |
| `provider/opinkode/fuska/references/continuation-format.md` | Edit: update reference |
| `docs/commands.md` | Edit: remove table row |
| `src/commands/migrate-terminology.ts` | Edit: remove obsolete rule |
