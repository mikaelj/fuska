<megamemory_schema>

# Model Profiles Schema for MegaMemory

## Concept Structure

**Root Concept:** `model-profiles` (kind: `config`)

### Concept Definition

```typescript
interface ModelProfilesConcept {
  kind: 'config';
  name: 'model-profiles';
  summary: string;
  why: string;
  file_refs: string[];
  edges: {
    to: string;
    relation: 'connects_to' | 'depends_on' | 'configured_by';
    description: string;
  }[];
}
```

### Stored Data

```typescript
interface ModelProfilesData {
  model_aliases: {
    quality_model: string;   // e.g., "opencode/claude-opus-4"
    balanced_model: string;  // e.g., "opencode/claude-sonnet-4"
    budget_model: string;    // e.g., "opencode/claude-haiku-4"
    explore_model?: string;  // e.g., "opencode/claude-haiku-4" — profile-independent
  };
  active_profile: 'quality' | 'balanced' | 'budget';
  presets: {
    quality: ModelStageMapping;
    balanced: ModelStageMapping;
    budget: ModelStageMapping;
  };
  custom_overrides?: {
    [profile: string]: ModelStageMapping;
  };
}

interface ModelStageMapping {
  design: string;
  plan: string;
  build: string;
  review: string;
}

type Stage = 'design' | 'plan' | 'build' | 'review';
```

### Stage-to-Agent Mapping

```typescript
interface StageAgentMapping {
  design: string[];
  plan: string[];
  build: string[];
  review: string[];
}

const STAGE_AGENTS: StageAgentMapping = {
  design: [
    'fuska-planner',
    'fuska-roadmapper',
    'fuska-initiative-researcher',
    'fuska-research-synthesizer'
  ],
  plan: [
    'fuska-plan-checker',
    'fuska-chapter-researcher',
    'fuska-codebase-mapper'
  ],
  build: [
    'fuska-executor',
    'fuska-debugger'
  ],
  review: [
    'fuska-verifier',
    'fuska-integration-checker',
    'fuska-commit-checker'
  ]
};
```

## Key Fields

| Field | Type | Purpose |
|-------|------|---------|
| `active_profile` | enum | Currently selected profile (quality/balanced/budget) |
| `presets` | object | Model mappings for each profile and stage |
| `custom_overrides` | object | Per-profile custom model overrides |

</megamemory_schema>

<megamemory_operations>

# MegaMemory Operations

## Create Model Profiles

```typescript
import { megamemory_create_concept } from '@opencode/mcp-client';

const modelProfiles = await megamemory_create_concept({
  name: 'model-profiles',
  kind: 'config',
  summary: 'Model profiles with model_aliases: quality_model=opencode/claude-opus-4, balanced_model=opencode/claude-sonnet-4, budget_model=opencode/claude-haiku-4; active=balanced, presets: quality(design:claude-opus-4,plan:claude-opus-4,build:claude-opus-4,review:claude-opus-4), balanced(design:claude-opus-4,plan:claude-opus-4,build:claude-sonnet-4,review:claude-sonnet-4), budget(design:claude-sonnet-4,plan:claude-sonnet-4,build:claude-sonnet-4,review:claude-haiku-4)',
  why: 'Controls model selection per Fuska agent stage to balance quality vs token spend. Model aliases provide indirection between lookup tables and actual model IDs.',
  file_refs: ['opencode.json'],
  edges: [
    {
      to: 'fuska-agents',
      relation: 'configured_by',
      description: 'All Fuska agents resolve models from these profiles'
    },
    {
      to: 'planning-config',
      relation: 'configured_by',
      description: 'Model profile selection controlled by planning config model_profile field'
    }
  ],
  created_by_task: 'Initial model profile configuration'
});
```

## Update Active Profile

```typescript
import { megamemory_update_concept } from '@opencode/mcp-client';

await megamemory_update_concept({
  id: '<model-profiles-concept-id>',
  changes: {
    summary: 'Model profiles with active=quality, presets: quality(...), balanced(...), budget(...)'
  }
});
```

## Update Preset Models

```typescript
await megamemory_update_concept({
  id: '<model-profiles-concept-id>',
  changes: {
    summary: 'Model profiles with active=balanced, presets: quality(design:gpt-4o,plan:gpt-4o,build:gpt-4o-mini,review:gpt-4o), balanced(design:gpt-4o,plan:gpt-4o,build:gpt-4o-mini,review:gpt-4o-mini), budget(design:gpt-4o-mini,plan:gpt-4o-mini,build:gpt-4o-mini,review:gpt-4o-mini)'
  }
});
```

## Query Model for Agent

```typescript
import { megamemory_understand } from '@opencode/mcp-client';

async function getModelForAgent(agentName: string): Promise<string> {
  const stage = getStageForAgent(agentName);

  const profiles = await megamemory_understand({
    query: `model profiles active ${stage}`,
    top_k: 1
  });

  return parseModelFromSummary(profiles[0].summary);
}
```

