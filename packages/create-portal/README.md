# @openchoreo/create-portal

Scaffolds a **custom OpenChoreo Portal**: a thin Backstage app that depends on
the published `@openchoreo/backstage-portal-app` and
`@openchoreo/backstage-portal-backend` packages, pinned to one portal release.
You own the generated repo — add plugins, replace pages, re-brand — and
upgrading to the next OpenChoreo release is a single lockstep version bump
plus a small skeleton diff.

## Usage

```sh
npx @openchoreo/create-portal
```

Flags:

| Flag                    | Meaning                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| `--name <name>`         | Portal name (lowercase, digits, dashes); skips the prompt. `OPENCHOREO_PORTAL_NAME` works too. |
| `--path <dir>`          | Scaffold into an existing directory instead of `./<name>`.                                     |
| `--registry <url>`      | npm registry the scaffold resolves `@openchoreo/*` from (default: npmjs).                      |
| `--skip-install`        | Skip `yarn install` + `yarn tsc` after scaffolding.                                            |
| `--template-path <dir>` | Use an external template directory instead of the built-in one.                                |

If `--registry` points at a private registry, add an `npmAuthToken` under
`npmScopes.openchoreo` in the scaffold's `.yarnrc.yml` before installing.

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
- A few files are owned overrides in `templates-src/` (`App.tsx` without the
  assistant, the scaffold README, the upgrade anchor).

Invariants (no private packages, no unpinned `workspace:` ranges, scaffolder
templates untouched, every `.hbs` renders) are enforced by the generator
itself and by `src/generateTemplate.test.ts`.
