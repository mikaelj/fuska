# Fix Initiative Scoping in `/fuska` Command

## Executive Summary

**Root causes** (from analysis):
1. Stale markdown roadmap summary (3 chapters) doesn't match child nodes (4 chapters)
2. `fuska progress` can't parse markdown, falls back to discovery
3. `findRecentSummaries()` shows summaries from wrong initiative
4. `/fuska` doesn't specify roadmap parsing strategy

**Solution:** Three-phase approach
- **Phase 1**: Fix data (convert to JSON, update state)
- **Phase 2**: Fix code (scope queries, specify parsing)
- **Phase 3**: Add migration tool (prevent future issues)

---

## Phase 1: Data Fixes (Immediate)

### 1.1 Fix `entry/roadmap` Summary

**Action:** Convert from markdown to JSON with all 4 chapters

**SQL query** (or via megamemory CLI):
```sql
UPDATE nodes 
SET summary = '{
  "name": "Entry Initiative Roadmap",
  "total_chapters": 4,
  "chapters": [
    {
      "number": 1,
      "slug": "chapter-1-daily-price-breakdown",
      "name": "Daily Price Breakdown",
      "status": "complete",
      "goal": "Users can see granular day-by-day price progression during each historical dip"
    },
    {
      "number": 2,
      "slug": "chapter-2-optimal-entry-detection",
      "name": "Optimal Entry Detection",
      "status": "complete",
      "goal": "Algorithm identifies the best entry point during each dip using multiple confirming TA signals"
    },
    {
      "number": 3,
      "slug": "chapter-3-learning-feedback",
      "name": "Learning Feedback",
      "status": "pending",
      "goal": "System learns from discrepancies between algorithm-suggested entry points and actual bottoms"
    },
    {
      "number": 4,
      "slug": "chapter-4-ml-entry-model-training",
      "name": "ML Entry Model Training",
      "status": "pending",
      "goal": "Build production-ready entry predictor"
    }
  ],
  "created": "2026-03-04",
  "updated": "2026-03-05"
}',
updated_at = datetime('now')
WHERE id = 'entry/roadmap';
```

### 1.2 Fix `entry/state` Current Chapter

**Action:** Set `current_chapter` to correct value

**Analysis needed:** Determine if chapter 3 is truly complete
- Check if `chapter-3-learning-feedback-plan-01-summary` exists
- If yes: set `current_chapter` to `chapter-4-ml-entry-model-training`
- If no: set `current_chapter` to `chapter-3-learning-feedback`

### 1.3 Handle Orphaned Chapter 8

**Action:** Rename to task format

```sql
UPDATE nodes 
SET name = 'task-daily-breakdown-enhancement',
    parent_id = NULL
WHERE name = 'chapter-8-daily-breakdown-enhancement';

-- Remove chapter-8 from any roadmap edges
DELETE FROM edges 
WHERE from_id = (SELECT id FROM nodes WHERE name = 'task-daily-breakdown-enhancement')
  AND relation = 'part_of';
```

---

## Phase 2: Code Fixes (Systematic)

### 2.1 Create Reference Document

**File:** `provider/opinkode/fuska/references/initiative-scoped-queries.md`

**Content:**

```markdown
# Initiative-Scoped MegaMemory Queries

## Problem

When multiple initiatives exist OR when roadmap summaries are stale/inconsistent:
1. Queries return wrong initiative's data (cross-pollution)
2. Summary doesn't match child nodes (stale data)
3. Markdown summaries can't be parsed as JSON

## Solution Pattern

Always use this 3-layer approach:

### Layer 1: Initiative Scoping

```
// Step 1: Get current initiative
const config = await megamemory.understand({ query: "config", top_k: 5 })
const configData = JSON.parse(config.concepts[0]?.summary)
const initiativeSlug = configData?.current_initiative

// Step 2: Get initiative root ID
const initiative = await megamemory.understand({ query: initiativeSlug, top_k: 10 })
const initiativeRoot = initiative.concepts.find(c => 
  c.name === initiativeSlug && c.parent_id === null
)
const initiativeRootId = initiativeRoot?.id

