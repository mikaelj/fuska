---
name: fuska-migrate-roadmap
description: Convert roadmap summary from markdown to JSON format, discover orphaned chapters, and sync with child nodes
argument-hint: "[--dry-run] [--json]"
flags: --dry-run, --json
tools:
  - read
  - bash
  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
  - megamemory:link
  - megamemory:list_roots
---

<objective>
Migrate roadmap summary from markdown to JSON format. Discover chapter nodes that may be orphaned or disconnected from roadmap. Ensure roadmap JSON reflects actual child nodes in MegaMemory.

**Problem:** Roadmap summaries may be in markdown format instead of JSON, causing parsing inconsistencies. Chapters may exist without proper parent_id or edges, leading to wrong chapter counts and cross-initiative pollution.

**Solution:** Parse roadmap summary, convert to JSON, discover all chapter nodes, heal orphaned chapters, and sync roadmap data with actual child nodes.

**Orchestrator role:** Read roadmap concept, parse/format, query chapter nodes, update concepts.
</objective>

<execution_context>

@../../fuska/references/megamemory-quick-ref.md
@../../fuska/references/preflight-check-initiative-exists.md
</execution_context>

<context>
Migrate roadmap summary to JSON format.

**Flags:**
- `--dry-run` -- Show what would change without updating MegaMemory
- `--json` -- Output migration report as JSON

Variable: `$ARGUMENTS` contains flags.
</context>

<process>

## 0. Preflight Check

Follow the MegaMemory Initiative Exists Preflight Check from @preflight-check-initiative-exists.md.

## 1. Parse Arguments

```
const input = "$ARGUMENTS" || ""
const hasDryRunFlag = input.includes("--dry-run")
const hasJsonFlag = input.includes("--json")
```

## 2. Load Current Initiative

**Step 2.1: Get current initiative from config**

```
megamemory_understand(query="config", top_k=1)
```

If response.matches.length > 0:
```
const configData = JSON.parse(response.matches[0].summary)
const currentInitiative = configData.current_initiative
```

If currentInitiative is null:
→ Display: "No current initiative set in config"
→ Suggest: "Run 'fuska init' or 'fuska initiative-switch' first"
→ Stop

**Step 2.2: Find initiative root**

```
megamemory_understand(query=currentInitiative, top_k=1)
```

Verify: match.parent_id === null AND match.kind === 'feature'

Store `initiativeId` = response.matches[0].id

## 3. Load Roadmap Concept

**Step 3.1: Find roadmap concept**

```
megamemory_understand(query="roadmap", top_k=10)
```

Filter for roadmap concept:
```
const roadmapMatch = response.matches.find(m => 
  m.name.includes('roadmap') && 
  (m.parent_id === initiativeId || m.parent?.name === currentInitiative)
)
```

If no roadmap found:
→ Display: "No roadmap concept found for initiative"
→ Suggest: "Initialize roadmap with 'fuska init'"
→ Stop

**Step 3.2: Extract roadmap summary**

```
const roadmapSummaryString = roadmapMatch.summary
const roadmapId = roadmapMatch.id
```

## 4. Parse Roadmap Summary

**Step 4.1: Check if already JSON**

Try to parse as JSON:
```
let roadmapData
let isMarkdown = false

try {
  roadmapData = JSON.parse(roadmapSummaryString)
} catch (e) {
  isMarkdown = true
  roadmapData = parseMarkdownRoadmap(roadmapSummaryString)
}
```

**Step 4.2: Parse markdown roadmap (if needed)**

```
function parseMarkdownRoadmap(markdown: string): any {
  const data = {
    chapters: [],
    current_milestone: null,
    created_at: null,
    updated: new Date().toISOString()
  }
  
  // Extract chapters from markdown
  const chapterMatches = markdown.matchAll(/###\s+Chapter\s+(\d+):\s+(.+)/g)
  for (const match of chapterMatches) {
    const number = parseInt(match[1])
    const name = match[2].trim()
    
    // Extract goal (look for **Goal:** or Goal:)
    const goalMatch = markdown.match(new RegExp(`Chapter ${number}[\\s\\S]*?\\*\\*Goal:\\*\\*\\s*(.+)`))
    const goal = goalMatch ? goalMatch[1].trim() : ''
    
    // Extract status
    const statusMatch = markdown.match(new RegExp(`Chapter ${number}[\\s\\S]*?\\*\\*Status:\\*\\*\\s*(.+)`))
    const status = statusMatch ? statusMatch[1].trim() : 'pending'
    
    data.chapters.push({
      number,
      slug: `chapter-${number.toString().padStart(2, '0')}`,
      name,
      goal,
      status,
      depends_on: [],
      created_at: null,
      completed_date: null
    })
  }
  
  return data
}
```

