# GLM Migration Guide for Fuska Agents

Adaptations for running Fuska workflow with GLM models (e.g., GLM-5), based on https://www.cerebras.ai/blog/glm-4-7-migration-guide

## Overview

GLM models have specific behavioral characteristics that require prompt engineering adjustments. This document maps all 10 rules from the Cerebras migration guide to Fuska's agent workflow.

## Quick Reference

| GLM Rule | Fuska Agents | Current State | Action |
|----------|--------------|---------------|--------|
| #1: Front load instructions | All | NEEDS FIX | Move CRITICAL directives before context in orchestrator prompts |
| #2: Clear/direct instructions | All | NEEDS FIX | Replace "should" with "MUST/STRICTLY" in 4 agents |
| #3: Specify default language | All | MISSING | Add `<language>` directive to all 19 agents |
| #4: Leverage role-play | All | Excellent | Already implemented |
| #5: Break up the task | All | Excellent | Already implemented |
| #6: Disable reasoning when not needed | Checker, Executor, Verifier | N/A | Not applicable (tool-level config) |
| #7: Enable reasoning for complex tasks | Researcher, Planner | N/A | Not applicable (tool-level config) |
| #8: Use critics | All | Excellent | Already implemented via checker/verifier chain |
| #9: Pair with frontier model | Orchestrators | Excellent | Hybrid routing in fuska-do.md |
| #10: clear_thinking control | Orchestrators | N/A | Not applicable (tool-level config) |

## Rule Mapping

### Rule 1: Front Load Instructions

**GLM behavior:** Strong bias toward beginning of prompt. Instructions at the start are followed more reliably.

**Fuska adaptation:**

Orchestrator prompts (in `fuska-do.md`, `fuska-plan-phase.md`, etc.) should structure agent prompts as:

```
<critical_constraints>
[MANDATORY rules that MUST be followed - placed FIRST]
</critical_constraints>

<role>
[Persona definition]
</role>

<context>
[Supporting information - loaded AFTER critical constraints]
</context>
```

**Current issue:** Many orchestrator prompts place `<context>` before `<constraints>`.

**Files to update:**
- `provider/opinkode/command/fuska/fuska-do.md` - Steps 5, 6, 7, 9, 10 prompt building
- `provider/opinkode/command/fuska/fuska-plan-phase.md` - Agent spawn prompts

### Rule 2: Provide Clear and Direct Instructions

**GLM behavior:** Responds best to firm, direct language (MUST, STRICTLY). Avoids treating soft language as optional.

**Fuska adaptation:**

Replace suggestive language with mandatory language:

| Current | GLM-Optimized |
|---------|---------------|
| "Plans should complete within ~50% context" | "Plans MUST complete within 50% context" |
| "Each plan: 2-3 tasks maximum" | "Each plan STRICTLY limited to 2-3 tasks" |
| "Consider splitting if..." | "You MUST split when..." |
| "It's recommended to..." | "REQUIRED: ..." |
| "Avoid..." | "NEVER..." |

**Files to update:**
- `provider/opinkode/agents/fuska/fuska-planner.md` - Scope estimation, task breakdown sections
- `provider/opinkode/agents/fuska/fuska-executor.md` - Deviation rules, commit protocol
- `provider/opinkode/agents/fuska/fuska-plan-checker.md` - Verification dimensions
- `provider/opinkode/agents/fuska/fuska-verifier.md` - Critical rules section

### Rule 3: Specify a Default Language

**GLM behavior:** Multilingual model that may switch languages or output Chinese reasoning traces.

**Fuska adaptation:**

Add to ALL agent definitions after `<role>`:

```xml
<language>
You MUST respond in English at all times.
All code comments, documentation, reasoning, and output MUST be in English.
Never use Chinese or other languages in your responses or internal reasoning.
</language>
```

**Files to update:**
- All files in `provider/opinkode/agents/fuska/`

