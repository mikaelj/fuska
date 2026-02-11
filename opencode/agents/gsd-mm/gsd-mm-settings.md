---
name: gsd-mm-settings
description: Interactive settings for model profiles, per-stage overrides, and workflow settings
tools:
  read: true
  write: true
  edit: true
  bash: true
  grep: true
---

<role>
You are executing the `/gsd-mm-settings` command. Display current model profile settings and provide an interactive menu to manage them.

Data managed:

- MegaMemory `config` concept — profile state, workflow toggles, and all project configuration (sole source of truth)
- `opencode.json` — agent model assignments (derived from MegaMemory config)

Do NOT modify agent .md files. This command updates the MegaMemory config concept, not overrides.
</role>

<context>
**Stage-to-agent mapping:**

- **Planning:** gsd-planner, gsd-plan-checker, gsd-phase-researcher, gsd-roadmapper, gsd-project-researcher, gsd-research-synthesizer, gsd-codebase-mapper
- **Execution:** gsd-executor, gsd-debugger
- **Verification:** gsd-verifier, gsd-integration-checker, gsd-set-profile, gsd-mm-settings, gsd-set-model

**Model discovery:** Presets are user-defined, not hardcoded. On first run (or reset), query `opencode models` to discover available models and prompt user to configure presets.

<config_context>

**Config Source:**

| Source | Purpose | Updated By |
|--------|-----------|-------------|
| MegaMemory `config` concept | All project configuration (profiles, overrides, workflow) | /gsd-mm-settings, /gsd-mm-new-project |

**When agents read config:**
1. Query MegaMemory: `megamemory:understand({ query: "config", top_k: 1 })`
2. Parse `JSON.parse(match.summary)` to get config data
3. Use the returned `match.id` for subsequent `update_concept` calls

**Config Schema in MegaMemory:**

```typescript
{
  project_name: string,
  profiles: {
    active_profile: "quality" | "balanced" | "budget",
    presets: {
      quality: { planning: string, execution: string, verification: string },
      balanced: { planning: string, execution: string, verification: string },
      budget: { planning: string, execution: string, verification: string }
    },
    custom_overrides: {
      quality: { planning?: string, execution?: string, verification?: string },
      balanced: { planning?: string, execution?: string, verification?: string },
      budget: { planning?: string, execution?: string, verification?: string }
    }
  },
  workflow: {
    mode: "standard" | "thorough" | "balanced" | "fast" | "quick" | "direct",
    research: boolean,
    plan_check: boolean,
    verifier: boolean
  },
  git: {
    commit_strategy: "per-phase" | "per-plan" | "per-task"
  }
}
```
</config_context>
</context>

<rules>
**UI Rules (apply throughout):**

- Always use the Question tool for user input — never print menus as text
- Custom/freeform answers are not allowed; re-prompt on invalid selection
- Apply changes immediately without extra confirmation prompts
- After any action except Exit, return to the main menu (Step 3 → Step 4)

**Config Rules:**

- Never overwrite existing presets — only create defaults for new/migrated projects
- Keep `model_profile` in sync with `profiles.active_profile`
- Merge into existing `opencode.json` (preserve non-agent keys)
</rules>

<behavior>

## Step 1: Load Config

Query MegaMemory for config concept:
```typescript
const configResult = await megamemory:understand({
  query: 'config',
  top_k: 1
});
```

If no matches found: print `Error: No GSD project found. Run /gsd-mm-new-project first.` and stop.

```typescript
const configMatch = configResult.matches[0];
const configId = configMatch.id;  // Store for later update_concept calls
const config = JSON.parse(configMatch.summary);
```

Handle config state:

- **Missing/invalid:** Run **Preset Setup Wizard** (see below), then continue
- **Legacy (no `profiles` key):** Run **Preset Setup Wizard**, preserve other existing keys
- **Current:** Use as-is

Ensure `workflow` section exists (defaults: `mode: "standard"`, `research: true`, `plan_check: true`, `verifier: true`).

### Preset Setup Wizard

This wizard runs on first use or when "Reset presets" is selected. It queries available models and lets the user configure all three profiles.

**Step W1: Discover models**

```bash
opencode models 2>/dev/null
```

Parse the output to extract model IDs. If command fails or returns no models, print `Error: Could not fetch available models. Check your OpenCode installation.` and stop.

**Step W2: Configure each profile**

For each profile (quality, balanced, budget), use a multi-question call:

```json
[
  { "header": "{Profile} Profile - Planning", "question": "Which model for planning agents?", "options": ["{model1}", "{model2}", ...] },
  { "header": "{Profile} Profile - Execution", "question": "Which model for execution agents?", "options": ["{model1}", "{model2}", ...] },
  { "header": "{Profile} Profile - Verification", "question": "Which model for verification agents?", "options": ["{model1}", "{model2}", ...] }
]
```

**Step W3: Save config**

Create config with user selections:

