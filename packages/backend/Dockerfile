ARG BUILD_IMAGE=docker.io/node:22-bookworm-slim@sha256:813a7480f28fdadac1f7f5c824bcdad435b5bc1322a5968bbbdef8d058f9dff4
# Google distroless doesn't have tags for minor and patches which forces to float
# creating the same possible regression scenarios introduced in 22.23.0 
# as a result of a patch for CVE-2026-48931 which broke OpenChoreo
# see https://github.com/openchoreo/backstage-plugins/pull/657
# To solve this Minimus distroless can be used instead of Google distroless
ARG RUNTIME_IMAGE=reg.mini.dev/node:v22.23.1@sha256:0da07560ce5c76bbedfc20f26ad14f27b063c705e9c906981b8c4ecde0f7daf7

# ---------------------------------------------------------------------------
# Stage 1 - Install all dependencies, compile TypeScript, build backend
# ---------------------------------------------------------------------------
FROM ${BUILD_IMAGE} AS build

ENV PYTHON=/usr/bin/python3 \
    JOBS=max

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    python3 g++ build-essential libsqlite3-dev

USER node
WORKDIR /app

# Copy package manifests and yarn config first so the install layer
# caches until a dependency actually changes.
COPY --chown=node:node backstage.json package.json yarn.lock .yarnrc.yml ./
COPY --chown=node:node .yarn ./.yarn
COPY --chown=node:node packages packages
COPY --chown=node:node plugins plugins
RUN find packages \! -name "package.json" -mindepth 2 -maxdepth 2 -exec rm -rf {} \+

RUN --mount=type=cache,target=/app/.yarn/cache,sharing=locked,uid=1000,gid=1000 \
    yarn install --immutable

COPY --chown=node:node . .

RUN yarn tsc && yarn --cwd packages/backend build

RUN mkdir packages/backend/dist/skeleton packages/backend/dist/bundle \
    && tar xzf packages/backend/dist/skeleton.tar.gz -C packages/backend/dist/skeleton \
    && tar xzf packages/backend/dist/bundle.tar.gz -C packages/backend/dist/bundle


# ---------------------------------------------------------------------------
# Stage 2 - Production-only dependencies from the skeleton
# ---------------------------------------------------------------------------
# Native addons (better-sqlite3, isolated-vm) recompile during focus,
# so build tooling is needed here too.
FROM ${BUILD_IMAGE} AS deps

ENV PYTHON=/usr/bin/python3

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    python3 g++ build-essential libsqlite3-dev

USER node
WORKDIR /app

COPY --from=build --chown=node:node /app/.yarn ./.yarn
COPY --from=build --chown=node:node /app/.yarnrc.yml ./
COPY --from=build --chown=node:node /app/backstage.json ./
COPY --from=build --chown=node:node /app/yarn.lock /app/package.json /app/packages/backend/dist/skeleton/ ./

ENV NODE_ENV=production

# Yarn berry non-global cache is at ./.yarn/cache by default
# workspaces focus --production replaces the removed yarn install --production.
RUN --mount=type=cache,target=/app/.yarn/cache,sharing=locked,uid=1000,gid=1000 \
    yarn workspaces focus --all --production

# Strip tests, sourcemaps, config lint and other miscellaneous files from node_modules.
RUN find . -type d -name node_modules -prune | xargs -I NM \
    find NM \( \
    -type d \( \
    -name test -o -name tests -o -name __tests__ -o -name powered-test \
    -o -name examples -o -name example -o -name benchmark -o -name benchmarks \
    -o -name coverage -o -name .nyc_output \
    -o -name .idea -o -name .vscode -o -name .github \
    -o -name .circleci -o -name .husky \
    \) \
    -o -type f \( \
    -name '*.md' -o -name '*.map' \
    -o -name '*.tgz' -o -name '*.swp' \
    -o -name 'CHANGELOG*' -o -name 'AUTHORS*' -o -name 'CONTRIBUTORS*' \
    -o -name 'Makefile' -o -name 'Gulpfile.js' -o -name 'Gruntfile.js' \
    -o -name '.DS_Store' -o -name 'tsconfig*.json' -o -name '*.tsbuildinfo' \
    -o -name '.eslintrc*' -o -name '.eslintignore' \
    -o -name '.prettierrc*' -o -name '.prettierignore' \
    -o -name '.babelrc*' -o -name 'jest.config.*' \
    -o -name '.gitignore' -o -name '.npmignore' -o -name '.npmrc' \
    -o -name '.yarn-integrity' -o -name '.yarn-metadata.json' \
    \) \
    \) -prune -exec rm -rf {} \+

# ---------------------------------------------------------------------------
# Stage 3 - Distroless runtime
# ---------------------------------------------------------------------------
FROM ${RUNTIME_IMAGE} AS final

WORKDIR /app

COPY --from=deps --chown=1000:1000 /app/package.json ./
COPY --from=deps --chown=1000:1000 /app/node_modules ./node_modules
COPY --from=deps --chown=1000:1000 /app/packages ./packages
COPY --from=build --chown=1000:1000 /app/packages/backend/dist/bundle/ ./
COPY --chown=1000:1000 app-config.production.yaml ./app-config.yaml
COPY --chown=1000:1000 templates/ ./templates
COPY --chown=1000:1000 catalog-entities/ ./catalog-entities

ENV NODE_ENV=production \
    NODE_OPTIONS="--no-node-snapshot"

USER 1000

CMD ["packages/backend"]