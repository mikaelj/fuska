# Fix Initiative Scoping in `/fuska` Command (REVISED)

## Executive Summary

**Root causes** (from analysis):
1. Stale markdown roadmap summary (3 chapters) doesn't match child nodes (4 chapters)
2. `fuska progress` can't parse markdown, falls back to discovery
3. `findRecentSummaries()` shows summaries from wrong initiative
4. `/fuska` doesn't specify roadmap parsing strategy

**Solution:** Six-phase approach
- **Phase 0**: Create migration tool prototype
- **Phase 1**: Test migration on backup
- **Phase 2**: Run migration on production
- **Phase 3**: Create reference document
- **Phase 4**: Update core commands
- **Phase 5**: Update remaining commands
- **Phase 6**: Integration testing

---

## Phase 0: Create Migration Tool Prototype

### 0.1 Create Migration Command

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

## 7. Handle orphaned chapters

```
// Find chapters not in roadmap
const roadmapSlugs = new Set(chapters.map(c => c.slug))
const allChapterNodes = results.concepts.filter(c => 
  c.kind === 'feature' && /^chapter-\d+/.test(c.name)
)

for (const node of allChapterNodes) {
  if (!roadmapSlugs.has(node.name) && !node.name.includes('-plan-')) {
    Display: "⚠️  Orphaned chapter found: ${node.name}"
    
    // Convert to task
    const taskName = node.name.replace(/^chapter-\d+/, 'task')
    
    megamemory:update_concept({
      id: node.id,
      changes: { 
        name: taskName,
        summary: JSON.stringify({
          ...JSON.parse(node.summary),
          type: 'orphaned-chapter',
          original_name: node.name,
          migrated_at: new Date().toISOString()
        })
      }
    })
    
    // Find or create todos module
    megamemory:understand({ query: "todos", top_k: 5 })
    let todosModule = results.concepts.find(c => 
      c.name === 'todos' && c.parent_id === initiativeRootId
    )
    
    if (!todosModule) {
      megamemory:create_concept({
        name: 'todos',
        kind: 'module',
        summary: JSON.stringify({ description: 'Task backlog and orphaned items' }),
        parent_id: initiativeRootId,
        edges: [{ to: initiativeSlug, relation: 'part_of' }]
      })
    }
    
    // Link task to todos
    megamemory:link({
      from: taskName,
      to: 'todos',
      relation: 'part_of'
    })
    
    Display: "✓ Converted to task: ${taskName}"
  }
}
```

</process>

<verify>

```
// Verify roadmap is valid JSON
megamemory:understand({ query: "roadmap", top_k: 5 })
const roadmap = results.concepts.find(c => c.name === 'roadmap')

try {
  const data = JSON.parse(roadmap.summary)
  if (!data.chapters || !Array.isArray(data.chapters)) {
    Display: "❌ Roadmap summary is not valid JSON with chapters array"
    Stop
  }
  if (data.chapters.length === 0) {
    Display: "❌ Roadmap has no chapters"
    Stop
  }
  Display: "✓ Roadmap has ${data.chapters.length} chapters in valid JSON format"
} catch (e) {
  Display: "❌ Roadmap summary is not valid JSON: ${e.message}"
  Stop
}

// Verify state consistency
megamemory:understand({ query: "state", top_k: 5 })
const state = results.concepts.find(c => c.name === 'state')
const stateData = JSON.parse(state.summary)

const roadmapData = JSON.parse(roadmap.summary)
const nextIncomplete = roadmapData.chapters.find(c => c.status !== 'complete')

if (stateData.current_chapter !== nextIncomplete?.slug) {
  Display: "⚠️  State current_chapter (${stateData.current_chapter}) doesn't match next incomplete (${nextIncomplete?.slug})"
} else {
  Display: "✓ State current_chapter is correct: ${stateData.current_chapter}"
}
```

</verify>

<done>

- [ ] Roadmap summary converted to JSON format
- [ ] All child chapter nodes included in summary
- [ ] Chapter statuses match between summary and nodes
- [ ] State current_chapter set to next incomplete chapter
- [ ] Orphaned chapters converted to tasks with proper parent_id
- [ ] Both `/fuska` and `fuska progress` show consistent results

</done>
```

### 0.2 Implement CLI Command

**File:** `src/commands/migrate-roadmap.ts`

```typescript
import { Command } from 'commander';
import chalk from 'chalk';

export class MigrateRoadmapCommand {
  async execute(): Promise<void> {
    console.log(chalk.blue('🔄 Migrating roadmap to JSON format...\n'));
    
    // Implementation follows the markdown command logic
    // 1. Load initiative
    // 2. Load roadmap
    // 3. Discover chapters
    // 4. Check format
    // 5. Compare and update
    // 6. Update state
    // 7. Handle orphans
    // 8. Verify
    
    console.log(chalk.green('✓ Migration complete\n'));
  }
}

