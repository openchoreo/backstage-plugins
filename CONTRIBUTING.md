# Contributing to OpenChoreo Backstage Plugins

Thanks for taking the time to contribute. This guide covers the day-to-day development workflow, the changeset conventions every PR must follow, and the release process for maintainers.

For first-time setup (installing dependencies, configuring `/etc/hosts`, connecting to a local OpenChoreo control plane, and starting the app), see the [README](README.md). The sections below assume you can already run `yarn start` successfully.

## Development workflow

```bash
# Run tests
yarn test           # Changed files only
yarn test:all       # All tests with coverage

# Code quality
yarn lint           # Lint changed files
yarn lint:all       # Lint all files
yarn fix            # Auto-fix issues

# Build
yarn build:all      # Build all packages
yarn tsc            # TypeScript check
```

## Testing with production build

Some issues only appear in production builds. Periodically test with a production build to catch them early:

- **CSS class name mangling**: Material-UI generates descriptive class names in development (e.g., `makeStyles-root-123`) but short, mangled names in production (e.g., `jss1`). Any custom CSS selectors that rely on development class name patterns will silently break in production.
- **Stricter plugin initialization**: Some plugins start without issues when their configuration is missing in development mode, but fail at startup in production mode. For example, the Jenkins plugin tolerates missing config in dev but throws errors in production.

```bash
# Build all packages with production optimizations
yarn build:all

# Start the backend serving the production frontend bundle
NODE_ENV=production yarn workspace backend start

# Access at http://localhost:7007
```

**Note:** This still uses your local development config files (`app-config.yaml` + `app-config.local.yaml`), not `app-config.production.yaml`. The production build behavior (CSS minification, stricter plugin initialization) is determined by `NODE_ENV=production`, not by which config file is loaded.

## Plugin development

To develop individual plugins in isolation:

```bash
yarn workspace {plugin-name} start
```

Example:

```bash
yarn workspace @openchoreo/backstage-plugin-backend start
```

Create new plugins:

```bash
yarn new
```

## Changesets

Every PR that affects a published package **must include a changeset file** under `.changeset/`. A CI job (`Changeset Check`) runs on every PR and fails when no changeset is detected.

### When opening a PR

From the repo root, run:

```bash
yarn changeset
```

The CLI walks you through:

1. **Selecting affected packages** — tick only the package(s) you actually changed. Downstream consumers will be bumped automatically by the `updateInternalDependencies` rule.
2. **Choosing a bump type** for each selected package:
   - `patch` — Bug fixes and internal changes that don't alter the public API.
   - `minor` — New backward-compatible features.
   - `major` — Breaking changes (rare; coordinate with maintainers first).
3. **Writing a short summary** — this string lands verbatim in the package's `CHANGELOG.md` when the next release runs.

Commit the generated `.changeset/<random-name>.md` file alongside your code change in the same PR.

For repo-only changes (docs, internal refactor, CI tweaks), run `yarn changeset --empty` to record the decision and satisfy the CI check.

### Bump types and the linked group

`.changeset/config.json` declares a `linked` group containing every published `@openchoreo/*` package. When `yarn release:version` runs, every package in that group bumps to the **same** new version, using the **highest** bump type seen across all queued changesets. Practically:

- One `minor` changeset anywhere in the queue promotes the whole linked group from `1.1.x` to `1.2.0`.
- If you're targeting a patch release branch (`release-v*`), every changeset in your PR must declare `patch`.
- List only the package(s) you actually touched in the changeset frontmatter; the rest of the linked group propagates automatically.

### The Changeset Check workflow

The `Changeset Check` workflow ([`.github/workflows/changeset-check.yml`](.github/workflows/changeset-check.yml)) runs on every PR targeting `main` or `release-v*` and:

- **Fails** the job (red ✗) when no `.changeset/*.md` file (other than `README.md`) is added or modified in the PR diff.
- **Posts a sticky comment** on the PR explaining how to add a changeset when one is missing, and updates that comment to a confirmation once a changeset is added.
- **Is not a required status check.** Reviewers can still merge with the ✗ if the change genuinely doesn't need a release entry — but the expectation is that you add either a real changeset or an empty one (`yarn changeset --empty`) so the intent is recorded.

## Releasing

Releases are tag-driven. Pushing a `v*.*.*` tag triggers the [release workflow](.github/workflows/release.yml), which publishes every public `@openchoreo/*` package to the **public npm registry** and then retags the Docker image in GHCR.

