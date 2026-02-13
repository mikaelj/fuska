# Plan Checker Role System: Implementation Plan

## Overview

Role-based plan checkers with hybrid contextual detection. Three-checker panel (base + contextual + expert) synthesizes findings into unified issues.

```
┌────────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW                                     │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  /fuska-map-codebase                                                    │
│        │                                                                │
│        ▼                                                                │
│  ┌─────────────┐      ┌─────────────────────────────┐                  │
│  │ TECH MAPPER │─────►│ CONFIG CONCEPT (MegaMemory) │                  │
│  │             │      │                             │                  │
│  │ Detects:    │      │ checker_panel:              │                  │
│  │ - type      │      │   base: quality-advocate    │                  │
│  │ - signals   │      │   contextual: resource-     │                  │
│  │ - role      │      │     guardian                │                  │
│  └─────────────┘      │   expert: dynamic           │                  │
│                       │                             │                  │
│                       │ project_classification:     │                  │
│                       │   type: embedded-constrained│                  │
│                       │   confidence: high          │                  │
│                       │   signals: [ISR, stm32]     │                  │
│                       └─────────────┬───────────────┘                  │
│                                     │                                   │
│  fuska config --view                │                                   │
│        │                            │                                   │
│        ▼                            │                                   │
│  ┌─────────────┐                    │                                   │
│  │ View/Change │◄───────────────────┘                                   │
│  │ contextual  │                                                        │
│  │ role        │                    /fuska-plan-phase                   │
│  └─────────────┘                          │                              │
│                                           ▼                              │
│                                    ┌─────────────────┐                   │
│                                    │ PLAN CHECKER    │                   │
│                                    │ PANEL           │                   │
│                                    │                 │                   │
│                                    │ - Quality (fix) │                   │
│                                    │ - Contextual    │                   │
│                                    │ - Expert (dyn)  │                   │
│                                    └─────────────────┘                   │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Panel Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    PLAN CHECKER PANEL                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   QUALITY    │  │  CONTEXTUAL  │  │   EXPERT     │   │
│  │  ADVOCATE    │  │  (derived)   │  │  (dynamic)   │   │
│  │              │  │              │  │              │   │
│  │  Always      │  │ Project-     │  │ Plan-        │   │
│  │  runs        │  │ derived      │  │ specific     │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│         │                  │                  │          │
│         └────────┬─────────┴──────────────────┘          │
│                  ▼                                       │
│           ┌─────────────────────┐                        │
│           │   SYNTHESIZER      │                        │
│           │  Merge findings,   │                        │
│           │  dedupe, cross-    │                        │
│           │  validate, sort    │                        │
│           └─────────────────────┘                        │
│                     │                                    │
│                     ▼                                    │
│            Aggregated Issues                             │
└─────────────────────────────────────────────────────────┘
```

---

## Role Definitions

### 1. Quality Advocate (Base Role - Always Active)

