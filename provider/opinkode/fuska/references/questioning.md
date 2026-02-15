# MegaMemory: Adaptive Questioning Patterns

Reference file for @questioning.md - Learn how to effectively question users during project initialization.

---

<megamemory_schema>

## Questioning Knowledge Graph Structure

### Concepts Related to Questioning

```
questioning-pattern (pattern)
├── questioning-phase (component)
│   ├── questioning-technique (pattern)
│   └── anti-pattern (pattern)
└── context-checklist-item (component)
```

### Concept Kinds

- `pattern`: Reusable questioning techniques or approaches
- `component`: Specific elements within the questioning framework
- `decision`: Decision points in the questioning flow

### Relationships

- `depends_on`: One technique requires understanding of another
- `configured_by`: A phase uses specific techniques
- `calls`: One pattern invokes another

</megamemory_schema>

---

<megamemory_operations>

## Creating Questioning Concepts

```typescript
// Create a questioning technique
await megamemory.createConcept({
  name: "Open-Ended Start",
  kind: "pattern",
  summary: "Begin with open questions to let users dump their mental model without interruption",
  why: "Users need to express their full vision before structure can be applied",
  parent_id: "questioning-phase-initiation",
  file_refs: ["@questioning.md:31-33"],
  edges: [
    {
      to: "energy-following",
      relation: "calls",
      description: "After initial dump, follow user's energy"
    }
  ]
});

// Create context checklist item
await megamemory.createConcept({
  name: "What They're Building",
  kind: "component",
  summary: "Concrete enough to explain to a stranger",
  why: "Foundation requirement for PROJECT.md",
  parent_id: "context-checklist",
  file_refs: ["@questioning.md:103"]
});
```

## Querying Questioning Patterns

```typescript
// Find appropriate question types for current context
const relevant = await megamemory.understand({
  query: "questioning techniques for vague user answers about performance",
  top_k: 5
});

// Get anti-patterns to avoid
const antiPatterns = await megamemory.understand({
  query: "questioning anti-patterns to avoid during project initialization"
});
```

## Linking Techniques to Phases

```typescript
// Connect technique to workflow phase
await megamemory.link({
  from: "concreteness-making",
  to: "questioning-phase-clarification",
  relation: "configured_by",
  description: "Used during clarification to make abstract ideas concrete"
});
```

</megamemory_operations>

---

<megamemory_examples>

## Example: Storing Question Types

```typescript
// Store motivation questioning patterns
await megamemory.createConcept({
  name: "Motivation Questions",
  kind: "pattern",
  summary: "Questions that uncover why the project exists",
  why: "Essential for understanding user intent and problem space",
  file_refs: ["@questioning.md:49-52"],
  edges: [
    {
      to: "project-philosophy",
      relation: "configured_by",
      description: "Aligned with thinking partner philosophy"
    }
  ]
});

// Store success questioning patterns
await megamemory.createConcept({
  name: "Success Definition Questions",
  kind: "pattern",
  summary: "Questions that establish observable success criteria",
  why: "Critical for creating clear PROJECT.md downstream",
  file_refs: ["@questioning.md:63-65"],
  edges: [
    {
      to: "decision-gate-readiness",
      relation: "depends_on",
      description: "Must understand success before offering to proceed"
    }
  ]
});
```

## Example: Storing Anti-Patterns

```typescript
// Store interrogation anti-pattern
await megamemory.createConcept({
  name: "Checklist Walking",
  kind: "pattern",
  summary: "Going through question domains regardless of what user said",
  why: "Anti-pattern — breaks conversational flow, feels scripted",
  file_refs: ["@questioning.md:130"]
});

// Store shallow acceptance anti-pattern
await megamemory.createConcept({
  name: "Shallow Acceptance",
  kind: "pattern",
  summary: "Taking vague answers without probing deeper",
  why: "Anti-pattern — results in unclear PROJECT.md, costs compound downstream",
  file_refs: ["@questioning.md:135"]
});
```

## Example: Decision Gate Flow

```typescript
// Store decision gate concept
await megamemory.createConcept({
  name: "Decision Gate: Ready for PROJECT.md",
  kind: "decision",
  summary: "Offer to create PROJECT.md when sufficient clarity exists: what, why, who, done",
  why: "Prevents premature planning and ensures downstream phases have clear direction",
  file_refs: ["@questioning.md:114-124"],
  edges: [
    {
      to: "context-checklist",
      relation: "depends_on",
      description: "Checklist items must be satisfied"
    },
    {
      to: "questioning-phase-completion",
      relation: "calls",
      description: "If 'Keep exploring', continue questioning"
    }
  ]
});
```

