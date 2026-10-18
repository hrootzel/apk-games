# Testing — Vector Arcade 0.5.0

## Canonical commands

```bash
docker compose run --rm --build test
docker compose run --rm --build apk
```

The second command reruns the quality gate before Android assembly. GitHub CI avoids duplicate tests by running `test` once and then invoking `scripts/assemble-android.sh` directly.

## Coverage areas

Unit tests cover Asteroids, Tempest, Phosphor Swarm, registry/menu state, touch profiles and analog math, phosphor timing, and both graphics/input setting defaults. Phosphor Swarm tests include independent movement/aim, continuous fire, dash edge behavior, pulse bomb, repulsor physics, bullet collisions/scoring, particle lifetime, warped-grid geometry, and state round-trip.

Playwright runs headed Chromium under Xvfb with ANGLE/SwiftShader. It exercises real Pixi/WebGL boot, menu/configuration, all three games, deterministic multi-input through the `?e2e=1` bridge, at least one real PointerEvent overlay path, touch profile switching, cancellation/focus cleanup, Start/Select shell behavior, and portrait/landscape layout.

## Failure artifacts

Browser artifacts are written directly to:

```text
out/test-results/
out/playwright-report/
```

Coverage is copied on failure to:

```text
out/test-artifacts/coverage/
```

Android/Gradle reports are preserved on assembly failure under:

```text
out/android-reports/
```

CI uploads these paths only on failure with one-day retention.
