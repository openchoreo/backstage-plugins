---
'@openchoreo/backstage-plugin-common': minor
'@openchoreo/backstage-plugin-backend': minor
'@openchoreo/backstage-plugin': minor
---

Surface OpenChoreo controller auto-deploy failures in the Deploy tab and Setup card. Pre-binding release-generation failures (bad trait, invalid config — from `Component.status.conditions`) now flip the first environment from a silent "Not Deployed" to "Failed" with the controller's reason, and show inline on the Setup card after an auto-deploy save. Post-binding render/apply failures (from `ReleaseBinding.status.conditions`) now show an actionable error banner with the controller's message in the environment detail panel, instead of a context-free "Failed" badge.
