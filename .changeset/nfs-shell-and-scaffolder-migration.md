---
'@openchoreo/backstage-plugin': minor
'@openchoreo/backstage-plugin-openchoreo-observability': minor
'@openchoreo/backstage-plugin-platform-engineer-core': minor
'@openchoreo/backstage-plugin-react': minor
'@openchoreo/backstage-portal-app': minor
---

Complete the New Frontend System migration for the portal shell and
distribute scaffolder field extensions through the base plugin.

**Portal**: `convertLegacyAppRoot` and `Root.tsx` are gone. Themes, icons,
sidebar (`NavContentBlueprint`), provider stack, and every route now
ship as NFS blueprints.

**Adopter-facing additions**:

- `@openchoreo/backstage-plugin/alpha` — `execTerminalPage`, 32
  `FormFieldBlueprint`s for OC template fields, plus new component
  exports (`ScaffolderPreselectionProvider`, `EntityWarningStrip`,
  `ForeignCardsSection`)
- `@openchoreo/backstage-plugin-openchoreo-observability/alpha` —
  `costInsightsPage` with sidebar auto-discovery
- `@openchoreo/backstage-plugin-platform-engineer-core/alpha` —
  `platformOverviewPage` with sidebar auto-discovery; `PlatformOverviewPage`
  source moved from portal-app
- `@openchoreo/backstage-plugin-react` — `useQueryParams` (backwards-compat
  re-export left in `@openchoreo/backstage-plugin`)
