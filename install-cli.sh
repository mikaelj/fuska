#!/bin/bash
set -e

echo "Building fuska..."
npm run build

echo "Installing fuska CLI globally..."
npm link

echo ""
echo "[OK] fuska installed successfully!"
echo "  Run: fuska --help"
