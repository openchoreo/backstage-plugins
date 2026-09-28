# @openchoreo/create-portal

Scaffolds a **custom OpenChoreo Portal**: a thin Backstage app that depends on
the published `@openchoreo/backstage-portal-app` and
`@openchoreo/backstage-portal-backend` packages, pinned to one portal release.
You own the generated repo — add plugins, replace pages, re-brand — and
upgrading to the next OpenChoreo release is a single lockstep version bump
plus a small skeleton diff.

## Requirements

- Node.js 20 or 22 and Yarn (`corepack enable`; the scaffold pins its own
  Yarn release under `.yarn/releases`).
- `git` on the `PATH` (optional) — the CLI initializes a repository with an
  initial commit of the untouched template, which later serves as the
  upgrade base.
- An OpenChoreo control plane of the same release to point the portal at.

## Usage

```sh
npx @openchoreo/create-portal
```

The CLI prompts for a name, renders the template, seeds
`app-config.local.yaml` from its example, creates the initial commit, then
runs `yarn install` and `yarn tsc`.

Flags:

| Flag                    | Meaning                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| `--name <name>`         | Portal name (lowercase, digits, dashes); skips the prompt. `OPENCHOREO_PORTAL_NAME` works too. |
| `--path <dir>`          | Scaffold into an existing directory instead of `./<name>`.                                     |
| `--registry <url>`      | npm registry the scaffold resolves `@openchoreo/*` from (default: npmjs).                      |
| `--skip-install`        | Skip `yarn install` + `yarn tsc` after scaffolding.                                            |
| `--template-path <dir>` | Use an external template directory instead of the built-in one.                                |

If `--registry` points at a private registry, set an `npmAuthToken` for the
`openchoreo` scope in your user-level `~/.yarnrc.yml` before installing —
don't commit registry tokens to the scaffold's `.yarnrc.yml`. A plain-`http://`
registry (such as an in-cluster mirror) is added to the scaffold's
`unsafeHttpWhitelist`, since Yarn otherwise refuses to install from it.

## What you get

```text
my-portal/
├── packages/app/            # createPortalApp() — add frontend features here
├── packages/backend/        # portalBackendFeatures + your backend plugins
│   └── Dockerfile           # the same image build the stock portal uses
├── plugins/                 # your in-house plugins (`yarn new`)
├── app-config*.yaml         # stock portal configuration, yours to edit
├── templates/, examples/    # the OpenChoreo scaffolder templates
└── .openchoreo-portal.json  # which template release this repo started from
```

The image is a drop-in replacement for the stock `openchoreo-ui` image: point
the OpenChoreo control-plane Helm chart's `backstage.image.repository` and
`backstage.image.tag` at it.

The generated portal's README covers local development, adding plugins,
branding, image builds, and the upgrade flow against the per-release
[`openchoreo/portal-template`](https://github.com/openchoreo/portal-template)
repo.

## How the template stays current

The template is **rendered from the live monorepo** by
`scripts/generate-template.js` (run automatically at `prepack`, so every
published CLI version carries a template matching its release):

- Most files copy verbatim from the repo (configs, `packages/app` assets,
  scaffolder templates) — monorepo changes flow through automatically.
- `package.json` files are transformed: private packages (the Portal
  Assistant) are stripped and `workspace:^` ranges are pinned to the CLI's
  own version — correct because releases stamp every workspace to one
  version.
- The monorepo `yarn.lock` ships as a seed lockfile, so a scaffold installs
  the dependency set the release was tested with rather than whatever is
  newest on the registry; Yarn prunes the monorepo-only entries on first
  install.
- A few files are owned overrides in `templates-src/` (`App.tsx` without the
  assistant, the scaffold README, the upgrade anchor).

Invariants (no private packages, no unpinned `workspace:` ranges, scaffolder
templates untouched, every `.hbs` renders) are enforced by the generator
itself and by `src/generateTemplate.test.ts`.

## Testing template changes end to end

From the monorepo, render the template and run the CLI straight from source:

```sh
yarn workspace @openchoreo/create-portal generate-template
node packages/create-portal/bin/create-portal --name my-portal --path /tmp/my-portal
```

Until a release containing your changes is published, the scaffold's pinned
`@openchoreo/*` versions won't carry them. To exercise the real release path,
pack the changed packages the way `release.yml` does
(`yarn workspace <pkg> pack`), publish them to a throwaway local registry
such as [Verdaccio](https://verdaccio.org) that proxies npmjs, and scaffold
with `--registry http://localhost:4873`. The generated portal's
`packages/backend/Dockerfile` then builds a deployable image from that
registry (`docker build --network host …`).