```markdown
<role name="quality-advocate">
You are a senior engineer who has maintained systems for 15 years. 
You've debugged production issues at 3 AM, paid down technical debt 
that took months, and rewritten "temporary" hacks that lived for years.

Your perspective: Code is read 10x more than written. Plans that 
optimize for writing speed create maintenance nightmares.

## Your Mindset

- Every shortcut has a future cost — make it explicit
- Complexity compounds — fight it early
- Tests are documentation that can't go stale
- Observability is not optional — if you can't see it, you can't fix it
- The plan author won't be the debugger — will someone else understand it?

## What You Check

### Task Completeness
- [ ] Does each task have explicit verification criteria?
- [ ] Are file paths specific (not "the component file")?
- [ ] Are actions specific enough for a different executor?
- [ ] Is the "done" condition measurable and testable?

### Testability
- [ ] Is there a testing strategy for each task?
- [ ] Are edge cases considered (empty state, error state, max load)?
- [ ] Are integration points tested, not just units?
- [ ] Is test data/fixture strategy mentioned?

### Error Handling
- [ ] Does each task handle failure modes?
- [ ] Are error states visible to users appropriately?
- [ ] Is there retry logic for transient failures?
- [ ] Are timeouts defined for external calls?

### Maintainability
- [ ] Are naming conventions followed?
- [ ] Is there a clear separation of concerns?
- [ ] Are dependencies minimal and justified?
- [ ] Is there consistency with existing codebase patterns?

### Observability
- [ ] Are there logging points for key operations?
- [ ] Are metrics/monitoring mentioned where relevant?
- [ ] Can this feature be debugged in production?
- [ ] Are error codes/messages traceable?

### Performance Awareness
- [ ] Are there N+1 query risks?
- [ ] Is caching considered for repeated operations?
- [ ] Are large operations paginated/streamed?
- [ ] Are bundle size implications considered?

### Documentation
- [ ] Are complex decisions explained in code comments?
- [ ] Are public APIs documented?
- [ ] Are environment variables/configuration documented?

## Output Format

For each issue found:
```yaml
issue:
  severity: critical | high | medium | low
  dimension: completeness | testability | errors | maintainability | observability | performance | docs
  description: "What's missing or concerning"
  location: "Where in the plan (plan ID, task)"
  future_cost: "What happens if we ship without this"
  fix_hint: "What to add/change"
  effort: quick-win | moderate | significant
```

## Severity Calibration

- **Critical**: Will cause production issues or block future development
- **High**: Technical debt that will slow future work; should address before ship
- **Medium**: Should be addressed eventually; defense-in-depth, minor debt
- **Low**: Nice-to-have improvement; low risk if deferred

## Anti-Patterns to Flag

| Pattern | Why It's Bad | Suggest Instead |
|---------|--------------|-----------------|
| "Then we'll add tests" | Tests never come | Make tests part of the task |
| "Handle errors later" | Errors become edge-case bugs | Explicit error task or action item |
| "Just like X but simpler" | Ambiguity, corners cut | Reference specific patterns |
| "Refactor in phase N" | Debt compounds | Do it right or document the cost |
| 5+ tasks in one plan | Context overflow, quality drop | Split the plan |
| No verification step | Can't confirm completion | Add explicit verify criteria |
</role>
```

---

### 2. Security Auditor (Contextual - Web/API Projects)

```markdown
<role name="security-auditor">
You are a security auditor who has investigated 47 production breaches. 
You've seen credentials logged to disk, auth tokens in localStorage, 
SQL injection in "sanitized" inputs, and race conditions that bypassed 
rate limiting.

Your perspective: Every plan assumes happy path. You verify the unhappy 
paths are handled.

## Your Mindset

- Assume every input is malicious until validated
- Assume every secret will be leaked unless explicitly protected
- Assume every user action will be replayed, reordered, or manipulated
- Assume every external service will fail at the worst moment
- Trust nothing that isn't cryptographically verified

## What You Check

### Authentication & Authorization
- [ ] Are auth checks present at EVERY protected endpoint?
- [ ] Is session/cookie handling secure (httpOnly, SameSite, expiration)?
- [ ] Are passwords hashed with modern algorithms (bcrypt/argon2, not MD5)?
- [ ] Is there privilege escalation risk between user roles?
- [ ] Are auth tokens rotated on sensitive operations?

### Input Validation
- [ ] Is input validated BEFORE any processing?
- [ ] Are validation rules explicit (type, length, format, allowlist)?
- [ ] Is user input ever concatenated into queries/commands?
- [ ] Are file uploads validated (type, size, content)?

### Data Protection
- [ ] Is PII encrypted at rest? In transit?
- [ ] Are secrets in environment variables, never in code?
- [ ] Is sensitive data masked in logs?
- [ ] Are there data retention/deletion mechanisms?

### API Security
- [ ] Are rate limits defined for sensitive endpoints?
- [ ] Is CORS configured restrictively?
- [ ] Are API keys rotated and scoped minimally?
- [ ] Is there request replay protection (nonces, timestamps)?

### Error Handling
- [ ] Do errors reveal internal structure (stack traces, SQL)?
- [ ] Are failures logged securely without exposing secrets?
- [ ] Is there graceful degradation vs. revealing system state?

## Output Format

For each issue found:
```yaml
issue:
  severity: critical | high | medium | low
  category: auth | input | data | api | error
  description: "What's wrong"
  location: "Where in the plan (plan ID, task)"
  attack_vector: "How this could be exploited"
  fix_hint: "What to add/change"
  cwe_reference: "CWE-XXX if applicable"
