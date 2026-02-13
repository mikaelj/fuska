# Requirements Template (MegaMemory-Backed)

Template for MegaMemory-based requirements tracking. **For @-reference only by agents — data stored in MegaMemory, never on disk.**

---

<megamemory_schema>

## Concept Structure

```typescript
interface RequirementConcept {
  name: string;
  kind: "feature" | "config";
  summary: string;
  parent_id?: string;
  edges?: ConceptEdge[];
  file_refs?: string[];
}
```

## Root Requirements Concept

```
name: "[Project Name] Requirements"
kind: "config"
summary: "Requirements for [Project Name]. Core Value: [from PROJECT.md]. v1 requirements: [X] total. v2 requirements: [Y] total. Out of scope: [Z] features."
```

## Requirement Concepts

### Individual Requirement
```
name: "[CATEGORY]-[NUMBER]: [Requirement description]"
kind: "feature"
summary: "User-centric, testable, atomic requirement"
parent_id: "[Project Name] Requirements"
edges: [{to: "Phase [N]: [Phase Name]", relation: "configured_by", description: "Requirement covered in Phase [N]"}]
```

### Category Concept
```
name: "[Category] Requirements"
kind: "config"
summary: "[CATEGORY]-[01-N] requirements for [Category] feature area"
parent_id: "[Project Name] Requirements"
```

### V2 Requirement
```
name: "[CATEGORY]-[NUMBER]: [Requirement description] (v2)"
kind: "feature"
summary: "Deferred requirement for future release. Not in current roadmap."
parent_id: "[Project Name] Requirements"
```

## Out of Scope Concept

```
name: "Out of Scope Features"
kind: "config"
summary: "Explicitly excluded features with reasoning: [Feature] — [Reason]"
parent_id: "[Project Name] Requirements"
```

## Traceability Concept

```
name: "Requirement Traceability"
kind: "config"
summary: "Coverage: v1 requirements [X] total, mapped to phases [Y], unmapped [Z]\n[REQ-ID] → Phase [N]: [status]"
parent_id: "[Project Name] Requirements"
```

</megamemory_schema>

---

<megamemory_operations>

## Initialize Requirements