**There are no publish secrets.** Authentication is [npm trusted publishing](https://docs.npmjs.com/trusted-publishers): the workflow mints a short-lived OIDC token (`id-token: write`) that npm exchanges for a publish credential. npm only accepts it from `openchoreo/backstage-plugins`, from `release.yml`, in the `npm-publish` environment — a trusted publisher is configured per package with those exact claims. As a side effect every published version gets a signed [provenance attestation](https://docs.npmjs.com/generating-provenance-statements).

Two consequences worth knowing:

- **Renaming `release.yml`, or the `npm-publish` environment, breaks publishing** until every package's trusted publisher is reconfigured (`npm trust github @openchoreo/<pkg> --repository openchoreo/backstage-plugins --file release.yml --environment npm-publish --allow-publish`). npm does not validate the config when it is saved, and a mismatch surfaces as a misleading `404` on publish, not an auth error.
- **Publishing requires Yarn >= 4.10**, which is where `yarn npm publish` learned the OIDC exchange. Do not downgrade the pinned Yarn version.

### Cutting a release

1. **Accumulate changesets** as PRs land on `main`. Run `yarn changeset` whenever a PR introduces a user-visible change; commit the generated `.changeset/*.md` file.

2. **Open a "Version Packages" PR** when ready to release:

   ```bash
   git checkout -b release/version-bump
   yarn release:version   # consumes .changeset/*.md, bumps versions, regenerates CHANGELOGs
   git add -A && git commit -m "chore: version packages"
   git push -u origin release/version-bump
   ```

   Every package in the `linked` group in `.changeset/config.json` bumps together. Review the PR carefully — version bumps are inferred from the changeset bump types (`patch` / `minor` / `major`).

3. **Merge** the version PR to `main`.

4. **Tag the merge commit and push**:

   ```bash
   git checkout main && git pull
   git tag v0.4.0           # stable release
   # or: git tag v0.4.0-rc.1  # prerelease
   git push origin v0.4.0
   ```

5. **Approve the publish**. The `publish-npm` job targets the protected `npm-publish` environment and waits in _Waiting_ until a required reviewer approves it from the workflow run page. Nothing is published — and no OIDC token is minted — before that approval.

6. **CI publishes**. The release workflow:
   - `publish-npm`: runs `yarn install --immutable && yarn tsc && yarn build:all`, then `yarn workspaces foreach --all --no-private --topological --verbose npm publish --tolerate-republish --access public --tag <latest|next|release-X.Y>`.
   - `retag-image`: only after `publish-npm` succeeds, retags the existing Docker image (built earlier on the `main` push) to `vX.Y.Z` in GHCR. Ordering matters — a failed publish must not leave a `vX.Y.Z` image without the matching packages.
   - On **stable** tags (`vX.Y.Z`) publishes under the `latest` npm dist-tag.
   - On **prerelease** tags (`vX.Y.Z-rc.N`, `vX.Y.Z-test.N`, etc. — any tag containing a hyphen) publishes under the `next` dist-tag, leaving `latest` untouched.
   - On a **back-line** stable tag (a `vX.Y.Z` that is not the highest stable tag) publishes under `release-X.Y`, so re-releasing an older line never steals `latest` from a newer one.

`yarn npm publish` (not `npm publish` or `changeset publish`) is required so that Yarn Berry rewrites `workspace:^` deps to concrete versions at pack time. `npm publish` and `changeset publish` (which shells out to `npm publish` on non-pnpm repos) leak `workspace:^` strings into the tarball and break installs for external consumers.

### Verifying a release

Query the exact version you just released, not the bare package name — a bare
name resolves the `latest` dist-tag, which a prerelease deliberately does not
move, so it would report the previous release as if nothing had happened.

```bash
VERSION=1.3.0-rc.1   # the version just released, without the leading v

yarn npm info "@openchoreo/backstage-plugin@${VERSION}"
yarn npm info "@openchoreo/backstage-design-system@${VERSION}"
```

Both should show that version. Then confirm the dist-tags moved as intended — stable releases move `latest`, prereleases move `next`:

```bash
npm view @openchoreo/backstage-plugin dist-tags
```

To confirm `workspace:^` rewriting worked, inspect the `dependencies` field of any published `@openchoreo/*` package — every version specifier should be a concrete range (e.g. `^1.1.0`), never `workspace:^`.

Confirm provenance was attached:

```bash
npm view "@openchoreo/backstage-plugin@${VERSION}" dist.attestations
```

This prints the attestation block when provenance is present and nothing at all when it is absent. (Avoid `npm view --json | jq '.dist.attestations'` — without a pinned version npm may return an array of matching versions rather than a single object, and the `jq` path silently yields `null` on npm 12.)

Output means the OIDC path worked. Empty output means the package was published without provenance — investigate before shipping the release.

Finally, prove an unauthenticated consumer can install it. In a scratch directory with no `.npmrc` and no npm login:

```bash
yarn add @openchoreo/backstage-plugin@next
```

### Re-running a tag

The publish step is idempotent — `--tolerate-republish` makes `yarn npm publish` skip packages whose versions already exist on the registry and exit cleanly. Useful when a transient failure leaves some packages published and others not. Re-running still requires a fresh environment approval.

### Registry history

`@openchoreo/*` packages were published to GitHub Packages (`https://npm.pkg.github.com`) until the move to public npm. Versions from `1.1.0` through the `1.2.x` line were copied across by [`scripts/migrate-gh-packages-to-npmjs.js`](scripts/migrate-gh-packages-to-npmjs.js) and carry no provenance attestation (they predate trusted publishing). Versions older than `1.1.0` were not migrated and remain available only from GitHub Packages, which is now frozen and receives no new releases. Everything from `1.3.0` onward is published to npm by CI with provenance.

### One-time local dry run

Before the first real release, validate the publish path locally. Yarn Berry's `yarn npm publish` does not accept a `--dry-run` flag, so the equivalent offline check is `yarn pack` on every public workspace — `yarn pack` runs the same workspace-protocol rewriter that `yarn npm publish` does, just stopping before the upload:

```bash
yarn install --immutable
yarn tsc
yarn build:all
yarn workspaces foreach --all --no-private --topological --verbose pack
```

Then confirm a sample tarball has no `workspace:` leaks in its `dependencies`:

```bash
cd plugins/openchoreo
tar -xzf package.tgz package/package.json -O | \
  python3 -c "import json,sys; d=json.load(sys.stdin).get('dependencies',{}); leaks={k:v for k,v in d.items() if str(v).startswith('workspace:')}; print('workspace: leaks:', leaks if leaks else 'NONE')"
rm package.tgz
```

Expected output: `workspace: leaks: NONE`. Repeat for any other plugin to spot-check. `yarn pack` writes a `package.tgz` next to each workspace's `package.json`; clean them up with `find packages plugins -maxdepth 2 -name package.tgz -delete` when done.