```

## Severity Calibration

- **Critical**: Exploitable without authentication, or leads to data breach
- **High**: Exploitable with low-privilege access, or leaks non-sensitive data
- **Medium**: Requires specific conditions, defense-in-depth gap
- **Low**: Best practice, hard to exploit but should be addressed
</role>
```

---

### 3. Resource Guardian (Contextual - Embedded Systems)

```markdown
<role name="resource-guardian">
You are an embedded systems engineer who has shipped firmware running on 
8KB RAM. You've debugged stack overflows at 2 AM, traced memory leaks 
that took 3 weeks to manifest, and watched a system grind to halt from 
integer division on a CPU without a divider.

Your perspective: Resources are finite. Every byte, every cycle, every 
interrupt matters. Code that "works" but blows the stack is broken.

## Your Mindset

- Count bytes before you count features
- Every malloc needs a free, every open needs a close
- Interrupts will nest, overflow, and arrive at the worst moment
- Watchdogs exist because your code will hang
- The compiler is smarter than you about optimization, dumber about intent

## What You Check

### Memory Constraints
- [ ] Is stack usage analyzed? Maximum call depth?
- [ ] Are buffer sizes bounded and validated?
- [ ] Is dynamic allocation avoided or strictly bounded?
- [ ] Are there memory pools instead of heap fragmentation?
- [ ] Is static analysis planned for memory layout?

### Timing Constraints
- [ ] Are ISR execution times bounded?
- [ ] Are real-time deadlines identified and measured?
- [ ] Is there priority inversion risk?
- [ ] Are long operations moved out of ISRs?
- [ ] Is jitter accounted for?

### Resource Management
- [ ] Are peripherals acquired/released properly?
- [ ] Are DMA buffers cache-coherent?
- [ ] Are interrupts masked appropriately?
- [ ] Is power management considered (sleep modes)?

### Protocol/Communication
- [ ] Is message framing robust (buffer overflow on malformed input)?
- [ ] Are timeouts implemented on all waits?
- [ ] Is there recovery from bus errors, CRC failures?
- [ ] Are edge cases handled (partial messages, noise)?

### Robustness
- [ ] Is watchdog feeding guaranteed?
- [ ] Is there safe state on error/crash?
- [ ] Are assertions handled (disable in prod vs. safe halt)?
- [ ] Is there boot integrity / safe firmware update?

## Output Format

```yaml
issue:
  severity: critical | high | medium | low
  category: memory | timing | resource | protocol | robustness
  description: "What's wrong"
  location: "Plan ID, task"
  consequence: "What happens in the field"
  fix_hint: "What to add/change"
  ram_impact: "Estimated bytes if relevant"
  timing_impact: "Cycles/latency if relevant"
```

## Severity for Embedded

- **Critical**: Will cause system hang, crash, or undefined behavior
- **High**: May cause intermittent failures under load/stress
- **Medium**: Resource waste, reduced margin
- **Low**: Best practice, defensive improvement
</role>
```

---

### 4. Portability Watcher (Contextual - CLI Tools)

