#!/usr/bin/env bash
set -euo pipefail
cd /workspace

# Hard quality gate: typecheck, unit coverage, production web build, and
# Chromium/Pixi/WebGL integration tests must all pass before Gradle runs.
bash ./scripts/test.sh

# Capacitor 8 Android builds require Java source level 21. Fail here with a
# useful diagnostic instead of much later in :capacitor-android:compileDebugJavaWithJavac.
echo "[android] Java toolchain:"
java -version
javac -version
JAVA_MAJOR="$(javac -version 2>&1 | awk '{print $2}' | cut -d. -f1)"
if [[ ! "$JAVA_MAJOR" =~ ^[0-9]+$ ]] || (( JAVA_MAJOR < 21 )); then
  echo "[android] ERROR: JDK 21+ is required by Capacitor 8; found javac ${JAVA_MAJOR:-unknown}." >&2
  exit 21
fi

if [[ ! -d android ]]; then
  echo "[android] Creating Capacitor Android project..."
  cap add android
fi

cap sync android

# The Gradle "all" distribution includes sources/docs that CI does not need.
# Capacitor generates the wrapper; switch it to the smaller binary-only archive
# before first wrapper execution to reduce download/unpack time.
if [[ -f android/gradle/wrapper/gradle-wrapper.properties ]]; then
  sed -i 's/-all\.zip/-bin.zip/' android/gradle/wrapper/gradle-wrapper.properties
fi

chmod +x android/gradlew
mkdir -p out .cache/gradle

(
  cd android
  GRADLE_USER_HOME=/workspace/.cache/gradle ./gradlew --no-daemon assembleDebug
)

cp android/app/build/outputs/apk/debug/app-debug.apk out/vector-arcade-debug.apk
echo "APK: /workspace/out/vector-arcade-debug.apk"
