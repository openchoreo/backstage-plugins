---
'@openchoreo/backstage-plugin-tech-insights-scorecards': minor
---

Add `CheckAuthoringAssistantBlueprint` (alpha), an extension blueprint for an
assistant that writes checks. When an app installs one, the Create button
offers Manual and Generate with AI, and the check edit page and dialog offer
to edit a check with AI, reloading the form after the assistant saves it.
Export `factFieldsOf`, `kindsOfFilter` and `DryRunEntityField`, which now
takes an optional `label` and `disabled`.
