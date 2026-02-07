# Verification Patterns (MegaMemory-Backed)

How to verify different types of artifacts are real implementations, not stubs or placeholders.

<core_principle>
**Existence ≠ Implementation**

A file existing does not mean the feature works. Verification must check:
1. **Exists** - File is present at expected path
2. **Substantive** - Content is real implementation, not placeholder
3. **Wired** - Connected to the rest of the system
4. **Functional** - Actually works when invoked

Levels 1-3 can be checked programmatically. Level 4 often requires human verification.
</core_principle>

<megamemory_schema>

## MegaMemory Concept Schema for Verification Patterns

Verification patterns are stored as `pattern` concepts with the following structure:

### Concept: `verification-pattern`
```typescript
interface VerificationPatternConcept {
  name: string;                    // Pattern identifier (e.g., "react-component-stub")
  kind: "pattern";
  summary: string;                  // What this pattern verifies
  why: string;                     // Why this verification matters
  
  file_refs: string[];              // References to verification code/examples
  
  edges: {
    to: string;                    // Related concepts
    relation: "depends_on" | "implements" | "connects_to";
    description: string;
  }[];
  
  created_by_task: string;          // Task that created/verified this pattern
  
  // Pattern-specific metadata (stored in summary or as nested concepts)
  artifact_type: "component" | "api" | "schema" | "hook" | "config" | "wiring";
  verification_level: "exists" | "substantive" | "wired" | "functional";
  check_type: "programmatic" | "human" | "hybrid";
}
```

### Related Concepts

**Concepts to create during verification:**
- `verification-result:{artifact-id}` - Individual verification outcome
- `artifact:{artifact-id}` - The artifact being verified
- `wiring:{source}-{target}` - Connection between components

**Relationships:**
- `verification-result` → `depends_on` → `verification-pattern`
- `verification-result` → `connects_to` → `artifact`
- `wiring` → `connects_to` → `artifact` (both sides)
- `artifact` → `implements` → `feature` (if relevant)

</megamemory_schema>

<megamemory_operations>

## MegaMemory Operations for Verification

### 1. Query Existing Patterns

Before starting verification, query for relevant patterns:

```typescript
// Query all verification patterns for React components
const reactPatterns = await megamemory.understand({
  query: "React component verification patterns stub detection"
});

// Query wiring patterns
const wiringPatterns = await megamemory.understand({
  query: "component API wiring verification database"
});

// Query specific artifact type
const apiPatterns = await megamemory.understand({
  query: "API route verification substantive query database"
});
```

### 2. Create Artifact Concept

Before verification, create an artifact concept to track it:

```typescript
const artifactId = await megamemory.create_concept({
  name: "artifact:api-auth-register",
  kind: "component",
  summary: "POST /api/auth/register endpoint in src/api/auth.ts:15-45. Handles user registration with email/password validation, duplicate checking, and JWT token return.",
  why: "Core authentication flow for user onboarding",
  file_refs: [
    "src/api/auth.ts:15-45",
    "src/types/user.ts:1-20"
  ],
  edges: [
    {
      to: "feature:user-authentication",
      relation: "implements",
      description: "Implements user registration endpoint"
    }
  ]
});
```

### 3. Record Verification Result

After running verification checks, record the result:

```typescript
const resultId = await megamemory.create_concept({
  name: `verification-result:${artifactId}`,
  kind: "config",
  summary: "Verification of artifact:api-auth-register. EXISTS: ✅ file present. SUBSTANTIVE: ✅ 45 lines, includes prisma.user.create and error handling. WIRED: ✅ imported by pages/register.tsx, uses process.env.JWT_SECRET. STUB_PATTERNS: ✅ none found.",
  why: "Captures verification outcome for future reference and debugging",
  file_refs: [
    "src/api/auth.ts:15-45",
    "pages/register.tsx:78-92"
  ],
  edges: [
    {
      to: "verification-pattern:api-route-substantive",
      relation: "implements",
      description: "Passes substantive verification pattern"
    },
    {
      to: "verification-pattern:wiring-component-api",
      relation: "implements",
      description: "Passes wiring verification to frontend"
    },
    {
      to: artifactId,
      relation: "connects_to",
      description: "Verifies this artifact"
    }
  ],
  created_by_task: "verification:check-auth-endpoint"
});
```

