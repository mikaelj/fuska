# Verification Patterns

How to verify artifacts are real implementations, not stubs or placeholders.

<core_principle>
**Existence ≠ Implementation**

Verification must check 4 levels:
1. **Exists** - File is present at expected path
2. **Substantive** - Content is real implementation, not placeholder
3. **Wired** - Connected to the rest of the system
4. **Functional** - Actually works when invoked

Levels 1-3 can be checked programmatically. Level 4 often requires human verification.
</core_principle>

<stub_detection>

## Universal Stub Patterns

These patterns indicate placeholder code regardless of file type:

```bash
# Comment-based stubs
grep -E "(TODO|FIXME|XXX|HACK|PLACEHOLDER)" "$file"
grep -E "implement|add later|coming soon|will be" "$file" -i
grep -E "// \.\.\.|/\* \.\.\. \*/|# \.\.\." "$file"

# Placeholder text in output
grep -E "placeholder|lorem ipsum|coming soon|under construction" "$file" -i
grep -E "sample|example|test data|dummy" "$file" -i

# Empty or trivial implementations
grep -E "return null|return undefined|return \{\}|return \[\]" "$file"
grep -E "pass$|\.\.\.|\bnothing\b" "$file"
grep -E "console\.(log|warn|error).*only" "$file"

# Hardcoded values where dynamic expected
grep -E "id.*=.*['\"].*['\"]" "$file"     # Hardcoded string IDs
grep -E "\\\$\d+\.\d{2}|\d+ items" "$file"  # Hardcoded display values
```

</stub_detection>

<artifact_verification>

## React/Next.js Components

| Check | Command/Pattern |
|-------|----------------|
| Exists | `[ -f "$path" ] && grep -E "export (default )?function\|export const.*=.*\(" "$path"` |
| Substantive | Returns actual JSX (not null/empty), has `className=`, `onClick=`, uses `props.` or `useState` |
| Wired | Imports resolve, component is imported elsewhere, API calls exist for data-fetching components |
| Functional | Renders visible content, interactive elements respond, data loads and displays |

**Stub red flags:**
```typescript
return <div>Component</div>      // Placeholder text
return <div>{/* TODO */}</div>    // Empty with TODO
return null                      // Returns nothing
onClick={() => {}}               // Empty handler
onSubmit={(e) => e.preventDefault()}  // Only prevents default
```

## API Routes

| Check | Command/Pattern |
|-------|----------------|
| Exists | `grep -E "export (async )?function (GET\|POST\|PUT\|DELETE)" "$path"` |
| Substantive | >10 lines, queries database (`prisma.`/`db.`), has error handling, returns meaningful response |
| Wired | Imports database client, uses request body, validates input (`zod`/`yup`) |
| Functional | GET returns real data, POST creates records, correct status codes, auth enforced |

**Stub red flags:**
```typescript
return Response.json({ message: "Not implemented" })  // Placeholder
return Response.json([])  // Empty array, no DB query
console.log(await req.json()); return Response.json({ ok: true })  // Log-only
```

## Database Schema (Prisma / Drizzle / SQL)

| Check | Command/Pattern |
|-------|----------------|
| Exists | `grep -E "^model $model_name" "$schema_path"` |
| Substantive | Has all expected fields, relationships defined, appropriate types (not all String) |
| Wired | Migrations exist and applied, client generated (`node_modules/.prisma/client`) |
| Functional | `npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM $table_name"` |

**Stub red flags:**
```prisma
model User {
  id String @id
  // TODO: add fields        // Only has id
}
model Order {
  id String @id
  // No: userId, items, total, status, createdAt
}
```

## Custom Hooks and Utilities

| Check | Command/Pattern |
|-------|----------------|
| Exists | `[ -f "$path" ] && grep -E "export (default )?function" "$path"` |
| Substantive | Uses React hooks (`useState`, `useEffect`), meaningful return value, >10 lines |
| Wired | Imported somewhere (`grep -r "import.*$hook_name" src/`), actually called |
| Functional | Return values consumed by calling component |

**Stub red flags:**
```typescript
export function useAuth() {
  return { user: null, login: () => {}, logout: () => {} }  // All no-ops
}
export function useUser() {
  return { name: "Test User", email: "test@example.com" }  // Hardcoded
}
```

## Environment Variables

| Check | Command/Pattern |
|-------|----------------|
| Exists | `grep -E "^$VAR_NAME=" .env .env.local 2>/dev/null` |
| Substantive | Has actual value (not `your-*-here`, `xxx`, `placeholder`, `TODO`) |
| Wired | Used in code (`grep -r "process\.env\.$VAR_NAME" src/`), in validation schema if exists |

