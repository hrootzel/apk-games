# Test harness

The project has two complementary test layers and both execute inside the same Docker image used for Android builds.

## One-command CI suite

```bash
docker compose run --rm test
```

This performs, in order:

1. `npm run typecheck` — strict TypeScript checking across application, unit tests, and test configs.
2. `npm run test:coverage` — deterministic Vitest unit tests with V8 coverage thresholds.
3. `npm run build:web` — the actual optimized Vite production bundle.
4. `npm run test:e2e` — Playwright launches pinned Chromium against that production bundle and exercises Pixi/WebGL plus input/UI integration.

The `apk` service calls the same script before `cap sync` or Gradle, so a failed test blocks APK generation.

## Unit coverage scope

V8 coverage is enforced for deterministic application logic:

- `src/game/AsteroidsGame.ts`
- `src/input/layout.ts`
- `src/graphics/phosphorMath.ts`
- `src/graphics/settings.ts`

Global thresholds are 80% lines/functions/statements and 70% branches. The small input-layout and phosphor-math modules have higher file-specific thresholds.

The unit suite covers:

- inertial motion, steering, thrust, brake, wrapping
- pause and settings press-edge semantics
- fire cooldown and bullet expiry
- large/small asteroid destruction and scoring
- toroidal collision detection
- ship collision/respawn
- deterministic hyperspace
- automatic new waves
- deep state export/import behavior
- vector-path emission
- all touch zones and central joystick math
- joystick clamping/proportional movement
- frame-rate-independent phosphor decay/diffusion and RGB separation
- graphics-default range invariants

## Browser/WebGL integration coverage

Playwright uses the exact Chromium revision matched to `@playwright/test` and installed into the Docker image. Tests run against `vite preview`, not the development server.

The browser suite verifies:

- Pixi starts on a WebGL canvas and the ticker advances
- no uncaught page errors during boot
- simultaneous joystick + A multi-pointer input
- simultaneous L/R strip input
- Select opens display calibration
- Start pauses the game
- desktop keyboard fallback
- portrait/landscape viewport resizing propagates to Pixi
- live settings changes do not stop rendering

On failure, Playwright retains traces, screenshots, and video under `test-results/`; its HTML report is under `playwright-report/`.

## Useful commands

```bash
# Full containerized quality gate
docker compose run --rm test

# Interactive shell in the same image
docker compose run --rm shell

# Inside the shell
npm run test:unit
npm run test:coverage
npm run build:web
npm run test:e2e

# APK: automatically executes the full gate first
docker compose run --rm apk
```

A real Samsung tablet smoke test remains valuable after automated CI, particularly for Android WebView GPU-driver behavior, device pixel ratio, sustained frame rate, thermal throttling, and true hardware multi-touch latency.
