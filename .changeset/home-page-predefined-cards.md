---
'@openchoreo/backstage-plugin-common': patch
---

Home page predefined cards:

- Add `openchoreo.home.cardConfig` config key (frontend visibility) selecting
  the named predefined card layout rendered on the portal home page (default:
  `choreo-default`).
- The home page renders its cards from a card registry + named layout configs
  (search, my-projects, quick-actions, recent-deployments, starred-entities,
  recently-visited, permission-gated platform-details).
- New `RecentDeploymentsCard` showing the latest releases across the user's
  components with per-environment status.
