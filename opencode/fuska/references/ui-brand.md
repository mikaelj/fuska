# MegaMemory: UI Brand Patterns

Reference file for @ui-brand.md - Learn OpenCode visual patterns and personality guidelines.

---

<megamemory_schema>

## UI Patterns Knowledge Graph Structure

### Visual Pattern Hierarchy

```
ui-brand (component)
├── visual-element (pattern)
│   ├── stage-banner (pattern)
│   ├── checkpoint-box (pattern)
│   ├── status-symbol (pattern)
│   ├── progress-display (pattern)
│   ├── spawning-indicator (pattern)
│   ├── next-up-block (pattern)
│   └── error-box (pattern)
└── formatting-rule (pattern)
    ├── width-constraint (config)
    └── symbol-convention (config)
```

### Concept Kinds

- `pattern`: Reusable visual templates or formatting conventions
- `component`: Major UI categories
- `config`: Fixed values (widths, symbols, colors)

### Relationships

- `configured_by`: Pattern uses specific configuration values
- `depends_on`: Some patterns require others to be present
- `implements`: Visual pattern implements brand guidelines

</megamemory_schema>

---

<megamemory_operations>

## Creating Visual Pattern Concepts

```typescript
// Create stage banner pattern
await megamemory.createConcept({
  name: "Stage Banner",
  kind: "pattern",
  summary: "Major workflow transition display with Fuska: prefix, 62-char width",
  why: "Provides clear visual separation between workflow phases",
  parent_id: "ui-brand",
  file_refs: ["@ui-brand.md:10-13"],
  edges: [
    {
      to: "banner-width",
      relation: "configured_by",
      description: "Fixed 62-character width"
    },
    {
      to: "fuska-prefix",
      relation: "configured_by",
      description: "Always uses Fuska: prefix"
    }
  ]
});

// Create status symbol set
await megamemory.createConcept({
  name: "Status Symbols",
  kind: "config",
  summary: "Standard symbol mapping: [OK] Complete, [FAIL] Failed, [IN_PROGRESS] In Progress, [PENDING] Pending, [AUTO] Auto-approved, [WARN] Warning",
  why: "Consistent visual language across all Fuska output",
  parent_id: "ui-brand",
  file_refs: ["@ui-brand.md:53-61"]
});
```

## Querying Visual Templates

```typescript
// Find appropriate pattern for checkpoint
const checkpointPattern = await megamemory.understand({
  query: "checkpoint box visual pattern with user action required"
});

// Get all status symbols
const symbols = await megamemory.understand({
  query: "status symbols for progress display"
});
```

## Validating Output

```typescript
// Validate anti-patterns before rendering
const antiPatterns = await megamemory.understand({
  query: "ui anti-patterns to avoid in Fuska output"
});
```

</megamemory_operations>

---

<megamemory_examples>

## Example: Stage Banner Storage

```typescript
// Store banner template with variants
await megamemory.createConcept({
  name: "QUESTIONING Banner",
  kind: "pattern",
  summary: "Stage banner for questioning phase: 'Fuska: QUESTIONING'",
  why: "Indicates active workflow stage",
  parent_id: "stage-banner",
  file_refs: ["@ui-brand.md:10-13", "@ui-brand.md:16"],
  edges: [
    {
      to: "stage-name-list",
      relation: "configured_by",
      description: "Uses standard stage name format"
    }
  ]
});

// Store all stage names as config
await megamemory.createConcept({
  name: "Stage Names",
  kind: "config",
  summary: "Standard stage names: QUESTIONING, RESEARCHING, DEFINING REQUIREMENTS, CREATING ROADMAP, PLANNING PHASE {N}, EXECUTING WAVE {N}, VERIFYING, PHASE {N} COMPLETE [OK], MILESTONE COMPLETE [DONE]",
  why: "Ensures consistent stage naming across workflow",
  file_refs: ["@ui-brand.md:16-24"]
});
```

## Example: Checkpoint Box Pattern

```typescript
// Store checkpoint pattern
await megamemory.createConcept({
  name: "Checkpoint Box Template",
  kind: "pattern",
  summary: "62-char width box with CHECKPOINT: {Type} header, content area, and → action prompt",
  why: "Clear visual indication of required user action",
  file_refs: ["@ui-brand.md:33-42"],
  edges: [
    {
      to: "checkpoint-width",
      relation: "configured_by",
      description: "Fixed 62-character width"
    }
  ]
});

// Store checkpoint types
await megamemory.createConcept({
  name: "Checkpoint Types",
  kind: "config",
  summary: "Verification Required → 'approved', Decision Required → option selection, Action Required → 'done'",
  why: "Standardized checkpoint flow across workflow",
  file_refs: ["@ui-brand.md:45-47"]
});
```

