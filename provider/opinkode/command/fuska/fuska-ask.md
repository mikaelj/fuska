---
name: fuska-ask
description: Ask questions about the codebase using import graph data
argument-hint: "[question]"
tools:
  - read
  - bash
  - grep
  - glob

  - megamemory:understand
  - megamemory:list_roots
---

<objective>
Answer questions about the codebase using the import graph stored in MegaMemory. Falls back to grep when data is unavailable or stale.

**Orchestrator role:** Parse question intent, query MegaMemory, format response with fallback to grep.

**No subagent needed:** Direct query and response operation.
</objective>

<execution_context>
@../../fuska/references/preflight-check-project-exists.md
</execution_context>

<megamemory_guide>

## Query patterns

| Query Type | Example |
|------------|---------|
| Find file | `megamemory_understand(query="file:lib/services/auth", top_k=5)` |
| Find symbol | `megamemory_understand(query="symbol:UserService", top_k=5)` |
| Find dead code | `megamemory_understand(query="dead-code:ItemSelection", top_k=5)` |
| General search | `megamemory_understand(query="authentication login user", top_k=20)` |

**Parse response:** Use `response.matches[0]` to access first match.

**Check edges:**
- `match.edges` -- outgoing edges from this concept
- `match.incoming_edges` -- incoming edges to this concept

**Edge relations:**
- `imports` -- files importing this file
- `uses` -- files using this symbol
- `defined_in` -- file where symbol is defined
- `exports` -- symbols exported by this file

</megamemory_guide>

<context>
User question: `$ARGUMENTS`

**Supported question types:**
- "What imports X?" / "Who imports X?" -- Find files that import a file
- "Who uses Symbol?" / "What calls X?" / "Callers of X" -- Find files that use a symbol
- "Is X dead code?" / "Is X unused?" -- Check if symbol has no usage
- "What domain is X in?" / "Which area is X in?" -- Find conceptual grouping
- "What if I delete X?" / "Impact of deleting X" / "What breaks if I remove X?" -- Impact analysis
- "Where is Symbol defined?" / "Find X" / "Definition of X" -- Locate symbol
- "What does X export?" / "Exports of X" -- List exported symbols from a file
</context>

<process>

## 0. Preflight Check

Follow the MegaMemory Project Exists Preflight Check from @preflight-check-project-exists.md.

## 1. Parse Question Intent

```
const input = "$ARGUMENTS" || ""
const lowerInput = input.toLowerCase()

let intent = "GENERAL"
let target = null

// Detect intent patterns (order matters for specificity)

if (lowerInput.includes("import") && (lowerInput.includes("what") || lowerInput.includes("who") || lowerInput.includes("which"))) {
  intent = "IMPORTERS"
  target = extractTarget(input, ["import", "imports", "file"])
}
else if (lowerInput.includes("uses") || lowerInput.includes("callers") || lowerInput.includes("calls") || lowerInput.includes("who uses") || lowerInput.includes("what uses")) {
  intent = "USERS"
  target = extractTarget(input, ["uses", "callers", "calls", "who uses", "what calls"])
}
else if (lowerInput.includes("dead") || lowerInput.includes("unused") || lowerInput.includes("orphan")) {
  intent = "DEAD_CHECK"
  target = extractTarget(input, ["dead", "unused", "orphan", "is"])
}
else if (lowerInput.includes("domain") || lowerInput.includes("area") || lowerInput.includes("module") || lowerInput.includes("belongs")) {
  intent = "DOMAIN"
  target = extractTarget(input, ["domain", "area", "module", "belongs to", "in"])
}
else if (lowerInput.includes("delete") || lowerInput.includes("remove") || lowerInput.includes("break") || lowerInput.includes("impact") || lowerInput.includes("affect")) {
  intent = "IMPACT"
  target = extractTarget(input, ["delete", "remove", "break", "impact", "affect"])
}
else if (lowerInput.includes("where") || lowerInput.includes("find") || lowerInput.includes("defined") || lowerInput.includes("definition") || lowerInput.includes("locate")) {
  intent = "LOCATE"
  target = extractTarget(input, ["where", "find", "defined", "definition", "locate"])
}
else if (lowerInput.includes("export") || lowerInput.includes("provides") || lowerInput.includes("exposes")) {
  intent = "EXPORTS"
  target = extractTarget(input, ["export", "exports", "provides", "exposes"])
}
else {
  intent = "GENERAL"
  target = extractTarget(input, [])
}
```

