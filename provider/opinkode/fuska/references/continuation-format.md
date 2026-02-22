# MegaMemory: Continuation Format Patterns

Reference file for @continuation-format.md - Learn standard continuation prompt format with MegaMemory operations.

---

<megamemory_schema>

## Continuation Format Knowledge Graph Structure

### Format Pattern Hierarchy

```
continuation-format (pattern)
├── continuation-variant (pattern)
│   ├── execute-next-plan (pattern)
│   ├── final-plan-in-chapter (pattern)
│   ├── plan-a-chapter (pattern)
│   ├── chapter-complete (pattern)
│   ├── multiple-options (pattern)
│   └── milestone-complete (pattern)
├── format-rule (pattern)
└── format-anti-pattern (pattern)
```

### Concept Kinds

- `pattern`: Reusable continuation templates
- `config`: Fixed formatting conventions
- `decision`: When to use which variant

### Relationships

- `configured_by`: Variant uses format rules
- `calls`: Context extraction calls specific parsing logic
- `implements`: Variant implements core continuation structure

</megamemory_schema>

---

<megamemory_operations>

## Creating Continuation Format Concepts

```typescript
// Create core continuation format
await megamemory.createConcept({
  name: "Continuation Format Core",
  kind: "pattern",
  summary: "Standard next steps format: > Next Up header, identifier:name with description, inline command, /new explanation, Also available section with --- separators",
  why: "Consistent UX for guiding users through workflow transitions",
  file_refs: ["@continuation-format.md:8-25"],
  edges: [
    {
      to: "format-rules",
      relation: "configured_by",
      description: "Implements all core format rules"
    }
  ]
});

// Store format rules
await megamemory.createConcept({
  name: "Continuation Format Rules",
  kind: "config",
  summary: "1. Always show name+description 2. Pull context from source 3. Command in inline code 4. Include /new explanation 5. Use 'Also available' 6. Visual --- separators",
  why: "Ensures consistent, informative continuation prompts",
  file_refs: ["@continuation-format.md:28-34"]
});
```

## Storing Continuation Variants

```typescript
// Store execution variant
await megamemory.createConcept({
  name: "Execute Next Plan Variant",
  kind: "pattern",
  summary: "Standard plan execution with chapter/plan ID, description from PLAN.md, /fuska-build command",
  why: "Standard format for executing plans within a chapter",
  parent_id: "continuation-variant",
  file_refs: ["@continuation-format.md:38-58"]
});

// Store final plan variant
await megamemory.createConcept({
  name: "Final Plan in Chapter Variant",
  kind: "pattern",
  summary: "Same as Execute Next Plan but adds '*Final plan in Chapter N*' note and 'After this completes:' transition info",
  why: "Prepares user for chapter transition, reduces context shock",
  parent_id: "continuation-variant",
  file_refs: ["@continuation-format.md:60-83"]
});
```

## Querying Appropriate Variants

```typescript
// Find correct variant for current state
const variant = await megamemory.understand({
  query: "continuation format for chapter complete with 3/3 plans executed"
});

// Get format validation rules
const rules = await megamemory.understand({
  query: "continuation format rules to avoid anti-patterns"
});
```

---

<megamemory_examples>

## Example: Context Extraction Logic

```typescript
// Store context extraction patterns
await megamemory.createConcept({
  name: "Chapter Context Extraction",
  kind: "pattern",
  summary: "Extract from ROADMAP.md: '### Chapter N: {Name}' → '**Chapter N: {Name}** — {Goal}'",
  why: "Pulls accurate chapter name and goal for continuation prompts",
  file_refs: ["@continuation-format.md:182-188"],
  edges: [
    {
      to: "execute-next-plan-variant",
      relation: "calls",
      description: "Provides context for chapter-level continuations"
    }
  ]
});

// Store plan context extraction
await megamemory.createConcept({
  name: "Plan Context Extraction",
  kind: "pattern",
  summary: "Extract from ROADMAP.md or PLAN.md: ID + objective → '**ID: Name** — {Short description}'",
  why: "Pulls accurate plan identifier and purpose",
  file_refs: ["@continuation-format.md:190-207"]
});
```

## Example: Anti-Pattern Storage

