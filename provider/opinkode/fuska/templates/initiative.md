# INITIATIVE.md Template (MegaMemory-Backed)

Template for MegaMemory-based initiative context. **For @-reference only by agents — data stored in MegaMemory, never on disk.**

---

<megamemory_schema>

## Concept Structure

```typescript
interface InitiativeConcept {
  name: string;
  kind: "feature" | "module" | "decision" | "config";
  summary: string;
  why?: string;
  parent_id?: string;
  file_refs?: string[];
  edges?: ConceptEdge[];
}

interface ConceptEdge {
  to: string;
  relation: "connects_to" | "depends_on" | "implements" | "calls" | "configured_by";
  description: string;
}
```

## Root Concept

```
name: "[Initiative Name]"
kind: "feature"
summary: "Current accurate description — 2-3 sentences. What does this product do and who it's for? Use the user's language and framing. Update whenever reality drifts from this description."
why: "Core value statement — the ONE thing that matters most. If everything else fails, this must work. One sentence that drives prioritization when tradeoffs arise."
```

## Child Concepts

### Requirements Concepts
```
name: "Validated Requirements"
kind: "config"
summary: "Requirements that shipped and proved valuable. Format: '- [OK] [Requirement] — [version/phase]'. These are locked — changing them requires explicit discussion."
parent_id: "[Initiative Name]"

name: "Active Requirements"
kind: "config"
summary: "Current scope being built toward. These are hypotheses until shipped and validated. Move to Validated when shipped, Out of Scope if invalidated."
parent_id: "[Initiative Name]"

name: "Out of Scope"
kind: "config"
summary: "Explicit boundaries on what we're not building. Always include reasoning (prevents re-adding later). Includes: considered and rejected, deferred to future, explicitly excluded."
parent_id: "[Initiative Name]"
```

### Context Concept
```
name: "Context"
kind: "config"
summary: "Background information that informs implementation: Technical environment or ecosystem, Relevant prior work or experience, User research or feedback themes, Known issues to address."
parent_id: "[Initiative Name]"
```

### Constraint Concepts
```
name: "Constraints"
kind: "config"
summary: "Hard limits on implementation choices. Tech stack, timeline, budget, compatibility, dependencies. Include the 'why' — constraints without rationale get questioned."
parent_id: "[Initiative Name]"
```

### Decision Concepts
```
name: "Key Decision: [Decision Name]"
kind: "decision"
summary: "[Choice made] — [Why it was made]"
why: "Significant choice that affects future work. Track outcome when known: [OK] Good (proved correct), [WARN] Revisit (may need reconsideration), — Pending (too early to evaluate)"
parent_id: "[Initiative Name]"
edges: [{to: "[affected requirement or module]", relation: "configured_by", description: "This decision affects [X]"}]
```

### Refresh Config (in config concept)

The `config` concept includes a `refresh` object for import graph settings:

```json
{
  "refresh": {
    "mode": "hybrid",
    "age_hours": 24,
    "auto_before": ["plan-phase", "execute-phase", "debug"],
    "last_sha": null,
    "last_refresh": null,
    "files_scanned": 0,
    "symbols_indexed": 0,
    "dead_code_count": 0
  }
}
```

**Mode values:**
- `hybrid` -- Auto-refresh if stale (>age_hours old) OR git SHA changed (default)
- `manual` -- Only refresh when user runs `/fuska-refresh`
- `disabled` -- Never auto-refresh

**auto_before:** Commands that trigger auto-refresh when import graph is stale.

**Update via config wizard:** Run `fuska config` and select "Import graph settings" to modify.

</megamemory_schema>

---

<megamemory_operations>

## Create Initiative

```typescript
await megamemory.create_concept({
  name: "CommunityApp",
  kind: "feature",
  summary: "Users can share and discuss content with people who share their interests. Web-based social platform with profiles, posts, follows, and activity feeds.",
  why: "The community value prop — users connect through shared interests. If posts don't reach the right people, nothing else matters."
});
```

## Create Requirements Category

```typescript
await megamemory.create_concept({
  name: "Active Requirements",
  kind: "config",
  summary: "- [ ] User can sign up with email and password\n- [ ] User receives email verification after signup\n- [ ] User can reset password via email link",
  parent_id: "CommunityApp"
});
```

## Create Constraint

```typescript
await megamemory.create_concept({
  name: "Tech Stack Constraint",
  kind: "config",
  summary: "React + TypeScript + TailwindCSS — Team has existing expertise, enables rapid prototyping",
  why: "Hard limit — changing mid-project would require significant retraining",
  parent_id: "CommunityApp"
});
```

## Create Decision