**Helper: extractTarget(input, keywords)**

```
function extractTarget(input, keywordsToRemove) {
  let cleaned = input
  for (const keyword of keywordsToRemove) {
    cleaned = cleaned.replace(new RegExp(keyword, 'gi'), '')
  }
  // Remove common question words
  cleaned = cleaned.replace(/^(what|who|which|where|how|is|are|the|a|an|does|do|if|i|of)\s+/gi, '')
  cleaned = cleaned.replace(/\?/g, '').trim()

  // Extract the likely target (capitalized word, or quoted string, or last significant word)
  const quoted = cleaned.match(/["']([^"']+)["']/)
  if (quoted) return quoted[1]

  const capitalized = cleaned.match(/\b([A-Z][a-zA-Z0-9_]*)\b/)
  if (capitalized) return capitalized[1]

  // Last word as fallback
  const words = cleaned.split(/\s+/).filter(w => w.length > 2)
  return words[words.length - 1] || cleaned
}
```

## 2. Query MegaMemory

**Step 2.1: Build query based on intent**

| Intent | Query Pattern | Check Field |
|--------|---------------|-------------|
| IMPORTERS | `file:${target}` (fuzzy) | `incoming_edges` where `relation === 'imports'` |
| USERS | `symbol:${target}` | `incoming_edges` where `relation === 'uses'` |
| DEAD_CHECK | `dead-code:${target}` OR `symbol:${target}` | Existence + `incoming_edges` |
| DOMAIN | `symbol:${target}` | `edges` for grouping relations |
| IMPACT | `file:${target}` OR `symbol:${target}` | All `incoming_edges` |
| LOCATE | `symbol:${target}` | `edges` where `relation === 'defined_in'` |
| EXPORTS | `file:${target}` | `edges` where `relation === 'exports'` |
| GENERAL | `${target}` (semantic) | Depends on results |

**Step 2.2: Execute primary query**

```
let query = ""
switch (intent) {
  case "IMPORTERS":
    query = `file ${target}`
    break
  case "USERS":
  case "DEAD_CHECK":
  case "LOCATE":
    query = `symbol ${target}`
    break
  case "IMPACT":
    query = `file symbol ${target}`
    break
  case "EXPORTS":
    query = `file ${target}`
    break
  default:
    query = target
}

const result = await megamemory_understand(query=query, top_k=20)
```

## 3. Process Results

**Step 3.1: Check if results found**

If `result.matches.length === 0`:
- Set `useFallback = true`
- Skip to Step 4 (Fallback to Grep)

**Step 3.2: Filter to relevant concept type**

```
let relevantMatches = result.matches.filter(m => {
  if (intent === "IMPORTERS" || intent === "EXPORTS") {
    return m.name.startsWith("file:")
  }
  if (["USERS", "DEAD_CHECK", "LOCATE", "DOMAIN"].includes(intent)) {
    return m.name.startsWith("symbol:") || m.name.startsWith("dead-code:")
  }
  return true
})

if (relevantMatches.length === 0) {
  useFallback = true
}
```

## 4. Fallback to Grep

If `useFallback === true`:

```
Display: "Not found in import graph, using grep fallback..."

let grepResults = []

switch (intent) {
  case "IMPORTERS":
    // grep for import statements referencing the target
    grep -rn "import.*${target}" --include="*.dart" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.py" --include="*.go"
    break
  case "USERS":
    // grep for symbol usage
    grep -rn "${target}" --include="*.dart" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.py" --include="*.go"
    break
  case "LOCATE":
    // grep for definitions
    grep -rn "class ${target}\|function ${target}\|const ${target}\|def ${target}\|func ${target}" --include="*.dart" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.py" --include="*.go"
    break
  default:
    grep -rn "${target}" --include="*.dart" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.py" --include="*.go"
}
```