### Rule 4: Leverage Role-Play

**GLM behavior:** Effectively maintains personas. Internal thinking blocks mirror role prompts closely.

**Fuska status:** ALREADY EXCELLENT - No changes needed.

Each agent has explicit `<role>` sections:
- `fuska-phase-researcher`: "You are a Fuska phase researcher"
- `fuska-planner`: "You are a Fuska planner"
- `fuska-plan-checker`: "You are a Fuska plan checker"
- `fuska-executor`: "You are a Fuska plan executor"
- `fuska-verifier`: "You are a Fuska phase verifier"

### Rule 5: Break Up the Task

**GLM behavior:** Single reasoning pass per prompt. Better results from breaking into sub-steps.

**Fuska status:** ALREADY EXCELLENT - No changes needed.

The Fuska workflow naturally decomposes:
1. **Multi-agent chain:** Research → Plan → Check → Execute → Verify
2. **Task limits:** Planner enforces 2-3 tasks per plan
3. **Multiple plans:** Complex phases split into multiple plans
4. **Wave execution:** Parallel plans in dependency waves
5. **Atomic commits:** Each task committed separately

## Implementation Priority

### P0 — Critical (Required for GLM Compatibility)

1. **Add language directive to all agents** (Rule 3)
   - Add `<language>` block after `<role>` in all 19 agent files
   - Low effort, high impact, prevents Chinese output
   - Files: All files in `provider/opinkode/agents/fuska/`

2. **Strengthen instruction language** (Rule 2)
   - Replace "should" with "MUST" in: planner, executor, checker, verifier
   - Low effort, high impact, ensures reliable instruction following
   - Files: `fuska-planner.md`, `fuska-verifier.md`, `fuska-plan-checker.md`

### P1 — High (Recommended for Quality)

3. **Reorder orchestrator prompts** (Rule 1)
   - Move `<critical_constraints>` before `<context>` in agent spawn prompts
   - Files: `fuska-do.md`, `fuska-plan-phase.md`
   - Medium effort, high impact

### Already Excellent (No Changes Needed)

4. **Role-play** (Rule 4) — All agents have explicit personas
5. **Task breakup** (Rule 5) — Multi-agent chain with 2-3 task limits
6. **Critics pattern** (Rule 8) — Checker/verifier chain implemented
7. **Hybrid routing** (Rule 9) — Model profile config in fuska-do.md

## Files to Update

### Agents (Language Directive)

All 19 agents need `<language>` directive added after `<role>`:

| Agent | File |
|-------|------|
| fuska-planner | `agents/fuska/fuska-planner.md` |
| fuska-executor | `agents/fuska/fuska-executor.md` |
| fuska-plan-checker | `agents/fuska/fuska-plan-checker.md` |
| fuska-verifier | `agents/fuska/fuska-verifier.md` |
| fuska-phase-researcher | `agents/fuska/fuska-phase-researcher.md` |
| fuska-roadmapper | `agents/fuska/fuska-roadmapper.md` |
| fuska-debugger | `agents/fuska/fuska-debugger.md` |
| fuska-git-message | `agents/fuska/fuska-git-message.md` |
| fuska-commit-checker | `agents/fuska/fuska-commit-checker.md` |
| fuska-plan-checker-panel | `agents/fuska/fuska-plan-checker-panel.md` |
| fuska-codebase-mapper | `agents/fuska/fuska-codebase-mapper.md` |
| fuska-integration-checker | `agents/fuska/fuska-integration-checker.md` |
| fuska-research-synthesizer | `agents/fuska/fuska-research-synthesizer.md` |
| fuska-initiative-researcher | `agents/fuska/fuska-initiative-researcher.md` |
| fuska-doc-researcher | `agents/fuska/fuska-doc-researcher.md` |
| fuska-doc-writer | `agents/fuska/fuska-doc-writer.md` |
| fuska-doc-planner | `agents/fuska/fuska-doc-planner.md` |
| fuska-doc-reviewer | `agents/fuska/fuska-doc-reviewer.md` |
| fuska-doc-checker | `agents/fuska/fuska-doc-checker.md` |

