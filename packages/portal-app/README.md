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

This package is **published** as part of the lockstep OpenChoreo release. The
shell is fully on the new frontend system and has no dependency on any private
plugin: optional assistant features integrate through the
`portalAssistantIntegrationApiRef` slots (see `usePortalAssistant`), which
render nothing when no implementation is registered. The stock portal injects
its assistant via `createPortalApp({ features })`; custom portals simply omit
it.