```typescript
await megamemory.create_concept({
  name: "Key Decision: Authentication Provider",
  kind: "decision",
  summary: "Use Auth0 for authentication — Handles password security, social logins, and session management",
  why: "Avoid building security-critical code in-house. Proven reliability, good documentation.",
  parent_id: "CommunityApp",
  edges: [{
    to: "Active Requirements",
    relation: "configured_by",
    description: "This decision enables AUTH-01 through AUTH-04"
  }]
});
```

## Query Initiative Context

```typescript
// Get full initiative context
const initiative = await megamemory.understand({
  query: "CommunityApp initiative context requirements constraints"
});

// Get only active requirements
const requirements = await megamemory.understand({
  query: "Active requirements"
});

// Get decisions affecting a feature
const decisions = await megamemory.understand({
  query: "Key decisions for authentication"
});
```

## Update Initiative

```typescript
await megamemory.update_concept({
  id: "CommunityApp",
  changes: {
    summary: "Updated description reflecting current state"
  }
});
```

## Update Requirements Status

```typescript
// Move from Active to Validated
await megamemory.update_concept({
  id: "Active Requirements",
  changes: {
    summary: "- [OK] User can sign up with email and password — Phase 1\n- [OK] User receives email verification after signup — Phase 1"
  }
});

// Add to Out of Scope
await megamemory.update_concept({
  id: "Out of Scope",
  changes: {
    summary: "OAuth login — Email/password sufficient for v1\nMobile app — Web-first, mobile later"
  }
});
```

## Link Concepts

```typescript
await megamemory.link({
  from: "Key Decision: Authentication Provider",
  to: "Auth Module",
  relation: "configured_by",
  description: "Auth0 configuration affects AuthModule implementation"
});
```

</megamemory_operations>

---

<megamemory_examples>

## Full Initiative Initialization Example

```typescript
// 1. Create root initiative concept
const initiative = await megamemory.create_concept({
  name: "CommunityApp",
  kind: "feature",
  summary: "Users can share and discuss content with people who share their interests. Web-based social platform with profiles, posts, follows, and activity feeds.",
  why: "The community value prop — users connect through shared interests. If posts don't reach the right people, nothing else matters."
});

// 2. Create requirements buckets
await megamemory.create_concept({
  name: "Validated Requirements",
  kind: "config",
  summary: "None yet — ship to validate",
  parent_id: initiative.id
});

await megamemory.create_concept({
  name: "Active Requirements",
  kind: "config",
  summary: "- [ ] User can sign up with email and password\n- [ ] User receives email verification after signup\n- [ ] User can reset password via email link",
  parent_id: initiative.id
});

await megamemory.create_concept({
  name: "Out of Scope",
  kind: "config",
  summary: "Real-time chat — High complexity, not core to community value\nVideo posts — Storage/bandwidth costs, defer to v2+",
  parent_id: initiative.id
});

// 3. Add context
await megamemory.create_concept({
  name: "Context",
  kind: "config",
  summary: "Technical environment: Node.js + PostgreSQL on AWS. Prior work: Prototype shows basic CRUD patterns work. User feedback: Users want simple onboarding, not complex permissions.",
  parent_id: initiative.id
});

// 4. Add constraints
await megamemory.create_concept({
  name: "Tech Stack Constraint",
  kind: "config",
  summary: "React + TypeScript + TailwindCSS — Team has existing expertise",
  why: "Hard limit — changing mid-initiative would require significant retraining",
  parent_id: initiative.id
});

await megamemory.create_concept({
  name: "Timeline Constraint",
  kind: "config",
  summary: "MVP launch in 3 months — Drives scope decisions",
  why: "Funding milestone requires demo by Q2",
  parent_id: initiative.id
});

// 5. Log first key decision
const authDecision = await megamemory.create_concept({
  name: "Key Decision: Authentication Provider",
  kind: "decision",
  summary: "Use Auth0 for authentication — Handles password security, social logins, and session management",
  why: "Avoid building security-critical code in-house. Proven reliability, good documentation.",
  parent_id: initiative.id
});

// 6. Link decision to requirements
await megamemory.link({
  from: authDecision.id,
  to: "Active Requirements",
  relation: "configured_by",
  description: "This decision enables AUTH-01 through AUTH-04"
});
```

## Query and Update Example

