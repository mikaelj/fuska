# Pitfalls Research Template (MegaMemory-Backed)

Template for pitfalls research concepts — common mistakes to avoid in the project domain, stored in MegaMemory.

**Principle:** All pitfalls data lives in MegaMemory concepts. This file teaches agents how to create, update, and query pitfalls research concepts.

---

## MegaMemory Schema

```typescript
// Pitfalls Research Concept Structure
interface PitfallsResearchConcept {
  name: string;                    // e.g., "Pitfalls Research: REST API"
  kind: "feature" | "module" | "pattern" | "config" | "decision" | "component";
  summary: string;                  // Concise description: critical pitfalls, technical debt, gotchas, performance traps
  
  // Metadata stored in summary/why fields
  why: string;                     // Why understanding these pitfalls is critical for this domain
  file_refs: string[];             // Source documentation URLs or file paths
  edges: ConceptEdge[];
  parent_id?: string;              // Optional parent concept
  
  created_by_task: string;          // Description of task that created this
}

interface ConceptEdge {
  to: string;                      // Target concept ID
  relation: "connects_to" | "depends_on" | "implements" | "calls" | "configured_by";
  description: string;             // Why this relationship exists
}

// Store pitfalls details in summary field using structured format:
const pitfallsSummary = `
**Domain:** [domain type]
**Researched:** [date]
**Confidence:** [HIGH/MEDIUM/LOW]

**Critical Pitfalls:**
### Pitfall 1: [Name]
**What goes wrong:** [Description of the failure mode]
**Why it happens:** [Root cause — why developers make this mistake]
**How to avoid:** [Specific prevention strategy]
**Warning signs:** [How to detect this early before it becomes a problem]
**Chapter to address:** [Which roadmap chapter should prevent this]

[... more pitfalls ...]

**Technical Debt Patterns:**
| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
| [shortcut] | [benefit] | [cost] | [conditions, or "never"] |

**Integration Gotchas:**
| Integration | Common Mistake | Correct Approach |
| [service] | [what people do wrong] | [what to do instead] |

**Performance Traps:**
| Trap | Symptoms | Prevention | When It Breaks |
| [trap] | [how you notice] | [how to avoid] | [scale threshold] |

**Security Mistakes:**
| Mistake | Risk | Prevention |
| [mistake] | [what could happen] | [how to avoid] |

**UX Pitfalls:**
| Pitfall | User Impact | Better Approach |
| [pitfall] | [how users suffer] | [what to do instead] |

**"Looks Done But Isn't" Checklist:**
- [ ] **[Feature]:** Often missing [thing] — verify [check]

**Recovery Strategies:**
| Pitfall | Recovery Cost | Recovery Steps |
| [pitfall] | LOW/MEDIUM/HIGH | [what to do] |

**Pitfall-to-Chapter Mapping:**
| Pitfall | Prevention Chapter | Verification |
| [pitfall] | Chapter [X] | [how to verify prevention worked] |

**Sources:**
- [Post-mortems referenced]
- [Community discussions]
- [Official "gotchas" documentation]
`;
```

---

## MegaMemory Operations

### Creating Pitfalls Research Concepts

```typescript
// Create pitfalls research concept
await megamemory.create_concept({
  name: "Pitfalls Research: CLI Tools",
  kind: "feature",
  summary: `
**Domain:** CLI Tools
**Researched:** 2025-02-08
**Confidence:** HIGH

**Critical Pitfalls:**

### Pitfall 1: Silent Failures

**What goes wrong:**
Commands exit with success code (0) even when errors occur. Users assume everything worked, but data is corrupted or incomplete.

**Why it happens:**
Developers forget to set process.exitCode on errors, or swallow exceptions in async handlers without re-throwing.

**How to avoid:**
- Always set exit code explicitly: process.exitCode = 1
- Use try/catch in all async command handlers
- Add top-level error handler: process.on('unhandledRejection')

**Warning signs:**
- Tests pass but manual execution shows unexpected results
- Data inconsistencies in production
- User reports of "it didn't work but said it did"

**Chapter to address:** Chapter 1 - Core CLI infrastructure

---

### Pitfall 2: Inconsistent Flag Names

**What goes wrong:**
Different commands use different names for the same concept (--verbose vs -v vs --debug vs -d). Users can't remember which flag does what.

**Why it happens:**
Commands added independently without establishing conventions. No central style guide for flag naming.

