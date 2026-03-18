## MegaMemory Quick Reference

Supplementary quick reference. Full API: `megamemory-integration.md`.

All project data lives in MegaMemory. Empty results = concept doesn't exist.

### Tool Responses

**megamemory:understand** returns `{concepts: [{id, name, kind, summary, children, edges, incoming_edges}]}`
- Parse `summary` with `JSON.parse()` to extract data
- Use `top_k` to limit results (default: 10)

**megamemory:create_concept** returns `{id, message}`

**megamemory:update_concept** accepts `{summary?, name?, kind?, why?, file_refs?}` only
- Pass full JSON string as `summary`
- Cannot update `parent_id` or `edges` — use `megamemory:link`

**megamemory:list_roots** returns root concepts (no parent_id)

**megamemory:link** creates relationship between existing concepts

**megamemory:get_concept** returns `NodeWithContext` or null/empty
- Parameter: `id` (string) — exact concept ID to look up
- Exact ID lookup vs semantic search. O(1) deterministic.
- Use when concept name is known (user-provided slug). Do NOT use for bulk listing.

### Error Handling

- `MEGAMEMORY_ERROR:` → MCP server issue. Stop and inform user.
- Empty `concepts` array → Concept doesn't exist. Handle gracefully.
