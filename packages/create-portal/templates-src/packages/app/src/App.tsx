import { createApp } from '@backstage/frontend-defaults';
import { PageLoader } from '@openchoreo/backstage-design-system';

// No `features` array. `app.packages` in app-config.yaml turns on frontend
// feature discovery, which installs every dependency of this package that
// default-exports a frontend feature from its root or `./alpha` entry point.
// `@openchoreo/backstage-portal-app` is one of them: it carries the whole
// OpenChoreo portal.
//
// Adding a plugin to your portal is therefore `yarn add` plus nothing. For
// anything discovery cannot reach (a plugin with only named exports, or a
// module of your own), pass it here: `createApp({ features: [...] })`. To
// replace an extension the portal provides, pass a frontend module for the
// plugin that owns it (see the README); an extension with the same ID from
// anywhere else is ignored.
//
// The `loadingElement` stays here because it is the only piece a feature
// cannot supply: it is the Suspense fallback rendered before any feature
// exists.
export default createApp({
  advanced: {
    loadingElement: <PageLoader />,
  },
}).createRoot();
