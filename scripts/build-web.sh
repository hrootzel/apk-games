#!/usr/bin/env bash
set -euo pipefail
cd /workspace
./scripts/install-deps.sh
npm run build
