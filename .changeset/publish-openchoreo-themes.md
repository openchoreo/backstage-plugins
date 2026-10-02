---
'@openchoreo/backstage-design-system': minor
'@openchoreo/backstage-plugin': minor
---

Ship the OpenChoreo light and dark themes to every host that installs the
plugins, instead of keeping them private to the portal.

The built `AppTheme` entries, the `app.branding` reader, and the config schema
that declares it all lived in `packages/portal-app`, which is not published. An
external Backstage app installing the OpenChoreo plugins therefore rendered our
surfaces against the stock Backstage palette: wrong contrast, a dark mode that
painted `--bui-bg-app` grey, and no way to set a brand color.

The design system now owns them. It exports `appThemes` plus `useBranding`,
`brandName`, `readBrandingConfig`, and `DEFAULT_BRAND_NAME`, and carries the
`app.branding.*` config schema. `openChoreoAppModule` registers both themes as
`ThemeBlueprint` extensions, so feature discovery hands them to any host. They
are additive — the host's own themes stay in the picker, and either can be
turned off through `app.extensions`.

`theme.light.primaryColor` and `theme.dark.primaryColor` now apply anywhere the
themes are registered. `name`, `iconLogo`, and `fullLogo` still drive only the
OpenChoreo portal's sidebar and sign-in card, since a host supplies its own
app shell.
