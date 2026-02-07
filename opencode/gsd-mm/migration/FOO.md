# Implementation Plan: `export-to-markdown.ts`

## Overview
Export MegaMemory knowledge graph back to old-style `.planning/` Markdown structure.

## Architecture

```typescript
// CLI Arguments
interface ExportOptions {
  projectDir: string;      // Path to project with .megamemory/
  outputDir: string;       // Output directory (created if not exists)
  overwrite: boolean;      // Overwrite existing files
  dryRun: boolean;         // Show what would be written
  debug: boolean;          // Show concept mapping details
  verbose: boolean;        // Detailed progress
}

// Concept Organization
interface OrganizedConcepts {
  projectRoot: ConceptMatch | null;
  requirements: ConceptMatch | null;
  roadmap: ConceptMatch | null;
  phases: Map<string, ConceptMatch>;  // phase-{number} -> concept
  phaseChildren: Map<string, PhaseChildren>;  // phase-{number} -> children
  research: ConceptMatch | null;
  researchDocs: Map<string, ConceptMatch>;  // research-{name} -> concept
  milestones: ConceptMatch | null;
  milestoneDocs: Map<string, ConceptMatch>;  // milestone-{slug} -> concept
  todos: ConceptMatch | null;
  todoItems: Map<string, ConceptMatch>;  // todo-{id} -> concept
  config: ConceptMatch | null;
  state: ConceptMatch | null;
  reqItems: ConceptMatch[];  // req-{id} items
}

interface PhaseChildren {
  context: ConceptMatch | null;
  plans: Map<number, ConceptMatch>;      // plan number -> concept
  research: ConceptMatch | null;
  summaries: Map<number, ConceptMatch>;   // plan number -> concept
  uat: ConceptMatch | null;
}
```

## Step-by-Step Implementation

### 1. Setup & CLI Parser (Lines 1-80)
- Import dependencies: `commander`, `fs-extra`, `path`, `megamemory/dist/db.js`
- Import helpers: `extractJson`, `generateContextMarkdown`, `generatePlanMarkdown`, `generateSummaryMarkdown`, `generateResearchMarkdown`, `generateUATMarkdown`
- Define `ExportOptions` interface
- Implement `parseArguments()` using `commander`
- Validate paths exist

### 2. MegaMemory Client (Lines 81-130)
- `loadMegaMemory(projectDir: string)` - returns `KnowledgeDB`
- Query all concepts: `await db.understand('', 10000)`
- Build lookup maps:
  - `byId: Map<string, ConceptMatch>`
  - `byName: Map<string, ConceptMatch>`
  - `byParent: Map<string | null, ConceptMatch[]>`

### 3. Concept Organization (Lines 131-300)
`organizeConcepts(allConcepts: ConceptMatch[]): OrganizedConcepts`

Categorization rules:
- `feature` + `parent=null` + `name != 'Project'` → project root (project slug)
- `feature` + `name='Project'` → skip (legacy concept)
- `module` + `name='requirements'` → requirements module
- `feature` + `name.startsWith('req-')` → requirement items
- `module` + `name='roadmap'` → roadmap module
- `feature` + `name.match(/^phase-\d+$/)` → phase roots
- `config` + `name.match(/^-context$/)` → context files
- `feature` + `name.match(/^-plan-\d+$/)` → plan files
- `pattern` + `name.match(/^-research$/)` → research files
- `component` + `name.match(/^-plan-\d+-summary$/)` → summary files
- `component` + `name.match(/^-uat$/)` → UAT files (export as VERIFICATION.md)
- `module` + `name='research'` → research module
- `pattern` + `name.startsWith('research-')` → research documents
- `module` + `name='milestones'` → milestones module
- `feature` + `name.startsWith('milestone-')` → milestone documents
- `module` + `name='todos'` → todos module
- `feature` + `name.startsWith('todo-')` → todo items
- `config` + `name='config'` → config concept
- `config` + `name='state'` → state concept

### 4. Phase Directory Name Extraction (Lines 301-400)
`determinePhaseDirName(phaseConcept: ConceptMatch): string`

