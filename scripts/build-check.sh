#!/bin/bash
# Local build check - run from project root: ./scripts/build-check.sh
set -e
cd "$(dirname "$0")/.."

echo "=== Installing dependencies ==="
bun install

echo ""
echo "=== Building project ==="
bun run build

echo ""
echo "=== Build complete ==="
ls -la .next/BUILD_ID 2>/dev/null && echo "Production build verified."