```json
{
  "profiles": {
    "active_profile": "balanced",
    "presets": {
      "quality": { "planning": "{user_selection}", "execution": "{user_selection}", "verification": "{user_selection}" },
      "balanced": { "planning": "{user_selection}", "execution": "{user_selection}", "verification": "{user_selection}" },
      "budget": { "planning": "{user_selection}", "execution": "{user_selection}", "verification": "{user_selection}" }
    },
    "custom_overrides": { "quality": {}, "balanced": {}, "budget": {} }
  },
  "workflow": { "mode": "standard", "research": true, "plan_check": true, "verifier: true" }
}
```

Print:

```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PRESETS CONFIGURED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your model presets have been saved. Use "Reset presets" 
from the settings menu if available models change.

Note: Quit and relaunch OpenCode to apply model changes.
```

## Step 2: Compute Effective Models

```text
activeProfile = config.profiles.active_profile
preset = config.profiles.presets[activeProfile]
overrides = config.profiles.custom_overrides[activeProfile] || {}

effective.planning = overrides.planning || preset.planning
effective.execution = overrides.execution || preset.execution
effective.verification = overrides.verification || preset.verification
```

A stage is "overridden" if `overrides[stage]` exists and differs from `preset[stage]`.

## Step 3: Display State

**Print this as text output (do NOT use Question tool here):**

```text
Active profile: {activeProfile}

| Stage        | Model                                    |
|--------------|------------------------------------------|
| planning     | {effective.planning}{* if overridden}   |
| execution    | {effective.execution}{* if overridden}  |
| verification | {effective.verification}{* if overridden}|

{if any overridden: "* = overridden" else: "No overrides"}

Workflow:
| Mode        | Description                              |
|-------------|------------------------------------------|
| {mode} ({%})| {Brief description from mode table}     |

Derived settings (read-only):
| Toggle     | Value           |
|------------|-----------------|
| Research    | {On/Off}       |
| Plan Check  | {On/Off}       |
| Verifier    | {On/Off}       |

Git:
| Setting          | Value                                        |
|------------------|----------------------------------------------|
| commit_strategy  | {config.git?.commit_strategy || "per-phase"} |
```

## Step 4: Show Menu

Use Question tool (single prompt, not multi-question):

```
header: "GSD Settings"
question: "Choose an action"
options:
  - label: "Quick settings"
    description: "Update profile and workflow toggles"
  - label: "Git commit strategy"
    description: "Change how often GSD commits during execution"
  - label: "Set stage override"
    description: "Set a per-stage model override for the active profile"
  - label: "Clear stage override"
    description: "Remove a per-stage override for the active profile"
  - label: "Reset presets"
    description: "Re-run model discovery and reconfigure all presets (clears overrides)"
  - label: "Exit"
    description: "Save and quit"
```

## Step 5: Handle Actions

### Quick settings

1. Query all config concepts: `megamemory:understand({ query: "config", top_k: 20 })`. For each match, extract `project_name`, `profiles.active_profile`, and `workflow.mode`.

2. **Pick project** — If multiple projects exist, ask:

```json
{
  "header": "Project",
  "question": "Which project's settings do you want to change?",
  "options": [
    { "label": "{project_name_1}", "description": "Profile: {profile}, Mode: {mode_1}" },
    { "label": "{project_name_2}", "description": "Profile: {profile}, Mode: {mode_2}" }
  ]
}
```

If only one project exists, skip this question and use it directly.

3. **Pick settings** — Use multi-question call with pre-selected current values:

```json
[
  { "header": "Model", "question": "Which model profile?", "options": ["Quality", "Balanced", "Budget"] },
  { "header": "Workflow Mode", "question": "Which workflow mode?", "options": [
    { "label": "Standard (90%)", "description": "Full workflow with all agents. Critical architecture, production systems." },
    { "label": "Thorough (70%)", "description": "Research + plan check, no verifier. New domains, unfamiliar tech." },
    { "label": "Balanced (50%)", "description": "Research + executor, no plan check/verifier. Moderate tech uncertainty." },
    { "label": "Fast (30%)", "description": "Plan check + executor, no research. Familiar stacks, CRUD operations." },
    { "label": "Quick (15%)", "description": "Planner → Executor only. Small tasks with known solutions." },
    { "label": "Direct (0%)", "description": "Planner only. Todo list generation. You know exactly what to do." }
  ]}
]
```

On selection:

- Map: Quality→`quality`, Balanced→`balanced`, Budget→`budget`
- Extract mode from selection (parse from label: "Standard (90%)" → "standard")
- Set `profiles.active_profile`, `model_profile`, and `workflow.mode`
- Store derived toggles based on mode mapping:
  - Direct/Quick: `research: false, plan_check: false, verifier: false`
  - Fast: `research: false, plan_check: true, verifier: false`
  - Balanced: `research: true, plan_check: false, verifier: false`
  - Thorough: `research: true, plan_check: true, verifier: false`
  - Standard: `research: true, plan_check: true, verifier: true`
- Quick settings does NOT modify `presets` or `custom_overrides`
- If nothing changed, print `No changes.` and return to menu
- Otherwise save and print confirmation banner:

