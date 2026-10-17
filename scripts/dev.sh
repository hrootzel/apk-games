#!/usr/bin/env bash
set -euo pipefail
cd /workspace
exec npm run dev -- --host 0.0.0.0
