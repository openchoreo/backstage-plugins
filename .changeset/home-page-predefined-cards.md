---
'@openchoreo/backstage-portal-app': patch
---

Add predefined home page card modules (not yet wired into the home page):

- A home card registry + named layout configs (search, my-projects,
  quick-actions, recent-deployments, starred-entities, recently-visited,
  permission-gated platform-details) under `components/Home/cards`.
- New `RecentDeploymentsCard` showing the latest releases across the user's
  components with per-environment status.
- Shared `getRelativeTime` helper (also adopted by `RecentlyVisitedCard`).

The current home page is unchanged; a follow-up will render it from the
card registry.
