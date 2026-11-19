---
'@openchoreo/backstage-plugin-tech-insights-backend-module-openchoreo': minor
---

Report deployment and build facts for each ReleaseLine, read from the line's own Workload, release
bindings, workflow runs and latest release. A Component's facts now describe its main line only.
They no longer count other lines' bindings, so a line in production doesn't put its component
there, and its build facts no longer count other lines' runs.
