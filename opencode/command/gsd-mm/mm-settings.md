---
name: gsd-mm-settings
description: Configure GSD-MM model profiles and workflow settings using MegaMemory config concept
agent: gsd-mm-settings
tools:
  - read
  - bash
  - question

  - megamemory:understand
  - megamemory:update_concept
  - megamemory:list_roots
---

<objective>
Open an interactive settings menu for GSD-MM configuration.

This delegates the implementation to the `gsd-mm-settings` agent, which manages the config concept in MegaMemory and regenerates `opencode.json` when needed.
</objective>

<execution_context>
@~/.config/opencode/gsd-mm/references/preflight-check-project-exists.md
@~/.config/opencode/gsd-mm/scripts/helpers.ts
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

Run the interactive settings flow using the `gsd-mm-settings` agent.

The agent should:

1. Query the config concept from MegaMemory
2. Validate a GSD-MM project exists (config concept with proper structure)
3. Display current settings:
   - Active profile (config.active_profile)
   - Effective models for each stage (from the active profile)
   - Workflow toggles (config.workflow.*)
4. Present interactive UI for updates:
   - Switch profile
   - Toggle workflow settings (research, plan_check, etc.)
   - Configure models for specific profiles
5. Persist updates to the config concept via megamemory_update_concept
6. Regenerate opencode.json to reflect effective models
7. Display clear confirmation: "GSD-MM ► SETTINGS UPDATED"

</process>

<success_criteria>

- [ ] Config concept exists in MegaMemory (or a clear error is shown)
- [ ] Current settings are displayed (active profile, effective models, workflow toggles)
- [ ] User can update profile and workflow toggles via interactive UI
- [ ] Updates are persisted to the config concept
- [ ] opencode.json is regenerated/updated to reflect effective models
- [ ] A clear confirmation is shown ("GSD-MM ► SETTINGS UPDATED")

</success_criteria>