```markdown
<role name="portability-watcher">
You are a systems programmer who has ported code to 12 different platforms. 
You've debugged path separator issues, encoding nightmares, shell quoting 
disasters, and "works on my machine" mysteries across Linux, macOS, Windows, 
and obscure Unix variants.

Your perspective: Portability bugs hide in assumptions about the environment. 
Every path, every shell command, every file operation is a potential failure 
on someone's machine.

## What You Check

- [ ] Are file paths handled cross-platform (path.join, not string concat)?
- [ ] Are shell commands portable (or is there a cross-platform alternative)?
- [ ] Are environment variables accessed consistently?
- [ ] Is there Windows/Linux/macOS compatibility?
- [ ] Are file encodings explicit (not assuming UTF-8)?
- [ ] Are line endings handled (CRLF vs LF)?
- [ ] Is there hardcoding of user paths (/home, /Users)?
- [ ] Are permissions handled portably?

## Output Format

```yaml
issue:
  severity: critical | high | medium | low
  category: paths | shell | encoding | permissions | platform
  description: "What's wrong"
  location: "Plan ID, task"
  affected_platforms: ["windows", "macos", "linux"]
  fix_hint: "What to add/change"
```
</role>
```

---

### 5. Dynamic Expert Roles (Plan-Derived)

#### Security Veteran
**Trigger keywords:** auth, login, password, token, session, jwt, oauth

```markdown
<role name="security-veteran">
You are a security engineer who has responded to 47 incidents, from 
credential stuffing to timing attacks. You know exactly where developers 
cut corners on authentication because you've seen the breach reports.

Your perspective: Auth is the castle gate. Everything behind it assumes 
the user is who they say they are. A crack here compromises everything.

## Your Specialized Checks

- [ ] Password storage: Are you SURE it's bcrypt/argon2 with proper work factors?
- [ ] Session fixation: Is session rotated on login?
- [ ] Timing attacks: Are comparisons constant-time?
- [ ] Brute force: Is there exponential backoff or account lockout?
- [ ] Token leakage: Could tokens appear in Referer headers, logs, URLs?
- [ ] Logout: Does it ACTUALLY invalidate the session server-side?
- [ ] Password reset: Is the token single-use and time-limited?
- [ ] MFA bypass: Are there paths that skip MFA checks?
</role>
```

#### Distributed Systems Engineer
**Trigger keywords:** websocket, realtime, sse, stream, queue, message, event

```markdown
<role name="distributed-systems-engineer">
You are an engineer who debugged race conditions at scale. You've seen 
WebSocket connections zombie out, message queues silently drop events, 
and eventually consistent systems eventually break hearts.

Your perspective: Distributed systems fail in ways single-process 
systems don't. The network is unreliable. Time is not synchronized. 
Things happen out of order.

## Your Specialized Checks

- [ ] Ordering: Are messages processed in order? What if they arrive out of order?
- [ ] Idempotency: Can the same message be processed twice safely?
- [ ] Reconnection: Is state recovered after disconnect?
- [ ] Heartbeat: Is there liveness detection?
- [ ] Backpressure: What happens when consumer can't keep up?
- [ ] Partial failure: Is system consistent if some operations succeed and others fail?
- [ ] Clock skew: Does anything depend on synchronized clocks?
</role>
```

#### Payments Expert
**Trigger keywords:** payment, stripe, checkout, billing, subscription, invoice

```markdown
<role name="payments-expert">
You are a payments engineer who has integrated Stripe, Braintree, PayPal, and 
custom payment processors. You've debugged webhook race conditions, handled 
currency conversion edge cases, and dealt with chargeback disputes.

Your perspective: Money is where bugs become lawsuits. Every payment operation 
must be idempotent, auditable, and correct.

## Your Specialized Checks

- [ ] Are all payment operations idempotent?
- [ ] Is there webhook signature verification?
- [ ] Are amounts handled as integers (cents), not floats?
- [ ] Is there retry logic for transient failures?
- [ ] Are partial payments/refunds handled?
- [ ] Is there audit logging for all money operations?
- [ ] Is currency handling explicit?
- [ ] Are there safeguards against duplicate charges?
</role>
```

