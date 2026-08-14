---
'@openchoreo/backstage-plugin': minor
'@openchoreo/backstage-plugin-openchoreo-ci': patch
'@openchoreo/backstage-plugin-openchoreo-observability': patch
'@openchoreo/backstage-plugin-openchoreo-workflows': patch
'@openchoreo/backstage-portal-app': patch
---

Entity pages fully migrated to the Backstage New Frontend System. The hand-authored `EntityPage.tsx` in `packages/portal-app` is gone; tabs, cards, per-kind Overview layouts, and delete / annotation context menu items now ship as NFS blueprints from the plugins.

- Adopters who install `@openchoreo/backstage-plugin` (and the CI / observability / workflows siblings) get the same OpenChoreo tabs and Overview grids as the OpenChoreo portal, automatically. No hand-authored `EntityPage.tsx` required.
- New export: `openChoreoEntityPageOverride` from `@openchoreo/backstage-plugin/alpha`. Add it to your `createApp({ features: [...] })` to also get the OpenChoreo compact header + styled tab bar. Omit it to keep vanilla Backstage chrome — tabs and Overview layouts still work either way. `createPortalApp` in `@openchoreo/backstage-portal-app` includes it by default.
- New public exports from `@openchoreo/backstage-plugin`: `OpenChoreoAboutCard`, `ContainedCatalogGraphCard`, `EntityRelationWarning` (previously portal-internal, now shipped as React components).
- New NFS blueprints registered: 2 `EntityContextMenuItemBlueprint`s (Delete, Edit Annotations), 18 `EntityContentLayoutBlueprint`s (one per OC-owned kind), plus `group` annotations on every existing `EntityContentBlueprint` for tab-ordering support.
- See the README's Installation section for the recommended `app.pages.entity.config` block and per-extension override examples.
