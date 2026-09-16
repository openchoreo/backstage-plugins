---
'@openchoreo/backstage-plugin': minor
'@openchoreo/backstage-plugin-openchoreo-ci': patch
'@openchoreo/backstage-plugin-openchoreo-observability': patch
---

Ship the OpenChoreo frontend integration surface out of the base plugin so
adopters no longer copy-paste boilerplate into their `packages/app/`.
`@openchoreo/backstage-plugin/alpha` now exports:

- **`openChoreoAppModule`** — a `createFrontendModule({ pluginId: 'app' })`
  that wraps the app root in `OpenChoreoQueryProvider` and overrides
  `fetchApiRef` + `permissionApiRef` with the OpenChoreo IDP-token-aware
  implementations. Previously each adopter had to hand-copy the
  `OpenChoreoFetchApi` / `OpenChoreoPermissionApi` classes plus three
  `ApiBlueprint.make(...)` factories (~150 lines) into a local
  `customAppModule.tsx`.
- **`openChoreoEntityGroupsModule`** — an opt-in
  `createFrontendModule({ pluginId: 'catalog' })` that overrides
  `page:catalog/entity`'s `groupDefinitions` with the canonical OpenChoreo
  tab order (Definition → Build → Deploy → Cell Diagram → …). Every OC tab
  uses a unique `group:` key so the vanilla NFS dropdown-collapse never
  triggers and tabs render flat. Non-OC entity pages are unaffected — the
  six upstream default group names are retained in their vanilla relative
  order.
- **`openChoreoAuthApiRef`**, **`OpenChoreoFetchApi`**,
  **`OpenChoreoPermissionApi`** — surfaced as public exports so
  `customAppModule.tsx` can reference them without local re-declaration.
- **`openchoreo:inject-user-token`** scaffolder form decorator — now
  registered automatically as a `FormDecoratorBlueprint` extension.
  Templates that opt in via `EXPERIMENTAL_formDecorators` in their spec get
  the signed-in user's IDP token injected as the `OPENCHOREO_USER_TOKEN`
  template secret with no adopter-side wiring.

Group values on OpenChoreo entity content tabs were also uniqued across the
three plugins (`deployment` → `deploy` / `build` / `cell-diagram` /
`diagram`, `runtime` → `logs` / `events` / `metrics` / `alerts` /
`wirelogs`, `analysis` → `traces` / `incidents` / `rca-reports` /
`cost-analysis`). Combined with `openChoreoEntityGroupsModule` this
guarantees flat tab rendering under vanilla NFS chrome.

Portal-app is unchanged for users. Internally, the plugin-owned modules
replace ~200 lines of previously-hand-copied wiring in
`packages/portal-app/src/apis/customOverrides.tsx` and
`packages/portal-app/src/appModule.tsx`, and the standalone
`openChoreoTokenDecorator.ts` file in `packages/portal-app/src/scaffolder/`
is deleted.