## 5. Discover Chapter Nodes

**Step 5.1: Query all chapter concepts**

```
megamemory_understand(query="chapter-", top_k=100)
```

**Step 5.2: Filter to current initiative**

```
const allChapterConcepts = response.matches.filter(m => 
  m.name.match(/^chapter-\d+/) && 
  (m.parent_id === initiativeId || 
   m.parent?.name === currentInitiative ||
   m.parent?.id === initiativeId)
)
```

**Step 5.3: Extract chapter data from nodes**

```
const discoveredChapters = allChapterConcepts.map(match => {
  const summaryString = match.summary
  let chapterData
  
  try {
    chapterData = JSON.parse(summaryString)
  } catch (e) {
    // If summary is markdown, extract basic info
    const nameMatch = match.name.match(/^chapter-(\d+)(?:-(.+))?/)
    chapterData = {
      number: nameMatch ? parseInt(nameMatch[1]) : 0,
      slug: match.name,
      name: match.name.replace('chapter-', '').replace(/-\d+$/, ''),
      status: 'pending',
      goal: ''
    }
  }
  
  return {
    id: match.id,
    name: match.name,
    parentId: match.parent_id,
    hasParentEdge: match.parent_id === initiativeId,
    hasPartOfEdge: match.edges?.some(e => e.relation === 'part_of' && e.to_name === 'roadmap'),
    ...chapterData
  }
})
```

## 6. Identify Orphaned Chapters

**Step 6.1: Find chapters without proper connections**

```
const orphanedChapters = discoveredChapters.filter(ch => 
  !ch.hasParentEdge && !ch.hasPartOfEdge
)

const chaptersWithWrongParent = discoveredChapters.filter(ch =>
  ch.parentId && ch.parentId !== initiativeId
)
```

**Step 6.2: Log orphaned chapters**

```
if (orphanedChapters.length > 0) {
  Display: `Found ${orphanedChapters.length} orphaned chapters:`
  orphanedChapters.forEach(ch => {
    Display: `  - ${ch.name} (parent_id: ${ch.parentId || 'null'})`
  })
}

if (chaptersWithWrongParent.length > 0) {
  Display: `Found ${chaptersWithWrongParent.length} chapters with wrong parent:`
  chaptersWithWrongParent.forEach(ch => {
    Display: `  - ${ch.name} (parent_id: ${ch.parentId}, expected: ${initiativeId})`
  })
}
```

## 7. Sync Roadmap with Discovered Chapters

**Step 7.1: Merge discovered chapters into roadmap**

```
const syncedChapters = discoveredChapters.map(discovered => {
  // Find matching chapter in roadmap data
  const existingInRoadmap = roadmapData.chapters?.find(ch => 
    ch.number === discovered.number || 
    ch.slug === discovered.slug
  )
  
  if (existingInRoadmap) {
    // Merge: prefer discovered data, but keep roadmap fields if missing
    return {
      ...existingInRoadmap,
      ...discovered,
      // Preserve roadmap-specific fields
      depends_on: existingInRoadmap.depends_on || [],
      created_at: existingInRoadmap.created_at || discovered.created_at,
      completed_date: existingInRoadmap.completed_date || discovered.completed_date
    }
  } else {
    // New chapter discovered
    return {
      number: discovered.number,
      slug: discovered.slug,
      name: discovered.name,
      goal: discovered.goal || '',
      status: discovered.status || 'pending',
      depends_on: [],
      created_at: discovered.created_at || null,
      completed_date: discovered.completed_date || null
    }
  }
})

// Sort by chapter number
syncedChapters.sort((a, b) => a.number - b.number)
```

**Step 7.2: Build final roadmap data**

```
const finalRoadmapData = {
  chapters: syncedChapters,
  current_milestone: roadmapData.current_milestone || null,
  created_at: roadmapData.created_at || new Date().toISOString(),
  updated: new Date().toISOString()
}
```

## 8. Verify Chapter Count

**Step 8.1: Count chapters in roadmap vs discovered**

```
const roadmapChapterCount = roadmapData.chapters?.length || 0
const discoveredChapterCount = discoveredChapters.length
const syncedChapterCount = syncedChapters.length

if (roadmapChapterCount !== discoveredChapterCount) {
  Display: `⚠ Chapter count mismatch:`
  Display: `  Roadmap (before): ${roadmapChapterCount} chapters`
  Display: `  Discovered nodes: ${discoveredChapterCount} chapters`
  Display: `  Synced roadmap: ${syncedChapterCount} chapters`
}
```

## 9. Heal Orphaned Chapters

