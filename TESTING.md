# Vector Arcade test harness

The project is designed so the same Docker toolchain used for development also
runs the CI gate that protects APK generation.

## One-command container test

```bash
docker compose build
docker compose run --rm test
```

The `test` service runs, in order:

1. strict TypeScript type checking;
2. Vitest unit tests with V8 coverage enforcement;
3. a production Vite build;
4. Playwright Chromium integration tests against that production bundle.

APK generation runs the same gate first:

```bash
docker compose run --rm apk
```

If any test, coverage threshold, type check, production build, or browser test
fails, Gradle is not invoked and no APK is emitted.

## Current coverage matrix

### Deterministic unit suite

- **Asteroids**: inertial movement, wrapping, thrust/brake, pause/settings edges,
  hyperspace, firing cadence, bullet lifetime, asteroid splitting, toroidal
  collisions, ship respawn, wave lifecycle, deep state export/import, and
  emitted vector geometry.
- **Tempest**: lane/rim movement and seam wrapping, precision movement,
  pause/settings edges, phase jump, repeated fire/cooldown, bullet expiration,
  lane/depth projectile collision, seam collisions, super-zap behavior, rim
  collisions/lives/game reset, auto-spawn/waves, deep state export/import, and
  complete tube/enemy/projectile/player vector projection.
- **Arcade menu model**: joystick edge navigation, wraparound, A/Start confirm,
  scrolling-window bookkeeping, direct selection, invalid IDs, and clamping.
- **Game registry**: stable ordering and correct game factory construction.
- **Shared input**: every screen binding region, joystick clamping, and boundary
  behavior.
- **Phosphor math**: frame-rate-independent persistence, RGB decay separation,
  diffusion calculations, and parameter bounds.
- **Graphics settings**: defaults stay within supported UI ranges.

At v0.4 there are **57 unit tests**.

### Chromium/Pixi integration suite

The Playwright suite boots the real optimized Vite bundle with Chromium and a
software WebGL implementation in the Docker image. It verifies:

- Pixi/WebGL boot and frame progression on the top-level arcade menu;
- the visible ASTEROIDS / TEMPEST / CONFIGURATION registry UI;
- opening and changing global Configuration settings;
- launching Asteroids and preserving simultaneous joystick + A multi-touch;
- launching Tempest and advancing its movement/fire simulation;
- simultaneous L/R strip input;
- in-game Select settings and Start pause behavior;
- Start+Select return-to-arcade chord;
- keyboard-only menu navigation/launch;
- orientation/viewport resize propagation into Pixi and the active game.

At v0.4 there are **9 browser integration tests**.

## Coverage thresholds

Global deterministic-core thresholds:

- lines: 80%
- statements: 80%
- functions: 80%
- branches: 70%

Critical pure subsystems carry stronger file-specific thresholds:

- MenuController: 95% lines/functions/statements, 85% branches
- touch layout: 95% lines/functions/statements, 85% branches
- phosphor math: 95% lines/statements, 100% functions, 85% branches

Coverage reports are written to `coverage/`.

## Browser failure artifacts

Playwright keeps useful diagnostics on failure:

- screenshot
- video
- browser trace
- HTML report in `playwright-report/`

These artifacts are especially useful when an AI coding agent changes renderer,
input, or shell/navigation behavior.