## Example: Anti-Pattern Storage

```typescript
// Store anti-pattern as warning
await megamemory.createConcept({
  name: "Variable Banner Widths Anti-Pattern",
  kind: "pattern",
  summary: "Anti-pattern: Varying box/banner widths breaks visual consistency",
  why: "Inconsistent widths create cluttered, unprofessional appearance",
  parent_id: "ui-brand",
  file_refs: ["@ui-brand.md:153"]
});

// Store emoji usage rules
await megamemory.createConcept({
  name: "Restricted Emoji Usage",
  kind: "config",
  summary: "Only use [DONE] in milestone banners, random emoji (🚀, ✨, 💫) are anti-patterns",
  why: "Maintains professional, focused visual language",
  file_refs: ["@ui-brand.md:57", "@ui-brand.md:157"]
});
```

---

<ui_patterns>

Visual patterns for user-facing Fuska output. Orchestrators @-reference this file.

## Stage Banners

Use for major workflow transitions.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Fuska: {STAGE NAME}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Stage names (uppercase):**
- `QUESTIONING`
- `RESEARCHING`
- `DEFINING REQUIREMENTS`
- `CREATING ROADMAP`
- `PLANNING PHASE {N}`
- `EXECUTING WAVE {N}`
- `VERIFYING`
- `PHASE {N} COMPLETE [OK]`
- `MILESTONE COMPLETE [DONE]`

---

## Checkpoint Boxes

User action required. 62-character width.

```
═══════════════════════════════════════════════════════════════
 CHECKPOINT: {Type}                                          
═══════════════════════════════════════════════════════════════

{Content}

──────────────────────────────────────────────────────────────
→ {ACTION PROMPT}
──────────────────────────────────────────────────────────────
```

**Types:**
- `CHECKPOINT: Verification Required` → `→ Type "approved" or describe issues`
- `CHECKPOINT: Decision Required` → `→ Select: option-a / option-b`
- `CHECKPOINT: Action Required` → `→ Type "done" when complete`

---

## Status Symbols

```
[OK]          Complete / Passed / Verified
[FAIL]        Failed / Missing / Blocked
[IN_PROGRESS] In Progress
[PENDING]     Pending
[AUTO]        Auto-approved
[WARN]        Warning
[DONE]        Milestone complete (only in banner)
```

---

## Progress Display

**Phase/milestone level:**
```
Progress: ████████░░ 80%
```

**Task level:**
```
Tasks: 2/4 complete
```

**Plan level:**
```
Plans: 3/5 complete
```

---

## Spawning Indicators

```
[IN_PROGRESS] Spawning researcher...

[IN_PROGRESS] Spawning 4 researchers in parallel...
  → Stack research
  → Features research
  → Architecture research
  → Pitfalls research

[OK] Researcher complete: STACK.md written
```

---

## Next Up Block

Always at end of major completions.

```
───────────────────────────────────────────────────────────────

## > Next Up

**{Identifier}: {Name}** — {one-line description}

`{copy-paste command}`

*`/new` first → fresh context window*

───────────────────────────────────────────────────────────────

**Also available:**
- `/fuska-alternative-1` — description
- `/fuska-alternative-2` — description

───────────────────────────────────────────────────────────────
```

---

## Error Box

```
═══════════════════════════════════════════════════════════════
 ERROR                                                        
═══════════════════════════════════════════════════════════════

{Error description}

**To fix:** {Resolution steps}
```

---

## Tables

```
| Phase | Status      | Plans | Progress |
|-------|-------------|-------|----------|
| 1     | [OK]        | 3/3   | 100%     |
| 2     | [IN_PROGRESS] | 1/4   | 25%      |
| 3     | [PENDING]   | 0/2   | 0%       |
```

---

## Anti-Patterns

- Varying box/banner widths
- Mixing banner styles (`===`, `---`, `***`)
- Skipping `Fuska:` prefix in banners
- Random decorative text (`***`, `~~~`, `###` decorations outside standard patterns)
- Missing Next Up block after completions

</ui_patterns>