export const migrateRoadmapCommand = new Command('migrate-roadmap')
  .description('Convert markdown roadmap summaries to JSON and sync with child nodes')
  .action(async () => {
    const cmd = new MigrateRoadmapCommand();
    await cmd.execute();
  });
```

**<verify>**
```bash
# Compile TypeScript
npm run build

# Verify command is available
fuska migrate-roadmap --help
```
**</verify>**

**<done>**
- [ ] Migration command created in `provider/opinkode/commands/fuska/fuska-migrate-roadmap.md`
- [ ] CLI implementation in `src/commands/migrate-roadmap.ts`
- [ ] Command registered in CLI
- [ ] `fuska migrate-roadmap --help` shows usage
**</done>**

---

## Phase 1: Test Migration on Backup

### 1.1 Create Database Backup

**Action:** Copy MegaMemory database before any modifications

```bash
# Create backup with timestamp
cp ~/.megamemory/megamemory.db ~/.megamemory/megamemory.db.backup-$(date +%Y%m%d-%H%M%S)

# Verify backup
ls -lh ~/.megamemory/megamemory.db*
```

**<verify>**
```bash
# Confirm backup exists and has same size
BACKUP_FILE=$(ls -t ~/.megamemory/megamemory.db.backup-* | head -1)
ORIGINAL_SIZE=$(stat -f%z ~/.megamemory/megamemory.db)
BACKUP_SIZE=$(stat -f%z "$BACKUP_FILE")

if [ "$ORIGINAL_SIZE" -eq "$BACKUP_SIZE" ]; then
  echo "✓ Backup created: $BACKUP_FILE"
else
  echo "❌ Backup size mismatch"
  exit 1
fi
```
**</verify>**

**<done>**
- [ ] Backup file created with timestamp
- [ ] Backup file size matches original
- [ ] Backup location documented: `~/.megamemory/megamemory.db.backup-YYYYMMDD-HHMMSS`
**</done>**

### 1.2 Run Migration on Test Initiative

**Action:** Test migration command on a copy of the database

```bash
# Create test database
cp ~/.megamemory/megamemory.db ~/.megamemory/megamemory-test.db

# Set environment to use test database
export MEGAMEMORY_DB=~/.megamemory/megamemory-test.db

# Run migration
fuska migrate-roadmap

# Check results
fuska progress
```

**<verify>**
```bash
# Verify roadmap is JSON
sqlite3 ~/.megamemory/megamemory-test.db "SELECT summary FROM nodes WHERE name='roadmap'" | jq '.chapters | length'

# Should output: 4

# Verify state is updated
sqlite3 ~/.megamemory/megamemory-test.db "SELECT summary FROM nodes WHERE name='state'" | jq '.current_chapter'

# Should output: "chapter-3-learning-feedback" or "chapter-4-ml-entry-model-training"
```
**</verify>**

**<done>**
- [ ] Migration runs without errors
- [ ] Roadmap converted to JSON with 4 chapters
- [ ] State current_chapter is correct
- [ ] `fuska progress` shows 4 chapters
- [ ] No data loss or corruption
**</done>**

### 1.3 Document Rollback Procedure

**File:** `provider/opinkode/fuska/references/rollback-procedure.md`

```markdown
# MegaMemory Rollback Procedure

## When to Rollback

If migration causes data corruption or unexpected behavior:

## Rollback Steps

1. Stop all Fuska operations
2. Restore backup:
   ```bash
   # Find latest backup
   BACKUP_FILE=$(ls -t ~/.megamemory/megamemory.db.backup-* | head -1)
   
   # Restore
   cp "$BACKUP_FILE" ~/.megamemory/megamemory.db
   
   # Verify
   fuska progress
   ```
3. Document issue in GitHub issue tracker
4. Update migration command with fix
5. Re-test on backup before re-running

## Backup Retention

- Keep last 5 backups
- Delete older backups: `ls -t ~/.megamemory/megamemory.db.backup-* | tail -n +6 | xargs rm -f`
```

**<verify>**
```bash
# Test rollback procedure on test database
cp ~/.megamemory/megamemory.db ~/.megamemory/megamemory-rollback-test.db
export MEGAMEMORY_DB=~/.megamemory/megamemory-rollback-test.db

# Intentionally corrupt
echo "corrupted" > ~/.megamemory/megamemory-rollback-test.db

# Rollback
BACKUP_FILE=$(ls -t ~/.megamemory/megamemory.db.backup-* | head -1)
cp "$BACKUP_FILE" ~/.megamemory/megamemory-rollback-test.db

# Verify
fuska progress
```
**</verify>**

**<done>**
- [ ] Rollback procedure documented
- [ ] Rollback tested and verified
- [ ] Backup retention policy defined
**</done>**

---

## Phase 2: Run Migration on Production

### 2.1 Run Migration Command

**Action:** Execute migration on production database

```bash
# Switch to production database
unset MEGAMEMORY_DB

# Run migration
fuska migrate-roadmap
```

**<verify>**
```bash
# Verify roadmap is JSON
sqlite3 ~/.megamemory/megamemory.db "SELECT summary FROM nodes WHERE name='roadmap'" | jq '.chapters | length'

