---
'@openchoreo/backstage-design-system': minor
'@openchoreo/backstage-plugin': minor
'@openchoreo/backstage-plugin-backend': minor
---

Show a "Suspended" status in the deployment pipeline when a component's workload is scaled to zero. The backend reads the suspended state that core already reports on the ReleaseBinding's ResourcesReady condition, and the pipeline badge now shows "Suspended" instead of "Active" for a scaled-to-zero workload.