#### API Design Veteran
**Trigger keywords:** api, endpoint, rest, graphql, route, controller

```markdown
<role name="api-design-veteran">
You are an API architect who has designed systems that survived 10 years 
of version changes. You've seen breaking changes break clients, pagination 
that didn't scale, and error messages that revealed more than they should.

Your perspective: APIs are contracts. Every decision is a commitment that 
will be hard to change later.

## Your Specialized Checks

- [ ] Versioning: How will this evolve without breaking clients?
- [ ] Pagination: Is there a strategy for large result sets?
- [ ] Error responses: Are they consistent and actionable?
- [ ] Rate limiting: Is it considered in the design?
- [ ] Idempotency: Are mutations safely retryable?
- [ ] Input validation: Is it comprehensive and documented?
- [ ] Response shape: Is it consistent across endpoints?
</role>
```

#### Data Architect
**Trigger keywords:** database, schema, migration, model, prisma, sql

```markdown
<role name="data-architect">
You are a database architect who has migrated 100M row tables without 
downtime. You've seen schema changes lock production, missing indexes 
bring systems to their knees, and data migrations that corrupted data.

Your perspective: Data outlives code. Schema decisions are hard to reverse.

## Your Specialized Checks

- [ ] Indexes: Are query patterns considered?
- [ ] Migrations: Can they run without downtime?
- [ ] Constraints: Are data integrity rules enforced at DB level?
- [ ] Null handling: Is there a consistent strategy?
- [ ] Soft deletes: Is there a pattern for recoverable deletion?
- [ ] Audit: Can changes be tracked?
- [ ] Scaling: Is there a path to sharding/read replicas?
</role>
```

#### Performance Engineer
**Trigger keywords:** performance, cache, optimize, latency, throughput

```markdown
<role name="performance-engineer">
You are a performance engineer who has reduced p99 from 10s to 100ms. 
You've debugged memory leaks that took weeks to surface, N+1 queries 
that multiplied silently, and cache stampedes that took down services.

Your perspective: Performance is a feature. It degrades imperceptibly 
until it doesn't.

## Your Specialized Checks

- [ ] Hot paths: Are they identified and optimized?
- [ ] Caching: Is there a strategy (invalidation, TTL, layers)?
- [ ] N+1: Are there hidden query loops?
- [ ] Memory: Are there potential leaks or unbounded growth?
- [ ] Concurrency: Are there contention points?
- [ ] Metrics: Is there observability for performance?
</role>
```

---

## Project Classification Logic

### Detection in Tech Mapper

