# Model Resolution

Shared pattern for resolving model aliases to actual model IDs. Each command defines its own lookup table; this reference covers the common extraction and resolution steps.

## Resolution Steps

1. Extract `model_profile` from config (default: `"balanced"`)
2. Extract `model_aliases` from config (with defaults below)
3. Define per-command lookup table mapping profile → agent → alias
4. Resolve: `models = modelLookup[modelProfile]`

## Default Aliases

```
const aliases = configData.model_aliases || {
  quality_model: "opencode/claude-opus-4",
  balanced_model: "opencode/claude-sonnet-4",
  budget_model: "opencode/claude-haiku-4"
}
```

## Lookup Table Pattern

Each command defines a lookup table using alias references (not raw model IDs):

```
const modelLookup = {
  quality:  { agent1: aliases.quality_model, agent2: aliases.balanced_model, ... },
  balanced: { agent1: aliases.balanced_model, agent2: aliases.balanced_model, ... },
  budget:   { agent1: aliases.budget_model,   agent2: aliases.budget_model,   ... }
}
const models = modelLookup[modelProfile]
```

## Profile-Independent Agents

Some agents use the same model regardless of profile. Resolve directly from aliases:

```
const gitMessageModel = aliases.explore_model || aliases.budget_model
```

Currently profile-independent:
- `fuska-git-message` → `explore_model` (simple summary task)

## Validation

After resolution, validate model strings against `~/.config/opencode/opencode.jsonc` using model-validation.md patterns. If invalid: show error with available providers, suggest `fuska config`, stop.

## Reference Lookup Tables

See model-profiles.md for the full agent-to-stage mapping and profile philosophy.