### 4. Record Wiring Connection

When verifying that components communicate, create wiring concepts:

```typescript
const wiringId = await megamemory.create_concept({
  name: "wiring:register-page-auth-api",
  kind: "pattern",
  summary: "Connection from pages/register.tsx to src/api/auth.ts. Component calls fetch('/api/auth/register') on form submit, awaits response, stores JWT in localStorage, redirects on success.",
  why: "Critical user flow - registration form to backend authentication",
  file_refs: [
    "pages/register.tsx:78-92",
    "src/api/auth.ts:15-45"
  ],
  edges: [
    {
      to: "artifact:page-register",
      relation: "connects_to",
      description: "Source: registration page component"
    },
    {
      to: "artifact:api-auth-register",
      relation: "connects_to",
      description: "Target: auth API endpoint"
    },
    {
      to: "verification-pattern:wiring-component-api",
      relation: "implements",
      description: "Follows correct wiring pattern"
    }
  ]
});
```

### 5. Record Stub Detection

When stubs are found, record them for resolution:

```typescript
const stubId = await megamemory.create_concept({
  name: "stub:detect-message-api",
  kind: "decision",
  summary: "Stub detected in src/api/messages.ts: Returns static array instead of database query. Pattern: 'return Response.json([])' with no prisma.message.findMany(). Needs implementation.",
  why: "Placeholder code that blocks message functionality",
  file_refs: [
    "src/api/messages.ts:5-15"
  ],
  edges: [
    {
      to: "verification-pattern:api-route-stub",
      relation: "implements",
      description: "Matches stub detection pattern"
    },
    {
      to: "artifact:api-messages",
      relation: "depends_on",
      description: "Blocks message feature completion"
    }
  ]
});
```

### 6. Update Concept After Fix

When fixing a stub or verification issue:

```typescript
await megamemory.update_concept({
  id: stubId,
  changes: {
    summary: "RESOLVED: src/api/messages.ts now implements full database query. Uses prisma.message.findMany with orderBy, includes userId filter, returns actual messages."
  }
});

await megamemory.update_concept({
  id: resultId,
  changes: {
    summary: "Verification of artifact:api-messages. EXISTS: ✅. SUBSTANTIVE: ✅ implements prisma.message.findMany with filters. WIRED: ✅ called by messages/page.tsx. STUB_PATTERNS: ✅ resolved (was static array, now DB query)."
  }
});
```

### 7. Query Failed Verifications

Find all failed verifications for debugging:

```typescript
const failures = await megamemory.understand({
  query: "verification failed stub detected placeholder not implemented"
});

const stubs = await megamemory.understand({
  query: "stub detection API component missing implementation"
});
```

### 8. Query Artifact Context

Before working on an artifact, query its verification history:

```typescript
const artifactHistory = await megamemory.understand({
  query: "artifact:api-auth-register verification result wiring"
});

// Returns:
// - The artifact concept
// - Verification results (successes/failures)
// - Wiring connections (what connects to/from this artifact)
// - Related patterns applied
```

</megamemory_operations>

<megamemory_examples>

## Complete Verification Workflow Example

### Example 1: React Component Verification

