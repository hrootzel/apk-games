# AGENTS.md — Vector Arcade 0.5.0

## Project intent
Tablet-first Android/browser arcade using TypeScript + PixiJS 8. Games emit platform-neutral geometry/particle snapshots; Pixi owns WebGL presentation. Keep game simulation free of Pixi imports.

## Programs
- `asteroids` — free-flight vector survival.
- `tempest` — pseudo-3D chromatic tube shooter.
- `phosphor-swarm` — twin-stick neon arena using the shared vector renderer plus Pixi `ParticleContainer` sparks.
- `configuration` — shell-level display/input settings.

Games register through `src/app/gameRegistry.ts`.

## Architecture
1. Games live under `src/game/` and implement `ArcadeGame`.
2. Vector geometry uses `VectorPath[]`; optional high-volume effects use `ArcadeParticle[]` and `ParticleRenderer`.
3. `GraphicsSettings` contains only CRT/phosphor/display calibration. `InputSettings` contains touch-overlay/input behavior.
4. `InputSnapshot.joystick` is movement/primary steering; `InputSnapshot.aim` is an independent aim vector for twin-stick games.
5. Touch layouts are per-game `TouchProfile`s. Preserve keyboard and `?e2e=1` deterministic input bridge support.
6. Clear held inputs on cancellation, focus loss, resize, profile transitions, and shell transitions.
7. Start+Select returns to the shell; Escape is the desktop equivalent.

## Validation
Run:

```bash
docker compose run --rm --build test
```

This must pass layout checks, strict TypeScript, Vitest coverage, production Vite build, and headed Chromium/WebGL Playwright tests under Xvfb.

APK builds are hard-gated:

```bash
docker compose run --rm --build apk
```

GitHub Actions runs the same test service and then runs `scripts/assemble-android.sh` separately so Android/JDK/Gradle failures cannot pass CI. Failure artifacts live under `out/`; successful CI uploads the debug APK for three days.

## Dependencies
Dependencies are image-baked at `/opt/vector-arcade-deps`. Do not add runtime `npm install` calls. A committed `package-lock.json` is preferred and causes the Dockerfile to use `npm ci`; until one is present, CI emits a reproducibility warning.

## Tests for new games
Add deterministic coverage for movement/input, collision/scoring, lifecycle/reset, serialization, representative vectors, particles if used, and at least one Playwright launch/input path.
