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
docker compose build
docker compose run --rm test
```

The container runs:

1. strict TypeScript checking;
2. **57 deterministic unit tests** with V8 coverage enforcement;
3. optimized Vite production compilation;
4. **9 Playwright Chromium/Pixi/WebGL integration tests**.

The unit suite covers Asteroids, Tempest, menu state/scrolling, registry construction, input geometry, phosphor math, and settings. The browser suite covers the actual top-level menu, Configuration, both games, GPU startup, multi-touch, keyboard navigation, return-to-menu behavior, and orientation resizing.

See [`TESTING.md`](TESTING.md) for the detailed matrix and thresholds.

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

`apk` is a hard quality gate: the complete test suite and production browser build run before Capacitor/Gradle. A failing test prevents APK generation.

Output:

```text
out/vector-arcade-debug.apk
```

Install from the host with:

```bash
adb install -r out/vector-arcade-debug.apk
```

The first dependency install creates `package-lock.json` if one is not already present; commit it after the first successful online build to pin the npm dependency graph.

## Interactive toolchain / Dev Container

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

VS Code can also open `.devcontainer/devcontainer.json`, which uses the same image.

The Docker image contains Node 22, JDK 17, Android SDK/API 36 tooling, and the Chromium build paired with Playwright 1.64.0.

## Target hardware

Primary target: **Samsung Galaxy Tab S9+ 5G (SM-X818U)**. Controls and projection geometry are normalized and responsive so the same app can run on other Android tablets and in browser windows of different aspect ratios. Pixi internal resolution remains capped to control the cost of the double phosphor framebuffer and blur/filter passes.
