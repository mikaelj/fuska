## MegaMemory Connectivity Preflight Check

For commands that create the database (/mm-new-project, /mm-map-codebase).

**Purpose:** Verify MCP server is running (empty database is OK).

**Step 1:** Call `megamemory:list_roots()` to confirm connectivity.

**Two types of errors to check:**

1. **Tool call itself fails** (MCP server not running):
   - The tool call doesn't complete or returns a connection error
   - This means the MCP server is not responding

2. **Tool result contains `MEGAMEMORY_ERROR:`** (server/database error):
   - Tool call completes but returns `"MEGAMEMORY_ERROR: ..."`
   - This means server encountered an error

**Success criteria:**
- Empty or populated `roots` array → MCP server is running, proceed
- These commands will create initial concepts if database is empty

**When tool call fails or `MEGAMEMORY_ERROR:` is detected:**

→ Display:

    MegaMemory MCP server is not responding.

    To fix:
    1. Ensure MegaMemory is installed (npm install megamemory)
    2. Check your MCP server configuration points to megamemory executable
    3. Restart your editor/OpenCode to start the MCP server

→ Stop — do not proceed with any megamemory tool calls.
