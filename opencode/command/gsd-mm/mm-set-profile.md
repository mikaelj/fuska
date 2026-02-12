---
name: gsd-mm-set-profile
description: Switch model profile for GSD-MM agents (quality/balanced/budget) using MegaMemory config
arguments:
  - name: profile
    description: "Profile name: quality, balanced, or budget"
    required: true
agent: gsd-mm-set-profile
tools:
  - read
  - bash
  - question

  - megamemory:understand
  - megamemory:update_concept
  - megamemory:list_roots
---

<objective>
Switch the project's active model profile (quality/balanced/budget) in the MegaMemory config concept.

Implementation lives in the `gsd-mm-set-profile` agent so we don't duplicate the full switching/migration logic in multiple places.
</objective>

<execution_context>
@./opencode/gsd-mm/references/preflight-check-project-exists.md
@./opencode/gsd-mm/scripts/types.ts
@./opencode/gsd-mm/scripts/helpers.ts
</execution_context>

<megamemory_guide>

## How to read MegaMemory responses

All project data lives in MegaMemory. If a MegaMemory query returns no results, tell the user the data wasn't found.

**`megamemory:understand` returns:**
```json
{ "matches": [ { "id": "project/state", "name": "state", "kind": "config", "summary": "{\"current_phase\":\"phase-01\", ...}", "children": [...], "edges": [...] } ] }
```

The important field is **`summary`** — it's a JSON string containing the concept's data. Parse it to extract the fields you need. If `matches` is empty, the concept doesn't exist.

**`megamemory:update_concept` accepts changes:** `{summary?, name?, kind?, why?, file_refs?}` only. Pass the full updated JSON string as `summary`. Returns `{message}`.

**`megamemory:list_roots` returns:** an array of root concepts.

</megamemory_guide>

<process>

## 0. Preflight Check

Follow the MegaMemory Project Exists Preflight Check from @preflight-check-project-exists.md.

Run the profile switch using the `gsd-mm-set-profile` agent.

The agent should:

1. Query the config concept from MegaMemory
2. Validate the requested profile exists in config.profiles
3. Update config.active_profile to the requested profile
4. Update the config concept with new active profile
5. Regenerate opencode.json based on the new profile's model assignments
6. Display confirmation with the active profile and effective models

</process>

<examples>

**Switch to budget profile:**

```text
/gsd-mm-set-profile budget

✓ Active profile set to: budget

Effective models:
| Stage | Model |
|-------|-------|
| planning | anthropic/claude-haiku |
| execution | anthropic/claude-sonnet |
| verification | anthropic/claude-haiku |
```

**Switch to quality profile:**

```text
/gsd-mm-set-profile quality

✓ Active profile set to: quality

Effective models:
| Stage | Model |
|-------|-------|
| planning | anthropic/claude-opus |
| execution | anthropic/claude-opus |
| verification | anthropic/claude-sonnet |
```

</examples>

<success_criteria>

- [ ] Config concept exists in MegaMemory (or clear error shown)
- [ ] Requested profile exists in config.profiles
- [ ] Config.active_profile updated in config concept
- [ ] opencode.json regenerated with new model assignments
- [ ] Clear confirmation shown with active profile and effective models
</success_criteria>
