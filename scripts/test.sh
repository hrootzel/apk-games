#!/usr/bin/env bash
set -euo pipefail
cd /workspace

preserve_failure_artifacts() {
  status=$?
  if [[ $status -ne 0 ]]; then
    mkdir -p /workspace/out/test-artifacts
    for path in test-results playwright-report coverage; do
      if [[ -e "$path" ]]; then
        rm -rf "/workspace/out/test-artifacts/$path"
        cp -a "$path" "/workspace/out/test-artifacts/$path"
      fi
    done
    echo "[test] failure artifacts copied to /workspace/out/test-artifacts"
  fi
  exit "$status"
}
trap preserve_failure_artifacts EXIT

bash ./scripts/check-layout.sh
npm run test:ci
trap - EXIT
