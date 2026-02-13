# User Setup Template (MegaMemory-Backed)

Template for human-required configuration - stored in MegaMemory, never on disk.

---

## Original Template Structure

```markdown
# Phase {X}: User Setup Required

**Generated:** [YYYY-MM-DD]
**Phase:** {phase-name}
**Status:** Incomplete

Complete these items for the integration to function. OpenCode automated everything possible; these items require human access to external dashboards/accounts.

## Environment Variables

| Status | Variable | Source | Add to |
|--------|----------|--------|--------|
| [ ] | `ENV_VAR_NAME` | [Service Dashboard → Path → To → Value] | `.env.local` |
| [ ] | `ANOTHER_VAR` | [Service Dashboard → Path → To → Value] | `.env.local` |

## Account Setup

[Only if new account creation is required]

- [ ] **Create [Service] account**
  - URL: [signup URL]
  - Skip if: Already have account

## Dashboard Configuration

[Only if dashboard configuration is required]

- [ ] **[Configuration task]**
  - Location: [Service Dashboard → Path → To → Setting]
  - Set to: [Required value or configuration]
  - Notes: [Any important details]

## Verification

After completing setup, verify with:

```bash
# [Verification commands]
```

Expected results:
- [What success looks like]

---

**Once all items complete:** Mark status as "Complete" at top.
```

---

## MegaMemory Schema

```typescript
<megamemory_schema>
concept_kind: "user-setup"

summary: |
  User Setup for Phase {phase_number}: {phase_name}
  Status: {incomplete | complete}
  Generated: {date}
  {Env vars: X, Account setup: X, Dashboard config: X}

why: |
  Documents setup tasks that literally require human action - account creation, dashboard configuration, secret retrieval.
  OpenCode automates everything possible; this file captures only what remains.

file_refs: [
  ".env.local"
]

edges: [
  {
    to: "phase-{phase_number}",
    relation: "connects_to",
    description: "Setup required for this phase"
  }
]
</megamemory_schema>
```

---

## MegaMemory Operations

```markdown
<megamemory_operations>
**Create User Setup (when plan requires human setup):**

1. Create concept with phase, environment variables, account setup, dashboard config
2. Set status to "incomplete"
3. List all required items with checkboxes
4. Include verification commands
5. Link to parent phase
6. Return concept ID for updates

**Update Status (when items completed):**

1. Update status from "incomplete" to "complete" when all items done
2. Mark specific items as complete (if tracking individually)
3. Update timestamp

**Query User Setup (for execution):**

1. Query setup by phase number
2. Read environment variables, account setup, dashboard config
3. Run verification commands to confirm setup is complete
</megamemory_operations>
```

---

## MegaMemory Examples

```typescript
<megamemory_examples>
```typescript
// Create a user setup
const createUserSetup = async (phaseNumber: string, phaseName: string, setup: {
  envVars: Array<{
    name: string;
    source: string;
    addTo: string;
  }>;
  accountSetup?: {
    serviceName: string;
    signupUrl: string;
    skipIf?: string;
  };
  dashboardConfig?: Array<{
    task: string;
    location: string;
    setValue: string;
    notes?: string;
  }>;
  verification?: {
    commands: string[];
    expectedResults: string[];
  };
}) => {
  const now = new Date().toISOString().split('T')[0];

  let summary =
    `User Setup for Phase ${phaseNumber}: ${phaseName}\n` +
    `Status: incomplete\n` +
    `Generated: ${now}\n\n` +
    `Environment Variables:\n` +
    setup.envVars.map(v => `- [ ] ${v.name} (Source: ${v.source}, Add to: ${v.addTo})`).join('\n') +
    `\n\n` +
    `Env vars: ${setup.envVars.length}`;

  if (setup.accountSetup) {
    summary += `\n\nAccount Setup:\n` +
               `- [ ] Create ${setup.accountSetup.serviceName} account\n` +
               `  URL: ${setup.accountSetup.signupUrl}`;
    if (setup.accountSetup.skipIf) {
      summary += `\n  Skip if: ${setup.accountSetup.skipIf}`;
    }
    summary += `\n\nAccount setup: 1`;
  }

  if (setup.dashboardConfig) {
    summary += `\n\nDashboard Configuration:\n` +
               setup.dashboardConfig.map(d =>
                 `- [ ] ${d.task}\n` +
                 `  Location: ${d.location}\n` +
                 `  Set to: ${d.setValue}` +
                 (d.notes ? `\n  Notes: ${d.notes}` : '')
               ).join('\n\n');
    summary += `\n\nDashboard config: ${setup.dashboardConfig.length}`;
  }

  if (setup.verification) {
    summary += `\n\nVerification:\n` +
               `Commands:\n` +
               setup.verification.commands.map(c => `  ${c}`).join('\n') +
               `\n\nExpected results:\n` +
               setup.verification.expectedResults.map(r => `- ${r}`).join('\n');
  }

  const result = await megamemory.create_concept({
    name: `User Setup: Phase ${phaseNumber}`,
    kind: "user-setup",
    summary,
    why: "Documents setup tasks that literally require human action - account creation, dashboard configuration, secret retrieval. " +
          "OpenCode automates everything possible; this file captures only what remains.",
    file_refs: [".env.local"],
    edges: [{
      to: `phase-${phaseNumber}`,
      relation: "connects_to",
      description: "Setup required for this phase"
    }],
    created_by_task: `Execute plan for Phase ${phaseNumber}`
  });
  const concept = JSON.parse(result.concepts[0]);

  return concept.id;
};