Parse grep results and format similar to MegaMemory output.

## 5. Format Output

### IMPORTERS Output

```
---------------------------------------------------
  Fuska: What imports ${target}?
---------------------------------------------------

Files that import ${filePath}:

${importers.map(f => `- ${f.path}:${f.line}`).join('\n')}

Total: ${importers.length} files
```

### USERS Output

```
---------------------------------------------------
  Fuska: Who uses ${target}?
---------------------------------------------------

Files that use symbol '${target}':

${users.map(u => `- ${u.file}${u.method ? ` (${u.method})` : ''}`).join('\n')}

Total: ${users.length} files

Symbol defined in: ${definitionFile}
```

### DEAD_CHECK Output (Yes)

```
---------------------------------------------------
  Fuska: Is ${target} dead code?
---------------------------------------------------

**Yes, likely dead code.**

Reason: No incoming 'uses' edges found.

Evidence:
- Symbol '${target}' has no incoming 'uses' edges
- Detected as dead on: ${detectedAt}

${relatedDead.length > 0 ? `Related dead code in same file:\n${relatedDead.map(r => `- ${r}`).join('\n')}` : ''}

Recommendation: Safe to delete after verifying no dynamic usage.
```

### DEAD_CHECK Output (No)

```
---------------------------------------------------
  Fuska: Is ${target} dead code?
---------------------------------------------------

**No, not dead code.**

Used by ${users.length} files:
${users.slice(0, 10).map(u => `- ${u.file}`).join('\n')}
${users.length > 10 ? `... and ${users.length - 10} more` : ''}

Symbol defined in: ${definitionFile}
```

### IMPACT Output

```
---------------------------------------------------
  Fuska: Impact of deleting ${target}
---------------------------------------------------

**Warning: ${affectedCount} files would be affected**

Direct importers (would break):
${importers.slice(0, 10).map(f => `- ${f.path}`).join('\n')}
${importers.length > 10 ? `... and ${importers.length - 10} more` : ''}

${symbols.length > 0 ? `Symbols that would be unavailable:\n${symbols.map(s => `- ${s.name} (used by ${s.userCount} files)`).join('\n')}` : ''}

Recommendation: ${importers.length > 0 ? 'Not safe to delete without migration' : 'Appears safe to delete (no direct importers found)'}
```

### LOCATE Output

```
---------------------------------------------------
  Fuska: Where is ${target} defined?
---------------------------------------------------

Symbol: ${target}
Type: ${symbolType}
File: ${filePath}
Signature: ${signature}

${methods.length > 0 ? `Methods: ${methods.join(', ')}` : ''}
```

### EXPORTS Output

```
---------------------------------------------------
  Fuska: What does ${target} export?
---------------------------------------------------

File: ${filePath}

Exported symbols:
${exports.map(e => `- ${e.name} (${e.type})`).join('\n')}

Total: ${exports.length} symbols
```

### GENERAL Output

```
---------------------------------------------------
  Fuska: ${input}
---------------------------------------------------

${matches.length > 0 ? `Found ${matches.length} related concepts:\n\n${matches.map(m => {
  const data = JSON.parse(m.summary)
  return `**${m.name}** (${m.kind})\n${data.path || data.file || ''}`
}).join('\n\n')}` : 'No results found in import graph.'}
```

</process>

<success_criteria>
- [ ] Preflight check completed
- [ ] Question intent detected correctly
- [ ] Target extracted from question
- [ ] MegaMemory queried with appropriate pattern
- [ ] Results filtered to relevant concept types
- [ ] Fallback to grep executed if no results
- [ ] Output formatted according to question type
- [ ] All output includes clear header and structure
</success_criteria>
