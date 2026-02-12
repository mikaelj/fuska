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
  planning: string;
  execution: string;
  verification: string;
}

type Stage = 'planning' | 'execution' | 'verification';
```

### Stage-to-Agent Mapping

```typescript
interface StageAgentMapping {
  planning: string[];
  execution: string[];
  verification: string[];
}

const STAGE_AGENTS: StageAgentMapping = {
  planning: [
    'gsd-planner',
    'gsd-plan-checker',
    'gsd-phase-researcher',
    'gsd-roadmapper',
    'gsd-project-researcher',
    'gsd-research-synthesizer',
    'gsd-codebase-mapper'
  ],
  execution: [
    'gsd-executor',
    'gsd-debugger',
    'gsd-git-message'
  ],
  verification: [
    'gsd-verifier',
    'gsd-integration-checker',
    'gsd-commit-checker',
    'gsd-set-profile',
    'gsd-settings'
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
  summary: 'Model profiles with model_aliases: quality_model=opencode/claude-opus-4, balanced_model=opencode/claude-sonnet-4, budget_model=opencode/claude-haiku-4; active=balanced, presets: quality(planning:claude-opus-4,execution:claude-opus-4,verification:claude-opus-4), balanced(planning:claude-opus-4,execution:claude-sonnet-4,verification:claude-sonnet-4), budget(planning:claude-sonnet-4,execution:claude-sonnet-4,verification:claude-haiku-4)',
  why: 'Controls model selection per GSD agent stage to balance quality vs token spend. Model aliases provide indirection between lookup tables and actual model IDs.',
  file_refs: ['opencode.json'],
  edges: [
    {
      to: 'gsd-agents',
      relation: 'configured_by',
      description: 'All GSD agents resolve models from these profiles'
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
    summary: 'Model profiles with active=balanced, presets: quality(planning:gpt-4o,execution:gpt-4o-mini,verification:gpt-4o), balanced(planning:gpt-4o,execution:gpt-4o-mini,verification:gpt-4o-mini), budget(planning:gpt-4o-mini,execution:gpt-4o-mini,verification:gpt-4o-mini)'
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
  to: 'gsd-planner',
  relation: 'configured_by',
  description: 'Planner uses model from profiles[active].planning'
});

await megamemory_link({
  from: 'model-profiles',
  to: 'gsd-executor',
  relation: 'configured_by',
  description: 'Executor uses model from profiles[active].execution'
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
  const regex = new RegExp(`${profile}\\(planning:([^,]+),execution:([^,]+),verification:([^)]+)\\)`);
  const match = summary.match(regex);

  if (!match) {
    throw new Error(`Could not parse preset for ${profile}`);
  }

  return {
    planning: match[1],
    execution: match[2],
    verification: match[3]
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

    const oldPreset = `\\b${profile}\\(planning:[^,]+,execution:[^,]+,verification:[^)]+\\)`;
    const presetData = parsePreset(summary, profile);

    presetData[stage] = model;

    const newPreset = `${profile}(planning:${presetData.planning},execution:${presetData.execution},verification:${presetData.verification})`;

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
      planning: strongModels[0] || midTierModels[0],
      execution: strongModels[0] || midTierModels[0],
      verification: strongModels[0] || midTierModels[0]
    },
    balanced: {
      planning: strongModels[0] || midTierModels[0],
      execution: midTierModels[0],
      verification: midTierModels[0]
    },
    budget: {
      planning: midTierModels[0],
      execution: midTierModels[0],
      verification: lightweightModels[0] || midTierModels[0]
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
    return `${name}(planning:${mapping.planning},execution:${mapping.execution},verification:${mapping.verification})`;
  });

  return `Model profiles with active=${active}, presets: ${parts.join(', ')}`;
}
```

</megamemory_examples>

---

# Model Profiles

Model profiles control which OpenCode model each GSD agent uses. This allows balancing quality vs token spend.

## Stage-to-Agent Mapping

Agents are grouped by stage. Each profile assigns a model to each stage:

| Stage | Agents |
|-------|--------|
| Planning | gsd-planner, gsd-plan-checker, gsd-phase-researcher, gsd-roadmapper, gsd-project-researcher, gsd-research-synthesizer, gsd-codebase-mapper |
| Execution | gsd-executor, gsd-debugger, gsd-git-message |
| Verification | gsd-verifier, gsd-integration-checker, gsd-commit-checker, gsd-set-profile, gsd-settings |

## Model Aliases

Model aliases provide an indirection layer between lookup tables and actual model IDs. Instead of hardcoding model names like `opus`, `sonnet`, `haiku`, orchestrators use aliases:

| Alias | Purpose | Example Value |
|-------|---------|---------------|
| `quality_model` | Strongest model for quality profile | `opencode/claude-opus-4` |
| `balanced_model` | Mid-tier model for balanced profile | `opencode/claude-sonnet-4` |
| `budget_model` | Lightweight model for budget profile | `opencode/claude-haiku-4` |

**Lookup tables use aliases:**

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| gsd-mm-planner | quality_model | quality_model | balanced_model |
| gsd-mm-executor | quality_model | balanced_model | balanced_model |
| gsd-mm-plan-checker | balanced_model | balanced_model | budget_model |
| gsd-mm-verifier | balanced_model | balanced_model | budget_model |
| gsd-mm-phase-researcher | quality_model | balanced_model | budget_model |
| gsd-mm-git-message | balanced_model | budget_model | budget_model |
| gsd-mm-commit-checker | budget_model | budget_model | budget_model |

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

On first run, `/gsd-settings` runs the **Preset Setup Wizard**:

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
    "budget_model": "opencode/claude-haiku-4"
  },
  "active_profile": "balanced",
  "presets": {
    "quality": { "planning": "...", "execution": "...", "verification": "..." },
    "balanced": { "planning": "...", "execution": "...", "verification": "..." },
    "budget": { "planning": "...", "execution": "...", "verification": "..." }
  }
}
```

## Profile Philosophy

When configuring presets, consider these guidelines:

**quality** - Maximum reasoning power

- Use your most capable model for all stages
- Use when: quota available, critical architecture work

**balanced** (default) - Smart allocation

- Strong model for planning (where architecture decisions happen)
- Mid-tier model for execution (follows explicit instructions)
- Mid-tier model for verification (needs reasoning, not just pattern matching)
- Use when: normal development, good balance of quality and cost

**budget** - Minimal token spend

- Mid-tier model for anything that writes code
- Lightweight model for research and verification
- Use when: conserving quota, high-volume work, less critical phases

## Resolution Logic

Orchestrators resolve model before spawning:

```text
1. Query MegaMemory for config concept
2. Parse JSON from concept.summary
3. Extract model_aliases (with defaults if missing)
4. Get model_profile (default: "balanced")
5. Lookup table maps [profile][agent] → alias
6. Alias resolves to actual model ID from model_aliases
7. Pass model parameter to Task call
```

**Example resolution:**

```javascript
const configData = JSON.parse(configMatch.summary);
const modelProfile = configData.model_profile || "balanced";

const aliases = configData.model_aliases || {
  quality_model: "opencode/claude-opus-4",
  balanced_model: "opencode/claude-sonnet-4",
  budget_model: "opencode/claude-haiku-4"
};

const modelLookup = {
  quality: {
    researcher: aliases.quality_model,
    planner: aliases.quality_model,
    checker: aliases.balanced_model,
    executor: aliases.quality_model,
    verifier: aliases.balanced_model
  },
  balanced: {
    researcher: aliases.balanced_model,
    planner: aliases.quality_model,
    checker: aliases.balanced_model,
    executor: aliases.balanced_model,
    verifier: aliases.balanced_model
  },
  budget: {
    researcher: aliases.budget_model,
    planner: aliases.balanced_model,
    checker: aliases.budget_model,
    executor: aliases.balanced_model,
    verifier: aliases.budget_model
  }
};

const models = modelLookup[modelProfile];
```

Query pattern:
```javascript
megamemory:understand({query: "model profiles"})
// Access: result.concepts[0]
// Parse: JSON.parse(result.concepts[0].summary)
```

Agent-to-model mappings are written to `opencode.json` by `/gsd-set-profile` and `/gsd-settings`.

## Switching Profiles

Runtime: `/gsd-set-profile <profile>`

Interactive settings: `/gsd-settings`

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

**Why use your strongest model for planning?**
Planning involves architecture decisions, goal decomposition, and task design. This is where model quality has the highest impact.

**Why mid-tier for execution?**
Executors follow explicit PLAN.md instructions. The plan already contains the reasoning; execution is implementation.

**Why mid-tier (not lightweight) for verification?**
Verification requires goal-backward reasoning - checking if code *delivers* what the phase promised, not just pattern matching. Mid-tier models handle this well; lightweight models may miss subtle gaps.

**Why lightweight for codebase mapping?**
Read-only exploration and pattern extraction. No complex reasoning required, just structured output from file contents.