**Step 9.1: Update parent_id for orphaned chapters**

For each chapter in orphanedChapters:
```
if (!hasDryRunFlag) {
  await megamemory_update_concept({
    id: chapter.id,
    changes: { parent_id: initiativeId }
  })
}
```

**Step 9.2: Create part_of edges**

For each chapter in orphanedChapters:
```
if (!hasDryRunFlag) {
  await megamemory_link({
    from: chapter.name,
    to: 'roadmap',
    relation: 'part_of'
  })
}
```

**Step 9.3: Log healing actions**

```
if (orphanedChapters.length > 0) {
  Display: `✓ Healed ${orphanedChapters.length} orphaned chapters`
}
```

## 10. Update Roadmap Concept

**Step 10.1: Convert to JSON string**

```
const roadmapJsonString = JSON.stringify(finalRoadmapData, null, 2)
```

**Step 10.2: Update roadmap concept**

```
if (!hasDryRunFlag) {
  await megamemory_update_concept({
    id: roadmapId,
    changes: {
      summary: roadmapJsonString
    }
  })
  
  Display: "✓ Updated roadmap summary to JSON format"
} else {
  Display: "[DRY RUN] Would update roadmap summary to JSON format"
}
```

## 11. Update State Concept

**Step 11.1: Query state concept**

```
megamemory_understand(query="state", top_k=1)
```

**Step 11.2: Update state with correct chapter count**

```
if (response.matches.length > 0) {
  const stateData = JSON.parse(response.matches[0].summary)
  const stateId = response.matches[0].id
  
  const completedChapters = syncedChapters.filter(ch => ch.status === 'complete').length
  const progress = syncedChapters.length > 0 
    ? Math.round((completedChapters / syncedChapters.length) * 100)
    : 0
  
  const updatedState = {
    ...stateData,
    progress,
    last_activity: new Date().toISOString()
  }
  
  if (!hasDryRunFlag) {
    await megamemory_update_concept({
      id: stateId,
      changes: {
        summary: JSON.stringify(updatedState)
      }
    })
    
    Display: `✓ Updated state: ${progress}% progress (${completedChapters}/${syncedChapters.length} chapters complete)`
  } else {
    Display: `[DRY RUN] Would update state: ${progress}% progress`
  }
}
```

## 12. Generate Migration Report

**Step 12.1: Build report data**

```
const report = {
  initiative: currentInitiative,
  roadmap_id: roadmapId,
  migration: {
    from_format: isMarkdown ? 'markdown' : 'json',
    to_format: 'json',
    chapters_before: roadmapChapterCount,
    chapters_after: syncedChapterCount,
    orphaned_healed: orphanedChapters.length
  },
  chapters: {
    discovered: discoveredChapterCount,
    synced: syncedChapterCount,
    complete: syncedChapters.filter(ch => ch.status === 'complete').length,
    pending: syncedChapters.filter(ch => ch.status === 'pending').length,
    in_progress: syncedChapters.filter(ch => ch.status === 'in_progress').length
  },
  state_updated: !hasDryRunFlag,
  dry_run: hasDryRunFlag
}
```

**Step 12.2: Output report**

If hasJsonFlag:
```
Output: JSON.stringify(report, null, 2)
```

Else:
```
Display: `
---------------------------------------------------
  Fuska: Roadmap Migration Complete
---------------------------------------------------

Initiative: ${currentInitiative}
Format: ${report.migration.from_format} → JSON

Chapters:
  Before: ${report.migration.chapters_before}
  After: ${report.migration.chapters_after}
  Healed: ${report.migration.orphaned_healed} orphaned chapters

Status:
  Complete: ${report.chapters.complete}
  In Progress: ${report.chapters.in_progress}
  Pending: ${report.chapters.pending}

State: ${report.state_updated ? 'Updated' : 'Not updated'}
${hasDryRunFlag ? '\n[DRY RUN - No changes made to MegaMemory]' : ''}

---------------------------------------------------
`
```

</process>

<success_criteria>
- [ ] Arguments parsed correctly
- [ ] Current initiative loaded from config
- [ ] Initiative root found (parent_id === null)
- [ ] Roadmap concept found and loaded
- [ ] Roadmap summary parsed (markdown or JSON)
- [ ] Chapter concepts discovered and filtered to current initiative
- [ ] Orphaned chapters identified
- [ ] Roadmap chapters synced with discovered nodes
- [ ] Chapter count verified and logged
- [ ] Orphaned chapters healed (parent_id and edges updated)
- [ ] Roadmap concept updated with JSON summary
- [ ] State concept updated with correct progress
- [ ] Migration report generated and displayed
</success_criteria>