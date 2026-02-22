<overview>
Plans execute autonomously. Checkpoints formalize the interaction points where human verification or decisions are needed.

**Core principle:** OpenCode automates everything with CLI/API. Checkpoints are for verification and decisions, not manual work.

**Golden rules:**
1. **If OpenCode can run it, OpenCode runs it** - Never ask user to execute CLI commands, start servers, or run builds
2. **OpenCode sets up the verification environment** - Start dev servers, seed databases, configure env vars
3. **User only does what requires human judgment** - Visual checks, UX evaluation, "does this feel right?"
4. **Secrets come from user, automation comes from OpenCode** - Ask for API keys, then OpenCode uses them via CLI
</overview>

<checkpoint_types>

<type name="human-verify">
## checkpoint:human-verify (Most Common - 90%)

**When:** OpenCode completed automated work, human confirms it works correctly.

**Use for:** Visual UI checks, interactive flows, functional verification, audio/video quality, animation smoothness, accessibility testing.

**Structure:**
```xml
<task type="checkpoint:human-verify" gate="blocking">
  <what-built>[What OpenCode automated and deployed/built]</what-built>
  <how-to-verify>
    [Exact steps to test - URLs, commands, expected behavior]
  </how-to-verify>
  <resume-signal>[How to continue - "approved", "yes", or describe issues]</resume-signal>
</task>
```

**Example: Responsive UI (server already running)**
```xml
<task type="auto">
  <name>Start dev server</name>
  <action>Run `npm run dev` in background, wait for ready signal</action>
  <verify>curl http://localhost:3000 returns 200</verify>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Responsive dashboard - dev server running at http://localhost:3000</what-built>
  <how-to-verify>
    Visit http://localhost:3000/dashboard and verify:
    1. Desktop (>1024px): Sidebar visible, content fills remaining space
    2. Tablet (768px): Sidebar collapses to icons
    3. Mobile (375px): Sidebar hidden, hamburger menu appears
    4. No horizontal scroll at any size
  </how-to-verify>
  <resume-signal>Type "approved" or describe layout issues</resume-signal>
</task>
```

**Key pattern:** OpenCode starts the dev server BEFORE the checkpoint. User only visits URLs.
</type>

<type name="decision">
## checkpoint:decision (9%)

**When:** Human must make choice that affects implementation direction.

**Use for:** Technology selection, architecture decisions, design choices, feature prioritization, data model decisions.

**Structure:**
```xml
<task type="checkpoint:decision" gate="blocking">
  <decision>[What's being decided]</decision>
  <context>[Why this decision matters]</context>
  <options>
    <option id="option-a">
      <name>[Option name]</name>
      <pros>[Benefits]</pros>
      <cons>[Tradeoffs]</cons>
    </option>
  </options>
  <resume-signal>[How to indicate choice]</resume-signal>
</task>
```

**Example: Auth Provider**
```xml
<task type="checkpoint:decision" gate="blocking">
  <decision>Select authentication provider</decision>
  <context>Need user authentication. Using Supabase DB already.</context>
  <options>
    <option id="supabase">
      <name>Supabase Auth</name>
      <pros>Built-in with our DB, free tier, row-level security</pros>
      <cons>Less customizable UI, ecosystem lock-in</cons>
    </option>
    <option id="clerk">
      <name>Clerk</name>
      <pros>Beautiful pre-built UI, best DX, excellent docs</pros>
      <cons>Paid after 10k MAU, vendor lock-in</cons>
    </option>
    <option id="nextauth">
      <name>NextAuth.js</name>
      <pros>Free, self-hosted, maximum control</pros>
      <cons>More setup work, DIY security updates</cons>
    </option>
  </options>
  <resume-signal>Select: supabase, clerk, or nextauth</resume-signal>
</task>
```
</type>

<type name="human-action">
## checkpoint:human-action (1% - Rare)

**When:** Action has NO CLI/API and requires human-only interaction, OR OpenCode hit an authentication gate.

**Use ONLY for:**
- **Authentication gates** - OpenCode tried CLI/API but needs credentials
- Email verification links
- SMS 2FA codes
- Manual account approvals
- Credit card 3D Secure flows
- OAuth app approvals

**Do NOT use for:** Deploying (use CLI), creating resources (use CLI/API), running builds/tests (use bash), creating files (use write tool), adding env vars (use CLI).

**Structure:**
```xml
<task type="checkpoint:human-action" gate="blocking">
  <action>[What human must do]</action>
  <instructions>[What OpenCode already automated + the ONE thing requiring human action]</instructions>
  <verification>[What OpenCode can check afterward]</verification>
  <resume-signal>[How to continue]</resume-signal>
</task>
```

