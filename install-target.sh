#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOME="${HOME:-$(echo ~)}"

OPENCODE_CONFIG="$HOME/.config/opencode"
CLAUDE_CONFIG="$HOME/.claude"

FORCE=false
DRY_RUN=false
TARGET=""

usage() {
  echo "Usage: $0 [options]"
  echo ""
  echo "Options:"
  echo "  --opencode    Install to ~/.config/opencode/"
  echo "  --claude      Install to ~/.claude/"
  echo "  --force       Replace existing directories without prompting"
  echo "  --dry-run     Show what would be done without making changes"
  echo "  --help        Show this help"
  echo ""
  echo "Examples:"
  echo "  $0 --opencode              # Install to opencode"
  echo "  $0 --claude --dry-run      # Preview claude installation"
  echo "  $0 --opencode --force      # Force replace existing"
}

create_symlink() {
  local source="$1"
  local target="$2"
  
  if [ "$DRY_RUN" = true ]; then
    echo "  [DRY-RUN] Would create: $target → $source"
    return 0
  fi
  
  if [ -L "$target" ]; then
    local current_target
    current_target=$(readlink "$target")
    if [ "$current_target" = "$source" ]; then
      echo "  [SKIP] Already correct: $target"
      return 0
    fi
    rm "$target"
    echo "  [UPDATE] Removed old symlink: $target"
  elif [ -e "$target" ]; then
    if [ "$FORCE" = false ]; then
      echo "  [ERROR] Already exists (use --force): $target"
      return 1
    fi
    rm -rf "$target"
    echo "  [MIGRATE] Removed old directory: $target"
  fi
  
  mkdir -p "$(dirname "$target")"
  ln -s "$source" "$target"
  echo "  [OK] $target → $source"
}

install_opencode() {
  echo ""
  echo "Installing to opencode at $OPENCODE_CONFIG"
  echo "Creating symlinks..."
  
  create_symlink "$SCRIPT_DIR/opencode/fuska" "$OPENCODE_CONFIG/fuska"
  create_symlink "$SCRIPT_DIR/opencode/commands/fuska" "$OPENCODE_CONFIG/commands/fuska"
  create_symlink "$SCRIPT_DIR/opencode/agents/fuska" "$OPENCODE_CONFIG/agents/fuska"
  
  echo ""
  echo "Done! 3 symlinks created."
}

install_claude() {
  echo ""
  echo "Installing to claude at $CLAUDE_CONFIG"
  echo "Creating symlinks..."
  
  create_symlink "$SCRIPT_DIR/claude/fuska" "$CLAUDE_CONFIG/fuska"
  create_symlink "$SCRIPT_DIR/claude/agents/fuska" "$CLAUDE_CONFIG/agents/fuska"
  
  echo "  Linking skills..."
  local count=0
  for skill_dir in "$SCRIPT_DIR/claude/skills"/fuska-*; do
    if [ -d "$skill_dir" ]; then
      local skill_name
      skill_name=$(basename "$skill_dir")
      create_symlink "$skill_dir" "$CLAUDE_CONFIG/skills/$skill_name"
      ((count++)) || true
    fi
  done
  
  echo ""
  echo "Done! $((count + 2)) symlinks created."
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --opencode)
      TARGET="opencode"
      shift
      ;;
    --claude)
      TARGET="claude"
      shift
      ;;
    --force)
      FORCE=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

if [ -z "$TARGET" ]; then
  echo "Error: Must specify --opencode or --claude"
  echo ""
  usage
  exit 1
fi

if [ "$TARGET" = "claude" ] && [ ! -d "$SCRIPT_DIR/claude" ]; then
  echo "Error: claude/ directory not found. Run 'npm run build:claude' first."
  exit 1
fi

if [ "$TARGET" = "opencode" ]; then
  install_opencode
else
  install_claude
fi
