---
name: fuska
description: Universal Fuska entry point — navigate, plan, execute, and more
argument-hint: "[verb] [args]"
tools:
  - read
  - write
  - edit
  - glob
  - grep
  - bash

  - question
  - task
  - webfetch
  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
  - megamemory:list_roots
  - megamemory:delete_concept
---

<objective>

Universal dispatch for Fuska. One command for everything.

- `/fuska` — show where you are and what to do next
- `/fuska plan` — plan the current chapter (auto-detects chapter number)
- `/fuska build` — build the current chapter
- `/fuska do fix the bug` — quick ad-hoc task
- `/fuska [verb] [args]` — any Fuska action

**Bare invocation:** Read MegaMemory state. Show the full chapter pipeline with current position marked. Explain what each step does and show the command to run it.

**Verb invocation:** Parse verb, auto-detect missing arguments (chapter number), read the target command file, resolve its `@` references, follow its process.

All `/fuska-*` commands remain available for direct use. This command is the universal entry point that routes to them.

</objective>

<execution_context>

@../../fuska/references/megamemory-quick-ref.md

</execution_context>

<context>
Arguments: `$ARGUMENTS`
</context>

<process>

## 0. Parse Input

```
const input = "$ARGUMENTS" || ""
const words = input.trim().split(/\s+/).filter(w => w)
const verb = words[0]?.toLowerCase() || null
const effectiveArgs = words.slice(1).join(" ")
```

If verb is null or empty → go to **Step 1: Navigator Mode**

Check verb against dispatch table (Step 2.1). If matched → go to **Step 2: Verb Dispatch**

Otherwise → go to **Step 3: Unknown Verb**

---

## 1. Navigator Mode

### 1.1 Check MegaMemory

```
megamemory:list_roots()
```

**If tool call fails or returns `MEGAMEMORY_ERROR:`:**

Display:

    MegaMemory MCP server is not responding.

    To fix:
    1. Ensure MegaMemory is installed (npm install megamemory)
    2. Check your MCP server configuration points to megamemory executable
    3. Restart your editor to start the MCP server

→ Stop

**If roots is empty:**

Display:

    No initiative here yet.

        fuska init "My Project"

    Then /fuska to see what's next.

→ Stop

### 1.2 Load project state

