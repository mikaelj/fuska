# Roadmap Template (MegaMemory-Backed)

Template for MegaMemory-based project roadmap. **For @-reference only by agents — data stored in MegaMemory, never on disk.**

---

<megamemory_schema>

## Concept Structure

```typescript
interface RoadmapConcept {
  name: string;
  kind: "feature" | "config" | "component";
  summary: string;
  parent_id?: string;
  edges?: ConceptEdge[];
  file_refs?: string[];
}
```

## Root Roadmap Concept

```
name: "[Project Name] Roadmap"
kind: "feature"
summary: "Roadmap for [Project Name]: [One paragraph describing the journey from start to finish]. Phases execute in numeric order: 1 → 2 → 2.1 → 2.2 → 3 → 3.1 → 4."
```

## Phase Concepts

### Standard Phase
```
name: "Phase [N]: [Phase Name]"
kind: "feature"
summary: "Goal: [What this phase delivers]. Depends on: Phase [N-1]. Requirements: [REQ-01, REQ-02]. Success criteria: 1. [Observable behavior], 2. [Observable behavior], 3. [Observable behavior]. Plans: [X] plans."
parent_id: "[Project Name] Roadmap"
edges: [{to: "Phase [N-1]", relation: "depends_on", description: "Requires Phase [N-1] completion"}]
```

### Inserted Phase (Decimal)
```
name: "Phase [N].[M]: [Critical Fix] (INSERTED)"
kind: "feature"
summary: "Goal: [Urgent work inserted between phases]. Depends on: Phase [N]. Success criteria: 1. [What the fix achieves]. Plans: 1 plan."
parent_id: "[Project Name] Roadmap"
edges: [{to: "Phase [N]", relation: "depends_on", description: "Requires Phase [N] completion"}]
```

### Plan Concepts
```
name: "Plan [N]-[M]: [Plan Description]"
kind: "component"
summary: "Brief description of plan work"
parent_id: "Phase [N]: [Phase Name]"
```

## Milestone Concepts

```
name: "Milestone [vX.Y]: [Milestone Name]"
kind: "config"
summary: "Milestone goal: [What vX.Y delivers]. Phases: [X-Y]. Status: [planned / in progress / shipped YYYY-MM-DD]"
parent_id: "[Project Name] Roadmap"
edges: [{to: "Phase [X]", relation: "configured_by", description: "Milestone includes this phase"}]
```

## Progress Concept

```
name: "Roadmap Progress"
kind: "config"
summary: "Phase 1: 0/3 Not started | Phase 2: 0/2 Not started | Phase 3: 0/2 Not started | Phase 4: 0/1 Not started"
parent_id: "[Project Name] Roadmap"
```

## Out of Scope Concept

```
name: "Roadmap Out of Scope"
kind: "config"
summary: "Features explicitly excluded from current roadmap with reasoning"
parent_id: "[Project Name] Roadmap"
```

</megamemory_schema>

---

<megamemory_operations>

## Create Roadmap with Phases