```typescript
const requirements = await megamemory.create_concept({
  name: "CommunityApp Requirements",
  kind: "config",
  summary: "Requirements for CommunityApp. Core Value: Users can share and discuss content with people who share their interests. v1 requirements: 18 total. v2 requirements: 9 total. Out of scope: 4 features."
});

// Authentication category
await megamemory.create_concept({
  name: "Authentication Requirements",
  kind: "config",
  summary: "AUTH-01 through AUTH-04 requirements for authentication feature area",
  parent_id: requirements.id
});

// V1 Requirements
const auth01 = await megamemory.create_concept({
  name: "AUTH-01: User can sign up with email and password",
  kind: "feature",
  summary: "User creates account by providing email and password. Validation for email format and password strength.",
  parent_id: requirements.id
});

const auth02 = await megamemory.create_concept({
  name: "AUTH-02: User receives email verification after signup",
  kind: "feature",
  summary: "Verification email sent after signup. User must click link to activate account.",
  parent_id: requirements.id
});

const auth03 = await megamemory.create_concept({
  name: "AUTH-03: User can reset password via email link",
  kind: "feature",
  summary: "Password reset flow sends email with reset link. Link expires after 1 hour.",
  parent_id: requirements.id
});

const auth04 = await megamemory.create_concept({
  name: "AUTH-04: User session persists across browser refresh",
  kind: "feature",
  summary: "Session stored in localStorage. User stays logged in after closing browser.",
  parent_id: requirements.id
});

// Profile requirements
await megamemory.create_concept({
  name: "Profiles Requirements",
  kind: "config",
  summary: "PROF-01 through PROF-04 requirements for profile feature area",
  parent_id: requirements.id
});

await megamemory.create_concept({
  name: "PROF-01: User can create profile with display name",
  kind: "feature",
  summary: "User sets display name (3-30 chars, alphanumeric + spaces). Required field.",
  parent_id: requirements.id
});

await megamemory.create_concept({
  name: "PROF-02: User can upload avatar image",
  kind: "feature",
  summary: "User uploads avatar (JPG/PNG, max 5MB, resized to 200x200). Optional field.",
  parent_id: requirements.id
});

await megamemory.create_concept({
  name: "PROF-03: User can write bio (max 500 chars)",
  kind: "feature",
  summary: "User writes bio text (max 500 chars). Supports emojis. Optional field.",
  parent_id: requirements.id
});

await megamemory.create_concept({
  name: "PROF-04: User can view other users' profiles",
  kind: "feature",
  summary: "User navigates to profile page. Shows display name, avatar, bio, and post count.",
  parent_id: requirements.id
});

// Content requirements
await megamemory.create_concept({
  name: "Content Requirements",
  kind: "config",
  summary: "CONT-01 through CONT-05 requirements for content feature area",
  parent_id: requirements.id
});

await megamemory.create_concept({
  name: "CONT-01: User can create text post",
  kind: "feature",
  summary: "User writes post text (1-280 chars). Supports emojis. Published to feed immediately.",
  parent_id: requirements.id
});

await megamemory.create_concept({
  name: "CONT-02: User can upload image with post",
  kind: "feature",
  summary: "User attaches image to post (JPG/PNG, max 10MB). Optional. Multiple images not supported in v1.",
  parent_id: requirements.id
});

await megamemory.create_concept({
  name: "CONT-03: User can edit own posts",
  kind: "feature",
  summary: "User edits post content within 15 minutes of creation. Edit history not tracked.",
  parent_id: requirements.id
});

await megamemory.create_concept({
  name: "CONT-04: User can delete own posts",
  kind: "feature",
  summary: "User deletes own post. Confirmation required. Action is permanent.",
  parent_id: requirements.id
});

await megamemory.create_concept({
  name: "CONT-05: User can view feed of posts",
  kind: "feature",
  summary: "Feed shows posts from followed users sorted by timestamp. Infinite scroll pagination.",
  parent_id: requirements.id
});

// Social requirements
await megamemory.create_concept({
  name: "Social Requirements",
  kind: "config",
  summary: "SOCL-01 through SOCL-05 requirements for social feature area",
  parent_id: requirements.id
});

await megamemory.create_concept({
  name: "SOCL-01: User can follow other users",
  kind: "feature",
  summary: "User clicks follow button on profile. Follow button becomes unfollow.",
  parent_id: requirements.id
});

await megamemory.create_concept({
  name: "SOCL-02: User can unfollow users",
  kind: "feature",
  summary: "User clicks unfollow button. Confirmation required. Follower count updates.",
  parent_id: requirements.id
});

await megamemory.create_concept({
  name: "SOCL-03: User can like posts",
  kind: "feature",
  summary: "User clicks like button. Like button toggles. Like count updates.",
  parent_id: requirements.id
});

await megamemory.create_concept({
  name: "SOCL-04: User can comment on posts",
  kind: "feature",
  summary: "User writes comment (1-280 chars). Comments shown under post. Nested comments not supported in v1.",
  parent_id: requirements.id
});

await megamemory.create_concept({
  name: "SOCL-05: User can view activity feed",
  kind: "feature",
  summary: "Activity feed shows posts from followed users. Shows new posts indicator.",
  parent_id: requirements.id
});

// V2 Requirements
await megamemory.create_concept({
  name: "NOTF-01: User receives in-app notifications (v2)",
  kind: "feature",
  summary: "User gets notifications for likes and comments. Notification bell shows count.",
  parent_id: requirements.id
});

await megamemory.create_concept({
  name: "NOTF-02: User receives email for new followers (v2)",
  kind: "feature",
  summary: "Email sent when user gains new follower. Email settings customizable.",
  parent_id: requirements.id
});

await megamemory.create_concept({
  name: "MODR-01: User can report content (v2)",
  kind: "feature",
  summary: "User reports inappropriate content. Report sent to moderators for review.",
  parent_id: requirements.id
});

// Out of scope
await megamemory.create_concept({
  name: "Out of Scope Features",
  kind: "config",
  summary: "Real-time chat — High complexity, not core to community value\nVideo posts — Storage/bandwidth costs, defer to v2+\nOAuth login — Email/password sufficient for v1\nMobile app — Web-first, mobile later",
  parent_id: requirements.id
});

// Traceability
await megamemory.create_concept({
  name: "Requirement Traceability",
  kind: "config",
  summary: "Coverage: v1 requirements 18 total, mapped to phases 18, unmapped 0\nAUTH-01 → Phase 1: Pending\nAUTH-02 → Phase 1: Pending\nAUTH-03 → Phase 1: Pending\nAUTH-04 → Phase 1: Pending",
  parent_id: requirements.id
});
```

## Map Requirement to Phase

