# @openchoreo/backstage-design-system

The shared design system behind the OpenChoreo Backstage plugins and the OpenChoreo
Portal: the Backstage theme, design tokens, icons, and the UI primitives the plugins
build on.

You do not normally install this yourself: it is an ordinary dependency of the
OpenChoreo frontend plugins, so adding `@openchoreo/backstage-plugin` brings it along.
Add it directly only if you import the theme or components into your own code.

## What's in here

- `openChoreoTheme` / `openChoreoDarkTheme` — the prebuilt Backstage themes, and
  `buildOpenChoreoTheme` to build one from your own tokens.
- `appThemes` — the same two themes as `AppTheme` entries, ready for
  `ThemeBlueprint`. `@openchoreo/backstage-plugin` already registers these, so an
  app that installs the plugins gets them without touching this package.
- `lightTokens` / `darkTokens` / `useChoreoTokens` — the design tokens, including
  the extended set (graph, entity-kind palettes) that MUI's theme has no slot for.
- `useBranding` / `brandName` / `readBrandingConfig` — readers for `app.branding.*`,
  whose schema this package declares. `resolveBrandTokens` applies a brand accent
  to a token set.
- UI primitives — `Card`, `StatusBadge`, `Spinner`, `YamlViewer`, and the rest.

## Installation

```bash
yarn workspace app add @openchoreo/backstage-design-system
```

**Full setup instructions**:
[Installing into an existing Backstage app](https://openchoreo.dev/docs/platform-engineer-guide/backstage-plugins/installing-into-existing-backstage/).

## License

Apache-2.0
