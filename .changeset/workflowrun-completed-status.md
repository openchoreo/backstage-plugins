---
'@openchoreo/backstage-plugin-common': patch
'@openchoreo/backstage-plugin-openchoreo-workflows-backend': patch
'@openchoreo/backstage-plugin-openchoreo-ci-backend': patch
'@openchoreo/backstage-plugin-backend': patch
---

Map WorkflowRun UI status from `WorkflowCompleted` condition reasons (and typed
`WorkflowFailed`/`WorkflowSucceeded`), so completed failures no longer show as
Pending when only the aggregate condition is present.
