#!/usr/bin/env bash
set -euo pipefail
mkdir -p .cache/npm .cache/gradle
if [[ -f package-lock.json ]]; then
  npm ci --cache "$(pwd)/.cache/npm"
else
  npm install --cache "$(pwd)/.cache/npm"
fi
