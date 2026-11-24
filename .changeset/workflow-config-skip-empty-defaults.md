---
'@openchoreo/backstage-plugin-openchoreo-ci': patch
---

Stop the build configuration editor from adding empty schema-default fields
(such as `repository.secretRef` and `repository.revision.commit`) as new
changes when they were never set. Only fields the user actually changed are
shown in the confirmation dialog and saved (openchoreo/openchoreo#5344).
