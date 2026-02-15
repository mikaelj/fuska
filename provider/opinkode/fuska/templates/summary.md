# Summary Template (MegaMemory-Backed)

Template for phase completion documentation stored as MegaMemory concept.

---

<megamemory_schema>

## Concept: `phase-summary`

**Kind:** `feature`

**Summary:** Phase/plan completion documentation with dependency graph, tech stack, key files, decisions, patterns, performance metrics, and deviations. Enables automatic context assembly via dependency graph.

**Fields:**
- `phase_id` (string) - Phase identifier (e.g., "03-features")
- `plan_id` (string) - Plan number within phase
- `subsystem` (string) - Primary category (auth, payments, ui, api, database, infra, testing)
- `tags` (array) - Searchable tech keywords (jwt, stripe, react, postgres)
- `dependency_graph` (object)
  - `requires` (array) - Prior phases this depends on with what they provide
  - `provides` (array) - What this phase delivered
  - `affects` (array) - Phases that will need this context
- `tech_stack` (object)
  - `added` (array) - Libraries/tools added
  - `patterns` (array) - Architectural patterns established
- `key_files` (object)
  - `created` (array) - Important files created
  - `modified` (array) - Important files modified
- `key_decisions` (array) - Major decisions made
- `patterns_established` (array) - Patterns future phases should maintain
- `metrics` (object)
  - `duration` (string) - Time taken (e.g., "28 min")
  - `completed` (string) - ISO timestamp
- `deviations` (array) - Auto-fixed issues (if any)
- `issues_encountered` (array) - Problems during planned work
- `next_readiness` (object) - What's ready, blockers, concerns

**Relationships:**
- `implements` → `phase-plan:plan_id` - Completes execution of plan
- `depends_on` → `phase-context:phase_id` - Context used for execution
- `depends_on` → `phase-research:phase_id` - Research used for stack decisions
- `connects_to` → `phase-summary:requires` - Links to prior summaries for dependency graph
- `configured_by` → `phase-summary:affects` - Future phases depend on this

</megamemory_schema>

<megamemory_operations>

## Create Phase Summary

```typescript
// After completing a phase/plan execution
await megamemory.create_concept({
  name: `phase-summary:${phaseId}-${planId}`,
  kind: "feature",
  summary: `${oneLiner}. Duration: ${duration}. Files: ${filesModified.length}. Decisions: ${keyDecisions.length}. Tech stack added: ${techStack.added.join(", ")}. Subsystem: ${subsystem}. Tags: ${tags.join(", ")}.`,
  why: "Documents actual execution results, enables automatic context assembly via dependency graph",
  parent_id: `project:${projectId}`,
  edges: [
    {
      to: `phase-plan:${phaseId}-${planId}`,
      relation: "implements",
      description: "Completes execution of plan"
    },
    {
      to: `phase-context:${phaseId}`,
      relation: "depends_on",
      description: "Used context decisions during execution"
    },
    ...dependencyGraph.requires.map(req => ({
      to: `phase-summary:${req.phase}`,
      relation: "depends_on",
      description: `Requires ${req.provides} from ${req.phase}`
    }))
  ]
})
```

## Query Summary by Subsystem

```typescript
// Get all summary concepts for a subsystem (auth, payments, ui, etc.)
const result = await megamemory.understand({
  query: `phase summaries subsystem ${subsystem} with decisions and patterns`,
  top_k: 10
})

// Returns all auth-related phase-summary concepts with their decisions and patterns
// Used for context assembly when planning new auth features
```

## Query Tech Stack Usage

```typescript
// Find all phases that use a specific library
const result = await megamemory.understand({
  query: `phase summaries using ${libraryName} with examples and patterns`,
  top_k: 15
})

// Returns all phase-summary concepts where library is in tech_stack.added or tags
// Shows patterns established for that library
```

## Query Dependency Graph for Context Assembly

```typescript
// Plan-phase agent builds context by traversing dependency graph
const result = await megamemory.understand({
  query: `phase summary ${currentPhaseId} dependency graph requires provides affects`,
  top_k: 20
})

// Returns transitive closure of all required phase-summary concepts
// Context assembly: query phase-summary concepts in dependency order
```

</megamemory_operations>

<megamemory_examples>

## Example 1: Creating Auth Foundation Summary

```typescript
// After completing Phase 1: Foundation (auth)
await megamemory.create_concept({
  name: "phase-summary:01-foundation-01",
  kind: "feature",
  summary: "JWT auth with refresh rotation using jose library, Prisma User model, and protected API middleware. Duration: 28 min. Files: 8. Decisions: 3. Tech stack added: jose, prisma. Subsystem: auth. Tags: jwt, refresh-tokens, prisma, postgres, protected-routes.",
  why: "Auth foundation complete, provides User model and protected middleware to future phases",
  parent_id: "project:myapp",
  edges: [
    {
      to: "phase-plan:01-foundation-01",
      relation: "implements",
      description: "Completed auth foundation plan"
    },
    {
      to: "phase-context:01-foundation",
      relation: "depends_on",
      description: "Used context decisions during execution"
    }
  ]
})
```

