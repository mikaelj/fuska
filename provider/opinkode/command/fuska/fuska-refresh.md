---
name: fuska-refresh
description: Refresh import graph with file and symbol-level indexing, detect dead code
argument-hint: "[--full] [--dead-code] [--json] [--prune]"
tools:
  - read
  - bash
  - glob
  - grep

  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
  - megamemory:link
  - megamemory:list_roots
  - megamemory:remove_concept
---

<objective>
Refresh the import graph stored in MegaMemory with file and symbol-level indexing. Detect potentially dead code by analyzing usage edges.

**Orchestrator role:** Scan codebase, extract imports/exports/symbols, update MegaMemory concepts, report dead code.

**No subagent needed:** This is a direct indexing operation with bounded work per file.
</objective>

<execution_context>
@../../fuska/references/preflight-check-initiative-exists.md
</execution_context>

<megamemory_guide>

## How to read MegaMemory responses

**`megamemory:understand` returns:**
```json
{ "matches": [ { "id": "...", "name": "...", "kind": "...", "summary": "{...}", "edges": [...], "incoming_edges": [...] } ] }
```

Use `response.matches[0]` to access the first match.

**Parse summaries:** `const data = JSON.parse(match.summary)` to extract structured data.

**Edge relations for import graph:**
- `imports` -- File -> File
- `uses` -- File -> Symbol
- `defined_in` -- Symbol -> File
- `exports` -- File -> Symbol

**Concept naming convention:**
- Files: `file:lib/services/auth.dart` (use forward slashes in path)
- Symbols: `symbol:ClassName` or `symbol:functionName`
- Dead code: `dead-code:SymbolName`

</megamemory_guide>

<context>
Refresh the import graph. Default: incremental (only changed files since last SHA).

**Flags:**
- `--full` -- Force full re-scan of all files
- `--dead-code` -- Only show dead code report, skip refresh
- `--json` -- Output as JSON for scripts
- `--prune` -- Remove dead code concepts that are no longer dead

Variable: `$ARGUMENTS` contains flags and arguments.
</context>

<process>

## 0. Preflight Check

Follow the MegaMemory Initiative Exists Preflight Check from @preflight-check-initiative-exists.md.

## 1. Parse Arguments

```
const input = "$ARGUMENTS" || ""
const hasFullFlag = input.includes("--full")
const hasDeadCodeFlag = input.includes("--dead-code")
const hasJsonFlag = input.includes("--json")
const hasPruneFlag = input.includes("--prune")
```

## 2. Get Project Context

**Step 2.1: Get working directory and Git SHA**

```bash
pwd
git rev-parse HEAD
```

Store `projectRoot` and `currentSha`.

**Step 2.2: Query config concept**

```
megamemory_understand(query="config", top_k=1)
```

If `response.matches.length > 0`:
```
const configData = JSON.parse(response.matches[0].summary)
const refreshConfig = configData.refresh || { mode: 'disabled', age_hours: 24 }
const configId = response.matches[0].id
```

Else, use defaults:
```
const refreshConfig = { mode: 'hybrid', age_hours: 24 }
```

## 3. Check Staleness

```
const lastSha = refreshConfig.last_sha
const lastRefresh = refreshConfig.last_refresh ? new Date(refreshConfig.last_refresh) : null
const ageHours = lastRefresh ? (Date.now() - lastRefresh.getTime()) / (1000 * 60 * 60) : Infinity

const shaChanged = lastSha !== currentSha
const ageStale = ageHours > (refreshConfig.age_hours || 24)

const needsRefresh = !lastSha || shaChanged || ageStale || hasFullFlag
```

**If NOT needsRefresh AND NOT hasDeadCodeFlag AND NOT hasFullFlag:**
```
Display: "Import graph up to date (SHA: ${lastSha.slice(0,7)})"
Query dead code concepts and display -> Skip to Step 9 (Output)
```

## 4. Determine Files to Scan

**Step 4.1: Full refresh**

If `hasFullFlag` OR `!lastSha`:
```bash
git ls-files
```

**Step 4.2: Incremental refresh**

Else:
```bash
git diff --name-only ${lastSha} HEAD -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.dart' '*.py' '*.go'
```

Filter results to supported languages only.

**Step 4.3: Store file list**

```
const filesToScan = [list from git output]
const isFullRefresh = hasFullFlag || !lastSha
```

## 5. Scan Files for Imports/Exports/Symbols

**Step 5.1: Language patterns table**

