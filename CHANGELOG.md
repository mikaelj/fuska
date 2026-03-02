# Changelog — Fuska

Narrative changelog tracking significant changes to the Fuska prompt framework.
Organized by theme rather than individual commit.

---

## v0.5.0 - 2026-03-02

**11 commits** | 15 files changed, 3070 insertions, 53 deletions

### New Features

- **Architecture Decision Records (ADR)** — Full ADR lifecycle system with CLI commands (`fuska decision query/export/list`), decision concept schema in MegaMemory, logging template, and automatic workflow integration in `fuska-do` when ADR opt-in is enabled

### Improvements

- **Init Command Refactor** — Streamlined command by removing unnecessary `description` argument and broken `--debug` flag, improved provider display in next steps

### Bug Fixes

- Fixed tutorial documentation
- Added try-catch to ADR config JSON parsing for better error handling
- Corrected ADR opt-in check syntax in fuska-do workflow
- Fixed progress command to find global config and simplify initiative detection

---

## v0.4.0 - 2026-02-27

**2 commits** | 9 files changed, 293 insertions, 11 deletions

### New Features

- **Lessons Command** — New `fuska lessons` CLI command queries MegaMemory for plan and code review lessons, grouped by source with relative timestamps and `--json` output

### Documentation

- Added "Formalize as You Go" section with three escalation paths from ad-hoc fixes to full chapters
- Documented lessons-learned capture workflow in pitch documents

---

## v0.3.0 - 2026-02-27

**3 commits** | 10 files changed, 276 insertions, 1 deletion

### New Features

- **Cross-Task Learning System** — Plan-checker and code-reviewer now create lessons; planner and executor query them before work, enabling knowledge reuse across sessions

### Bug Fixes

- Fixed changelog script parameter handling
- Fixed prepublish login issue

---

## v0.2.1 - 2026-02-27

**2 commits** | 4 files changed, 180 insertions, 20 deletions

### New Features

- **Initiative New Command** — New `fuska initiative new` CLI command for creating initiatives with slug validation and auto-switch

---

## v0.2.0 — 2026-02-25

**6 commits** | 24 files changed, 558 insertions, 27 deletions

### New Features

- **Code Review Command** — New `fuska-code-review` command for reviewing uncommitted changes

### Documentation

- Added FAQ with GSD cost comparison, expanded README with links and new features
- Fixed npm package name and agent count in pitch and docs

---

## v0.1.1 — 2026-02-25

**2 commits** | 7 files changed, 495 insertions, 90 deletions

### Documentation

- Enhanced code review pitch and blurb documentation (English and Swedish)

---

## v0.1.0 — 2026-02-25

**4 commits** | 18 files changed, 957 insertions, 79 deletions

### New Features

- **Code Review Command** — New `/fuska-code-review` command with execution loop and agent pipelines
- **Workflow Mode Display** — Improved config command shows agent pipelines per workflow mode

### Documentation

- Added code review example and Swedish pitch
- Updated workflow and configuration docs

---

## v0.0.5 — 2026-02-23

**2 commits** | 5 files changed, 16 insertions, 11 deletions

### Improvements

- Updated README and init command for Claude's MegaMemory permissions

---

## v0.0.4 — 2026-02-23

**2 commits** | 3 files changed, 5 insertions, 5 deletions

### Package

- Renamed npm package to `fuska-magistern`

---

## v0.0.3 — 2026-02-23

**31 commits** | 66 files changed, ~1,600 insertions, ~8,800 deletions (net ~7,200 lines removed)

This release represents a focused token-optimization effort. The prompt files that make up Fuska had grown organically, with substantial duplication across agent and command definitions. The goal was to reduce total token cost without losing any behavioral fidelity — every instruction still exists, it just lives in one place instead of thirty.

### Shared resource extraction (`@include` pattern)

The single biggest lever was identifying blocks of text that appeared verbatim (or near-verbatim) in many files and extracting them into standalone reference files under `provider/opinkode/fuska/`. Each source file now uses a short `@include` directive instead of carrying its own copy.