// Update setup status
const updateSetupStatus = async (setupId: string, status: 'incomplete' | 'complete', completedItems?: {
  envVarNames?: string[];
  accountSetupComplete?: boolean;
  dashboardConfigTasks?: string[];
}) => {
  await megamemory.update_concept({
    id: setupId,
    changes: {
      summary: (currentSummary) => {
        let updated = currentSummary
          .replace(/Status: incomplete/, `Status: ${status}`);

        if (completedItems?.envVarNames) {
          for (const varName of completedItems.envVarNames) {
            updated = updated.replace(
              new RegExp(`- \\[ \\] ${varName}`),
              `- [x] ${varName}`
            );
          }
        }

        if (completedItems?.accountSetupComplete) {
          updated = updated.replace(
            /- \[ \] Create (.+?) account/,
            '- [x] Create $1 account'
          );
        }

        if (completedItems?.dashboardConfigTasks) {
          for (const task of completedItems.dashboardConfigTasks) {
            updated = updated.replace(
              new RegExp(`- \\[ \\] ${task}`),
              `- [x] ${task}`
            );
          }
        }

        return updated;
      }
    }
  });
};

// Query user setup
const queryUserSetup = async (phaseNumber: string) => {
  const result = await megamemory.understand({
    query: `User setup for Phase ${phaseNumber} with env vars, account setup, dashboard config`
  });

  if (result.concepts.length > 0) {
    const setup = JSON.parse(result.concepts[0]);
    const summary = setup.summary;

    // Parse basic info
    const setupData = {
      id: setup.id,
      phaseNumber,
      phaseName: summary.match(/User Setup for Phase ([\d.]+): ([^\n]+)/)?.[2] || '',
      status: summary.match(/Status: (incomplete|complete)/)?.[1] || 'incomplete',
      generated: summary.match(/Generated: ([^\n]+)/)?.[1] || '',
      envVars: summary.includes('Environment Variables:')
        ? summary.match(/Environment Variables:\n([\s\S]*?)(?=\n\nAccount Setup:|\n\nDashboard Configuration:|\n\nVerification:|$)/)?.[1]
            .split('\n')
            .filter(line => line.startsWith('- '))
            .map(line => {
              const match = line.match(/\[ ([\s])\] ([^ ]+) \(Source: ([^,]+), Add to: ([^)]+)\)/);
              return match ? {
                name: match[2],
                source: match[3],
                addTo: match[4],
                complete: match[1] === 'x'
              } : null;
            })
            .filter(Boolean) || []
        : [],
      accountSetup: summary.includes('Account Setup:')
        ? {
            serviceName: summary.match(/Account Setup:\n- (?:\[[\s]\]|\[x\]) Create (.+?) account/)?.[1] || '',
            signupUrl: summary.match(/URL: ([^\n]+)/)?.[1] || '',
            skipIf: summary.match(/Skip if: ([^\n]+)/)?.[1] || '',
            complete: summary.includes('Account Setup:') && summary.includes('[x] Create')
          }
        : null,
      dashboardConfig: summary.includes('Dashboard Configuration:')
        ? summary.match(/Dashboard Configuration:\n([\s\S]*?)(?=\n\nVerification:|$)/)?.[1]
            .split('\n\n')
            .filter(block => block.startsWith('- ') || block.startsWith('- [x]'))
            .map(block => {
              const taskMatch = block.match(/- (?:\[[\s]\]|\[x\]) (.+?)\n/);
              const locationMatch = block.match(/Location: ([^\n]+)/);
              const setValueMatch = block.match(/Set to: ([^\n]+)/);
              const notesMatch = block.match(/Notes: ([^\n]+)/);
              return {
                task: taskMatch?.[1] || '',
                location: locationMatch?.[1] || '',
                setValue: setValueMatch?.[1] || '',
                notes: notesMatch?.[1] || '',
                complete: block.startsWith('- [x]')
              };
            }) || []
        : [],
      verification: summary.includes('Verification:')
        ? {
            commands: summary.match(/Verification:\nCommands:\n([\s\S]*?)\n\nExpected results:/)?.[1]
                .split('\n')
                .filter(line => line.startsWith('  ')) || [],
            expectedResults: summary.includes('Expected results:')
              ? summary.match(/Expected results:\n([\s\S]*?)$/)?.[1]
                  .split('\n')
                  .filter(line => line.startsWith('- '))
                  .map(line => line.slice(2)) || []
              : []
          }
        : null
    };

    return setupData;
  }

  return null;
};

