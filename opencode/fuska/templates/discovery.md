# Discovery Template (MegaMemory-Backed)

Template for shallow research for library/option decisions - stored in MegaMemory.

---

## Original Template Structure

```markdown
---
phase: XX-name
type: discovery
topic: [discovery-topic]
---

<session_initialization>
Before beginning discovery, verify today's date:
!\`date +%Y-%m-%d\`

Use this date when searching for "current" or "latest" information.
Example: If today is 2025-11-22, search for "2025" not "2024".
</session_initialization>

<discovery_objective>
Discover [topic] to inform [phase name] implementation.

Purpose: [What decision/implementation this enables]
Scope: [Boundaries]
Output: DISCOVERY.md with recommendation
</discovery_objective>

<discovery_scope>
<include>
- [Question to answer]
- [Area to investigate]
- [Specific comparison if needed]
</include>

<exclude>
- [Out of scope for this discovery]
- [Defer to implementation phase]
</exclude>
</discovery_scope>
```

### Output Structure

```markdown
# [Topic] Discovery

## Summary
[2-3 paragraph executive summary - what was researched, what was found, what's recommended]

## Primary Recommendation
[What to do and why - be specific and actionable]

## Alternatives Considered
[What else was evaluated and why not chosen]

## Key Findings

### [Category 1]
- [Finding with source URL and relevance to our case]

### [Category 2]
- [Finding with source URL and relevance]

## Code Examples
[Relevant implementation patterns, if applicable]

## Metadata

<metadata>
<confidence level="high|medium|low">
[Why this confidence level - based on source quality and verification]
</confidence>

<sources>
- [Primary authoritative sources used]
</sources>

<open_questions>
[What couldn't be determined or needs validation during implementation]
</open_questions>

<validation_checkpoints>
[If confidence is LOW or MEDIUM, list specific things to verify during implementation]
</validation_checkpoints>
</metadata>
```

---

## MegaMemory Schema

```typescript
<megamemory_schema>
concept_kind: "discovery"

summary: |
  Discovery: {topic} for Phase {phase_number}: {phase_name}
  Recommendation: {primary_recommendation}
  Confidence: {high|medium|low}
  {2-3 sentence executive summary}

why: |
  Shallow research for library/option decisions during mandatory discovery in plan-phase.
  Answers "which library/option should we use" questions.
  Enables informed implementation decisions.

edges: [
  {
    to: "phase-{phase_number}",
    relation: "connects_to",
    description: "Discovery informs this phase implementation"
  }
]
</megamemory_schema>
```

---

## MegaMemory Operations

```markdown
<megamemory_operations>
**Create Discovery (when starting research):**

1. Create concept with topic, objective, scope
2. Set confidence to "low" (will be updated)
3. Link to parent phase
4. Return concept ID for updates

**Update Findings (during research):**

1. Update summary with key findings by category
2. Track sources (Context7, official docs, webfetch)
3. Note confidence level for each finding
4. Append code examples if found

**Finalize Discovery (when recommendation ready):**

1. Update summary with primary recommendation
2. List alternatives considered with rationale
3. Set overall confidence level (high/medium/low)
4. Document open_questions and validation_checkpoints if needed
5. Link to phase concept

**Query Discovery (when planning):**

1. Query by phase number or topic
2. Read recommendation, confidence, findings
3. Use findings to inform PLAN.md creation
</megamemory_operations>
```

---

## MegaMemory Examples

```typescript
<megamemory_examples>
```typescript
// Create a new discovery
const createDiscovery = async (phaseNumber: string, phaseName: string, topic: string, objective: string) => {
  const concept = await megamemory_create_concept({
    name: `Discovery: ${topic}`,
    kind: "discovery",
    summary: `Discovery: ${topic} for Phase ${phaseNumber}: ${phaseName}\n` +
             `Objective: ${objective}\n` +
             `Confidence: low\n` +
             `Status: in_progress`,
    why: "Shallow research for library/option decisions during mandatory discovery in plan-phase. " +
          "Answers 'which library/option should we use' questions. " +
          "Enables informed implementation decisions.",
    edges: [{
      to: `phase-${phaseNumber}`,
      relation: "connects_to",
      description: "Discovery informs this phase implementation"
    }],
    created_by_task: `Discovery for Phase ${phaseNumber}`
  });

  return concept.id;
};

// Add findings by category
const addFindings = async (discoveryId: string, category: string, findings: Array<{
  finding: string;
  source: string;
  url?: string;
  confidence: 'high' | 'medium' | 'low';
}>) => {
  await megamemory_update_concept({
    id: discoveryId,
    changes: {
      summary: (currentSummary) => {
        const section = `\n\nKEY FINDINGS - ${category}:\n` +
                        findings.map(f =>
                          `- ${f.finding} (Source: ${f.source}${f.url ? `, ${f.url}` : ''}) ` +
                          `[Confidence: ${f.confidence}]`
                        ).join('\n');

        return currentSummary + section;
      }
    }
  });
};

// Add code example
const addCodeExample = async (discoveryId: string, language: string, code: string) => {
  await megamemory_update_concept({
    id: discoveryId,
    changes: {
      summary: (currentSummary) => {
        const section = `\n\nCODE EXAMPLE (${language}):\n` +
                        '```' + language + '\n' +
                        code + '\n' +
                        '```';

        return currentSummary + section;
      }
    }
  });
};

