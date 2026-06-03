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

Releases are tag-driven. Pushing a `v*.*.*` tag triggers the [release workflow](.github/workflows/release.yml), which retags the Docker image in GHCR **and** publishes every public `@openchoreo/*` package to GitHub Packages (`https://npm.pkg.github.com`). Authentication uses the auto-issued `GITHUB_TOKEN` — no extra secrets needed.

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

5. **CI publishes**. The release workflow:
   - Retags the existing Docker image (built earlier on the `main` push) to `vX.Y.Z` in GHCR.
   - Runs `yarn install --immutable && yarn tsc && yarn build:all`, then `yarn workspaces foreach --all --no-private --topological --verbose npm publish --tolerate-republish --access public --tag <latest|next>` to publish npm packages to GitHub Packages.
   - On **stable** tags (`vX.Y.Z`) publishes under the `latest` npm dist-tag.
   - On **prerelease** tags (`vX.Y.Z-rc.N`, `vX.Y.Z-test.N`, etc. — any tag containing a hyphen) publishes under the `next` dist-tag, leaving `latest` untouched.

`yarn npm publish` (not `npm publish` or `changeset publish`) is required so that Yarn Berry rewrites `workspace:^` deps to concrete versions at pack time. `npm publish` and `changeset publish` (which shells out to `npm publish` on non-pnpm repos) leak `workspace:^` strings into the tarball and break installs for external consumers.

### Verifying a release

```bash
yarn npm info @openchoreo/backstage-plugin --registry=https://npm.pkg.github.com
yarn npm info @openchoreo/backstage-design-system --registry=https://npm.pkg.github.com
```

Both should show the new version. Confirm under `dist-tags` that stable releases moved `latest` and prereleases moved `next`. To confirm `workspace:^` rewriting worked, inspect the `dependencies` field of any published `@openchoreo/*` package — every version specifier should be a concrete range (e.g. `^1.1.0`), never `workspace:^`.

### Re-running a tag

The publish step is idempotent — `--tolerate-republish` makes `yarn npm publish` skip packages whose versions already exist on the registry and exit cleanly. Useful when a transient failure leaves some packages published and others not.

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
