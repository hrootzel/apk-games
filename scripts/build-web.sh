#!/usr/bin/env bash
set -euo pipefail
cd /workspace
npm run build
rm -rf /workspace/out/web
mkdir -p /workspace/out/web
cp -a dist/. /workspace/out/web/
echo "Web bundle: /workspace/out/web"
