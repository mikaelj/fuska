# Opinkode Pitfalls

Known issues and gotchas when authoring commands, agents, and references for OpenCode.

## YAML frontmatter: quote `@` values

**Problem:** Unquoted `@` at the start of a YAML value breaks frontmatter parsing in OpenCode. The `@` character is reserved in YAML 1.1 (used by gray-matter/js-yaml), so values like `agent: @../../agents/foo.md` can cause the YAML parser to fail silently.

**Symptoms:**
- Command shows as `/fuska/fuska-foo` instead of `/fuska-foo` (directory prefix leaks into slug)
- Description is missing from the command list
- The `name:` frontmatter field is ignored, falling back to the file-path-based name

**Root cause:** OpenCode derives command slugs from the file path (e.g., `commands/fuska/fuska-foo.md` -> `fuska/fuska-foo`), then lets the frontmatter `name:` field override it. When YAML parsing fails on the `@` character, the frontmatter data is empty, so `name:` and `description:` are never read.

**Fix:** Always quote `@` references in frontmatter values:

```yaml
# Bad - breaks YAML parsing
agent: @../../agents/fuska/fuska-planner.md

# Good
agent: "@../../agents/fuska/fuska-planner.md"
```

**Affected fields:** Any frontmatter value starting with `@`, most commonly `agent:`.

**Reference:** OpenCode source at `packages/opencode/src/config/config.ts` (`loadCommand` function) and `packages/opencode/src/config/markdown.ts` (`ConfigMarkdown.parse`).
