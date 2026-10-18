#!/usr/bin/env bash
set -euo pipefail
cd /workspace

preserve_failure_artifacts() {
  status=$?
  if [[ $status -ne 0 ]]; then
    mkdir -p /workspace/out/test-artifacts
    if [[ -e coverage ]]; then
      rm -rf /workspace/out/test-artifacts/coverage
      cp -a coverage /workspace/out/test-artifacts/coverage
    fi
    echo "[test] Playwright artifacts remain in /workspace/out/test-results and /workspace/out/playwright-report"
    echo "[test] coverage copied to /workspace/out/test-artifacts/coverage when available"
  fi
  exit "$status"
}
trap preserve_failure_artifacts EXIT

bash ./scripts/check-layout.sh
npm run test:ci
trap - EXIT
