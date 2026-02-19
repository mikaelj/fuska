# Model Validation

Validate model strings against OpenCode's configured providers before spawning Task tool to avoid cryptic `ProviderModelNotFoundError`.

## OpenCode Configuration Location

OpenCode's provider and model configuration lives in:

```
~/.config/opencode/opencode.jsonc
```

## Configuration Structure

```jsonc
{
  "provider": {
    "zai-coding-plan": {
      "whitelist": ["glm-5", "glm-4.7", "glm-4.6v", "glm-4.6v-flash"],
      "options": { "baseURL": "..." },
      "models": { ... }
    },
    "anthropic": {
      "whitelist": ["claude-opus-4", "claude-sonnet-4", "claude-haiku-4"]
    }
  }
}
```

Each provider has:
- `whitelist`: Array of available model names for that provider
- `models`: Optional per-model configuration

## Model String Format

Model strings follow the pattern: `{provider}/{model}`

Examples:
- `zai-coding-plan/glm-5`
- `anthropic/claude-opus-4`
- `openai/gpt-4`

## Validation Algorithm

```typescript
interface ProviderConfig {
  whitelist?: string[];
  models?: Record<string, unknown>;
}

interface OpenCodeConfig {
  provider?: Record<string, ProviderConfig>;
}

function parseOpenCodeConfig(configPath: string): OpenCodeConfig {
  const content = readFileSync(configPath, 'utf-8');
  const cleaned = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  return JSON.parse(cleaned);
}

function validateModelString(modelString: string, config: OpenCodeConfig): {
  valid: boolean;
  error?: string;
  provider?: string;
  availableModels?: string[];
} {
  const parts = modelString.split('/');
  if (parts.length !== 2) {
    return {
      valid: false,
      error: `Invalid model string format. Expected "provider/model", got "${modelString}"`
    };
  }

  const [provider, model] = parts;
  const providerConfig = config.provider?.[provider];

  if (!providerConfig) {
    const availableProviders = Object.keys(config.provider || {});
    return {
      valid: false,
      error: `Provider "${provider}" not found`,
      provider,
      availableModels: availableProviders
    };
  }

  const whitelist = providerConfig.whitelist || [];
  const configuredModels = Object.keys(providerConfig.models || {});
  const availableModels = whitelist.length > 0 ? whitelist : configuredModels;

  if (!availableModels.includes(model)) {
    return {
      valid: false,
      error: `Model "${model}" not found in provider "${provider}"`,
      provider,
      availableModels
    };
  }

  return { valid: true, provider, availableModels };
}

function validateAllModels(
  modelAliases: Record<string, string>,
  config: OpenCodeConfig
): { valid: boolean; errors: string[]; providerModels: Map<string, string[]> } {
  const errors: string[] = [];
  const providerModels = new Map<string, string[]>();

  for (const [alias, modelString] of Object.entries(modelAliases)) {
    const result = validateModelString(modelString, config);
    
    if (!result.valid) {
      errors.push(`"${modelString}" (${alias}) - ${result.error}`);
    }
    
    if (result.provider && result.availableModels) {
      if (!providerModels.has(result.provider)) {
        providerModels.set(result.provider, result.availableModels);
      }
    }
  }

  return { valid: errors.length === 0, errors, providerModels };
}
```

## Error Message Format

When validation fails, display a helpful error with available options:

```
Invalid model configuration:
  - "opencode/big-pickle" (quality_model) - provider "opencode" not found

Available providers in your OpenCode config:
  - zai-coding-plan: glm-5, glm-4.7, glm-4.6v, glm-4.6v-flash
  - anthropic: claude-opus-4, claude-sonnet-4, claude-haiku-4

To fix: Run `fuska config` to reconfigure your models
```

## Integration Point

Add validation in fuska commands after extracting model aliases from config:

1. Read OpenCode config: `~/.config/opencode/opencode.jsonc`
2. Parse JSONC (strip comments)
3. Validate each model alias against available providers
4. If invalid: show error, suggest `fuska config`, stop
5. If valid: proceed with Task spawn

## Example Integration

```typescript
const configPath = path.join(os.homedir(), '.config', 'opencode', 'opencode.jsonc');
const openCodeConfig = parseOpenCodeConfig(configPath);

const modelAliases = configData.model_aliases || {
  quality_model: "opencode/claude-opus-4",
  balanced_model: "opencode/claude-sonnet-4",
  budget_model: "opencode/claude-haiku-4"
};

const validation = validateAllModels(modelAliases, openCodeConfig);

if (!validation.valid) {
  const providerList = Array.from(validation.providerModels.entries())
    .map(([provider, models]) => `  - ${provider}: ${models.join(', ')}`)
    .join('\n');

  console.error(`Invalid model configuration:
${validation.errors.map(e => `  - ${e}`).join('\n')}

Available providers in your OpenCode config:
${providerList}

To fix: Run \`fuska config\` to reconfigure your models`);
  process.exit(1);
}
```

## JSONC Parsing

OpenCode uses JSONC (JSON with comments). Strip comments before parsing:

```typescript
function stripJsonc(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}
```

## Handling Missing Config

If `opencode.jsonc` doesn't exist:

```
Could not read OpenCode configuration at ~/.config/opencode/opencode.jsonc

Please ensure OpenCode is properly configured, then run `fuska config`
```
