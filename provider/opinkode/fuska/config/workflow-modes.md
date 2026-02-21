## Workflow Mode Configuration

Defines behavior flags for each workflow mode.

### Mode Flags

| Mode | Research | Plan Check |
|------|----------|------------|
| direct | false | false |
| quick | false | false |
| fast | false | true |
| balanced | true | false |
| thorough | true | true |
| standard | true | true |

### Resolution Logic

```
mode = modeOverride || configData.workflow?.mode || "standard"

modeConfig = {
  direct: { research: false, planCheck: false },
  quick: { research: false, planCheck: false },
  fast: { research: false, planCheck: true },
  balanced: { research: true, planCheck: false },
  thorough: { research: true, planCheck: true },
  standard: { research: true, planCheck: true }
}[mode]

// Flags augment (never reduce) mode defaults
shouldResearch = modeConfig.research || hasResearchFlag
shouldPlanCheck = modeConfig.planCheck && !hasSkipVerifyFlag
```

### Checker Panel Defaults

```
checkerPanel: { base: 'quality-advocate', contextual: null, expert: 'dynamic' }
projectClassification: { type: 'generic', confidence: 'low', signals: [] }
```