**Stub red flags:**
```bash
DATABASE_URL=your-database-url-here
STRIPE_SECRET_KEY=sk_test_xxx
API_KEY=placeholder
```

</artifact_verification>

<wiring_verification>

## Wiring Verification Patterns

Wiring checks that components actually communicate. This is where most stubs hide.

### Component → API

```bash
grep -E "fetch\(['\"].*$api_path|axios\.(get|post).*$api_path" "$component_path"
# Verify response is used (not fire-and-forget)
grep -E "await.*fetch|\.then\(|setData|setState" "$component_path"
```

**Red flags:** Fetch exists but response ignored, fetch in comment, fetch to wrong endpoint (typo).

### API → Database

```bash
grep -E "await.*prisma\.$model|await.*db\." "$route_path"
# Verify result is returned (not static response after query)
```

**Red flags:** Query result not returned (`return Response.json({ ok: true })` instead of data), query not awaited.

### Form → Handler

```bash
grep -A 10 "onSubmit.*=" "$component_path" | grep -E "fetch|axios|mutate|dispatch"
```

**Red flags:** Handler only prevents default, handler only logs, handler is empty `() => {}`.

### State → Render

```bash
grep -E "\.map\(|\.filter\(" "$component_path"    # State iterated in JSX
grep -E "\{[a-zA-Z_]+\." "$component_path"         # Variable interpolation
```

**Red flags:** Hardcoded list items instead of `.map()`, state exists but not rendered, wrong state variable rendered.

</wiring_verification>

<verification_checklist>

## Quick Verification Checklists

### Component
- [ ] File exists, exports component
- [ ] Returns JSX (not null/empty), no placeholder text
- [ ] Uses props or state (not static)
- [ ] Event handlers have real implementations
- [ ] Used somewhere in the app

### API Route
- [ ] Exports HTTP method handlers, >5 lines
- [ ] Queries database or service
- [ ] Returns meaningful response, has error handling
- [ ] Validates input, called from frontend

### Schema
- [ ] Model defined with all expected fields and types
- [ ] Relationships defined, migrations applied, client generated

### Hook/Utility
- [ ] Exports function with meaningful implementation
- [ ] Used and called somewhere, return values consumed

### Wiring
- [ ] Component → API: fetch call exists and uses response
- [ ] API → Database: query exists and result returned
- [ ] Form → Handler: onSubmit calls API/mutation
- [ ] State → Render: state variables appear in JSX

</verification_checklist>

<automated_verification_script>

## Automated Verification Functions

```bash
check_exists() {
  [ -f "$1" ] && echo "EXISTS: $1" || echo "MISSING: $1"
}

check_stubs() {
  local stubs=$(grep -c -E "TODO|FIXME|placeholder|not implemented" "$1" 2>/dev/null || echo 0)
  [ "$stubs" -gt 0 ] && echo "STUB_PATTERNS: $stubs in $1"
}

check_wiring() {
  grep -q "$2" "$1" && echo "WIRED: $1 → $2" || echo "NOT_WIRED: $1 → $2"
}

check_substantive() {
  local lines=$(wc -l < "$1" 2>/dev/null || echo 0)
  local has_pattern=$(grep -c -E "$3" "$1" 2>/dev/null || echo 0)
  [ "$lines" -ge "$2" ] && [ "$has_pattern" -gt 0 ] && echo "SUBSTANTIVE: $1" || echo "THIN: $1 ($lines lines, $has_pattern matches)"
}
```

Run against each must-have artifact. Aggregate results.

</automated_verification_script>

<human_verification_triggers>

## When to Require Human Verification

**Always human:** Visual appearance, user flow completion, real-time behavior (WebSocket/SSE), external service integration, error message clarity, performance feel.

**Human if uncertain:** Complex wiring that grep can't trace, dynamic state-dependent behavior, edge cases/error states, mobile responsiveness, accessibility.

**Format:**
```markdown
## Human Verification Required

### 1. Chat message sending
**Test:** Type a message and click Send
**Expected:** Message appears in list, input clears
**Check:** Does message persist after refresh?
```

</human_verification_triggers>

<checkpoint_automation_reference>

For pre-checkpoint automation (server lifecycle, CLI installation, error recovery), see **@./checkpoints.md** → `<automation_reference>` section.

</checkpoint_automation_reference>
