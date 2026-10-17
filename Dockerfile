# syntax=docker/dockerfile:1.7
FROM node:22-bookworm

ARG ANDROID_CMDLINE_TOOLS=13114758
ARG PLAYWRIGHT_VERSION=1.64.0
ENV DEBIAN_FRONTEND=noninteractive \
    ANDROID_HOME=/opt/android-sdk \
    ANDROID_SDK_ROOT=/opt/android-sdk \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    VECTOR_ARCADE_DEPS=/opt/vector-arcade-deps \
    PATH=/opt/vector-arcade-deps/node_modules/.bin:/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools:${PATH} \
    NODE_PATH=/opt/vector-arcade-deps/node_modules

USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
      openjdk-17-jdk-headless \
      ca-certificates \
      git \
      unzip \
      wget \
      xvfb \
      xauth \
    && rm -rf /var/lib/apt/lists/*

# Install the exact Chromium build + Linux libraries matched to our pinned
# Playwright test runner. Browser binaries are part of the image and are not
# downloaded again by docker compose run.
RUN npx -y playwright@${PLAYWRIGHT_VERSION} install --with-deps chromium \
    && chmod -R a+rX ${PLAYWRIGHT_BROWSERS_PATH}

RUN mkdir -p ${ANDROID_HOME}/cmdline-tools \
    && wget -q "https://dl.google.com/android/repository/commandlinetools-linux-${ANDROID_CMDLINE_TOOLS}_latest.zip" -O /tmp/cmdline-tools.zip \
    && unzip -q /tmp/cmdline-tools.zip -d /tmp/android-tools \
    && mv /tmp/android-tools/cmdline-tools ${ANDROID_HOME}/cmdline-tools/latest \
    && rm -rf /tmp/android-tools /tmp/cmdline-tools.zip \
    && yes | sdkmanager --licenses >/dev/null || true

RUN sdkmanager \
      "platform-tools" \
      "platforms;android-36" \
      "build-tools;35.0.0" \
    && chown -R node:node ${ANDROID_HOME} ${PLAYWRIGHT_BROWSERS_PATH}

# ---------------------------------------------------------------------------
# NPM dependencies are baked into their own image layer.
#
# Only package metadata is copied before npm runs. Normal source edits therefore
# do not invalidate this layer. BuildKit also keeps npm's download cache between
# dependency-layer rebuilds.
#
# WORKDIR creates a missing directory as root. Create the dependency workspace
# explicitly first so the non-root `node` user can create node_modules there.
# COPY --chown changes copied files, but does not change the ownership of the
# parent directory itself.
# ---------------------------------------------------------------------------
USER root
RUN install -d -o node -g node -m 0755 ${VECTOR_ARCADE_DEPS}
WORKDIR ${VECTOR_ARCADE_DEPS}
COPY --chown=node:node package*.json ./
USER node
RUN --mount=type=cache,target=/home/node/.npm,uid=1000,gid=1000,sharing=locked \
    if [ -f package-lock.json ]; then \
      echo "[image deps] package-lock.json found; running npm ci"; \
      npm ci --prefer-offline --no-audit --no-fund; \
    else \
      echo "[image deps] no package-lock.json; running npm install"; \
      npm install --prefer-offline --no-audit --no-fund; \
    fi

# Let Node/Vite resolve bare imports from bind-mounted /workspace source while
# keeping node_modules outside that bind mount. npm scripts find executables via
# PATH above; module resolution can walk up to /node_modules.
USER root
RUN ln -s ${VECTOR_ARCADE_DEPS}/node_modules /node_modules \
    && mkdir -p /workspace /workspace/out /workspace/.cache/gradle \
    && chown -R node:node /workspace

# Bake a source snapshot for immutable test/web/apk services. dev and shell
# overlay /workspace with the host checkout, but still reuse image dependencies.
WORKDIR /workspace
COPY --chown=node:node . .

USER node
CMD ["bash"]
