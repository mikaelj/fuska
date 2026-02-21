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
summary: "Roadmap for [Project Name]: [One paragraph describing the journey from start to finish]. Chapters execute in numeric order: 1 → 2 → 2.1 → 2.2 → 3 → 3.1 → 4."
```

## Chapter Concepts

### Standard Chapter
```
name: "Chapter [N]: [Chapter Name]"
kind: "feature"
summary: "Goal: [What this chapter delivers]. Depends on: Chapter [N-1]. Requirements: [REQ-01, REQ-02]. Success criteria: 1. [Observable behavior], 2. [Observable behavior], 3. [Observable behavior]. Plans: [X] plans."
parent_id: "[Project Name] Roadmap"
edges: [{to: "Chapter [N-1]", relation: "depends_on", description: "Requires Chapter [N-1] completion"}]
```

### Inserted Chapter (Decimal)
```
name: "Chapter [N].[M]: [Critical Fix] (INSERTED)"
kind: "feature"
summary: "Goal: [Urgent work inserted between chapters]. Depends on: Chapter [N]. Success criteria: 1. [What the fix achieves]. Plans: 1 plan."
parent_id: "[Project Name] Roadmap"
edges: [{to: "Chapter [N]", relation: "depends_on", description: "Requires Chapter [N] completion"}]
```

### Plan Concepts
```
name: "Plan [N]-[M]: [Plan Description]"
kind: "component"
summary: "Brief description of plan work"
parent_id: "Chapter [N]: [Chapter Name]"
```

## Milestone Concepts

```
name: "Milestone [vX.Y]: [Milestone Name]"
kind: "config"
summary: "Milestone goal: [What vX.Y delivers]. Chapters: [X-Y]. Status: [planned / in progress / shipped YYYY-MM-DD]"
parent_id: "[Project Name] Roadmap"
edges: [{to: "Chapter [X]", relation: "configured_by", description: "Milestone includes this chapter"}]
```

## Progress Concept

```
name: "Roadmap Progress"
kind: "config"
summary: "Chapter 1: 0/3 Not started | Chapter 2: 0/2 Not started | Chapter 3: 0/2 Not started | Chapter 4: 0/1 Not started"
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

## Create Roadmap with Chapters

