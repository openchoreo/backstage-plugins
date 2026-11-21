---
'@openchoreo/backstage-plugin-openchoreo-ci-backend': patch
---

Fall back to Observer when live WorkflowRun logs are empty for terminal runs.
`hasLiveObservability` stays true while the Argo Workflow CR exists, but live
`/logs` reads pods — after `podGC.strategy: OnWorkflowSuccess` those pods are
gone and the CI plugin previously returned `[]`. Aligns with
`GenericWorkflowService.getWorkflowRunLogs` (skip Observer fallback for
incremental `sinceSeconds` polls while still running).