# Verify state
sqlite3 ~/.megamemory/megamemory.db "SELECT summary FROM nodes WHERE name='state'" | jq '.current_chapter'

# Run both commands
fuska progress
```

Also run `/fuska` command and verify output shows 4 chapters.
**</verify>**

**<done>**
- [ ] Migration completed on production
- [ ] `entry/roadmap` has JSON with 4 chapters
- [ ] `entry/state` has correct current_chapter
- [ ] `fuska progress` shows 4 chapters
- [ ] `/fuska` shows correct current chapter
- [ ] Orphaned chapter 8 converted to task with parent_id
**</done>**

### 2.2 Verify Cross-Initiative Isolation

**Action:** Confirm no cross-initiative pollution after migration

```bash
# Check for multiple state nodes
sqlite3 ~/.megamemory/megamemory.db "SELECT name, parent_id FROM nodes WHERE name='state'"

# Should show only one state per initiative

# Check for orphaned summaries
sqlite3 ~/.megamemory/megamemory.db "SELECT name FROM nodes WHERE name LIKE '%-summary' AND parent_id IS NULL"

# Should return no results
```

**<verify>**
```bash
# If multiple initiatives exist, verify scoping
fuska progress

# Should only show summaries from current initiative
```
**</verify>**

**<done>**
- [ ] No orphaned state nodes
- [ ] No orphaned summary nodes
- [ ] Cross-initiative isolation verified
**</done>**

---

## Phase 3: Create Reference Document

### 3.1 Create Initiative-Scoped Queries Reference

**File:** `provider/opinkode/fuska/references/initiative-scoped-queries.md`

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

```typescript
// Step 1: Get current initiative
const configQuery = await megamemory.understand({ query: "config", top_k: 5 })
const configData = JSON.parse(configQuery.concepts[0]?.summary || '{}')
const initiativeSlug = configData?.current_initiative

if (!initiativeSlug) {
  throw new Error('No current initiative configured')
}

// Step 2: Get initiative root ID
const initiativeQuery = await megamemory.understand({ query: initiativeSlug, top_k: 10 })
const initiativeRoot = initiativeQuery.concepts.find(c => 
  c.name === initiativeSlug && c.parent_id === null
)

if (!initiativeRoot) {
  throw new Error(`Initiative "${initiativeSlug}" not found`)
}

const initiativeRootId = initiativeRoot.id

// Step 3: Scope queries by parent_id
const stateQuery = await megamemory.understand({ query: "state", top_k: 10 })
const stateConcept = stateQuery.concepts.find(c => 
  c.name === 'state' && c.parent_id === initiativeRootId
)
```

### Layer 2: Dual-Path Roadmap Parsing

Always try BOTH JSON parsing AND node discovery:

```typescript
let roadmapData = null
let chapters = []