```typescript
// Step 1: Query relevant patterns
const patterns = await megamemory.understand({
  query: "React component verification stub detection"
});

// Step 2: Run programmatic checks
const componentPath = "src/components/ChatMessage.tsx";
const exists = checkExists(componentPath);
const hasJsx = grepReturnJsx(componentPath);
const noPlaceholders = !grepStubPatterns(componentPath);
const usesProps = grepUsesPropsOrState(componentPath);

// Step 3: Create artifact concept
const artifactId = await megamemory.create_concept({
  name: "artifact:component-chat-message",
  kind: "component",
  summary: "ChatMessage component in src/components/ChatMessage.tsx:1-50. Renders message with sender info, timestamp, and formatting. Accepts message prop, handles own/user styles, supports markdown rendering.",
  why: "Core UI component for displaying chat messages",
  file_refs: ["src/components/ChatMessage.tsx:1-50"],
  edges: [{
    to: "feature:chat-interface",
    relation: "implements",
    description: "Renders individual chat messages"
  }]
});

// Step 4: Record verification result
const resultId = await megamemory.create_concept({
  name: `verification-result:${artifactId}`,
  kind: "config",
  summary: `Verification of ${artifactId}. EXISTS: ✅ file present. SUBSTANTIVE: ✅ 50 lines, returns JSX with conditional rendering, uses props.message. WIRED: ✅ imported by ChatList.tsx. STUB_PATTERNS: ✅ none. PLACEHOLDERS: ✅ none.`,
  why: "Confirms ChatMessage is fully implemented",
  file_refs: ["src/components/ChatMessage.tsx:1-50"],
  edges: [
    { to: "verification-pattern:react-component-substantive", relation: "implements", description: "Passes all checks" },
    { to: artifactId, relation: "connects_to", description: "Verifies this component" }
  ]
});
```

### Example 2: API Route Verification with Stub Detection

```typescript
// Verification that finds a stub
const componentPath = "src/api/messages.ts";
const exists = checkExists(componentPath);
const hasDbQuery = grepPrismaCalls(componentPath);
const lines = wcLines(componentPath);
const notImplemented = grepNotImplemented(componentPath);

// Create artifact
const artifactId = await megamemory.create_concept({
  name: "artifact:api-messages",
  kind: "component",
  summary: "GET /api/messages endpoint in src/api/messages.ts. Currently returns static empty array. Needs database query implementation.",
  why: "Required for fetching chat messages",
  file_refs: ["src/api/messages.ts:1-15"]
});

// Record stub detection
const stubId = await megamemory.create_concept({
  name: "stub:detect-messages-api",
  kind: "decision",
  summary: `Stub detected in ${componentPath}. Lines: ${lines}. Has prisma query: ${hasDbQuery ? '✅' : '❌'}. 'not implemented' present: ${notImplemented ? '✅' : '❌'}. Issue: Returns Response.json([]) without database call.`,
  why: "Placeholder blocking message fetching",
  file_refs: ["src/api/messages.ts:1-15"],
  edges: [
    { to: "verification-pattern:api-route-stub", relation: "implements", description: "Matches stub pattern" },
    { to: artifactId, relation: "depends_on", description: "Needs real implementation" }
  ]
});

// Later, after fixing:
await megamemory.update_concept({
  id: stubId,
  changes: {
    summary: `RESOLVED: ${componentPath} now implements prisma.message.findMany with userId filter and orderBy timestamp DESC. Returns 50 messages paginated. No stub patterns detected.`
  }
});

await megamemory.create_concept({
  name: `verification-result:${artifactId}-fixed`,
  kind: "config",
  summary: `Verification of ${artifactId} after fix. EXISTS: ✅. SUBSTANTIVE: ✅ 35 lines, includes database query, error handling, pagination. WIRED: ✅ called by messages/page.tsx. STUB_PATTERNS: ✅ resolved.`,
  why: "Confirms messages API is now functional",
  file_refs: ["src/api/messages.ts:1-35"],
  edges: [
    { to: "verification-pattern:api-route-substantive", relation: "implements", description: "Passes all checks" },
    { to: artifactId, relation: "connects_to", description: "Verifies fixed implementation" }
  ]
});
```

### Example 3: Wiring Verification (Component → API)

