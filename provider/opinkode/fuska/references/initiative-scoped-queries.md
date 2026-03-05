# Initiative-Scoped MegaMemory Queries

**Purpose:** Prevent cross-initiative pollution by establishing canonical patterns for all command implementations. This reference document provides the 3-layer approach for safe MegaMemory operations in multi-initiative environments.

**Audience:** Command implementers, agent developers, and anyone writing code that queries MegaMemory.

**Related:** [megamemory-integration.md](megamemory-integration.md), [rollback-procedure.md](rollback-procedure.md)

---

## Table of Contents

1. [The Problem](#the-problem)
2. [The 3-Layer Approach](#the-3-layer-approach)
3. [Layer 1: Initiative Scoping](#layer-1-initiative-scoping)
4. [Layer 2: Dual-Path Roadmap Parsing](#layer-2-dual-path-roadmap-parsing)
5. [Layer 3: Cross-Initiative Validation](#layer-3-cross-initiative-validation)
6. [Common Patterns](#common-patterns)
7. [Error Handling](#error-handling)
8. [Testing Checklist](#testing-checklist)

---

## The Problem

Fuska supports multiple initiatives in a single MegaMemory database. Without proper scoping, commands can accidentally:

- **Pollute across initiatives:** Query chapters from initiative A while working on initiative B
- **Display wrong data:** Show roadmap chapters from one initiative with state from another
- **Create orphaned nodes:** Create concepts without proper parent relationships
- **Corrupt state:** Update the wrong initiative's state concept

### Example Failure Scenarios

```typescript
// ❌ WRONG: Returns ALL chapters across ALL initiatives
const allChapters = await megamemory.understand({ query: 'chapter-', top_k: 100 });

// ❌ WRONG: Returns first "config" found, could be wrong initiative
const config = await megamemory.understand({ query: 'config', top_k: 1 });

// ❌ WRONG: Returns roadmap from ANY initiative
const roadmap = await megamemory.understand({ query: 'roadmap', top_k: 1 });

// ❌ WRONG: No parent_id check means could be from different initiative
const state = allConcepts.matches?.find(n => n.name === 'state' && n.kind === 'config');
```

---

## The 3-Layer Approach

Every MegaMemory query MUST follow these three layers in order:

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: Initiative Scoping                            │
│  - Load current_initiative from config                  │
│  - Filter ALL queries by parent_id                      │
│  - Use exact name/kind/parent_id matching               │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 2: Dual-Path Roadmap Parsing                     │
│  - Try JSON parse first                                 │
│  - Fallback to node discovery if JSON fails/stale       │
│  - Verify chapter count matches child nodes             │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 3: Cross-Initiative Validation                   │
│  - Warn if data from multiple initiatives detected      │
│  - Check for orphaned nodes                             │
│  - Verify parent chain integrity                        │
└─────────────────────────────────────────────────────────┘
```

---

## Layer 1: Initiative Scoping

### Load Current Initiative

**Pattern:** Read from config concept, not semantic search.

```typescript
import { understand, KnowledgeDB } from 'megamemory/dist/tools.js';

async function loadCurrentInitiative(db: KnowledgeDB): Promise<string | null> {
  // Step 1: Load ALL concepts to find config
  const allConcepts = await understand(db, { query: 'config concepts', top_k: 10000 });
  
  // Step 2: Find config with current_initiative field (exact match)
  // NOTE: Multiple config concepts may exist - find the one with current_initiative
  const configNode = allConcepts.matches?.find(node => {
    if (node.name !== 'config' || node.kind !== 'config') return false;
    try {
      const data = JSON.parse(node.summary);
      return 'current_initiative' in data;
    } catch {
      return false;
    }
  });
  
  if (!configNode) {
    console.error('No config concept with current_initiative found');
    return null;
  }
  
  const configData = JSON.parse(configNode.summary);
  return configData.current_initiative || null;
}
```

### Find Initiative Root

**Pattern:** Exact name + kind + parent_id match.

```typescript
async function findInitiativeRoot(
  db: KnowledgeDB, 
  initiativeSlug: string
): Promise<NodeWithContext | null> {
  const allConcepts = await understand(db, { query: 'initiative feature', top_k: 10000 });
  
  // CRITICAL: Match name, kind, AND parent_id===null
  // parent_id===null ensures we find the ROOT, not child concepts
  return allConcepts.matches?.find(node => 
    node.name === initiativeSlug && 
    node.kind === 'feature' && 
    !node.parent_id  // Root initiative has no parent
  ) || null;
}
```

### Scope Queries by Initiative

**Pattern:** Always filter by initiative's parent_id.

```typescript
async function loadChaptersForInitiative(
  db: KnowledgeDB,
  initiativeId: string
): Promise<NodeWithContext[]> {
  const allConcepts = await understand(db, { query: 'chapter', top_k: 10000 });
  
  // Filter chapters by parent_id matching initiative
  // OR by parent chain traversal (see loadRoadmap below)
  return allConcepts.matches?.filter(node => 
    node.name.startsWith('chapter-') && 
    node.kind === 'feature' &&
    node.parent_id === initiativeId
  ) || [];
}
```

### Key Principle: Direct Node Lookup

**❌ NEVER use semantic search for exact name matching:**

```typescript
// ❌ WRONG: Returns concepts by similarity, not exact match
const config = await understand(db, { query: 'config', top_k: 1 });
// Could return domain-config, session-config, etc.
```

**✅ ALWAYS use exact filters:**

```typescript
// ✅ CORRECT: Exact name + kind + parent_id
const config = allConcepts.matches?.find(n => 
  n.name === 'config' && 
  n.kind === 'config'
);
```

---

## Layer 2: Dual-Path Roadmap Parsing

Roadmap summaries may be in JSON or legacy markdown format. Always use dual-path parsing with verification.

### Pattern: JSON Parse with Fallback

```typescript
interface ChapterInfo {
  number: number;
  slug: string;
  name: string;
  status: string;
}

interface RoadmapData {
  chapters: ChapterInfo[];
}

async function loadRoadmap(
  db: KnowledgeDB,
  initiativeId: string
): Promise<{ data: RoadmapData | null; warnings: string[] }> {
  const warnings: string[] = [];
  
  // Step 1: Find roadmap concept scoped to initiative
  const allConcepts = await understand(db, { query: 'roadmap', top_k: 10000 });
  const roadmapNode = allConcepts.matches?.find(node => 
    node.name === 'roadmap' && 
    node.kind === 'module' &&
    node.parent_id === initiativeId
  );
  
  if (!roadmapNode) {
    return { data: null, warnings: ['No roadmap concept found for initiative'] };
  }
  
  // Step 2: Try JSON parse first
  let roadmapData: RoadmapData | null = null;
  try {
    const parsed = JSON.parse(roadmapNode.summary);
    if (parsed.chapters && Array.isArray(parsed.chapters)) {
      roadmapData = parsed;
    }
  } catch {
    // JSON parse failed, try markdown
  }
  
  // Step 3: Fallback to markdown parsing if JSON failed
  if (!roadmapData) {
    roadmapData = parseMarkdownRoadmap(roadmapNode.summary);
    if (roadmapData) {
      warnings.push('Roadmap using legacy markdown format - consider migrating to JSON');
    }
  }
  
  // Step 4: Verify chapter count against actual child nodes
  if (roadmapData) {
    const actualChapters = await loadChaptersForInitiative(db, initiativeId);
    if (roadmapData.chapters.length !== actualChapters.length) {
      warnings.push(
        `Roadmap shows ${roadmapData.chapters.length} chapters but ` +
        `found ${actualChapters.length} chapter nodes - data may be stale`
      );
      
      // Step 5: Use node discovery for accurate count
      roadmapData = {
        chapters: actualChapters.map(node => {
          const data = JSON.parse(node.summary);
          return {
            number: data.number,
            slug: data.slug,
            name: data.name,
            status: data.status
          };
        })
      };
    }
  }
  
  return { data: roadmapData, warnings };
}

function parseMarkdownRoadmap(summary: string): RoadmapData | null {
  // Extract chapters from markdown format
  // Example: "## Chapter 1: Setup\nStatus: planned\n..."
  const chapters: ChapterInfo[] = [];
  const chapterRegex = /## Chapter (\d+): (.+?)\nStatus: (\w+)/g;
  let match;
  
  while ((match = chapterRegex.exec(summary)) !== null) {
    chapters.push({
      number: parseInt(match[1], 10),
      slug: `chapter-${match[1]}`,
      name: match[2],
      status: match[3]
    });
  }
  
  return chapters.length > 0 ? { chapters } : null;
}
```

### When to Use Node Discovery

Always use node discovery (bypassing roadmap summary) when:

1. **JSON parse fails** - Roadmap is in legacy markdown format
2. **Chapter count mismatch** - Summary is stale
3. **No roadmap concept exists** - Build from chapter nodes directly
4. **Need accurate real-time data** - Don't trust cached summary

---

## Layer 3: Cross-Initiative Validation

### Detect Cross-Initiative Pollution

```typescript
async function validateInitiativeIsolation(
  db: KnowledgeDB,
  initiativeSlug: string
): Promise<{ valid: boolean; issues: string[] }> {
  const issues: string[] = [];
  
  // Load initiative root
  const initiative = await findInitiativeRoot(db, initiativeSlug);
  if (!initiative) {
    return { valid: false, issues: [`Initiative ${initiativeSlug} not found`] };
  }
  
  // Check for orphaned nodes (no parent_id, no edges to initiative)
  const allConcepts = await understand(db, { query: '', top_k: 10000 });
  const orphanedNodes = allConcepts.matches?.filter(node => 
    !node.parent_id &&
    node.name !== initiativeSlug && // Exclude other initiative roots
    node.kind !== 'config' && // Exclude global config
    !node.edges?.some(e => e.to === initiative.id)
  ) || [];
  
  if (orphanedNodes.length > 0) {
    issues.push(
      `Found ${orphanedNodes.length} orphaned nodes: ` +
      orphanedNodes.map(n => n.name).join(', ')
    );
  }
  
  // Check for state/summary nodes from wrong initiative
  const stateNodes = allConcepts.matches?.filter(n => 
    n.name === 'state' && n.kind === 'config'
  ) || [];
  
  if (stateNodes.length > 1) {
    issues.push(
      `Multiple state nodes found (${stateNodes.length}) - ` +
      `should be exactly one per initiative`
    );
  }
  
  // Verify parent chain integrity
  const chapters = await loadChaptersForInitiative(db, initiative.id);
  for (const chapter of chapters) {
    if (chapter.parent_id !== initiative.id) {
      issues.push(
        `Chapter ${chapter.name} has parent_id=${chapter.parent_id} ` +
        `but should be ${initiative.id}`
      );
    }
  }
  
  return { valid: issues.length === 0, issues };
}
```

### Warn on Multi-Initiative Data

```typescript
function checkForMultiInitiativeData(
  nodes: NodeWithContext[],
  expectedInitiativeId: string
): string[] {
  const warnings: string[] = [];
  const parentIds = new Set(nodes.map(n => n.parent_id).filter(Boolean));
  
  if (parentIds.size > 1) {
    warnings.push(
      `Query returned data from multiple parent IDs: ` +
      Array.from(parentIds).join(', ') +
      ` - expected only ${expectedInitiativeId}`
    );
  }
  
  return warnings;
}
```

---

## Common Patterns

### Load Initiative State

```typescript
async function loadInitiativeState(
  db: KnowledgeDB,
  initiativeSlug: string
): Promise<{
  initiative: NodeWithContext;
  state: any;
  roadmap: RoadmapData | null;
  warnings: string[];
} | null> {
  const warnings: string[] = [];
  
  // Load initiative root
  const initiative = await findInitiativeRoot(db, initiativeSlug);
  if (!initiative) return null;
  
  // Load state concept scoped to initiative
  const allConcepts = await understand(db, { query: 'state config', top_k: 10000 });
  const stateNode = allConcepts.matches?.find(node =>
    node.name === 'state' &&
    node.kind === 'config' &&
    node.parent_id === initiative.id
  );
  
  if (!stateNode) {
    warnings.push('No state concept found for initiative');
  }
  
  const state = stateNode ? JSON.parse(stateNode.summary) : null;
  
  // Load roadmap with dual-path parsing
  const { data: roadmap, warnings: roadmapWarnings } = await loadRoadmap(db, initiative.id);
  warnings.push(...roadmapWarnings);
  
  return { initiative, state, roadmap, warnings };
}
```

### Find Recent Summaries

```typescript
async function findRecentSummaries(
  db: KnowledgeDB,
  initiativeId: string,
  limit: number = 10
): Promise<NodeWithContext[]> {
  const allConcepts = await understand(db, { query: 'summary', top_k: 10000 });
  
  // Filter summaries by initiative via parent chain
  // A summary's parent is a plan, and plan's parent is a chapter,
  // and chapter's parent is the initiative
  const summaries = allConcepts.matches?.filter(node => {
    if (!node.name.endsWith('-summary') || node.kind !== 'component') {
      return false;
    }
    
    // Check parent chain - summary → plan → chapter → initiative
    // This requires traversing up the parent hierarchy
    return hasInitiativeInParentChain(db, node, initiativeId);
  }) || [];
  
  // Sort by some timestamp if available, otherwise return as-is
  return summaries.slice(0, limit);
}

async function hasInitiativeInParentChain(
  db: KnowledgeDB,
  node: NodeWithContext,
  targetInitiativeId: string
): Promise<boolean> {
  // Direct parent check
  if (node.parent_id === targetInitiativeId) return true;
  
  // For chapters, check if parent_id matches initiative
  if (node.parent_id) {
    const parentQuery = await understand(db, { query: node.parent_id, top_k: 1 });
    const parent = parentQuery.matches?.[0];
    if (parent) {
      return hasInitiativeInParentChain(db, parent, targetInitiativeId);
    }
  }
  
  return false;
}
```

### Load Chapter Context

```typescript
async function loadChapterContext(
  db: KnowledgeDB,
  initiativeId: string,
  chapterSlug: string
): Promise<{
  chapter: NodeWithContext;
  context: any;
  plans: NodeWithContext[];
  summaries: NodeWithContext[];
} | null> {
  // Find chapter scoped to initiative
  const allConcepts = await understand(db, { query: `${chapterSlug} context plan summary`, top_k: 10000 });
  
  const chapter = allConcepts.matches?.find(node =>
    node.name === chapterSlug &&
    node.kind === 'feature' &&
    node.parent_id === initiativeId
  );
  
  if (!chapter) return null;
  
  // Load context (if exists)
  const contextNode = allConcepts.matches?.find(node =>
    node.name === `${chapterSlug}-context` &&
    node.parent_id === chapter.id
  );
  
  const context = contextNode ? JSON.parse(contextNode.summary) : null;
  
  // Load plans
  const plans = allConcepts.matches?.filter(node =>
    node.name.startsWith(`${chapterSlug}-plan-`) &&
    !node.name.endsWith('-summary') &&
    node.kind === 'feature' &&
    node.parent_id === chapter.id
  ) || [];
  
  // Load summaries
  const summaries = allConcepts.matches?.filter(node =>
    node.name.startsWith(`${chapterSlug}-plan-`) &&
    node.name.endsWith('-summary') &&
    node.kind === 'component' &&
    node.parent_id === chapter.id
  ) || [];
  
  return { chapter, context, plans, summaries };
}
```

---

## Error Handling

### Missing Config

```typescript
if (!configNode) {
  console.error(`
ERROR: No config concept found with current_initiative field.

This usually means:
1. No initiative has been initialized (run 'fuska init' first)
2. Config concept exists but missing current_initiative field

To fix:
- Run 'fuska init' to initialize a new initiative
- Or manually add current_initiative to config concept
  `);
  process.exit(1);
}
```

### Initiative Not Found

```typescript
if (!initiative) {
  console.error(`
ERROR: Initiative '${initiativeSlug}' not found.

Possible causes:
1. Initiative slug is incorrect
2. Initiative exists but has parent_id (not a root)
3. Initiative was deleted

To fix:
- Run 'fuska initiatives' to list available initiatives
- Check MegaMemory for orphaned initiative nodes
  `);
  process.exit(1);
}
```

### Roadmap Not Found

```typescript
if (!roadmapNode) {
  console.warn(`
WARNING: No roadmap concept found for initiative '${initiativeSlug}'.

The initiative may not have any chapters planned yet.

To fix:
- Run '/fuska-add-chapter' to create the first chapter
- Or check if chapters exist as orphaned nodes
  `);
  // Continue with empty roadmap or build from chapter nodes
}
```

### Cross-Initiative Pollution Detected

```typescript
if (parentIds.size > 1) {
  console.error(`
ERROR: Cross-initiative pollution detected!

Query returned data from multiple initiatives:
${Array.from(parentIds).map(id => `- ${id}`).join('\n')}

Expected only: ${expectedInitiativeId}

This is a critical data integrity issue. To fix:
1. Run 'fuska migrate-roadmap --dry-run' to check data
2. Review orphaned nodes
3. Run migration to heal parent relationships
  `);
  process.exit(1);
}
```

---

## Testing Checklist

Before considering a command implementation complete, verify:

### Initiative Scoping Tests

- [ ] **Config Loading:** Command loads current_initiative from config concept
- [ ] **Initiative Root:** Command finds initiative by name + kind + parent_id===null
- [ ] **Parent Filtering:** All queries filter by initiative's parent_id
- [ ] **Exact Matching:** No semantic search used for exact name lookups
- [ ] **Multiple Configs:** Command handles multiple config concepts gracefully

### Dual-Path Parsing Tests

- [ ] **JSON Parse:** Command parses JSON roadmap successfully
- [ ] **Markdown Fallback:** Command falls back to markdown parsing when JSON fails
- [ ] **Chapter Count Verification:** Command verifies roadmap chapters match node count
- [ ] **Stale Data Detection:** Command warns when roadmap is stale
- [ ] **Node Discovery:** Command uses node discovery when roadmap missing/mismatched

### Cross-Initiative Validation Tests

- [ ] **Orphan Detection:** Command detects and reports orphaned nodes
- [ ] **Multi-Initiative Warning:** Command warns when data from multiple initiatives detected
- [ ] **Parent Chain:** Command validates parent chain integrity
- [ ] **State Uniqueness:** Command checks for duplicate state nodes
- [ ] **Error Messages:** Error messages include actionable fix instructions

### Edge Cases

- [ ] **No Initiative:** Command handles missing initiative gracefully
- [ ] **No Roadmap:** Command handles missing roadmap gracefully
- [ ] **Empty Chapters:** Command handles initiative with no chapters
- [ ] **Corrupted Data:** Command handles malformed JSON in summaries
- [ ] **Large Datasets:** Command performs well with 100+ concepts

### Integration Tests

- [ ] **Multi-Initiative Environment:** Command works correctly when multiple initiatives exist
- [ ] **Initiative Switching:** Command respects current_initiative after switch
- [ ] **No Cross-Pollution:** Command never returns data from wrong initiative
- [ ] **Rollback Safety:** Migration/command can be safely rolled back

---

## Best Practices Summary

1. **Always scope by initiative:** Never query without filtering by parent_id
2. **Use exact matching:** Direct node lookup, not semantic search
3. **Parse defensively:** Dual-path parsing with verification
4. **Validate aggressively:** Check for pollution, orphans, and inconsistencies
5. **Fail informatively:** Provide actionable error messages with fix instructions
6. **Test thoroughly:** Use the checklist above for every command implementation

---

## References

- [megamemory-integration.md](megamemory-integration.md) - General MegaMemory patterns
- [rollback-procedure.md](rollback-procedure.md) - Database rollback procedures
- [status-values.md](status-values.md) - Canonical status values
- Plan-01 Summary - Migration tool implementation patterns
- Plan-02 Summary - Direct node lookup patterns

---

**Last Updated:** 2026-03-05  
**Related Chapter:** chapter-1-fix-scoping-json-format  
**Maintainers:** Fuska development team