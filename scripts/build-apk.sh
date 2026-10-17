#!/usr/bin/env bash
set -euo pipefail
cd /workspace

# Hard quality gate: typecheck, unit coverage, production web build, and
# Chromium/Pixi/WebGL integration tests must all pass before Gradle runs.
./scripts/test.sh

if [[ ! -d android ]]; then
  echo "[android] Creating Capacitor Android project..."
  cap add android
fi

cap sync android
chmod +x android/gradlew
mkdir -p out .cache/gradle

(
  cd android
  GRADLE_USER_HOME=/workspace/.cache/gradle ./gradlew --no-daemon assembleDebug
)

cp android/app/build/outputs/apk/debug/app-debug.apk out/vector-arcade-debug.apk
echo "APK: /workspace/out/vector-arcade-debug.apk"
