#!/bin/bash

VERSION="${1:-}"

if [[ -n "$VERSION" ]]; then
  VERSION_INFO="v${VERSION#v} (pretend HEAD is tagged as v${VERSION#v})"
else
  VERSION_INFO="Unreleased (\$(git rev-parse --short HEAD))"
fi

fuska do planned "Update @CHANGELOG.md:
1. Check if there are uncommitted changes (staged or unstaged). If nothing to commit, exit with no changes.
2. Get git log between latest tag and HEAD.
3. Create/update section for ${VERSION_INFO} with the changes.
4. Keep format consistent with existing entries (theme-based, not commit-by-commit)."