```typescript
const roadmap = await megamemory.create_concept({
  name: "CommunityApp Roadmap",
  kind: "feature",
  summary: "Roadmap for CommunityApp: Build MVP social platform with authentication, profiles, content sharing, and social features. Deliver v1.0 MVP in 4 phases. Phases execute in numeric order."
});

// Phase 1: Authentication
const phase1 = await megamemory.create_concept({
  name: "Phase 1: Authentication",
  kind: "feature",
  summary: "Goal: User can sign up, verify email, and authenticate. Depends on: Nothing (first phase). Requirements: AUTH-01, AUTH-02, AUTH-03, AUTH-04. Success criteria: 1. User can sign up with email and password, 2. User receives email verification, 3. User can reset password, 4. Session persists across refresh. Plans: 3 plans.",
  parent_id: roadmap.id
});

await megamemory.create_concept({
  name: "Plan 01-01: User sign-up flow",
  kind: "component",
  summary: "Build sign-up form with validation, email verification trigger",
  parent_id: phase1.id
});

await megamemory.create_concept({
  name: "Plan 01-02: Password reset flow",
  kind: "component",
  summary: "Build password reset request and email link handling",
  parent_id: phase1.id
});

await megamemory.create_concept({
  name: "Plan 01-03: Session persistence",
  kind: "component",
  summary: "Implement localStorage session management",
  parent_id: phase1.id
});

// Phase 2: Profiles
const phase2 = await megamemory.create_concept({
  name: "Phase 2: Profiles",
  kind: "feature",
  summary: "Goal: Users can create profiles with avatars and bios. Depends on: Phase 1. Requirements: PROF-01, PROF-02, PROF-03, PROF-04. Success criteria: 1. User can create profile with display name, 2. User can upload avatar, 3. User can write bio, 4. User can view other profiles. Plans: 2 plans.",
  parent_id: roadmap.id
});

await megamemory.link({
  from: phase2.id,
  to: phase1.id,
  relation: "depends_on",
  description: "Phase 2 requires Phase 1 completion"
});

await megamemory.create_concept({
  name: "Plan 02-01: Profile creation",
  kind: "component",
  summary: "Build profile form with display name and bio",
  parent_id: phase2.id
});

await megamemory.create_concept({
  name: "Plan 02-02: Avatar upload",
  kind: "component",
  summary: "Build avatar upload with image storage",
  parent_id: phase2.id
});

// Phase 3: Content
const phase3 = await megamemory.create_concept({
  name: "Phase 3: Content",
  kind: "feature",
  summary: "Goal: Users can create and view posts. Depends on: Phase 2. Requirements: CONT-01, CONT-02, CONT-03, CONT-04, CONT-05. Success criteria: 1. User can create text post, 2. User can upload image with post, 3. User can edit own posts, 4. User can delete own posts, 5. User can view feed. Plans: 2 plans.",
  parent_id: roadmap.id
});

await megamemory.link({
  from: phase3.id,
  to: phase2.id,
  relation: "depends_on",
  description: "Phase 3 requires Phase 2 completion"
});

await megamemory.create_concept({
  name: "Plan 03-01: Post creation",
  kind: "component",
  summary: "Build post creation form with text and image",
  parent_id: phase3.id
});

await megamemory.create_concept({
  name: "Plan 03-02: Post feed",
  kind: "component",
  summary: "Build post feed view with infinite scroll",
  parent_id: phase3.id
});

// Phase 4: Social
const phase4 = await megamemory.create_concept({
  name: "Phase 4: Social",
  kind: "feature",
  summary: "Goal: Users can follow others, like, and comment. Depends on: Phase 3. Requirements: SOCL-01, SOCL-02, SOCL-03, SOCL-04, SOCL-05. Success criteria: 1. User can follow users, 2. User can unfollow users, 3. User can like posts, 4. User can comment on posts, 5. User can view activity feed. Plans: 1 plan.",
  parent_id: roadmap.id
});

await megamemory.link({
  from: phase4.id,
  to: phase3.id,
  relation: "depends_on",
  description: "Phase 4 requires Phase 3 completion"
});

await megamemory.create_concept({
  name: "Plan 04-01: Social interactions",
  kind: "component",
  summary: "Build follow, like, and comment features",
  parent_id: phase4.id
});

// Progress tracking
await megamemory.create_concept({
  name: "Roadmap Progress",
  kind: "config",
  summary: "Phase 1: 0/3 Not started | Phase 2: 0/2 Not started | Phase 3: 0/2 Not started | Phase 4: 0/1 Not started",
  parent_id: roadmap.id
});

// Out of scope
await megamemory.create_concept({
  name: "Roadmap Out of Scope",
  kind: "config",
  summary: "Real-time chat — High complexity, not core to community value\nVideo posts — Storage/bandwidth costs, defer to v2+\nOAuth login — Email/password sufficient for v1\nMobile app — Web-first, mobile later",
  parent_id: roadmap.id
});
```

## Create Inserted Phase

```typescript
const insertedPhase = await megamemory.create_concept({
  name: "Phase 2.1: Auth0 Migration (INSERTED)",
  kind: "feature",
  summary: "Goal: Migrate from custom auth to Auth0 provider. Depends on: Phase 2. Success criteria: 1. All users authenticated via Auth0, 2. Session tokens valid, 3. Existing users migrated. Plans: 1 plan.",
  parent_id: roadmap.id
});

await megamemory.link({
  from: insertedPhase.id,
  to: phase2.id,
  relation: "depends_on",
  description: "Inserted phase requires Phase 2 completion"
});

await megamemory.create_concept({
  name: "Plan 02.1-01: Auth0 integration",
  kind: "component",
  summary: "Configure Auth0, migrate users, update auth flow",
  parent_id: insertedPhase.id
});
```

