---
'app': patch
---

Preselect the project and namespace in the create wizard when launched from a project overview. The template list page now carries the `project` and `namespace` query params forward when navigating to the selected template's form, so `ProjectNamespaceField` preselects the originating project instead of falling back to the default.
