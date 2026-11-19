---
'@openchoreo/backstage-plugin-tech-insights-backend-module-github': patch
---

Report only `githubRepositoryResolved: false` for a component whose GitHub repository or branch
can't be read, instead of setting every other fact to null. Checks on those facts now skip the
component instead of failing it.
