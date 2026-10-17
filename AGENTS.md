# AGENTS.md — Vector Arcade

## Project intent

This is a tablet-first, full-color vector arcade for Android and browsers.
TypeScript game simulations emit geometric `VectorPath[]` data. PixiJS owns the
GPU/WebGL presentation layer, including the ping-pong phosphor feedback surface.
Do not convert games into sprite/raster engines unless explicitly requested.

## Current programs

- `asteroids` — free-flight vector Asteroids clone.
- `tempest` — pseudo-3D chromatic vector tube shooter.
- `configuration` — shell-level global display/input settings entry.

Games are registered in `src/app/gameRegistry.ts`; the shell must discover them
through that registry rather than hard-coding game classes into menu markup.

## Architecture rules

1. Game simulation code belongs under `src/game/` and must not import PixiJS.
2. Each game implements the small `ArcadeGame` contract: resize, update,
   vector-path emission, HUD text, and serializable debug state.
3. Randomness in simulations must be injectable for deterministic tests.
4. Shared touch bindings remain A/B/X/Y + L/R + Start/Select + central joystick.
5. The top-level menu and configuration are shell concerns; game code must not
   own DOM navigation.
6. The CRT/vector appearance comes primarily from GPU beam/phosphor rendering,
   not from a decorative scanline overlay.
7. Start+Select is the universal touch-controller chord for returning to the
   arcade shell. Escape is the desktop/debug equivalent.

## Required validation

Before considering a change complete, run inside the Docker toolchain:

```bash
docker compose run --rm test
```

This must pass strict TypeScript, Vitest coverage, production Vite compilation,
and Playwright Chromium/WebGL integration tests.

APK builds are gated by that same suite:

```bash
docker compose run --rm apk
```

Never bypass the test gate in `scripts/build-apk.sh` to make a build appear to
work.

## Tests to add with new games/features

Every new game needs deterministic tests for controls, movement/state evolution,
collisions/scoring, lifecycle/reset behavior, export/import, and representative
`VectorPath` generation. Every new shell/menu flow needs a pure unit-testable
state model where practical plus at least one Playwright end-to-end path.

## Container dependency model (v0.4.4)

Do not add runtime `npm install` / `npm ci` calls to build or test scripts.
Dependencies are baked into the image at `/opt/vector-arcade-deps`; after package
metadata changes, rebuild with `docker compose build`. Immutable `test`, `web`,
and `apk` services use the source snapshot baked into the image. Interactive
`dev` and `shell` services bind-mount the checkout but resolve packages from the
image. See `CACHING.md` before changing this model.

## E2E input policy

Browser integration tests load `/?e2e=1` and may use the deterministic
`window.__VECTOR_ARCADE_DEBUG__.input` bridge for controller/game state. Do not
replace this with fixed-duration synthetic pointer pulses. Keep at least one
real DOM PointerEvent smoke test against the visible touch overlay so browser
event wiring remains covered. Multi-button chords must be injected atomically
in one page task and assertions should wait on observable state with bounded
`expect.poll(...)` timeouts rather than `waitForTimeout(...)`.