```typescript
// Store command-only anti-pattern
await megamemory.createConcept({
  name: "Command-Only Anti-Pattern",
  kind: "pattern",
  summary: "Anti-pattern: Showing only command without identifier/name/description - user has no context what they're executing",
  why: "Poor UX - forces user to guess or navigate away to understand",
  parent_id: "continuation-format",
  file_refs: ["@continuation-format.md:211-220"]
});

// Store missing /new explanation anti-pattern
await megamemory.createConcept({
  name: "Missing /new Explanation Anti-Pattern",
  kind: "pattern",
  summary: "Anti-pattern: 'Run /new first' without explaining why - user may skip it and suffer context bloat",
  why: "Insufficient guidance leads to suboptimal behavior",
  parent_id: "continuation-format",
  file_refs: ["@continuation-format.md:222-230"]
});

// Store fenced code anti-pattern
await megamemory.createConcept({
  name: "Fenced Code for Commands Anti-Pattern",
  kind: "pattern",
  summary: "Anti-pattern: Using ``` fenced blocks for commands creates nesting ambiguity in templates",
  why: "Breaks template rendering, hard to copy-paste",
  parent_id: "continuation-format",
  file_refs: ["@continuation-format.md:241-249"]
});
```

## Example: Variant Selection Logic

```typescript
// Store decision tree for variant selection
await megamemory.createConcept({
  name: "Continuation Variant Selection",
  kind: "decision",
  summary: "Decision tree: Chapter complete? → Chapter complete variant. Final plan? → Final plan variant. Multiple equal options? → Multiple options variant. Else → Standard execute variant",
  why: "Ensures appropriate continuation format for workflow state",
  file_refs: ["@continuation-format.md:137-158"],
  edges: [
    {
      to: "chapter-complete-variant",
      relation: "calls",
      description: "When chapter marked complete"
    },
    {
      to: "final-plan-in-chapter-variant",
      relation: "calls",
      description: "When executing last plan in chapter"
    },
    {
      to: "multiple-options-variant",
      relation: "calls",
      description: "When no clear primary action"
    }
  ]
});
```

---

# Continuation Format

Standard format for presenting next steps after completing a command or workflow.

## Core Structure

```
---

## > Next Up

**{identifier}: {name}** — {one-line description}

`{command to copy-paste}`

*`/new` first → fresh context window*

---

**Also available:**
- `{alternative option 1}` — description
- `{alternative option 2}` — description

---
```

## Format Rules

1. **Always show what it is** — name + description, never just a command path
2. **Pull context from source** — ROADMAP.md for chapters, PLAN.md `<objective>` for plans
3. **Command in inline code** — backticks, easy to copy-paste, renders as clickable link
4. **`/new` explanation** — always include, keeps it concise but explains why
5. **"Also available" not "Other options"** — sounds more app-like
6. **Visual separators** — `---` above and below to make it stand out

## Variants

### Execute Next Plan

```
---

## > Next Up

**02-03: Refresh Token Rotation** — Add /api/auth/refresh with sliding expiry

`/fuska-build 2`

*`/new` first → fresh context window*

---

**Also available:**
- Review plan before executing
- Check roadmap for dependencies

---
```

### Execute Final Plan in Chapter

Add note that this is the last plan and what comes after:

```
---

## > Next Up

**02-03: Refresh Token Rotation** — Add /api/auth/refresh with sliding expiry
*Final plan in Chapter 2*

`/fuska-build 2`

*`/new` first → fresh context window*

---

**After this completes:**
- Chapter 2 → Chapter 3 transition
- Next: **Chapter 3: Core Features** — User dashboard and settings

---
```

### Plan a Chapter

```
---

## > Next Up

**Chapter 2: Authentication** — JWT login flow with refresh tokens

`/fuska-plan 2`

*`/new` first → fresh context window*

---

**Also available:**
- `/fuska-design 2` — gather context first
- `/fuska-research-chapter 2` — investigate unknowns
- Review roadmap

---
```

### Chapter Complete, Ready for Next

Show completion status before next action:

```
---

## [OK] Chapter 2 Complete

3/3 plans executed

## > Next Up

**Chapter 3: Core Features** — User dashboard, settings, and data export

`/fuska-plan 3`

*`/new` first → fresh context window*

---

**Also available:**
- `/fuska-design 3` — gather context first
- `/fuska-research-chapter 3` — investigate unknowns
- Review what Chapter 2 built

---
```

### Multiple Equal Options

When there's no clear primary action:

```
---

## > Next Up

**Chapter 3: Core Features** — User dashboard, settings, and data export

**To plan directly:** `/fuska-plan 3`

**To discuss context first:** `/fuska-design 3`

**To research unknowns:** `/fuska-research-chapter 3`

*`/new` first → fresh context window*

---
```

### Milestone Complete

```
---

## [DONE] Milestone v1.0 Complete

All 4 chapters shipped

## > Next Up

**Start v1.1** — questioning → research → requirements → roadmap

`/fuska-new-milestone`

*`/new` first → fresh context window*

---
```

## Pulling Context

### For chapters (from ROADMAP.md):

```markdown
### Chapter 2: Authentication
**Goal**: JWT login flow with refresh tokens
```

Extract: `**Chapter 2: Authentication** — JWT login flow with refresh tokens`

### For plans (from ROADMAP.md):

```markdown
Plans:
- [ ] 02-03: Add refresh token rotation
```

Or from PLAN.md `<objective>`:

```xml
<objective>
Add refresh token rotation with sliding expiry window.

Purpose: Extend session lifetime without compromising security.
</objective>
```

Extract: `**02-03: Refresh Token Rotation** — Add /api/auth/refresh with sliding expiry`

## Anti-Patterns

### Don't: Command-only (no context)

```
## To Continue

Run `/new`, then paste:
/fuska-build 2
```

User has no idea what 02-03 is about.

### Don't: Missing /new explanation

```
`/fuska-plan 3`

Run /new first.
```

Doesn't explain why. User might skip it.

### Don't: "Other options" language

```
Other options:
- Review roadmap
```

Sounds like an afterthought. Use "Also available:" instead.

### Don't: Fenced code blocks for commands

```
```
/fuska-plan 3
```
```

Fenced blocks inside templates create nesting ambiguity. Use inline backticks instead.
