#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

VERSION=$(node -p "require('./package.json').version")
TARBALL="fuska-${VERSION}.tgz"

echo "Cleaning dist..."
rm -rf dist

echo "Building fuska..."
npm run build

echo "Creating package tarball..."
npm pack

echo "Installing globally from tarball..."
npm install -g "$TARBALL"

echo "Cleaning up tarball..."
rm "$TARBALL"

echo ""
echo "[OK] fuska v${VERSION} installed to global node_modules!"
echo "  Run: fuska --help"
echo "  Run: fuska install opencode"