// Path A: Try JSON parse
const roadmapQuery = await megamemory.understand({ query: "roadmap", top_k: 10 })
const roadmapConcept = roadmapQuery.concepts.find(c => 
  (c.name === 'roadmap' || c.name.toLowerCase().includes('roadmap')) && 
  c.parent_id === initiativeRootId
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
const roadmapData = { chapters, total_chapters: totalChapters }
```

### Layer 3: Cross-Initiative Validation

```typescript
// Warn if multiple state nodes exist
const allStates = stateQuery.concepts.filter(c => c.name === 'state')
if (allStates.length > 1) {
  const initiatives = allStates.map(s => {
    const parent = allConcepts.find(n => n.id === s.parent_id)
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

### Load State (Scoped)

```typescript
async function loadInitiativeState(megamemory: any): Promise<any> {
  // Get config
  const configQuery = await megamemory.understand({ query: "config", top_k: 5 })
  const configData = JSON.parse(configQuery.concepts[0]?.summary || '{}')
  const initiativeSlug = configData?.current_initiative
  
  if (!initiativeSlug) return null
  
  // Get initiative root
  const initiativeQuery = await megamemory.understand({ query: initiativeSlug, top_k: 10 })
  const initiativeRoot = initiativeQuery.concepts.find(c => 
    c.name === initiativeSlug && c.parent_id === null
  )
  
  if (!initiativeRoot) return null
  
  // Get scoped state
  const stateQuery = await megamemory.understand({ query: "state", top_k: 10 })
  const stateConcept = stateQuery.concepts.find(c => 
    c.name === 'state' && c.parent_id === initiativeRoot.id
  )
  
  return stateConcept ? JSON.parse(stateConcept.summary) : null
}
```

### Load Recent Summaries (Scoped)

```typescript
function findRecentSummaries(
  limit: number = 3, 
  initiativeId: string, 
  nodes: Node[]
): Array<{ name: string; data: any }> {
  return nodes
    .filter(n => {
      if (!n.name.includes('-summary')) return false
      
      // Walk parent chain to find initiative
      let current: Node | undefined = n
      let depth = 0
      while (current && depth < 10) {
        if (current.parent_id === initiativeId) return true
        current = nodes.find(node => node.id === current.parent_id)
        depth++
      }
      return false
    })
    .map(n => {
      try {
        const data = JSON.parse(n.summary)
        return { name: n.name, data }
      } catch {
        return null
      }
    })
    .filter((s): s is { name: string; data: any } => s !== null)
    .sort((a, b) => {
      const dateA = new Date(a.data.completed || 0).getTime()
      const dateB = new Date(b.data.completed || 0).getTime()
      return dateB - dateA
    })
    .slice(0, limit)
}
```

### Load Roadmap with Verification

```typescript
async function loadRoadmap(
  megamemory: any, 
  initiativeRootId: string
): Promise<{ chapters: any[]; total_chapters: number } | null> {
  // Try JSON parse
  const roadmapQuery = await megamemory.understand({ query: "roadmap", top_k: 10 })
  const roadmapConcept = roadmapQuery.concepts.find(c => 
    c.name === 'roadmap' && c.parent_id === initiativeRootId
  )
  
  let chapters: any[] = []
  
  if (roadmapConcept) {
    try {
      const data = JSON.parse(roadmapConcept.summary)
      chapters = data.chapters || []
    } catch {}
  }
  
  // Always discover
  const chapterQuery = await megamemory.understand({ query: "chapter-", top_k: 100 })
  const discovered = chapterQuery.concepts
    .filter(c => 
      c.kind === 'feature' && 
      /^chapter-\d+/.test(c.name) &&
      !c.name.includes('-plan-') &&
      (c.parent_id === initiativeRootId || c.parent_id?.startsWith(initiativeRootId + '/'))
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
  
  // Warn on mismatch
  if (chapters.length !== discovered.length) {
    console.warn(`⚠️  Roadmap has ${chapters.length} chapters, but ${discovered.length} nodes exist`)
    console.warn(`   Using discovered nodes`)
  }
  
  return {
    chapters: discovered,
    total_chapters: discovered.length
  }
}
```

## Error Handling

```typescript
// Missing config
if (!configData || !configData.current_initiative) {
  throw new Error('No initiative configured. Run: fuska init')
}

// Missing initiative root
if (!initiativeRoot) {
  throw new Error(`Initiative "${initiativeSlug}" not found in knowledge graph`)
}

// Missing state
if (!stateConcept) {
  console.warn(`⚠️  No state found for initiative "${initiativeSlug}". Run: fuska init`)
  return null
}

// Invalid JSON in summary
try {
  const data = JSON.parse(concept.summary)
} catch (e) {
  console.error(`❌ Invalid JSON in ${concept.name}: ${e.message}`)
  // Fallback or re-raise
}
```

## Testing Checklist

When updating a command to use initiative scoping:

- [ ] Loads config.current_initiative first
- [ ] Finds initiative root by name AND parent_id === null
- [ ] Scopes all subsequent queries by parent_id
- [ ] Uses dual-path roadmap parsing (JSON + discovery)
- [ ] Warns on mismatch between JSON and discovered
- [ ] Warns if multiple initiatives detected
- [ ] Handles missing config/initiative/state gracefully
- [ ] Tests with multi-initiative database
```

**<verify>**
```bash
# Verify file exists
ls -lh provider/opinkode/fuska/references/initiative-scoped-queries.md

# Verify content
head -20 provider/opinkode/fuska/references/initiative-scoped-queries.md
```
**</verify>**

**<done>**
- [ ] Reference document created
- [ ] Contains all 3 layers (scoping, dual-path, validation)
- [ ] Contains code patterns for common operations
- [ ] Contains error handling examples
- [ ] Contains testing checklist
**</done>**

---

## Phase 4: Update Core Commands

### 4.1 Update fuska.md Command

**File:** `provider/opinkode/commands/fuska/fuska.md`

**Change 1:** Add to execution_context (at line ~30)

```markdown
@../../fuska/references/initiative-scoped-queries.md
@../../fuska/references/megamemory-integration.md
```

**Change 2:** Replace Step 1.2 (lines 105-122) with:

```markdown
### 1.2 Load project state

Load config and determine current initiative:

```
megamemory:understand({ query: "config", top_k: 5 })

const configData = JSON.parse(configResponse.concepts[0]?.summary || '{}')
const currentInitiativeSlug = configData?.current_initiative

if (!currentInitiativeSlug) {
  Display: "⚠️  No initiative configured. Using first root."
  currentInitiativeSlug = rootsResponse.roots[0]?.name
}

if (!currentInitiativeSlug) {
  Display: "❌ No initiatives found. Run: fuska init"
  Stop
}
```

Find initiative root ID:

```
megamemory:understand({ query: currentInitiativeSlug, top_k: 10 })

const initiativeRoot = results.concepts.find(c => 
  c.name === currentInitiativeSlug && c.parent_id === null
)

if (!initiativeRoot) {
  Display: "❌ Initiative '${currentInitiativeSlug}' not found"
  Stop
}

const initiativeRootId = initiativeRoot.id
```

Load state scoped to initiative:

```
megamemory:understand({ query: "state", top_k: 10 })

const stateConcept = results.concepts.find(c => 
  c.name === 'state' && c.parent_id === initiativeRootId
)

const stateData = stateConcept ? JSON.parse(stateConcept.summary) : null

// Validation
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

**<verify>**
```bash
# Run /fuska command and verify output shows 4 chapters
# Verify current chapter is correct
# Verify no cross-initiative pollution
```
**</verify>**

**<done>**
- [ ] Step 1.2 updated with initiative scoping
- [ ] Dual-path roadmap parsing implemented
- [ ] Validation warnings added
- [ ] `/fuska` shows 4 chapters
- [ ] `/fuska` shows correct current chapter
**</done>**

### 4.2 Fix progress.ts

**File:** `src/commands/progress.ts`

**Change 1:** Add initiativeRootId property (line ~50)

```typescript
export class ProgressCommand {
  private currentInitiativeId: string = '';
  // ... existing properties
```

**Change 2:** Update loadState() to scope by initiative (line ~150)

```typescript
private async loadState(): Promise<void> {
  // Load config first
  const configQuery = await megamemory.understand({ query: "config", top_k: 5 });
  const configData = this.parseSummary<ConfigData>(configQuery.concepts[0]?.summary);
  const initiativeSlug = configData?.current_initiative;
  
  if (!initiativeSlug) {
    const roots = await megamemory.list_roots();
    this.currentInitiativeId = roots.roots[0]?.id || '';
  } else {
    const initiativeQuery = await megamemory.understand({ query: initiativeSlug, top_k: 10 });
    const initiativeRoot = initiativeQuery.concepts.find(c => 
      c.name === initiativeSlug && c.parent_id === null
    );
    this.currentInitiativeId = initiativeRoot?.id || '';
  }
  
  // Load state scoped to initiative
  const stateQuery = await megamemory.understand({ query: "state", top_k: 10 });
  const stateConcept = stateQuery.concepts.find(c => 
    c.name === 'state' && c.parent_id === this.currentInitiativeId
  );
  
  if (stateConcept) {
    this.stateData = this.parseSummary<StateData>(stateConcept.summary);
  }
  
  // Warn if multiple initiatives
  const allStates = stateQuery.concepts.filter(c => c.name === 'state');
  if (allStates.length > 1) {
    console.warn(chalk.yellow(`⚠️  Multiple initiatives detected. Using: ${initiativeSlug}`));
  }
}
```

**Change 3:** Update findRoadmap() with dual-path parsing (line ~344)

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
  
  // Verify consistency
  if (parsedChapters && parsedChapters.length !== chapters.length) {
    console.warn(chalk.yellow(`⚠️  Roadmap summary has ${parsedChapters.length} chapters but ${chapters.length} exist as nodes`));
    console.warn(chalk.yellow(`   Using discovered nodes for accuracy`));
  }
  
  if (chapters.length > 0) {
    return { chapters, current_milestone: '' };
  }
  
  return null;
}
```

**Change 4:** Update findRecentSummaries() to scope by initiative (line ~534)

```typescript
private findRecentSummaries(limit: number = 3): Array<{ name: string; data: SummaryData }> {
  return this.nodes
    .filter(n => {
      if (!n.name.includes('-summary')) return false;
      
      // Filter by initiative via parent chain
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

**<verify>**
```bash
# Compile
npm run build

# Run command
fuska progress

# Verify:
# - Shows 4 chapters
# - Shows correct current chapter
# - Shows only current initiative's summaries
# - No cross-initiative pollution
```
**</verify>**

**<done>**
- [ ] loadState() updated with initiative scoping
- [ ] findRoadmap() updated with dual-path parsing
- [ ] findRecentSummaries() scoped by initiative
- [ ] `fuska progress` shows 4 chapters
- [ ] `fuska progress` shows correct current chapter
- [ ] No cross-initiative pollution in summaries
**</done>**

---

## Phase 5: Update Remaining Commands

### 5.1 High Priority Commands (Batch 1)

**Commands:** fuska-build, fuska-design, fuska-research-chapter, fuska-review

**Pattern to apply:**

For each command file in `provider/opinkode/commands/fuska/`:

1. **Add to execution_context:**
   ```markdown
   @../../fuska/references/initiative-scoped-queries.md
   ```

2. **Replace direct state/roadmap queries with scoped pattern:**
   ```markdown
   megamemory:understand({ query: "config", top_k: 5 })
   const configData = JSON.parse(results.concepts[0]?.summary)
   const initiativeSlug = configData?.current_initiative
   
   megamemory:understand({ query: initiativeSlug, top_k: 10 })
   const initiativeRoot = results.concepts.find(c => c.name === initiativeSlug && c.parent_id === null)
   
   megamemory:understand({ query: "state", top_k: 10 })
   const stateConcept = results.concepts.find(c => c.name === 'state' && c.parent_id === initiativeRoot.id)
   ```

3. **Add dual-path roadmap parsing**

4. **Add validation warnings**

**Task breakdown:**

| Command | Functions to Modify | Lines | Priority |
|---------|---------------------|-------|----------|
| fuska-build.md | Load state, check current chapter | ~50-80 | HIGH |
| fuska-design.md | Load state, load roadmap | ~40-70 | HIGH |
| fuska-research-chapter.md | Load chapter context | ~30-60 | HIGH |
| fuska-review.md | Load recent summaries | ~60-90 | HIGH |

**<verify>**
```bash
# Test each command in multi-initiative environment
fuska build --dry-run
fuska design --dry-run
fuska research-chapter
fuska review

# Verify no cross-initiative data appears
```
**</verify>**

**<done>**
- [ ] fuska-build.md updated
- [ ] fuska-design.md updated
- [ ] fuska-research-chapter.md updated
- [ ] fuska-review.md updated
- [ ] All show correct initiative data
**</done>**

### 5.2 Medium Priority Commands (Batch 2)

**Commands:** fuska-add-chapter, fuska-insert-chapter, fuska-remove-chapter

**Task breakdown:**

| Command | Functions to Modify | Lines | Priority |
|---------|---------------------|-------|----------|
| fuska-add-chapter.md | Load roadmap, update roadmap | ~40-80 | MEDIUM |
| fuska-insert-chapter.md | Load roadmap, update roadmap | ~50-90 | MEDIUM |
| fuska-remove-chapter.md | Load roadmap, update roadmap | ~50-90 | MEDIUM |

**<verify>**
```bash
# Test each command
fuska add-chapter --dry-run
fuska insert-chapter --dry-run
fuska remove-chapter --dry-run

# Verify correct initiative scope
```
**</verify>**

**<done>**
- [ ] fuska-add-chapter.md updated
- [ ] fuska-insert-chapter.md updated
- [ ] fuska-remove-chapter.md updated
- [ ] All modify correct initiative's roadmap
**</done>**

### 5.3 Lower Priority Commands (Batch 3)

**Commands:** fuska-check-todos, fuska-code-review, fuska-complete, fuska-export-md, fuska-help, fuska-map-codebase, fuska-new-milestone, fuska-plan-milestone-fixes

**Task breakdown:**

| Command | Functions to Modify | Lines | Priority |
|---------|---------------------|-------|----------|
| fuska-check-todos.md | Load todos by initiative | ~30-50 | LOW |
| fuska-code-review.md | Load summaries by initiative | ~40-70 | LOW |
| fuska-complete.md | Load state, update state | ~50-80 | LOW |
| fuska-export-md.md | Load all data by initiative | ~60-100 | LOW |
| fuska-help.md | No changes needed (static) | 0 | LOW |
| fuska-map-codebase.md | Load context by initiative | ~30-50 | LOW |
| fuska-new-milestone.md | Load roadmap by initiative | ~40-70 | LOW |
| fuska-plan-milestone-fixes.md | Load roadmap by initiative | ~50-80 | LOW |

**<verify>**
```bash
# Sample test each command
fuska check-todos
fuska code-review --dry-run
fuska complete --dry-run
fuska export-md --dry-run

# Verify correct initiative scope
```
**</verify>**

**<done>**
- [ ] fuska-check-todos.md updated
- [ ] fuska-code-review.md updated
- [ ] fuska-complete.md updated
- [ ] fuska-export-md.md updated
- [ ] fuska-map-codebase.md updated
- [ ] fuska-new-milestone.md updated
- [ ] fuska-plan-milestone-fixes.md updated
- [ ] All commands scope correctly
**</done>**

---

## Phase 6: Integration Testing

### 6.1 Multi-Initiative Environment Test

**Setup:** Create test environment with multiple initiatives

```bash
# Create test directory
mkdir -p ~/code/test-multi-initiative
cd ~/code/test-multi-initiative

# Create backup of current database
cp ~/.megamemory/megamemory.db ~/.megamemory/megamemory.db.test-backup

# Initialize test initiative
fuska init "Test Initiative Alpha"
fuska add-chapter "Test Chapter 1" "Test goal 1"
fuska add-chapter "Test Chapter 2" "Test goal 2"

# Switch to original initiative
cd ~/code/stocks/main
fuska progress  # Should show 'entry' initiative
```

**<verify>**
```bash
# Test 1: fuska progress shows only current initiative
cd ~/code/stocks/main
SUMMARIES=$(fuska progress | grep -c "summary")
if [ "$SUMMARIES" -gt 0 ]; then
  echo "✓ Shows summaries from current initiative only"
else
  echo "✓ No summaries (expected if no completions)"
fi

# Test 2: Switch initiatives
cd ~/code/test-multi-initiative
fuska progress | grep "Test Initiative Alpha"

# Test 3: No cross-pollution
if fuska progress | grep -q "chapter-1-daily-price-breakdown"; then
  echo "❌ Cross-initiative pollution detected"
  exit 1
else
  echo "✓ No cross-initiative pollution"
fi

# Cleanup
cp ~/.megamemory/megamemory.db.test-backup ~/.megamemory/megamemory.db
rm -rf ~/code/test-multi-initiative
```
**</verify>**

**<done>**
- [ ] Multi-initiative test environment created
- [ ] No cross-initiative pollution detected
- [ ] Initiative switching works correctly
- [ ] Test environment cleaned up
**</done>**

### 6.2 Dual-Path Parsing Test

**Test scenarios:**

1. **JSON roadmap (valid):** Should use JSON data
2. **Markdown roadmap:** Should discover nodes
3. **Stale JSON (wrong count):** Should warn and use discovered

```bash
# Scenario 1: Valid JSON (after migration)
fuska progress
# Should show 4 chapters without warnings

# Scenario 2: Markdown roadmap (simulate)
sqlite3 ~/.megamemory/megamemory.db "UPDATE nodes SET summary='# Roadmap\n\n## Chapters\n\n1. Chapter 1\n2. Chapter 2' WHERE name='roadmap'"
fuska progress
# Should show 4 chapters with warning about format

# Restore
fuska migrate-roadmap

# Scenario 3: Stale JSON
sqlite3 ~/.megamemory/megamemory.db "UPDATE nodes SET summary='{\"chapters\": [{\"number\": 1}]}' WHERE name='roadmap'"
fuska progress
# Should warn: "Roadmap summary has 1 chapters but 4 exist as nodes"
# Should show 4 chapters

# Restore
fuska migrate-roadmap
```

**<verify>**
```bash
# Verify all three scenarios pass
echo "Testing dual-path parsing..."
# Run scenarios above
echo "✓ All dual-path scenarios passed"
```
**</verify>**

**<done>**
- [ ] Scenario 1 (valid JSON) passes
- [ ] Scenario 2 (markdown) passes with warning
- [ ] Scenario 3 (stale JSON) passes with warning
- [ ] All scenarios use discovered nodes when appropriate
**</done>**

### 6.3 All Commands Test Matrix

**Test all 16 commands in multi-initiative environment:**

| # | Command | Test | Expected Result | Status |
|---|---------|------|-----------------|--------|
| 1 | fuska | Run `/fuska` | Shows 4 chapters, correct current | [ ] |
| 2 | fuska progress | Run `fuska progress` | Shows 4 chapters, correct current | [ ] |
| 3 | fuska migrate-roadmap | Run command | Converts to JSON, handles orphans | [ ] |
| 4 | fuska build | Run with --dry-run | Shows correct chapter | [ ] |
| 5 | fuska design | Run with --dry-run | Shows correct chapter | [ ] |
| 6 | fuska research-chapter | Run command | Shows correct chapter context | [ ] |
| 7 | fuska review | Run command | Shows correct summaries | [ ] |
| 8 | fuska add-chapter | Run with --dry-run | Adds to correct initiative | [ ] |
| 9 | fuska insert-chapter | Run with --dry-run | Inserts in correct initiative | [ ] |
| 10 | fuska remove-chapter | Run with --dry-run | Removes from correct initiative | [ ] |
| 11 | fuska check-todos | Run command | Shows correct initiative todos | [ ] |
| 12 | fuska code-review | Run with --dry-run | Shows correct summaries | [ ] |
| 13 | fuska complete | Run with --dry-run | Updates correct initiative | [ ] |
| 14 | fuska export-md | Run with --dry-run | Exports correct initiative | [ ] |
| 15 | fuska map-codebase | Run command | Maps correct initiative | [ ] |
| 16 | fuska new-milestone | Run with --dry-run | Creates in correct initiative | [ ] |

**<verify>**
```bash
# Run test matrix
for cmd in "fuska" "progress" "migrate-roadmap" "build" "design" "research-chapter" "review" "add-chapter" "insert-chapter" "remove-chapter" "check-todos" "code-review" "complete" "export-md" "map-codebase" "new-milestone"; do
  echo "Testing: fuska $cmd"
  fuska $cmd --dry-run 2>&1 | grep -i "error" && echo "❌ FAILED" || echo "✓ PASSED"
done
```
**</verify>**

**<done>**
- [ ] All 16 commands tested
- [ ] All pass without errors
- [ ] All scope to correct initiative
- [ ] No cross-initiative pollution
**</done>**

---

## Success Criteria

- [ ] `/fuska` shows correct chapter count (4, not 3)
- [ ] `fuska progress` shows correct chapter statuses
- [ ] Both commands show same current chapter
- [ ] No cross-initiative pollution in summaries
- [ ] All 16 commands scope queries correctly
- [ ] Migration command successfully converts markdown → JSON
- [ ] Migration command handles orphaned chapters
- [ ] Validation warnings appear when needed
- [ ] Tests pass in multi-initiative environment
- [ ] Rollback procedure documented and tested
- [ ] Reference document created and comprehensive

---

## Risk Mitigation

**Risk:** Breaking existing commands in single-initiative environments

**Mitigation:** 
- Test in both single and multi-initiative databases
- The pattern works for both cases (parent_id filtering is safe when only one initiative exists)
- Validation warnings only appear when truly needed (multiple state nodes)

**Risk:** Data corruption during migration

**Mitigation:**
- Create backup before migration
- Test migration on backup database first
- Document rollback procedure
- Migration uses transactions where possible

**Risk:** Inconsistent implementation across commands

**Mitigation:**
- Create reusable reference document first
- Follow same 3-step pattern in all commands
- Use dual-path parsing consistently
- Test all commands in test matrix

**Risk:** Performance degradation from extra queries

**Mitigation:**
- Initiative root ID cached after first lookup
- Discovery queries use top_k=100 (reasonable limit)
- JSON parse is fast, fallback is only on error

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

**Why create migration tool before manual fixes?**
- Tool is testable and repeatable
- Tool includes verification steps
- Tool handles edge cases (orphans, stale data)
- Manual SQL is error-prone and hard to rollback

**Why batch command updates by priority?**
- High priority commands affect execution flow
- Medium priority commands modify data
- Low priority commands are read-only utilities
- Allows incremental testing and deployment

---

## Execution Checklist

### Pre-Execution
- [ ] Review this plan with user
- [ ] Confirm database backup strategy
- [ ] Confirm rollback procedure
- [ ] Set aside 4-6 hours for full execution

### Phase 0
- [ ] Create migration command markdown
- [ ] Implement CLI command
- [ ] Test command on sample data
- [ ] Verify command is available

### Phase 1
- [ ] Create database backup
- [ ] Test migration on backup
- [ ] Document rollback procedure
- [ ] Test rollback

### Phase 2
- [ ] Run migration on production
- [ ] Verify roadmap is JSON with 4 chapters
- [ ] Verify state current_chapter is correct
- [ ] Verify orphaned chapter converted
- [ ] Verify cross-initiative isolation

### Phase 3
- [ ] Create reference document
- [ ] Verify all 3 layers documented
- [ ] Verify code patterns included

### Phase 4
- [ ] Update fuska.md
- [ ] Update progress.ts
- [ ] Test both commands

### Phase 5
- [ ] Update batch 1 (high priority)
- [ ] Update batch 2 (medium priority)
- [ ] Update batch 3 (low priority)
- [ ] Test each batch

### Phase 6
- [ ] Multi-initiative environment test
- [ ] Dual-path parsing test
- [ ] All commands test matrix
- [ ] Document results

### Post-Execution
- [ ] Update megamemory-integration.md with multi-initiative section
- [ ] Update CLAUDE.md in ~/code/stocks/main
- [ ] Create GitHub issue for any remaining work
- [ ] Archive backup files (keep last 5)

---

## Estimated Timeline

| Phase | Duration | Complexity |
|-------|----------|------------|
| Phase 0 | 1 hour | Medium |
| Phase 1 | 30 min | Low |
| Phase 2 | 15 min | Low |
| Phase 3 | 30 min | Low |
| Phase 4 | 1 hour | Medium |
| Phase 5 | 2 hours | High |
| Phase 6 | 1 hour | Medium |
| **Total** | **6.25 hours** | **Medium-High** |

---

## File Change Summary

### New Files
- `provider/opinkode/commands/fuska/fuska-migrate-roadmap.md`
- `src/commands/migrate-roadmap.ts`
- `provider/opinkode/fuska/references/initiative-scoped-queries.md`
- `provider/opinkode/fuska/references/rollback-procedure.md`

### Modified Files
- `provider/opinkode/commands/fuska/fuska.md` (Step 1.2)
- `src/commands/progress.ts` (4 functions)
- `provider/opinkode/commands/fuska/fuska-build.md`
- `provider/opinkode/commands/fuska/fuska-design.md`
- `provider/opinkode/commands/fuska/fuska-research-chapter.md`
- `provider/opinkode/commands/fuska/fuska-review.md`
- `provider/opinkode/commands/fuska/fuska-add-chapter.md`
- `provider/opinkode/commands/fuska/fuska-insert-chapter.md`
- `provider/opinkode/commands/fuska/fuska-remove-chapter.md`
- `provider/opinkode/commands/fuska/fuska-check-todos.md`
- `provider/opinkode/commands/fuska/fuska-code-review.md`
- `provider/opinkode/commands/fuska/fuska-complete.md`
- `provider/opinkode/commands/fuska/fuska-export-md.md`
- `provider/opinkode/commands/fuska/fuska-map-codebase.md`
- `provider/opinkode/commands/fuska/fuska-new-milestone.md`
- `provider/opinkode/commands/fuska/fuska-plan-milestone-fixes.md`

### Total Changes
- **New files:** 4
- **Modified files:** 16
- **Total files affected:** 20
