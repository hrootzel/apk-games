#!/usr/bin/env bash
set -euo pipefail
cat <<'MSG'
Vector Arcade shell
-------------------
Dependencies are baked into the Docker image at /opt/vector-arcade-deps.
Do not run `npm install` in /workspace unless you intentionally want a host
node_modules tree. After package.json/package-lock.json changes, exit and run:

  docker compose build

MSG
exec bash