## Update Phase Progress

```typescript
await megamemory.update_concept({
  id: "Roadmap Progress",
  changes: {
    summary: "Phase 1: 3/3 Complete | Phase 2: 0/2 Not started | Phase 3: 0/2 Not started | Phase 4: 0/1 Not started"
  }
});
```

## Create Milestone

```typescript
const milestone = await megamemory.create_concept({
  name: "Milestone v1.0: MVP",
  kind: "config",
  summary: "Milestone goal: Deliver functional MVP with auth, profiles, content, and social features. Phases: 1-4. Status: planned",
  parent_id: roadmap.id
});

await megamemory.link({
  from: milestone.id,
  to: phase1.id,
  relation: "configured_by",
  description: "Milestone includes Phase 1"
});

await megamemory.link({
  from: milestone.id,
  to: phase2.id,
  relation: "configured_by",
  description: "Milestone includes Phase 2"
});

await megamemory.link({
  from: milestone.id,
  to: phase3.id,
  relation: "configured_by",
  description: "Milestone includes Phase 3"
});

await megamemory.link({
  from: milestone.id,
  to: phase4.id,
  relation: "configured_by",
  description: "Milestone includes Phase 4"
});
```

## Query Roadmap

```typescript
// Get full roadmap
const roadmap = await megamemory.understand({
  query: "CommunityApp Roadmap phases plans"
});

// Get current phase
const currentPhase = await megamemory.understand({
  query: "Phase in progress not started"
});

// Get phase dependencies
const dependencies = await megamemory.understand({
  query: "Phase 3 depends on requirements"
});

// Get progress
const progress = await megamemory.understand({
  query: "Roadmap progress"
});
```

</megamemory_operations>

---

<megamemory_examples>

## Complete Roadmap Initialization

```typescript
async function createRoadmap(projectName: string, phases: PhaseConfig[]) {
  const roadmap = await megamemory.create_concept({
    name: `${projectName} Roadmap`,
    kind: "feature",
    summary: `Roadmap for ${projectName}: ${phases.map((p, i) => p.name).join(' → ')}. Deliver MVP in ${phases.length} phases.`
  });

  let prevPhaseId: string | null = null;
  const planCounts: number[] = [];

  for (const phase of phases) {
    const phaseConcept = await megamemory.create_concept({
      name: `Phase ${phase.number}: ${phase.name}`,
      kind: "feature",
      summary: `Goal: ${phase.goal}. Depends on: ${prevPhaseId ? `Phase ${phase.number - 1}` : 'Nothing (first phase)'}. Requirements: ${phase.requirements.join(', ')}. Success criteria: ${phase.successCriteria.map((s, i) => `${i + 1}. ${s}`).join('. ')}. Plans: ${phase.plans.length} plans.`,
      parent_id: roadmap.id
    });

    if (prevPhaseId) {
      await megamemory.link({
        from: phaseConcept.id,
        to: prevPhaseId,
        relation: "depends_on",
        description: `Phase ${phase.number} requires Phase ${phase.number - 1} completion`
      });
    }

    for (let i = 0; i < phase.plans.length; i++) {
      await megamemory.create_concept({
        name: `Plan ${String(phase.number).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}: ${phase.plans[i]}`,
        kind: "component",
        summary: phase.plans[i],
        parent_id: phaseConcept.id
      });
    }

    prevPhaseId = phaseConcept.id;
    planCounts.push(phase.plans.length);
  }

  const progressString = planCounts.map((count, i) => `Phase ${i + 1}: 0/${count} Not started`).join(' | ');
  await megamemory.create_concept({
    name: "Roadmap Progress",
    kind: "config",
    summary: progressString,
    parent_id: roadmap.id
  });

  return roadmap.id;
}

interface PhaseConfig {
  number: number;
  name: string;
  goal: string;
  requirements: string[];
  successCriteria: string[];
  plans: string[];
}

// Usage
await createRoadmap("CommunityApp", [
  {
    number: 1,
    name: "Authentication",
    goal: "User can sign up, verify email, and authenticate",
    requirements: ["AUTH-01", "AUTH-02", "AUTH-03", "AUTH-04"],
    successCriteria: [
      "User can sign up with email and password",
      "User receives email verification",
      "User can reset password",
      "Session persists across refresh"
    ],
    plans: [
      "User sign-up flow",
      "Password reset flow",
      "Session persistence"
    ]
  },
  {
    number: 2,
    name: "Profiles",
    goal: "Users can create profiles with avatars and bios",
    requirements: ["PROF-01", "PROF-02", "PROF-03", "PROF-04"],
    successCriteria: [
      "User can create profile with display name",
      "User can upload avatar",
      "User can write bio",
      "User can view other profiles"
    ],
    plans: [
      "Profile creation",
      "Avatar upload"
    ]
  },
  {
    number: 3,
    name: "Content",
    goal: "Users can create and view posts",
    requirements: ["CONT-01", "CONT-02", "CONT-03", "CONT-04", "CONT-05"],
    successCriteria: [
      "User can create text post",
      "User can upload image with post",
      "User can edit own posts",
      "User can delete own posts",
      "User can view feed"
    ],
    plans: [
      "Post creation",
      "Post feed"
    ]
  },
  {
    number: 4,
    name: "Social",
    goal: "Users can follow others, like, and comment",
    requirements: ["SOCL-01", "SOCL-02", "SOCL-03", "SOCL-04", "SOCL-05"],
    successCriteria: [
      "User can follow users",
      "User can unfollow users",
      "User can like posts",
      "User can comment on posts",
      "User can view activity feed"
    ],
    plans: [
      "Social interactions"
    ]
  }
]);
```