// Step 3: Scope queries by parent_id
const stateQuery = await megamemory.understand({ query: "state", top_k: 10 })
const stateConcept = stateQuery.concepts.find(c => 
  c.name === 'state' && c.parent_id === initiativeRootId
)
```

### Layer 2: Dual-Path Roadmap Parsing

Always try BOTH JSON parsing AND node discovery:

```
let roadmapData = null
let chapters = []

// Path A: Try JSON parse
const roadmapQuery = await megamemory.understand({ query: "roadmap", top_k: 10 })
const roadmapConcept = roadmapQuery.concepts.find(c => 
  c.name === 'roadmap' && c.parent_id === initiativeRootId
)

if (roadmapConcept) {
  try {
    const data = JSON.parse(roadmapConcept.summary)
    if (data.chapters && Array.isArray(data.chapters)) {
      chapters = data.chapters
    }
  } catch {
    // Not JSON, continue to discovery
  }
}

// Path B: Discover from child nodes (ALWAYS run for verification)
const chapterQuery = await megamemory.understand({ query: "chapter-", top_k: 100 })
const discoveredChapters = chapterQuery.concepts
  .filter(c => 
    c.kind === 'feature' && 
    /^chapter-\d+/.test(c.name) &&
    !c.name.includes('-plan-') &&
    (c.parent_id === initiativeRootId || 
     c.parent_id?.startsWith(initiativeRootId + '/') ||
     c.edges?.some(e => e.to === initiativeRootId && e.relation === 'part_of'))
  )
  .map(c => {
    try {
      return JSON.parse(c.summary)
    } catch {
      return null
    }
  })
  .filter(c => c !== null)
  .sort((a, b) => a.number - b.number)

// Verification: Compare JSON vs discovered
if (chapters.length > 0 && discoveredChapters.length > 0) {
  if (chapters.length !== discoveredChapters.length) {
    console.warn(`⚠️  Roadmap summary has ${chapters.length} chapters but ${discoveredChapters.length} exist as nodes`)
    console.warn(`   Using discovered nodes (more accurate)`)
    chapters = discoveredChapters
  }
} else if (discoveredChapters.length > 0) {
  chapters = discoveredChapters
}

// Final data
const totalChapters = chapters.length
const completedChapters = chapters.filter(c => c.status === 'complete').length
```

### Layer 3: Cross-Initiative Validation

```
// Warn if multiple state nodes exist
const allStates = stateQuery.concepts.filter(c => c.name === 'state')
if (allStates.length > 1) {
  const initiatives = allStates.map(s => {
    const parent = nodes.find(n => n.id === s.parent_id)
    return parent?.name || 'unknown'
  })
  console.warn(`⚠️  Multiple initiatives detected: ${initiatives.join(', ')}`)
  console.warn(`   Using initiative: ${initiativeSlug}`)
}

// Warn if roadmap is stale
if (chapters.length > 0 && roadmapConcept) {
  try {
    const data = JSON.parse(roadmapConcept.summary)
    if (data.chapters && data.chapters.length !== chapters.length) {
      console.warn(`⚠️  Roadmap summary is stale. Run: fuska migrate-roadmap`)
    }
  } catch {}
}
```

## Common Patterns

### Load State
```typescript
async function loadInitiativeState() {
  const config = await megamemory.understand({ query: "config", top_k: 5 })
  const configData = JSON.parse(config.concepts[0]?.summary)
  const initiativeSlug = configData?.current_initiative
  
  const initiative = await megamemory.understand({ query: initiativeSlug, top_k: 10 })
  const initiativeRoot = initiative.concepts.find(c => c.name === initiativeSlug && c.parent_id === null)
  
  const stateQuery = await megamemory.understand({ query: "state", top_k: 10 })
  const stateConcept = stateQuery.concepts.find(c => c.name === 'state' && c.parent_id === initiativeRoot.id)
  
  return stateConcept ? JSON.parse(stateConcept.summary) : null
}
```

### Load Recent Summaries (Scoped)
```typescript
function findRecentSummaries(limit: number = 3, initiativeId: string, nodes: Node[]) {
  return nodes
    .filter(n => {
      if (!n.name.includes('-summary')) return false
      
      // Walk parent chain to find initiative
      let current = n
      let depth = 0
      while (current && depth < 10) {
        if (current.parent_id === initiativeId) return true
        current = nodes.find(node => node.id === current.parent_id)
        depth++
      }
      return false
    })
    .slice(0, limit)
}
```
```