## Example 2: Querying Subsystem Context for New Feature

```typescript
// Planning new payment feature - what auth decisions matter?
const authContext = await megamemory.understand({
  query: "phase summaries subsystem auth with User model auth middleware patterns",
  top_k: 5
})

// Returns phase-summary concepts with:
// - Summary: "JWT auth with refresh rotation using jose library"
// - Key files from summary: src/lib/auth.ts, src/middleware.ts
// - Decisions: 15-min access tokens, 7-day refresh tokens
// - Patterns: Protected route checks, token rotation on each request
// Used to plan payment feature integration with existing auth
```

## Example 3: Querying Library Usage Patterns

```typescript
// Planning to add another Prisma model - what patterns exist?
const prismaPatterns = await megamemory.understand({
  query: "phase summaries using prisma with schema patterns migration examples",
  top_k: 10
})

// Returns phase-summary concepts for all phases using Prisma with:
// - Schema patterns established (model structure, relations)
// - Migration patterns (how to run migrations)
// - Query patterns (where, include, select usage)
// Used to maintain consistency across new models
```

## Example 4: Dependency Graph Traversal

```typescript
// Plan-phase needs context for Phase 4: Comments
const result = await megamemory.understand({
  query: "phase summary 04-comments dependency graph requires provides affects",
  top_k: 20
})

// Returns dependency chain:
// Phase 4 requires:
//   - Phase 1 (auth) provides: User model, protected routes
//   - Phase 2 (posts) provides: Post model, post API
//   - Phase 3 (UAT) provides: Testing patterns

// Context assembly loads phase-summary:01-foundation-01, phase-summary:02-posts-01, phase-summary:03-uat-01
// Plan-phase knows User type, Post type, auth middleware patterns from summary concepts
```

</megamemory_examples>

---

## File Template

```markdown
---
phase: XX-name
plan: YY
subsystem: [primary category: auth, payments, ui, api, database, infra, testing, etc.]
tags: [searchable tech: jwt, stripe, react, postgres, prisma]

# Dependency graph
requires:
  - phase: [prior phase this depends on]
    provides: [what that phase built that this uses]
provides:
  - [bullet list of what this phase built/delivered]
affects: [list of phase names or keywords that will need this context]

# Tech tracking
tech-stack:
  added: [libraries/tools added in this phase]
  patterns: [architectural/code patterns established]

key-files:
  created: [important files created]
  modified: [important files modified]

key-decisions:
  - "Decision 1"
  - "Decision 2"

patterns-established:
  - "Pattern 1: description"
  - "Pattern 2: description"

# Metrics
duration: Xmin
completed: YYYY-MM-DD
---

# Phase [X]: [Name] Summary

**[Substantive one-liner describing outcome - NOT "phase complete" or "implementation finished"]**

## Performance

- **Duration:** [time] (e.g., 23 min, 1h 15m)
- **Started:** [ISO timestamp]
- **Completed:** [ISO timestamp]
- **Tasks:** [count completed]
- **Files modified:** [count]

## Accomplishments
- [Most important outcome]
- [Second key accomplishment]
- [Third if applicable]

## Task Commits

Each task was committed atomically:

1. **Task 1: [task name]** - `abc123f` (feat/fix/test/refactor)
2. **Task 2: [task name]** - `def456g` (feat/fix/test/refactor)
3. **Task 3: [task name]** - `hij789k` (feat/fix/test/refactor)

**Plan metadata:** `lmn012o` (docs: complete plan)

_Note: TDD tasks may have multiple commits (test → feat → refactor)_

## Files Created/Modified
- `path/to/file.ts` - What it does
- `path/to/another.ts` - What it does

## Decisions Made
[Key decisions with brief rationale, or "None - followed plan as specified"]

## Deviations from Plan

[If no deviations: "None - plan executed exactly as written"]

[If deviations occurred:]

### Auto-fixed Issues

**1. [Rule X - Category] Brief description**
- **Found during:** Task [N] ([task name])
- **Issue:** [What was wrong]
- **Fix:** [What was done]
- **Files modified:** [file paths]
- **Verification:** [How it was verified]
- **Committed in:** [hash] (part of task commit)

[... repeat for each auto-fix ...]

---

**Total deviations:** [N] auto-fixed ([breakdown by rule])
**Impact on plan:** [Brief assessment - e.g., "All auto-fixes necessary for correctness/security. No scope creep."]

## Issues Encountered
[Problems and how they were resolved, or "None"]

[Note: "Deviations from Plan" documents unplanned work that was handled automatically via deviation rules. "Issues Encountered" documents problems during planned work that required problem-solving.]

## User Setup Required

[If USER-SETUP.md was generated:]
**External services require manual configuration.** See [{phase}-USER-SETUP.md](./{phase}-USER-SETUP.md) for:
- Environment variables to add
- Dashboard configuration steps
- Verification commands

[If no USER-SETUP.md:]
None - no external service configuration required.

## Next Phase Readiness
[What's ready for next phase]
[Any blockers or concerns]

---
*Phase: XX-name*
*Completed: [date]*
```

