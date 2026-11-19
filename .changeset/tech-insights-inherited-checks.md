---
'@openchoreo/backstage-plugin-tech-insights-backend-module-dynamic-checks': minor
---

Add `techInsights.dynamicChecks.inheritChecks`, which lets the entities of a kind run every check
that matches their parent entity, against their own facts. The OpenChoreo app-configs turn it on
for release lines, so a release line runs its component's checks, starter checks included, without
ReleaseLine being added to their filters.