### 2.2 Update fuska.md Command

**File:** `provider/opinkode/commands/fuska/fuska.md`

**Changes:**

1. **Add to execution_context:**
```markdown
@../../fuska/references/initiative-scoped-queries.md
```

2. **Replace Step 1.2 (lines 105-122) with:**

```markdown
### 1.2 Load project state

Load config and determine current initiative:

```
megamemory:understand({ query: "config", top_k: 5 })

const configData = JSON.parse(configResponse.concepts[0]?.summary)
const currentInitiativeSlug = configData?.current_initiative

If not found, use first root from step 1.1
```

Find initiative root ID:
```
megamemory:understand({ query: currentInitiativeSlug, top_k: 10 })

const initiativeRoot = results.concepts.find(c => 
  c.name === currentInitiativeSlug && c.parent_id === null
)

const initiativeRootId = initiativeRoot?.id

If not found → display error, stop
```

Load state scoped to initiative:
```
megamemory:understand({ query: "state", top_k: 10 })

const stateConcept = results.concepts.find(c => 
  c.name === 'state' && c.parent_id === initiativeRootId
)

const stateData = stateConcept ? JSON.parse(stateConcept.summary) : null

Validation:
const allStates = results.concepts.filter(c => c.name === 'state')
if (allStates.length > 1) {
  Display: "⚠️  Multiple initiatives detected. Using: ${currentInitiativeSlug}"
}
```

Load roadmap with dual-path parsing:
```
megamemory:understand({ query: "roadmap", top_k: 10 })

const roadmapConcept = results.concepts.find(c => 
  (c.name === 'roadmap' || c.name.toLowerCase().includes('roadmap')) && 
  c.parent_id === initiativeRootId
)

let chapters = []
let totalChapters = 0
let completedChapters = 0

// Path A: Try JSON parse
if (roadmapConcept) {
  try {
    const data = JSON.parse(roadmapConcept.summary)
    if (data.chapters && Array.isArray(data.chapters)) {
      chapters = data.chapters
    }
  } catch {
    // Not JSON, will use discovery
  }
}

// Path B: Discover from nodes (ALWAYS run)
megamemory:understand({ query: "chapter-", top_k: 100 })

const discoveredChapters = results.concepts
  .filter(c => 
    c.kind === 'feature' && 
    /^chapter-\d+/.test(c.name) &&
    !c.name.includes('-plan-') &&
    (c.parent_id === initiativeRootId || 
     c.parent_id?.startsWith(initiativeRootId + '/'))
  )
  .map(c => {
    try {
      return JSON.parse(c.summary)
    } catch {
      return null
    }
  })
  .filter(c => c !== null)
  .sort((a, b) => a.number - b.number)

// Use discovered if mismatch or empty
if (chapters.length === 0 || chapters.length !== discoveredChapters.length) {
  if (chapters.length !== discoveredChapters.length) {
    Display: "⚠️  Roadmap summary has ${chapters.length} chapters but ${discoveredChapters.length} exist as nodes. Using discovered."
  }
  chapters = discoveredChapters
}

totalChapters = chapters.length
completedChapters = chapters.filter(c => c.status === 'complete').length

const roadmapData = { chapters, total_chapters: totalChapters }
```

**If no state or no chapters found** → state is `INIT_ONLY`.
```

### 2.3 Fix progress.ts

**File:** `src/commands/progress.ts`

**Change 1:** Scope `findRecentSummaries()` (line 534)

```typescript
private findRecentSummaries(limit: number = 3): Array<{ name: string; data: SummaryData }> {
  return this.nodes
    .filter(n => {
      if (!n.name.includes('-summary')) return false
      
      // NEW: Filter by initiative via parent chain
      let current: TodoNode | undefined = n
      let depth = 0
      while (current && depth < 10) {
        if (current.parent_id === this.currentInitiativeId) return true
        current = this.nodeMap.get(current.parent_id || '')
        depth++
      }
      return false
    })
    .map(n => {
      const data = this.parseSummary<SummaryData>(n.summary)
      return data ? { name: n.name, data } : null
    })
    .filter((s): s is { name: string; data: SummaryData } => s !== null)
    .sort((a, b) => {
      const dateA = new Date(a.data.completed || 0).getTime()
      const dateB = new Date(b.data.completed || 0).getTime()
      return dateB - dateA
    })
    .slice(0, limit)
}
```