| Extension | Language | Import Pattern | Export Detection | Symbol Patterns |
|-----------|----------|----------------|------------------|-----------------|
| `.dart` | Dart | `import\s+['"]([^'"]+)['"]` | `export\s+['"]([^'"]+)['"]` | `class\s+(\w+)`, `enum\s+(\w+)`, `mixin\s+(\w+)`, `void\s+(\w+)\s*\(`, `(\w+)\s*\([^)]*\)\s*(async\s+)?=>` |
| `.ts` `.tsx` | TypeScript | `import\s+.*from\s+['"]([^'"]+)['"]` | `export\s+(class\|function\|const\|interface\|type)\s+(\w+)` | Same as export patterns |
| `.js` `.jsx` | JavaScript | `import\s+.*from\s+['"]([^'"]+)['"]`, `require\(['"]([^'"]+)['"]\)` | `export\s+(class\|function\|const)\s+(\w+)`, `module\.exports` | Same as export patterns |
| `.py` | Python | `import\s+(\w+)`, `from\s+([\w.]+)\s+import` | N/A | `class\s+(\w+)\s*:`, `def\s+(\w+)\s*\(` |
| `.go` | Go | `import\s+\(?\s*["']([^"']+)["']` | Capitalized first letter | `func\s+(\w+)\s*\(`, `type\s+(\w+)\s+struct`, `type\s+(\w+)\s+interface` |

**Step 5.2: For each file, extract:**

```
For each file in filesToScan:
  1. Detect language from extension
  2. Read file content
  3. Extract imports -> resolve to relative paths (handle package aliases if possible)
  4. Extract exports -> list of symbol names
  5. Extract symbols:
     - name (e.g., "UserService")
     - type (class, function, enum, mixin, const, etc.)
     - signature (first line of definition, e.g., "class UserService extends BaseService")
     - exported (boolean)
     - methods (for classes: list of method names)
  6. Track file metadata: path, language, symbol_count
```

**Step 5.3: Handle edge cases**

- Dart `part` and `part of` directives: treat as same-file symbols
- Dart `show` and `hide`: note in imports but don't break
- TypeScript re-exports (`export * from`): resolve and add to exports
- Dynamic imports (`import()`): mark as dynamic usage, don't count as static import

## 6. Update MegaMemory Concepts

**Step 6.1: For each changed file**

```
const fileConceptName = `file:${filePath}`

// Query existing file concept
const existingFile = await megamemory_understand(query=fileConceptName, top_k=1)

// If exists, remove old symbol concepts first
if (existingFile.matches.length > 0) {
  const fileData = JSON.parse(existingFile.matches[0].summary)
  for (const exportedSymbol of (fileData.exports || [])) {
    const symbolConcept = await megamemory_understand(query=`symbol:${exportedSymbol}`, top_k=1)
    if (symbolConcept.matches.length > 0) {
      await megamemory_remove_concept(id=symbolConcept.matches[0].id, reason="Re-indexing file")
    }
  }
}

// Create file concept
const fileSummary = {
  path: filePath,
  language: language,
  imports: importsList,
  exports: exportsList,
  symbol_count: symbols.length,
  last_indexed: new Date().toISOString()
}

const fileConcept = await megamemory_create_concept(
  name=fileConceptName,
  kind='component',
  summary=JSON.stringify(fileSummary),
  parent_id=null
)

// Create symbol concepts
for (const symbol of symbols) {
  const symbolSummary = {
    type: symbol.type,
    name: symbol.name,
    file: filePath,
    signature: symbol.signature,
    exported: symbol.exported,
    methods: symbol.methods || []
  }

  const symbolConcept = await megamemory_create_concept(
    name=`symbol:${symbol.name}`,
    kind='component',
    summary=JSON.stringify(symbolSummary)
  )

  // Link symbol to file (defined_in)
  await megamemory_link(
    from=`symbol:${symbol.name}`,
    to=fileConceptName,
    relation='defined_in'
  )

  // Link file to symbol (exports) if exported
  if (symbol.exported) {
    await megamemory_link(
      from=fileConceptName,
      to=`symbol:${symbol.name}`,
      relation='exports'
    )
  }
}

// Create import edges
for (const importedPath of importsList) {
  const importedFileConceptName = `file:${importedPath}`
  await megamemory_link(
    from=fileConceptName,
    to=importedFileConceptName,
    relation='imports'
  )
}
```

**Step 6.2: For deleted files (incremental only)**

```
// Check for deleted files via git
git diff --name-only --diff-filter=D ${lastSha} HEAD

// For each deleted file:
const fileConceptName = `file:${deletedPath}`
const fileConcept = await megamemory_understand(query=fileConceptName, top_k=1)
if (fileConcept.matches.length > 0) {
  // Remove associated symbol concepts first
  const fileData = JSON.parse(fileConcept.matches[0].summary)
  for (const exportedSymbol of (fileData.exports || [])) {
    const symbolConcept = await megamemory_understand(query=`symbol:${exportedSymbol}`, top_k=1)
    if (symbolConcept.matches.length > 0) {
      await megamemory_remove_concept(id=symbolConcept.matches[0].id, reason="File deleted")
    }
  }
  await megamemory_remove_concept(id=fileConcept.matches[0].id, reason="File deleted")
}
```

## 7. Detect Dead Code

**Step 7.1: Query all symbol concepts**

```
const allSymbols = await megamemory_understand(query="symbol:", top_k=500)
```

If `allSymbols.matches.length === 500`, display warning:
```
"Warning: Symbol query truncated at 500 results. Run with --full for complete dead code analysis on large codebases."
```

**Step 7.2: Check each symbol for incoming usage edges**

