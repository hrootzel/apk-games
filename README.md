# Vector Asteroids

A PixiJS 8 / TypeScript Asteroids demo built around a futuristic full-color Vectrex/oscilloscope rendering model. The same production web bundle runs in a desktop browser and inside Capacitor on Android.

## Implemented

- GPU-accelerated PixiJS WebGL renderer.
- Vector-only ship, asteroids, bullets, and thrust flame.
- Additive hot-core beam + blurred bloom.
- Two-texture ping-pong GPU phosphor framebuffer with time-based RGB decay/diffusion shader.
- Adjustable beam intensity, bloom, persistence, phosphor diffusion, color decay split, jitter, scanlines, vignette, and control opacity.
- Full multi-touch controller map: central analog joystick, Y/X/B/A quadrants, L/R top strips, Select/Start bottom strips.
- Browser keyboard fallback.
- Deterministic, injectable game randomness and serializable game state for repeatable tests/debugging.
- Vitest unit suite with enforced V8 coverage thresholds.
- Playwright production-browser suite exercising Pixi/WebGL, resize, settings, keyboard, and simultaneous pointer input.
- Dockerized browser development, testing, and Android APK build.
- VS Code Dev Container configuration.

## Browser development — Docker only

```bash
docker compose up --build dev
```

Open <http://localhost:5173>.

## Full automated test/CI gate

```bash
docker compose build
docker compose run --rm test
```

The test container runs strict TypeScript checking, unit tests with coverage enforcement, the optimized web build, and Playwright Chromium integration tests. See [`TESTING.md`](TESTING.md) for the complete matrix.

Coverage HTML is written to `coverage/`; Playwright failure artifacts are written to `test-results/` and `playwright-report/`.

## Production web build — Docker only

```bash
docker compose run --rm web
```

Output: `dist/`.

## Android debug APK

```bash
docker compose build
docker compose run --rm apk
```

`apk` is intentionally a hard quality gate. It first runs the complete test suite. Only after all checks pass does it run Capacitor sync and Gradle `assembleDebug`.

Output:

```text
out/vector-asteroids-debug.apk
```

Install from the host with:

```bash
adb install -r out/vector-asteroids-debug.apk
```

The first dependency install creates `package-lock.json` if one is not already present; commit it after that first successful online build to pin the entire npm dependency graph.

## Interactive dev-container/toolchain shell

```bash
docker compose run --rm shell
```

Inside:

```bash
./scripts/install-deps.sh
npm run typecheck
npm run test:coverage
npm run build:web
npm run test:e2e
```

The Docker image contains Node 22, JDK 17, Android SDK/API 36 tooling, and a pinned Playwright Chromium build with its Linux dependencies. The same image is therefore used for browser CI and APK compilation.

## Target device

Primary target: Samsung Galaxy Tab S9+ 5G (SM-X818U), with responsive normalized controls suitable for similar Android tablets. The renderer caps internal Pixi resolution to limit the cost of the two phosphor framebuffers and blur/filter passes.

## GPU phosphor renderer

`AsteroidsGame` emits `VectorPath[]`. `VectorRenderer` rasterizes those lines as luminous beam strokes and a bloom layer, then uses exactly two reusable `RenderTexture`s:

1. Sample the previous phosphor framebuffer.
2. Apply time-based RGB decay plus normalized four-tap diffusion in `PhosphorFilter`.
3. Add the newly energized beam geometry into the other framebuffer.
4. Swap read/write textures and display the result.

The renderer never reads and writes the same texture in one pass, performs no CPU framebuffer readback, and allocates no history texture per frame. Buffers are recreated/cleared on resize.

Scanlines and vignette remain optional finishing effects; the vector appearance comes from the beam geometry, additive excitation, bloom, instability, and persistent phosphor surface.
