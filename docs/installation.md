# Installation

> Full setup guide for Fuska.

**Audience:** New users
**Prerequisites:** Node.js 18+, git

---

## Quick Install

```bash
npm install -g fuska
fuska install
```

On first run, Fuska prompts you to select a provider:

```
? Select provider:
> opencode (~/.config/opencode/)
  claude (~/.claude/)
  both
```

Your choice is saved to `~/.config/fuska/fuska.jsonc` for future installs.

**Options:**
- `--opencode` — Install to `~/.config/opencode/`
- `--claude` — Install to `~/.claude/`
- `--both` — Install to both locations
- `--force` — Replace existing directories without prompting
- `--dry-run` — Preview changes without making them

---

## What `fuska install` Does

Fuska creates **symlinks** from your config directories to the npm package:

### OpenCode Symlinks

| Global Target | Points To |
|---------------|-----------|
| `~/.config/opencode/fuska/` | `provider/opinkode/fuska/` |
| `~/.config/opencode/command/fuska/` | `provider/opinkode/command/fuska/` |
| `~/.config/opencode/agents/fuska/` | `provider/opinkode/agents/fuska/` |

### Claude Code Symlinks

| Global Target | Points To |
|---------------|-----------|
| `~/.claude/fuska/` | `provider/klod/fuska/` |
| `~/.claude/skills/fuska-*/` | `provider/klod/skills/fuska-*/` |
| `~/.claude/agents/fuska/` | `provider/klod/agents/fuska/` |

Because these are symlinks, package updates are immediately available — no reinstall needed.

---

## First Run

```bash
# In your project directory
fuska init "My project description"
# Creates: .git (if needed), .megamemory/, main initiative
# Runs: codebase mapping (unless --no-map)

# Then in your editor:
/fuska configure
# Walks through: questioning -> preferences -> requirements -> roadmap
```

At any point, run `/fuska` (bare) to see where you are and what to do next.

---

## Platform Notes

### macOS (Homebrew)

```
npm prefix: /opt/homebrew
Package location: /opt/homebrew/lib/node_modules/fuska/
```

### macOS (nvm / fnm)

```
npm prefix: ~/.nvm/versions/node/v22.x.x/
Package location: ~/.nvm/versions/node/v22.x.x/lib/node_modules/fuska/
```

### Linux

```
npm prefix: /usr/local (or /usr)
Package location: /usr/local/lib/node_modules/fuska/
```

### Windows

Directory symlinks use `junction` type for reliability without admin privileges.

---

## Upgrading

```bash
npm update -g fuska
```

Symlinks automatically point to the updated package — no reinstall needed.

After upgrading, rebuild if you use Claude Code (the build step transforms OpenCode commands to Claude skills):

```bash
cd $(npm root -g)/fuska && npm run build
```

---

## Migrating from Old Installations

If you have existing Fuska files from copy-based installs, `fuska install` will offer to replace them with symlinks:

```
Old installation detected at ~/.config/opencode/fuska
? Replace with symlink? (Y/n)
```

Use `--force` to skip the prompt.

**What happens when a directory exists:**
1. **Symlink with same target**: Skip (already correct)
2. **Symlink with different target**: Update to new target
3. **Directory or file**: Prompt to replace (unless `--force`)

---

## Troubleshooting

**Permission denied during install:**
Check your npm prefix with `npm prefix -g`. If it points to a system directory (e.g., `/usr/local`), either use `sudo npm install -g fuska` or configure npm to use a user-writable prefix.

**Symlinks not resolving:**
Verify with `ls -la ~/.config/opencode/fuska` — it should show a symlink arrow (`->`) pointing to the package directory. If it's a regular directory, run `fuska install --force` to replace it.

**`fuska` command not found:**
Ensure the npm global bin directory is in your PATH. Run `npm bin -g` to see where npm installs binaries, then add it to your shell profile.

**Rollback on error:**
If installation fails mid-way, all changes are automatically rolled back. No partial installations are left behind.

---

## See Also

- [development.md](development.md) — Development installation and contributing
- [configuration.md](configuration.md) — Post-install configuration
- [concepts.md](concepts.md) — Understand Fuska's mental model