```typescript
// Verify component actually calls API
const componentPath = "src/components/MessageForm.tsx";
const apiPath = "/api/messages";
const hasFetch = grepFetchCall(componentPath, apiPath);
const usesResponse = grepUsesResponse(componentPath);

// Create component artifact
const componentArtifact = await megamemory.create_concept({
  name: "artifact:component-message-form",
  kind: "component",
  summary: "MessageForm component in src/components/MessageForm.tsx:1-80. Form for sending chat messages. Has input field, submit button, calls POST /api/messages, clears input on success, shows error on failure.",
  why: "Primary user action for chat",
  file_refs: ["src/components/MessageForm.tsx:1-80"]
});

// Create API artifact
const apiArtifact = await megamemory.create_concept({
  name: "artifact:api-messages-post",
  kind: "component",
  summary: "POST /api/messages endpoint in src/api/messages.ts:40-75. Creates new message with userId and content, validates input, returns created message with timestamp.",
  why: "Backend endpoint for message creation",
  file_refs: ["src/api/messages.ts:40-75"]
});

// Record wiring
const wiringId = await megamemory.create_concept({
  name: "wiring:message-form-messages-api",
  kind: "pattern",
  summary: `Connection from ${componentPath} to POST ${apiPath}. onSubmit handler: fetch('${apiPath}', { method: 'POST', body: JSON.stringify({ content }) }). Awaits response, checks response.ok, calls setMessages(prev => [...prev, data]), clears input. Error: catches and displays alert.`,
  why: "Core user action - sending a message",
  file_refs: ["src/components/MessageForm.tsx:45-65", "src/api/messages.ts:40-75"],
  edges: [
    { to: "artifact:component-message-form", relation: "connects_to", description: "Source component" },
    { to: "artifact:api-messages-post", relation: "connects_to", description: "Target API" },
    { to: "verification-pattern:wiring-component-api", relation: "implements", description: "Properly wired" }
  ]
});

// Record verification
await megamemory.create_concept({
  name: "verification-result:wiring-message-form",
  kind: "config",
  summary: `Wiring verification: component → API. EXISTS: ✅ fetch('${apiPath}') present. SUBSTANTIVE: ✅ awaited, response used (setMessages), error handled. WIRED: ✅ correct endpoint, method POST, body formatted. STUB_PATTERNS: ✅ none. Component properly calls API and uses response.`,
  why: "Confirms form-to-API wiring works",
  file_refs: ["src/components/MessageForm.tsx:45-65"],
  edges: [
    { to: "verification-pattern:wiring-component-api", relation: "implements", description: "Passes wiring verification" },
    { to: wiringId, relation: "connects_to", description: "Verifies this wiring" }
  ]
});
```

### Example 4: Query Before Development

```typescript
// Before implementing a new feature, query existing patterns and artifacts
const context = await megamemory.understand({
  query: "verification patterns API routes database schema wiring"
});

// This returns:
// - Existing API route patterns (what to follow)
// - Previously verified artifacts (what's already done)
// - Wiring patterns (how to connect components)
// - Stub detections (what still needs fixing)

console.log("Following these patterns:", context.filter(c => c.kind === "pattern"));
console.log("Already implemented:", context.filter(c => c.kind === "component"));
console.log("Fix needed for:", context.filter(c => c.kind === "decision" && c.name.startsWith("stub")));
```

### Example 5: Handoff Verification Summary

```typescript
// When handing off, query all verification results for summary
const allVerifications = await megamemory.understand({
  query: "verification-result artifact completed"
});

const summary = {
  total: allVerifications.length,
  passed: allVerifications.filter(v => v.summary.includes("✅") && !v.summary.includes("❌")).length,
  failed: allVerifications.filter(v => v.summary.includes("❌") || v.name.startsWith("stub")).length,
  byType: {
    component: allVerifications.filter(v => v.summary.includes("component")).length,
    api: allVerifications.filter(v => v.summary.includes("api") && !v.summary.includes("component")).length,
    schema: allVerifications.filter(v => v.summary.includes("schema") || v.summary.includes("prisma")).length
  }
};

console.log("Verification Summary:", summary);
// Output: { total: 15, passed: 12, failed: 3, byType: { component: 8, api: 5, schema: 2 } }
```

</megamemory_examples>

<stub_detection>

## Universal Stub Patterns

These patterns indicate placeholder code regardless of file type:

**Comment-based stubs:**
```bash
# grep patterns for stub comments
grep -E "(TODO|FIXME|XXX|HACK|PLACEHOLDER)" "$file"
grep -E "implement|add later|coming soon|will be" "$file" -i
grep -E "// \.\.\.|/\* \.\.\. \*/|# \.\.\." "$file"
```

