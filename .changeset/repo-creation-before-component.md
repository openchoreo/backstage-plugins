---
'@openchoreo/backstage-plugin': patch
'@openchoreo/backstage-plugin-catalog-backend-module': patch
---

Add the ability to create a git repository as part of creating an OpenChoreo
component, in a single scaffolder flow.

**Dynamic component templates (provider-agnostic).** The generated per-ComponentType
templates now offer an "Use existing repository / Create new repository" choice in
the Build-from-Source flow. Available git providers are discovered from
`integrations.*`, so whatever is configured (GitHub, GitLab, Bitbucket, …) is
offered without code changes; the converter emits one conditional `publish:<provider>`
step per configured provider and resolves the created repo URL back into the build
workflow. The provider picker only appears when more than one provider is configured.

- New config `openchoreo.scaffolder.repoCreation.enabled` (default `true`) is a master
  switch — when `false`, the create/existing toggle and the fetch/publish steps are
  omitted entirely (existing-repo only). It is set to `false` in
  `app-config.production.yaml`.
- New config `openchoreo.scaffolder.starterSkeletons` seeds created repos with
  buildable content. When set, a curated runtime dropdown is shown and the skeleton is
  fetched via `fetch:template`; when absent, an optional "Starter Template URL" field is
  shown (`fetch:plain`), and leaving it blank creates an empty repo.

**New "Component with New Repository" template** (`create-component-with-repo`) —
creates a GitHub repository (optionally seeded) and a component in one flow, with
runtime ComponentType selection (schema-driven parameters) and build workflow selection.
Review-step presentation is controlled via native `ui:backstage.review` hints in the
template.

**Scaffolder field extensions** — adds `ComponentTypeSelectorField` and `RepoCreateField`;
`GitSourceField` gains the create-repo UI; `BuildWorkflowPicker` and
`BuildWorkflowParameters` gain additive fallbacks so they work when the component type is
chosen at runtime. Existing dynamic templates are unaffected when repo creation is not
configured.