**Change 2:** Add dual-path verification to `findRoadmap()` (line 344)

```typescript
private findRoadmap(): RoadmapData | null {
  const roadmapNode = this.nodes.find(n => 
    (n.name === 'roadmap' || n.name.toLowerCase().includes('roadmap')) && 
    n.parent_id === this.currentInitiativeId
  );
  
  let parsedChapters: ChapterData[] | null = null;
  
  // Try JSON parse first
  if (roadmapNode) {
    const parsed = this.parseSummary<RoadmapData>(roadmapNode.summary);
    if (parsed?.chapters && parsed.chapters.length > 0) {
      parsedChapters = parsed.chapters;
    }
  }
  
  // Always discover nodes
  const chapters: ChapterData[] = [];
  const discoveredIds = new Set<string>();
  
  for (const node of this.nodes) {
    if (node.kind !== 'feature') continue;
    
    const belongsToInitiative = node.parent_id === this.currentInitiativeId ||
      node.parent_id?.startsWith(this.currentInitiativeId + '/') ||
      this.edges.some(e => e.from_id === node.id && e.to_id === this.currentInitiativeId && e.relation === 'part_of');
    
    if (!belongsToInitiative) continue;
    
    const isChapter = /^chapter-\d+(-|$|\/)/.test(node.name) && !node.name.includes('-plan-');
    if (!isChapter) continue;
    
    if (discoveredIds.has(node.id)) continue;
    discoveredIds.add(node.id);
    
    const chapterData = this.parseSummary<ChapterData>(node.summary);
    if (chapterData) {
      chapters.push(chapterData);
    } else {
      const numMatch = node.name.match(/chapter-(\d+)/);
      if (numMatch) {
        chapters.push({
          number: parseInt(numMatch[1], 10),
          slug: node.name,
          name: node.name,
          goal: '',
          status: 'planned'
        });
      }
    }
  }
  
  chapters.sort((a, b) => a.number - b.number);
  
  // NEW: Verify consistency
  if (parsedChapters && parsedChapters.length !== chapters.length) {
    console.warn(`⚠️  Roadmap summary has ${parsedChapters.length} chapters but ${chapters.length} exist as nodes`);
    console.warn(`   Using discovered nodes for accuracy`);
  }
  
  if (chapters.length > 0) {
    return { chapters, current_milestone: '' };
  }
  
  return null;
}
```

### 2.4 Update Other Commands (15 remaining)

**Pattern:** For each command that queries `state` or `roadmap`:
1. Add `@../../fuska/references/initiative-scoped-queries.md` to execution_context
2. Replace direct queries with initiative-scoped pattern
3. Add dual-path roadmap parsing
4. Add validation warnings

**Commands to update (priority order):**
1. **High priority** (execution flow):
   - fuska-build.md
   - fuska-design.md
   - fuska-research-chapter.md
   - fuska-review.md
   
2. **Medium priority** (chapter management):
   - fuska-add-chapter.md
   - fuska-insert-chapter.md
   - fuska-remove-chapter.md
   
3. **Lower priority** (utilities):
   - fuska-check-todos.md
   - fuska-code-review.md
   - fuska-complete.md
   - fuska-export-md.md
   - fuska-help.md
   - fuska-map-codebase.md
   - fuska-new-milestone.md
   - fuska-plan-milestone-fixes.md

---

## Phase 3: Migration Tool (Preventive)

### 3.1 Create Migration Command

**File:** `provider/opinkode/commands/fuska/fuska-migrate-roadmap.md`

```markdown
---
name: fuska-migrate-roadmap
description: Convert markdown roadmap summaries to JSON and sync with child nodes
tools:
  - megamemory:understand
  - megamemory:update_concept
  - megamemory:list_roots
---

<objective>

Convert roadmap summaries from markdown to JSON format and ensure they accurately 
reflect all child chapter nodes. This fixes inconsistencies and enables proper 
parsing by both `/fuska` and `fuska progress` commands.

</objective>

<process>

## 1. Load current initiative

```
megamemory:list_roots()
megamemory:understand({ query: "config", top_k: 5 })