**Placeholder text in output:**
```bash
# UI placeholder patterns
grep -E "placeholder|lorem ipsum|coming soon|under construction" "$file" -i
grep -E "sample|example|test data|dummy" "$file" -i
grep -E "\[.*\]|<.*>|\{.*\}" "$file"  # Template brackets left in
```

**Empty or trivial implementations:**
```bash
# Functions that do nothing
grep -E "return null|return undefined|return \{\}|return \[\]" "$file"
grep -E "pass$|\.\.\.|\bnothing\b" "$file"
grep -E "console\.(log|warn|error).*only" "$file"  # Log-only functions
```

**Hardcoded values where dynamic expected:**
```bash
# Hardcoded IDs, counts, or content
grep -E "id.*=.*['\"].*['\"]" "$file"  # Hardcoded string IDs
grep -E "count.*=.*\d+|length.*=.*\d+" "$file"  # Hardcoded counts
grep -E "\\\$\d+\.\d{2}|\d+ items" "$file"  # Hardcoded display values
```

</stub_detection>

<react_components>

## React/Next.js Components

**Existence check:**
```bash
# File exists and exports component
[ -f "$component_path" ] && grep -E "export (default |)function|export const.*=.*\(" "$component_path"
```

**Substantive check:**
```bash
# Returns actual JSX, not placeholder
grep -E "return.*<" "$component_path" | grep -v "return.*null" | grep -v "placeholder" -i

# Has meaningful content (not just wrapper div)
grep -E "<[A-Z][a-zA-Z]+|className=|onClick=|onChange=" "$component_path"

# Uses props or state (not static)
grep -E "props\.|useState|useEffect|useContext|\{.*\}" "$component_path"
```

**Stub patterns specific to React:**
```javascript
// RED FLAGS - These are stubs:
return <div>Component</div>
return <div>Placeholder</div>
return <div>{/* TODO */}</div>
return <p>Coming soon</p>
return null
return <></>

// Also stubs - empty handlers:
onClick={() => {}}
onChange={() => console.log('clicked')}
onSubmit={(e) => e.preventDefault()}  // Only prevents default, does nothing
```

**Wiring check:**
```bash
# Component imports what it needs
grep -E "^import.*from" "$component_path"

# Props are actually used (not just received)
# Look for destructuring or props.X usage
grep -E "\{ .* \}.*props|\bprops\.[a-zA-Z]+" "$component_path"

# API calls exist (for data-fetching components)
grep -E "fetch\(|axios\.|useSWR|useQuery|getServerSideProps|getStaticProps" "$component_path"
```

**Functional verification (human required):**
- Does the component render visible content?
- Do interactive elements respond to clicks?
- Does data load and display?
- Do error states show appropriately?

</react_components>

<api_routes>

## API Routes (Next.js App Router / Express / etc.)

**Existence check:**
```bash
# Route file exists
[ -f "$route_path" ]

# Exports HTTP method handlers (Next.js App Router)
grep -E "export (async )?(function|const) (GET|POST|PUT|PATCH|DELETE)" "$route_path"

# Or Express-style handlers
grep -E "\.(get|post|put|patch|delete)\(" "$route_path"
```

**Substantive check:**
```bash
# Has actual logic, not just return statement
wc -l "$route_path"  # More than 10-15 lines suggests real implementation

# Interacts with data source
grep -E "prisma\.|db\.|mongoose\.|sql|query|find|create|update|delete" "$route_path" -i

# Has error handling
grep -E "try|catch|throw|error|Error" "$route_path"

# Returns meaningful response
grep -E "Response\.json|res\.json|res\.send|return.*\{" "$route_path" | grep -v "message.*not implemented" -i
```

**Stub patterns specific to API routes:**
```typescript
// RED FLAGS - These are stubs:
export async function POST() {
  return Response.json({ message: "Not implemented" })
}

export async function GET() {
  return Response.json([])  // Empty array with no DB query
}

export async function PUT() {
  return new Response()  // Empty response
}

// Console log only:
export async function POST(req) {
  console.log(await req.json())
  return Response.json({ ok: true })
}
```

