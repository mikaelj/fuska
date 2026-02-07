---
name: gsd-mm-set-model
description: Configure models for a specific profile's stages (planning/execution/verification) using MegaMemory config
arguments:
  - name: profile
    description: "Profile name: quality, balanced, or budget (optional - will prompt if not provided)"
    required: false
agent: gsd-mm-set-model
tools:
  - read
  - bash
  - question

  - megamemory:understand
  - megamemory:update_concept
  - megamemory:list_roots
---

<objective>
Configure the models assigned to each stage (planning, execution, verification) for a specific profile in the MegaMemory config concept.

Unlike `/gsd-mm-set-profile` which switches between profiles, this command lets you define *what models* a profile uses. Implementation lives in the `gsd-mm-set-model` agent.
</objective>

<execution_context>
@~/.config/opencode/gsd-mm/references/preflight-check-project-exists.md
@~/.config/opencode/gsd-mm/scripts/types.ts
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

Run the model configuration flow using the `gsd-mm-set-model` agent.

The agent should:

1. Query the config concept from MegaMemory
2. Extract available models from the config
3. Prompt user to select profile (if not provided)
4. For each stage (planning, execution, verification), prompt user to select model
5. Update the config concept with new model assignments
6. Display confirmation with updated model assignments

</process>

<examples>

**Configure the balanced profile:**

```text
/gsd-mm-set-model balanced

Configuring models for: balanced

Select model for Planning stage:
> anthropic/claude-sonnet-4-20250514

Select model for Execution stage:
> anthropic/claude-sonnet-4-20250514

Select model for Verification stage:
> openai/gpt-4o-mini

✓ Updated balanced profile:
| Stage | Model |
|-------|-------|
| planning | anthropic/claude-sonnet-4-20250514 |
| execution | anthropic/claude-sonnet-4-20250514 |
| verification | openai/gpt-4o-mini |
```

**Interactive mode (no argument):**

```text
/gsd-mm-set-model

Which profile do you want to configure?
> Balanced

Configuring models for: balanced
...
```

</examples>

<success_criteria>

- [ ] Config concept exists in MegaMemory (or clear error shown)
- [ ] User selects a profile (or provides via argument)
- [ ] User selects models for all three stages from available models
- [ ] Profile preset is updated in config concept
- [ ] If the modified profile is active, opencode.json is regenerated (via agent)
- [ ] Clear confirmation shown with updated model assignments

</success_criteria>