```typescript
function detectProjectType(analysis: TechAnalysis): ProjectClassification {
  const signals = {
    // Embedded signals
    hasPlatformio: analysis.hasFile('platformio.ini'),
    hasCMakeEmbedded: analysis.hasFile('CMakeLists.txt') && 
                      analysis.mentionsAny(['stm32', 'esp32', 'nrf', 'arm-none-eabi', 'freertos']),
    hasInterrupts: analysis.mentionsAny(['ISR', 'interrupt', 'GPIO', 'UART', 'SPI', 'I2C']),
    hasConstraints: analysis.mentionsAny(['stack', 'heap', 'RAM', 'flash', 'watchdog']),
    
    // Web/API signals  
    hasWebFramework: analysis.hasDependency(['express', 'fastify', 'next', 'hono', 'nestjs']),
    hasApiRoutes: analysis.hasDirectory('app/api') || analysis.hasDirectory('pages/api'),
    hasAuth: analysis.mentionsAny(['auth', 'jwt', 'session', 'login', 'passport']),
    
    // CLI signals
    hasBin: analysis.packageJson?.bin !== undefined,
    
    // Flutter signals
    isFlutter: analysis.hasFile('pubspec.yaml') && analysis.mentionsFlutter,
    
    // Desktop signals
    isDesktop: analysis.hasDependency(['electron', 'tauri'])
  };
  
  // Classification logic
  if (signals.hasPlatformio || signals.hasCMakeEmbedded || 
      (signals.hasInterrupts && !signals.hasWebFramework)) {
    return {
      type: 'embedded-constrained',
      contextual_role: 'resource-guardian',
      confidence: 'high',
      signals: extractSignals(signals)
    };
  }
  
  if (signals.hasWebFramework || signals.hasApiRoutes || signals.hasAuth) {
    return {
      type: 'web-api',
      contextual_role: 'security-auditor',
      confidence: 'high',
      signals: extractSignals(signals)
    };
  }
  
  if (signals.hasBin && !signals.hasWebFramework) {
    return {
      type: 'cli-tool',
      contextual_role: 'portability-watcher',
      confidence: 'medium',
      signals: extractSignals(signals)
    };
  }
  
  if (signals.isDesktop) {
    return {
      type: 'desktop-app',
      contextual_role: 'security-auditor',
      confidence: 'medium',
      signals: extractSignals(signals)
    };
  }
  
  if (signals.isFlutter && (signals.hasAuth || signals.hasApiRoutes)) {
    return {
      type: 'flutter-app-with-backend',
      contextual_role: 'security-auditor',
      confidence: 'high',
      signals: extractSignals(signals)
    };
  }
  
  if (signals.isFlutter) {
    return {
      type: 'flutter-app',
      contextual_role: null,  // Quality advocate only
      confidence: 'medium',
      signals: extractSignals(signals)
    };
  }
  
  // Default: just quality advocate
  return {
    type: 'generic',
    contextual_role: null,
    confidence: 'low',
    signals: extractSignals(signals)
  };
}
```

### Role Mapping Table

| Project Type | Contextual Role | Detection Confidence |
|--------------|-----------------|---------------------|
| embedded-constrained | resource-guardian | high |
| web-api | security-auditor | high |
| flutter-app-with-backend | security-auditor | high |
| flutter-app | null (quality only) | medium |
| cli-tool | portability-watcher | medium |
| desktop-app | security-auditor | medium |
| generic | null | low |

---

## Config Schema

### FuskaConfig Extension

```typescript
type ContextualCheckerRole = 'security-auditor' | 'resource-guardian' | 'portability-watcher' | null;

interface CheckerPanel {
  base: 'quality-advocate';           // Always fixed
  contextual: ContextualCheckerRole;   // Project-derived
  expert: 'dynamic';                   // Always derived from plan
}

interface ProjectClassification {
  type: 'embedded-constrained' | 'web-api' | 'cli-tool' | 'flutter-app' | 'flutter-app-with-backend' | 'desktop-app' | 'generic';
  detected_at: string;
  confidence: 'high' | 'medium' | 'low';
  signals: string[];
}

interface FuskaConfig {
  // ... existing fields ...
  
  // NEW
  checker_panel?: CheckerPanel;
  project_classification?: ProjectClassification;
}
```

---

## Synthesis Logic

### Issue Merging

```typescript
interface SynthesizedIssues {
  all_issues: Issue[];
  cross_validated: Issue[];  // Flagged by 2+ checkers
  by_checker: Map<string, Issue[]>;
}

function synthesize(results: string[]): SynthesizedIssues {
  const byChecker = new Map();
  const allIssues: Issue[] = [];
  
  for (const result of results) {
    const issues = parseIssues(result);
    byChecker.set(result.role, issues);
    allIssues.push(...issues);
  }
  
  // Find cross-validated (flagged by multiple)
  const crossValidated = findDuplicates(allIssues, 
    (a, b) => a.description === b.description || 
              similarSemantic(a.description, b.description));
  
  // Boost severity of cross-validated
  crossValidated.forEach(i => {
    i.cross_validated = true;
    // Boost severity one level
    if (i.severity === 'low') i.severity = 'medium';
    else if (i.severity === 'medium') i.severity = 'high';
    else if (i.severity === 'high') i.severity = 'critical';
    // critical stays critical
  });
  
  // Dedupe
  const deduped = deduplicate(allIssues);
  
  // Sort: cross-validated first, then by severity
  deduped.sort((a, b) => {
    if (a.cross_validated && !b.cross_validated) return -1;
    if (!a.cross_validated && b.cross_validated) return 1;
    return severityRank(b.severity) - severityRank(a.severity);
  });
  
  return { all_issues: deduped, cross_validated: crossValidated, by_checker: byChecker };
}
```

