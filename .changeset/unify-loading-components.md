---
'@openchoreo/backstage-design-system': patch
'@openchoreo/backstage-plugin-react': patch
'@openchoreo/backstage-plugin-openchoreo-observability': patch
---

Add a unified loading system to standardize portal loading states. New
`Skeleton` primitive (token-driven shimmer) in the design system, plus
`ContentLoader` and `SkeletonRows` in the React plugin. `ContentLoader`
keeps content on screen during a background refetch (overlay spinner
instead of a full swap), fixing cards that "pop in and out" on slow
networks. Applied to the observability Alerts and Incidents views: the
alerts list no longer blanks on refresh, and the permission gate shows a
stable page skeleton instead of a top progress bar.
