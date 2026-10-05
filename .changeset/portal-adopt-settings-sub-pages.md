---
'@openchoreo/backstage-portal-app': patch
---

Adopt the shipped Access Control and Secrets settings sub-pages instead of overriding the whole `/settings` page.

Portal-app used to override `page:user-settings` with a hand-authored
`OpenChoreoUserSettingsPage` so Auth Providers and Feature Flags would not
appear. Now that `@openchoreo/backstage-plugin` contributes Access Control
and Secrets as `SubPageBlueprint` extensions, portal-app does the same thing
with far less code:

- Drops the `page:user-settings` override and the `OpenChoreoUserSettingsPage`
  component.
- Hides `sub-page:user-settings/auth-providers` and
  `sub-page:user-settings/feature-flags` through `app.extensions` in
  `app-config.yaml` and `app-config.production.yaml`.
- Narrowly overrides `sub-page:user-settings/general` with a new
  `OpenChoreoGeneralSettings` component so the portal keeps the fourth
  `PlatformAboutCard` grid card next to upstream's Profile / Appearance /
  Identity cards.

Net result is the same three visible tabs — General, Access Control, Secrets
— but every host that installs the plugins now gets the OpenChoreo settings
layout rather than only the portal.