```
const deadCodeCandidates = []

for (const match of allSymbols.matches) {
  const symbolData = JSON.parse(match.summary)

  // Skip non-exported symbols (internal usage hard to detect)
  if (!symbolData.exported) continue

  // Skip test files
  if (symbolData.file.includes('_test.') || symbolData.file.includes('.test.') || symbolData.file.includes('.spec.')) continue

  // Check for incoming 'uses' edges
  const hasIncomingUsage = match.incoming_edges?.some(e => e.relation === 'uses') ?? false

  if (!hasIncomingUsage) {
    deadCodeCandidates.push({
      name: symbolData.name,
      type: symbolData.type,
      file: symbolData.file,
      signature: symbolData.signature
    })
  }
}
```

**Step 7.3: Group related dead code (same file) and create concepts**

```
const deadByFile = {}
for (const candidate of deadCodeCandidates) {
  if (!deadByFile[candidate.file]) {
    deadByFile[candidate.file] = []
  }
  deadByFile[candidate.file].push(candidate)
}

for (const candidate of deadCodeCandidates) {
  const relatedDead = deadByFile[candidate.file]
    .filter(c => c.name !== candidate.name)
    .map(c => c.name)

  const deadCodeSummary = {
    type: candidate.type,
    file: candidate.file,
    signature: candidate.signature,
    reason: 'no_incoming_edges',
    detected_at: new Date().toISOString(),
    related_dead: relatedDead
  }

  await megamemory_create_concept(
    name=`dead-code:${candidate.name}`,
    kind='component',
    summary=JSON.stringify(deadCodeSummary)
  )
}
```

**Step 7.4: Prune if requested (--prune flag)**

If `hasPruneFlag`:
```
const allDeadCode = await megamemory_understand(query="dead-code:", top_k=500)
let prunedCount = 0

for (const match of allDeadCode.matches) {
  const symbolName = match.name.replace('dead-code:', '')
  const symbolResult = await megamemory_understand(query=`symbol:${symbolName}`, top_k=1)

  if (symbolResult.matches.length > 0) {
    const symbol = symbolResult.matches[0]
    const hasIncomingUsage = symbol.incoming_edges?.some(e => e.relation === 'uses') ?? false

    if (hasIncomingUsage) {
      await megamemory_remove_concept(id=match.id, reason="Symbol now has incoming usage")
      prunedCount++
    }
  }
}

Display: "Pruned ${prunedCount} dead code concepts that are no longer dead"
```

## 8. Update Config Concept

```
const updatedRefresh = {
  mode: refreshConfig.mode || 'hybrid',
  age_hours: refreshConfig.age_hours || 24,
  auto_before: refreshConfig.auto_before || ["plan-chapter", "execute-chapter", "debug"],
  last_sha: currentSha,
  last_refresh: new Date().toISOString(),
  files_scanned: filesToScan.length,
  symbols_indexed: totalSymbolsCount,
  dead_code_count: deadCodeCandidates.length
}

const updatedConfig = {
  ...configData,
  refresh: updatedRefresh
}

await megamemory_update_concept(
  id=configId,
  changes={ summary: JSON.stringify(updatedConfig) }
)
```

## 9. Output Summary

**If hasJsonFlag:**

Output raw JSON:
```json
{
  "mode": "incremental",
  "files_scanned": 12,
  "total_files": 147,
  "symbols_indexed": 892,
  "import_edges": 1247,
  "dead_code_count": 3,
  "dead_code": [
    {"name": "ItemSelectionSheet", "file": "lib/widgets/...", "type": "widget"}
  ],
  "pruned": 0
}
```

**Else (TTY format):**

```
---------------------------------------------------
  Fuska: Import graph refreshed
---------------------------------------------------

Mode: incremental
Files scanned: 12 changed / 147 total
Symbols indexed: 892
Import edges: 1,247
Dead code candidates: 3

Dead Code Candidates:
- ItemSelectionSheet        lib/widgets/item_selection_sheet.dart
- ItemSelectionFullScreen   lib/widgets/item_selection_sheet.dart
- showItemSelectionSheet()  lib/widgets/item_selection_sheet.dart

Run /fuska-ask "why is ItemSelectionSheet dead?" for details.
```

**If --dead-code flag (no refresh):**

Skip to dead code display only.

**If --prune flag:**

Add pruned count to output.

</process>

<success_criteria>
- [ ] Arguments parsed correctly
- [ ] Config concept queried for refresh settings
- [ ] Git SHA compared for staleness detection
- [ ] Changed files identified (incremental or full)
- [ ] Each file scanned for imports/exports/symbols
- [ ] File concepts created/updated in MegaMemory with `file:` prefix
- [ ] Symbol concepts created with `symbol:` prefix and `defined_in` edges
- [ ] Import edges created with `imports` relation
- [ ] Dead code detected by checking incoming `uses` edges
- [ ] Dead code concepts created with `dead-code:` prefix
- [ ] Pruning performed if --prune flag
- [ ] Config concept updated with refresh metadata
- [ ] Summary displayed to user (JSON or TTY format)
</success_criteria>
