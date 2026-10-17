FROM node:22-bookworm

ARG ANDROID_CMDLINE_TOOLS=13114758
ARG PLAYWRIGHT_VERSION=1.64.0
ENV DEBIAN_FRONTEND=noninteractive \
    ANDROID_HOME=/opt/android-sdk \
    ANDROID_SDK_ROOT=/opt/android-sdk \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PATH=/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools:${PATH}

USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
      openjdk-17-jdk-headless \
      ca-certificates \
      git \
      unzip \
      wget \
    && rm -rf /var/lib/apt/lists/*

# Install the exact Chromium build + Linux libraries matched to our pinned
# Playwright test runner. This also provides software WebGL (SwiftShader) in CI.
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

WORKDIR /workspace
USER node
CMD ["bash"]
