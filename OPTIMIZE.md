# Optimization Plan: Remove Non-Essential Tool Calls

Goal: Reduce unnecessary bash `date` calls and JavaScript `new Date()` invocations that add "nice to have" data but slow down execution.

---

## Category 1: Duration Tracking (Primary Target)
**Impact:** Removes 4+ bash `date` calls per plan execution

| File | What to Remove |
|------|----------------|
| `workflows/execute-plan.md` | Steps `record_start_time` and `record_completion_time` including `PLAN_START_TIME`, `PLAN_START_EPOCH`, `PLAN_END_TIME`, `PLAN_END_EPOCH`, `DURATION` calculations; also `started`, `completed`, `duration` from summary JSON |
| `agents/fuska/fuska-executor.md` | Same bash time commands; `duration_minutes`, `started`, `completed` from summary |
| `templates/summary.md` | `duration`, `started`, `completed` fields in schema and examples; "Performance" section in file template |
| `templates/state.md` | "Performance Metrics" child concept entirely; performance update logic |

---

## Category 2: `last_activity` Field (Secondary Target)
**Impact:** Removes `new Date()` calls from every state update across ~20 commands

| File | What to Change |
|------|----------------|
| `fuska-do.md`, `fuska-execute-phase.md`, `fuska-plan-phase.md`, `fuska-research-phase.md`, `fuska-insert-phase.md`, `fuska-remove-phase.md`, `fuska-complete-milestone.md`, `fuska-new-milestone.md`, `fuska-new-project.md`, `fuska-map-codebase.md`, `fuska-resume-work.md`, `fuska-check-todos.md`, `fuska-plan-milestone-gaps.md` | Remove `last_activity` field from state updates |
| `templates/state.md` | Remove `last_activity` from schema and all examples |
| `fuska/scripts/types.ts` | Remove `last_activity` from StateData interface |

---

## Category 3: Performance Metrics Concept (Removal)
**Impact:** Removes child concept creation and updates

| File | What to Change |
|------|----------------|
| `templates/state.md` | Remove entire "Performance Metrics" section and all related code examples |
| Any command updating metrics | Remove those update calls (if any exist outside templates) |

---

## Category 4: Other Minor Optimizations

| File | What to Remove | Rationale |
|------|----------------|-----------|
| `workflows/execute-plan.md` | `files_modified_count` field | Redundant with `files_modified.length` |
| `templates/summary.md` | `files_modified_count` from schema | Same |

---

## Items to KEEP (Functional Purpose)

- **`created_at` in todos** — Used for ordering/deduplication
- **`gathered_date` in context** — Shows when context was gathered
- **`completed_at` in milestones** — Tracks milestone completion
- **`timestamp` in debug sessions** — Tracks hypothesis state changes
- **`files_modified` / `key_files` arrays** — Used by verifier
- **`total_tasks` in pause state** — Needed for resume workflow
- **`task_commits`** — Audit trail for atomic commits

---

## Files to Modify

### 1. `workflows/execute-plan.md`
- Remove step `record_start_time` (lines ~186-195)
- Remove step `record_completion_time` (lines ~1401-1421)
- Remove from summary creation: `duration`, `started`, `completed`, `files_modified_count`
- Remove `last_activity` from state updates
- Remove timing variables from display output

### 2. `agents/fuska/fuska-executor.md`
- Remove bash time commands at start (lines ~81-85)
- Remove `duration_minutes`, `completed` from summary creation
- Remove `last_activity` from state updates

### 3. `templates/summary.md`
- Remove from schema: `metrics.duration`, `metrics.completed`
- Remove "Performance" section from file template (duration, started, completed, tasks, files modified count)
- Update examples to remove timing fields
- Keep: `key_files`, `files_modified` (used by verifier)

### 4. `templates/state.md`
- Remove "Performance Metrics" child concept entirely
- Remove `last_activity` from Current Position and all examples
- Remove `performance` from TypeScript interfaces
- Simplify to: Current Position, Recent Decisions, Pending Todos, Blockers/Concerns, Session Continuity

### 5. `fuska/scripts/types.ts`
- Remove from StateData: `last_activity`
- Remove from SummaryData: `duration_minutes`, `started`, `completed`, `files_modified_count`

### 6. Commands with `last_activity` updates (remove field):
- `command/fuska/fuska-do.md`
- `command/fuska/fuska-execute-phase.md`
- `command/fuska/fuska-plan-phase.md`
- `command/fuska/fuska-research-phase.md`
- `command/fuska/fuska-insert-phase.md`
- `command/fuska/fuska-remove-phase.md`
- `command/fuska/fuska-complete-milestone.md`
- `command/fuska/fuska-new-milestone.md`
- `command/fuska/fuska-new-project.md`
- `command/fuska/fuska-map-codebase.md`
- `command/fuska/fuska-resume-work.md`
- `command/fuska/fuska-check-todos.md`
- `command/fuska/fuska-plan-milestone-gaps.md`

### 7. Display commands (remove `last_activity` reads):
- `command/fuska/fuska-progress.md`
- `command/fuska/fuska-export-md.md`
- `command/fuska/fuska-resume-work.md`
- `command/fuska/fuska-pause-work.md`

### 8. Reference files (update docs):
- `fuska/references/megamemory-integration.md` — Remove timing examples
- `fuska/references/query-patterns.md` — Remove `last_activity` from parse examples

### 9. Test files (update to match):
- `fuska/scripts/__tests__/workflow-integration.test.ts`
- `fuska/scripts/__tests__/e2e-lifecycle.test.ts`
- `fuska/scripts/__tests__/helpers.test.ts`
- `fuska/scripts/__tests__/phase-templates.test.ts`
- `fuska/scripts/__tests__/migration.test.ts`
- `fuska/scripts/validators.ts`

---

## Estimated Impact
- **~30+ `date` / `new Date()` calls removed** per execution cycle
- **Fewer MegaMemory update calls** (smaller state updates)
- **Cleaner state schema** with only essential fields
