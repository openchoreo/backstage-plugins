# @openchoreo/backstage-portal-app

The OpenChoreo Portal's frontend shell: app assembly, sign-in, navigation,
custom catalog/entity/scaffolder pages, and scaffolder field extensions,
built entirely on the Backstage
[New Frontend System](https://backstage.io/docs/frontend-system/). The stock
portal's `app` package is a thin consumer:

```tsx
import { createPortalApp } from '@openchoreo/backstage-portal-app';

export default createPortalApp().createRoot();
```

The fastest way to build your own portal on this package is
[`npx @openchoreo/create-portal`](https://github.com/openchoreo/backstage-plugins/tree/main/packages/create-portal), which scaffolds
a ready-to-run Backstage app (frontend + backend + Dockerfile) pinned to one
OpenChoreo release.

## API

| Export                                                   | Purpose                                                                                   |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `createPortalApp(options?)`                              | Assembles the portal app. Returns Backstage's app; call `.createRoot()` to render it.     |
| `PortalAppOptions`                                       | `{ features?: FrontendFeature[] }` — extra plugins/modules loaded after the portal's own. |
| `useBranding()`, `brandName`, `DEFAULT_BRAND_NAME`       | Read the `app.branding.*` config (product name, logos, brand colors).                     |
| `portalAssistantIntegrationApiRef`, `usePortalAssistant` | The optional assistant integration seam (see below). Re-exported from `plugin-react`.     |

### Adding your own features

```tsx
import { createPortalApp } from '@openchoreo/backstage-portal-app';
import myPlugin from '@acme/backstage-plugin-my-plugin/alpha';

export default createPortalApp({ features: [myPlugin] }).createRoot();
```

Features passed here load after the portal's own, so an extension you
contribute with the same ID as a built-in one replaces it. Individual
extensions can also be disabled or reconfigured without code through
`app.extensions` in `app-config.yaml`.

### Branding

Product name, logos, and brand colors are runtime configuration under
`app.branding` — see `config.d.ts` for the schema. No rebuild is needed.

## Assistant integration seam

This package has **no dependency on any AI-assistant implementation**. The
portal shell and the OpenChoreo plugins expose optional slots through
`portalAssistantIntegrationApiRef` (the contract lives in
`@openchoreo/backstage-plugin-react`, so plugins can consume it without
depending on this shell):

| Slot                      | Where it renders                                                      |
| ------------------------- | --------------------------------------------------------------------- |
| `AppWrapper`              | Around the routed app, at the root — e.g. a global assistant drawer.  |
| `BuildFailureNotifier`    | Component Overview and Build tabs — e.g. a "build failed" prompt.     |
| `renderInvestigateAction` | Deploy panel, on a pending or failed deployment — an investigate CTA. |

When nothing is registered every slot renders nothing, so a portal without an
assistant shows no trace of one. To fill the slots, register an
implementation from your app:

```tsx
import {
  ApiBlueprint,
  createFrontendModule,
} from '@backstage/frontend-plugin-api';
import {
  createPortalApp,
  portalAssistantIntegrationApiRef,
} from '@openchoreo/backstage-portal-app';

const assistantModule = createFrontendModule({
  pluginId: 'app',
  extensions: [
    ApiBlueprint.make({
      name: 'assistant-integration',
      params: defineParams =>
        defineParams({
          api: portalAssistantIntegrationApiRef,
          deps: {},
          factory: () => ({
            AppWrapper: MyAssistantDrawer,
            BuildFailureNotifier: MyBuildFailurePrompt,
            renderInvestigateAction: scope => <MyInvestigate {...scope} />,
          }),
        }),
    }),
  ],
});

export default createPortalApp({ features: [assistantModule] }).createRoot();
```

The stock OpenChoreo portal wires its own Portal Assistant exactly this way
in `packages/app/src/assistant.tsx`, which keeps that private plugin out of
this published package.