// Verify setup is complete
const verifySetupComplete = async (setupId: string) => {
  const result = await megamemory.understand({
    query: `User setup with ID ${setupId}`
  });

  if (result.concepts.length === 0) {
    return { complete: false, missing: ['Setup not found'] };
  }

  const setup = JSON.parse(result.concepts[0]);
  const summary = setup.summary;

  // Parse basic info
  const setupData = {
    id: setup.id,
    phaseNumber: summary.match(/User Setup for Phase ([\d.]+): ([^\n]+)/)?.[1] || '',
    phaseName: summary.match(/User Setup for Phase [\d.]+: ([^\n]+)/)?.[2] || '',
    status: summary.match(/Status: (incomplete|complete)/)?.[1] || 'incomplete',
    generated: summary.match(/Generated: ([^\n]+)/)?.[1] || '',
    envVars: summary.includes('Environment Variables:')
      ? summary.match(/Environment Variables:\n([\s\S]*?)(?=\n\nAccount Setup:|\n\nDashboard Configuration:|\n\nVerification:|$)/)?.[1]
          .split('\n')
          .filter(line => line.startsWith('- '))
          .map(line => {
            const match = line.match(/\[ ([\s])\] ([^ ]+) \(Source: ([^,]+), Add to: ([^)]+)\)/);
            return match ? {
              name: match[2],
              source: match[3],
              addTo: match[4],
              complete: match[1] === 'x'
            } : null;
          })
          .filter(Boolean) || []
      : [],
    accountSetup: summary.includes('Account Setup:')
      ? {
          serviceName: summary.match(/Account Setup:\n- (?:\[[\s]\]|\[x\]) Create (.+?) account/)?.[1] || '',
          signupUrl: summary.match(/URL: ([^\n]+)/)?.[1] || '',
          skipIf: summary.match(/Skip if: ([^\n]+)/)?.[1] || '',
          complete: summary.includes('Account Setup:') && summary.includes('[x] Create')
        }
      : null,
    dashboardConfig: summary.includes('Dashboard Configuration:')
      ? summary.match(/Dashboard Configuration:\n([\s\S]*?)(?=\n\nVerification:|$)/)?.[1]
          .split('\n\n')
          .filter(block => block.startsWith('- ') || block.startsWith('- [x]'))
          .map(block => {
            const taskMatch = block.match(/- (?:\[[\s]\]|\[x\]) (.+?)\n/);
            const locationMatch = block.match(/Location: ([^\n]+)/);
            const setValueMatch = block.match(/Set to: ([^\n]+)/);
            const notesMatch = block.match(/Notes: ([^\n]+)/);
            return {
              task: taskMatch?.[1] || '',
              location: locationMatch?.[1] || '',
              setValue: setValueMatch?.[1] || '',
              notes: notesMatch?.[1] || '',
              complete: block.startsWith('- [x]')
            };
          }) || []
      : []
  };

  const missing: string[] = [];

  if (setupData.envVars.some(v => !v.complete)) {
    missing.push(...setupData.envVars.filter(v => !v.complete).map(v => `Env var: ${v.name}`));
  }

  if (setupData.accountSetup && !setupData.accountSetup.complete) {
    missing.push(`Account setup: ${setupData.accountSetup.serviceName}`);
  }

  if (setupData.dashboardConfig.some(d => !d.complete)) {
    missing.push(...setupData.dashboardConfig.filter(d => !d.complete).map(d => `Config: ${d.task}`));
  }

  return {
    complete: missing.length === 0,
    missing
  };
};
```
</megamemory_examples>
```