**Example: Auth Gate (dynamic checkpoint)**
```xml
<!-- OpenCode tries automation, gets auth error, creates checkpoint on the fly -->
<task type="checkpoint:human-action" gate="blocking">
  <action>Authenticate Vercel CLI so I can continue deployment</action>
  <instructions>
    I tried to deploy but got authentication error.
    Run: vercel login
    Complete the browser authentication flow.
  </instructions>
  <verification>vercel whoami returns your account email</verification>
  <resume-signal>Type "done" when authenticated</resume-signal>
</task>
<!-- After auth, OpenCode retries the deployment automatically -->
```

**Key distinction:** Auth gates are created dynamically when OpenCode encounters auth errors. They're NOT pre-planned — OpenCode tries automation first, only asks for credentials when blocked.
</type>
</checkpoint_types>

<execution_protocol>

When OpenCode encounters `type="checkpoint:*"`:

1. **Stop immediately** - do not proceed to next task
2. **Display checkpoint clearly** using format below
3. **Wait for user response** - do not hallucinate completion
4. **Verify if possible** - check files, run tests, whatever is specified
5. **Resume execution** - continue to next task only after confirmation

**Display format:**
```
╔═══════════════════════════════════════════════════════╗
║  CHECKPOINT: [Verification/Decision/Action] Required  ║
╚═══════════════════════════════════════════════════════╝

Progress: X/Y tasks complete
Task: [task name]

[Type-specific content: what-built/decision/action details]

───────────────────────────────────────────────────────
→ YOUR ACTION: [resume-signal text]
───────────────────────────────────────────────────────
```
</execution_protocol>

<automation_reference>

**The rule:** If it has CLI/API, OpenCode does it. Never ask human to perform automatable work.

## Service CLI Reference

| Service | CLI | Key Commands | Auth Gate |
|---------|-----|--------------|-----------|
| Vercel | `vercel` | `--yes`, `env add`, `--prod`, `ls` | `vercel login` |
| Railway | `railway` | `init`, `up`, `variables set` | `railway login` |
| Fly | `fly` | `launch`, `deploy`, `secrets set` | `fly auth login` |
| Stripe | `stripe` + API | `listen`, `trigger`, API calls | API key in .env |
| Supabase | `supabase` | `init`, `link`, `db push`, `gen types` | `supabase login` |
| Upstash | `upstash` | `redis create`, `redis get` | `upstash auth login` |
| PlanetScale | `pscale` | `database create`, `branch create` | `pscale auth login` |
| GitHub | `gh` | `repo create`, `pr create`, `secret set` | `gh auth login` |
| Node | `npm`/`pnpm` | `install`, `run build`, `test`, `run dev` | N/A |
| Xcode | `xcodebuild` | `-project`, `-scheme`, `build`, `test` | N/A |
| Convex | `npx convex` | `dev`, `deploy`, `env set`, `env get` | `npx convex login` |

## Environment Variable Automation

**Env files:** Use write/edit tools. Never ask human to create .env manually.

**Dashboard env vars via CLI:**

| Platform | CLI Command | Example |
|----------|-------------|---------|
| Convex | `npx convex env set` | `npx convex env set OPENAI_API_KEY sk-...` |
| Vercel | `vercel env add` | `vercel env add STRIPE_KEY production` |
| Railway | `railway variables set` | `railway variables set API_KEY=value` |
| Fly | `fly secrets set` | `fly secrets set DATABASE_URL=...` |
| Supabase | `supabase secrets set` | `supabase secrets set MY_SECRET=value` |

**Secret collection pattern:** Ask user for the value via checkpoint:human-action, then OpenCode adds it via CLI. Never ask user to navigate to a dashboard.

## Dev Server Automation

| Framework | Start Command | Ready Signal | Default URL |
|-----------|---------------|--------------|-------------|
| Next.js | `npm run dev` | "Ready in" | http://localhost:3000 |
| Vite | `npm run dev` | "ready in" | http://localhost:5173 |
| Convex | `npx convex dev` | "Convex functions ready" | N/A (backend) |
| Express | `npm start` | "listening on port" | http://localhost:3000 |
| Django | `python manage.py runserver` | "Starting development server" | http://localhost:8000 |

**Protocol:** Run in background (`npm run dev &`), wait for ready signal (max 30s with curl polling), keep running through checkpoint. Kill only when plan complete or port needed elsewhere.