**Wiring check:**
```bash
# Imports database/service clients
grep -E "^import.*prisma|^import.*db|^import.*client" "$route_path"

# Actually uses request body (for POST/PUT)
grep -E "req\.json\(\)|req\.body|request\.json\(\)" "$route_path"

# Validates input (not just trusting request)
grep -E "schema\.parse|validate|zod|yup|joi" "$route_path"
```

**Functional verification (human or automated):**
- Does GET return real data from database?
- Does POST actually create a record?
- Does error response have correct status code?
- Are auth checks actually enforced?

</api_routes>

<database_schema>

## Database Schema (Prisma / Drizzle / SQL)

**Existence check:**
```bash
# Schema file exists
[ -f "prisma/schema.prisma" ] || [ -f "drizzle/schema.ts" ] || [ -f "src/db/schema.sql" ]

# Model/table is defined
grep -E "^model $model_name|CREATE TABLE $table_name|export const $table_name" "$schema_path"
```

**Substantive check:**
```bash
# Has expected fields (not just id)
grep -A 20 "model $model_name" "$schema_path" | grep -E "^\s+\w+\s+\w+"

# Has relationships if expected
grep -E "@relation|REFERENCES|FOREIGN KEY" "$schema_path"

# Has appropriate field types (not all String)
grep -A 20 "model $model_name" "$schema_path" | grep -E "Int|DateTime|Boolean|Float|Decimal|Json"
```

**Stub patterns specific to schemas:**
```prisma
// RED FLAGS - These are stubs:
model User {
  id String @id
  // TODO: add fields
}

model Message {
  id        String @id
  content   String  // Only one real field
}

// Missing critical fields:
model Order {
  id     String @id
  // No: userId, items, total, status, createdAt
}
```

**Wiring check:**
```bash
# Migrations exist and are applied
ls prisma/migrations/ 2>/dev/null | wc -l  # Should be > 0
npx prisma migrate status 2>/dev/null | grep -v "pending"

# Client is generated
[ -d "node_modules/.prisma/client" ]
```

**Functional verification:**
```bash
# Can query the table (automated)
npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM $table_name"
```

</database_schema>

<hooks_utilities>

## Custom Hooks and Utilities

**Existence check:**
```bash
# File exists and exports function
[ -f "$hook_path" ] && grep -E "export (default )?(function|const)" "$hook_path"
```

**Substantive check:**
```bash
# Hook uses React hooks (for custom hooks)
grep -E "useState|useEffect|useCallback|useMemo|useRef|useContext" "$hook_path"

# Has meaningful return value
grep -E "return \{|return \[" "$hook_path"

# More than trivial length
[ $(wc -l < "$hook_path") -gt 10 ]
```

**Stub patterns specific to hooks:**
```typescript
// RED FLAGS - These are stubs:
export function useAuth() {
  return { user: null, login: () => {}, logout: () => {} }
}

export function useCart() {
  const [items, setItems] = useState([])
  return { items, addItem: () => console.log('add'), removeItem: () => {} }
}

// Hardcoded return:
export function useUser() {
  return { name: "Test User", email: "test@example.com" }
}
```

**Wiring check:**
```bash
# Hook is actually imported somewhere
grep -r "import.*$hook_name" src/ --include="*.tsx" --include="*.ts" | grep -v "$hook_path"

# Hook is actually called
grep -r "$hook_name()" src/ --include="*.tsx" --include="*.ts" | grep -v "$hook_path"
```

</hooks_utilities>

<environment_config>

## Environment Variables and Configuration

**Existence check:**
```bash
# .env file exists
[ -f ".env" ] || [ -f ".env.local" ]

# Required variable is defined
grep -E "^$VAR_NAME=" .env .env.local 2>/dev/null
```

**Substantive check:**
```bash
# Variable has actual value (not placeholder)
grep -E "^$VAR_NAME=.+" .env .env.local 2>/dev/null | grep -v "your-.*-here|xxx|placeholder|TODO" -i

# Value looks valid for type:
# - URLs should start with http
# - Keys should be long enough
# - Booleans should be true/false
```

