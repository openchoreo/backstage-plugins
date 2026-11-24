---
'@openchoreo/backstage-plugin-tech-insights-backend-module-dynamic-checks': minor
---

Explain conditions with a `path` in dry run. Each such condition carries the
whole fact as `factValue` beside the value the path selected (`factResult`).
When the path selected nothing, the condition is marked `selectedNothing` and
the result has an `empty-selection` reason saying so. For `everyFact:` and
`someFact:` the reason also says whether the condition passed or failed only
because nothing was selected.