### Agents (Language Strengthening)

| Agent | Changes |
|-------|---------|
| fuska-planner | 4 locations: lines ~93, ~95, ~357, ~369 |
| fuska-verifier | 1 location: line ~18 |
| fuska-plan-checker | Pattern: "should" → "MUST" in verification instructions |

### Commands (Prompt Reordering)

| Command | Changes |
|---------|---------|
| fuska-do.md | Steps 5, 6, 7, 9, 10 - move constraints before context |
| fuska-plan-phase.md | Researcher, Planner, Checker spawn prompts |

## Additional GLM Considerations

### Critics Pattern (Rule 8) — ALREADY EXCELLENT

**GLM behavior:** "Following from rule 4, one of the most powerful patterns when working with GLM (or any LLM) is to employ specialized critic agents to review and validate outputs before allowing the main agentic flow to advance in its plan."

**Fuska status:** ALREADY EXCELLENT — No changes needed.

Fuska implements the exact architecture GLM recommends:

| Critic Agent | Reviews | Catches |
|--------------|---------|---------|
| fuska-plan-checker | Planner output | Incomplete tasks, scope creep, missing verification |
| fuska-plan-checker-panel | Complex plans | Multi-perspective validation (quality, context, expert) |
| fuska-verifier | Executor output | Goal achievement vs task completion gaps |
| fuska-commit-checker | Git commit messages | Format violations, scope creep |
| fuska-integration-checker | Phase boundaries | Cross-phase integration failures |
| fuska-doc-checker | Documentation | Outline compliance, section coverage |

**Pattern flow:**
```
Generator Agent → Critic Agent → (Pass) Continue / (Fail) Revise
```

This matches GLM's recommended "generation and validation are decoupled" architecture.

### Hybrid Model Routing (Rule 9) — ALREADY EXCELLENT

**GLM behavior:** Route simple tasks to fast models, complex reasoning to frontier models.

**Fuska status:** ALREADY EXCELLENT — Hybrid routing implemented in fuska-do.md via model_profile config.

Current implementation:
- `model_profile: quality` → Uses quality_model for planner, executor
- `model_profile: balanced` → Uses balanced_model for most agents
- `model_profile: budget` → Uses budget_model where acceptable

Configured via `model_aliases` in config concept:
```typescript
model_aliases: {
  quality_model: "opencode/claude-opus-4",
  balanced_model: "zai-coding-plan/glm-5",
  budget_model: "zai-coding-plan/glm-5"
}
```

## Testing Checklist

After implementing GLM adaptations:

- [ ] All 19 agents have `<language>` directive after `<role>`
- [ ] fuska-planner.md uses MUST/STRICTLY language (4 locations)
- [ ] fuska-verifier.md uses MUST language (1 location)
- [ ] fuska-plan-checker.md uses MUST language where appropriate
- [ ] fuska-do.md orchestrator prompts place constraints before context (5 prompts)
- [ ] fuska-plan-phase.md orchestrator prompts place constraints before context
- [ ] Test run with `/fuska-do planned test task` completes successfully
- [ ] Test run with `/fuska-do verified complex task` completes successfully
- [ ] No Chinese text appears in any agent output

## References

- GLM 4.7 Migration Guide: https://www.cerebras.ai/blog/glm-4-7-migration-guide
- Cerebras API Docs: https://cloud.cerebras.ai
- Model ID: Configurable via `model_aliases` in config concept (e.g., `zai-coding-plan/glm-5`)

## Summary Statistics

| Category | Count |
|----------|-------|
| Agents needing language directive | 19 |
| Agents needing language strengthening | 3 |
| Orchestrator prompts to reorder | ~8 |
| Total file modifications | ~22 |
