#!/usr/bin/env bash
set -euo pipefail
cd /workspace

bad=0
for path in src/src src/tests src/package.json src/compose.yaml; do
  if [[ -e "$path" ]]; then
    echo "[layout] ERROR: unexpected '$path' exists." >&2
    bad=1
  fi
done

if [[ $bad -ne 0 ]]; then
  cat >&2 <<'MSG'
[layout] The project appears to have been patched or extracted while the shell
[layout] was inside ./src instead of the project root. The project root is the
[layout] directory containing package.json, compose.yaml, Dockerfile, src/, and tests/.
[layout]
[layout] Safe cleanup for this specific accidental nesting is:
[layout]   rm -rf src/src src/tests
[layout]
[layout] Then re-apply the harness patch from the project root.
MSG
  exit 2
fi