**Stub patterns specific to env:**
```bash
# RED FLAGS - These are stubs:
DATABASE_URL=your-database-url-here
STRIPE_SECRET_KEY=sk_test_xxx
API_KEY=placeholder
NEXT_PUBLIC_API_URL=http://localhost:3000  # Still pointing to localhost in prod
```

**Wiring check:**
```bash
# Variable is actually used in code
grep -r "process\.env\.$VAR_NAME|env\.$VAR_NAME" src/ --include="*.ts" --include="*.tsx"

# Variable is in validation schema (if using zod/etc for env)
grep -E "$VAR_NAME" src/env.ts src/env.mjs 2>/dev/null
```

</environment_config>

<wiring_verification>

## Wiring Verification Patterns

Wiring verification checks that components actually communicate. This is where most stubs hide.

### Pattern: Component → API

**Check:** Does the component actually call the API?

```bash
# Find the fetch/axios call
grep -E "fetch\(['\"].*$api_path|axios\.(get|post).*$api_path" "$component_path"

# Verify it's not commented out
grep -E "fetch\(|axios\." "$component_path" | grep -v "^.*//.*fetch"

# Check the response is used
grep -E "await.*fetch|\.then\(|setData|setState" "$component_path"
```

**Red flags:**
```typescript
// Fetch exists but response ignored:
fetch('/api/messages')  // No await, no .then, no assignment

// Fetch in comment:
// fetch('/api/messages').then(r => r.json()).then(setMessages)

// Fetch to wrong endpoint:
fetch('/api/message')  // Typo - should be /api/messages
```

### Pattern: API → Database

**Check:** Does the API route actually query the database?

```bash
# Find the database call
grep -E "prisma\.$model|db\.query|Model\.find" "$route_path"

# Verify it's awaited
grep -E "await.*prisma|await.*db\." "$route_path"

# Check result is returned
grep -E "return.*json.*data|res\.json.*result" "$route_path"
```

**Red flags:**
```typescript
// Query exists but result not returned:
await prisma.message.findMany()
return Response.json({ ok: true })  // Returns static, not query result

// Query not awaited:
const messages = prisma.message.findMany()  // Missing await
return Response.json(messages)  // Returns Promise, not data
```

### Pattern: Form → Handler

**Check:** Does the form submission actually do something?

```bash
# Find onSubmit handler
grep -E "onSubmit=\{|handleSubmit" "$component_path"

# Check handler has content
grep -A 10 "onSubmit.*=" "$component_path" | grep -E "fetch|axios|mutate|dispatch"

# Verify not just preventDefault
grep -A 5 "onSubmit" "$component_path" | grep -v "only.*preventDefault" -i
```

**Red flags:**
```typescript
// Handler only prevents default:
onSubmit={(e) => e.preventDefault()}

// Handler only logs:
const handleSubmit = (data) => {
  console.log(data)
}

// Handler is empty:
onSubmit={() => {}}
```

### Pattern: State → Render

**Check:** Does the component render state, not hardcoded content?

```bash
# Find state usage in JSX
grep -E "\{.*messages.*\}|\{.*data.*\}|\{.*items.*\}" "$component_path"

# Check map/render of state
grep -E "\.map\(|\.filter\(|\.reduce\(" "$component_path"

# Verify dynamic content
grep -E "\{[a-zA-Z_]+\." "$component_path"  # Variable interpolation
```

**Red flags:**
```tsx
// Hardcoded instead of state:
return <div>
  <p>Message 1</p>
  <p>Message 2</p>
</div>

// State exists but not rendered:
const [messages, setMessages] = useState([])
return <div>No messages</div>  // Always shows "no messages"

// Wrong state rendered:
const [messages, setMessages] = useState([])
return <div>{otherData.map(...)}</div>  // Uses different data
```

</wiring_verification>

<verification_checklist>

## Quick Verification Checklist

For each artifact type, run through this checklist:

### Component Checklist
- [ ] File exists at expected path
- [ ] Exports a function/const component
- [ ] Returns JSX (not null/empty)
- [ ] No placeholder text in render
- [ ] Uses props or state (not static)
- [ ] Event handlers have real implementations
- [ ] Imports resolve correctly
- [ ] Used somewhere in the app

