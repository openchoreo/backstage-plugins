---
'@openchoreo/backstage-plugin-tech-insights-backend-module-dynamic-checks': minor
---

Explain conditions with a `path` in dry run. Each such condition carries the
value the path selected (`factResult`) and a preview of the fact it selected
from (`factPreview`, the fact's JSON cut to 300 characters, with
`factPreviewTruncated` when cut). When the path selected nothing, the
condition is marked `selectedNothing` and the result has an `empty-selection`
reason saying so. For `everyFact:` and `someFact:` the reason also says
whether the condition, including any `not` around it, passed or failed only
because nothing was selected.
