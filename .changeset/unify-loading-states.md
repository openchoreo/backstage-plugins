---
'@openchoreo/backstage-design-system': minor
'@openchoreo/backstage-plugin-react': minor
'@openchoreo/backstage-plugin': patch
'@openchoreo/backstage-plugin-openchoreo-observability': patch
'@openchoreo/backstage-plugin-openchoreo-ci': patch
'@openchoreo/backstage-plugin-openchoreo-workflows': patch
'@openchoreo/backstage-plugin-platform-engineer-core': patch
---

Unify portal loading states behind a shared, token-driven system so every
loader looks and behaves consistently.

**New shared components**

- **design-system**: `Skeleton` (token-driven shimmer — `text`/`rect`/`circle`
  with a `count` for stacked lines, backed by new `motion` timing tokens),
  `Spinner` (theme-coloured circular loader with named sizes
  `chip`/`button`/`inline`/`page`), and `PageLoader` (centered `Spinner` for
  page/route/section loads).
- **backstage-plugin-react**: `ContentLoader` (loading/error/empty/content
  wrapper that keeps content on screen and overlays a spinner during a
  background refetch instead of blanking) and `SkeletonRows` (table-body
  skeleton helper).

**Consistency changes**

- Tables now show skeleton rows instead of a circular overlay (catalog,
  Project Contents, namespace cards, observability RCA/Cost Analysis, and the
  raw-MUI alert/incident/log tables).
- Overview cards and widgets render skeleton placeholders via the shared
  `Skeleton` (including the home-page platform-planes section).
- Page-level loaders use the centered `PageLoader` instead of the Backstage
  progress bar — including Backstage's internal route/Suspense fallback and the
  app-boot loader.
- Status chips use the themed `Spinner` (removing a hardcoded spinner colour).
- The shared `ErrorState` icon is sized down to read proportionately in
  section-level errors.

Prefer `Skeleton`/`Spinner`/`PageLoader` and `ContentLoader` over raw MUI
`Skeleton`/`CircularProgress`/`Progress` for new loading states.
