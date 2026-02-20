## MegaMemory Initiative Exists Preflight Check

For all commands that require an existing initiative (25 commands total).

**Purpose:** Verify MCP server is running AND database has initiative data.

**Step 1:** Call `megamemory:list_roots()` to confirm connectivity and check for data.

**Two types of errors to check:**

1. **Tool call itself fails** (MCP server not running):
   - The tool call doesn't complete or returns a connection error
   - This means the MCP server is not responding

2. **Tool result contains `MEGAMEMORY_ERROR:`** (server/database error):
   - Tool call completes but returns `"MEGAMEMORY_ERROR: ..."`
   - This means server encountered an error

**Success criteria:**
- If `roots` is empty:
   → Display: "No initiative found. Run fuska init first"
   → Stop execution
- If `roots` has content → Proceed to Step 2

**When tool call fails or `MEGAMEMORY_ERROR:` is detected:**

→ Display:

    MegaMemory MCP server is not responding.

    To fix:
    1. Ensure MegaMemory is installed (npm install megamemory)
    2. Check your MCP server configuration points to megamemory executable
    3. Restart your editor/OpenCode to start the MCP server

→ Stop — do not proceed with any megamemory tool calls.

---

**Step 2:** Validate initiative configuration integrity

After calling `megamemory:list_roots()`:

1. Query the config concept:
   ```
   megamemory_understand(query="config", top_k=1, kind="config")
   ```

2. Extract `current_initiative` from config

3. Query for state with the current initiative:
   ```
   megamemory_understand(query="state", top_k=5)
   ```

4. Check if any state's `parent_id` matches `current_initiative`

5. If mismatch detected:
   → Display:

       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        ⚠️  INITIATIVE CONFIGURATION ISSUE
       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

       The current initiative pointer doesn't match any existing
       initiative in MegaMemory.

       Run `fuska config` to fix this issue.

       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   → Stop — do not proceed
