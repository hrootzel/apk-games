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

Top-level global display/input configuration. Current settings cover beam intensity, phosphor bloom, persistence, diffusion, RGB decay separation, beam jitter, scanlines, vignette, touch-overlay opacity, control size/spacing, and game-specific touch options. The shell is structured so additional system-level settings can be added here without coupling them to a particular game.

## Arcade shell

Games are registered in `src/app/gameRegistry.ts`. The top-level scrolling program list is generated from this registry rather than hard-coded into the view, so adding future games is intentionally small and testable.

Menu input:

- touch any program directly;
- keyboard arrows navigate and **Space** selects;
- keyboard arrows + Space work during browser development.

While a game is running:

- **Start** pauses;
- **Select** opens Configuration;
- **Start + Select** together returns to the arcade menu;
- **Escape** returns to the menu in desktop/browser debugging.

## GitHub continuous integration

[Container CI](.github/workflows/ci.yml) runs on every push and pull request, and
can also be started manually from GitHub's Actions tab. It builds the checked-out
source into the same Docker image used locally, then runs the complete test gate:
strict TypeScript, Vitest with coverage thresholds, production Vite compilation,
and headed Playwright Chromium/WebGL tests under Xvfb. A failure fails the check.

Docker layers are cached between runs. The first build may take longer while
Chromium, the Android SDK, Java, and npm dependencies are installed into the image.
No registry credentials or additional repository secrets are required. Superseded
runs on the same branch or pull request are canceled.

Only failed test runs upload a `test-reports` artifact, retained for **one day**.
It contains the browser HTML report (including available traces/screenshots/videos),
control-layout screenshots, and any preserved coverage report. Successful runs
upload no test artifacts. Docker build-record uploads are disabled, and no
container images are published to a registry. Console logs and job summaries
remain available. Build failures before tests start have no test artifact.

To control storage and spending on GitHub:

- Keep the repository's Actions cache size eviction limit at **10 GB or less**;
  this is separate from the artifact storage allowance. Older caches are evicted
  automatically at the configured limit.
- Under account/organization **Billing & licensing → Budgets and alerts**, set
  an Actions budget appropriate for no paid overages (for example, $0) with
  **Stop usage when budget limit is reached** enabled where available. Check
  Actions cache storage budget settings as well. Alerts alone do not stop usage.
- Review existing artifacts in the Actions tab and delete unwanted old reports
  or `.dockerbuild` records. The new policy applies to future uploads; it does
  not shorten existing artifacts' retention or reverse accrued charges.

Workflow retention reduces storage use; it cannot guarantee zero charges across
an account. Existing usage, other repositories, and runner minutes also matter.
Repository cache limits and billing settings must be configured on GitHub; this
workflow does not change them. See [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
and [budget setup](https://docs.github.com/en/billing/how-tos/set-up-budgets).

After the workflow has run on GitHub, configure a branch protection rule or
ruleset for the default branch and require **Docker test gate** to pass before
merging. The workflow starts checking pushes once this file is pushed; requiring
it for merges is a separate repository setting. APK packaging remains a separate,
test-gated build rather than running Gradle on every push.

## Shared tablet control surface

Games share logical A/B/X/Y, L/R, Start/Select, and analog axes, with touch
profiles supplied by the game registry. The center stays clear; only the visible
buttons and drag strip accept gameplay touches.

- **Asteroids:** lower-left rotate arrows and Brake; lower-right Fire, Thrust,
  Hyperspace, and an optional Fire + Thrust button for simultaneous shooting and
  acceleration with one thumb.
- **Tempest:** lower-left movement arrows and Precision; lower-right Fire,
  Superzap, and Jump. Configuration can replace the arrows with a horizontal
  drag strip: touch anywhere on it, drag left/right to steer, lift to release.
- **System:** compact Select / Settings and Start / Pause controls at the top
  right. Start+Select returns to the arcade shell; Escape does the same on desktop.

Configuration adjusts control opacity, size, edge spacing, Tempest drag steering,
and the combined Asteroids button. Settings apply across games for the current
session. Multiple pointers are tracked independently, including overlapping
Fire and Fire + Thrust holds. Cancellation, focus loss, and shell transitions
release held input. Keyboard controls and the E2E analog bridge remain available.

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

The unit suite covers Asteroids, Tempest, menu state/scrolling, registry construction, touch profiles/drag steering, phosphor math, and settings. The browser suite covers the actual top-level menu, Configuration, both games, GPU startup, multi-touch, keyboard navigation, return-to-menu behavior, and orientation resizing.

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
test still exercises real PointerEvents through the visible L/R steering buttons. The
remaining controller/chord tests drive the same TouchController snapshot path
and wait for observable game/shell state transitions. This makes the headed
Xvfb suite independent of SwiftShader frame timing while retaining a real
Pixi/WebGL browser run.