```typescript
// Agent starting work: Query current state
const context = await megamemory.understand({
  query: "CommunityApp active requirements constraints decisions"
});

// Returns: project summary, core value, active requirements list, constraints, recent decisions

// After implementing a requirement: Update status
await megamemory.update_concept({
  id: "Active Requirements",
  changes: {
    summary: "- [OK] User can sign up with email and password — Phase 1\n- [ ] User receives email verification after signup\n- [ ] User can reset password via email link"
  }
});

// Add to validated
await megamemory.update_concept({
  id: "Validated Requirements",
  changes: {
    summary: "- [OK] User can sign up with email and password — Phase 1"
  }
});

// Log new decision
await megamemory.create_concept({
  name: "Key Decision: Session Storage",
  kind: "decision",
  summary: "Use localStorage for session persistence — Simple, no server-side state",
  why: "MVP doesn't need cross-device sync. Reduces complexity.",
  parent_id: "CommunityApp",
  edges: [{
    to: "Active Requirements",
    relation: "configured_by",
    description: "Enables AUTH-04: User session persists across browser refresh"
  }]
});
```

</megamemory_examples>

---

<template>

**Original guidance preserved for reference:**

```markdown
# [Initiative Name]

## What This Is

[Current accurate description — 2-3 sentences. What does this product do and who it's for?
Use the user's language and framing. Update whenever reality drifts from this description.]

## Core Value

[The ONE thing that matters most. If everything else fails, this must work.
One sentence that drives prioritization when tradeoffs arise.]

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

- [ ] [Requirement 1]
- [ ] [Requirement 2]
- [ ] [Requirement 3]

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- [Exclusion 1] — [why]
- [Exclusion 2] — [why]

## Context

[Background information that informs implementation:
- Technical environment or ecosystem
- Relevant prior work or experience
- User research or feedback themes
- Known issues to address]

## Constraints

- **[Type]**: [What] — [Why]
- **[Type]**: [What] — [Why]

Common types: Tech stack, Timeline, Budget, Dependencies, Compatibility, Performance, Security

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| [Choice] | [Why] | [[OK] Good / [WARN] Revisit / — Pending] |

---
*Last updated: [date] after [trigger]*
```

</template>

---

<Guidelines>

**What This Is:**
- Current accurate description of the product
- 2-3 sentences capturing what it does and who it's for
- Use the user's words and framing
- Update when the product evolves beyond this description

**Core Value:**
- The single most important thing
- Everything else can fail; this cannot
- Drives prioritization when tradeoffs arise
- Rarely changes; if it does, it's a significant pivot

**Requirements — Validated:**
- Requirements that shipped and proved valuable
- Format: `- [OK] [Requirement] — [version/phase]`
- These are locked — changing them requires explicit discussion

**Requirements — Active:**
- Current scope being built toward
- These are hypotheses until shipped and validated
- Move to Validated when shipped, Out of Scope if invalidated

**Requirements — Out of Scope:**
- Explicit boundaries on what we're not building
- Always include reasoning (prevents re-adding later)
- Includes: considered and rejected, deferred to future, explicitly excluded

**Context:**
- Background that informs implementation decisions
- Technical environment, prior work, user feedback
- Known issues or technical debt to address
- Update as new context emerges

**Constraints:**
- Hard limits on implementation choices
- Tech stack, timeline, budget, compatibility, dependencies
- Include the "why" — constraints without rationale get questioned

**Key Decisions:**
- Significant choices that affect future work
- Add decisions as they're made throughout the project
- Track outcome when known:
  - [OK] Good — decision proved correct
  - [WARN] Revisit — decision may need reconsideration
  - — Pending — too early to evaluate

**Last Updated:**
- Always note when and why the document was updated
- Format: `after Phase 2` or `after v1.0 milestone`
- Triggers review of whether content is still accurate

</Guidelines>

<evolution>

INITIATIVE.md evolves throughout the initiative lifecycle.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone:**
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state (users, feedback, metrics)

</evolution>

<brownfield>

For existing codebases:

1. **Map codebase first** via `/fuska-map-codebase`

2. **Infer Validated requirements** from existing code:
   - What does the codebase actually do?
   - What patterns are established?
   - What's clearly working and relied upon?

3. **Gather Active requirements** from user:
   - Present inferred current state
   - Ask what they want to build next

4. **Initialize:**
   - Validated = inferred from existing code
   - Active = user's goals for this work
   - Out of Scope = boundaries user specifies
   - Context = includes current codebase state

</brownfield>

<state_reference>

 STATE.md references INITIATIVE.md:

```markdown
## Initiative Reference

See: MegaMemory concept "Initiative Name" (updated [date])

Query via:
```typescript
const initiative = await megamemory.understand({ query: "Initiative Name" });
const context = JSON.parse(initiative.concepts[0].summary);
```

**Core value:** [One-liner from Core Value section]
**Current focus:** [Current phase name]
```

This ensures OpenCode reads current INITIATIVE.md context from MegaMemory.

</state_reference>
