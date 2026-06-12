# @openchoreo/backstage-plugin

## 1.2.0-next.0

### Patch Changes

- e809b2d: Limit the condition action selector to actions compatible with the current selection, so only actions sharing a condition attribute are offered.
- c7c41b7: Disable the primary action (Create Release / Save Overrides / Deploy) on
  the deploy flow while an environment variable or file mount row is in
  edit mode, so users can't submit a half-typed row with an empty key or
  value.
- 84cfaeb: Auto-select a default card in the Environments deploy graph instead of
  landing users on an empty detail panel: first env with an active or
  pending deployment, else the first failed env, else the first undeployed
  env, falling back to the Setup card when only never-deployed envs exist.
  Only applies while nothing is selected, so it never overrides a manual
  choice.
- c6f1de1: Rework the Environments setup card auto-deploy experience: searchable
  release dropdown with a primary "New release" CTA, an empty-state
  panel for brand-new components, an optimistic auto-deploy toggle with
  inline "Saving…" feedback and permission-aware error handling, and a
  controller-truth "Last deployed release" row that polls for the new
  release after a save.
- 8d8bd80: Upgrade the OpenChoreo Backstage plugin suite to Backstage v1.51.0.

  This bump aligns every `@backstage/*` peer dependency with the v1.51.0 line and adapts the plugins to the API shapes introduced across v1.44–v1.51. Adopters running the OpenChoreo plugins on a host Backstage app must be on Backstage v1.51.0 (or newer) after this release; older host versions will hit peer-dep mismatches.

  Notable adapter-side changes:

  - Scaffolder backend actions now use the v4.0 `schema.input: { field: z => z.type(...) }` field-per-arrow shape introduced after v1.43.3.
  - Permission rules inline their `paramsSchema` at the `createPermissionRule` call site and import Zod via `zod/v3` to match what `@backstage/plugin-permission-node@0.11.0` was compiled against.
  - The catalog backend module reads `catalogProcessingExtensionPoint` from the stable export (no `/alpha`) and registers permission rules through `coreServices.permissionsRegistry`.
  - React 18 + Node 22 are required at runtime, in line with Backstage v1.50+.

- Updated dependencies [529f13c]
- Updated dependencies [1207eda]
- Updated dependencies [7c76d05]
- Updated dependencies [8d8bd80]
  - @openchoreo/backstage-plugin-common@1.2.0-next.0
  - @openchoreo/backstage-plugin-react@1.2.0-next.0
  - @openchoreo/backstage-design-system@1.2.0-next.0

## 1.1.1

- Display resource entities in the project overview page. (#590)
- Runtime network observability toggle added to the cell diagram. (#578)
- Resource Deploy actions gated on environment-scoped permissions. (#577)

## 1.1.0

- Initial public release on GitHub Packages, aligned with the OpenChoreo platform release line (`1.1.0`).
