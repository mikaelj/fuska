---
name: fuska-map-domains
description: Discover business domains in codebase for MegaMemory
argument-hint: "[optional: specific area to focus on]"
agent: fuska-codebase-mapper
tools:
  - read
  - bash
  - glob
  - grep
  - megamemory:understand
  - megamemory:create_concept

---

<objective>
Discover business domains in the codebase and create SEPARATE MegaMemory concepts - one per business area.

Each domain concept represents a distinct business concern (pricing, booking, auth, etc.) with specific file references.

This is a fast, focused operation that only maps domains - use `fuska map` for full codebase analysis.
</objective>

<megamemory_guide>

## How to read MegaMemory responses

All project data lives in MegaMemory. If a MegaMemory query returns no results, tell the user the data wasn't found.

**`megamemory:understand` returns:**
```json
{ "matches": [ { "id": "domain-pricing", "name": "domain-pricing", "kind": "domain", "summary": "...", "file_refs": [...] } ] }
```

The important field is **`summary`** — it's a JSON string containing the concept's data. If `matches` is empty, the concept doesn't exist.

**`megamemory:create_concept` returns:** `{id, message}` on success.

</megamemory_guide>

<context>

**This command:**
- Discovers business domains (pricing, auth, booking, etc.)
- Creates separate `domain-{name}` concepts for each
- Fast operation (~1 minute)

**Use `fuska map` (without --domains-only) for:**
- Full codebase analysis (tech, arch, quality, concerns + domains)
- Initial codebase setup

</context>

<process>

### 1. Preflight Check

Display: "Checking MegaMemory connectivity..."

**Ping MCP with a simple query:**
```
megamemory_understand(query="connectivity-ping", top_k=1)
```

If tool call fails or returns `MEGAMEMORY_ERROR:`:
→ Display: "MegaMemory MCP server is not responding. Check MCP configuration and restart."
→ Stop

If any response (even empty matches): MCP is working, continue.

### 2. Get Project Root

```bash
pwd
```

Store result as `$PROJECT_ROOT`.

Display: "Project root: ${PROJECT_ROOT}"

### 3. Spawn Domain Mapper

Display: "Spawning domain mapper agent..."

@../../fuska/references/domain-mapping-task.md

### 4. Verify Domains

Display: "Verifying domain concepts..."

**Query domain concepts:**
```
megamemory_understand(query="domain", top_k=50)
```

**Validate domain concepts:**

Verify:
- [ ] At least 3 domain concepts exist
- [ ] All are named domain-{name} (not codebase-domains)
- [ ] All have kind: 'domain' (not 'pattern')
- [ ] Each has specific file_refs (not shared across all)

If any domain concept is named codebase-* or has kind: 'pattern':
→ Display: "Warning: Domain concepts created incorrectly. Expected domain-{name} with kind: 'domain'"
→ List the incorrectly created concepts

If domain concepts found and valid:
→ Display: "Domains discovered: {list of domain names}"
→ Display: "[OK] Domain mapping complete"

### 5. Present Summary

```
---------------------------------------------------
  Fuska: Domains mapped
---------------------------------------------------

Domains discovered:
- domain-pricing (N files)
- domain-auth (N files)
- ...

N domain concepts created in MegaMemory

Use `fuska git-message <commit>` to get domain-aware scopes.
────────────────────────────────────────────────────────────
```

</process>

<success_criteria>
- [ ] MegaMemory connectivity verified
- [ ] Domain mapper agent spawned and completed
- [ ] 3+ domain concepts created with correct naming (domain-{name})
- [ ] All domain concepts have kind: 'domain'
- [ ] Each domain concept has specific file_refs
</success_criteria>