## Roadmap Query Helper

```typescript
interface RoadmapPhase {
  name: string;
  goal: string;
  requirements: string[];
  successCriteria: string[];
  plans: Plan[];
  status: string;
}

interface Plan {
  name: string;
  description: string;
}

async function getRoadmap(projectName: string): Promise<RoadmapPhase[]> {
  const concepts = await megamemory.understand({
    query: `${projectName} Roadmap Phase plans`
  });

  const phases: Map<string, RoadmapPhase> = new Map();
  const progress = await megamemory.understand({ query: "Roadmap progress" });
  const progressMap = new Map<string, string>();

  // Parse progress
  if (progress.length > 0) {
    const progressString = progress[0].summary;
    const parts = progressString.split(' | ');
    for (const part of parts) {
      const match = part.match(/Phase (\d+): (\d+)\/(\d+) (.*)/);
      if (match) {
        progressMap.set(match[1], match[4]);
      }
    }
  }

  // Parse phases and plans
  for (const concept of concepts) {
    if (concept.name.startsWith('Phase ')) {
      const phaseMatch = concept.name.match(/Phase (\d+\.?\d*): (.*)/);
      if (phaseMatch) {
        const [_, num, name] = phaseMatch;

        const lines = concept.summary.split('. ');
        const goal = lines[0].replace('Goal: ', '');
        const depsLine = lines.find(l => l.includes('Depends on'));
        const reqLine = lines.find(l => l.includes('Requirements'));
        const criteriaLine = lines.find(l => l.includes('Success criteria'));

        const requirements = reqLine?.replace('Requirements: ', '').split(', ') || [];
        const criteriaMatch = criteriaLine?.match(/Success criteria: (.*)/);
        const successCriteria = criteriaMatch
          ? criteriaMatch[1].split('. ').map(s => s.replace(/^\d+\. /, ''))
          : [];

        phases.set(num, {
          name,
          goal,
          requirements,
          successCriteria,
          plans: [],
          status: progressMap.get(Math.floor(parseFloat(num)).toString()) || 'Not started'
        });
      }
    } else if (concept.name.startsWith('Plan ')) {
      const planMatch = concept.name.match(/Plan (\d+\.?\d*)-(\d+): (.*)/);
      if (planMatch) {
        const phaseNum = planMatch[1].split('.')[0];
        const phase = phases.get(phaseNum);
        if (phase) {
          phase.plans.push({
            name: concept.name,
            description: concept.summary
          });
        }
      }
    }
  }

  return Array.from(phases.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

// Usage
const roadmap = await getRoadmap("CommunityApp");
console.log(roadmap.map(p => `${p.name}: ${p.status}`));
```

## Update Progress After Plan Completion

