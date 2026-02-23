# Status Values Reference

Canonical reference for all status values used across the fuska system. All status assignments and comparisons MUST use values from this document.

## Universal Status Values

Apply to chapters, milestones, requirements, and todos.

| Status | Meaning |
|--------|---------|
| `pending` | Created but not started |
| `planned` | Ready to start, plan exists |
| `in_progress` | Actively being worked |
| `complete` | Finished successfully |
| `blocked` | Cannot proceed, needs intervention |
| `failed` | Finished unsuccessfully |
| `skipped` | Intentionally not done |

## State Machine States

Only for the `state` concept (initiative execution state). These track where the initiative is in its lifecycle.

| Status | Meaning |
|--------|---------|
| `initialized` | New initiative, no chapters yet |
| `defining_requirements` | Gathering requirements for a milestone |
| `ready_to_plan` | Chapter exists, needs planning |
| `ready_to_execute` | Plan exists, ready to build |
| `in_progress` | Execution underway |
| `chapter_complete` | Current chapter done |
| `milestone_complete` | All chapters in current milestone done |


## Debug Workflow Phases

Only for debug session concepts.

| Status | Meaning |
|--------|---------|
| `gathering` | Collecting symptoms |
| `investigating` | Finding root cause |
| `fixing` | Implementing solution |
| `verifying` | Confirming fix works |
| `resolved` | Debug complete |

## Outcomes

Separate from status. Used for verification and review results.

| Outcome | Use |
|---------|-----|
| `passed` | Verification succeeded |
| `issues_found` | Problems detected |
| `human_needed` | Requires human decision |
| `failed` | Verification failed |

## Verification Concept Health

Internal values for MegaMemory concept verification.

| Value | Meaning |
|-------|---------|
| `verified` | Concept confirmed accurate |
| `orphaned` | Concept has no parent or references |
| `stub` | Concept exists but lacks detail |
| `missing` | Expected concept not found |

## Requirement Coverage (audit only)

Used by `/fuska-audit` for requirement coverage assessment.

| Value | Meaning |
|-------|---------|
| `satisfied` | Requirement fully covered |
| `partial` | Requirement partially covered |
| `unsatisfied` | Requirement not covered |
| `unverified` | Chapter not yet verified |

## Migration Map

| Old Value | New Value | Context |
|-----------|-----------|---------|
| `not_planned` | `pending` | Chapter status |
| `ready_for_planning` | `planned` | Chapter status (chapter concept, not state) |
| `completed` | `complete` | Any context |
| `chapter_complete` | `complete` | Chapter status (use `chapter_complete` only in state concept) |
| `done` | `complete` | Todo status |
| `shipped` | `complete` | Milestone status |
| `validated` | `complete` | Requirement status |
| `active` (requirement) | `in_progress` | Requirement status |
| `executing` | `in_progress` | State concept — equivalent to in_progress |
| `not_started` | `pending` | Chapter/roadmap default |
| `archived` | `skipped` | Chapter guard check |
| `planning` | `in_progress` | Plan/doc intermediate state |
| `open` (debug) | `gathering` | Debug session initial state |
| `Ready to plan` | `ready_to_plan` | Fix title-casing in state |
| `Not started` | `pending` | Roadmap display — normalize casing |
| `In progress` | `in_progress` | Roadmap display — normalize casing |
| `Complete` | `complete` | Roadmap display — normalize casing |
| `Deferred` | `skipped` | Roadmap display — normalize casing |
| `phase_complete` | `chapter_complete` | Legacy terminology migration |

## Usage Guidelines

### Chapters
Use universal status values: `pending`, `planned`, `in_progress`, `complete`, `blocked`, `failed`, `skipped`.

### Todos
Use `pending` and `complete` (migrated from `done`).

### Milestones
Use universal status values. `shipped` is migrated to `complete`.

### Requirements
Use: `pending`, `in_progress`, `complete`, `out_of_scope`, `blocked`.
- `validated` migrated to `complete`
- `active` migrated to `in_progress`

### State concept
Use state machine states only: `initialized`, `defining_requirements`, `ready_to_plan`, `ready_to_execute`, `in_progress`, `chapter_complete`, `milestone_complete`.

### Debug sessions
Use debug workflow phases: `gathering`, `investigating`, `fixing`, `verifying`, `resolved`.

### Display formatting
Status values are always stored in snake_case. For human-readable display, convert at presentation time (e.g., `in_progress` → "In progress"). Never store title-cased values.