---

<questioning_guide>

Project initialization is dream extraction, not requirements gathering. You're helping the user discover and articulate what they want to build. This isn't a contract negotiation — it's collaborative thinking.

<philosophy>

**You are a thinking partner, not an interviewer.**

The user often has a fuzzy idea. Your job is to help them sharpen it. Ask questions that make them think "oh, I hadn't considered that" or "yes, that's exactly what I mean."

Don't interrogate. Collaborate. Don't follow a script. Follow the thread.

</philosophy>

<the_goal>

By the end of questioning, you need enough clarity to write a PROJECT.md that downstream phases can act on:

- **Research** needs: what domain to research, what the user already knows, what unknowns exist
- **Requirements** needs: clear enough vision to scope v1 features
- **Roadmap** needs: clear enough vision to decompose into phases, what "done" looks like
- **plan-phase** needs: specific requirements to break into tasks, context for implementation choices
- **execute-phase** needs: success criteria to verify against, the "why" behind requirements

A vague PROJECT.md forces every downstream phase to guess. The cost compounds.

</the_goal>

<how_to_question>

**Start open.** Let them dump their mental model. Don't interrupt with structure.

**Follow energy.** Whatever they emphasized, dig into that. What excited them? What problem sparked this?

**Challenge vagueness.** Never accept fuzzy answers. "Good" means what? "Users" means who? "Simple" means how?

**Make the abstract concrete.** "Walk me through using this." "What does that actually look like?"

**Clarify ambiguity.** "When you say Z, do you mean A or B?" "You mentioned X — tell me more."

**Know when to stop.** When you understand what they want, why they want it, who it's for, and what done looks like — offer to proceed.

</how_to_question>

<question_types>

Use these as inspiration, not a checklist. Pick what's relevant to the thread.

**Motivation — why this exists:**
- "What prompted this?"
- "What are you doing today that this replaces?"
- "What would you do if this existed?"

**Concreteness — what it actually is:**
- "Walk me through using this"
- "You said X — what does that actually look like?"
- "Give me an example"

**Clarification — what they mean:**
- "When you say Z, do you mean A or B?"
- "You mentioned X — tell me more about that"

**Success — how you'll know it's working:**
- "How will you know this is working?"
- "What does done look like?"

</question_types>

<using_askuserquestion>

Use question to help users think by presenting concrete options to react to.

**Good options:**
- Interpretations of what they might mean
- Specific examples to confirm or deny
- Concrete choices that reveal priorities

**Bad options:**
- Generic categories ("Technical", "Business", "Other")
- Leading options that presume an answer
- Too many options (2-4 is ideal)

**Example — vague answer:**
User says "it should be fast"

- header: "Fast"
- question: "Fast how?"
- options: ["Sub-second response", "Handles large datasets", "Quick to build", "Let me explain"]

**Example — following a thread:**
User mentions "frustrated with current tools"

- header: "Frustration"
- question: "What specifically frustrates you?"
- options: ["Too many clicks", "Missing features", "Unreliable", "Let me explain"]

</using_askuserquestion>

<context_checklist>

Use this as a **background checklist**, not a conversation structure. Check these mentally as you go. If gaps remain, weave questions naturally.

- [ ] What they're building (concrete enough to explain to a stranger)
- [ ] Why it needs to exist (the problem or desire driving it)
- [ ] Who it's for (even if just themselves)
- [ ] What "done" looks like (observable outcomes)

Four things. If they volunteer more, capture it.

</context_checklist>

<decision_gate>

When you could write a clear PROJECT.md, offer to proceed:

- header: "Ready?"
- question: "I think I understand what you're after. Ready to create PROJECT.md?"
- options:
  - "Create PROJECT.md" — Let's move forward
  - "Keep exploring" — I want to share more / ask me more

If "Keep exploring" — ask what they want to add or identify gaps and probe naturally.

Loop until "Create PROJECT.md" selected.

</decision_gate>

<anti_patterns>

- **Checklist walking** — Going through domains regardless of what they said
- **Canned questions** — "What's your core value?" "What's out of scope?" regardless of context
- **Corporate speak** — "What are your success criteria?" "Who are your stakeholders?"
- **Interrogation** — Firing questions without building on answers
- **Rushing** — Minimizing questions to get to "the work"
- **Shallow acceptance** — Taking vague answers without probing
- **Premature constraints** — Asking about tech stack before understanding the idea
- **User skills** — NEVER ask about user's technical experience. OpenCode builds.

</anti_patterns>

</questioning_guide>
