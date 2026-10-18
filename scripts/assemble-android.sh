#!/usr/bin/env bash
set -euo pipefail
cd /workspace

preserve_android_failure() {
  status=$?
  if [[ $status -ne 0 ]]; then
    mkdir -p out/android-reports
    for path in android/build/reports android/app/build/reports; do
      if [[ -e "$path" ]]; then cp -a "$path" "out/android-reports/$(basename "$(dirname "$path")")-reports"; fi
    done
    echo "[android] failure reports preserved under /workspace/out/android-reports"
  fi
  exit "$status"
}
trap preserve_android_failure EXIT

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
trap - EXIT
echo "APK: /workspace/out/vector-arcade-debug.apk"