**How to avoid:**
- Document flag naming conventions early
- Use consistent patterns: --verbose for verbosity, --dry-run for preview
- Audit all flags before v1 launch

**Warning signs:**
- Users asking "what's the difference between -v and -debug?"
- Multiple flags that do similar things
- Confusion in help documentation

**Chapter to address:** Chapter 1 - Command design and documentation

---

### Pitfall 3: Blocking Async Operations

**What goes wrong:**
CLI becomes unresponsive during long operations. Users can't cancel or see progress. Tool appears frozen.

**Why it happens:**
Blocking synchronous I/O operations, or heavy CPU work without yielding. No progress indicators.

**How to avoid:**
- Use async/await for all I/O operations
- Add progress indicators for long operations (ora, listr2)
- Respect process interruption (SIGINT)

**Warning signs:**
- Cursor stops blinking during execution
- Users report "it hung"
- No output for long periods

**Chapter to address:** Chapter 2 - Long-running operations

---

### Pitfall 4: No Graceful Exit

**What goes wrong:**
Pressing Ctrl+C immediately kills the process. Incomplete operations leave system in inconsistent state (partial files, orphaned processes).

**Why it happens:**
Not handling SIGINT/SIGTERM signals. Not implementing cleanup logic.

**How to avoid:**
- Register signal handlers: process.on('SIGINT', cleanupAndExit)
- Implement rollback logic for partial operations
- Exit gracefully after cleanup

**Warning signs:**
- Ctrl+C leaves temp files behind
- Database locks not released on abort
- Orphaned child processes

**Chapter to address:** Chapter 1 - Core CLI infrastructure

---

### Pitfall 5: Incompatible Node Versions

**What goes wrong:**
Users with older Node versions get cryptic errors or silent failures. Tool appears broken for segment of users.

**Why it happens:**
Not using modern features correctly, or no engine field in package.json. Not testing on minimum supported version.

**How to avoid:**
- Set "engines": {"node": ">=18"} in package.json
- Test on minimum Node version
- Provide clear error message for unsupported versions

**Warning signs:**
- User reports of "SyntaxError: Unexpected token"
- Works on developer machine, fails in CI
- No version check in startup code

**Chapter to address:** Chapter 1 - Package setup

---

**Technical Debt Patterns:**

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skipping config file | Faster MVP launch | Harder to customize later | MVP only, add in v1.x |
| Hardcoded paths | Quick prototype | Deployment inflexibility | Never — always use env vars |
| Sync I/O everywhere | Simpler code | Unresponsive CLI | Never — use async I/O |
| Global state | Easy access | Hard to test, bugs at scale | Never — use dependency injection |

**Integration Gotchas:**

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| File operations | Not handling permission errors | Check permissions before writes, provide clear error |
| HTTP requests | No timeout, infinite wait | Always set reasonable timeout (30s default) |
| Child processes | Not killing on exit | Track and kill all spawned processes on cleanup |

**Performance Traps:**

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Reading entire file into memory | Out of memory on large files | Use streaming for large files | Files > 100MB |
| Recursive directory scanning | Slow on node_modules | Use non-recursive where possible | Deep directory structures |
| Console.log in hot path | Slow performance at scale | Remove or conditionally disable | 1000+ calls/sec |

**Security Mistakes:**

| Mistake | Risk | Prevention |
|---------|------|------------|
| Passing secrets as CLI args | Visible in process list | Use env vars or config file |
| Running with elevated privileges | Privilege escalation | Run as non-root, drop privileges |
| Eval on user input | Code injection | Never use eval, use proper parsers |

**UX Pitfalls:**

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No color on Windows | Unreadable on default terminal | Use color-detection libraries |
| Too much output | Users miss important info | Use -v for verbose, quiet by default |
| No confirmation on destructive ops | Accidental data loss | Require --force flag for destructive operations |

**"Looks Done But Isn't" Checklist:**

- [ ] **Error handling:** Often missing user-friendly messages — verify error messages are actionable
- [ ] **Exit codes:** Often missing non-zero on errors — verify process.exitCode set correctly
- [ ] **Config file:** Often missing persistence — verify config works end-to-end
- [ ] **Help text:** Often missing for new commands — verify --help documents everything