<frontmatter_guidance>
**Purpose:** Enable automatic context assembly via dependency graph. Frontmatter makes summary metadata machine-readable so plan-phase can scan all summaries quickly and select relevant ones based on dependencies.

**Fast scanning:** Frontmatter is first ~25 lines, cheap to scan across all summaries without reading full content.

**Dependency graph:** `requires`/`provides`/`affects` create explicit links between phases, enabling transitive closure for context selection.

**Subsystem:** Primary categorization (auth, payments, ui, api, database, infra, testing) for detecting related phases.

**Tags:** Searchable technical keywords (libraries, frameworks, tools) for tech stack awareness.

**Key-files:** Important files for @context references in PLAN.md.

**Patterns:** Established conventions future phases should maintain.

**Population:** Frontmatter is populated during summary creation in execute-plan.md. See `<step name="create_summary">` for field-by-field guidance.
</frontmatter_guidance>

<one_liner_rules>
The one-liner MUST be substantive:

**Good:**
- "JWT auth with refresh rotation using jose library"
- "Prisma schema with User, Session, and Product models"
- "Dashboard with real-time metrics via Server-Sent Events"

**Bad:**
- "Phase complete"
- "Authentication implemented"
- "Foundation finished"
- "All tasks done"

The one-liner should tell someone what actually shipped.
</one_liner_rules>

<example>
```markdown
# Phase 1: Foundation Summary

**JWT auth with refresh rotation using jose library, Prisma User model, and protected API middleware**

## Performance

- **Duration:** 28 min
- **Started:** 2025-01-15T14:22:10Z
- **Completed:** 2025-01-15T14:50:33Z
- **Tasks:** 5
- **Files modified:** 8

## Accomplishments
- User model with email/password auth
- Login/logout endpoints with httpOnly JWT cookies
- Protected route middleware checking token validity
- Refresh token rotation on each request

## Files Created/Modified
- `prisma/schema.prisma` - User and Session models
- `src/app/api/auth/login/route.ts` - Login endpoint
- `src/app/api/auth/logout/route.ts` - Logout endpoint
- `src/middleware.ts` - Protected route checks
- `src/lib/auth.ts` - JWT helpers using jose

## Decisions Made
- Used jose instead of jsonwebtoken (ESM-native, Edge-compatible)
- 15-min access tokens with 7-day refresh tokens
- Storing refresh tokens in database for revocation capability

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added password hashing with bcrypt**
- **Found during:** Task 2 (Login endpoint implementation)
- **Issue:** Plan didn't specify password hashing - storing plaintext would be critical security flaw
- **Fix:** Added bcrypt hashing on registration, comparison on login with salt rounds 10
- **Files modified:** src/app/api/auth/login/route.ts, src/lib/auth.ts
- **Verification:** Password hash test passes, plaintext never stored
- **Committed in:** abc123f (Task 2 commit)

**2. [Rule 3 - Blocking] Installed missing jose dependency**
- **Found during:** Task 4 (JWT token generation)
- **Issue:** jose package not in package.json, import failing
- **Fix:** Ran `npm install jose`
- **Files modified:** package.json, package-lock.json
- **Verification:** Import succeeds, build passes
- **Committed in:** def456g (Task 4 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both auto-fixes essential for security and functionality. No scope creep.

## Issues Encountered
- jsonwebtoken CommonJS import failed in Edge runtime - switched to jose (planned library change, worked as expected)

## Next Phase Readiness
- Auth foundation complete, ready for feature development
- User registration endpoint needed before public launch

---
*Phase: 01-foundation*
*Completed: 2025-01-15*
```
</example>

<guidelines>
**When to create:**
- After completing each phase plan
- Required output from execute-plan workflow
- Documents what actually happened vs what was planned

**Frontmatter completion:**
- MANDATORY: Complete all frontmatter fields during summary creation
- See <frontmatter_guidance> for field purposes
- Frontmatter enables automatic context assembly for future planning

**One-liner requirements:**
- Must be substantive (describe what shipped, not "phase complete")
- Should tell someone what was accomplished
- Examples: "JWT auth with refresh rotation using jose library" not "Authentication implemented"

**Performance tracking:**
- Include duration, start/end timestamps
- Used for velocity metrics in STATE.md

**Deviations section:**
- Documents unplanned work handled via deviation rules
- Separate from "Issues Encountered" (which is planned work problems)
- Auto-fixed issues: What was wrong, how fixed, verification

**Decisions section:**
- Key decisions made during execution
- Include rationale (why this choice)
- Extracted to STATE.md accumulated context
- Use "None - followed plan as specified" if no deviations

**After creation:**
- STATE.md updated with position, decisions, issues
- Next plan can reference decisions made
</guidelines>