## Link to Agents

```typescript
import { megamemory_link } from '@opencode/mcp-client';

await megamemory_link({
  from: 'model-profiles',
  to: 'fuska-planner',
  relation: 'configured_by',
  description: 'Planner uses model from profiles[active].design'
});

await megamemory_link({
  from: 'model-profiles',
  to: 'fuska-executor',
  relation: 'configured_by',
  description: 'Executor uses model from profiles[active].build'
});
```

</megamemory_operations>

<megamemory_examples>

# TypeScript Examples

## Example 1: Get Model for Agent Stage

```typescript
async function getModelForAgent(agentName: string): Promise<string> {
  const stage = getStageForAgent(agentName);
  const profiles = await getProfilesFromMM();

  const activeProfile = profiles.presets[profiles.active_profile];
  const customOverride = profiles.custom_overrides?.[profiles.active_profile];

  if (customOverride && customOverride[stage]) {
    return customOverride[stage];
  }

  return activeProfile[stage];
}

function getStageForAgent(agentName: string): Stage {
  for (const [stage, agents] of Object.entries(STAGE_AGENTS)) {
    if (agents.includes(agentName)) {
      return stage as Stage;
    }
  }
  throw new Error(`Unknown agent: ${agentName}`);
}
```

## Example 2: Parse Profiles from Summary

```typescript
function parseProfilesFromSummary(summary: string): ModelProfilesData {
  const activeMatch = summary.match(/active=(\w+)/);
  const activeProfile = (activeMatch?.[1] ?? 'balanced') as any;

  const presets = {
    quality: parsePreset(summary, 'quality'),
    balanced: parsePreset(summary, 'balanced'),
    budget: parsePreset(summary, 'budget')
  };

  return {
    active_profile: activeProfile,
    presets
  };
}

function parsePreset(summary: string, profile: string): ModelStageMapping {
  const regex = new RegExp(`${profile}\\(design:([^,]+),plan:([^,]+),build:([^,]+),review:([^)]+)\\)`);
  const match = summary.match(regex);

  if (!match) {
    throw new Error(`Could not parse preset for ${profile}`);
  }

  return {
    design: match[1],
    plan: match[2],
    build: match[3],
    review: match[4]
  };
}
```

## Example 3: Switch Active Profile

```typescript
async function switchProfile(newProfile: 'quality' | 'balanced' | 'budget'): Promise<void> {
  const profiles = await getProfilesFromMM();
  const active = profiles.active_profile;

  if (active === newProfile) {
    return;
  }

  const result = await megamemory_understand({
    query: 'model profiles',
    top_k: 1
  });

  if (result && result.length > 0) {
    const newSummary = result[0].summary.replace(
      /active=\w+/,
      `active=${newProfile}`
    );

    await megamemory_update_concept({
      id: result[0].id,
      changes: {
        summary: newSummary
      }
    });
  }
}
```

## Example 4: Resolve Model with Custom Overrides

```typescript
async function resolveModelForAgent(agentName: string): Promise<string> {
  const stage = getStageForAgent(agentName);
  const profiles = await getProfilesFromMM();

  const customOverride = profiles.custom_overrides?.[profiles.active_profile];

  if (customOverride?.[stage]) {
    return customOverride[stage];
  }

  return profiles.presets[profiles.active_profile][stage];
}
```

## Example 5: Update Single Preset

```typescript
async function updatePresetModel(
  profile: 'quality' | 'balanced' | 'budget',
  stage: Stage,
  model: string
): Promise<void> {
  const result = await megamemory_understand({
    query: 'model profiles',
    top_k: 1
  });

  if (result && result.length > 0) {
    const summary = result[0].summary;

    const oldPreset = `\\b${profile}\\(design:[^,]+,plan:[^,]+,build:[^,]+,review:[^)]+\\)`;
    const presetData = parsePreset(summary, profile);

    presetData[stage] = model;

    const newPreset = `${profile}(design:${presetData.design},plan:${presetData.plan},build:${presetData.build},review:${presetData.review})`;

    const newSummary = summary.replace(new RegExp(oldPreset), newPreset);

    await megamemory_update_concept({
      id: result[0].id,
      changes: {
        summary: newSummary
      }
    });
  }
}
```

## Example 6: Auto-Configure from Available Models

