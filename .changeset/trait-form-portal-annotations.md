---
'@openchoreo/backstage-plugin': minor
---

Render trait configuration forms using `x-openchoreo-backstage-portal` schema annotations. The Add/Edit trait dialogs now fold these vendor extensions (e.g. `ui:order`, `ui:widget`, `ui:title`, `ui:placeholder`) into the RJSF uiSchema, letting trait authors control form rendering. Traits without annotations are unaffected.
