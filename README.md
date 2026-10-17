# Vector Arcade

A PixiJS 8 / TypeScript full-color vector arcade targeting Android tablets and desktop-browser debugging. The presentation model is inspired by Vectrex/vector arcade hardware: games emit geometry rather than sprites, while a GPU phosphor-feedback renderer simulates luminous beam excitation, bloom, analog instability, and time-based CRT persistence.

The same production web bundle runs in Chromium and inside Capacitor on Android.

## Programs currently included

### ASTEROIDS

Free-flight vector Asteroids clone with inertial steering, thrust/brake, hyperspace, asteroid splitting, toroidal wrapping, and multi-touch firing.

### TEMPEST

A full-color vector tube shooter inspired by classic vector arcade design. The simulation runs in lane/depth coordinates and projects into the same 2D beam renderer. It includes:

- 16 chromatic tube rails plus perspective depth rings;
- continuous rim movement with wraparound;
- flipper and spinner enemies moving toward the player;
- depth-traveling projectiles;
- phase jump;
- limited super-zap charges;
- lives, score, waves, and increasing enemy pressure.

### CONFIGURATION

Top-level global display/input configuration. Current settings cover beam intensity, phosphor bloom, persistence, diffusion, RGB decay separation, beam jitter, scanlines, vignette, and touch-overlay opacity. The shell is structured so additional system-level settings can be added here without coupling them to a particular game.

## Arcade shell

Games are registered in `src/app/gameRegistry.ts`. The top-level scrolling program list is generated from this registry rather than hard-coded into the view, so adding future games is intentionally small and testable.

Menu input:

- touch any program directly;
- joystick up/down + **A** selects;
- keyboard arrows + Space work during browser development.

While a game is running:

- **Start** pauses;
- **Select** opens Configuration;
- **Start + Select** together returns to the arcade menu;
- **Escape** returns to the menu in desktop/browser debugging.

## Shared tablet control surface

Every game receives the same multi-touch input model:

- central analog joystick;
- Y / X upper quadrants;
- B / A lower quadrants;
- L / R thin strips across the top;
- Select / Start thin strips across the bottom.

Multiple touch pointers are tracked independently, so steering + fire + another action can be held simultaneously.

## GPU phosphor renderer

Each game emits `VectorPath[]`. `VectorRenderer` rasterizes those paths as luminous beam strokes and bloom, then uses exactly two reusable Pixi `RenderTexture`s as a ping-pong phosphor surface:

1. sample the previous phosphor framebuffer;
2. apply elapsed-time-based RGB decay plus normalized diffusion in `PhosphorFilter`;
3. add newly energized vector beams into the other framebuffer;
4. swap read/write surfaces and display the result.

The renderer never reads and writes the same texture in one pass, performs no CPU framebuffer readback, and does not allocate a trail texture per frame. Scanlines/vignette are optional finishing effects; the core analog appearance comes from beam geometry, additive excitation, bloom, jitter, and persistent phosphor history.

## Browser development — Docker only

```bash
docker compose up --build dev
```

Open <http://localhost:5173>.

## Full automated test / CI gate

```bash
docker compose run --rm --build test
```

The container runs:

1. strict TypeScript checking;
2. **58 deterministic unit tests** with V8 coverage enforcement;
3. optimized Vite production compilation;
4. **9 Playwright Chromium/Pixi/WebGL integration tests**.

The unit suite covers Asteroids, Tempest, menu state/scrolling, registry construction, input geometry, phosphor math, and settings. The browser suite covers the actual top-level menu, Configuration, both games, GPU startup, multi-touch, keyboard navigation, return-to-menu behavior, and orientation resizing.

See [`TESTING.md`](TESTING.md) for the detailed matrix and thresholds.

## Production web build — Docker only

```bash
docker compose run --rm web
```

Output: `out/web/`.

## Android debug APK

```bash
docker compose run --rm --build apk
```

`apk` is a hard quality gate: the complete test suite and production browser build run before Capacitor/Gradle. A failing test prevents APK generation.

Output:

```text
out/vector-arcade-debug.apk
```

Install from the host with:

```bash
adb install -r out/vector-arcade-debug.apk
```

A committed `package-lock.json` is strongly recommended. When it is present, the image dependency layer uses `npm ci`; otherwise it falls back to `npm install`. If your existing WSL checkout already produced a lockfile, keep/commit it before rebuilding the v0.4.4 image.

## Interactive toolchain / Dev Container

```bash
docker compose run --rm shell
```

Inside, dependencies are already supplied by the image:

```bash
npm run typecheck
npm run test:coverage
npm run build:web
npm run test:e2e
```

Do not run `npm install` in `/workspace` unless you intentionally want a host-side `node_modules` tree. After changing package metadata, exit the shell and run `docker compose build`.

VS Code can also open `.devcontainer/devcontainer.json`, which uses the same image.

The Docker image contains Node 22, JDK 17, Android SDK/API 36 tooling, and the Chromium build paired with Playwright 1.64.0.

## Target hardware

Primary target: **Samsung Galaxy Tab S9+ 5G (SM-X818U)**. Controls and projection geometry are normalized and responsive so the same app can run on other Android tablets and in browser windows of different aspect ratios. Pixi internal resolution remains capped to control the cost of the double phosphor framebuffer and blur/filter passes.

### WSL / Docker browser tests

The CI/APK gate runs Playwright with a **headed Chromium under Xvfb**, not Chromium headless. This keeps the build self-contained while giving Pixi/WebGL and touch-edge tests normal visible-browser animation scheduling. Run `docker compose run --rm test`; use `npm run test:e2e:plain` only when you specifically want to compare against headless Chromium.

## v0.4.4 image-baked dependency cache

JavaScript dependencies now live in `/opt/vector-arcade-deps` inside the Docker
image. `docker compose run --rm test`, `web`, and `apk` do not run npm dependency
installation at container startup.

After ordinary source changes, rebuild the source snapshot and then run the task:

```bash
docker compose run --rm --build apk
```

The expensive npm layer remains cached unless `package.json` or
`package-lock.json` changed. `dev` and `shell` still use the live WSL checkout
while resolving packages from the image.

See `CACHING.md` for dependency refresh, BuildKit cleanup, Gradle-cache cleanup,
and full-reset procedures.


### E2E reliability under WSL/Xvfb

Version 0.4.4 replaces fixed-duration synthetic multi-touch pulses with a
deterministic E2E controller bridge available only under `?e2e=1`. One browser
test still exercises real PointerEvents through the visible L/R strips. The
remaining controller/chord tests drive the same TouchController snapshot path
and wait for observable game/shell state transitions. This makes the headed
Xvfb suite independent of SwiftShader frame timing while retaining a real
Pixi/WebGL browser run.
