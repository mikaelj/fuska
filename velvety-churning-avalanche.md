# Why `/fuska` and `fuska progress` show different output

## Context

Running `/fuska` in `~/code/stocks/main` shows "3/3 chapters complete" → MILESTONE_DONE.
Running `fuska progress` shows 5 chapters (1-4, 8), all in "Future:", with chapter 1 as "Next".
The actual database state is somewhere in between.

## Root Causes (3 independent bugs)

### Bug 1: Stale roadmap summary (affects `/fuska`)

The `entry/roadmap` node summary is **markdown text** that was written when the initiative had 3 chapters. It says:

```
**Chapters:** 3
Chapter 1 - Daily Price Breakdown | **Complete**
Chapter 2 - Optimal Entry Detection | **Complete**
Chapter 3 - Learning Feedback | **Planned**
```

But chapter 4 (`entry/roadmap/chapter-4-ml-entry-model-training`) was added later as a child node and the parent roadmap summary was never updated. The `/fuska` LLM reads this summary and only sees 3 chapters.

Additionally, chapter 3 has both `chapter-3-learning-feedback-plan-01` and `chapter-3-learning-feedback-plan-01-summary` in the DB, so the LLM classifies it as CHAPTER_DONE (summaryCount >= planCount). With all 3 known chapters appearing done, it concludes MILESTONE_DONE.

**Fix**: Update `entry/roadmap` summary to include chapter 4 and correct chapter 3 status.

### Bug 2: Markdown roadmap can't be parsed as JSON (affects `fuska progress`)

`progress.ts:findRoadmap()` (line 344) first tries to parse the roadmap node summary as JSON with a `chapters` array. Since `entry/roadmap` is markdown, `parseSummary()` fails to extract `{ chapters: [...] }`.

It then falls through to node discovery (line 357-398) which scans ALL feature nodes belonging to the initiative. This discovers:
- Chapters 1, 2, 3 (parent_id = `entry`)
- Chapter 4 (parent_id = `entry/roadmap`, starts with `entry/`)
- Chapter 8 (orphaned `chapter-1-daily-breakdown-enhancement` node with name `chapter-8-daily-breakdown-enhancement`, healed into initiative by `healOrphanedChapters()`)

For chapters 1-3, the markdown summaries don't have a parseable `status` field, so they default to "planned". This is why ALL chapters (including truly-complete 1 and 2) appear in "Future:".

**Files**: `src/commands/progress.ts:344-399` (findRoadmap), `src/commands/progress.ts:237-303` (parseSummary)

**Fix**: Two options:
- A) Update `entry/roadmap` to store JSON summary with chapters array (fixes parsing, consistent with other initiatives)
- B) Enhance `parseSummaryRegex` to extract status from markdown tables (fragile, not recommended)

### Bug 3: `findRecentSummaries()` doesn't filter by initiative (affects `fuska progress`)

`progress.ts:534-548` — `findRecentSummaries(3)` searches ALL nodes globally for names containing `-summary`. The "Done:" section shows summaries from the `main` initiative (chapters 2 and 3 from `main/roadmap`) rather than from `entry`:

```
Done:
* Chapter 2.1: Created requirements.txt with yfinance>=0.2.0 and pandas>=2.0.0  ← main initiative
* Chapter 2.2: Created fetch_index_data()...  ← main initiative
* Chapter 3.1: Created src/indicators/ package...  ← main initiative
```

**Fix**: Filter `findRecentSummaries()` to only include summaries whose parent chain leads to the current initiative.

### Secondary issue: `current_chapter: null` in state

The `entry/state` has `current_chapter: null` with `status: "chapter_complete"`. This means the last chapter was completed but no next chapter was set as current. Both systems handle this poorly:
- `/fuska` LLM infers chapter 3 as current from the roadmap
- `fuska progress` falls back to finding the first "incomplete" chapter (which is chapter 1 due to Bug 2)

The state also has an embedded `roadmap` JSON with accurate chapter statuses (1=complete, 2=complete, 3=pending), but `findState()` only extracts `StateData` fields and ignores this embedded roadmap.

## Database state summary

| Node | Status in DB | `/fuska` sees | `progress` sees |
|------|-------------|---------------|-----------------|
| Chapter 1 | complete (roadmap text) | complete | planned (unparseable) |
| Chapter 2 | complete (roadmap text) | complete | planned (unparseable) |
| Chapter 3 | has plan+summary | CHAPTER_DONE | planned (unparseable) |
| Chapter 4 | JSON status: planned | not visible | planned |
| Chapter 8 | orphaned node | not visible | planned (healed in) |

## Recommended fix plan

### Step 1: Fix the data — update `entry/roadmap` to JSON format
Use `megamemory:update_concept` to rewrite `entry/roadmap` summary as proper JSON with all chapters and correct statuses. This fixes both `/fuska` (LLM will see all chapters) and `fuska progress` (JSON will parse correctly).

### Step 2: Fix `entry/state` to set current_chapter
Set `current_chapter` to the correct next chapter slug (likely `chapter-3-learning-feedback` since it's not truly complete, or `chapter-1-daily-price-breakdown` if that's where work is happening).

### Step 3: Fix `findRecentSummaries()` to scope by initiative
In `progress.ts:534-548`, filter summaries by checking parent chain against `this.currentInitiativeId`.

### Step 4: Decide on orphan chapter 8
The node `chapter-1-daily-breakdown-enhancement` (name: `chapter-8-daily-breakdown-enhancement`) appears to be from a separate ad-hoc task that was incorrectly given a `chapter-N` name. Either:
- Rename it to not look like a chapter
- Or properly integrate it into the roadmap

## Verification
After fixes:
1. Run `fuska progress` — should show correct chapter statuses matching the actual roadmap
2. Run `/fuska` — should show the correct current position (not MILESTONE_DONE)
3. Both should agree on which chapter is current and how many are complete
