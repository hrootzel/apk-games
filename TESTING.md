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

At v0.4.4 there are **58 unit tests**.

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

## Headed Chromium under Xvfb (Docker / WSL)

The container CI path runs Playwright in **headed Chromium** inside an Xvfb virtual X11 display. This is intentional: the Pixi/WebGL integration tests depend on animation frames and multitouch event consumption, and headed mode provides browser scheduling closer to the Android/runtime behavior than Chromium's headless path on software WebGL.

Canonical commands:

```bash
docker compose run --rm test
```

or, for only the browser suite after dependencies/build are ready:

```bash
docker compose run --rm test bash -lc 'npm run build:web && npm run test:e2e'
```

`npm run test:e2e` invokes `scripts/test-e2e.sh`, which uses `xvfb-run` with a 1280x960x24 virtual display and launches Playwright with `--headed`. `npm run test:e2e:plain` remains available for an ordinary Playwright headless run when debugging differences between modes.


## Image-baked dependencies

The test container does not install npm packages at startup. Dependencies are
baked into the Docker image. After changing source, rebuild the image before
running the immutable test service:

```bash
docker compose build
docker compose run --rm test
```

After changing `package.json` or `package-lock.json`, the same `docker compose
build` command automatically invalidates and rebuilds the dependency layer. See
`CACHING.md` for force-refresh and cleanup commands.


## Deterministic browser input harness (v0.4.4)

Playwright loads the app with `?e2e=1`. Only in that mode, `main.ts` exposes a
small `window.__VECTOR_ARCADE_DEBUG__.input` bridge that drives the existing
`TouchController` state machine directly. This avoids relying on synthetic
multi-pointer scheduling to test game/shell chords under Xvfb + SwiftShader.

The browser suite deliberately splits responsibilities:

- **Real DOM PointerEvent smoke coverage:** L/R are pressed through the actual
  overlay elements, using their live DOM rectangles (no hard-coded pixels).
- **Deterministic game/shell input:** joystick, A, Start, Select, and the
  Start+Select chord use the E2E bridge and are consumed by the normal Pixi
  ticker/game loop.
- **No fixed frame sleeps:** state changes use `expect.poll(...)` with bounded
  timeouts. A genuinely stalled renderer still fails, but slow software WebGL
  does not create false negatives.
- **Atomic chords:** Start and Select are injected in one browser task so a
  ticker frame cannot observe only half the chord.

The bridge is not installed during normal browser or Android operation; it is
created only when the URL contains `?e2e=1`.

The Start+Select E2E case also guards a shell-level regression: returning to
the menu primes `MenuController` with the currently-held chord so Start cannot
be interpreted as a fresh menu-confirm before the user releases it.


### Browser failure artifacts

Playwright writes screenshots, videos, traces, and the HTML report under
`out/test-results/` and `out/playwright-report/`. The Compose test/APK services
already bind-mount `./out`, so these diagnostics survive `docker compose run
--rm ...` and can be opened directly from WSL after a failed run.

## Layout guard (v0.4.4.1)

The CI entrypoint now rejects accidental nested project trees such as `src/src`
or `src/tests`. Those paths usually mean a patch was applied while the current
directory was `./src` instead of the project root. If this guard fires, remove
only those accidental nested paths and re-apply the update from the directory
that contains `package.json`, `compose.yaml`, `Dockerfile`, `src/`, and `tests/`.

## E2E launch-state synchronization

`GameApp.startGame()` switches `mode` and `activeGameId` immediately, but the HUD
text is refreshed on the following Pixi ticker frame. Browser tests therefore
must not use the previous HUD text as proof that a launch completed. The shared
`launch()` helper waits for `mode === "game"`, the expected `activeGameId`, a
non-null exported game state, and at least one frame after the menu click.