```typescript
async function updatePlanProgress(projectName: string, phaseNum: number, planNum: number) {
  const progress = await megamemory.understand({
    query: `${projectName} Roadmap Progress`
  });

  if (progress.length > 0) {
    const parts = progress[0].summary.split(' | ');
    const newParts = parts.map(part => {
      const match = part.match(/Phase (\d+): (\d+)\/(\d+) (.*)/);
      if (match && parseInt(match[1]) === phaseNum) {
        const completed = parseInt(match[2]) + 1;
        const total = parseInt(match[3]);
        const status = completed === total ? 'Complete' : 'In progress';
        return `Phase ${phaseNum}: ${completed}/${total} ${status}`;
      }
      return part;
    });

    await megamemory.update_concept({
      id: progress[0].id,
      changes: {
        summary: newParts.join(' | ')
      }
    });
  }
}

// Usage
await updatePlanProgress("CommunityApp", 1, 1);
```

</megamemory_examples>

---

<template>

**Original template structure preserved for reference:**

```markdown
# Roadmap: [Project Name]

## Overview

[One paragraph describing the journey from start to finish]

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: [Name]** - [One-line description]
- [ ] **Phase 2: [Name]** - [One-line description]
- [ ] **Phase 3: [Name]** - [One-line description]
- [ ] **Phase 4: [Name]** - [One-line description]

## Phase Details

### Phase 1: [Name]
**Goal**: [What this phase delivers]
**Depends on**: Nothing (first phase)
**Requirements**: [REQ-01, REQ-02, REQ-03]
**Success Criteria** (what must be TRUE):
  1. [Observable behavior from user perspective]
  2. [Observable behavior from user perspective]
  3. [Observable behavior from user perspective]
**Plans**: [Number of plans, e.g., "3 plans" or "TBD"]

Plans:
- [ ] 01-01: [Brief description of first plan]
- [ ] 01-02: [Brief description of second plan]
- [ ] 01-03: [Brief description of third plan]

### Phase 2: [Name]
**Goal**: [What this phase delivers]
**Depends on**: Phase 1
**Requirements**: [REQ-04, REQ-05]
**Success Criteria** (what must be TRUE):
  1. [Observable behavior from user perspective]
  2. [Observable behavior from user perspective]
**Plans**: [Number of plans]

Plans:
- [ ] 02-01: [Brief description]
- [ ] 02-02: [Brief description]

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. [Name] | 0/3 | Not started | - |
| 2. [Name] | 0/2 | Not started | - |
| 3. [Name] | 0/2 | Not started | - |
| 4. [Name] | 0/1 | Not started | - |
```

</template>

---

<Guidelines>

**Initial planning (v1.0):**
- Phase count depends on depth setting (quick: 3-5, standard: 5-8, comprehensive: 8-12)
- Each phase delivers something coherent
- Phases can have 1+ plans (split if >3 tasks or multiple subsystems)
- Plans use naming: {phase}-{plan}-PLAN.md (e.g., 01-02-PLAN.md)
- No time estimates (this isn't enterprise PM)
- Progress updated by execute workflow
- Plan count can be "TBD" initially, refined during planning

**Success criteria:**
- 2-5 observable behaviors per phase (from user's perspective)
- Cross-checked against requirements during roadmap creation
- Flow downstream to plan must_haves
- Verified after execution
- Format: "User can [action]" or "[Thing] works/exists"

**After milestones ship:**
- Add milestone concepts grouping completed phases
- Keep continuous phase numbering (never restart at 01)

</Guidelines>

<status_values>
- `Not started` - Haven't begun
- `In progress` - Currently working
- `Complete` - Done (add completion date)
- `Deferred` - Pushed to later (with reason)
</status_values>

---

<Milestone-Grouped Roadmap (After v1.0 Ships)>

After completing first milestone, organize with milestone groupings:

```markdown
## Milestones

- ✅ **v1.0 MVP** - Phases 1-4 (shipped YYYY-MM-DD)
- 🚧 **v1.1 [Name]** - Phases 5-6 (in progress)
- 📋 **v2.0 [Name]** - Phases 7-10 (planned)
```

**Notes:**
- Milestone emoji: ✅ shipped, 🚧 in progress, 📋 planned
- Continuous phase numbering (01-99)
- Progress includes milestone column

</Milestone-Grouped Roadmap (After v1.0 Ships)>
