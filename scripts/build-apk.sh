#!/usr/bin/env bash
set -euo pipefail
cd /workspace

# Local APK builds remain hard-gated by the complete quality suite.
bash ./scripts/test.sh
bash ./scripts/assemble-android.sh
