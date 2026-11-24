---
'@openchoreo/backstage-plugin-tech-insights-backend-module-dynamic-checks': patch
---

The OpenChoreo starter checks on plain-text secrets and pinned images judge every environment a
line is bound to, through `openchoreoEnvironmentDeployments`. Starter checks are seeded once, so a
database seeded by an earlier version keeps its earlier versions of these two checks. Their facts
no longer exist, so they show as checks that can't be evaluated; edit them onto
`openchoreoEnvironmentDeployments` or delete them.
