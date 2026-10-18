# Docker caching and cleanup

Vector Arcade v0.4.4 keeps JavaScript dependencies **inside the Docker image**.
There is no persistent `node_modules` Docker volume and the normal test/APK
container startup does not run `npm ci` or `npm install`.

## What is cached

The Dockerfile copies only `package.json` / `package-lock.json` before installing
npm dependencies. Therefore ordinary edits to `src/`, `tests/`, shaders, HTML,
or scripts do not invalidate the dependency layer.

The dependency install also uses a Docker BuildKit cache mounted at
`/home/node/.npm`. If dependency metadata changes and npm must run again, package
tarballs already downloaded by previous image builds can normally be reused.

Playwright Chromium and the Android SDK are also image layers, so they are not
reinstalled by `docker compose run`.

The Android APK service keeps one explicit host-visible cache:

```text
.cache/gradle/
```

This stores Gradle distributions/dependencies between APK runs. It is deliberately
not a hidden Docker volume, so its state and cleanup are obvious.

## Normal workflow

After changing application source:

```bash
docker compose run --rm --build test
# or
docker compose run --rm apk
```

The source snapshot used by `test`, `web`, and `apk` is baked into the image.
That means **rebuild the image after source changes**. The npm dependency layer
will still be a cache hit unless package metadata changed.

For interactive development, `dev` and `shell` bind-mount the live WSL checkout
at `/workspace`, while resolving dependencies from the image at
`/opt/vector-arcade-deps`.

```bash
docker compose up --build dev
```

## GitHub Actions cache

`.github/workflows/ci.yml` uses Docker Buildx with GitHub Actions layer caching
(`type=gha`, scope `vector-arcade`). It loads the resulting image into the runner's
Docker daemon under the tag read from Compose, then runs the `test` service with
`--pull never` so the gate tests that exact source snapshot.

The cache reuses image layers, including the installed SDK, browser, Java, and npm
dependencies. BuildKit's npm cache mount is not exported by this layer cache;
when package metadata changes, npm may need to download packages again. Cache
availability affects build speed, not which checks run. No cache or registry
credentials need to be configured manually.

## CI artifact retention and storage limits

The workflow uploads diagnostics only when the test step fails, with a one-day
retention period. The HTML browser report already includes its diagnostic data,
so CI does not also upload the duplicate raw `out/test-results` directory.
Successful runs upload no test reports. Docker's automatic `.dockerbuild`
artifact upload is disabled via `DOCKER_BUILD_RECORD_UPLOAD=false`; its console
logs and build summary remain enabled. Images are loaded locally on the runner
and are not published or archived as artifacts.

The layer cache remains enabled. Keep GitHub's repository cache size eviction
limit at or below the included 10 GB rather than opting into paid extra storage.
A fixed BuildKit scope does not impose a byte limit: GitHub can hold cache entries
for multiple branch/PR refs. GitHub's configured cache eviction limit bounds that
storage. See [cache usage limits](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching#usage-limits-and-eviction-policy).

Artifact retention and cache settings are separate from account billing controls.
Use [Budgets and alerts](https://docs.github.com/en/billing/how-tos/set-up-budgets)
with a stop-usage budget for Actions and review cache storage budgets to constrain
paid overages. Existing artifacts keep their previous expiration unless deleted;
removing them stops future storage accrual but does not reverse past usage.
No account settings or existing artifacts are changed by this workflow update.

## Shell script permissions across WSL and GitHub

Git tracks the shell scripts as non-executable files (`100644`). WSL checkouts
under `/mnt/c` can expose executable permissions that a fresh Linux Git checkout
does not. The base Node image treats a non-executable command as a JavaScript
entrypoint, causing `ERR_UNKNOWN_FILE_EXTENSION` for `.sh` files.

Compose services, npm's E2E command, and nested script calls invoke `bash`
explicitly so neither CI nor bind-mounted development requires executable bits.
`.gitattributes` keeps shell scripts LF-terminated across Windows checkouts. After
changing these commands, rebuild with `docker compose build` before testing.
The APK script still runs the complete test gate before Gradle.

## Dependency changes

After changing `package.json` or `package-lock.json`:

```bash
docker compose build
```

Docker invalidates the dependency layer automatically and reruns npm.

A committed `package-lock.json` is strongly recommended. If it exists, the image
uses `npm ci`. Without one it falls back to `npm install`, which is less
reproducible.

## Cleanup / recovery

### Force a completely fresh npm dependency layer

Use when dependency state looks suspicious or after a major Node/npm change:

```bash
docker compose build --no-cache
```

This ignores all Docker image layers for that rebuild.

### Clear only Docker BuildKit's build cache

This removes cached npm downloads and other build-step caches, but does not
remove your source tree:

```bash
docker builder prune
```

Docker will ask for confirmation. To skip the prompt:

```bash
docker builder prune -f
```

### Clear only the persistent Gradle cache

Safe when Gradle reports corrupt downloads or strange dependency state:

```bash
rm -rf .cache/gradle
mkdir -p .cache/gradle
```

The next APK build downloads the required Gradle artifacts again.

### Remove this project's containers and local image

```bash
docker compose down --rmi local
```

No `node_modules` volume exists to clean up.

### Full Docker cleanup

Only use this when you intentionally want to remove unused Docker-wide state:

```bash
docker system prune
```

This affects more than Vector Arcade. Add `-a` only if you explicitly want to
remove all unused images as well.

## WSL filesystem recommendation

Keep the checkout in the WSL Linux filesystem, for example:

```text
/home/<user>/projects/vector-arcade
```

rather than `/mnt/c/...`. Even though `node_modules` is now inside the image,
Vite, test artifacts, Gradle outputs, and source scanning still benefit from the
Linux filesystem.

## How to verify the npm cache is working

Run twice without changing package metadata:

```bash
docker compose build
```

On the second build the dependency-install step should display `CACHED` in the
BuildKit output. Also, `docker compose run --rm apk` should proceed directly to
the test/typecheck pipeline; it should **not** print an npm install spinner or
the `uuid@7.0.3` warning at container startup.

## EACCES during the image dependency layer

If an older v0.4.3 image fails with an error like:

```text
EACCES: permission denied, mkdir '/opt/vector-arcade-deps/node_modules'
```

that image was built from the original v0.4.3 Dockerfile, where Docker created
`/opt/vector-arcade-deps` as root before `npm ci` switched to the `node` user.
The hotfix explicitly creates that directory as `node:node` first.

After applying the hotfix, rebuild the image once:

```bash
docker compose build --no-cache
```

`--no-cache` is recommended for this one transition so Docker cannot reuse the
broken dependency layer. After this successful rebuild, return to the normal
cached workflow:

```bash
docker compose run --rm --build apk
```

You do **not** need to delete the BuildKit npm cache for this error. The npm
cache contents are independent of the directory ownership problem.

## Java 21 and Gradle wrapper

Capacitor 8 compiles its Android modules with Java 21. The image therefore
installs Microsoft OpenJDK 21 late in the Dockerfile and sets `JAVA_HOME` to
`/opt/jdk21`. `scripts/build-apk.sh` prints `java -version`/`javac -version` and
fails before Gradle if the compiler major version is below 21.

The APK script also changes Capacitor's generated Gradle wrapper URL from the
`-all.zip` distribution to `-bin.zip`. The binary distribution is sufficient
for container builds and avoids downloading/unpacking Gradle documentation and
sources.

After applying the JDK fix, a normal `docker compose build` is sufficient.
Docker can reuse all unchanged layers above the new Java-21 layer. Use
`--no-cache` only if you intentionally want to discard all image-layer caches.