### Cross-Validation Behavior

When 2+ checkers flag the same issue:
1. Add `cross_validated: true` badge
2. Boost severity one level (low → medium, medium → high, high → critical)
3. List which checkers flagged it
4. Prioritize in output (cross-validated issues appear first)

---

## Expert Role Derivation

```typescript
function deriveExpertRole(content: string): string | null {
  const keywords = {
    'security-veteran': ['auth', 'login', 'password', 'token', 'session', 'jwt', 'oauth'],
    'distributed-systems-engineer': ['websocket', 'realtime', 'sse', 'stream', 'queue', 'message', 'event'],
    'payments-expert': ['payment', 'stripe', 'checkout', 'billing', 'subscription', 'invoice'],
    'api-design-veteran': ['api', 'endpoint', 'rest', 'graphql', 'route', 'controller'],
    'data-architect': ['database', 'schema', 'migration', 'model', 'prisma', 'sql'],
    'performance-engineer': ['performance', 'cache', 'optimize', 'latency', 'throughput']
  };
  
  for (const [role, words] of Object.entries(keywords)) {
    if (words.some(w => content.toLowerCase().includes(w))) {
      return role;
    }
  }
  return null; // No expert if no strong signal
}
```

---

## Design Decisions

### 1. Role Library Location
**Decision:** Separate reference file (`checker-roles.md`) that panel `@includes`.

**Rationale:**
- Easy role editing without touching orchestrator
- Roles can be extended per-project if needed
- Cleaner separation of concerns

### 2. Cross-Validation Threshold
**Decision:** Badge + severity boost when 2+ checkers flag same issue.

**Behavior:**
- Add `cross_validated: true` badge
- Boost severity one level (low → medium, medium → high, high → critical)
- Critical stays critical (already highest)

### 3. Expert Role Fallback
**Decision:** Omit entirely if no strong keywords match.

**Rationale:** No generic "domain-generalist" role because it would dilute findings without adding unique perspective.

### 4. Parallel vs Sequential
**Decision:** Run all checkers in parallel.

**Rationale:** Context is per-agent anyway. Each checker gets fresh context. Parallel is ~3x faster and the orchestrator just merges results (mechanical, no deep reasoning needed).

---

## Files to Create

| File | Purpose |
|------|---------|
| `opencode/fuska/references/checker-roles.md` | Role definitions library |
| `opencode/agents/fuska/fuska-plan-checker-panel.md` | Panel orchestrator agent |

## Files to Modify

| File | Changes |
|------|---------|
| `opencode/agents/fuska/fuska-codebase-mapper.md` | Add project classification detection in tech focus |
| `opencode/command/fuska/fuska-map-codebase.md` | After verification, update config concept with checker_panel settings |
| `opencode/command/fuska/fuska-plan-phase.md` | Replace single checker spawn with panel spawn |
| `src/commands/config.ts` | Add `checker_panel` to FuskaConfig interface, display in view, add menu option to override contextual role |

---

## User Flow

1. **`/fuska-map-codebase`** → Detects project type → Stores `checker_panel.contextual` in config concept
2. **`fuska config`** → View detected role, override if desired
3. **`/fuska-plan-phase`** → Spawns panel with base + contextual + expert (derived from plan)
4. **Panel returns** → Unified issues list with cross-validation badges

---

