# Vector Asteroids agent notes

## Architecture
- TypeScript + Vite + PixiJS 8.
- Production renderer is WebGL. Do not switch Android to WebGPU without an explicit compatibility test.
- Capacitor 8 wraps the same production web bundle for Android.
- `AsteroidsGame` emits `VectorPath[]`; CRT/vector behavior belongs in the graphics layer.
- `TouchController` owns DOM pointer state; pure zone/joystick math belongs in `src/input/layout.ts` so it remains deterministic and unit-testable.
- `AsteroidsGame` randomness is injectable. New random gameplay behavior must use the injected RNG, not direct `Math.random()`, so tests can remain deterministic.
- `exportState()` / `importState()` are the supported deterministic state boundary for tests and future save/debug tooling.

## Controls
- Center joystick: X turns; up thrusts.
- A: fire.
- B: thrust.
- X: hyperspace.
- Y: brake.
- L/R: rotate left/right.
- Start: pause.
- Select: graphics settings.
- Browser fallback: arrows, Space, X/Y, Q/E, P/O.

## Display goals
The aesthetic is a futuristic full-color Vectrex/vector oscilloscope. The renderer must derive the look from luminous vector beams, additive bloom, slight beam instability, and phosphor persistence. `VectorRenderer` uses a strict two-framebuffer ping-pong path; never sample from the same render texture currently being written. `PhosphorFilter` owns GPU decay/diffusion; `phosphorMath` owns deterministic timing math. Scanlines/vignette are secondary finishing effects.

## Tests are part of the architecture
- Deterministic logic: Vitest under `tests/unit/`.
- Browser/Pixi/WebGL/multi-pointer integration: Playwright under `tests/e2e/`.
- Keep pure calculations out of DOM/Pixi classes where practical so unit coverage remains fast.
- Browser tests run against the built `dist/` bundle, not Vite dev mode.
- `?e2e=1` exposes a read-only debug snapshot hook used only by integration tests.
- Failed Playwright runs retain trace/screenshot/video artifacts.

## Required checks
Before considering a code change complete:
1. `docker compose run --rm test`
2. For Android-impacting changes: `docker compose run --rm apk`

`apk` already calls the full test gate before Capacitor/Gradle, so never bypass it merely to obtain an APK.
