---
'@openchoreo/backstage-plugin-tech-insights-backend-module-dynamic-checks': minor
---

An entity's check results and facts now follow access to the entity. Running
checks for one entity, and reading its latest facts or their history, answer
403 when the caller can't read the entity in the catalog. The bulk check run
lets holders of the dynamic-check read permission through; anyone else must be
able to read every entity they list.
