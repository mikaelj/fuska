<deviation_rules>

**While executing tasks, you WILL discover work not in the plan.** This is normal.

Apply these rules automatically. Track all deviations for Summary documentation.

---

**RULE 1: Auto-fix bugs**

**Trigger:** Code doesn't work as intended (broken behavior, incorrect output, errors)
**Action:** Fix immediately, track for Summary

Examples: wrong SQL query, logic errors, type/null errors, broken validation, security vulnerabilities, race conditions, memory leaks.

Process: Fix inline → add/update tests → verify → continue → track as `[Rule 1 - Bug] [description]` → update MegaMemory.

**No user permission needed.** Bugs must be fixed for correct operation.

---

**RULE 2: Auto-add missing critical functionality**

**Trigger:** Code is missing essential features for correctness, security, or basic operation
**Action:** Add immediately, track for Summary

Examples: missing error handling, no input validation, missing null checks, no auth on protected routes, missing authorization, no CSRF/CORS protection, no rate limiting, missing DB indexes, no error logging.

Process: Add inline → add tests → verify → continue → track as `[Rule 2 - Missing Critical] [description]` → update MegaMemory.

**No user permission needed.** These are requirements for basic correctness, not "features".

---

**RULE 3: Auto-fix blocking issues**

**Trigger:** Something prevents you from completing current task
**Action:** Fix immediately to unblock, track for Summary

Examples: missing dependency, wrong types blocking compilation, broken imports, missing env vars, DB config errors, build config errors, missing referenced files, circular dependencies.

Process: Fix blocker → verify task can proceed → continue → track as `[Rule 3 - Blocking] [description]`.

**No user permission needed.** Can't complete task without fixing blocker.

---

**RULE 4: Ask about architectural changes**

**Trigger:** Fix/addition requires significant structural modification
**Action:** STOP, present to user, wait for decision

Examples: adding new DB table (not just column), major schema changes, new service layer/pattern, switching frameworks, changing auth approach, adding new infrastructure, breaking API changes, new deployment environment.

Process: STOP → present what you found, proposed change, why needed, impact, alternatives → WAIT for decision → implement or defer → track as `[Rule 4 - Architectural] [description]` → update MegaMemory.

**User decision required.** These changes affect system design.

---

**RULE PRIORITY (when multiple could apply):**

1. **If Rule 4 applies** → STOP and ask (architectural decision)
2. **If Rules 1-3 apply** → Fix automatically, track for Summary
3. **If genuinely unsure which rule** → Apply Rule 4 (ask user)

**Edge case guidance:**
- "This validation is missing" → Rule 2 (critical for security)
- "This crashes on null" → Rule 1 (bug)
- "Need to add table" → Rule 4 (architectural)
- "Need to add column" → Rule 1 or 2 (depends: fixing bug or adding critical field)

**When in doubt:** "Does this affect correctness, security, or ability to complete task?" YES → Rules 1-3. MAYBE → Rule 4.

</deviation_rules>

<authentication_gates>

**When you encounter authentication errors during `type="auto"` task execution:**

This is NOT a failure. Authentication gates are expected and normal.

**Authentication error indicators:**
- CLI returns: "Error: Not authenticated", "Not logged in", "Unauthorized", "401", "403"
- API returns: "Authentication required", "Invalid API key", "Missing credentials"
- Command fails with: "Please run {tool} login" or "Set {ENV_VAR} environment variable"

**Authentication gate protocol:**

1. **Recognize it's an auth gate** — Not a bug, just needs credentials
2. **STOP current task execution** — Don't retry repeatedly
3. **Return checkpoint with type `human-action`** — Present to user
4. **Provide exact authentication steps** — CLI commands, where to get keys
5. **Specify verification** — How you'll confirm auth worked
6. **After user authenticates** — Retry the original task, continue normally

**In Summary documentation:** Document authentication gates as normal flow, not deviations. They're expected interaction points during first-time setup.

</authentication_gates>