const configData = JSON.parse(configResponse.concepts[0]?.summary)
const initiativeSlug = configData?.current_initiative

const initiative = await megamemory.understand({ query: initiativeSlug, top_k: 10 })
const initiativeRoot = initiative.concepts.find(c => c.name === initiativeSlug && c.parent_id === null)
const initiativeRootId = initiativeRoot.id
```

## 2. Load roadmap node

```
megamemory:understand({ query: "roadmap", top_k: 10 })

const roadmapConcept = results.concepts.find(c => 
  c.name === 'roadmap' && c.parent_id === initiativeRootId
)

If not found → display "No roadmap found", stop
```

## 3. Discover all chapter nodes

```
megamemory:understand({ query: "chapter-", top_k: 100 })

const chapters = results.concepts
  .filter(c => 
    c.kind === 'feature' && 
    /^chapter-\d+/.test(c.name) &&
    !c.name.includes('-plan-') &&
    (c.parent_id === initiativeRootId || 
     c.parent_id?.startsWith(initiativeRootId + '/'))
  )
  .map(c => JSON.parse(c.summary))
  .sort((a, b) => a.number - b.number)

Display: "Discovered ${chapters.length} chapters"
```

## 4. Check current format

```
let currentFormat = 'unknown'
let existingChapters = []

try {
  const data = JSON.parse(roadmapConcept.summary)
  if (data.chapters && Array.isArray(data.chapters)) {
    currentFormat = 'json'
    existingChapters = data.chapters
  }
} catch {
  currentFormat = 'markdown'
}

Display: "Current format: ${currentFormat}"
Display: "Existing chapters in summary: ${existingChapters.length}"
```

## 5. Compare and update

```
if (existingChapters.length === chapters.length) {
  const allMatch = chapters.every((discovered, i) => {
    const existing = existingChapters.find(e => e.number === discovered.number)
    return existing && existing.status === discovered.status
  })
  
  if (allMatch) {
    Display: "✓ Roadmap is already up-to-date"
    Stop
  }
}

Display: "Updating roadmap summary..."

const newSummary = JSON.stringify({
  name: `${initiativeSlug} Roadmap`,
  total_chapters: chapters.length,
  chapters: chapters.map(c => ({
    number: c.number,
    slug: c.slug,
    name: c.name,
    status: c.status,
    goal: c.goal
  })),
  created: roadmapConcept.created_at || new Date().toISOString(),
  updated: new Date().toISOString()
}, null, 2)

megamemory:update_concept({
  id: roadmapConcept.id,
  changes: { summary: newSummary }
})

Display: "✓ Updated roadmap with ${chapters.length} chapters"
```

## 6. Update state if needed

```
megamemory:understand({ query: "state", top_k: 10 })

const stateConcept = results.concepts.find(c => 
  c.name === 'state' && c.parent_id === initiativeRootId
)

if (stateConcept) {
  const stateData = JSON.parse(stateConcept.summary)
  
  // Find next incomplete chapter
  const nextChapter = chapters.find(c => c.status !== 'complete')
  
  if (nextChapter && stateData.current_chapter !== nextChapter.slug) {
    Display: "Updating current_chapter to ${nextChapter.slug}"
    
    const newState = JSON.stringify({
      ...stateData,
      current_chapter: nextChapter.slug,
      roadmap: {
        total_chapters: chapters.length,
        completed_chapters: chapters.filter(c => c.status === 'complete').length
      },
      last_activity: new Date().toISOString()
    })
    
    megamemory:update_concept({
      id: stateConcept.id,
      changes: { summary: newState }
    })
    
    Display: "✓ State updated"
  }
}
```

</process>

<success_criteria>

- [ ] Roadmap summary converted to JSON format
- [ ] All child chapter nodes included in summary
- [ ] Chapter statuses match between summary and nodes
- [ ] State current_chapter set to next incomplete chapter
- [ ] Both `/fuska` and `fuska progress` show consistent results

</success_criteria>
```

### 3.2 Add to CLI

**File:** `src/commands/migrate-roadmap.ts`