New shared resources created:

- **megamemory-quick-ref.md** — condensed megamemory usage guide, replacing a ~40-line block duplicated across 26 command files and 4 agent files.
- **workflow-modes.md** — the three workflow modes (discovery, milestone, chapter) that were copy-pasted into multiple commands.
- **plan-prompts.md** — plan-type definitions and prompt templates extracted from fuska-plan.md.
- **review-loop.md** — the review/verify loop template previously inlined in the execute-plan workflow.
- **model-resolution.md** — model selection logic extracted from command files.
- **execution-rules.md** — shared execution constraints that were duplicated across agent files.
- **language.md** — the Swedish-language instruction block, previously inlined in all 19 agent files.

### Reference file condensation

Several large reference documents were condensed significantly while preserving all essential rules. Redundant phrasing, over-explained examples, and verbose formatting were tightened:

| File | Before | After | Reduction | ~Tokens saved |
|------|--------|-------|-----------|---------------|
| checkpoints.md | 1,365 lines | 354 lines | 74% | ~3,980 (69%) |
| verification-patterns.md | 1,056 lines | 268 lines | 75% | ~2,730 (70%) |
| git-integration.md | 1,048 lines | 219 lines | 79% | ~3,040 (77%) |
| tdd.md | 987 lines | 207 lines | 79% | ~3,575 (80%) |
| megamemory-integration.md | 1,562 lines | 655 lines | 58% | ~1,790 (38%) |
| **Total:** | 6,018 lines | 1,703 lines | 72% | ~15,115 (66%) |

### Command file deduplication

The three largest command files — `fuska-plan.md`, `fuska-do.md`, and `fuska-build.md` — each contained over 1,000 lines because they inlined their own copies of workflow logic, review templates, and plan-type definitions. After extracting shared resources, these shrank dramatically:

| File | Before | After | Shared @includes | ~Tokens saved | ~Saved (cached*) |
|------|--------|-------|-----------------|---------------|-----------------|
| fuska-plan.md | 1,446 lines | 450 lines | ~1,180 tokens | ~2,080 (44%) | ~3,140 (66%) |
| fuska-do.md | 1,163 lines | 534 lines | ~280 tokens | ~1,190 (34%) | ~1,440 (42%) |
| fuska-build.md | 1,023 lines | 384 lines | ~280 tokens | ~1,400 (45%) | ~1,650 (53%) |
| **Total:** | 3,632 lines | 1,368 lines | ~1,740 tokens | ~4,670 (41%) | ~6,230 (55%) |

*Cached: shared @includes at prompt-cache read price (90% discount). Before the refactor, this content was inlined and unique to each command file — uncacheable. After extraction to shared paths, it benefits from caching across invocations.

The remaining 26 command files and 19 agent files each lost their inlined megamemory guide, language block, and other duplicated sections — typically 20–50 lines per file, adding up across the full set.

> Token estimates use word count as proxy (~1 word ≈ 1 token for English markdown). "Cached" columns assume shared @include files hit the prompt cache at 90% discount — reasonable since they're stable, shared-path resources loaded identically across commands.

### Improvements

- Added chapter-scoped todos for iterative refinement
- Renamed `/fuska-configure-initiative` to `/fuska-configure`
- Merged `list-chapter-assumptions` into design command
- Added `.gitignore` and IDE directory exclusions to codebase mapper

### Documentation

- Added `docs/concepts.md` covering plan types, reference architecture, and TDD approach
- Minor updates to `docs/development.md` and `docs/workflow.md`

### Bug Fixes

- Fixed stale file paths referencing old `get-shit-done` project name
- Fixed `--no-map` flag in init command
- Improved table formatting for terminal display

---

## v0.0.2-baseline — 2026-02-21

Baseline tag created before the token-optimization work began. Represents the last state of the prompt framework before the extraction and condensation effort described above.