**Recovery Strategies:**

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Silent failures | HIGH | Audit all command handlers, add explicit error handling |
| Blocking operations | MEDIUM | Refactor to async, add progress indicators |
| No graceful exit | MEDIUM | Add signal handlers and cleanup logic |
| Incompatible Node | LOW | Add version check, clear error message |

**Pitfall-to-Chapter Mapping:**

| Pitfall | Prevention Chapter | Verification |
|---------|------------------|--------------|
| Silent failures | Chapter 1 | Integration tests verify exit codes |
| Inconsistent flags | Chapter 1 | Code review audits all flag names |
| Blocking operations | Chapter 2 | Performance tests on large operations |
| No graceful exit | Chapter 1 | Manual test: Ctrl+C mid-operation |
| Incompatible Node | Chapter 1 | Test on minimum supported Node version |

**Sources:**
- CLI best practices: https://cli-guidelines.io/
- Node CLI patterns: https://github.com/sindresorhus/awesome-node-cli
- Post-mortems: https://post-mortems.npmjs.org/
`,
  why: "Understanding CLI pitfalls prevents common mistakes that frustrate users and damage trust",
  file_refs: [
    "https://cli-guidelines.io/",
    "https://github.com/sindresorhus/awesome-node-cli"
  ],
  created_by_task: "Research CLI tool common pitfalls and mistakes"
});
```

### Updating Pitfalls Research Concepts

```typescript
// Update pitfalls research when new issues discovered
await megamemory.update_concept({
  id: "[pitfalls-research-concept-id]",
  changes: {
    summary: `
**Domain:** CLI Tools
**Researched:** 2025-02-08
**Confidence:** HIGH

[... existing pitfalls ...]

**NEW Critical Pitfall:**

### Pitfall 6: Concurrent Process Collisions

**What goes wrong:**
Multiple instances of CLI modify same resources simultaneously. Users run multiple builds in parallel and corrupt build artifacts.

**Why it happens:**
No file locking or process detection. Tool assumes single instance usage.

**How to avoid:**
- Use lockfile (proper-lockfile) for shared resources
- Check for running instances on startup
- Document that parallel execution is unsupported

**Warning signs:**
- Build artifacts corrupted intermittently
- "File already in use" errors
- Users reporting "it works sometimes, fails sometimes"

**Chapter to address:** Chapter 2 - Build operations

[... rest of original ...]
`
  }
});
```

### Querying Pitfalls Research Concepts

```typescript
// Query pitfalls research for a domain
const pitfallsResults = await megamemory_understand({
  query: "pitfalls research CLI tools critical mistakes errors",
  top_k: 5
});

// Results include concept with full pitfalls details
// Use pitfallsResults[0].summary to get critical pitfalls, prevention strategies
```

### Linking Pitfalls to Other Concepts

```typescript
// Link pitfalls research to project and chapter concepts
await megamemory.link({
  from: "[pitfalls-research-concept-id]",
  to: "[project-concept-id]",
  relation: "configured_by",
  description: "Project must address these pitfalls to succeed"
});

await megamemory.link({
  from: "[chapter-concept-id]",
  to: "[pitfall-concept-id]",
  relation: "verifies",
  description: "Chapter includes verification that this pitfall is avoided"
});
```

### Creating Individual Pitfall Concepts

```typescript
// Create granular pitfall concepts for linking
const silentFailurePitfall = await megamemory.create_concept({
  name: "Pitfall: Silent Failures (CLI)",
  kind: "pattern",
  summary: "Commands exit with success code (0) even when errors occur, causing data corruption or incomplete operations",
  why: "Must set process.exitCode = 1 on all errors",
  file_refs: ["https://cli-guidelines.io/#exit-codes"],
  created_by_task: "Define silent failure pitfall"
});

// Link to pitfalls research
await megamemory.link({
  from: silentFailurePitfall.id,
  to: "[pitfalls-research-concept-id]",
  relation: "connects_to",
  description: "Part of CLI critical pitfalls"
});

// Link to chapter that addresses it
await megamemory.link({
  from: "[chapter-1-concept-id]",
  to: silentFailurePitfall.id,
  relation: "verifies",
  description: "Chapter 1 prevents silent failures with proper error handling"
});
```

---

## MegaMemory Examples

### Example 1: Complete Pitfalls Research Flow

