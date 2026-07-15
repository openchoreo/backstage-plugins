---
'@openchoreo/backstage-design-system': patch
'@openchoreo/backstage-plugin': patch
---

Fix sidebar section separators rendering as dark near-black lines in production
builds. The softening rule targeted the divider by its `BackstageSidebarDivider-root`
class prefix, which JSS mangles away in the production bundle; it now targets the
sidebar-nav `hr` element directly, so the light-mode divider stays a subtle grey in
both dev and prod.
