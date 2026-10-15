# @openchoreo/backstage-portal-app

The OpenChoreo Portal's frontend shell: app assembly, sign-in, navigation,
custom catalog/entity/scaffolder pages, and scaffolder field extensions. The
stock portal's `app` package is a thin consumer:

```tsx
import { createPortalApp } from '@openchoreo/backstage-portal-app';

export default createPortalApp().createRoot();
```

A custom portal adds its own plugins via options:

```tsx
export default createPortalApp({
  features: [myPluginAlpha],
}).createRoot();
```

## Status

This package is **private for now**. It is the landing place for app-shell
pieces as they are migrated to the new frontend system — parts of the shell
still run through `@backstage/core-compat-api` (legacy bridge) and are being
migrated piece by piece. The shell no longer depends on the private
portal-assistant plugin: the assistant ships its own wiring from
`@openchoreo/backstage-plugin-openchoreo-portal-assistant/alpha` and the `app`
package installs it. Removing the legacy-bridged internals is the remaining
blocker; that PR flips `private` and adds the
package to the changeset linked group.