**Port conflicts:** Check with `lsof -ti:PORT`, kill stale process or use alternate port.

## CLI Installation

| CLI | Auto-install? | Command |
|-----|---------------|---------|
| npm/pnpm/yarn | No - ask user | User chooses |
| vercel | Yes | `npm i -g vercel` |
| gh | Yes | `brew install gh` / `apt install gh` |
| stripe | Yes | `npm i -g stripe` |
| supabase | Yes | `npm i -g supabase` |
| convex | No - use npx | `npx convex` |
| fly | Yes | `brew install flyctl` |
| railway | Yes | `npm i -g @railway/cli` |

## Pre-Checkpoint Failures

| Failure | Response |
|---------|----------|
| Server won't start | Fix issue, retry (don't proceed to checkpoint) |
| Port in use | Kill stale process or use alternate port |
| Missing dependency | `npm install`, retry |
| Build error | Fix the error first |
| Auth error | Create auth gate checkpoint |
| Network timeout | Retry with backoff, then checkpoint if persistent |

**Never present a checkpoint with broken verification environment.** If `curl localhost:3000` fails, don't ask user to visit it.

## Quick Reference

| Action | Automatable? |
|--------|--------------|
| Deploy to Vercel/Railway/Fly | Yes (CLI) |
| Create Stripe webhooks | Yes (API) |
| Write .env files | Yes (write tool) |
| Create databases | Yes (CLI) |
| Run tests/builds | Yes (bash) |
| Start dev servers | Yes (bash) |
| Add env vars to platforms | Yes (CLI) |
| Seed databases | Yes (CLI/API) |
| Click email verification | No |
| Enter credit card with 3DS | No |
| Complete OAuth in browser | No |
| Visually verify UI | No |
| Test interactive flows | No |

</automation_reference>

<writing_guidelines>

**DO:**
- Automate everything with CLI/API before checkpoint
- Be specific: "Visit https://myapp.vercel.app" not "check deployment"
- Number verification steps
- State expected outcomes: "You should see X"
- Provide context: why this checkpoint exists

**DON'T:**
- Ask human to do work OpenCode can automate
- Assume knowledge: "Configure the usual settings"
- Skip steps: "Set up database" (too vague)
- Mix multiple verifications in one checkpoint
- Present checkpoint with broken environment

**Placement:**
- After automation completes (not before)
- After UI buildout (before declaring complete)
- Before dependent work (decisions before implementation)
- At integration points (after external service config)
- NOT too frequently (combine related verifications)

</writing_guidelines>

<anti_patterns>

### BAD: Asking user to run CLI commands
```xml
<!-- WRONG: User runs npm/deploy/migrate commands -->
<task type="checkpoint:human-verify">
  <how-to-verify>1. Run: npm run dev  2. Visit localhost:3000</how-to-verify>
</task>
```
OpenCode starts servers, runs builds, deploys, migrates. User only visits URLs and verifies visuals.

### BAD: Asking user to navigate dashboards
```xml
<!-- WRONG: User adds env vars in dashboard UI -->
<task type="checkpoint:human-action">
  <instructions>Go to dashboard.convex.dev → Settings → Add OPENAI_API_KEY</instructions>
</task>
```
If the platform has a CLI (`npx convex env set`), OpenCode uses it. Ask user only for the secret value.

### BAD: Too many checkpoints
```xml
<!-- WRONG: Checkpoint after every task -->
<task type="auto">Create schema</task>
<task type="checkpoint:human-verify">Check schema</task>
<task type="auto">Create API</task>
<task type="checkpoint:human-verify">Check API</task>
```
Combine into one checkpoint at end: verify full flow (register → login → access protected page).

### BAD: Vague verification
```xml
<!-- WRONG -->
<task type="checkpoint:human-verify">
  <what-built>Dashboard</what-built>
  <how-to-verify>Check it works</how-to-verify>
</task>
```
Be specific: exact URL, numbered steps, expected outcomes at each breakpoint.

</anti_patterns>

<summary>

**Checkpoint priority:**
1. **checkpoint:human-verify** (90%) - OpenCode automated everything, human confirms visual/functional correctness
2. **checkpoint:decision** (9%) - Human makes architectural/technology choices
3. **checkpoint:human-action** (1%) - Truly unavoidable manual steps (auth gates, email verification, 3DS)

**When NOT to use checkpoints:**
- Things OpenCode can verify programmatically (tests, builds)
- File operations (OpenCode can read/write files)
- Anything automatable via CLI/API

</summary>
