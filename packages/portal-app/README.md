# @openchoreo/backstage-portal-app

The OpenChoreo Portal's frontend shell: app assembly, sign-in, navigation,
custom catalog/entity/scaffolder pages, and scaffolder field extensions.

## Installing

The `./alpha` entry point default-exports a [feature loader][discovery]
carrying the whole portal, so [frontend feature discovery][discovery] installs
it from the dependency alone. Add the package, turn discovery on, and the app
package needs no `features` array — this is what the stock portal does:

```yaml
# app-config.yaml
app:
  packages: all
```

```tsx
// packages/app/src/App.tsx
import { createApp } from '@backstage/frontend-defaults';
import { PageLoader } from '@openchoreo/backstage-design-system';

export default createApp({
  // Optional. Branded Suspense fallback, rendered before any feature loads —
  // the one thing a feature cannot contribute. Omit it for Backstage's spinner.
  advanced: { loadingElement: <PageLoader /> },
}).createRoot();
```

Your own plugins go in the same way: add the dependency, and discovery picks up
whatever its root or `./alpha` entry point default-exports. For anything
discovery cannot reach — a plugin that only has named exports, or a module you
want applied in a specific position — pass it to `createApp({ features })` as
usual; discovered features are installed ahead of those.

`createPortalApp` is the no-config alternative, for a host that would rather
call one function than edit `app-config.yaml`:

```tsx
import { createPortalApp } from '@openchoreo/backstage-portal-app';

export default createPortalApp().createRoot();
```

```tsx
export default createPortalApp({
  features: [myPluginAlpha],
}).createRoot();
```

It reads the same loader, so the two paths cannot drift, and using both at once
is safe — feature loaders are de-duplicated by reference.

No route bindings are needed either way: all five the portal relies on
(catalog → scaffolder/techdocs, scaffolder → catalog-import/techdocs) are
already the upstream `defaultTarget` of each external route ref.

[discovery]: https://backstage.io/docs/frontend-system/building-apps/installing-plugins

## Status

Published in lockstep with the rest of `@openchoreo/*`: every release ships
this package at the same version as the plugins it composes, so one version
number identifies a whole portal. The shell carries no dependency on the
private Portal Assistant: the assistant ships its own wiring from
`@openchoreo/backstage-plugin-openchoreo-portal-assistant/alpha`, and the stock
`app` package installs it through discovery like any other plugin.
