# Plan: Standardize Command Flags Location

**Created:** 2026-02-21
**Status:** Not started
**Estimated effort:** ~1 hour

## Problem

Command flags are defined inconsistently across command files, making validation and maintenance difficult:

| Command | Where flags are defined |
|---------|------------------------|
| `fuska-do` | `argument-hint` frontmatter + "Flags:" section in help output |
| `fuska-refresh` | `argument-hint` frontmatter (`[--full] [--dead-code]...`) |
| `fuska-doc` | `argument-hint` frontmatter (`[--type TYPE]...`) |
| `fuska-debug` | "Modes:" in help output, no explicit flags |

The CLI help command (`fuska help <cmd>`) uses a hardcoded lookup table in `src/commands/help.ts` that must be manually synced with command files.

## Solution

1. Add a standardized `flags:` field in YAML frontmatter for all commands
2. Create a validation script that compares frontmatter flags against `help.ts`
3. Run validation at build time (before `npm publish`)

---

## Part A: Add `flags:` Frontmatter Field

**Location:** `provider/opinkode/command/fuska/*.md`

**Format:**
```yaml
---
name: fuska-do
description: Execute unplanned tasks...
argument-hint: "[mode] [description]"
flags: --review, --no-review, --auto-commit
---
```

**Rules:**
- Comma-separated list of flags
- Flags without descriptions (descriptions stay in help output blocks for human readability)
- Commands without flags omit the field or use `flags:` with empty value

### Files to Update

| File | Flags to Add |
|------|--------------|
| `provider/opinkode/command/fuska/fuska-do.md` | `flags: --review, --no-review, --auto-commit` |
| `provider/opinkode/command/fuska/fuska-refresh.md` | `flags: --full, --dead-code, --json, --prune` |
| `provider/opinkode/command/fuska/fuska-doc.md` | `flags: --type, --audience, --depth, --output` |
| `provider/opinkode/command/fuska/fuska-debug.md` | Omit (no flags) |
| `provider/opinkode/command/fuska/fuska-ask.md` | Omit (no flags) |

---

## Part B: Create Validation Script

**File:** `scripts/validate-help-sync.ts`

**Logic:**
```
For each command in help.ts (do, refresh, doc, debug, ask):
  1. Find matching command file (provider/opinkode/command/fuska/fuska-{cmd}.md)
  2. Parse YAML frontmatter, extract `flags:` field
  3. Parse help.ts commandHelp[cmd], extract flags from "Flags:" section
  4. Compare sets (order-independent, whitespace-normalized)
  5. Report: ✓ match or ✗ mismatch with details

Exit 0 if all match, 1 if any mismatch
```

**Extraction from frontmatter:**
```typescript
const flags = frontmatter.flags?.split(',').map(f => f.trim()).filter(Boolean) || [];
```

**Extraction from help.ts:**
```typescript
const flagsMatch = helpText.match(/Flags:\n((?:  --[\w-]+.*\n?)+)/);
const flags = flagsMatch[1].match(/--[\w-]+/g) || [];
```

---

## Part C: Update Build Process

**File:** `package.json`

Add validation script and integrate into prepare hook:

```json
{
  "scripts": {
    "validate:help": "ts-node scripts/validate-help-sync.ts",
    "prepare": "npm run validate:help && npm run build"
  }
}
```

This ensures:
- Validation runs before `npm publish` (via `prepare` hook)
- Not at runtime (only package distributors run `prepare`)
- Build fails early if flags are out of sync

---

## Part D: Document Sync Requirement

**File:** `AGENTS.md`

Add to Code Conventions section:

```markdown
## CLI Help Sync

The CLI `fuska help <cmd>` uses a hardcoded lookup table in `src/commands/help.ts`. 

Command flags are defined in two places:
1. `flags:` field in command file frontmatter (source of truth)
2. `commandHelp` object in `src/commands/help.ts` (must stay in sync)

When adding or modifying command flags:
1. Update `flags:` in `provider/opinkode/command/fuska/fuska-{cmd}.md`
2. **Manually sync** to `src/commands/help.ts`

A validation script (`npm run validate:help`) catches mismatches at build time.
Run it locally before committing flag changes.
```

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `provider/opinkode/command/fuska/fuska-do.md` | Edit | Add `flags:` to frontmatter |
| `provider/opinkode/command/fuska/fuska-refresh.md` | Edit | Add `flags:` to frontmatter |
| `provider/opinkode/command/fuska/fuska-doc.md` | Edit | Add `flags:` to frontmatter |
| `scripts/validate-help-sync.ts` | Create | Parse frontmatter + help.ts, compare flags |
| `package.json` | Edit | Add `validate:help` script, update `prepare` |
| `AGENTS.md` | Edit | Document sync requirement |

---

## Testing

After implementation:

1. Run `npm run validate:help` — should pass (flags match)
2. Modify a flag in `help.ts` only — should fail
3. Modify `flags:` in command file only — should fail
4. Match both — should pass

---

## Future Enhancements (Out of Scope)

- Auto-generate `help.ts` from frontmatter at build time
- Add `--description` support in frontmatter for richer help
- Extend validation to check `argument-hint` consistency