Store initiative info from roots (first root, or use config's `current_initiative` to pick the right one).

```
megamemory:understand({ query: "config", top_k: 5 })
```

Extract `current_initiative`, `projectName` from config/initiative root.

```
megamemory:understand({ query: "state", top_k: 5 })
megamemory:understand({ query: "roadmap", top_k: 5 })
```

Store `stateData`, `roadmapData`.

**If no config concept or no roadmap concept exists** → state is `INIT_ONLY`.

### 1.3 Check for paused work

```
megamemory:understand({ query: "handoff", top_k: 3 })
```

If a handoff concept exists with status that is NOT "resolved" → state is `PAUSED`.

### 1.4 Classify lifecycle position

Extract from state:
```
const currentChapterSlug = stateData.current_chapter
const chapterNumber = parseInt(currentChapterSlug?.replace("chapter-", "")) || 1
```

Query current chapter and related concepts:
```
megamemory:understand({ query: currentChapterSlug, top_k: 20 })
```

From results, look for:
- Chapter concept itself (name matches `chapter-NN`, kind is "feature")
- Context concept (name is `${currentChapterSlug}-context`)
- Plan concepts (name contains `${currentChapterSlug}` and contains `-plan-`)
- Summary concepts (name contains `${currentChapterSlug}` and contains `-summary`)

Extract:
- `chapterName` — from chapter concept summary
- `chapterGoal` — from chapter concept summary
- `contextExists` — whether context concept was found
- `planConcepts` — array of plan concepts
- `summaryConcepts` — array of summary concepts
- `planCount` = planConcepts.length
- `summaryCount` = summaryConcepts.length

From roadmap:
- `totalChapters` — number of chapters in roadmap
- `completedChapters` — chapters with status "complete"

**Classification:**

```
if (!configExists || !roadmapExists)     → INIT_ONLY
if (handoffExists && !handoffResolved)   → PAUSED
if (planCount === 0 && !contextExists)   → CHAPTER_START
if (planCount === 0 && contextExists)    → DISCUSSED
if (planCount > 0 && summaryCount < planCount) → PLANNED
if (planCount > 0 && summaryCount >= planCount) → CHAPTER_DONE
if (all roadmap chapters complete)         → MILESTONE_DONE
```

### 1.5 Display pipeline

Output depends on classified state. Use the exact format below — no markdown headers in the pipeline area, no decorative borders, no progress bars. Plain indented text.

The pipeline always shows four steps for the current chapter. `>` marks the current position. `done` marks completed steps. Future steps show their `/fuska` command.

**INIT_ONLY:**

```
Fuska: ${projectName} — needs configuration

    /fuska-configure

This walks you through questioning, research,
requirements, and roadmap creation.
```

→ Stop

**PAUSED:**

```
Fuska: ${projectName} — paused

You left off at Chapter ${chapterNumber}: ${chapterName}
${handoffData.mental_context ? handoffData.mental_context : ''}

    /fuska-resume
```

→ Stop

**CHAPTER_START:**

```
Fuska: ${projectName}${completedChapters > 0 ? ' -- ' + completedChapters + '/' + totalChapters + ' chapters complete' : ''}

Chapter ${chapterNumber} of ${totalChapters}: ${chapterName}

    share your vision    /fuska-design    (optional, helps me plan better)
  > plan into tasks      /fuska-plan
    build it             /fuska-build
    check it works       /fuska-review

You can tell me how you imagine this chapter working, or I'll plan
directly from the requirements. Either way, planning is next.
```

→ Stop

**DISCUSSED:**

```
Fuska: ${projectName}${completedChapters > 0 ? ' -- ' + completedChapters + '/' + totalChapters + ' chapters complete' : ''}

Chapter ${chapterNumber} of ${totalChapters}: ${chapterName}

    share your vision    done
  > plan into tasks      /fuska-plan
    build it             /fuska-build
    check it works       /fuska-review

Your thinking is captured. Next: I'll break this into concrete tasks.
```

→ Stop

**PLANNED:**

Derive batch count from plan concepts (max batch number).

```
Fuska: ${projectName}${completedChapters > 0 ? ' -- ' + completedChapters + '/' + totalChapters + ' chapters complete' : ''}

Chapter ${chapterNumber} of ${totalChapters}: ${chapterName}

    share your vision    ${contextExists ? 'done' : 'skipped'}
    plan into tasks      done -- ${planCount} tasks${batchCount > 1 ? ' in ' + batchCount + ' batches' : ''}
  > build it             /fuska-build
    check it works       /fuska-review

Ready to build.${batchCount > 1 ? ' Tasks run grouped by batch.' : ''}
```

→ Stop

**CHAPTER_DONE:**

Check if there is a next chapter in the roadmap.

```
Fuska: ${projectName} -- ${completedChapters + 1}/${totalChapters} chapters complete

Chapter ${chapterNumber} of ${totalChapters}: ${chapterName}

    share your vision    ${contextExists ? 'done' : 'skipped'}
    plan into tasks      done
    build it             done
  > check it works       /fuska review

Built. Walk through what was created and verify it works.

${nextChapterExists ? 'Or move to the next chapter:\n    /fuska plan ' + (chapterNumber + 1) : ''}
```

→ Stop

**MILESTONE_DONE:**

```
Fuska: ${projectName} -- all ${totalChapters} chapters complete

    /fuska complete

Archive this milestone and prepare for what's next.

Or audit first:
    /fuska audit
```

→ Stop

---

## 2. Verb Dispatch

### 2.1 Dispatch table

| Verb | Target file | Auto-detect chapter |
|------|------------|-------------------|
| plan | fuska-plan.md | yes |
| design | fuska-design.md | yes |
| build | fuska-build.md | yes |
| review | fuska-review.md | yes |
| research | fuska-research-chapter.md | yes |
| assumptions | fuska-list-chapter-assumptions.md | yes |
| do | fuska-do.md | no |
| debug | fuska-debug.md | no |
| pause | fuska-pause-work.md | no |
| resume | fuska-resume.md | no |
| todo | fuska-add-todo.md | no |
| todos | fuska-check-todos.md | no |
| configure | fuska-configure.md | no |
| map | fuska-map-codebase.md | no |
| help | fuska-help.md | no |
| add | fuska-add-chapter.md | no |
| insert | fuska-insert-chapter.md | no |
| remove | fuska-remove-chapter.md | no |
| complete | fuska-complete.md | no |
| milestone | fuska-new-milestone.md | no |
| audit | fuska-audit.md | no |
| gaps | fuska-plan-milestone-fixes.md | no |
| doc | fuska-doc.md | no |
| export | fuska-export-md.md | no |
| import | fuska-import.md | no |
| refresh | fuska-refresh.md | no |
| ask | fuska-ask.md | no |

### 2.2 Auto-detect chapter number

If the verb has "Auto-detect chapter: yes" AND effectiveArgs does not start with a number:

```
megamemory:understand({ query: "state", top_k: 5 })
const stateData = JSON.parse(response.matches[0].summary)
const chapterNumber = parseInt(stateData.current_chapter?.replace("chapter-", "")) || 1
effectiveArgs = chapterNumber + (effectiveArgs ? " " + effectiveArgs : "")
```

### 2.3 Read target command file

Read the target file from: ~/.config/opencode/commands/fuska/{target}

For example, if verb is "design", read:
    ~/.config/opencode/commands/fuska/fuska-design.md

### 2.4 Resolve @ references

Each `@` path is relative to the command file's directory:
- `@../../fuska/references/X.md` → ~/.config/opencode/fuska/references/X.md
- `@../../fuska/scripts/X.ts` → ~/.config/opencode/fuska/scripts/X.ts
- `@../../fuska/templates/X.md` → ~/.config/opencode/fuska/templates/X.md

Construct absolute paths and read each referenced file.

### 2.5 Execute target process

You now have:
- The target command file content (objective, megamemory_guide, context, process, success_criteria)
- The resolved `@` reference contents
- `effectiveArgs` as the value for `$ARGUMENTS`

Follow the target command's `<process>` as if you were executing that command directly. Use the target's `<objective>` to understand purpose. Apply the target's `<megamemory_guide>` for MegaMemory operations. Substitute `effectiveArgs` wherever the process references `$ARGUMENTS`.

The `@` reference content serves as execution context — the same role it would play if the command were invoked directly.

---

## 3. Unknown Verb

If verb does not match any entry in the dispatch table:

Known verbs: plan, design, build, review, research, assumptions, do, debug, pause, resume, todo, todos, configure, map, help, add, insert, remove, complete, milestone, audit, gaps, doc, export, import, refresh, ask.

Find the verb with smallest edit distance (simple character comparison is fine — no need for full Levenshtein).

If a close match exists (differs by 1-2 characters):

```
Unknown verb: "${verb}". Did you mean "${closestVerb}"?

    /fuska ${closestVerb} ${effectiveArgs}
```

If no close match:

```
Unknown verb: "${verb}".

/fuska help to see all commands, or just /fuska to see what's next.
```

→ Stop

</process>

<success_criteria>

**Navigator mode:**
- [ ] MegaMemory connectivity verified
- [ ] Project state loaded (config, state, roadmap)
- [ ] Lifecycle position correctly classified
- [ ] Full chapter pipeline displayed with current position marked
- [ ] Each pipeline step shows human description + command
- [ ] Explanatory text matches current state
- [ ] No decorative borders, no progress bar graphics

**Verb dispatch:**
- [ ] Verb correctly parsed from $ARGUMENTS
- [ ] Chapter number auto-detected from MegaMemory state when needed
- [ ] Target command file read successfully
- [ ] All @ references from target resolved and read
- [ ] Target process executed with effectiveArgs as $ARGUMENTS

**Unknown verb:**
- [ ] Close match suggested when edit distance is small
- [ ] Helpful fallback when no close match

</success_criteria>