### API Route Checklist
- [ ] File exists at expected path
- [ ] Exports HTTP method handlers
- [ ] Handlers have more than 5 lines
- [ ] Queries database or service
- [ ] Returns meaningful response (not empty/placeholder)
- [ ] Has error handling
- [ ] Validates input
- [ ] Called from frontend

### Schema Checklist
- [ ] Model/table defined
- [ ] Has all expected fields
- [ ] Fields have appropriate types
- [ ] Relationships defined if needed
- [ ] Migrations exist and applied
- [ ] Client generated

### Hook/Utility Checklist
- [ ] File exists at expected path
- [ ] Exports function
- [ ] Has meaningful implementation (not empty returns)
- [ ] Used somewhere in the app
- [ ] Return values consumed

### Wiring Checklist
- [ ] Component → API: fetch/axios call exists and uses response
- [ ] API → Database: query exists and result returned
- [ ] Form → Handler: onSubmit calls API/mutation
- [ ] State → Render: state variables appear in JSX

</verification_checklist>

<automated_verification_script>

## Automated Verification Approach

For the verification subagent, use this pattern:

```bash
# 1. Check existence
check_exists() {
  [ -f "$1" ] && echo "EXISTS: $1" || echo "MISSING: $1"
}

# 2. Check for stub patterns
check_stubs() {
  local file="$1"
  local stubs=$(grep -c -E "TODO|FIXME|placeholder|not implemented" "$file" 2>/dev/null || echo 0)
  [ "$stubs" -gt 0 ] && echo "STUB_PATTERNS: $stubs in $file"
}

# 3. Check wiring (component calls API)
check_wiring() {
  local component="$1"
  local api_path="$2"
  grep -q "$api_path" "$component" && echo "WIRED: $component → $api_path" || echo "NOT_WIRED: $component → $api_path"
}

# 4. Check substantive (more than N lines, has expected patterns)
check_substantive() {
  local file="$1"
  local min_lines="$2"
  local pattern="$3"
  local lines=$(wc -l < "$file" 2>/dev/null || echo 0)
  local has_pattern=$(grep -c -E "$pattern" "$file" 2>/dev/null || echo 0)
  [ "$lines" -ge "$min_lines" ] && [ "$has_pattern" -gt 0 ] && echo "SUBSTANTIVE: $file" || echo "THIN: $file ($lines lines, $has_pattern matches)"
}
```

Run these checks against each must-have artifact. Aggregate results into VERIFICATION.md.

</automated_verification_script>

<human_verification_triggers>

## When to Require Human Verification

Some things can't be verified programmatically. Flag these for human testing:

**Always human:**
- Visual appearance (does it look right?)
- User flow completion (can you actually do the thing?)
- Real-time behavior (WebSocket, SSE)
- External service integration (Stripe, email sending)
- Error message clarity (is the message helpful?)
- Performance feel (does it feel fast?)

**Human if uncertain:**
- Complex wiring that grep can't trace
- Dynamic behavior depending on state
- Edge cases and error states
- Mobile responsiveness
- Accessibility

**Format for human verification request:**
```markdown
## Human Verification Required

### 1. Chat message sending
**Test:** Type a message and click Send
**Expected:** Message appears in list, input clears
**Check:** Does message persist after refresh?

### 2. Error handling
**Test:** Disconnect network, try to send
**Expected:** Error message appears, message not lost
**Check:** Can retry after reconnect?
```

</human_verification_triggers>

<checkpoint_automation_reference>

## Pre-Checkpoint Automation

For automation-first checkpoint patterns, server lifecycle management, CLI installation handling, and error recovery protocols, see:

**@~/.config/opencode/get-shit-done/references/checkpoints.md** → `<automation_reference>` section

Key principles:
- OpenCode sets up verification environment BEFORE presenting checkpoints
- Users never run CLI commands (visit URLs only)
- Server lifecycle: start before checkpoint, handle port conflicts, keep running for duration
- CLI installation: auto-install where safe, checkpoint for user choice otherwise
- Error handling: fix broken environment before checkpoint, never present checkpoint with failed setup

</checkpoint_automation_reference>