```typescript
// Step 1: Query existing pitfalls research
const existingPitfalls = await megamemory_understand({
  query: "pitfalls research REST API domain",
  top_k: 3
});

if (existingPitfalls.length === 0) {
  // Step 2: Create new pitfalls research
  const pitfallsConcept = await megamemory.create_concept({
    name: "Pitfalls Research: REST API",
    kind: "feature",
    summary: `
**Domain:** REST API
**Researched:** 2025-02-08
**Confidence:** HIGH

**Critical Pitfalls:**

### Pitfall 1: N+1 Query Problem

**What goes wrong:**
Fetching a list of resources triggers individual queries for each resource. 100-item list = 101 database queries instead of 2. API becomes slow and unscalable.

**Why it happens:**
Developers fetch related data inside loops instead of eager loading. ORM makes this mistake easy.

**How to avoid:**
- Use eager loading: Prisma's .include(), Sequelize's .findAll({ include })
- Audit database queries during development
- Set query monitoring in production

**Warning signs:**
- List endpoint gets slower as data grows
- Database connection pool exhaustion
- Monitoring shows many similar queries

**Chapter to address:** Chapter 2 - List operations

---

### Pitfall 2: Inconsistent Error Responses

**What goes wrong:**
Errors return different formats, codes, and messages across endpoints. Clients can't reliably parse or handle errors. Some errors expose stack traces.

**Why it happens:**
No centralized error handling. Each endpoint defines errors differently.

**How to avoid:**
- Implement global error middleware
- Define error response schema once
- Use standard HTTP status codes

**Warning signs:**
- Client code has many error-format branches
- Some errors return 200 with error message in body
- Stack traces visible in production

**Chapter to address:** Chapter 1 - Error handling infrastructure

---

### Pitfall 3: Missing Pagination

**What goes wrong:**
List endpoints return all records without limit. API works fine in dev, crashes in production with 100k records. Memory exhaustion, slow responses.

**Why it happens:**
Data is small in dev. Pagination deferred as "nice to have." Not tested with realistic data volumes.

**How to avoid:**
- Implement pagination for all list endpoints from day 1
- Set reasonable default page size (20-50)
- Add max page size limit (e.g., 100)

**Warning signs:**
- API response time increases linearly with data size
- Memory usage spikes on large datasets
- Monitoring shows slow list endpoints

**Chapter to address:** Chapter 2 - List operations

---

### Pitfall 4: Insecure Auth Token Storage

**What goes wrong:**
API tokens stored in plaintext, database, or environment files without encryption. If DB is compromised, all user tokens are stolen.

**Why it happens:**
"Hashing passwords" is standard, but tokens aren't hashed by default. Developers treat tokens like regular strings.

**How to avoid:**
- Hash API tokens before storing
- Use proper key derivation functions (bcrypt, argon2)
- Never log or expose tokens

**Warning signs:**
- Tokens visible in database queries
- Logs contain raw tokens
- No hashing in token storage code

**Chapter to address:** Chapter 1 - Authentication infrastructure

---

### Pitfall 5: Race Conditions in Updates

**What goes wrong:**
Two requests update the same resource simultaneously. Last write wins, overwriting first update without detection. Data lost silently.

**Why it happens:**
No optimistic concurrency control or versioning. APIs assume serial access.

**How to avoid:**
- Add version field to resources
- Return 409 Conflict on version mismatch
- Include current version in update response

**Warning signs:**
- Data loss reported under concurrent load
- Tests pass in sequential execution, fail in parallel
- "It worked yesterday" issues

**Chapter to address:** Chapter 3 - Update operations

---

**Technical Debt Patterns:**

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skipping validation | Faster endpoint dev | Invalid data in DB | Never — always validate |
| Returning DB entities directly | Less code | Tight coupling, security risk | Never — use DTOs |
| No pagination | Simpler endpoints | Unscalable lists | MVP only, add in v1.x |
| Returning 200 with error body | Easier client code | Confusing semantics | Never — use proper codes |

**Integration Gotchas:**

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Stripe webhooks | Not verifying signature | Always verify webhook signature |
| S3 file upload | No file type validation | Validate MIME types on upload |
| Database migrations | Running in prod without backup | Always backup before migrations |

**Performance Traps:**

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| N+1 queries | Slow lists as data grows | Eager load related data | >100 records |
| Full table scans | Slow queries | Add indexes on query fields | >10k records |
| No response caching | Repeated expensive queries | Cache GET responses | Frequent identical requests |

