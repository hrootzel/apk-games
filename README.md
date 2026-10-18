# Vector Arcade 0.5.0

A tablet-first full-color vector/neon arcade built with TypeScript, PixiJS 8, Vite, Capacitor 8, and a Dockerized Android toolchain. Primary target: Samsung Galaxy Tab S9+ class Android tablets; the same app runs in a desktop browser for development.

## Games

- **ASTEROIDS** — classic free-flight vector survival with thrust, hyperspace, braking, and luminous phosphor trails.
- **TEMPEST** — chromatic pseudo-3D tube shooter with lane/depth simulation.
- **PHOSPHOR SWARM** — modern twin-stick arena shooter: independent move/aim pads, continuous aim-fire, dash, pulse bomb, repulsor field, reactive neon grid, and GPU particle explosions.

The third game deliberately exercises more of Pixi: high-volume additive particles are rendered with a shared `ParticleRenderer`, while gameplay remains independent of Pixi.

## Configuration architecture

`GraphicsSettings` controls only the CRT/phosphor renderer: beam intensity, bloom, persistence, diffusion, color decay, jitter, scanlines, and vignette.

`InputSettings` controls only touch/input UI: overlay opacity, control size/inset, Tempest drag steering, and the optional Asteroids Fire+Thrust button.

## Local browser development

```bash
docker compose up --build dev
```

Open `http://localhost:5173`.

## Test gate

```bash
docker compose run --rm --build test
```

The gate runs strict TypeScript, deterministic Vitest coverage, Vite production build, then headed Chromium/WebGL tests under Xvfb.

## Android APK

```bash
docker compose run --rm --build apk
```

Output:

```text
out/vector-arcade-debug.apk
```

The APK path runs the full test gate first, then Capacitor sync and Gradle `assembleDebug` with JDK 21. The generated Gradle wrapper is switched from `-all.zip` to the smaller `-bin.zip` distribution.

## GitHub Actions

`.github/workflows/ci.yml`:

1. Builds the same Docker image with GitHub Buildx layer caching.
2. Runs the same Compose `test` gate used locally.
3. Separately runs Android `assembleDebug` so Java/Capacitor/Gradle regressions are caught.
4. Uploads the debug APK on success for three days.
5. Uploads Playwright, coverage, control screenshots, and Android reports only on failure.

A committed `package-lock.json` is still recommended. This source snapshot does not include one; CI warns until you commit the lockfile produced by your WSL checkout.

## Controls

Asteroids and Tempest retain their per-game button layouts. PHOSPHOR SWARM uses a left **MOVE** analog pad and right **AIM · FIRE** analog pad simultaneously, plus Dash, Pulse Bomb, Repulse, weapon-cycle buttons, Start, and Select. Keyboard aim for desktop debugging uses I/J/K/L.

See `TESTING.md`, `CACHING.md`, and `AGENTS.md` for development details.