// Finalize discovery with recommendation
const finalizeDiscovery = async (discoveryId: string, recommendation: {
  primary: string;
  alternatives: Array<{ option: string; whyNot: string }>;
  overallConfidence: 'high' | 'medium' | 'low';
  openQuestions?: string[];
  validationCheckpoints?: string[];
}) => {
  await megamemory_update_concept({
    id: discoveryId,
    changes: {
      summary: (currentSummary) => {
        let updated = currentSummary
          .replace(/Confidence: low/, `Confidence: ${recommendation.overallConfidence}`)
          .replace(/Status: in_progress/, 'Status: complete');

        const section = `\n\nRECOMMENDATION:\n` +
                         `Primary: ${recommendation.primary}\n\n` +
                         `Alternatives considered:\n` +
                         recommendation.alternatives.map(a => `- ${a.option} (why not: ${a.whyNot})`).join('\n');

        if (recommendation.openQuestions && recommendation.openQuestions.length > 0) {
          updated += `\n\nOpen questions:\n` + recommendation.openQuestions.map(q => `- ${q}`).join('\n');
        }

        if (recommendation.validationCheckpoints && recommendation.validationCheckpoints.length > 0) {
          updated += `\n\nValidation checkpoints (verify during implementation):\n` +
                     recommendation.validationCheckpoints.map(v => `- ${v}`).join('\n');
        }

        return updated.replace(/STATUS: in_progress/, `${section}\n\nStatus: complete`);
      }
    }
  });
};

// Query discovery for planning
const queryDiscovery = async (phaseNumber: string) => {
  const results = await megamemory_understand({
    query: `Discovery for Phase ${phaseNumber} with recommendations, findings, confidence level`
  });

  if (results.length > 0) {
    const discovery = results[0];
    const summary = discovery.summary;

    // Parse recommendation
    const recommendation = {
      primary: summary.match(/Primary: ([^\n]+)/)?.[1] || '',
      alternatives: [],
      confidence: summary.match(/Confidence: (high|medium|low)/)?.[1] || 'low'
    };

    const altMatches = summary.matchAll(/- ([^\n]+) \(why not: ([^\n]+)\)/g);
    for (const match of altMatches) {
      recommendation.alternatives.push({ option: match[1], whyNot: match[2] });
    }

    // Parse findings by category
    const findings: Record<string, string[]> = {};
    const categoryMatches = summary.matchAll(/KEY FINDINGS - ([^:]+):\n([\s\S]*?)(?=\n\n[A-Z]|\n\nRECOMMENDATION|$)/g);
    for (const match of categoryMatches) {
      const category = match[1];
      const content = match[2];
      findings[category] = content.split('\n').filter(line => line.startsWith('- ')).map(line => line.slice(2));
    }

    // Parse code examples
    const codeExamples: Array<{ language: string; code: string }> = [];
    const codeMatches = summary.matchAll(/CODE EXAMPLE \((\w+)\):\n```(\w+)\n([\s\S]*?)\n```/g);
    for (const match of codeMatches) {
      codeExamples.push({ language: match[1], code: match[3] });
    }

    // Parse validation checkpoints
    const validationCheckpoints = summary.includes('Validation checkpoints:')
      ? summary.match(/Validation checkpoints:([\s\S]*?)(?=\n\n|$)/)?.[1]
          .split('\n')
          .filter(line => line.startsWith('- '))
          .map(line => line.slice(2)) || []
      : [];

    return {
      id: discovery.id,
      phase: phaseNumber,
      recommendation,
      findings,
      codeExamples,
      validationCheckpoints
    };
  }

  return null;
};
```
</megamemory_examples>
```

---

## Discovery Protocol

```markdown
**Source Priority:**

1. **Context7 MCP** - For library/framework documentation (current, authoritative)
2. **Official Docs** - For platform-specific or non-indexed libraries
3. **webfetch** - For comparisons, trends, community patterns (verify all findings)

**Quality Checklist:**

Before completing discovery, verify:
- [ ] All claims have authoritative sources (Context7 or official docs)
- [ ] Negative claims ("X is not possible") verified with official documentation
- [ ] API syntax/configuration from Context7 or official docs (never webfetch alone)
- [ ] webfetch findings cross-checked with authoritative sources
- [ ] Recent updates/changelogs checked for breaking changes
- [ ] Alternative approaches considered (not just first solution found)

**Confidence Levels:**

- HIGH: Context7 or official docs confirm
- MEDIUM: webfetch + Context7/official docs confirm
- LOW: webfetch only or training knowledge only (mark for validation)
```

---

## When to Use Discovery

```markdown
**Use discovery when:**

- Technology choice unclear (library A vs B)
- Best practices needed for unfamiliar integration
- API/library investigation required
- Single decision pending

**Do NOT use when:**

- Established patterns (CRUD, auth with known library)
- Implementation details (defer to execution)
- Questions answerable from existing project context

**Use RESEARCH.md instead when:**

- Niche/complex domains (3D, games, audio, shaders)
- Need ecosystem knowledge, not just library choice
- "How do experts build this" questions
- Use `/fuska-research-phase` for these
```

---

## Success Criteria

```markdown
Complete discovery when:

- All scope questions answered with authoritative sources
- Quality checklist items completed
- Clear primary recommendation
- Low-confidence findings marked with validation checkpoints
- Ready to inform PLAN.md creation
```