---

## The Automation-First Rule

```markdown
**USER-SETUP contains ONLY what OpenCode literally cannot do.**

| OpenCode CAN Do (not in USER-SETUP) | OpenCode CANNOT Do (→ USER-SETUP) |
|-----------------------------------|--------------------------------|
| `npm install stripe` | Create Stripe account |
| write webhook handler code | Get API keys from dashboard |
| Create `.env.local` file structure | Copy actual secret values |
| Run `stripe listen` | Authenticate Stripe CLI (browser OAuth) |
| Configure package.json | Access external service dashboards |
| write any code | Retrieve secrets from third-party systems |

**The test:** "Does this require a human in a browser, accessing an account OpenCode doesn't have credentials for?"
- Yes → USER-SETUP.md
- No → OpenCode does it automatically
```

---

## Service-Specific Examples

```markdown
### Stripe Example

```markdown
# Phase 10: User Setup Required

**Generated:** 2025-01-14
**Phase:** 10-monetization
**Status:** Incomplete

Complete these items for Stripe integration to function.

## Environment Variables

| Status | Variable | Source | Add to |
|--------|----------|--------|--------|
| [ ] | `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys → Secret key | `.env.local` |
| [ ] | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → Developers → API keys → Publishable key | `.env.local` |
| [ ] | `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Developers → Webhooks → [endpoint] → Signing secret | `.env.local` |

## Account Setup

- [ ] **Create Stripe account** (if needed)
  - URL: https://dashboard.stripe.com/register
  - Skip if: Already have Stripe account

## Dashboard Configuration

- [ ] **Create webhook endpoint**
  - Location: Stripe Dashboard → Developers → Webhooks → Add endpoint
  - Endpoint URL: `https://[your-domain]/api/webhooks/stripe`
  - Events to send:
    - `checkout.session.completed`
    - `customer.subscription.created`
    - `customer.subscription.updated`
    - `customer.subscription.deleted`

- [ ] **Create products and prices** (if using subscription tiers)
  - Location: Stripe Dashboard → Products → Add product
  - Create each subscription tier
  - Copy Price IDs to:
    - `STRIPE_STARTER_PRICE_ID`
    - `STRIPE_PRO_PRICE_ID`

## Local Development

For local webhook testing:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```
Use the webhook signing secret from CLI output (starts with `whsec_`).

## Verification

After completing setup:

```bash
# Check env vars are set
grep STRIPE .env.local

# Verify build passes
npm run build

# Test webhook endpoint (should return 400 bad signature, not 500 crash)
curl -X POST http://localhost:3000/api/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: Build passes, webhook returns 400 (signature validation working).

---

**Once all items complete:** Mark status as "Complete" at top.
```

### Supabase Example

```markdown
# Phase 2: User Setup Required

**Generated:** 2025-01-14
**Phase:** 02-authentication
**Status:** Incomplete

Complete these items for Supabase Auth to function.

## Environment Variables