**Security Mistakes:**

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing IDs in URLs | Enumeration attacks | Use UUIDs or encode IDs |
| Not validating input | SQL injection, XSS | Use input validation library |
| Missing CORS config | Cross-origin attacks | Explicitly whitelist origins |
| Logging sensitive data | Information leak | Sanitize all logs |

**UX Pitfalls:**

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No rate limiting | API abuse, downtime | Implement rate limiting per endpoint |
| Too many error codes | Confusing for clients | Use standard HTTP codes, extra info in body |
| No version in URL | Breaking changes break clients | Use /v1/ URL versioning |

**"Looks Done But Isn't" Checklist:**

- [ ] **Pagination:** Often missing on list endpoints — verify all lists have pagination
- [ ] **Error responses:** Often inconsistent — verify all errors use same schema
- [ ] **Input validation:** Often missing for complex types — verify all inputs validated
- [ ] **Rate limiting:** Often missing — verify API has rate limits
- [ ] **CORS:** Often too permissive — verify CORS is explicitly configured

**Recovery Strategies:**

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| N+1 queries | MEDIUM | Add eager loading, deploy without downtime |
| Missing pagination | HIGH | Refactor all list endpoints, may require client changes |
| Inconsistent errors | MEDIUM | Implement error middleware, migrate endpoints |
| Insecure token storage | HIGH | Hash all tokens, force users to regenerate |

**Pitfall-to-Chapter Mapping:**

| Pitfall | Prevention Chapter | Verification |
|---------|------------------|--------------|
| N+1 queries | Chapter 2 | Load test with 1000 records |
| Inconsistent errors | Chapter 1 | Integration tests verify error schema |
| Missing pagination | Chapter 2 | Load test with large datasets |
| Insecure auth tokens | Chapter 1 | Security audit of token storage |
| Race conditions | Chapter 3 | Concurrent update tests |

**Sources:**
- API security: https://owasp.org/www-project-api-security/
- REST best practices: https://restfulapi.net/
- Post-mortems: Analyzed GitHub, Stripe API issues
`,
    why: "REST API pitfalls are costly to fix later, must prevent during implementation",
    file_refs: [
      "https://owasp.org/www-project-api-security/",
      "https://restfulapi.net/"
    ],
    created_by_task: "Research REST API common pitfalls and mistakes"
  });

  // Step 3: Link to project
  await megamemory.link({
    from: pitfallsConcept.id,
    to: "[project-concept-id]",
    relation: "configured_by",
    description: "REST API pitfalls must be addressed for successful project"
  });
}

// Step 4: Use pitfalls research in chapter planning
const pitfallsInfo = existingPitfalls[0] || pitfallsConcept;
console.log("Critical pitfalls for Chapter 1:", extractChapterPitfalls(pitfallsInfo.summary, "Chapter 1"));
```

### Example 2: Extracting Pitfall Prevention for Chapters

```typescript
// When agent needs pitfalls to prevent in a chapter

async function getPitfallsForChapter(domain: string, chapter: string) {
  const results = await megamemory_understand({
    query: `pitfalls research ${domain}`,
    top_k: 1
  });
  
  if (results.length === 0) {
    console.log(`No pitfalls research found for domain: ${domain}`);
    return [];
  }
  
  const pitfalls = results[0];
  const summary = pitfalls.summary;
  
  // Extract pitfalls mapped to this chapter
  const chapterPitfalls = [];
  const lines = summary.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(`Chapter to address:** ${chapter}`)) {
      // Find the pitfall name (3 lines up)
      const pitfallName = lines[i - 3].replace(/### Pitfall \d+: /, '');
      chapterPitfalls.push({
        name: pitfallName,
        what: extractSection(lines, i - 2, 'What goes wrong:'),
        howToAvoid: extractSection(lines, i - 1, 'How to avoid:'),
        warningSigns: extractSection(lines, i, 'Warning signs:')
      });
    }
  }
  
  return chapterPitfalls;
}

// Agent uses to create chapter tasks
const chapter1Pitfalls = await getPitfallsForChapter('REST API', 'Chapter 1');
for (const pitfall of chapter1Pitfalls) {
  console.log(`Prevent: ${pitfall.name}`);
  console.log(`  Warning signs: ${pitfall.warningSigns}`);
}
```

---

## Original Template Reference

<template>

