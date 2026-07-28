---
'@openchoreo/backstage-design-system': minor
---

Add app-config-driven branding groundwork: `resolveBrandTokens(base, brand?)`
pure helper (brand primary → derived token slots; identity when no overrides)
and `ChoreoTokensProvider` with a context-aware `useChoreoTokens`. The portal
app gains an `app.branding.*` frontend-visible config schema (name, iconLogo,
fullLogo, theme.light/dark.primaryColor) wired into the theme providers,
sidebar logos, and sign-in card. Default behavior with no branding config is
unchanged.