| Status | Variable | Source | Add to |
|--------|----------|--------|--------|
| [ ] | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL | `.env.local` |
| [ ] | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → anon public | `.env.local` |
| [ ] | `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → service_role | `.env.local` |

## Account Setup

- [ ] **Create Supabase project**
  - URL: https://supabase.com/dashboard/new
  - Skip if: Already have project for this app

## Dashboard Configuration

- [ ] **Enable Email Auth**
  - Location: Supabase Dashboard → Authentication → Providers
  - Enable: Email provider
  - Configure: Confirm email (on/off based on preference)

- [ ] **Configure OAuth providers** (if using social login)
  - Location: Supabase Dashboard → Authentication → Providers
  - For Google: Add Client ID and Secret from Google Cloud Console
  - For GitHub: Add Client ID and Secret from GitHub OAuth Apps

## Verification

After completing setup:

```bash
# Check env vars
grep SUPABASE .env.local

# Verify connection (run in project directory)
npx supabase status
```

---

**Once all items complete:** Mark status as "Complete" at top.
```

### SendGrid Example

```markdown
# Phase 5: User Setup Required

**Generated:** 2025-01-14
**Phase:** 05-notifications
**Status:** Incomplete

Complete these items for SendGrid email to function.

## Environment Variables

| Status | Variable | Source | Add to |
|--------|----------|--------|--------|
| [ ] | `SENDGRID_API_KEY` | SendGrid Dashboard → Settings → API Keys → Create API Key | `.env.local` |
| [ ] | `SENDGRID_FROM_EMAIL` | Your verified sender email address | `.env.local` |

## Account Setup

- [ ] **Create SendGrid account**
  - URL: https://signup.sendgrid.com/
  - Skip if: Already have account

## Dashboard Configuration

- [ ] **Verify sender identity**
  - Location: SendGrid Dashboard → Settings → Sender Authentication
  - Option 1: Single Sender Verification (quick, for dev)
  - Option 2: Domain Authentication (production)

- [ ] **Create API Key**
  - Location: SendGrid Dashboard → Settings → API Keys → Create API Key
  - Permission: Restricted Access → Mail Send (Full Access)
  - Copy key immediately (shown only once)

## Verification

After completing setup:

```bash
# Check env var
grep SENDGRID .env.local

# Test email sending (replace with your test email)
curl -X POST http://localhost:3000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"to": "your@email.com"}'
```

---

**Once all items complete:** Mark status as "Complete" at top.
```
```

---

## When to Generate

```markdown
Generate user setup when plan frontmatter contains `user_setup` field.

**Trigger:** `user_setup` exists in PLAN.md frontmatter and has items.

**Location:** MegaMemory concept linked to phase concept.

**Timing:** Generated during execute-plan.md after tasks complete, before SUMMARY.md creation.
```

---

## Frontmatter Schema

```yaml
In PLAN.md, user_setup declares human-required configuration:

user_setup:
  - service: stripe
    why: "Payment processing requires API keys"
    env_vars:
      - name: STRIPE_SECRET_KEY
        source: "Stripe Dashboard → Developers → API keys → Secret key"
      - name: STRIPE_WEBHOOK_SECRET
        source: "Stripe Dashboard → Developers → Webhooks → Signing secret"
    dashboard_config:
      - task: "Create webhook endpoint"
        location: "Stripe Dashboard → Developers → Webhooks → Add endpoint"
        details: "URL: https://[your-domain]/api/webhooks/stripe, Events: checkout.session.completed, customer.subscription.*"
    local_dev:
      - "Run: stripe listen --forward-to localhost:3000/api/webhooks/stripe"
      - "Use the webhook secret from CLI output for local testing"
```

---

## Guidelines

```markdown
**Include in USER-SETUP.md:**

- Environment variable names and where to find values
- Account creation URLs (if new service)
- Dashboard configuration steps
- Verification commands to confirm setup works
- Local development alternatives (e.g., `stripe listen`)

**Do NOT include:**

- Actual secret values (never)
- Steps OpenCode can automate (package installs, code changes, file creation)
- Generic instructions ("set up your environment")

**Naming:** `{phase}-USER-SETUP.md` matches the phase number pattern.

**Status tracking:** User marks checkboxes and updates status line when complete.

**Searchability:** Query MegaMemory for `user-setup` kind to find all phases with user requirements.
```
