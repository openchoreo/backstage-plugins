---
'app': patch
'backend': patch
---

Wire up the "create a repository before a component" scaffolder feature at the app
level:

- Register the new `create-component-with-repo` template and ship `nodejs`/`python`
  starter skeletons under `skeletons/`.
- Disable in-wizard repo creation in production via
  `openchoreo.scaffolder.repoCreation.enabled: false` in `app-config.production.yaml`.

Repo creation for the dynamic component templates is opt-in: set
`integrations.*` (providers) and `openchoreo.scaffolder.starterSkeletons` in your
`app-config` to enable it. See the new package changeset for details.