```typescript
const roadmap = await megamemory.create_concept({
  name: "CommunityApp Roadmap",
  kind: "feature",
  summary: "Roadmap for CommunityApp: Build MVP social platform with authentication, profiles, content sharing, and social features. Deliver v1.0 MVP in 4 chapters. Chapters execute in numeric order."
});

// Chapter 1: Authentication
const chapter1 = await megamemory.create_concept({
  name: "Chapter 1: Authentication",
  kind: "feature",
  summary: "Goal: User can sign up, verify email, and authenticate. Depends on: Nothing (first chapter). Requirements: AUTH-01, AUTH-02, AUTH-03, AUTH-04. Success criteria: 1. User can sign up with email and password, 2. User receives email verification, 3. User can reset password, 4. Session persists across refresh. Plans: 3 plans.",
  parent_id: roadmap.id
});

await megamemory.create_concept({
  name: "Plan 01-01: User sign-up flow",
  kind: "component",
  summary: "Build sign-up form with validation, email verification trigger",
  parent_id: chapter1.id
});

await megamemory.create_concept({
  name: "Plan 01-02: Password reset flow",
  kind: "component",
  summary: "Build password reset request and email link handling",
  parent_id: chapter1.id
});

await megamemory.create_concept({
  name: "Plan 01-03: Session persistence",
  kind: "component",
  summary: "Implement localStorage session management",
  parent_id: chapter1.id
});

// Chapter 2: Profiles
const chapter2 = await megamemory.create_concept({
  name: "Chapter 2: Profiles",
  kind: "feature",
  summary: "Goal: Users can create profiles with avatars and bios. Depends on: Chapter 1. Requirements: PROF-01, PROF-02, PROF-03, PROF-04. Success criteria: 1. User can create profile with display name, 2. User can upload avatar, 3. User can write bio, 4. User can view other profiles. Plans: 2 plans.",
  parent_id: roadmap.id
});

await megamemory.link({
  from: chapter2.id,
  to: chapter1.id,
  relation: "depends_on",
  description: "Chapter 2 requires Chapter 1 completion"
});

await megamemory.create_concept({
  name: "Plan 02-01: Profile creation",
  kind: "component",
  summary: "Build profile form with display name and bio",
  parent_id: chapter2.id
});

await megamemory.create_concept({
  name: "Plan 02-02: Avatar upload",
  kind: "component",
  summary: "Build avatar upload with image storage",
  parent_id: chapter2.id
});

// Chapter 3: Content
const chapter3 = await megamemory.create_concept({
  name: "Chapter 3: Content",
  kind: "feature",
  summary: "Goal: Users can create and view posts. Depends on: Chapter 2. Requirements: CONT-01, CONT-02, CONT-03, CONT-04, CONT-05. Success criteria: 1. User can create text post, 2. User can upload image with post, 3. User can edit own posts, 4. User can delete own posts, 5. User can view feed. Plans: 2 plans.",
  parent_id: roadmap.id
});

await megamemory.link({
  from: chapter3.id,
  to: chapter2.id,
  relation: "depends_on",
  description: "Chapter 3 requires Chapter 2 completion"
});

await megamemory.create_concept({
  name: "Plan 03-01: Post creation",
  kind: "component",
  summary: "Build post creation form with text and image",
  parent_id: chapter3.id
});

await megamemory.create_concept({
  name: "Plan 03-02: Post feed",
  kind: "component",
  summary: "Build post feed view with infinite scroll",
  parent_id: chapter3.id
});

// Chapter 4: Social
const chapter4 = await megamemory.create_concept({
  name: "Chapter 4: Social",
  kind: "feature",
  summary: "Goal: Users can follow others, like, and comment. Depends on: Chapter 3. Requirements: SOCL-01, SOCL-02, SOCL-03, SOCL-04, SOCL-05. Success criteria: 1. User can follow users, 2. User can unfollow users, 3. User can like posts, 4. User can comment on posts, 5. User can view activity feed. Plans: 1 plan.",
  parent_id: roadmap.id
});

await megamemory.link({
  from: chapter4.id,
  to: chapter3.id,
  relation: "depends_on",
  description: "Chapter 4 requires Chapter 3 completion"
});

await megamemory.create_concept({
  name: "Plan 04-01: Social interactions",
  kind: "component",
  summary: "Build follow, like, and comment features",
  parent_id: chapter4.id
});

// Progress tracking
await megamemory.create_concept({
  name: "Roadmap Progress",
  kind: "config",
  summary: "Chapter 1: 0/3 Not started | Chapter 2: 0/2 Not started | Chapter 3: 0/2 Not started | Chapter 4: 0/1 Not started",
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

## Create Inserted Chapter

```typescript
const insertedChapter = await megamemory.create_concept({
  name: "Chapter 2.1: Auth0 Migration (INSERTED)",
  kind: "feature",
  summary: "Goal: Migrate from custom auth to Auth0 provider. Depends on: Chapter 2. Success criteria: 1. All users authenticated via Auth0, 2. Session tokens valid, 3. Existing users migrated. Plans: 1 plan.",
  parent_id: roadmap.id
});

await megamemory.link({
  from: insertedChapter.id,
  to: chapter2.id,
  relation: "depends_on",
  description: "Inserted chapter requires Chapter 2 completion"
});

await megamemory.create_concept({
  name: "Plan 02.1-01: Auth0 integration",
  kind: "component",
  summary: "Configure Auth0, migrate users, update auth flow",
  parent_id: insertedChapter.id
});
```

## Update Chapter Progress

```typescript
await megamemory.update_concept({
  id: "Roadmap Progress",
  changes: {
    summary: "Chapter 1: 3/3 Complete | Chapter 2: 0/2 Not started | Chapter 3: 0/2 Not started | Chapter 4: 0/1 Not started"
  }
});
```

## Create Milestone

```typescript
const milestone = await megamemory.create_concept({
  name: "Milestone v1.0: MVP",
  kind: "config",
  summary: "Milestone goal: Deliver functional MVP with auth, profiles, content, and social features. Chapters: 1-4. Status: planned",
  parent_id: roadmap.id
});