```markdown
# Pitfalls Research

**Domain:** [domain type]
**Researched:** [date]
**Confidence:** [HIGH/MEDIUM/LOW]

## Critical Pitfalls

### Pitfall 1: [Name]

**What goes wrong:**
[Description of the failure mode]

**Why it happens:**
[Root cause — why developers make this mistake]

**How to avoid:**
[Specific prevention strategy]

**Warning signs:**
[How to detect this early before it becomes a problem]

**Chapter to address:**
[Which roadmap chapter should prevent this]

---

### Pitfall 2: [Name]

**What goes wrong:**
[Description of the failure mode]

**Why it happens:**
[Root cause — why developers make this mistake]

**How to avoid:**
[Specific prevention strategy]

**Warning signs:**
[How to detect this early before it becomes a problem]

**Chapter to address:**
[Which roadmap chapter should prevent this]

---

### Pitfall 3: [Name]

**What goes wrong:**
[Description of the failure mode]

**Why it happens:**
[Root cause — why developers make this mistake]

**How to avoid:**
[Specific prevention strategy]

**Warning signs:**
[How to detect this early before it becomes a problem]

**Chapter to address:**
[Which roadmap chapter should prevent this]

---

[Continue for all critical pitfalls...]

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| [shortcut] | [benefit] | [cost] | [conditions, or "never"] |
| [shortcut] | [benefit] | [cost] | [conditions, or "never"] |
| [shortcut] | [benefit] | [cost] | [conditions, or "never"] |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| [service] | [what people do wrong] | [what to do instead] |
| [service] | [what people do wrong] | [what to do instead] |
| [service] | [what people do wrong] | [what to do instead] |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| [trap] | [how you notice] | [how to avoid] | [scale threshold] |
| [trap] | [how you notice] | [how to avoid] | [scale threshold] |
| [trap] | [how you notice] | [how to avoid] | [scale threshold] |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| [mistake] | [what could happen] | [how to avoid] |
| [mistake] | [what could happen] | [how to avoid] |
| [mistake] | [what could happen] | [how to avoid] |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| [pitfall] | [how users suffer] | [what to do instead] |
| [pitfall] | [how users suffer] | [what to do instead] |
| [pitfall] | [how users suffer] | [what to do instead] |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **[Feature]:** Often missing [thing] — verify [check]
- [ ] **[Feature]:** Often missing [thing] — verify [check]
- [ ] **[Feature]:** Often missing [thing] — verify [check]
- [ ] **[Feature]:** Often missing [thing] — verify [check]

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| [pitfall] | LOW/MEDIUM/HIGH | [what to do] |
| [pitfall] | LOW/MEDIUM/HIGH | [what to do] |
| [pitfall] | LOW/MEDIUM/HIGH | [what to do] |

## Pitfall-to-Chapter Mapping

How roadmap chapters should address these pitfalls.

| Pitfall | Prevention Chapter | Verification |
|---------|------------------|--------------|
| [pitfall] | Chapter [X] | [how to verify prevention worked] |
| [pitfall] | Chapter [X] | [how to verify prevention worked] |
| [pitfall] | Chapter [X] | [how to verify prevention worked] |

## Sources

- [Post-mortems referenced]
- [Community discussions]
- [Official "gotchas" documentation]
- [Personal experience / known issues]

---
*Pitfalls research for: [domain]*
*Researched: [date]*
```

</template>

---

## Guidelines

<guidelines>

**Critical Pitfalls:**
- Focus on domain-specific issues, not generic mistakes
- Include warning signs — early detection prevents disasters
- Link to specific chapters — makes pitfalls actionable

**Technical Debt:**
- Be realistic — some shortcuts are acceptable
- Note when shortcuts are "never acceptable" vs. "only in MVP"
- Include the long-term cost to inform tradeoff decisions

**Performance Traps:**
- Include scale thresholds ("breaks at 10k users")
- Focus on what's relevant for this project's expected scale
- Don't over-engineer for hypothetical scale

**Security Mistakes:**
- Beyond OWASP basics — domain-specific issues
- Example: Community platforms have different security concerns than e-commerce
- Include risk level to prioritize

**"Looks Done But Isn't":**
- Checklist format for verification during execution
- Common in demos vs. production
- Prevents "it works on my machine" issues

**Pitfall-to-Chapter Mapping:**
- Critical for roadmap creation
- Each pitfall should map to a chapter that prevents it
- Informs chapter ordering and success criteria

</guidelines>
