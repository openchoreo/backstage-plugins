---
'@openchoreo/backstage-plugin': minor
'@openchoreo/backstage-plugin-react': minor
'@openchoreo/backstage-plugin-common': minor
---

Add a Deploy tab to Endpoint entities. It shows the project's deployment
pipeline with each environment's status, the release pinned there, and
whether it is behind the environment before it. From the tab you can:

- deploy the Endpoint's latest release to the first environment from Set up,
  and promote it forward;
- see how each backend resolved in an environment: its in-cluster address, or
  why it did not resolve;
- edit per-environment overrides against the pinned release's schema;
- view the release manifest, or remove the deployment from an environment.

These actions are gated by new `openchoreo.endpointreleasebinding.create`,
`.update` and `.delete` permissions, scoped per environment.

The pipeline canvas and release manifest dialog are now shared between the
Resource and Endpoint Deploy tabs.