```typescript
const phase1 = await megamemory.understand({
  query: "Phase 1"
});

await megamemory.link({
  from: "AUTH-01: User can sign up with email and password",
  to: phase1[0].id,
  relation: "configured_by",
  description: "Requirement covered in Phase 1"
});

await megamemory.link({
  from: "AUTH-02: User receives email verification after signup",
  to: phase1[0].id,
  relation: "configured_by",
  description: "Requirement covered in Phase 1"
});

// Update traceability
await megamemory.update_concept({
  id: "Requirement Traceability",
  changes: {
    summary: "Coverage: v1 requirements 18 total, mapped to phases 18, unmapped 0\nAUTH-01 → Phase 1: In Progress\nAUTH-02 → Phase 1: In Progress\nAUTH-03 → Phase 1: Pending\nAUTH-04 → Phase 1: Pending"
  }
});
```

## Mark Requirement Complete

```typescript
await megamemory.update_concept({
  id: "AUTH-01: User can sign up with email and password",
  changes: {
    summary: "✅ COMPLETE: User creates account by providing email and password. Validation for email format and password strength. Shipped: Phase 1."
  }
});

await megamemory.update_concept({
  id: "Requirement Traceability",
  changes: {
    summary: "Coverage: v1 requirements 18 total, mapped to phases 18, unmapped 0\nAUTH-01 → Phase 1: Complete\nAUTH-02 → Phase 1: Complete\nAUTH-03 → Phase 1: Complete\nAUTH-04 → Phase 1: Complete"
  }
});
```

## Add New Requirement

```typescript
await megamemory.create_concept({
  name: "PROF-05: User can view post history on profile",
  kind: "feature",
  summary: "Profile page shows user's recent posts. Shows 10 most recent, load more available.",
  parent_id: "CommunityApp Requirements"
});

// Update category
await megamemory.update_concept({
  id: "Profiles Requirements",
  changes: {
    summary: "PROF-01 through PROF-05 requirements for profile feature area"
  }
});

// Update traceability
await megamemory.update_concept({
  id: "Requirement Traceability",
  changes: {
    summary: "Coverage: v1 requirements 19 total, mapped to phases 19, unmapped 0\nPROF-05 → Phase 2: In Progress"
  }
});
```

## Query Requirements

```typescript
// Get all requirements
const allReqs = await megamemory.understand({
  query: "CommunityApp Requirements"
});

// Get v1 requirements
const v1Reqs = await megamemory.understand({
  query: "Requirements v1 pending in progress"
});

// Get requirements by category
const authReqs = await megamemory.understand({
  query: "Authentication requirements AUTH"
});

// Get unmapped requirements
const unmapped = await megamemory.understand({
  query: "Requirements unmapped not mapped to phase"
});

// Get traceability
const traceability = await megamemory.understand({
  query: "Requirement Traceability coverage"
});
```

</megamemory_operations>

---

<megamemory_examples>

## Requirements Initialization Helper

```typescript
interface RequirementConfig {
  id: string;
  description: string;
  details: string;
  category: string;
  version: "v1" | "v2";
}

async function initializeRequirements(
  projectName: string,
  coreValue: string,
  requirements: RequirementConfig[],
  outOfScope: Array<{ feature: string; reason: string }>
) {
  const reqConcept = await megamemory.create_concept({
    name: `${projectName} Requirements`,
    kind: "config",
    summary: `Requirements for ${projectName}. Core Value: ${coreValue}. v1 requirements: ${requirements.filter(r => r.version === "v1").length} total. v2 requirements: ${requirements.filter(r => r.version === "v2").length} total. Out of scope: ${outOfScope.length} features.`
  });

  // Group by category
  const categories = new Map<string, string[]>();
  for (const req of requirements) {
    if (!categories.has(req.category)) {
      categories.set(req.category, []);
    }
    categories.get(req.category)!.push(req.id);
  }

  // Create category concepts
  for (const [category, reqIds] of categories) {
    const [prefix] = reqIds[0].split('-');
    await megamemory.create_concept({
      name: `${category} Requirements`,
      kind: "config",
      summary: `${reqIds[0]} through ${reqIds[reqIds.length - 1]} requirements for ${category} feature area`,
      parent_id: reqConcept.id
    });
  }

  // Create requirement concepts
  for (const req of requirements) {
    const suffix = req.version === "v2" ? " (v2)" : "";
    await megamemory.create_concept({
      name: `${req.id}: ${req.description}${suffix}`,
      kind: "feature",
      summary: req.details,
      parent_id: reqConcept.id
    });
  }

  // Create out of scope
  if (outOfScope.length > 0) {
    await megamemory.create_concept({
      name: "Out of Scope Features",
      kind: "config",
      summary: outOfScope.map(o => `${o.feature} — ${o.reason}`).join('\n'),
      parent_id: reqConcept.id
    });
  }

  // Create traceability (empty initially)
  await megamemory.create_concept({
    name: "Requirement Traceability",
    kind: "config",
    summary: `Coverage: v1 requirements ${requirements.filter(r => r.version === "v1").length} total, mapped to phases 0, unmapped ${requirements.filter(r => r.version === "v1").length} [WARN]`,
    parent_id: reqConcept.id
  });

  return reqConcept.id;
}

// Usage
await initializeRequirements(
  "CommunityApp",
  "Users can share and discuss content with people who share their interests",
  [
    {
      id: "AUTH-01",
      description: "User can sign up with email and password",
      details: "User creates account by providing email and password. Validation for email format and password strength.",
      category: "Authentication",
      version: "v1"
    },
    {
      id: "AUTH-02",
      description: "User receives email verification after signup",
      details: "Verification email sent after signup. User must click link to activate account.",
      category: "Authentication",
      version: "v1"
    },
    {
      id: "PROF-01",
      description: "User can create profile with display name",
      details: "User sets display name (3-30 chars, alphanumeric + spaces). Required field.",
      category: "Profiles",
      version: "v1"
    },
    {
      id: "NOTF-01",
      description: "User receives in-app notifications",
      details: "User gets notifications for likes and comments. Notification bell shows count.",
      category: "Notifications",
      version: "v2"
    }
  ],
  [
    { feature: "Real-time chat", reason: "High complexity, not core to community value" },
    { feature: "Video posts", reason: "Storage/bandwidth costs, defer to v2+" }
  ]
);
```