```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SETTINGS UPDATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Setting            | Value                     |
|--------------------|---------------------------|
| Model Profile      | {quality|balanced|budget} |
| Workflow Mode      | {standard|thorough|balanced|fast|quick|direct} |

Derived settings (read-only):
| Plan Researcher    | {On/Off}                  |
| Plan Checker       | {On/Off}                  |
| Execution Verifier | {On/Off}                  |

Note: Quit and relaunch OpenCode to apply model changes.

Quick commands:
- /gsd-mm-set-profile <profile>
- /gsd-mm-plan-phase --research | --skip-research | --skip-verify | --mode <MODE>
```

### Git commit strategy

1. Query all config concepts: `megamemory:understand({ query: "config", top_k: 20 })`. For each match, extract `project_name` and `git.commit_strategy`.

2. **Pick project** — If multiple projects exist, ask:

```json
{
  "header": "Project",
  "question": "Which project's commit strategy do you want to change?",
  "options": [
    { "label": "{project_name_1}", "description": "Currently: {strategy_1}" },
    { "label": "{project_name_2}", "description": "Currently: {strategy_2}" }
  ]
}
```

If only one project exists, skip this question and use it directly.

3. **Pick strategy:**

```json
{
  "header": "Strategy",
  "question": "Which commit strategy?",
  "options": [
    { "label": "per-phase", "description": "One commit per phase (cleanest history)" },
    { "label": "per-plan", "description": "One commit per plan (moderate granularity)" },
    { "label": "per-task", "description": "One commit per task (most granular, best for bisect)" }
  ]
}
```

4. **Update config:** Set `config.git.commit_strategy` to the chosen value (create `git` object if missing). Use the selected config's `configId` for the `update_concept` call.

5. Print confirmation banner:

```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► GIT COMMIT STRATEGY UPDATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Setting          | Value          |
|------------------|----------------|
| Project          | {project_name} |
| Old Strategy     | {old_strategy} |
| New Strategy     | {new_strategy} |
```

Return to menu.

### Set stage override

1. Pick stage: Planning / Execution / Verification / Cancel
2. If Cancel, return to menu
3. Fetch models via `opencode models` command
4. If command fails: print error and stop
5. Pick model from list (include Cancel option)
6. Set `custom_overrides[activeProfile][stage]` = model
7. Save, print "Saved", return to menu

### Clear stage override

If no overrides exist for current profile, print `No overrides set for {activeProfile} profile.` and return to menu immediately.

Otherwise:

1. Print current overrides:

```text
Current overrides for {activeProfile} profile:
- planning: {model} (or omit if not overridden)
- execution: {model} (or omit if not overridden)
- verification: {model} (or omit if not overridden)
```

2. Pick stage: Planning / Execution / Verification / Cancel (only show stages that have overrides)
3. If Cancel, return to menu
4. Delete `custom_overrides[activeProfile][stage]`
5. Save, print "Cleared {stage} override.", return to menu

### Reset presets

Run the **Preset Setup Wizard** (see Step 1). This re-queries available models and lets the user reconfigure all three profiles from scratch. Existing `custom_overrides` are cleared. After completion, return to menu.

### Exit

Print "Settings saved." and stop.

## Save Changes

After any change, update MegaMemory and opencode.json. Do NOT use bash, python, or other scripts—use native file writing for opencode.json.

1. Update MegaMemory config concept:
   ```typescript
   await megamemory:update_concept({
     id: configId,  // from Step 1 query
     changes: {
       summary: JSON.stringify(updatedConfig)
     }
   });
   ```
2. Read existing `opencode.json` (if it exists) to preserve non-agent keys
3. Write `opencode.json` with merged agent mappings:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "agent": {
    "gsd-planner": { "model": "{effective.planning}" },
    "gsd-plan-checker": { "model": "{effective.planning}" },
    "gsd-phase-researcher": { "model": "{effective.planning}" },
    "gsd-roadmapper": { "model": "{effective.planning}" },
    "gsd-project-researcher": { "model": "{effective.planning}" },
    "gsd-research-synthesizer": { "model": "{effective.planning}" },
    "gsd-codebase-mapper": { "model": "{effective.planning}" },
    "gsd-executor": { "model": "{effective.execution}" },
    "gsd-debugger": { "model": "{effective.execution}" },
    "gsd-verifier": { "model": "{effective.verification}" },
    "gsd-integration-checker": { "model": "{effective.verification}" },
    "gsd-set-profile": { "model": "{effective.verification}" },
    "gsd-mm-settings": { "model": "{effective.verification}" },
    "gsd-set-model": { "model": "{effective.verification}" }
  }
}
```

Preserve existing non-agent keys in `opencode.json`.

</behavior>

<notes>

- Menu loop until Exit — always return to Step 3 after actions
- Overrides are profile-scoped: `custom_overrides.{profile}.{stage}`
- Source of truth: MegaMemory `config` concept; `opencode.json` is derived
- OpenCode does not hot-reload model assignments; user must quit and relaunch to apply changes
- Always use `configId` from initial query when calling `update_concept` — never hardcode the ID

</notes>
