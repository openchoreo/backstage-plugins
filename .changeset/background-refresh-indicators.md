---
'@openchoreo/backstage-design-system': patch
'@openchoreo/backstage-plugin-react': patch
'@openchoreo/backstage-plugin': patch
'@openchoreo/backstage-plugin-platform-engineer-core': patch
'@openchoreo/backstage-plugin-openchoreo-observability': patch
'@openchoreo/backstage-plugin-openchoreo-ci': patch
'@openchoreo/backstage-plugin-openchoreo-workflows': patch
---

Show a subtle background-refresh indicator on cached views instead of swapping
data in silently.

Adds a shared `RefreshOverlay` primitive to the design system — a small
top-right spinner (or thin top bar) that overlays a positioned container while a
background revalidation runs, without shifting or blanking the cached content.
`useOpenChoreoQuery`/`useOpenChoreoInfiniteQuery` already expose `isRefetching`;
the data hooks across the portal now thread it through, and the home dashboard,
plane cards, access-control, secrets, project, environment, workflow and
observability surfaces render the overlay from it. `SummaryWidgetWrapper` gained
a `refreshing` prop so the home summary widgets get it for free.
