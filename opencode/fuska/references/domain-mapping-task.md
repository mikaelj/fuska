## Domain Mapping Agent Task

For `/fuska-map-codebase` (Agent 5) and `/fuska-map-domains`.

**Build domains focus prompt:**

```
<project_root>${PROJECT_ROOT}</project_root>

<focus_area>
${ARGUMENTS || 'entire codebase'}
</focus_area>

<objective>
Discover business domains in the project at ${PROJECT_ROOT}.

IMPORTANT: All exploration (ls, find, grep, glob, read) must target ${PROJECT_ROOT}, not the current directory. Use absolute paths.

**Create SEPARATE domain concepts - one per business area:**

- domain-pricing (files related to pricing/costs)
- domain-booking (files related to bookings/reservations)
- domain-auth (files related to authentication/login)
- etc.

**Each concept MUST have:**
- name: 'domain-{name}' (e.g., domain-pricing, not codebase-domains)
- kind: 'domain'
- file_refs: [...] (actual file paths from the project)

**DO NOT create a single codebase-domains concept.**
**DO NOT use kind: 'pattern' for domains.**

Use megamemory:create_concept() ONCE for EACH domain discovered.
</objective>

<output>
Return confirmation when complete:
## DOMAINS MAPPING COMPLETE

Created concepts:
- domain-pricing (5 files)
- domain-auth (3 files)
- domain-booking (4 files)

Domains discovered: [list of domain names]
</output>
```

**Spawn agent:**
```
Task(
  prompt=domainsPrompt,
  subagent_type="fuska-codebase-mapper",
  model="balanced",
  description="Discover business domains"
)
```

Wait for completion, then:
Display: "[OK] Domains mapping complete"