```typescript
async function configureModelProfiles(availableModels: string[]): Promise<void> {
  const strongModels = filterByCapability(availableModels, 'strong');
  const midTierModels = filterByCapability(availableModels, 'mid-tier');
  const lightweightModels = filterByCapability(availableModels, 'lightweight');

  const presets = {
    quality: {
      design: strongModels[0] || midTierModels[0],
      plan: strongModels[0] || midTierModels[0],
      build: strongModels[0] || midTierModels[0],
      review: strongModels[0] || midTierModels[0]
    },
    balanced: {
      design: strongModels[0] || midTierModels[0],
      plan: strongModels[0] || midTierModels[0],
      build: midTierModels[0],
      review: midTierModels[0]
    },
    budget: {
      design: midTierModels[0],
      plan: midTierModels[0],
      build: midTierModels[0],
      review: lightweightModels[0] || midTierModels[0]
    }
  };

  const summary = formatProfilesSummary('balanced', presets);

  const result = await megamemory_understand({
    query: 'model profiles',
    top_k: 1
  });

  if (result && result.length > 0) {
    await megamemory_update_concept({
      id: result[0].id,
      changes: {
        summary
      }
    });
  } else {
    await megamemory_create_concept({
      name: 'model-profiles',
      kind: 'config',
      summary,
      why: 'Auto-configured from available models'
    });
  }
}

function formatProfilesSummary(
  active: string,
  presets: any
): string {
  const parts = Object.entries(presets).map(([name, mapping]: [string, any]) => {
    return `${name}(design:${mapping.design},plan:${mapping.plan},build:${mapping.build},review:${mapping.review})`;
  });

  return `Model profiles with active=${active}, presets: ${parts.join(', ')}`;
}
```

</megamemory_examples>

---

# Model Profiles

Model profiles control which OpenCode model each Fuska agent uses. This allows balancing quality vs token spend.

## Stage-to-Agent Mapping

Agents are grouped by stage. Each profile assigns a model to each stage:

| Stage | Agents |
|-------|--------|
| Design | fuska-planner, fuska-roadmapper, fuska-initiative-researcher, fuska-research-synthesizer |
| Plan | fuska-plan-checker, fuska-chapter-researcher, fuska-codebase-mapper |
| Build | fuska-executor, fuska-debugger |
| Review | fuska-verifier, fuska-integration-checker, fuska-commit-checker |

## Model Aliases

Model aliases provide an indirection layer between lookup tables and actual model IDs. Instead of hardcoding model names like `opus`, `sonnet`, `haiku`, coordinators use aliases:

| Alias | Purpose | Example Value |
|-------|---------|---------------|
| `quality_model` | Strongest model for quality profile | `opencode/claude-opus-4` |
| `balanced_model` | Mid-tier model for balanced profile | `opencode/claude-sonnet-4` |
| `budget_model` | Lightweight model for budget profile | `opencode/claude-haiku-4` |
| `explore_model` | Fast/cheap model for OpenCode's explore subagent (profile-independent) | `opencode/claude-haiku-4` |

**Note:** `explore_model` is profile-independent — it does not appear in the presets table and does not change when switching profiles. Even in quality mode, codebase exploration should use a fast/cheap model.

**Lookup tables use aliases:**

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| fuska-planner | quality_model | quality_model | balanced_model |
| fuska-executor | quality_model | balanced_model | balanced_model |
| fuska-plan-checker | balanced_model | balanced_model | budget_model |
| fuska-verifier | balanced_model | balanced_model | budget_model |
| fuska-chapter-researcher | quality_model | balanced_model | budget_model |
| fuska-git-message | balanced_model | budget_model | budget_model |
| fuska-commit-checker | budget_model | budget_model | budget_model |

**Resolution flow:**

```
1. Load config from MegaMemory
2. Extract model_aliases: { quality_model, balanced_model, budget_model }
3. Lookup table maps profile → alias
4. Alias resolves to actual model ID
5. Pass model to Task() call
```

This design allows changing underlying models without modifying lookup tables.

## Profile Configuration

Models are **user-configured**, not hardcoded. OpenCode supports multiple providers (Anthropic, OpenAI, local models, etc.), so available models vary per installation.

On first run, `fuska config` runs the **Preset Setup Wizard**:

1. Queries `opencode models` to discover available models
2. Prompts user to configure model aliases (quality_model, balanced_model, budget_model)
3. Prompts user to select models for each profile/stage combination
4. Saves to MegaMemory `config` concept

Configuration structure (stored in MegaMemory concept summary):

```json
{
  "model_aliases": {
    "quality_model": "opencode/claude-opus-4",
    "balanced_model": "opencode/claude-sonnet-4",
    "budget_model": "opencode/claude-haiku-4",
    "explore_model": "opencode/claude-haiku-4"
  },
  "active_profile": "balanced",
  "presets": {
    "quality": { "design": "quality_model", "plan": "quality_model", "build": "quality_model", "review": "quality_model" },
    "balanced": { "design": "quality_model", "plan": "quality_model", "build": "balanced_model", "review": "balanced_model" },
    "budget": { "design": "balanced_model", "plan": "balanced_model", "build": "balanced_model", "review": "budget_model" }
  }
}
```