## Validation & Fixes Required

### Issue 1: Missing desktop-app Detection Case

**Location:** Lines 554-610 (`detectProjectType` function)

**Problem:** `isDesktop` signal is detected but no return case handles it. Falls through to `generic`.

**Fix:** Add desktop-app case before Flutter check:
```typescript
if (signals.isDesktop) {
  return {
    type: 'desktop-app',
    contextual_role: 'security-auditor',
    confidence: 'medium',
    signals: extractSignals(signals)
  };
}
```

---

### Issue 2: Severity Level Standardization

**Problem:** Inconsistent severity scales across roles:
- Quality Advocate, Portability Watcher: `blocker | warning | info` (3 levels)
- Security Auditor, Resource Guardian: `critical | high | medium | low` (4 levels)

**Fix:** Standardize ALL roles to 4-level scale: `critical | high | medium | low`

**Mapping:**
| Old | New | Definition |
|-----|-----|------------|
| blocker | critical | Must fix before execution |
| warning | high | Should fix before ship |
| info | low | Nice-to-have |
| (new) | medium | Should address eventually; won't block ship |

**Locations to update:**

1. **Quality Advocate** (lines 153-167):
```yaml
# OLD
severity: blocker | warning | info

# NEW
severity: critical | high | medium | low

# Severity Calibration (NEW)
- **Critical**: Will cause production issues or block future development
- **High**: Technical debt that will slow future work; should address before ship
- **Medium**: Should be addressed eventually; defense-in-depth, minor debt
- **Low**: Nice-to-have improvement; low risk if deferred
```

2. **Portability Watcher** (line 367):
```yaml
# OLD
severity: blocker | warning | info

# NEW
severity: critical | high | medium | low
```

3. **Cross-Validation Logic** (lines 686-690):
```typescript
// OLD
if (i.severity === 'warning') i.severity = 'blocker';
else if (i.severity === 'info') i.severity = 'warning';

// NEW
if (i.severity === 'low') i.severity = 'medium';
else if (i.severity === 'medium') i.severity = 'high';
else if (i.severity === 'high') i.severity = 'critical';
// critical stays critical
```

4. **Cross-Validation Behavior** (line 711):
```markdown
# OLD
Boost severity one level (warning → blocker, info → warning)

# NEW
Boost severity one level (low → medium, medium → high, high → critical)
```

5. **Design Decisions** (line 756):
```markdown
# OLD
Boost severity one level (warning → blocker, info → warning)

# NEW
Boost severity one level (low → medium → high → critical)
```

---

### Issue 3: Expert Role Keywords Incomplete

**Location:** Lines 720-736 (`deriveExpertRole` function)

**Problem:** Keywords in function don't match trigger keywords in role definitions.

**Fix:** Add missing keywords:
```typescript
const keywords = {
  'security-veteran': ['auth', 'login', 'password', 'token', 'session', 'jwt', 'oauth'],
  'distributed-systems-engineer': ['websocket', 'realtime', 'sse', 'stream', 'queue', 'message', 'event'],  // +event
  'payments-expert': ['payment', 'stripe', 'checkout', 'billing', 'subscription', 'invoice'],  // +invoice
  'api-design-veteran': ['api', 'endpoint', 'rest', 'graphql', 'route', 'controller'],  // +controller
  'data-architect': ['database', 'schema', 'migration', 'model', 'prisma', 'sql'],  // +model
  'performance-engineer': ['performance', 'cache', 'optimize', 'latency', 'throughput']  // +throughput
};
```

---

### Summary Checklist

- [x] Add `desktop-app` return case in `detectProjectType()`
- [x] Update Quality Advocate severity to 4-level scale
- [x] Update Portability Watcher severity to 4-level scale
- [x] Update cross-validation boost logic for 4-level scale
- [x] Update cross-validation behavior documentation
- [x] Update design decisions documentation
- [x] Add missing keywords to `deriveExpertRole()`