Priority strategy:
```typescript
// Priority 1: Extract JSON metadata from summary
const data = extractJson(phaseConcept.summary);
if (data.number && data.slug) {
  return `${data.number}-${data.slug}`;
}

// Priority 2: Parse from text "phase N: slug"
const match = phaseConcept.summary.match(/phase\s+(\d+):\s+([a-z0-9-]+)/i);
if (match) {
  return `${match[1]}-${match[2]}`;
}

// Priority 3: Fallback to concept name
const phaseNum = phaseConcept.name.replace('phase-', '');
return `${phaseNum}-unknown`;
```

### 5. Markdown Generators (Lines 401-700)

All generators receive: `concept: ConceptMatch`, `allConcepts: ConceptMatch[]`

**`generateProjectMarkdown(concept, reqItems): string`**
- Extract project data from summary
- Generate with sections: Validated, Active, Out of Scope

**`generatePlanMarkdown(concept, allConcepts): string`**
- Use existing helper from `helpers.ts:160`
- Add @-references from edges with `relation === 'depends_on'`
- Format: `@ref1, ref2, ref3` before tasks section

**`generateSummaryMarkdown(concept): string`**
- Use existing helper from `helpers.ts:195`
- Include JSON + markdown content

**`generateContextMarkdown(concept): string`**
- Use existing helper from `helpers.ts:126`
- Format with XML-like tags

**`generateVerificationMarkdown(concept): string`**
- Use existing helper from `helpers.ts:297`
- YAML frontmatter with verification fields

**`generateConfigJson(concept): string`**
- Extract JSON from summary using `extractJson()`
- Return as formatted JSON string (no schema required)

### 6. File Writing (Lines 701-900)

**`safeWrite(filePath: string, content: string, options: ExportOptions): boolean`**
- Check if file exists and `!overwrite` → skip
- Dry-run mode → log what would be written
- Create directory if needed
- Write file

**`ensurePlanningDirectories(outputDir: string): void`**
- Create `{outputDir}/.planning/`
- Create `{outputDir}/.planning/research/`
- Create `{outputDir}/.planning/phases/`
- Create `{outputDir}/.planning/todos/pending/`

**`writeExportedFiles(organized: OrganizedConcepts, options: ExportOptions): void`**
- Write project root files (PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md, MILESTONES.md, config.json)
- Write research documents to `research/`
- Write phase directories with all child files
- Write todo items to `todos/pending/`
- Skip empty files (check content.trim() length)

### 7. Main Execution Flow (Lines 901-1000)

```typescript
async function main(): Promise<void> {
  const options = parseArguments();

  console.log(`Exporting MegaMemory from: ${options.projectDir}`);
  console.log(`Output directory: ${options.outputDir}`);

  const db = await loadMegaMemory(options.projectDir);
  const allConcepts = await db.understand('', 10000);

  console.log(`Loaded ${allConcepts.matches.length} concepts`);

  const organized = organizeConcepts(allConcepts.matches);

  if (options.debug) {
    console.log('\n=== CONCEPT MAPPING ===');
    // Print mapping details
  }

  ensurePlanningDirectories(options.outputDir);
  writeExportedFiles(organized, options);

  console.log('\nExport complete!');
}
```

## Key Edge Cases

1. **Empty phase summaries:** Skip creating files
2. **Missing phase directory info:** Use fallback naming `{phaseNum}-unknown`
3. **Duplicate plan numbers:** Use concept order as fallback
4. **@-references with `to_name` missing:** Use `to` id instead
5. **Config concept without JSON:** Export empty `{}`
6. **Phase directories already exist:** Create if `--overwrite`, skip otherwise

## Testing Strategy

1. Run migration on `testproj/` (dry-run)
2. Run export on migrated `testproj/`
3. Compare output with original `.planning/`:
   ```bash
   diff -r testproj/.planning /tmp/export-output/.planning
   ```
4. Verify YAML frontmatter is preserved
5. Check @-references format
6. Confirm VERIFICATION.md (not -UAT.md)

## Files to Create

- **`gsd-mm/migration/export-to-markdown.ts`** - Main export script

## Files to Reference

- `gsd-mm/scripts/helpers.ts` - Markdown generation functions
- `gsd-mm/scripts/types.ts` - Type definitions
- `gsd-mm/scripts/phase-templates.ts` - Phase concept naming patterns
- `gsd-mm/scripts/project-templates.ts` - Project concept naming patterns