**IMPORTANT:** Presets should store alias names (`quality_model`, `balanced_model`, `budget_model`), NOT actual model IDs. This allows changing the underlying model in one place (`model_aliases`) without updating all presets.

**Resolution function:**

```typescript
function resolveModelAlias(value: string, aliases: Record<string, string>): string {
  // If value is an alias key, resolve it
  if (aliases[value]) {
    return aliases[value];
  }
  // Otherwise, return as-is (backward compatibility with old configs)
  return value;
}

// Example: Get effective model for a stage
function getEffectiveModel(
  profile: string,
  stage: 'design' | 'plan' | 'build' | 'review',
  config: FuskaConfig
): string {
  const preset = config.profiles.presets[profile][stage];
  const override = config.profiles.custom_overrides?.[profile]?.[stage];
  const aliasOrModel = override || preset;
  return resolveModelAlias(aliasOrModel, config.model_aliases || {});
}
```

## Profile Philosophy

When configuring presets, consider these guidelines:

**quality** - Maximum reasoning power

- Use your most capable model for all stages
- Use when: quota available, critical architecture work

**balanced** (default) - Smart allocation

- Strong model for design and plan (where architecture decisions happen)
- Mid-tier model for build (follows explicit instructions)
- Mid-tier model for review (needs reasoning, not just pattern matching)
- Use when: normal development, good balance of quality and cost

**budget** - Minimal token spend

- Mid-tier model for anything that writes code
- Lightweight model for research and review
- Use when: conserving quota, high-volume work, less critical chapters

## Resolution Logic

Orchestrators resolve model before spawning:

```text
1. Query MegaMemory for config concept
2. Parse JSON from concept.summary
3. Extract model_aliases (with defaults if missing)
4. Get active_profile (default: "balanced")
5. Get preset value for profile + stage (e.g., presets.balanced.design = "quality_model")
6. Resolve alias to actual model ID from model_aliases (e.g., "quality_model" → "opencode/claude-opus-4")
7. Pass model parameter to Task call
```

**Example resolution:**

```javascript
const configData = JSON.parse(configMatch.summary);
const profile = configData.profiles?.active_profile || "balanced";

const aliases = configData.model_aliases || {
  quality_model: "opencode/claude-opus-4",
  balanced_model: "opencode/claude-sonnet-4",
  budget_model: "opencode/claude-haiku-4"
};

// Resolution function - converts alias to actual model ID
function resolveModelAlias(value) {
  return aliases[value] || value; // Return resolved or original (backward compat)
}

// Get preset for profile (uses alias names)
const preset = configData.profiles?.presets?.[profile] || {};
const overrides = configData.profiles?.custom_overrides?.[profile] || {};

// Resolve stages to actual models
const models = {
  researcher: resolveModelAlias(overrides.review || preset.review),
  planner: resolveModelAlias(overrides.design || preset.design),
  checker: resolveModelAlias(overrides.plan || preset.plan),
  executor: resolveModelAlias(overrides.build || preset.build),
  verifier: resolveModelAlias(overrides.review || preset.review)
};

// explore_model is written directly to opencode.json as agent.explore.model
// It is profile-independent and does not go through presets.
if (aliases.explore_model) {
  agentConfig["explore"] = { model: aliases.explore_model };
}
```

Query pattern:
```javascript
megamemory:understand({query: "model profiles"})
// Access: result.concepts[0]
// Parse: JSON.parse(result.concepts[0].summary)
```

Agent-to-model mappings are written to `opencode.json` by `fuska config`.

## Switching Profiles

Runtime: `fuska config` → Set active profile → select profile

View current: `fuska config --view`

Per-project default stored in MegaMemory `model-profiles` concept:

Query and update pattern:
```javascript
// Query for current profiles
const result = await megamemory:understand({query: "model profiles"});
const profilesData = JSON.parse(result.concepts[0].summary);

// Update active_profile
const newSummary = result.concepts[0].summary.replace(
  /active=\w+/,
  `active=${newProfile}`
);

await megamemory:update_concept({
  id: result.concepts[0].id,
  changes: { summary: newSummary }
});
```

## Design Rationale

**Why use your strongest model for design?**
Design involves architecture decisions, goal decomposition, and task design. This is where model quality has the highest impact.

**Why mid-tier for build?**
Builders follow explicit PLAN.md instructions. The plan already contains the reasoning; building is implementation.

**Why mid-tier (not lightweight) for review?**
Review requires goal-backward reasoning - checking if code *delivers* what the chapter promised, not just pattern matching. Mid-tier models handle this well; lightweight models may miss subtle gaps.

**Why lightweight for codebase mapping?**
Read-only exploration and pattern extraction. No complex reasoning required, just structured output from file contents.
