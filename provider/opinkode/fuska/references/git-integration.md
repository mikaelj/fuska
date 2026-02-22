# Git Integration

<core_principle>

**Commit outcomes, not process.**

The git log should read like a changelog of what shipped, not a diary of planning activity.
</core_principle>

<megamemory_persistence>

**MegaMemory is persistent outside git.** Planning artifacts (initiative, roadmap, state, plan, summary) are stored in MegaMemory and persist outside git version control.

- **No planning file commits:** Never `git add` planning artifacts
- **Source code only:** Git commits include only code changes (src/, tests/, config)
- **MegaMemory data survives git operations:** Unaffected by reset, revert, etc.

</megamemory_persistence>

<commit_points>

Commit timing depends on the `git.commit_strategy` setting in the config concept. Default: `per-chapter`.

| Event | per-chapter | per-plan | per-task | Why |
|-------|-----------|----------|----------|-----|
| BRIEF + ROADMAP created | YES | YES | YES | Project initialization |
| PLAN/RESEARCH/DISCOVERY created | NO | NO | NO | Intermediate — MegaMemory tracks this |
| **Task completed** | stage | stage | COMMIT | Stage files; commit only if per-task |
| **Plan completed** | stage | COMMIT | — | Commit if per-plan |
| **Chapter completed** | COMMIT | — | — | Commit if per-chapter |
| Handoff created | YES | YES | YES | WIP state preserved |

**"stage" means:** `git add` the files but do NOT commit yet. Commit happens at the boundary defined by the strategy.

</commit_points>

<git_check>

```bash
[ -d .git ] && echo "GIT_EXISTS" || echo "NO_GIT"
```

If NO_GIT: Run `git init` silently. Fuska projects always get their own repo.
</git_check>

<commit_message_rules>

## Commit Message Rules

**CRITICAL: LLMs tend to write extremely verbose commit messages. Fight this tendency.**

### Subject line
- Max 72 characters
- Imperative mood ("add X", not "added X")
- Format: `{type}({scope}): {description}`

### Body
- **Maximum 2-4 bullet points.** Never more.
- Each bullet is ONE high-level sentence describing *what* changed and *why*
- **NEVER** list: imports, field names, parameter details, null checks, variable renamings, or implementation mechanics
- **NEVER** restate what the diff shows — the diff is the source of truth

### Commit types
| Type | Usage |
|------|-------|
| `feat` | New feature/functionality |
| `fix` | Bug fix |
| `test` | Test-only (TDD RED chapter) |
| `refactor` | Code cleanup, no behavior change |
| `perf` | Performance improvement |
| `chore` | Dependencies, config, tooling |

### BAD (do not do this)
```
feat(api): Parse discounts array from API response and map to Discount subclasses

- Added import 'package:goride/util/api_price_calc.dart' to data_parser.dart
- Created _parseDiscounts() helper method that parses discounts array
- Extracts common fields: id, name, description, type
- Uses pattern matching on type field...
[11 bullet points restating the diff]
```

### GOOD (do this)
```
feat(api): parse discounts from API response

- Map discount JSON to typed Discount subclasses via pattern matching
- Assign parsed discounts to User after construction

02-02
```
Two bullets. High-level. The diff shows the rest.

</commit_message_rules>

<commit_formats>

## Commit Formats by Strategy

### Initialization
```
docs: initialize [initiative-name] ([N] chapters)

[One-liner initiative description]
```

### Per-Task (`git.commit_strategy` = `per-task`)
```
{type}({scope}): {concise task description}

- {high-level change 1}
- {high-level change 2}

{chapter}-{plan}
```

### Per-Plan (`git.commit_strategy` = `per-plan`)
```
{type}({scope}): {plan objective summary}

- {task 1}: {one-line summary}
- {task 2}: {one-line summary}

{chapter}-{plan}
```

### Per-Chapter (`git.commit_strategy` = `per-chapter`)
```
{type}({scope}): {chapter goal summary}

- Plan {NN}-01: {one-line summary}
- Plan {NN}-02: {one-line summary}

chapter-{NN}
```

### Handoff (WIP)
```
wip: [chapter-name] paused at task [X]/[Y]

Current: [task name]

{chapter}-{plan}
```

**Notes:**
- Scope = semantic area (`auth`, `api`, `checkout`)
- Trailer = chapter-plan identifier
- Max 2-4 bullets per commit, one sentence each

</commit_formats>

<git_megamemory_separation>

| Type | Git | MegaMemory |
|------|-----|------------|
| Source code, tests, config | Commit | Track in file_refs |
| Planning artifacts | Never commit | Stored as concepts |
| Commit history context | Git log | Stored as concepts |
| Task progress, handoff state | Never commit | Stored as concepts |

**Key principle:** MegaMemory persists all planning and context data. Git only tracks shipping code.

</git_megamemory_separation>

<example_log>

## Example Git Logs

**per-chapter (default — cleanest):**
```
a7f2d1 feat(checkout): add Stripe payments integration     chapter-04
3e9c4b feat(catalog): add product search and filters       chapter-03
8a1b2c feat(auth): add JWT auth with refresh tokens        chapter-02
5c3d7e feat(scaffold): set up Next.js 15 + Prisma          chapter-01
2f4a8d docs: initialize ecommerce-app (5 chapters)
```

**per-plan (moderate):**
```
4d5e6f feat(checkout): add Stripe session flow              04-01
8b9c0d feat(auth): implement refresh token rotation         02-02
7k8l9m feat(auth): add JWT generation and validation        02-01
6t7u8v feat(scaffold): configure project structure          01-01
2f4a8d docs: initialize ecommerce-app (5 chapters)
```

**per-task (most granular):**
```
4d5e6f feat(stripe): add webhook signature verification     04-01
7g8h9i feat(api): implement payment session creation        04-01
0j1k2l feat(ui): create checkout page component             04-01
1e2f3g test(auth): add failing test for token refresh       02-02
7k8l9m feat(jose): add JWT generation and validation        02-01
2f4a8d docs: initialize ecommerce-app (5 chapters)
```

</example_log>

<commit_strategy_rationale>

**per-chapter (default):** Cleanest git history. MegaMemory already tracks granular progress. Rarely need to bisect individual tasks.

**per-plan:** Middle ground. Useful when chapters are large and you want to revert individual plans.

**per-task:** Most granular. Each task independently revertable/bisectable. Use when working with other developers who read git log.

**Failure recovery:** MegaMemory tracks task completion regardless of commit strategy. If an agent crashes mid-chapter, it resumes from the last completed task (not the last commit).

</commit_strategy_rationale>

<anti_patterns>

**Never commit:** Planning artifacts, PLAN/RESEARCH/DISCOVERY concepts, plan-completion metadata.

**Always commit:** Source code and tests (at strategy boundary), project initialization, handoff (WIP).

</anti_patterns>
