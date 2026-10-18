# Container caching — Vector Arcade 0.5.0

## npm
npm dependencies are baked into the image at `/opt/vector-arcade-deps`. Only `package*.json` is copied before the dependency install layer, so ordinary source edits reuse that expensive layer. BuildKit also caches npm downloads.

Normal workflow:

```bash
docker compose run --rm --build apk
```

If `package.json` or `package-lock.json` changes, Docker invalidates the dependency layer. With a lockfile it uses `npm ci`; without one it uses `npm install`. A lockfile is required for deterministic direct and transitive dependency resolution.

Force a fresh dependency/image build:

```bash
docker compose build --no-cache
```

Clear BuildKit cache:

```bash
docker builder prune
```

## Gradle
Local APK builds cache Gradle under `.cache/gradle`. Delete only that cache when Gradle downloads become corrupt:

```bash
rm -rf .cache/gradle
mkdir -p .cache/gradle
```

Capacitor's generated wrapper is rewritten to `gradle-*-bin.zip` to avoid downloading Gradle sources/docs.

## Cleanup

```bash
docker compose down --rmi local
```

For a Docker-wide cleanup, use `docker system prune` only when intentionally removing unrelated unused Docker state too.

## WSL
Keep the checkout under `/home/<user>/...` rather than `/mnt/c/...` when possible. Source scanning, Gradle caches, and browser artifacts all benefit from the Linux filesystem.