Implement TypeScript version of the command logic following the pattern from `progress.ts`.

---

## Testing Plan

### Test 1: Data Migration

```bash
cd ~/code/stocks/main
fuska migrate-roadmap

# Verify
fuska progress  # Should show 4 chapters
/fuska          # Should show correct current chapter
```

### Test 2: Initiative Scoping

```bash
# Create second initiative for testing
cd ~/code/test-project
fuska init "Test Project"
# ... add chapters ...

# Switch back
cd ~/code/stocks/main
fuska progress  # Should only show 'entry' initiative summaries

# Switch initiative
fuska initiative switch main
fuska progress  # Should show 'main' initiative summaries
```

### Test 3: Dual-Path Parsing

```bash
# Test with JSON roadmap (should use it)
# Test with markdown roadmap (should discover nodes)
# Test with stale JSON (should warn and use discovered)
```

### Test 4: All Commands

Run each of the 16 commands in multi-initiative environment to verify scoping:
- [ ] fuska (primary)
- [ ] fuska-add-chapter
- [ ] fuska-build
- [ ] fuska-check-todos
- [ ] fuska-code-review
- [ ] fuska-complete
- [ ] fuska-design
- [ ] fuska-export-md
- [ ] fuska-help
- [ ] fuska-insert-chapter
- [ ] fuska-map-codebase
- [ ] fuska-new-milestone
- [ ] fuska-plan-milestone-fixes
- [ ] fuska-remove-chapter
- [ ] fuska-research-chapter
- [ ] fuska-review

---

## Execution Order

1. **Fix data** (manual SQL or via migration command prototype)
   - Update `entry/roadmap` to JSON format
   - Set correct `current_chapter` in state
   - Rename orphaned chapter 8

2. **Create reference document** (`initiative-scoped-queries.md`)

3. **Update fuska.md** (primary command)

4. **Update progress.ts** (fix cross-initiative pollution)

5. **Create migration command** (prevent future issues)
   - Create `fuska-migrate-roadmap.md`
   - Implement `src/commands/migrate-roadmap.ts`

6. **Update remaining 15 commands** (batch by priority)
   - High priority: build, design, research, review
   - Medium priority: add/insert/remove chapter
   - Lower priority: utilities

7. **Test thoroughly** (all scenarios)

8. **Update documentation** 
   - Add multi-initiative section to `megamemory-integration.md`
   - Update CLAUDE.md in ~/code/stocks/main

---

## Success Criteria

- [ ] `/fuska` shows correct chapter count (4, not 3)
- [ ] `fuska progress` shows correct chapter statuses
- [ ] Both commands show same current chapter
- [ ] No cross-initiative pollution in summaries
- [ ] All 16 commands scope queries correctly
- [ ] Migration command successfully converts markdown → JSON
- [ ] Validation warnings appear when needed
- [ ] Tests pass in multi-initiative environment
- [ ] Documentation updated with multi-initiative best practices

---

## Risk Mitigation

**Risk:** Breaking existing commands in single-initiative environments

**Mitigation:** 
- Test in both single and multi-initiative databases
- The pattern works for both cases (parent_id filtering is safe when only one initiative exists)
- Validation warnings only appear when truly needed (multiple state nodes)

**Risk:** Inconsistent implementation across commands

**Mitigation:**
- Create reusable reference document first
- Follow same 3-step pattern in all commands
- Use dual-path parsing consistently

**Risk:** Data migration breaking existing initiatives

**Mitigation:**
- Test migration command thoroughly
- Keep backup of database before migration
- Migration only updates if mismatch detected

---

## Notes

**Why dual-path parsing (always try both JSON + discovery)?**
- Catches stale roadmap summaries immediately
- Works with both old (markdown) and new (JSON) formats
- Provides accurate data even when summary is out of sync
- Validates data consistency automatically

**Why filter by parent_id instead of query scoping?**
- MegaMemory uses semantic search, not graph queries
- Query like "entry roadmap" doesn't guarantee correct parent
- Filtering by `parent_id === initiativeRootId` is deterministic
- Works regardless of embedding similarity

**Why create migration command instead of auto-fixing?**
- Explicit is better than implicit
- User can review changes before committing
- Prevents unexpected data modifications
- Can be run on-demand when needed