## Traceability Manager

```typescript
interface TraceabilityEntry {
  requirementId: string;
  requirementDescription: string;
  phase: string;
  status: "Pending" | "In Progress" | "Complete" | "Blocked";
}

async function mapRequirementToPhase(
  projectName: string,
  requirementId: string,
  phaseName: string
) {
  const traceability = await megamemory.understand({
    query: "Requirement Traceability"
  });

  if (traceability.length > 0) {
    const current = traceability[0].summary;

    // Parse current entries
    const lines = current.split('\n');
    const coverageLine = lines[0];

    // Check if requirement already mapped
    const existingEntry = lines.find(l => l.startsWith(`${requirementId} →`));
    if (existingEntry) {
      return; // Already mapped
    }

    // Add new entry
    const newEntry = `${requirementId} → ${phaseName}: Pending`;
    const updated = [...lines, newEntry].join('\n');

    // Update coverage
    const match = coverageLine.match(/mapped to phases (\d+), unmapped (\d+)/);
    if (match) {
      const mapped = parseInt(match[1]) + 1;
      const unmapped = parseInt(match[2]) - 1;
      const newCoverage = coverageLine.replace(
        /mapped to phases \d+, unmapped \d+/,
        `mapped to phases ${mapped}, unmapped ${unmapped}`
      );

      await megamemory.update_concept({
        id: traceability[0].id,
        changes: {
          summary: updated.replace(coverageLine, newCoverage)
        }
      });
    }
  }
}

async function updateRequirementStatus(
  projectName: string,
  requirementId: string,
  status: "In Progress" | "Complete" | "Blocked"
) {
  const traceability = await megamemory.understand({
    query: "Requirement Traceability"
  });

  if (traceability.length > 0) {
    const current = traceability[0].summary;
    const lines = current.split('\n');

    // Find and update the entry
    const updatedLines = lines.map(line => {
      if (line.startsWith(`${requirementId} →`)) {
        return line.replace(/: (Pending|In Progress|Complete|Blocked)$/, `: ${status}`);
      }
      return line;
    });

    await megamemory.update_concept({
      id: traceability[0].id,
      changes: {
        summary: updatedLines.join('\n')
      }
    });
  }
}

// Usage
await mapRequirementToPhase("CommunityApp", "AUTH-01", "Phase 1");
await updateRequirementStatus("CommunityApp", "AUTH-01", "In Progress");
await updateRequirementStatus("CommunityApp", "AUTH-01", "Complete");
```

## Requirements Query Helper