await megamemory.link({
  from: milestone.id,
  to: chapter1.id,
  relation: "configured_by",
  description: "Milestone includes Chapter 1"
});

await megamemory.link({
  from: milestone.id,
  to: chapter2.id,
  relation: "configured_by",
  description: "Milestone includes Chapter 2"
});

await megamemory.link({
  from: milestone.id,
  to: chapter3.id,
  relation: "configured_by",
  description: "Milestone includes Chapter 3"
});

await megamemory.link({
  from: milestone.id,
  to: chapter4.id,
  relation: "configured_by",
  description: "Milestone includes Chapter 4"
});
```

## Query Roadmap

```typescript
// Get full roadmap
const roadmap = await megamemory.understand({
  query: "CommunityApp Roadmap chapters plans"
});

// Get current chapter
const currentChapter = await megamemory.understand({
  query: "Chapter in progress not started"
});

// Get chapter dependencies
const dependencies = await megamemory.understand({
  query: "Chapter 3 depends on requirements"
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
async function createRoadmap(initiativeName: string, chapters: ChapterConfig[]) {
  const roadmap = await megamemory.create_concept({
    name: `${initiativeName} Roadmap`,
    kind: "feature",
    summary: `Roadmap for ${initiativeName}: ${chapters.map((p, i) => p.name).join(' → ')}. Deliver MVP in ${chapters.length} chapters.`
  });

  let prevChapterId: string | null = null;
  const planCounts: number[] = [];

  for (const chapter of chapters) {
    const chapterConcept = await megamemory.create_concept({
      name: `Chapter ${chapter.number}: ${chapter.name}`,
      kind: "feature",
      summary: `Goal: ${chapter.goal}. Depends on: ${prevChapterId ? `Chapter ${chapter.number - 1}` : 'Nothing (first chapter)'}. Requirements: ${chapter.requirements.join(', ')}. Success criteria: ${chapter.successCriteria.map((s, i) => `${i + 1}. ${s}`).join('. ')}. Plans: ${chapter.plans.length} plans.`,
      parent_id: roadmap.id
    });

    if (prevChapterId) {
      await megamemory.link({
        from: chapterConcept.id,
        to: prevChapterId,
        relation: "depends_on",
        description: `Chapter ${chapter.number} requires Chapter ${chapter.number - 1} completion`
      });
    }

    for (let i = 0; i < chapter.plans.length; i++) {
      await megamemory.create_concept({
        name: `Plan ${String(chapter.number).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}: ${chapter.plans[i]}`,
        kind: "component",
        summary: chapter.plans[i],
        parent_id: chapterConcept.id
      });
    }

    prevChapterId = chapterConcept.id;
    planCounts.push(chapter.plans.length);
  }

  const progressString = planCounts.map((count, i) => `Chapter ${i + 1}: 0/${count} Not started`).join(' | ');
  await megamemory.create_concept({
    name: "Roadmap Progress",
    kind: "config",
    summary: progressString,
    parent_id: roadmap.id
  });

  return roadmap.id;
}

interface ChapterConfig {
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
interface RoadmapChapter {
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

async function getRoadmap(initiativeName: string): Promise<RoadmapChapter[]> {
  const concepts = await megamemory.understand({
    query: `${initiativeName} Roadmap Chapter plans`
  });

  const chapters: Map<string, RoadmapChapter> = new Map();
  const progress = await megamemory.understand({ query: "Roadmap progress" });
  const progressMap = new Map<string, string>();

  // Parse progress
  if (progress.length > 0) {
    const progressString = progress[0].summary;
    const parts = progressString.split(' | ');
    for (const part of parts) {
      const match = part.match(/Chapter (\d+): (\d+)\/(\d+) (.*)/);
      if (match) {
        progressMap.set(match[1], match[4]);
      }
    }
  }

  // Parse chapters and plans
  for (const concept of concepts) {
    if (concept.name.startsWith('Chapter ')) {
      const chapterMatch = concept.name.match(/Chapter (\d+\.?\d*): (.*)/);
      if (chapterMatch) {
        const [_, num, name] = chapterMatch;

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

        chapters.set(num, {
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
        const chapterNum = planMatch[1].split('.')[0];
        const chapter = chapters.get(chapterNum);
        if (chapter) {
          chapter.plans.push({
            name: concept.name,
            description: concept.summary
          });
        }
      }
    }
  }

  return Array.from(chapters.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

// Usage
const roadmap = await getRoadmap("CommunityApp");
console.log(roadmap.map(p => `${p.name}: ${p.status}`));
```

## Update Progress After Plan Completion

```typescript
async function updatePlanProgress(initiativeName: string, chapterNum: number, planNum: number) {
  const progress = await megamemory.understand({
    query: `${initiativeName} Roadmap Progress`
  });

  if (progress.length > 0) {
    const parts = progress[0].summary.split(' | ');
    const newParts = parts.map(part => {
      const match = part.match(/Chapter (\d+): (\d+)\/(\d+) (.*)/);
      if (match && parseInt(match[1]) === chapterNum) {
        const completed = parseInt(match[2]) + 1;
        const total = parseInt(match[3]);
        const status = completed === total ? 'Complete' : 'In progress';
        return `Chapter ${chapterNum}: ${completed}/${total} ${status}`;
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
# Roadmap: [Initiative Name]

## Overview

[One paragraph describing the journey from start to finish]

## Chapters

**Chapter Numbering:**
- Integer chapters (1, 2, 3): Planned milestone work
- Decimal chapters (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal chapters appear between their surrounding integers in numeric order.

- [ ] **Chapter 1: [Name]** - [One-line description]
- [ ] **Chapter 2: [Name]** - [One-line description]
- [ ] **Chapter 3: [Name]** - [One-line description]
- [ ] **Chapter 4: [Name]** - [One-line description]

## Chapter Details

### Chapter 1: [Name]
**Goal**: [What this chapter delivers]
**Depends on**: Nothing (first chapter)
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

### Chapter 2: [Name]
**Goal**: [What this chapter delivers]
**Depends on**: Chapter 1
**Requirements**: [REQ-04, REQ-05]
**Success Criteria** (what must be TRUE):
  1. [Observable behavior from user perspective]
  2. [Observable behavior from user perspective]
**Plans**: [Number of plans]

Plans:
- [ ] 02-01: [Brief description]
- [ ] 02-02: [Brief description]

## Progress

| Chapter | Plans Complete | Status | Completed |
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
- Chapter count depends on depth setting (quick: 3-5, standard: 5-8, comprehensive: 8-12)
- Each chapter delivers something coherent
- Chapters can have 1+ plans (split if >3 tasks or multiple subsystems)
- Plans use naming: {chapter}-{plan}-PLAN.md (e.g., 01-02-PLAN.md)
- No time estimates (this isn't enterprise PM)
- Progress updated by execute workflow
- Plan count can be "TBD" initially, refined during planning

**Success criteria:**
- 2-5 observable behaviors per chapter (from user's perspective)
- Cross-checked against requirements during roadmap creation
- Flow downstream to plan requirements
- Verified after execution
- Format: "User can [action]" or "[Thing] works/exists"

**After milestones ship:**
- Add milestone concepts grouping completed chapters
- Keep continuous chapter numbering (never restart at 01)

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

- ✅ **v1.0 MVP** - Chapters 1-4 (shipped YYYY-MM-DD)
- 🚧 **v1.1 [Name]** - Chapters 5-6 (in progress)
- [TODO] **v2.0 [Name]** - Chapters 7-10 (planned)
```

**Notes:**
- Milestone emoji: ✅ shipped, 🚧 in progress, [TODO] planned
- Continuous chapter numbering (01-99)
- Progress includes milestone column

</Milestone-Grouped Roadmap (After v1.0 Ships)>
