#!/usr/bin/env bash
set -euo pipefail
cd /workspace

# Docker/WSL CI path: run a real headed Chromium inside a virtual X11 display.
if command -v xvfb-run >/dev/null 2>&1; then
  echo "[e2e] Starting headed Chromium under Xvfb (1280x960x24)..."
  exec xvfb-run \
    --auto-servernum \
    --server-args="-screen 0 1280x960x24 -nolisten tcp -ac" \
    playwright test --headed "$@"
fi

echo "[e2e] xvfb-run not found; falling back to Playwright headless mode."
exec playwright test "$@"
