---
'@openchoreo/backstage-plugin': minor
---

Contribute Access Control and Secrets as tabs on Backstage's user-settings
page, so a host that installs the plugin gets them without wiring anything.

`AccessControlPage` and `SecretsPage` were exported as plain components.
Nothing mounted them, they had no route, and feature discovery could not
surface them — the only page this plugin registered was the exec terminal.

They now ship as `SubPageBlueprint` extensions attached to `page:user-settings`
at `access-control` and `secrets`. Settings tabs rather than standalone pages,
because that is where the OpenChoreo portal already places them: every host
ends up with the same layout instead of the portal and its adopters diverging.
A host that would rather place them itself can switch them off through
`app.extensions`.

Adds a `secretsRouteRef` alongside the existing `accessControlRouteRef` and
exposes it on the plugin's `routes` map for binding.