```typescript
async function getRequirements(projectName: string): Promise<{
  v1: TraceabilityEntry[];
  v2: string[];
  outOfScope: Array<{ feature: string; reason: string }>;
  coverage: { total: number; mapped: number; unmapped: number };
}> {
  const concepts = await megamemory.understand({
    query: `${projectName} Requirements`
  });

  const result = {
    v1: [] as TraceabilityEntry[],
    v2: [] as string[],
    outOfScope: [] as Array<{ feature: string; reason: string }>,
    coverage: { total: 0, mapped: 0, unmapped: 0 }
  };

  for (const concept of concepts) {
    if (concept.name.includes("Requirements") && !concept.name.includes(projectName)) {
      // Category concept, skip
      continue;
    } else if (concept.name === "Out of Scope Features") {
      // Parse out of scope
      const lines = concept.summary.split('\n');
      for (const line of lines) {
        const match = line.match(/(.+) — (.+)/);
        if (match) {
          result.outOfScope.push({ feature: match[1], reason: match[2] });
        }
      }
    } else if (concept.name === "Requirement Traceability") {
      // Parse coverage
      const match = concept.summary.match(/v1 requirements (\d+) total, mapped to phases (\d+), unmapped (\d+)/);
      if (match) {
        result.coverage = {
          total: parseInt(match[1]),
          mapped: parseInt(match[2]),
          unmapped: parseInt(match[3])
        };
      }

      // Parse v1 entries
      const lines = concept.summary.split('\n');
      for (const line of lines) {
        if (line.includes(' → ')) {
          const [reqPart, phasePart] = line.split(' → ');
          const [reqId] = reqPart.split(':');
          const [phase, status] = phasePart.split(': ');
          result.v1.push({
            requirementId: reqId.trim(),
            requirementDescription: reqPart.replace(`${reqId}: `, '').trim(),
            phase: phase.trim(),
            status: status as any
          });
        }
      }
    } else if (concept.name.includes('(v2)')) {
      // v2 requirement
      result.v2.push(concept.name.replace(' (v2)', ''));
    }
  }

  return result;
}

// Usage
const reqs = await getRequirements("CommunityApp");
console.log(`Coverage: ${reqs.coverage.mapped}/${reqs.coverage.total} (${reqs.coverage.unmapped} unmapped)`);
console.log(`V1 Complete: ${reqs.v1.filter(r => r.status === "Complete").length}`);
```

</megamemory_examples>

---

<template>

**Original template structure preserved for reference:**

```markdown
# Requirements: [Project Name]

**Defined:** [date]
**Core Value:** [from PROJECT.md]

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [ ] **AUTH-01**: User can sign up with email and password
- [ ] **AUTH-02**: User receives email verification after signup
- [ ] **AUTH-03**: User can reset password via email link
- [ ] **AUTH-04**: User session persists across browser refresh

### [Category 2]

- [ ] **[CAT]-01**: [Requirement description]
- [ ] **[CAT]-02**: [Requirement description]
- [ ] **[CAT]-03**: [Requirement description]

### [Category 3]

- [ ] **[CAT]-01**: [Requirement description]
- [ ] **[CAT]-02**: [Requirement description]

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### [Category]

- **[CAT]-01**: [Requirement description]
- **[CAT]-02**: [Requirement description]

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| [Feature] | [Why excluded] |
| [Feature] | [Why excluded] |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| [REQ-ID] | Phase [N] | Pending |

**Coverage:**
- v1 requirements: [X] total
- Mapped to phases: [Y]
- Unmapped: [Z] [WARN]

---
*Requirements defined: [date]*
*Last updated: [date] after [trigger]*
```

</template>

---

<Guidelines>

**Requirement Format:**
- ID: `[CATEGORY]-[NUMBER]` (AUTH-01, CONTENT-02, SOCIAL-03)
- Description: User-centric, testable, atomic
- Checkbox: Only for v1 requirements (v2 are not yet actionable)

**Categories:**
- Derive from research features categories
- Keep consistent with domain conventions
- Typical: Authentication, Content, Social, Notifications, Moderation, Payments, Admin

**v1 vs v2:**
- v1: Committed scope, will be in roadmap phases
- v2: Acknowledged but deferred, not in current roadmap
- Moving v2 → v1 requires roadmap update

**Out of Scope:**
- Explicit exclusions with reasoning
- Prevents "why didn't you include X?" later
- Anti-features from research belong here with warnings

**Traceability:**
- Empty initially, populated during roadmap creation
- Each requirement maps to exactly one phase
- Unmapped requirements = roadmap gap

**Status Values:**
- Pending: Not started
- In Progress: Phase is active
- Complete: Requirement verified
- Blocked: Waiting on external factor

</Guidelines>

<evolution>

**After each phase completes:**
1. Mark covered requirements as Complete
2. Update traceability status
3. Note any requirements that changed scope

**After roadmap updates:**
1. Verify all v1 requirements still mapped
2. Add new requirements if scope expanded
3. Move requirements to v2/out of scope if descoped

**Requirement completion criteria:**
- Requirement is "Complete" when:
  - Feature is implemented
  - Feature is verified (tests pass, manual check done)
  - Feature is committed

</evolution>